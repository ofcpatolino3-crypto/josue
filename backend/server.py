from dotenv import load_dotenv
load_dotenv()

import os
import time
import uuid
import jwt
import bcrypt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

# ----------------------------------------------------------------------------
# Config & DB
# ----------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
COOKIE_NAME = "pc_token"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Portal Concursos API")

_origins = os.environ.get("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",")] if _origins != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

# ----------------------------------------------------------------------------
# Password & JWT helpers
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(uid: str, email: str) -> str:
    payload = {
        "sub": uid,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def now_ms() -> int:
    return int(time.time() * 1000)


def sanitize_profile(doc: dict) -> dict:
    if not doc:
        return doc
    out = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
    return out


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.auth_users.find_one({"uid": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=604800,
        path="/",
    )


# ----------------------------------------------------------------------------
# Startup: seed master admin + indexes
# ----------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.auth_users.create_index("email", unique=True, sparse=True)
    await db.auth_users.create_index("username", sparse=True)
    await db.auth_users.create_index("uid", unique=True)
    await db.user_contacts.create_index("_owner")
    await db.user_templates.create_index("_owner")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@portal.com").lower()
    admin_user = os.environ.get("ADMIN_USERNAME", "admin").lower()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_name = os.environ.get("ADMIN_NAME", "Administrador Master")

    existing = await db.auth_users.find_one({"email": admin_email})
    if existing is None:
        uid = "master_admin_root"
        doc = {
            "uid": uid,
            "email": admin_email,
            "username": admin_user,
            "name": admin_name,
            "role": "admin",
            "status": "approved",
            "password_hash": hash_password(admin_pass),
            "createdAt": now_ms(),
            "approvedAt": now_ms(),
            "approvedBy": "system",
        }
        await db.auth_users.insert_one(doc)
        await db.user_profiles.update_one(
            {"uid": uid},
            {"$set": {
                "uid": uid, "email": admin_email, "username": admin_user,
                "displayName": admin_name, "role": "admin", "status": "approved",
                "createdAt": now_ms(), "approvedAt": now_ms(), "approvedBy": "system",
            }},
            upsert=True,
        )
    else:
        # keep master password in sync with env
        if not verify_password(admin_pass, existing.get("password_hash", "")):
            await db.auth_users.update_one(
                {"uid": existing["uid"]},
                {"$set": {"password_hash": hash_password(admin_pass), "role": "admin", "status": "approved"}},
            )


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
MASTER_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@portal.com").lower()
MASTER_USERNAME = os.environ.get("ADMIN_USERNAME", "admin").lower()


class RegisterIn(BaseModel):
    name: str
    emailOrUser: str
    password: str


class LoginIn(BaseModel):
    emailOrUser: str
    password: str


class AdminCreateIn(BaseModel):
    name: str
    emailOrUser: str
    password: str
    role: str = "attendant"


def build_profile(u: dict) -> dict:
    return {
        "uid": u["uid"],
        "email": u.get("email", ""),
        "username": u.get("username", ""),
        "displayName": u.get("name", ""),
        "role": u.get("role", "attendant"),
        "status": u.get("status", "approved"),
        "createdAt": u.get("createdAt", now_ms()),
        "approvedAt": u.get("approvedAt"),
        "approvedBy": u.get("approvedBy"),
    }


async def _create_user(name: str, email_or_user: str, password: str, role: str, status: str, approved_by: str) -> dict:
    clean = email_or_user.strip().lower()
    is_master = clean == MASTER_EMAIL or clean == MASTER_USERNAME
    email = clean if "@" in clean else f"{clean}@portal.com"
    username = clean
    dup = await db.auth_users.find_one({"$or": [{"email": email}, {"username": username}]})
    if dup:
        raise HTTPException(status_code=409, detail="Já existe uma conta com este e-mail ou usuário.")
    uid = "usr_" + uuid.uuid4().hex[:16]
    if is_master:
        role, status = "admin", "approved"
    auth_doc = {
        "uid": uid, "email": email, "username": username, "name": name.strip(),
        "role": role, "status": status, "password_hash": hash_password(password),
        "createdAt": now_ms(), "approvedAt": now_ms() if status == "approved" else None,
        "approvedBy": approved_by,
    }
    await db.auth_users.insert_one(auth_doc)
    profile = build_profile(auth_doc)
    await db.user_profiles.update_one({"uid": uid}, {"$set": profile}, upsert=True)
    return auth_doc


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    auth_doc = await _create_user(body.name, body.emailOrUser, body.password, "attendant", "approved", "auto")
    token = create_token(auth_doc["uid"], auth_doc["email"])
    set_auth_cookie(response, token)
    return {"profile": build_profile(auth_doc), "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    clean = body.emailOrUser.strip().lower()
    user = await db.auth_users.find_one({"$or": [{"email": clean}, {"username": clean}]})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado. Crie sua conta primeiro.")
    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Senha incorreta. Tente novamente.")
    if user.get("status") == "blocked":
        raise HTTPException(status_code=403, detail="Sua conta está bloqueada pelo Administrador.")
    token = create_token(user["uid"], user["email"])
    set_auth_cookie(response, token)
    # refresh the public profile snapshot
    await db.user_profiles.update_one({"uid": user["uid"]}, {"$set": build_profile(user)}, upsert=True)
    return {"profile": build_profile(user), "token": token}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"profile": build_profile(user)}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@api.post("/auth/admin-create")
async def admin_create(body: AdminCreateIn, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas o Administrador pode criar usuários.")
    role = body.role if body.role in ("admin", "supervisor", "attendant") else "attendant"
    auth_doc = await _create_user(body.name, body.emailOrUser, body.password, role, "approved",
                                  user.get("name", "admin"))
    return {"profile": build_profile(auth_doc)}


# ----------------------------------------------------------------------------
# Firestore-compatible store (documents / collections / batch)
# ----------------------------------------------------------------------------
CONTACT_LIKE = {"global_contacts", "lead_batches", "user_profiles"}


def _map_collection(path: list[str]):
    """Return (mongo_collection, filter, owner_uid, kind)."""
    if len(path) == 1 and path[0] in CONTACT_LIKE:
        return path[0], {}, None, path[0]
    if len(path) == 3 and path[0] == "users" and path[2] in ("contacts", "templates"):
        uid = path[1]
        coll = "user_contacts" if path[2] == "contacts" else "user_templates"
        return coll, {"_owner": uid}, uid, coll
    raise HTTPException(status_code=400, detail=f"Coleção inválida: {'/'.join(path)}")


def _map_doc(path: list[str]):
    """Return (mongo_collection, _id, owner_uid)."""
    if len(path) == 2 and path[0] in CONTACT_LIKE:
        return path[0], path[1], None
    if len(path) == 4 and path[0] == "users" and path[2] in ("contacts", "templates"):
        uid = path[1]
        coll = "user_contacts" if path[2] == "contacts" else "user_templates"
        return coll, f"{uid}__{path[3]}", uid
    raise HTTPException(status_code=400, detail=f"Documento inválido: {'/'.join(path)}")


def _is_privileged(user: dict) -> bool:
    return user.get("role") in ("admin", "supervisor")


def _clean_doc(doc: dict, kind: str) -> dict:
    out = {k: v for k, v in doc.items() if k not in ("_id", "_owner", "_docid")}
    if kind == "user_profiles":
        out.pop("password_hash", None)
    return out


def _doc_id(doc: dict, coll: str) -> str:
    if coll in ("user_contacts", "user_templates"):
        return doc.get("_docid", "")
    if coll == "user_profiles":
        return doc.get("uid", str(doc.get("_id", "")))
    return doc.get("id", str(doc.get("_id", "")))


@api.get("/store/collection")
async def store_collection(request: Request, user: dict = Depends(get_current_user)):
    path = request.query_params.getlist("path")
    coll, flt, owner, kind = _map_collection(path)
    top = path[0]
    if top in ("global_contacts", "lead_batches") and not _is_privileged(user):
        raise HTTPException(status_code=403, detail="Acesso restrito ao Administrador.")
    if top == "user_profiles" and not _is_privileged(user):
        flt = {"uid": user["uid"]}
    if top == "users" and owner != user["uid"] and not _is_privileged(user):
        raise HTTPException(status_code=403, detail="Acesso negado a dados de outro usuário.")
    docs = []
    async for d in db[coll].find(flt):
        docs.append({"id": _doc_id(d, coll), "data": _clean_doc(d, kind)})
    return {"docs": docs}


@api.get("/store/doc")
async def store_get_doc(request: Request, user: dict = Depends(get_current_user)):
    path = request.query_params.getlist("path")
    coll, _id, owner = _map_doc(path)
    top = path[0]
    if top in ("global_contacts", "lead_batches") and not _is_privileged(user):
        raise HTTPException(status_code=403, detail="Acesso restrito.")
    if top == "users" and owner != user["uid"] and not _is_privileged(user):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    d = await db[coll].find_one({"_id": _id})
    if not d:
        return {"exists": False, "id": path[-1], "data": None}
    kind = top if top in CONTACT_LIKE else coll
    return {"exists": True, "id": _doc_id(d, coll), "data": _clean_doc(d, kind)}


class DocIn(BaseModel):
    path: list[str]
    data: dict
    merge: bool = True


def _guard_write(user: dict, path: list[str], data: dict) -> dict:
    top = path[0]
    if top == "user_profiles":
        target = path[1]
        if user.get("role") == "admin":
            return data
        if user["uid"] == target:
            # non-admin cannot escalate role/status
            return {k: v for k, v in data.items() if k not in ("role", "status", "uid", "password_hash")}
        raise HTTPException(status_code=403, detail="Apenas o Administrador pode alterar outros usuários.")
    if top == "users":
        owner = path[1]
        if owner != user["uid"] and not _is_privileged(user):
            raise HTTPException(status_code=403, detail="Não é permitido gravar em outro atendente.")
    # global_contacts / lead_batches: any authenticated user may write
    return data


async def _apply_set(user: dict, path: list[str], data: dict, merge: bool):
    coll, _id, owner = _map_doc(path)
    data = _guard_write(user, path, data)
    payload = dict(data)
    if coll in ("user_contacts", "user_templates"):
        payload["_owner"] = owner
        payload["_docid"] = path[3]
    if merge:
        await db[coll].update_one({"_id": _id}, {"$set": payload}, upsert=True)
    else:
        payload["_id"] = _id
        await db[coll].replace_one({"_id": _id}, payload, upsert=True)
    # keep user_profiles auth copy consistent for role/status changes by admin
    if path[0] == "user_profiles" and user.get("role") == "admin":
        sync = {k: v for k, v in data.items() if k in ("role", "status", "approvedAt", "approvedBy", "displayName")}
        if "displayName" in sync:
            sync["name"] = sync.pop("displayName")
        if sync:
            await db.auth_users.update_one({"uid": path[1]}, {"$set": sync})


async def _apply_delete(user: dict, path: list[str]):
    coll, _id, owner = _map_doc(path)
    top = path[0]
    if top == "users" and owner != user["uid"] and not _is_privileged(user):
        raise HTTPException(status_code=403, detail="Não é permitido excluir dados de outro atendente.")
    await db[coll].delete_one({"_id": _id})


@api.put("/store/doc")
async def store_put_doc(body: DocIn, user: dict = Depends(get_current_user)):
    await _apply_set(user, body.path, body.data, body.merge)
    return {"ok": True}


@api.delete("/store/doc")
async def store_delete_doc(request: Request, user: dict = Depends(get_current_user)):
    path = request.query_params.getlist("path")
    await _apply_delete(user, path)
    return {"ok": True}


class BatchOp(BaseModel):
    type: str
    path: list[str]
    data: Optional[dict] = None
    merge: bool = True


class BatchIn(BaseModel):
    ops: list[BatchOp]


@api.post("/store/batch")
async def store_batch(body: BatchIn, user: dict = Depends(get_current_user)):
    for op in body.ops:
        if op.type == "set":
            await _apply_set(user, op.path, op.data or {}, op.merge)
        elif op.type == "delete":
            await _apply_delete(user, op.path)
    return {"ok": True, "count": len(body.ops)}


# ----------------------------------------------------------------------------
# AI (Gemini) — ported from Express, graceful fallback when no key
# ----------------------------------------------------------------------------
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"


async def _gemini_generate(system: str, user_text: str, temperature: float = 0.7) -> Optional[str]:
    if not GEMINI_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {"temperature": temperature},
    }
    try:
        async with httpx.AsyncClient(timeout=45) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print("Gemini error:", e)
        return None


@api.post("/ai/chat")
async def ai_chat(request: Request):
    body = await request.json()
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Mensagem é obrigatória.")
    context = body.get("context") or {}
    contact = context.get("currentContact")
    system = (
        "Você é o Assistente IA Especialista em Vendas & Atendimento do Portal Concurso. "
        "Ajude o atendente a converter alunos de concursos para as Assinaturas (Premium 1.0 / Elite 2.0). "
        "Tom acolhedor, empático e focado na aprovação. 100% do curso isolado vira crédito na Premium 1.0. "
        + (f"Aluno em foco: {contact}" if contact else "")
    )
    text = await _gemini_generate(system, message, 0.7)
    if text is None:
        return {
            "response": "Olá! Sou o Assistente IA do Portal Concurso. Para ativar respostas geradas por IA, "
            "configure a GEMINI_API_KEY no backend. Enquanto isso, use os scripts de objeções, planos e a esteira de contatos!",
            "source": "local_fallback",
        }
    return {"response": text, "source": "gemini"}


@api.post("/ai/generate-pitch")
async def ai_pitch(request: Request):
    body = await request.json()
    contact = body.get("contact") or {}
    objection = body.get("objection") or {}
    plan = body.get("plan") or {}
    prompt = (
        f"Crie uma mensagem calorosa e persuasiva para WhatsApp para o aluno {contact.get('nome','Aluno')}, "
        f"interesse: {contact.get('curso','Concursos')}, momento: {contact.get('temperatura','Morno')}. "
        f"Objeção: {objection.get('objecao','custo-benefício')}. Plano: {plan.get('nome','Premium 1.0')} "
        f"({plan.get('preco','12x R$ 99,70')}). Use quebras de linha duplas e CTA leve."
    )
    text = await _gemini_generate("Você redige mensagens prontas de vendas para WhatsApp do Portal Concurso.", prompt, 0.7)
    if text is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY não configurada no servidor.")
    return {"pitch": text}


async def _handle_extract(request: Request):
    body = await request.json()
    if not body.get("text") and not body.get("fileData"):
        raise HTTPException(status_code=400, detail="Nenhum texto ou arquivo fornecido.")
    if not GEMINI_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY não configurada. A extração por imagem/PDF via IA está indisponível; "
            "use a colagem de texto (OCR local) como alternativa.",
        )
    # Text-only extraction path
    if body.get("text"):
        system = (
            "Extraia contatos de alunos do texto. Retorne SOMENTE JSON: "
            '{"contacts":[{"nome":"","whatsapp":"","email":"","curso":"","temperatura":"Morno","observacao":""}]}'
        )
        text = await _gemini_generate(system, body["text"], 0.1)
        import json, re
        contacts = []
        if text:
            cleaned = re.sub(r"^```json\s*|\s*```$", "", text.strip())
            try:
                contacts = json.loads(cleaned).get("contacts", [])
            except Exception:
                contacts = []
        return {"success": True, "contacts": contacts, "totalDetected": len(contacts),
                "summary": f"{len(contacts)} contatos identificados."}
    raise HTTPException(status_code=503, detail="Extração de imagem indisponível sem configuração adicional.")


@api.post("/ai/extract-contacts")
async def ai_extract(request: Request):
    return await _handle_extract(request)


@api.post("/extract-contacts")
async def extract2(request: Request):
    return await _handle_extract(request)


@api.post("/contacts/extract")
async def extract3(request: Request):
    return await _handle_extract(request)


@api.post("/ai/ocr")
async def extract4(request: Request):
    return await _handle_extract(request)


# ----------------------------------------------------------------------------
# Email (SendGrid) — ported, graceful fallback when no key
# ----------------------------------------------------------------------------
@api.get("/email/status")
async def email_status():
    key = os.environ.get("SENDGRID_API_KEY", "")
    from_email = os.environ.get("SENDGRID_FROM_EMAIL", "")
    return {"configured": bool(key), "hasFromEmail": bool(from_email),
            "fromEmail": from_email or None, "provider": "sendgrid"}


def _fill_vars(template: str, c: dict) -> str:
    first = (c.get("nome") or "Aluno").strip().split(" ")[0]
    repl = {
        "{nome}": c.get("nome", "Aluno"), "{primeiro_nome}": first, "{primeironome}": first,
        "{curso}": c.get("curso", "Concursos Públicos"), "{whatsapp}": c.get("whatsapp", ""),
        "{telefone}": c.get("whatsapp", ""), "{email}": c.get("email", ""),
        "{observacao}": c.get("observacao", ""), "{status}": c.get("status", ""),
        "{temperatura}": c.get("temperatura", ""),
    }
    out = template
    for k, v in repl.items():
        for variant in (k, k.upper(), k.capitalize()):
            out = out.replace(variant, str(v))
    return out


def _email_html(subject: str, body_text: str, cta_link: str, cta_text: str) -> str:
    paragraphs = "".join(
        f'<p style="margin:0 0 16px 0;line-height:1.6;">{p.replace(chr(10), "<br/>")}</p>'
        for p in body_text.split("\n\n")
    )
    is_wa = "wa.me" in cta_link or "whatsapp.com" in cta_link
    cta = ""
    if cta_link and cta_text:
        color = "#25D366" if is_wa else "#059669"
        cta = (f'<div style="text-align:center;margin:32px 0;"><a href="{cta_link}" target="_blank" '
               f'style="background:{color};color:#fff;padding:15px 30px;text-decoration:none;border-radius:9999px;'
               f'font-weight:bold;display:inline-block;">{cta_text}</a></div>')
    return (
        '<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#1e293b;">'
        '<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">'
        '<div style="background:#0f172a;padding:22px 28px;border-bottom:2px solid #C9A227;color:#EDE6D6;font-weight:900;font-size:19px;">'
        'PORTAL <span style="color:#C9A227;font-size:11px;letter-spacing:.18em;">CONCURSOS E OAB</span></div>'
        f'<div style="padding:32px;font-size:16px;color:#334155;">{paragraphs}{cta}</div>'
        '<div style="background:#f1f5f9;padding:20px 32px;text-align:center;font-size:12px;color:#64748b;">'
        'Portal Concurso - Central de Carreiras e Aprovações</div></div></div>'
    )


@api.post("/email/send-batch")
async def email_send_batch(request: Request):
    body = await request.json()
    contacts = body.get("contacts") or []
    subject_t = body.get("subjectTemplate")
    body_t = body.get("bodyTemplate")
    if not contacts:
        raise HTTPException(status_code=400, detail="Nenhum contato fornecido para envio.")
    if not subject_t or not body_t:
        raise HTTPException(status_code=400, detail="Assunto e Mensagem são obrigatórios.")
    api_key = body.get("customApiKey") or os.environ.get("SENDGRID_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503,
                            detail="Chave SENDGRID_API_KEY não configurada. Configure no backend ou informe no painel.")
    from_email = body.get("fromEmailCustom") or os.environ.get("SENDGRID_FROM_EMAIL") or "notificacoes@portalconcurso.com.br"
    from_name = body.get("fromNameCustom") or "Portal Concursos"
    cta_link_t = body.get("ctaLink") or ""
    cta_text = body.get("ctaText") or ""
    import re
    valid = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    sent = failed = skipped = 0
    results = []
    seen = set()
    async with httpx.AsyncClient(timeout=30) as http:
        for c in contacts:
            email = (c.get("email") or "").strip().lower()
            if not email or not valid.match(email):
                skipped += 1
                results.append({"id": c.get("id", ""), "email": email, "nome": c.get("nome", "Aluno"),
                                "status": "skipped", "error": "E-mail ausente ou inválido"})
                continue
            if email in seen:
                skipped += 1
                results.append({"id": c.get("id", ""), "email": email, "nome": c.get("nome", "Aluno"),
                                "status": "skipped", "error": "E-mail duplicado"})
                continue
            seen.add(email)
            subj = _fill_vars(subject_t, c)
            body_p = _fill_vars(body_t, c)
            cta_link = _fill_vars(cta_link_t, c) if cta_link_t else ""
            payload = {
                "personalizations": [{"to": [{"email": email}], "subject": subj}],
                "from": {"email": from_email, "name": from_name},
                "content": [
                    {"type": "text/plain", "value": body_p},
                    {"type": "text/html", "value": _email_html(subj, body_p, cta_link, cta_text)},
                ],
            }
            try:
                r = await http.post("https://api.sendgrid.com/v3/mail/send", json=payload,
                                    headers={"Authorization": f"Bearer {api_key}"})
                if r.status_code in (200, 201, 202):
                    sent += 1
                    results.append({"id": c.get("id", ""), "email": email, "nome": c.get("nome", "Aluno"), "status": "sent"})
                else:
                    failed += 1
                    results.append({"id": c.get("id", ""), "email": email, "nome": c.get("nome", "Aluno"),
                                    "status": "failed", "error": f"HTTP {r.status_code}"})
            except Exception as e:
                failed += 1
                results.append({"id": c.get("id", ""), "email": email, "nome": c.get("nome", "Aluno"),
                                "status": "failed", "error": str(e)})
    return {"success": True, "sentCount": sent, "failedCount": failed, "skippedCount": skipped,
            "total": len(contacts), "results": results,
            "message": f"Disparo concluído: {sent} enviados, {failed} falhas, {skipped} ignorados."}


@api.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


app.include_router(api)

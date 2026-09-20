# Portal Concursos — Test Credentials

## Admin (Master) — JWT login
- **Usuário:** `admin`  (ou e-mail `ofcpatolino3@gmail.com`)
- **Senha:** `admin123`
- **Role:** admin
- Seeded automatically on backend startup (ADMIN_* vars in `/app/backend/.env`).

## Attendant (create via "Novo Atendente" tab or admin panel)
- Self-register: any username/email + password (>= any length). Defaults to role `attendant`, status `approved`.
- Example used in tests: `joao` / `senha123`

## Auth endpoints (backend :8001, all under /api)
- POST /api/auth/register  {name, emailOrUser, password}
- POST /api/auth/login     {emailOrUser, password}   -> sets httpOnly cookie `pc_token`
- GET  /api/auth/me
- POST /api/auth/logout
- POST /api/auth/admin-create {name, emailOrUser, password, role}  (admin only)

## Secure data store endpoints (require auth cookie)
- GET    /api/store/collection?path=<seg>&path=<seg>
- GET    /api/store/doc?path=...
- PUT    /api/store/doc         {path, data, merge}
- DELETE /api/store/doc?path=...
- POST   /api/store/batch       {ops:[{type:set|delete, path, data, merge}]}

Role rules: `global_contacts` & `lead_batches` are admin/supervisor only.
Attendants can only read/write their own `users/{uid}/contacts`.

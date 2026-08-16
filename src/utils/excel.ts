import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Contact, Temperature } from '../types';
import { extractContactsFromRawText } from './clientOcr';

export function normHeader(h: unknown): string {
  return (h ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function excelDateToStr(v: unknown): string {
  if (v === '' || v === null || v === undefined) return '';

  // XLSX date serial numbers
  if (typeof v === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d && d.y && d.m && d.d) {
        return (
          String(d.y).padStart(4, '0') +
          '-' +
          String(d.m).padStart(2, '0') +
          '-' +
          String(d.d).padStart(2, '0')
        );
      }
    } catch {
      // ignore and fallback
    }
  }

  const s = String(v).trim();
  if (!s) return '';

  // Match DD/MM/YYYY or DD-MM-YYYY
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Match ISO YYYY-MM-DD
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];

  return '';
}

export function normalizeRawPhoneValue(val: unknown): string {
  if (val === null || val === undefined) return '';

  // Handle Excel numbers (e.g. 5591981234567 or scientific notation 5.59198E+12)
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return val.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
  }

  let s = String(val).trim();
  // Handle scientific notation formatted as string "5.59198E+12"
  if (/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)$/.test(s)) {
    try {
      const num = Number(s);
      if (!isNaN(num)) {
        return num.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
      }
    } catch {
      // fallback
    }
  }

  // Remove trailing .0 if Excel exported integer as float string
  if (/\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, '');
  }

  return s;
}

export function cleanPhone(tel: unknown): string {
  const rawStr = normalizeRawPhoneValue(tel);
  if (!rawStr) return '';

  // Remove all non-digits
  let digits = rawStr.replace(/\D/g, '');
  if (!digits) return '';

  // Handle leading zeroes (e.g. 091981234567 -> 91981234567 or 05591981234567 -> 5591981234567)
  while (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }

  // Handle 55 DDI prefix (Brazil international code)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    // 55 + DDD (2) + 8 or 9 digits -> strip 55 to keep standard DDD+Number
    return digits.slice(2);
  } else if (digits.startsWith('550') && digits.length === 14) {
    // 550 + DDD (2) + 9 digits -> strip 550
    return digits.slice(3);
  }

  return digits;
}

export function isLikelyPhone(val: unknown): boolean {
  const digits = cleanPhone(val);
  return digits.length >= 8 && digits.length <= 13;
}

export function formatPhoneDisplay(tel: unknown): string {
  const digits = cleanPhone(tel);
  if (!digits) return '';
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return digits;
}

export function cleanTemperature(val: string): Temperature {
  const v = val.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (v.includes('pago') || v.includes('pagou') || v.includes('comprou') || v.includes('matriculado') || v.includes('aluno')) return 'Pagou';
  if (v.includes('quente') || v.includes('hot') || v.includes('urgente') || v.includes('fechar')) return 'Quente';
  if (v.includes('potencial') || v.includes('alto') || v.includes('negociando') || v.includes('proposta')) return 'Potencial';
  if (v.includes('morno') || v.includes('warm') || v.includes('medio') || v.includes('duvida')) return 'Morno';
  return 'Frio';
}

export function mapRowToContact(row: Record<string, unknown>, rowIndex?: number): Partial<Contact> {
  const out: Partial<Contact> = {
    nome: '',
    whatsapp: '',
    email: '',
    curso: '',
    temperatura: 'Frio',
    dataContato: '',
    ultimoContato: '',
    proximoContato: '',
    status: '',
    observacao: '',
  };

  let separateDDD = '';
  let phoneCandidate = '';
  let courseCandidate = '';
  let nameCandidate = '';
  let noteCandidate = '';

  for (const [k, raw] of Object.entries(row)) {
    const n = normHeader(k);
    const rawVal = raw === undefined || raw === null ? '' : raw;
    const vStr = normalizeRawPhoneValue(rawVal);
    const v = String(rawVal).trim();

    // Check specific DDD column
    if (n === 'ddd' || n === 'codigodearea' || n === 'prefixo') {
      const dddDigits = v.replace(/\D/g, '');
      if (dddDigits.length === 2) {
        separateDDD = dddDigits;
      }
      continue;
    }

    if (n.includes('proximocontato') || n.includes('proximo') || n.includes('retorno') || n.includes('agendamento')) {
      out.proximoContato = excelDateToStr(rawVal);
    } else if (n.includes('ultimocontato') || n.includes('ultimo') || n.includes('atendido')) {
      out.ultimoContato = excelDateToStr(rawVal);
    } else if (n.includes('datacontato') || n === 'data' || n.includes('criadoem') || n.includes('cadastro') || n.includes('datacadastro')) {
      out.dataContato = excelDateToStr(rawVal);
    } else if (n.includes('temperatura') || n.includes('temp') || n.includes('etiqueta') || n.includes('tag') || n.includes('prioridade')) {
      out.temperatura = cleanTemperature(v);
    } else if (n.includes('status') || n.includes('situacao') || n.includes('fase') || n.includes('etapa')) {
      out.status = v;
    } else if (n.includes('observ') || n.includes('obs') || n.includes('nota') || n.includes('comentario') || n.includes('detalhe') || n.includes('historico')) {
      out.observacao = v;
    } else if (n.includes('email') || n.includes('correio') || n.includes('mail') || n.includes('e-mail')) {
      out.email = v.toLowerCase();
    } else if (
      n.includes('whatsapp') ||
      n.includes('whats') ||
      n.includes('wpp') ||
      n.includes('zap') ||
      n.includes('celular') ||
      n.includes('cel') ||
      n.includes('telefone') ||
      n.includes('tel') ||
      n.includes('fone') ||
      n.includes('mobile') ||
      n.includes('phone') ||
      n.includes('numero') ||
      n.includes('num')
    ) {
      const cleaned = cleanPhone(vStr);
      if (cleaned) {
        out.whatsapp = cleaned;
      } else if (v) {
        out.whatsapp = v;
      }
    } else if (
      n.includes('curso') ||
      n.includes('concurso') ||
      n.includes('edital') ||
      n.includes('cargo') ||
      n.includes('carreira') ||
      n.includes('orgao') ||
      n.includes('interesse') ||
      n.includes('materia') ||
      n.includes('produto') ||
      n.includes('turma')
    ) {
      out.curso = v;
    } else if (
      n.includes('nome') ||
      n.includes('name') ||
      n.includes('aluno') ||
      n.includes('cliente') ||
      n.includes('lead') ||
      n.includes('candidato') ||
      n.includes('estudante') ||
      n.includes('participante') ||
      n.includes('pessoa') ||
      n.includes('destinatario')
    ) {
      out.nome = v;
    } else if (n.includes('contato')) {
      // "Contato" could be a name or a phone number
      if (isLikelyPhone(vStr)) {
        if (!out.whatsapp) out.whatsapp = cleanPhone(vStr);
      } else if (!out.nome && v.length > 2) {
        out.nome = v;
      }
    } else {
      // Capture unmapped columns as candidates
      if (!phoneCandidate && isLikelyPhone(vStr)) {
        phoneCandidate = cleanPhone(vStr);
      } else if (!courseCandidate && (v.toLowerCase().includes('polic') || v.toLowerCase().includes('inss') || v.toLowerCase().includes('tj') || v.toLowerCase().includes('concurso'))) {
        courseCandidate = v;
      } else if (!nameCandidate && v.length > 3 && /^[A-Za-zÀ-ÿ\s]+$/.test(v) && v.includes(' ')) {
        nameCandidate = v;
      }
    }
  }

  // Apply separate DDD if number is only 8 or 9 digits
  if (separateDDD && out.whatsapp && (out.whatsapp.length === 8 || out.whatsapp.length === 9)) {
    out.whatsapp = `${separateDDD}${out.whatsapp}`;
  }

  // FALLBACK SCANNER: If phone is still missing, scan ALL cells in the row
  if (!out.whatsapp) {
    if (phoneCandidate) {
      out.whatsapp = phoneCandidate;
    } else {
      for (const raw of Object.values(row)) {
        const v = normalizeRawPhoneValue(raw);
        if (isLikelyPhone(v)) {
          const cp = cleanPhone(v);
          if (cp.length >= 8) {
            out.whatsapp = cp;
            break;
          }
        }
      }
    }
  }

  // Combine separate DDD with fallback phone if needed
  if (separateDDD && out.whatsapp && (out.whatsapp.length === 8 || out.whatsapp.length === 9)) {
    out.whatsapp = `${separateDDD}${out.whatsapp}`;
  }

  // FALLBACK SCANNER for Email
  if (!out.email) {
    for (const raw of Object.values(row)) {
      const v = String(raw ?? '').trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        out.email = v.toLowerCase();
        break;
      }
    }
  }

  // FALLBACK SCANNER for Course
  if (!out.curso && courseCandidate) {
    out.curso = courseCandidate;
  }

  // FALLBACK SCANNER for Name
  if (!out.nome) {
    if (nameCandidate) {
      out.nome = nameCandidate;
    } else {
      // Look for any string that looks like a person name (letters and spaces, not email, not date)
      for (const raw of Object.values(row)) {
        const v = String(raw ?? '').trim();
        if (
          v.length >= 3 &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) &&
          !isLikelyPhone(v) &&
          !/^\d{4}-\d{2}-\d{2}/.test(v) &&
          /^[A-Za-zÀ-ÿ\s.\-']+$/.test(v) &&
          !['frio', 'morno', 'quente', 'pagou', 'potencial', 'novo lead', 'pendente', 'ativo', 'inativo'].includes(v.toLowerCase())
        ) {
          out.nome = v;
          break;
        }
      }
    }
  }

  // If name is STILL empty, generate a polite fallback so the contact is NEVER lost!
  if (!out.nome || !out.nome.trim()) {
    if (out.whatsapp) {
      out.nome = `Contato (${formatPhoneDisplay(out.whatsapp)})`;
    } else if (out.email) {
      out.nome = out.email.split('@')[0];
    } else {
      out.nome = `Aluno ${rowIndex !== undefined ? rowIndex + 1 : 'Lead'}`;
    }
  }

  return out;
}

/**
 * Super-fast local parser for pasted text (from WhatsApp, CSV, Notepad, or clipboard)
 */
export function parseRawTextToContacts(rawText: string): Partial<Contact>[] {
  if (!rawText || !rawText.trim()) return [];

  // Use the intelligent multi-line extractor
  const extracted = extractContactsFromRawText(rawText);
  if (extracted.length > 0) {
    return extracted.map((c) => ({
      nome: c.nome,
      whatsapp: c.whatsapp,
      email: c.email || '',
      curso: c.curso || '',
      temperatura: c.temperatura || 'Morno',
      status: c.status || 'Novo Lead',
      observacao: c.observacao || '',
      dataContato: c.dataContato || todayStr(),
    }));
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: Partial<Contact>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line contains a phone pattern
    const phoneMatch = line.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);
    let extractedPhone = '';
    if (phoneMatch) {
      extractedPhone = cleanPhone(phoneMatch[0]);
    }

    // Check for email
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const extractedEmail = emailMatch ? emailMatch[0].toLowerCase() : '';

    // Split by common delimiters (tab, comma, semicolon, pipe, dash, colon)
    const tokens = line
      .split(/[\t;,|]|\s+-\s+|\s+:\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    let nome = '';
    let curso = '';
    let observacao = '';
    let temperatura: Temperature = 'Morno';

    if (line.toLowerCase().includes('pagou') || line.toLowerCase().includes('matriculado')) temperatura = 'Pagou';
    else if (line.toLowerCase().includes('quente')) temperatura = 'Quente';
    else if (line.toLowerCase().includes('potencial')) temperatura = 'Potencial';
    else if (line.toLowerCase().includes('frio')) temperatura = 'Frio';

    for (const token of tokens) {
      if (isLikelyPhone(token)) {
        if (!extractedPhone) extractedPhone = cleanPhone(token);
      } else if (token.includes('@')) {
        // already handled
      } else if (
        token.toLowerCase().includes('polic') ||
        token.toLowerCase().includes('pm') ||
        token.toLowerCase().includes('pc') ||
        token.toLowerCase().includes('pf') ||
        token.toLowerCase().includes('prf') ||
        token.toLowerCase().includes('inss') ||
        token.toLowerCase().includes('tj') ||
        token.toLowerCase().includes('tribunal') ||
        token.toLowerCase().includes('edital') ||
        token.toLowerCase().includes('concurso') ||
        token.toLowerCase().includes('oab') ||
        token.toLowerCase().includes('banco') ||
        token.toLowerCase().includes('curso') ||
        token.toLowerCase().includes('isolada') ||
        token.toLowerCase().includes('combo')
      ) {
        curso = token;
      } else if (!nome && /^[A-Za-zÀ-ÿ\s]+$/.test(token) && token.length >= 2) {
        nome = token;
      } else if (!observacao && token.length > 2) {
        observacao = token;
      }
    }

    // Fallback name if missing
    if (!nome) {
      if (extractedPhone) {
        nome = `Contato (${formatPhoneDisplay(extractedPhone)})`;
      } else if (extractedEmail) {
        nome = extractedEmail.split('@')[0];
      } else {
        nome = `Lead ${i + 1}`;
      }
    }

    if (extractedPhone || extractedEmail || nome !== `Lead ${i + 1}`) {
      results.push({
        nome: nome.trim(),
        whatsapp: extractedPhone,
        email: extractedEmail,
        curso: curso.trim(),
        temperatura,
        status: 'Novo Lead',
        observacao: observacao.trim(),
        dataContato: todayStr(),
      });
    }
  }

  return results;
}

export type WhatsAppTargetMode = 'same_tab' | 'desktop_app' | 'new_tab';

export function getWhatsAppTargetMode(): WhatsAppTargetMode {
  try {
    const saved = localStorage.getItem('portal_whatsapp_target_mode');
    if (saved === 'same_tab' || saved === 'desktop_app' || saved === 'new_tab') {
      return saved as WhatsAppTargetMode;
    }
  } catch (e) {
    console.error(e);
  }
  return 'same_tab'; // Padrão: Reaproveita a mesma aba para não criar dezenas de abas!
}

export function setWhatsAppTargetMode(mode: WhatsAppTargetMode) {
  try {
    localStorage.setItem('portal_whatsapp_target_mode', mode);
  } catch (e) {
    console.error(e);
  }
}

export function waLink(tel: string): string | null {
  const digits = cleanPhone(tel);
  if (!digits) return null;
  const full = digits.length <= 11 ? '55' + digits : digits;
  return `https://web.whatsapp.com/send?phone=${full}`;
}

export function waLinkWithMessage(tel: string, message?: string): string | null {
  const digits = cleanPhone(tel);
  if (!digits) return null;
  const full = digits.length <= 11 ? '55' + digits : digits;
  const base = `https://web.whatsapp.com/send?phone=${full}`;
  if (message && message.trim()) {
    return `${base}&text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}

/**
 * Abre o WhatsApp sem criar abas infinitas quando no modo 'same_tab' (padrão),
 * ou diretamente no aplicativo Desktop quando no modo 'desktop_app'.
 */
let waHubWindow: Window | null = null;

export function openWhatsAppDirect(
  tel: string,
  message?: string,
  customMode?: WhatsAppTargetMode
): boolean {
  const digits = cleanPhone(tel);
  if (!digits) return false;
  const full = digits.length <= 11 ? '55' + digits : digits;
  const mode = customMode || getWhatsAppTargetMode();
  const msgParam = message && message.trim() ? `&text=${encodeURIComponent(message.trim())}` : '';

  if (mode === 'desktop_app') {
    // Protocolo nativo do aplicativo WhatsApp Desktop ou Celular
    // Não abre nenhuma aba no navegador!
    const appUrl = `whatsapp://send?phone=${full}${msgParam}`;
    const hiddenLink = document.createElement('a');
    hiddenLink.href = appUrl;
    hiddenLink.style.display = 'none';
    document.body.appendChild(hiddenLink);
    hiddenLink.click();
    setTimeout(() => {
      if (document.body.contains(hiddenLink)) {
        document.body.removeChild(hiddenLink);
      }
    }, 400);
    return true;
  }

  // URL do WhatsApp Web
  const webUrl = `https://web.whatsapp.com/send?phone=${full}${msgParam}`;

  if (mode === 'same_tab') {
    // 1. Tenta reaproveitar a instância de janela já aberta em memória
    if (waHubWindow) {
      try {
        if (!waHubWindow.closed) {
          waHubWindow.location.href = webUrl;
          waHubWindow.focus();
          return true;
        }
      } catch (e) {
        // Cross-origin pode impedir leitura, continua para window.open nomeado
      }
    }

    // 2. Abre ou reconecta com a janela de nome fixo 'portal_whatsapp_hub'
    waHubWindow = window.open(webUrl, 'portal_whatsapp_hub');
    if (waHubWindow) {
      try {
        waHubWindow.focus();
      } catch (e) {}
    }
    return true;
  }

  // Modo nova aba
  window.open(webUrl, '_blank');
  return true;
}

export function getFirstName(fullName?: string): string {
  if (!fullName) return 'amigo(a)';
  const first = fullName.trim().split(/\s+/)[0];
  return first || 'amigo(a)';
}

export function fillTemplate(templateText: string, contact?: Partial<Contact>): string {
  if (!templateText) return '';
  const fullName = contact?.nome?.trim() || '';
  const firstName = getFirstName(fullName);
  const curso = contact?.curso?.trim() || 'concurso público';
  const whatsapp = contact?.whatsapp?.trim() || '';
  const email = contact?.email?.trim() || '';

  return templateText
    .replace(/\{nome\}/gi, firstName)
    .replace(/\{nome_completo\}/gi, fullName || firstName)
    .replace(/\{curso\}/gi, curso)
    .replace(/\{whatsapp\}/gi, whatsapp)
    .replace(/\{telefone\}/gi, whatsapp)
    .replace(/\{email\}/gi, email);
}

export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateBR(iso?: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}

export function isOverdue(isoDate?: string): boolean {
  if (!isoDate) return false;
  return isoDate < todayStr();
}

/**
 * Calculates how many days have passed without attendant message/contact
 */
export function getDaysWithoutContact(contact: Partial<Contact>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. If there's an explicit last message timestamp
  if (contact.lastMessageAt) {
    const lastMsgDate = new Date(contact.lastMessageAt);
    lastMsgDate.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - lastMsgDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // 2. If there's an ISO string ultimoContato (YYYY-MM-DD)
  if (contact.ultimoContato && contact.ultimoContato.trim()) {
    const parts = contact.ultimoContato.split('-').map(Number);
    if (parts.length === 3) {
      const contactDate = new Date(parts[0], parts[1] - 1, parts[2]);
      contactDate.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - contactDate.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // 3. Fallback to dataContato (date lead entered system)
  if (contact.dataContato && contact.dataContato.trim()) {
    const parts = contact.dataContato.split('-').map(Number);
    if (parts.length === 3) {
      const entryDate = new Date(parts[0], parts[1] - 1, parts[2]);
      entryDate.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - entryDate.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // 4. Fallback to createdAt timestamp
  if (contact.createdAt) {
    const created = new Date(contact.createdAt);
    created.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - created.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  return 0;
}

/**
 * Checks if a contact has been without attendant contact for 3 days or more
 */
export function isWithoutContactFor3Days(contact: Partial<Contact>): boolean {
  if (contact.temperatura === 'Pagou') return false; // Ignore already converted sales if desired
  return getDaysWithoutContact(contact) >= 3;
}

export function getContactInactivityStatus(contact: Partial<Contact>): {
  days: number;
  isCritical: boolean;
  label: string;
  badgeClass: string;
} {
  const days = getDaysWithoutContact(contact);
  const isPaid = contact.temperatura === 'Pagou';

  if (isPaid) {
    return {
      days,
      isCritical: false,
      label: 'Matriculado / Pagou',
      badgeClass: 'bg-[#16A34A]/15 text-[#4ADE80] border-[#16A34A]/30',
    };
  }

  if (days === 0) {
    return {
      days: 0,
      isCritical: false,
      label: 'Contatado hoje',
      badgeClass: 'bg-[#6E8F5C]/20 text-[#6E8F5C] border-[#6E8F5C]/40',
    };
  }

  if (days === 1) {
    return {
      days: 1,
      isCritical: false,
      label: 'Há 1 dia',
      badgeClass: 'bg-[#2563EB]/15 text-[#60A5FA] border-[#2563EB]/30',
    };
  }

  if (days === 2) {
    return {
      days: 2,
      isCritical: false,
      label: 'Há 2 dias (Atenção)',
      badgeClass: 'bg-[#C9A227]/20 text-[#FCD34D] border-[#C9A227]/40',
    };
  }

  return {
    days,
    isCritical: true,
    label: `🚨 ${days} dias sem resposta`,
    badgeClass: 'bg-[#DC2626]/20 text-[#F87171] border-[#DC2626]/50 animate-pulse font-bold',
  };
}

// Temperature Style Maps (ARGB format for ExcelJS)
export const TEMP_EXCEL_STYLES: Record<
  Temperature,
  {
    fill: string;
    text: string;
    border: string;
    badge: string;
  }
> = {
  Pagou: {
    fill: 'FFD4EDDA', // Verde claro
    text: 'FF155724', // Verde escuro
    border: 'FFA5D6A7',
    badge: '🟢 Pagou',
  },
  Potencial: {
    fill: 'FFE3F2FD', // Azul claro
    text: 'FF0D47A1', // Azul escuro
    border: 'FF90CAF9',
    badge: '🔵 Potencial',
  },
  Frio: {
    fill: 'FFFFEBEE', // Vermelho claro
    text: 'FFB71C1C', // Vermelho escuro
    border: 'FFEF9A9A',
    badge: '🔴 Frio',
  },
  Quente: {
    fill: 'FFFFE0B2', // Laranja claro / Âmbar
    text: 'FFE65100', // Laranja escuro
    border: 'FFFFCC80',
    badge: '🔥 Quente',
  },
  Morno: {
    fill: 'FFFFF9C4', // Amarelo/Dourado claro
    text: 'FF8D6E00', // Dourado escuro
    border: 'FFFFE082',
    badge: '🟡 Morno',
  },
};

export async function exportContactsToExcel(
  contacts: Contact[],
  filename?: string,
  filterName = 'Todos'
): Promise<void> {
  const dateStr = todayStr();
  const actualFilename = filename || `fechamento-contatos-${dateStr}.xlsx`;

  // Sort contacts by course (A-Z) and then name (A-Z)
  const sortedContacts = [...contacts].sort((a, b) => {
    const courseA = (a.curso || 'Sem Curso').trim().toLowerCase();
    const courseB = (b.curso || 'Sem Curso').trim().toLowerCase();
    const courseDiff = courseA.localeCompare(courseB, 'pt-BR');
    if (courseDiff !== 0) return courseDiff;
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Portal Concurso PA';
  workbook.lastModifiedBy = 'Portal Concurso PA';
  workbook.created = new Date();
  workbook.modified = new Date();

  // ----------------------------------------------------
  // SHEET 1: LISTA ATUALIZADA (COM CORES POR ETIQUETA)
  // ----------------------------------------------------
  const wsContacts = workbook.addWorksheet('Lista Atualizada', {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  wsContacts.columns = [
    { key: 'nome', width: 30 },
    { key: 'whatsapp', width: 20 },
    { key: 'email', width: 30 },
    { key: 'curso', width: 32 },
    { key: 'temperatura', width: 20 },
    { key: 'dataCadastro', width: 18 },
    { key: 'ultimoContato', width: 18 },
    { key: 'proximoContato', width: 18 },
    { key: 'status', width: 24 },
    { key: 'observacao', width: 45 },
  ];

  // 1. Title Banner (Row 1)
  const titleRow = wsContacts.addRow([
    'PORTAL CONCURSO — RELATÓRIO DE CONTATOS & LEADS ATUALIZADO',
  ]);
  wsContacts.mergeCells('A1:J1');
  titleRow.height = 36;
  const titleCell = wsContacts.getCell('A1');
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFC9A227' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101B2D' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 2. Subtitle / Metadata (Row 2)
  const subRow = wsContacts.addRow([
    `📅 Fechamento: ${formatDateBR(dateStr)}   |   🎯 Filtro: ${filterName}   |   📚 Organizado em Ordem de Curso   |   👥 Total: ${contacts.length}`,
  ]);
  wsContacts.mergeCells('A2:J2');
  subRow.height = 24;
  const subCell = wsContacts.getCell('A2');
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFEDE6D6' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172644' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 3. Table Column Headers (Row 3)
  const headers = [
    'Nome do Aluno',
    'WhatsApp',
    'E-mail',
    'Curso / Interesse',
    'Etiqueta / Status',
    'Data de Cadastro',
    'Último Contato',
    'Próximo Contato',
    'Status Atual',
    'Observações',
  ];
  const headerRow = wsContacts.addRow(headers);
  headerRow.height = 28;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3156' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8 ? 'center' : 'left',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2B3D63' } },
      bottom: { style: 'medium', color: { argb: 'FFC9A227' } },
      left: { style: 'thin', color: { argb: 'FF2B3D63' } },
      right: { style: 'thin', color: { argb: 'FF2B3D63' } },
    };
  });

  // 4. Populate Data Rows with Colored Tags (in order of course)
  sortedContacts.forEach((c, index) => {
    const temp: Temperature = c.temperatura || 'Frio';
    const tempStyle = TEMP_EXCEL_STYLES[temp] || TEMP_EXCEL_STYLES.Frio;

    const row = wsContacts.addRow([
      c.nome || '',
      c.whatsapp || '',
      c.email || '',
      c.curso || '',
      tempStyle.badge,
      formatDateBR(c.dataContato),
      formatDateBR(c.ultimoContato),
      formatDateBR(c.proximoContato),
      c.status || '',
      c.observacao || '',
    ]);

    row.height = 24;
    const isEven = index % 2 === 0;
    const defaultRowBg = isEven ? 'FFFFFFFF' : 'FFF9FAFB';

    row.eachCell((cell, colNumber) => {
      // Default cell styles
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber >= 5 && colNumber <= 8 ? 'center' : 'left',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: defaultRowBg },
      };

      // SPECIAL COLOR FOR TEMPERATURA / TAG (COLUMN 5)
      if (colNumber === 5) {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: tempStyle.text },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: tempStyle.fill },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: tempStyle.border } },
          bottom: { style: 'thin', color: { argb: tempStyle.border } },
          left: { style: 'thin', color: { argb: tempStyle.border } },
          right: { style: 'thin', color: { argb: tempStyle.border } },
        };
      }
    });
  });

  // ----------------------------------------------------
  // SHEET 2: RESUMO DO FECHAMENTO (COM CORES & MÉTRICAS)
  // ----------------------------------------------------
  const wsSummary = workbook.addWorksheet('Resumo do Fechamento', {
    views: [{ showGridLines: true }],
  });

  wsSummary.columns = [
    { key: 'metrica', width: 38 },
    { key: 'valor', width: 28 },
  ];

  // Title Banner
  const sumTitle = wsSummary.addRow(['RESUMO EXECUTIVO DO FECHAMENTO DIÁRIO']);
  wsSummary.mergeCells('A1:B1');
  sumTitle.height = 34;
  const sumTitleCell = wsSummary.getCell('A1');
  sumTitleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFC9A227' } };
  sumTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101B2D' } };
  sumTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle
  const sumSub = wsSummary.addRow([`Data: ${formatDateBR(dateStr)}   |   Base: ${filterName}`]);
  wsSummary.mergeCells('A2:B2');
  sumSub.height = 22;
  const sumSubCell = wsSummary.getCell('A2');
  sumSubCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFEDE6D6' } };
  sumSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172644' } };
  sumSubCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Section 1 Header
  const s1 = wsSummary.addRow(['MÉTRICAS GERAIS DE ATENDIMENTO', 'VALOR']);
  s1.height = 26;
  s1.eachCell((c) => {
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3156' } };
    c.alignment = { vertical: 'middle' };
  });

  const total = contacts.length;
  const contactedToday = contacts.filter((c) => c.ultimoContato === dateStr).length;
  const countPagou = contacts.filter((c) => c.temperatura === 'Pagou').length;
  const countQuente = contacts.filter((c) => c.temperatura === 'Quente').length;
  const countPotencial = contacts.filter((c) => c.temperatura === 'Potencial').length;
  const countMorno = contacts.filter((c) => c.temperatura === 'Morno').length;
  const countFrio = contacts.filter((c) => c.temperatura === 'Frio').length;
  const countPending = contacts.filter((c) => !c.ultimoContato).length;
  const countScheduled = contacts.filter((c) => Boolean(c.proximoContato)).length;

  const generalMetrics = [
    ['Total de Contatos Exportados', `${total} leads`],
    ['Atendimentos Realizados Hoje', `${contactedToday} contatados`],
    ['Pendentes de Primeiro Contato', `${countPending} contatos`],
    ['Acompanhamentos Futuros Agendados', `${countScheduled} contatos`],
  ];

  generalMetrics.forEach(([label, val]) => {
    const r = wsSummary.addRow([label, val]);
    r.height = 22;
    r.eachCell((c) => {
      c.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
      c.alignment = { vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  // Section 2 Header: Status & Cores
  const s2 = wsSummary.addRow(['DISTRIBUIÇÃO POR ETIQUETA / TEMPERATURA', 'QUANTIDADE & %']);
  s2.height = 26;
  s2.eachCell((c) => {
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3156' } };
    c.alignment = { vertical: 'middle' };
  });

  const tempRowsData: Array<{
    temp: Temperature;
    label: string;
    count: number;
  }> = [
    { temp: 'Pagou', label: '🟢 Pagou (Vendas / Alunos Matriculados)', count: countPagou },
    { temp: 'Potencial', label: '🔵 Potencial (Em Negociação / Alta Intenção)', count: countPotencial },
    { temp: 'Quente', label: '🔥 Quente (Interesse Imediato / Alta Chance)', count: countQuente },
    { temp: 'Morno', label: '🟡 Morno (Tirando Dúvidas / Avaliação)', count: countMorno },
    { temp: 'Frio', label: '🔴 Frio (Sem Retorno / Desistência / Frio)', count: countFrio },
  ];

  tempRowsData.forEach(({ temp, label, count }) => {
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    const style = TEMP_EXCEL_STYLES[temp];
    const r = wsSummary.addRow([label, `${count} (${pct}%)`]);
    r.height = 24;

    r.eachCell((c) => {
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: style.text } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
      c.alignment = { vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: style.border } },
        bottom: { style: 'thin', color: { argb: style.border } },
        left: { style: 'thin', color: { argb: style.border } },
        right: { style: 'thin', color: { argb: style.border } },
      };
    });
  });

  // Write buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', actualFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportContactsToCSV(
  contacts: Contact[],
  filename?: string
) {
  const dateStr = todayStr();
  const actualFilename = filename || `fechamento-contatos-${dateStr}.csv`;

  // Sort by course (A-Z) and then name
  const sorted = [...contacts].sort((a, b) => {
    const courseA = (a.curso || 'Sem Curso').trim().toLowerCase();
    const courseB = (b.curso || 'Sem Curso').trim().toLowerCase();
    const diff = courseA.localeCompare(courseB, 'pt-BR');
    if (diff !== 0) return diff;
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

  const rows = sorted.map((c) => ({
    'Nome': c.nome,
    'WhatsApp': c.whatsapp,
    'E-mail': c.email || '',
    'Curso/Interesse': c.curso || '',
    'Temperatura': c.temperatura || 'Frio',
    'Data Cadastro': formatDateBR(c.dataContato),
    'Último Contato': formatDateBR(c.ultimoContato),
    'Próximo Contato': formatDateBR(c.proximoContato),
    'Status': c.status || '',
    'Observação': c.observacao || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', actualFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateDailySummaryText(contacts: Contact[]): string {
  const dateStr = todayStr();
  const total = contacts.length;
  const contactedToday = contacts.filter((c) => c.ultimoContato === dateStr).length;
  const countPagou = contacts.filter((c) => c.temperatura === 'Pagou').length;
  const countQuente = contacts.filter((c) => c.temperatura === 'Quente').length;
  const countPotencial = contacts.filter((c) => c.temperatura === 'Potencial').length;
  const countMorno = contacts.filter((c) => c.temperatura === 'Morno').length;
  const countFrio = contacts.filter((c) => c.temperatura === 'Frio').length;
  const countPending = contacts.filter((c) => !c.ultimoContato).length;
  const countScheduled = contacts.filter((c) => Boolean(c.proximoContato)).length;

  const convRate = total > 0 ? ((countPagou / total) * 100).toFixed(1) : '0';

  // Group contacts count by course
  const courseCounts: Record<string, number> = {};
  contacts.forEach((c) => {
    const course = c.curso?.trim() || 'Geral / Sem Curso';
    courseCounts[course] = (courseCounts[course] || 0) + 1;
  });
  const courseLines = Object.entries(courseCounts)
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([course, count]) => `• 📚 *${course}:* ${count} aluno(s)`)
    .join('\n');

  return `📊 *RELATÓRIO DE FECHAMENTO DIÁRIO - PORTAL CONCURSO*
📅 *Data:* ${formatDateBR(dateStr)}

👥 *Total na Base Atualizada:* ${total} leads
📞 *Atendidos/Contatados Hoje:* ${contactedToday}
⏳ *Ainda Pendentes de Contato:* ${countPending}
🗓️ *Agendamentos Futuros:* ${countScheduled}

🎯 *STATUS E TEMPERATURAS:*
• 🟢 *Pagou (Matriculados):* ${countPagou} (${convRate}%)
• 🔵 *Potencial (Negociando):* ${countPotencial}
• 🔥 *Quente (Alta Intenção):* ${countQuente}
• 🟡 *Morno (Avaliação):* ${countMorno}
• 🔴 *Frio (Sem retorno/Desistência):* ${countFrio}

📚 *DISTRIBUIÇÃO POR ORDEM DE CURSO:*
${courseLines || '• Nenhum curso cadastrado'}

📈 *Taxa de Conversão em Vendas:* ${convRate}%
_Relatório gerado automaticamente pelo Painel de Contatos._`;
}

/**
 * Exportação Completa e Especial para Gestão e Supervisão
 * Contém colunas detalhadas: Atendente Responsável, Lote de Origem, Contatado, Inatividade, etc.
 */
export async function exportSupervisorContactsToExcel(
  contacts: Contact[],
  filterTitle: string = 'Base Geral de Gestão',
  filename?: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Portal Concursos - Painel de Gestão e Supervisão';
  workbook.lastModifiedBy = 'Supervisor';
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.addWorksheet('Gestão de Leads', {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }],
  });

  ws.columns = [
    { key: 'nome', width: 28 },
    { key: 'whatsapp', width: 18 },
    { key: 'email', width: 26 },
    { key: 'curso', width: 24 },
    { key: 'temperatura', width: 16 },
    { key: 'status', width: 20 },
    { key: 'atendente', width: 24 },
    { key: 'lote', width: 20 },
    { key: 'dataCadastro', width: 15 },
    { key: 'ultimoContato', width: 15 },
    { key: 'proximoContato', width: 15 },
    { key: 'inatividade', width: 16 },
    { key: 'observacao', width: 34 },
  ];

  // Header Title
  const titleRow = ws.addRow([`PORTAL CONCURSOS - EXPORTAÇÃO DE GESTÃO: ${filterTitle.toUpperCase()}`]);
  ws.mergeCells('A1:M1');
  titleRow.height = 30;
  const titleCell = ws.getCell('A1');
  titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFC9A227' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101B2D' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle
  const subRow = ws.addRow([`Gerado em: ${formatDateBR(todayStr())} às ${new Date().toLocaleTimeString()} | Total: ${contacts.length} contatos`]);
  ws.mergeCells('A2:M2');
  subRow.height = 20;
  const subCell = ws.getCell('A2');
  subCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FFEDE6D6' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172644' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Table Headers
  const headerRow = ws.addRow([
    'Nome do Lead',
    'WhatsApp / Fone',
    'E-mail',
    'Curso / Interesse',
    'Etiqueta / Temp',
    'Status Atual',
    'Atendente Responsável',
    'Lote / Origem',
    'Data Cadastro',
    'Último Contato',
    'Próximo Contato',
    'Dias s/ Contato',
    'Observações / Notas',
  ]);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3156' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2B3D63' } },
      bottom: { style: 'medium', color: { argb: 'FFC9A227' } },
      left: { style: 'thin', color: { argb: 'FF2B3D63' } },
      right: { style: 'thin', color: { argb: 'FF2B3D63' } },
    };
  });

  contacts.forEach((c) => {
    const temp = c.temperatura || 'Frio';
    const style = TEMP_EXCEL_STYLES[temp];
    const daysOff = getDaysWithoutContact(c);

    const r = ws.addRow([
      c.nome || 'Sem Nome',
      c.whatsapp || '',
      c.email || '',
      c.curso || '',
      temp,
      c.status || '',
      c.assignedToName || c.assignedToEmail || (c.assignedTo ? 'Atribuído' : 'Não Atribuído (Geral)'),
      c.batchName || 'Base Direta',
      formatDateBR(c.dataContato),
      formatDateBR(c.ultimoContato) || 'Pendente',
      formatDateBR(c.proximoContato),
      daysOff > 0 ? `${daysOff} dias` : 'Hoje / Recente',
      c.observacao || '',
    ]);
    r.height = 20;

    r.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1F2937' } };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };

      if (colNum === 5) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: style.text } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  const actualFilename = filename || `gestao-supervisao-contatos-${todayStr()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', actualFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

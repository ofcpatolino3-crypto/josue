import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Contact, Temperature } from '../types';
import { extractContactsFromRawText } from './clientOcr';

export const VALID_BRAZIL_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
]);

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

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const br = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
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

  // Handle Excel numbers (e.g. 5591981234567 or 5.59198E+12)
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    try {
      if (Number.isSafeInteger(val)) {
        return BigInt(val).toString();
      }
      return BigInt(Math.floor(val)).toString();
    } catch {
      return String(Math.floor(val));
    }
  }

  let s = String(val).trim();
  if (!s) return '';

  // Handle scientific notation formatted as string "5.59198E+12"
  if (/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)$/.test(s)) {
    try {
      const num = Number(s);
      if (!isNaN(num)) {
        return BigInt(Math.floor(num)).toString();
      }
    } catch {
      // fallback
    }
  }

  // Remove trailing .0 or .00 if Excel exported integer as float string
  if (/\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, '');
  }

  return s;
}

/**
 * Robust cleaner for a single phone string
 */
function cleanSinglePhoneString(rawStr: string, separateDDD?: string): string {
  if (!rawStr) return '';

  // Handle scientific notation string if present
  if (/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)$/.test(rawStr)) {
    try {
      const num = Number(rawStr);
      if (!isNaN(num)) {
        rawStr = BigInt(Math.floor(num)).toString();
      }
    } catch {}
  }
  rawStr = rawStr.replace(/\.0+$/, '').trim();

  let digits = rawStr.replace(/\D/g, '');
  if (!digits) return '';

  // Remove leading 00 (international 0055...)
  if (digits.startsWith('00')) {
    digits = digits.replace(/^00+/, '');
  }

  // 14 digits with carrier code and leading zero (e.g. 0 + 15 + 85 + 987654321 or 0 + 21 + 91 + 981234567)
  if (digits.length === 14 && digits.startsWith('0')) {
    const ddd = digits.slice(3, 5);
    if (VALID_BRAZIL_DDDS.has(ddd)) {
      digits = digits.slice(3); // strips '0' and carrier code (2 digits)
    }
  }

  // 14 digits with 550 prefix (e.g. 55085987654321)
  if (digits.length === 14 && digits.startsWith('550')) {
    digits = digits.slice(3);
  }

  // 13 digits with carrier code without leading zero (e.g. 15 + 85 + 987654321)
  if (digits.length === 13 && !digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    if (VALID_BRAZIL_DDDS.has(ddd)) {
      digits = digits.slice(2);
    }
  }

  // 13 digits starting with 55 (55 + DDD (2) + 9 digits, e.g. 5585987654321)
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    if (VALID_BRAZIL_DDDS.has(ddd)) {
      digits = digits.slice(2);
    }
  }

  // 12 digits with leading 0 before DDD (e.g. 085987654321 -> 85987654321)
  if (digits.length === 12 && digits.startsWith('0')) {
    const ddd = digits.slice(1, 3);
    if (VALID_BRAZIL_DDDS.has(ddd)) {
      digits = digits.slice(1);
    }
  }

  // 12 digits starting with 55 (55 + DDD (2) + 8 digits, e.g. 558587654321)
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    if (VALID_BRAZIL_DDDS.has(ddd)) {
      digits = digits.slice(2);
    }
  }

  // 10 digits (DDD (2) + 8 digits, e.g. 8587654321) -> normalize to 11 digits by inserting '9' if mobile
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const firstNum = digits.charAt(2);
    if (VALID_BRAZIL_DDDS.has(ddd) && ['6', '7', '8', '9'].includes(firstNum)) {
      digits = ddd + '9' + digits.slice(2);
    }
  }

  // If 8 or 9 digits and separateDDD was passed
  if (separateDDD && (digits.length === 8 || digits.length === 9)) {
    const cleanD = separateDDD.replace(/\D/g, '');
    if (VALID_BRAZIL_DDDS.has(cleanD)) {
      if (digits.length === 8 && ['6', '7', '8', '9'].includes(digits.charAt(0))) {
        digits = cleanD + '9' + digits;
      } else {
        digits = cleanD + digits;
      }
    }
  }

  return digits;
}

/**
 * Universal Phone Cleaner.
 * Handles Brazilian DDDs, DDI 55, carrier codes, scientific numbers, and multi-number cells.
 */
export function cleanPhone(tel: unknown, separateDDD?: string): string {
  const rawStr = normalizeRawPhoneValue(tel);
  if (!rawStr) return '';

  // Check if multiple phone numbers exist in cell separated by slash, comma, semicolon, pipe or words
  const parts = rawStr.split(/[\/,;|]|\bou\b|\be\b/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) {
      const cleaned = cleanSinglePhoneString(part, separateDDD);
      if (cleaned && (cleaned.length === 11 || cleaned.length === 10)) {
        return cleaned;
      }
    }
  }

  return cleanSinglePhoneString(rawStr, separateDDD);
}

export function isLikelyPhone(val: unknown): boolean {
  const digits = cleanPhone(val);
  if (!digits) return false;
  // If 11 or 10 digits, must start with a valid Brazilian DDD
  if (digits.length === 11 || digits.length === 10) {
    const ddd = digits.slice(0, 2);
    return VALID_BRAZIL_DDDS.has(ddd);
  }
  // If 8 or 9 digits (local number without DDD)
  if (digits.length === 8 || digits.length === 9) {
    return true;
  }
  // Full international number with 55 (12 or 13 digits)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    return VALID_BRAZIL_DDDS.has(ddd);
  }
  return false;
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
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return digits;
}

export function cleanTemperature(val: string): Temperature {
  const v = val.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (v.includes('pago') || v.includes('pagou') || v.includes('comprou') || v.includes('matriculado') || v.includes('aluno')) return 'Pagou';
  if (v.includes('quente') || v.includes('hot') || v.includes('urgente') || v.includes('fechar') || v.includes('alta') || v.includes('alto')) return 'Quente';
  if (v.includes('potencial') || v.includes('medio') || v.includes('negociando') || v.includes('proposta') || v.includes('retornar')) return 'Potencial';
  if (v.includes('morno') || v.includes('warm') || v.includes('duvida') || v.includes('interessado')) return 'Morno';
  return 'Frio';
}

/**
 * Universal Mapper that maps any spreadsheet row to a Contact,
 * 100% independent of column order or header naming variations.
 */
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
  let sobrenomeCandidate = '';

  // Words that NEVER represent a phone column
  const PHONE_EXCLUSION_KEYWORDS = [
    'parcela', 'parcelas', 'parcelamento',
    'cancelado', 'cancelamento', 'cancelar',
    'acerto', 'acertos', 'erro', 'erros', 'questao', 'questoes', 'simulado',
    'matricula', 'inscricao', 'pedido', 'protocolo', 'cpf', 'rg', 'cep',
    'endereco', 'documento', 'transacao', 'id', 'valor', 'preco', 'r$', 'plano',
    'nota', 'escore', 'posicao', 'ranking', 'tentativa', 'tentativas'
  ];

  for (const [k, raw] of Object.entries(row)) {
    const n = normHeader(k);
    const rawVal = raw === undefined || raw === null ? '' : raw;
    const vStr = normalizeRawPhoneValue(rawVal);
    const v = String(rawVal).trim();
    if (!v && !vStr) continue;

    // 1. Check separate DDD column
    if (
      n === 'ddd' ||
      n === 'codigodearea' ||
      n === 'codarea' ||
      n === 'prefixo' ||
      n === 'areacode' ||
      n === 'dddcelular' ||
      n === 'dddtelefone' ||
      n === 'ddd1' ||
      n === 'ddd2'
    ) {
      const dddDigits = v.replace(/\D/g, '');
      if (VALID_BRAZIL_DDDS.has(dddDigits)) {
        separateDDD = dddDigits;
      }
      continue;
    }

    // 2. Next Contact / Return date
    if (
      n.includes('proximocontato') ||
      n.includes('proximo') ||
      n.includes('retorno') ||
      n.includes('agendamento') ||
      n.includes('proximaretorno') ||
      n.includes('dataretorno') ||
      n.includes('followup') ||
      n.includes('nextcontact')
    ) {
      out.proximoContato = excelDateToStr(rawVal);
    }
    // 3. Last contact / Interaction
    else if (
      n.includes('ultimocontato') ||
      n.includes('ultimainteracao') ||
      n.includes('ultimo') ||
      n.includes('ultimochat') ||
      n.includes('atendido') ||
      n.includes('lastcontact')
    ) {
      out.ultimoContato = excelDateToStr(rawVal);
    }
    // 4. Contact Date / Creation / Registration
    else if (
      n.includes('datacontato') ||
      n === 'data' ||
      n.includes('criadoem') ||
      n.includes('cadastro') ||
      n.includes('datacadastro') ||
      n.includes('datadecadastro') ||
      n.includes('datadolead') ||
      n.includes('datadeentrada') ||
      n.includes('dataenvio') ||
      n.includes('createdat') ||
      n.includes('date')
    ) {
      out.dataContato = excelDateToStr(rawVal);
    }
    // 5. Temperature / Lead Qualification
    else if (
      n.includes('temperatura') ||
      n.includes('temp') ||
      n.includes('etiqueta') ||
      n.includes('tag') ||
      n.includes('prioridade') ||
      n.includes('classificacao') ||
      n.includes('qualificacao') ||
      n.includes('grau') ||
      n.includes('score')
    ) {
      out.temperatura = cleanTemperature(v);
    }
    // 6. Status / Funnel Stage
    else if (
      n.includes('status') ||
      n.includes('situacao') ||
      n.includes('fase') ||
      n.includes('etapa') ||
      n.includes('condicao') ||
      n.includes('estado') ||
      n.includes('estatus') ||
      n.includes('stage')
    ) {
      out.status = v;
    }
    // 7. Observations / Notes / Comments / History
    else if (
      n.includes('observ') ||
      n.includes('obs') ||
      n.includes('nota') ||
      n.includes('comentario') ||
      n.includes('detalhe') ||
      n.includes('historico') ||
      n.includes('descricao') ||
      n.includes('anotacao') ||
      n.includes('anotacoes') ||
      n.includes('informacao') ||
      n.includes('informacoes') ||
      n.includes('mensagem') ||
      n.includes('origem') ||
      n.includes('fonte') ||
      n.includes('campanha') ||
      n.includes('notes') ||
      n.includes('comments')
    ) {
      out.observacao = out.observacao ? `${out.observacao} | ${v}` : v;
    }
    // 8. Email
    else if (
      n.includes('email') ||
      n.includes('correio') ||
      n.includes('mail') ||
      n.includes('e-mail') ||
      n.includes('electronicmail')
    ) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        out.email = v.toLowerCase();
      }
    }
    // 9. Phone / WhatsApp / Mobile (High Precision Matching)
    else if (
      (n.includes('whatsapp') ||
        n.includes('whats') ||
        n.includes('wpp') ||
        n.includes('zap') ||
        n.includes('celular') ||
        n.includes('mobile') ||
        n.includes('cel') ||
        n.includes('telefone') ||
        n.includes('fone') ||
        n.includes('phone') ||
        n.includes('tel')) &&
      !PHONE_EXCLUSION_KEYWORDS.some((kw) => n.includes(kw))
    ) {
      const cleaned = cleanPhone(vStr, separateDDD);
      if (cleaned) {
        if (!out.whatsapp || cleaned.length >= out.whatsapp.length) {
          out.whatsapp = cleaned;
        }
      } else if (v && !out.whatsapp && isLikelyPhone(vStr)) {
        out.whatsapp = v;
      }
    }
    // 10. Generic "Numero" or "Contato" column (Only if it contains a valid phone number)
    else if (
      (n === 'numero' || n === 'num' || n === 'numerodecontato' || n === 'numerodocontato' || n === 'contato') &&
      !PHONE_EXCLUSION_KEYWORDS.some((kw) => n.includes(kw))
    ) {
      if (isLikelyPhone(vStr)) {
        const cleaned = cleanPhone(vStr, separateDDD);
        if (cleaned && !out.whatsapp) {
          out.whatsapp = cleaned;
        }
      } else if (n === 'contato' && !out.nome && v.length > 2 && !/^\d+$/.test(v)) {
        out.nome = v;
      }
    }
    // 11. Course / Exam / Position / Area / Interest
    else if (
      (n.includes('curso') ||
        n.includes('concurso') ||
        n.includes('cargo') ||
        n.includes('carreira') ||
        n.includes('orgao') ||
        n.includes('edital') ||
        n.includes('turma') ||
        n.includes('materia') ||
        n.includes('disciplina') ||
        n.includes('produto') ||
        n.includes('area') ||
        n.includes('interesse') ||
        n.includes('plano') ||
        n.includes('modalidade') ||
        n.includes('pacote') ||
        n.includes('modulo') ||
        n.includes('mentoria') ||
        n.includes('course') ||
        n.includes('product')) &&
      !n.includes('matricula') &&
      !n.includes('numinscricao') &&
      !n.includes('datainscricao')
    ) {
      out.curso = v;
    }
    // 12. Student Name / Lead Name / Full Name
    else if (
      (n.includes('nome') ||
        n.includes('name') ||
        n.includes('aluno') ||
        n.includes('aluna') ||
        n.includes('cliente') ||
        n.includes('lead') ||
        n.includes('candidato') ||
        n.includes('candidata') ||
        n.includes('estudante') ||
        n.includes('participante') ||
        n.includes('pessoa') ||
        n.includes('destinatario') ||
        n.includes('titular') ||
        n.includes('assinante') ||
        n.includes('usuario') ||
        n.includes('student') ||
        n.includes('customer')) &&
      !n.includes('sobrenome')
    ) {
      // Don't overwrite if it's "nomedocurso" or "nomedoconcurso"
      if (n.includes('curso') || n.includes('concurso') || n.includes('produto') || n.includes('plano')) {
        if (!out.curso) out.curso = v;
      } else {
        out.nome = v;
      }
    }
    // 13. Surname / Sobrenome
    else if (n.includes('sobrenome') || n.includes('lastname') || n.includes('surname')) {
      sobrenomeCandidate = v;
    }
    // 14. Fallback Heuristic Candidates for Unlabeled / Mystery Columns
    else {
      if (!phoneCandidate && isLikelyPhone(vStr) && !PHONE_EXCLUSION_KEYWORDS.some((kw) => n.includes(kw))) {
        phoneCandidate = cleanPhone(vStr, separateDDD);
      } else if (
        !courseCandidate &&
        (v.toLowerCase().includes('polic') ||
          v.toLowerCase().includes('pm') ||
          v.toLowerCase().includes('pc') ||
          v.toLowerCase().includes('inss') ||
          v.toLowerCase().includes('tj') ||
          v.toLowerCase().includes('concurso') ||
          v.toLowerCase().includes('oab'))
      ) {
        courseCandidate = v;
      } else if (!nameCandidate && v.length > 3 && /^[A-Za-zÀ-ÿ\s]+$/.test(v) && v.includes(' ')) {
        nameCandidate = v;
      } else if (!noteCandidate && v.length > 5 && !PHONE_EXCLUSION_KEYWORDS.some((kw) => n.includes(kw))) {
        noteCandidate = v;
      }
    }
  }

  // Combine First Name + Surname if available
  if (sobrenomeCandidate) {
    if (out.nome && !out.nome.toLowerCase().includes(sobrenomeCandidate.toLowerCase())) {
      out.nome = `${out.nome} ${sobrenomeCandidate}`.trim();
    } else if (!out.nome) {
      out.nome = sobrenomeCandidate;
    }
  }

  // Apply separate DDD if phone number has only 8 or 9 digits
  if (separateDDD && out.whatsapp && (out.whatsapp.length === 8 || out.whatsapp.length === 9)) {
    if (out.whatsapp.length === 8 && ['6', '7', '8', '9'].includes(out.whatsapp.charAt(0))) {
      out.whatsapp = `${separateDDD}9${out.whatsapp}`;
    } else {
      out.whatsapp = `${separateDDD}${out.whatsapp}`;
    }
  }

  // FALLBACK SCANNER 1: Phone number detection from unmapped cells
  if (!out.whatsapp) {
    if (phoneCandidate) {
      out.whatsapp = phoneCandidate;
    } else {
      for (const [k, raw] of Object.entries(row)) {
        const n = normHeader(k);
        if (PHONE_EXCLUSION_KEYWORDS.some((kw) => n.includes(kw))) continue;
        const v = normalizeRawPhoneValue(raw);
        if (isLikelyPhone(v)) {
          const cp = cleanPhone(v, separateDDD);
          if (cp.length >= 8) {
            out.whatsapp = cp;
            break;
          }
        }
      }
    }
  }

  // Re-apply separate DDD to fallback phone if applicable
  if (separateDDD && out.whatsapp && (out.whatsapp.length === 8 || out.whatsapp.length === 9)) {
    if (out.whatsapp.length === 8 && ['6', '7', '8', '9'].includes(out.whatsapp.charAt(0))) {
      out.whatsapp = `${separateDDD}9${out.whatsapp}`;
    } else {
      out.whatsapp = `${separateDDD}${out.whatsapp}`;
    }
  }

  // Normalize any 10-digit mobile number to 11 digits
  if (out.whatsapp && out.whatsapp.length === 10) {
    const ddd = out.whatsapp.slice(0, 2);
    const firstNum = out.whatsapp.charAt(2);
    if (VALID_BRAZIL_DDDS.has(ddd) && ['6', '7', '8', '9'].includes(firstNum)) {
      out.whatsapp = `${ddd}9${out.whatsapp.slice(2)}`;
    }
  }

  // Strip DDI 55 if length is 13 so out.whatsapp is stored as clean 11 digits (DDD + 9 digits)
  if (out.whatsapp && out.whatsapp.length === 13 && out.whatsapp.startsWith('55')) {
    const ddd = out.whatsapp.slice(2, 4);
    if (VALID_BRAZIL_DDDS.has(ddd)) {
      out.whatsapp = out.whatsapp.slice(2);
    }
  }

  // FALLBACK SCANNER 2: Email detection
  if (!out.email) {
    for (const raw of Object.values(row)) {
      const v = String(raw ?? '').trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        out.email = v.toLowerCase();
        break;
      }
    }
  }

  // FALLBACK SCANNER 3: Course detection
  if (!out.curso && courseCandidate) {
    out.curso = courseCandidate;
  }

  // FALLBACK SCANNER 4: Name detection
  if (!out.nome) {
    if (nameCandidate) {
      out.nome = nameCandidate;
    } else {
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

  // FALLBACK SCANNER 5: Notes
  if (!out.observacao && noteCandidate) {
    out.observacao = noteCandidate;
  }

  // Polite Name Fallback: NEVER lose a contact that has phone, email, or data!
  if (!out.nome || !out.nome.trim()) {
    if (out.whatsapp) {
      out.nome = `Contato (${formatPhoneDisplay(out.whatsapp)})`;
    } else if (out.email) {
      out.nome = out.email.split('@')[0];
    } else {
      out.nome = `Lead ${rowIndex !== undefined ? rowIndex + 1 : ''}`.trim();
    }
  }

  return out;
}

/**
 * Universal Intelligent Spreadsheet Buffer Parser.
 * Automatically scans rows to locate the header row (even if on row 2, 3, 4...),
 * detects columns in any arbitrary order, reads multiple sheets, and extracts all contacts reliably.
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer): {
  contacts: Partial<Contact>[];
  sheetNames: string[];
  totalRows: number;
  detectedHeaders: string[];
} {
  const data = new Uint8Array(buffer);
  const wb = XLSX.read(data, { type: 'array', cellDates: false });

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('Nenhuma aba ou planilha encontrada no arquivo.');
  }

  const allContacts: Partial<Contact>[] = [];
  const allDetectedHeaders: Set<string> = new Set();
  let totalProcessedRows = 0;

  const headerKeywords = [
    'nome', 'name', 'aluno', 'cliente', 'lead', 'candidato', 'pessoa', 'contato',
    'telefone', 'whatsapp', 'whats', 'wpp', 'zap', 'celular', 'tel', 'fone', 'numero', 'phone', 'ddd',
    'email', 'mail', 'correio',
    'curso', 'concurso', 'cargo', 'orgao', 'carreira', 'edital', 'turma', 'materia', 'produto', 'interesse', 'plano',
    'data', 'cadastro', 'datacontato', 'criadoem', 'retorno', 'proximo', 'ultimo',
    'status', 'situacao', 'fase', 'etapa', 'temperatura', 'prioridade', 'etiqueta', 'tag',
    'observacao', 'obs', 'nota', 'comentario', 'detalhe', 'historico', 'descricao'
  ];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    // Read sheet as 2D array (formatted and raw)
    const rows2D = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false });
    const rows2DRaw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: true });

    if (!rows2D || rows2D.length === 0) continue;

    // 1. Locate the best header row in the first 25 rows
    let bestHeaderRowIdx = 0;
    let maxHeaderScore = 0;

    const maxSearchRows = Math.min(25, rows2D.length);
    for (let r = 0; r < maxSearchRows; r++) {
      const rowCells = rows2D[r];
      if (!Array.isArray(rowCells)) continue;

      let score = 0;
      for (const cell of rowCells) {
        const norm = normHeader(cell);
        if (!norm) continue;
        for (const kw of headerKeywords) {
          if (norm.includes(kw)) {
            score++;
            break;
          }
        }
      }

      if (score > maxHeaderScore) {
        maxHeaderScore = score;
        bestHeaderRowIdx = r;
      }
    }

    // Header strings
    const headerRow = rows2D[bestHeaderRowIdx] || [];
    const headers: string[] = [];
    for (let col = 0; col < headerRow.length; col++) {
      const hStr = String(headerRow[col] ?? '').trim();
      const finalHeader = hStr || `Coluna_${col + 1}`;
      headers.push(finalHeader);
      allDetectedHeaders.add(finalHeader);
    }

    // 2. Process data rows starting from after the header row
    const startDataRow = maxHeaderScore >= 1 ? bestHeaderRowIdx + 1 : 0;

    for (let r = startDataRow; r < rows2D.length; r++) {
      const rowFormatted = rows2D[r];
      const rowRaw = rows2DRaw[r] || [];
      if (!Array.isArray(rowFormatted) || rowFormatted.length === 0) continue;

      // Build row record
      const rowRecord: Record<string, unknown> = {};
      let hasAnyValue = false;

      for (let c = 0; c < Math.max(headers.length, rowFormatted.length); c++) {
        const colName = headers[c] || `Coluna_${c + 1}`;
        const rawVal = rowRaw[c] !== undefined && rowRaw[c] !== '' ? rowRaw[c] : rowFormatted[c];
        rowRecord[colName] = rawVal;
        if (rawVal !== undefined && rawVal !== '' && rawVal !== null) {
          hasAnyValue = true;
        }
      }

      if (!hasAnyValue) continue;

      totalProcessedRows++;
      const contact = mapRowToContact(rowRecord, totalProcessedRows);

      // Keep contact if it has name, phone, email, or course
      if (contact.whatsapp || contact.email || (contact.nome && !contact.nome.startsWith('Lead '))) {
        allContacts.push(contact);
      }
    }
  }

  return {
    contacts: allContacts,
    sheetNames: wb.SheetNames,
    totalRows: totalProcessedRows,
    detectedHeaders: Array.from(allDetectedHeaders),
  };
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

export type WhatsAppTargetMode = 'desktop_app' | 'same_tab' | 'new_tab';

export function getWhatsAppTargetMode(): WhatsAppTargetMode {
  try {
    const saved = localStorage.getItem('portal_whatsapp_target_mode');
    if (saved === 'desktop_app' || saved === 'same_tab' || saved === 'new_tab') {
      return saved as WhatsAppTargetMode;
    }
  } catch (e) {
    console.error(e);
  }
  // Padrão: Abre direto no Aplicativo WhatsApp (Desktop / Celular) sem abrir abas no navegador!
  return 'desktop_app';
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
  const mode = getWhatsAppTargetMode();
  if (mode === 'desktop_app') {
    return `whatsapp://send?phone=${full}`;
  }
  return `https://web.whatsapp.com/send?phone=${full}`;
}

export function waLinkWithMessage(tel: string, message?: string): string | null {
  const digits = cleanPhone(tel);
  if (!digits) return null;
  const full = digits.length <= 11 ? '55' + digits : digits;
  const msgParam = message && message.trim() ? `&text=${encodeURIComponent(message.trim())}` : '';
  const mode = getWhatsAppTargetMode();
  if (mode === 'desktop_app') {
    return `whatsapp://send?phone=${full}${msgParam}`;
  }
  return `https://web.whatsapp.com/send?phone=${full}${msgParam}`;
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

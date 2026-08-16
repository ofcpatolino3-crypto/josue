import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { Contact, Temperature } from '../types';
import { cleanPhone } from './excel';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

export interface ClientExtractionResult {
  contacts: Contact[];
  totalDetected: number;
  summary: string;
  source: 'ocr_local' | 'pdf_text' | 'regex';
}

/**
 * Intelligent regex and heuristic text parser to extract contacts from WhatsApp messages,
 * raw notes, platform purchase receipts, copy-pasted lists or OCR text without needing an API key.
 */
export function extractContactsFromRawText(text: string): Contact[] {
  if (!text || typeof text !== 'string') return [];

  const contacts: Contact[] = [];
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Common regexes
  const phoneRegex = /(?:\+?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:9\s?)?([0-9]{4,5})[-.\s]?([0-9]{4})\b/g;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

  // Helper to detect course keywords
  const isCourseCandidate = (s: string): boolean => {
    const lower = s.toLowerCase();
    return (
      lower.includes('polic') ||
      lower.includes('pm') ||
      lower.includes('pc') ||
      lower.includes('pf') ||
      lower.includes('prf') ||
      lower.includes('inss') ||
      lower.includes('tj') ||
      lower.includes('tribunal') ||
      lower.includes('banco') ||
      lower.includes('caixa') ||
      lower.includes('sefaz') ||
      lower.includes('detran') ||
      lower.includes('guarda') ||
      lower.includes('oab') ||
      lower.includes('enferm') ||
      lower.includes('saude') ||
      lower.includes('edital') ||
      lower.includes('concurso') ||
      lower.includes('curso') ||
      lower.includes('isolada') ||
      lower.includes('combo') ||
      lower.includes('turma') ||
      lower.includes('mentoria') ||
      lower.includes('apostila') ||
      lower.includes('assinatura') ||
      lower.includes('direito') ||
      lower.includes('portugues') ||
      lower.includes('raciocinio')
    );
  };

  // Helper to clean course string from noise
  const cleanCourseString = (s: string): string => {
    let clean = s.trim();
    // Remove labels like "Curso:", "Produto:", "Concurso:", "Oferta:"
    clean = clean.replace(/^(curso|concurso|produto|oferta|turma|interesse|cargo|edital)\s*[:=-]\s*/i, '');
    clean = clean.replace(/^[\-\•\*\>\s]+/, '').trim();
    return clean;
  };

  // APPROACH 1: Block-based / Multi-line card parsing
  // (Common in WhatsApp forwards or CRM exports where 1 contact spans 2-6 consecutive lines)
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const isDivider = /^[-=_*]{3,}$/.test(line) || /^Aluno\s*#?\d+/i.test(line) || /^Contato\s*#?\d+/i.test(line);

    if (isDivider) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    currentBlock.push(line);

    // If block already has a phone and the next line looks like the start of another contact
    const hasPhone = currentBlock.some((l) => /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/.test(l));
    const nextLineHasPhone = i + 1 < rawLines.length && /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/.test(rawLines[i + 1]);
    const nextLineIsNumbered = i + 1 < rawLines.length && /^\d+[\.\-\)]\s+/.test(rawLines[i + 1]);

    if (hasPhone && (nextLineIsNumbered || (currentBlock.length >= 4 && nextLineHasPhone))) {
      blocks.push(currentBlock);
      currentBlock = [];
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  // Parse each block
  for (const block of blocks) {
    let blockPhone = '';
    let blockEmail = '';
    let blockName = '';
    let blockCourse = '';
    let blockNote = '';
    let blockValor = 0;
    let blockTemp: Temperature = 'Morno';

    for (const line of block) {
      // 1. Check for email
      const emMatches = [...line.matchAll(emailRegex)];
      if (emMatches.length > 0 && !blockEmail) {
        blockEmail = emMatches[0][0].toLowerCase();
      }

      // 2. Check for phone
      const phMatches = [...line.matchAll(phoneRegex)];
      if (phMatches.length > 0 && !blockPhone) {
        blockPhone = cleanPhone(phMatches[0][0]);
      }

      // 3. Check for Temperature / Payment
      const lower = line.toLowerCase();
      if (lower.includes('pagou') || lower.includes('pago') || lower.includes('comprou') || lower.includes('matriculado') || lower.includes('pix')) {
        blockTemp = 'Pagou';
      } else if (lower.includes('quente') || lower.includes('urgente')) {
        blockTemp = 'Quente';
      }

      // 4. Check for explicit value (R$ 150,00)
      const valMatch = line.match(/R\$\s?([0-9]+(?:[.,][0-9]{2})?)/i);
      if (valMatch && !blockValor) {
        blockValor = parseFloat(valMatch[1].replace(',', '.'));
      }

      // 5. Check for explicit Course labels
      const courseLabelMatch = line.match(/(?:curso|concurso|produto|oferta|turma|interesse|cargo|edital)\s*[:=-]\s*(.+)/i);
      if (courseLabelMatch && !blockCourse) {
        blockCourse = cleanCourseString(courseLabelMatch[1]);
      } else if (isCourseCandidate(line) && !blockCourse) {
        // Line itself mentions a known course
        let candidate = line;
        if (phMatches.length > 0) candidate = candidate.replace(phMatches[0][0], '');
        if (emMatches.length > 0) candidate = candidate.replace(emMatches[0][0], '');
        candidate = cleanCourseString(candidate);
        if (candidate.length > 2 && candidate.length < 80) {
          blockCourse = candidate;
        }
      }

      // 6. Check for explicit Name labels or pure name lines
      const nameLabelMatch = line.match(/(?:nome|aluno|cliente|lead|contato)\s*[:=-]\s*(.+)/i);
      if (nameLabelMatch && !blockName) {
        blockName = nameLabelMatch[1].replace(/^[0-9]+[\.\-\)\s]+/, '').trim();
      } else if (!blockName && !phMatches.length && !emMatches.length && !isCourseCandidate(line)) {
        const cleanL = line.replace(/^[0-9]+[\.\-\)\s]+/, '').replace(/^[\-\•\*\>\s]+/, '').trim();
        if (cleanL.length >= 3 && cleanL.length <= 60 && /^[A-Za-zÀ-ÿ\s.\-']+$/.test(cleanL) && cleanL.includes(' ')) {
          blockName = cleanL;
        }
      }
    }

    // If block had a single-line format (e.g. "1. João Silva - 91981234567 - PM Pará - joao@gmail.com")
    if (block.length === 1 && blockPhone) {
      const line = block[0];
      let cleanLine = line;
      if (blockEmail) cleanLine = cleanLine.replace(new RegExp(blockEmail, 'i'), '');
      
      const phoneMatches = [...line.matchAll(phoneRegex)];
      if (phoneMatches.length > 0) {
        cleanLine = cleanLine.replace(phoneMatches[0][0], '');
      }

      cleanLine = cleanLine.replace(/^[0-9]+[\.\-\)\s]+/, '').replace(/^[\-\•\*\>\s]+/, '').trim();

      // Check delimiters
      if (cleanLine.includes(' - ') || cleanLine.includes(' | ') || cleanLine.includes(';') || cleanLine.includes(',')) {
        const sep = cleanLine.includes(' - ') ? ' - ' : cleanLine.includes(' | ') ? ' | ' : cleanLine.includes(';') ? ';' : ',';
        const parts = cleanLine.split(sep).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          blockName = parts[0];
          blockCourse = cleanCourseString(parts.slice(1).join(' - '));
        } else if (parts.length === 1) {
          blockName = parts[0];
        }
      } else if (!blockName) {
        blockName = cleanLine;
      }
    }

    if (blockPhone && blockPhone.length >= 8) {
      const todayIso = new Date().toISOString().split('T')[0];
      contacts.push({
        id: 'client_ext_' + Date.now() + '_' + contacts.length + '_' + Math.random().toString(36).slice(2, 6),
        nome: (blockName || `Contato (${blockPhone})`).slice(0, 80),
        whatsapp: blockPhone,
        email: blockEmail || undefined,
        curso: blockCourse || 'Concursos Gerais',
        temperatura: blockTemp,
        dataContato: todayIso,
        ultimoContato: todayIso,
        proximoContato: todayIso,
        status: 'Novo Lead',
        observacao: blockValor > 0 ? `Valor isolado pago: R$ ${blockValor.toFixed(2)}` : (blockNote || 'Extraído via leitor'),
        createdAt: Date.now(),
      });
    }
  }

  return contacts;
}

/**
 * Extract text from PDF directly in browser
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Local OCR for images using Tesseract.js (runs 100% in client, no API key needed)
 */
export async function extractTextFromImageLocal(
  imageSource: string | File,
  onProgress?: (percent: number, status: string) => void
): Promise<string> {
  let worker: any = null;
  try {
    if (onProgress) onProgress(10, 'Iniciando motor OCR no navegador...');

    worker = await createWorker('por', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const p = Math.round((m.progress || 0) * 80) + 15;
          onProgress(p, `Lendo texto da foto: ${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });

    if (onProgress) onProgress(30, 'Analisando caracteres da imagem...');
    const ret = await worker.recognize(imageSource);
    
    await worker.terminate();
    return ret.data.text || '';
  } catch (err: any) {
    console.warn('Tesseract OCR error:', err);
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
    throw err;
  }
}

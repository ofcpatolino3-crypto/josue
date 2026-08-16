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
 * Intelligent regex text parser to extract contacts from WhatsApp messages,
 * raw notes, copy-pasted lists or OCR text without needing an API key.
 */
export function extractContactsFromRawText(text: string): Contact[] {
  if (!text || typeof text !== 'string') return [];

  const contacts: Contact[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Common patterns
  // Pattern 1: WhatsApp forward format / list format:
  // "Nome"
  // "email@..."
  // "(DD) 9XXXX-XXXX" or "DD9XXXXXXXX"
  // or "1. Fulano - 91988887777 - Concurso TJ"

  const phoneRegex = /(?:\+?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:9\s?)?([0-9]{4,5})[-.\s]?([0-9]{4})\b/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  // Let's iterate block by block or line by line
  let currentContact: Partial<Contact> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line contains phone
    const phoneMatches = [...line.matchAll(phoneRegex)];
    const emailMatches = [...line.matchAll(emailRegex)];

    // Check if this line is a compact single-line contact (e.g. "João Silva, 91981234567, PM Pará")
    if (phoneMatches.length > 0) {
      const matchedPhone = phoneMatches[0][0];
      const cleaned = cleanPhone(matchedPhone);

      // Extract Name and Course by stripping phone and email
      let cleanLine = line.replace(matchedPhone, '').trim();
      let emailFound = '';

      if (emailMatches.length > 0) {
        emailFound = emailMatches[0][0];
        cleanLine = cleanLine.replace(emailFound, '').trim();
      }

      // Remove numbers like "1.", "2.", "•", "-", etc.
      cleanLine = cleanLine.replace(/^[0-9]+[\.\-\)\s]+/, '').replace(/^[\-\•\*\>\s]+/, '').trim();

      // Check for separators like "-" or "," to separate Name and Course
      let name = '';
      let course = 'Concursos Gerais';

      if (cleanLine.includes(' - ')) {
        const parts = cleanLine.split(' - ');
        name = parts[0].trim();
        course = parts.slice(1).join(' - ').trim();
      } else if (cleanLine.includes(' | ')) {
        const parts = cleanLine.split(' | ');
        name = parts[0].trim();
        course = parts.slice(1).join(' | ').trim();
      } else if (cleanLine.includes(';')) {
        const parts = cleanLine.split(';');
        name = parts[0].trim();
        if (parts.length > 1) course = parts[1].trim();
      } else if (cleanLine.includes(',')) {
        const parts = cleanLine.split(',');
        name = parts[0].trim();
        if (parts.length > 1) course = parts[1].trim();
      } else {
        name = cleanLine;
      }

      // If line only had phone, maybe previous line was the name
      if (!name && i > 0 && lines[i - 1].length < 60 && !lines[i - 1].match(phoneRegex)) {
        name = lines[i - 1].replace(/^[0-9]+[\.\-\)\s]+/, '').trim();
      }

      if (cleaned.length >= 10) {
        const todayIso = new Date().toISOString().split('T')[0];
        contacts.push({
          id: 'client_ext_' + Date.now() + '_' + contacts.length + '_' + Math.random().toString(36).slice(2, 6),
          nome: (name || `Contato ${contacts.length + 1}`).slice(0, 80),
          whatsapp: cleaned,
          email: emailFound.toLowerCase() || undefined,
          curso: course || 'Concursos Gerais',
          temperatura: 'Morno' as Temperature,
          dataContato: todayIso,
          ultimoContato: todayIso,
          proximoContato: todayIso,
          status: 'Novo Lead',
          observacao: 'Extraído via OCR no navegador',
          createdAt: Date.now(),
        });
      }
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

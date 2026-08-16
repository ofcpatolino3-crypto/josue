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

// Words that indicate a table header, column label or OCR artifact, NEVER a person or course
const HEADER_BLACK_LIST = [
  'cpf',
  'whatsa',
  'whatsapp',
  'telefone',
  'fone',
  'celular',
  'valor',
  'vaor',
  'preco',
  'preço',
  'r$',
  'data',
  'status',
  'situacao',
  'situação',
  'curso',
  'concurso',
  'aluno',
  'cliente',
  'lead',
  'contato',
  'nome',
  'matricula',
  'matrícula',
  'inscricao',
  'inscrição',
  'email',
  'e-mail',
  'obs',
  'observacao',
  'observação',
  'total',
  'subtotal',
  'linha',
  'item',
  'coluna',
  'id',
  'cod',
  'código',
  'concursos gerais',
];

const VALID_DDDS = new Set([
  '11','12','13','14','15','16','17','18','19',
  '21','22','24','27','28',
  '31','32','33','34','35','37','38',
  '41','42','43','44','45','46','47','48','49',
  '51','53','54','55',
  '61','62','63','64','65','66','67','68','69',
  '71','73','74','75','77','79',
  '81','82','83','84','85','86','87','88','89',
  '91','92','93','94','95','96','97','98','99'
]);

function isHeaderNoise(text: string): boolean {
  if (!text) return true;
  const clean = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (clean.length < 2) return true;

  // Exact header matches or small combinations like "CPF = WhatsA" or ") Vaor ="
  for (const word of HEADER_BLACK_LIST) {
    if (clean === word) return true;
    if (clean.startsWith(word + ' ') || clean.endsWith(' ' + word)) return true;
    if (clean.includes(word) && (clean.includes('=') || clean.includes(':') || clean.includes('|') || clean.includes('-'))) {
      return true;
    }
  }

  if (/^[=\-\:\.\;\)\(\_\s\d]+$/.test(clean)) return true;
  if (/^va[lo0]r\s*[=\:]/i.test(clean)) return true;
  if (/^cpf\s*[=\:]/i.test(clean)) return true;

  return false;
}

/**
 * Intelligent regex and heuristic text parser to extract contacts from WhatsApp messages,
 * raw notes, platform purchase receipts, copy-pasted lists or OCR text without needing an API key.
 */
export function extractContactsFromRawText(text: string): Contact[] {
  if (!text || typeof text !== 'string') return [];

  const contacts: Contact[] = [];
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Phone regex that matches full international/national formats
  // Ex: 5583981119398, +55 83 98111-9398, (83) 98111-9398, 83 98111-9398, 83981119398
  const phonePattern = /(?:(?:\+?55\s?|\(55\)\s?))?(?:\(?([1-9][0-9])\)?\s?)?(?:9\s?)?([0-9]{4,5})[-.\s]?([0-9]{4})\b/g;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

  // Helper to detect course keywords
  const isCourseCandidate = (s: string): boolean => {
    if (isHeaderNoise(s)) return false;
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
      lower.includes('raciocinio') ||
      lower.includes('prefeitura') ||
      lower.includes('municip') ||
      lower.includes('camara') ||
      lower.includes('fiscal') ||
      lower.includes('agente')
    );
  };

  // Helper to clean course string from noise
  const cleanCourseString = (s: string): string => {
    let clean = s.trim();
    if (isHeaderNoise(clean)) return '';
    clean = clean.replace(/^(curso|concurso|produto|oferta|turma|interesse|cargo|edital)\s*[:=-]\s*/i, '');
    clean = clean.replace(/^[\-\•\*\>\s]+/, '').trim();
    // Capitalize properly if needed (e.g. prefeitura de são -> Prefeitura de São...)
    if (clean.length > 2) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return clean;
  };

  // Helper to clean name from IDs, noise and numbers
  const cleanNameString = (s: string): string => {
    if (isHeaderNoise(s)) return '';
    let clean = s.trim();
    // Strip leading ID/Matricula (e.g. "109185 Gustavo" -> "Gustavo")
    clean = clean.replace(/^\d{3,10}\s*[-_\s|:]*\s*/, '');
    // Strip bullet points, numbers ("1.", "1 -")
    clean = clean.replace(/^[0-9]+[\.\-\)\s]+/, '').replace(/^[\-\•\*\>\s]+/, '').trim();
    clean = clean.replace(/^(nome|aluno|cliente|lead|contato)\s*[:=-]\s*/i, '').trim();

    if (isHeaderNoise(clean)) return '';
    return clean;
  };

  // Extract phone helper from any raw string with high precision
  const extractPhoneFromString = (str: string): string => {
    const rawMatches = [...str.matchAll(phonePattern)];
    for (const m of rawMatches) {
      const full = m[0];
      const cleaned = cleanPhone(full);
      if (cleaned.length >= 8 && cleaned.length <= 11) {
        return cleaned;
      }
    }

    // Fallback: look for 10-13 digit blocks
    const digitSequences = str.match(/\b\d{8,14}\b/g);
    if (digitSequences) {
      for (const ds of digitSequences) {
        const cleaned = cleanPhone(ds);
        if (cleaned.length >= 8 && cleaned.length <= 11) {
          return cleaned;
        }
      }
    }
    return '';
  };

  // APPROACH 1: Check if text is tabular (Single-line per record or multi-column table format)
  const singleLineContacts: Contact[] = [];

  for (const line of rawLines) {
    if (isHeaderNoise(line)) continue;

    // Check if line has a phone
    const linePhone = extractPhoneFromString(line);
    if (linePhone) {
      let remainingText = line;

      // Extract email
      const emMatches = [...remainingText.matchAll(emailRegex)];
      let lineEmail = '';
      if (emMatches.length > 0) {
        lineEmail = emMatches[0][0].toLowerCase();
        remainingText = remainingText.replace(emMatches[0][0], ' ');
      }

      // Extract value
      let lineValor = 0;
      const valMatch = remainingText.match(/R\$\s?([0-9]+(?:[.,][0-9]{2})?)/i);
      if (valMatch) {
        lineValor = parseFloat(valMatch[1].replace(',', '.'));
        remainingText = remainingText.replace(valMatch[0], ' ');
      }

      // Remove the phone digits from text to find name & course
      remainingText = remainingText.replace(new RegExp(linePhone, 'g'), ' ');
      // Also remove formatted phone
      remainingText = remainingText.replace(/\+?55\s?|\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g, ' ');

      // Split remaining text by delimiters or large spaces
      const parts = remainingText
        .split(/[\t|;,\-\–—]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 1 && !isHeaderNoise(p));

      let lineName = '';
      let lineCourse = '';

      for (const part of parts) {
        const cleanP = cleanNameString(part);
        if (!cleanP || isHeaderNoise(cleanP)) continue;

        if (isCourseCandidate(cleanP)) {
          if (!lineCourse) lineCourse = cleanCourseString(cleanP);
        } else if (!lineName && /^[A-Za-zÀ-ÿ\s.\-']+$/.test(cleanP)) {
          lineName = cleanP;
        } else if (!lineCourse && cleanP.length > 3) {
          lineCourse = cleanCourseString(cleanP);
        }
      }

      if (!lineName && remainingText.trim()) {
        const fallbackClean = cleanNameString(remainingText);
        if (fallbackClean && !isHeaderNoise(fallbackClean)) {
          lineName = fallbackClean.slice(0, 60);
        }
      }

      const todayIso = new Date().toISOString().split('T')[0];
      singleLineContacts.push({
        id: 'client_ext_' + Date.now() + '_' + singleLineContacts.length + '_' + Math.random().toString(36).slice(2, 6),
        nome: (lineName || `Aluno ${singleLineContacts.length + 1}`).slice(0, 80),
        whatsapp: linePhone,
        email: lineEmail || undefined,
        curso: lineCourse || 'Concursos Gerais',
        temperatura: 'Morno',
        dataContato: todayIso,
        ultimoContato: todayIso,
        proximoContato: todayIso,
        status: 'Novo Lead',
        observacao: lineValor > 0 ? `Valor pago: R$ ${lineValor.toFixed(2)}` : 'Extraído via leitor',
        createdAt: Date.now(),
      });
    }
  }

  // If single-line table parsing yielded results, return them!
  if (singleLineContacts.length > 0) {
    return singleLineContacts;
  }

  // APPROACH 2: Multi-line card/block parsing (WhatsApp forwards, multi-line exports)
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (isHeaderNoise(line)) continue;

    const isDivider = /^[-=_*]{3,}$/.test(line) || /^Aluno\s*#?\d+/i.test(line) || /^Contato\s*#?\d+/i.test(line);

    if (isDivider) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    currentBlock.push(line);

    const hasPhone = currentBlock.some((l) => Boolean(extractPhoneFromString(l)));
    const nextLineHasPhone = i + 1 < rawLines.length && Boolean(extractPhoneFromString(rawLines[i + 1]));
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
      if (isHeaderNoise(line)) continue;

      // 1. Check for email
      const emMatches = [...line.matchAll(emailRegex)];
      if (emMatches.length > 0 && !blockEmail) {
        blockEmail = emMatches[0][0].toLowerCase();
      }

      // 2. Check for phone
      if (!blockPhone) {
        blockPhone = extractPhoneFromString(line);
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
        const cl = cleanCourseString(courseLabelMatch[1]);
        if (cl && !isHeaderNoise(cl)) blockCourse = cl;
      } else if (isCourseCandidate(line) && !blockCourse) {
        let candidate = line;
        if (blockPhone) candidate = candidate.replace(new RegExp(blockPhone, 'g'), '');
        if (blockEmail) candidate = candidate.replace(new RegExp(blockEmail, 'i'), '');
        candidate = cleanCourseString(candidate);
        if (candidate.length > 2 && candidate.length < 80 && !isHeaderNoise(candidate)) {
          blockCourse = candidate;
        }
      }

      // 6. Check for explicit Name labels or pure name lines
      const nameLabelMatch = line.match(/(?:nome|aluno|cliente|lead|contato)\s*[:=-]\s*(.+)/i);
      if (nameLabelMatch && !blockName) {
        const nm = cleanNameString(nameLabelMatch[1]);
        if (nm && !isHeaderNoise(nm)) blockName = nm;
      } else if (!blockName && !extractPhoneFromString(line) && !emMatches.length && !isCourseCandidate(line)) {
        const cleanL = cleanNameString(line);
        if (cleanL.length >= 3 && cleanL.length <= 60 && !isHeaderNoise(cleanL)) {
          blockName = cleanL;
        }
      }
    }

    if (blockPhone && blockPhone.length >= 8) {
      const todayIso = new Date().toISOString().split('T')[0];
      contacts.push({
        id: 'client_ext_' + Date.now() + '_' + contacts.length + '_' + Math.random().toString(36).slice(2, 6),
        nome: (blockName || `Aluno ${contacts.length + 1}`).slice(0, 80),
        whatsapp: blockPhone,
        email: blockEmail || undefined,
        curso: blockCourse || 'Concursos Gerais',
        temperatura: blockTemp,
        dataContato: todayIso,
        ultimoContato: todayIso,
        proximoContato: todayIso,
        status: 'Novo Lead',
        observacao: blockValor > 0 ? `Valor pago: R$ ${blockValor.toFixed(2)}` : (blockNote || 'Extraído via leitor'),
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
 * Preprocesses an image on HTML5 Canvas to drastically improve OCR accuracy:
 * - Upscales low-res mobile screenshots
 * - Converts to grayscale with weighted luminance
 * - Increases contrast & binarizes to black text on white background
 */
async function preprocessImageForTesseract(imageSource: string | File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const onImageLoaded = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));

        // Scale up small images for better character recognition
        let scale = 1;
        if (img.width < 1400 && img.height < 1400) {
          scale = 2; // 2x upscale for crisp text
        }
        const width = img.width * scale;
        const height = img.height * scale;

        canvas.width = width;
        canvas.height = height;

        // Draw image scaled with smooth rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Get image pixel data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Calculate average brightness to detect dark mode screenshots
        let totalLuminance = 0;
        const sampleStep = 8;
        let sampledPixels = 0;
        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          totalLuminance += lum;
          sampledPixels++;
        }
        const avgLuminance = totalLuminance / (sampledPixels || 1);
        const isDarkMode = avgLuminance < 110;

        // High-contrast grayscale conversion & adaptive thresholding
        const contrastFactor = 1.35; // boost contrast
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          // Grayscale luminance
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Invert dark mode to light mode (Tesseract is optimized for black text on white)
          if (isDarkMode) {
            gray = 255 - gray;
          }

          // Apply contrast stretch
          gray = ((gray / 255 - 0.5) * contrastFactor + 0.5) * 255;
          gray = Math.max(0, Math.min(255, gray));

          // Soft binarization: push light grays to pure white and dark grays to crisp black
          if (gray > 175) {
            gray = 255;
          } else if (gray < 75) {
            gray = 0;
          }

          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Image preprocessing failed, falling back to raw image:', err);
        resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));
      }
    };

    img.onerror = () => {
      resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Local OCR for images using Tesseract.js with advanced canvas preprocessing (runs 100% in client, no API key needed)
 */
export async function extractTextFromImageLocal(
  imageSource: string | File,
  onProgress?: (percent: number, status: string) => void
): Promise<string> {
  let worker: any = null;
  try {
    if (onProgress) onProgress(10, 'Aprimorando contraste e nitidez da imagem...');
    const preprocessedDataUrl = await preprocessImageForTesseract(imageSource);

    if (onProgress) onProgress(25, 'Iniciando motor OCR de alta resolução...');

    worker = await createWorker('por', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const p = Math.round((m.progress || 0) * 65) + 25;
          onProgress(p, `Lendo e transcrevendo dados da imagem: ${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });

    if (onProgress) onProgress(40, 'Reconhecendo números de WhatsApp, Nomes e Cursos...');
    const ret = await worker.recognize(preprocessedDataUrl);

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

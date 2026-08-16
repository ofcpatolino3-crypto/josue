import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Sparkles,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus,
  Users,
  Layers,
  Loader2,
  FileCheck,
  ArrowRight,
  Info,
  Edit3,
  Zap,
} from 'lucide-react';
import { Contact, Temperature, UserProfile } from '../types';
import { mapRowToContact, cleanPhone, formatPhoneDisplay, parseRawTextToContacts } from '../utils/excel';
import { extractContactsFromRawText, extractTextFromImageLocal, extractTextFromPDF } from '../utils/clientOcr';

export interface SmartImportResult {
  contacts: Partial<Contact>[];
  batchName: string;
  distributionMode: 'unassigned' | 'equal' | 'single' | 'self';
  targetUserUid?: string;
  targetUserEmail?: string;
  selectedAttendantUids?: string[];
}

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (result: SmartImportResult) => Promise<void> | void;
  existingContacts: Contact[];
  users: UserProfile[];
  currentProfile: UserProfile | null;
}

interface ExtractedItem extends Partial<Contact> {
  id_temp: string;
  selected: boolean;
  isDuplicate?: boolean;
}

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  existingContacts,
  users,
  currentProfile,
}) => {
  const [step, setStep] = useState<'upload' | 'review' | 'distribute'>('upload');
  const [inputTab, setInputTab] = useState<'file' | 'text'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  
  // File details
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  
  // Extracted contacts for review
  const [extractedList, setExtractedList] = useState<ExtractedItem[]>([]);
  const [batchName, setBatchName] = useState('');
  const [aiSummary, setAiSummary] = useState('');

  // Distribution settings
  const [distMode, setDistMode] = useState<'unassigned' | 'equal' | 'single' | 'self'>('unassigned');
  const [singleTargetUid, setSingleTargetUid] = useState('');
  const [selectedAttendantUids, setSelectedAttendantUids] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const approvedAttendants = users.filter((u) => u.status === 'approved' && u.role === 'attendant');

  // Reset modal state
  const resetState = () => {
    setStep('upload');
    setInputTab('file');
    setSelectedFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setExtractedList([]);
    setBatchName('');
    setAiSummary('');
    setErrorMsg('');
    setDistMode('unassigned');
    setSingleTargetUid('');
    setSelectedAttendantUids(approvedAttendants.map((a) => a.uid));
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Check if contact already exists in base
  const checkDuplicate = (item: Partial<Contact>): boolean => {
    const cleanTel = cleanPhone(item.whatsapp || '');
    const cleanMail = (item.email || '').trim().toLowerCase();
    const cleanName = (item.nome || '').trim().toLowerCase();

    return existingContacts.some((c) => {
      const cTel = cleanPhone(c.whatsapp || '');
      const cMail = (c.email || '').trim().toLowerCase();
      const cName = (c.nome || '').trim().toLowerCase();

      if (cleanTel && cTel && cleanTel === cTel) return true;
      if (cleanMail && cMail && cleanMail === cMail) return true;
      if (cleanName && cName && cleanName === cName && cleanTel && cTel && cleanTel === cTel) return true;
      return false;
    });
  };

  // Convert raw items into ExtractedItem list with duplicates marked
  const populateExtractedList = (items: Partial<Contact>[], defaultBatch: string, summary?: string) => {
    const formatted: ExtractedItem[] = items.map((it, idx) => ({
      ...it,
      id_temp: `tmp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      nome: it.nome?.trim() || 'Aluno sem nome',
      whatsapp: it.whatsapp ? cleanPhone(it.whatsapp) : '',
      email: it.email?.trim().toLowerCase() || '',
      curso: it.curso?.trim() || '',
      temperatura: (it.temperatura as Temperature) || 'Frio',
      status: it.status || 'Novo Lead',
      observacao: it.observacao || '',
      selected: true,
      isDuplicate: checkDuplicate(it),
    }));

    setExtractedList(formatted);
    setBatchName(defaultBatch);
    setAiSummary(summary || `Foram encontrados ${formatted.length} contatos prontos para conferência.`);
    setStep('review');
  };

  // Clipboard paste support (Ctrl+V)
  useEffect(() => {
    if (!isOpen || step !== 'upload' || loading) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Check for image files in clipboard
      if (e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              handleFilePicked(file);
              return;
            }
          }
        }
      }

      // If user pasted text and tab is text
      const pastedText = e.clipboardData?.getData('text');
      if (pastedText && pastedText.trim() && inputTab === 'file') {
        // Auto-switch to text tab or process directly if there are phone patterns
        if (/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/.test(pastedText)) {
          setTextInput(pastedText);
          setInputTab('text');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, step, loading, inputTab]);

  // Process Excel/CSV locally with deep scanning
  const processSpreadsheet = (file: File) => {
    setLoading(true);
    setLoadingMsg('Lendo colunas e números da planilha...');
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const data = new Uint8Array(buffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('Nenhuma aba encontrada na planilha.');
        const sheet = wb.Sheets[sheetName];
        
        // Try formatted strings first (preserves phone formatting & currency)
        let rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
        if (rawRows.length === 0) {
          rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
        }
        
        const mapped = rawRows
          .map((row, idx) => mapRowToContact(row, idx))
          .filter((c) => Boolean(c.nome || c.whatsapp || c.email));

        if (mapped.length === 0) {
          throw new Error('Nenhum contato com número ou nome identificado na planilha.');
        }

        const fileNameClean = file.name.replace(/\.[^/.]+$/, '');
        populateExtractedList(
          mapped,
          `Lote Planilha - ${fileNameClean}`,
          `Planilha processada com sucesso! ${mapped.length} contatos e números identificados.`
        );
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Erro ao processar planilha. Verifique o formato do arquivo.');
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Falha ao ler arquivo do computador.');
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Instant local text extraction without AI (0ms delay)
  const processFastLocalText = (rawText: string) => {
    if (!rawText || !rawText.trim()) return;
    setLoading(true);
    setLoadingMsg('Processando lista de contatos instantaneamente...');
    setErrorMsg('');

    try {
      const contacts = parseRawTextToContacts(rawText);
      if (contacts.length === 0) {
        throw new Error('Nenhum contato com número ou nome encontrado no texto colado.');
      }
      populateExtractedList(
        contacts,
        `Lote Texto - ${new Date().toLocaleDateString('pt-BR')}`,
        `Processamento instantâneo: ${contacts.length} contatos extraídos com sucesso!`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível interpretar o texto colado.');
    } finally {
      setLoading(false);
    }
  };

  // Optimize and resize image on client side before sending to AI to guarantee lightning-fast upload & OCR
  const prepareImageForAI = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) {
          return resolve({ base64: '', mimeType: file.type || 'image/jpeg' });
        }

        // For non-images (like PDF), return raw data url
        if (!file.type.startsWith('image/') && !['png', 'jpg', 'jpeg', 'webp', 'bmp'].some((ext) => file.name.toLowerCase().endsWith(ext))) {
          return resolve({ base64: rawDataUrl, mimeType: file.type || 'application/pdf' });
        }

        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 1280; // Optimal 1280px for ultra-sharp text reading with 10x smaller payload (~150KB)
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              // 0.82 JPEG quality creates a lightweight ~100-200KB payload that transfers in <50ms
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
              resolve({ base64: compressedDataUrl, mimeType: 'image/jpeg' });
              return;
            }
          } catch (err) {
            console.warn('Canvas resize failed, falling back to original image:', err);
          }
          resolve({ base64: rawDataUrl, mimeType: file.type || 'image/jpeg' });
        };
        img.onerror = () => {
          resolve({ base64: rawDataUrl, mimeType: file.type || 'image/jpeg' });
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: file.type || 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });
  };

  // Process PDF or Image with Gemini AI
  const processWithAI = async (file?: File, rawText?: string) => {
    setLoading(true);
    setErrorMsg('');

    try {
      let payload: { fileData?: string; mimeType?: string; fileName?: string; text?: string } = {};

      if (file) {
        setLoadingMsg(`Otimizando "${file.name}" para leitura ultra-rápida...`);
        const { base64, mimeType } = await prepareImageForAI(file);

        if (!base64) {
          throw new Error('Não foi possível ler os dados da foto ou arquivo selecionado.');
        }

        payload = {
          fileData: base64,
          mimeType,
          fileName: file.name,
        };
      } else if (rawText) {
        setLoadingMsg('Analisando texto e estruturando contatos com IA...');
        payload = {
          text: rawText,
        };
      }

      setLoadingMsg('Lendo contatos, números e cursos em alta velocidade...');

      let data: any = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        let res = await fetch('/api/ai/extract-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        // Fallback endpoint for Vercel / serverless deployments
        if (res.status === 404) {
          res = await fetch('/api/extract-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        }

        clearTimeout(timeoutId);

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn('Backend OCR endpoint failed or unreachable, trying local browser engine...', fetchErr);
      }

      // If backend was not available or no API key, execute Client-Side OCR locally
      if (!data || !data.contacts || data.contacts.length === 0) {
        if (file) {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          let extractedText = '';

          if (ext === 'pdf' || file.type === 'application/pdf') {
            setLoadingMsg('Extraindo texto do documento PDF diretamente no navegador...');
            extractedText = await extractTextFromPDF(file);
          } else {
            setLoadingMsg('Processando imagem com OCR Local (Sem necessidade de chave API)...');
            extractedText = await extractTextFromImageLocal(file, (p, status) => {
              setLoadingMsg(status);
            });
          }

          if (extractedText) {
            const parsedContacts = extractContactsFromRawText(extractedText);
            if (parsedContacts.length > 0) {
              data = {
                contacts: parsedContacts,
                totalDetected: parsedContacts.length,
                summary: `${parsedContacts.length} contatos identificados com sucesso via OCR no seu navegador.`,
              };
            }
          }
        } else if (rawText) {
          const parsedContacts = extractContactsFromRawText(rawText);
          if (parsedContacts.length > 0) {
            data = {
              contacts: parsedContacts,
              totalDetected: parsedContacts.length,
              summary: `${parsedContacts.length} contatos identificados e formatados no texto.`,
            };
          }
        }
      }

      if (!data || !data.contacts || data.contacts.length === 0) {
        throw new Error('Não foi possível identificar contatos legíveis na imagem ou documento. Verifique se a foto está nítida ou copie e cole o texto dos contatos.');
      }

      const defaultName = file
        ? `Lote ${file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Foto'} - ${file.name.replace(/\.[^/.]+$/, '')}`
        : `Lote Texto - ${new Date().toLocaleDateString('pt-BR')}`;

      populateExtractedList(data.contacts, defaultName, data.summary);
    } catch (err: any) {
      console.error('AI / OCR extraction error:', err);
      setErrorMsg(err.message || 'Não foi possível extrair contatos.');
    } finally {
      setLoading(false);
    }
  };

  // Handle file select
  const handleFilePicked = (file: File) => {
    setSelectedFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext) || file.type.includes('sheet') || file.type.includes('csv');
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    const isImage = ['png', 'jpg', 'jpeg', 'webp', 'jfif', 'bmp', 'heic', 'heif', 'gif'].includes(ext) || file.type.startsWith('image/');

    if (isSpreadsheet) {
      setFilePreviewUrl(null);
      processSpreadsheet(file);
    } else if (isImage) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
      processWithAI(file);
    } else if (isPdf) {
      setFilePreviewUrl(null);
      processWithAI(file);
    } else {
      setErrorMsg('Formato não suportado. Utilize .xlsx, .csv, .pdf, .png, .jpg ou cole o texto.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilePicked(e.dataTransfer.files[0]);
    }
  };

  // List editing functions
  const handleToggleSelectAll = (select: boolean) => {
    setExtractedList((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleToggleItem = (idTemp: string) => {
    setExtractedList((prev) =>
      prev.map((item) => (item.id_temp === idTemp ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleUpdateItem = (idTemp: string, field: keyof Contact, value: any) => {
    setExtractedList((prev) =>
      prev.map((item) => {
        if (item.id_temp === idTemp) {
          const updated = { ...item, [field]: value };
          if (field === 'whatsapp' || field === 'email' || field === 'nome') {
            updated.isDuplicate = checkDuplicate(updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (idTemp: string) => {
    setExtractedList((prev) => prev.filter((item) => item.id_temp !== idTemp));
  };

  const handleAddEmptyRow = () => {
    const newItem: ExtractedItem = {
      id_temp: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nome: 'Novo Aluno',
      whatsapp: '',
      email: '',
      curso: '',
      temperatura: 'Morno',
      status: 'Novo Lead',
      observacao: '',
      selected: true,
      isDuplicate: false,
    };
    setExtractedList((prev) => [newItem, ...prev]);
  };

  const handleDeselectDuplicates = () => {
    setExtractedList((prev) =>
      prev.map((item) => (item.isDuplicate ? { ...item, selected: false } : item))
    );
  };

  // Final confirmation
  const handleFinalize = async () => {
    const selectedContacts = extractedList.filter((item) => item.selected);
    if (selectedContacts.length === 0) {
      alert('Selecione pelo menos um contato para importar.');
      return;
    }

    if (!batchName.trim()) {
      alert('Informe o nome do lote para identificar estes contatos.');
      return;
    }

    if (distMode === 'single' && !singleTargetUid) {
      alert('Selecione o atendente que receberá os contatos.');
      return;
    }

    if (distMode === 'equal' && selectedAttendantUids.length === 0) {
      alert('Selecione pelo menos um atendente para a divisão igualitária.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanContactsToImport: Partial<Contact>[] = selectedContacts.map((it) => ({
        nome: it.nome?.trim() || 'Aluno',
        whatsapp: it.whatsapp ? cleanPhone(it.whatsapp) : '',
        email: it.email?.trim() || '',
        curso: it.curso?.trim() || '',
        temperatura: it.temperatura || 'Frio',
        status: it.status || 'Novo Lead',
        observacao: it.observacao || '',
      }));

      const targetAttendant = users.find((u) => u.uid === singleTargetUid);

      await onConfirmImport({
        contacts: cleanContactsToImport,
        batchName: batchName.trim(),
        distributionMode: distMode,
        targetUserUid: singleTargetUid || undefined,
        targetUserEmail: targetAttendant?.email || undefined,
        selectedAttendantUids: distMode === 'equal' ? selectedAttendantUids : undefined,
      });

      handleClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar contatos: ' + (err.message || 'Falha desconhecida.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = extractedList.filter((c) => c.selected).length;
  const duplicatesCount = extractedList.filter((c) => c.isDuplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#EDE6D6]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B3D63] bg-[#101B2D]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#C9A227] to-[#8C6D1F] text-[#101B2D] shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Importação Inteligente de Contatos
                </h3>
                <span className="bg-[#C9A227]/20 border border-[#C9A227]/40 text-[#C9A227] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  IA Multimodal Gemini
                </span>
              </div>
              <p className="text-xs text-[#8C98B4]">
                Importe planilhas (.xlsx, .csv), documentos PDF, fotos de listas ou texto corrido com detecção automática.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-[#8C98B4] hover:text-white rounded-lg hover:bg-[#1F3057] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* STEP 1: UPLOAD & INPUT */}
          {step === 'upload' && !loading && (
            <div className="space-y-4">
              {/* Type Switcher */}
              <div className="flex items-center gap-2 border-b border-[#2B3D63] pb-3">
                <button
                  type="button"
                  onClick={() => setInputTab('file')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    inputTab === 'file'
                      ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
                      : 'text-[#8C98B4] hover:text-white hover:bg-[#1F3057]'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Arquivo (Planilha, PDF ou Foto)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInputTab('text')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    inputTab === 'text'
                      ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
                      : 'text-[#8C98B4] hover:text-white hover:bg-[#1F3057]'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Colar Texto / Lista de Contatos</span>
                </button>
              </div>

              {/* TAB 1: FILE UPLOADER */}
              {inputTab === 'file' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFilePicked(e.target.files[0]);
                      }
                    }}
                    accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp,.jfif,.bmp,image/*,application/pdf"
                    className="hidden"
                  />

                  {/* Drop Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                      isDragging
                        ? 'border-[#C9A227] bg-[#C9A227]/10 scale-[1.01]'
                        : 'border-[#2B3D63] hover:border-[#C9A227]/60 bg-[#101B2D]/50 hover:bg-[#101B2D]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-3 bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30 rounded-xl shadow-sm" title="Planilhas Excel">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="p-3 bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30 rounded-xl shadow-sm" title="Documentos PDF">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="p-3 bg-[#3B82F6]/15 text-[#60A5FA] border border-[#3B82F6]/30 rounded-xl shadow-sm" title="Fotos e Prints">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        Arraste e solte o arquivo aqui ou <span className="text-[#C9A227] underline">clique para selecionar</span>
                      </p>
                      <p className="text-xs text-[#8C98B4]">
                        Formatos suportados: <strong>Excel (.xlsx, .csv)</strong>, <strong>PDF (.pdf)</strong> e <strong>Imagens/Fotos (.png, .jpg, .jpeg, prints)</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                      <span className="text-[11px] bg-[#1F3057] text-[#8C98B4] px-2.5 py-1 rounded-full border border-[#2B3D63]">
                        📊 Planilhas com colunas automáticas
                      </span>
                      <span className="text-[11px] bg-[#1F3057] text-[#8C98B4] px-2.5 py-1 rounded-full border border-[#2B3D63]">
                        📄 PDFs de matrículas & editais
                      </span>
                      <span className="text-[11px] bg-[#1F3057] text-[#8C98B4] px-2.5 py-1 rounded-full border border-[#2B3D63]">
                        📸 Prints de WhatsApp (Cole com Ctrl+V)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PASTE TEXT */}
              {inputTab === 'text' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#8C98B4]">
                      Cole aqui sua lista de contatos (mensagens do WhatsApp, tabela copiada ou anotações):
                    </label>
                    <textarea
                      rows={8}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder={`Exemplo de texto:\n1. Carlos Silva - 11987654321 - Polícia Federal - Quente - Já pagou R$ 150 no isolado\n2. Maria Santos - maria@gmail.com - (21) 99123-4567 - Concurso INSS\n3. João Pereira - 31976543210 - Tribunais`}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-xl p-3 text-xs sm:text-sm text-white placeholder-[#8C98B4] focus:outline-none focus:border-[#C9A227] font-mono leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!textInput.trim()) {
                          alert('Cole ou digite algum texto antes de processar.');
                          return;
                        }
                        processFastLocalText(textInput);
                      }}
                      disabled={!textInput.trim()}
                      className="flex items-center gap-1.5 bg-[#1F3057] hover:bg-[#2B3D63] text-white border border-[#2B3D63] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4 text-[#34D399]" />
                      <span>Extração Rápida Local</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!textInput.trim()) {
                          alert('Cole ou digite algum texto antes de processar.');
                          return;
                        }
                        processWithAI(undefined, textInput);
                      }}
                      disabled={!textInput.trim()}
                      className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Detectar com IA Gemini</span>
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-[#DC2626]/20 border border-[#DC2626]/40 rounded-xl text-xs text-[#F87171] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* LOADING STATE */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#2B3D63] border-t-[#C9A227] animate-spin" />
                <Sparkles className="w-6 h-6 text-[#C9A227] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Processando com Inteligência Artificial</h4>
                <p className="text-xs text-[#C9A227] animate-pulse">{loadingMsg}</p>
                <p className="text-[11px] text-[#8C98B4]">Identificando e limpando nomes, números de WhatsApp, cursos e dados de venda...</p>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & VALIDATION TABLE */}
          {step === 'review' && !loading && (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#101B2D] border border-[#2B3D63] rounded-xl p-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white">
                        {extractedList.length} contatos detectados
                      </span>
                      <span className="bg-[#C9A227]/20 text-[#C9A227] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {selectedCount} selecionados
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C98B4]">{aiSummary}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
                  {duplicatesCount > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectDuplicates}
                      className="text-[11px] bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#F87171] border border-[#EF4444]/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-medium"
                      title="Desmarca contatos que já existem na base central"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Ignorar {duplicatesCount} duplicados</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddEmptyRow}
                    className="text-[11px] bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] border border-[#2B3D63] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3 h-3 text-[#C9A227]" />
                    <span>Adicionar Linha</span>
                  </button>
                </div>
              </div>

              {/* Lote Name Input */}
              <div className="bg-[#101B2D]/60 border border-[#2B3D63] rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Layers className="w-4 h-4 text-[#C9A227]" />
                  <label className="text-xs font-bold text-white">Nome do Lote:</label>
                </div>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Ex: Lote PDF - Polícia Federal 15/08"
                  className="flex-1 w-full bg-[#172644] border border-[#2B3D63] rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#C9A227]"
                />
              </div>

              {/* Contacts Editable Table */}
              <div className="border border-[#2B3D63] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#101B2D] text-[#8C98B4] sticky top-0 z-10 border-b border-[#2B3D63]">
                    <tr>
                      <th className="py-2 px-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={extractedList.length > 0 && extractedList.every((c) => c.selected)}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="accent-[#C9A227] rounded cursor-pointer"
                        />
                      </th>
                      <th className="py-2 px-3">Nome</th>
                      <th className="py-2 px-3">WhatsApp / Telefone</th>
                      <th className="py-2 px-3">E-mail</th>
                      <th className="py-2 px-3">Curso / Concurso</th>
                      <th className="py-2 px-3">Temperatura</th>
                      <th className="py-2 px-3">Observação</th>
                      <th className="py-2 px-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B3D63]/50">
                    {extractedList.map((item) => (
                      <tr
                        key={item.id_temp}
                        className={`transition-colors ${
                          item.selected ? 'bg-[#172644]' : 'bg-[#101B2D]/40 opacity-60'
                        } ${item.isDuplicate ? 'border-l-2 border-l-[#EF4444]' : ''}`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleItem(item.id_temp)}
                            className="accent-[#C9A227] rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.nome || ''}
                            onChange={(e) => handleUpdateItem(item.id_temp, 'nome', e.target.value)}
                            className="w-full bg-[#101B2D] border border-transparent hover:border-[#2B3D63] focus:border-[#C9A227] rounded px-2 py-1 text-xs text-white focus:outline-none"
                          />
                          {item.isDuplicate && (
                            <span className="text-[10px] text-[#F87171] font-semibold flex items-center gap-0.5 mt-0.5">
                              ⚠️ Já cadastrado
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.whatsapp || ''}
                            onChange={(e) => handleUpdateItem(item.id_temp, 'whatsapp', e.target.value)}
                            placeholder="DDD + Número"
                            className="w-full bg-[#101B2D] border border-transparent hover:border-[#2B3D63] focus:border-[#C9A227] rounded px-2 py-1 text-xs text-white focus:outline-none font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="email"
                            value={item.email || ''}
                            onChange={(e) => handleUpdateItem(item.id_temp, 'email', e.target.value)}
                            placeholder="email@exemplo.com"
                            className="w-full bg-[#101B2D] border border-transparent hover:border-[#2B3D63] focus:border-[#C9A227] rounded px-2 py-1 text-xs text-white focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.curso || ''}
                            onChange={(e) => handleUpdateItem(item.id_temp, 'curso', e.target.value)}
                            placeholder="Ex: Polícia Federal"
                            className="w-full bg-[#101B2D] border border-transparent hover:border-[#2B3D63] focus:border-[#C9A227] rounded px-2 py-1 text-xs text-white focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={item.temperatura || 'Frio'}
                            onChange={(e) => handleUpdateItem(item.id_temp, 'temperatura', e.target.value)}
                            className="bg-[#101B2D] border border-[#2B3D63] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#C9A227]"
                          >
                            <option value="Quente">🔥 Quente</option>
                            <option value="Potencial">🔵 Potencial</option>
                            <option value="Morno">🟡 Morno</option>
                            <option value="Frio">🔴 Frio</option>
                            <option value="Pagou">🟢 Pagou</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.observacao || ''}
                            onChange={(e) => handleUpdateItem(item.id_temp, 'observacao', e.target.value)}
                            placeholder="Notas..."
                            className="w-full bg-[#101B2D] border border-transparent hover:border-[#2B3D63] focus:border-[#C9A227] rounded px-2 py-1 text-xs text-white focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id_temp)}
                            className="text-[#8C98B4] hover:text-[#EF4444] p-1 rounded transition-colors cursor-pointer"
                            title="Remover linha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Distribution Mode Options */}
              <div className="bg-[#101B2D] border border-[#2B3D63] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C9A227]" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">Como deseja destinar estes {selectedCount} contatos?</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Unassigned in Pool */}
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      distMode === 'unassigned'
                        ? 'border-[#C9A227] bg-[#C9A227]/10'
                        : 'border-[#2B3D63] hover:border-[#8C98B4] bg-[#172644]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dist_mode"
                      checked={distMode === 'unassigned'}
                      onChange={() => setDistMode('unassigned')}
                      className="accent-[#C9A227] mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">📦 Banco Geral (Livre)</div>
                      <p className="text-[11px] text-[#8C98B4]">
                        Fica salvo no painel admin para o supervisor distribuir depois na aba "Distribuir Planilhas".
                      </p>
                    </div>
                  </label>

                  {/* Option 2: Equal Division */}
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      distMode === 'equal'
                        ? 'border-[#C9A227] bg-[#C9A227]/10'
                        : 'border-[#2B3D63] hover:border-[#8C98B4] bg-[#172644]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dist_mode"
                      checked={distMode === 'equal'}
                      onChange={() => setDistMode('equal')}
                      className="accent-[#C9A227] mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">⚖️ Distribuir Igualmente</div>
                      <p className="text-[11px] text-[#8C98B4]">
                        Divide os {selectedCount} contatos igualmente entre os atendentes ativos da equipe.
                      </p>
                    </div>
                  </label>

                  {/* Option 3: Single Attendant */}
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      distMode === 'single'
                        ? 'border-[#C9A227] bg-[#C9A227]/10'
                        : 'border-[#2B3D63] hover:border-[#8C98B4] bg-[#172644]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dist_mode"
                      checked={distMode === 'single'}
                      onChange={() => setDistMode('single')}
                      className="accent-[#C9A227] mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">👤 Atribuir a 1 Atendente</div>
                      <p className="text-[11px] text-[#8C98B4]">
                        Direciona todos os contatos do lote para um consultor específico.
                      </p>
                    </div>
                  </label>

                  {/* Option 4: Assign to Self */}
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      distMode === 'self'
                        ? 'border-[#C9A227] bg-[#C9A227]/10'
                        : 'border-[#2B3D63] hover:border-[#8C98B4] bg-[#172644]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dist_mode"
                      checked={distMode === 'self'}
                      onChange={() => setDistMode('self')}
                      className="accent-[#C9A227] mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">🎯 Atribuir para Mim</div>
                      <p className="text-[11px] text-[#8C98B4]">
                        Adiciona diretamente à minha própria lista de atendimento diário.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Sub-selectors for distribution */}
                {distMode === 'single' && (
                  <div className="pt-2 border-t border-[#2B3D63] flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <label className="text-xs font-semibold text-[#8C98B4] shrink-0">Selecione o Atendente:</label>
                    <select
                      value={singleTargetUid}
                      onChange={(e) => setSingleTargetUid(e.target.value)}
                      className="w-full sm:w-auto flex-1 bg-[#172644] border border-[#2B3D63] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C9A227]"
                    >
                      <option value="">-- Escolha um atendente --</option>
                      {approvedAttendants.map((att) => (
                        <option key={att.uid} value={att.uid}>
                          {att.displayName || att.username || att.email} ({att.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {distMode === 'equal' && (
                  <div className="pt-2 border-t border-[#2B3D63] space-y-1.5">
                    <label className="text-xs font-semibold text-[#8C98B4]">
                      Atendentes que participarão da divisão ({selectedAttendantUids.length} selecionados):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {approvedAttendants.map((att) => {
                        const isChecked = selectedAttendantUids.includes(att.uid);
                        return (
                          <button
                            key={att.uid}
                            type="button"
                            onClick={() => {
                              setSelectedAttendantUids((prev) =>
                                isChecked ? prev.filter((id) => id !== att.uid) : [...prev, att.uid]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-[#C9A227] text-[#101B2D] border-[#C9A227] font-bold'
                                : 'bg-[#172644] text-[#8C98B4] border-[#2B3D63]'
                            }`}
                          >
                            {isChecked ? '✓ ' : '+ '}
                            {att.displayName || att.username || att.email}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2B3D63] bg-[#101B2D]">
          {step === 'review' ? (
            <button
              type="button"
              onClick={() => setStep('upload')}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#8C98B4] hover:text-white hover:bg-[#1F3057] transition-colors cursor-pointer"
            >
              ← Voltar ao Envio
            </button>
          ) : (
            <div className="text-xs text-[#8C98B4] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Detecção de contatos com OCR e IA Gemini integrada.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8C98B4] hover:text-white hover:bg-[#1F3057] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {step === 'review' && (
              <button
                type="button"
                onClick={handleFinalize}
                disabled={isSubmitting || selectedCount === 0}
                className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] font-bold px-5 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando Contatos...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Confirmar e Importar {selectedCount} Leads</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

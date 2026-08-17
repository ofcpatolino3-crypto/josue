import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus,
  Users,
  Layers,
  Loader2,
  FileCheck,
  Info,
  Edit3,
  Zap,
} from 'lucide-react';
import { Contact, Temperature, UserProfile } from '../types';
import { cleanPhone, parseSpreadsheetBuffer, parseRawTextToContacts } from '../utils/excel';

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
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [inputTab, setInputTab] = useState<'file' | 'text'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  
  // Extracted contacts for review
  const [extractedList, setExtractedList] = useState<ExtractedItem[]>([]);
  const [batchName, setBatchName] = useState('');
  const [summaryInfo, setSummaryInfo] = useState('');

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
    setExtractedList([]);
    setBatchName('');
    setSummaryInfo('');
    setErrorMsg('');
    setTextInput('');
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
    setSummaryInfo(summary || `Foram encontrados ${formatted.length} contatos prontos para conferência.`);
    setStep('review');
  };

  // Process Excel/CSV locally with deep multi-sheet & arbitrary column order scanning
  const processSpreadsheet = (file: File) => {
    setLoading(true);
    setLoadingMsg('Lendo colunas, números e dados da planilha...');
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseSpreadsheetBuffer(buffer);

        if (result.contacts.length === 0) {
          throw new Error('Nenhum contato válido (com telefone, e-mail ou nome) foi identificado na planilha.');
        }

        const fileNameClean = file.name.replace(/\.[^/.]+$/, '');
        const summary = `Planilha processada! ${result.contacts.length} contatos detectados em ${result.sheetNames.length} aba(s). Colunas identificadas automaticamente.`;

        populateExtractedList(
          result.contacts,
          `Lote Planilha - ${fileNameClean}`,
          summary
        );
      } catch (err: any) {
        console.error('Spreadsheet parsing error:', err);
        setErrorMsg(err.message || 'Erro ao processar planilha. Verifique se o arquivo está em formato .xlsx, .xls ou .csv.');
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

  // Instant local text extraction for copied spreadsheet cells or list
  const processFastLocalText = (rawText: string) => {
    if (!rawText || !rawText.trim()) return;
    setLoading(true);
    setLoadingMsg('Processando linhas e colunas copiadas...');
    setErrorMsg('');

    try {
      const contacts = parseRawTextToContacts(rawText);
      if (contacts.length === 0) {
        throw new Error('Nenhum contato com número ou nome foi encontrado no texto colado.');
      }
      populateExtractedList(
        contacts,
        `Lote Texto - ${new Date().toLocaleDateString('pt-BR')}`,
        `Leitura instantânea: ${contacts.length} contatos identificados e estruturados com sucesso!`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível interpretar o texto colado.');
    } finally {
      setLoading(false);
    }
  };

  // Handle file select
  const handleFilePicked = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext) || file.type.includes('sheet') || file.type.includes('csv');

    if (isSpreadsheet) {
      processSpreadsheet(file);
    } else {
      setErrorMsg('Formato não suportado. Por favor, envie uma planilha no formato .xlsx, .xls ou .csv.');
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
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Importador Inteligente de Planilhas
                </h3>
                <span className="bg-[#C9A227]/20 border border-[#C9A227]/40 text-[#C9A227] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Ordem de Colunas 100% Automática
                </span>
              </div>
              <p className="text-xs text-[#8C98B4]">
                Importe planilhas (.xlsx, .xls, .csv) com reconhecimento automático de qualquer cabeçalho ou ordem.
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
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Planilha Excel / CSV (.xlsx, .xls, .csv)</span>
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
                  <span>Colar Linhas de Tabela / Contatos</span>
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
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
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
                    <div className="p-3.5 bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30 rounded-2xl shadow-sm">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        Arraste e solte a planilha aqui ou <span className="text-[#C9A227] underline">clique para selecionar</span>
                      </p>
                      <p className="text-xs text-[#8C98B4]">
                        Formatos aceitos: <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.csv</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-w-xl text-left">
                      <div className="text-[11px] bg-[#1F3057] text-[#8C98B4] p-2 rounded-lg border border-[#2B3D63] flex items-center gap-1.5">
                        <span className="text-[#34D399] font-bold">✓</span> Independente da ordem das colunas
                      </div>
                      <div className="text-[11px] bg-[#1F3057] text-[#8C98B4] p-2 rounded-lg border border-[#2B3D63] flex items-center gap-1.5">
                        <span className="text-[#34D399] font-bold">✓</span> Detecta cabeçalhos em qualquer linha
                      </div>
                      <div className="text-[11px] bg-[#1F3057] text-[#8C98B4] p-2 rounded-lg border border-[#2B3D63] flex items-center gap-1.5">
                        <span className="text-[#34D399] font-bold">✓</span> Suporte a DDD separado ou junto
                      </div>
                      <div className="text-[11px] bg-[#1F3057] text-[#8C98B4] p-2 rounded-lg border border-[#2B3D63] flex items-center gap-1.5">
                        <span className="text-[#34D399] font-bold">✓</span> Múltiplas abas lidas automaticamente
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PASTE TEXT */}
              {inputTab === 'text' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#8C98B4]">
                      Cole aqui as linhas copiadas do Excel, Google Sheets, WhatsApp ou bloco de notas:
                    </label>
                    <textarea
                      rows={8}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder={`Exemplo de linhas copiadas:\nCarlos Silva\t11987654321\tPolícia Federal\tQuente\nMaria Santos\t(21) 99123-4567\tmaria@gmail.com\tConcurso INSS\nJoão Pereira\t31976543210\tTribunais\tMorno`}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-xl p-3 text-xs sm:text-sm text-white placeholder-[#8C98B4] focus:outline-none focus:border-[#C9A227] font-mono leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end">
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
                      className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Processar Linhas Copiadas</span>
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
                <FileSpreadsheet className="w-6 h-6 text-[#C9A227] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Processando Planilha</h4>
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
                    <p className="text-[11px] text-[#8C98B4]">{summaryInfo}</p>
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
                  placeholder="Ex: Lote Planilha - Concurso PF 2026"
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
              ← Escolher Outra Planilha
            </button>
          ) : (
            <div className="text-xs text-[#8C98B4] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Importação compatível com planilhas Excel (.xlsx, .xls) e arquivos CSV.</span>
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

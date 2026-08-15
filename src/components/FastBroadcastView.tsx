import React, { useState, useRef } from 'react';
import {
  Send,
  Mail,
  Phone,
  Image as ImageIcon,
  Copy,
  Check,
  Sparkles,
  Zap,
  User,
  BookOpen,
  Trash2,
  Upload,
  CheckCircle2,
  ExternalLink,
  Users,
  Clock,
  Plus,
  RefreshCw,
  Eye,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { Contact, MessageTemplate, BroadcastLog, Temperature } from '../types';
import { fillTemplate, waLinkWithMessage, todayStr } from '../utils/excel';

interface FastBroadcastViewProps {
  contacts: Contact[];
  templates: MessageTemplate[];
  onAddContact?: (contact: Contact) => void;
  onMarkContacted?: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const FastBroadcastView: React.FC<FastBroadcastViewProps> = ({
  contacts,
  templates,
  onAddContact,
  onMarkContacted,
  onToast,
}) => {
  // Mode: single quick broadcast, batch queue broadcast, history
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'history'>('single');

  // Single Broadcast Form States
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [nome, setNome] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [curso, setCurso] = useState<string>('');
  const [assuntoEmail, setAssuntoEmail] = useState<string>('🎯 Informação Importante sobre seu Concurso {curso} - Portal Concursos');
  const [mensagem, setMensagem] = useState<string>(
    'Olá {nome}! Tudo bem?\n\nPassando para compartilhar uma oportunidade exclusiva e material atualizado para o seu concurso {curso}.\n\nQualquer dúvida estou à sua disposição aqui no WhatsApp!'
  );
  
  // Image attachment state
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options
  const [autoSaveContact, setAutoSaveContact] = useState<boolean>(true);
  const [autoMarkToday, setAutoMarkToday] = useState<boolean>(true);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // History Log
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>(() => {
    try {
      const saved = localStorage.getItem('portal_broadcast_logs');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Batch Queue States
  const [batchCourseFilter, setBatchCourseFilter] = useState<string>('');
  const [batchTempFilter, setBatchTempFilter] = useState<string>('');
  const [batchOnlyPending, setBatchOnlyPending] = useState<boolean>(true);
  const [batchQueueIndex, setBatchQueueIndex] = useState<number>(0);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  // Format and clean phone
  const cleanPhone = (val: string) => val.replace(/\D/g, '');

  const formatPhoneDisplay = (val: string) => {
    const digits = cleanPhone(val);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = cleanPhone(raw);
    if (digits.length <= 13) {
      setWhatsapp(digits);
    }
  };

  // Load contact from list
  const handleSelectExistingContact = (id: string) => {
    setSelectedContactId(id);
    if (!id) return;
    const found = contacts.find((c) => c.id === id);
    if (found) {
      setNome(found.nome || '');
      setWhatsapp(cleanPhone(found.whatsapp || ''));
      setEmail(found.email || '');
      setCurso(found.curso || '');
      onToast(`Dados de ${found.nome} carregados para disparo!`, 'info');
    }
  };

  // Handle template selection
  const handleApplyTemplate = (tmpl: MessageTemplate) => {
    setMensagem(tmpl.texto);
    onToast(`Modelo "${tmpl.titulo}" aplicado!`, 'info');
  };

  // Handle quick emoji insert
  const handleInsertEmoji = (emoji: string) => {
    setMensagem((prev) => prev + ' ' + emoji);
  };

  // Handle quick tag insert
  const handleInsertTag = (tag: string) => {
    setMensagem((prev) => prev + ` {${tag}}`);
  };

  // Handle Image Upload / Paste
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onToast('A imagem deve ter no máximo 5MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImageUrl(result);
        setImageFileName(file.name);
        onToast('Foto carregada com sucesso!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImageFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onToast('Foto removida do disparo.', 'info');
  };

  // Copy Image to Clipboard as PNG Blob for direct WhatsApp Web Ctrl+V
  const handleCopyImageToClipboard = async () => {
    if (!imageUrl) {
      onToast('Nenhuma imagem carregada para copiar.', 'info');
      return;
    }

    try {
      // Create image element to convert to canvas blob
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context error');
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          onToast('Erro ao processar imagem para cópia.', 'error');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          setCopiedImage(true);
          onToast('📷 Foto copiada! Ao abrir o WhatsApp Web, basta pressionar Ctrl + V para colar a imagem.', 'success');
          setTimeout(() => setCopiedImage(false), 3000);
        } catch (clipErr) {
          console.warn('Clipboard write error:', clipErr);
          // Fallback: download or notify
          onToast('Foto pronta! Você também pode arrastar o arquivo ou colar.', 'info');
        }
      }, 'image/png');
    } catch (e: any) {
      console.error('Error copying image:', e);
      onToast('Não foi possível copiar automaticamente a imagem. Use o botão de download ou arraste a foto.', 'info');
    }
  };

  // Helper to get formatted text for contact
  const getProcessedText = (targetContact?: Partial<Contact>) => {
    const contactObj: Partial<Contact> = targetContact || {
      nome: nome.trim() || 'Amigo(a)',
      curso: curso.trim() || 'Concurso Público',
      whatsapp: whatsapp.trim(),
      email: email.trim(),
    };
    return fillTemplate(mensagem, contactObj);
  };

  const getProcessedSubject = (targetContact?: Partial<Contact>) => {
    const contactObj: Partial<Contact> = targetContact || {
      nome: nome.trim() || 'Amigo(a)',
      curso: curso.trim() || 'Concurso Público',
      whatsapp: whatsapp.trim(),
      email: email.trim(),
    };
    return fillTemplate(assuntoEmail, contactObj);
  };

  // Save log entry
  const recordBroadcast = (channel: 'whatsapp' | 'email' | 'both', contactName: string, textUsed: string) => {
    const newLog: BroadcastLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      contactName: contactName || 'Sem Nome',
      whatsapp: whatsapp,
      email: email,
      channel,
      timestamp: Date.now(),
      messagePreview: textUsed.length > 80 ? textUsed.substring(0, 80) + '...' : textUsed,
      hasImage: Boolean(imageUrl),
      status: 'sent',
    };

    setBroadcastLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      try {
        localStorage.setItem('portal_broadcast_logs', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Save or update contact in DB/Local state
  const handleAutoSaveContact = () => {
    const digits = cleanPhone(whatsapp);
    if (!nome.trim() && !digits) return;

    // Check if contact already exists
    const existing = contacts.find(
      (c) =>
        (digits && cleanPhone(c.whatsapp) === digits) ||
        (email.trim() && c.email?.toLowerCase() === email.trim().toLowerCase())
    );

    if (existing) {
      if (autoMarkToday && onMarkContacted) {
        onMarkContacted(existing.id);
      }
    } else if (onAddContact) {
      const newContact: Contact = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        nome: nome.trim() || 'Contato Sem Nome',
        whatsapp: digits,
        email: email.trim(),
        curso: curso.trim() || 'Geral',
        temperatura: 'Potencial',
        dataContato: todayStr(),
        ultimoContato: autoMarkToday ? todayStr() : '',
        proximoContato: '',
        status: 'Contatado via Disparador',
        observacao: `Disparo realizado em ${new Date().toLocaleDateString('pt-BR')}`,
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        lastMessageText: mensagem.substring(0, 100),
        lastMessageType: 'whatsapp',
        messagesSentCount: 1,
      };
      onAddContact(newContact);
    }
  };

  // --- ACTIONS ---

  // 1. WhatsApp Broadcast
  const handleSendWhatsApp = async () => {
    const digits = cleanPhone(whatsapp);
    if (!digits) {
      onToast('Por favor, informe um número de WhatsApp válido.', 'error');
      return;
    }

    const processedText = getProcessedText();
    const link = waLinkWithMessage(digits, processedText);

    if (!link) {
      onToast('Número de WhatsApp inválido.', 'error');
      return;
    }

    // Auto copy image if present
    if (imageUrl) {
      handleCopyImageToClipboard();
    }

    // Open WhatsApp
    window.open(link, '_blank');

    // Auto save / mark contacted
    if (autoSaveContact) {
      handleAutoSaveContact();
    }

    recordBroadcast('whatsapp', nome || digits, processedText);
    onToast('🚀 WhatsApp aberto com sucesso! Mensagem preenchida.', 'success');
  };

  // 2. Email Broadcast (Gmail Web or Default Mailto)
  const handleSendEmail = (type: 'gmail' | 'mailto' = 'gmail') => {
    if (!email.trim() || !email.includes('@')) {
      onToast('Por favor, informe um endereço de e-mail válido.', 'error');
      return;
    }

    const processedSubject = getProcessedSubject();
    const processedBody = getProcessedText();

    if (type === 'gmail') {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        email.trim()
      )}&su=${encodeURIComponent(processedSubject)}&body=${encodeURIComponent(processedBody)}`;
      window.open(gmailUrl, '_blank');
    } else {
      const mailtoUrl = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(
        processedSubject
      )}&body=${encodeURIComponent(processedBody)}`;
      window.location.href = mailtoUrl;
    }

    if (autoSaveContact) {
      handleAutoSaveContact();
    }

    recordBroadcast('email', nome || email, processedBody);
    onToast(`✉️ E-mail aberto (${type === 'gmail' ? 'Gmail Web' : 'Cliente de E-mail'}) com sucesso!`, 'success');
  };

  // 3. Dual Send (WhatsApp + Email)
  const handleSendBoth = () => {
    if (!cleanPhone(whatsapp) && !email.trim()) {
      onToast('Informe ao menos o WhatsApp ou o E-mail para disparo.', 'error');
      return;
    }

    if (cleanPhone(whatsapp)) {
      handleSendWhatsApp();
    }
    if (email.trim() && email.includes('@')) {
      setTimeout(() => {
        handleSendEmail('gmail');
      }, 500);
    }
  };

  // Copy text to clipboard
  const handleCopyText = () => {
    const text = getProcessedText();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    onToast('Texto copiado com sucesso!', 'success');
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Clear Form
  const handleClearForm = () => {
    setSelectedContactId('');
    setNome('');
    setWhatsapp('');
    setEmail('');
    setCurso('');
    setImageUrl('');
    setImageFileName('');
    onToast('Campos limpos para novo disparo.', 'info');
  };

  // Batch Queue Calculation
  const uniqueCourses = Array.from(
    new Set(contacts.map((c) => c.curso?.trim()).filter(Boolean))
  ) as string[];

  const filteredBatchQueue = contacts.filter((c) => {
    if (batchCourseFilter && (c.curso || '').toLowerCase() !== batchCourseFilter.toLowerCase()) {
      return false;
    }
    if (batchTempFilter && (c.temperatura || '').toLowerCase() !== batchTempFilter.toLowerCase()) {
      return false;
    }
    if (batchOnlyPending && c.ultimoContato) {
      return false;
    }
    if (selectedBatchIds.length > 0 && !selectedBatchIds.includes(c.id)) {
      return false;
    }
    return true;
  });

  const currentBatchContact = filteredBatchQueue[batchQueueIndex] || null;

  const handleNextBatchContact = (step: number = 1) => {
    const nextIdx = batchQueueIndex + step;
    if (nextIdx >= 0 && nextIdx < filteredBatchQueue.length) {
      setBatchQueueIndex(nextIdx);
    }
  };

  const handleBatchSendWhatsAppCurrent = () => {
    if (!currentBatchContact) return;
    const digits = cleanPhone(currentBatchContact.whatsapp);
    if (!digits) {
      onToast(`Contato "${currentBatchContact.nome}" sem telefone válido.`, 'error');
      handleNextBatchContact(1);
      return;
    }

    const processedText = fillTemplate(mensagem, currentBatchContact);
    const link = waLinkWithMessage(digits, processedText);
    if (link) {
      if (imageUrl) {
        handleCopyImageToClipboard();
      }
      window.open(link, '_blank');
      if (onMarkContacted) {
        onMarkContacted(currentBatchContact.id);
      }
      recordBroadcast('whatsapp', currentBatchContact.nome, processedText);
      onToast(`Disparo realizado para ${currentBatchContact.nome}!`, 'success');
      // Advance to next
      if (batchQueueIndex < filteredBatchQueue.length - 1) {
        setBatchQueueIndex((prev) => prev + 1);
      }
    }
  };

  const handleBatchSendEmailCurrent = () => {
    if (!currentBatchContact || !currentBatchContact.email) {
      onToast(`Contato "${currentBatchContact?.nome}" sem e-mail cadastrado.`, 'error');
      return;
    }
    const processedSubject = fillTemplate(assuntoEmail, currentBatchContact);
    const processedBody = fillTemplate(mensagem, currentBatchContact);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      currentBatchContact.email.trim()
    )}&su=${encodeURIComponent(processedSubject)}&body=${encodeURIComponent(processedBody)}`;
    window.open(gmailUrl, '_blank');
    if (onMarkContacted) {
      onMarkContacted(currentBatchContact.id);
    }
    recordBroadcast('email', currentBatchContact.nome, processedBody);
    onToast(`E-mail aberto para ${currentBatchContact.nome}!`, 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#C9A227] text-xs font-bold uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4 text-[#C9A227]" />
              Central de Disparos Rápidos
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#EDE6D6]">
              Disparador de WhatsApp & E-mail
            </h2>
            <p className="text-xs sm:text-sm text-[#8C98B4] mt-1">
              Preencha nome, número, e-mail, foto e mensagem para disparar instantaneamente com 1 clique.
            </p>
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1.5 bg-[#101B2D] p-1 rounded-lg border border-[#2B3D63] self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'single'
                  ? 'bg-[#C9A227] text-[#101B2D] shadow-sm'
                  : 'text-[#8C98B4] hover:text-[#EDE6D6]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Disparo Rápido</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'batch'
                  ? 'bg-[#C9A227] text-[#101B2D] shadow-sm'
                  : 'text-[#8C98B4] hover:text-[#EDE6D6]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Disparo em Lote / Fila</span>
              <span className="text-[10px] bg-[#1F3057] text-[#C9A227] px-1.5 py-0.2 rounded-full">
                {filteredBatchQueue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#C9A227] text-[#101B2D] shadow-sm'
                  : 'text-[#8C98B4] hover:text-[#EDE6D6]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Histórico ({broadcastLogs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: SINGLE DISPATCH (O QUE O USUÁRIO PEDIU: EMAIL, NOME, NÚMERO, MSG, FOTO E PRONTO) */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: FORM INPUTS (Col 7) */}
          <div className="lg:col-span-7 bg-[#172644] border border-[#2B3D63] rounded-xl p-5 sm:p-6 space-y-5 shadow-md">
            {/* Quick Load Existing Contact */}
            <div className="bg-[#101B2D] p-3.5 rounded-lg border border-[#2B3D63] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C9A227]" />
                <span className="text-xs font-semibold text-[#EDE6D6]">
                  Carregar de um contato salvo (opcional):
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedContactId}
                  onChange={(e) => handleSelectExistingContact(e.target.value)}
                  className="w-full sm:w-64 bg-[#172644] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="">-- Digitar manualmente ou escolher aluno --</option>
                  {contacts.slice(0, 200).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.curso ? `(${c.curso})` : ''} - {c.whatsapp || c.email}
                    </option>
                  ))}
                </select>

                {(nome || whatsapp || email) && (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="text-xs text-[#8C98B4] hover:text-[#B14432] p-1.5 rounded hover:bg-[#1F3057] transition-colors"
                    title="Limpar campos"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Inputs: Nome & Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#EDE6D6] mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#C9A227]" />
                  Nome do Aluno / Destinatário:
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Alberto da Silva"
                  className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-sm text-[#EDE6D6] placeholder-[#5A688A] focus:outline-none focus:border-[#C9A227]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EDE6D6] mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#4ADE80]" />
                  Número do WhatsApp / Celular:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatPhoneDisplay(whatsapp)}
                    onChange={handlePhoneChange}
                    placeholder="Ex: (91) 98765-4321"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-sm text-[#EDE6D6] placeholder-[#5A688A] focus:outline-none focus:border-[#4ADE80]"
                  />
                  {whatsapp && (
                    <span className="absolute right-2.5 top-2.5 text-[10px] bg-[#6E8F5C]/20 text-[#4ADE80] px-1.5 py-0.5 rounded font-mono">
                      +55 {cleanPhone(whatsapp)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs: E-mail & Curso */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#EDE6D6] mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#60A5FA]" />
                  E-mail do Destinatário:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: carlos.alberto@gmail.com"
                  className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-sm text-[#EDE6D6] placeholder-[#5A688A] focus:outline-none focus:border-[#60A5FA]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EDE6D6] mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#C9A227]" />
                  Curso / Concurso de Interesse:
                </label>
                <input
                  type="text"
                  value={curso}
                  onChange={(e) => setCurso(e.target.value)}
                  placeholder="Ex: Polícia Militar do Pará - PMPA"
                  className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-sm text-[#EDE6D6] placeholder-[#5A688A] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
            </div>

            {/* Assunto do E-mail (quando for disparar por e-mail) */}
            <div>
              <label className="block text-xs font-semibold text-[#EDE6D6] mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#60A5FA]" />
                Assunto do E-mail:
              </label>
              <input
                type="text"
                value={assuntoEmail}
                onChange={(e) => setAssuntoEmail(e.target.value)}
                placeholder="Assunto do e-mail..."
                className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#EDE6D6] placeholder-[#5A688A] focus:outline-none focus:border-[#60A5FA]"
              />
            </div>

            {/* Modelos Prontos & Tags Rápidas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8C98B4] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
                  Modelos Rápidos de Mensagem:
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[#8C98B4]">Inserir Tag:</span>
                  {['nome', 'curso', 'whatsapp', 'email'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag)}
                      className="text-[10px] bg-[#101B2D] text-[#C9A227] hover:bg-[#1F3057] border border-[#2B3D63] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      {`{${tag}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {templates.slice(0, 6).map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="text-xs bg-[#101B2D] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] px-2.5 py-1 rounded-md whitespace-nowrap cursor-pointer transition-colors"
                    title={tmpl.texto}
                  >
                    {tmpl.titulo}
                  </button>
                ))}
              </div>
            </div>

            {/* Mensagem Principal */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#EDE6D6]">
                  Mensagem do Disparo:
                </label>
                <div className="flex items-center gap-1">
                  {['🔥', '🚀', '📚', '🎯', '⏳', '🏆', '✅', '📲'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleInsertEmoji(emoji)}
                      className="text-xs hover:scale-125 transition-transform p-0.5 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={5}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Escreva sua mensagem aqui... Use {nome} e {curso} para personalizar automaticamente."
                className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-3 text-sm text-[#EDE6D6] placeholder-[#5A688A] focus:outline-none focus:border-[#C9A227] leading-relaxed font-sans"
              />
              <div className="flex items-center justify-between text-[11px] text-[#8C98B4] mt-1">
                <span>{mensagem.length} caracteres · {mensagem.split(/\s+/).filter(Boolean).length} palavras</span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-[#C9A227] hover:underline cursor-pointer"
                >
                  {copiedText ? <Check className="w-3 h-3 text-[#4ADE80]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>
              </div>
            </div>

            {/* Foto / Imagem do Disparo */}
            <div className="bg-[#101B2D] border border-[#2B3D63] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#EDE6D6] flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#C9A227]" />
                  Foto / Imagem Anexo para o Disparo:
                </label>
                {imageUrl && (
                  <span className="text-[11px] text-[#4ADE80] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Foto anexada
                  </span>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageFileChange}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
              />

              {!imageUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#2B3D63] hover:border-[#C9A227] rounded-lg p-5 text-center cursor-pointer transition-colors bg-[#172644]/50 hover:bg-[#172644]"
                >
                  <Upload className="w-7 h-7 text-[#C9A227] mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-[#EDE6D6]">
                    Clique para selecionar uma foto ou arraste o arquivo aqui
                  </p>
                  <p className="text-[11px] text-[#8C98B4] mt-1">
                    PNG, JPG, WebP até 5MB (Banners, tabela de planos, comprovantes, avisos)
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#172644] p-3 rounded-lg border border-[#2B3D63]">
                  <div className="relative group shrink-0">
                    <img
                      src={imageUrl}
                      alt="Anexo de disparo"
                      className="w-24 h-24 object-cover rounded-md border border-[#2B3D63] shadow-md"
                    />
                  </div>

                  <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                    <p className="text-xs font-semibold text-[#EDE6D6] truncate">
                      {imageFileName || 'Imagem carregada pronta para envio'}
                    </p>
                    <p className="text-[11px] text-[#8C98B4]">
                      A foto está pronta! Clique em <b>"Copiar Foto"</b> para colar direto na conversa do WhatsApp Web (Ctrl+V) ou anexar no e-mail.
                    </p>

                    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={handleCopyImageToClipboard}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                          copiedImage
                            ? 'bg-[#4ADE80] text-[#101B2D]'
                            : 'bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D]'
                        }`}
                      >
                        {copiedImage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedImage ? 'Foto Copiada (Ctrl+V)!' : 'Copiar Foto para Colar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="flex items-center gap-1 text-xs text-[#B14432] hover:text-white hover:bg-[#B14432] px-2.5 py-1.5 rounded-md border border-[#B14432]/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Checkboxes: Save contact & Mark today */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-[#2B3D63]/70">
              <label className="flex items-center gap-2 text-xs text-[#EDE6D6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSaveContact}
                  onChange={(e) => setAutoSaveContact(e.target.checked)}
                  className="rounded border-[#2B3D63] text-[#C9A227] focus:ring-[#C9A227]"
                />
                <span>Salvar novo contato na base de dados se não existir</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-[#EDE6D6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoMarkToday}
                  onChange={(e) => setAutoMarkToday(e.target.checked)}
                  className="rounded border-[#2B3D63] text-[#4ADE80] focus:ring-[#4ADE80]"
                />
                <span>Marcar contato como contatado hoje ({todayStr()})</span>
              </label>
            </div>

            {/* BOTOES DE DISPARO RÁPIDO (E PRONTO!) */}
            <div className="pt-2 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#C9A227]">
                Ações de Disparo Imediato:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. DISPARAR WHATSAPP */}
                <button
                  type="button"
                  id="fast-send-whatsapp-btn"
                  onClick={handleSendWhatsApp}
                  disabled={!whatsapp}
                  className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-[#101B2D] font-bold text-sm sm:text-base py-3 px-4 rounded-xl shadow-lg transition-all transform active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-5 h-5" />
                  <span>Disparar via WhatsApp</span>
                </button>

                {/* 2. DISPARAR E-MAIL (GMAIL) */}
                <button
                  type="button"
                  id="fast-send-email-btn"
                  onClick={() => handleSendEmail('gmail')}
                  disabled={!email}
                  className="flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold text-sm sm:text-base py-3 px-4 rounded-xl shadow-lg transition-all transform active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Mail className="w-5 h-5" />
                  <span>Disparar via E-mail (Gmail)</span>
                </button>
              </div>

              {/* Action: Dual Send (WhatsApp + Gmail ao mesmo tempo) */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSendBoth}
                  disabled={!whatsapp && !email}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] font-semibold text-xs sm:text-sm py-2.5 px-3 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Zap className="w-4 h-4 text-[#C9A227]" />
                  <span>Disparo Duplo (WhatsApp + E-mail)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendEmail('mailto')}
                  disabled={!email}
                  className="flex items-center justify-center gap-1.5 bg-[#101B2D] hover:bg-[#1F3057] text-[#8C98B4] hover:text-[#EDE6D6] border border-[#2B3D63] text-xs py-2.5 px-3 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                  title="Abrir no Outlook, Thunderbird ou App de E-mail Padrão"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Cliente Padrão</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: LIVE PREVIEW (Col 5) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 shadow-md">
              <div className="flex items-center justify-between border-b border-[#2B3D63] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#C9A227]" />
                  <h3 className="text-sm font-bold font-serif text-[#EDE6D6]">
                    Pré-visualização do Disparo
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-bold bg-[#101B2D] text-[#4ADE80] px-2 py-0.5 rounded border border-[#6E8F5C]/40">
                  Visualização Real
                </span>
              </div>

              {/* WhatsApp Balloon Preview */}
              <div className="bg-[#0B141A] rounded-xl p-4 border border-[#2B3D63] shadow-inner space-y-3">
                <div className="flex items-center justify-between text-[11px] text-[#8C98B4] border-b border-[#1F3057] pb-2">
                  <span className="font-semibold text-[#EDE6D6]">
                    Para: {nome.trim() || 'Nome do Aluno'}
                  </span>
                  <span className="font-mono text-[#4ADE80]">
                    {whatsapp ? `+55 ${cleanPhone(whatsapp)}` : '(Sem número)'}
                  </span>
                </div>

                {/* Attached Image Preview */}
                {imageUrl && (
                  <div className="relative rounded-lg overflow-hidden border border-[#2B3D63] bg-[#172644]">
                    <img
                      src={imageUrl}
                      alt="Preview do Anexo"
                      className="w-full max-h-48 object-cover"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/70 text-[10px] text-white px-1.5 py-0.5 rounded">
                      📷 Foto Anexada
                    </div>
                  </div>
                )}

                {/* Message Bubble */}
                <div className="bg-[#005C4B] text-[#EDE6D6] p-3.5 rounded-lg rounded-tr-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-md">
                  {getProcessedText()}
                  <div className="text-[10px] text-right text-[#A0D2C8] mt-1.5">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </div>
                </div>
              </div>

              {/* Email Subject Preview */}
              <div className="mt-4 p-3 bg-[#101B2D] rounded-lg border border-[#2B3D63] text-xs space-y-1">
                <div className="text-[11px] text-[#8C98B4] font-semibold">Assunto do E-mail formatado:</div>
                <div className="text-[#EDE6D6] font-medium">{getProcessedSubject()}</div>
                <div className="text-[10px] text-[#60A5FA] mt-1">Destinatário: {email || '(Nenhum e-mail informado)'}</div>
              </div>
            </div>

            {/* Quick tips */}
            <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-4 space-y-2 text-xs text-[#8C98B4]">
              <div className="flex items-center gap-1.5 font-bold text-[#C9A227]">
                <Sparkles className="w-3.5 h-3.5" />
                Dica de Disparo com Foto:
              </div>
              <p>
                1. Ao clicar em <b>"Disparar via WhatsApp"</b>, a foto é copiada automaticamente para sua área de transferência.
              </p>
              <p>
                2. Na janela do WhatsApp Web que se abre, basta pressionar <b>Ctrl + V</b> para colar a imagem imediatamente e enviar!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BATCH / QUEUE DISPATCH */}
      {activeTab === 'batch' && (
        <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 sm:p-6 space-y-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2B3D63] pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-serif text-[#EDE6D6]">
                Fila de Disparos em Sequência ({filteredBatchQueue.length} contatos)
              </h3>
              <p className="text-xs text-[#8C98B4] mt-0.5">
                Dispare para a lista inteira um por um com 1 clique por aluno, sem travar o WhatsApp e com marcação automática.
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={batchCourseFilter}
                onChange={(e) => {
                  setBatchCourseFilter(e.target.value);
                  setBatchQueueIndex(0);
                }}
                className="bg-[#101B2D] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-md px-2.5 py-1.5 focus:outline-none"
              >
                <option value="">Todos os Cursos</option>
                {uniqueCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={batchTempFilter}
                onChange={(e) => {
                  setBatchTempFilter(e.target.value);
                  setBatchQueueIndex(0);
                }}
                className="bg-[#101B2D] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-md px-2.5 py-1.5 focus:outline-none"
              >
                <option value="">Todas Temperaturas</option>
                <option value="Quente">🔥 Quente</option>
                <option value="Potencial">⚡ Potencial</option>
                <option value="Morno">🌤️ Morno</option>
                <option value="Frio">❄️ Frio</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-[#8C98B4] bg-[#101B2D] px-2.5 py-1.5 rounded border border-[#2B3D63] cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchOnlyPending}
                  onChange={(e) => {
                    setBatchOnlyPending(e.target.checked);
                    setBatchQueueIndex(0);
                  }}
                  className="rounded border-[#2B3D63] text-[#C9A227]"
                />
                <span>Apenas não contatados hoje</span>
              </label>
            </div>
          </div>

          {filteredBatchQueue.length === 0 ? (
            <div className="py-12 text-center text-[#8C98B4]">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#C9A227] opacity-60" />
              <p className="text-sm font-semibold text-[#EDE6D6]">Nenhum contato encontrado com esses filtros.</p>
              <p className="text-xs mt-1">Altere os filtros acima para listar contatos para disparo.</p>
            </div>
          ) : currentBatchContact ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Active Item Card (Col 7) */}
              <div className="lg:col-span-7 bg-[#101B2D] border border-[#2B3D63] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase bg-[#C9A227] text-[#101B2D] px-2.5 py-0.5 rounded-full">
                      Item {batchQueueIndex + 1} de {filteredBatchQueue.length}
                    </span>
                    <span className="text-xs text-[#8C98B4]">
                      {Math.round(((batchQueueIndex + 1) / filteredBatchQueue.length) * 100)}% concluído
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleNextBatchContact(-1)}
                      disabled={batchQueueIndex === 0}
                      className="text-xs bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] px-2.5 py-1 rounded border border-[#2B3D63] disabled:opacity-30 cursor-pointer"
                    >
                      ← Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextBatchContact(1)}
                      disabled={batchQueueIndex >= filteredBatchQueue.length - 1}
                      className="text-xs bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] px-2.5 py-1 rounded border border-[#2B3D63] disabled:opacity-30 cursor-pointer"
                    >
                      Próximo →
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#172644] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#C9A227] h-full transition-all duration-300"
                    style={{
                      width: `${((batchQueueIndex + 1) / filteredBatchQueue.length) * 100}%`,
                    }}
                  />
                </div>

                {/* Contact Data */}
                <div className="bg-[#172644] p-4 rounded-lg border border-[#2B3D63] space-y-2">
                  <h4 className="text-lg font-bold font-serif text-[#EDE6D6]">
                    {currentBatchContact.nome}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[#8C98B4]">WhatsApp:</span>{' '}
                      <span className="font-mono text-[#4ADE80] font-bold">
                        {currentBatchContact.whatsapp || 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8C98B4]">E-mail:</span>{' '}
                      <span className="text-[#60A5FA] truncate block">
                        {currentBatchContact.email || 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8C98B4]">Curso:</span>{' '}
                      <span className="text-[#EDE6D6] font-semibold">
                        {currentBatchContact.curso || 'Geral'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dispatch Buttons for Current Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBatchSendWhatsAppCurrent}
                    className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-[#101B2D] font-bold py-3 px-4 rounded-xl shadow transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Disparar WhatsApp ({batchQueueIndex + 1})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBatchSendEmailCurrent}
                    disabled={!currentBatchContact.email}
                    className="flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-3 px-4 rounded-xl shadow transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Disparar E-mail</span>
                  </button>
                </div>
              </div>

              {/* Message Live Preview (Col 5) */}
              <div className="lg:col-span-5 bg-[#0B141A] rounded-xl p-4 border border-[#2B3D63] space-y-3">
                <div className="text-xs font-semibold text-[#8C98B4] border-b border-[#1F3057] pb-2">
                  Mensagem que será enviada para {currentBatchContact.nome}:
                </div>

                {imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-[#2B3D63] max-h-36">
                    <img src={imageUrl} alt="Foto" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="bg-[#005C4B] text-[#EDE6D6] p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap">
                  {fillTemplate(mensagem, currentBatchContact)}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: BROADCAST HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-[#2B3D63] pb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-[#EDE6D6]">
                Histórico de Disparos Realizados
              </h3>
              <p className="text-xs text-[#8C98B4]">
                Registro das últimas mensagens disparadas por WhatsApp e E-mail nesta sessão.
              </p>
            </div>

            {broadcastLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Deseja limpar o histórico de disparos?')) {
                    setBroadcastLogs([]);
                    localStorage.removeItem('portal_broadcast_logs');
                    onToast('Histórico de disparos limpo.', 'info');
                  }
                }}
                className="text-xs text-[#8C98B4] hover:text-[#B14432] flex items-center gap-1 p-1.5 rounded hover:bg-[#101B2D] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>

          {broadcastLogs.length === 0 ? (
            <div className="py-12 text-center text-[#8C98B4]">
              <Clock className="w-8 h-8 mx-auto mb-2 text-[#C9A227] opacity-50" />
              <p className="text-sm font-semibold text-[#EDE6D6]">Nenhum disparo registrado ainda.</p>
              <p className="text-xs mt-1">Os disparos efetuados aparecerão listados aqui.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2B3D63] overflow-hidden">
              {broadcastLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        log.channel === 'whatsapp'
                          ? 'bg-[#25D366]/20 text-[#25D366]'
                          : log.channel === 'email'
                          ? 'bg-[#60A5FA]/20 text-[#60A5FA]'
                          : 'bg-[#C9A227]/20 text-[#C9A227]'
                      }`}
                    >
                      {log.channel === 'whatsapp' ? (
                        <Phone className="w-4 h-4" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#EDE6D6] truncate">
                          {log.contactName}
                        </span>
                        <span className="text-[10px] text-[#8C98B4] font-mono">
                          {log.whatsapp || log.email}
                        </span>
                        {log.hasImage && (
                          <span className="text-[10px] bg-[#101B2D] text-[#C9A227] px-1.5 py-0.2 rounded border border-[#2B3D63]">
                            📷 com foto
                          </span>
                        )}
                      </div>
                      <p className="text-[#8C98B4] truncate text-[11px] mt-0.5">
                        {log.messagePreview}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-[#8C98B4]">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="text-[10px] text-[#4ADE80] font-semibold">
                      ✓ Disparado
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

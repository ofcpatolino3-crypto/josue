import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Copy,
  Check,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowRightLeft,
  RefreshCw,
  Edit3,
  Mail,
  Phone,
  BookOpen,
  FastForward,
  Mic,
  Volume2,
  Timer,
  Headphones,
  Plus,
  BookmarkPlus,
  Save,
  Tag,
} from 'lucide-react';
import { Contact, MessageTemplate, MessageTemplateCategory } from '../types';
import { fillTemplate, openWhatsAppDirect } from '../utils/excel';

interface MessageModalProps {
  isOpen: boolean;
  contact: Contact | null;
  contactsQueue?: Contact[];
  templates: MessageTemplate[];
  onClose: () => void;
  onSelectContact?: (contact: Contact) => void;
  onMarkContacted?: (id: string) => void;
  onAddTemplate?: (newTmpl: MessageTemplate) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  contact,
  contactsQueue = [],
  templates,
  onClose,
  onSelectContact,
  onMarkContacted,
  onAddTemplate,
  onToast,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateFilter, setTemplateFilter] = useState<'all' | 'audio' | 'text'>('all');
  const [customText, setCustomText] = useState<string>('');
  const [autoMarkContacted, setAutoMarkContacted] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Quick Script Creator inline state
  const [showInlineNewScript, setShowInlineNewScript] = useState<boolean>(false);
  const [newScriptTitle, setNewScriptTitle] = useState<string>('');
  const [newScriptCategory, setNewScriptCategory] = useState<MessageTemplateCategory>('roteiro_audio');
  const [newScriptGatilho, setNewScriptGatilho] = useState<string>('');
  const [newScriptText, setNewScriptText] = useState<string>('');
  const [newScriptType, setNewScriptType] = useState<'texto' | 'audio'>('audio');

  // Quick Save Current Text as Script
  const [showSaveCurrentAsScript, setShowSaveCurrentAsScript] = useState<boolean>(false);
  const [saveCurrentTitle, setSaveCurrentTitle] = useState<string>('');
  const [saveCurrentCategory, setSaveCurrentCategory] = useState<MessageTemplateCategory>('roteiro_audio');
  const [saveCurrentGatilho, setSaveCurrentGatilho] = useState<string>('');

  // Find queue index
  const currentIndex = contactsQueue.findIndex((c) => c.id === contact?.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < contactsQueue.length - 1;

  // Contacts from same course in queue
  const currentCourse = contact?.curso || 'Sem Concurso Definido';
  const sameCourseContacts = contactsQueue.filter(
    (c) => (c.curso || 'Sem Concurso Definido') === currentCourse
  );
  const indexInCourse = sameCourseContacts.findIndex((c) => c.id === contact?.id);

  // Initialize template selection when modal opens or contact changes
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      // Default to first template or a pos_prova / audio template
      const defaultTmpl =
        templates.find((t) => t.categoria === 'pos_prova') ||
        templates.find((t) => t.categoria === 'roteiro_audio') ||
        templates[0];
      setSelectedTemplateId(defaultTmpl.id);
    }
  }, [templates, selectedTemplateId]);

  // Update text when template or contact changes
  useEffect(() => {
    if (contact && selectedTemplateId) {
      const tmpl = templates.find((t) => t.id === selectedTemplateId);
      if (tmpl) {
        setCustomText(fillTemplate(tmpl.texto, contact));
      }
    }
  }, [contact, selectedTemplateId, templates]);

  if (!isOpen || !contact) return null;

  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find((t) => t.id === tmplId);
    if (tmpl && contact) {
      setCustomText(fillTemplate(tmpl.texto, contact));
    }
  };

  const handleResetToTemplate = () => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (tmpl && contact) {
      setCustomText(fillTemplate(tmpl.texto, contact));
      onToast('Texto resetado para o modelo padrão.', 'info');
    }
  };

  const handleCreateInlineScript = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScriptTitle.trim() || !newScriptText.trim()) {
      onToast('Título e texto do script são obrigatórios.', 'error');
      return;
    }

    const newId = 't_custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newTmpl: MessageTemplate = {
      id: newId,
      titulo: newScriptTitle.trim(),
      categoria: newScriptCategory,
      texto: newScriptText.trim(),
      gatilho: newScriptGatilho.trim() || undefined,
      tipo: newScriptType,
      duracaoEstimada: newScriptType === 'audio' ? '25 a 35 segundos' : undefined,
      tomDeVoz: newScriptType === 'audio' ? 'Acolhedor e seguro' : undefined,
    };

    if (onAddTemplate) {
      onAddTemplate(newTmpl);
    }

    setSelectedTemplateId(newId);
    if (contact) {
      setCustomText(fillTemplate(newTmpl.texto, contact));
    }

    setShowInlineNewScript(false);
    setNewScriptTitle('');
    setNewScriptGatilho('');
    setNewScriptText('');
    onToast(`Script "${newTmpl.titulo}" salvo e aplicado!`, 'success');
  };

  const handleSaveCurrentAsScript = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveCurrentTitle.trim()) {
      onToast('Digite um título para o script.', 'error');
      return;
    }
    if (!customText.trim()) {
      onToast('O texto do script não pode estar vazio.', 'error');
      return;
    }

    let templateTextToSave = customText;
    if (contact) {
      if (contact.nome) {
        templateTextToSave = templateTextToSave.replaceAll(contact.nome, '{nome}');
        const firstName = contact.nome.split(' ')[0];
        if (firstName && firstName !== contact.nome) {
          templateTextToSave = templateTextToSave.replaceAll(firstName, '{nome}');
        }
      }
      if (contact.curso) {
        templateTextToSave = templateTextToSave.replaceAll(contact.curso, '{curso}');
      }
    }

    const newId = 't_saved_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newTmpl: MessageTemplate = {
      id: newId,
      titulo: saveCurrentTitle.trim(),
      categoria: saveCurrentCategory,
      texto: templateTextToSave.trim(),
      gatilho: saveCurrentGatilho.trim() || undefined,
      tipo: isAudio ? 'audio' : 'texto',
      duracaoEstimada: isAudio ? '25 a 30 segundos' : undefined,
      tomDeVoz: isAudio ? 'Seguro e confiante' : undefined,
    };

    if (onAddTemplate) {
      onAddTemplate(newTmpl);
    }

    setSelectedTemplateId(newId);
    setShowSaveCurrentAsScript(false);
    setSaveCurrentTitle('');
    setSaveCurrentGatilho('');
    onToast(`Script "${newTmpl.titulo}" salvo na biblioteca!`, 'success');
  };

  const insertSnippet = (snippet: string) => {
    setCustomText((prev) => {
      if (!prev) return snippet;
      return prev + (prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' ') + snippet;
    });
    onToast(`Inserido no script: "${snippet.slice(0, 25)}..."`, 'info');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    onToast('Mensagem copiada para a área de transferência!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigate = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < contactsQueue.length && onSelectContact) {
      onSelectContact(contactsQueue[newIndex]);
    }
  };

  const handleSendWhatsAppAndNext = () => {
    if (!contact.whatsapp) {
      onToast('Contato não possui telefone WhatsApp cadastrado.', 'error');
      return;
    }

    // Direct desktop/mobile app trigger
    openWhatsAppDirect(contact.whatsapp, customText);

    if (autoMarkContacted && onMarkContacted) {
      onMarkContacted(contact.id);
    }

    onToast(`WhatsApp aberto para ${contact.nome}!`, 'success');

    // Auto advance to next contact in queue
    if (hasNext && onSelectContact) {
      onSelectContact(contactsQueue[currentIndex + 1]);
    } else {
      onClose();
    }
  };

  const handleSendWhatsAppOnly = () => {
    if (!contact.whatsapp) {
      onToast('Contato não possui telefone WhatsApp cadastrado.', 'error');
      return;
    }

    openWhatsAppDirect(contact.whatsapp, customText);

    if (autoMarkContacted && onMarkContacted) {
      onMarkContacted(contact.id);
    }

    onToast(`WhatsApp aberto para ${contact.nome}!`, 'success');
    onClose();
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'roteiro_audio':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#38BDF8] border border-[#38BDF8]/50 text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">
            <Mic className="w-3 h-3 text-[#38BDF8]" />
            🎙️ Roteiro de Áudio
          </span>
        );
      case 'pos_prova':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#C9A227] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Check className="w-3 h-3 text-[#C9A227]" />
            Pós-Prova
          </span>
        );
      case 'pre_prova':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#5C7A9E] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Clock className="w-3 h-3 text-[#5C7A9E]" />
            Pré-Prova / Rotina
          </span>
        );
      case 'migracao':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#D97C3A] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <ArrowRightLeft className="w-3 h-3 text-[#D97C3A]" />
            Migração p/ Assinatura 1.0
          </span>
        );
      case 'fechamento_pix':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#16A34A] border border-[#16A34A]/40 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3 text-[#16A34A]" />
            Fechamento & PIX
          </span>
        );
      case 'recuperacao_sumidos':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#E11D48] border border-[#E11D48]/40 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <RefreshCw className="w-3 h-3 text-[#E11D48]" />
            Resgate / Sumidos
          </span>
        );
      case 'renovacao':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#6E8F5C] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <RefreshCw className="w-3 h-3 text-[#6E8F5C]" />
            Renovação
          </span>
        );
      case 'boas_vindas':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#38BDF8] border border-[#38BDF8]/40 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3 text-[#38BDF8]" />
            Boas-Vindas & Diagnóstico
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#8C98B4] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            Geral
          </span>
        );
    }
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplateId);
  const isAudio = currentTemplate?.categoria === 'roteiro_audio' || currentTemplate?.tipo === 'audio';

  const visibleTemplates = templates.filter((t) => {
    if (templateFilter === 'audio') return t.categoria === 'roteiro_audio' || t.tipo === 'audio';
    if (templateFilter === 'text') return t.categoria !== 'roteiro_audio' && t.tipo !== 'audio';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Queue / Course Progress Bar */}
        {contactsQueue.length > 1 && (
          <div className="bg-[#101B2D] px-4 py-2 border-b border-[#2B3D63] flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40 font-bold px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {currentCourse}
              </span>
              <span className="text-[#8C98B4] text-[11px]">
                {sameCourseContacts.length > 1 ? (
                  <span>
                    Aluno <b className="text-[#EDE6D6]">{indexInCourse + 1} de {sameCourseContacts.length}</b> deste curso
                  </span>
                ) : (
                  <span>1 aluno neste curso</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={!hasPrevious}
                onClick={() => handleNavigate(currentIndex - 1)}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                  hasPrevious
                    ? 'border-[#2B3D63] text-[#EDE6D6] hover:bg-[#1F3057] cursor-pointer'
                    : 'border-[#2B3D63]/40 text-[#8C98B4]/40 cursor-not-allowed'
                }`}
                title="Aluno anterior"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <span className="text-[11px] font-mono text-[#8C98B4] px-1">
                {currentIndex + 1}/{contactsQueue.length}
              </span>

              <button
                type="button"
                disabled={!hasNext}
                onClick={() => handleNavigate(currentIndex + 1)}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                  hasNext
                    ? 'border-[#2B3D63] text-[#EDE6D6] hover:bg-[#1F3057] cursor-pointer'
                    : 'border-[#2B3D63]/40 text-[#8C98B4]/40 cursor-not-allowed'
                }`}
                title="Próximo aluno"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2B3D63] flex items-start justify-between bg-[#101B2D]/50 gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase font-semibold text-[#C9A227] tracking-wider flex items-center gap-1.5 mb-0.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Fila de Envio por Ordem de Curso
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-serif text-[#EDE6D6] flex items-center gap-2 flex-wrap">
              <span>{contact.nome}</span>
              {contact.curso && (
                <span className="text-xs font-sans font-medium text-[#C9A227] border-l border-[#2B3D63] pl-2">
                  {contact.curso}
                </span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8C98B4] mt-1 font-sans">
              {contact.whatsapp && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#25D366]" />
                  {contact.whatsapp}
                </span>
              )}
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#C9A227]" />
                  <a href={`mailto:${contact.email}`} className="hover:text-[#EDE6D6] underline">
                    {contact.email}
                  </a>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8C98B4] hover:text-[#EDE6D6] p-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Template Selector with Audio / Text Filter and '+ Colocar Script' button */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] flex items-center gap-1.5">
                <span>Escolha o Script da Mensagem:</span>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-[#101B2D] p-0.5 rounded-lg border border-[#2B3D63]">
                  <button
                    type="button"
                    onClick={() => setTemplateFilter('all')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                      templateFilter === 'all'
                        ? 'bg-[#1F3057] text-[#EDE6D6]'
                        : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                    }`}
                  >
                    Todos ({templates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateFilter('audio')}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer transition-all flex items-center gap-1 ${
                      templateFilter === 'audio'
                        ? 'bg-[#38BDF8] text-[#101B2D]'
                        : 'text-[#38BDF8] hover:text-[#EDE6D6]'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    Roteiros de Áudio
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateFilter('text')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                      templateFilter === 'text'
                        ? 'bg-[#1F3057] text-[#EDE6D6]'
                        : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                    }`}
                  >
                    Textos
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInlineNewScript(!showInlineNewScript)}
                  className="flex items-center gap-1 bg-[#C9A227]/20 hover:bg-[#C9A227]/30 text-[#C9A227] border border-[#C9A227]/40 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Colocar Novo Script</span>
                </button>
              </div>
            </div>

            {/* INLINE SCRIPT CREATOR FORM */}
            {showInlineNewScript && (
              <form
                onSubmit={handleCreateInlineScript}
                className="bg-[#101B2D] border-2 border-[#C9A227]/60 rounded-xl p-3.5 mb-3 space-y-3 animate-fadeIn shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-[#2B3D63] pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#C9A227]">
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Cadastrar Novo Script no Sistema</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInlineNewScript(false)}
                    className="text-[#8C98B4] hover:text-[#EDE6D6] text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold text-[#8C98B4] block mb-1">
                      Título do Script:
                    </label>
                    <input
                      type="text"
                      value={newScriptTitle}
                      onChange={(e) => setNewScriptTitle(e.target.value)}
                      placeholder="Ex: Oferta Relâmpago PF com Abatimento"
                      className="w-full bg-[#172644] border border-[#2B3D63] focus:border-[#C9A227] text-xs text-[#EDE6D6] rounded-lg p-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[#8C98B4] block mb-1">
                      Tipo do Script:
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-[#172644] p-1 rounded-lg border border-[#2B3D63]">
                      <button
                        type="button"
                        onClick={() => setNewScriptType('texto')}
                        className={`py-1 text-[11px] font-semibold rounded cursor-pointer ${
                          newScriptType === 'texto' ? 'bg-[#1F3057] text-[#EDE6D6]' : 'text-[#8C98B4]'
                        }`}
                      >
                        Texto
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewScriptType('audio')}
                        className={`py-1 text-[11px] font-bold rounded cursor-pointer flex items-center justify-center gap-1 ${
                          newScriptType === 'audio' ? 'bg-[#38BDF8] text-[#101B2D]' : 'text-[#38BDF8]'
                        }`}
                      >
                        <Mic className="w-3 h-3" />
                        Áudio
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-[#8C98B4] block mb-1">
                      Categoria:
                    </label>
                    <select
                      value={newScriptCategory}
                      onChange={(e) => setNewScriptCategory(e.target.value as MessageTemplateCategory)}
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-lg p-2"
                    >
                      <option value="roteiro_audio">🎙️ Roteiro de Áudio</option>
                      <option value="pos_prova">Pós-Prova</option>
                      <option value="pre_prova">Pré-Prova / Rotina</option>
                      <option value="migracao">Migração Assinatura 1.0</option>
                      <option value="fechamento_pix">Fechamento & PIX</option>
                      <option value="recuperacao_sumidos">Resgate de Sumidos</option>
                      <option value="boas_vindas">Boas-Vindas & Acesso</option>
                      <option value="geral">Geral</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[#8C98B4] block mb-1">
                      Gatilho / Destaque (Opcional):
                    </label>
                    <input
                      type="text"
                      value={newScriptGatilho}
                      onChange={(e) => setNewScriptGatilho(e.target.value)}
                      placeholder="Ex: Abatimento de 100% + Urgência"
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-lg p-2"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-[#8C98B4]">
                      Texto do Script: (Use <code className="text-[#C9A227]">{"{nome}"}</code> e <code className="text-[#C9A227]">{"{curso}"}</code>)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewScriptText((prev) => prev + ' {nome}')}
                        className="text-[10px] bg-[#172644] text-[#C9A227] px-1.5 py-0.5 rounded hover:bg-[#1F3057] cursor-pointer"
                      >
                        +{"{nome}"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewScriptText((prev) => prev + ' {curso}')}
                        className="text-[10px] bg-[#172644] text-[#C9A227] px-1.5 py-0.5 rounded hover:bg-[#1F3057] cursor-pointer"
                      >
                        +{"{curso}"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={newScriptText}
                    onChange={(e) => setNewScriptText(e.target.value)}
                    placeholder="Digite o script com as tags {nome} e {curso}..."
                    className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-lg p-2 font-sans"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInlineNewScript(false)}
                    className="px-3 py-1.5 text-xs text-[#8C98B4] hover:text-[#EDE6D6]"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#B89220] text-[#101B2D] font-bold text-xs px-4 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar e Usar Este Script</span>
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {visibleTemplates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
                const isTmplAudio = tmpl.categoria === 'roteiro_audio' || tmpl.tipo === 'audio';

                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? isTmplAudio
                          ? 'bg-[#142944] border-[#38BDF8] text-[#EDE6D6] shadow-sm ring-1 ring-[#38BDF8]/50'
                          : 'bg-[#1F3057] border-[#C9A227] text-[#EDE6D6] shadow-sm ring-1 ring-[#C9A227]/50'
                        : isTmplAudio
                        ? 'bg-[#101B2D]/90 border-[#38BDF8]/30 text-[#8C98B4] hover:text-[#EDE6D6] hover:border-[#38BDF8]'
                        : 'bg-[#101B2D]/70 border-[#2B3D63] text-[#8C98B4] hover:text-[#EDE6D6] hover:border-[#8C98B4]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="font-semibold text-xs leading-snug text-[#EDE6D6] line-clamp-1">
                        {tmpl.titulo}
                      </div>
                      {isTmplAudio && (
                        <span className="text-[10px] text-[#38BDF8] bg-[#38BDF8]/10 px-1.5 py-0.2 rounded font-bold shrink-0">
                          🎙️ Áudio
                        </span>
                      )}
                    </div>
                    {tmpl.gatilho && (
                      <div className="text-[10px] text-[#C9A227] line-clamp-1 font-medium">
                        ⚡ {tmpl.gatilho}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Teleprompter & Voice Tone Guidance Box */}
          {isAudio && (
            <div className="bg-gradient-to-br from-[#101B2D] to-[#12233C] border border-[#38BDF8]/50 rounded-xl p-3.5 space-y-2.5 text-xs shadow-sm">
              <div className="flex items-center justify-between border-b border-[#2B3D63] pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 font-bold text-[#38BDF8] text-xs uppercase tracking-wide">
                  <Mic className="w-4 h-4 text-[#38BDF8] animate-pulse" />
                  <span>Teleprompter de Gravação no WhatsApp</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#EDE6D6]">
                  {currentTemplate?.duracaoEstimada && (
                    <span className="flex items-center gap-1 bg-[#38BDF8]/20 border border-[#38BDF8]/40 px-2 py-0.5 rounded text-[#38BDF8] font-semibold">
                      <Timer className="w-3 h-3" />
                      {currentTemplate.duracaoEstimada}
                    </span>
                  )}
                  {currentTemplate?.tomDeVoz && (
                    <span className="flex items-center gap-1 text-[#8C98B4]">
                      <Volume2 className="w-3 h-3 text-[#38BDF8]" />
                      {currentTemplate.tomDeVoz}
                    </span>
                  )}
                </div>
              </div>

              {currentTemplate?.dicasGravacao && currentTemplate.dicasGravacao.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[#EDE6D6]/90">
                  {currentTemplate.dicasGravacao.map((dica, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 bg-[#172644]/70 p-1.5 rounded">
                      <span className="text-[#38BDF8] font-bold">•</span>
                      <span>{dica}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Emotion & Logic Strategic Context for Text Scripts */}
          {!isAudio && currentTemplate && (currentTemplate.emocao || currentTemplate.logica || currentTemplate.gatilho) && (
            <div className="bg-[#101B2D] border border-[#C9A227]/30 rounded-xl p-3 space-y-2 text-xs">
              {currentTemplate.gatilho && (
                <div className="text-[11px] font-bold text-[#C9A227] flex items-center gap-1.5 border-b border-[#2B3D63] pb-1.5">
                  <span>⚡ Gatilho do Script:</span>
                  <span className="text-[#EDE6D6] font-normal">{currentTemplate.gatilho}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentTemplate.emocao && (
                  <div className="bg-[#172644]/60 border border-[#B14432]/30 rounded-lg p-2">
                    <span className="text-[10px] font-bold uppercase text-[#B14432] block mb-0.5">
                      ❤️ Conexão Emocional:
                    </span>
                    <p className="text-[11px] text-[#EDE6D6]/90 leading-snug">
                      {currentTemplate.emocao}
                    </p>
                  </div>
                )}
                {currentTemplate.logica && (
                  <div className="bg-[#172644]/60 border border-[#5C7A9E]/40 rounded-lg p-2">
                    <span className="text-[10px] font-bold uppercase text-[#5C7A9E] block mb-0.5">
                      🧠 Fundamento Lógico:
                    </span>
                    <p className="text-[11px] text-[#EDE6D6]/90 leading-snug">
                      {currentTemplate.logica}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editable Text / Teleprompter Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[#C9A227]" />
                {isAudio ? 'Roteiro de Fala Personalizado:' : `Mensagem Personalizada para ${contact.nome}:`}
              </label>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveCurrentAsScript(!showSaveCurrentAsScript)}
                  className="text-[11px] text-[#C9A227] hover:bg-[#C9A227]/10 px-2 py-0.5 rounded border border-[#C9A227]/30 cursor-pointer flex items-center gap-1 transition-colors"
                  title="Salvar esta mensagem editada como um modelo permanente"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  <span>Salvar como Script</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToTemplate}
                  className="text-[11px] text-[#8C98B4] hover:text-[#EDE6D6] hover:underline cursor-pointer flex items-center gap-1"
                  title="Recarregar texto original do modelo"
                >
                  <RefreshCw className="w-3 h-3" />
                  Resetar
                </button>
              </div>
            </div>

            {/* QUICK SAVE CURRENT TEXT AS SCRIPT POPOVER */}
            {showSaveCurrentAsScript && (
              <form
                onSubmit={handleSaveCurrentAsScript}
                className="bg-[#101B2D] border border-[#C9A227] rounded-xl p-3 space-y-2.5 animate-fadeIn shadow-md"
              >
                <div className="flex items-center justify-between border-b border-[#2B3D63] pb-1.5">
                  <span className="text-xs font-bold text-[#C9A227] flex items-center gap-1">
                    <Save className="w-3.5 h-3.5" />
                    Salvar Mensagem Editada na Biblioteca de Scripts
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSaveCurrentAsScript(false)}
                    className="text-[#8C98B4] hover:text-[#EDE6D6] text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={saveCurrentTitle}
                      onChange={(e) => setSaveCurrentTitle(e.target.value)}
                      placeholder="Nome do Novo Script (Ex: Oferta Fechamento Especial)"
                      className="w-full bg-[#172644] border border-[#2B3D63] focus:border-[#C9A227] text-xs text-[#EDE6D6] rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <select
                      value={saveCurrentCategory}
                      onChange={(e) => setSaveCurrentCategory(e.target.value as MessageTemplateCategory)}
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-lg p-2"
                    >
                      <option value="fechamento_pix">Fechamento & PIX</option>
                      <option value="migracao">Migração 1.0</option>
                      <option value="roteiro_audio">Roteiro de Áudio</option>
                      <option value="pos_prova">Pós-Prova</option>
                      <option value="pre_prova">Pré-Prova</option>
                      <option value="recuperacao_sumidos">Resgate Sumidos</option>
                      <option value="boas_vindas">Boas-Vindas</option>
                      <option value="geral">Geral</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-[#8C98B4]">
                    💡 As palavras com nome do aluno serão salvas como tags automáticas {'{nome}'} e {'{curso}'}.
                  </span>
                  <button
                    type="submit"
                    className="bg-[#C9A227] hover:bg-[#B89220] text-[#101B2D] font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Script</span>
                  </button>
                </div>
              </form>
            )}

            {/* Quick Variable & Offer Snippets Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
              <span className="text-[10px] uppercase font-bold text-[#8C98B4] flex items-center gap-1 shrink-0">
                <Tag className="w-3 h-3 text-[#C9A227]" />
                Inserir no Script:
              </span>
              <button
                type="button"
                onClick={() => insertSnippet(contact.nome ? (contact.nome.split(' ')[0] || contact.nome) : '{nome}')}
                className="bg-[#172644] hover:bg-[#1F3057] text-[#C9A227] border border-[#2B3D63] px-2 py-0.5 rounded cursor-pointer shrink-0 font-medium transition-colors"
                title="Inserir primeiro nome do aluno"
              >
                + {contact.nome ? contact.nome.split(' ')[0] : 'Nome'}
              </button>
              <button
                type="button"
                onClick={() => insertSnippet(contact.curso ? contact.curso : '{curso}')}
                className="bg-[#172644] hover:bg-[#1F3057] text-[#C9A227] border border-[#2B3D63] px-2 py-0.5 rounded cursor-pointer shrink-0 font-medium transition-colors"
                title="Inserir concurso de interesse"
              >
                + {contact.curso ? contact.curso.slice(0, 16) : 'Curso'}
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('A gente abate 100% do valor que você já investiu no seu curso isolado!')}
                className="bg-[#172644] hover:bg-[#1F3057] text-[#38BDF8] border border-[#2B3D63] px-2 py-0.5 rounded cursor-pointer shrink-0 transition-colors"
                title="Inserir benefício do abatimento integral"
              >
                + Abatimento 100%
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('Você terá acesso a mais de 180.000 questões comentadas e simulados semanais.')}
                className="bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] border border-[#2B3D63] px-2 py-0.5 rounded cursor-pointer shrink-0 transition-colors"
              >
                + 180k Questões
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('Chave PIX Oficial (CNPJ): 00.000.000/0001-00 (Portal Concursos)')}
                className="bg-[#172644] hover:bg-[#1F3057] text-[#4ADE80] border border-[#2B3D63] px-2 py-0.5 rounded cursor-pointer shrink-0 transition-colors"
              >
                + Chave PIX
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('https://portalconcursos.com.br/assinatura')}
                className="bg-[#172644] hover:bg-[#1F3057] text-[#38BDF8] border border-[#2B3D63] px-2 py-0.5 rounded cursor-pointer shrink-0 transition-colors"
              >
                + Link Assinatura
              </button>
            </div>

            <textarea
              rows={isAudio ? 6 : 7}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Digite ou ajuste a mensagem..."
              className={`w-full rounded-xl p-3 sm:p-3.5 text-xs sm:text-[14px] leading-relaxed resize-y font-sans shadow-inner ${
                isAudio
                  ? 'bg-[#0E1726] border-2 border-[#38BDF8]/40 focus:border-[#38BDF8] text-[#EDE6D6] font-medium tracking-wide'
                  : 'bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6]'
              }`}
            />
            <div className="text-[11px] text-[#8C98B4] mt-1 flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A227] shrink-0" />
                <span>
                  Tags <b>{'{nome}'}</b> e <b>{'{curso}'}</b> são substituídas por <b>{contact.nome}</b> e <b>{contact.curso || 'Portal Concurso'}</b>.
                </span>
              </div>
              <span className="text-[11px] text-[#8C98B4]">
                {customText.length} caracteres • {customText.split(/\s+/).filter(Boolean).length} palavras
              </span>
            </div>
          </div>

          {/* Auto mark option */}
          <label className="flex items-center gap-2.5 text-xs text-[#EDE6D6] cursor-pointer select-none bg-[#101B2D]/40 p-2.5 rounded-lg border border-[#2B3D63]/50">
            <input
              type="checkbox"
              checked={autoMarkContacted}
              onChange={(e) => setAutoMarkContacted(e.target.checked)}
              className="rounded accent-[#C9A227] w-4 h-4 cursor-pointer"
            />
            <span>Marcar automaticamente como <b>"Contatado Hoje"</b> ao enviar pelo WhatsApp</span>
          </label>
        </div>

        {/* Modal Footer with Queue Flow Actions */}
        <div className="p-4 sm:p-5 border-t border-[#2B3D63] bg-[#101B2D]/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                copied
                  ? 'bg-[#6E8F5C]/20 border-[#6E8F5C] text-[#6E8F5C]'
                  : 'border-[#2B3D63] hover:border-[#EDE6D6] text-[#EDE6D6] hover:bg-[#1F3057]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  {isAudio ? 'Copiar Roteiro' : 'Copiar Texto'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-3 py-2 text-xs font-semibold text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#101B2D] rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasNext && (
              <button
                type="button"
                onClick={handleSendWhatsAppOnly}
                className="w-full sm:w-auto px-3 py-2 text-xs font-semibold text-[#EDE6D6] border border-[#2B3D63] hover:bg-[#1F3057] rounded-lg transition-colors cursor-pointer"
                title="Apenas abre o WhatsApp sem avançar na fila"
              >
                {isAudio ? 'Gravar Só Este' : 'Enviar Só Este'}
              </button>
            )}

            <button
              type="button"
              onClick={handleSendWhatsAppAndNext}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap ${
                isAudio
                  ? 'bg-[#38BDF8] hover:bg-[#2bb2ee] text-[#101B2D]'
                  : 'bg-[#25D366] hover:bg-[#20ba5a] text-[#101B2D]'
              }`}
            >
              {isAudio ? <Mic className="w-4 h-4" /> : <Send className="w-4 h-4 fill-current" />}
              {isAudio
                ? hasNext
                  ? 'Abrir WhatsApp p/ Gravar & Próximo'
                  : 'Abrir WhatsApp para Gravar'
                : hasNext
                ? 'Enviar no WhatsApp & Próximo Aluno'
                : 'Enviar no WhatsApp'}
              {hasNext && <FastForward className="w-4 h-4 ml-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

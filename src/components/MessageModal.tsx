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
} from 'lucide-react';
import { Contact, MessageTemplate } from '../types';
import { fillTemplate, waLinkWithMessage, openWhatsAppDirect } from '../utils/excel';

interface MessageModalProps {
  isOpen: boolean;
  contact: Contact | null;
  contactsQueue?: Contact[];
  templates: MessageTemplate[];
  onClose: () => void;
  onSelectContact?: (contact: Contact) => void;
  onMarkContacted?: (id: string) => void;
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
  onToast,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [autoMarkContacted, setAutoMarkContacted] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Find queue index
  const currentIndex = contactsQueue.findIndex((c) => c.id === contact?.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < contactsQueue.length - 1;

  // Calculate stats for current course in queue
  const currentCourse = contact?.curso?.trim() || 'Sem Curso';
  const sameCourseContacts = contactsQueue.filter(
    (c) => (c.curso?.trim() || 'Sem Curso') === currentCourse
  );
  const indexInCourse = sameCourseContacts.findIndex((c) => c.id === contact?.id);

  // When modal opens or contact changes, update template text
  useEffect(() => {
    if (isOpen && contact && templates.length > 0) {
      const activeTmpl =
        templates.find((t) => t.id === selectedTemplateId) || templates[0];
      if (activeTmpl) {
        setSelectedTemplateId(activeTmpl.id);
        setCustomText(fillTemplate(activeTmpl.texto, contact));
      }
    }
  }, [isOpen, contact]);

  if (!isOpen || !contact) return null;

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setCustomText(fillTemplate(tmpl.texto, contact));
    }
  };

  const handleResetToTemplate = () => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (tmpl) {
      setCustomText(fillTemplate(tmpl.texto, contact));
      onToast('Texto redefinido para o padrão do modelo.', 'info');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    onToast('Mensagem copiada para a área de transferência!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigate = (targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < contactsQueue.length && onSelectContact) {
      onSelectContact(contactsQueue[targetIndex]);
    }
  };

  const handleSendWhatsAppAndNext = () => {
    if (!contact.whatsapp) {
      onToast('Este contato não possui número de WhatsApp cadastrado.', 'error');
      return;
    }

    openWhatsAppDirect(contact.whatsapp, customText);

    if (autoMarkContacted && onMarkContacted) {
      onMarkContacted(contact.id);
    }

    onToast(`WhatsApp aberto para ${contact.nome}!`, 'success');

    if (hasNext && onSelectContact) {
      const nextContact = contactsQueue[currentIndex + 1];
      onSelectContact(nextContact);
    } else {
      onToast('Você concluiu toda a fila de envio de contatos!', 'success');
      onClose();
    }
  };

  const handleSendWhatsAppOnly = () => {
    if (!contact.whatsapp) {
      onToast('Este contato não possui número de WhatsApp cadastrado.', 'error');
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
            Pré-Prova / Preparação
          </span>
        );
      case 'migracao':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#D97C3A] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <ArrowRightLeft className="w-3 h-3 text-[#D97C3A]" />
            Migração p/ Assinatura 1.0
          </span>
        );
      case 'renovacao':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#6E8F5C] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <RefreshCw className="w-3 h-3 text-[#6E8F5C]" />
            Renovação
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
          {/* Template Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center justify-between">
              <span>Escolha o Script da Mensagem:</span>
              {currentTemplate && getCategoryBadge(currentTemplate.categoria)}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1F3057] border-[#C9A227] text-[#EDE6D6] shadow-sm'
                        : 'bg-[#101B2D]/70 border-[#2B3D63] text-[#8C98B4] hover:text-[#EDE6D6] hover:border-[#8C98B4]/50'
                    }`}
                  >
                    <div className="font-semibold text-xs leading-snug text-[#EDE6D6]">
                      {tmpl.titulo}
                    </div>
                    {tmpl.gatilho && (
                      <div className="text-[10px] text-[#C9A227] mt-1 line-clamp-1 font-medium">
                        ⚡ {tmpl.gatilho}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Emotion & Logic Strategic Context */}
          {currentTemplate && (currentTemplate.emocao || currentTemplate.logica || currentTemplate.gatilho) && (
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

          {/* Editable Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[#C9A227]" />
                Mensagem Personalizada para {contact.nome}:
              </label>
              <button
                type="button"
                onClick={handleResetToTemplate}
                className="text-[11px] text-[#C9A227] hover:underline cursor-pointer flex items-center gap-1"
                title="Recarregar texto original do modelo"
              >
                <RefreshCw className="w-3 h-3" />
                Resetar para o padrão
              </button>
            </div>

            <textarea
              rows={7}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Digite ou ajuste a mensagem..."
              className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] rounded-xl p-3 text-xs sm:text-[13.5px] leading-relaxed resize-y font-sans shadow-inner"
            />
            <div className="text-[11px] text-[#8C98B4] mt-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A227] shrink-0" />
              <span>
                As tags como <b>{'{nome}'}</b> e <b>{'{curso}'}</b> foram substituídas por <b>{contact.nome}</b> e <b>{contact.curso || 'Portal Concurso'}</b>.
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
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
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
                  Copiar Texto
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
                Enviar Apenas Este
              </button>
            )}

            <button
              type="button"
              onClick={handleSendWhatsAppAndNext}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-[#101B2D] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Send className="w-4 h-4 fill-current" />
              {hasNext ? 'Enviar no WhatsApp & Próximo Aluno' : 'Enviar no WhatsApp'}
              {hasNext && <FastForward className="w-4 h-4 ml-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

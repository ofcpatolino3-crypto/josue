import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Check,
  RotateCcw,
  Calendar,
  Trash2,
  AlertCircle,
  MessageSquare,
  Mail,
  Bot,
  Sparkles,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Contact, Temperature } from '../types';
import { TEMP_COLORS, TEMP_ORDER } from '../data/defaults';
import {
  waLink,
  formatDateBR,
  todayStr,
  isOverdue,
  getContactInactivityStatus,
  isWithoutContactFor3Days,
  openWhatsAppDirect,
} from '../utils/excel';

interface CardProps {
  contact: Contact;
  isNewLead?: boolean;
  onMarkToday: (id: string) => void;
  onUndoContact: (id: string) => void;
  onUpdateField: (id: string, field: keyof Contact, value: string) => void;
  onDeleteContact: (id: string) => void;
  onOpenMessageModal?: (contact: Contact) => void;
  onOpenSalesAssistant?: (contact: Contact) => void;
}

export const ContactCard: React.FC<CardProps> = ({
  contact,
  isNewLead = false,
  onMarkToday,
  onUndoContact,
  onUpdateField,
  onDeleteContact,
  onOpenMessageModal,
  onOpenSalesAssistant,
}) => {
  const [obsValue, setObsValue] = useState(contact.observacao || '');
  const [copiedWA, setCopiedWA] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    setObsValue(contact.observacao || '');
  }, [contact.observacao]);

  const whatsappHref = waLink(contact.whatsapp);
  const overdue = isOverdue(contact.proximoContato);
  const inactivity = getContactInactivityStatus(contact);
  const is3DaysInactive = isWithoutContactFor3Days(contact);

  const handleOpenWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!contact.whatsapp) return;
    onMarkToday(contact.id);
    openWhatsAppDirect(contact.whatsapp);
  };

  const handleCopyPhone = () => {
    if (!contact.whatsapp) return;
    navigator.clipboard.writeText(contact.whatsapp);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2000);
  };

  const handleCopyEmail = () => {
    if (!contact.email) return;
    navigator.clipboard.writeText(contact.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div
      id={`card-${contact.id}`}
      className={`bg-[#172644] border rounded-xl p-4 sm:p-5 transition-all duration-150 shadow-sm relative group ${
        is3DaysInactive
          ? 'border-[#DC2626]/70 shadow-[0_0_14px_rgba(220,38,38,0.18)] ring-1 ring-[#DC2626]/30'
          : overdue
          ? 'border-[#B14432] shadow-[0_0_12px_rgba(177,68,50,0.15)]'
          : isNewLead && !contact.ultimoContato
          ? 'border-emerald-500/70 shadow-[0_0_14px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/30'
          : 'border-[#2B3D63] hover:border-[#2B3D63]'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base sm:text-[17px] text-[#EDE6D6] tracking-tight">
              {contact.nome || 'Sem Nome'}
            </h3>

            {/* New Lead Badge */}
            {isNewLead && !contact.ultimoContato && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-sm animate-pulse"
                title="Novo lead recebido recentemente para primeiro atendimento!"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Novo Lead
              </span>
            )}

            {/* Color Tag Badge */}
            {(() => {
              const temp = contact.temperatura || 'Frio';
              const badges: Record<Temperature, { label: string; cls: string }> = {
                Pagou: { label: '🟢 Pagou', cls: 'bg-[#16A34A]/20 text-[#4ADE80] border-[#16A34A]/40' },
                Potencial: { label: '🔵 Potencial', cls: 'bg-[#2563EB]/20 text-[#60A5FA] border-[#2563EB]/40' },
                Quente: { label: '🔥 Quente', cls: 'bg-[#EA580C]/20 text-[#FB923C] border-[#EA580C]/40' },
                Morno: { label: '🟡 Morno', cls: 'bg-[#C9A227]/20 text-[#FCD34D] border-[#C9A227]/40' },
                Frio: { label: '🔴 Frio', cls: 'bg-[#DC2626]/20 text-[#F87171] border-[#DC2626]/40' },
              };
              const b = badges[temp] || badges.Frio;
              return (
                <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md border ${b.cls}`}>
                  {b.label}
                </span>
              );
            })()}

            {/* WhatsApp Contatado Badge */}
            {contact.ultimoContato && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs"
                title={`Contatado via WhatsApp em ${formatDateBR(contact.ultimoContato)}${contact.messagesSentCount ? ` (${contact.messagesSentCount} disparos)` : ''}`}
              >
                <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                <span>Contatado ({contact.ultimoContato === todayStr() ? 'Hoje' : formatDateBR(contact.ultimoContato)})</span>
              </span>
            )}

            {/* Email Contacted Badge */}
            {contact.lastEmailSentAt && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm"
                title={`E-mail enviado em ${new Date(contact.lastEmailSentAt).toLocaleDateString('pt-BR')} às ${new Date(contact.lastEmailSentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${contact.emailSentCount && contact.emailSentCount > 1 ? ` (${contact.emailSentCount} disparos)` : ''}${contact.lastEmailSubject ? `\nAssunto: ${contact.lastEmailSubject}` : ''}`}
              >
                <Mail className="w-3 h-3 text-blue-400" />
                <span>E-mail Enviado ({new Date(contact.lastEmailSentAt).toLocaleDateString('pt-BR')})</span>
              </span>
            )}

            {/* Inactivity Status Badge */}
            {contact.temperatura !== 'Pagou' && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${inactivity.badgeClass}`}
                title={`Tempo desde a última resposta/contato: ${inactivity.days} dias`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                {inactivity.label}
              </span>
            )}

            {overdue && (
              <span className="inline-flex items-center gap-1 bg-[#B14432] text-[#EDE6D6] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                <AlertCircle className="w-3 h-3" />
                Atrasado
              </span>
            )}
          </div>

          {contact.curso && (
            <div className="text-xs sm:text-[13px] font-medium text-[#C9A227] mt-0.5 truncate">
              {contact.curso}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#8C98B4]">
            {contact.whatsapp && (
              <div className="flex items-center gap-1.5">
                <span
                  onClick={handleOpenWhatsApp}
                  className="cursor-pointer hover:text-[#EDE6D6] border-b border-dotted border-[#8C98B4] transition-colors"
                  title="Abrir no Aplicativo WhatsApp"
                >
                  {contact.whatsapp}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="text-[11px] text-[#8C98B4] hover:text-[#C9A227] cursor-pointer"
                  title="Copiar número"
                >
                  {copiedWA ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}

            {contact.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#C9A227]/80 shrink-0" />
                <a
                  href={`mailto:${contact.email}`}
                  className="hover:text-[#EDE6D6] border-b border-dotted border-[#8C98B4] transition-colors truncate max-w-[200px] sm:max-w-none"
                  title="Enviar e-mail"
                >
                  {contact.email}
                </a>
                {contact.lastEmailSentAt && (
                  <span
                    className="text-[10px] text-blue-400 font-semibold bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-800/40 shrink-0"
                    title={`Contatado por e-mail em ${new Date(contact.lastEmailSentAt).toLocaleDateString('pt-BR')}`}
                  >
                    ✓ E-mail enviado
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="text-[11px] text-[#8C98B4] hover:text-[#C9A227] cursor-pointer shrink-0"
                  title="Copiar e-mail"
                >
                  {copiedEmail ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
          {/* Sales Assistant Trigger */}
          {onOpenSalesAssistant && (
            <button
              type="button"
              onClick={() => onOpenSalesAssistant(contact)}
              className="flex items-center gap-1.5 bg-[#C9A227]/15 hover:bg-[#C9A227]/25 text-[#C9A227] hover:text-[#EDE6D6] border border-[#C9A227]/50 hover:border-[#C9A227] rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              title="Abrir Assistente de Vendas IA com sugestão de objeções e planos recomendados"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Assistente de Vendas</span>
            </button>
          )}

          {/* Quick message modal trigger */}
          {onOpenMessageModal && (
            <button
              type="button"
              onClick={() => onOpenMessageModal(contact)}
              className="flex items-center gap-1.5 bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] hover:border-[#C9A227] rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Abrir mensagem pronta personalizável para este contato"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Mensagem Pronta</span>
            </button>
          )}

          {whatsappHref && (
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex items-center gap-1.5 bg-[#101B2D] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#25D366] border border-[#2B3D63] hover:border-[#25D366]/60 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              title="Abrir conversa no WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              <span className="hidden sm:inline">WhatsApp Direto</span>
            </button>
          )}

          {!contact.ultimoContato ? (
            <button
              type="button"
              onClick={() => onMarkToday(contact.id)}
              className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold rounded-lg px-3.5 py-1.5 text-xs shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              Marcar contato hoje
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 rounded-lg px-3 py-1 text-xs font-bold shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-400" />
                <span>Contatado {contact.ultimoContato === todayStr() ? 'Hoje' : formatDateBR(contact.ultimoContato)}</span>
              </div>
              <button
                type="button"
                onClick={() => onUndoContact(contact.id)}
                className="text-xs text-[#8C98B4] hover:text-[#EDE6D6] flex items-center gap-1 px-2 py-1 rounded hover:bg-[#101B2D] transition-colors cursor-pointer"
                title="Desfazer marcação de contato"
              >
                <RotateCcw className="w-3 h-3" />
                Desfazer
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Deseja excluir o contato "${contact.nome}"?`)) {
                onDeleteContact(contact.id);
              }
            }}
            className="text-[#8C98B4] hover:text-[#B14432] p-1.5 rounded hover:bg-[#101B2D] transition-colors cursor-pointer opacity-70 hover:opacity-100"
            title="Excluir contato"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Meta Grid Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-[#101B2D]/60 p-3 rounded-lg border border-[#2B3D63]/60 mb-3">
        {/* Temperatura */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C98B4] mb-1">
            Temperatura
          </label>
          <div className="relative">
            <select
              value={contact.temperatura}
              onChange={(e) => onUpdateField(contact.id, 'temperatura', e.target.value as Temperature)}
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-md px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-[#C9A227] cursor-pointer"
            >
              {TEMP_ORDER.map((t) => (
                <option key={t} value={t} className="bg-[#101B2D] text-[#EDE6D6]">
                  {t === 'Pagou' ? '💰 Pagou (venda)' : t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data do contato */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C98B4] mb-1">
            Data do Contato
          </label>
          <div className="text-xs text-[#EDE6D6] py-1.5 font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#8C98B4]" />
            {formatDateBR(contact.dataContato) || '—'}
          </div>
        </div>

        {/* Último contato */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C98B4] mb-1">
            Último Contato
          </label>
          <div className="text-xs text-[#EDE6D6] py-1.5 font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#8C98B4]" />
            {formatDateBR(contact.ultimoContato) || '—'}
          </div>
        </div>

        {/* Próximo contato */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C98B4] mb-1">
            Próximo Contato
          </label>
          <input
            type="date"
            value={contact.proximoContato || ''}
            onChange={(e) => onUpdateField(contact.id, 'proximoContato', e.target.value)}
            className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-md px-2 py-1 text-xs focus:outline-none focus:border-[#C9A227] cursor-pointer"
          />
        </div>
      </div>

      {/* Observações Field */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C98B4] mb-1 flex items-center justify-between">
          <span>Observação</span>
          {contact.status && (
            <span className="text-[11px] text-[#C9A227] lowercase font-normal">
              status: {contact.status}
            </span>
          )}
        </label>
        <textarea
          value={obsValue}
          onChange={(e) => setObsValue(e.target.value)}
          onBlur={() => onUpdateField(contact.id, 'observacao', obsValue)}
          placeholder="Adicionar notas sobre o contato, dúvidas levantadas, propostas enviadas..."
          rows={2}
          className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/50 rounded-lg px-3 py-2 text-xs sm:text-[13px] focus:outline-none focus:border-[#C9A227] transition-colors resize-y min-h-[44px]"
        />
      </div>
    </div>
  );
};

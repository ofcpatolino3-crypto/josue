import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Users,
  ShieldAlert,
  Sparkles,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Bot,
  Shield,
  Zap,
  MessageCircle,
  Monitor,
  Globe,
  ExternalLink,
  Clipboard,
} from 'lucide-react';
import { ViewTab, UserProfile } from '../types';
import { getWhatsAppTargetMode, setWhatsAppTargetMode, WhatsAppTargetMode } from '../utils/excel';
import { PortalLogo } from './BrandLogo';

interface HeaderProps {
  activeView: ViewTab;
  onSelectView: (view: ViewTab) => void;
  onOpenDailyExport: () => void;
  onOpenAIAssistant: () => void;
  onOpenQuickPaste?: () => void;
  contactsCount: number;
  currentProfile: UserProfile | null;
  pendingApprovalsCount?: number;
  inactiveAlertsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onSelectView,
  onOpenDailyExport,
  onOpenAIAssistant,
  onOpenQuickPaste,
  contactsCount,
  currentProfile,
  pendingApprovalsCount = 0,
  inactiveAlertsCount = 0,
}) => {
  const isSupervisorOrAdmin = currentProfile?.role === 'admin' || currentProfile?.role === 'supervisor';
  const [waMode, setWaMode] = useState<WhatsAppTargetMode>(() => getWhatsAppTargetMode());

  const handleSwitchWaMode = (mode: WhatsAppTargetMode) => {
    setWaMode(mode);
    setWhatsAppTargetMode(mode);
  };

  return (
    <header className="mb-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#25334A] pb-4">
        <div className="flex items-center gap-3.5">
          <div className="p-1 bg-[#111827] border border-[#25334A] rounded-xl shadow-md shrink-0 flex items-center justify-center">
            <PortalLogo size={44} />
          </div>
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[#D4AF37] mb-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Portal Concursos e OAB · Vendas & Atendimento</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-sans text-[#F8FAFC] tracking-tight">
              Painel Operacional
            </h1>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Gestão de contatos, disparos no WhatsApp, controle de equipe e fechamento de matrículas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          {/* WhatsApp Mode Selector */}
          <div
            className="flex items-center bg-[#0A0E17] border border-[#25334A] rounded-lg p-1 text-xs gap-1"
            title="Escolha como o WhatsApp será aberto ao clicar em um contato"
          >
            <div className="flex items-center gap-1 px-1.5 text-[#94A3B8] font-medium text-[11px]">
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              <span className="hidden xl:inline">Zap:</span>
            </div>
            
            <button
              type="button"
              onClick={() => handleSwitchWaMode('desktop_app')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                waMode === 'desktop_app'
                  ? 'bg-[#25D366] text-[#0A0E17] shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
              title="Abre direto no Aplicativo WhatsApp do Computador / Celular (ZERO abas no navegador!)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>App WhatsApp (0 Abas)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchWaMode('same_tab')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                waMode === 'same_tab'
                  ? 'bg-[#25D366] text-[#0A0E17] shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
              title="Abre e atualiza na MESMA aba do WhatsApp Web"
            >
              <Globe className="w-3 h-3" />
              <span>Web (1 Aba)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchWaMode('new_tab')}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] transition-all cursor-pointer ${
                waMode === 'new_tab'
                  ? 'bg-[#25334A] text-white'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
              title="Abre em nova aba a cada contato"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {onOpenQuickPaste && (
            <button
              id="quick-paste-header-btn"
              onClick={onOpenQuickPaste}
              className="flex items-center gap-2 bg-[#111827] hover:bg-[#1E293B] text-[#F8FAFC] hover:text-[#4ADE80] border border-[#22C55E]/40 font-bold rounded-lg px-3 py-2 text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Colar contatos diretamente do WhatsApp, Excel ou Bloco de Notas (Ctrl+V)"
            >
              <Clipboard className="w-4 h-4 text-[#4ADE80]" />
              <span>Colar Contatos</span>
            </button>
          )}

          <button
            id="ai-assistant-btn"
            onClick={onOpenAIAssistant}
            className="flex items-center gap-2 bg-[#111827] hover:bg-[#1E293B] text-[#D4AF37] hover:text-[#F8FAFC] border border-[#D4AF37]/40 font-bold rounded-lg px-3 py-2 text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Abrir Assistente Inteligente com IA (Google Gemini)"
          >
            <Bot className="w-4 h-4 text-[#D4AF37]" />
            <span>Assistente IA</span>
            <span className="bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] px-1.5 py-0.2 rounded font-sans uppercase">
              Gemini
            </span>
          </button>

          <button
            id="export-btn"
            onClick={onOpenDailyExport}
            disabled={contactsCount === 0}
            className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#E5C04A] text-[#0A0E17] font-bold rounded-lg px-3.5 py-2 text-xs transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Abrir painel de fechamento do dia e exportar lista atualizada com status"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Fechamento & Exportar</span>
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1.5 sm:gap-2 border-b border-[#25334A] mt-3 pb-1 overflow-x-auto">
        <button
          id="nav-btn-contatos"
          onClick={() => onSelectView('contatos')}
          className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
            activeView === 'contatos'
              ? 'bg-[#D4AF37] text-[#0A0E17] shadow-sm font-bold'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111827]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Meus Contatos</span>
          <span
            className={`text-[11px] px-1.5 py-0.2 rounded-full ${
              activeView === 'contatos'
                ? 'bg-[#0A0E17]/20 text-[#0A0E17]'
                : 'bg-[#111827] text-[#94A3B8]'
            }`}
          >
            {contactsCount}
          </span>
        </button>

        {currentProfile?.role === 'admin' && (
          <button
            id="nav-btn-disparos"
            onClick={() => onSelectView('disparos')}
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
              activeView === 'disparos'
                ? 'bg-[#16A34A] text-white shadow-sm font-bold'
                : 'text-[#94A3B8] hover:text-[#4ADE80] hover:bg-[#111827]'
            }`}
            title="Disparador rápido WhatsApp & E-mail exclusivo do Administrador"
          >
            <Zap className="w-4 h-4 text-[#4ADE80]" />
            <span>Disparador Rápido</span>
            <span className="text-[10px] uppercase font-black px-1.5 py-0.2 rounded bg-black/20 text-white border border-white/20">
              Admin
            </span>
          </button>
        )}

        <button
          id="nav-btn-mensagens"
          onClick={() => onSelectView('mensagens')}
          className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
            activeView === 'mensagens'
              ? 'bg-[#1E293B] text-[#F8FAFC] border border-[#D4AF37]/50 shadow-sm font-bold'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111827]'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          <span>Mensagens Prontas</span>
        </button>

        <button
          id="nav-btn-objecoes"
          onClick={() => onSelectView('objecoes')}
          className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
            activeView === 'objecoes'
              ? 'bg-[#1E293B] text-[#F8FAFC] border border-[#D4AF37]/50 shadow-sm font-bold'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111827]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
          <span>Objeções</span>
        </button>

        <button
          id="nav-btn-planos"
          onClick={() => onSelectView('planos')}
          className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
            activeView === 'planos'
              ? 'bg-[#1E293B] text-[#F8FAFC] border border-[#D4AF37]/50 shadow-sm font-bold'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111827]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#D4AF37]" />
          <span>Planos & Valores</span>
        </button>

        <button
          id="nav-btn-dashboard"
          onClick={() => onSelectView('dashboard')}
          className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
            activeView === 'dashboard'
              ? 'bg-[#1E293B] text-[#F8FAFC] border border-[#D4AF37]/50 shadow-sm font-bold'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111827]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
          <span>Métricas</span>
        </button>

        {isSupervisorOrAdmin && (
          <button
            id="nav-btn-admin"
            onClick={() => onSelectView('admin')}
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-all whitespace-nowrap ml-auto ${
              activeView === 'admin'
                ? 'bg-[#D4AF37] text-[#0A0E17] shadow-sm font-extrabold'
                : 'text-[#D4AF37] bg-[#111827] hover:bg-[#1E293B] border border-[#D4AF37]/50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Lucas Henrique</span>
            {inactiveAlertsCount > 0 && (
              <span
                className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-[#DC2626] text-white animate-pulse shadow-sm"
                title={`${inactiveAlertsCount} lead(s) estão há 3 ou mais dias sem resposta pelo vendedor`}
              >
                🚨 {inactiveAlertsCount} parados
              </span>
            )}
            {pendingApprovalsCount > 0 && (
              <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-amber-500 text-black">
                {pendingApprovalsCount} pendentes
              </span>
            )}
          </button>
        )}
      </nav>
    </header>
  );
};


import React from 'react';
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
} from 'lucide-react';
import { ViewTab, UserProfile } from '../types';

interface HeaderProps {
  activeView: ViewTab;
  onSelectView: (view: ViewTab) => void;
  onOpenDailyExport: () => void;
  onOpenAIAssistant: () => void;
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
  contactsCount,
  currentProfile,
  pendingApprovalsCount = 0,
  inactiveAlertsCount = 0,
}) => {
  const isAdmin = currentProfile?.role === 'admin';

  return (
    <header className="mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2B3D63] pb-5">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#C9A227] mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Portal Concurso · Gestão de Migração
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#EDE6D6] tracking-tight">
            Painel de Contatos & Distribuição
          </h1>
          <p className="text-xs sm:text-sm text-[#8C98B4] mt-1">
            Acompanhamento de alunos, status no WhatsApp, controle de equipe e distribuição de planilhas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center flex-wrap">
          <button
            id="ai-assistant-btn"
            onClick={onOpenAIAssistant}
            className="flex items-center gap-2 bg-[#172644] hover:bg-[#1F3057] text-[#C9A227] hover:text-[#EDE6D6] border border-[#C9A227]/50 font-bold rounded-lg px-3.5 py-2.5 text-xs sm:text-sm transition-all duration-150 shadow-md active:scale-95 cursor-pointer"
            title="Abrir Assistente Inteligente com IA (Google Gemini)"
          >
            <Bot className="w-4 h-4 text-[#C9A227]" />
            <span>Assistente IA</span>
            <span className="bg-[#C9A227]/20 text-[#C9A227] text-[10px] px-1.5 py-0.5 rounded font-sans uppercase">
              Gemini
            </span>
          </button>

          <button
            id="export-btn"
            onClick={onOpenDailyExport}
            disabled={contactsCount === 0}
            className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold rounded-lg px-4 py-2.5 text-xs sm:text-sm transition-all duration-150 shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Abrir painel de fechamento do dia e exportar lista atualizada com status"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Fechamento do Dia & Exportar
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-2 sm:gap-6 border-b border-[#2B3D63] mt-4 pt-1 overflow-x-auto">
        <button
          id="nav-btn-contatos"
          onClick={() => onSelectView('contatos')}
          className={`flex items-center gap-2 py-2.5 px-2 border-b-2 font-serif text-sm sm:text-base font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeView === 'contatos'
              ? 'text-[#EDE6D6] border-[#C9A227]'
              : 'text-[#8C98B4] border-transparent hover:text-[#EDE6D6]'
          }`}
        >
          <Users className="w-4 h-4 text-[#C9A227]" />
          Meus Contatos
          <span className="text-xs font-sans font-normal px-2 py-0.5 rounded-full bg-[#172644] text-[#8C98B4]">
            {contactsCount}
          </span>
        </button>

        <button
          id="nav-btn-dashboard"
          onClick={() => onSelectView('dashboard')}
          className={`flex items-center gap-2 py-2.5 px-2 border-b-2 font-serif text-sm sm:text-base font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeView === 'dashboard'
              ? 'text-[#EDE6D6] border-[#C9A227]'
              : 'text-[#8C98B4] border-transparent hover:text-[#EDE6D6]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-[#C9A227]" />
          Dashboard & Métricas
        </button>

        <button
          id="nav-btn-mensagens"
          onClick={() => onSelectView('mensagens')}
          className={`flex items-center gap-2 py-2.5 px-2 border-b-2 font-serif text-sm sm:text-base font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeView === 'mensagens'
              ? 'text-[#EDE6D6] border-[#C9A227]'
              : 'text-[#8C98B4] border-transparent hover:text-[#EDE6D6]'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-[#C9A227]" />
          Mensagens Prontas
        </button>

        <button
          id="nav-btn-objecoes"
          onClick={() => onSelectView('objecoes')}
          className={`flex items-center gap-2 py-2.5 px-2 border-b-2 font-serif text-sm sm:text-base font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeView === 'objecoes'
              ? 'text-[#EDE6D6] border-[#C9A227]'
              : 'text-[#8C98B4] border-transparent hover:text-[#EDE6D6]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-[#C9A227]" />
          Objeções
        </button>

        <button
          id="nav-btn-planos"
          onClick={() => onSelectView('planos')}
          className={`flex items-center gap-2 py-2.5 px-2 border-b-2 font-serif text-sm sm:text-base font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeView === 'planos'
              ? 'text-[#EDE6D6] border-[#C9A227]'
              : 'text-[#8C98B4] border-transparent hover:text-[#EDE6D6]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#C9A227]" />
          Planos
        </button>

        {isAdmin && (
          <button
            id="nav-btn-admin"
            onClick={() => onSelectView('admin')}
            className={`flex items-center gap-2 py-2.5 px-2 border-b-2 font-serif text-sm sm:text-base font-bold cursor-pointer transition-colors whitespace-nowrap ${
              activeView === 'admin'
                ? 'text-[#C9A227] border-[#C9A227]'
                : 'text-[#C9A227]/70 border-transparent hover:text-[#C9A227]'
            }`}
          >
            <Shield className="w-4 h-4 text-[#C9A227]" />
            Painel Admin
            {inactiveAlertsCount > 0 && (
              <span
                className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-[#DC2626] text-white animate-pulse shadow-sm"
                title={`${inactiveAlertsCount} lead(s) estão há 3 ou mais dias sem resposta pelo vendedor`}
              >
                🚨 {inactiveAlertsCount} parado(s) +3d
              </span>
            )}
            {pendingApprovalsCount > 0 && (
              <span className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-[#B14432] text-white">
                {pendingApprovalsCount} pendente(s)
              </span>
            )}
            {inactiveAlertsCount === 0 && pendingApprovalsCount === 0 && (
              <span className="text-[10px] font-sans uppercase font-bold px-1.5 py-0.5 rounded bg-[#C9A227]/20 text-[#C9A227]">
                Gestão
              </span>
            )}
          </button>
        )}
      </nav>
    </header>
  );
};

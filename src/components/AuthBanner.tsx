import React from 'react';
import { User, LogIn, LogOut, CloudCheck, CloudOff, RefreshCw, Shield, Clock, AlertOctagon, Key, UserCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { PortalLogo } from './BrandLogo';

interface AuthBannerProps {
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  syncing: boolean;
  onOpenLogin: () => void;
  onSignOut: () => void;
  contactsCount: number;
}

export const AuthBanner: React.FC<AuthBannerProps> = ({
  user,
  profile,
  loading,
  syncing,
  onOpenLogin,
  onSignOut,
  contactsCount,
}) => {
  if (loading) {
    return (
      <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-3 mb-4 flex items-center justify-between text-xs text-[#8C98B4] animate-pulse">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#C9A227] animate-spin" />
          <span>Verificando sessão e permissões de acesso...</span>
        </div>
      </div>
    );
  }

  if (profile) {
    const isPending = profile.status === 'pending';
    const isBlocked = profile.status === 'blocked';
    const isAdmin = profile.role === 'admin';

    if (isBlocked) {
      return (
        <div className="bg-[#B14432]/15 border border-[#B14432] rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#B14432]/20 border border-[#B14432] flex items-center justify-center text-[#B14432] shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#EDE6D6]">Acesso Bloqueado ({profile.displayName || profile.email})</h4>
              <p className="text-xs text-[#8C98B4]">
                Sua conta foi temporariamente desativada pelo administrador. Entre em contato com a gerência.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-[#8C98B4] hover:text-white bg-[#101B2D] border border-[#2B3D63] px-3 py-1.5 rounded-lg transition-colors cursor-pointer self-end sm:self-auto"
          >
            Trocar de Conta / Sair
          </button>
        </div>
      );
    }

    if (isPending) {
      return (
        <div className="bg-[#C9A227]/15 border border-[#C9A227] rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#C9A227]/20 border border-[#C9A227] flex items-center justify-center text-[#C9A227] shrink-0 animate-pulse">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#EDE6D6]">
                  Atendente: {profile.displayName || profile.email}
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40 uppercase">
                  Aguardando Liberação do Admin
                </span>
              </div>
              <p className="text-xs text-[#8C98B4] mt-0.5">
                Sua conta foi criada com sucesso e está na fila para o Administrador aprovar seu acesso e distribuir seus contatos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs text-[#8C98B4] hover:text-white bg-[#101B2D] border border-[#2B3D63] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      );
    }

    // Approved User / Admin
    return (
      <div className="bg-[#172644] border border-[#6E8F5C]/40 rounded-xl px-4 py-2.5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-full ${isAdmin ? 'bg-[#C9A227]/20 border-[#C9A227]' : 'bg-[#6E8F5C]/20 border-[#6E8F5C]'} border flex items-center justify-center ${isAdmin ? 'text-[#C9A227]' : 'text-[#6E8F5C]'}`}>
              {isAdmin ? <Shield className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                syncing ? 'bg-[#C9A227] animate-ping' : 'bg-[#6E8F5C]'
              } border-2 border-[#172644]`}
              title={syncing ? 'Sincronizando dados...' : 'Nuvem Conectada'}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-[#EDE6D6] truncate">
                {profile.displayName || profile.email}
              </span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40">
                  <Shield className="w-3 h-3" />
                  Administrador Master
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6E8F5C]/20 text-[#6E8F5C] border border-[#6E8F5C]/30">
                  <CloudCheck className="w-3 h-3" />
                  Atendente Ativo
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8C98B4] truncate">
              {isAdmin
                ? 'Acesso irrestrito ao Painel Administrativo, Equipe e Distribuição de Leads'
                : `${contactsCount} leads na sua carteira de atendimento • Sistema pronto para produção`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-1.5 text-xs text-[#8C98B4] hover:text-[#B14432] bg-[#101B2D] hover:bg-[#101B2D]/80 border border-[#2B3D63] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Sair da conta"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </div>
    );
  }

  // Not logged in banner with Simple Login button
  return (
    <div className="bg-[#172644] border border-[#C9A227]/40 rounded-xl p-3.5 sm:p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md bg-gradient-to-r from-[#172644] to-[#1a2c4e]">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-1 bg-[#101B2D] border border-[#2B3D63] rounded-lg shrink-0 mt-0.5 sm:mt-0 shadow-sm flex items-center justify-center">
          <PortalLogo size={32} />
        </div>
        <div>
          <div className="text-xs sm:text-sm font-semibold text-[#EDE6D6] flex items-center gap-2">
            Portal Concursos e OAB • Acesso da Equipe
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/30 uppercase">
              Oficial
            </span>
          </div>
          <p className="text-xs text-[#8C98B4] mt-0.5">
            Faça login com seu usuário/senha ou crie seu cadastro de atendente para receber sua cota de leads.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          id="btn-simple-login"
          onClick={onOpenLogin}
          className="flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
        >
          <LogIn className="w-4 h-4" />
          Entrar / Cadastrar
        </button>
      </div>
    </div>
  );
};

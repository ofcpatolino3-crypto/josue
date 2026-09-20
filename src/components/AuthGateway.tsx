import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { PortalLogo } from './BrandLogo';

interface AuthGatewayProps {
  onLogin: (userOrEmail: string, pass: string) => Promise<boolean | string>;
  onRegister: (name: string, emailOrUser: string, pass: string) => Promise<boolean | string>;
  loading: boolean;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({
  onLogin,
  onRegister,
  loading,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!emailOrUser.trim() || !password) {
      setErrorMsg('Preencha seu usuário/e-mail e senha de acesso.');
      return;
    }

    try {
      const res = await onLogin(emailOrUser.trim(), password);
      if (res === true) {
        setSuccessMsg('Login realizado com sucesso! Carregando sua carteira...');
      } else if (typeof res === 'string') {
        setErrorMsg(res);
      } else {
        setErrorMsg('Usuário ou senha incorretos.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!name.trim() || !emailOrUser.trim() || !password) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      return;
    }
    if (password.length < 4) {
      setErrorMsg('A senha deve conter no mínimo 4 caracteres.');
      return;
    }

    try {
      const res = await onRegister(name.trim(), emailOrUser.trim(), password);
      if (res === true) {
        setSuccessMsg('Conta de atendente criada com sucesso! Acessando sua área...');
      } else if (typeof res === 'string') {
        setErrorMsg(res);
      } else {
        setErrorMsg('Erro ao cadastrar novo atendente.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar.');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-6 px-4">
      <div className="w-full max-w-md bg-[#111827] border border-[#25334A] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
        {/* Top Branding Header */}
        <div className="bg-[#0A0E17] p-6 border-b border-[#25334A] text-center relative">
          <div className="flex justify-center mb-3">
            <div className="p-2 bg-[#111827] border border-[#25334A] rounded-2xl shadow-lg flex items-center justify-center">
              <PortalLogo size={52} />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            Portal Concursos e OAB
          </div>
          <h2 className="text-xl font-black text-[#F8FAFC] tracking-tight">
            Acesso ao Sistema de Atendimento
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            Gestão de leads, disparos no WhatsApp e acompanhamento individual.
          </p>
        </div>

        {/* Security / Privacy Assurance Notice */}
        <div className="bg-[#0A0E17]/80 border-b border-[#25334A] px-4 py-2.5 flex items-center gap-2.5 text-xs text-[#94A3B8]">
          <ShieldCheck className="w-4 h-4 text-[#6E8F5C] shrink-0" />
          <span>
            <strong className="text-[#F8FAFC]">Privacidade Total:</strong> Cada atendente acessa exclusivamente sua própria carteira de contatos atribuída.
          </span>
        </div>

        {/* Tabs: Entrar vs Cadastrar */}
        <div className="grid grid-cols-2 bg-[#0A0E17]/60 p-1.5 border-b border-[#25334A] text-xs font-semibold">
          <button
            type="button"
            id="tab-login"
            onClick={() => {
              setTab('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
              tab === 'login'
                ? 'bg-[#D4AF37] text-[#0A0E17] font-bold shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Entrar com Minha Conta</span>
          </button>

          <button
            type="button"
            id="tab-register"
            onClick={() => {
              setTab('register');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
              tab === 'register'
                ? 'bg-[#D4AF37] text-[#0A0E17] font-bold shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Atendente</span>
          </button>
        </div>

        {/* Form Container */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 bg-[#B14432]/20 border border-[#B14432] text-[#F8FAFC] p-3 rounded-xl flex items-center gap-2.5 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-[#B14432] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-[#6E8F5C]/20 border border-[#6E8F5C] text-[#F8FAFC] p-3 rounded-xl flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-[#6E8F5C] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                  Usuário ou E-mail
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                  <input
                    type="text"
                    id="input-login-username"
                    required
                    value={emailOrUser}
                    onChange={(e) => setEmailOrUser(e.target.value)}
                    placeholder="Seu usuário ou e-mail cadastrado"
                    className="w-full bg-[#0A0E17] border border-[#25334A] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#D4AF37] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="input-login-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full bg-[#0A0E17] border border-[#25334A] rounded-lg pl-9 pr-10 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#D4AF37] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-login"
                disabled={loading}
                className="w-full bg-[#D4AF37] hover:bg-[#E5C04A] text-[#0A0E17] font-black py-3 rounded-lg text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Validando acesso...' : 'Entrar no Sistema'}
              </button>

              <div className="pt-2 text-center text-xs text-[#94A3B8]">
                Ainda não tem conta de atendente?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMsg('');
                  }}
                  className="text-[#D4AF37] hover:underline font-bold"
                >
                  Cadastre-se aqui
                </button>
              </div>

              {/* Master Admin hint */}
              <div className="mt-4 pt-3 border-t border-[#25334A]/60 flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-[#D4AF37]" />
                  Acesso Master Administrador
                </span>
                <span className="text-[#94A3B8]/80 font-mono text-[10px]">
                  admin / admin123
                </span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                  <input
                    type="text"
                    id="input-register-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-[#0A0E17] border border-[#25334A] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#D4AF37] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                  Usuário ou E-mail
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                  <input
                    type="text"
                    id="input-register-user"
                    required
                    value={emailOrUser}
                    onChange={(e) => setEmailOrUser(e.target.value)}
                    placeholder="Ex: joao ou joao@portal.com"
                    className="w-full bg-[#0A0E17] border border-[#25334A] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#D4AF37] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="input-register-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full bg-[#0A0E17] border border-[#25334A] rounded-lg pl-9 pr-10 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#D4AF37] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-[#0A0E17] border border-[#25334A] p-3 rounded-lg text-xs text-[#94A3B8] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#F8FAFC]">
                  <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Como funciona a carteira de contatos?
                </div>
                <p className="text-[11px] leading-relaxed">
                  Sua conta começa limpa e privada. Você só verá os contatos que o Administrador distribuir especificamente para você ou que você mesmo cadastrar.
                </p>
              </div>

              <button
                type="submit"
                id="btn-submit-register"
                disabled={loading}
                className="w-full bg-[#D4AF37] hover:bg-[#E5C04A] text-[#0A0E17] font-black py-3 rounded-lg text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Cadastrando...' : 'Criar Conta de Atendente'}
              </button>

              <div className="pt-2 text-center text-xs text-[#94A3B8]">
                Já possui conta cadastrada?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg('');
                  }}
                  className="text-[#D4AF37] hover:underline font-bold"
                >
                  Entrar com usuário
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

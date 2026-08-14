import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  Shield,
  Key,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (userOrEmail: string, pass: string) => Promise<boolean | string>;
  onRegister: (name: string, emailOrUser: string, pass: string) => Promise<boolean | string>;
  onAdminQuickLogin?: (adminPassword: string) => Promise<boolean | string>;
  onAdminLogin?: (adminPassword: string) => Promise<boolean | string>;
  initialTab?: 'login' | 'register' | 'admin';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onRegister,
  onAdminQuickLogin,
  onAdminLogin,
  initialTab = 'login',
}) => {
  const adminLoginFn = onAdminQuickLogin || onAdminLogin;
  const [tab, setTab] = useState<'login' | 'register' | 'admin'>(initialTab);
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [adminPass, setAdminPass] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!emailOrUser.trim() || !password) {
      setErrorMsg('Preencha seu usuário/e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      const res = await onLogin(emailOrUser.trim(), password);
      if (res === true) {
        setSuccessMsg('Login realizado com sucesso!');
        setTimeout(() => {
          onClose();
        }, 500);
      } else if (typeof res === 'string') {
        setErrorMsg(res);
      } else {
        setErrorMsg('Usuário ou senha incorretos.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
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
      setErrorMsg('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await onRegister(name.trim(), emailOrUser.trim(), password);
      if (res === true) {
        setSuccessMsg('Cadastro realizado! Sua conta foi criada e está aguardando liberação do administrador.');
        setTimeout(() => {
          onClose();
        }, 2000);
      } else if (typeof res === 'string') {
        setErrorMsg(res);
      } else {
        setErrorMsg('Erro ao cadastrar usuário.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!adminPass) {
      setErrorMsg('Digite a senha de Administrador.');
      return;
    }

    setLoading(true);
    try {
      if (!adminLoginFn) {
        setErrorMsg('Função de autenticação de administrador indisponível.');
        return;
      }
      const res = await adminLoginFn(adminPass);
      if (res === true) {
        setSuccessMsg('Acesso Administrador liberado!');
        setTimeout(() => {
          onClose();
        }, 600);
      } else if (typeof res === 'string') {
        setErrorMsg(res);
      } else {
        setErrorMsg('Senha de administrador incorreta.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Senha incorreta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-[#101B2D] p-5 border-b border-[#2B3D63] flex items-center justify-between relative">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#C9A227] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Portal Concurso • Acesso Equipe
            </div>
            <h3 className="text-xl font-bold font-serif text-[#EDE6D6]">
              {tab === 'login' && 'Entrar no Sistema'}
              {tab === 'register' && 'Novo Cadastro de Atendente'}
              {tab === 'admin' && 'Acesso Master Administrador'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#8C98B4] hover:text-[#EDE6D6] p-1.5 rounded-lg hover:bg-[#172644] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 bg-[#101B2D]/60 p-1.5 border-b border-[#2B3D63] text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              tab === 'login'
                ? 'bg-[#C9A227] text-[#101B2D] font-bold shadow-md'
                : 'text-[#8C98B4] hover:text-[#EDE6D6]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              tab === 'register'
                ? 'bg-[#C9A227] text-[#101B2D] font-bold shadow-md'
                : 'text-[#8C98B4] hover:text-[#EDE6D6]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Criar Conta
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('admin');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              tab === 'admin'
                ? 'bg-[#C9A227] text-[#101B2D] font-bold shadow-md'
                : 'text-[#8C98B4] hover:text-[#EDE6D6]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-[#B14432]/20 border border-[#B14432] text-[#EDE6D6] p-3 rounded-xl flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-[#B14432] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#6E8F5C]/20 border border-[#6E8F5C] text-[#EDE6D6] p-3 rounded-xl flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-[#6E8F5C] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                  Usuário ou E-mail
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={emailOrUser}
                    onChange={(e) => setEmailOrUser(e.target.value)}
                    placeholder="Seu usuário ou e-mail cadastrado"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg pl-9 pr-10 py-2.5 text-sm text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#8C98B4] hover:text-[#EDE6D6]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold py-2.5 rounded-lg text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Entrando...' : 'Entrar no Sistema'}
              </button>

              <div className="text-center pt-2 flex flex-col items-center gap-1.5">
                <span className="text-xs text-[#8C98B4]">
                  Novo na equipe?{' '}
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className="text-[#C9A227] hover:underline font-semibold cursor-pointer"
                  >
                    Cadastre-se aqui
                  </button>
                </span>
                <span className="text-xs text-[#8C98B4]">
                  É o Administrador ou perdeu o acesso?{' '}
                  <button
                    type="button"
                    onClick={() => setTab('admin')}
                    className="text-[#EDE6D6] hover:text-[#C9A227] underline font-semibold cursor-pointer"
                  >
                    Recuperar Acesso Admin
                  </button>
                </span>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Maria Atendente"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                  Usuário ou E-mail para Login
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={emailOrUser}
                    onChange={(e) => setEmailOrUser(e.target.value)}
                    placeholder="Ex: maria@portal.com ou maria.vendas"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                  Crie uma Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg pl-9 pr-10 py-2.5 text-sm text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#8C98B4] hover:text-[#EDE6D6]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#6E8F5C] hover:bg-[#5e7d4d] text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Cadastrando...' : 'Criar Minha Conta'}
              </button>

              <div className="text-center pt-1">
                <span className="text-xs text-[#8C98B4]">
                  Já possui conta?{' '}
                  <button
                    type="button"
                    onClick={() => setTab('login')}
                    className="text-[#C9A227] hover:underline font-semibold cursor-pointer"
                  >
                    Faça login
                  </button>
                </span>
              </div>
            </form>
          )}

          {/* TAB 3: MASTER ADMIN ACCESS */}
          {tab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="bg-[#101B2D] p-3 rounded-xl border border-[#C9A227]/30 text-xs text-[#8C98B4] leading-relaxed">
                <span className="font-bold text-[#C9A227] block mb-1">Acesso Direto do Administrador:</span>
                Permite gerenciar todos os usuários, aprovar novos acessos, importar planilhas e redistribuir leads entre a equipe.
                <span className="block mt-1 text-[11px] text-[#EDE6D6]/70">
                  (Senha padrão inicial: <code className="bg-[#172644] text-[#C9A227] px-1 py-0.5 rounded font-mono">admin123</code> ou a senha personalizada definida no painel).
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                  Senha Mestra de Administrador
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-[#C9A227] absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="Digite a senha de administrador"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg pl-9 pr-10 py-2.5 text-sm text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#8C98B4] hover:text-[#EDE6D6]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold py-2.5 rounded-lg text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <Shield className="w-4 h-4" />
                {loading ? 'Validando...' : 'Acessar como Administrador'}
              </button>

              <div className="pt-2 border-t border-[#2B3D63]/80">
                <div className="bg-[#101B2D]/80 p-3 rounded-lg border border-[#C9A227]/20 flex flex-col gap-2">
                  <div className="text-[11px] text-[#EDE6D6] font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
                    Apagou sua conta sem querer?
                  </div>
                  <p className="text-[11px] text-[#8C98B4]">
                    Clique no botão abaixo para recriar e restaurar a conta de Administrador Master instantaneamente com privilégios totais.
                  </p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      setAdminPass('admin123');
                      setLoading(true);
                      try {
                        if (adminLoginFn) {
                          const res = await adminLoginFn('admin123');
                          if (res === true) {
                            setSuccessMsg('Conta de Administrador Master Restaurada com Sucesso!');
                            setTimeout(() => {
                              onClose();
                            }, 700);
                          } else {
                            setErrorMsg(typeof res === 'string' ? res : 'Erro ao restaurar.');
                          }
                        }
                      } catch (err: any) {
                        setErrorMsg(err.message || 'Erro ao restaurar.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full bg-[#6E8F5C] hover:bg-[#5e7d4d] text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Restaurar Conta Master Agora (admin123)
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

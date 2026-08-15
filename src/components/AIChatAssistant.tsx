import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  X,
  Copy,
  Check,
  RotateCcw,
  MessageCircle,
  Zap,
  HelpCircle,
  Flame,
  BookOpen,
  ShieldAlert,
  ChevronDown,
  User,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Contact, Objection, Plan } from '../types';
import { waLinkWithMessage, openWhatsAppDirect } from '../utils/excel';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface AIChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  objections: Objection[];
  plans: Plan[];
  activeContact?: Contact | null;
  onSelectContact?: (contact: Contact) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const QUICK_PROMPT_CHIPS = [
  {
    label: '💰 Quebrar "Está muito caro"',
    prompt: 'Como responder com empatia e lógica a um aluno que diz que a Assinatura 1.0 está cara, usando o abatimento do curso isolado?',
  },
  {
    label: '⏳ Quebrar "Não tenho tempo"',
    prompt: 'Qual o melhor roteiro de mensagem para um aluno que diz estar sem tempo ou com rotina de trabalho/filhos pesada?',
  },
  {
    label: '🎯 Roteiro de Fechamento (Aluno Quente)',
    prompt: 'Gere uma mensagem direta e elegante de fechamento para um aluno quente, enfatizando os 7 dias de garantia e as 180 mil questões.',
  },
  {
    label: '🕊️ Resgate de Aluno Frio/Desanimado',
    prompt: 'Crie uma mensagem acolhedora de reconexão para um aluno que desanimou dos estudos, lembrando o sonho da posse sem pressionar.',
  },
  {
    label: '📊 Diferença entre Plano 1.0 e 2.0',
    prompt: 'Explique de forma resumida e persuasiva a diferença entre a Assinatura Premium 1.0 e a Assinatura Elite 2.0.',
  },
];

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  isOpen,
  onClose,
  contacts,
  objections,
  plans,
  activeContact: initialContact,
  onSelectContact,
  onToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Olá! Sou a **IA Especialista do Portal Concurso** 🤖✨\n\nEstou pronta para te ajudar a criar abordagens personalizadas, quebrar objeções difíceis, redigir mensagens para o WhatsApp ou sugerir a melhor estratégia para cada aluno da sua lista.\n\nComo posso te ajudar agora?',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>(initialContact?.id || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentContact = contacts.find((c) => c.id === selectedContactId) || initialContact || null;

  useEffect(() => {
    if (initialContact) {
      setSelectedContactId(initialContact.id);
    }
  }, [initialContact?.id]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build history for API
      const historyForApi = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const contextData = {
        currentContact: currentContact
          ? {
              nome: currentContact.nome,
              curso: currentContact.curso,
              temperatura: currentContact.temperatura,
              observacao: currentContact.observacao,
              whatsapp: currentContact.whatsapp,
            }
          : null,
        totalContacts: contacts.length,
        plansCount: plans.length,
        objectionsCount: objections.length,
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyForApi,
          context: contextData,
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro na API (${res.status})`);
      }

      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.response || 'Desculpe, não consegui processar a resposta.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error: any) {
      console.error('Error contacting AI endpoint:', error);
      
      // Resilient local intelligent fallback response so user is never stranded
      let fallbackText = '';
      const lower = text.toLowerCase();

      if (lower.includes('caro') || lower.includes('preço') || lower.includes('dinheiro')) {
        fallbackText = `💡 **Estratégia para Objeção de Preço:**\n\n1. **❤️ Acolha com empatia:** Diga ao aluno que você entende o momento econômico e que cada real suado precisa ter retorno.\n2. **🧠 Mostre a lógica:** Destaque que 100% do valor do curso isolado que ele já tem é abatido na Assinatura 1.0 anual (dividido em 12x de menos de R$ 3 por dia).\n3. **🛡️ Garantia:** Lembre dos 7 dias incondicionais.\n\n*Texto sugerido para WhatsApp:*\n"Oi, ${currentContact?.nome || 'amigo(a)'}! Entendo perfeitamente o cuidado com o orçamento. Por isso, conseguimos aplicar o abatimento integral de 100% do que você pagou no curso isolado. Fica por menos de R$ 2,80/dia para ter todas as matérias e questões comentadas. Posso segurar essa condição para você hoje?"`;
      } else if (lower.includes('tempo') || lower.includes('rotina')) {
        fallbackText = `💡 **Estratégia para Falta de Tempo:**\n\n1. Mostre que concurseiro aprovado estuda com constância, não necessariamente 8 horas por dia.\n2. Apresente o método de **45 minutos/dia** resolvendo 15 questões comentadas no celular no ônibus ou intervalo de almoço.\n3. O cronograma enxuto da Assinatura 1.0 foca apenas no que realmente cai na banca do aluno.`;
      } else {
        fallbackText = `💡 **Dica do Especialista de Vendas:**\n\nPara aumentar sua taxa de conversão:\n- Personalize sempre com o primeiro nome do aluno (${currentContact?.nome || 'o aluno'}).\n- Mencione o concurso específico (${currentContact?.curso || 'o concurso de interesse'}).\n- Termine sempre com uma pergunta simples que exija apenas um 'Sim' ou 'Não' (ex: *"Posso liberar seu acesso com desconto agora?"*).\n\nComo posso detalhar mais para você?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onToast('Texto copiado com sucesso!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendToWhatsApp = (text: string) => {
    if (!currentContact?.whatsapp) {
      onToast('Nenhum aluno com WhatsApp selecionado.', 'info');
      return;
    }

    openWhatsAppDirect(currentContact.whatsapp, text);
    onToast(`WhatsApp aberto para ${currentContact.nome}!`, 'success');
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'model',
        text: 'Conversa reiniciada! 🔄 Em que posso te apoiar agora?',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#172644] border-l border-[#C9A227]/40 shadow-2xl flex flex-col animate-slideLeft">
      
      {/* Header */}
      <div className="bg-[#101B2D] p-4 border-b border-[#2B3D63] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A227] to-[#8C6D18] flex items-center justify-center text-[#101B2D] shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-serif font-bold text-sm sm:text-base text-[#EDE6D6]">
                Assistente IA de Vendas
              </h3>
              <span className="bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                Gemini 3.7
              </span>
            </div>
            <p className="text-[11px] text-[#8C98B4]">
              Consultor de estratégias, scripts & conversão
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearChat}
            className="p-1.5 text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644] rounded-lg transition-colors cursor-pointer"
            title="Reiniciar Conversa"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644] rounded-lg transition-colors cursor-pointer"
            title="Fechar Assistente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Student Context Selector Bar */}
      <div className="bg-[#121E33] px-4 py-2 border-b border-[#2B3D63] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-[#8C98B4] shrink-0">
          <User className="w-3.5 h-3.5 text-[#C9A227]" />
          <span className="text-[11px] font-semibold">Contexto do Aluno:</span>
        </div>

        <select
          value={selectedContactId}
          onChange={(e) => {
            setSelectedContactId(e.target.value);
            const found = contacts.find((c) => c.id === e.target.value);
            if (found && onSelectContact) {
              onSelectContact(found);
            }
          }}
          className="bg-[#172644] border border-[#2B3D63] text-[#EDE6D6] text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-[#C9A227] truncate max-w-[240px] cursor-pointer"
        >
          <option value="">Geral (Sem aluno específico)</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({c.temperatura}) — {c.curso || 'Sem curso'}
            </option>
          ))}
        </select>
      </div>

      {/* Active Student Badge info if selected */}
      {currentContact && (
        <div className="bg-[#101B2D]/80 px-4 py-2 border-b border-[#2B3D63]/70 flex items-center justify-between text-[11px] text-[#8C98B4]">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-[#EDE6D6]">{currentContact.nome}</span>
            <span>•</span>
            <span className="truncate">{currentContact.curso || 'Sem curso'}</span>
          </div>
          <span className="bg-[#172644] border border-[#2B3D63] text-[#C9A227] px-2 py-0.5 rounded font-bold uppercase text-[10px]">
            {currentContact.temperatura}
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs sm:text-sm">
        {messages.map((msg) => {
          const isModel = msg.role === 'model';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isModel ? 'items-start' : 'items-end'} space-y-1`}
            >
              <div className="flex items-center gap-1.5 px-1 text-[10px] text-[#8C98B4]">
                {isModel ? (
                  <>
                    <Bot className="w-3 h-3 text-[#C9A227]" />
                    <span className="font-semibold text-[#C9A227]">IA Portal Concurso</span>
                  </>
                ) : (
                  <span className="font-semibold text-[#EDE6D6]">Você</span>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[92%] rounded-2xl p-3.5 leading-relaxed shadow-sm transition-all whitespace-pre-wrap ${
                  isModel
                    ? 'bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-tl-sm'
                    : 'bg-[#C9A227] text-[#101B2D] font-medium rounded-tr-sm'
                }`}
              >
                {msg.text}
              </div>

              {/* Action buttons for AI messages */}
              {isModel && msg.id !== 'welcome' && (
                <div className="flex items-center gap-1.5 pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.text, msg.id)}
                    className="text-[11px] text-[#8C98B4] hover:text-[#EDE6D6] bg-[#101B2D] hover:bg-[#1F3057] border border-[#2B3D63] px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copiar texto"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-[#4ADE80]" />
                        <span className="text-[#4ADE80]">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  {currentContact?.whatsapp && (
                    <button
                      type="button"
                      onClick={() => handleSendToWhatsApp(msg.text)}
                      className="text-[11px] text-[#101B2D] font-bold bg-[#25D366] hover:bg-[#20ba5a] px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                      title={`Enviar no WhatsApp para ${currentContact.nome}`}
                    >
                      <MessageCircle className="w-3 h-3 fill-current" />
                      <span>Enviar no WhatsApp</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[#C9A227] bg-[#101B2D] border border-[#2B3D63] p-3 rounded-xl max-w-[80%] animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
            <span>Consultando inteligência do Portal Concurso...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="p-2.5 bg-[#101B2D] border-t border-[#2B3D63] overflow-x-auto">
        <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
          <span className="text-[#8C98B4] text-[10px] uppercase font-semibold flex items-center gap-1 shrink-0 pl-1">
            <Sparkles className="w-3 h-3 text-[#C9A227]" />
            Sugestões Rápidas:
          </span>
          {QUICK_PROMPT_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(chip.prompt)}
              className="bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] hover:border-[#C9A227]/50 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-[#101B2D] border-t border-[#2B3D63] flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            currentContact
              ? `Pergunte algo sobre ${currentContact.nome} ou peça um script...`
              : 'Pergunte como quebrar uma objeção ou criar um pitch...'
          }
          className="flex-1 bg-[#172644] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none placeholder-[#8C98B4]/70"
        />

        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="bg-[#C9A227] hover:bg-[#d8b030] active:scale-95 text-[#101B2D] font-bold p-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shrink-0"
          title="Enviar mensagem"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>

    </div>
  );
};

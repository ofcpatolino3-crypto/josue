import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Bot,
  TrendingUp,
  Target,
  ShieldAlert,
  Send,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Flame,
  Clock,
  DollarSign,
  Zap,
  Award,
  ArrowRight,
  MessageCircle,
  Edit3,
  HelpCircle,
  CheckCircle2,
  FastForward,
  Loader2,
  Mic,
  Volume2,
  Timer,
  Headphones,
  BookmarkPlus,
  Save,
} from 'lucide-react';
import { Contact, MessageTemplate, Objection, Plan, Temperature } from '../types';
import { fillTemplate, openWhatsAppDirect } from '../utils/excel';

interface SalesAssistantModalProps {
  isOpen: boolean;
  contact: Contact | null;
  contactsQueue?: Contact[];
  objections: Objection[];
  plans: Plan[];
  onClose: () => void;
  onSelectContact?: (contact: Contact) => void;
  onUpdateContactField?: (id: string, field: keyof Contact, value: any) => void;
  onMarkContacted?: (id: string) => void;
  onAddTemplate?: (newTmpl: MessageTemplate) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

interface DetectedObjectionMatch {
  objection: Objection;
  score: number;
  reason: string;
}

export const SalesAssistantModal: React.FC<SalesAssistantModalProps> = ({
  isOpen,
  contact,
  contactsQueue = [],
  objections,
  plans,
  onClose,
  onSelectContact,
  onUpdateContactField,
  onMarkContacted,
  onAddTemplate,
  onToast,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedObjectionId, setSelectedObjectionId] = useState<string>('');
  const [customPitch, setCustomPitch] = useState<string>('');
  const [customAudioScript, setCustomAudioScript] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'pitch' | 'audio' | 'objecoes' | 'planos'>('pitch');
  const [quickNote, setQuickNote] = useState<string>('');

  // Queue navigation index
  const currentIndex = contactsQueue.findIndex((c) => c.id === contact?.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < contactsQueue.length - 1;

  // --- AUTOMATED DIAGNOSTICS & ANALYSIS ENGINE ---
  const analysis = useMemo(() => {
    if (!contact) return null;

    const temp = contact.temperatura || 'Frio';
    const obsLower = (contact.observacao || '').toLowerCase();
    const statusLower = (contact.status || '').toLowerCase();
    const cursoLower = (contact.curso || '').toLowerCase();
    const fullContext = `${obsLower} ${statusLower} ${cursoLower}`;

    // 1. Temperature Strategy & Lead Score
    let score = 30;
    let strategyTitle = '';
    let strategyColor = '';
    let strategySummary = '';
    let strategyTips: string[] = [];

    switch (temp) {
      case 'Pagou':
        score = 100;
        strategyTitle = 'Boas-Vindas, Onboarding & Upsell de Elite';
        strategyColor = 'from-[#16A34A]/20 to-[#0B132B] border-[#16A34A]/40 text-[#4ADE80]';
        strategySummary = 'O aluno já comprou! O objetivo agora é garantir o acesso imediato, acolher e apresentar os benefícios da Mentoria VIP / Premium 2.0 no futuro.';
        strategyTips = [
          'Confirme se ele conseguiu acessar a plataforma e baixar o cronograma.',
          'Valide o sentimento de vitória: ele deu o passo decisivo para a posse.',
          'Coloque-se à disposição como orientador pedagógico de confiança.',
        ];
        break;
      case 'Quente':
        score = 90;
        strategyTitle = 'Fechamento Direto com Escassez & Abatimento';
        strategyColor = 'from-[#EA580C]/20 to-[#0B132B] border-[#EA580C]/40 text-[#FB923C]';
        strategySummary = 'O aluno está na iminência de assinar! Evite excesso de rodeios e envie a condição final com o valor do curso isolado já abatido e link para pagamento.';
        strategyTips = [
          'Mostre a facilidade de parcelar em até 12x (menos de R$ 3/dia).',
          'Enfatize a liberação de 180k questões comentadas para o concurso dele.',
          'Envie o link do checkout facilitado sem fricção.',
        ];
        break;
      case 'Potencial':
        score = 70;
        strategyTitle = 'Demonstração de Vantagem Econômica & Apoio à Decisão';
        strategyColor = 'from-[#2563EB]/20 to-[#0B132B] border-[#2563EB]/40 text-[#60A5FA]';
        strategySummary = 'O aluno demonstrou forte interesse, mas está calculando ou conversando com a família. O foco é provar que a Assinatura 1.0 é um investimento que se paga no primeiro salário público.';
        strategyTips = [
          'Frise que 100% do valor do curso isolado entra como desconto na Assinatura 1.0.',
          'Tranquilize sobre a Garantia Incondicional de 7 dias protegida por lei.',
          'Ofereça segurar o desconto especial por 24h a 48h.',
        ];
        break;
      case 'Morno':
        score = 50;
        strategyTitle = 'Acolhimento de Rotina & Diagnóstico de Dificuldades';
        strategyColor = 'from-[#2563EB]/20 to-[#0B132B] border-[#2563EB]/40 text-[#FCD34D]';
        strategySummary = 'O aluno está em ritmo lento ou tímido. Não faça venda agressiva: faça perguntas sinceras sobre como está a rotina de estudos para identificar sua maior dor.';
        strategyTips = [
          'Pergunte qual disciplina ele está achando mais pesada no curso isolado.',
          'Apresente o método de 45 min/dia de questões comentadas no celular.',
          'Envie uma mensagem leve e acolhedora sem pressão de compra.',
        ];
        break;
      case 'Frio':
      default:
        score = 25;
        strategyTitle = 'Resgate do Sonho & Reconexão com Baixa Fricção';
        strategyColor = 'from-[#DC2626]/20 to-[#0B132B] border-[#DC2626]/40 text-[#F87171]';
        strategySummary = 'O aluno desanimou ou pausou os estudos. O foco é reavivar o motivo principal da busca pela estabilidade e oferecer um recomeço acessível.';
        strategyTips = [
          'Relembre o propósito da posse (estabilidade, salário digno, família).',
          'Sugira voltar aos poucos com apenas 10 questões por dia.',
          'Mostre que o valor que ele já investiu não expira na migração.',
        ];
        break;
    }

    // 2. Keyword & History-based Objection Matching
    const objectionMatches: DetectedObjectionMatch[] = [];

    const keywordsPrice = ['caro', 'dinheiro', 'orçamento', 'preço', 'valor', 'parcela', 'desconto', 'bolsa', 'condição', 'custo', 'sem grana', 'apertad'];
    const keywordsTime = ['tempo', 'rotina', 'trabalho', 'filho', 'família', 'corrido', 'cansad', 'sem tempo', 'hora', 'agenda', 'pesad'];
    const keywordsIndecision = ['pensar', 'pensando', 'depois', 'aviso', 'ver com', 'esposo', 'esposa', 'marido', 'mãe', 'pai', 'mês que vem', 'semana que vem', 'analisar'];
    const keywordsMigration = ['isolado', 'já comprei', 'só esse', 'uma matéria', 'já tenho', 'crédito', 'abatimento', 'abater'];
    const keywordsFear = ['insegur', 'medo', 'não passar', 'difícil', 'desanim', 'adaptar', 'garantia', 'cancelar', 'concorrencia'];

    objections.forEach((obj) => {
      let matchScore = 0;
      let reason = 'Recomendado para o perfil do aluno';

      const objLower = (obj.objecao + ' ' + (obj.categoria || '')).toLowerCase();

      // Check context matches
      if (keywordsPrice.some((k) => fullContext.includes(k)) && (objLower.includes('car') || objLower.includes('preço') || objLower.includes('orçamento'))) {
        matchScore += 80;
        reason = 'Detectado histórico com menção a valor/orçamento';
      }
      if (keywordsTime.some((k) => fullContext.includes(k)) && (objLower.includes('tempo') || objLower.includes('rotina') || objLower.includes('horário'))) {
        matchScore += 80;
        reason = 'Detectado histórico com menção a falta de tempo/rotina corrida';
      }
      if (keywordsIndecision.some((k) => fullContext.includes(k)) && (objLower.includes('pensar') || objLower.includes('depois') || objLower.includes('indecis'))) {
        matchScore += 80;
        reason = 'Detectado histórico com pedido de tempo para pensar';
      }
      if (keywordsMigration.some((k) => fullContext.includes(k)) && (objLower.includes('isolado') || objLower.includes('migraç') || objLower.includes('compr'))) {
        matchScore += 75;
        reason = 'Aluno possui curso isolado com crédito de migração aplicável';
      }
      if (keywordsFear.some((k) => fullContext.includes(k)) && (objLower.includes('adaptar') || objLower.includes('garantia') || objLower.includes('medo') || objLower.includes('insegur'))) {
        matchScore += 75;
        reason = 'Detectada insegurança sobre adaptação ou garantia';
      }

      // Default baseline scores based on temperature if no direct keyword matched
      if (matchScore === 0) {
        if (temp === 'Quente' && (objLower.includes('garantia') || objLower.includes('adaptar') || objLower.includes('car'))) {
          matchScore = 50;
          reason = 'Excelente para quebrar última objeção antes da compra';
        } else if (temp === 'Potencial' && (objLower.includes('isolado') || objLower.includes('car') || objLower.includes('pensar'))) {
          matchScore = 55;
          reason = 'Forte argumento para destravar a negociação';
        } else if (temp === 'Morno' && (objLower.includes('tempo') || objLower.includes('pensar') || objLower.includes('isolado'))) {
          matchScore = 45;
          reason = 'Aborda a rotina e acolhe o aluno';
        } else if (temp === 'Frio' && (objLower.includes('tempo') || objLower.includes('isolado'))) {
          matchScore = 40;
          reason = 'Diminui o atrito para recomeço dos estudos';
        } else {
          matchScore = 20;
        }
      }

      objectionMatches.push({
        objection: obj,
        score: matchScore,
        reason,
      });
    });

    // Sort objections with highest score first
    objectionMatches.sort((a, b) => b.score - a.score);

    // 3. Recommended Plan Logic
    // If student has a specific single course, Recommend Plan 1.0 (Abatimento Total)
    // If student is hot or asks for VIP/redacao, Recommend Plan 2.0 (Elite)
    let recommendedPlan = plans.find((p) => p.destaque) || plans[0];
    let planPitchReason = 'Melhor custo-benefício com aproveitamento total do curso isolado';

    if (fullContext.includes('redação') || fullContext.includes('elite') || fullContext.includes('mentoria') || fullContext.includes('2 anos')) {
      const elitePlan = plans.find((p) => p.id === 'premium2' || p.nome.toLowerCase().includes('elite') || p.nome.toLowerCase().includes('2.0'));
      if (elitePlan) {
        recommendedPlan = elitePlan;
        planPitchReason = 'O aluno busca correção de redações e mentoria individualizada';
      }
    }

    return {
      score,
      temp,
      strategyTitle,
      strategyColor,
      strategySummary,
      strategyTips,
      objectionMatches,
      recommendedPlan,
      planPitchReason,
    };
  }, [contact, objections, plans]);

  // Sync selected plan and objection when analysis updates or contact changes
  React.useEffect(() => {
    if (analysis) {
      const topObj = analysis.objectionMatches[0]?.objection;
      if (topObj) {
        setSelectedObjectionId(topObj.id);
      }
      if (analysis.recommendedPlan) {
        setSelectedPlanId(analysis.recommendedPlan.id);
      }
    }
  }, [contact?.id]);

  // Generate the tailored sales pitch whenever selections or contact change
  React.useEffect(() => {
    if (!contact || !analysis) return;

    const activePlan = plans.find((p) => p.id === selectedPlanId) || analysis.recommendedPlan;
    const activeObjMatch = analysis.objectionMatches.find((m) => m.objection.id === selectedObjectionId);
    const activeObj = activeObjMatch?.objection;

    const nome = contact.nome || 'Futuro(a) Aprovado(a)';
    const curso = contact.curso ? contact.curso.trim() : 'Concursos Públicos';

    let pitch = '';

    if (analysis.temp === 'Pagou') {
      pitch = `Olá, ${nome}! Tudo bem? ✨\n\n` +
        `Passando para te dar as boas-vindas oficiais à família do Portal Concursos na sua preparação para *${curso}*! 👏\n\n` +
        `Você já conseguiu acessar a sua área de alunos e baixar o primeiro cronograma de estudos?\n\n` +
        `Estou aqui no WhatsApp para acompanhar a sua jornada até o Diário Oficial. Se precisar de qualquer orientação pedagógica inicial, é só me chamar! Bons estudos! 🚀`;
    } else if (analysis.temp === 'Quente') {
      pitch = `Oi, ${nome}! Tudo bem com você? 🎯\n\n` +
        `Estava separando aqui o seu cadastro para os estudos de *${curso}* e consegui autorização da coordenação para aplicar o *abatimento total do valor do seu curso isolado* na *${activePlan ? activePlan.nome : 'Assinatura Premium 1.0'}*.\n\n` +
        (activeObj
          ? `Lembrando que sobre "${activeObj.objecao}":\n${fillTemplate(activeObj.resposta, contact)}\n\n`
          : '') +
        `📌 *Condição Liberada Hoje:* ${activePlan ? activePlan.preco : 'Em até 12x facilitadas'}\n` +
        `✅ Acesso a 180.000+ questões comentadas, simulados e mentorias.\n` +
        `🛡️ Garantia incondicional de 7 dias.\n\n` +
        `Posso te enviar o link exclusivo com o abatimento já aplicado para você começar agora?`;
    } else if (analysis.temp === 'Potencial') {
      pitch = `Olá, ${nome}! Como você está? ✨\n\n` +
        `Estava analisando a sua preparação para *${curso}* e queria te apresentar uma oportunidade pensada com muito respeito ao seu investimento.\n\n` +
        `Em vez de você ter que comprar novos cursos avulsos no futuro a cada edital novo, nós conseguimos abater 100% do que você já investiu no curso isolado de ${curso} para você migrar para a *${activePlan ? activePlan.nome : 'Assinatura Premium 1.0'}*.\n\n` +
        `Fica por menos de R$ 2,80 por dia no plano anual, liberando TODOS os concursos e nosso banco com mais de 180 mil questões resolvidas em vídeo.\n\n` +
        `Faz sentido para o seu momento dar uma olhada nessa condição com calma?`;
    } else if (analysis.temp === 'Morno') {
      pitch = `Oi, ${nome}, tudo em paz? 📚\n\n` +
        `Lembrei de você hoje acompanhando a turma de *${curso}*.\n\n` +
        `Sei que a rotina de trabalho e família muitas vezes aperta e a gente sente que o tempo de estudo não rende como gostaria. Isso é super comum!\n\n` +
        `Você tem conseguido avançar nas aulas ou sentiu alguma matéria mais travada essa semana?\n\n` +
        `Se quiser, posso te mostrar como estudar 45 minutinhos por dia com questões comentadas no celular para acelerar seu rendimento sem sobrecarga!`;
    } else {
      // Frio
      pitch = `Oi, ${nome}! Tudo bem? 🕊️\n\n` +
        `Estava lembrando da sua caminhada aqui no Portal Concurso e senti no coração de te mandar uma mensagem amiga sobre a sua meta em *${curso}*.\n\n` +
        `A rotina muitas vezes cansa e imprevistos acontecem, mas queria te lembrar que a sua conquista da estabilidade financeira e tranquilidade para sua família continua totalmente ao seu alcance.\n\n` +
        `Se você quiser recomeçar no seu ritmo, nós garantimos que o valor que você já investiu no curso isolado continua 100% válido para você migrar para a Assinatura 1.0 quando quiser.\n\n` +
        `Como estão as coisas por aí hoje?`;
    }

    setCustomPitch(pitch);

    // Audio speech scripts calculation (20 to 35 seconds spoken scripts)
    const firstName = nome.split(' ')[0] || nome;
    let audioScript = '';
    if (analysis.temp === 'Pagou') {
      audioScript = `Fala, ${firstName}! Tudo bem por aí? Passando rapidinho em áudio só pra te dar as boas-vindas oficiais aqui no Portal Concursos! O seu acesso já tá 100% liberado e eu tô à sua disposição aqui no WhatsApp pra te apoiar no cronograma e tirar dúvidas. Tamo junto até a sua aprovação, viu? Um abraço!`;
    } else if (analysis.temp === 'Quente') {
      audioScript = `Oi, ${firstName}! Tudo bem? Gravando esse áudio rapidinho porque lembrei de você. Consegui a autorização aqui pra abater cem por cento do valor do seu curso isolado de ${curso} pra você migrar pra Assinatura 1.0! Ficou uma condição muito diferenciada e você já leva mais de cento e oitenta mil questões comentadas. Posso te mandar o link com o desconto aplicado agora?`;
    } else if (analysis.temp === 'Potencial') {
      audioScript = `Oi, ${firstName}, tudo em paz? Gravei esse áudio rápido porque vi seu interesse em ${curso} e queria te dar uma dica de ouro. A gente consegue abater todo o valor do seu curso isolado se você migrar pra Assinatura Completa. Assim você não gasta duas vezes quando abrir outro edital. Se fizer sentido pro seu momento, me avisa que te mostro como fica!`;
    } else if (analysis.temp === 'Morno') {
      audioScript = `Fala, ${firstName}! Tudo bem contigo? Lembrei de você hoje acompanhando a turma de ${curso}. Sei que a rotina pesa e o tempo fica apertado, mas queria te dizer que com trinta a quarenta minutos de questões comentadas por dia no celular você já mantém o ritmo sem cansaço excessivo. Me conta: como tá seu ritmo essa semana?`;
    } else {
      // Frio
      audioScript = `Oi, ${firstName}! Tudo bem por aí? Passei pra te deixar um abraço amigo e te lembrar que o seu sonho do concurso em ${curso} continua totalmente possível. Se a rotina apertou, relaxa que acontece. Só queria te avisar que o valor do seu curso isolado continua garantido pra quando você quiser reativar. Me dá um oi quando puder!`;
    }

    setCustomAudioScript(audioScript);
  }, [contact, analysis, selectedPlanId, selectedObjectionId, plans]);

  if (!isOpen || !contact || !analysis) return null;

  // Handlers
  const handleCopyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onToast(`${label} copiado com sucesso!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSendWhatsApp = (text: string) => {
    if (!contact.whatsapp) {
      onToast('Este contato não possui número de WhatsApp cadastrado.', 'error');
      return;
    }

    openWhatsAppDirect(contact.whatsapp, text);
    if (onMarkContacted) {
      onMarkContacted(contact.id);
    }
    onToast(`WhatsApp acionado com mensagem para ${contact.nome}!`, 'success');
  };

  const handleSendAndNext = (text: string) => {
    handleSendWhatsApp(text);
    if (hasNext && onSelectContact) {
      onSelectContact(contactsQueue[currentIndex + 1]);
    } else {
      onClose();
    }
  };

  const handleNavigate = (idx: number) => {
    if (idx >= 0 && idx < contactsQueue.length && onSelectContact) {
      onSelectContact(contactsQueue[idx]);
    }
  };

  const handleAddQuickNote = (noteText: string) => {
    const prev = contact.observacao ? contact.observacao.trim() + ' | ' : '';
    const updated = `${prev}${noteText}`;
    if (onUpdateContactField) {
      onUpdateContactField(contact.id, 'observacao', updated);
      onToast(`Observação atualizada para ${contact.nome}!`, 'info');
    }
  };

  const handleUpdateTemperature = (newTemp: Temperature) => {
    if (onUpdateContactField) {
      onUpdateContactField(contact.id, 'temperatura', newTemp);
      onToast(`Temperatura atualizada para "${newTemp}"!`, 'success');
    }
  };

  const handleGenerateAIPitch = async () => {
    if (!contact) return;
    setIsGeneratingAI(true);
    onToast('Gerando pitch ultra personalizado com IA...', 'info');

    try {
      const selectedPlan = plans.find((p) => p.id === selectedPlanId);
      const selectedObj = objections.find((o) => o.id === selectedObjectionId);

      const res = await fetch('/api/ai/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: {
            nome: contact.nome,
            curso: contact.curso,
            temperatura: contact.temperatura,
            observacao: contact.observacao,
          },
          objection: selectedObj,
          plan: selectedPlan,
          goal: contact.temperatura === 'Quente' ? 'fechamento e envio de link' : 'abertura de conversa e acolhimento',
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao gerar pitch com IA');
      }

      const data = await res.json();
      if (data.pitch) {
        setCustomPitch(data.pitch);
        onToast('Pitch gerado com sucesso pelo Gemini!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      onToast('Não foi possível conectar com o Gemini. Mantendo pitch padrão.', 'info');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const currentCourse = contact.curso?.trim() || 'Sem Curso Informado';
  const sameCourseContacts = contactsQueue.filter(
    (c) => (c.curso?.trim() || 'Sem Curso Informado') === currentCourse
  );
  const indexInCourse = sameCourseContacts.findIndex((c) => c.id === contact.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#111D3E] border border-[#2563EB]/40 rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Queue Bar & Contact Switcher */}
        <div className="bg-[#0B132B] px-4 py-2.5 border-b border-[#263B6E] flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="flex items-center gap-1.5 bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/50 font-bold px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider">
              <Bot className="w-3.5 h-3.5" />
              Assistente de Vendas IA
            </span>
            <span className="text-[#FFFFFF] font-serif font-bold text-sm truncate">
              {contact.nome}
            </span>
            <span className="text-[#94A3B8] text-xs">
              ({currentCourse}) {sameCourseContacts.length > 1 && `• ${indexInCourse + 1} de ${sameCourseContacts.length}`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {contactsQueue.length > 1 && (
              <div className="flex items-center gap-1 bg-[#111D3E] border border-[#263B6E] rounded-lg p-0.5">
                <button
                  type="button"
                  disabled={!hasPrevious}
                  onClick={() => handleNavigate(currentIndex - 1)}
                  className={`p-1.5 rounded text-xs flex items-center gap-1 transition-all ${
                    hasPrevious
                      ? 'text-[#FFFFFF] hover:bg-[#1C2C55] cursor-pointer'
                      : 'text-[#94A3B8]/40 cursor-not-allowed'
                  }`}
                  title="Aluno anterior na fila"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-[11px] font-mono text-[#94A3B8] px-1">
                  {currentIndex + 1}/{contactsQueue.length}
                </span>

                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => handleNavigate(currentIndex + 1)}
                  className={`p-1.5 rounded text-xs flex items-center gap-1 transition-all ${
                    hasNext
                      ? 'text-[#FFFFFF] hover:bg-[#1C2C55] cursor-pointer'
                      : 'text-[#94A3B8]/40 cursor-not-allowed'
                  }`}
                  title="Próximo aluno na fila"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-[#94A3B8] hover:text-[#FFFFFF] p-1.5 hover:bg-[#111D3E] rounded-lg transition-colors cursor-pointer"
              title="Fechar Assistente"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Top Banner: Real-time Analysis & Strategy based on Temperature & History */}
          <div className={`p-4 sm:p-5 rounded-xl border bg-gradient-to-r ${analysis.strategyColor} shadow-md`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-[#0B132B]/80 px-3 py-1 rounded-md border border-[#263B6E]">
                  <Flame className="w-4 h-4 text-[#EA580C]" />
                  <span>Temperatura: <b>{contact.temperatura}</b></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#FFFFFF] bg-[#0B132B]/80 px-3 py-1 rounded-md border border-[#263B6E]">
                  <Target className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Potencial de Conversão: <b>{analysis.score}%</b></span>
                </div>
              </div>

              {/* Quick Temperature Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-[#94A3B8]">Mudar Temperatura:</span>
                {(['Frio', 'Morno', 'Potencial', 'Quente', 'Pagou'] as Temperature[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleUpdateTemperature(t)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                      contact.temperatura === t
                        ? 'bg-[#2563EB] text-[#0B132B] border-[#2563EB] shadow-sm'
                        : 'bg-[#0B132B] text-[#94A3B8] border-[#263B6E] hover:text-[#FFFFFF] hover:border-[#94A3B8]'
                    }`}
                  >
                    {t === 'Pagou' ? '💰 Pagou' : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#2563EB]" />
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#FFFFFF]">
                  Estratégia Recomendada: {analysis.strategyTitle}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#FFFFFF]/90 leading-relaxed font-sans">
                {analysis.strategySummary}
              </p>

              {/* Strategy Action Tips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                {analysis.strategyTips.map((tip, idx) => (
                  <div key={idx} className="bg-[#0B132B]/60 border border-[#263B6E]/70 rounded-lg p-2.5 text-xs text-[#FFFFFF] flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Context from Notes & History */}
            {contact.observacao && (
              <div className="mt-3 pt-3 border-t border-[#263B6E]/60 flex items-start gap-2 text-xs text-[#94A3B8]">
                <Edit3 className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#FFFFFF]">Histórico Anotado do Aluno: </span>
                  <span className="text-[#FFFFFF]/90">{contact.observacao}</span>
                </div>
              </div>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#263B6E] overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('pitch')}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'pitch'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Pitch de Vendas (Texto)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audio')}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'audio'
                  ? 'border-[#38BDF8] text-[#38BDF8]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>🎙️ Roteiro de Áudio (25-30s)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('objecoes')}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'objecoes'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Objeções & Scripts ({analysis.objectionMatches.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('planos')}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'planos'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Planos & Proposta</span>
            </button>
          </div>

          {/* TAB 1: PITCH DE VENDAS PERSONALIZADO */}
          {activeTab === 'pitch' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Configuration selectors for the pitch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0B132B] p-3.5 rounded-xl border border-[#263B6E]">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-1 flex items-center justify-between">
                    <span>Plano Vinculado à Proposta:</span>
                    <span className="text-[#2563EB] text-[10px] font-normal">{analysis.planPitchReason}</span>
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-[#111D3E] border border-[#263B6E] text-[#FFFFFF] text-xs rounded-lg p-2 focus:outline-none focus:border-[#2563EB] cursor-pointer"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {p.preco}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-1">
                    Objeção a Destravar no Texto:
                  </label>
                  <select
                    value={selectedObjectionId}
                    onChange={(e) => setSelectedObjectionId(e.target.value)}
                    className="w-full bg-[#111D3E] border border-[#263B6E] text-[#FFFFFF] text-xs rounded-lg p-2 focus:outline-none focus:border-[#2563EB] cursor-pointer"
                  >
                    <option value="">Nenhuma objeção específica (Foco direto no plano)</option>
                    {analysis.objectionMatches.map((m) => (
                      <option key={m.objection.id} value={m.objection.id}>
                        {m.score >= 70 ? '🎯 [Alta Relevância] ' : ''}
                        "{m.objection.objecao}"
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Editable Pitch Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Script de Abordagem Pronto para {contact.nome}:</span>
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingAI}
                      onClick={handleGenerateAIPitch}
                      className="flex items-center gap-1.5 bg-[#2563EB]/15 hover:bg-[#2563EB]/25 text-[#2563EB] hover:text-[#FFFFFF] border border-[#2563EB]/50 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                      title="Gerar uma versão inédita e hiper personalizada com a inteligência do Gemini"
                    >
                      {isGeneratingAI ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Gerando com IA...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Gerar / Refinar com IA Gemini</span>
                        </>
                      )}
                    </button>

                    {onAddTemplate && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!customPitch.trim()) {
                            onToast('O pitch não pode estar vazio.', 'error');
                            return;
                          }
                          let savedText = customPitch;
                          if (contact.nome) {
                            savedText = savedText.replaceAll(contact.nome, '{nome}');
                            const first = contact.nome.split(' ')[0];
                            if (first && first !== contact.nome) {
                              savedText = savedText.replaceAll(first, '{nome}');
                            }
                          }
                          if (contact.curso) {
                            savedText = savedText.replaceAll(contact.curso, '{curso}');
                          }
                          const newTmpl: MessageTemplate = {
                            id: 't_ai_' + Date.now(),
                            titulo: `Script Assistente IA (${contact.temperatura || 'Vendas'})`,
                            categoria: 'fechamento_pix',
                            texto: savedText,
                            gatilho: 'Argumentação gerada por IA / Assistente',
                            tipo: 'texto',
                          };
                          onAddTemplate(newTmpl);
                          onToast('Pitch salvo como Novo Script no sistema!', 'success');
                        }}
                        className="flex items-center gap-1 text-[11px] bg-[#0B132B] hover:bg-[#1C2C55] text-[#2563EB] border border-[#263B6E] rounded-lg px-2.5 py-1 font-semibold cursor-pointer transition-colors"
                        title="Salvar este pitch como um Script reutilizável"
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        <span>Salvar como Script</span>
                      </button>
                    )}
                    <span className="text-[11px] text-[#94A3B8] hidden sm:inline">Você pode editar livremente</span>
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={customPitch}
                  onChange={(e) => setCustomPitch(e.target.value)}
                  placeholder="Gerando pitch personalizado..."
                  className="w-full bg-[#0B132B] border border-[#263B6E] focus:border-[#2563EB] text-[#FFFFFF] text-xs sm:text-sm font-sans p-3.5 rounded-xl leading-relaxed resize-y focus:outline-none shadow-inner"
                />
              </div>

              {/* Quick CRM stamp buttons */}
              <div className="flex items-center gap-2 flex-wrap text-xs bg-[#0B132B]/50 p-2.5 rounded-lg border border-[#263B6E]/50">
                <span className="text-[11px] font-semibold text-[#94A3B8]">Carimbo Rápido de Histórico:</span>
                <button
                  type="button"
                  onClick={() => handleAddQuickNote('Oferecido plano 1.0 com abatimento integral')}
                  className="px-2 py-1 bg-[#111D3E] hover:bg-[#1C2C55] text-[#FFFFFF] border border-[#263B6E] rounded text-[11px] cursor-pointer transition-colors"
                >
                  + Oferecida Migração 1.0
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuickNote('Aluno pediu prazo até amanhã')}
                  className="px-2 py-1 bg-[#111D3E] hover:bg-[#1C2C55] text-[#FFFFFF] border border-[#263B6E] rounded text-[11px] cursor-pointer transition-colors"
                >
                  + Pediu prazo
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuickNote('Enviado link com garantia de 7 dias')}
                  className="px-2 py-1 bg-[#111D3E] hover:bg-[#1C2C55] text-[#FFFFFF] border border-[#263B6E] rounded text-[11px] cursor-pointer transition-colors"
                >
                  + Enviada Garantia 7 dias
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAddQuickNote('Matrícula confirmada no PIX/Cartão!');
                    handleUpdateTemperature('Pagou');
                  }}
                  className="px-2 py-1 bg-[#16A34A]/20 hover:bg-[#16A34A]/30 text-[#4ADE80] border border-[#16A34A]/50 rounded text-[11px] font-bold cursor-pointer transition-colors"
                >
                  + Fechou Matrícula (💰 Pagou)
                </button>
              </div>
            </div>
          )}

          {/* TAB: ROTEIRO DE ÁUDIO (25-30s) */}
          {activeTab === 'audio' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Teleprompter Banner & Voice Tips */}
              <div className="bg-gradient-to-r from-[#0B132B] via-[#142640] to-[#0B132B] border border-[#38BDF8]/40 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#263B6E] pb-2.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#38BDF8]">
                    <Mic className="w-4 h-4 text-[#38BDF8] animate-pulse" />
                    <span>Teleprompter de Fala para WhatsApp ({contact.nome})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] text-xs font-bold px-2.5 py-0.5 rounded">
                      <Timer className="w-3.5 h-3.5" />
                      ⏱️ Duração: 25 a 30s
                    </span>
                    <span className="inline-flex items-center gap-1 bg-[#111D3E] border border-[#263B6E] text-[#FFFFFF] text-xs px-2.5 py-0.5 rounded">
                      <Volume2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                      Tom Seguro & Amigável
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-[#111D3E]/70 p-2 rounded-lg border border-[#263B6E] flex items-start gap-1.5">
                    <span className="text-[#38BDF8] font-bold">1.</span>
                    <span className="text-[#FFFFFF]">Fale o 1º nome nos 3 primeiros segundos para gerar atenção imediata.</span>
                  </div>
                  <div className="bg-[#111D3E]/70 p-2 rounded-lg border border-[#263B6E] flex items-start gap-1.5">
                    <span className="text-[#38BDF8] font-bold">2.</span>
                    <span className="text-[#FFFFFF]">Destaque a garantia de abater 100% do curso isolado sem rodeios.</span>
                  </div>
                  <div className="bg-[#111D3E]/70 p-2 rounded-lg border border-[#263B6E] flex items-start gap-1.5">
                    <span className="text-[#38BDF8] font-bold">3.</span>
                    <span className="text-[#FFFFFF]">Finalize com uma pergunta simples que exija apenas um "sim".</span>
                  </div>
                </div>
              </div>

              {/* Spoken Teleprompter Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    <span>Texto do Roteiro (Leitura Fluida):</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {onAddTemplate && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!customAudioScript.trim()) {
                            onToast('O roteiro de áudio não pode estar vazio.', 'error');
                            return;
                          }
                          let savedText = customAudioScript;
                          if (contact.nome) {
                            savedText = savedText.replaceAll(contact.nome, '{nome}');
                            const first = contact.nome.split(' ')[0];
                            if (first && first !== contact.nome) {
                              savedText = savedText.replaceAll(first, '{nome}');
                            }
                          }
                          if (contact.curso) {
                            savedText = savedText.replaceAll(contact.curso, '{curso}');
                          }
                          const newTmpl: MessageTemplate = {
                            id: 't_audio_' + Date.now(),
                            titulo: `Roteiro Áudio: ${contact.temperatura || 'Vendas'} (${contact.curso || 'Geral'})`,
                            categoria: 'roteiro_audio',
                            texto: savedText,
                            gatilho: 'Abatimento Integral + Simulado Semanal',
                            tipo: 'audio',
                            duracaoEstimada: '25 a 30 segundos',
                            tomDeVoz: 'Seguro, amigável e direto',
                          };
                          onAddTemplate(newTmpl);
                          onToast('Roteiro de áudio salvo como Novo Script!', 'success');
                        }}
                        className="text-[11px] text-[#38BDF8] hover:bg-[#38BDF8]/15 px-2 py-0.5 rounded border border-[#38BDF8]/30 cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        <span>Salvar como Script</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const firstName = (contact.nome || '').split(' ')[0] || contact.nome;
                        const curso = contact.curso ? contact.curso.trim() : 'Concursos';
                        let script = `Oi, ${firstName}! Tudo bem? Gravando esse áudio rapidinho porque consegui autorização da coordenação pra abater cem por cento do valor do seu curso isolado de ${curso} na Assinatura 1.0! Você já leva mais de cento e oitenta mil questões comentadas e simulados. Posso te mandar o link com o desconto aplicado agora?`;
                        setCustomAudioScript(script);
                        onToast('Roteiro de áudio recarregado!', 'info');
                      }}
                      className="text-[11px] text-[#38BDF8] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      Resetar Roteiro
                    </button>
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={customAudioScript}
                  onChange={(e) => setCustomAudioScript(e.target.value)}
                  className="w-full bg-[#0E1726] border-2 border-[#38BDF8]/50 focus:border-[#38BDF8] text-[#FFFFFF] rounded-xl p-4 text-sm sm:text-base leading-relaxed resize-y font-sans font-medium tracking-wide shadow-inner"
                  placeholder="Roteiro de fala..."
                />
              </div>

              {/* Action buttons specifically for Audio */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-[#263B6E]">
                <div className="text-xs text-[#94A3B8]">
                  💡 <i>Dica: Clique no botão abaixo para abrir o WhatsApp do aluno e segure o microfone para gravar enquanto lê a tela acima!</i>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleCopyText(customAudioScript, 'audio_script', 'Roteiro de Áudio')}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-[#111D3E] hover:bg-[#1C2C55] text-[#FFFFFF] border border-[#263B6E] rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {copiedKey === 'audio_script' ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'audio_script' ? 'Copiado!' : 'Copiar Roteiro'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!contact.whatsapp) {
                        onToast('Contato não possui WhatsApp cadastrado.', 'error');
                        return;
                      }
                      openWhatsAppDirect(contact.whatsapp, '');
                      if (onMarkContacted) {
                        onMarkContacted(contact.id);
                      }
                      onToast(`WhatsApp aberto para gravação com ${contact.nome}!`, 'success');
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-[#38BDF8] hover:bg-[#2cb2ed] text-[#0B132B] font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Abrir WhatsApp para Gravar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OBJEÇÕES DETECTADAS & SCRIPTS */}
          {activeTab === 'objecoes' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                <span>
                  Objeções ranqueadas por relevância com base na temperatura e nas anotações de <b>{contact.nome}</b>:
                </span>
              </div>

              <div className="space-y-3">
                {analysis.objectionMatches.map((m, idx) => {
                  const obj = m.objection;
                  const isTopMatch = m.score >= 70;
                  const formattedResponse = fillTemplate(obj.resposta, contact);
                  const isCopied = copiedKey === `obj_${obj.id}`;

                  return (
                    <div
                      key={obj.id}
                      className={`bg-[#0B132B] border rounded-xl p-4 sm:p-5 transition-all shadow-sm ${
                        isTopMatch
                          ? 'border-[#2563EB]/70 shadow-[0_0_12px_rgba(201,162,39,0.12)]'
                          : 'border-[#263B6E]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {isTopMatch && (
                              <span className="bg-[#2563EB] text-[#0B132B] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Alta Sugestão ({m.score}%)
                              </span>
                            )}
                            {obj.categoria && (
                              <span className="bg-[#111D3E] text-[#94A3B8] border border-[#263B6E] text-[10px] font-semibold uppercase px-2 py-0.5 rounded">
                                {obj.categoria}
                              </span>
                            )}
                            <span className="text-[11px] text-[#2563EB]/90 font-medium">
                              💡 Motivo: {m.reason}
                            </span>
                          </div>
                          <h4 className="font-serif font-bold text-base sm:text-lg text-[#FFFFFF]">
                            "{fillTemplate(obj.objecao, contact)}"
                          </h4>
                        </div>
                      </div>

                      {/* Answer Display */}
                      <div className="bg-[#111D3E]/70 p-3.5 rounded-lg border border-[#263B6E] text-xs sm:text-sm text-[#FFFFFF] leading-relaxed space-y-2 whitespace-pre-wrap font-sans my-2.5">
                        {formattedResponse.split('\n\n').map((para, pIdx) => {
                          if (para.startsWith('❤️ [EMOÇÃO]:')) {
                            return (
                              <div key={pIdx} className="bg-[#B14432]/10 border-l-2 border-[#B14432] pl-3 py-1 text-[#FFFFFF]">
                                <span className="font-bold text-[#B14432] mr-1.5">❤️ Emoção (Acolhimento):</span>
                                {para.replace('❤️ [EMOÇÃO]:', '').trim()}
                              </div>
                            );
                          }
                          if (para.startsWith('🧠 [LÓGICA]:')) {
                            return (
                              <div key={pIdx} className="bg-[#5C7A9E]/10 border-l-2 border-[#5C7A9E] pl-3 py-1 text-[#FFFFFF]">
                                <span className="font-bold text-[#5C7A9E] mr-1.5">🧠 Lógica (Racional/Cálculo):</span>
                                {para.replace('🧠 [LÓGICA]:', '').trim()}
                              </div>
                            );
                          }
                          return <p key={pIdx}>{para}</p>;
                        })}
                      </div>

                      {/* Action buttons for this objection */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#263B6E]/60 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedObjectionId(obj.id);
                            setActiveTab('pitch');
                            onToast('Objeção adicionada ao Pitch de Vendas!', 'info');
                          }}
                          className="text-xs text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Usar no Pitch Personalizado</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyText(formattedResponse, `obj_${obj.id}`, 'Script de Objeção')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              isCopied
                                ? 'bg-[#6E8F5C]/20 border-[#6E8F5C] text-[#6E8F5C]'
                                : 'border-[#263B6E] hover:border-[#FFFFFF] text-[#FFFFFF] hover:bg-[#1C2C55]'
                            }`}
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isCopied ? 'Copiado!' : 'Copiar Script'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(formattedResponse)}
                            className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-[#0B132B] font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar no WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: PLANOS & PROPOSTA SUGERIDA */}
          {activeTab === 'planos' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                <span>
                  Planos cadastrados com proposta personalizada para o curso de <b>{currentCourse}</b>:
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isSuggested = plan.id === analysis.recommendedPlan?.id;
                  const isCopied = copiedKey === `plan_${plan.id}`;

                  const formattedPlanText =
                    `Olá, ${contact.nome}! 🎯\n\n` +
                    `Aqui está a proposta da *${plan.nome}* com as condições especiais para quem já tem o curso de *${currentCourse}*:\n\n` +
                    `💳 *Investimento Especial:* ${plan.preco}\n\n` +
                    `*Benefícios Inclusos:*\n` +
                    plan.beneficios.map((b) => `✅ ${b}`).join('\n') +
                    `\n\n🛡️ *Garantia Incondicional de 7 Dias:*\n` +
                    `Você tem 7 dias completos para testar a plataforma. Se não se adaptar, devolvemos 100% do valor com uma única mensagem.\n\n` +
                    `Posso gerar seu link de acesso com o desconto aplicado?`;

                  return (
                    <div
                      key={plan.id}
                      className={`bg-[#0B132B] border rounded-xl p-5 flex flex-col justify-between shadow-sm transition-all ${
                        isSuggested
                          ? 'border-[#2563EB] shadow-[0_0_16px_rgba(201,162,39,0.15)] bg-gradient-to-b from-[#111D3E] to-[#0B132B]'
                          : 'border-[#263B6E]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="font-serif font-bold text-base sm:text-lg text-[#FFFFFF]">
                            {plan.nome}
                          </h4>
                          {isSuggested && (
                            <span className="bg-[#2563EB] text-[#0B132B] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Recomendado para {contact.nome}
                            </span>
                          )}
                        </div>

                        <div className="bg-[#111D3E] border border-dashed border-[#263B6E] p-2.5 rounded-lg mb-3">
                          <span className="block text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider mb-0.5">
                            Condição Comercial
                          </span>
                          <span className="font-serif font-semibold text-[#2563EB] text-sm">
                            {plan.preco}
                          </span>
                        </div>

                        <div className="space-y-1.5 mb-4">
                          <span className="block text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider">
                            O que está incluso ({plan.beneficios.length} benefícios)
                          </span>
                          <ul className="space-y-1 text-xs text-[#FFFFFF]">
                            {plan.beneficios.map((b, bIdx) => (
                              <li key={bIdx} className="flex items-start gap-1.5">
                                <Check className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#263B6E] flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyText(formattedPlanText, `plan_${plan.id}`, 'Proposta de Plano')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isCopied
                              ? 'bg-[#6E8F5C]/20 border-[#6E8F5C] text-[#6E8F5C]'
                              : 'border-[#263B6E] hover:border-[#FFFFFF] text-[#FFFFFF] hover:bg-[#1C2C55]'
                          }`}
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? 'Copiado!' : 'Copiar Proposta'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(formattedPlanText)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-[#0B132B] font-bold text-xs py-2 rounded-lg transition-all cursor-pointer shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar no WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer: Action Bar */}
        <div className="p-4 sm:p-5 border-t border-[#263B6E] bg-[#0B132B] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleCopyText(customPitch, 'main_pitch', 'Pitch Completo')}
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                copiedKey === 'main_pitch'
                  ? 'bg-[#6E8F5C]/20 border-[#6E8F5C] text-[#6E8F5C]'
                  : 'border-[#263B6E] hover:border-[#FFFFFF] text-[#FFFFFF] hover:bg-[#1C2C55]'
              }`}
            >
              {copiedKey === 'main_pitch' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Pitch Gerado
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#111D3E] rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasNext && (
              <button
                type="button"
                onClick={() => handleSendWhatsApp(customPitch)}
                className="w-full sm:w-auto px-3.5 py-2.5 text-xs font-semibold text-[#FFFFFF] border border-[#263B6E] hover:bg-[#1C2C55] rounded-lg transition-colors cursor-pointer"
                title="Apenas envia para este aluno sem avançar"
              >
                Enviar Apenas Este
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSendAndNext(customPitch)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-[#0B132B] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Send className="w-4 h-4 fill-current" />
              <span>{hasNext ? 'Enviar no WhatsApp & Próximo Aluno' : 'Enviar no WhatsApp'}</span>
              {hasNext && <FastForward className="w-4 h-4 ml-0.5" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

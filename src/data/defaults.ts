import { Contact, Objection, Plan, Temperature, MessageTemplate } from '../types';

export const TEMP_COLORS: Record<Temperature, string> = {
  Frio: '#DC2626', // 🔴 Vermelho
  Morno: '#C9A227', // 🟡 Amarelo / Dourado
  Potencial: '#2563EB', // 🔵 Azul
  Quente: '#EA580C', // 🔥 Laranja / Fogo
  Pagou: '#16A34A', // 🟢 Verde
};

export const TEMP_ORDER: Temperature[] = ['Frio', 'Morno', 'Potencial', 'Quente', 'Pagou'];

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  // 1. PÓS-PROVA (Acolhimento + Sondagem Inteligente)
  {
    id: 't_pos_1',
    titulo: 'Pós-Prova: Acolhimento Humano & Conversa de Corredor',
    categoria: 'pos_prova',
    gatilho: '❤️ Acolhimento Emocional Genuíno (Zero Pressão de Venda)',
    emocao: 'Tira a solidão do pós-prova, valida o cansaço mental e as renúncias feitas durante a preparação do curso isolado.',
    logica: 'Acolher primeiro para entender a real necessidade pedagógica antes de qualquer proposta de continuidade.',
    descricao: 'Para mandar 1 a 3 dias após a prova do curso isolado. Foco 100% em ouvir o aluno com empatia.',
    tags: ['Pós-Prova', 'Empatia', 'Acolhimento'],
    texto: `Olá, {nome}! Tudo bem com você? 

Passando aqui com calma, antes de qualquer coisa, para te dar um abraço de parabéns por ter encarado a prova de *{curso}*. Só quem abre mão de fins de semana e descansa pouco sabe o quanto essa jornada exige de nós. 👏

Como você está se sentindo hoje? Conseguiu descansar um pouco a cabeça depois da prova?

Me conta com calma como foi a sua experiência com as questões e o tempo de prova. Estou aqui para te ouvir e na torcida por você!`
  },
  {
    id: 't_pos_gabarito',
    titulo: 'Pós-Prova: Análise de Gabarito & Não Parar o Ritmo',
    categoria: 'pos_prova',
    gatilho: '🎯 Clareza de Próximos Passos + ⚡ Aproveitamento de Bagagem',
    emocao: 'Tranquilidade e direcionamento — mostra que a bagagem adquirida é o maior patrimônio do concurseiro.',
    logica: 'O concurseiro que não interrompe os estudos após a prova tem 4x mais chance de aprovação no concurso seguinte.',
    descricao: 'Ideal após a divulgação do gabarito preliminar, orientando o aluno a manter o ritmo sem desespero.',
    tags: ['Pós-Prova', 'Gabarito', 'Direcionamento'],
    texto: `Oi, {nome}! Como você está hoje? ☕

Vi que já saiu a movimentação do gabarito de *{curso}*. Independentemente da pontuação inicial, quero que você saiba que todo o conteúdo que você aprendeu e memorizou continua com você. Concurso é uma escada: nenhum esforço é perdido!

Você conseguiu dar uma olhada nas suas respostas? Como foi o seu desempenho nas matérias básicas e específicas?

Se você quiser uma ajuda para analisar os pontos fortes e o que precisa de reforço para os próximos editais, me avisa aqui que a gente bate um papo rápido!`
  },

  // 2. MIGRAÇÃO DE CURSO ISOLADO PARA ASSINATURA 1.0 (Abatimento Total do Valor Pago)
  {
    id: 't_pos_migracao',
    titulo: 'Pós-Prova: Do Curso Isolado para a Assinatura 1.0 (Abatimento 100%)',
    categoria: 'migracao',
    gatilho: '💡 Alívio de Não Perder Investimento + 🔓 Destravar Todos os Cursos',
    emocao: 'Paz de saber que o valor pago no curso isolado não foi "perdido" e a liberdade de poder estudar sem limitações.',
    logica: 'O valor pago no curso isolado de {curso} é abatido 100% como crédito na Assinatura 1.0, liberando toda a plataforma.',
    descricao: 'Abordagem humana para alunos que finalizaram a prova do curso isolado e querem continuar com acesso completo.',
    tags: ['Migração', 'Crédito Integral', 'Pós-Prova'],
    texto: `Oi, {nome}! Tudo bem? Espero que esteja conseguindo recarregar as energias. ✨

Estava conversando com a nossa coordenação sobre os alunos dedicados que fizeram o curso de *{curso}*. A gente sabe o quanto é ruim ter o acesso encerrado ou ficar limitado a um só material quando você quer continuar no ritmo de estudos.

Por isso, liberamos uma condição especial: você pode fazer a *Migração para a Assinatura 1.0*, e *100% do valor que você já investiu no seu curso isolado entra como desconto*.

Com a Assinatura 1.0, você não fica mais preso(a) a um curso só: ganha acesso livre a todos os concursos do portal, ao nosso banco com 180.000+ questões comentadas e mentorias.

Se fizer sentido para o seu momento, me dá um alô aqui que te mostro como fica esse aproveitamento sem compromisso nenhum. O que acha?`
  },
  {
    id: 't_migracao_1',
    titulo: 'Migração Financeira Inteligente: Economia Real vs Cursos Avulsos',
    categoria: 'migracao',
    gatilho: '❤️ Respeito ao Orçamento + 🧠 Economia Matemática na Assinatura 1.0',
    emocao: 'Sentimento de consideração e cuidado — saber que a escola reconhece o valor do dinheiro já investido pelo aluno.',
    logica: 'Evita gastar R$ 400 a R$ 800 em cada curso avulso novo. A Assinatura 1.0 unifica tudo por uma fração do valor.',
    descricao: 'Apresentação delicada e transparente da oportunidade de migrar do curso isolado para a Assinatura 1.0.',
    tags: ['Migração', 'Economia', 'Orçamento'],
    texto: `Oi, {nome}! Tudo em paz com você? 

Quero compartilhar com você uma oportunidade pensada com muito respeito à sua trajetória aqui com a gente. 

Você adquiriu o curso isolado de *{curso}*, e para que você não precise gastar dinheiro comprando novos cursos avulsos toda vez que surgir um novo edital, nós criamos o plano de *Migração para a Assinatura 1.0*.

Funciona de forma muito transparente:
1. Nós pegamos o valor exato que você já pagou no curso de *{curso}*;
2. Abatemos 100% dele como crédito para você migrar para a Assinatura 1.0;
3. Você ganha acesso irrestrito a TODOS os cursos do portal, ao banco de 180.000+ questões comentadas e simulados semanais.

Isso te dá a tranquilidade de estudar para qualquer certame sem ter que comprar novos pacotes.

Faz sentido para você dar uma olhadinha em como fica a condição para o seu cadastro? Se quiser, te passo os detalhes!`
  },
  {
    id: 't_pre_migracao',
    titulo: 'Pré-Prova: Sentindo Falta de Questões? (Ponte para a Assinatura 1.0)',
    categoria: 'migracao',
    gatilho: '🤝 Diagnóstico de Necessidade Real + 🚀 Upgrade Sem Duplicar Custo',
    emocao: 'Alívio de ter uma ferramenta completa (questões, simulados e mentoria) sem a sensação de estar desamparado.',
    logica: 'O curso isolado tem teoria excelente, mas a Assinatura 1.0 traz 180k questões e mentoria aproveitando o valor já pago.',
    descricao: 'Para o aluno que tem o curso isolado e precisa de mais questões comentadas e simulados para subir de nível.',
    tags: ['Migração', 'Banco de Questões', 'Simulados'],
    texto: `Olá, {nome}! Tudo bem? 🎯

Queria te fazer uma pergunta bem sincera sobre a sua preparação em *{curso}*: 

Você tem sentido que só as aulas teóricas do curso isolado estão sendo suficientes, ou às vezes dá aquela insegurança na hora de resolver exercícios e você sente falta de um banco de questões comentadas e simulados semanais?

Te pergunto isso porque muitos alunos nossos que estavam no curso isolado migraram para a *Assinatura 1.0* justamente para ter acesso a mais de 180.000 questões com resolução em vídeo e mentorias individuais. 

E o melhor: o valor que você pagou no curso de *{curso}* é abatido na migração.

Se você sentir que isso pode destravar seu rendimento, me conta aqui que eu te mostro como funciona, tá bom? Sem pressão alguma!`
  },

  // 3. PRÉ-PROVA & ROTINA DE ESTUDOS
  {
    id: 't_pre_1',
    titulo: 'Pré-Prova: Acolhimento de Rotina & Apoio Pedagógico',
    categoria: 'pre_prova',
    gatilho: '❤️ Empatia com a Sobrecarga Diária (Sem Julgamento)',
    emocao: 'Tira o sentimento de culpa de não conseguir estudar 6h por dia e normaliza a rotina apertada de quem trabalha.',
    logica: 'Estudo ativo e focado de 45 a 60 min diários supera a ansiedade de tentar cobrir tudo de uma vez no curso isolado.',
    descricao: 'Para alunos que estão estudando no curso isolado e podem estar se sentindo travados ou sobrecarregados.',
    tags: ['Pré-Prova', 'Rotina', 'Apoio Pedagógico'],
    texto: `Oi, {nome}, tudo bem? 📚

Estava acompanhando aqui os alunos do curso de *{curso}* e lembrei de você. 

Sei bem que conciliar trabalho, família e as aulas do curso nem sempre é fácil. Tem dias que bate aquele cansaço e a sensação de que o tempo não rende, né? Se estiver sentindo isso, fique em paz: quase todo concurseiro aprovado passou exatamente por essa mesma fase.

Como está o ritmo das matérias essa semana? Está conseguindo avançar com calma ou sentiu que alguma disciplina está mais pesada?

Se precisar de uma orientação prática de como organizar seu horário sem se sobrecarregar, me avisa! Estou por aqui para te apoiar.`
  },
  {
    id: 't_pre_reta_final',
    titulo: 'Pré-Prova: Reta Final & O Que Priorizar nos Últimos 30 Dias',
    categoria: 'pre_prova',
    gatilho: '⏳ Urgência Estratégica + 🎯 Foco nas Disciplinas Mais Cobradas',
    emocao: 'Segurança e direcionamento para combater a ansiedade dos últimos dias antes do concurso.',
    logica: 'Na reta final, resolver questões da banca examinadora tem 3x mais impacto na nota do que rever teoria inteira.',
    descricao: 'Para enviar quando o edital estiver próximo ou na contagem regressiva da prova.',
    tags: ['Pré-Prova', 'Reta Final', 'Foco'],
    texto: `Oi, {nome}! Como estão os preparativos para a prova de *{curso}*? ⏳

Estamos entrando num momento decisivo e sei que a ansiedade costuma bater nessa reta final. O segredo agora não é tentar devorar livros inteiros, mas sim focar no estilo da banca e em resolução massiva de questões dos tópicos mais cobrados.

Como está a sua revisão dos principais pontos do edital?

Se você quiser, posso te mandar um raio-x dos 3 temas que mais caem na sua prova para você garantir esses pontos preciosos. Quer que eu te envie?`
  },

  // 4. FECHAMENTO RÁPIDO & PIX (Para leads quentes e potenciais)
  {
    id: 't_fechamento_pix',
    titulo: 'Fechamento PIX / Cartão: Condição Especial com Liberação Imediata',
    categoria: 'fechamento_pix',
    gatilho: '⚡ Bônus Exclusivo + 🔓 Acesso Imediato + Condição Facilitada',
    emocao: 'Decisão segura, com a sensação de estar aproveitando uma oportunidade única e com suporte prioritário.',
    logica: 'O parcelamento em 12x fica menor que R$ 3,10/dia e a liberação no PIX/Cartão é instantânea.',
    descricao: 'Para enviar quando o aluno já tirou dúvidas e está pronto para efetuar a matrícula ou migração.',
    tags: ['Fechamento', 'PIX', 'Condição Especial'],
    texto: `Oi, {nome}! Tudo certo? 🚀

Consegui aprovar com a nossa diretoria a sua condição especial para a *Assinatura 1.0* com o aproveitamento total do valor que você já investiu em *{curso}*.

Ficou assim para o seu cadastro:
✅ Abatimento integral do seu curso isolado de {curso};
✅ Acesso completo e ilimitado a todos os cursos e editais do portal;
✅ Banco com 180.000+ questões comentadas e simulados ranqueados;
✅ 01 Mentoria individual de planejamento de estudos;
💳 Em até 12x suaves no cartão ou com desconto extra no PIX.

O link com o seu cupom de crédito exclusivo já está gerado. Quer que eu te envie agora para você já começar com o acesso liberado hoje mesmo?`
  },
  {
    id: 't_fechamento_urgencia',
    titulo: 'Fechamento: Últimas Vagas do Lote Promocional com Abatimento',
    categoria: 'fechamento_pix',
    gatilho: '⏰ Escassez Real de Condição + 🛡️ Garantia Incondicional de 7 Dias',
    emocao: 'Tranquilidade por contar com a garantia de 7 dias e urgência sadia para não perder o lote promocional.',
    logica: 'A tabela de abatimento integral de cursos isolados é limitada por lote para manter o suporte individual.',
    descricao: 'Para alunos que pediram para pensar ou que receberam a proposta e não finalizaram no dia.',
    tags: ['Fechamento', 'Urgência', 'Garantia'],
    texto: `Oi, {nome}, passando para te dar um toque rápido! ⏳

O nosso sistema vai virar o lote de matrículas da *Assinatura 1.0* e eu consegui segurar a sua vaga com a condição de abatimento total do curso de *{curso}* até o final do dia de hoje.

Lembrando que você conta com a nossa *Garantia Incondicional de 7 Dias*: você acessa tudo, assiste às aulas, testa o banco de questões e, se por qualquer motivo achar que não é para você, devolvemos 100% do valor com um clique. O risco é todo nosso!

Posso te mandar o link direto para você garantir o valor promocional antes da virada do lote?`
  },

  // 5. RECUPERAÇÃO DE ALUNOS SUMIDOS / RESGATE COM AFETO
  {
    id: 't_resgate_1',
    titulo: 'Resgate com Afeto: Uma Conversa Sincera sobre o seu Propósito',
    categoria: 'recuperacao_sumidos',
    gatilho: '❤️ Reconexão Genuína com o Sonho + 🕊️ Alívio de Cobranças',
    emocao: 'Toca o coração ao relembrar os motivos nobres da busca pela posse (estabilidade, família, dignidade) sem tom de cobrança.',
    logica: 'Recomeçar com uma meta leve e acessível (10 questões no celular) reduz o atrito e reativa o hábito de estudo.',
    descricao: 'Para reatar contato com alunos que desanimaram, pararam de acessar o curso isolado ou sumiram.',
    tags: ['Resgate', 'Recuperação', 'Afeto'],
    texto: `Oi, {nome}! Estava lembrando da sua caminhada aqui e senti no coração de te mandar uma mensagem... 

A gente sabe que a rotina cansa, imprevistos acontecem e muitas vezes o desânimo bate forte, fazendo a gente querer deixar os estudos de lado. Isso é absolutamente humano.

Mas queria te lembrar com muito carinho: *qual era o seu maior sonho quando você se matriculou em {curso}?* 
Foi dar mais tranquilidade para quem você ama? Ter a segurança de um salário digno todo mês sem medo de demissão?

Esse sonho ainda é totalmente seu. Se estiver difícil sentar e estudar por horas, que tal tentar só 10 minutinhos hoje, no seu tempo? 

Não estou te cobrando nada, viu? Só queria que soubesse que nós acreditamos no seu potencial. Se quiser conversar ou desabafar sobre como estão as coisas, estou por aqui!`
  },
  {
    id: 't_resgate_leve',
    titulo: 'Resgate Leve: "Está tudo bem por aí? Só para saber de você"',
    categoria: 'recuperacao_sumidos',
    gatilho: '🌿 Mensagem Curta e Desarmada (Zero Gatilhos Comerciais)',
    emocao: 'Alívio e abertura — o aluno não se sente pressionado a comprar nada, apenas percebe que alguém se importa com ele.',
    logica: 'Mensagens curtas de 3 linhas têm 75% mais taxa de resposta em leads inativos há mais de 15 dias.',
    descricao: 'Para contatos frios ou sem resposta há várias semanas. Abordagem minimalista e ultra-eficaz.',
    tags: ['Resgate', 'Mensagem Curta', 'Reconexão'],
    texto: `Oi, {nome}! Tudo bem com você?

Passando bem rapidinho só para saber como você está e se deu tudo certo com a sua rotina essa semana. 

Você ainda está com foco nos estudos de *{curso}* ou deu uma pausa no momento? 

(Sem pressão nenhuma, só para saber como posso te ajudar melhor por aqui!)`
  },

  // 6. RENOVAÇÃO AFETUOSA
  {
    id: 't_renovacao_1',
    titulo: 'Renovação Afetuosa: Cuidado com a Sua Reta Final (Assinatura 1.0)',
    categoria: 'renovacao',
    gatilho: '🏆 Proteção da Conquista + ☕ Investimento Menor que um Café por Dia',
    emocao: 'Reconhecimento da evolução já conquistada e incentivo carinhoso para não abandonar o sonho na hora decisiva.',
    logica: 'Manter a Assinatura 1.0 ativa custa menos de R$ 2,80/dia, preservando todo o progresso acumulado.',
    descricao: 'Para alunos da Assinatura 1.0 com período de acesso vencendo ou precisando de extensão.',
    tags: ['Renovação', 'Fidelidade', 'Reta Final'],
    texto: `Oi, {nome}, tudo bem? Espero que o seu dia esteja sendo muito bom! ✨

Estava aqui revendo o seu histórico de estudos e fiquei muito feliz em ver o quanto você já caminhou desde que começou. Concurso é uma construção diária, e o momento mais delicado é quando chegamos perto da prova e não podemos perder o ritmo.

O seu período de acesso está próximo de vencer, e como você é nosso aluno(a) querido(a), conseguimos segurar um valor especial de renovação da *Assinatura 1.0* com desconto de fidelidade.

Fica menos de R$ 2,80 por dia para você continuar com acesso a todas as aulas, simulados e ao banco de 180.000+ questões.

Quando tiver um tempinho, me responde aqui para eu te passar o link com o desconto aplicado, tá bom? Estou torcendo demais pelo seu sucesso!`
  },

  // 7. BOAS-VINDAS & PRIMEIRO CONTATO
  {
    id: 't_geral_1',
    titulo: 'Primeiro Contato: Conversa de Boas-Vindas & Diagnóstico Amigo',
    categoria: 'boas_vindas',
    gatilho: '🤝 Abordagem Humanizada e Consultiva (Anti-Telemarketing)',
    emocao: 'Faz o lead se sentir seguro, respeitado e ouvido como pessoa, e não como uma meta de venda fria.',
    logica: 'Identificar a real situação de estudo do aluno permite recomendar a melhor rota pedagógica.',
    descricao: 'Para novos contatos. Estabelece relação de confiança antes de qualquer proposta comercial.',
    tags: ['Boas-Vindas', 'Diagnóstico', 'Primeiro Contato'],
    texto: `Olá, {nome}! Tudo bem com você? 

Aqui é da equipe pedagógica do Portal Concursos. Vi que você demonstrou interesse nos estudos para *{curso}* e fiz questão de te mandar uma mensagem pessoalmente. 

A gente sabe que começar a estudar para concurso traz muitas dúvidas e um pouco de ansiedade sobre qual caminho seguir, o que priorizar e como não perder tempo.

Nosso papel aqui não é te empurrar curso nenhum, mas sim entender o seu momento: você já estuda há algum tempo ou está dando os primeiros passos agora?

Se você puder me contar um pouquinho da sua rotina, vou adorar te orientar da melhor forma!`
  },
  {
    id: 't_material_gratis',
    titulo: 'Boas-Vindas: Entrega de Material Gratuito / Edital Esquematizado',
    categoria: 'boas_vindas',
    gatilho: '🎁 Reciprocidade + 📖 Entrega de Valor Imediato sem Cobrança',
    emocao: 'Gratidão e confiança — o aluno recebe ajuda prática antes de receber qualquer oferta.',
    logica: 'Disponibilizar material gratuito qualifica o lead e abre canal direto de comunicação no WhatsApp.',
    descricao: 'Ideal para envio automático ou manual logo após o cadastro do aluno em listas e formulários.',
    tags: ['Boas-Vindas', 'Material Grátis', 'Reciprocidade'],
    texto: `Oi, {nome}! Tudo bem? 🎁

Separei aqui um material exclusivo de apoio pedagógico para quem está focado em *{curso}*: é o nosso *Guia de Estudos com Edital Esquematizado* e as disciplinas mais cobradas pela banca.

Quero te enviar gratuitamente para te ajudar a organizar seu cronograma dessa semana!

Você prefere que eu te envie o link direto por aqui em PDF ou tem algum e-mail de preferência? Me dá um alô!`
  },

  // 8. ROTEIROS DE ÁUDIO / VOICE SCRIPTS (Para gravar áudios de alta conversão de 20-35s)
  {
    id: 't_audio_pos_prova',
    titulo: '🎙️ Áudio: Acolhimento Humano Pós-Prova',
    categoria: 'roteiro_audio',
    tipo: 'audio',
    duracaoEstimada: '25 a 30 segundos',
    tomDeVoz: 'Acolhedor, sincero, voz calma e amiga (sem tom vendedor)',
    dicasGravacao: [
      'Chame pelo primeiro nome logo no 1º segundo de gravação.',
      'Fale pausadamente, como uma conversa entre dois amigos.',
      'Faça uma pequena pausa de 1 segundo antes da pergunta final.'
    ],
    gatilho: '🎙️ Conexão de Voz Genuína + Validação da Dedicação',
    emocao: 'Ouvir a voz humana transmite consideração real e quebra qualquer frieza do texto comercial.',
    logica: 'Áudios pós-prova aumentam a taxa de resposta do aluno em até 70% quando não há oferta imediata.',
    descricao: 'Roteiro de áudio para gravar no WhatsApp 1 a 3 dias após a prova do curso isolado.',
    tags: ['Roteiro de Áudio', 'Pós-Prova', 'Voz', 'Acolhimento'],
    texto: `Fala, {nome}, tudo bem contigo? Aqui é da equipe pedagógica do Portal Concursos. Tô passando aqui rapidinho só pra te parabenizar por ter encarado essa prova de *{curso}*! Sei o quanto você se dedicou nesses últimos meses. Conseguiu descansar um pouquinho a cabeça? Me manda um áudio ou uma mensagem aqui dizendo como você sentiu o nível da prova. Tô na torcida por você!`
  },
  {
    id: 't_audio_quebra_preco',
    titulo: '🎙️ Áudio: Quebra de Objeção "Tá Caro" / Abatimento 100%',
    categoria: 'roteiro_audio',
    tipo: 'audio',
    duracaoEstimada: '28 a 35 segundos',
    tomDeVoz: 'Empático, firme e seguro na proposta de valor',
    dicasGravacao: [
      'Valide que cuidar do dinheiro é prioridade, sem desmerecer a objeção.',
      'Destaque com ênfase a frase "100% de abatimento do que já pagou".',
      'Use a comparação de menos de R$ 3 por dia.'
    ],
    gatilho: '💡 Alívio de Custo + 🧠 Economia Diária vs Salário Público',
    emocao: 'Segurança financeira e sentimento de estar fazendo um negócio vantajoso.',
    logica: 'A voz firme e didática esclarece o cálculo do abatimento melhor que textos longos.',
    descricao: 'Para enviar quando o aluno disser que está apertado financeiramente ou achar caro.',
    tags: ['Roteiro de Áudio', 'Objeção Preço', 'Migração', 'Voz'],
    texto: `Oi, {nome}! Tudo bem? Te entendo perfeitamente, a gente tem que cuidar muito bem do nosso dinheiro mesmo. Mas olha só a boa notícia: você não perde um centavo do que já pagou no curso de *{curso}*. Nós abatemos 100% desse valor pra você migrar pra Assinatura 1.0! Na prática, a diferença fica parcelada em menos de três reais por dia pra destravar o portal inteiro com 180 mil questões. Posso te mandar o link pra você dar uma olhada sem compromisso?`
  },
  {
    id: 't_audio_resgate_sumido',
    titulo: '🎙️ Áudio: Resgate de Aluno Sumido / Desanimado',
    categoria: 'roteiro_audio',
    tipo: 'audio',
    duracaoEstimada: '20 a 25 segundos',
    tomDeVoz: 'Leve, incentivador, sem qualquer tom de cobrança',
    dicasGravacao: [
      'Comece com entusiasmo caloroso.',
      'Não pergunte "por que você sumiu?", foque na rotina real.',
      'Sugira o recomeço fácil com apenas 20 a 30 minutos diários.'
    ],
    gatilho: '🕊️ Reativação Emocional do Sonho da Posse',
    emocao: 'Tira a culpa do aluno por ter pausado os estudos e devolve a esperança.',
    logica: 'Ouvir um áudio caloroso e sem cobrança gera resposta rápida.',
    descricao: 'Para contatos que pararam de responder há 3 dias ou mais.',
    tags: ['Roteiro de Áudio', 'Resgate', 'Reconexão', 'Voz'],
    texto: `Oi, {nome}, tudo em paz? Lembrei de você hoje acompanhando aqui a turma de *{curso}*! Sei que a rotina aperta e às vezes a gente dá uma desanimada ou fica sem tempo, isso é super normal. Só queria te lembrar que você tem muito potencial pra buscar essa posse. Se quiser, a gente monta um planinho leve de 30 minutinhos por dia pra você retomar no seu ritmo. Me dá um oi aqui quando puder!`
  },
  {
    id: 't_audio_fechamento_quente',
    titulo: '🎙️ Áudio: Fechamento com Condição Autorizada',
    categoria: 'roteiro_audio',
    tipo: 'audio',
    duracaoEstimada: '25 a 30 segundos',
    tomDeVoz: 'Entusiasmado, com autoridade e energia de oportunidade única',
    dicasGravacao: [
      'Grave com energia alta e tom resolutivo.',
      'Diga que acabou de sair da coordenação com a aprovação especial.',
      'Finalize avisando que o link já está sendo enviado no chat.'
    ],
    gatilho: '🔥 Escassez Real + Autorização Especial de Desconto',
    emocao: 'Sensação de exclusividade e urgência positiva de fechar agora.',
    logica: 'O áudio personalizado gera compromisso moral muito maior que mensagem automática.',
    descricao: 'Para contatos quentes que estão prestes a fechar a Assinatura.',
    tags: ['Roteiro de Áudio', 'Fechamento', 'Quente', 'Voz'],
    texto: `Fala, {nome}, tudo certo? Passei agora pela coordenação e consegui a liberação daquela condição exclusiva que a gente conversou sobre *{curso}*. O abatimento do seu curso isolado já tá cadastrado no sistema e se você confirmar hoje eu consigo segurar o seu acesso com todas as 180 mil questões comentadas liberadas. Vou te mandar o link facilitado aqui abaixo, tá bom? Confirma se recebeu!`
  },
  {
    id: 't_audio_quebra_tempo',
    titulo: '🎙️ Áudio: "Não Tenho Tempo" / Estudo de 40 Minutos',
    categoria: 'roteiro_audio',
    tipo: 'audio',
    duracaoEstimada: '22 a 28 segundos',
    tomDeVoz: 'Prático, compreensivo e didático',
    dicasGravacao: [
      'Grave em ritmo natural, transmitindo praticidade.',
      'Mostre que o concurseiro comum estuda no intervalo e no celular.',
      'Enfatize as questões comentadas em vídeo.'
    ],
    gatilho: '⏱️ Desmistificação do Tempo + Método Direto no Celular',
    emocao: 'Alívio da sobrecarga de achar que precisa de 6 horas por dia.',
    logica: 'Estudo ativo por questões em blocos de 15 minutos rende mais que maratonas passivas.',
    descricao: 'Para alunos que alegam falta de tempo, trabalho puxado ou filhos.',
    tags: ['Roteiro de Áudio', 'Objeção Tempo', 'Método', 'Voz'],
    texto: `Oi, {nome}! Deixa eu te falar uma coisa rápida: a maioria dos nossos alunos aprovados também não tinha o dia livre, trabalhava fora e cuidava de casa. A Assinatura foi pensada exatamente pra quem tem pouco tempo: você faz 10 a 15 questões comentadas no celular na hora do almoço ou no ônibus e fixa mais matéria do que vendo três horas de aula. Quer que eu te mostre como organizar 40 minutinhos por dia?`
  },
  {
    id: 't_audio_boas_vindas',
    titulo: '🎙️ Áudio: Boas-Vindas ao Aluno Matriculado (Encantamento)',
    categoria: 'roteiro_audio',
    tipo: 'audio',
    duracaoEstimada: '20 a 25 segundos',
    tomDeVoz: 'Festivo, acolhedor, vibrante e profissional',
    dicasGravacao: [
      'Transmita genuína alegria pela matrícula do aluno.',
      'Reforce que agora você é o orientador direto dele no WhatsApp.',
      'Dê uma instrução inicial simples sobre a plataforma.'
    ],
    gatilho: '🎉 Validação da Vitória + Redução do Remorso Pós-Compra',
    emocao: 'Orgulho, pertencimento e segurança de ter feito a escolha certa.',
    logica: 'Áudio pós-venda reduz cancelamentos a zero e aumenta indicações futuras.',
    descricao: 'Para enviar imediatamente após o aluno pagar a assinatura.',
    tags: ['Roteiro de Áudio', 'Boas-Vindas', 'Pós-Venda', 'Voz'],
    texto: `Parabéns, {nome}! Seja muito bem-vindo(a) oficialmente à família do Portal Concursos! Você deu o passo mais importante rumo à sua posse em *{curso}*. Tô salvando seu contato como meu aluno VIP aqui no WhatsApp. Qualquer dúvida com as aulas, simulados ou cronograma, pode me mandar mensagem direta aqui. Bons estudos e vamos juntos até a nomeação!`
  }
];

export const DEFAULT_OBJECTIONS: Objection[] = [
  {
    id: 'o_1',
    objecao: 'Já comprei o curso isolado de {curso}, não quero gastar mais com Assinatura',
    resposta: '❤️ [EMOÇÃO]: Compreendo totalmente a sua preocupação, {nome}! O seu dinheiro é fruto de muito trabalho e você está mais do que certo(a) em cuidar bem dele.\n\n🧠 [LÓGICA]: A grande notícia é que na Migração para a Assinatura 1.0 você não perde um único centavo: 100% do valor que você pagou no curso isolado de {curso} entra como desconto direto na assinatura. Em vez de ficar limitado(a) só a uma matéria ou ter que comprar outro curso avulso de R$ 500 no próximo edital, você destrava o portal inteiro com 180.000 questões e mentorias por uma diferença bem pequena parcelada em 12x. Quer ver como fica a conta na ponta do lápis sem compromisso?',
    categoria: 'Migração'
  },
  {
    id: 'o_2',
    objecao: 'Achei a Assinatura 1.0 cara / não cabe no orçamento agora',
    resposta: '❤️ [EMOÇÃO]: Te entendo de coração! Sei como as contas apertam e como cada investimento precisa ser muito bem pensado para não comprometer a família.\n\n🧠 [LÓGICA]: Se olharmos o valor diário da Assinatura 1.0 com o desconto do seu curso isolado abatido, ele fica por menos de R$ 2,80 ao dia — menos que o pão na padaria. Quando sair sua posse e você receber seu primeiro salário público (R$ 5.000 a R$ 12.000+), esse valor se paga centenas de vezes no primeiro mês. Conseguimos opções em até 12x no cartão ou condições facilitadas. Posso verificar uma condição suave para você?',
    categoria: 'Preço'
  },
  {
    id: 'o_3',
    objecao: 'Vou ficar só com o curso isolado mesmo, acho que já dá',
    resposta: '❤️ [EMOÇÃO]: O curso isolado de {curso} é excelente e foi feito com muita qualidade, você vai aprender muito com ele sim!\n\n🧠 [LÓGICA]: A única coisa que me preocupa como orientador pedagógico é que as bancas hoje cobram muita malícia de prova, e o curso isolado tem foco quase todo em teoria. Na Assinatura 1.0 você ganha o banco de 180k questões comentadas alternativa por alternativa, simulados ranqueados e mentorias para não travar na hora H. Como seu curso isolado entra como crédito integral, a migração sai quase pelo mesmo valor. O que acha de dar uma olhada?',
    categoria: 'Migração'
  },
  {
    id: 'o_4',
    objecao: 'Vou pensar com calma e te aviso depois',
    resposta: '❤️ [EMOÇÃO]: Claro, {nome}! Uma decisão sobre o seu futuro e os seus estudos merece ser tomada com bastante tranquilidade e paz no coração.\n\n🧠 [LÓGICA]: Só queria te deixar bem tranquilo(a): o que mais está pesando para você refletir agora? É a questão do valor da parcela, o tempo para conseguir estudar ou como conciliar com o trabalho? Me conta com carinho, porque dependendo do que for, posso te ajudar a clarear isso ou segurar sua condição promocional do curso isolado por mais alguns dias.',
    categoria: 'Indecisão'
  },
  {
    id: 'o_5',
    objecao: 'Não tenho tempo para estudar uma assinatura inteira',
    resposta: '❤️ [EMOÇÃO]: Essa é a realidade da maioria dos nossos alunos: gente trabalhadora, com família e rotina puxada. Você não está sozinho(a) nessa angústia.\n\n🧠 [LÓGICA]: A Assinatura 1.0 não foi feita para quem tem o dia todo livre, mas sim para quem tem pouco tempo. Com o nosso método de questões e resumos direcionados, 45 minutos diários no celular no trajeto ou no almoço trazem mais resultado do que assistir a horas de aulas longas. Você estuda no seu ritmo, sem pressão. Quer que eu te mostre um plano de estudos de 45 min/dia?',
    categoria: 'Tempo/Rotina'
  },
  {
    id: 'o_6',
    objecao: 'E se eu assinar a 1.0 e não me adaptar?',
    resposta: '❤️ [EMOÇÃO]: É normal ter receio de dar um novo passo, ainda mais quando a gente já se decepcionou com outros métodos no passado.\n\n🧠 [LÓGICA]: Por isso nós oferecemos a Garantia Incondicional de 7 dias protegida por lei. Você migra para a Assinatura 1.0, acessa todas as aulas, mexe no banco de questões, assiste mentorias. Se achar que não valeu a pena, você pede o cancelamento com uma única mensagem e devolvemos 100% do seu dinheiro. O risco é inteiramente nosso. Quer fazer o teste?',
    categoria: 'Segurança'
  }
];

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'premium1',
    nome: 'Assinatura Premium 1.0',
    preco: '12x de R$ 93,05 ou R$ 997,00 à vista (com abatimento do curso isolado)',
    beneficios: [
      'Abatimento integral do valor já pago no seu curso isolado',
      'Acesso ilimitado a TODOS os cursos do portal sem custo extra',
      'Banco completo de questões com 180.000+ resoluções comentadas',
      'Simulados ilimitados com raio-x da banca examinadora',
      '01 mentoria individual estratégica de planejamento de estudos',
      'Acesso liberado no celular e computador'
    ],
    destaque: true
  },
  {
    id: 'premium2',
    nome: 'Assinatura Premium 2.0 (Elite)',
    preco: '12x de R$ 186,39 ou R$ 1.997,00 à vista',
    beneficios: [
      'Tudo da Assinatura Premium 1.0',
      'Correção de redações ilimitada com pareceristas oficiais',
      'Mentorias individuais ilimitadas com professores especialistas',
      'Acesso estendido por 2 anos completos',
      'Cronograma personalizado feito sob medida para a sua rotina'
    ],
    destaque: false
  }
];

export const SAMPLE_CONTACTS: Contact[] = [];

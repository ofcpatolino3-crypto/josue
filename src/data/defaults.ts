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
  {
    id: 't_pos_1',
    titulo: 'Pós-Prova: Acolhimento Humano & Conversa de Corredor',
    categoria: 'pos_prova',
    gatilho: '❤️ Acolhimento Emocional Genuíno (Zero Pressão de Venda)',
    emocao: 'Tira a solidão do pós-prova, valida o cansaço mental e as renúncias feitas durante a preparação do curso isolado.',
    logica: 'Acolher primeiro para entender a real necessidade pedagógica antes de qualquer proposta de continuidade.',
    descricao: 'Para mandar 1 a 2 dias após a prova do curso isolado. Foco 100% em ouvir o aluno com empatia.',
    texto: `Olá, {nome}! Tudo bem com você? 

Passando aqui com calma, antes de qualquer coisa, para te dar um abraço de parabéns por ter encarado a prova de *{curso}*. Só quem abre mão de fins de semana e descansa pouco sabe o quanto essa jornada exige de nós. 👏

Como você está se sentindo hoje? Conseguiu descansar um pouco a cabeça depois da prova?

Me conta com calma como foi a sua experiência com as questões e o tempo de prova. Estou aqui para te ouvir e na torcida por você!`
  },
  {
    id: 't_pos_migracao',
    titulo: 'Pós-Prova: Do Curso Isolado para a Assinatura 1.0 (Abatimento Total)',
    categoria: 'migracao',
    gatilho: '💡 Alívio de Não Perder Investimento + 🔓 Destravar Todos os Cursos',
    emocao: 'Paz de saber que o valor pago no curso isolado não foi "perdido" e a liberdade de poder estudar sem limitações.',
    logica: 'O valor pago no curso isolado de {curso} é abatido 100% como crédito na Assinatura 1.0, liberando toda a plataforma.',
    descricao: 'Abordagem humana para alunos que finalizaram o curso isolado e querem continuar com acesso completo.',
    texto: `Oi, {nome}! Tudo bem? Espero que esteja conseguindo recarregar as energias. ✨

Estava conversando com a nossa equipe sobre os alunos que se prepararam com o curso isolado de *{curso}*. A gente sabe o quanto é frustrante ter o acesso encerrado ou limitado a um único material quando você quer continuar no ritmo de estudos.

Por isso, a coordenação liberou uma condição de muito carinho: você pode fazer a *Migração para a Assinatura 1.0*, e *100% do valor que você já investiu no seu curso isolado entra como desconto*.

Com a Assinatura 1.0, você não fica mais preso(a) a um curso só: ganha acesso livre a todos os concursos, banco com 180.000+ questões comentadas e mentorias.

Se fizer sentido para o seu momento, me dá um alô aqui que te explico com calma como fica esse aproveitamento, sem compromisso nenhum. O que acha?`
  },
  {
    id: 't_pre_1',
    titulo: 'Pré-Prova: Acolhimento de Rotina & Apoio Pedagógico',
    categoria: 'pre_prova',
    gatilho: '❤️ Empatia com a Sobrecarga Diária (Sem Julgamento)',
    emocao: 'Tira o sentimento de culpa de não conseguir estudar 6h por dia e normaliza a rotina apertada de quem trabalha.',
    logica: 'Estudo ativo e focado de 45 a 60 min diários supera a ansiedade de tentar cobrir tudo de uma vez no curso isolado.',
    descricao: 'Para alunos que estão estudando no curso isolado e podem estar se sentindo travados ou sobrecarregados.',
    texto: `Oi, {nome}, tudo bem? 📚

Estava acompanhando aqui os alunos do curso de *{curso}* e lembrei de você. 

Sei bem que conciliar trabalho, família e as aulas do curso nem sempre é fácil. Tem dias que bate aquele cansaço e a sensação de que o tempo não rende, né? Se estiver sentindo isso, fique em paz: quase todo concurseiro aprovado passou exatamente por essa mesma fase.

Como está o ritmo das matérias essa semana? Está conseguindo avançar com calma ou sentiu que alguma disciplina está mais pesada?

Se precisar de uma orientação prática de como organizar seu horário sem se sobrecarregar, me avisa! Estou por aqui para te apoiar.`
  },
  {
    id: 't_pre_migracao',
    titulo: 'Pré-Prova: Sentindo Falta de Questões? (Ponte Humana para a Assinatura 1.0)',
    categoria: 'migracao',
    gatilho: '🤝 Diagnóstico de Necessidade Real + 🚀 Upgrade Sem Duplicar Custo',
    emocao: 'Alívio de ter uma ferramenta completa (questões, simulados e mentoria) sem a sensação de estar desamparado.',
    logica: 'O curso isolado tem teoria excelente, mas a Assinatura 1.0 traz 180k questões e mentoria aproveitando o valor já pago.',
    descricao: 'Para o aluno que tem o curso isolado e precisa de mais questões comentadas e simulados para subir de nível.',
    texto: `Olá, {nome}! Tudo bem? 🎯

Queria te fazer uma pergunta bem sincera sobre a sua preparação em *{curso}*: 

Você tem sentido que só as aulas teóricas do curso isolado estão sendo suficientes, ou às vezes dá aquela insegurança na hora de resolver exercícios e você sente falta de um banco de questões comentadas e simulados semanais?

Te pergunto isso porque muitos alunos nossos que estavam no curso isolado migraram para a *Assinatura 1.0* justamente para ter acesso a mais de 180.000 questões com resolução em vídeo e mentorias individuais. 

E o melhor: o valor que você pagou no curso de *{curso}* é abatido na migração.

Se você sentir que isso pode destravar seu rendimento, me conta aqui que eu te mostro como funciona, tá bom? Sem pressão alguma!`
  },
  {
    id: 't_migracao_1',
    titulo: 'Migração Humanizada: O Respeito ao seu Esforço Financeiro (Assinatura 1.0)',
    categoria: 'migracao',
    gatilho: '❤️ Respeito ao Orçamento + 🧠 Economia Inteligente na Assinatura 1.0',
    emocao: 'Sentimento de consideração e cuidado — saber que a escola reconhece o valor do dinheiro já investido pelo aluno.',
    logica: 'Evita gastar R$ 400 a R$ 800 em cada curso avulso novo. A Assinatura 1.0 unifica tudo por uma fração do valor.',
    descricao: 'Apresentação delicada e transparente da oportunidade de migrar do curso isolado para a Assinatura 1.0.',
    texto: `Oi, {nome}! Tudo em paz com você? 

Quero compartilhar com você uma oportunidade pensada com muito respeito à sua trajetória aqui com a gente. 

Você adquiriu o curso isolado de *{curso}*, e para que você não precise gastar dinheiro comprando novos cursos avulsos no futuro toda vez que surgir uma oportunidade, nós criamos o plano de *Migração para a Assinatura 1.0*.

Funciona de forma muito transparente:
1. Nós pegamos o valor exato que você já pagou no curso de *{curso}*;
2. Abatemos 100% dele como crédito para você migrar para a Assinatura 1.0;
3. Você ganha acesso irrestrito a TODOS os cursos do portal, ao nosso banco completo de questões comentadas e simulados.

Isso te dá a tranquilidade de estudar para qualquer certame sem gastar a cada novo edital.

Faz sentido para você dar uma olhadinha em como fica a condição para o seu cadastro? Se quiser, te mando os detalhes!`
  },
  {
    id: 't_renovacao_1',
    titulo: 'Renovação Afetuosa: Cuidado com a Sua Reta Final (Assinatura 1.0)',
    categoria: 'renovacao',
    gatilho: '🏆 Proteção da Conquista + ☕ Investimento Menor que um Café por Dia',
    emocao: 'Reconhecimento da evolução já conquistada e incentivo carinhoso para não abandonar o sonho na hora decisiva.',
    logica: 'Manter a Assinatura 1.0 ativa custa menos de R$ 2,80/dia, preservando todo o progresso acumulado.',
    descricao: 'Para alunos da Assinatura 1.0 com período de acesso vencendo ou precisando de extensão.',
    texto: `Oi, {nome}, tudo bem? Espero que o seu dia esteja sendo muito bom! ✨

Estava aqui revendo o seu histórico de estudos e fiquei muito feliz em ver o quanto você já caminhou desde que começou. Concurso é uma construção diária, e o momento mais delicado é quando chegamos perto da prova e não podemos perder o ritmo.

O seu período de acesso está próximo de vencer, e como você é nosso aluno(a) querido(a), conseguimos segurar um valor especial de renovação da *Assinatura 1.0* com desconto de fidelidade.

Fica menos de R$ 2,80 por dia para você continuar com acesso a todas as aulas, simulados e ao banco de 180.000+ questões.

Quando tiver um tempinho, me responde aqui para eu te passar o link com o desconto aplicado, tá bom? Estou torcendo demais pelo seu sucesso!`
  },
  {
    id: 't_resgate_1',
    titulo: 'Resgate com Afeto: Uma Conversa Sincera sobre o seu Propósito',
    categoria: 'geral',
    gatilho: '❤️ Reconexão Genuína com o Sonho + 🕊️ Alívio de Cobranças',
    emocao: 'Toca o coração ao relembrar os motivos nobres da busca pela posse (estabilidade, família, dignidade) sem tom de cobrança.',
    logica: 'Recomeçar com uma meta leve e acessível (10 questões no celular) reduz o atrito e reativa o hábito de estudo.',
    descricao: 'Para reatar contato com alunos que desanimaram, pararam de acessar o curso isolado ou sumiram.',
    texto: `Oi, {nome}! Estava lembrando da sua caminhada aqui e senti no coração de te mandar uma mensagem... 

A gente sabe que a rotina cansa, imprevistos acontecem e muitas vezes o desânimo bate forte, fazendo a gente querer deixar os estudos de lado. Isso é absolutamente humano.

Mas queria te lembrar com muito carinho: *qual era o seu maior sonho quando você se matriculou em {curso}?* 
Foi dar mais tranquilidade para quem você ama? Ter a segurança de um salário digno todo mês sem medo de demissão?

Esse sonho ainda é totalmente seu. Se estiver difícil sentar e estudar por horas, que tal tentar só 10 minutinhos hoje, no seu tempo? 

Não estou te cobrando nada, viu? Só queria que soubesse que nós acreditamos no seu potencial. Se quiser conversar ou desabafar sobre como estão as coisas, estou por aqui!`
  },
  {
    id: 't_geral_1',
    titulo: 'Primeiro Contato: Conversa de Boas-Vindas & Diagnóstico Amigo',
    categoria: 'geral',
    gatilho: '🤝 Abordagem Humanizada e Consultiva (Anti-Telemarketing)',
    emocao: 'Faz o lead se sentir seguro, respeitado e ouvido como pessoa, e não como uma meta de venda fria.',
    logica: 'Identificar a real situação de estudo do aluno permite recomendar a melhor rota pedagógica.',
    descricao: 'Para novos contatos. Estabelece relação de confiança antes de qualquer proposta comercial.',
    texto: `Olá, {nome}! Tudo bem com você? 

Aqui é da equipe pedagógica do Portal Concursos. Vi que você demonstrou interesse nos estudos para *{curso}* e fiz questão de te mandar uma mensagem pessoalmente. 

A gente sabe que começar a estudar para concurso traz muitas dúvidas e um pouco de ansiedade sobre qual caminho seguir, o que priorizar e como não perder tempo.

Nosso papel aqui não é te empurrar curso nenhum, mas sim entender o seu momento: você já estuda há algum tempo ou está dando os primeiros passos agora?

Se você puder me contar um pouquinho da sua rotina, vou adorar te orientar da melhor forma!`
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

export const SAMPLE_CONTACTS: Contact[] = [
  {
    id: 'c_demo_1',
    nome: 'Ana Carolina Mendes',
    whatsapp: '11987654321',
    email: 'ana.mendes@email.com',
    curso: 'Polícia Federal - Agente (Curso Isolado)',
    temperatura: 'Quente',
    dataContato: '2026-08-10',
    ultimoContato: '',
    proximoContato: '2026-08-14',
    status: 'Interessada na Migração 1.0',
    observacao: 'Comprou o curso isolado da PF e quer abater o valor para entrar na Assinatura 1.0.'
  },
  {
    id: 'c_demo_2',
    nome: 'Rodrigo Silveira Ramos',
    whatsapp: '21991234567',
    email: 'rodrigo.ramos@gmail.com',
    curso: 'Receita Federal - Auditor (Curso Isolado)',
    temperatura: 'Potencial',
    dataContato: '2026-08-08',
    ultimoContato: '2026-08-12',
    proximoContato: '2026-08-15',
    status: 'Em análise de abatimento',
    observacao: 'Achou interessante abater o curso isolado na Assinatura 1.0; vai conversar com a família.'
  },
  {
    id: 'c_demo_3',
    nome: 'Beatriz Vasconcelos',
    whatsapp: '31976543210',
    email: 'beatriz.v@outlook.com',
    curso: 'TJ-SP - Escrevente (Curso Isolado)',
    temperatura: 'Pagou',
    dataContato: '2026-08-05',
    ultimoContato: '2026-08-11',
    proximoContato: '',
    status: 'Migração 1.0 Concluída',
    observacao: 'Fez a migração para Assinatura 1.0 no PIX com abatimento total do curso isolado do TJ.'
  },
  {
    id: 'c_demo_4',
    nome: 'Lucas Albuquerque',
    whatsapp: '61988887777',
    email: 'lucas.albuquerque@gmail.com',
    curso: 'Banco do Brasil - Escriturário (Curso Isolado)',
    temperatura: 'Morno',
    dataContato: '2026-08-01',
    ultimoContato: '',
    proximoContato: '2026-08-10',
    status: 'Aguardando retorno',
    observacao: 'Enviada mensagem humanizada perguntando como está a rotina de estudos.'
  },
  {
    id: 'c_demo_5',
    nome: 'Mariana Duarte Costa',
    whatsapp: '41999991234',
    email: 'mariana.costa@hotmail.com',
    curso: 'INSS - Técnico (Curso Isolado)',
    temperatura: 'Frio',
    dataContato: '2026-07-28',
    ultimoContato: '2026-07-30',
    proximoContato: '',
    status: 'Pausou estudos',
    observacao: 'Aguardando momento mais tranquilo para retomar com a Assinatura 1.0.'
  }
];

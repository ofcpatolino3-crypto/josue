import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Lazy Gemini client helper
  let aiClient: GoogleGenAI | null = null;
  function getGemini(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI Chat Assistant Endpoint
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history = [], context = {} } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Mensagem é obrigatória.' });
      }

      const ai = getGemini();

      if (!ai) {
        // Fallback intelligent response if API key is not yet set in environment
        return res.json({
          response:
            'Olá! Sou o Assistente IA do Portal Concurso. Para ativar respostas geradas em tempo real pela IA do Google Gemini, certifique-se de configurar sua GEMINI_API_KEY no painel de Secrets. Enquanto isso, você pode consultar todos os scripts de objeções, planos de migração e a esteira de contatos pelo menu principal!',
          source: 'local_fallback',
        });
      }

      const systemInstruction = `Você é o "Assistente IA Especialista em Vendas & Atendimento do Portal Concurso".
Sua missão é ajudar o atendente/consultor comercial a converter contatos de alunos de concursos públicos para as Assinaturas do Portal Concurso (especialmente migração de cursos isolados para a Assinatura Premium 1.0 ou Assinatura Elite 2.0).

Regras de ouro do Portal Concurso:
1. Tom sempre acolhedor, empático, respeitoso e focado no sonho da aprovação e estabilidade financeira do aluno.
2. Vantagem Principal: 100% do valor já pago no curso isolado é abatido como crédito na Assinatura Premium 1.0 anual.
3. Diferenciais do Portal: 180.000+ questões comentadas, cronogramas por carreira, simulados gabaritados, garantia incondicional de 7 dias protegida por lei.
4. Estrutura das respostas para objeções: Sempre usar a combinação de ❤️ Acolhimento Emocional (validar a dor da falta de tempo/dinheiro) + 🧠 Lógica Racional (mostrar o cálculo por dia, menos de R$ 2,80/dia, economia de não comprar cursos avulsos).
5. Se o usuário pedir um texto para mandar no WhatsApp, forneça o texto pronto, bem formatado com negrito nos pontos-chave e emojis amigáveis.
6. Seja direto, prático, motivador e profissional.

Contexto atual da plataforma:
- Planos disponíveis: Assinatura Premium 1.0 (R$ 997/ano ou 12x R$ 99,70 - com abatimento do isolado), Assinatura Elite 2.0 (R$ 1.497/2 anos - com mentoria e redações).
${context.currentContact ? `- Aluno em foco: Nome: ${context.currentContact.nome}, Curso: ${context.currentContact.curso}, Temperatura: ${context.currentContact.temperatura}, Obs: ${context.currentContact.observacao || 'Nenhuma'}` : ''}
`;

      const formattedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Add conversation history
      if (Array.isArray(history)) {
        for (const item of history.slice(-6)) {
          if (item.role === 'user' || item.role === 'model') {
            formattedContents.push({
              role: item.role,
              parts: [{ text: item.text }],
            });
          }
        }
      }

      // Add current message
      formattedContents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const generatedText = response.text || 'Desculpe, não consegui gerar a resposta neste momento.';

      return res.json({
        response: generatedText,
        source: 'gemini',
      });
    } catch (error: any) {
      console.error('Error in /api/ai/chat:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao processar mensagem com IA.',
      });
    }
  });

  // AI Personalized Pitch Generator Endpoint
  app.post('/api/ai/generate-pitch', async (req, res) => {
    try {
      const { contact, objection, plan, goal = 'fechamento' } = req.body;

      const ai = getGemini();

      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY não configurada no servidor.',
        });
      }

      const prompt = `Crie uma mensagem ultra persuasiva, calorosa e elegante para WhatsApp direcionada ao seguinte aluno de concurso:
- Nome do Aluno: ${contact?.nome || 'Aluno'}
- Concurso/Curso de Interesse: ${contact?.curso || 'Concursos Públicos'}
- Temperatura/Momento: ${contact?.temperatura || 'Morno'}
- Histórico/Observações: ${contact?.observacao || 'Nenhum histórico registrado'}
- Objeção a quebrar (se houver): ${objection?.objecao || 'Dúvida geral sobre o custo-benefício'}
- Resposta base da objeção: ${objection?.resposta || '100% do curso isolado entra como abatimento'}
- Plano Oferecido: ${plan?.nome || 'Assinatura Premium 1.0'} (${plan?.preco || '12x R$ 99,70'})
- Objetivo: ${goal}

Instruções para o WhatsApp:
- Comece cumprimentando pelo primeiro nome de forma humana e leve.
- Faça uma ponte empática com o concurso do aluno (${contact?.curso || 'o concurso'}).
- Apresente a quebra da objeção com delicadeza e mostre a vantagem de abater o curso isolado.
- Termine com uma chamada de ação (CTA) simples e sem pressão (ex: "Posso te enviar o link com a condição liberada?").
- Use quebras de linha duplas para não virar um bloco gigante no WhatsApp.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Você é um consultor pedagógico e de vendas de alto nível do Portal Concurso. Redija mensagens prontas para envio no WhatsApp.',
          temperature: 0.7,
        },
      });

      return res.json({
        pitch: response.text,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/generate-pitch:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao gerar pitch com IA.',
      });
    }
  });

  // AI Document / PDF / Photo / Image / Text Contact Extractor Endpoint
  app.post('/api/ai/extract-contacts', async (req, res) => {
    try {
      const { text, fileData, mimeType, fileName } = req.body;

      if (!text && !fileData) {
        return res.status(400).json({ error: 'Nenhum texto ou arquivo fornecido para extração.' });
      }

      const ai = getGemini();

      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY não configurada no servidor. Configure a chave para extrair contatos de PDFs e Fotos com IA.',
        });
      }

      const systemInstruction = `Você é um especialista em OCR e Extração Inteligente de Contatos e Alunos do Portal Concurso.
Sua função é analisar com extrema precisão arquivos (documentos PDF, fotos de listas impressas, capturas de tela do WhatsApp ou CRM, formulários escaneados, planilhas ou texto corrido) e extrair todos os contatos individuais encontrados.

Regras de Extração para cada contato:
1. nome: Nome completo ou primeiro nome da pessoa. Remova numerações ("1.", "2."), cargos ou títulos desnecessários.
2. whatsapp: Número de telefone celular ou WhatsApp apenas dígitos com DDD (ex: 11987654321, 91981234567, 21999998888). Limpe espaços, parênteses e traços. Se contiver DDI 55 no início, mantenha no formato brasileiro padrão com DDD (10 ou 11 dígitos).
3. email: Endereço de e-mail válido se estiver visível no arquivo (em minúsculas).
4. curso: Nome do concurso (ex: "Polícia Federal", "INSS", "Polícia Civil", "TJ-SP", "Receita Federal", "PRF", "Enfermagem", "Banco do Brasil"), matéria ou curso isolado de interesse. Se não estiver explícito, use o contexto do documento ou deixe vazio.
5. temperatura: 'Quente' (se demonstrou alto interesse, pagou valor recente ou pediu proposta), 'Morno' (se fez pergunta padrão ou interesse moderado) ou 'Frio' (se é contato antigo ou lista geral). Padrão: 'Morno'.
6. observacao: Notas adicionais, forma de pagamento, histórico, data informada ou detalhes da conversa.
7. valorPago: Se houver indicação de valor pago em curso avulso (ex: R$ 150, R$ 297), extraia o número decimal (ex: 150.00).
8. status: 'Novo Lead' ou 'Pendente'.

Extraia com fidelidade TODOS os contatos válidos encontrados, não interrompa antes do fim da lista.`;

      const promptText = `Analise atentamente este arquivo (${fileName || 'documento'}) e extraia todos os contatos e informações de leads/alunos nele contidos em formato estruturado.`;

      const parts: Array<any> = [];

      if (fileData && mimeType) {
        // Support base64 encoded PDFs and Images
        const cleanBase64 = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        });
      }

      if (text) {
        parts.push({
          text: `Conteúdo de texto/lista fornecido:\n${text}`,
        });
      }

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: { parts },
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              contacts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nome: { type: Type.STRING, description: 'Nome completo do aluno' },
                    whatsapp: { type: Type.STRING, description: 'Telefone ou WhatsApp apenas dígitos com DDD' },
                    email: { type: Type.STRING, description: 'E-mail do aluno se houver' },
                    curso: { type: Type.STRING, description: 'Concurso ou curso de interesse' },
                    temperatura: { type: Type.STRING, description: 'Quente, Morno ou Frio' },
                    observacao: { type: Type.STRING, description: 'Observação ou notas' },
                    valorPago: { type: Type.NUMBER, description: 'Valor já pago se mencionado' },
                    status: { type: Type.STRING, description: 'Status inicial' },
                  },
                  required: ['nome'],
                },
              },
              summary: { type: Type.STRING, description: 'Resumo breve do que foi detectado no arquivo' },
              totalDetected: { type: Type.INTEGER, description: 'Total de contatos detectados' },
            },
            required: ['contacts'],
          },
        },
      });

      const responseText = response.text || '{}';
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(responseText);
      } catch (err) {
        console.error('Failed to parse Gemini JSON output:', responseText);
        parsedData = { contacts: [] };
      }

      return res.json({
        success: true,
        contacts: parsedData.contacts || [],
        summary: parsedData.summary || `Foram identificados ${parsedData.contacts?.length || 0} contatos com sucesso.`,
        totalDetected: parsedData.contacts?.length || 0,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/extract-contacts:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao extrair contatos com IA.',
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

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

  // Shared handler for contact extraction (PDFs, Photos, Screenshots, and Text)
  const handleExtractContacts = async (req: express.Request, res: express.Response) => {
    try {
      const { text, fileData, mimeType, fileName } = req.body;

      if (!text && !fileData) {
        return res.status(400).json({ error: 'Nenhum texto ou arquivo fornecido para extração.' });
      }

      const ai = getGemini();

      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY não configurada no servidor. Configure a chave no painel de Secrets para extrair contatos de fotos e documentos com IA.',
        });
      }

      const systemInstruction = `Você é um especialista em OCR e Extração Inteligente de Contatos e Alunos do Portal Concurso.
Sua função é analisar com extrema precisão arquivos (fotos de listas, capturas de tela do WhatsApp, mensagens encaminhadas, prints de CRM, documentos PDF, formulários escaneados, planilhas ou texto corrido) e extrair todos os contatos individuais encontrados.

Atenção especial a capturas de tela e mensagens de WhatsApp:
- Geralmente cada contato possui o Nome em uma linha (ou em maiúsculas), seguido pelo e-mail e o número de telefone/WhatsApp com DDD entre parênteses ou no formato (DD) 9XXXX-XXXX.
- Separe cada pessoa em um objeto de contato individual com seu respectivo nome, telefone e e-mail.

Regras de Extração para cada contato:
1. nome: Nome completo ou primeiro nome da pessoa. Remova numerações ("1.", "2."), setas ("->"), prefixos como "Encaminhada" ou cargos desnecessários.
2. whatsapp: Número de telefone celular ou WhatsApp apenas dígitos com DDD (ex: 11987654321, 31996218500, 75981009055, 21999998888). Limpe espaços, parênteses e traços. Se contiver DDI 55 no início, mantenha no formato brasileiro padrão com DDD (10 ou 11 dígitos).
3. email: Endereço de e-mail válido se estiver visível no arquivo (em minúsculas).
4. curso: Nome do concurso (ex: "Polícia Federal", "INSS", "Polícia Civil", "TJ-SP", "Receita Federal", "PRF", "Enfermagem", "Banco do Brasil", "PMPA", "PCPA", "DEPEN"), matéria ou curso isolado de interesse. Se não estiver explícito, use o contexto do documento ou deixe vazio.
5. temperatura: 'Quente' (se demonstrou alto interesse, pagou valor recente ou pediu proposta), 'Morno' (se fez pergunta padrão ou interesse moderado) ou 'Frio' (se é contato antigo ou lista geral). Padrão: 'Morno'.
6. observacao: Notas adicionais, forma de pagamento, histórico, data informada ou detalhes da conversa.
7. valorPago: Se houver indicação de valor pago em curso avulso (ex: R$ 150, R$ 297), extraia o número decimal (ex: 150.00).
8. status: 'Novo Lead' ou 'Pendente'.

Extraia com fidelidade TODOS os contatos válidos encontrados, não interrompa antes do fim da lista.`;

      const promptText = `Analise atentamente esta imagem ou documento (${fileName || 'arquivo'}) e extraia todos os contatos e informações de leads/alunos nele contidos em formato estruturado.`;

      const parts: Array<any> = [];

      if (fileData) {
        // Support base64 encoded PDFs and Images
        let cleanBase64 = fileData;
        let detectedMime = mimeType || 'image/jpeg';

        if (fileData.includes('base64,')) {
          const splitArr = fileData.split('base64,');
          cleanBase64 = splitArr[1];
          const mimeMatch = splitArr[0].match(/data:([^;]+)/);
          if (mimeMatch && mimeMatch[1]) {
            detectedMime = mimeMatch[1];
          }
        }

        const nameLower = (fileName || '').toLowerCase();
        if (detectedMime.includes('pdf') || nameLower.endsWith('.pdf')) {
          detectedMime = 'application/pdf';
        } else if (detectedMime.includes('png') || nameLower.endsWith('.png')) {
          detectedMime = 'image/png';
        } else if (detectedMime.includes('webp') || nameLower.endsWith('.webp')) {
          detectedMime = 'image/webp';
        } else if (!detectedMime.startsWith('image/')) {
          detectedMime = 'image/jpeg';
        }

        parts.push({
          inlineData: {
            mimeType: detectedMime,
            data: cleanBase64.trim(),
          },
        });
      }

      if (text) {
        parts.push({
          text: `Conteúdo de texto/lista fornecido:\n${text}`,
        });
      }

      parts.push({
        text: `${promptText}\nIMPORTANTE: Retorne a lista de contatos em formato JSON com o objeto { "contacts": [ { "nome": "...", "whatsapp": "...", "email": "...", "curso": "...", "temperatura": "...", "observacao": "..." } ], "summary": "...", "totalDetected": 0 }`,
      });

      let responseText = '';
      const modelsToTry = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: parts,
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          });

          if (response && response.text) {
            responseText = response.text;
            break;
          }
        } catch (mErr: any) {
          lastErr = mErr;
          console.warn(`Model ${modelName} failed in OCR extraction:`, mErr.message);
        }
      }

      if (!responseText && lastErr) {
        throw lastErr;
      }

      let parsedData: any = {};
      try {
        // Strip markdown code fences if present
        let cleanedJson = responseText.trim();
        if (cleanedJson.startsWith('```json')) {
          cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedJson.startsWith('```')) {
          cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        parsedData = JSON.parse(cleanedJson);
      } catch (err) {
        console.error('Failed to parse Gemini JSON output:', responseText);
        parsedData = { contacts: [] };
      }

      const rawContacts: Array<any> = Array.isArray(parsedData.contacts) ? parsedData.contacts : [];

      // Post-process and sanitize contacts
      const sanitizedContacts = rawContacts.map((c: any, index: number) => {
        let phoneDigits = (c.whatsapp || '').toString().replace(/\D/g, '');
        if (phoneDigits.startsWith('55') && (phoneDigits.length === 12 || phoneDigits.length === 13)) {
          phoneDigits = phoneDigits.slice(2);
        }
        while (phoneDigits.startsWith('0') && phoneDigits.length > 10) {
          phoneDigits = phoneDigits.slice(1);
        }

        let nome = (c.nome || '').trim();
        if (!nome) {
          nome = phoneDigits ? `Contato (${phoneDigits})` : `Lead ${index + 1}`;
        }

        let temp = (c.temperatura || 'Morno').trim();
        if (/quente/i.test(temp)) temp = 'Quente';
        else if (/pag/i.test(temp) || /matriculado/i.test(temp)) temp = 'Pagou';
        else if (/potencial/i.test(temp) || /alto/i.test(temp)) temp = 'Potencial';
        else if (/frio/i.test(temp)) temp = 'Frio';
        else temp = 'Morno';

        return {
          nome,
          whatsapp: phoneDigits,
          email: (c.email || '').toString().trim().toLowerCase(),
          curso: (c.curso || '').toString().trim(),
          temperatura: temp,
          observacao: (c.observacao || '').toString().trim(),
          valorPago: typeof c.valorPago === 'number' ? c.valorPago : 0,
          status: (c.status || 'Novo Lead').toString().trim(),
        };
      });

      return res.json({
        success: true,
        contacts: sanitizedContacts,
        summary: parsedData.summary || `Foram identificados ${sanitizedContacts.length} contatos com sucesso.`,
        totalDetected: sanitizedContacts.length,
      });
    } catch (error: any) {
      console.error('Error in contact extraction:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao extrair contatos com IA.',
      });
    }
  };

  // AI Document / PDF / Photo / Image / Text Contact Extractor Endpoints
  app.post('/api/ai/extract-contacts', handleExtractContacts);
  app.post('/api/extract-contacts', handleExtractContacts);
  app.post('/api/contacts/extract', handleExtractContacts);
  app.post('/api/ai/ocr', handleExtractContacts);

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

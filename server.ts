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

      const systemInstruction = `Você é um especialista sênior em OCR, Visão Computacional e Extração Inteligente de Contatos, Alunos e Compras do Portal Concurso.
Sua função é analisar com extrema precisão e fidelidade documentos, capturas de tela do WhatsApp, prints de planilhas como Google Sheets/Excel, prints de plataformas de pagamento/vendas (Hotmart, Eduzz, Kiwify, Asaas, MercadoPago, Monetizze, Braip, Hubla), comprovantes de PIX, CRM, notas, formulários ou textos.

REGRAS CRÍTICAS DE OCR EM PLANILHAS E TABELAS:
- NUNCA use cabeçalhos de tabela como nome ou curso do contato! Termos como "Nome", "CPF", "WhatsA", "WhatsApp", "Telefone", "Valor", "Status", "Matrícula" NÃO são alunos. Ignore a linha de cabeçalho.
- Se a linha começar com número de matrícula ou ID (ex: "109185 Gustavo"), remova o número/matrícula e extraia apenas o nome do aluno: "Gustavo".
- Em prints de planilhas com colunas (ex: Matrícula | Nome | WhatsApp/CPF | Curso | Valor), relacione cada coluna com o campo correto de cada pessoa.
- Remova DDI 55 do início do telefone, mantendo o DDD (2 dígitos) + número (8 ou 9 dígitos). Ex: 5583981119398 -> 83981119398.

ATENÇÃO MÁXIMA PARA CADA CAMPO:

1. CURSO / PRODUTO COMPRADO (campo "curso"):
- EXTRAIA O NOME COMPLETO E EXATO DO CURSO, CONCURSO, TURMA OU PRODUTO QUE O ALUNO COMPROU OU TEM INTERESSE.
- Procure por termos como: "Curso", "Isolada", "Combo", "Turma", "Apostila", "Mentoria", "Assinatura", "Polícia Militar", "PM-PA", "PMPA", "Polícia Civil", "PC-PA", "PCPA", "Polícia Federal", "PRF", "TJ-SP", "TJ-PA", "INSS", "Receita Federal", "Enfermagem", "Banco do Brasil", "Caixa", "Guarda Municipal", "SEFAZ", "Detran", "DEPEN", "Tribunal", "OAB", "Prefeitura de...", "Direito Penal", "Português", "Raciocínio Lógico", etc.
- NUNCA coloque cabeçalhos como ") Vaor =" ou "Valor" aqui.

2. E-MAIL (campo "email"):
- Procure ativamente por endereços de e-mail (ex: aluno@gmail.com, nome.sobrenome@hotmail.com, contato@...).
- Retorne SEMPRE o e-mail completo em letras minúsculas. Se não houver e-mail visível, deixe string vazia "".

3. NOME (campo "nome"):
- Extraia o nome completo ou primeiro nome da pessoa.
- Remova numerações ("1.", "2.", "109185"), prefixos como "Nome:", "Aluno:", "•", "->", "Encaminhada".

4. TELEFONE / WHATSAPP (campo "whatsapp"):
- Extraia o número completo com DDD (apenas dígitos).
- Exemplo: "(83) 98111-9398" -> "83981119398". Se tiver prefixo DDI +55, normalize para os 10 ou 11 dígitos padrão do Brasil.

5. TEMPERATURA (campo "temperatura"):
- "Pagou" se comprou, pagou, enviou comprovante, é aluno matriculado ou tem valor pago.
- "Quente" se pediu link, negociou ou tem interesse imediato.
- "Potencial" se quer saber condições ou valores.
- "Morno" se fez dúvida geral.
- "Frio" se é contato antigo.

6. VALOR PAGO (campo "valorPago"):
- Se houver indicação de valor pago ou preço do curso (ex: R$ 197,00, 297, 99.70), extraia o número float (ex: 197.00).

7. OBSERVAÇÃO (campo "observacao"):
- Detalhes adicionais, forma de pagamento (PIX/Cartão), data da compra ou notas do atendimento.

Regra de saída: Retorne rigorosamente um objeto JSON estruturado contendo a lista de contatos. Não interrompa antes de extrair todos os alunos.`;

      const promptText = `Analise com máxima atenção esta imagem/documento (${fileName || 'arquivo'}) e extraia com precisão cirúrgica:
1. O Nome do aluno;
2. O WhatsApp com DDD;
3. O E-mail do aluno (se presente no print, formulário ou texto);
4. O Nome exato do Curso / Concurso / Produto que ele comprou ou tem interesse;
5. O Valor pago e detalhes de pagamento (se houver).`;

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
      const modelsToTry = ['gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        try {
          const config: any = {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: 'application/json',
          };
          if (modelName === 'gemini-3.7-flash') {
            config.thinkingConfig = { thinkingBudget: 0 };
          }
          const response = await ai.models.generateContent({
            model: modelName,
            contents: parts,
            config,
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

      const HEADER_NOISE = ['cpf', 'whatsa', 'whatsapp', 'telefone', 'valor', 'vaor', 'preco', 'r$', 'status', 'aluno', 'nome', 'matricula', 'inscricao'];

      // Post-process and sanitize contacts
      const sanitizedContacts = rawContacts
        .filter((c: any) => {
          const nameLower = (c.nome || '').toString().toLowerCase().trim();
          if (HEADER_NOISE.some((h) => nameLower === h || nameLower === `cpf = ${h}` || nameLower.startsWith('cpf ='))) return false;
          if (nameLower.includes('whatsa') && nameLower.includes('cpf')) return false;
          return true;
        })
        .map((c: any, index: number) => {
          let phoneDigits = (c.whatsapp || '').toString().replace(/\D/g, '');
          if (phoneDigits.startsWith('55') && (phoneDigits.length === 12 || phoneDigits.length === 13)) {
            phoneDigits = phoneDigits.slice(2);
          } else if (phoneDigits.startsWith('550') && phoneDigits.length === 14) {
            phoneDigits = phoneDigits.slice(3);
          }
          while (phoneDigits.startsWith('0') && phoneDigits.length > 10) {
            phoneDigits = phoneDigits.slice(1);
          }

          let nome = (c.nome || '').toString().trim();
          nome = nome.replace(/^\d{3,10}\s*[-_\s|:]*\s*/, '').trim();
          if (!nome || HEADER_NOISE.some((h) => nome.toLowerCase() === h)) {
            nome = phoneDigits ? `Aluno (${phoneDigits.slice(0, 2)})` : `Aluno ${index + 1}`;
          }

          let curso = (c.curso || '').toString().trim();
          if (/va[lo0]r\s*[=\:]/i.test(curso) || HEADER_NOISE.some((h) => curso.toLowerCase() === h)) {
            curso = 'Concursos Gerais';
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
            curso: curso || 'Concursos Gerais',
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

  // SendGrid Lazy Client & Status
  const getSendGridClient = (customApiKey?: string) => {
    const apiKey = customApiKey || process.env.SENDGRID_API_KEY;
    if (!apiKey) return null;
    try {
      // Dynamic require / import
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(apiKey);
      return sgMail;
    } catch (err) {
      console.warn('Failed to load @sendgrid/mail:', err);
      return null;
    }
  };

  // Check SendGrid Configuration
  app.get('/api/email/status', (req, res) => {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    res.json({
      configured: !!apiKey,
      hasFromEmail: !!fromEmail,
      fromEmail: fromEmail || null,
      provider: 'sendgrid',
    });
  });

  // Batch Email Dispatcher
  app.post('/api/email/send-batch', async (req, res) => {
    try {
      const {
        contacts,
        subjectTemplate,
        bodyTemplate,
        fromEmailCustom,
        fromNameCustom = 'Portal Concursos',
        ctaLink,
        ctaText,
        customApiKey,
      } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: 'Nenhum contato fornecido para envio.' });
      }

      if (!subjectTemplate || !bodyTemplate) {
        return res.status(400).json({ error: 'Assunto e Mensagem são obrigatórios.' });
      }

      const apiKey = customApiKey || process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            'Chave SENDGRID_API_KEY não configurada. Configure a chave no menu de Configurações/Secrets ou insira diretamente no painel.',
          code: 'SENDGRID_KEY_MISSING',
        });
      }

      const senderEmail =
        fromEmailCustom || process.env.SENDGRID_FROM_EMAIL || 'notificacoes@portalconcurso.com.br';

      const sgMail = getSendGridClient(apiKey);
      if (!sgMail) {
        return res.status(500).json({ error: 'Falha ao inicializar o cliente SendGrid.' });
      }

      const results: Array<{
        id: string;
        email: string;
        nome: string;
        status: 'sent' | 'failed' | 'skipped';
        error?: string;
      }> = [];

      let sentCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      // Filter valid emails & deduplicate
      const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const seenEmails = new Set<string>();

      for (const contact of contacts) {
        const rawEmail = (contact.email || '').trim().toLowerCase();

        if (!rawEmail || !validEmailRegex.test(rawEmail)) {
          skippedCount++;
          results.push({
            id: contact.id || '',
            email: rawEmail,
            nome: contact.nome || 'Aluno',
            status: 'skipped',
            error: 'E-mail ausente ou inválido',
          });
          continue;
        }

        // Prevent duplicate dispatch to the exact same email address in the same batch
        if (seenEmails.has(rawEmail)) {
          skippedCount++;
          results.push({
            id: contact.id || '',
            email: rawEmail,
            nome: contact.nome || 'Aluno',
            status: 'skipped',
            error: 'E-mail duplicado no mesmo lote (omitido com segurança)',
          });
          continue;
        }
        seenEmails.add(rawEmail);

        // Variable Replacements
        const firstName = (contact.nome || 'Aluno').trim().split(' ')[0];
        const replaceVars = (template: string) => {
          return template
            .replace(/{nome}/gi, contact.nome || 'Aluno')
            .replace(/{primeiro_nome}/gi, firstName)
            .replace(/{primeironome}/gi, firstName)
            .replace(/{curso}/gi, contact.curso || 'Concursos Públicos')
            .replace(/{whatsapp}/gi, contact.whatsapp || '')
            .replace(/{telefone}/gi, contact.whatsapp || '')
            .replace(/{email}/gi, contact.email || '')
            .replace(/{observacao}/gi, contact.observacao || '')
            .replace(/{status}/gi, contact.status || '')
            .replace(/{temperatura}/gi, contact.temperatura || '');
        };

        const personalizedSubject = replaceVars(subjectTemplate);
        const personalizedBody = replaceVars(bodyTemplate);

        // Convert body text to formatted HTML
        const paragraphs = personalizedBody
          .split('\n\n')
          .map((p: string) => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');

        // Personalized CTA Link (supports wa.me or standard URL with variables)
        const personalizedCtaLink = ctaLink ? replaceVars(ctaLink) : '';

        const isWhatsAppBtn = personalizedCtaLink.includes('wa.me') || personalizedCtaLink.includes('whatsapp.com');

        const ctaHtml =
          personalizedCtaLink && ctaText
            ? `<div style="text-align: center; margin: 32px 0 24px 0;">
                <a href="${personalizedCtaLink}" target="_blank" style="background-color: ${isWhatsAppBtn ? '#25D366' : '#059669'}; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 9999px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15); letter-spacing: 0.2px;">
                  ${isWhatsAppBtn ? '💬 ' : ''}${ctaText}
                </a>
              </div>`
            : '';

        const fullHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${personalizedSubject}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center">
                  <table width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" border="0" cellspacing="0" cellpadding="0">
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #0f172a; padding: 24px 32px; text-align: left;">
                        <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                          PORTAL <span style="color: #34d399;">CONCURSOS</span>
                        </span>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding: 32px; font-size: 16px; color: #334155;">
                        ${paragraphs}
                        ${ctaHtml}
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">Portal Concurso - Central de Carreiras e Aprovações</p>
                        <p style="margin: 0;">Você recebeu esta mensagem porque é um aluno cadastrado no Portal Concurso.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        try {
          await sgMail.send({
            to: rawEmail,
            from: {
              email: senderEmail,
              name: fromNameCustom,
            },
            subject: personalizedSubject,
            text: personalizedBody,
            html: fullHtml,
          });

          sentCount++;
          results.push({
            id: contact.id || '',
            email: rawEmail,
            nome: contact.nome || 'Aluno',
            status: 'sent',
          });
        } catch (sendErr: any) {
          failedCount++;
          const errDetail =
            sendErr.response?.body?.errors?.[0]?.message || sendErr.message || 'Erro de envio';
          results.push({
            id: contact.id || '',
            email: rawEmail,
            nome: contact.nome || 'Aluno',
            status: 'failed',
            error: errDetail,
          });
        }
      }

      return res.json({
        success: true,
        sentCount,
        failedCount,
        skippedCount,
        total: contacts.length,
        results,
        message: `Disparo concluído: ${sentCount} e-mails enviados com sucesso, ${failedCount} falhas, ${skippedCount} ignorados.`,
      });
    } catch (error: any) {
      console.error('Error in /api/email/send-batch:', error);
      return res.status(500).json({
        error: error.message || 'Erro inesperado no disparo de e-mails em lote.',
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

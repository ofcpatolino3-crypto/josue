import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { text, fileData, mimeType, fileName } = req.body || {};

    if (!text && !fileData) {
      return res.status(400).json({ error: 'Nenhum texto ou arquivo fornecido para extração.' });
    }

    const ai = getGemini();

    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY não configurada na Vercel / Servidor. Adicione GEMINI_API_KEY nas variáveis de ambiente da Vercel para OCR com IA.',
      });
    }

    const systemInstruction = `Você é um especialista em OCR e Extração Inteligente de Contatos e Alunos do Portal Concurso.
Sua função é analisar com extrema precisão arquivos (fotos de listas, capturas de tela do WhatsApp, prints de planilhas como Google Sheets/Excel, mensagens encaminhadas, prints de CRM, documentos PDF, formulários escaneados ou texto corrido) e extrair todos os contatos individuais encontrados.

REGRAS CRÍTICAS DE OCR EM PLANILHAS E TABELAS:
- NUNCA use cabeçalhos de tabela como nome ou curso do contato! Ex: Termos como "Nome", "CPF", "WhatsA", "WhatsApp", "Telefone", "Valor", "Status", "Matrícula" NÃO são alunos. Ignore a linha de cabeçalho.
- Se a linha começar com número de matrícula ou ID (ex: "109185 Gustavo"), remova o número/matrícula e extraia apenas o nome do aluno: "Gustavo".
- Em prints de planilhas com colunas (ex: Matrícula | Nome | WhatsApp/CPF | Curso | Valor), relacione cada coluna com o campo correto de cada pessoa.
- Remova DDI 55 do início do telefone, mantendo o DDD (2 dígitos) + número (8 ou 9 dígitos). Ex: 5583981119398 -> 83981119398.

Regras de Extração para cada contato:
1. nome: Nome completo ou primeiro nome da pessoa. Remova numerações ("1.", "2.", "109185"), setas ("->"), prefixos como "Encaminhada" ou rótulos ("Nome:", "Aluno:").
2. whatsapp: Número de telefone celular ou WhatsApp apenas dígitos com DDD (ex: 83981286997, 17991029387, 88992356945). Limpe espaços, parênteses e traços. Se contiver DDI 55 no início, remova o 55 e mantenha DDD + 8 ou 9 dígitos.
3. email: Endereço de e-mail válido se estiver visível no arquivo (em minúsculas).
4. curso: Nome do concurso (ex: "Prefeitura de...", "PM-PA", "Polícia Civil", "TJ-SP", "INSS", "Polícia Federal", "PRF", "Banco do Brasil"), matéria ou curso de interesse. NUNCA coloque cabeçalhos como ") Vaor =" ou "Valor" aqui.
5. temperatura: 'Pagou' (se constar pago/matriculado), 'Quente' (alto interesse), 'Morno' ou 'Frio'. Padrão: 'Morno'.
6. observacao: Notas adicionais, forma de pagamento, histórico ou data informada.
7. valorPago: Se houver indicação de valor pago em curso avulso (ex: R$ 150, R$ 297), extraia o número decimal (ex: 150.00).
8. status: 'Novo Lead'.

Extraia com fidelidade TODOS os contatos válidos encontrados, linha por linha.`;

    const promptText = `Analise atentamente esta imagem ou documento (${fileName || 'arquivo'}) e extraia todos os contatos e informações de leads/alunos nele contidos em formato estruturado.`;

    const parts: Array<any> = [];

    if (fileData) {
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
        console.warn(`Model ${modelName} failed in Vercel OCR extraction:`, mErr.message);
      }
    }

    if (!responseText && lastErr) {
      throw lastErr;
    }

    let parsedData: any = {};
    try {
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

    const sanitizedContacts = rawContacts
      .filter((c: any) => {
        const nameLower = (c.nome || '').toString().toLowerCase().trim();
        const courseLower = (c.curso || '').toString().toLowerCase().trim();
        // Discard header rows
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

        let cleanName = (c.nome || '').toString().trim();
        // Remove leading matricula/ID (e.g. "109185 Gustavo" -> "Gustavo")
        cleanName = cleanName.replace(/^\d{3,10}\s*[-_\s|:]*\s*/, '').trim();
        if (!cleanName || HEADER_NOISE.some((h) => cleanName.toLowerCase() === h)) {
          cleanName = phoneDigits ? `Aluno (${phoneDigits.slice(0, 2)})` : `Aluno ${index + 1}`;
        }

        let cleanCourse = (c.curso || '').toString().trim();
        if (/va[lo0]r\s*[=\:]/i.test(cleanCourse) || HEADER_NOISE.some((h) => cleanCourse.toLowerCase() === h)) {
          cleanCourse = 'Concursos Gerais';
        }

        let temp: 'Quente' | 'Morno' | 'Frio' | 'Pagou' = 'Morno';
        if (c.temperatura) {
          const tempStr = c.temperatura.toString().toLowerCase();
          if (tempStr.includes('pago') || tempStr.includes('matriculado')) temp = 'Pagou';
          else if (tempStr.includes('quent') || tempStr.includes('alt') || tempStr.includes('hot')) temp = 'Quente';
          else if (tempStr.includes('fri') || tempStr.includes('baix') || tempStr.includes('cold')) temp = 'Frio';
        }

        return {
          id: 'ai_imp_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 6),
          nome: cleanName,
          whatsapp: phoneDigits,
          email: (c.email || '').trim().toLowerCase(),
          curso: cleanCourse || 'Concursos Gerais',
          temperatura: temp,
          status: 'Novo Lead',
          observacao: c.observacao || (c.valorPago ? `Valor pago: R$ ${Number(c.valorPago).toFixed(2)}` : ''),
          valorPago: typeof c.valorPago === 'number' ? c.valorPago : undefined,
          criadoEm: new Date().toISOString(),
        };
      });

    return res.status(200).json({
      contacts: sanitizedContacts,
      totalDetected: sanitizedContacts.length,
      summary: parsedData.summary || `${sanitizedContacts.length} contatos identificados e estruturados com sucesso.`,
    });
  } catch (error: any) {
    console.error('Error in /api/extract-contacts handler:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao processar imagem ou documento com IA Gemini.',
    });
  }
}

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const { message, history = [], context = {} } = req.body || {};
    const ai = getGemini();

    if (!ai) {
      return res.json({
        response:
          'Olá! Para ativar respostas em tempo real pela IA do Google Gemini, adicione a variável GEMINI_API_KEY no painel da Vercel (Settings > Environment Variables).',
        source: 'local_fallback',
      });
    }

    const systemInstruction = `Você é o "Assistente IA Especialista em Vendas & Atendimento do Portal Concurso".
Sua missão é ajudar o atendente/consultor comercial a converter contatos de alunos de concursos públicos para as Assinaturas do Portal Concurso.
${context.currentContact ? `- Aluno em foco: Nome: ${context.currentContact.nome}, Curso: ${context.currentContact.curso}` : ''}`;

    const formattedContents: Array<any> = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item.role === 'user' || item.role === 'model') {
          formattedContents.push({ role: item.role, parts: [{ text: item.text }] });
        }
      }
    }
    formattedContents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: formattedContents,
      config: { systemInstruction, temperature: 0.7 },
    });

    return res.json({ response: response.text || 'Sem resposta.', source: 'gemini' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

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
    const { contact, objection, plan, goal = 'fechamento' } = req.body || {};
    const ai = getGemini();

    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY não configurada na Vercel.' });
    }

    const prompt = `Crie uma mensagem ultra persuasiva, calorosa e elegante para WhatsApp direcionada ao seguinte aluno de concurso:
- Nome do Aluno: ${contact?.nome || 'Aluno'}
- Concurso/Curso de Interesse: ${contact?.curso || 'Concursos Públicos'}
- Objeção: ${objection?.objecao || 'Dúvida geral'}
- Plano: ${plan?.nome || 'Assinatura Premium 1.0'}
- Objetivo: ${goal}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Você é um consultor de vendas do Portal Concurso.',
        temperature: 0.7,
      },
    });

    return res.json({ pitch: response.text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

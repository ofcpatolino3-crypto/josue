import sgMail from '@sendgrid/mail';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

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
    } = req.body || {};

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

    sgMail.setApiKey(apiKey);

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

    const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

      const paragraphs = personalizedBody
        .split('\n\n')
        .map((p: string) => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

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
                  <tr>
                    <td style="background-color: #0f172a; padding: 24px 32px; text-align: left;">
                      <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                        PORTAL <span style="color: #34d399;">CONCURSOS</span>
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px; font-size: 16px; color: #334155;">
                      ${paragraphs}
                      ${ctaHtml}
                    </td>
                  </tr>
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
      } catch (err: any) {
        failedCount++;
        const errorMessage =
          err?.response?.body?.errors?.[0]?.message || err?.message || 'Falha no envio';
        results.push({
          id: contact.id || '',
          email: rawEmail,
          nome: contact.nome || 'Aluno',
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    return res.status(200).json({
      success: true,
      sentCount,
      failedCount,
      skippedCount,
      total: contacts.length,
      results,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro interno ao processar disparo.' });
  }
}

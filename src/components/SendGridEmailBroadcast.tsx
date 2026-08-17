import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Check,
  Users,
  Filter,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  CheckSquare,
  Square,
  Key,
  MessageSquare,
  MessageCircle,
  Phone,
  Link2,
  StopCircle,
  Shield,
  UserCheck,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { Contact, MessageTemplate } from '../types';
import { todayStr, formatDateBR } from '../utils/excel';

interface SendGridEmailBroadcastProps {
  contacts: Contact[];
  templates: MessageTemplate[];
  onMarkContacted?: (id: string) => void;
  onMarkEmailContacted?: (id: string, emailSubject?: string) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const SendGridEmailBroadcast: React.FC<SendGridEmailBroadcastProps> = ({
  contacts,
  templates,
  onMarkContacted,
  onMarkEmailContacted,
  onToast,
}) => {
  // SendGrid Status
  const [sendGridStatus, setSendGridStatus] = useState<{
    configured: boolean;
    hasFromEmail: boolean;
    fromEmail: string | null;
    loading: boolean;
  }>({
    configured: false,
    hasFromEmail: false,
    fromEmail: null,
    loading: true,
  });

  // Filters & Deduplication States
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [tempFilter, setTempFilter] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [onlyPending, setOnlyPending] = useState<boolean>(false);
  const [emailStatusFilter, setEmailStatusFilter] = useState<'all' | 'uncontacted' | 'contacted' | 'uncontacted_today'>('all');
  const [avoidDuplicates, setAvoidDuplicates] = useState<boolean>(() => {
    return localStorage.getItem('portal_sendgrid_dedup') !== 'false';
  });
  const [showRecipientDrawer, setShowRecipientDrawer] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Email Content
  const [subject, setSubject] = useState<string>(
    '🎯 Oportunidade Exclusiva: Condição Especial para o Concurso {curso} - Portal Concursos'
  );
  const [body, setBody] = useState<string>(
    `Olá {primeiro_nome}, tudo bem?

Identificamos o seu interesse no curso preparatório para {curso}.

Temos uma excelente notícia: liberamos uma condição especial com desconto exclusivo na Assinatura Anual do Portal Concursos para você continuar seus estudos com foco total.

Com a assinatura, você tem acesso a mais de 180.000 questões comentadas, cronogramas atualizados e simulados para todas as carreiras.

Clique no botão abaixo para falar diretamente com nosso suporte no WhatsApp e garantir sua condição!`
  );

  const [fromName, setFromName] = useState<string>('Portal Concursos');
  const [fromEmail, setFromEmail] = useState<string>('');
  
  // CTA & WhatsApp Button Configuration
  const [includeCta, setIncludeCta] = useState<boolean>(true);
  const [ctaMode, setCtaMode] = useState<'whatsapp' | 'custom_link'>('whatsapp');
  const [waPhoneNumber, setWaPhoneNumber] = useState<string>('55');
  const [waMessage, setWaMessage] = useState<string>(
    'Olá! Vi o e-mail do Portal Concursos sobre {curso} e gostaria de saber mais sobre a oferta.'
  );
  const [ctaText, setCtaText] = useState<string>('🟢 Falar no WhatsApp com o Consultor');
  const [ctaLink, setCtaLink] = useState<string>('https://portalconcurso.com.br');

  // Dispatch Queue Execution State
  const [isSending, setIsSending] = useState<boolean>(false);
  const stopSendingRef = useRef<boolean>(false);
  const [sendProgress, setSendProgress] = useState<{
    processed: number;
    total: number;
    percent: number;
    currentName: string;
    currentEmail: string;
    sent: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const [dispatchResults, setDispatchResults] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    total: number;
    logs: Array<{ id: string; email: string; nome: string; status: string; error?: string }>;
  } | null>(null);

  const [copiedBcc, setCopiedBcc] = useState<boolean>(false);
  const [showConfigGuide, setShowConfigGuide] = useState<boolean>(false);

  const [directApiKey, setDirectApiKey] = useState<string>(() => {
    return localStorage.getItem('portal_sendgrid_custom_key') || '';
  });
  const [directFromEmail, setDirectFromEmail] = useState<string>(() => {
    return localStorage.getItem('portal_sendgrid_custom_from') || '';
  });

  // Check backend SendGrid status
  const checkStatus = async () => {
    try {
      setSendGridStatus((prev) => ({ ...prev, loading: true }));
      const res = await fetch('/api/email/status');
      const savedKey = localStorage.getItem('portal_sendgrid_custom_key');
      const savedFrom = localStorage.getItem('portal_sendgrid_custom_from');

      if (res.ok) {
        const data = await res.json();
        const isConfigured = !!data.configured || !!(savedKey && savedKey.startsWith('SG.'));
        const effectiveFrom = data.fromEmail || savedFrom || null;

        setSendGridStatus({
          configured: isConfigured,
          hasFromEmail: !!effectiveFrom,
          fromEmail: effectiveFrom,
          loading: false,
        });

        if (effectiveFrom && !fromEmail) {
          setFromEmail(effectiveFrom);
        }
      } else {
        const isConfigured = !!(savedKey && savedKey.startsWith('SG.'));
        setSendGridStatus({
          configured: isConfigured,
          hasFromEmail: !!savedFrom,
          fromEmail: savedFrom || null,
          loading: false,
        });
      }
    } catch (e) {
      const savedKey = localStorage.getItem('portal_sendgrid_custom_key');
      const savedFrom = localStorage.getItem('portal_sendgrid_custom_from');
      setSendGridStatus({
        configured: !!(savedKey && savedKey.startsWith('SG.')),
        hasFromEmail: !!savedFrom,
        fromEmail: savedFrom || null,
        loading: false,
      });
    }
  };

  const handleSaveDirectKey = () => {
    const trimmedKey = directApiKey.trim();
    const trimmedEmail = directFromEmail.trim();

    if (trimmedKey && !trimmedKey.startsWith('SG.')) {
      onToast('A chave do SendGrid deve começar com "SG."', 'error');
      return;
    }

    if (trimmedKey) {
      localStorage.setItem('portal_sendgrid_custom_key', trimmedKey);
    } else {
      localStorage.removeItem('portal_sendgrid_custom_key');
    }

    if (trimmedEmail) {
      localStorage.setItem('portal_sendgrid_custom_from', trimmedEmail);
      setFromEmail(trimmedEmail);
    } else {
      localStorage.removeItem('portal_sendgrid_custom_from');
    }

    onToast('Configurações do SendGrid salvas com sucesso!', 'success');
    checkStatus();
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Test Email State
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [testEmailAddress, setTestEmailAddress] = useState<string>(() => {
    return localStorage.getItem('portal_last_test_email') || 'ofcpatolino3@gmail.com';
  });
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  // Filter contacts with emails
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 1. Raw filtered contacts before deduplication
  const rawFilteredContacts = useMemo(() => {
    const today = todayStr();
    return contacts.filter((c) => {
      const emailValid = c.email && validEmailRegex.test(c.email.trim());
      if (!emailValid) return false;
      if (courseFilter && c.curso !== courseFilter) return false;
      if (tempFilter && c.temperatura !== tempFilter) return false;
      if (batchFilter && c.batchName !== batchFilter) return false;

      // Status do E-mail
      if (emailStatusFilter === 'uncontacted' && c.lastEmailSentAt) return false;
      if (emailStatusFilter === 'contacted' && !c.lastEmailSentAt) return false;
      if (emailStatusFilter === 'uncontacted_today' && (c.ultimoContato === today || c.dataContato === today)) return false;

      if (onlyPending && (c.ultimoContato === today || c.dataContato === today)) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = (c.nome || '').toLowerCase().includes(q);
        const matchEmail = (c.email || '').toLowerCase().includes(q);
        const matchCourse = (c.curso || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCourse) return false;
      }
      return true;
    });
  }, [contacts, courseFilter, tempFilter, batchFilter, emailStatusFilter, onlyPending, search]);

  // 2. Global and filtered duplicate stats
  const duplicateStats = useMemo(() => {
    const emailCounts = new Map<string, number>();
    rawFilteredContacts.forEach((c) => {
      const emailKey = (c.email || '').trim().toLowerCase();
      emailCounts.set(emailKey, (emailCounts.get(emailKey) || 0) + 1);
    });

    let duplicateEntriesCount = 0;
    emailCounts.forEach((count) => {
      if (count > 1) {
        duplicateEntriesCount += count - 1;
      }
    });

    // Counts for email statuses
    let uncontactedCount = 0;
    let contactedCount = 0;
    rawFilteredContacts.forEach((c) => {
      if (c.lastEmailSentAt) contactedCount++;
      else uncontactedCount++;
    });

    return {
      emailCounts,
      duplicateEntriesCount,
      uniqueEmailsCount: emailCounts.size,
      totalRaw: rawFilteredContacts.length,
      uncontactedCount,
      contactedCount,
    };
  }, [rawFilteredContacts]);

  // 3. Contacts list with deduplication applied
  const contactsWithEmail = useMemo(() => {
    if (!avoidDuplicates) {
      return rawFilteredContacts;
    }
    const seen = new Set<string>();
    const deduplicated: Contact[] = [];

    for (const c of rawFilteredContacts) {
      const emailKey = (c.email || '').trim().toLowerCase();
      if (!seen.has(emailKey)) {
        seen.add(emailKey);
        deduplicated.push(c);
      }
    }
    return deduplicated;
  }, [rawFilteredContacts, avoidDuplicates]);

  // Target contacts based on explicit selection or all filtered
  const targetContacts = useMemo(() => {
    if (selectedIds.length === 0) return contactsWithEmail;
    return contactsWithEmail.filter((c) => selectedIds.includes(c.id));
  }, [contactsWithEmail, selectedIds]);

  const uniqueCourses = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.curso) set.add(c.curso);
    });
    return Array.from(set);
  }, [contacts]);

  const uniqueBatches = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.batchName) set.add(c.batchName);
    });
    return Array.from(set);
  }, [contacts]);

  const handleToggleDeduplication = () => {
    const nextVal = !avoidDuplicates;
    setAvoidDuplicates(nextVal);
    localStorage.setItem('portal_sendgrid_dedup', String(nextVal));
    if (nextVal) {
      onToast('🛡️ Anti-Duplicação ATIVADA: Apenas 1 envio por endereço de e-mail!', 'success');
    } else {
      onToast('⚠️ Anti-Duplicação DESATIVADA: E-mails repetidos poderão receber cópias.', 'info');
    }
  };

  const handleSelectFirst100 = () => {
    const first100 = contactsWithEmail.slice(0, 100).map((c) => c.id);
    setSelectedIds(first100);
    onToast(`🎯 Primeiros ${first100.length} contatos selecionados!`, 'info');
  };

  const handleSelectVirgins = () => {
    const virgins = contactsWithEmail.filter((c) => !c.lastEmailSentAt).map((c) => c.id);
    if (virgins.length === 0) {
      onToast('Todos os contatos listados já receberam e-mail.', 'info');
      return;
    }
    setSelectedIds(virgins);
    onToast(`🆕 ${virgins.length} alunos que NUNCA receberam e-mail foram selecionados!`, 'success');
  };

  const handleDeselectAlreadyContacted = () => {
    const uncontacted = contactsWithEmail.filter((c) => !c.lastEmailSentAt).map((c) => c.id);
    setSelectedIds(uncontacted);
    onToast(`🧹 Contatos já contatados por e-mail foram desmarcados (${uncontacted.length} restantes).`, 'info');
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIds(contactsWithEmail.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleContact = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.length === 0) {
        return contactsWithEmail.filter((c) => c.id !== id).map((c) => c.id);
      }
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const insertVariable = (variableName: string, targetField: 'subject' | 'body') => {
    if (targetField === 'subject') {
      setSubject((prev) => prev + ` {${variableName}}`);
    } else {
      setBody((prev) => prev + ` {${variableName}}`);
    }
    onToast(`Tag {${variableName}} inserida!`, 'info');
  };

  // Build computed CTA link based on mode
  const effectiveCtaLink = useMemo(() => {
    if (!includeCta) return '';
    if (ctaMode === 'whatsapp') {
      const cleanNumber = waPhoneNumber.replace(/\D/g, '');
      const validPhone = cleanNumber.startsWith('55') ? cleanNumber : cleanNumber ? `55${cleanNumber}` : '55';
      const encodedMsg = encodeURIComponent(waMessage);
      return `https://wa.me/${validPhone}?text=${encodedMsg}`;
    }
    return ctaLink.trim();
  }, [includeCta, ctaMode, waPhoneNumber, waMessage, ctaLink]);

  // Preview data using the first selected contact
  const previewContact = targetContacts[0] || {
    id: 'preview',
    nome: 'Carlos Eduardo Oliveira',
    whatsapp: '11987654321',
    email: 'carlos.oliveira@email.com',
    curso: 'Polícia Federal - Agente',
    temperatura: 'Quente',
    status: 'Interessado na Assinatura',
    observacao: 'Fez isolada de Penal',
  };

  const previewFirstName = (previewContact.nome || 'Aluno').split(' ')[0];

  const processedPreviewSubject = subject
    .replace(/{nome}/gi, previewContact.nome || 'Aluno')
    .replace(/{primeiro_nome}/gi, previewFirstName)
    .replace(/{primeironome}/gi, previewFirstName)
    .replace(/{curso}/gi, previewContact.curso || 'Concursos')
    .replace(/{whatsapp}/gi, previewContact.whatsapp || '')
    .replace(/{email}/gi, previewContact.email || '');

  const processedPreviewBody = body
    .replace(/{nome}/gi, previewContact.nome || 'Aluno')
    .replace(/{primeiro_nome}/gi, previewFirstName)
    .replace(/{primeironome}/gi, previewFirstName)
    .replace(/{curso}/gi, previewContact.curso || 'Concursos')
    .replace(/{whatsapp}/gi, previewContact.whatsapp || '')
    .replace(/{email}/gi, previewContact.email || '');

  const processedPreviewCtaLink = effectiveCtaLink
    .replace(/{nome}/gi, previewContact.nome || 'Aluno')
    .replace(/{primeiro_nome}/gi, previewFirstName)
    .replace(/{primeironome}/gi, previewFirstName)
    .replace(/{curso}/gi, previewContact.curso || 'Concursos');

  // Stop active dispatch
  const handleStopSending = () => {
    stopSendingRef.current = true;
    onToast('🛑 Parando envio em lote...', 'info');
  };

  // Send single instant test email
  const handleSendSingleTestEmail = async () => {
    const trimmedEmail = testEmailAddress.trim();
    if (!trimmedEmail || !validEmailRegex.test(trimmedEmail)) {
      onToast('Digite um e-mail válido para o teste.', 'error');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      onToast('Por favor, preencha o assunto e o texto da mensagem antes de testar.', 'error');
      return;
    }

    setIsSendingTest(true);
    localStorage.setItem('portal_last_test_email', trimmedEmail);
    onToast(`🧪 Enviando e-mail de teste para ${trimmedEmail}...`, 'info');

    try {
      const savedCustomKey = localStorage.getItem('portal_sendgrid_custom_key');
      const testContact = {
        id: 'test-user',
        nome: 'Josué (Teste)',
        email: trimmedEmail,
        curso: previewContact.curso || 'Concurso Polícia Militar',
        whatsapp: waPhoneNumber || '11999999999',
      };

      const payload = {
        contacts: [testContact],
        subjectTemplate: `[TESTE] ${subject}`,
        bodyTemplate: body,
        fromEmailCustom: fromEmail || sendGridStatus.fromEmail || undefined,
        fromNameCustom: fromName,
        ctaLink: includeCta && effectiveCtaLink ? effectiveCtaLink : undefined,
        ctaText: includeCta && ctaText.trim() ? ctaText.trim() : undefined,
        customApiKey: savedCustomKey || undefined,
      };

      const response = await fetch('/api/email/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        data = { error: `Erro na resposta do servidor (${response.status})` };
      }

      if (!response.ok) {
        if (data?.code === 'SENDGRID_KEY_MISSING') {
          setShowConfigGuide(true);
          onToast('⚠️ Chave do SendGrid ausente. Cole sua chave no painel!', 'error');
        } else {
          onToast(data?.error || `Falha no envio de teste (HTTP ${response.status})`, 'error');
        }
      } else if (data.sentCount > 0) {
        onToast(`✅ E-mail de teste enviado com sucesso para ${trimmedEmail}! Olhe na sua Caixa de Entrada / Spam.`, 'success');
        setShowTestModal(false);
      } else {
        const errDetail = data.results?.[0]?.error || 'Erro desconhecido';
        onToast(`Falha ao entregar teste: ${errDetail}`, 'error');
      }
    } catch (err) {
      console.error('Test email error:', err);
      onToast('Erro de conexão ao enviar e-mail de teste.', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  // 1-Click Mass Dispatch via SendGrid API with Real-time Chunking & Progress Bar
  const handleExecuteBatchSend = async () => {
    if (targetContacts.length === 0) {
      onToast('Nenhum contato selecionado com e-mail válido.', 'error');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      onToast('Por favor, defina o assunto e a mensagem do e-mail.', 'error');
      return;
    }

    if (includeCta && ctaMode === 'whatsapp') {
      const cleanPhone = waPhoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        onToast('Por favor, digite o número do seu WhatsApp com DDD para o botão.', 'error');
        return;
      }
    }

    const confirmMsg = `Confirma o disparo de e-mails para ${targetContacts.length} contato(s) via SendGrid?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSending(true);
    stopSendingRef.current = false;
    setDispatchResults(null);

    const totalContacts = targetContacts.length;
    setSendProgress({
      processed: 0,
      total: totalContacts,
      percent: 0,
      currentName: targetContacts[0]?.nome || 'Iniciando...',
      currentEmail: targetContacts[0]?.email || '',
      sent: 0,
      failed: 0,
      skipped: 0,
    });

    onToast(`🚀 Iniciando disparo progressivo para ${totalContacts} contatos...`, 'info');

    const savedCustomKey = localStorage.getItem('portal_sendgrid_custom_key');
    const CHUNK_SIZE = 3; // Send in micro-batches of 3 for fast response & smooth real-time progress
    let accumulatedSent = 0;
    let accumulatedFailed = 0;
    let accumulatedSkipped = 0;
    const accumulatedLogs: Array<{ id: string; email: string; nome: string; status: string; error?: string }> = [];

    try {
      for (let i = 0; i < totalContacts; i += CHUNK_SIZE) {
        if (stopSendingRef.current) {
          onToast('Envio interrompido pelo usuário.', 'info');
          break;
        }

        const chunk = targetContacts.slice(i, i + CHUNK_SIZE);
        const currentContact = chunk[0];

        setSendProgress({
          processed: i,
          total: totalContacts,
          percent: Math.round((i / totalContacts) * 100),
          currentName: currentContact?.nome || 'Processando...',
          currentEmail: currentContact?.email || '',
          sent: accumulatedSent,
          failed: accumulatedFailed,
          skipped: accumulatedSkipped,
        });

        const payload = {
          contacts: chunk,
          subjectTemplate: subject,
          bodyTemplate: body,
          fromEmailCustom: fromEmail || sendGridStatus.fromEmail || undefined,
          fromNameCustom: fromName,
          ctaLink: includeCta && effectiveCtaLink ? effectiveCtaLink : undefined,
          ctaText: includeCta && ctaText.trim() ? ctaText.trim() : undefined,
          customApiKey: savedCustomKey || undefined,
        };

        try {
          const response = await fetch('/api/email/send-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          let data: any = null;
          try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
          } catch (parseErr) {
            data = { error: `Resposta inválida do servidor (${response.status})` };
          }

          if (!response.ok) {
            if (data?.code === 'SENDGRID_KEY_MISSING') {
              setShowConfigGuide(true);
              onToast(
                '⚠️ Chave do SendGrid não configurada. Cole sua chave no painel acima!',
                'error'
              );
              break;
            }
            // Mark this chunk as failed and keep going
            chunk.forEach((c) => {
              accumulatedFailed++;
              accumulatedLogs.push({
                id: c.id,
                email: c.email || '',
                nome: c.nome,
                status: 'failed',
                error: data?.error || `Erro HTTP ${response.status}`,
              });
            });
          } else {
            const chunkSent = data.sentCount || 0;
            const chunkFailed = data.failedCount || 0;
            const chunkSkipped = data.skippedCount || 0;
            const chunkResults = data.results || [];

            accumulatedSent += chunkSent;
            accumulatedFailed += chunkFailed;
            accumulatedSkipped += chunkSkipped;
            accumulatedLogs.push(...chunkResults);

            // Mark contacted in CRM
            if (Array.isArray(chunkResults)) {
              chunkResults.forEach((r: any) => {
                if (r.status === 'sent' && r.id) {
                  if (onMarkEmailContacted) {
                    onMarkEmailContacted(r.id, subject);
                  } else if (onMarkContacted) {
                    onMarkContacted(r.id);
                  }
                }
              });
            }
          }
        } catch (fetchErr: any) {
          chunk.forEach((c) => {
            accumulatedFailed++;
            accumulatedLogs.push({
              id: c.id,
              email: c.email || '',
              nome: c.nome,
              status: 'failed',
              error: 'Erro de conexão/timeout',
            });
          });
        }

        const currentProcessed = Math.min(i + chunk.length, totalContacts);
        setSendProgress({
          processed: currentProcessed,
          total: totalContacts,
          percent: Math.round((currentProcessed / totalContacts) * 100),
          currentName: chunk[chunk.length - 1]?.nome || '',
          currentEmail: chunk[chunk.length - 1]?.email || '',
          sent: accumulatedSent,
          failed: accumulatedFailed,
          skipped: accumulatedSkipped,
        });

        // Small delay between micro-chunks for smooth rate limiting
        if (i + CHUNK_SIZE < totalContacts && !stopSendingRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      setDispatchResults({
        sent: accumulatedSent,
        failed: accumulatedFailed,
        skipped: accumulatedSkipped,
        total: totalContacts,
        logs: accumulatedLogs,
      });

      if (accumulatedSent > 0) {
        onToast(
          `🎉 Disparo concluído! ${accumulatedSent} de ${totalContacts} e-mails entregues com sucesso!`,
          'success'
        );
      } else if (accumulatedFailed > 0) {
        onToast(`Falha no envio de ${accumulatedFailed} e-mails. Verifique as credenciais.`, 'error');
      }
    } catch (err: any) {
      console.error('Batch email error:', err);
      onToast('Erro durante o processamento do envio.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Copy 100 emails in BCC/CCO
  const handleCopyBccList = () => {
    if (targetContacts.length === 0) {
      onToast('Nenhum e-mail disponível para cópia.', 'error');
      return;
    }

    const emailList = targetContacts
      .map((c) => c.email?.trim())
      .filter((e) => e && validEmailRegex.test(e))
      .join(', ');

    navigator.clipboard.writeText(emailList);
    setCopiedBcc(true);
    onToast(
      `📋 ${targetContacts.length} e-mails copiados para a área de transferência! Cole no campo CCO do seu Gmail/Outlook.`,
      'success'
    );
    setTimeout(() => setCopiedBcc(false), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* SendGrid Status & Info Banner */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-serif text-[#EDE6D6]">
                  Disparo de E-mails em Massa (SendGrid API)
                </h3>
                {sendGridStatus.loading ? (
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Verificando...
                  </span>
                ) : sendGridStatus.configured ? (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> SendGrid Conectado
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400" /> Chave API Pendente
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8C98B4] mt-1">
                Dispare 100+ e-mails personalizados de uma só vez direto para a caixa de entrada dos alunos com alta taxa de entrega.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-3.5 py-2 rounded-lg border border-blue-400/40 flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105"
            >
              <span>🧪</span>
              <span>Enviar Teste para Mim</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfigGuide(!showConfigGuide)}
              className="text-xs bg-[#101B2D] hover:bg-[#1F3057] text-[#C9A227] px-3 py-2 rounded-lg border border-[#2B3D63] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{showConfigGuide ? 'Ocultar Instruções' : 'Como Configurar a Chave'}</span>
            </button>

            <button
              type="button"
              onClick={checkStatus}
              className="text-xs bg-[#101B2D] hover:bg-[#1F3057] text-[#8C98B4] hover:text-[#EDE6D6] p-2 rounded-lg border border-[#2B3D63] transition-colors cursor-pointer"
              title="Recarregar status da conexão"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sendGridStatus.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Configuration Guide & Direct Key Input Dropdown */}
        {showConfigGuide && (
          <div className="mt-4 pt-4 border-t border-[#2B3D63] bg-[#101B2D] p-4 rounded-lg text-xs space-y-4">
            {/* Direct Key Activation Input Box */}
            <div className="bg-[#172644] p-3.5 rounded-lg border border-[#C9A227]/40 space-y-3">
              <div className="flex items-center gap-2 text-[#C9A227] font-bold">
                <Key className="w-4 h-4" />
                <span>Colar Chave do SendGrid Diretamente no Painel (Ativação Instantânea)</span>
              </div>
              <p className="text-[#8C98B4] text-[11px]">
                Você pode colar sua chave diretamente aqui para ativar na hora sem precisar de variáveis de ambiente.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#EDE6D6] font-semibold mb-1">
                    Chave de API (Começa com SG.)
                  </label>
                  <input
                    type="password"
                    value={directApiKey}
                    onChange={(e) => setDirectApiKey(e.target.value)}
                    placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxx..."
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded px-3 py-2 text-[#EDE6D6] font-mono focus:outline-none focus:border-[#C9A227]"
                  />
                </div>

                <div>
                  <label className="block text-[#EDE6D6] font-semibold mb-1">
                    E-mail do Remetente (Verificado no SendGrid)
                  </label>
                  <input
                    type="email"
                    value={directFromEmail}
                    onChange={(e) => setDirectFromEmail(e.target.value)}
                    placeholder="ofcpatolino3@gmail.com"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded px-3 py-2 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[#8C98B4]">
                  🔒 A chave fica salva de forma segura na sua sessão local.
                </span>
                <button
                  type="button"
                  onClick={handleSaveDirectKey}
                  className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-4 py-1.5 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Salvar e Ativar Chave</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#EDE6D6] font-bold pt-1">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Como pegar sua chave no SendGrid:</span>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-[#CBD5E1] leading-relaxed">
              <li>
                <strong className="text-white">Criar API Key no SendGrid:</strong> Acesse seu painel no SendGrid → menu lateral esquerdo em <em>Settings</em> → <em>API Keys</em> → clique em <em>Create API Key</em> (Dê permissão "Full Access" ou "Mail Send").
              </li>
              <li>
                <strong className="text-white">Copiar a Chave:</strong> Copie a chave gerada (ela começa com <code className="bg-black/40 text-emerald-400 px-1 py-0.5 rounded font-mono">SG.xxxxxxxx...</code>).
              </li>
              <li>
                <strong className="text-white">Verificar Remetente (Single Sender):</strong> No SendGrid, vá em <em>Settings</em> → <em>Sender Authentication</em> → <em>Verify a Single Sender</em> e cadastre o e-mail de remetente (ex: <code className="text-blue-300">ofcpatolino3@gmail.com</code>).
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Main Grid: Builder & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Settings, Filter & Message Builder (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Contact Selection & Filters with Anti-Duplication & Email Contact Status */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C9A227]" />
                <h4 className="font-bold text-[#EDE6D6] text-sm">
                  1. Destinatários Selecionados ({targetContacts.length})
                </h4>
              </div>

              {/* Quick Selection Actions */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectFirst100}
                  className="bg-[#101B2D] hover:bg-[#1F3057] text-[#C9A227] font-semibold text-xs px-2.5 py-1 rounded border border-[#2B3D63] transition-colors cursor-pointer"
                  title="Seleciona os primeiros 100 contatos com e-mail válido"
                >
                  ⚡ 100 Primeiros
                </button>
                <button
                  type="button"
                  onClick={handleSelectVirgins}
                  className="bg-[#101B2D] hover:bg-[#1F3057] text-emerald-400 font-semibold text-xs px-2.5 py-1 rounded border border-[#2B3D63] transition-colors cursor-pointer"
                  title="Seleciona apenas alunos que nunca receberam nenhum e-mail"
                >
                  🆕 Apenas Virgens
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAlreadyContacted}
                  className="bg-[#101B2D] hover:bg-[#1F3057] text-blue-300 font-semibold text-xs px-2.5 py-1 rounded border border-[#2B3D63] transition-colors cursor-pointer"
                  title="Remove da seleção quem já recebeu e-mail anteriormente"
                >
                  🧹 Desmarcar Contatados
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(selectedIds.length !== contactsWithEmail.length)}
                  className="text-xs text-[#8C98B4] hover:text-[#EDE6D6] px-2 py-1 rounded hover:bg-[#101B2D] transition-colors cursor-pointer"
                >
                  {selectedIds.length === contactsWithEmail.length && selectedIds.length > 0
                    ? 'Desmarcar Todos'
                    : 'Marcar Todos'}
                </button>
              </div>
            </div>

            {/* Anti-Duplication Feature Banner */}
            <div className={`p-3 rounded-lg border transition-all ${
              avoidDuplicates
                ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-600/40 text-amber-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2">
                  {avoidDuplicates ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold flex items-center gap-2">
                      <span>Filtro Anti-Duplicação de E-mails</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        avoidDuplicates
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {avoidDuplicates ? '✓ ATIVADO (1 envio por e-mail)' : 'DESATIVADO'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C98B4] mt-0.5">
                      {avoidDuplicates
                        ? 'Garante que o mesmo endereço de e-mail não receba mensagens repetidas no mesmo disparo.'
                        : 'Permite múltiplos envios se o mesmo e-mail estiver cadastrado em contatos diferentes.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleDeduplication}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    avoidDuplicates
                      ? 'bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border-emerald-500/50'
                      : 'bg-amber-900/60 hover:bg-amber-800/80 text-amber-200 border-amber-500/50'
                  }`}
                >
                  {avoidDuplicates ? 'Desativar Anti-Duplicação' : 'Ativar Anti-Duplicação'}
                </button>
              </div>

              {/* Duplicates Notification Badge if detected */}
              {duplicateStats.duplicateEntriesCount > 0 && (
                <div className="mt-2 pt-2 border-t border-[#2B3D63]/50 flex items-center justify-between text-[11px]">
                  <span className="text-[#8C98B4]">
                    Identificados <strong>{duplicateStats.duplicateEntriesCount}</strong> e-mails duplicados na base selecionada.
                  </span>
                  <span className={`font-semibold ${avoidDuplicates ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {avoidDuplicates
                      ? `🛡️ ${duplicateStats.duplicateEntriesCount} duplicatas filtradas com sucesso!`
                      : `⚠️ ${duplicateStats.duplicateEntriesCount} duplicatas serão enviadas.`}
                  </span>
                </div>
              )}
            </div>

            {/* Email Status Filter Tabs */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4]">
                Filtrar por Histórico de Contato via E-mail:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEmailStatusFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                    emailStatusFilter === 'all'
                      ? 'bg-[#C9A227] text-[#101B2D] border-[#C9A227] font-bold shadow-sm'
                      : 'bg-[#101B2D] text-[#EDE6D6] border-[#2B3D63] hover:border-[#C9A227]/60'
                  }`}
                >
                  Todos ({duplicateStats.totalRaw})
                </button>

                <button
                  type="button"
                  onClick={() => setEmailStatusFilter('uncontacted')}
                  className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                    emailStatusFilter === 'uncontacted'
                      ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-sm'
                      : 'bg-[#101B2D] text-emerald-300 border-[#2B3D63] hover:border-emerald-500/60'
                  }`}
                >
                  🆕 Nunca Contatados ({duplicateStats.uncontactedCount})
                </button>

                <button
                  type="button"
                  onClick={() => setEmailStatusFilter('contacted')}
                  className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                    emailStatusFilter === 'contacted'
                      ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-sm'
                      : 'bg-[#101B2D] text-blue-300 border-[#2B3D63] hover:border-blue-500/60'
                  }`}
                >
                  ✉️ Já Contatados ({duplicateStats.contactedCount})
                </button>

                <button
                  type="button"
                  onClick={() => setEmailStatusFilter('uncontacted_today')}
                  className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                    emailStatusFilter === 'uncontacted_today'
                      ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-sm'
                      : 'bg-[#101B2D] text-purple-300 border-[#2B3D63] hover:border-purple-500/60'
                  }`}
                >
                  ⏳ Não Hoje
                </button>
              </div>
            </div>

            {/* General Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="bg-[#101B2D] border border-[#2B3D63] rounded-lg px-2.5 py-1.5 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
              >
                <option value="">Todos os Cursos ({uniqueCourses.length})</option>
                {uniqueCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={tempFilter}
                onChange={(e) => setTempFilter(e.target.value)}
                className="bg-[#101B2D] border border-[#2B3D63] rounded-lg px-2.5 py-1.5 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
              >
                <option value="">Todas Temperaturas</option>
                <option value="Quente">🔥 Quente</option>
                <option value="Potencial">⚡ Potencial</option>
                <option value="Morno">☕ Morno</option>
                <option value="Pagou">💰 Pagou</option>
                <option value="Frio">❄️ Frio</option>
              </select>

              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#101B2D] border border-[#2B3D63] rounded-lg px-2.5 py-1.5 text-[#EDE6D6] placeholder-[#8C98B4] focus:outline-none focus:border-[#C9A227]"
              />
            </div>

            {/* Contact count summary & Drawer Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-[#101B2D] px-3.5 py-2.5 rounded-lg border border-[#2B3D63]/70">
              <div className="flex items-center gap-2 text-[#8C98B4] flex-wrap">
                <span>Total pós-filtro:</span>
                <strong className="text-[#EDE6D6]">{contactsWithEmail.length} alunos</strong>
                {avoidDuplicates && duplicateStats.duplicateEntriesCount > 0 && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                    ({duplicateStats.duplicateEntriesCount} duplicatas excluídas)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecipientDrawer((prev) => !prev)}
                  className="text-xs bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#C9A227] px-2.5 py-1 rounded border border-[#2B3D63] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#C9A227]" />
                  <span>{showRecipientDrawer ? 'Ocultar Detalhes' : 'Inspecionar Lista'}</span>
                  {showRecipientDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <span className="font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-1 rounded text-[11px]">
                  {targetContacts.length} prontos para disparo
                </span>
              </div>
            </div>

            {/* Collapsible Recipient Inspector Drawer */}
            {showRecipientDrawer && (
              <div className="bg-[#101B2D] border border-[#2B3D63] rounded-lg p-3 space-y-2 animate-fadeIn max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-[#2B3D63] text-xs">
                  <span className="font-semibold text-[#EDE6D6] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#C9A227]" />
                    Lista Individual de Destinatários ({contactsWithEmail.length})
                  </span>
                  <span className="text-[11px] text-[#8C98B4]">
                    Clique na caixa para incluir/remover do envio
                  </span>
                </div>

                <div className="divide-y divide-[#2B3D63]/50 text-xs">
                  {contactsWithEmail.map((c) => {
                    const isSelected = selectedIds.length === 0 || selectedIds.includes(c.id);
                    const emailOccurrences = duplicateStats.emailCounts.get((c.email || '').trim().toLowerCase()) || 1;
                    const hasBeenEmailed = !!c.lastEmailSentAt;

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleContact(c.id)}
                        className={`py-2 px-2 rounded-md flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'hover:bg-[#172644]' : 'opacity-40 hover:opacity-75 bg-[#0B141A]/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by div click
                            className="rounded border-[#2B3D63] text-[#C9A227] focus:ring-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#EDE6D6] truncate">
                                {c.nome || 'Sem Nome'}
                              </span>
                              {c.curso && (
                                <span className="text-[10px] text-[#C9A227] truncate max-w-[140px]">
                                  {c.curso}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#8C98B4] font-mono truncate flex items-center gap-1.5 mt-0.5">
                              <span>{c.email}</span>
                              {emailOccurrences > 1 && (
                                <span className="text-[9px] bg-amber-950 text-amber-400 px-1 rounded border border-amber-800/40">
                                  {emailOccurrences}x cadastrado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 text-right">
                          {hasBeenEmailed ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/50 shadow-sm"
                              title={`Último e-mail enviado em: ${new Date(c.lastEmailSentAt!).toLocaleString('pt-BR')}${c.emailSentCount ? ` (${c.emailSentCount}x)` : ''}`}
                            >
                              <Mail className="w-3 h-3 text-blue-400" />
                              <span>Contatado ({new Date(c.lastEmailSentAt!).toLocaleDateString('pt-BR')})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 shadow-sm">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>Nunca contatado</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Email Subject & Body Builder */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C9A227]" />
                <h4 className="font-bold text-[#EDE6D6] text-sm">
                  2. Redação do E-mail Personalizado
                </h4>
              </div>

              {/* Template quick loader */}
              {templates.length > 0 && (
                <select
                  onChange={(e) => {
                    const tmpl = templates.find((t) => t.id === e.target.value);
                    if (tmpl) {
                      setSubject(tmpl.titulo ? `🎯 ${tmpl.titulo} - Portal Concursos` : subject);
                      setBody(tmpl.texto);
                      onToast(`Modelo "${tmpl.titulo}" carregado!`, 'info');
                    }
                  }}
                  defaultValue=""
                  className="bg-[#101B2D] border border-[#2B3D63] rounded text-xs px-2 py-1 text-[#C9A227] focus:outline-none"
                >
                  <option value="" disabled>
                    📖 Carregar Modelo do CRM...
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.titulo}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Variable Tags Quick Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#101B2D] p-2.5 rounded-lg border border-[#2B3D63]/70">
              <span className="text-[11px] font-semibold text-[#8C98B4] mr-1">Inserir Tag:</span>
              {[
                { tag: 'primeiro_nome', label: '{primeiro_nome}' },
                { tag: 'nome', label: '{nome}' },
                { tag: 'curso', label: '{curso}' },
                { tag: 'whatsapp', label: '{whatsapp}' },
                { tag: 'email', label: '{email}' },
              ].map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag, 'body')}
                  className="text-[11px] bg-[#1F3057] hover:bg-[#C9A227] hover:text-[#101B2D] text-[#EDE6D6] px-2 py-0.5 rounded font-mono transition-colors cursor-pointer border border-[#2B3D63]"
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Sender details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#8C98B4] mb-1 font-semibold">Nome do Remetente</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Portal Concursos"
                  className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div>
                <label className="block text-[#8C98B4] mb-1 font-semibold">
                  E-mail Remetente (Verificado no SendGrid)
                </label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="contato@portalconcurso.com.br"
                  className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-[#8C98B4] mb-1">
                Assunto do E-mail
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2 text-sm text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-[#8C98B4] mb-1">
                Mensagem do E-mail
              </label>
              <textarea
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-3 text-xs sm:text-sm text-[#EDE6D6] leading-relaxed focus:outline-none focus:border-[#C9A227] font-sans"
              />
            </div>

            {/* Call to Action & WhatsApp Button Options */}
            <div className="bg-[#101B2D] p-4 rounded-lg border border-[#2B3D63]/70 space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#EDE6D6]">
                  <input
                    type="checkbox"
                    checked={includeCta}
                    onChange={(e) => setIncludeCta(e.target.checked)}
                    className="rounded border-[#2B3D63] text-[#10B981] focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-[#EDE6D6]">
                    Incluir Botão de Ação / WhatsApp no E-mail
                  </span>
                </label>
              </div>

              {includeCta && (
                <div className="space-y-3.5 pt-1">
                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 gap-2 bg-[#172644] p-1 rounded-lg border border-[#2B3D63]">
                    <button
                      type="button"
                      onClick={() => {
                        setCtaMode('whatsapp');
                        setCtaText('🟢 Falar no WhatsApp com o Consultor');
                      }}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        ctaMode === 'whatsapp'
                          ? 'bg-[#25D366] text-slate-900 shadow'
                          : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Botão do WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCtaMode('custom_link');
                        setCtaText('Garantir Minha Vaga com Desconto');
                      }}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        ctaMode === 'custom_link'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Link do Site / Checkout</span>
                    </button>
                  </div>

                  {ctaMode === 'whatsapp' ? (
                    /* WhatsApp Specific Inputs */
                    <div className="space-y-3 bg-[#172644]/80 p-3.5 rounded-lg border border-[#25D366]/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[#EDE6D6] mb-1 font-semibold flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                            Seu Número de WhatsApp (com DDD)
                          </label>
                          <input
                            type="text"
                            value={waPhoneNumber}
                            onChange={(e) => setWaPhoneNumber(e.target.value)}
                            placeholder="Ex: 5511999998888 ou 11987654321"
                            className="w-full bg-[#101B2D] border border-[#2B3D63] rounded px-3 py-2 text-[#EDE6D6] font-mono focus:outline-none focus:border-[#25D366]"
                          />
                          <span className="text-[10px] text-[#8C98B4] mt-0.5 block">
                            Pode digitar com DDD (ex: 11 98765-4321). O sistema ajusta o link automaticamente.
                          </span>
                        </div>

                        <div>
                          <label className="block text-[#EDE6D6] mb-1 font-semibold">
                            Texto que vai escrito no Botão
                          </label>
                          <input
                            type="text"
                            value={ctaText}
                            onChange={(e) => setCtaText(e.target.value)}
                            placeholder="🟢 Falar no WhatsApp com o Consultor"
                            className="w-full bg-[#101B2D] border border-[#2B3D63] rounded px-3 py-2 text-[#EDE6D6] focus:outline-none focus:border-[#25D366]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-[#EDE6D6] mb-1 font-semibold">
                          Mensagem Pré-pronta que o aluno vai enviar quando clicar:
                        </label>
                        <input
                          type="text"
                          value={waMessage}
                          onChange={(e) => setWaMessage(e.target.value)}
                          placeholder="Olá! Vi o e-mail do Portal Concursos sobre {curso} e quero tirar dúvidas."
                          className="w-full bg-[#101B2D] border border-[#2B3D63] rounded px-3 py-2 text-xs text-[#EDE6D6] focus:outline-none focus:border-[#25D366]"
                        />
                        <span className="text-[10px] text-[#8C98B4] mt-1 block">
                          Quando o aluno apertar o botão no e-mail, essa mensagem já vai digitada no WhatsApp dele!
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Standard URL Input */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[#8C98B4] mb-1 font-semibold">Texto do Botão</label>
                        <input
                          type="text"
                          value={ctaText}
                          onChange={(e) => setCtaText(e.target.value)}
                          placeholder="Garantir Minha Vaga com Desconto"
                          className="w-full bg-[#172644] border border-[#2B3D63] rounded px-3 py-2 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#8C98B4] mb-1 font-semibold">Link de Destino</label>
                        <input
                          type="url"
                          value={ctaLink}
                          onChange={(e) => setCtaLink(e.target.value)}
                          placeholder="https://portalconcurso.com.br"
                          className="w-full bg-[#172644] border border-[#2B3D63] rounded px-3 py-2 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Action Dispatch Box */}
          <div className="bg-gradient-to-br from-[#172644] to-[#101B2D] border-2 border-[#10B981]/50 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#34D399]" />
                  Disparar para {targetContacts.length} Alunos com 1 Clique
                </h4>
                <p className="text-xs text-[#8C98B4] mt-0.5">
                  Cada aluno receberá um e-mail individual com seu nome e curso preenchidos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyBccList}
                  className="text-xs bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] px-3 py-2 rounded-lg border border-[#2B3D63] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copia os 100 e-mails para colar em CCO no Gmail/Outlook"
                >
                  {copiedBcc ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copiados!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#C9A227]" />
                      <span>Copiar em CCO</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Progress Bar Section */}
            {isSending && sendProgress && (
              <div className="bg-[#101B2D] border-2 border-emerald-500/50 rounded-xl p-4 space-y-3 animate-fadeIn shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-sm font-bold text-emerald-400">
                      Disparando E-mails ({sendProgress.processed} de {sendProgress.total})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-white bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-700/60">
                      {sendProgress.percent}%
                    </span>
                    <button
                      type="button"
                      onClick={handleStopSending}
                      className="bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      title="Interromper envio agora"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Parar</span>
                    </button>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full bg-[#172644] h-3.5 rounded-full overflow-hidden border border-[#2B3D63] relative">
                  <div
                    className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full rounded-full transition-all duration-300 relative overflow-hidden shadow"
                    style={{ width: `${Math.max(sendProgress.percent, 3)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>

                {/* Current Contact and Live Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1">
                  <div className="text-[#8C98B4] truncate flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Enviando agora:</span>
                    <strong className="text-[#EDE6D6] truncate">
                      {sendProgress.currentName} {sendProgress.currentEmail ? `(${sendProgress.currentEmail})` : ''}
                    </strong>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                    <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      ✓ {sendProgress.sent} enviados
                    </span>
                    {sendProgress.failed > 0 && (
                      <span className="text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40">
                        ✗ {sendProgress.failed} falhas
                      </span>
                    )}
                    <span className="text-slate-400">
                      ⏳ {sendProgress.total - sendProgress.processed} restantes
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isSending || targetContacts.length === 0}
              onClick={handleExecuteBatchSend}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                isSending
                  ? 'bg-emerald-800/60 text-slate-300 cursor-not-allowed border border-emerald-500/30'
                  : targetContacts.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white ring-2 ring-emerald-400/40 hover:scale-[1.01]'
              }`}
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Enviando em Tempo Real ({sendProgress ? `${sendProgress.processed}/${sendProgress.total}` : 'Iniciando...'})</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Disparar {targetContacts.length} E-mails com 1 Clique (SendGrid)</span>
                </>
              )}
            </button>

            {/* Results Progress / Summary Box */}
            {dispatchResults && (
              <div className="mt-4 pt-4 border-t border-[#2B3D63] space-y-3 bg-[#0B141A] p-4 rounded-lg">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Relatório do Último Disparo
                  </span>
                  <span className="text-[#8C98B4]">Total: {dispatchResults.total} contatos</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-emerald-950/80 border border-emerald-700/60 p-2 rounded">
                    <div className="text-lg font-bold text-emerald-400">{dispatchResults.sent}</div>
                    <div className="text-[10px] text-emerald-300">Enviados</div>
                  </div>
                  <div className="bg-red-950/80 border border-red-800/60 p-2 rounded">
                    <div className="text-lg font-bold text-red-400">{dispatchResults.failed}</div>
                    <div className="text-[10px] text-red-300">Falhas</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 p-2 rounded">
                    <div className="text-lg font-bold text-slate-300">{dispatchResults.skipped}</div>
                    <div className="text-[10px] text-slate-400">Sem E-mail</div>
                  </div>
                </div>

                {/* Detailed mini logs */}
                {dispatchResults.logs.length > 0 && (
                  <div className="max-h-40 overflow-y-auto divide-y divide-[#2B3D63]/50 text-[11px]">
                    {dispatchResults.logs.slice(0, 50).map((log, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="text-[#EDE6D6] truncate font-medium">
                          {log.nome} ({log.email})
                        </span>
                        <span
                          className={`shrink-0 px-1.5 py-0.2 rounded font-bold text-[10px] ${
                            log.status === 'sent'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-red-950 text-red-400'
                          }`}
                        >
                          {log.status === 'sent' ? '✓ Enviado' : log.error || 'Falha'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Email Inbox Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-5 shadow-md sticky top-6">
            <div className="flex items-center justify-between mb-3 border-b border-[#2B3D63] pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#C9A227]" />
                <h4 className="font-bold text-[#EDE6D6] text-sm">
                  Pré-visualização do Aluno
                </h4>
              </div>
              <span className="text-[10px] bg-[#101B2D] text-[#C9A227] px-2 py-0.5 rounded border border-[#2B3D63]">
                Simulação em Tempo Real
              </span>
            </div>

            {/* Email Client Mockup */}
            <div className="bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200 text-slate-900 text-xs">
              {/* Mail Header Bar */}
              <div className="bg-slate-100 p-3 border-b border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold w-12">De:</span>
                  <span className="font-semibold text-slate-800">
                    {fromName} &lt;{fromEmail || 'notificacoes@portalconcurso.com.br'}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold w-12">Para:</span>
                  <span className="text-slate-700 font-medium">
                    {previewContact.nome} &lt;{previewContact.email || 'aluno@email.com'}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold w-12">Assunto:</span>
                  <span className="font-bold text-slate-900 truncate">
                    {processedPreviewSubject}
                  </span>
                </div>
              </div>

              {/* Email Content Frame */}
              <div className="p-5 bg-slate-50 space-y-4 max-h-[480px] overflow-y-auto">
                {/* Brand Banner with Official Logo */}
                <div className="bg-slate-900 p-3.5 rounded-lg text-white flex items-center justify-between border-b-2 border-[#C9A227]">
                  <div className="flex items-center gap-2.5">
                    {/* Official Portal Icon */}
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow bg-white flex items-center justify-center">
                      <img src="/logo.png" alt="Portal Concursos" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-black tracking-wider text-[#EDE6D6] uppercase">PORTAL</span>
                      <span className="text-[8px] font-extrabold tracking-widest text-[#C9A227] uppercase">CONCURSOS E OAB</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">Comunicação Oficial</span>
                </div>

                {/* Email Body */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3 text-slate-700 leading-relaxed text-xs sm:text-sm whitespace-pre-wrap">
                  {processedPreviewBody}

                  {includeCta && processedPreviewCtaLink && ctaText && (
                    <div className="pt-4 pb-2 text-center">
                      <a
                        href={processedPreviewCtaLink}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-block text-white font-bold px-7 py-3 rounded-full text-xs sm:text-sm shadow-md transition-all hover:scale-105 ${
                          ctaMode === 'whatsapp'
                            ? 'bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-emerald-600/30'
                            : 'bg-[#059669] hover:bg-[#047857]'
                        }`}
                      >
                        {ctaMode === 'whatsapp' ? '💬 ' : ''}
                        {ctaText}
                      </a>
                      <p className="text-[10px] text-slate-400 mt-1.5 italic">
                        {ctaMode === 'whatsapp'
                          ? '👆 Clique acima para testar o redirecionamento para o seu WhatsApp'
                          : '👆 Botão de ação oficial no corpo do e-mail'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] text-slate-400 pt-2 space-y-1">
                  <p className="font-semibold text-slate-500">Portal Concurso - Central de Aprovações</p>
                  <p>Mensagem enviada para {previewContact.email || 'seu e-mail'}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons for Preview */}
            <div className="pt-3 border-t border-[#2B3D63] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowTestModal(true)}
                className="w-full bg-[#101B2D] hover:bg-[#1A2D52] text-blue-400 hover:text-blue-300 font-bold text-xs py-2.5 px-4 rounded-lg border border-blue-500/40 flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
              >
                <span>🧪</span>
                <span>Enviar E-mail de Teste para o Meu Próprio Gmail</span>
              </button>
            </div>

            <p className="text-[11px] text-[#8C98B4] mt-3 text-center">
              As tags como <code className="text-emerald-400 font-mono">&#123;primeiro_nome&#125;</code> são substituídas automaticamente pelos dados de cada aluno no momento exato do disparo.
            </p>
          </div>
        </div>
      </div>

      {/* Test Email Modal Popup */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#172644] border-2 border-blue-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2B3D63] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  🧪
                </div>
                <div>
                  <h3 className="font-bold text-[#EDE6D6] text-base">Enviar E-mail de Teste</h3>
                  <p className="text-[11px] text-[#8C98B4]">Receba na hora exatamente como o aluno verá</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="text-[#8C98B4] hover:text-white p-1 rounded hover:bg-[#101B2D] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#EDE6D6] font-semibold mb-1">
                  Seu E-mail de Destino (Onde você quer receber):
                </label>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg px-3 py-2.5 text-[#EDE6D6] focus:outline-none focus:border-blue-400 font-medium"
                />
              </div>

              <div className="bg-[#101B2D] p-3 rounded-lg border border-[#2B3D63] space-y-1 text-[#CBD5E1] text-[11px]">
                <p>
                  <strong>Assunto:</strong> [TESTE] {subject || '(Sem assunto)'}
                </p>
                <p>
                  <strong>Remetente:</strong> {fromName} &lt;{fromEmail || 'SendGrid Verified'}&gt;
                </p>
              </div>

              <p className="text-[10px] text-[#8C98B4]">
                💡 O e-mail de teste não afeta sua lista de contatos e gasta apenas 1 crédito de envio.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3D63]">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 rounded-lg bg-[#101B2D] text-[#8C98B4] hover:text-white text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSendingTest || !testEmailAddress.trim()}
                onClick={handleSendSingleTestEmail}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando Teste...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Teste Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

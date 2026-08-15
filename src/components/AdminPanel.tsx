import React, { useState, useMemo } from 'react';
import {
  Shield,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  FileSpreadsheet,
  Share2,
  Layers,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  Send,
  PieChart,
  AlertCircle,
  MessageSquare,
  Flame,
  MessageCircle,
  TrendingUp,
  ExternalLink,
  ArrowUpDown,
  Bell,
  Check,
  Download,
  UploadCloud,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { UserProfile, Contact, LeadBatch, Temperature } from '../types';
import { SmartImportModal, SmartImportResult } from './SmartImportModal';
import {
  isWithoutContactFor3Days,
  getContactInactivityStatus,
  getDaysWithoutContact,
  formatDateBR,
  waLink,
  openWhatsAppDirect,
  todayStr,
  exportSupervisorContactsToExcel,
} from '../utils/excel';

interface AdminPanelProps {
  currentProfile: UserProfile | null;
  users: UserProfile[];
  globalContacts: Contact[];
  batches: LeadBatch[];
  onApproveUser: (uid: string, role: 'admin' | 'attendant') => Promise<void>;
  onBlockUser: (uid: string) => Promise<void>;
  onChangeUserRole: (uid: string, role: 'admin' | 'attendant') => Promise<void>;
  onCreateUserByAdmin?: (name: string, emailOrUser: string, pass: string, role: 'admin' | 'attendant') => Promise<boolean | string>;
  onDistributeContacts: (
    contactsToAssign: Contact[],
    targetUserUid: string,
    targetUserEmail: string
  ) => Promise<void>;
  onDistributeEqually: (
    unassignedContacts: Contact[],
    targetUsers: UserProfile[]
  ) => Promise<void>;
  onReassignSingleContact?: (
    contactId: string,
    targetUserUid: string,
    targetUserEmail: string
  ) => Promise<void>;
  onBatchDeleteContacts: (contactIds: string[]) => Promise<void>;
  onImportSmartContacts?: (result: SmartImportResult) => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentProfile,
  users,
  globalContacts,
  batches,
  onApproveUser,
  onBlockUser,
  onChangeUserRole,
  onCreateUserByAdmin,
  onDistributeContacts,
  onDistributeEqually,
  onReassignSingleContact,
  onBatchDeleteContacts,
  onImportSmartContacts,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'alerts' | 'activity' | 'users' | 'distribution' | 'overview' | 'import_ai'>('alerts');
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('todos');
  const [selectedTargetUser, setSelectedTargetUser] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [actionFilter, setActionFilter] = useState<'todos' | 'unassigned' | 'assigned'>('unassigned');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('123456');
  const [newUserRole, setNewUserRole] = useState<'attendant' | 'admin'>('attendant');
  const [createUserError, setCreateUserError] = useState('');

  // Inactivity Alerts Filter & Search State
  const [alertSearch, setAlertSearch] = useState('');
  const [alertAttendantFilter, setAlertAttendantFilter] = useState('todos');
  const [alertDaysFilter, setAlertDaysFilter] = useState<'all' | '3to5' | '5to10' | '10plus'>('all');
  const [reassignTargetByContact, setReassignTargetByContact] = useState<Record<string, string>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // General Stats
  const approvedUsers = users.filter((u) => u.status === 'approved');
  const pendingUsers = users.filter((u) => u.status === 'pending');
  const attendants = users.filter((u) => u.status === 'approved' && u.role === 'attendant');
  const unassignedContacts = globalContacts.filter((c) => !c.assignedTo);
  const assignedContacts = globalContacts.filter((c) => !!c.assignedTo);

  // 3+ Days Inactivity Alerts list
  const inactiveAlertContacts = useMemo(() => {
    return globalContacts
      .filter((c) => isWithoutContactFor3Days(c))
      .sort((a, b) => getDaysWithoutContact(b) - getDaysWithoutContact(a));
  }, [globalContacts]);

  // Filtered Alert Contacts
  const filteredAlertContacts = useMemo(() => {
    return inactiveAlertContacts.filter((c) => {
      // Attendant filter
      if (alertAttendantFilter !== 'todos') {
        if (alertAttendantFilter === 'unassigned' && c.assignedTo) return false;
        if (alertAttendantFilter !== 'unassigned' && c.assignedTo !== alertAttendantFilter) return false;
      }
      // Days filter
      const days = getDaysWithoutContact(c);
      if (alertDaysFilter === '3to5' && (days < 3 || days > 5)) return false;
      if (alertDaysFilter === '5to10' && (days < 5 || days > 10)) return false;
      if (alertDaysFilter === '10plus' && days < 10) return false;
      // Search filter
      if (alertSearch.trim()) {
        const q = alertSearch.toLowerCase();
        const matchName = c.nome.toLowerCase().includes(q);
        const matchWpp = c.whatsapp.includes(q);
        const matchCurso = (c.curso || '').toLowerCase().includes(q);
        const matchEmail = (c.assignedToEmail || '').toLowerCase().includes(q);
        if (!matchName && !matchWpp && !matchCurso && !matchEmail) return false;
      }
      return true;
    });
  }, [inactiveAlertContacts, alertAttendantFilter, alertDaysFilter, alertSearch]);

  // Today's stats
  const today = todayStr();
  const todayInteractedCount = useMemo(() => {
    return globalContacts.filter((c) => {
      if (c.ultimoContato === today) return true;
      if (c.lastMessageAt && Date.now() - c.lastMessageAt < 24 * 60 * 60 * 1000) return true;
      return false;
    }).length;
  }, [globalContacts, today]);

  // Attendant Performance Statistics
  const attendantStats = useMemo(() => {
    return attendants.map((a) => {
      const myLeads = globalContacts.filter((c) => c.assignedTo === a.uid);
      const contactedToday = myLeads.filter((c) => {
        if (c.ultimoContato === today) return true;
        if (c.lastMessageAt && Date.now() - c.lastMessageAt < 24 * 60 * 60 * 1000) return true;
        return false;
      }).length;
      const inactive3Days = myLeads.filter((c) => isWithoutContactFor3Days(c)).length;
      const activeIn3Days = myLeads.length - inactive3Days;
      const paidCount = myLeads.filter((c) => c.temperatura === 'Pagou').length;
      const hotCount = myLeads.filter((c) => c.temperatura === 'Quente' || c.temperatura === 'Potencial').length;
      const coverageRate = myLeads.length > 0 ? Math.round((activeIn3Days / myLeads.length) * 100) : 100;

      let statusTier: 'good' | 'warning' | 'danger' = 'good';
      if (inactive3Days > 3) statusTier = 'danger';
      else if (inactive3Days > 0) statusTier = 'warning';

      return {
        attendant: a,
        totalLeads: myLeads.length,
        contactedToday,
        inactive3Days,
        activeIn3Days,
        paidCount,
        hotCount,
        coverageRate,
        statusTier,
      };
    }).sort((a, b) => b.inactive3Days - a.inactive3Days);
  }, [attendants, globalContacts, today]);

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  // Filtered Contacts for Distribution
  const filteredContactsForDistribution = globalContacts.filter((c) => {
    if (selectedBatchFilter !== 'todos' && c.batchName !== selectedBatchFilter) return false;
    if (actionFilter === 'unassigned' && c.assignedTo) return false;
    if (actionFilter === 'assigned' && !c.assignedTo) return false;
    return true;
  });

  // Single contact reassignment
  const handleReassignSingle = async (contactId: string) => {
    const targetUid = reassignTargetByContact[contactId];
    if (!targetUid) {
      alert('Selecione o atendente para transferir.');
      return;
    }
    const target = users.find((u) => u.uid === targetUid);
    if (!target) return;

    setIsProcessing(true);
    try {
      if (onReassignSingleContact) {
        await onReassignSingleContact(contactId, target.uid, target.email);
      } else {
        const contact = globalContacts.find((c) => c.id === contactId);
        if (contact) {
          await onDistributeContacts([contact], target.uid, target.email);
        }
      }
      setSuccessMsg(`Contato reatribuído com sucesso para ${target.displayName || target.email}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao reatribuir: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk reassign all 3+ days inactive contacts to active attendants
  const handleBulkReassignAllInactive = async () => {
    if (inactiveAlertContacts.length === 0) {
      alert('Não há contatos parados há 3 ou mais dias.');
      return;
    }
    if (attendants.length === 0) {
      alert('Não há atendentes aprovados disponíveis para receber os contatos.');
      return;
    }

    const confirmMsg = `Deseja reatribuir todos os ${inactiveAlertContacts.length} contatos parados (+3 dias) dividindo-os igualmente entre os ${attendants.length} atendentes da equipe?`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await onDistributeEqually(inactiveAlertContacts, attendants);
      setSuccessMsg(`Sucesso! ${inactiveAlertContacts.length} contatos parados foram redistribuídos entre os ${attendants.length} atendentes!`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e: any) {
      alert('Erro ao redistribuir contatos: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle single user assignment in distribution tab
  const handleAssignSelected = async () => {
    if (!selectedTargetUser) {
      alert('Selecione o atendente de destino.');
      return;
    }
    const target = users.find((u) => u.uid === selectedTargetUser);
    if (!target) return;

    const contactsToAssign = globalContacts.filter((c) => selectedContactIds.includes(c.id));
    if (contactsToAssign.length === 0) {
      alert('Nenhum contato selecionado.');
      return;
    }

    setIsProcessing(true);
    try {
      await onDistributeContacts(contactsToAssign, target.uid, target.email);
      setSelectedContactIds([]);
      setSuccessMsg(`${contactsToAssign.length} contatos atribuídos com sucesso para ${target.displayName || target.email}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao distribuir: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle automatic equal distribution
  const handleAutoEqualDistribute = async () => {
    if (attendants.length === 0) {
      alert('Não há atendentes aprovados no sistema para receber contatos.');
      return;
    }

    const unassigned = globalContacts.filter((c) => {
      if (selectedBatchFilter !== 'todos' && c.batchName !== selectedBatchFilter) return false;
      return !c.assignedTo;
    });

    if (unassigned.length === 0) {
      alert('Não há contatos não distribuídos nesta seleção.');
      return;
    }

    const confirmMsg = `Deseja dividir ${unassigned.length} contatos igualmente entre os ${attendants.length} atendentes aprovados (${Math.ceil(unassigned.length / attendants.length)} para cada)?`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await onDistributeEqually(unassigned, attendants);
      setSuccessMsg(`Sucesso! ${unassigned.length} contatos foram divididos igualmente entre ${attendants.length} atendentes!`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e: any) {
      alert('Erro na distribuição automática: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectAllFiltered = () => {
    if (selectedContactIds.length === filteredContactsForDistribution.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContactsForDistribution.map((c) => c.id));
    }
  };

  // Copy notice to seller
  const handleCopySellerNotice = (contact: Contact, attendantName: string, days: number) => {
    const text = `🚨 *ALERTA DE ATENDIMENTO - PORTAL CONCURSO*\n\nOlá, *${attendantName}*!\nO lead *${contact.nome}* (WhatsApp: ${contact.whatsapp}) está há *${days} dias sem resposta ou contato* no painel.\n\nPor favor, envie uma mensagem agora para dar andamento e não perder o aluno! 🎯`;
    navigator.clipboard.writeText(text);
    setCopiedMessageId(contact.id);
    setTimeout(() => setCopiedMessageId(null), 3000);
  };

  // Supervisor Export Handlers
  const handleExportSupervisorAll = async () => {
    if (globalContacts.length === 0) {
      alert('Não há contatos cadastrados na base geral para exportar.');
      return;
    }
    setIsProcessing(true);
    try {
      await exportSupervisorContactsToExcel(globalContacts, 'Base_Geral_Supervisao');
      setSuccessMsg(`Planilha de Supervisão com ${globalContacts.length} contatos exportada com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao exportar planilha: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSupervisorAlerts = async () => {
    if (inactiveAlertContacts.length === 0) {
      alert('Não há leads parados no momento.');
      return;
    }
    setIsProcessing(true);
    try {
      await exportSupervisorContactsToExcel(inactiveAlertContacts, 'Leads_Parados_Mais_3_Dias');
      setSuccessMsg(`Planilha de Leads Parados com ${inactiveAlertContacts.length} contatos exportada com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao exportar planilha: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSupervisorUnassigned = async () => {
    if (unassignedContacts.length === 0) {
      alert('Não há contatos não distribuídos no momento.');
      return;
    }
    setIsProcessing(true);
    try {
      await exportSupervisorContactsToExcel(unassignedContacts, 'Leads_Nao_Distribuidos');
      setSuccessMsg(`Planilha com ${unassignedContacts.length} contatos livres exportada com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao exportar planilha: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert / Success */}
      {successMsg && (
        <div className="bg-[#6E8F5C]/20 border border-[#6E8F5C] text-[#EDE6D6] p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-[#6E8F5C] shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Header Admin Bar */}
      <div className="bg-[#172644] border border-[#C9A227]/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#C9A227] uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              Painel de Controle Central • Administrador Master
            </div>
            <h2 className="text-2xl font-bold font-serif text-[#EDE6D6]">
              Radar de Atendimento, Alertas & Gestão de Equipe
            </h2>
            <p className="text-xs sm:text-sm text-[#8C98B4] mt-1">
              Monitore se os vendedores estão enviando mensagens, receba alertas de leads sem resposta (+3 dias) e gerencie a distribuição.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSmartImportModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#C9A227] to-[#8C6D1F] hover:brightness-110 text-[#101B2D] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              title="Importar planilhas, PDFs de matrículas ou fotos de listas com inteligência artificial"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Importar Planilha / PDF / Foto (IA)</span>
            </button>

            <button
              type="button"
              onClick={handleExportSupervisorAll}
              disabled={isProcessing || globalContacts.length === 0}
              className="flex items-center gap-1.5 bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Exporta a planilha completa da supervisão com atendente, curso, lote e status de cada aluno"
            >
              <Download className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Exportar Gestão (.xlsx)</span>
            </button>

            <span className="text-xs bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#6E8F5C]" />
              Admin: <b>{currentProfile?.displayName || currentProfile?.email}</b>
            </span>
          </div>
        </div>

        {/* Real-time KPI Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#2B3D63]/70">
          <div
            onClick={() => setActiveSubTab('alerts')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              inactiveAlertContacts.length > 0
                ? 'bg-[#DC2626]/10 border-[#DC2626]/50 hover:bg-[#DC2626]/20'
                : 'bg-[#101B2D] border-[#2B3D63]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#8C98B4] block font-medium">Leads Parados (+3 Dias)</span>
              {inactiveAlertContacts.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xl font-bold ${inactiveAlertContacts.length > 0 ? 'text-[#F87171]' : 'text-[#EDE6D6]'}`}>
                {inactiveAlertContacts.length}
              </span>
              {inactiveAlertContacts.length > 0 && (
                <span className="text-[10px] bg-[#DC2626]/30 text-[#FCA5A5] px-1.5 py-0.5 rounded font-bold animate-pulse">
                  Alerta Ativo
                </span>
              )}
            </div>
          </div>

          <div
            onClick={() => setActiveSubTab('activity')}
            className="bg-[#101B2D] hover:bg-[#1F3057]/40 p-3 rounded-xl border border-[#2B3D63] transition-all cursor-pointer"
          >
            <span className="text-[11px] text-[#8C98B4] block font-medium">Contatados Hoje</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-[#4ADE80]">{todayInteractedCount}</span>
              <span className="text-[10px] text-[#8C98B4]">mensagens/status</span>
            </div>
          </div>

          <div
            onClick={() => setActiveSubTab('users')}
            className="bg-[#101B2D] hover:bg-[#1F3057]/40 p-3 rounded-xl border border-[#2B3D63] transition-all cursor-pointer"
          >
            <span className="text-[11px] text-[#8C98B4] block font-medium">Atendentes Aprovados</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-[#C9A227]">{attendants.length}</span>
              {pendingUsers.length > 0 && (
                <span className="text-[10px] bg-[#B14432] text-white px-1.5 py-0.5 rounded font-bold">
                  {pendingUsers.length} pendente(s)
                </span>
              )}
            </div>
          </div>

          <div
            onClick={() => setActiveSubTab('distribution')}
            className="bg-[#101B2D] hover:bg-[#1F3057]/40 p-3 rounded-xl border border-[#2B3D63] transition-all cursor-pointer"
          >
            <span className="text-[11px] text-[#8C98B4] block font-medium">Total de Leads na Base</span>
            <span className="text-xl font-bold text-[#EDE6D6] mt-1 block">
              {globalContacts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex items-center gap-1.5 border-b border-[#2B3D63] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('alerts')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'alerts'
              ? 'bg-[#DC2626] text-white shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Leads Parados (+3 Dias)</span>
          {inactiveAlertContacts.length > 0 && (
            <span className="bg-white text-[#DC2626] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {inactiveAlertContacts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('import_ai')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'import_ai'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#C9A227]" />
          <span>Importar Planilha / PDF / Foto (IA)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('distribution')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'distribution'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644]'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Distribuir Planilhas</span>
          {unassignedContacts.length > 0 && (
            <span className="bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40 text-[10px] px-1.5 py-0.2 rounded-full font-sans">
              {unassignedContacts.length} livres
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('activity')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'activity'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Produtividade da Equipe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'users'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Atendentes & Acessos</span>
          {pendingUsers.length > 0 && (
            <span className="bg-[#B14432] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {pendingUsers.length} pendentes
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#172644]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Base Geral ({globalContacts.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: 🚨 RADAR DE ALERTAS (+3 DIAS SEM CONTATO)                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-4">
          {/* Top Inactivity Alert Banner */}
          <div className="bg-[#172644] border border-[#DC2626]/50 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#F87171] uppercase tracking-wider mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Alerta Automático de Inatividade & Abandono de Lead
                </div>
                <h3 className="text-xl font-bold font-serif text-[#EDE6D6]">
                  Leads sem Resposta ou Contato há 3+ Dias ({inactiveAlertContacts.length})
                </h3>
                <p className="text-xs text-[#8C98B4] mt-1 max-w-2xl">
                  O sistema monitora em tempo real a data da última mensagem enviada por cada vendedor. Leads que não recebem resposta há 3 dias ou mais entram em alerta crítico para que você possa cobrar o vendedor ou redistribuir o contato.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {inactiveAlertContacts.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleExportSupervisorAlerts}
                      disabled={isProcessing}
                      className="bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] font-bold text-xs px-3.5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40"
                      title="Exportar planilha Excel apenas com os leads parados"
                    >
                      <Download className="w-4 h-4 text-[#C9A227]" />
                      <span>Exportar Parados ({inactiveAlertContacts.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBulkReassignAllInactive}
                      disabled={isProcessing || attendants.length === 0}
                      className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs px-4 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40"
                      title="Dividir todos os contatos parados igualmente entre os atendentes ativos"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Redistribuir Todos</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Filter Bar for Alerts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#2B3D63]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar aluno, telefone ou curso..."
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] text-xs pl-9 pr-3 py-2.5 rounded-lg focus:outline-none focus:border-[#C9A227]"
                />
              </div>

              <div>
                <select
                  value={alertAttendantFilter}
                  onChange={(e) => setAlertAttendantFilter(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] text-xs p-2.5 rounded-lg focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="todos">Todos os Atendentes ({inactiveAlertContacts.length} alertas)</option>
                  <option value="unassigned">Sem Atendente Atribuído</option>
                  {attendants.map((a) => {
                    const count = inactiveAlertContacts.filter((c) => c.assignedTo === a.uid).length;
                    return (
                      <option key={a.uid} value={a.uid}>
                        {a.displayName || a.email} ({count} parados)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <select
                  value={alertDaysFilter}
                  onChange={(e) => setAlertDaysFilter(e.target.value as any)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] text-xs p-2.5 rounded-lg focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="all">Qualquer Inatividade (+3 dias)</option>
                  <option value="3to5">Parados entre 3 e 5 dias</option>
                  <option value="5to10">Parados entre 5 e 10 dias (Crítico)</option>
                  <option value="10plus">Parados há mais de 10 dias (Abandono)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table / List of Inactive Leads */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-xl overflow-hidden shadow-md">
            <div className="p-3 bg-[#101B2D] border-b border-[#2B3D63] flex items-center justify-between text-xs">
              <span className="text-[#8C98B4]">
                Exibindo <b>{filteredAlertContacts.length}</b> lead(s) em alerta de inatividade
              </span>
              <span className="text-[11px] text-[#C9A227] font-semibold">
                Ordenado por maior tempo sem contato
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs text-[#EDE6D6]">
                <thead className="bg-[#101B2D] text-[#8C98B4] uppercase text-[10px] font-semibold sticky top-0 border-b border-[#2B3D63] z-10">
                  <tr>
                    <th className="py-3 px-3.5">Status de Inatividade</th>
                    <th className="py-3 px-3.5">Aluno / Lead</th>
                    <th className="py-3 px-3.5">WhatsApp</th>
                    <th className="py-3 px-3.5">Curso / Concurso</th>
                    <th className="py-3 px-3.5">Vendedor Responsável</th>
                    <th className="py-3 px-3.5">Última Interação</th>
                    <th className="py-3 px-3.5 text-right">Ações Rápidas do Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3D63]/40">
                  {filteredAlertContacts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#8C98B4]">
                        <CheckCircle2 className="w-8 h-8 text-[#4ADE80] mx-auto mb-2 opacity-80" />
                        <span className="text-sm font-semibold text-[#EDE6D6] block">
                          Nenhum lead em alerta de inatividade para os filtros selecionados!
                        </span>
                        <span className="text-xs text-[#8C98B4]">
                          Todos os contatos estão sendo respondidos e atualizados pela equipe.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredAlertContacts.map((c) => {
                      const inactivity = getContactInactivityStatus(c);
                      const days = getDaysWithoutContact(c);
                      const attendant = attendants.find((a) => a.uid === c.assignedTo);
                      const attendantName = attendant?.displayName || c.assignedToEmail || 'Sem atendente';
                      const selectedTarget = reassignTargetByContact[c.id] || '';
                      const isCopied = copiedMessageId === c.id;

                      return (
                        <tr key={c.id} className="hover:bg-[#1F3057]/40 transition-colors">
                          {/* Inactivity Badge */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded border ${inactivity.badgeClass}`}
                            >
                              <Clock className="w-3 h-3 shrink-0" />
                              {inactivity.label}
                            </span>
                          </td>

                          {/* Lead Name */}
                          <td className="py-3 px-3.5 font-semibold text-[#EDE6D6]">
                            <div>{c.nome || 'Sem Nome'}</div>
                            {c.observacao && (
                              <div className="text-[11px] text-[#8C98B4] truncate max-w-xs" title={c.observacao}>
                                {c.observacao}
                              </div>
                            )}
                          </td>

                          {/* WhatsApp */}
                          <td className="py-3 px-3.5 font-mono text-[#8C98B4] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{c.whatsapp}</span>
                              {c.whatsapp && (
                                <button
                                  type="button"
                                  onClick={() => openWhatsAppDirect(c.whatsapp)}
                                  className="text-[#4ADE80] hover:text-white p-1 rounded hover:bg-[#4ADE80]/20 transition-all cursor-pointer"
                                  title="Abrir WhatsApp do Aluno (Mesma aba / App)"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Course */}
                          <td className="py-3 px-3.5 text-[#EDE6D6]">
                            <span className="text-[#C9A227] font-medium">{c.curso || '—'}</span>
                          </td>

                          {/* Attendant */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {c.assignedTo ? (
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[#101B2D] border border-[#C9A227]/60 flex items-center justify-center text-[10px] font-bold text-[#C9A227]">
                                  {attendantName[0].toUpperCase()}
                                </span>
                                <div>
                                  <div className="font-semibold text-[#EDE6D6]">{attendantName}</div>
                                  <div className="text-[10px] text-[#8C98B4]">{c.assignedToEmail}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#B14432] bg-[#B14432]/10 border border-[#B14432]/30 px-2 py-0.5 rounded font-semibold">
                                <UserX className="w-3 h-3" />
                                Sem atendente
                              </span>
                            )}
                          </td>

                          {/* Last Interaction */}
                          <td className="py-3 px-3.5 text-[#8C98B4] text-[11px] whitespace-nowrap">
                            {c.lastMessageAt ? (
                              <div>
                                <span className="text-[#EDE6D6] font-medium">
                                  {formatDateBR(new Date(c.lastMessageAt).toISOString().split('T')[0])}
                                </span>
                                <span className="block text-[10px] text-[#8C98B4]">
                                  {c.lastMessageType === 'ai' ? '✨ Via IA' : '💬 Mensagem'}
                                </span>
                              </div>
                            ) : c.ultimoContato ? (
                              <div>
                                <span className="text-[#EDE6D6] font-medium">{formatDateBR(c.ultimoContato)}</span>
                                <span className="block text-[10px] text-[#8C98B4]">Último contato</span>
                              </div>
                            ) : (
                              <span className="text-[#F87171] font-semibold">Nunca contatado</span>
                            )}
                          </td>

                          {/* Quick Admin Actions */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {/* Cobrar Vendedor Button */}
                              {c.assignedTo && (
                                <button
                                  type="button"
                                  onClick={() => handleCopySellerNotice(c, attendantName, days)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                                    isCopied
                                      ? 'bg-[#4ADE80]/20 border-[#4ADE80] text-[#4ADE80]'
                                      : 'bg-[#101B2D] border-[#2B3D63] text-[#EDE6D6] hover:border-[#C9A227] hover:text-[#C9A227]'
                                  }`}
                                  title="Copiar aviso pronto para cobrar o vendedor"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5 text-[#C9A227]" />}
                                  <span>{isCopied ? 'Copiado!' : 'Cobrar Vendedor'}</span>
                                </button>
                              )}

                              {/* Reassign select & button */}
                              <select
                                value={selectedTarget}
                                onChange={(e) =>
                                  setReassignTargetByContact((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                className="bg-[#101B2D] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-lg p-1.5 focus:outline-none focus:border-[#C9A227] max-w-[140px]"
                              >
                                <option value="">Mudar para...</option>
                                {attendants
                                  .filter((a) => a.uid !== c.assignedTo)
                                  .map((a) => (
                                    <option key={a.uid} value={a.uid}>
                                      {a.displayName || a.email}
                                    </option>
                                  ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => handleReassignSingle(c.id)}
                                disabled={!selectedTarget || isProcessing}
                                className="bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                                title="Transferir este contato para o vendedor escolhido"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>Transferir</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: 📊 MONITOR DE VENDEDORES & PRODUTIVIDADE                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'activity' && (
        <div className="space-y-4">
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-bold text-[#C9A227] uppercase tracking-wider mb-1">
              <TrendingUp className="w-4 h-4" />
              Monitoramento em Tempo Real de Produtividade dos Vendedores
            </div>
            <h3 className="text-xl font-bold font-serif text-[#EDE6D6]">
              Atividade da Equipe de Vendas
            </h3>
            <p className="text-xs text-[#8C98B4] mt-1">
              Acompanhe quantas mensagens cada atendente enviou hoje, quantos leads estão em dia e quem possui contatos parados há mais de 3 dias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attendantStats.map((item) => {
              const a = item.attendant;
              const hasAlerts = item.inactive3Days > 0;

              return (
                <div
                  key={a.uid}
                  className={`bg-[#172644] border rounded-2xl p-5 shadow-md transition-all relative overflow-hidden ${
                    item.statusTier === 'danger'
                      ? 'border-[#DC2626]/70 shadow-[0_0_14px_rgba(220,38,38,0.15)]'
                      : item.statusTier === 'warning'
                      ? 'border-[#C9A227]/60'
                      : 'border-[#2B3D63] hover:border-[#6E8F5C]/50'
                  }`}
                >
                  {/* Status Pill on Top Right */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {a.photoURL ? (
                        <img
                          src={a.photoURL}
                          alt={a.displayName}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full border-2 border-[#C9A227] object-cover"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#101B2D] border border-[#2B3D63] flex items-center justify-center font-bold text-[#C9A227] text-base">
                          {(a.displayName || a.email || 'A')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#EDE6D6] truncate">
                          {a.displayName || 'Atendente'}
                        </h4>
                        <p className="text-xs text-[#8C98B4] truncate">{a.email}</p>
                      </div>
                    </div>

                    <div>
                      {item.statusTier === 'danger' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#DC2626]/20 text-[#F87171] border border-[#DC2626]/40 px-2 py-0.5 rounded-md uppercase">
                          🚨 Crítico
                        </span>
                      ) : item.statusTier === 'warning' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#C9A227]/20 text-[#FCD34D] border border-[#C9A227]/40 px-2 py-0.5 rounded-md uppercase">
                          ⚠️ Atenção
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#16A34A]/20 text-[#4ADE80] border-[#16A34A]/40 px-2 py-0.5 rounded-md uppercase">
                          🟢 Em Dia
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center my-3">
                    <div className="bg-[#101B2D] p-2.5 rounded-xl border border-[#2B3D63]">
                      <span className="text-[10px] text-[#8C98B4] block font-medium">Total Leads</span>
                      <span className="text-base font-bold text-[#EDE6D6]">{item.totalLeads}</span>
                    </div>
                    <div className="bg-[#101B2D] p-2.5 rounded-xl border border-[#2B3D63]">
                      <span className="text-[10px] text-[#4ADE80] block font-medium">Hoje</span>
                      <span className="text-base font-bold text-[#4ADE80]">{item.contactedToday}</span>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        hasAlerts ? 'bg-[#DC2626]/20 border-[#DC2626]/50' : 'bg-[#101B2D] border-[#2B3D63]'
                      }`}
                    >
                      <span className={`text-[10px] block font-medium ${hasAlerts ? 'text-[#F87171]' : 'text-[#8C98B4]'}`}>
                        Parados +3d
                      </span>
                      <span className={`text-base font-bold ${hasAlerts ? 'text-[#F87171]' : 'text-[#EDE6D6]'}`}>
                        {item.inactive3Days}
                      </span>
                    </div>
                  </div>

                  {/* Coverage Progress Bar */}
                  <div className="space-y-1 my-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8C98B4]">Taxa de Cobertura Ativa</span>
                      <span className="font-bold text-[#EDE6D6]">{item.coverageRate}%</span>
                    </div>
                    <div className="w-full bg-[#101B2D] rounded-full h-2 overflow-hidden border border-[#2B3D63]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.coverageRate >= 80
                            ? 'bg-[#4ADE80]'
                            : item.coverageRate >= 50
                            ? 'bg-[#C9A227]'
                            : 'bg-[#DC2626]'
                        }`}
                        style={{ width: `${item.coverageRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Sales count & Filter trigger */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#2B3D63] text-xs">
                    <span className="text-[#8C98B4]">
                      Vendas (Pagou): <b className="text-[#4ADE80]">{item.paidCount}</b>
                    </span>

                    {hasAlerts ? (
                      <button
                        onClick={() => {
                          setAlertAttendantFilter(a.uid);
                          setActiveSubTab('alerts');
                        }}
                        className="text-xs text-[#F87171] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        Ver {item.inactive3Days} parados →
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#4ADE80] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 100% em dia
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: 👥 GESTÃO DE ATENDENTES & ACESSOS                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#172644] p-3 rounded-xl border border-[#2B3D63]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar usuário por nome ou email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-[#C9A227]"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreateUserError('');
                  setShowAddUserModal(true);
                }}
                className="bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Users className="w-3.5 h-3.5" />
                Adicionar Novo Atendente
              </button>
              <div className="text-xs text-[#8C98B4] hidden md:block">
                Total de Contas: <b className="text-[#EDE6D6]">{users.length}</b>
              </div>
            </div>
          </div>

          {/* Add User Modal */}
          {showAddUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
              <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#2B3D63]">
                  <h3 className="text-base font-bold text-[#EDE6D6] flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#C9A227]" />
                    Cadastrar Atendente Diretamente
                  </h3>
                  <button
                    onClick={() => setShowAddUserModal(false)}
                    className="text-[#8C98B4] hover:text-[#EDE6D6] text-sm"
                  >
                    ✕
                  </button>
                </div>

                {createUserError && (
                  <div className="bg-[#B14432]/20 border border-[#B14432] text-xs text-[#EDE6D6] p-2.5 rounded-lg">
                    {createUserError}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2.5 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                    />
                  </div>

                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Usuário ou E-mail para Login</label>
                    <input
                      type="text"
                      placeholder="Ex: joao@portal.com ou joao.atendimento"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2.5 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                    />
                  </div>

                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Senha de Acesso</label>
                    <input
                      type="text"
                      placeholder="Senha provisória"
                      value={newUserPass}
                      onChange={(e) => setNewUserPass(e.target.value)}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2.5 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                    />
                  </div>

                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Cargo Inicial</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as 'attendant' | 'admin')}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2 text-[#EDE6D6] focus:outline-none focus:border-[#C9A227]"
                    >
                      <option value="attendant">Atendente (Acesso normal)</option>
                      <option value="admin">Administrador (Acesso total)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3D63]">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-3 py-2 text-xs text-[#8C98B4] hover:text-[#EDE6D6]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newUserName.trim() || !newUserEmail.trim() || !newUserPass.trim()) {
                        setCreateUserError('Preencha todos os campos.');
                        return;
                      }
                      if (onCreateUserByAdmin) {
                        const res = await onCreateUserByAdmin(
                          newUserName.trim(),
                          newUserEmail.trim(),
                          newUserPass.trim(),
                          newUserRole
                        );
                        if (res === true) {
                          setShowAddUserModal(false);
                          setNewUserName('');
                          setNewUserEmail('');
                          setNewUserPass('123456');
                        } else if (typeof res === 'string') {
                          setCreateUserError(res);
                        }
                      }
                    }}
                    className="bg-[#6E8F5C] hover:bg-[#5e7d4d] text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Salvar e Liberar Acesso
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Approvals Notice */}
          {pendingUsers.length > 0 && (
            <div className="bg-[#C9A227]/10 border border-[#C9A227] rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#C9A227] mb-2">
                <AlertTriangle className="w-4 h-4" />
                Novas Contas Aguardando Sua Aprovação ({pendingUsers.length})
              </div>
              <p className="text-xs text-[#EDE6D6]/80 mb-3">
                Os seguintes usuários se cadastraram pelo login com Google e só poderão ver ou atender os contatos após sua liberação:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="bg-[#101B2D] border border-[#C9A227]/50 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt={u.displayName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full border border-[#C9A227]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#172644] border border-[#2B3D63] flex items-center justify-center font-bold text-[#C9A227]">
                          {(u.displayName || u.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-[#EDE6D6] truncate">
                          {u.displayName || 'Novo Usuário'}
                        </h4>
                        <p className="text-xs text-[#8C98B4] truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onApproveUser(u.uid, 'attendant')}
                        className="bg-[#6E8F5C] hover:bg-[#5e7d4d] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        title="Aprovar como Atendente"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => onBlockUser(u.uid)}
                        className="bg-[#B14432] hover:bg-[#963727] text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Rejeitar / Bloquear"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Users Table */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-xl overflow-hidden shadow-md">
            <div className="p-3 bg-[#101B2D] border-b border-[#2B3D63] text-xs font-semibold text-[#8C98B4]">
              Lista Completa de Usuários Cadastrados ({filteredUsers.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#EDE6D6]">
                <thead className="bg-[#101B2D] text-[#8C98B4] uppercase text-[10px] font-semibold border-b border-[#2B3D63]">
                  <tr>
                    <th className="py-2.5 px-3">Usuário</th>
                    <th className="py-2.5 px-3">E-mail</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Cargo</th>
                    <th className="py-2.5 px-3">Contatos Atribuídos</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3D63]/40">
                  {filteredUsers.map((u) => {
                    const assignedCount = globalContacts.filter((c) => c.assignedTo === u.uid).length;
                    const isSelf = u.uid === currentProfile?.uid;

                    return (
                      <tr key={u.uid} className="hover:bg-[#1F3057]/40 transition-colors">
                        <td className="py-3 px-3 flex items-center gap-2.5 font-medium">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt={u.displayName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full border border-[#2B3D63]"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#101B2D] border border-[#2B3D63] flex items-center justify-center font-bold text-[#C9A227] text-xs">
                              {(u.displayName || u.email || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <span className="truncate max-w-[140px]">{u.displayName || 'Sem Nome'}</span>
                          {isSelf && (
                            <span className="bg-[#C9A227]/20 text-[#C9A227] text-[10px] px-1.5 py-0.2 rounded font-bold">
                              Você
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#8C98B4] font-mono">{u.email}</td>
                        <td className="py-3 px-3">
                          {u.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#6E8F5C] bg-[#6E8F5C]/10 border border-[#6E8F5C]/30 px-2 py-0.5 rounded font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Aprovado
                            </span>
                          ) : u.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/30 px-2 py-0.5 rounded font-semibold">
                              <Clock className="w-3 h-3" /> Pendente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#B14432] bg-[#B14432]/10 border border-[#B14432]/30 px-2 py-0.5 rounded font-semibold">
                              <XCircle className="w-3 h-3" /> Bloqueado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => onChangeUserRole(u.uid, e.target.value as 'admin' | 'attendant')}
                            className="bg-[#101B2D] border border-[#2B3D63] rounded px-2 py-1 text-xs text-[#EDE6D6] focus:outline-none focus:border-[#C9A227] disabled:opacity-50"
                          >
                            <option value="attendant">Atendente</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#EDE6D6]">
                          {assignedCount} contatos
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!isSelf && (
                            <div className="flex items-center justify-end gap-1.5">
                              {u.status === 'blocked' ? (
                                <button
                                  onClick={() => onApproveUser(u.uid, u.role)}
                                  className="text-xs text-[#6E8F5C] hover:underline"
                                >
                                  Desbloquear
                                </button>
                              ) : (
                                <button
                                  onClick={() => onBlockUser(u.uid)}
                                  className="text-xs text-[#B14432] hover:underline"
                                >
                                  Bloquear Acesso
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: 📦 DISTRIBUIR PLANILHAS & CONTATOS                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'distribution' && (
        <div className="space-y-4">
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#C9A227] uppercase tracking-wider mb-1">
                  <Share2 className="w-4 h-4" />
                  Divisão Automática e Distribuição de Leads
                </div>
                <h3 className="text-xl font-bold font-serif text-[#EDE6D6]">
                  Distribuir Leads para Atendentes
                </h3>
                <p className="text-xs text-[#8C98B4] mt-1">
                  Selecione lotes inteiros de planilhas importadas ou escolha contatos específicos para enviar a um vendedor.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSmartImportModal(true)}
                  className="bg-gradient-to-r from-[#C9A227] to-[#8C6D1F] hover:brightness-110 text-[#101B2D] font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  title="Importar novas planilhas, PDFs ou fotos com inteligência artificial"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Importar Novos Leads (IA)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSupervisorUnassigned}
                  disabled={isProcessing || unassignedContacts.length === 0}
                  className="bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Exportar planilha Excel apenas com os contatos ainda não distribuídos"
                >
                  <Download className="w-4 h-4 text-[#C9A227]" />
                  <span>Exportar Não Distribuídos ({unassignedContacts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoEqualDistribute}
                  disabled={isProcessing || unassignedContacts.length === 0 || attendants.length === 0}
                  className="bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Dividir igualmente todos os contatos sem atendente entre os atendentes aprovados"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Dividir Igualmente ({unassignedContacts.length})</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#2B3D63]">
              <div>
                <label className="text-[11px] font-semibold text-[#8C98B4] block mb-1">
                  Filtrar por Lote / Importação:
                </label>
                <select
                  value={selectedBatchFilter}
                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-lg p-2 focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="todos">Todos os Lotes ({globalContacts.length} contatos)</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.totalRows} contatos)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#8C98B4] block mb-1">
                  Status de Atribuição:
                </label>
                <div className="flex rounded-lg overflow-hidden border border-[#2B3D63]">
                  <button
                    onClick={() => setActionFilter('unassigned')}
                    className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                      actionFilter === 'unassigned'
                        ? 'bg-[#C9A227] text-[#101B2D]'
                        : 'bg-[#101B2D] text-[#8C98B4]'
                    }`}
                  >
                    Sem Atendente ({unassignedContacts.length})
                  </button>
                  <button
                    onClick={() => setActionFilter('assigned')}
                    className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                      actionFilter === 'assigned'
                        ? 'bg-[#C9A227] text-[#101B2D]'
                        : 'bg-[#101B2D] text-[#8C98B4]'
                    }`}
                  >
                    Já Distribuídos ({assignedContacts.length})
                  </button>
                  <button
                    onClick={() => setActionFilter('todos')}
                    className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                      actionFilter === 'todos'
                        ? 'bg-[#C9A227] text-[#101B2D]'
                        : 'bg-[#101B2D] text-[#8C98B4]'
                    }`}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#8C98B4] block mb-1">
                  Atribuir Selecionados para:
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedTargetUser}
                    onChange={(e) => setSelectedTargetUser(e.target.value)}
                    className="flex-1 bg-[#101B2D] border border-[#2B3D63] text-xs text-[#EDE6D6] rounded-lg p-2 focus:outline-none focus:border-[#C9A227]"
                  >
                    <option value="">Escolha o Atendente...</option>
                    {attendants.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.displayName || a.email} (atual: {globalContacts.filter((c) => c.assignedTo === a.uid).length})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignSelected}
                    disabled={isProcessing || selectedContactIds.length === 0 || !selectedTargetUser}
                    className="bg-[#6E8F5C] hover:bg-[#5e7d4d] text-white px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar ({selectedContactIds.length})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table of Contacts ready for distribution */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-xl overflow-hidden shadow-md">
            <div className="p-3 bg-[#101B2D] border-b border-[#2B3D63] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAllFiltered}
                  className="text-xs font-semibold text-[#C9A227] hover:underline cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedContactIds.length === filteredContactsForDistribution.length &&
                  filteredContactsForDistribution.length > 0
                    ? 'Desmarcar Todos'
                    : 'Selecionar Todos (' + filteredContactsForDistribution.length + ')'}
                </button>
                <span className="text-[#8C98B4]">
                  • <b>{selectedContactIds.length}</b> selecionados
                </span>
              </div>

              {selectedContactIds.length > 0 && (
                <button
                  onClick={async () => {
                    if (window.confirm(`Deseja excluir permanentemente ${selectedContactIds.length} contatos selecionados?`)) {
                      await onBatchDeleteContacts(selectedContactIds);
                      setSelectedContactIds([]);
                    }
                  }}
                  className="text-[#B14432] hover:underline text-xs cursor-pointer font-semibold"
                >
                  Excluir Selecionados
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs text-[#EDE6D6]">
                <thead className="bg-[#101B2D] text-[#8C98B4] uppercase text-[10px] font-semibold sticky top-0 border-b border-[#2B3D63]">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">Sel.</th>
                    <th className="py-2.5 px-3">Nome</th>
                    <th className="py-2.5 px-3">WhatsApp</th>
                    <th className="py-2.5 px-3">Curso</th>
                    <th className="py-2.5 px-3">Lote / Origem</th>
                    <th className="py-2.5 px-3">Atendente Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3D63]/40">
                  {filteredContactsForDistribution.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#8C98B4]">
                        Nenhum contato encontrado para estes filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredContactsForDistribution.map((c) => {
                      const isSelected = selectedContactIds.includes(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => {
                            setSelectedContactIds((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#C9A227]/10' : 'hover:bg-[#1F3057]/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-[#2B3D63] text-[#C9A227] focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#EDE6D6]">{c.nome}</td>
                          <td className="py-2.5 px-3 font-mono text-[#8C98B4]">{c.whatsapp}</td>
                          <td className="py-2.5 px-3 text-[#EDE6D6]">{c.curso}</td>
                          <td className="py-2.5 px-3">
                            <span className="bg-[#101B2D] border border-[#2B3D63] text-[11px] px-2 py-0.5 rounded text-[#8C98B4]">
                              {c.batchName || 'Importação Direta'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {c.assignedToEmail ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#6E8F5C] font-semibold bg-[#6E8F5C]/10 border border-[#6E8F5C]/30 px-2 py-0.5 rounded">
                                <UserCheck className="w-3 h-3" />
                                {c.assignedToEmail}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#B14432] font-semibold bg-[#B14432]/10 border border-[#B14432]/30 px-2 py-0.5 rounded">
                                <UserX className="w-3 h-3" />
                                Sem atendente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: 📈 VISÃO GERAL                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {attendants.map((a) => {
              const myContacts = globalContacts.filter((c) => c.assignedTo === a.uid);
              const paidCount = myContacts.filter((c) => c.temperatura === 'Pagou').length;
              const hotCount = myContacts.filter((c) => c.temperatura === 'Quente' || c.temperatura === 'Potencial').length;
              const inactiveCount = myContacts.filter((c) => isWithoutContactFor3Days(c)).length;

              return (
                <div
                  key={a.uid}
                  className="bg-[#172644] border border-[#2B3D63] rounded-xl p-4 shadow-md hover:border-[#C9A227]/50 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {a.photoURL ? (
                      <img
                        src={a.photoURL}
                        alt={a.displayName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full border border-[#C9A227] object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#101B2D] border border-[#2B3D63] flex items-center justify-center font-bold text-[#C9A227]">
                        {(a.displayName || a.email || 'A')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[#EDE6D6] truncate">
                        {a.displayName || 'Atendente'}
                      </h4>
                      <p className="text-xs text-[#8C98B4] truncate">{a.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-[#2B3D63]">
                    <div className="bg-[#101B2D] p-2 rounded-lg">
                      <span className="text-[10px] text-[#8C98B4] block">Total Leads</span>
                      <span className="text-sm font-bold text-[#EDE6D6]">{myContacts.length}</span>
                    </div>
                    <div className="bg-[#101B2D] p-2 rounded-lg">
                      <span className="text-[10px] text-[#C9A227] block">Quentes</span>
                      <span className="text-sm font-bold text-[#C9A227]">{hotCount}</span>
                    </div>
                    <div className="bg-[#101B2D] p-2 rounded-lg">
                      <span className="text-[10px] text-[#6E8F5C] block">Vendas / Pagou</span>
                      <span className="text-sm font-bold text-[#6E8F5C]">{paidCount}</span>
                    </div>
                  </div>

                  {inactiveCount > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#2B3D63]/60 flex items-center justify-between text-xs">
                      <span className="text-[#F87171] font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {inactiveCount} sem resposta (+3d)
                      </span>
                      <button
                        onClick={() => {
                          setAlertAttendantFilter(a.uid);
                          setActiveSubTab('alerts');
                        }}
                        className="text-[#C9A227] hover:underline text-[11px]"
                      >
                        Ver no Radar →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: 📥 IMPORTAR PLANILHAS / PDF / FOTOS VIA IA                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'import_ai' && (
        <div className="space-y-6">
          <div className="bg-[#172644] border border-[#C9A227]/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#C9A227]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#C9A227] uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                Inteligência Artificial de Extração & Reconhecimento
              </div>
              <h3 className="text-2xl font-bold font-serif text-[#EDE6D6]">
                Importador Inteligente de Leads (Planilhas, PDFs, Fotos e Textos)
              </h3>
              <p className="text-sm text-[#8C98B4] max-w-3xl leading-relaxed">
                Carregue qualquer arquivo ou foto de lista de alunos. A IA detecta e extrai automaticamente <strong className="text-[#EDE6D6]">Nomes, Telefones com DDD, Cursos de Interesse, E-mails e Observações</strong>, permitindo que você revise tudo antes de distribuir para sua equipe.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSmartImportModal(true)}
                  className="bg-gradient-to-r from-[#C9A227] to-[#8C6D1F] hover:brightness-110 active:scale-[0.98] text-[#101B2D] font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2.5 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Iniciar Importação com IA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('distribution')}
                  className="bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] font-semibold text-xs px-4 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#C9A227]" />
                  <span>Ver Contatos Não Distribuídos ({unassignedContacts.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Supported Formats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-md flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#101B2D] border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227] mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#EDE6D6]">Planilhas Excel & CSV</h4>
                <p className="text-xs text-[#8C98B4] mt-1.5 leading-relaxed">
                  Arquivos <span className="text-[#EDE6D6]">.xlsx, .xls ou .csv</span> com cabeçalhos padronizados ou desorganizados. A IA reconhece sinônimos de colunas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSmartImportModal(true)}
                className="mt-4 text-xs font-semibold text-[#C9A227] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Importar Planilha →
              </button>
            </div>

            <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-md flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#101B2D] border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227] mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#EDE6D6]">Documentos em PDF</h4>
                <p className="text-xs text-[#8C98B4] mt-1.5 leading-relaxed">
                  Listas de inscritos, relatórios de cursos ou formulários salvos em <span className="text-[#EDE6D6]">.pdf</span>. O sistema lê as páginas e extrai os contatos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSmartImportModal(true)}
                className="mt-4 text-xs font-semibold text-[#C9A227] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Importar PDF →
              </button>
            </div>

            <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-md flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#101B2D] border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227] mb-3">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#EDE6D6]">Fotos, Prints & Câmera</h4>
                <p className="text-xs text-[#8C98B4] mt-1.5 leading-relaxed">
                  Fotografias de cadernos, anotações de balcão, prints do WhatsApp ou fotos de formulários <span className="text-[#EDE6D6]">(.png, .jpg, .jpeg)</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSmartImportModal(true)}
                className="mt-4 text-xs font-semibold text-[#C9A227] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Importar Foto →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Import Modal */}
      <SmartImportModal
        isOpen={showSmartImportModal}
        onClose={() => setShowSmartImportModal(false)}
        onConfirmImport={async (res) => {
          if (onImportSmartContacts) {
            await onImportSmartContacts(res);
          }
          setShowSmartImportModal(false);
          setActiveSubTab('distribution');
        }}
        existingContacts={globalContacts}
        users={users}
        currentProfile={currentProfile}
      />
    </div>
  );
};

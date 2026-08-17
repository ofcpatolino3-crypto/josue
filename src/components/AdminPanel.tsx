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
  Search,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Send,
  TrendingUp,
  ExternalLink,
  Bell,
  Check,
  Download,
  Plus,
  Zap,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  UserPlus,
  RotateCcw,
  Briefcase,
  HelpCircle,
} from 'lucide-react';
import { UserProfile, Contact, LeadBatch, UserRole } from '../types';
import { SmartImportModal, SmartImportResult } from './SmartImportModal';
import {
  isWithoutContactFor3Days,
  getContactInactivityStatus,
  getDaysWithoutContact,
  formatDateBR,
  openWhatsAppDirect,
  todayStr,
  exportSupervisorContactsToExcel,
} from '../utils/excel';

interface AdminPanelProps {
  currentProfile: UserProfile | null;
  users: UserProfile[];
  globalContacts: Contact[];
  batches: LeadBatch[];
  onApproveUser: (uid: string, role: UserRole) => Promise<void>;
  onBlockUser: (uid: string) => Promise<void>;
  onChangeUserRole: (uid: string, role: UserRole) => Promise<void>;
  onCreateUserByAdmin?: (name: string, emailOrUser: string, pass: string, role: UserRole) => Promise<boolean | string>;
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
  // Main Navigation Tabs
  const [activeTab, setActiveTab] = useState<'distribution' | 'alerts' | 'activity' | 'users'>('distribution');
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Distribution Sub-tools & Controls
  const [distributionMode, setDistributionMode] = useState<'round_robin' | 'manual_select' | 'by_course' | 'transfer_portfolio'>('round_robin');
  const [selectedAttendantsForRoleta, setSelectedAttendantsForRoleta] = useState<string[]>([]);
  const [customAmountToDistribute, setCustomAmountToDistribute] = useState<number>(20);
  const [targetAttendantForCustom, setTargetAttendantForCustom] = useState<string>('');
  
  // By Course routing
  const [selectedCourseForRouting, setSelectedCourseForRouting] = useState<string>('');
  const [targetAttendantForCourse, setTargetAttendantForCourse] = useState<string>('');

  // Transfer whole portfolio
  const [portfolioSourceUser, setPortfolioSourceUser] = useState<string>('');
  const [portfolioTargetUser, setPortfolioTargetUser] = useState<string>('');

  // Distribution Table Filters
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('todos');
  const [selectedTargetUser, setSelectedTargetUser] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<'todos' | 'unassigned' | 'assigned' | 'alerts'>('unassigned');
  const [distributionSearch, setDistributionSearch] = useState('');

  // Alerts Tab Filters
  const [alertSearch, setAlertSearch] = useState('');
  const [alertAttendantFilter, setAlertAttendantFilter] = useState('todos');
  const [alertDaysFilter, setAlertDaysFilter] = useState<'all' | '3to5' | '5to10' | '10plus'>('all');
  const [reassignTargetByContact, setReassignTargetByContact] = useState<Record<string, string>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Users Tab
  const [userSearch, setUserSearch] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('123456');
  const [newUserRole, setNewUserRole] = useState<UserRole>('attendant');
  const [createUserError, setCreateUserError] = useState('');

  // Computed Users Lists
  const pendingUsers = useMemo(() => users.filter((u) => u.status === 'pending'), [users]);
  const activeStaff = useMemo(() => users.filter((u) => u.status === 'approved' && (u.role === 'attendant' || u.role === 'supervisor')), [users]);
  const attendants = useMemo(() => users.filter((u) => u.status === 'approved' && u.role === 'attendant'), [users]);
  const allApprovedUsers = useMemo(() => users.filter((u) => u.status === 'approved'), [users]);

  // Initializing default checked attendants for Roleta (all approved attendants)
  React.useEffect(() => {
    if (attendants.length > 0 && selectedAttendantsForRoleta.length === 0) {
      setSelectedAttendantsForRoleta(attendants.map((a) => a.uid));
    }
  }, [attendants]);

  // Base Contacts pools
  const unassignedContacts = useMemo(() => globalContacts.filter((c) => !c.assignedTo), [globalContacts]);
  const assignedContacts = useMemo(() => globalContacts.filter((c) => !!c.assignedTo), [globalContacts]);

  // 3+ Days Inactivity Alert Contacts
  const inactiveAlertContacts = useMemo(() => {
    return globalContacts
      .filter((c) => isWithoutContactFor3Days(c))
      .sort((a, b) => getDaysWithoutContact(b) - getDaysWithoutContact(a));
  }, [globalContacts]);

  // Filtered Alert Contacts
  const filteredAlertContacts = useMemo(() => {
    return inactiveAlertContacts.filter((c) => {
      if (alertAttendantFilter !== 'todos') {
        if (alertAttendantFilter === 'unassigned' && c.assignedTo) return false;
        if (alertAttendantFilter !== 'unassigned' && c.assignedTo !== alertAttendantFilter) return false;
      }
      const days = getDaysWithoutContact(c);
      if (alertDaysFilter === '3to5' && (days < 3 || days > 5)) return false;
      if (alertDaysFilter === '5to10' && (days < 5 || days > 10)) return false;
      if (alertDaysFilter === '10plus' && days < 10) return false;

      if (alertSearch.trim()) {
        const q = alertSearch.toLowerCase();
        const matchName = (c.nome || '').toLowerCase().includes(q);
        const matchWpp = (c.whatsapp || '').includes(q);
        const matchCurso = (c.curso || '').toLowerCase().includes(q);
        const matchEmail = (c.assignedToEmail || '').toLowerCase().includes(q);
        if (!matchName && !matchWpp && !matchCurso && !matchEmail) return false;
      }
      return true;
    });
  }, [inactiveAlertContacts, alertAttendantFilter, alertDaysFilter, alertSearch]);

  // Today stats
  const today = todayStr();
  const todayInteractedCount = useMemo(() => {
    return globalContacts.filter((c) => {
      if (c.ultimoContato === today) return true;
      if (c.lastMessageAt && Date.now() - c.lastMessageAt < 24 * 60 * 60 * 1000) return true;
      return false;
    }).length;
  }, [globalContacts, today]);

  // Courses available among unassigned leads
  const unassignedCoursesList = useMemo(() => {
    const counts: Record<string, number> = {};
    unassignedContacts.forEach((c) => {
      const course = c.curso?.trim() || 'Sem Curso Informado';
      counts[course] = (counts[course] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [unassignedContacts]);

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
    }).sort((a, b) => b.totalLeads - a.totalLeads);
  }, [attendants, globalContacts, today]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

  // Filtered Contacts for Distribution Table
  const filteredContactsForDistribution = useMemo(() => {
    return globalContacts.filter((c) => {
      if (selectedBatchFilter !== 'todos' && c.batchName !== selectedBatchFilter) return false;
      if (actionFilter === 'unassigned' && c.assignedTo) return false;
      if (actionFilter === 'assigned' && !c.assignedTo) return false;
      if (actionFilter === 'alerts' && !isWithoutContactFor3Days(c)) return false;
      if (distributionSearch.trim()) {
        const q = distributionSearch.toLowerCase();
        const mName = (c.nome || '').toLowerCase().includes(q);
        const mWpp = (c.whatsapp || '').includes(q);
        const mCur = (c.curso || '').toLowerCase().includes(q);
        const mAss = (c.assignedToEmail || '').toLowerCase().includes(q);
        if (!mName && !mWpp && !mCur && !mAss) return false;
      }
      return true;
    });
  }, [globalContacts, selectedBatchFilter, actionFilter, distributionSearch]);

  // Toast Helper
  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  // --- ACTIONS ---

  // 1. Roleta / Equitative Division
  const handleExecuteRoletaDistribution = async () => {
    const selectedUsers = attendants.filter((a) => selectedAttendantsForRoleta.includes(a.uid));
    if (selectedUsers.length === 0) {
      showNotification('Selecione pelo menos um atendente para participar da divisão.', true);
      return;
    }
    if (unassignedContacts.length === 0) {
      showNotification('Não há leads livres disponíveis para distribuição no momento.', true);
      return;
    }

    const leadsPerPerson = Math.floor(unassignedContacts.length / selectedUsers.length);
    const confirmText = `Deseja dividir ${unassignedContacts.length} leads livres igualmente entre os ${selectedUsers.length} atendentes selecionados (~${leadsPerPerson} leads para cada)?`;
    
    if (!window.confirm(confirmText)) return;

    setIsProcessing(true);
    try {
      await onDistributeEqually(unassignedContacts, selectedUsers);
      showNotification(`⚡ Sucesso! ${unassignedContacts.length} leads foram divididos igualmente entre ${selectedUsers.length} atendentes.`);
    } catch (e: any) {
      showNotification('Erro na divisão de leads: ' + e.message, true);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Custom Amount Distribution
  const handleExecuteCustomAmountDistribution = async () => {
    if (!targetAttendantForCustom) {
      showNotification('Selecione o atendente que receberá os leads.', true);
      return;
    }
    const targetUser = users.find((u) => u.uid === targetAttendantForCustom);
    if (!targetUser) return;

    if (unassignedContacts.length === 0) {
      showNotification('Não há leads livres disponíveis.', true);
      return;
    }

    const amount = Math.min(Math.max(1, customAmountToDistribute), unassignedContacts.length);
    const sliceToAssign = unassignedContacts.slice(0, amount);

    setIsProcessing(true);
    try {
      await onDistributeContacts(sliceToAssign, targetUser.uid, targetUser.email);
      showNotification(`✅ ${sliceToAssign.length} leads atribuídos para ${targetUser.displayName || targetUser.email}!`);
    } catch (e: any) {
      showNotification('Erro ao atribuir leads: ' + e.message, true);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. By Course Routing
  const handleExecuteCourseRouting = async () => {
    if (!selectedCourseForRouting) {
      showNotification('Selecione o concurso para roteamento.', true);
      return;
    }
    if (!targetAttendantForCourse) {
      showNotification('Selecione o atendente especialista que receberá os leads.', true);
      return;
    }
    const targetUser = users.find((u) => u.uid === targetAttendantForCourse);
    if (!targetUser) return;

    const courseLeads = unassignedContacts.filter((c) => {
      const cName = c.curso?.trim() || 'Sem Curso Informado';
      return cName === selectedCourseForRouting;
    });

    if (courseLeads.length === 0) {
      showNotification('Nenhum lead livre encontrado para este concurso.', true);
      return;
    }

    setIsProcessing(true);
    try {
      await onDistributeContacts(courseLeads, targetUser.uid, targetUser.email);
      showNotification(`🎯 ${courseLeads.length} leads do concurso "${selectedCourseForRouting}" foram atribuídos para ${targetUser.displayName || targetUser.email}!`);
    } catch (e: any) {
      showNotification('Erro ao distribuir por curso: ' + e.message, true);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Transfer whole portfolio
  const handleExecutePortfolioTransfer = async () => {
    if (!portfolioSourceUser) {
      showNotification('Selecione o atendente de origem (quem vai transferir).', true);
      return;
    }
    if (!portfolioTargetUser) {
      showNotification('Selecione o destino da carteira.', true);
      return;
    }
    if (portfolioSourceUser === portfolioTargetUser) {
      showNotification('A origem e o destino não podem ser o mesmo atendente.', true);
      return;
    }

    const sourceLeads = globalContacts.filter((c) => c.assignedTo === portfolioSourceUser);
    if (sourceLeads.length === 0) {
      showNotification('O atendente de origem não possui leads atribuídos.', true);
      return;
    }

    const sourceUser = users.find((u) => u.uid === portfolioSourceUser);

    if (portfolioTargetUser === 'ROULETTE_EQUIP') {
      // Divide among all other attendants
      const otherAttendants = attendants.filter((a) => a.uid !== portfolioSourceUser);
      if (otherAttendants.length === 0) {
        showNotification('Não há outros atendentes para receber os contatos.', true);
        return;
      }
      if (!window.confirm(`Transferir todos os ${sourceLeads.length} contatos de ${sourceUser?.displayName || 'origem'} e dividi-los igualmente entre os ${otherAttendants.length} outros atendentes?`)) {
        return;
      }

      setIsProcessing(true);
      try {
        await onDistributeEqually(sourceLeads, otherAttendants);
        showNotification(`🔄 Toda a carteira (${sourceLeads.length} leads) de ${sourceUser?.displayName} foi redistribuída na equipe!`);
      } catch (e: any) {
        showNotification('Erro na transferência: ' + e.message, true);
      } finally {
        setIsProcessing(false);
      }
    } else {
      const targetUser = users.find((u) => u.uid === portfolioTargetUser);
      if (!targetUser) return;

      if (!window.confirm(`Transferir todos os ${sourceLeads.length} contatos de ${sourceUser?.displayName || 'origem'} para ${targetUser.displayName || targetUser.email}?`)) {
        return;
      }

      setIsProcessing(true);
      try {
        await onDistributeContacts(sourceLeads, targetUser.uid, targetUser.email);
        showNotification(`🔄 ${sourceLeads.length} contatos transferidos de ${sourceUser?.displayName} para ${targetUser.displayName || targetUser.email}!`);
      } catch (e: any) {
        showNotification('Erro na transferência: ' + e.message, true);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // 5. Manual table selection assign
  const handleAssignSelectedFromTable = async () => {
    if (!selectedTargetUser) {
      showNotification('Selecione o atendente que receberá os contatos.', true);
      return;
    }
    const target = users.find((u) => u.uid === selectedTargetUser);
    if (!target) return;

    const contactsToAssign = globalContacts.filter((c) => selectedContactIds.includes(c.id));
    if (contactsToAssign.length === 0) {
      showNotification('Nenhum contato selecionado na tabela.', true);
      return;
    }

    setIsProcessing(true);
    try {
      await onDistributeContacts(contactsToAssign, target.uid, target.email);
      setSelectedContactIds([]);
      showNotification(`✅ ${contactsToAssign.length} contatos atribuídos para ${target.displayName || target.email}!`);
    } catch (e: any) {
      showNotification('Erro ao distribuir: ' + e.message, true);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Single contact transfer
  const handleReassignSingle = async (contactId: string) => {
    const targetUid = reassignTargetByContact[contactId];
    if (!targetUid) {
      showNotification('Selecione o atendente para transferir.', true);
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
      showNotification(`Contato transferido com sucesso para ${target.displayName || target.email}!`);
    } catch (e: any) {
      showNotification('Erro ao transferir contato: ' + e.message, true);
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Bulk reassign all inactive
  const handleBulkReassignAllInactive = async () => {
    if (inactiveAlertContacts.length === 0) {
      showNotification('Não há contatos parados há 3 ou mais dias.', true);
      return;
    }
    if (attendants.length === 0) {
      showNotification('Não há atendentes cadastrados para receber os contatos.', true);
      return;
    }

    const confirmMsg = `Deseja pegar todos os ${inactiveAlertContacts.length} leads parados (+3 dias) e dividi-los igualmente entre os ${attendants.length} atendentes da equipe?`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await onDistributeEqually(inactiveAlertContacts, attendants);
      showNotification(`🚨 ${inactiveAlertContacts.length} leads parados foram reciclados e divididos igualmente!`);
    } catch (e: any) {
      showNotification('Erro ao redistribuir: ' + e.message, true);
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
    const text = `🚨 *ALERTA DE ATENDIMENTO - PORTAL CONCURSO*\n\nOlá, *${attendantName}*!\nO aluno *${contact.nome || 'Lead'}* (${contact.whatsapp}) está há *${days} dias sem resposta ou contato* no painel.\n\nPor favor, envie uma mensagem agora para dar andamento e não perder a matrícula! 🎯`;
    navigator.clipboard.writeText(text);
    setCopiedMessageId(contact.id);
    showNotification(`Mensagem de cobrança copiada para a área de transferência!`);
    setTimeout(() => setCopiedMessageId(null), 3000);
  };

  // Supervisor Export
  const handleExportSupervisorAll = async () => {
    if (globalContacts.length === 0) {
      showNotification('Não há contatos cadastrados para exportar.', true);
      return;
    }
    setIsProcessing(true);
    try {
      await exportSupervisorContactsToExcel(globalContacts, 'Base_Geral_Supervisao');
      showNotification(`Planilha de Supervisão com ${globalContacts.length} contatos exportada!`);
    } catch (e: any) {
      showNotification('Erro ao exportar planilha: ' + e.message, true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle attendant in Roleta
  const toggleAttendantInRoleta = (uid: string) => {
    setSelectedAttendantsForRoleta((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const selectAllAttendantsInRoleta = () => {
    setSelectedAttendantsForRoleta(attendants.map((a) => a.uid));
  };

  const clearAllAttendantsInRoleta = () => {
    setSelectedAttendantsForRoleta([]);
  };

  return (
    <div className="space-y-5" id="admin-panel-container">
      {/* Toast Feedback */}
      {successMsg && (
        <div className="bg-[#10B981]/20 border border-[#10B981] text-white p-3.5 rounded-xl flex items-center gap-3 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-[#DC2626]/20 border border-[#DC2626] text-white p-3.5 rounded-xl flex items-center gap-3 animate-fade-in shadow-lg">
          <XCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* 1. Header & Quick Actions Bar */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/50 px-3 py-1 rounded-full uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                {currentProfile?.role === 'admin' ? '👑 Painel Administrador Master' : '🛡️ Painel de Supervisão & Vendas'}
              </span>
              <span className="text-xs text-[#8C98B4]">
                • Supervisor: <strong className="text-white">{currentProfile?.displayName || currentProfile?.email}</strong>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#EDE6D6] tracking-tight">
              Central de Divisão de Leads & Gestão de Vendedores
            </h2>
            <p className="text-xs text-[#8C98B4]">
              Distribua leads por roleta equitativa, acompanhe o radar de inatividade (+3 dias) e monitore o desempenho da equipe.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSmartImportModal(true)}
              className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Importar Planilha (Excel / CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleExportSupervisorAll}
              disabled={isProcessing || globalContacts.length === 0}
              className="flex items-center gap-1.5 bg-[#101B2D] hover:bg-[#1F3057] text-[#EDE6D6] border border-[#2B3D63] px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Exportar planilha Excel completa de supervisão"
            >
              <Download className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Exportar Base Completa</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Counters - High Contrast Color-Coded Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#2B3D63]/70">
          {/* Card 1: Piscina de Leads Livres */}
          <div
            onClick={() => {
              setActiveTab('distribution');
              setActionFilter('unassigned');
            }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              unassignedContacts.length > 0
                ? 'bg-[#C9A227]/15 border-[#C9A227] shadow-[0_0_15px_rgba(201,162,39,0.15)] ring-1 ring-[#C9A227]/50'
                : 'bg-[#101B2D] border-[#2B3D63]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#FCD34D] uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#C9A227]" /> Leads Livres (Estoque)
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {unassignedContacts.length}
              </span>
              <span className="text-[11px] text-[#C9A227] font-semibold">
                aguardando divisão
              </span>
            </div>
          </div>

          {/* Card 2: Radar de Inatividade */}
          <div
            onClick={() => setActiveTab('alerts')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              inactiveAlertContacts.length > 0
                ? 'bg-[#DC2626]/20 border-[#DC2626] shadow-[0_0_15px_rgba(220,38,38,0.2)] ring-1 ring-[#DC2626]/60'
                : 'bg-[#101B2D] border-[#2B3D63]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#FCA5A5] uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" /> Leads Parados (+3d)
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className={`text-2xl sm:text-3xl font-extrabold ${inactiveAlertContacts.length > 0 ? 'text-[#F87171]' : 'text-white'}`}>
                {inactiveAlertContacts.length}
              </span>
              {inactiveAlertContacts.length > 0 && (
                <span className="text-[11px] bg-[#DC2626] text-white px-1.5 py-0.2 rounded font-bold">
                  Cobrar Vendedor
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Interações Hoje */}
          <div
            onClick={() => setActiveTab('activity')}
            className="p-3.5 rounded-xl border border-[#2B3D63] bg-[#101B2D] hover:border-[#10B981] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#86EFAC] uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" /> Atendimentos Hoje
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#4ADE80]">
                {todayInteractedCount}
              </span>
              <span className="text-[11px] text-[#8C98B4]">interações ativas</span>
            </div>
          </div>

          {/* Card 4: Equipe de Atendentes */}
          <div
            onClick={() => setActiveTab('users')}
            className="p-3.5 rounded-xl border border-[#2B3D63] bg-[#101B2D] hover:border-[#C9A227] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#8C98B4] uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#C9A227]" /> Atendentes Ativos
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#EDE6D6]">
                {attendants.length}
              </span>
              {pendingUsers.length > 0 ? (
                <span className="text-[10px] bg-[#DC2626] text-white px-1.5 py-0.5 rounded font-bold">
                  {pendingUsers.length} pendente(s)
                </span>
              ) : (
                <span className="text-[11px] text-[#8C98B4]">na equipe</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Visual Top Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2B3D63] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('distribution')}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm ${
            activeTab === 'distribution'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md ring-2 ring-[#C9A227]/40'
              : 'text-[#8C98B4] hover:text-white hover:bg-[#172644]'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Central de Divisão & Roleta de Leads</span>
          {unassignedContacts.length > 0 && (
            <span className="bg-[#101B2D] text-[#C9A227] text-[11px] px-2 py-0.5 rounded-full font-extrabold">
              {unassignedContacts.length} livres
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'alerts'
              ? 'bg-[#DC2626] text-white shadow-md ring-2 ring-[#DC2626]/40'
              : 'text-[#8C98B4] hover:text-white hover:bg-[#172644]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Radar de Inatividade (+3 Dias)</span>
          {inactiveAlertContacts.length > 0 && (
            <span className="bg-white text-[#DC2626] text-[10px] px-2 py-0.5 rounded-full font-extrabold animate-pulse">
              {inactiveAlertContacts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[#8C98B4] hover:text-white hover:bg-[#172644]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Produtividade & Desempenho da Equipe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#1F3057] text-[#EDE6D6] border border-[#C9A227]/50 shadow-md'
              : 'text-[#8C98B4] hover:text-white hover:bg-[#172644]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Equipe & Permissões</span>
          {pendingUsers.length > 0 && (
            <span className="bg-[#DC2626] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ⚡ CENTRAL DE DIVISÃO & ROLETA DE LEADS                           */}
      {/* ========================================================================= */}
      {activeTab === 'distribution' && (
        <div className="space-y-5">
          {/* Sub-modes selector */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2B3D63] pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#C9A227]" />
                  Como você deseja fazer a distribuição agora?
                </h3>
                <p className="text-xs text-[#8C98B4]">
                  Escolha o modo de divisão mais conveniente para a rotina de supervisão.
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8C98B4]">Leads Livres:</span>
                <span className="text-sm font-extrabold text-[#C9A227] bg-[#101B2D] border border-[#C9A227]/40 px-2.5 py-1 rounded-lg">
                  {unassignedContacts.length} disponíveis
                </span>
              </div>
            </div>

            {/* 4 Tool Modes Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setDistributionMode('round_robin')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  distributionMode === 'round_robin'
                    ? 'bg-[#C9A227]/20 border-[#C9A227] ring-1 ring-[#C9A227]'
                    : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <Zap className={`w-4 h-4 ${distributionMode === 'round_robin' ? 'text-[#C9A227]' : 'text-[#8C98B4]'}`} />
                  <span>1. Roleta Equitativa</span>
                </div>
                <p className="text-[11px] text-[#8C98B4] mt-1">
                  Divide os leads livres em partes iguais entre os atendentes selecionados.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('by_course')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  distributionMode === 'by_course'
                    ? 'bg-[#C9A227]/20 border-[#C9A227] ring-1 ring-[#C9A227]'
                    : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <Briefcase className={`w-4 h-4 ${distributionMode === 'by_course' ? 'text-[#C9A227]' : 'text-[#8C98B4]'}`} />
                  <span>2. Por Concurso / Cargo</span>
                </div>
                <p className="text-[11px] text-[#8C98B4] mt-1">
                  Envia todos os leads de um concurso específico para um vendedor especialista.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('manual_select')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  distributionMode === 'manual_select'
                    ? 'bg-[#C9A227]/20 border-[#C9A227] ring-1 ring-[#C9A227]'
                    : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <Send className={`w-4 h-4 ${distributionMode === 'manual_select' ? 'text-[#C9A227]' : 'text-[#8C98B4]'}`} />
                  <span>3. Lote por Quantidade</span>
                </div>
                <p className="text-[11px] text-[#8C98B4] mt-1">
                  Passa um número exato (ex: 20 ou 50 leads) para um vendedor escolhido.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('transfer_portfolio')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  distributionMode === 'transfer_portfolio'
                    ? 'bg-[#DC2626]/20 border-[#DC2626] ring-1 ring-[#DC2626]'
                    : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <RotateCcw className={`w-4 h-4 ${distributionMode === 'transfer_portfolio' ? 'text-[#F87171]' : 'text-[#8C98B4]'}`} />
                  <span>4. Transferir Carteira</span>
                </div>
                <p className="text-[11px] text-[#8C98B4] mt-1">
                  Remaneja todos os contatos de um vendedor ausente para outro ou para a equipe.
                </p>
              </button>
            </div>

            {/* --- TOOL PANEL: 1. ROLETA EQUITATIVA (ROUND ROBIN) --- */}
            {distributionMode === 'round_robin' && (
              <div className="bg-[#101B2D] border border-[#C9A227]/40 rounded-xl p-4.5 space-y-4 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#2B3D63]">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#C9A227]" />
                      Divisão Balanceada / Roleta Automática
                    </h4>
                    <p className="text-xs text-[#8C98B4] mt-0.5">
                      Marque quem vai receber leads nesta rodada. Se um vendedor faltou, desmarque-o abaixo.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllAttendantsInRoleta}
                      className="text-xs text-[#C9A227] hover:underline font-semibold cursor-pointer"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-[#2B3D63]">|</span>
                    <button
                      type="button"
                      onClick={clearAllAttendantsInRoleta}
                      className="text-xs text-[#8C98B4] hover:underline cursor-pointer"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                {/* Attendants Checklist Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {attendants.length === 0 ? (
                    <div className="col-span-full py-4 text-center text-xs text-[#8C98B4]">
                      Nenhum atendente cadastrado e aprovado no momento. Cadastre atendentes na aba "Equipe & Permissões".
                    </div>
                  ) : (
                    attendants.map((a) => {
                      const isChecked = selectedAttendantsForRoleta.includes(a.uid);
                      const myCount = globalContacts.filter((c) => c.assignedTo === a.uid).length;

                      return (
                        <div
                          key={a.uid}
                          onClick={() => toggleAttendantInRoleta(a.uid)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                            isChecked
                              ? 'bg-[#C9A227]/15 border-[#C9A227] text-white shadow-sm'
                              : 'bg-[#172644] border-[#2B3D63] text-[#8C98B4] opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-[#C9A227] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-[#8C98B4] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {a.displayName || a.email}
                              </div>
                              <div className="text-[10px] text-[#8C98B4]">
                                Carteira atual: <strong className="text-[#C9A227]">{myCount} leads</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Calculation Box & Action Button */}
                <div className="bg-[#172644] p-4 rounded-xl border border-[#2B3D63] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-[#8C98B4]">Cálculo da Divisão:</div>
                    <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                      <span className="text-[#C9A227] font-extrabold">{unassignedContacts.length} leads livres</span>
                      <span>÷</span>
                      <span className="text-[#38BDF8] font-extrabold">{selectedAttendantsForRoleta.length} atendente(s)</span>
                      <span>=</span>
                      <span className="bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40 px-2.5 py-0.5 rounded font-extrabold text-sm">
                        {selectedAttendantsForRoleta.length > 0
                          ? `~${Math.floor(unassignedContacts.length / selectedAttendantsForRoleta.length)} leads para cada`
                          : 'Selecione atendentes'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteRoletaDistribution}
                    disabled={isProcessing || unassignedContacts.length === 0 || selectedAttendantsForRoleta.length === 0}
                    className="bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] font-extrabold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Executar Divisão Automática Agora</span>
                  </button>
                </div>
              </div>
            )}

            {/* --- TOOL PANEL: 2. POR CONCURSO / CARGO --- */}
            {distributionMode === 'by_course' && (
              <div className="bg-[#101B2D] border border-[#C9A227]/40 rounded-xl p-4.5 space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#C9A227]" />
                    Distribuição Especializada por Concurso
                  </h4>
                  <p className="text-xs text-[#8C98B4] mt-0.5">
                    Envie todos os alunos interessados em um concurso específico direto para o vendedor especialista.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                      1. Escolha o Concurso / Turma:
                    </label>
                    <select
                      value={selectedCourseForRouting}
                      onChange={(e) => setSelectedCourseForRouting(e.target.value)}
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#C9A227]"
                    >
                      <option value="">Selecione o concurso...</option>
                      {unassignedCoursesList.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.count} leads disponíveis)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                      2. Atendente Especialista:
                    </label>
                    <select
                      value={targetAttendantForCourse}
                      onChange={(e) => setTargetAttendantForCourse(e.target.value)}
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#C9A227]"
                    >
                      <option value="">Selecione o atendente...</option>
                      {attendants.map((a) => (
                        <option key={a.uid} value={a.uid}>
                          {a.displayName || a.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteCourseRouting}
                    disabled={isProcessing || !selectedCourseForRouting || !targetAttendantForCourse}
                    className="bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span>Atribuir Todos Deste Concurso</span>
                  </button>
                </div>
              </div>
            )}

            {/* --- TOOL PANEL: 3. LOTE POR QUANTIDADE --- */}
            {distributionMode === 'manual_select' && (
              <div className="bg-[#101B2D] border border-[#C9A227]/40 rounded-xl p-4.5 space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#C9A227]" />
                    Atribuição por Quantidade Específica
                  </h4>
                  <p className="text-xs text-[#8C98B4] mt-0.5">
                    Defina quantos leads livres serão entregues para um vendedor específico agora.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                      Quantidade de Leads:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={unassignedContacts.length || 1}
                        value={customAmountToDistribute}
                        onChange={(e) => setCustomAmountToDistribute(Number(e.target.value))}
                        className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#C9A227] font-bold"
                      />
                      <div className="flex gap-1">
                        {[10, 25, 50, 100].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setCustomAmountToDistribute(num)}
                            className="text-[10px] bg-[#172644] hover:bg-[#2B3D63] text-[#EDE6D6] px-2 py-1.5 rounded border border-[#2B3D63] cursor-pointer"
                          >
                            +{num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-5">
                    <label className="text-xs font-semibold text-[#8C98B4] block mb-1">
                      Atendente de Destino:
                    </label>
                    <select
                      value={targetAttendantForCustom}
                      onChange={(e) => setTargetAttendantForCustom(e.target.value)}
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#C9A227]"
                    >
                      <option value="">Selecione o atendente...</option>
                      {attendants.map((a) => (
                        <option key={a.uid} value={a.uid}>
                          {a.displayName || a.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="button"
                      onClick={handleExecuteCustomAmountDistribution}
                      disabled={isProcessing || !targetAttendantForCustom || unassignedContacts.length === 0}
                      className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Entregar Leads</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- TOOL PANEL: 4. TRANSFERIR CARTEIRA --- */}
            {distributionMode === 'transfer_portfolio' && (
              <div className="bg-[#101B2D] border border-[#DC2626]/50 rounded-xl p-4.5 space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-[#F87171]" />
                    Remanejamento Total de Carteira
                  </h4>
                  <p className="text-xs text-[#8C98B4] mt-0.5">
                    Transfira todos os contatos de um vendedor (que faltou ou saiu) para outro atendente ou divida na equipe.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="text-xs font-semibold text-[#F87171] block mb-1">
                      1. Vendedor de Origem (Quem vai passar os leads):
                    </label>
                    <select
                      value={portfolioSourceUser}
                      onChange={(e) => setPortfolioSourceUser(e.target.value)}
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#DC2626]"
                    >
                      <option value="">Selecione o vendedor de origem...</option>
                      {attendants.map((a) => {
                        const count = globalContacts.filter((c) => c.assignedTo === a.uid).length;
                        return (
                          <option key={a.uid} value={a.uid}>
                            {a.displayName || a.email} ({count} leads)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-center pt-5">
                    <ArrowRight className="w-6 h-6 text-[#C9A227] hidden sm:block" />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="text-xs font-semibold text-[#34D399] block mb-1">
                      2. Destino da Carteira:
                    </label>
                    <select
                      value={portfolioTargetUser}
                      onChange={(e) => setPortfolioTargetUser(e.target.value)}
                      className="w-full bg-[#172644] border border-[#2B3D63] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#10B981]"
                    >
                      <option value="">Selecione o destino...</option>
                      <option value="ROULETTE_EQUIP">⚡ Dividir Igualmente entre Todos os Outros Atendentes</option>
                      {attendants
                        .filter((a) => a.uid !== portfolioSourceUser)
                        .map((a) => (
                          <option key={a.uid} value={a.uid}>
                            {a.displayName || a.email}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleExecutePortfolioTransfer}
                    disabled={isProcessing || !portfolioSourceUser || !portfolioTargetUser}
                    className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirmar Transferência de Carteira</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table Controls & Filter Bar */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#C9A227]" />
                  Tabela Geral de Leads & Seleção Manual
                </h3>
                <p className="text-xs text-[#8C98B4]">
                  Filtre, pesquise e selecione contatos individualmente para redistribuição.
                </p>
              </div>

              {/* Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 bg-[#101B2D] p-1 rounded-xl border border-[#2B3D63]">
                <button
                  type="button"
                  onClick={() => setActionFilter('unassigned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    actionFilter === 'unassigned'
                      ? 'bg-[#C9A227] text-[#101B2D] shadow-sm'
                      : 'text-[#8C98B4] hover:text-white'
                  }`}
                >
                  ⚡ Livres ({unassignedContacts.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActionFilter('assigned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    actionFilter === 'assigned'
                      ? 'bg-[#C9A227] text-[#101B2D] shadow-sm'
                      : 'text-[#8C98B4] hover:text-white'
                  }`}
                >
                  🧑‍💼 Atribuídos ({assignedContacts.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActionFilter('alerts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    actionFilter === 'alerts'
                      ? 'bg-[#DC2626] text-white shadow-sm'
                      : 'text-[#F87171] hover:text-white'
                  }`}
                >
                  🚨 Parados +3d ({inactiveAlertContacts.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActionFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    actionFilter === 'todos'
                      ? 'bg-[#C9A227] text-[#101B2D] shadow-sm'
                      : 'text-[#8C98B4] hover:text-white'
                  }`}
                >
                  Todos ({globalContacts.length})
                </button>
              </div>
            </div>

            {/* Search & Actions on Selected */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-[#2B3D63]">
              <div className="sm:col-span-5 relative">
                <Search className="w-3.5 h-3.5 text-[#8C98B4] absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone, curso ou atendente..."
                  value={distributionSearch}
                  onChange={(e) => setDistributionSearch(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-white text-xs pl-8 pr-3 py-2 rounded-lg focus:outline-none focus:border-[#C9A227]"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={selectedBatchFilter}
                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="todos">Todos os Lotes / Origens</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.totalLeads || b.distributedLeads} leads)
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4 flex gap-1.5">
                <select
                  value={selectedTargetUser}
                  onChange={(e) => setSelectedTargetUser(e.target.value)}
                  className="flex-1 bg-[#101B2D] border border-[#2B3D63] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="">Atendente de Destino...</option>
                  {attendants.map((a) => (
                    <option key={a.uid} value={a.uid}>
                      {a.displayName || a.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssignSelectedFromTable}
                  disabled={isProcessing || selectedContactIds.length === 0 || !selectedTargetUser}
                  className="bg-[#10B981] hover:bg-[#059669] text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar ({selectedContactIds.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Distribution Contacts Table */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 bg-[#101B2D] border-b border-[#2B3D63] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-xs font-semibold text-[#C9A227] hover:underline cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedContactIds.length === filteredContactsForDistribution.length &&
                  filteredContactsForDistribution.length > 0
                    ? 'Desmarcar Todos'
                    : `Selecionar Todos (${filteredContactsForDistribution.length})`}
                </button>
                <span className="text-[#8C98B4]">
                  • <b>{selectedContactIds.length}</b> selecionado(s)
                </span>
              </div>

              {selectedContactIds.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Excluir permanentemente os ${selectedContactIds.length} contatos selecionados?`)) {
                      await onBatchDeleteContacts(selectedContactIds);
                      setSelectedContactIds([]);
                      showNotification(`${selectedContactIds.length} contatos excluídos.`);
                    }
                  }}
                  className="text-[#F87171] hover:underline text-xs cursor-pointer font-semibold"
                >
                  Excluir Selecionados ({selectedContactIds.length})
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#101B2D] text-[#8C98B4] uppercase text-[10px] font-semibold sticky top-0 border-b border-[#2B3D63] z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">Sel.</th>
                    <th className="py-2.5 px-3">Nome / Aluno</th>
                    <th className="py-2.5 px-3">WhatsApp</th>
                    <th className="py-2.5 px-3">Curso / Cargo</th>
                    <th className="py-2.5 px-3">Lote / Origem</th>
                    <th className="py-2.5 px-3">Atendente Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3D63]/50">
                  {filteredContactsForDistribution.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#8C98B4]">
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
                            isSelected ? 'bg-[#C9A227]/15' : 'hover:bg-[#1F3057]/40'
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
                          <td className="py-2.5 px-3 font-semibold text-white">
                            <div>{c.nome}</div>
                            {c.email && <div className="text-[10px] text-[#8C98B4]">{c.email}</div>}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#8C98B4] whitespace-nowrap">
                            {c.whatsapp}
                          </td>
                          <td className="py-2.5 px-3 text-[#C9A227] font-medium">{c.curso || '—'}</td>
                          <td className="py-2.5 px-3 text-[#8C98B4]">{c.batchName || 'Importação Direta'}</td>
                          <td className="py-2.5 px-3">
                            {c.assignedToEmail ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#34D399] font-semibold bg-[#10B981]/15 border border-[#10B981]/30 px-2 py-0.5 rounded">
                                <UserCheck className="w-3 h-3" />
                                {c.assignedToEmail}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#F87171] font-semibold bg-[#DC2626]/15 border border-[#DC2626]/30 px-2 py-0.5 rounded">
                                <UserX className="w-3 h-3" />
                                Livre (Sem atendente)
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
      {/* TAB 2: 🚨 RADAR DE LEADS PARADOS (+3 DIAS)                               */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#F87171]" />
                  Radar de Inatividade & Abandono (+3 Dias)
                </h3>
                <p className="text-xs text-[#8C98B4]">
                  Leads que não receberam mensagem há mais de 72 horas. Cobre o vendedor ou transfira para outro com 1 clique.
                </p>
              </div>

              {inactiveAlertContacts.length > 0 && attendants.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkReassignAllInactive}
                  disabled={isProcessing}
                  className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start md:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Redistribuir Todos os {inactiveAlertContacts.length} Parados</span>
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#2B3D63]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8C98B4] absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por aluno, telefone ou curso..."
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-white text-xs pl-8 pr-3 py-2 rounded-lg focus:outline-none focus:border-[#C9A227]"
                />
              </div>

              <div>
                <select
                  value={alertAttendantFilter}
                  onChange={(e) => setAlertAttendantFilter(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-white text-xs p-2 rounded-lg focus:outline-none focus:border-[#C9A227]"
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
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-white text-xs p-2 rounded-lg focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="all">Qualquer Inatividade (+3 dias)</option>
                  <option value="3to5">Parados entre 3 e 5 dias</option>
                  <option value="5to10">Parados entre 5 e 10 dias (Crítico)</option>
                  <option value="10plus">Parados há mais de 10 dias (Abandono)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Alert Leads Table */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 bg-[#101B2D] border-b border-[#2B3D63] flex items-center justify-between text-xs text-[#8C98B4]">
              <span>Mostrando <b>{filteredAlertContacts.length}</b> lead(s) em alerta</span>
              <span className="text-[#C9A227]">Ordenado pelo maior tempo parado</span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#101B2D] text-[#8C98B4] uppercase text-[10px] font-semibold sticky top-0 border-b border-[#2B3D63] z-10">
                  <tr>
                    <th className="py-2.5 px-3">Tempo Parado</th>
                    <th className="py-2.5 px-3">Aluno / Lead</th>
                    <th className="py-2.5 px-3">WhatsApp</th>
                    <th className="py-2.5 px-3">Curso</th>
                    <th className="py-2.5 px-3">Atendente Atual</th>
                    <th className="py-2.5 px-3 text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3D63]/50">
                  {filteredAlertContacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#8C98B4]">
                        <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2 opacity-80" />
                        <span className="text-sm font-semibold text-white block">
                          Nenhum lead em alerta de inatividade!
                        </span>
                        <span className="text-xs text-[#8C98B4]">
                          Todos os contatos foram respondidos nos últimos 3 dias.
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
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${inactivity.badgeClass}`}>
                              <Clock className="w-3 h-3 shrink-0" />
                              {inactivity.label}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-semibold text-white">
                            <div>{c.nome || 'Sem Nome'}</div>
                            {c.observacao && (
                              <div className="text-[11px] text-[#8C98B4] truncate max-w-xs" title={c.observacao}>
                                {c.observacao}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono text-[#8C98B4] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{c.whatsapp}</span>
                              {c.whatsapp && (
                                <button
                                  type="button"
                                  onClick={() => openWhatsAppDirect(c.whatsapp)}
                                  className="text-[#4ADE80] hover:text-white p-1 rounded hover:bg-[#4ADE80]/20 transition-all cursor-pointer"
                                  title="Abrir WhatsApp"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-[#C9A227] font-medium whitespace-nowrap">
                            {c.curso || '—'}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {c.assignedTo ? (
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[#101B2D] border border-[#C9A227]/60 flex items-center justify-center text-[10px] font-bold text-[#C9A227]">
                                  {attendantName[0]?.toUpperCase() || 'A'}
                                </span>
                                <div>
                                  <div className="font-semibold text-white">{attendantName}</div>
                                  <div className="text-[10px] text-[#8C98B4]">{c.assignedToEmail}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#F87171] bg-[#DC2626]/15 border border-[#DC2626]/30 px-2 py-0.5 rounded font-semibold">
                                Sem atendente
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {c.assignedTo && (
                                <button
                                  type="button"
                                  onClick={() => handleCopySellerNotice(c, attendantName, days)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                                    isCopied
                                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                                      : 'bg-[#101B2D] border-[#2B3D63] text-white hover:border-[#C9A227] hover:text-[#C9A227]'
                                  }`}
                                  title="Copiar texto pronto para cobrar o vendedor no WhatsApp"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5 text-[#C9A227]" />}
                                  <span>{isCopied ? 'Copiado!' : 'Cobrar'}</span>
                                </button>
                              )}

                              <select
                                value={selectedTarget}
                                onChange={(e) =>
                                  setReassignTargetByContact((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                className="bg-[#101B2D] border border-[#2B3D63] text-xs text-white rounded-lg p-1.5 focus:outline-none focus:border-[#C9A227] max-w-[130px]"
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
                                className="bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
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
      {/* TAB 3: 📊 PRODUTIVIDADE & DESEMPENHO DA EQUIPE                            */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#C9A227]" />
                Desempenho & Cobertura dos Vendedores
              </h3>
              <p className="text-xs text-[#8C98B4]">
                Acompanhe quem está conversando hoje, taxa de resposta e vendas concluídas de cada atendente.
              </p>
            </div>

            <div className="text-xs text-[#8C98B4]">
              Total de Atendentes Ativos: <b className="text-white">{attendants.length}</b>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attendantStats.map((item) => {
              const a = item.attendant;
              const hasAlerts = item.inactive3Days > 0;

              return (
                <div
                  key={a.uid}
                  className={`bg-[#172644] border rounded-2xl p-4 shadow-md transition-all ${
                    item.statusTier === 'danger'
                      ? 'border-[#DC2626]/70 shadow-[0_0_12px_rgba(220,38,38,0.12)]'
                      : item.statusTier === 'warning'
                      ? 'border-[#C9A227]/60'
                      : 'border-[#2B3D63] hover:border-[#10B981]/50'
                  }`}
                >
                  {/* Top Profile Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {a.photoURL ? (
                        <img
                          src={a.photoURL}
                          alt={a.displayName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full border border-[#C9A227] object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#101B2D] border border-[#2B3D63] flex items-center justify-center font-bold text-[#C9A227]">
                          {(a.displayName || a.email || 'A')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">
                          {a.displayName || 'Atendente'}
                        </h4>
                        <p className="text-xs text-[#8C98B4] truncate">{a.email}</p>
                      </div>
                    </div>

                    {item.statusTier === 'danger' ? (
                      <span className="text-[10px] font-bold bg-[#DC2626]/20 text-[#F87171] border border-[#DC2626]/40 px-2 py-0.5 rounded-full">
                        🚨 {item.inactive3Days} Parados
                      </span>
                    ) : item.statusTier === 'warning' ? (
                      <span className="text-[10px] font-bold bg-[#C9A227]/20 text-[#FCD34D] border border-[#C9A227]/40 px-2 py-0.5 rounded-full">
                        ⚠️ {item.inactive3Days} Parado
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40 px-2 py-0.5 rounded-full">
                        🟢 100% Em Dia
                      </span>
                    )}
                  </div>

                  {/* Metrics 3-Col Box */}
                  <div className="grid grid-cols-3 gap-2 text-center my-3">
                    <div className="bg-[#101B2D] p-2 rounded-xl border border-[#2B3D63]">
                      <span className="text-[10px] text-[#8C98B4] block font-medium">Total Leads</span>
                      <span className="text-sm font-bold text-white">{item.totalLeads}</span>
                    </div>
                    <div className="bg-[#101B2D] p-2 rounded-xl border border-[#2B3D63]">
                      <span className="text-[10px] text-[#34D399] block font-medium">Hoje</span>
                      <span className="text-sm font-bold text-[#34D399]">{item.contactedToday}</span>
                    </div>
                    <div className="bg-[#101B2D] p-2 rounded-xl border border-[#2B3D63]">
                      <span className="text-[10px] text-[#C9A227] block font-medium">Vendas (Pagou)</span>
                      <span className="text-sm font-bold text-[#C9A227]">{item.paidCount}</span>
                    </div>
                  </div>

                  {/* Coverage Progress Bar */}
                  <div className="space-y-1 my-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8C98B4]">Cobertura dos Leads</span>
                      <span className="font-bold text-white">{item.coverageRate}%</span>
                    </div>
                    <div className="w-full bg-[#101B2D] rounded-full h-1.5 overflow-hidden border border-[#2B3D63]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.coverageRate >= 80 ? 'bg-[#10B981]' : item.coverageRate >= 50 ? 'bg-[#C9A227]' : 'bg-[#DC2626]'
                        }`}
                        style={{ width: `${item.coverageRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom Action / View */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#2B3D63] text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setPortfolioSourceUser(a.uid);
                        setDistributionMode('transfer_portfolio');
                        setActiveTab('distribution');
                      }}
                      className="text-[11px] text-[#8C98B4] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Transferir Carteira</span>
                    </button>

                    {hasAlerts ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAlertAttendantFilter(a.uid);
                          setActiveTab('alerts');
                        }}
                        className="text-xs text-[#F87171] hover:underline font-bold cursor-pointer"
                      >
                        Ver no Radar →
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#10B981] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Atualizado
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
      {/* TAB 4: 👥 EQUIPE & PERMISSÕES                                             */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#172644] p-4 rounded-2xl border border-[#2B3D63]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar usuário por nome ou email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-white text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-[#C9A227]"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreateUserError('');
                  setShowAddUserModal(true);
                }}
                className="bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Novo Membro</span>
              </button>
              <div className="text-xs text-[#8C98B4] hidden md:block">
                Total de Usuários: <b className="text-white">{users.length}</b>
              </div>
            </div>
          </div>

          {/* Pending Approvals Notice */}
          {pendingUsers.length > 0 && (
            <div className="bg-[#DC2626]/10 border border-[#DC2626]/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#F87171]">
                <AlertTriangle className="w-4 h-4" />
                Novos Cadastros Aguardando Aprovação ({pendingUsers.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="bg-[#101B2D] border border-[#2B3D63] rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#172644] border border-[#2B3D63] flex items-center justify-center font-bold text-[#C9A227]">
                        {(u.displayName || u.email || 'U')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {u.displayName || 'Novo Usuário'}
                        </h4>
                        <p className="text-xs text-[#8C98B4] truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onApproveUser(u.uid, 'attendant')}
                        className="bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprovar Atendente
                      </button>
                      <button
                        type="button"
                        onClick={() => onBlockUser(u.uid)}
                        className="bg-[#DC2626] hover:bg-[#b91c1c] text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Bloquear"
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
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 bg-[#101B2D] border-b border-[#2B3D63] text-xs font-semibold text-[#8C98B4]">
              Lista Completa de Usuários ({filteredUsers.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#101B2D] text-[#8C98B4] uppercase text-[10px] font-semibold border-b border-[#2B3D63]">
                  <tr>
                    <th className="py-2.5 px-3">Usuário</th>
                    <th className="py-2.5 px-3">E-mail / Login</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Cargo / Função</th>
                    <th className="py-2.5 px-3">Leads Atribuídos</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3D63]/50">
                  {filteredUsers.map((u) => {
                    const assignedCount = globalContacts.filter((c) => c.assignedTo === u.uid).length;
                    const isSelf = u.uid === currentProfile?.uid;

                    return (
                      <tr key={u.uid} className="hover:bg-[#1F3057]/40 transition-colors">
                        <td className="py-3 px-3 flex items-center gap-2.5 font-medium">
                          <div className="w-7 h-7 rounded-full bg-[#101B2D] border border-[#2B3D63] flex items-center justify-center font-bold text-[#C9A227] text-xs">
                            {(u.displayName || u.email || 'U')[0]?.toUpperCase()}
                          </div>
                          <span className="truncate max-w-[150px]">{u.displayName || 'Sem Nome'}</span>
                          {isSelf && (
                            <span className="bg-[#C9A227]/20 text-[#C9A227] text-[10px] px-1.5 py-0.2 rounded font-bold">
                              Você
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#8C98B4] font-mono">{u.email}</td>
                        <td className="py-3 px-3">
                          {u.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#34D399] bg-[#10B981]/15 border border-[#10B981]/30 px-2 py-0.5 rounded font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </span>
                          ) : u.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#C9A227] bg-[#C9A227]/15 border border-[#C9A227]/30 px-2 py-0.5 rounded font-semibold">
                              <Clock className="w-3 h-3" /> Pendente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#F87171] bg-[#DC2626]/15 border border-[#DC2626]/30 px-2 py-0.5 rounded font-semibold">
                              <XCircle className="w-3 h-3" /> Bloqueado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => onChangeUserRole(u.uid, e.target.value as UserRole)}
                            className="bg-[#101B2D] border border-[#2B3D63] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#C9A227] disabled:opacity-50"
                          >
                            <option value="attendant">Atendente (Vendedor)</option>
                            <option value="supervisor">Supervisor (Divisão de Leads)</option>
                            <option value="admin">Administrador Master</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {assignedCount} leads
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!isSelf && (
                            <div className="flex items-center justify-end gap-2">
                              {u.status === 'blocked' ? (
                                <button
                                  type="button"
                                  onClick={() => onApproveUser(u.uid, u.role)}
                                  className="text-xs text-[#34D399] hover:underline cursor-pointer"
                                >
                                  Desbloquear
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onBlockUser(u.uid)}
                                  className="text-xs text-[#F87171] hover:underline cursor-pointer"
                                >
                                  Bloquear
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

          {/* Add User Modal */}
          {showAddUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
              <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#2B3D63]">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#C9A227]" />
                    Cadastrar Novo Membro da Equipe
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="text-[#8C98B4] hover:text-white text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {createUserError && (
                  <div className="bg-[#DC2626]/20 border border-[#DC2626] text-xs text-[#F87171] p-2.5 rounded-lg">
                    {createUserError}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#C9A227]"
                    />
                  </div>

                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Usuário ou E-mail para Login</label>
                    <input
                      type="text"
                      placeholder="Ex: carlos@portal.com ou carlos.vendas"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#C9A227]"
                    />
                  </div>

                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Senha Provisória</label>
                    <input
                      type="text"
                      value={newUserPass}
                      onChange={(e) => setNewUserPass(e.target.value)}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#C9A227]"
                    />
                  </div>

                  <div>
                    <label className="text-[#8C98B4] font-semibold block mb-1">Cargo / Função</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2 text-white focus:outline-none focus:border-[#C9A227]"
                    >
                      <option value="attendant">Atendente (Vendedor - Acesso operacional)</option>
                      <option value="supervisor">Supervisor (Divisão de Leads e Gestão)</option>
                      <option value="admin">Administrador Master (Acesso total)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3D63]">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-3 py-2 text-xs text-[#8C98B4] hover:text-white cursor-pointer"
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
                          showNotification('Usuário cadastrado com sucesso!');
                        } else if (typeof res === 'string') {
                          setCreateUserError(res);
                        }
                      }
                    }}
                    className="bg-[#10B981] hover:bg-[#059669] text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Salvar e Liberar Acesso
                  </button>
                </div>
              </div>
            </div>
          )}
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
          setActiveTab('distribution');
          showNotification(`Lote "${res.batchName}" importado e pronto para distribuição!`);
        }}
        existingContacts={globalContacts}
        users={users}
        currentProfile={currentProfile}
      />
    </div>
  );
};

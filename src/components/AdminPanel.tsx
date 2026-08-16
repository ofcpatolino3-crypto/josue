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
} from 'lucide-react';
import { UserProfile, Contact, LeadBatch } from '../types';
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
  // Navigation Tabs: 4 clear, focused sections
  const [activeTab, setActiveTab] = useState<'alerts' | 'activity' | 'distribution' | 'users'>('alerts');
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Alerts Tab Filters
  const [alertSearch, setAlertSearch] = useState('');
  const [alertAttendantFilter, setAlertAttendantFilter] = useState('todos');
  const [alertDaysFilter, setAlertDaysFilter] = useState<'all' | '3to5' | '5to10' | '10plus'>('all');
  const [reassignTargetByContact, setReassignTargetByContact] = useState<Record<string, string>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Distribution Tab Filters
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('todos');
  const [selectedTargetUser, setSelectedTargetUser] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<'todos' | 'unassigned' | 'assigned'>('unassigned');
  const [distributionSearch, setDistributionSearch] = useState('');

  // Users Tab Filters & Creation Modal
  const [userSearch, setUserSearch] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('123456');
  const [newUserRole, setNewUserRole] = useState<'attendant' | 'admin'>('attendant');
  const [createUserError, setCreateUserError] = useState('');

  // Core User Computations
  const pendingUsers = useMemo(() => users.filter((u) => u.status === 'pending'), [users]);
  const attendants = useMemo(() => users.filter((u) => u.status === 'approved' && u.role === 'attendant'), [users]);
  const unassignedContacts = useMemo(() => globalContacts.filter((c) => !c.assignedTo), [globalContacts]);
  const assignedContacts = useMemo(() => globalContacts.filter((c) => !!c.assignedTo), [globalContacts]);

  // 3+ Days Inactivity Alerts list
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
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

  // Filtered Contacts for Distribution
  const filteredContactsForDistribution = useMemo(() => {
    return globalContacts.filter((c) => {
      if (selectedBatchFilter !== 'todos' && c.batchName !== selectedBatchFilter) return false;
      if (actionFilter === 'unassigned' && c.assignedTo) return false;
      if (actionFilter === 'assigned' && !c.assignedTo) return false;
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
      setSuccessMsg(`Contato reatribuído para ${target.displayName || target.email}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao transferir contato: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk reassign all 3+ days inactive contacts
  const handleBulkReassignAllInactive = async () => {
    if (inactiveAlertContacts.length === 0) {
      alert('Não há contatos parados há 3 ou mais dias.');
      return;
    }
    if (attendants.length === 0) {
      alert('Não há atendentes aprovados disponíveis para receber os contatos.');
      return;
    }

    const confirmMsg = `Deseja dividir ${inactiveAlertContacts.length} contatos parados igualmente entre os ${attendants.length} atendentes da equipe?`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await onDistributeEqually(inactiveAlertContacts, attendants);
      setSuccessMsg(`Sucesso! ${inactiveAlertContacts.length} contatos parados foram redistribuídos igualmente.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e: any) {
      alert('Erro ao redistribuir: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Assign selected in distribution
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
      setSuccessMsg(`${contactsToAssign.length} contatos atribuídos a ${target.displayName || target.email}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao distribuir: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto equal distribution
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
      alert('Não há contatos livres para distribuição nesta seleção.');
      return;
    }

    const perPerson = Math.ceil(unassigned.length / attendants.length);
    const confirmMsg = `Dividir ${unassigned.length} contatos livres igualmente entre os ${attendants.length} atendentes (${perPerson} por atendente)?`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await onDistributeEqually(unassigned, attendants);
      setSuccessMsg(`Sucesso! ${unassigned.length} contatos foram divididos igualmente entre ${attendants.length} atendentes.`);
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
    const text = `🚨 *ALERTA DE ATENDIMENTO - PORTAL CONCURSO*\n\nOlá, *${attendantName}*!\nO aluno *${contact.nome || 'Lead'}* (${contact.whatsapp}) está há *${days} dias sem resposta ou contato* no painel.\n\nPor favor, envie uma mensagem agora para dar andamento e não perder o aluno! 🎯`;
    navigator.clipboard.writeText(text);
    setCopiedMessageId(contact.id);
    setTimeout(() => setCopiedMessageId(null), 3000);
  };

  // Supervisor Export Handlers
  const handleExportSupervisorAll = async () => {
    if (globalContacts.length === 0) {
      alert('Não há contatos cadastrados para exportar.');
      return;
    }
    setIsProcessing(true);
    try {
      await exportSupervisorContactsToExcel(globalContacts, 'Base_Geral_Supervisao');
      setSuccessMsg(`Planilha de Supervisão com ${globalContacts.length} contatos exportada!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Erro ao exportar planilha: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5" id="admin-panel-container">
      {/* Toast Notification */}
      {successMsg && (
        <div className="bg-[#10B981]/20 border border-[#10B981] text-white p-3.5 rounded-xl flex items-center gap-3 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {/* 1. Header & Quick Actions Bar */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <Shield className="w-3 h-3" /> Painel de Supervisão
              </span>
              <span className="text-xs text-[#8C98B4]">
                • Logado como <strong className="text-white">{currentProfile?.displayName || currentProfile?.email}</strong>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#EDE6D6]">
              Gestão de Vendedores & Distribuição de Leads
            </h2>
            <p className="text-xs text-[#8C98B4]">
              Acompanhe o radar de inatividade (+3 dias), monitore as vendas e distribua novas listas com praticidade.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSmartImportModal(true)}
              className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Importar com IA (Excel/Foto/PDF)</span>
            </button>

            {unassignedContacts.length > 0 && attendants.length > 0 && (
              <button
                type="button"
                onClick={handleAutoEqualDistribute}
                disabled={isProcessing}
                className="flex items-center gap-1.5 bg-[#1F3057] hover:bg-[#2B3D63] text-white border border-[#C9A227]/40 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                title="Dividir igualmente os leads não atribuídos"
              >
                <Zap className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>Dividir {unassignedContacts.length} Leads Livres</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportSupervisorAll}
              disabled={isProcessing || globalContacts.length === 0}
              className="flex items-center gap-1.5 bg-[#101B2D] hover:bg-[#1F3057] text-[#EDE6D6] border border-[#2B3D63] px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Exportar planilha Excel completa de supervisão"
            >
              <Download className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#2B3D63]/70">
          <div
            onClick={() => setActiveTab('alerts')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'border-[#DC2626] bg-[#DC2626]/15 ring-1 ring-[#DC2626]'
                : inactiveAlertContacts.length > 0
                ? 'bg-[#DC2626]/10 border-[#DC2626]/40 hover:bg-[#DC2626]/20'
                : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#8C98B4] font-medium">Leads Parados (+3d)</span>
              {inactiveAlertContacts.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-bold ${inactiveAlertContacts.length > 0 ? 'text-[#F87171]' : 'text-white'}`}>
                {inactiveAlertContacts.length}
              </span>
              {inactiveAlertContacts.length > 0 && (
                <span className="text-[10px] text-[#FCA5A5] font-semibold">requer atenção</span>
              )}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('activity')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'border-[#4ADE80] bg-[#4ADE80]/15 ring-1 ring-[#4ADE80]'
                : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
            }`}
          >
            <span className="text-[11px] text-[#8C98B4] font-medium block">Contatados Hoje</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#4ADE80]">{todayInteractedCount}</span>
              <span className="text-[10px] text-[#8C98B4]">interações</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('distribution')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'distribution'
                ? 'border-[#C9A227] bg-[#C9A227]/15 ring-1 ring-[#C9A227]'
                : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
            }`}
          >
            <span className="text-[11px] text-[#8C98B4] font-medium block">Total de Leads / Livres</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{globalContacts.length}</span>
              <span className="text-[10px] text-[#C9A227] font-semibold">({unassignedContacts.length} livres)</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('users')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-[#C9A227] bg-[#C9A227]/15 ring-1 ring-[#C9A227]'
                : 'bg-[#101B2D] border-[#2B3D63] hover:border-[#8C98B4]'
            }`}
          >
            <span className="text-[11px] text-[#8C98B4] font-medium block">Equipe de Atendentes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#C9A227]">{attendants.length}</span>
              {pendingUsers.length > 0 && (
                <span className="text-[10px] bg-[#DC2626] text-white px-1.5 py-0.5 rounded font-bold">
                  {pendingUsers.length} pendente(s)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Clean 4-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#2B3D63] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'alerts'
              ? 'bg-[#DC2626] text-white shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-white hover:bg-[#172644]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Radar de Leads Parados (+3 Dias)</span>
          {inactiveAlertContacts.length > 0 && (
            <span className="bg-white text-[#DC2626] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {inactiveAlertContacts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-white hover:bg-[#172644]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Produtividade & Metas da Equipe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('distribution')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'distribution'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
              : 'text-[#8C98B4] hover:text-white hover:bg-[#172644]'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Distribuir & Importar Leads</span>
          {unassignedContacts.length > 0 && (
            <span className="bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/40 text-[10px] px-1.5 py-0.2 rounded-full">
              {unassignedContacts.length} livres
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#C9A227] text-[#101B2D] shadow-md font-bold'
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
      {/* TAB 1: 🚨 RADAR DE LEADS PARADOS (+3 DIAS)                               */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Controls & Search Header */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#F87171]" />
                  Leads sem Interação há 3+ Dias ({inactiveAlertContacts.length})
                </h3>
                <p className="text-xs text-[#8C98B4]">
                  Leads que não receberam mensagem há mais de 72 horas. Cobre o vendedor ou transfira com 1 clique.
                </p>
              </div>

              {inactiveAlertContacts.length > 0 && attendants.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkReassignAllInactive}
                  disabled={isProcessing}
                  className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start md:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Redistribuir Todos os Parados</span>
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
      {/* TAB 2: 📊 PRODUTIVIDADE & METAS DA EQUIPE                                 */}
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
                    <span className="text-[#8C98B4]">
                      Potenciais/Quentes: <b className="text-white">{item.hotCount}</b>
                    </span>

                    {hasAlerts ? (
                      <button
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
      {/* TAB 3: 📦 DISTRIBUIR & IMPORTAR LEADS                                     */}
      {/* ========================================================================= */}
      {activeTab === 'distribution' && (
        <div className="space-y-4">
          {/* Main Action Banner */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#C9A227]" />
                  Central de Distribuição e Atribuição de Leads
                </h3>
                <p className="text-xs text-[#8C98B4] mt-0.5">
                  Atribua leads livres para vendedores específicos ou faça uma divisão automática igualitária.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSmartImportModal(true)}
                  className="bg-[#C9A227] hover:bg-[#8C6D1F] text-[#101B2D] font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Importar Novo Arquivo (IA)</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoEqualDistribute}
                  disabled={isProcessing || unassignedContacts.length === 0 || attendants.length === 0}
                  className="bg-[#1F3057] hover:bg-[#2B3D63] text-white border border-[#2B3D63] font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Zap className="w-4 h-4 text-[#C9A227]" />
                  <span>Dividir Igualmente ({unassignedContacts.length})</span>
                </button>
              </div>
            </div>

            {/* Filter Bar & Manual Assignment Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-[#2B3D63]">
              <div className="sm:col-span-3">
                <label className="text-[11px] font-semibold text-[#8C98B4] block mb-1">
                  Filtrar por Lote:
                </label>
                <select
                  value={selectedBatchFilter}
                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="todos">Todos os Lotes ({globalContacts.length})</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.totalRows} leads)
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-semibold text-[#8C98B4] block mb-1">
                  Status de Atribuição:
                </label>
                <div className="flex rounded-lg overflow-hidden border border-[#2B3D63]">
                  <button
                    onClick={() => setActionFilter('unassigned')}
                    className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                      actionFilter === 'unassigned' ? 'bg-[#C9A227] text-[#101B2D]' : 'bg-[#101B2D] text-[#8C98B4]'
                    }`}
                  >
                    Livres ({unassignedContacts.length})
                  </button>
                  <button
                    onClick={() => setActionFilter('assigned')}
                    className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                      actionFilter === 'assigned' ? 'bg-[#C9A227] text-[#101B2D]' : 'bg-[#101B2D] text-[#8C98B4]'
                    }`}
                  >
                    Atribuídos ({assignedContacts.length})
                  </button>
                  <button
                    onClick={() => setActionFilter('todos')}
                    className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                      actionFilter === 'todos' ? 'bg-[#C9A227] text-[#101B2D]' : 'bg-[#101B2D] text-[#8C98B4]'
                    }`}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-semibold text-[#8C98B4] block mb-1">
                  Buscar Lead / Aluno:
                </label>
                <input
                  type="text"
                  placeholder="Nome, telefone, curso..."
                  value={distributionSearch}
                  onChange={(e) => setDistributionSearch(e.target.value)}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#C9A227]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-semibold text-[#8C98B4] block mb-1">
                  Enviar Selecionados para:
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedTargetUser}
                    onChange={(e) => setSelectedTargetUser(e.target.value)}
                    className="flex-1 bg-[#101B2D] border border-[#2B3D63] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#C9A227]"
                  >
                    <option value="">Escolher Atendente...</option>
                    {attendants.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.displayName || a.email}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignSelected}
                    disabled={isProcessing || selectedContactIds.length === 0 || !selectedTargetUser}
                    className="bg-[#10B981] hover:bg-[#059669] text-white px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar ({selectedContactIds.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Contacts Table */}
          <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl overflow-hidden shadow-sm">
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
                    : `Selecionar Todos (${filteredContactsForDistribution.length})`}
                </button>
                <span className="text-[#8C98B4]">
                  • <b>{selectedContactIds.length}</b> selecionado(s)
                </span>
              </div>

              {selectedContactIds.length > 0 && (
                <button
                  onClick={async () => {
                    if (window.confirm(`Excluir permanentemente os ${selectedContactIds.length} contatos selecionados?`)) {
                      await onBatchDeleteContacts(selectedContactIds);
                      setSelectedContactIds([]);
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
                    <th className="py-2.5 px-3">Nome</th>
                    <th className="py-2.5 px-3">WhatsApp</th>
                    <th className="py-2.5 px-3">Curso</th>
                    <th className="py-2.5 px-3">Lote</th>
                    <th className="py-2.5 px-3">Atendente Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3D63]/50">
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
                          <td className="py-2.5 px-3 font-semibold text-white">{c.nome}</td>
                          <td className="py-2.5 px-3 font-mono text-[#8C98B4]">{c.whatsapp}</td>
                          <td className="py-2.5 px-3 text-[#C9A227]">{c.curso || '—'}</td>
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
                <span>Adicionar Novo Atendente</span>
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
                        onClick={() => onApproveUser(u.uid, 'attendant')}
                        className="bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
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
                    <th className="py-2.5 px-3">E-mail</th>
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
                            onChange={(e) => onChangeUserRole(u.uid, e.target.value as 'admin' | 'attendant')}
                            className="bg-[#101B2D] border border-[#2B3D63] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#C9A227] disabled:opacity-50"
                          >
                            <option value="attendant">Atendente</option>
                            <option value="admin">Administrador</option>
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
                                  onClick={() => onApproveUser(u.uid, u.role)}
                                  className="text-xs text-[#34D399] hover:underline"
                                >
                                  Desbloquear
                                </button>
                              ) : (
                                <button
                                  onClick={() => onBlockUser(u.uid)}
                                  className="text-xs text-[#F87171] hover:underline"
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
                    <UserCheck className="w-4 h-4 text-[#C9A227]" />
                    Cadastrar Novo Atendente
                  </h3>
                  <button
                    onClick={() => setShowAddUserModal(false)}
                    className="text-[#8C98B4] hover:text-white text-sm"
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
                    <label className="text-[#8C98B4] font-semibold block mb-1">Cargo</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as 'attendant' | 'admin')}
                      className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2 text-white focus:outline-none focus:border-[#C9A227]"
                    >
                      <option value="attendant">Atendente (Acesso operacional)</option>
                      <option value="admin">Administrador (Acesso total)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3D63]">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-3 py-2 text-xs text-[#8C98B4] hover:text-white"
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
                          setSuccessMsg('Atendente cadastrado com sucesso!');
                          setTimeout(() => setSuccessMsg(''), 4000);
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
          setSuccessMsg(`Lote "${res.batchName}" importado e pronto para distribuição!`);
          setTimeout(() => setSuccessMsg(''), 5000);
        }}
        existingContacts={globalContacts}
        users={users}
        currentProfile={currentProfile}
      />
    </div>
  );
};

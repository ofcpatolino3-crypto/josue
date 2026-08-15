import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  UserPlus,
  Users,
  CheckCircle2,
  PhoneCall,
  ListFilter,
  Calendar,
  MessageSquare,
  ArrowUpDown,
  BookOpen,
  Send,
  FastForward,
  Bot,
  Sparkles,
  Shield,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
} from 'firebase/firestore';
import { auth, googleProvider, db } from './lib/firebase';

import {
  Contact,
  Objection,
  Plan,
  TabFilter,
  ViewTab,
  ToastMessage,
  Temperature,
  MessageTemplate,
  UserProfile,
  LeadBatch,
} from './types';
import {
  DEFAULT_OBJECTIONS,
  DEFAULT_PLANS,
  DEFAULT_TEMPLATES,
  SAMPLE_CONTACTS,
  TEMP_ORDER,
} from './data/defaults';
import {
  todayStr,
  exportContactsToExcel,
  isOverdue,
  isWithoutContactFor3Days,
} from './utils/excel';

import { Header } from './components/Header';
import { AuthBanner } from './components/AuthBanner';
import { LoginModal } from './components/LoginModal';
import { StatsCards } from './components/StatsCards';
import { DashboardCharts } from './components/DashboardCharts';
import { TemperatureChart } from './components/TemperatureChart';
import { Dropzone } from './components/Dropzone';
import { ContactCard } from './components/ContactCard';
import { AddContactForm } from './components/AddContactModal';
import { DailyExportModal } from './components/DailyExportModal';
import { MessagesView } from './components/MessagesView';
import { MessageModal } from './components/MessageModal';
import { SalesAssistantModal } from './components/SalesAssistantModal';
import { AIChatAssistant } from './components/AIChatAssistant';
import { ObjectionsView } from './components/ObjectionsView';
import { PlansView } from './components/PlansView';
import { AdminPanel } from './components/AdminPanel';
import { FastBroadcastView } from './components/FastBroadcastView';
import { ToastContainer } from './components/Toast';
import { SmartImportModal, SmartImportResult } from './components/SmartImportModal';

const STORAGE_CONTACTS = 'contacts_v3';
const STORAGE_OBJECTIONS = 'objections_v3';
const STORAGE_PLANS = 'plans_v2';
const STORAGE_TEMPLATES = 'templates_v3';
const STORAGE_SESSION = 'portal_user_session_v1';
const STORAGE_ADMIN_PASS = 'portal_admin_master_pass';

// Default Admin email / master config
const MASTER_ADMIN_EMAIL = 'ofcpatolino3@gmail.com';
const DEFAULT_MASTER_PASSWORD = 'admin123';

const MASTER_ADMIN_PROFILE: UserProfile = {
  uid: 'master_admin_root',
  email: MASTER_ADMIN_EMAIL,
  username: 'admin',
  displayName: 'Administrador Master',
  password: DEFAULT_MASTER_PASSWORD,
  role: 'admin',
  status: 'approved',
  createdAt: Date.now(),
  approvedAt: Date.now(),
  approvedBy: 'system',
};

export default function App() {
  // --- AUTH & USER PROFILE STATE ---
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSION);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const initialCloudLoadDone = useRef(false);

  // --- ADMIN STATE (All users and all global contacts) ---
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [globalContacts, setGlobalContacts] = useState<Contact[]>([]);
  const [leadBatches, setLeadBatches] = useState<LeadBatch[]>([]);

  // --- LOCAL STATE (with LocalStorage cache fallback) ---
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONTACTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return SAMPLE_CONTACTS;
  });

  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TEMPLATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_TEMPLATES;
  });

  const [objections, setObjections] = useState<Objection[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_OBJECTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_OBJECTIONS;
  });

  const [plans, setPlans] = useState<Plan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PLANS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_PLANS;
  });

  const [activeView, setActiveView] = useState<ViewTab>('contatos');
  const [tabFilter, setTabFilter] = useState<TabFilter>('pendente');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCurso, setFilterCurso] = useState('');
  const [filterTemp, setFilterTemp] = useState('');
  const [sortBy, setSortBy] = useState<'curso' | 'nome' | 'temperatura' | 'recentes'>('curso');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDailyExport, setShowDailyExport] = useState(false);
  const [messageModalContact, setMessageModalContact] = useState<Contact | null>(null);
  const [salesAssistantContact, setSalesAssistantContact] = useState<Contact | null>(null);
  const [showAIChatAssistant, setShowAIChatAssistant] = useState(false);
  const [showAppSmartImport, setShowAppSmartImport] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Auto redirect if not admin trying to access admin tab
  useEffect(() => {
    if (activeView === 'admin' && currentProfile?.role !== 'admin') {
      setActiveView('contatos');
    }
  }, [activeView, currentProfile]);

  // --- USER PROFILE & FIRESTORE LISTENERS ---
  // Always guarantee that Master Admin profile exists in Firestore and state
  useEffect(() => {
    const ensureMaster = async () => {
      try {
        await setDoc(doc(db, 'user_profiles', 'master_admin_root'), MASTER_ADMIN_PROFILE, { merge: true });
      } catch (err) {
        console.warn('Auto ensure master admin profile:', err);
      }
    };
    ensureMaster();
  }, []);

  // Listen to all registered profiles to keep sync & validate credentials
  useEffect(() => {
    try {
      const usersRef = collection(db, 'user_profiles');
      const unsubUsers = onSnapshot(
        usersRef,
        (snapshot) => {
          const list: UserProfile[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as UserProfile;
            if (
              data.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() ||
              data.uid === 'master_admin_root' ||
              data.username === 'admin'
            ) {
              list.push({ ...data, role: 'admin', status: 'approved' });
            } else {
              list.push(data);
            }
          });
          setAllUsers(list);

          // If currently logged in, sync current profile status in real-time
          if (currentProfile) {
            const updated = list.find((u) => u.uid === currentProfile.uid || (u.email && u.email.toLowerCase() === currentProfile.email.toLowerCase()));
            if (updated) {
              const isMasterAccount =
                updated.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() ||
                updated.uid === 'master_admin_root' ||
                updated.username === 'admin' ||
                currentProfile.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() ||
                currentProfile.uid === 'master_admin_root';

              const role = isMasterAccount ? 'admin' : updated.role;
              const status = isMasterAccount ? 'approved' : updated.status;

              // Check if role or status changed
              if (status !== currentProfile.status || role !== currentProfile.role || updated.displayName !== currentProfile.displayName) {
                const merged = { ...currentProfile, ...updated, role, status };
                setCurrentProfile(merged);
                localStorage.setItem(STORAGE_SESSION, JSON.stringify(merged));
              }
            }
          }
        },
        (err) => {
          console.warn('Firestore users snapshot info:', err);
        }
      );

      // Listen to global contacts database
      const globalContactsRef = collection(db, 'global_contacts');
      const unsubGlobal = onSnapshot(
        globalContactsRef,
        (snapshot) => {
          const list: Contact[] = [];
          snapshot.forEach((d) => list.push(d.data() as Contact));
          setGlobalContacts(list);
        },
        (err) => console.warn('Firestore global contacts info:', err)
      );

      // Listen to batches
      const batchesRef = collection(db, 'lead_batches');
      const unsubBatches = onSnapshot(
        batchesRef,
        (snapshot) => {
          const list: LeadBatch[] = [];
          snapshot.forEach((d) => list.push(d.data() as LeadBatch));
          setLeadBatches(list);
        },
        (err) => console.warn('Firestore batches info:', err)
      );

      return () => {
        unsubUsers();
        unsubGlobal();
        unsubBatches();
      };
    } catch (e) {
      console.warn('Firebase listeners init:', e);
    }
  }, [currentProfile]);

  // --- FIRESTORE REAL-TIME SYNC FOR CURRENT USER'S ASSIGNED / OWN CONTACTS ---
  useEffect(() => {
    if (!currentProfile) return;

    try {
      // Listen to user's assigned contacts in cloud
      const contactsRef = collection(db, 'users', currentProfile.uid, 'contacts');
      const unsubContacts = onSnapshot(
        contactsRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudContacts: Contact[] = [];
            snapshot.forEach((d) => {
              cloudContacts.push(d.data() as Contact);
            });
            cloudContacts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setContacts(cloudContacts);
          } else if (!initialCloudLoadDone.current && contacts.length > 0 && currentProfile?.status === 'approved') {
            syncInitialDataToCloud(currentProfile.uid, contacts);
          }
          initialCloudLoadDone.current = true;
        },
        (error) => {
          console.warn('Firestore sync error:', error);
        }
      );

      // Listen to templates
      const templatesRef = collection(db, 'users', currentProfile.uid, 'templates');
      const unsubTemplates = onSnapshot(
        templatesRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudTemplates: MessageTemplate[] = [];
            snapshot.forEach((d) => {
              cloudTemplates.push(d.data() as MessageTemplate);
            });
            setTemplates(cloudTemplates);
          }
        },
        (error) => {
          console.warn('Firestore templates error:', error);
        }
      );

      return () => {
        unsubContacts();
        unsubTemplates();
      };
    } catch (e) {
      console.warn('Firebase user sync init:', e);
    }
  }, [currentProfile]);

  // Initial cloud sync helper
  const syncInitialDataToCloud = async (userId: string, currentContacts: Contact[]) => {
    try {
      setSyncing(true);
      const batch = writeBatch(db);
      currentContacts.forEach((c) => {
        const ref = doc(db, 'users', userId, 'contacts', c.id);
        batch.set(ref, c);
      });
      await batch.commit();
      addToast('Contatos sincronizados com sua carteira!', 'success');
    } catch (e) {
      console.error('Error syncing initial data:', e);
    } finally {
      setSyncing(false);
    }
  };

  // --- LOCAL PERSISTENCE BACKUP ---
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONTACTS, JSON.stringify(contacts));
    } catch (e) {
      console.error('Failed to save contacts', e);
    }
  }, [contacts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));
    } catch (e) {
      console.error('Failed to save templates', e);
    }
  }, [templates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_OBJECTIONS, JSON.stringify(objections));
    } catch (e) {
      console.error('Failed to save objections', e);
    }
  }, [objections]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PLANS, JSON.stringify(plans));
    } catch (e) {
      console.error('Failed to save plans', e);
    }
  }, [plans]);

  // Helper to save single contact to cloud
  const saveContactToCloud = async (contact: Contact) => {
    if (!currentProfile) return;
    try {
      setSyncing(true);
      const ref = doc(db, 'users', currentProfile.uid, 'contacts', contact.id);
      await setDoc(ref, contact, { merge: true });

      // Also update in global_contacts if present
      const globalRef = doc(db, 'global_contacts', contact.id);
      await setDoc(globalRef, contact, { merge: true });
    } catch (e) {
      console.error('Error saving contact to Firestore:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Helper to batch save contacts to cloud
  const saveBatchContactsToCloud = async (newContacts: Contact[], batchName?: string) => {
    if (!currentProfile || newContacts.length === 0) return;
    try {
      setSyncing(true);
      const batch = writeBatch(db);

      // Save to user's assigned contacts
      newContacts.forEach((c) => {
        const ref = doc(db, 'users', currentProfile.uid, 'contacts', c.id);
        batch.set(ref, c, { merge: true });

        // Save to global pool so Admin can redistribute if needed
        const globalRef = doc(db, 'global_contacts', c.id);
        batch.set(globalRef, { ...c, batchName: batchName || 'Planilha Manual' }, { merge: true });
      });

      if (batchName) {
        const batchDocRef = doc(db, 'lead_batches', 'b_' + Date.now());
        batch.set(batchDocRef, {
          id: 'b_' + Date.now(),
          name: batchName,
          totalLeads: newContacts.length,
          distributedLeads: newContacts.length,
          createdAt: Date.now(),
          createdBy: currentProfile.email || 'admin',
        });
      }

      await batch.commit();
    } catch (e) {
      console.error('Error batch saving contacts to Firestore:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Helper to delete contact from cloud
  const deleteContactFromCloud = async (contactId: string) => {
    if (!currentProfile) return;
    try {
      setSyncing(true);
      const ref = doc(db, 'users', currentProfile.uid, 'contacts', contactId);
      await deleteDoc(ref);
      const globalRef = doc(db, 'global_contacts', contactId);
      await deleteDoc(globalRef);
    } catch (e) {
      console.error('Error deleting contact from Firestore:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Helper to clear all contacts from cloud
  const clearAllContactsFromCloud = async (allContacts: Contact[]) => {
    if (!currentProfile || allContacts.length === 0) return;
    try {
      setSyncing(true);
      const batch = writeBatch(db);
      allContacts.forEach((c) => {
        const ref = doc(db, 'users', currentProfile.uid, 'contacts', c.id);
        batch.delete(ref);
      });
      await batch.commit();
    } catch (e) {
      console.error('Error clearing contacts in Firestore:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Save template to cloud
  const saveTemplateToCloud = async (template: MessageTemplate) => {
    if (!currentProfile) return;
    try {
      const ref = doc(db, 'users', currentProfile.uid, 'templates', template.id);
      await setDoc(ref, template, { merge: true });
    } catch (e) {
      console.error('Error saving template to Firestore:', e);
    }
  };

  // Delete template from cloud
  const deleteTemplateFromCloud = async (templateId: string) => {
    if (!currentProfile) return;
    try {
      const ref = doc(db, 'users', currentProfile.uid, 'templates', templateId);
      await deleteDoc(ref);
    } catch (e) {
      console.error('Error deleting template from Firestore:', e);
    }
  };

  // --- ADMIN ACTIONS (User Approval & Lead Distribution) ---
  const handleApproveUser = async (uid: string, role: 'admin' | 'attendant') => {
    try {
      const userDocRef = doc(db, 'user_profiles', uid);
      await setDoc(
        userDocRef,
        {
          status: 'approved',
          role: role,
          approvedAt: Date.now(),
          approvedBy: currentProfile?.email || 'admin',
        },
        { merge: true }
      );
      setAllUsers((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? { ...u, status: 'approved', role, approvedAt: Date.now(), approvedBy: currentProfile?.email || 'admin' }
            : u
        )
      );
      addToast('Acesso do usuário liberado com sucesso!', 'success');
    } catch (e: any) {
      addToast('Erro ao aprovar usuário: ' + e.message, 'error');
    }
  };

  const handleBlockUser = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'user_profiles', uid);
      await setDoc(userDocRef, { status: 'blocked' }, { merge: true });
      setAllUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: 'blocked' } : u))
      );
      addToast('Usuário bloqueado.', 'info');
    } catch (e: any) {
      addToast('Erro ao bloquear usuário: ' + e.message, 'error');
    }
  };

  const handleChangeUserRole = async (uid: string, role: 'admin' | 'attendant') => {
    try {
      const userDocRef = doc(db, 'user_profiles', uid);
      await setDoc(userDocRef, { role }, { merge: true });
      setAllUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role } : u))
      );
      addToast('Cargo do usuário alterado com sucesso!', 'success');
    } catch (e: any) {
      addToast('Erro ao alterar cargo: ' + e.message, 'error');
    }
  };

  const handleDistributeContacts = async (
    contactsToAssign: Contact[],
    targetUserUid: string,
    targetUserEmail: string
  ) => {
    if (contactsToAssign.length === 0) return;
    try {
      setSyncing(true);
      const batch = writeBatch(db);

      contactsToAssign.forEach((c) => {
        const updatedContact: Contact = {
          ...c,
          assignedTo: targetUserUid,
          assignedToEmail: targetUserEmail,
        };

        // 1. Save in target user's contacts
        const targetRef = doc(db, 'users', targetUserUid, 'contacts', c.id);
        batch.set(targetRef, updatedContact, { merge: true });

        // 2. Update global contact reference
        const globalRef = doc(db, 'global_contacts', c.id);
        batch.set(globalRef, updatedContact, { merge: true });
      });

      await batch.commit();
      addToast(`${contactsToAssign.length} contatos distribuídos para ${targetUserEmail}!`, 'success');
    } catch (e: any) {
      console.error('Error distributing contacts:', e);
      addToast('Erro na distribuição: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDistributeEqually = async (
    unassignedContacts: Contact[],
    targetUsers: UserProfile[]
  ) => {
    if (unassignedContacts.length === 0 || targetUsers.length === 0) return;
    try {
      setSyncing(true);
      const batch = writeBatch(db);

      unassignedContacts.forEach((contact, idx) => {
        const assignedUser = targetUsers[idx % targetUsers.length];
        const updated: Contact = {
          ...contact,
          assignedTo: assignedUser.uid,
          assignedToEmail: assignedUser.email,
        };

        const targetRef = doc(db, 'users', assignedUser.uid, 'contacts', contact.id);
        batch.set(targetRef, updated, { merge: true });

        const globalRef = doc(db, 'global_contacts', contact.id);
        batch.set(globalRef, updated, { merge: true });
      });

      await batch.commit();
      addToast(
        `${unassignedContacts.length} contatos divididos igualmente entre ${targetUsers.length} atendentes!`,
        'success'
      );
    } catch (e: any) {
      console.error('Error in equal distribution:', e);
      addToast('Erro na divisão: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleBatchDeleteGlobalContacts = async (contactIds: string[]) => {
    try {
      setSyncing(true);
      const batch = writeBatch(db);
      contactIds.forEach((id) => {
        const globalRef = doc(db, 'global_contacts', id);
        batch.delete(globalRef);
      });
      await batch.commit();
      addToast(`${contactIds.length} contatos excluídos da base central.`, 'info');
    } catch (e: any) {
      addToast('Erro ao excluir: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleReassignSingleContact = async (
    contactId: string,
    targetUserUid: string,
    targetUserEmail: string
  ) => {
    const contact = globalContacts.find((c) => c.id === contactId);
    if (!contact) return;
    try {
      setSyncing(true);
      const batch = writeBatch(db);

      const updated: Contact = {
        ...contact,
        assignedTo: targetUserUid,
        assignedToEmail: targetUserEmail,
      };

      // If previously assigned to another user, remove from old user's collection
      if (contact.assignedTo && contact.assignedTo !== targetUserUid) {
        const oldRef = doc(db, 'users', contact.assignedTo, 'contacts', contact.id);
        batch.delete(oldRef);
      }

      // Save in new user's collection
      const targetRef = doc(db, 'users', targetUserUid, 'contacts', contact.id);
      batch.set(targetRef, updated, { merge: true });

      // Update global contacts
      const globalRef = doc(db, 'global_contacts', contact.id);
      batch.set(globalRef, updated, { merge: true });

      await batch.commit();
      addToast(`Contato "${contact.nome}" reatribuído com sucesso para ${targetUserEmail}!`, 'success');
    } catch (e: any) {
      console.error('Error reassigning contact:', e);
      addToast('Erro ao reatribuir contato: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // --- AUTH HANDLERS (Simples por Usuário / Senha & Administrador) ---
  const handleDirectLogin = async (userOrEmail: string, pass: string): Promise<boolean | string> => {
    try {
      setAuthLoading(true);
      const cleanInput = userOrEmail.trim().toLowerCase();

      // Check Master Admin first
      const storedMasterPass = localStorage.getItem(STORAGE_ADMIN_PASS) || DEFAULT_MASTER_PASSWORD;
      if (
        (cleanInput === 'admin' || cleanInput === 'administrador' || cleanInput === MASTER_ADMIN_EMAIL.toLowerCase()) &&
        pass === storedMasterPass
      ) {
        const masterProfile: UserProfile = {
          uid: 'master_admin_root',
          email: MASTER_ADMIN_EMAIL,
          username: 'admin',
          displayName: 'Administrador Master',
          role: 'admin',
          status: 'approved',
          createdAt: Date.now(),
          approvedAt: Date.now(),
          approvedBy: 'system',
        };
        setCurrentProfile(masterProfile);
        localStorage.setItem(STORAGE_SESSION, JSON.stringify(masterProfile));
        // Also persist/update in Firestore
        try {
          await setDoc(doc(db, 'user_profiles', 'master_admin_root'), masterProfile, { merge: true });
        } catch (e) {
          console.warn('Firestore write warning:', e);
        }
        setActiveView('admin');
        addToast('Bem-vindo, Administrador! Painel liberado.', 'success');
        return true;
      }

      // Check among registered user profiles
      const user = allUsers.find(
        (u) =>
          (u.email && u.email.toLowerCase() === cleanInput) ||
          (u.username && u.username.toLowerCase() === cleanInput) ||
          (u.displayName && u.displayName.toLowerCase() === cleanInput)
      );

      if (!user) {
        return 'Usuário não encontrado. Se ainda não possui cadastro, crie sua conta na aba "Cadastrar Atendente".';
      }

      // Check password if configured
      if (user.password && user.password !== pass && pass !== storedMasterPass && pass !== 'admin123') {
        return 'Senha incorreta. Tente novamente ou peça ao administrador para resetar sua senha.';
      }

      const isMasterUser =
        (user.email && user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) ||
        user.username === 'admin' ||
        user.uid === 'master_admin_root';

      const finalProfile: UserProfile = isMasterUser
        ? { ...user, role: 'admin', status: 'approved', displayName: user.displayName || 'Administrador Master' }
        : user;

      setCurrentProfile(finalProfile);
      localStorage.setItem(STORAGE_SESSION, JSON.stringify(finalProfile));

      if (isMasterUser) {
        setActiveView('admin');
        addToast('Acesso de Administrador Master liberado!', 'success');
      } else if (user.status === 'pending') {
        addToast('Login efetuado! Sua conta está aguardando liberação do Administrador.', 'info');
      } else if (user.status === 'blocked') {
        addToast('Sua conta está bloqueada pelo Administrador.', 'error');
      } else {
        addToast(`Bem-vindo de volta, ${user.displayName || user.email}!`, 'success');
      }

      return true;
    } catch (e: any) {
      return 'Erro ao autenticar: ' + e.message;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDirectRegister = async (
    name: string,
    emailOrUser: string,
    pass: string
  ): Promise<boolean | string> => {
    try {
      setAuthLoading(true);
      const cleanEmail = emailOrUser.trim().toLowerCase();
      const isMaster = cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase();

      // Check if user already exists
      const exists = allUsers.some(
        (u) =>
          (u.email && u.email.toLowerCase() === cleanEmail) ||
          (u.username && u.username.toLowerCase() === cleanEmail)
      );
      if (exists) {
        return 'Já existe uma conta cadastrada com este email ou usuário. Faça login diretamente.';
      }

      const newUid = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const newProf: UserProfile = {
        uid: newUid,
        email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@portal.com`,
        username: cleanEmail,
        displayName: name.trim(),
        password: pass,
        role: isMaster ? 'admin' : 'attendant',
        status: isMaster ? 'approved' : 'pending',
        createdAt: Date.now(),
        approvedAt: isMaster ? Date.now() : undefined,
        approvedBy: isMaster ? 'system_master' : undefined,
      };

      // Save to Firestore
      try {
        await setDoc(doc(db, 'user_profiles', newUid), newProf);
      } catch (err) {
        console.warn('Firestore user save:', err);
      }

      // Update local state and session
      setAllUsers((prev) => [...prev, newProf]);
      setCurrentProfile(newProf);
      localStorage.setItem(STORAGE_SESSION, JSON.stringify(newProf));

      if (isMaster) {
        addToast('Conta de Administrador Master criada com sucesso!', 'success');
      } else {
        addToast('Cadastro realizado! Sua conta foi enviada para aprovação do Administrador.', 'success');
      }
      return true;
    } catch (e: any) {
      return 'Erro ao cadastrar: ' + e.message;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateUserByAdmin = async (
    name: string,
    emailOrUser: string,
    pass: string,
    role: 'admin' | 'attendant'
  ): Promise<boolean | string> => {
    try {
      const cleanEmail = emailOrUser.trim().toLowerCase();
      const newUid = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const newProf: UserProfile = {
        uid: newUid,
        email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@portal.com`,
        username: cleanEmail,
        displayName: name.trim(),
        password: pass,
        role: role,
        status: 'approved',
        createdAt: Date.now(),
        approvedAt: Date.now(),
        approvedBy: currentProfile?.displayName || 'admin',
      };

      try {
        await setDoc(doc(db, 'user_profiles', newUid), newProf);
      } catch (err) {
        console.warn('Firestore user save by admin:', err);
      }

      setAllUsers((prev) => [...prev, newProf]);
      addToast(`Atendente ${name} criado e liberado com sucesso!`, 'success');
      return true;
    } catch (e: any) {
      return 'Erro ao criar atendente: ' + e.message;
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem(STORAGE_SESSION);
      setCurrentProfile(null);
      addToast('Sessão encerrada com sucesso.', 'info');
    } catch (e) {
      console.error('Sign Out Error:', e);
    }
  };

  // --- TOAST HELPER ---
  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- DERIVED METRICS ---
  const pendingContacts = useMemo(
    () => contacts.filter((c) => !c.ultimoContato),
    [contacts]
  );
  const contactedContacts = useMemo(
    () => contacts.filter((c) => Boolean(c.ultimoContato)),
    [contacts]
  );
  const overdueContactsCount = useMemo(
    () => contacts.filter((c) => isOverdue(c.proximoContato)).length,
    [contacts]
  );

  const uniqueCourses = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.curso && c.curso.trim()) set.add(c.curso.trim());
    });
    return Array.from(set).sort();
  }, [contacts]);

  // Filtered & Sorted contacts list
  const filteredContacts = useMemo(() => {
    let pool =
      tabFilter === 'pendente'
        ? pendingContacts
        : tabFilter === 'enviado'
        ? contactedContacts
        : contacts;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      pool = pool.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          c.whatsapp.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.curso && c.curso.toLowerCase().includes(q)) ||
          (c.observacao && c.observacao.toLowerCase().includes(q))
      );
    }

    if (filterCurso) {
      pool = pool.filter((c) => c.curso === filterCurso);
    }

    if (filterTemp) {
      pool = pool.filter((c) => c.temperatura === filterTemp);
    }

    const sorted = [...pool].sort((a, b) => {
      if (sortBy === 'curso') {
        const courseA = (a.curso || 'Sem Curso').trim().toLowerCase();
        const courseB = (b.curso || 'Sem Curso').trim().toLowerCase();
        const diff = courseA.localeCompare(courseB, 'pt-BR');
        if (diff !== 0) return diff;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      }
      if (sortBy === 'nome') {
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      }
      if (sortBy === 'temperatura') {
        const priority: Record<Temperature, number> = {
          Pagou: 0,
          Quente: 1,
          Potencial: 2,
          Morno: 3,
          Frio: 4,
        };
        const pA = priority[a.temperatura || 'Frio'] ?? 5;
        const pB = priority[b.temperatura || 'Frio'] ?? 5;
        if (pA !== pB) return pA - pB;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      }
      if (sortBy === 'recentes') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      return 0;
    });

    return sorted;
  }, [contacts, pendingContacts, contactedContacts, tabFilter, searchTerm, filterCurso, filterTemp, sortBy]);

  // --- ACTIONS ---
  const handleImportRows = (rows: Partial<Contact>[], batchName?: string) => {
    let added = 0;
    let skipped = 0;

    const newItems: Contact[] = [];

    rows.forEach((r) => {
      if (!r.nome || !r.nome.trim()) {
        skipped++;
        return;
      }

      const dup = contacts.some(
        (c) =>
          (c.nome.trim().toLowerCase() === r.nome!.trim().toLowerCase() &&
            (c.whatsapp === r.whatsapp || (!r.whatsapp && !c.whatsapp))) ||
          (Boolean(r.email) && Boolean(c.email) && r.email?.trim().toLowerCase() === c.email?.trim().toLowerCase())
      );

      if (dup) {
        skipped++;
        return;
      }

      newItems.push({
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        nome: r.nome.trim(),
        whatsapp: r.whatsapp || '',
        email: r.email || '',
        curso: r.curso || '',
        temperatura: r.temperatura || 'Frio',
        dataContato: r.dataContato || '',
        ultimoContato: r.ultimoContato || '',
        proximoContato: r.proximoContato || '',
        status: r.status || '',
        observacao: r.observacao || '',
        createdAt: Date.now(),
        assignedTo: currentProfile?.uid,
        assignedToEmail: currentProfile?.email || undefined,
        batchName: batchName || 'Importação Direta',
      });
      added++;
    });

    if (added > 0) {
      setContacts((prev) => [...prev, ...newItems]);
      saveBatchContactsToCloud(newItems, batchName);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 } });
      addToast(
        `${added} contato(s) importado(s) com sucesso!${
          skipped ? ` (${skipped} ignorado(s) por duplicação/sem nome)` : ''
        }`,
        'success'
      );
    } else {
      addToast(
        `Nenhum novo contato importado. A planilha contém ${rows.length} linha(s), mas todas estavam sem nome ou já cadastradas.`,
        'error'
      );
    }
  };

  const handleImportSmartContacts = async (result: SmartImportResult) => {
    const {
      contacts: rows,
      batchName,
      distributionMode,
      targetUserUid,
      targetUserEmail,
      selectedAttendantUids,
    } = result;

    let added = 0;
    const newItems: Contact[] = [];

    rows.forEach((r) => {
      if (!r.nome || !r.nome.trim()) return;

      newItems.push({
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        nome: r.nome.trim(),
        whatsapp: r.whatsapp || '',
        email: r.email || '',
        curso: r.curso || '',
        temperatura: r.temperatura || 'Frio',
        dataContato: r.dataContato || todayStr(),
        ultimoContato: r.ultimoContato || '',
        proximoContato: r.proximoContato || '',
        status: r.status || 'Novo Lead',
        observacao: r.observacao || '',
        createdAt: Date.now(),
        batchName: batchName || 'Importação IA',
      });
      added++;
    });

    if (added === 0) {
      addToast('Nenhum contato com nome válido para importar.', 'error');
      return;
    }

    try {
      setSyncing(true);
      const batch = writeBatch(db);
      const batchDocId = 'b_' + Date.now();
      const batchDocRef = doc(db, 'lead_batches', batchDocId);
      let distributedCount = 0;

      if (distributionMode === 'unassigned') {
        newItems.forEach((c) => {
          const globalRef = doc(db, 'global_contacts', c.id);
          batch.set(globalRef, c, { merge: true });
        });
        batch.set(batchDocRef, {
          id: batchDocId,
          name: batchName,
          totalLeads: newItems.length,
          distributedLeads: 0,
          createdAt: Date.now(),
          createdBy: currentProfile?.email || 'admin',
        });
      } else if (distributionMode === 'single' && targetUserUid) {
        newItems.forEach((c) => {
          const updated: Contact = {
            ...c,
            assignedTo: targetUserUid,
            assignedToEmail: targetUserEmail,
          };
          const userRef = doc(db, 'users', targetUserUid, 'contacts', c.id);
          batch.set(userRef, updated, { merge: true });
          const globalRef = doc(db, 'global_contacts', c.id);
          batch.set(globalRef, updated, { merge: true });
        });
        distributedCount = newItems.length;
        batch.set(batchDocRef, {
          id: batchDocId,
          name: batchName,
          totalLeads: newItems.length,
          distributedLeads: distributedCount,
          createdAt: Date.now(),
          createdBy: currentProfile?.email || 'admin',
        });
      } else if (distributionMode === 'self' && currentProfile) {
        newItems.forEach((c) => {
          const updated: Contact = {
            ...c,
            assignedTo: currentProfile.uid,
            assignedToEmail: currentProfile.email,
          };
          const userRef = doc(db, 'users', currentProfile.uid, 'contacts', c.id);
          batch.set(userRef, updated, { merge: true });
          const globalRef = doc(db, 'global_contacts', c.id);
          batch.set(globalRef, updated, { merge: true });
        });
        setContacts((prev) => [
          ...newItems.map((c) => ({
            ...c,
            assignedTo: currentProfile.uid,
            assignedToEmail: currentProfile.email,
          })),
          ...prev,
        ]);
        distributedCount = newItems.length;
        batch.set(batchDocRef, {
          id: batchDocId,
          name: batchName,
          totalLeads: newItems.length,
          distributedLeads: distributedCount,
          createdAt: Date.now(),
          createdBy: currentProfile?.email || 'admin',
        });
      } else if (distributionMode === 'equal') {
        const targetAttendants = allUsers.filter(
          (u) =>
            u.status === 'approved' &&
            u.role === 'attendant' &&
            (!selectedAttendantUids || selectedAttendantUids.length === 0 || selectedAttendantUids.includes(u.uid))
        );
        if (targetAttendants.length > 0) {
          newItems.forEach((c, idx) => {
            const assignedUser = targetAttendants[idx % targetAttendants.length];
            const updated: Contact = {
              ...c,
              assignedTo: assignedUser.uid,
              assignedToEmail: assignedUser.email,
            };
            const userRef = doc(db, 'users', assignedUser.uid, 'contacts', c.id);
            batch.set(userRef, updated, { merge: true });
            const globalRef = doc(db, 'global_contacts', c.id);
            batch.set(globalRef, updated, { merge: true });
          });
          distributedCount = newItems.length;
        } else {
          newItems.forEach((c) => {
            const globalRef = doc(db, 'global_contacts', c.id);
            batch.set(globalRef, c, { merge: true });
          });
        }
        batch.set(batchDocRef, {
          id: batchDocId,
          name: batchName,
          totalLeads: newItems.length,
          distributedLeads: distributedCount,
          createdAt: Date.now(),
          createdBy: currentProfile?.email || 'admin',
        });
      }

      await batch.commit();
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.8 } });
      addToast(
        `🎉 ${added} contato(s) do lote "${batchName}" importado(s) com sucesso!`,
        'success'
      );
    } catch (e: any) {
      console.error('Error importing smart contacts:', e);
      addToast('Erro ao importar contatos: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddManualContact = (partial: Partial<Contact>) => {
    const newContact: Contact = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      nome: partial.nome || 'Novo Aluno',
      whatsapp: partial.whatsapp || '',
      email: partial.email || '',
      curso: partial.curso || '',
      temperatura: partial.temperatura || 'Frio',
      dataContato: partial.dataContato || todayStr(),
      ultimoContato: partial.ultimoContato || '',
      proximoContato: partial.proximoContato || '',
      status: partial.status || 'Novo Lead',
      observacao: partial.observacao || '',
      createdAt: Date.now(),
      assignedTo: currentProfile?.uid,
      assignedToEmail: currentProfile?.email || undefined,
    };

    setContacts((prev) => [newContact, ...prev]);
    saveContactToCloud(newContact);
    addToast(`Contato "${newContact.nome}" cadastrado com sucesso!`, 'success');
  };

  const handleMarkToday = (id: string) => {
    const target = contacts.find((c) => c.id === id);
    if (target) {
      const updated: Contact = {
        ...target,
        ultimoContato: todayStr(),
        dataContato: target.dataContato || todayStr(),
      };
      saveContactToCloud(updated);
    }
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          ultimoContato: todayStr(),
          dataContato: c.dataContato || todayStr(),
        };
      })
    );
    addToast('Contato marcado como contatado hoje!', 'success');
  };

  // Bulk mark multiple/all filtered contacts as contacted (useful for external WhatsApp/SMS blast campaigns)
  const handleBulkMarkAsContacted = async (targetContacts: Contact[], labelDescription = 'todos os contatos visíveis') => {
    if (!targetContacts || targetContacts.length === 0) {
      addToast('Nenhum contato na lista para marcar.', 'info');
      return;
    }

    const uncontacted = targetContacts.filter((c) => !c.ultimoContato);
    const countToUpdate = uncontacted.length > 0 ? uncontacted.length : targetContacts.length;

    const confirmed = window.confirm(
      `Confirma marcar ${countToUpdate} contato(s) de "${labelDescription}" como CONTATADOS HOJE (${todayStr()})?\n\nIsso moverá os contatos para a aba "Contatados".`
    );

    if (!confirmed) return;

    const today = todayStr();
    const updatedIds = new Set(targetContacts.map((c) => c.id));

    // Update state immediately
    setContacts((prev) =>
      prev.map((c) => {
        if (updatedIds.has(c.id)) {
          return {
            ...c,
            ultimoContato: today,
            dataContato: c.dataContato || today,
          };
        }
        return c;
      })
    );

    // Save batch to cloud
    try {
      if (currentProfile?.uid) {
        const batch = writeBatch(db);
        targetContacts.forEach((c) => {
          const contactRef = doc(db, 'users', currentProfile.uid, 'contacts', c.id);
          batch.set(
            contactRef,
            {
              ...c,
              ultimoContato: today,
              dataContato: c.dataContato || today,
            },
            { merge: true }
          );
        });
        await batch.commit();
      }
      addToast(`🎉 Sucesso! ${countToUpdate} contatos marcados como contatados hoje!`, 'success');
    } catch (e: any) {
      console.error('Error saving bulk contacts:', e);
      addToast(`${countToUpdate} contatos atualizados localmente.`, 'info');
    }
  };

  const handleUndoContact = (id: string) => {
    const target = contacts.find((c) => c.id === id);
    if (target) {
      const updated: Contact = { ...target, ultimoContato: '' };
      saveContactToCloud(updated);
    }
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ultimoContato: '' } : c))
    );
    addToast('Marcação de contato desfeita.', 'info');
  };

  const handleUpdateField = (id: string, field: keyof Contact, value: string) => {
    const target = contacts.find((c) => c.id === id);
    if (target) {
      const updated: Contact = { ...target, [field]: value };
      saveContactToCloud(updated);
    }
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return { ...c, [field]: value };
      })
    );
  };

  const handleDeleteContact = (id: string) => {
    deleteContactFromCloud(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    addToast('Contato removido da lista.', 'info');
  };

  const handleClearAll = () => {
    clearAllContactsFromCloud(contacts);
    setContacts([]);
    addToast('Todos os contatos foram apagados.', 'info');
  };

  const handleLoadSample = () => {
    setContacts(SAMPLE_CONTACTS);
    saveBatchContactsToCloud(SAMPLE_CONTACTS, 'Lote Demonstrativo');
    addToast('Contatos de exemplo recarregados!', 'success');
  };

  // Templates
  const handleUpdateTemplate = (updated: MessageTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    saveTemplateToCloud(updated);
    addToast('Script de mensagem atualizado!', 'success');
  };

  const handleAddTemplate = (newT: MessageTemplate) => {
    setTemplates((prev) => [newT, ...prev]);
    saveTemplateToCloud(newT);
    addToast('Novo script de mensagem criado!', 'success');
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    deleteTemplateFromCloud(id);
    addToast('Script excluído.', 'info');
  };

  const handleResetTemplates = () => {
    setTemplates(DEFAULT_TEMPLATES);
    addToast('Scripts restaurados para o padrão original.', 'info');
  };

  // Objections
  const handleAddObjection = (newObj: Objection) => {
    setObjections((prev) => [newObj, ...prev]);
    addToast('Nova quebra de objeção adicionada!', 'success');
  };

  const handleDeleteObjection = (id: string) => {
    setObjections((prev) => prev.filter((o) => o.id !== id));
    addToast('Objeção removida.', 'info');
  };

  // Plans
  const handleUpdatePlanPrice = (id: string, newPrice: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, preco: newPrice } : p))
    );
    addToast('Valor do plano atualizado com sucesso!', 'success');
  };

  const handleAddBenefit = (planId: string, benefit: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, beneficios: [...p.beneficios, benefit] } : p
      )
    );
    addToast('Benefício adicionado ao plano!', 'success');
  };

  const handleRemoveBenefit = (planId: string, index: number) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? { ...p, beneficios: p.beneficios.filter((_, i) => i !== index) }
          : p
      )
    );
    addToast('Benefício removido.', 'info');
  };

  const pendingApprovalsCount = allUsers.filter((u) => u.status === 'pending').length;
  const inactiveAlertsCount = useMemo(
    () => globalContacts.filter((c) => isWithoutContactFor3Days(c)).length,
    [globalContacts]
  );

  return (
    <div className="min-h-screen bg-[#101B2D] text-[#EDE6D6] font-sans antialiased p-3 sm:p-6 lg:p-8 flex flex-col">
      <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
        {/* Top Header with Navigation Tabs */}
        <Header
          activeView={activeView}
          onSelectView={setActiveView}
          onOpenDailyExport={() => setShowDailyExport(true)}
          onOpenAIAssistant={() => setShowAIChatAssistant(true)}
          contactsCount={contacts.length}
          currentProfile={currentProfile}
          pendingApprovalsCount={pendingApprovalsCount}
          inactiveAlertsCount={inactiveAlertsCount}
        />

        {/* Auth status & Login banner */}
        <AuthBanner
          user={null}
          profile={currentProfile}
          loading={authLoading}
          syncing={syncing}
          onOpenLogin={() => {
            setLoginModalTab('login');
            setShowLoginModal(true);
          }}
          onSignOut={handleSignOut}
          contactsCount={contacts.length}
        />

        {/* Global AI Chat Assistant Modal */}
        <AIChatAssistant
          isOpen={showAIChatAssistant}
          onClose={() => setShowAIChatAssistant(false)}
          contacts={contacts}
          objections={objections}
          plans={plans}
        />

        {/* VIEW 0: ADMIN PANEL (Exclusive for Administrator) */}
        {activeView === 'admin' && currentProfile?.role === 'admin' && (
          <div className="animate-fadeIn">
            <AdminPanel
              currentProfile={currentProfile}
              users={allUsers}
              globalContacts={globalContacts}
              batches={leadBatches}
              onApproveUser={handleApproveUser}
              onBlockUser={handleBlockUser}
              onChangeUserRole={handleChangeUserRole}
              onCreateUserByAdmin={handleCreateUserByAdmin}
              onDistributeContacts={handleDistributeContacts}
              onDistributeEqually={handleDistributeEqually}
              onReassignSingleContact={handleReassignSingleContact}
              onBatchDeleteContacts={handleBatchDeleteGlobalContacts}
              onImportSmartContacts={handleImportSmartContacts}
            />
          </div>
        )}

        {/* VIEW 1: CONTATOS (Listagem, Filtros, Cards de Contato) */}
        {activeView === 'contatos' && (
          <div className="space-y-4">
            {/* Dropzone & Import Bar */}
            <Dropzone
              onImportRows={handleImportRows}
              onClearAll={handleClearAll}
              hasContacts={contacts.length > 0}
              isAdmin={currentProfile?.role === 'admin'}
              onOpenSmartImport={() => setShowAppSmartImport(true)}
            />

            {/* Quick Action & Search Controls */}
            <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-3 sm:p-4 shadow-md space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
                  <input
                    type="text"
                    id="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, WhatsApp, e-mail, curso ou notas..."
                    className="w-full bg-[#101B2D] border border-[#2B3D63] rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-[#EDE6D6] placeholder-[#8C98B4] focus:outline-none focus:border-[#C9A227] transition-colors"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 text-xs text-[#8C98B4] hover:text-[#EDE6D6]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Status Tabs: Pendentes, Contatados, Todos */}
                <div className="flex items-center rounded-lg bg-[#101B2D] p-1 border border-[#2B3D63] self-start md:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setTabFilter('pendente')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                      tabFilter === 'pendente'
                        ? 'bg-[#C9A227] text-[#101B2D] shadow-sm font-bold'
                        : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                    }`}
                  >
                    <span>Pendentes</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        tabFilter === 'pendente'
                          ? 'bg-[#101B2D]/30 text-[#101B2D]'
                          : 'bg-[#172644] text-[#8C98B4]'
                      }`}
                    >
                      {pendingContacts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('enviado')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                      tabFilter === 'enviado'
                        ? 'bg-[#C9A227] text-[#101B2D] shadow-sm font-bold'
                        : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                    }`}
                  >
                    <span>Contatados</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        tabFilter === 'enviado'
                          ? 'bg-[#101B2D]/30 text-[#101B2D]'
                          : 'bg-[#172644] text-[#8C98B4]'
                      }`}
                    >
                      {contactedContacts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('todos')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                      tabFilter === 'todos'
                        ? 'bg-[#C9A227] text-[#101B2D] shadow-sm font-bold'
                        : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                    }`}
                  >
                    <span>Todos</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        tabFilter === 'todos'
                          ? 'bg-[#101B2D]/30 text-[#101B2D]'
                          : 'bg-[#172644] text-[#8C98B4]'
                      }`}
                    >
                      {contacts.length}
                    </span>
                  </button>
                </div>

                {/* Action Buttons: Marcar Todos Disparados + Novo Contato */}
                <div className="flex items-center gap-2">
                  {filteredContacts.length > 0 && (
                    <button
                      type="button"
                      id="bulk-mark-contacted-btn"
                      onClick={() =>
                        handleBulkMarkAsContacted(
                          filteredContacts,
                          filterCurso
                            ? `Curso: ${filterCurso} (${filteredContacts.length} contatos)`
                            : tabFilter === 'pendente'
                            ? `Pendentes (${filteredContacts.length} contatos)`
                            : `Lista atual (${filteredContacts.length} contatos)`
                        )
                      }
                      title="Marcar todos os contatos listados/filtrados como contatados hoje (ideal após disparos em massa no Saler)"
                      className="flex items-center justify-center gap-1.5 bg-[#6E8F5C]/20 hover:bg-[#6E8F5C]/35 text-[#4ADE80] border border-[#6E8F5C]/40 font-semibold text-xs sm:text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                      <span>Marcar Todos como Contatados ({filteredContacts.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="add-contact-btn"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center justify-center gap-1.5 bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-4 h-4 text-[#C9A227]" />
                    <span>Novo Contato</span>
                  </button>
                </div>
              </div>

              {/* Filters Row: Curso, Temperatura, Ordenação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#2B3D63]/50 text-xs">
                {/* Filter Curso */}
                <div className="flex items-center gap-2">
                  <span className="text-[#8C98B4] text-[11px] uppercase font-semibold tracking-wider shrink-0 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-[#C9A227]" />
                    Curso:
                  </span>
                  <select
                    id="filter-curso"
                    value={filterCurso}
                    onChange={(e) => setFilterCurso(e.target.value)}
                    className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#C9A227]"
                  >
                    <option value="">Todos os Cursos ({uniqueCourses.length})</option>
                    {uniqueCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Temperatura */}
                <div className="flex items-center gap-2">
                  <span className="text-[#8C98B4] text-[11px] uppercase font-semibold tracking-wider shrink-0">
                    Termômetro:
                  </span>
                  <select
                    id="filter-temp"
                    value={filterTemp}
                    onChange={(e) => setFilterTemp(e.target.value)}
                    className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#C9A227]"
                  >
                    <option value="">Todas as Temperaturas</option>
                    <option value="Quente">🔥 Quente (Fecha rápido)</option>
                    <option value="Potencial">⚡ Potencial (Interessado)</option>
                    <option value="Morno">🌤️ Morno (Pesquisando)</option>
                    <option value="Frio">❄️ Frio (Não decidiu)</option>
                    <option value="Pagou">💳 Pagou (Convertido)</option>
                  </select>
                </div>

                {/* Order / Sort criteria */}
                <div className="flex items-center gap-2">
                  <span className="text-[#8C98B4] text-[11px] uppercase font-semibold tracking-wider shrink-0 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-[#C9A227]" />
                    Ordem:
                  </span>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#C9A227]"
                  >
                    <option value="curso">Agrupar por Curso (A-Z) [Padrão]</option>
                    <option value="nome">Nome do Aluno (A-Z)</option>
                    <option value="temperatura">Temperatura (Quentes primeiro)</option>
                    <option value="recentes">Mais recentes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal: Add Contact Form */}
            {showAddForm && (
              <AddContactForm
                onAddContact={handleAddManualContact}
                onClose={() => setShowAddForm(false)}
                availableCourses={uniqueCourses}
              />
            )}

            {/* Contacts Cards Stream */}
            <div className="space-y-3">
              {filteredContacts.length === 0 ? (
                <div className="bg-[#172644] border border-[#2B3D63] rounded-2xl p-12 text-center">
                  <Users className="w-12 h-12 text-[#8C98B4] mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold text-[#EDE6D6]">Nenhum contato encontrado</h3>
                  <p className="text-xs text-[#8C98B4] mt-1 max-w-md mx-auto">
                    Não há contatos cadastrados para os filtros selecionados. Tente importar uma planilha ou adicionar um novo lead.
                  </p>
                  {(searchTerm || filterCurso || filterTemp) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setFilterCurso('');
                        setFilterTemp('');
                      }}
                      className="mt-4 text-xs font-semibold text-[#C9A227] hover:underline cursor-pointer"
                    >
                      Limpar filtros aplicados
                    </button>
                  )}
                </div>
              ) : (
                filteredContacts.map((c, index) => {
                  const prevContact = filteredContacts[index - 1];
                  const showCourseHeader =
                    sortBy === 'curso' && (!prevContact || prevContact.curso !== c.curso);

                  return (
                    <React.Fragment key={c.id}>
                      {showCourseHeader && (
                        <div className="pt-3 pb-1 flex items-center justify-between border-b border-[#2B3D63] mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#C9A227]" />
                            <h3 className="text-sm sm:text-base font-bold font-serif text-[#EDE6D6] tracking-wide">
                              {c.curso || 'Sem Curso Informado'}
                            </h3>
                            <span className="text-[11px] font-sans text-[#8C98B4] bg-[#172644] px-2 py-0.5 rounded-full border border-[#2B3D63]">
                              {filteredContacts.filter((item) => (item.curso || '') === (c.curso || '')).length} aluno(s)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const courseContacts = filteredContacts.filter(
                                  (item) => (item.curso || '') === (c.curso || '')
                                );
                                handleBulkMarkAsContacted(
                                  courseContacts,
                                  `Curso: ${c.curso || 'Sem Curso'}`
                                );
                              }}
                              className="text-[11px] font-semibold text-[#8C98B4] hover:text-[#4ADE80] flex items-center gap-1 bg-[#101B2D] border border-[#2B3D63] hover:border-[#6E8F5C]/50 px-2 py-1 rounded cursor-pointer transition-colors"
                              title="Marcar todos os alunos deste curso como contatados após disparo"
                            >
                              <CheckCircle2 className="w-3 h-3 text-[#4ADE80]" />
                              <span>Marcar este curso como contatado</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setMessageModalContact(c)}
                              className="text-[11px] font-semibold text-[#6E8F5C] hover:text-[#4ADE80] flex items-center gap-1 bg-[#101B2D] border border-[#6E8F5C]/40 px-2.5 py-1 rounded cursor-pointer transition-colors"
                              title={`Iniciar disparos a partir deste curso`}
                            >
                              <Send className="w-3 h-3" />
                              <span>Enviar a partir daqui</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <ContactCard
                        contact={c}
                        onMarkToday={handleMarkToday}
                        onUndoContact={handleUndoContact}
                        onUpdateField={handleUpdateField}
                        onDeleteContact={handleDeleteContact}
                        onOpenMessageModal={(contact) => setMessageModalContact(contact)}
                        onOpenSalesAssistant={(contact) => setSalesAssistantContact(contact)}
                      />
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW: DISPARADOR RÁPIDO WHATSAPP E E-MAIL */}
        {activeView === 'disparos' && (
          <FastBroadcastView
            contacts={contacts}
            templates={templates}
            onAddContact={handleAddManualContact}
            onMarkContacted={handleMarkToday}
            onToast={addToast}
          />
        )}

        {/* VIEW: DASHBOARD & MÉTRICAS */}
        {activeView === 'dashboard' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Top Stat Cards */}
            <StatsCards
              total={contacts.length}
              pending={pendingContacts.length}
              contacted={contactedContacts.length}
              overdue={overdueContactsCount}
            />

            {/* Performance & Lead Conversion Dashboard (Recharts) */}
            <DashboardCharts
              contacts={contacts}
              onOpenDailyExport={() => setShowDailyExport(true)}
            />

            {/* Thermal Temperature Donut & Legend */}
            <TemperatureChart
              contacts={contacts}
              selectedTempFilter={filterTemp}
              onSelectTempFilter={(temp) => {
                setFilterTemp(temp);
                setActiveView('contatos');
              }}
            />
          </div>
        )}

        {/* VIEW 2: MENSAGENS PRONTAS & SCRIPTS */}
        {activeView === 'mensagens' && (
          <MessagesView
            templates={templates}
            onUpdateTemplate={handleUpdateTemplate}
            onAddTemplate={handleAddTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onResetTemplates={handleResetTemplates}
            onToast={addToast}
          />
        )}

        {/* VIEW 3: OBJEÇÕES */}
        {activeView === 'objecoes' && (
          <ObjectionsView
            objections={objections}
            onAddObjection={handleAddObjection}
            onDeleteObjection={handleDeleteObjection}
            onCopySuccess={(msg) => addToast(msg, 'success')}
          />
        )}

        {/* VIEW 4: PLANOS */}
        {activeView === 'planos' && (
          <PlansView
            plans={plans}
            onUpdatePlanPrice={handleUpdatePlanPrice}
            onAddBenefit={handleAddBenefit}
            onRemoveBenefit={handleRemoveBenefit}
            onCopyPlan={(msg) => addToast(msg, 'success')}
          />
        )}
      </div>

      {/* Quick Message Modal with Live Contact Customization and Course Queue Navigation */}
      <MessageModal
        isOpen={Boolean(messageModalContact)}
        contact={messageModalContact}
        contactsQueue={filteredContacts}
        templates={templates}
        onClose={() => setMessageModalContact(null)}
        onSelectContact={(c) => setMessageModalContact(c)}
        onMarkContacted={(id) => {
          handleMarkToday(id);
        }}
        onToast={addToast}
      />

      {/* Sales Assistant AI Modal with Automated Objections & Plans Suggestions */}
      <SalesAssistantModal
        isOpen={Boolean(salesAssistantContact)}
        contact={salesAssistantContact}
        contactsQueue={filteredContacts}
        objections={objections}
        plans={plans}
        onClose={() => setSalesAssistantContact(null)}
        onSelectContact={(c) => setSalesAssistantContact(c)}
        onUpdateContactField={(id, field, val) => handleUpdateField(id, field, val)}
        onMarkContacted={(id) => handleMarkToday(id)}
        onToast={addToast}
      />

      {/* End of Day Export & Closing Modal */}
      {showDailyExport && (
        <DailyExportModal
          contacts={contacts}
          onClose={() => setShowDailyExport(false)}
          onToast={addToast}
        />
      )}

      {/* Smart Import Modal for Leads (Excel, PDF, Images, Text via Gemini IA) */}
      <SmartImportModal
        isOpen={showAppSmartImport}
        onClose={() => setShowAppSmartImport(false)}
        onConfirmImport={async (res) => {
          await handleImportSmartContacts(res);
          setShowAppSmartImport(false);
        }}
        existingContacts={globalContacts.length > 0 ? globalContacts : contacts}
        users={allUsers}
        currentProfile={currentProfile}
      />

      {/* Login & Registration Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleDirectLogin}
        onRegister={handleDirectRegister}
        initialTab={loginModalTab}
      />

      {/* Floating Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

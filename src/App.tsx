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
  Clipboard,
  AlertCircle,
  Clock,
  Zap,
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
  TEMP_ORDER,
} from './data/defaults';
import {
  todayStr,
  exportContactsToExcel,
  isOverdue,
  isWithoutContactFor3Days,
  cleanPhone,
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
import { QuickPasteModal } from './components/QuickPasteModal';
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
import { NewLeadsAlertBanner, playNewLeadChime } from './components/NewLeadsAlertBanner';
import { PortalWatermarkBackground } from './components/BrandLogo';
import { AuthGateway } from './components/AuthGateway';

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
  displayName: 'Lucas Henrique',
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

  // --- ADMIN STATE (All users and all global contacts) ---
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [globalContacts, setGlobalContacts] = useState<Contact[]>([]);
  const [leadBatches, setLeadBatches] = useState<LeadBatch[]>([]);

  // Approved attendants list
  const attendants = useMemo(
    () => allUsers.filter((u) => u.status === 'approved' && u.role === 'attendant'),
    [allUsers]
  );

  // --- LOCAL STATE (with strict per-user storage isolation) ---
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      // Purge legacy unpartitioned key to prevent data leaks across sessions
      localStorage.removeItem(STORAGE_CONTACTS);

      const savedSession = localStorage.getItem(STORAGE_SESSION);
      if (savedSession) {
        const prof = JSON.parse(savedSession);
        if (prof?.uid) {
          const userStorageKey = `contacts_v3_${prof.uid}`;
          const saved = localStorage.getItem(userStorageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed.filter(
                (c: Contact) =>
                  c &&
                  c.id &&
                  !c.id.startsWith('c_demo_') &&
                  c.nome !== 'Ana Carolina Mendes' &&
                  c.nome !== 'Rodrigo Silveira Ramos' &&
                  c.nome !== 'Beatriz Vasconcelos' &&
                  c.nome !== 'Lucas Albuquerque' &&
                  c.nome !== 'Mariana Duarte Costa'
              );
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TEMPLATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with DEFAULT_TEMPLATES to ensure new built-in templates are included
          const existingIds = new Set(parsed.map((p: MessageTemplate) => p.id));
          const missingDefaults = DEFAULT_TEMPLATES.filter((d) => !existingIds.has(d.id));
          if (missingDefaults.length > 0) {
            const merged = [...parsed, ...missingDefaults];
            localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
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
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false);
  const [showDailyExport, setShowDailyExport] = useState(false);
  const [messageModalContact, setMessageModalContact] = useState<Contact | null>(null);
  const [salesAssistantContact, setSalesAssistantContact] = useState<Contact | null>(null);
  const [showAIChatAssistant, setShowAIChatAssistant] = useState(false);
  const [showAppSmartImport, setShowAppSmartImport] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [recentlyContactedNotice, setRecentlyContactedNotice] = useState<{ contactName: string; contactId: string } | null>(null);

  // Global Ctrl+V / Cmd+V shortcut to open Quick Paste when not typing in an input
  useEffect(() => {
    const handleGlobalPaste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;
        if (!isInput && activeView === 'contatos') {
          setShowQuickPasteModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalPaste);
    return () => window.removeEventListener('keydown', handleGlobalPaste);
  }, [activeView]);

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

      return () => {
        unsubUsers();
      };
    } catch (e) {
      console.warn('Firebase users listener init:', e);
    }
  }, [currentProfile]);

  // --- FIRESTORE REAL-TIME SYNC FOR ADMIN / SUPERVISOR (GLOBAL CONTACTS & BATCHES) ---
  useEffect(() => {
    // SECURITY & PRIVACY RULE: If no profile is logged in or role is attendant, NEVER listen to global database!
    if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'supervisor')) {
      setGlobalContacts([]);
      setLeadBatches([]);
      return;
    }

    try {
      // Listen to global contacts database in real-time for Admin & Supervisors
      const globalContactsRef = collection(db, 'global_contacts');
      const unsubGlobal = onSnapshot(
        globalContactsRef,
        (snapshot) => {
          const list: Contact[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Contact;
            if (data && data.id && !data.id.startsWith('c_demo_') && data.nome !== 'Ana Carolina Mendes') {
              list.push(data);
            } else if (data?.id?.startsWith('c_demo_')) {
              deleteDoc(doc(db, 'global_contacts', data.id)).catch(() => {});
            }
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setGlobalContacts(list);
          setContacts(list);
        },
        (err) => console.warn('Firestore global contacts info:', err)
      );

      // Listen to lead distribution batches for Admin & Supervisors
      const batchesRef = collection(db, 'lead_batches');
      const unsubBatches = onSnapshot(
        batchesRef,
        (snapshot) => {
          const list: LeadBatch[] = [];
          snapshot.forEach((d) => {
            const batch = d.data() as LeadBatch;
            if (batch && !batch.name?.includes('Demonstrativo')) {
              list.push(batch);
            } else if (batch?.id) {
              deleteDoc(doc(db, 'lead_batches', batch.id)).catch(() => {});
            }
          });
          setLeadBatches(list);
        },
        (err) => console.warn('Firestore batches info:', err)
      );

      return () => {
        unsubGlobal();
        unsubBatches();
      };
    } catch (e) {
      console.warn('Firebase admin listeners init:', e);
    }
  }, [currentProfile?.uid, currentProfile?.role]);

  // --- FIRESTORE REAL-TIME SYNC FOR ATTENDANT (ONLY ASSIGNED CONTACTS & OWN TEMPLATES) ---
  useEffect(() => {
    // If not logged in, clear contacts state immediately
    if (!currentProfile) {
      setContacts([]);
      return;
    }

    // Only attendants listen to their isolated user subcollection
    if (currentProfile.role !== 'attendant') return;

    try {
      const contactsRef = collection(db, 'users', currentProfile.uid, 'contacts');
      const unsubContacts = onSnapshot(
        contactsRef,
        (snapshot) => {
          const cloudContacts: Contact[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Contact;
            if (data && data.id && !data.id.startsWith('c_demo_') && data.nome !== 'Ana Carolina Mendes') {
              cloudContacts.push(data);
            } else if (data?.id?.startsWith('c_demo_')) {
              deleteDoc(doc(db, 'users', currentProfile.uid, 'contacts', data.id)).catch(() => {});
            }
          });
          cloudContacts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setContacts(cloudContacts);
        },
        (error) => {
          console.warn('Firestore attendant sync error:', error);
        }
      );

      // Listen to attendant's custom templates
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
      console.warn('Firebase attendant sync init:', e);
    }
  }, [currentProfile?.uid, currentProfile?.role]);

  // --- LOCAL PERSISTENCE BACKUP (Partitioned strictly by User UID) ---
  useEffect(() => {
    if (!currentProfile?.uid) return;
    try {
      const userKey = `contacts_v3_${currentProfile.uid}`;
      localStorage.setItem(userKey, JSON.stringify(contacts));
    } catch (e) {
      console.error('Failed to save contacts locally', e);
    }
  }, [contacts, currentProfile?.uid]);

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
    try {
      setSyncing(true);
      // 1. First, save to attendant's assigned subcollection for guaranteed local isolation & persistence
      const assignedUid = contact.assignedTo || currentProfile?.uid;
      if (assignedUid) {
        const targetRef = doc(db, 'users', assignedUid, 'contacts', contact.id);
        await setDoc(targetRef, contact, { merge: true });
      }

      // If currentProfile is different from assignedTo, update currentProfile's subcollection as well
      if (currentProfile?.uid && currentProfile.uid !== contact.assignedTo) {
        const myRef = doc(db, 'users', currentProfile.uid, 'contacts', contact.id);
        await setDoc(myRef, contact, { merge: true }).catch(() => {});
      }

      // 2. Sync to global_contacts for administration view
      const globalRef = doc(db, 'global_contacts', contact.id);
      await setDoc(globalRef, contact, { merge: true }).catch((err) => {
        console.warn('Sync to global_contacts:', err);
      });
    } catch (e) {
      console.error('Error saving contact to Firestore:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Helper to batch save contacts to cloud
  const saveBatchContactsToCloud = async (newContacts: Contact[], batchName?: string) => {
    if (newContacts.length === 0) return;
    try {
      setSyncing(true);
      const batch = writeBatch(db);

      newContacts.forEach((c) => {
        // Save in global pool (central stock for Admin Panel)
        const globalRef = doc(db, 'global_contacts', c.id);
        batch.set(globalRef, { ...c, batchName: batchName || 'Planilha Manual' }, { merge: true });

        // Only save to personal user subcollection if specifically assigned
        if (c.assignedTo) {
          const userRef = doc(db, 'users', c.assignedTo, 'contacts', c.id);
          batch.set(userRef, c, { merge: true });
        }
      });

      if (batchName) {
        const batchDocId = 'b_' + Date.now();
        const batchDocRef = doc(db, 'lead_batches', batchDocId);
        batch.set(batchDocRef, {
          id: batchDocId,
          name: batchName,
          totalLeads: newContacts.length,
          distributedLeads: newContacts.filter((c) => c.assignedTo).length,
          createdAt: Date.now(),
          createdBy: currentProfile?.email || 'admin',
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
  const deleteContactFromCloud = async (contactId: string, assignedTo?: string) => {
    try {
      setSyncing(true);
      const globalRef = doc(db, 'global_contacts', contactId);
      await deleteDoc(globalRef);

      if (assignedTo) {
        const userRef = doc(db, 'users', assignedTo, 'contacts', contactId);
        await deleteDoc(userRef);
      }
      if (currentProfile?.uid) {
        const myRef = doc(db, 'users', currentProfile.uid, 'contacts', contactId);
        await deleteDoc(myRef);
      }
    } catch (e) {
      console.error('Error deleting contact from Firestore:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Helper to clear all contacts from cloud
  const clearAllContactsFromCloud = async (allContacts: Contact[]) => {
    if (allContacts.length === 0) return;
    try {
      setSyncing(true);
      const batch = writeBatch(db);
      allContacts.forEach((c) => {
        const globalRef = doc(db, 'global_contacts', c.id);
        batch.delete(globalRef);

        if (c.assignedTo) {
          const userRef = doc(db, 'users', c.assignedTo, 'contacts', c.id);
          batch.delete(userRef);
        }
        if (currentProfile?.uid) {
          const myRef = doc(db, 'users', currentProfile.uid, 'contacts', c.id);
          batch.delete(myRef);
        }
      });
      await batch.commit();
      localStorage.removeItem(STORAGE_CONTACTS);
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

  // --- ADMIN & SUPERVISOR ACTIONS (User Approval & Lead Distribution) ---
  const handleApproveUser = async (uid: string, role: 'admin' | 'supervisor' | 'attendant') => {
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

  const handleChangeUserRole = async (uid: string, role: 'admin' | 'supervisor' | 'attendant') => {
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
    if (currentProfile?.role !== 'admin') {
      addToast('Apenas o Administrador possui autorização para distribuir e liberar contatos.', 'error');
      return;
    }
    if (contactsToAssign.length === 0) return;
    try {
      setSyncing(true);
      const CHUNK_SIZE = 100;
      const updatedList: Contact[] = [];

      const targetUserProfile = allUsers.find((u) => u.uid === targetUserUid);
      const recipientName = targetUserProfile?.displayName || targetUserProfile?.username || targetUserEmail;

      for (let i = 0; i < contactsToAssign.length; i += CHUNK_SIZE) {
        const chunk = contactsToAssign.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((c) => {
          const updatedContact: Contact = {
            ...c,
            assignedTo: targetUserUid,
            assignedToEmail: targetUserEmail,
            assignedToName: recipientName,
            sentToAttendantName: recipientName,
            sentToAttendantEmail: targetUserEmail,
            sentByAdminAt: Date.now(),
            sentByAdminEmail: currentProfile?.email || 'admin@portalconcursos.com',
            transferredFromAdmin: true,
            assignedAt: Date.now(),
            isSeenByAttendant: false,
            status: c.status === 'Enviado' ? c.status : 'Novo Lead',
          };
          updatedList.push(updatedContact);

          // If previously assigned to another user, delete from old user's subcollection
          if (c.assignedTo && c.assignedTo !== targetUserUid) {
            const oldRef = doc(db, 'users', c.assignedTo, 'contacts', c.id);
            batch.delete(oldRef);
          }

          // 1. Save in target user's isolated subcollection
          const targetRef = doc(db, 'users', targetUserUid, 'contacts', c.id);
          batch.set(targetRef, updatedContact, { merge: true });

          // 2. Update global contact reference
          const globalRef = doc(db, 'global_contacts', c.id);
          batch.set(globalRef, updatedContact, { merge: true });
        });

        await batch.commit();
      }

      // Update state locally
      setGlobalContacts((prev) =>
        prev.map((c) => updatedList.find((u) => u.id === c.id) || c)
      );

      // If current user is the recipient attendant, update local contacts list
      if (currentProfile?.uid === targetUserUid) {
        setContacts((prev) => [...updatedList, ...prev.filter((p) => !updatedList.some((u) => u.id === p.id))]);
      } else if (currentProfile?.role === 'attendant') {
        // If current user was the previous owner, remove reassigned contacts from view
        setContacts((prev) => prev.filter((p) => !contactsToAssign.some((c) => c.id === p.id)));
      }

      addToast(`⚡ ${contactsToAssign.length} contatos liberados e atribuídos para ${targetUserEmail}!`, 'success');
    } catch (e: any) {
      console.error('Error distributing contacts:', e);
      addToast('Erro na distribuição: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDistributeEqually = async (
    contactsToDistribute: Contact[],
    targetUsers: UserProfile[]
  ) => {
    if (currentProfile?.role !== 'admin') {
      addToast('Apenas o Administrador possui autorização para distribuir e liberar contatos.', 'error');
      return;
    }
    if (contactsToDistribute.length === 0 || targetUsers.length === 0) return;
    try {
      setSyncing(true);
      const CHUNK_SIZE = 100;
      const updatedList: Contact[] = [];

      for (let i = 0; i < contactsToDistribute.length; i += CHUNK_SIZE) {
        const chunk = contactsToDistribute.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((contact, chunkIdx) => {
          const globalIdx = i + chunkIdx;
          const assignedUser = targetUsers[globalIdx % targetUsers.length];
          const attendantName = assignedUser.displayName || assignedUser.username || assignedUser.email;
          const updated: Contact = {
            ...contact,
            assignedTo: assignedUser.uid,
            assignedToEmail: assignedUser.email,
            assignedToName: attendantName,
            sentToAttendantName: attendantName,
            sentToAttendantEmail: assignedUser.email,
            sentByAdminAt: Date.now(),
            sentByAdminEmail: currentProfile?.email || 'admin@portalconcursos.com',
            transferredFromAdmin: true,
            assignedAt: Date.now(),
            isSeenByAttendant: false,
            status: contact.status === 'Enviado' ? contact.status : 'Novo Lead',
          };
          updatedList.push(updated);

          // If previously assigned to another user, delete from old user's subcollection
          if (contact.assignedTo && contact.assignedTo !== assignedUser.uid) {
            const oldRef = doc(db, 'users', contact.assignedTo, 'contacts', contact.id);
            batch.delete(oldRef);
          }

          // 1. Save in assigned user's isolated subcollection
          const targetRef = doc(db, 'users', assignedUser.uid, 'contacts', contact.id);
          batch.set(targetRef, updated, { merge: true });

          // 2. Update global reference
          const globalRef = doc(db, 'global_contacts', contact.id);
          batch.set(globalRef, updated, { merge: true });
        });

        await batch.commit();
      }

      // Update state locally
      setGlobalContacts((prev) =>
        prev.map((c) => updatedList.find((u) => u.id === c.id) || c)
      );

      // If current user is an attendant, reflect their own slice
      if (currentProfile?.role === 'attendant') {
        const myLeads = updatedList.filter((u) => u.assignedTo === currentProfile.uid);
        setContacts((prev) => [
          ...myLeads,
          ...prev.filter((p) => !contactsToDistribute.some((c) => c.id === p.id)),
        ]);
      }

      addToast(
        `⚡ ${contactsToDistribute.length} contatos liberados e divididos igualmente entre ${targetUsers.length} atendente(s)!`,
        'success'
      );
    } catch (e: any) {
      console.error('Error in equal distribution:', e);
      addToast('Erro na divisão: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // --- IMMEDIATE ADMIN STOCK DEDUCTION & ATTENDANT TRANSFER UPON SENDING ---
  const handleSendAndTransferContact = async (
    contactId: string,
    targetAttendantUid: string,
    messageText: string,
    channel: 'whatsapp' | 'email' = 'whatsapp'
  ) => {
    // 1. Security Check: Only admin can execute
    if (currentProfile?.role !== 'admin') {
      addToast('Apenas o Administrador possui autorização para enviar e creditar contatos para atendentes.', 'error');
      return;
    }

    // 2. Locate target contact
    const targetContact =
      contacts.find((c) => c.id === contactId) ||
      globalContacts.find((c) => c.id === contactId);

    if (!targetContact) {
      console.warn('Contato não encontrado para transferência:', contactId);
      return;
    }

    // 3. Resolve destination attendant
    const approvedAttendants = allUsers.filter(
      (u) => u.status === 'approved' && u.role === 'attendant'
    );

    if (approvedAttendants.length === 0) {
      addToast('Nenhum atendente aprovado encontrado no sistema para receber o lead.', 'error');
      return;
    }

    let recipientUser: UserProfile | undefined;
    if (targetAttendantUid === 'roleta') {
      // Find attendant with lowest count of active leads for equitable balance
      const countsMap = new Map<string, number>();
      approvedAttendants.forEach((a) => countsMap.set(a.uid, 0));
      globalContacts.forEach((c) => {
        if (c.assignedTo && countsMap.has(c.assignedTo)) {
          countsMap.set(c.assignedTo, (countsMap.get(c.assignedTo) || 0) + 1);
        }
      });

      const sorted = [...approvedAttendants].sort(
        (a, b) => (countsMap.get(a.uid) || 0) - (countsMap.get(b.uid) || 0)
      );
      recipientUser = sorted[0];
    } else {
      recipientUser = approvedAttendants.find((u) => u.uid === targetAttendantUid);
    }

    if (!recipientUser) {
      recipientUser = approvedAttendants[0];
    }

    const now = Date.now();
    const updatedContact: Contact = {
      ...targetContact,
      assignedTo: recipientUser.uid,
      assignedToEmail: recipientUser.email,
      assignedToName: recipientUser.displayName || recipientUser.email,
      assignedAt: now,
      isSeenByAttendant: false,
      transferredFromAdmin: true,
      sentByAdminAt: now,
      sentByAdminEmail: currentProfile.email || 'admin@portalconcursos.com',
      ultimoContato: todayStr(),
      status: 'Contatado',
      lastMessageAt: now,
      lastMessageText: messageText ? messageText.substring(0, 120) : undefined,
      lastMessageType: channel,
      messagesSentCount: (targetContact.messagesSentCount || 0) + 1,
    };

    try {
      setSyncing(true);
      const batch = writeBatch(db);

      // Immediate deduction: Remove from Admin's user contacts subcollection
      if (currentProfile?.uid) {
        const adminSubDoc = doc(db, 'users', currentProfile.uid, 'contacts', contactId);
        batch.delete(adminSubDoc);
      }
      const masterAdminSubDoc = doc(db, 'users', 'master_admin_root', 'contacts', contactId);
      batch.delete(masterAdminSubDoc);

      // Transfer: Credit immediately to the recipient attendant's contacts subcollection
      const attendantSubDoc = doc(db, 'users', recipientUser.uid, 'contacts', contactId);
      batch.set(attendantSubDoc, updatedContact, { merge: true });

      // Update central global contacts document
      const globalDoc = doc(db, 'global_contacts', contactId);
      batch.set(globalDoc, updatedContact, { merge: true });

      await batch.commit();

      // Immediately deduct from Admin's React state view
      setContacts((prev) => prev.filter((c) => c.id !== contactId));

      // Update globalContacts cache
      setGlobalContacts((prev) =>
        prev.map((c) => (c.id === contactId ? updatedContact : c))
      );

      // Clean from local storage of current admin session
      if (currentProfile?.uid) {
        try {
          const userKey = `contacts_v3_${currentProfile.uid}`;
          const currentSaved = localStorage.getItem(userKey);
          if (currentSaved) {
            const parsed = JSON.parse(currentSaved);
            if (Array.isArray(parsed)) {
              localStorage.setItem(
                userKey,
                JSON.stringify(parsed.filter((c: Contact) => c.id !== contactId))
              );
            }
          }
        } catch (storageErr) {
          console.warn('Storage deduction error:', storageErr);
        }
      }

      addToast(
        `⚡ Contato enviado e descontado! Transferido para o atendente ${recipientUser.displayName || recipientUser.email}.`,
        'success'
      );
    } catch (e: any) {
      console.error('Erro ao transferir contato pós-disparo:', e);
      addToast('Erro ao transferir contato: ' + e.message, 'error');
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
        setContacts([]);
        setGlobalContacts([]);
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
      setContacts([]);
      setGlobalContacts([]);

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
        status: 'approved',
        createdAt: Date.now(),
        approvedAt: Date.now(),
        approvedBy: isMaster ? 'system_master' : 'auto_liberado',
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
      setContacts([]);
      setGlobalContacts([]);

      if (isMaster) {
        addToast('Conta de Administrador Master criada com sucesso!', 'success');
      } else {
        addToast(`Bem-vindo, ${name}! Conta liberada para atendimento e importação de contatos.`, 'success');
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
    role: 'admin' | 'supervisor' | 'attendant'
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
      addToast(`Usuário ${name} (${role === 'supervisor' ? 'Supervisor' : role === 'admin' ? 'Admin' : 'Atendente'}) criado com sucesso!`, 'success');
      return true;
    } catch (e: any) {
      return 'Erro ao criar usuário: ' + e.message;
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem(STORAGE_SESSION);
      setCurrentProfile(null);
      setContacts([]);
      setGlobalContacts([]);
      setLeadBatches([]);
      setMessageModalContact(null);
      setSalesAssistantContact(null);
      setActiveView('contatos');
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

  // --- DERIVED METRICS & NEW LEADS NOTIFICATION ---
  // Set of dismissed or seen lead IDs for this user
  const [dismissedLeadIds, setDismissedLeadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`portal_dismissed_leads_${currentProfile?.uid || 'guest'}`);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
    return new Set<string>();
  });

  const prevNewLeadsCount = useRef<number>(-1);

  // Newly received leads for this attendant (not yet contacted and not dismissed)
  const newReceivedContacts = useMemo(() => {
    return contacts.filter((c) => {
      // If contact was already contacted or has a message, it's not a new lead
      if (c.ultimoContato || (c.messagesSentCount && c.messagesSentCount > 0)) return false;
      // If dismissed by attendant
      if (dismissedLeadIds.has(c.id)) return false;
      // If explicitly marked as unseen or status is 'Novo Lead'
      if (c.isSeenByAttendant === false || c.status === 'Novo Lead') return true;
      // If assigned or created in the last 48 hours without contact
      const timeRef = c.assignedAt || c.createdAt || 0;
      if (timeRef > 0 && Date.now() - timeRef < 48 * 60 * 60 * 1000) return true;
      return false;
    });
  }, [contacts, dismissedLeadIds]);

  // Audio alert and notification when new leads arrive
  useEffect(() => {
    if (prevNewLeadsCount.current >= 0 && newReceivedContacts.length > prevNewLeadsCount.current) {
      const diff = newReceivedContacts.length - prevNewLeadsCount.current;
      playNewLeadChime();
      addToast(`🔔 Você recebeu +${diff} novo(s) lead(s) para atendimento!`, 'info');
    }
    prevNewLeadsCount.current = newReceivedContacts.length;
  }, [newReceivedContacts.length]);

  const handleDismissAllNewLeads = () => {
    const newSet = new Set(dismissedLeadIds);
    newReceivedContacts.forEach((c) => newSet.add(c.id));
    setDismissedLeadIds(newSet);
    try {
      localStorage.setItem(
        `portal_dismissed_leads_${currentProfile?.uid || 'guest'}`,
        JSON.stringify(Array.from(newSet))
      );
    } catch (e) {
      console.warn(e);
    }
    addToast('Novos leads marcados como vistos!', 'info');
  };

  const handleStartImmediateQueue = () => {
    setTabFilter('novos');
    setSortBy('recentes');
    addToast('🎯 Fila de novos leads ativada! Inicie o primeiro contato rápido.', 'success');
  };

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
      tabFilter === 'novos'
        ? newReceivedContacts
        : tabFilter === 'pendente'
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

      const dup = globalContacts.some(
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
        status: 'Aguardando Envio',
        observacao: r.observacao || '',
        createdAt: Date.now(),
        // Spreadsheet contacts route directly to the Admin Panel stock (unassigned)
        assignedTo: undefined,
        assignedToEmail: undefined,
        assignedToName: undefined,
        batchName: batchName || 'Planilha Importada',
      });
      added++;
    });

    if (added > 0) {
      // Direct to Admin pool so AdminPanel reflects the new leads instantly
      setGlobalContacts((prev) => [...prev, ...newItems]);
      saveBatchContactsToCloud(newItems, batchName);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 } });

      if (currentProfile?.role === 'admin') {
        setActiveView('admin');
        addToast(
          `📥 ${added} contato(s) da planilha importados para o Painel Admin! Acesse o Painel Admin para enviar e dividir entre os atendentes.`,
          'success'
        );
      } else {
        addToast(
          `📥 ${added} contato(s) importados e direcionados para o Painel Admin! O Administrador fará o envio para os atendentes.`,
          'info'
        );
      }
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
        // Saves to central global pool for the Admin Panel
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
        const availableAttendants = allUsers.filter(
          (u) =>
            u.status === 'approved' &&
            (u.role === 'attendant' || u.role === 'supervisor')
        );
        // Fallback to all approved users if no specific attendants are tagged
        const eligibleUsers = availableAttendants.length > 0
          ? availableAttendants
          : allUsers.filter((u) => u.status === 'approved');

        const targetAttendants = eligibleUsers.filter(
          (u) =>
            !selectedAttendantUids ||
            selectedAttendantUids.length === 0 ||
            selectedAttendantUids.includes(u.uid)
        );

        if (targetAttendants.length > 0) {
          const myAssigned: Contact[] = [];
          newItems.forEach((c, idx) => {
            const assignedUser = targetAttendants[idx % targetAttendants.length];
            const updated: Contact = {
              ...c,
              assignedTo: assignedUser.uid,
              assignedToEmail: assignedUser.email,
              assignedAt: Date.now(),
              isSeenByAttendant: false,
              status: 'Novo Lead',
            };
            const userRef = doc(db, 'users', assignedUser.uid, 'contacts', c.id);
            batch.set(userRef, updated, { merge: true });
            const globalRef = doc(db, 'global_contacts', c.id);
            batch.set(globalRef, updated, { merge: true });

            if (currentProfile && assignedUser.uid === currentProfile.uid) {
              myAssigned.push(updated);
            }
          });

          if (myAssigned.length > 0) {
            setContacts((prev) => [...myAssigned, ...prev]);
          }
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
    const rawZap = partial.whatsapp ? cleanPhone(partial.whatsapp) : '';
    const newContact: Contact = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      nome: partial.nome?.trim() || 'Novo Aluno',
      whatsapp: rawZap || (partial.whatsapp?.trim() || ''),
      email: partial.email?.trim().toLowerCase() || '',
      curso: partial.curso?.trim() || '',
      temperatura: partial.temperatura || 'Frio',
      dataContato: partial.dataContato || todayStr(),
      ultimoContato: partial.ultimoContato || '',
      proximoContato: partial.proximoContato || '',
      status: partial.status || 'Novo Lead',
      observacao: partial.observacao?.trim() || '',
      createdAt: Date.now(),
      assignedTo: currentProfile?.uid,
      assignedToEmail: currentProfile?.email || undefined,
    };

    setContacts((prev) => [newContact, ...prev]);
    saveContactToCloud(newContact);
    addToast(`Contato "${newContact.nome}" cadastrado com sucesso!`, 'success');
  };

  const handleMarkToday = (id: string) => {
    const today = todayStr();
    const now = Date.now();
    const target = contacts.find((c) => c.id === id) || globalContacts.find((c) => c.id === id);
    const targetName = target?.nome || 'Contato';
    setRecentlyContactedNotice({ contactName: targetName, contactId: id });

    if (target) {
      const updated: Contact = {
        ...target,
        ultimoContato: today,
        dataContato: target.dataContato || today,
        status: target.status === 'Novo Lead' || target.status === 'Pendente' || !target.status ? 'Contatado' : target.status,
        lastMessageAt: now,
        messagesSentCount: (target.messagesSentCount || 0) + 1,
        isSeenByAttendant: true,
      };
      saveContactToCloud(updated);
    }
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          ultimoContato: today,
          dataContato: c.dataContato || today,
          status: c.status === 'Novo Lead' || c.status === 'Pendente' || !c.status ? 'Contatado' : c.status,
          lastMessageAt: now,
          messagesSentCount: (c.messagesSentCount || 0) + 1,
          isSeenByAttendant: true,
        };
      })
    );
    setGlobalContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          ultimoContato: today,
          dataContato: c.dataContato || today,
          status: c.status === 'Novo Lead' || c.status === 'Pendente' || !c.status ? 'Contatado' : c.status,
          lastMessageAt: now,
          messagesSentCount: (c.messagesSentCount || 0) + 1,
          isSeenByAttendant: true,
        };
      })
    );
    setMessageModalContact((prev) => {
      if (prev && prev.id === id) {
        return {
          ...prev,
          ultimoContato: today,
          dataContato: prev.dataContato || today,
          status: prev.status === 'Novo Lead' || prev.status === 'Pendente' || !prev.status ? 'Contatado' : prev.status,
          lastMessageAt: now,
          messagesSentCount: (prev.messagesSentCount || 0) + 1,
          isSeenByAttendant: true,
        };
      }
      return prev;
    });
    setSalesAssistantContact((prev) => {
      if (prev && prev.id === id) {
        return {
          ...prev,
          ultimoContato: today,
          dataContato: prev.dataContato || today,
          status: prev.status === 'Novo Lead' || prev.status === 'Pendente' || !prev.status ? 'Contatado' : prev.status,
          lastMessageAt: now,
          messagesSentCount: (prev.messagesSentCount || 0) + 1,
          isSeenByAttendant: true,
        };
      }
      return prev;
    });
    addToast(`✓ ${targetName} marcado como Contatado Hoje! (Salvo na aba Contatados)`, 'success');
  };

  const handleMarkEmailContacted = (id: string, emailSubject?: string) => {
    const target = contacts.find((c) => c.id === id) || globalContacts.find((c) => c.id === id);
    const now = Date.now();
    const today = todayStr();
    if (target) {
      const updated: Contact = {
        ...target,
        ultimoContato: today,
        dataContato: target.dataContato || today,
        lastEmailSentAt: now,
        lastEmailSubject: emailSubject || target.lastEmailSubject,
        emailSentCount: (target.emailSentCount || 0) + 1,
        lastMessageType: 'email',
        lastMessageAt: now,
        lastMessageText: emailSubject ? `E-mail: ${emailSubject.slice(0, 50)}` : 'E-mail enviado via SendGrid',
        status: target.status && !target.status.includes('E-mail') ? `${target.status} (E-mail)` : (target.status || 'Contatado via E-mail'),
        isSeenByAttendant: true,
      };
      saveContactToCloud(updated);
    }
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          ultimoContato: today,
          dataContato: c.dataContato || today,
          lastEmailSentAt: now,
          lastEmailSubject: emailSubject || c.lastEmailSubject,
          emailSentCount: (c.emailSentCount || 0) + 1,
          lastMessageType: 'email',
          lastMessageAt: now,
          lastMessageText: emailSubject ? `E-mail: ${emailSubject.slice(0, 50)}` : 'E-mail enviado via SendGrid',
          status: c.status && !c.status.includes('E-mail') ? `${c.status} (E-mail)` : (c.status || 'Contatado via E-mail'),
          isSeenByAttendant: true,
        };
      })
    );
    setGlobalContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          ultimoContato: today,
          dataContato: c.dataContato || today,
          lastEmailSentAt: now,
          lastEmailSubject: emailSubject || c.lastEmailSubject,
          emailSentCount: (c.emailSentCount || 0) + 1,
          lastMessageType: 'email',
          lastMessageAt: now,
          lastMessageText: emailSubject ? `E-mail: ${emailSubject.slice(0, 50)}` : 'E-mail enviado via SendGrid',
          status: c.status && !c.status.includes('E-mail') ? `${c.status} (E-mail)` : (c.status || 'Contatado via E-mail'),
          isSeenByAttendant: true,
        };
      })
    );
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
    const target = contacts.find((c) => c.id === id) || globalContacts.find((c) => c.id === id);
    if (target) {
      const updated: Contact = { ...target, ultimoContato: '' };
      saveContactToCloud(updated);
    }
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ultimoContato: '' } : c))
    );
    setGlobalContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ultimoContato: '' } : c))
    );
    setMessageModalContact((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, ultimoContato: '' };
      }
      return prev;
    });
    setSalesAssistantContact((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, ultimoContato: '' };
      }
      return prev;
    });
    addToast('Marcação de contato desfeita.', 'info');
  };

  const handleUpdateField = (id: string, field: keyof Contact, value: string) => {
    const target = contacts.find((c) => c.id === id) || globalContacts.find((c) => c.id === id);
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
    setGlobalContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return { ...c, [field]: value };
      })
    );
    setMessageModalContact((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, [field]: value };
      }
      return prev;
    });
    setSalesAssistantContact((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, [field]: value };
      }
      return prev;
    });
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
    <div className="min-h-screen bg-[#0B132B] text-[#FFFFFF] font-sans antialiased p-3 sm:p-6 lg:p-8 flex flex-col relative overflow-x-hidden">
      {/* Semi-transparent Portal Concursos e OAB background watermark (Foto 1) */}
      <PortalWatermarkBackground />

      <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col relative z-10">
        {!currentProfile ? (
          <AuthGateway
            onLogin={handleDirectLogin}
            onRegister={handleDirectRegister}
            loading={authLoading}
          />
        ) : (
          <>
            {/* Top Header with Navigation Tabs */}
            <Header
              activeView={activeView}
              onSelectView={setActiveView}
              onOpenDailyExport={() => setShowDailyExport(true)}
              onOpenAIAssistant={() => setShowAIChatAssistant(true)}
              onOpenQuickPaste={() => setShowQuickPasteModal(true)}
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

            {/* Blocked state */}
            {currentProfile.status === 'blocked' && (
              <div className="bg-[#111D3E] border border-[#B14432] rounded-2xl p-8 text-center max-w-xl mx-auto my-8 shadow-2xl animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-[#B14432]/20 border border-[#B14432] flex items-center justify-center text-[#B14432] mx-auto mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#FFFFFF] mb-2">Acesso Desativado</h3>
                <p className="text-sm text-[#94A3B8] mb-6">
                  Seu usuário foi temporariamente bloqueado pela administração. Entre em contato com a gerência para regularizar seu acesso.
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="bg-[#0B132B] border border-[#263B6E] text-[#FFFFFF] px-6 py-2.5 rounded-lg text-sm font-semibold hover:border-[#2563EB] transition-all cursor-pointer"
                >
                  Sair do Sistema
                </button>
              </div>
            )}

            {/* Pending approval state */}
            {currentProfile.status === 'pending' && (
              <div className="bg-[#111D3E] border border-[#2563EB] rounded-2xl p-8 text-center max-w-xl mx-auto my-8 shadow-2xl animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 border border-[#2563EB] flex items-center justify-center text-[#2563EB] mx-auto mb-4 animate-pulse">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#FFFFFF] mb-2">Aguardando Liberação do Administrador</h3>
                <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">
                  Olá, <strong className="text-[#FFFFFF]">{currentProfile.displayName || currentProfile.email}</strong>! Seu cadastro foi realizado com sucesso. Assim que o Administrador liberar seu acesso no painel, sua carteira individual de leads será sincronizada automaticamente.
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="bg-[#0B132B] border border-[#263B6E] text-[#FFFFFF] px-6 py-2.5 rounded-lg text-sm font-semibold hover:border-[#B14432] transition-all cursor-pointer"
                >
                  Trocar de Conta / Sair
                </button>
              </div>
            )}

            {/* Active approved views */}
            {currentProfile.status === 'approved' && (
              <>
                {/* Global AI Chat Assistant Modal */}
                <AIChatAssistant
                  isOpen={showAIChatAssistant}
                  onClose={() => setShowAIChatAssistant(false)}
                  contacts={contacts}
                  objections={objections}
                  plans={plans}
                />

        {/* VIEW 0: ADMIN & SUPERVISION PANEL (For Admin and Supervisors) */}
        {activeView === 'admin' && (currentProfile?.role === 'admin' || currentProfile?.role === 'supervisor') && (
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
            {/* New Leads Notification Alert Banner for Attendant */}
            <NewLeadsAlertBanner
              newLeads={newReceivedContacts}
              onStartImmediateQueue={handleStartImmediateQueue}
              onDismissAll={handleDismissAllNewLeads}
            />

            {/* Dropzone & Import Bar */}
            <Dropzone
              onImportRows={handleImportRows}
              onClearAll={handleClearAll}
              hasContacts={contacts.length > 0}
              isAdmin={currentProfile?.role === 'admin'}
              onOpenSmartImport={() => setShowAppSmartImport(true)}
              onOpenAddManual={() => setShowAddForm(true)}
              onOpenQuickPaste={() => setShowQuickPasteModal(true)}
            />

            {/* Quick Action & Search Controls */}
            <div className="bg-[#111D3E] border border-[#263B6E] rounded-xl p-3 sm:p-4 shadow-md space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                  <input
                    type="text"
                    id="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, WhatsApp, e-mail, curso ou notas..."
                    className="w-full bg-[#0B132B] border border-[#263B6E] rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-[#FFFFFF] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition-colors"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 text-xs text-[#94A3B8] hover:text-[#FFFFFF]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Status Tabs: Novos Recebidos, Pendentes, Contatados, Todos */}
                <div className="flex items-center rounded-lg bg-[#0B132B] p-1 border border-[#263B6E] self-start md:self-auto shrink-0 flex-wrap gap-1">
                  {newReceivedContacts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTabFilter('novos')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                        tabFilter === 'novos'
                          ? 'bg-emerald-500 text-[#0B132B] shadow-sm font-black'
                          : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Novos Leads</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          tabFilter === 'novos'
                            ? 'bg-[#0B132B]/30 text-[#0B132B]'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {newReceivedContacts.length}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setTabFilter('pendente')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                      tabFilter === 'pendente'
                        ? 'bg-[#2563EB] text-[#0B132B] shadow-sm font-bold'
                        : 'text-[#94A3B8] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <span>Pendentes</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        tabFilter === 'pendente'
                          ? 'bg-[#0B132B]/30 text-[#0B132B]'
                          : 'bg-[#111D3E] text-[#94A3B8]'
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
                        ? 'bg-[#2563EB] text-[#0B132B] shadow-sm font-bold'
                        : 'text-[#94A3B8] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <span>Contatados</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        tabFilter === 'enviado'
                          ? 'bg-[#0B132B]/30 text-[#0B132B]'
                          : 'bg-[#111D3E] text-[#94A3B8]'
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
                        ? 'bg-[#2563EB] text-[#0B132B] shadow-sm font-bold'
                        : 'text-[#94A3B8] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <span>Todos</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        tabFilter === 'todos'
                          ? 'bg-[#0B132B]/30 text-[#0B132B]'
                          : 'bg-[#111D3E] text-[#94A3B8]'
                      }`}
                    >
                      {contacts.length}
                    </span>
                  </button>
                </div>

                {/* Action Buttons: Colar Rápido, Marcar Todos Disparados, Novo Contato */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {(currentProfile?.role === 'admin' || currentProfile?.role === 'supervisor') && (
                    <button
                      type="button"
                      id="roleta-quick-access-btn"
                      onClick={() => setActiveView('admin')}
                      className="flex items-center justify-center gap-1.5 bg-[#2563EB]/20 hover:bg-[#2563EB]/30 text-[#FCD34D] border border-[#2563EB]/50 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
                      title="Abrir Central de Divisão & Roleta de Leads para liberar contatos de forma igualitária"
                    >
                      <Zap className="w-4 h-4 text-[#2563EB]" />
                      <span>⚡ Liberar Contatos (Roleta)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="quick-paste-action-btn"
                    onClick={() => setShowQuickPasteModal(true)}
                    className="flex items-center justify-center gap-1.5 bg-[#22C55E]/15 hover:bg-[#22C55E]/30 text-[#4ADE80] border border-[#22C55E]/40 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
                    title="Colar contatos do WhatsApp, Excel ou texto diretamente (Ctrl+V)"
                  >
                    <Clipboard className="w-4 h-4 text-[#4ADE80]" />
                    <span>📋 Colar Contatos (Ctrl+V)</span>
                  </button>

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
                      <span>Marcar Todos ({filteredContacts.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="add-contact-btn"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center justify-center gap-1.5 bg-[#1C2C55] hover:bg-[#263B6E] text-[#FFFFFF] hover:text-[#2563EB] border border-[#263B6E] font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-4 h-4 text-[#2563EB]" />
                    <span>+ Novo Manual</span>
                  </button>
                </div>
              </div>

              {/* Filters Row: Curso, Temperatura, Ordenação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#263B6E]/50 text-xs">
                {/* Filter Curso */}
                <div className="flex items-center gap-2">
                  <span className="text-[#94A3B8] text-[11px] uppercase font-semibold tracking-wider shrink-0 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-[#2563EB]" />
                    Curso:
                  </span>
                  <select
                    id="filter-curso"
                    value={filterCurso}
                    onChange={(e) => setFilterCurso(e.target.value)}
                    className="w-full bg-[#0B132B] border border-[#263B6E] text-[#FFFFFF] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#2563EB]"
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
                  <span className="text-[#94A3B8] text-[11px] uppercase font-semibold tracking-wider shrink-0">
                    Termômetro:
                  </span>
                  <select
                    id="filter-temp"
                    value={filterTemp}
                    onChange={(e) => setFilterTemp(e.target.value)}
                    className="w-full bg-[#0B132B] border border-[#263B6E] text-[#FFFFFF] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#2563EB]"
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
                  <span className="text-[#94A3B8] text-[11px] uppercase font-semibold tracking-wider shrink-0 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-[#2563EB]" />
                    Ordem:
                  </span>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-[#0B132B] border border-[#263B6E] text-[#FFFFFF] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#2563EB]"
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
                isOpen={showAddForm}
                onAddContact={handleAddManualContact}
                onAddMultipleContacts={(newContacts) => handleImportRows(newContacts, 'Cadastro Manual em Lote')}
                onClose={() => setShowAddForm(false)}
                availableCourses={uniqueCourses}
              />
            )}

            {/* Modal: Quick Paste Contacts (Instant batch paste & save) */}
            {showQuickPasteModal && (
              <QuickPasteModal
                isOpen={showQuickPasteModal}
                onClose={() => setShowQuickPasteModal(false)}
                onImportContacts={(newContacts, batch) =>
                  handleImportRows(newContacts, batch || 'Colar Rápido')
                }
                availableCourses={uniqueCourses}
              />
            )}

            {/* Live Feedback Alert when a contact is contacted */}
            {recentlyContactedNotice && (
              <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-md animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/40">
                    ✓
                  </div>
                  <div className="text-xs text-[#FFFFFF] truncate">
                    <strong className="text-emerald-300">{recentlyContactedNotice.contactName}</strong> foi registrado com sucesso como <b>Contatado Hoje</b>!
                    {tabFilter === 'pendente' && (
                      <span className="text-emerald-400/90 ml-1.5 hidden sm:inline">
                        (O lead foi arquivado da lista de pendentes e transferido para a aba "Contatados")
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tabFilter !== 'enviado' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTabFilter('enviado');
                        setRecentlyContactedNotice(null);
                      }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-[#0B132B] text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      Ver na aba Contatados
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRecentlyContactedNotice(null)}
                    className="text-[#94A3B8] hover:text-[#FFFFFF] text-xs px-1.5 py-1 rounded hover:bg-[#111D3E] cursor-pointer"
                    title="Fechar aviso"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Contacts Cards Stream */}
            <div className="space-y-3">
              {filteredContacts.length === 0 ? (
                <div className="bg-[#111D3E] border border-[#263B6E] rounded-2xl p-12 text-center">
                  <Users className="w-12 h-12 text-[#94A3B8] mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold text-[#FFFFFF]">Nenhum contato encontrado</h3>
                  <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
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
                      className="mt-4 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
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
                        <div className="pt-3 pb-1 flex items-center justify-between border-b border-[#263B6E] mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                            <h3 className="text-sm sm:text-base font-bold font-serif text-[#FFFFFF] tracking-wide">
                              {c.curso || 'Sem Curso Informado'}
                            </h3>
                            <span className="text-[11px] font-sans text-[#94A3B8] bg-[#111D3E] px-2 py-0.5 rounded-full border border-[#263B6E]">
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
                              className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#4ADE80] flex items-center gap-1 bg-[#0B132B] border border-[#263B6E] hover:border-[#6E8F5C]/50 px-2 py-1 rounded cursor-pointer transition-colors"
                              title="Marcar todos os alunos deste curso como contatados após disparo"
                            >
                              <CheckCircle2 className="w-3 h-3 text-[#4ADE80]" />
                              <span>Marcar este curso como contatado</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setMessageModalContact(c)}
                              className="text-[11px] font-semibold text-[#6E8F5C] hover:text-[#4ADE80] flex items-center gap-1 bg-[#0B132B] border border-[#6E8F5C]/40 px-2.5 py-1 rounded cursor-pointer transition-colors"
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
                        isNewLead={newReceivedContacts.some((nc) => nc.id === c.id)}
                        onMarkToday={handleMarkToday}
                        onUndoContact={handleUndoContact}
                        onUpdateField={handleUpdateField}
                        onDeleteContact={handleDeleteContact}
                        onOpenMessageModal={(contact) => setMessageModalContact(contact)}
                        onOpenSalesAssistant={(contact) => setSalesAssistantContact(contact)}
                        isAdmin={currentProfile?.role === 'admin'}
                        attendants={attendants}
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
            onMarkEmailContacted={handleMarkEmailContacted}
            onToast={addToast}
            isAdmin={currentProfile?.role === 'admin'}
            attendants={attendants}
            onSendAndTransferContact={handleSendAndTransferContact}
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
              </>
            )}
          </>
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
        onAddTemplate={handleAddTemplate}
        onToast={addToast}
        isAdmin={currentProfile?.role === 'admin'}
        attendants={attendants}
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
        onAddTemplate={handleAddTemplate}
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

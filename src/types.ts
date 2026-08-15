export type Temperature = 'Frio' | 'Morno' | 'Potencial' | 'Quente' | 'Pagou';

export type UserRole = 'admin' | 'attendant';
export type UserStatus = 'approved' | 'pending' | 'blocked';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  password?: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  approvedAt?: number;
  approvedBy?: string;
  assignedCount?: number;
}

export interface LeadBatch {
  id: string;
  name: string;
  totalLeads: number;
  distributedLeads: number;
  createdAt: number;
  createdBy: string;
  tags?: string[];
}

export interface Contact {
  id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  curso: string;
  temperatura: Temperature;
  dataContato: string; // ISO date YYYY-MM-DD
  ultimoContato: string; // ISO date YYYY-MM-DD
  proximoContato: string; // ISO date YYYY-MM-DD
  status: string;
  observacao: string;
  createdAt?: number;
  assignedTo?: string; // UID do atendente
  assignedToEmail?: string;
  assignedToName?: string;
  batchId?: string; // ID da planilha de importação
  batchName?: string;
  lastMessageAt?: number; // Timestamp da última mensagem enviada pelo vendedor
  lastMessageText?: string; // Resumo ou texto da última mensagem enviada
  lastMessageType?: 'whatsapp' | 'template' | 'assistente' | 'manual';
  messagesSentCount?: number; // Contador de mensagens enviadas
  lastInteractedBy?: string; // Nome/Email do atendente que interagiu por último
}

export interface Objection {
  id: string;
  objecao: string;
  resposta: string;
  categoria?: string;
}

export interface Plan {
  id: string;
  nome: string;
  preco: string;
  beneficios: string[];
  destaque?: boolean;
}

export type TabFilter = 'pendente' | 'enviado' | 'todos';
export type ViewTab = 'contatos' | 'disparos' | 'dashboard' | 'mensagens' | 'objecoes' | 'planos' | 'admin';

export interface BroadcastLog {
  id: string;
  contactName: string;
  whatsapp?: string;
  email?: string;
  channel: 'whatsapp' | 'email' | 'both';
  timestamp: number;
  messagePreview: string;
  hasImage?: boolean;
  status: 'sent' | 'prepared';
}

export type MessageTemplateCategory = 
  | 'pos_prova' 
  | 'pre_prova' 
  | 'migracao' 
  | 'fechamento_pix' 
  | 'recuperacao_sumidos' 
  | 'renovacao' 
  | 'boas_vindas' 
  | 'geral';

export interface MessageTemplate {
  id: string;
  titulo: string;
  categoria: MessageTemplateCategory;
  texto: string;
  descricao?: string;
  gatilho?: string;
  emocao?: string;
  logica?: string;
  tags?: string[];
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
}

import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Copy,
  Check,
  Edit2,
  Sparkles,
  Save,
  RotateCcw,
  Clock,
  ArrowRightLeft,
  RefreshCw,
  Search,
  Mic,
  Volume2,
  Timer,
  Headphones,
} from 'lucide-react';
import { MessageTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../data/defaults';
import { fillTemplate } from '../utils/excel';

interface MessagesViewProps {
  templates: MessageTemplate[];
  onUpdateTemplate: (template: MessageTemplate) => void;
  onAddTemplate: (newTmpl: MessageTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onResetTemplates: () => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  templates,
  onUpdateTemplate,
  onAddTemplate,
  onDeleteTemplate,
  onResetTemplates,
  onToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<MessageTemplate['categoria']>('pos_prova');
  const [editGatilho, setEditGatilho] = useState<string>('');
  const [editEmocao, setEditEmocao] = useState<string>('');
  const [editLogica, setEditLogica] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [editText, setEditText] = useState<string>('');
  const [editDuracao, setEditDuracao] = useState<string>('');
  const [editTomDeVoz, setEditTomDeVoz] = useState<string>('');

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<MessageTemplate['categoria']>('roteiro_audio');
  const [newGatilho, setNewGatilho] = useState<string>('');
  const [newEmocao, setNewEmocao] = useState<string>('');
  const [newLogica, setNewLogica] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newText, setNewText] = useState<string>('');
  const [newDuracao, setNewDuracao] = useState<string>('25 a 30 segundos');
  const [newTomDeVoz, setNewTomDeVoz] = useState<string>('Acolhedor, seguro e dinâmico');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mock contact for simulation
  const previewContact = {
    nome: 'Carlos Eduardo',
    curso: 'Polícia Federal - Agente',
    whatsapp: '11999998888',
  };

  const handleStartEdit = (tmpl: MessageTemplate) => {
    setEditingId(tmpl.id);
    setEditTitle(tmpl.titulo);
    setEditCategory(tmpl.categoria);
    setEditGatilho(tmpl.gatilho || '');
    setEditEmocao(tmpl.emocao || '');
    setEditLogica(tmpl.logica || '');
    setEditDesc(tmpl.descricao || '');
    setEditText(tmpl.texto);
    setEditDuracao(tmpl.duracaoEstimada || '');
    setEditTomDeVoz(tmpl.tomDeVoz || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editText.trim()) {
      onToast('Título e Texto da mensagem são obrigatórios.', 'error');
      return;
    }

    const currentTmpl = templates.find((t) => t.id === id);

    onUpdateTemplate({
      id,
      titulo: editTitle.trim(),
      categoria: editCategory,
      gatilho: editGatilho.trim() || undefined,
      emocao: editEmocao.trim() || undefined,
      logica: editLogica.trim() || undefined,
      descricao: editDesc.trim() || undefined,
      texto: editText.trim(),
      tipo: editCategory === 'roteiro_audio' ? 'audio' : currentTmpl?.tipo || 'texto',
      duracaoEstimada: editDuracao.trim() || undefined,
      tomDeVoz: editTomDeVoz.trim() || undefined,
      dicasGravacao: currentTmpl?.dicasGravacao,
      tags: currentTmpl?.tags,
    });

    setEditingId(null);
    onToast('Modelo atualizado com sucesso!', 'success');
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newText.trim()) {
      onToast('Título e Texto da mensagem são obrigatórios.', 'error');
      return;
    }

    const newId = 't_custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    onAddTemplate({
      id: newId,
      titulo: newTitle.trim(),
      categoria: newCategory,
      gatilho: newGatilho.trim() || undefined,
      emocao: newEmocao.trim() || undefined,
      logica: newLogica.trim() || undefined,
      descricao: newDesc.trim() || undefined,
      texto: newText.trim(),
      tipo: newCategory === 'roteiro_audio' ? 'audio' : 'texto',
      duracaoEstimada: newCategory === 'roteiro_audio' ? newDuracao.trim() : undefined,
      tomDeVoz: newCategory === 'roteiro_audio' ? newTomDeVoz.trim() : undefined,
    });

    setNewTitle('');
    setNewCategory('roteiro_audio');
    setNewGatilho('');
    setNewEmocao('');
    setNewLogica('');
    setNewDesc('');
    setNewText('');
    setNewDuracao('25 a 30 segundos');
    setNewTomDeVoz('Acolhedor, seguro e dinâmico');
    setShowAddForm(false);
    onToast('Novo modelo criado com sucesso!', 'success');
  };

  const handleCopyPreview = (tmpl: MessageTemplate) => {
    const filled = fillTemplate(tmpl.texto, previewContact);
    navigator.clipboard.writeText(filled);
    setCopiedId(tmpl.id);
    onToast(`Roteiro "${tmpl.titulo}" copiado (com dados de exemplo)!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = templates.filter((t) => {
    const matchesCategory = activeCategory === 'todos' || t.categoria === activeCategory;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      t.titulo.toLowerCase().includes(q) ||
      t.texto.toLowerCase().includes(q) ||
      (t.descricao && t.descricao.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'roteiro_audio':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#38BDF8] border border-[#38BDF8]/50 text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">
            <Mic className="w-3 h-3 text-[#38BDF8]" />
            🎙️ Roteiro de Áudio (20-35s)
          </span>
        );
      case 'pos_prova':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#C9A227] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Check className="w-3 h-3 text-[#C9A227]" />
            Pós-Prova
          </span>
        );
      case 'pre_prova':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#5C7A9E] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Clock className="w-3 h-3 text-[#5C7A9E]" />
            Pré-Prova / Rotina
          </span>
        );
      case 'migracao':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#D97C3A] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <ArrowRightLeft className="w-3 h-3 text-[#D97C3A]" />
            Migração p/ Assinatura 1.0
          </span>
        );
      case 'fechamento_pix':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#16A34A] border border-[#16A34A]/40 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3 text-[#16A34A]" />
            Fechamento & PIX
          </span>
        );
      case 'recuperacao_sumidos':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#E11D48] border border-[#E11D48]/40 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <RotateCcw className="w-3 h-3 text-[#E11D48]" />
            Resgate / Sumidos
          </span>
        );
      case 'renovacao':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#6E8F5C] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <RefreshCw className="w-3 h-3 text-[#6E8F5C]" />
            Renovação
          </span>
        );
      case 'boas_vindas':
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#38BDF8] border border-[#38BDF8]/40 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3 text-[#38BDF8]" />
            Boas-Vindas & Diagnóstico
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#8C98B4] border border-[#2B3D63] text-[10px] uppercase font-bold px-2 py-0.5 rounded">
            Geral
          </span>
        );
    }
  };

  return (
    <div className="animate-fadeIn space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#C9A227] mb-1 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Comunicação & Abordagens
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#EDE6D6]">
            Mensagens Prontas & Roteiros de Áudio
          </h2>
          <p className="text-xs sm:text-sm text-[#8C98B4] mt-0.5">
            Scripts de alta conversão para gravação de áudios de 20-35 segundos e mensagens de texto focadas em migração do Curso Isolado para a Assinatura 1.0.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Deseja restaurar as mensagens e roteiros de áudio para os modelos padrão de fábrica?'
                )
              ) {
                onResetTemplates();
              }
            }}
            className="flex items-center gap-1.5 bg-[#172644] hover:bg-[#1F3057] text-[#8C98B4] hover:text-[#EDE6D6] border border-[#2B3D63] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Restaurar modelos de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrões
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Novo Script / Roteiro
          </button>
        </div>
      </div>

      {/* Audio Scripts Highlight Promo Banner */}
      <div className="bg-gradient-to-r from-[#172644] via-[#1A2E56] to-[#172644] border border-[#38BDF8]/40 rounded-xl p-3.5 sm:p-4 text-xs text-[#EDE6D6] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/20 border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5 text-[#38BDF8] animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-sm text-[#EDE6D6] flex items-center gap-1.5">
              <span>🎙️ Roteiros de Áudio para Gravar no WhatsApp (20 a 35s)</span>
              <span className="bg-[#38BDF8] text-[#101B2D] text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                3x Mais Conversão
              </span>
            </div>
            <p className="text-xs text-[#8C98B4] mt-0.5">
              Áudios gravados com fala natural e conexão amiga quebram objeções e fecham matrículas muito mais rápido que textos longos.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveCategory('roteiro_audio')}
          className="bg-[#38BDF8] hover:bg-[#2fb0ea] text-[#101B2D] text-xs font-bold px-3.5 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Headphones className="w-3.5 h-3.5" />
          Ver Só Roteiros de Áudio
        </button>
      </div>

      {/* Dynamic Tags Legend Box */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-3 text-xs text-[#8C98B4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-[#EDE6D6] font-semibold">
          <Sparkles className="w-4 h-4 text-[#C9A227]" />
          <span>Variáveis automáticas aceitas nos roteiros:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <code className="bg-[#101B2D] border border-[#2B3D63] text-[#C9A227] px-2 py-0.5 rounded text-[11px] font-mono">
            {'{nome}'} (1º Nome)
          </code>
          <code className="bg-[#101B2D] border border-[#2B3D63] text-[#C9A227] px-2 py-0.5 rounded text-[11px] font-mono">
            {'{nome_completo}'}
          </code>
          <code className="bg-[#101B2D] border border-[#2B3D63] text-[#C9A227] px-2 py-0.5 rounded text-[11px] font-mono">
            {'{curso}'} (Concurso)
          </code>
          <code className="bg-[#101B2D] border border-[#2B3D63] text-[#C9A227] px-2 py-0.5 rounded text-[11px] font-mono">
            {'{whatsapp}'}
          </code>
        </div>
      </div>

      {/* Add new template form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateNew}
          className="bg-[#172644] border border-[#C9A227] rounded-xl p-4 sm:p-5 space-y-4 shadow-md"
        >
          <div className="flex items-center justify-between border-b border-[#2B3D63] pb-2">
            <h3 className="font-bold text-sm text-[#C9A227] flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Criar Novo Roteiro ou Modelo de Mensagem
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-[#8C98B4] hover:text-[#EDE6D6] cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                Título do Script *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: 🎙️ Áudio: Fechamento com Condição Autorizada"
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                Categoria *
              </label>
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as MessageTemplate['categoria'])
                }
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227] cursor-pointer"
              >
                <option value="roteiro_audio">🎙️ Roteiro para Áudio (Voice Script)</option>
                <option value="pos_prova">Pós-Prova</option>
                <option value="migracao">Migração de Edital (Assinatura 1.0)</option>
                <option value="fechamento_pix">Fechamento & PIX</option>
                <option value="pre_prova">Pré-Prova / Rotina</option>
                <option value="recuperacao_sumidos">Resgate / Sumidos</option>
                <option value="boas_vindas">Boas-Vindas</option>
                <option value="renovacao">Renovação</option>
                <option value="geral">Geral</option>
              </select>
            </div>
          </div>

          {newCategory === 'roteiro_audio' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#101B2D] p-3 rounded-lg border border-[#38BDF8]/30">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8] mb-1 flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Duração Estimada do Áudio
                </label>
                <input
                  type="text"
                  value={newDuracao}
                  onChange={(e) => setNewDuracao(e.target.value)}
                  placeholder="Ex: 25 a 30 segundos"
                  className="w-full bg-[#172644] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8] mb-1 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                  Tom de Voz Sugerido
                </label>
                <input
                  type="text"
                  value={newTomDeVoz}
                  onChange={(e) => setNewTomDeVoz(e.target.value)}
                  placeholder="Ex: Acolhedor, seguro e com energia positiva"
                  className="w-full bg-[#172644] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#C9A227] mb-1">
                ⚡ Gatilho Mental
              </label>
              <input
                type="text"
                value={newGatilho}
                onChange={(e) => setNewGatilho(e.target.value)}
                placeholder="Ex: 💡 Abatimento 100% + Reciprocidade"
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#B14432] mb-1">
                ❤️ Conexão Emocional
              </label>
              <input
                type="text"
                value={newEmocao}
                onChange={(e) => setNewEmocao(e.target.value)}
                placeholder="Ex: Tira o peso da reprovação"
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5C7A9E] mb-1">
                🧠 Fundamento Lógico
              </label>
              <input
                type="text"
                value={newLogica}
                onChange={(e) => setNewLogica(e.target.value)}
                placeholder="Ex: Abatimento de 100% na assinatura"
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              Descrição Curta (Instrução para o Atendente)
            </label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Ex: Usar quando o aluno disser que achou caro..."
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              Roteiro de Fala / Texto da Mensagem *
            </label>
            <textarea
              required
              rows={5}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Oi, {nome}! Tudo bem? Gravando esse áudio rapidinho só pra te avisar sobre o abatimento de {curso}..."
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227] resize-y font-sans"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3D63]">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-[#8C98B4] hover:text-[#EDE6D6] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm"
            >
              Salvar Modelo
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'todos', label: 'Todos os Scripts' },
            { id: 'roteiro_audio', label: '🎙️ Roteiros de Áudio (Voice)' },
            { id: 'pos_prova', label: 'Pós-Prova' },
            { id: 'migracao', label: 'Migração p/ Assinatura 1.0' },
            { id: 'fechamento_pix', label: 'Fechamento & PIX' },
            { id: 'pre_prova', label: 'Pré-Prova / Rotina' },
            { id: 'recuperacao_sumidos', label: 'Resgate / Sumidos' },
            { id: 'boas_vindas', label: 'Boas-Vindas' },
            { id: 'renovacao', label: 'Renovação' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? cat.id === 'roteiro_audio'
                    ? 'bg-[#38BDF8] text-[#101B2D] font-bold shadow-sm'
                    : 'bg-[#C9A227] text-[#101B2D] font-bold shadow-sm'
                  : 'bg-[#172644] text-[#8C98B4] hover:text-[#EDE6D6] border border-[#2B3D63]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-[#8C98B4] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar nos scripts..."
            className="w-full bg-[#172644] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#C9A227]"
          />
        </div>
      </div>

      {/* List of Templates */}
      <div className="flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-[#2B3D63] rounded-xl text-[#8C98B4] text-sm">
            Nenhum modelo de mensagem encontrado para esta categoria.
          </div>
        ) : (
          filtered.map((tmpl) => {
            const isEditing = editingId === tmpl.id;
            const isCopied = copiedId === tmpl.id;
            const isAudio = tmpl.categoria === 'roteiro_audio' || tmpl.tipo === 'audio';

            return (
              <div
                key={tmpl.id}
                className={`bg-[#172644] border rounded-xl p-4 sm:p-5 transition-all shadow-sm flex flex-col gap-3 ${
                  isAudio ? 'border-[#38BDF8]/40 bg-gradient-to-br from-[#172644] to-[#121F38]' : 'border-[#2B3D63]'
                }`}
              >
                {isEditing ? (
                  /* Edit Form Mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#2B3D63] pb-2">
                      <span className="text-xs font-semibold text-[#C9A227]">
                        Editando Modelo
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-[#8C98B4] hover:text-[#EDE6D6]"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                          Título
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#C9A227]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                          Categoria
                        </label>
                        <select
                          value={editCategory}
                          onChange={(e) =>
                            setEditCategory(e.target.value as MessageTemplate['categoria'])
                          }
                          className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#C9A227] cursor-pointer"
                        >
                          <option value="roteiro_audio">🎙️ Roteiro para Áudio (Voice Script)</option>
                          <option value="pos_prova">Pós-Prova</option>
                          <option value="migracao">Migração de Edital</option>
                          <option value="pre_prova">Pré-Prova / Rotina</option>
                          <option value="fechamento_pix">Fechamento & PIX</option>
                          <option value="recuperacao_sumidos">Resgate / Sumidos</option>
                          <option value="renovacao">Renovação</option>
                          <option value="boas_vindas">Boas-Vindas</option>
                          <option value="geral">Geral</option>
                        </select>
                      </div>
                    </div>

                    {editCategory === 'roteiro_audio' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#101B2D] p-2.5 rounded-lg border border-[#38BDF8]/30">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8] mb-1">
                            ⏱️ Duração Estimada do Áudio
                          </label>
                          <input
                            type="text"
                            value={editDuracao}
                            onChange={(e) => setEditDuracao(e.target.value)}
                            placeholder="Ex: 25 a 30 segundos"
                            className="w-full bg-[#172644] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-[#38BDF8]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8] mb-1">
                            🗣️ Tom de Voz
                          </label>
                          <input
                            type="text"
                            value={editTomDeVoz}
                            onChange={(e) => setEditTomDeVoz(e.target.value)}
                            placeholder="Ex: Acolhedor, seguro e com energia"
                            className="w-full bg-[#172644] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-[#38BDF8]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#C9A227] mb-1">
                          ⚡ Gatilho Mental & Estratégia
                        </label>
                        <input
                          type="text"
                          value={editGatilho}
                          onChange={(e) => setEditGatilho(e.target.value)}
                          placeholder="Ex: ❤️ Empatia + 🧠 Matemática dos 80%"
                          className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#C9A227]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#B14432] mb-1">
                          ❤️ Conexão Emocional
                        </label>
                        <input
                          type="text"
                          value={editEmocao}
                          onChange={(e) => setEditEmocao(e.target.value)}
                          placeholder="Ex: Acolhimento do cansaço e validação"
                          className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#C9A227]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5C7A9E] mb-1">
                          🧠 Fundamento Lógico
                        </label>
                        <input
                          type="text"
                          value={editLogica}
                          onChange={(e) => setEditLogica(e.target.value)}
                          placeholder="Ex: Curva de retenção e matemática"
                          className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#C9A227]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                        Descrição
                      </label>
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#C9A227]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                        Texto / Roteiro da Mensagem
                      </label>
                      <textarea
                        rows={6}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg p-3 text-sm focus:outline-none focus:border-[#C9A227] resize-y font-sans"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-[#8C98B4] hover:text-[#EDE6D6]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(tmpl.id)}
                        className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {getCategoryBadge(tmpl.categoria)}
                          {tmpl.gatilho && (
                            <span className="inline-flex items-center gap-1 bg-[#101B2D] text-[#EDE6D6] border border-[#C9A227]/50 text-[11px] font-semibold px-2.5 py-0.5 rounded-md shadow-xs">
                              ⚡ {tmpl.gatilho}
                            </span>
                          )}
                          {isAudio && (tmpl.duracaoEstimada || tmpl.tomDeVoz) && (
                            <span className="inline-flex items-center gap-1.5 bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 text-[10px] font-semibold px-2 py-0.5 rounded">
                              <Timer className="w-3 h-3" />
                              {tmpl.duracaoEstimada || '25 a 30s'}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif font-bold text-base sm:text-lg text-[#EDE6D6] mt-1 flex items-center gap-2">
                          <span>{tmpl.titulo}</span>
                        </h3>
                        {tmpl.descricao && (
                          <p className="text-xs text-[#8C98B4] mt-0.5">{tmpl.descricao}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(tmpl)}
                          className="flex items-center gap-1 text-xs text-[#8C98B4] hover:text-[#C9A227] bg-[#101B2D] border border-[#2B3D63] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="Editar este modelo"
                        >
                          <Edit2 className="w-3 h-3" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Excluir o modelo "${tmpl.titulo}"?`)) {
                              onDeleteTemplate(tmpl.id);
                            }
                          }}
                          className="text-[#8C98B4] hover:text-[#B14432] p-1.5 rounded hover:bg-[#101B2D] transition-colors cursor-pointer"
                          title="Excluir modelo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Audio Specific Guidelines Box if Audio */}
                    {isAudio && (
                      <div className="bg-[#101B2D] border border-[#38BDF8]/30 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex flex-wrap items-center gap-3 text-[11px]">
                          {tmpl.tomDeVoz && (
                            <div className="flex items-center gap-1 text-[#EDE6D6]">
                              <Volume2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                              <span className="text-[#8C98B4]">Tom de Voz:</span>
                              <span className="font-semibold">{tmpl.tomDeVoz}</span>
                            </div>
                          )}
                          {tmpl.duracaoEstimada && (
                            <div className="flex items-center gap-1 text-[#EDE6D6]">
                              <Timer className="w-3.5 h-3.5 text-[#38BDF8]" />
                              <span className="text-[#8C98B4]">Duração Ideal:</span>
                              <span className="font-semibold">{tmpl.duracaoEstimada}</span>
                            </div>
                          )}
                        </div>

                        {tmpl.dicasGravacao && tmpl.dicasGravacao.length > 0 && (
                          <div className="pt-2 border-t border-[#2B3D63] space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1">
                              <span>💡 Dicas de Gravação para Alta Conversão:</span>
                            </div>
                            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] text-[#EDE6D6]/90">
                              {tmpl.dicasGravacao.map((dica, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 bg-[#172644]/70 p-1.5 rounded">
                                  <span className="text-[#38BDF8] font-bold">•</span>
                                  <span>{dica}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Emotion & Logic Cards Breakdown */}
                    {(tmpl.emocao || tmpl.logica) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {tmpl.emocao && (
                          <div className="bg-[#101B2D]/70 border border-[#B14432]/30 rounded-lg p-2.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#B14432] flex items-center gap-1 mb-1">
                              <span>❤️ Conexão Emocional (Dor / Alívio / Desejo):</span>
                            </div>
                            <p className="text-[#EDE6D6]/90 leading-snug">{tmpl.emocao}</p>
                          </div>
                        )}
                        {tmpl.logica && (
                          <div className="bg-[#101B2D]/70 border border-[#5C7A9E]/40 rounded-lg p-2.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#5C7A9E] flex items-center gap-1 mb-1">
                              <span>🧠 Fundamento Lógico (Cálculo / Racional):</span>
                            </div>
                            <p className="text-[#EDE6D6]/90 leading-snug">{tmpl.logica}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Formatted Message / Teleprompter Box */}
                    <div
                      className={`rounded-lg p-4 text-xs sm:text-[14px] leading-relaxed whitespace-pre-wrap font-sans ${
                        isAudio
                          ? 'bg-[#0E1726] border-2 border-[#38BDF8]/40 text-[#EDE6D6] shadow-inner font-medium tracking-wide'
                          : 'bg-[#101B2D]/90 border border-[#2B3D63] text-[#EDE6D6]'
                      }`}
                    >
                      {isAudio && (
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] mb-1.5 flex items-center gap-1">
                          <Mic className="w-3 h-3" />
                          Teleprompter de Leitura para o Microfone:
                        </div>
                      )}
                      {tmpl.texto}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-[#2B3D63]/50">
                      <div className="text-[11px] text-[#8C98B4]">
                        Disponível diretamente no botão <b>"💬 Mensagem Rápida"</b> de cada contato.
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyPreview(tmpl)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-[#6E8F5C] text-[#EDE6D6]'
                            : isAudio
                            ? 'bg-[#38BDF8] hover:bg-[#2fb0ea] text-[#101B2D]'
                            : 'bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D]'
                        }`}
                        title="Copiar texto substituindo variáveis pelo exemplo"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            Copiado com Sucesso!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            {isAudio ? 'Copiar Roteiro de Áudio' : 'Copiar Script'}
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

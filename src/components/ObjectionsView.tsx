import React, { useState } from 'react';
import { Copy, Check, Plus, Trash2, ShieldAlert, Search } from 'lucide-react';
import { Objection } from '../types';

interface ObjectionsProps {
  objections: Objection[];
  onAddObjection: (obj: { objecao: string; resposta: string; categoria?: string }) => void;
  onDeleteObjection: (id: string) => void;
  onCopySuccess: (text: string) => void;
}

export const ObjectionsView: React.FC<ObjectionsProps> = ({
  objections,
  onAddObjection,
  onDeleteObjection,
  onCopySuccess,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const handleCopy = (obj: Objection) => {
    navigator.clipboard.writeText(obj.resposta);
    setCopiedId(obj.id);
    onCopySuccess(`Resposta para "${obj.objecao}" copiada!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQ.trim() || !newA.trim()) return;

    onAddObjection({
      objecao: newQ.trim(),
      resposta: newA.trim(),
      categoria: newCategory.trim() || 'Geral',
    });

    setNewQ('');
    setNewA('');
    setNewCategory('');
    setShowAdd(false);
  };

  const filtered = objections.filter(
    (o) =>
      o.objecao.toLowerCase().includes(search.toLowerCase()) ||
      o.resposta.toLowerCase().includes(search.toLowerCase()) ||
      (o.categoria && o.categoria.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#C9A227] mb-1">
            Apoio à Conversa no WhatsApp
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#EDE6D6]">
            Contornar Objeções
          </h2>
          <p className="text-xs sm:text-sm text-[#8C98B4] mt-0.5">
            Scripts e respostas estratégicas prontas para copiar e colar durante o atendimento.
          </p>
        </div>

        <button
          id="obj-toggle"
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Nova Objeção
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={handleSave}
          className="bg-[#172644] border border-[#C9A227]/40 rounded-xl p-4 sm:p-5 mb-5 shadow-lg space-y-3"
        >
          <div className="text-sm font-semibold text-[#EDE6D6] flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-[#C9A227]" />
            Cadastrar Nova Resposta a Objeção
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                Objeção do Cliente *
              </label>
              <input
                type="text"
                id="obj-q"
                required
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                placeholder="Ex: Achei a mensalidade alta..."
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
                Categoria / Tag
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Ex: Preço, Tempo, etc."
                className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              Resposta Sugerida (Script) *
            </label>
            <textarea
              id="obj-a"
              required
              rows={3}
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              placeholder="Digite o texto persuasivo que o atendente deve enviar..."
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227] resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3D63]">
            <button
              type="button"
              id="obj-cancel"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-[#8C98B4] hover:text-[#EDE6D6] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="obj-save"
              className="bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm"
            >
              Salvar Objeção
            </button>
          </div>
        </form>
      )}

      {/* Search filter */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-[#8C98B4] absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar scripts por palavra-chave..."
          className="w-full bg-[#172644] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#C9A227]"
        />
      </div>

      {/* List of objections */}
      <div className="flex flex-col gap-3" id="obj-list">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-[#2B3D63] rounded-xl text-[#8C98B4] text-sm">
            Nenhuma objeção encontrada.
          </div>
        ) : (
          filtered.map((o) => {
            const isCopied = copiedId === o.id;

            return (
              <div
                key={o.id}
                className="bg-[#172644] border border-[#2B3D63] hover:border-[#2B3D63] rounded-xl p-4 sm:p-5 transition-all shadow-sm flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {o.categoria && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#8C98B4] bg-[#101B2D] px-2 py-0.5 rounded mb-1.5 border border-[#2B3D63]">
                        {o.categoria}
                      </span>
                    )}
                    <h3 className="font-serif font-bold text-base sm:text-lg text-[#C9A227] leading-snug">
                      "{o.objecao}"
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Excluir esta resposta?')) {
                        onDeleteObjection(o.id);
                      }
                    }}
                    className="text-[#8C98B4] hover:text-[#B14432] p-1.5 rounded hover:bg-[#101B2D] transition-colors cursor-pointer"
                    title="Excluir objeção"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs sm:text-[13.5px] text-[#EDE6D6] leading-relaxed bg-[#101B2D]/70 p-3.5 rounded-lg border border-[#2B3D63]/70 whitespace-pre-wrap font-sans space-y-2">
                  {o.resposta.split('\n\n').map((paragraph, idx) => {
                    const isEmocao = paragraph.startsWith('❤️ [EMOÇÃO]:');
                    const isLogica = paragraph.startsWith('🧠 [LÓGICA]:');

                    if (isEmocao) {
                      return (
                        <div key={idx} className="bg-[#B14432]/10 border-l-2 border-[#B14432] pl-3 py-1 text-[#EDE6D6]">
                          <span className="font-bold text-[#B14432] mr-1.5">❤️ Emoção (Acolhimento):</span>
                          {paragraph.replace('❤️ [EMOÇÃO]:', '').trim()}
                        </div>
                      );
                    }
                    if (isLogica) {
                      return (
                        <div key={idx} className="bg-[#5C7A9E]/10 border-l-2 border-[#5C7A9E] pl-3 py-1 text-[#EDE6D6]">
                          <span className="font-bold text-[#5C7A9E] mr-1.5">🧠 Lógica (Racional/Cálculo):</span>
                          {paragraph.replace('🧠 [LÓGICA]:', '').trim()}
                        </div>
                      );
                    }
                    return <p key={idx}>{paragraph}</p>;
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(o)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                      isCopied
                        ? 'bg-[#6E8F5C] text-[#EDE6D6]'
                        : 'bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D]'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar resposta
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

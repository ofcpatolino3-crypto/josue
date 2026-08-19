import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  X,
  Check,
  Phone,
  Mail,
  BookOpen,
  Calendar,
  FileText,
  Thermometer,
  Sparkles,
  ClipboardList,
  AlertCircle,
  PlusCircle,
  CheckCircle2,
} from 'lucide-react';
import { Contact, Temperature } from '../types';
import { TEMP_ORDER } from '../data/defaults';
import { todayStr, cleanPhone, formatPhoneDisplay, parseRawTextToContacts } from '../utils/excel';

interface AddContactProps {
  isOpen?: boolean;
  onClose: () => void;
  onAddContact: (contact: Partial<Contact>) => void;
  onAddMultipleContacts?: (contacts: Partial<Contact>[]) => void;
  availableCourses?: string[];
}

export const AddContactForm: React.FC<AddContactProps> = ({
  isOpen = true,
  onClose,
  onAddContact,
  onAddMultipleContacts,
  availableCourses = [],
}) => {
  const [tab, setTab] = useState<'single' | 'batch'>('single');

  // Single Contact Form State
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [curso, setCurso] = useState('');
  const [temperatura, setTemperatura] = useState<Temperature>('Frio');
  const [proximoContato, setProximoContato] = useState('');
  const [observacao, setObservacao] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Batch Paste State
  const [rawBatchText, setRawBatchText] = useState('');
  const [parsedBatch, setParsedBatch] = useState<Partial<Contact>[]>([]);

  if (isOpen === false) return null;

  // Realtime phone cleaning & display helper
  const cleanedZap = cleanPhone(whatsapp);
  const formattedDisplayZap = cleanedZap ? formatPhoneDisplay(cleanedZap) : '';
  const isZapValid = cleanedZap.length >= 8 && cleanedZap.length <= 13;

  const popularCourses = [
    'TJ-SP',
    'Polícia Federal',
    'Polícia Rodoviária Federal',
    'Polícia Civil',
    'Polícia Militar',
    'OAB 1ª Fase',
    'OAB 2ª Fase',
    'INSS',
    'Receita Federal',
    'Tribunais (TRT/TRE/TRF)',
    'Magistratura / MP',
  ];

  const suggestedCourses = Array.from(new Set([...availableCourses, ...popularCourses])).slice(0, 10);

  const handleSingleSubmit = (e?: React.FormEvent, keepOpen: boolean = false) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!nome.trim()) {
      setErrorMessage('Por favor, informe ao menos o Nome Completo do aluno/lead.');
      return;
    }

    const finalPhone = cleanedZap || whatsapp.trim();

    onAddContact({
      nome: nome.trim(),
      whatsapp: finalPhone,
      email: email.trim().toLowerCase(),
      curso: curso.trim(),
      temperatura,
      dataContato: todayStr(),
      ultimoContato: '',
      proximoContato: proximoContato || '',
      status: 'Novo Lead',
      observacao: observacao.trim(),
    });

    if (keepOpen) {
      // Reset form fields but keep modal open for next lead
      setNome('');
      setWhatsapp('');
      setEmail('');
      setCurso('');
      setTemperatura('Frio');
      setProximoContato('');
      setObservacao('');
      setErrorMessage('');
    } else {
      onClose();
    }
  };

  const handleProcessBatchText = (text: string) => {
    setRawBatchText(text);
    if (!text.trim()) {
      setParsedBatch([]);
      return;
    }
    const results = parseRawTextToContacts(text);
    setParsedBatch(results);
  };

  const handleConfirmBatch = () => {
    if (parsedBatch.length === 0) {
      setErrorMessage('Nenhum contato detectado no texto colado.');
      return;
    }

    if (onAddMultipleContacts) {
      onAddMultipleContacts(parsedBatch);
    } else {
      parsedBatch.forEach((c) => onAddContact(c));
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#172644] border border-[#C9A227]/40 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B3D63] bg-[#121E33]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C9A227]/15 rounded-xl border border-[#C9A227]/30 text-[#C9A227]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#EDE6D6] flex items-center gap-2">
                <span>Adicionar Contato</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#C9A227]/20 text-[#C9A227] rounded-full border border-[#C9A227]/30">
                  Manual
                </span>
              </h2>
              <p className="text-xs text-[#8C98B4]">
                Cadastre um lead individualmente ou cole múltiplos contatos de uma vez
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8C98B4] hover:text-[#EDE6D6] p-1.5 rounded-lg hover:bg-[#1F3057] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-[#2B3D63] bg-[#101B2D] px-5 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'single'
                ? 'border-[#C9A227] text-[#C9A227] bg-[#172644]/60 rounded-t-lg'
                : 'border-transparent text-[#8C98B4] hover:text-[#EDE6D6]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Formulário Individual</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('batch')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'batch'
                ? 'border-[#C9A227] text-[#C9A227] bg-[#172644]/60 rounded-t-lg'
                : 'border-transparent text-[#8C98B4] hover:text-[#EDE6D6]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Colar Vários Contatos (Lote)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {tab === 'single' ? (
            <form onSubmit={(e) => handleSingleSubmit(e, false)} className="space-y-4">
              {/* Row 1: Name and WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center gap-1">
                    <span>Nome Completo *</span>
                  </label>
                  <input
                    type="text"
                    id="f-nome"
                    required
                    autoFocus
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] placeholder-[#8C98B4]/50 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#25D366]" />
                      <span>WhatsApp / Telefone</span>
                    </span>
                    {formattedDisplayZap && (
                      <span className="text-[10px] text-[#4ADE80] font-mono lowercase">
                        {formattedDisplayZap}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="f-whatsapp"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="Ex: (85) 99876-5432 ou 85998765432"
                      className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] placeholder-[#8C98B4]/50 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
                    />
                    {isZapValid && (
                      <CheckCircle2 className="w-4 h-4 text-[#4ADE80] absolute right-3 top-3" />
                    )}
                  </div>
                  <span className="text-[10px] text-[#8C98B4]/80 mt-1 block">
                    Pode digitar com DDD ou colado. O sistema normaliza automaticamente.
                  </span>
                </div>
              </div>

              {/* Row 2: E-mail and Curso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#60A5FA]" />
                    <span>E-mail do Aluno</span>
                  </label>
                  <input
                    type="email"
                    id="f-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: aluno@concursos.com.br"
                    className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] placeholder-[#8C98B4]/50 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-[#C9A227]" />
                    <span>Curso / Concurso de Interesse</span>
                  </label>
                  <input
                    type="text"
                    id="f-curso"
                    list="courses-datalist"
                    value={curso}
                    onChange={(e) => setCurso(e.target.value)}
                    placeholder="Ex: TJ-SP, PF, PM-SP, OAB..."
                    className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] placeholder-[#8C98B4]/50 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
                  />
                  <datalist id="courses-datalist">
                    {suggestedCourses.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  {/* Quick Course Suggestions Pills */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {['TJ-SP', 'Polícia Federal', 'OAB', 'INSS', 'PM'].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setCurso(quick)}
                        className="text-[10px] bg-[#101B2D] hover:bg-[#1F3057] text-[#8C98B4] hover:text-[#EDE6D6] px-2 py-0.5 rounded-md border border-[#2B3D63] transition-colors cursor-pointer"
                      >
                        +{quick}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: Temperatura and Próximo Contato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-[#F59E0B]" />
                    <span>Temperatura Inicial do Lead</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {TEMP_ORDER.map((t) => {
                      const isSelected = temperatura === t;
                      const colorMap: Record<Temperature, string> = {
                        Frio: isSelected
                          ? 'bg-[#3B82F6] text-white border-[#60A5FA]'
                          : 'bg-[#101B2D] text-[#8C98B4] border-[#2B3D63]',
                        Morno: isSelected
                          ? 'bg-[#EAB308] text-[#101B2D] border-[#FACC15]'
                          : 'bg-[#101B2D] text-[#8C98B4] border-[#2B3D63]',
                        Potencial: isSelected
                          ? 'bg-[#F97316] text-white border-[#FB923C]'
                          : 'bg-[#101B2D] text-[#8C98B4] border-[#2B3D63]',
                        Quente: isSelected
                          ? 'bg-[#EF4444] text-white border-[#F87171]'
                          : 'bg-[#101B2D] text-[#8C98B4] border-[#2B3D63]',
                        Pagou: isSelected
                          ? 'bg-[#16A34A] text-white border-[#4ADE80]'
                          : 'bg-[#101B2D] text-[#8C98B4] border-[#2B3D63]',
                      };

                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTemperatura(t)}
                          className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${colorMap[t]}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#C9A227]" />
                    <span>Agendar Próximo Contato (Retorno)</span>
                  </label>
                  <input
                    type="date"
                    id="f-proximo"
                    value={proximoContato}
                    onChange={(e) => setProximoContato(e.target.value)}
                    className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] rounded-xl px-3.5 py-2 text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Row 4: Observações */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[#8C98B4]" />
                  <span>Observações / Histórico Inicial</span>
                </label>
                <textarea
                  id="f-obs"
                  rows={2}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Informações relevantes: dia da prova, matéria de maior dificuldade, proposta enviada..."
                  className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] placeholder-[#8C98B4]/50 rounded-xl px-3.5 py-2 text-sm outline-none transition-colors resize-none"
                />
              </div>

              {/* Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2B3D63]">
                <button
                  type="button"
                  id="f-cancel"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#1F3057] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleSingleSubmit(e, true)}
                    className="flex items-center gap-1.5 bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] border border-[#2B3D63] px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Salvar e Adicionar Outro</span>
                  </button>

                  <button
                    type="submit"
                    id="f-save"
                    className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer font-sans"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Salvar Contato</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Batch Paste Mode */
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C98B4] mb-1.5 flex items-center justify-between">
                  <span>Cole a lista de contatos (Texto, WhatsApp ou Bloco de Notas)</span>
                  <span className="text-[10px] text-[#C9A227]">
                    {parsedBatch.length} contato(s) detectado(s)
                  </span>
                </label>
                <textarea
                  rows={5}
                  value={rawBatchText}
                  onChange={(e) => handleProcessBatchText(e.target.value)}
                  placeholder={`Exemplo (uma linha por contato):\nCarlos Silva, (85) 99876-5432, TJ-SP\nMariana Santos, 11988887777, Polícia Federal, Quente\nJoão Pedro | 21977776666 | OAB`}
                  className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] placeholder-[#8C98B4]/50 rounded-xl p-3 text-xs font-mono outline-none transition-colors resize-none"
                />
              </div>

              {parsedBatch.length > 0 && (
                <div className="border border-[#2B3D63] rounded-xl overflow-hidden bg-[#101B2D]">
                  <div className="px-3 py-2 bg-[#121E33] border-b border-[#2B3D63] text-[11px] font-bold text-[#8C98B4] flex items-center justify-between">
                    <span>Prévia dos Contatos Extraídos:</span>
                    <span className="text-[#4ADE80]">{parsedBatch.length} prontos</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#2B3D63]/50">
                    {parsedBatch.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs gap-2">
                        <div className="truncate">
                          <span className="font-semibold text-[#EDE6D6]">{item.nome}</span>
                          <span className="text-[#8C98B4] text-[11px] ml-2 font-mono">
                            {item.whatsapp ? formatPhoneDisplay(item.whatsapp) : '(Sem fone)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.curso && (
                            <span className="text-[10px] bg-[#172644] px-2 py-0.5 rounded text-[#C9A227] border border-[#2B3D63]">
                              {item.curso}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#172644] text-[#EDE6D6]">
                            {item.temperatura || 'Frio'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#2B3D63]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#1F3057] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBatch}
                  disabled={parsedBatch.length === 0}
                  className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Cadastrar Todos ({parsedBatch.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Clipboard,
  ClipboardCheck,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  BookOpen,
  Thermometer,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { Contact, Temperature } from '../types';
import { parseRawTextToContacts, formatPhoneDisplay, todayStr, cleanPhone } from '../utils/excel';
import { TEMP_ORDER } from '../data/defaults';

interface QuickPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportContacts: (contacts: Partial<Contact>[], batchName?: string) => void;
  availableCourses?: string[];
}

export const QuickPasteModal: React.FC<QuickPasteModalProps> = ({
  isOpen,
  onClose,
  onImportContacts,
  availableCourses = [],
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedContacts, setParsedContacts] = useState<Partial<Contact>[]>([]);
  const [defaultCourse, setDefaultCourse] = useState('');
  const [defaultTemp, setDefaultTemp] = useState<Temperature>('Frio');
  const [clipboardSupported, setClipboardSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
      setClipboardSupported(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Re-parse if text was already set
      if (rawText.trim()) {
        processText(rawText);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processText = (text: string) => {
    setRawText(text);
    if (!text || !text.trim()) {
      setParsedContacts([]);
      return;
    }

    const results = parseRawTextToContacts(text);
    setParsedContacts(results);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        processText(text);
      }
    } catch (err) {
      console.warn('Clipboard read failed or permission denied:', err);
    }
  };

  const handleConfirmImport = () => {
    if (parsedContacts.length === 0) return;

    // Apply default course or temperature if specified and missing in individual rows
    const finalized = parsedContacts.map((c, index) => {
      const cleanedZap = c.whatsapp ? cleanPhone(c.whatsapp) : '';
      return {
        ...c,
        nome: c.nome?.trim() || `Lead ${index + 1}`,
        whatsapp: cleanedZap || c.whatsapp || '',
        curso: c.curso?.trim() || defaultCourse.trim() || 'Geral',
        temperatura: c.temperatura || defaultTemp,
        dataContato: c.dataContato || todayStr(),
        status: c.status || 'Novo Lead',
      };
    });

    onImportContacts(finalized, 'Colar Rápido');
    onClose();
    setRawText('');
    setParsedContacts([]);
  };

  const popularCourses = [
    'TJ-SP',
    'Polícia Federal',
    'PRF',
    'Polícia Civil',
    'PM-SP',
    'OAB',
    'INSS',
    'Receita Federal',
  ];

  const suggestedCourses = Array.from(new Set([...availableCourses, ...popularCourses])).slice(0, 10);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#172644] border border-[#C9A227]/50 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B3D63] bg-[#121E33]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C9A227]/20 rounded-xl border border-[#C9A227]/40 text-[#C9A227]">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#EDE6D6] flex items-center gap-2">
                <span>Colar Contatos & Salvar Tudo</span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-[#22C55E]/20 text-[#4ADE80] rounded-full border border-[#22C55E]/30">
                  Instantâneo
                </span>
              </h2>
              <p className="text-xs text-[#8C98B4]">
                Cole números, nomes ou lista copiada do WhatsApp / Excel. O sistema formata e salva tudo.
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Paste Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8C98B4] flex items-center gap-1.5">
                <span>Cole aqui o texto / lista de contatos (Ctrl+V)</span>
              </label>
              {clipboardSupported && (
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="flex items-center gap-1 text-xs bg-[#1F3057] hover:bg-[#2B3D63] text-[#C9A227] px-2.5 py-1 rounded-md border border-[#2B3D63] transition-colors cursor-pointer font-semibold"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Colar da Área de Transferência</span>
                </button>
              )}
            </div>

            <textarea
              rows={6}
              autoFocus
              value={rawText}
              onChange={(e) => processText(e.target.value)}
              placeholder={`Exemplos aceitos (pode colar como quiser):\n\n1) Apenas números:\n85999887766\n11988887777\n\n2) Nome e WhatsApp:\nCarlos Silva - (85) 99988-7766\nMariana Souza - 11988887777 - TJ-SP\n\n3) Copiado direto do Excel ou WhatsApp:`}
              className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] placeholder-[#8C98B4]/40 rounded-xl p-3.5 text-xs font-mono outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Quick Options (Course & Temp fallback) */}
          <div className="bg-[#121E33] border border-[#2B3D63] rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#8C98B4] mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#C9A227]" />
                <span>Curso padrão (caso não esteja no texto):</span>
              </label>
              <input
                type="text"
                list="quick-courses"
                value={defaultCourse}
                onChange={(e) => setDefaultCourse(e.target.value)}
                placeholder="Ex: TJ-SP, PF, OAB..."
                className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] rounded-lg px-2.5 py-1.5 text-xs outline-none"
              />
              <datalist id="quick-courses">
                {suggestedCourses.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#8C98B4] mb-1 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-[#F59E0B]" />
                <span>Temperatura padrão:</span>
              </label>
              <select
                value={defaultTemp}
                onChange={(e) => setDefaultTemp(e.target.value as Temperature)}
                className="w-full bg-[#101B2D] border border-[#2B3D63] focus:border-[#C9A227] text-[#EDE6D6] rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer"
              >
                {TEMP_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real-time Parsed Preview */}
          {parsedContacts.length > 0 ? (
            <div className="border border-[#22C55E]/40 rounded-xl overflow-hidden bg-[#101B2D]">
              <div className="px-3.5 py-2.5 bg-[#14261C] border-b border-[#22C55E]/30 text-xs font-bold text-[#4ADE80] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                  <span>{parsedContacts.length} contato(s) identificados e prontos!</span>
                </span>
                <span className="text-[11px] text-[#8C98B4]">Formato validado</span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-[#2B3D63]/40">
                {parsedContacts.map((c, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between text-xs gap-2 hover:bg-[#172644]/40">
                    <div className="truncate flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1F3057] text-[#C9A227] font-bold text-[10px] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-[#EDE6D6]">{c.nome}</span>
                      {c.whatsapp && (
                        <span className="text-[#4ADE80] font-mono text-[11px] bg-[#172644] px-1.5 py-0.5 rounded border border-[#2B3D63]">
                          {formatPhoneDisplay(c.whatsapp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(c.curso || defaultCourse) && (
                        <span className="text-[10px] bg-[#1F3057] text-[#C9A227] px-2 py-0.5 rounded border border-[#2B3D63]">
                          {c.curso || defaultCourse}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#172644] text-[#EDE6D6]">
                        {c.temperatura || defaultTemp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : rawText.trim() ? (
            <div className="flex items-center gap-2 p-3 bg-amber-900/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Nenhum número ou contato reconhecido no texto. Cole ao menos telefones ou nomes.</span>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-[#2B3D63] bg-[#121E33]">
          <button
            type="button"
            onClick={() => {
              setRawText('');
              setParsedContacts([]);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#1F3057] transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {parsedContacts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRawText('');
                  setParsedContacts([]);
                }}
                className="px-3 py-2 rounded-xl text-xs text-[#8C98B4] hover:text-red-400 hover:bg-[#1F3057] transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}

            <button
              type="button"
              disabled={parsedContacts.length === 0}
              onClick={handleConfirmImport}
              className="flex items-center gap-2 bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:brightness-110 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {parsedContacts.length > 0
                  ? `Salvar e Carregar ${parsedContacts.length} Contato(s) Agora`
                  : 'Cole os Contatos Acima'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

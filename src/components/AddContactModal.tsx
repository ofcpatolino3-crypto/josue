import React, { useState } from 'react';
import { UserPlus, X, Check } from 'lucide-react';
import { Contact, Temperature } from '../types';
import { TEMP_ORDER } from '../data/defaults';
import { todayStr } from '../utils/excel';

interface AddContactProps {
  isOpen: boolean;
  onClose: () => void;
  onAddContact: (contact: Partial<Contact>) => void;
}

export const AddContactForm: React.FC<AddContactProps> = ({
  isOpen,
  onClose,
  onAddContact,
}) => {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [curso, setCurso] = useState('');
  const [temperatura, setTemperatura] = useState<Temperature>('Frio');
  const [proximoContato, setProximoContato] = useState('');
  const [observacao, setObservacao] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Por favor, informe ao menos o nome do aluno/contato.');
      return;
    }

    onAddContact({
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      curso: curso.trim(),
      temperatura,
      dataContato: todayStr(),
      ultimoContato: '',
      proximoContato: proximoContato || '',
      status: 'Novo Lead',
      observacao: observacao.trim(),
    });

    // Reset
    setNome('');
    setWhatsapp('');
    setEmail('');
    setCurso('');
    setTemperatura('Frio');
    setProximoContato('');
    setObservacao('');
    onClose();
  };

  return (
    <div className="bg-[#172644] border border-[#C9A227]/40 rounded-xl p-4 sm:p-5 mb-5 shadow-lg animate-fadeIn">
      <div className="flex items-center justify-between border-b border-[#2B3D63] pb-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#EDE6D6]">
          <UserPlus className="w-4 h-4 text-[#C9A227]" />
          Adicionar Novo Contato
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#8C98B4] hover:text-[#EDE6D6] p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              id="f-nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              WhatsApp / Telefone
            </label>
            <input
              type="text"
              id="f-whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ex: (11) 99999-8888 ou 11999998888"
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              E-mail do Aluno
            </label>
            <input
              type="email"
              id="f-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: aluno@email.com"
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              Curso / Edital de Interesse
            </label>
            <input
              type="text"
              id="f-curso"
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              placeholder="Ex: TJ-SP, Polícia Federal, etc."
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              Temperatura Inicial
            </label>
            <select
              id="f-temp"
              value={temperatura}
              onChange={(e) => setTemperatura(e.target.value as Temperature)}
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227] cursor-pointer"
            >
              {TEMP_ORDER.map((t) => (
                <option key={t} value={t} className="bg-[#101B2D] text-[#EDE6D6]">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
              Próximo Contato (Agendamento)
            </label>
            <input
              type="date"
              id="f-proximo"
              value={proximoContato}
              onChange={(e) => setProximoContato(e.target.value)}
              className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C98B4] mb-1">
            Observações
          </label>
          <input
            type="text"
            id="f-obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Detalhes sobre o interesse, propostas enviadas, rotina de estudos..."
            className="w-full bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3D63]">
          <button
            type="button"
            id="f-cancel"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8C98B4] hover:text-[#EDE6D6] hover:bg-[#101B2D] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            id="f-save"
            className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            Salvar Contato
          </button>
        </div>
      </form>
    </div>
  );
};

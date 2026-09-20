import React from 'react';
import { Users, PhoneCall, CheckCircle2, AlertTriangle } from 'lucide-react';

interface StatsProps {
  total: number;
  pending: number;
  contacted: number;
  overdue: number;
}

export const StatsCards: React.FC<StatsProps> = ({ total, pending, contacted, overdue }) => {
  const contactedPercent = total > 0 ? Math.round((contacted / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3.5">
      {/* Total Card */}
      <div className="bg-[#111D3E] border border-[#263B6E] rounded-xl p-3.5 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
            Total de Alunos
          </span>
          <div id="stat-total" className="text-2xl font-serif font-bold text-[#FFFFFF] mt-0.5">
            {total}
          </div>
          <span className="text-[11px] text-[#94A3B8]">cadastrados na sua base</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#0B132B] border border-[#263B6E] flex items-center justify-center text-[#94A3B8]">
          <Users className="w-5 h-5" />
        </div>
      </div>

      {/* A contatar Card */}
      <div className="bg-[#111D3E] border border-[#263B6E] rounded-xl p-3.5 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#2563EB]">
            Pendentes a Contatar
          </span>
          <div id="stat-pend" className="text-2xl font-serif font-bold text-[#2563EB] mt-0.5">
            {pending}
          </div>
          {overdue > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#DC2626] bg-[#DC2626]/10 px-1.5 py-0.2 rounded mt-0.5">
              <AlertTriangle className="w-3 h-3" />
              {overdue} atrasado{overdue > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-[11px] text-[#94A3B8]">aguardando primeiro envio</span>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#2563EB]">
          <PhoneCall className="w-5 h-5" />
        </div>
      </div>

      {/* Já contatados Card */}
      <div className="bg-[#111D3E] border border-[#263B6E] rounded-xl p-3.5 flex items-center justify-between shadow-sm">
        <div className="flex-1 mr-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#4ADE80]">
              Contatados / Concluídos
            </span>
            <span className="text-xs font-bold text-[#4ADE80]">{contactedPercent}%</span>
          </div>
          <div id="stat-sent" className="text-2xl font-serif font-bold text-[#4ADE80] mt-0.5">
            {contacted}
          </div>
          {/* Progress bar */}
          <div className="w-full bg-[#0B132B] h-1.5 rounded-full mt-1.5 overflow-hidden border border-[#263B6E]/50">
            <div
              className="bg-[#16A34A] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(contactedPercent, 100)}%` }}
            />
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#16A34A]/10 border border-[#4ADE80]/30 flex items-center justify-center text-[#4ADE80] shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};


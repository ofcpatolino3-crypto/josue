import React from 'react';
import { Users, PhoneCall, CheckCircle, Clock } from 'lucide-react';

interface StatsProps {
  total: number;
  pending: number;
  contacted: number;
  overdue: number;
}

export const StatsCards: React.FC<StatsProps> = ({ total, pending, contacted, overdue }) => {
  const contactedPercent = total > 0 ? Math.round((contacted / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      {/* Total Card */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-[#8C98B4] mb-2">
          <span className="text-[11px] uppercase tracking-wider font-medium">Total Cadastrados</span>
          <Users className="w-4 h-4 text-[#8C98B4]" />
        </div>
        <div className="flex items-baseline justify-between">
          <div id="stat-total" className="text-2xl sm:text-3xl font-serif font-bold text-[#EDE6D6]">
            {total}
          </div>
          <span className="text-xs text-[#8C98B4]">base ativa</span>
        </div>
      </div>

      {/* A contatar Card */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-[#8C98B4] mb-2">
          <span className="text-[11px] uppercase tracking-wider font-medium text-[#C9A227]">A Contatar</span>
          <PhoneCall className="w-4 h-4 text-[#C9A227]" />
        </div>
        <div className="flex items-baseline justify-between">
          <div id="stat-pend" className="text-2xl sm:text-3xl font-serif font-bold text-[#C9A227]">
            {pending}
          </div>
          {overdue > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#B14432] bg-[#B14432]/10 px-2 py-0.5 rounded border border-[#B14432]/20">
              <Clock className="w-3 h-3" />
              {overdue} atrasado{overdue > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Já contatados Card */}
      <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-[#8C98B4] mb-2">
          <span className="text-[11px] uppercase tracking-wider font-medium text-[#6E8F5C]">Já Contatados</span>
          <CheckCircle className="w-4 h-4 text-[#6E8F5C]" />
        </div>
        <div className="flex items-baseline justify-between">
          <div id="stat-sent" className="text-2xl sm:text-3xl font-serif font-bold text-[#6E8F5C]">
            {contacted}
          </div>
          <span className="text-xs font-semibold text-[#8C98B4]">
            {contactedPercent}% do total
          </span>
        </div>
      </div>
    </div>
  );
};

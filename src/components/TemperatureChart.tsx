import React from 'react';
import { Contact, Temperature } from '../types';
import { TEMP_COLORS, TEMP_ORDER } from '../data/defaults';

interface ChartProps {
  contacts: Contact[];
  selectedTempFilter?: string;
  onSelectTempFilter?: (temp: string) => void;
}

export const TemperatureChart: React.FC<ChartProps> = ({
  contacts,
  selectedTempFilter,
  onSelectTempFilter,
}) => {
  const total = contacts.length;

  // Calculate distribution
  const tempStats = TEMP_ORDER.map((t) => {
    const count = contacts.filter((c) => c.temperatura === t).length;
    const pct = total > 0 ? (count / total) * 100 : 0;
    return {
      temp: t,
      count,
      pct,
      color: TEMP_COLORS[t],
      label: t === 'Pagou' ? 'Pagou (vendas)' : t,
    };
  });

  // Calculate conic gradient stops
  let currentCursor = 0;
  const gradientStops: string[] = [];

  if (total === 0) {
    gradientStops.push('#2B3D63 0% 100%');
  } else {
    tempStats.forEach((stat) => {
      if (stat.count > 0) {
        const start = currentCursor;
        currentCursor += stat.pct;
        gradientStops.push(`${stat.color} ${start}% ${currentCursor}%`);
      }
    });

    // Fallback if 0 items have values
    if (gradientStops.length === 0) {
      gradientStops.push('#2B3D63 0% 100%');
    }
  }

  const conicStyle = {
    background: `conic-gradient(${gradientStops.join(', ')})`,
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 bg-[#172644] border border-[#2B3D63] rounded-xl p-5 mb-5 shadow-sm">
      {/* Donut graphic */}
      <div className="relative w-36 h-36 rounded-full shrink-0 shadow-inner" style={conicStyle}>
        <div className="absolute inset-5 rounded-full bg-[#172644] flex flex-col items-center justify-center text-center shadow-md">
          <div className="font-serif text-2xl font-bold text-[#EDE6D6] leading-none">
            {total}
          </div>
          <div className="text-[10px] text-[#8C98B4] uppercase tracking-wider mt-1 font-medium">
            cadastrados
          </div>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex-1 w-full flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wider text-[#8C98B4] font-semibold mb-1 flex items-center justify-between">
          <span>Distribuição por Temperatura</span>
          {selectedTempFilter && (
            <button
              onClick={() => onSelectTempFilter && onSelectTempFilter('')}
              className="text-[11px] text-[#C9A227] hover:underline cursor-pointer lowercase"
            >
              (limpar filtro)
            </button>
          )}
        </div>

        {total === 0 ? (
          <div className="text-xs text-[#8C98B4] py-2">
            Importe ou adicione contatos para visualizar o gráfico térmico de conversão.
          </div>
        ) : (
          tempStats.map((item) => {
            const isSelected = selectedTempFilter === item.temp;
            return (
              <button
                key={item.temp}
                onClick={() => {
                  if (onSelectTempFilter) {
                    onSelectTempFilter(isSelected ? '' : item.temp);
                  }
                }}
                className={`flex items-center gap-3 p-1.5 px-2 rounded-lg text-xs sm:text-sm text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1F3057] ring-1 ring-[#C9A227]'
                    : 'hover:bg-[#1F3057]/60'
                }`}
                title={`Filtrar por ${item.label}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1 text-[#EDE6D6] font-medium truncate">
                  {item.label}
                </span>
                <span className="text-xs text-[#8C98B4] w-24 text-right">
                  {item.count} contato{item.count !== 1 ? 's' : ''}
                </span>
                <span className="font-serif font-bold text-sm text-[#C9A227] w-12 text-right">
                  {Math.round(item.pct)}%
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

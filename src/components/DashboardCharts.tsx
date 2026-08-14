import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { TrendingUp, Users, CheckCircle2, Flame, Calendar, Filter, ArrowUpRight, FileSpreadsheet } from 'lucide-react';
import { Contact, Temperature } from '../types';
import { TEMP_COLORS } from '../data/defaults';

interface DashboardChartsProps {
  contacts: Contact[];
  onOpenDailyExport?: () => void;
}

type PeriodOption = '7d' | '14d' | '30d' | 'all';

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ contacts, onOpenDailyExport }) => {
  const [period, setPeriod] = useState<PeriodOption>('14d');
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'contacted' | 'paid'>('all');

  // --- OVERALL METRICS ---
  const totalLeads = contacts.length;
  const contactedLeads = contacts.filter((c) => Boolean(c.ultimoContato)).length;
  const paidLeads = contacts.filter((c) => c.temperatura === 'Pagou').length;
  const hotAndPotentialLeads = contacts.filter(
    (c) => c.temperatura === 'Quente' || c.temperatura === 'Potencial'
  ).length;

  const conversionRate = totalLeads > 0 ? ((paidLeads / totalLeads) * 100).toFixed(1) : '0.0';
  const contactedConversionRate =
    contactedLeads > 0 ? ((paidLeads / contactedLeads) * 100).toFixed(1) : '0.0';
  const contactedRate = totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0;

  // --- DAILY VOLUME DATA PREPARATION ---
  const dailyData = useMemo(() => {
    // Determine cutoff date based on period
    const now = new Date();
    const daysCount = period === '7d' ? 7 : period === '14d' ? 14 : period === '30d' ? 30 : 60;

    // Collect all valid dates from contacts (ultimoContato and dataContato)
    const dateMap = new Map<
      string,
      {
        dateStr: string;
        displayDate: string;
        atendimentos: number;
        novosLeads: number;
        conversoes: number;
      }
    >();

    // Generate continuous date array for the selected window
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const [year, month, day] = isoDate.split('-');
      const displayDate = `${day}/${month}`;

      dateMap.set(isoDate, {
        dateStr: isoDate,
        displayDate,
        atendimentos: 0,
        novosLeads: 0,
        conversoes: 0,
      });
    }

    // Populate counts from contacts
    contacts.forEach((c) => {
      // 1. Atendimentos (ultimoContato)
      if (c.ultimoContato) {
        const item = dateMap.get(c.ultimoContato);
        if (item) {
          item.atendimentos += 1;
        } else if (period === 'all') {
          const [year, month, day] = c.ultimoContato.split('-');
          dateMap.set(c.ultimoContato, {
            dateStr: c.ultimoContato,
            displayDate: `${day}/${month}`,
            atendimentos: 1,
            novosLeads: 0,
            conversoes: 0,
          });
        }
      }

      // 2. Novos cadastros (dataContato)
      if (c.dataContato) {
        const item = dateMap.get(c.dataContato);
        if (item) {
          item.novosLeads += 1;
        } else if (period === 'all') {
          const [year, month, day] = c.dataContato.split('-');
          const existing = dateMap.get(c.dataContato) || {
            dateStr: c.dataContato,
            displayDate: `${day}/${month}`,
            atendimentos: 0,
            novosLeads: 0,
            conversoes: 0,
          };
          existing.novosLeads += 1;
          dateMap.set(c.dataContato, existing);
        }
      }

      // 3. Conversões (Pagou)
      if (c.temperatura === 'Pagou') {
        const conversionDate = c.ultimoContato || c.dataContato;
        if (conversionDate) {
          const item = dateMap.get(conversionDate);
          if (item) {
            item.conversoes += 1;
          }
        }
      }
    });

    const result = Array.from(dateMap.values());
    result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    return result;
  }, [contacts, period]);

  // --- FUNNEL / CONVERSION STAGES DATA ---
  const funnelData = useMemo(() => {
    return [
      {
        etapa: '1. Cadastrados',
        qtd: totalLeads,
        taxa: 100,
        fill: '#8C98B4',
        descricao: 'Total de leads na base',
      },
      {
        etapa: '2. Contatados',
        qtd: contactedLeads,
        taxa: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0,
        fill: '#5C7A9E',
        descricao: 'Leads abordados no WhatsApp',
      },
      {
        etapa: '3. Qualificados',
        qtd: hotAndPotentialLeads,
        taxa: totalLeads > 0 ? Math.round((hotAndPotentialLeads / totalLeads) * 100) : 0,
        fill: '#C9A227',
        descricao: 'Temperatura Quente ou Potencial',
      },
      {
        etapa: '4. Vendas (1.0)',
        qtd: paidLeads,
        taxa: totalLeads > 0 ? Number(((paidLeads / totalLeads) * 100).toFixed(1)) : 0,
        fill: '#6E8F5C',
        descricao: 'Matrículas confirmadas / Pagou',
      },
    ];
  }, [totalLeads, contactedLeads, hotAndPotentialLeads, paidLeads]);

  // --- COURSE CONVERSION PERFORMANCE ---
  const coursePerformance = useMemo(() => {
    const map = new Map<string, { total: number; pagos: number; contatados: number }>();

    contacts.forEach((c) => {
      const course = c.curso && c.curso.trim() ? c.curso.trim() : 'Outros';
      const existing = map.get(course) || { total: 0, pagos: 0, contatados: 0 };
      existing.total += 1;
      if (c.ultimoContato) existing.contatados += 1;
      if (c.temperatura === 'Pagou') existing.pagos += 1;
      map.set(course, existing);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name: name.length > 22 ? name.slice(0, 20) + '...' : name,
        fullName: name,
        total: data.total,
        pagos: data.pagos,
        contatados: data.contatados,
        conversao: data.total > 0 ? Number(((data.pagos / data.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [contacts]);

  // Custom Dark Recharts Tooltip
  const CustomDailyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#101B2D] border border-[#2B3D63] p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[170px]">
          <div className="font-bold text-[#EDE6D6] border-b border-[#2B3D63] pb-1 flex items-center justify-between">
            <span>📅 {data.displayDate}</span>
            <span className="text-[10px] text-[#8C98B4] font-normal">{data.dateStr}</span>
          </div>
          <div className="flex items-center justify-between text-[#5C7A9E]">
            <span>💬 Atendimentos:</span>
            <span className="font-bold text-[#EDE6D6]">{data.atendimentos}</span>
          </div>
          <div className="flex items-center justify-between text-[#8C98B4]">
            <span>📥 Novos Cadastros:</span>
            <span className="font-bold text-[#EDE6D6]">{data.novosLeads}</span>
          </div>
          <div className="flex items-center justify-between text-[#6E8F5C]">
            <span>💰 Conversões (Pagou):</span>
            <span className="font-bold text-[#6E8F5C]">{data.conversoes}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomFunnelTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#101B2D] border border-[#2B3D63] p-3 rounded-lg shadow-xl text-xs space-y-1 min-w-[180px]">
          <div className="font-bold text-[#EDE6D6] border-b border-[#2B3D63] pb-1">
            {data.etapa}
          </div>
          <p className="text-[11px] text-[#8C98B4]">{data.descricao}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[#8C98B4]">Quantidade:</span>
            <span className="font-bold text-[#EDE6D6]">{data.qtd} leads</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#8C98B4]">Taxa de Conversão:</span>
            <span className="font-bold text-[#C9A227]">{data.taxa}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#172644] border border-[#2B3D63] rounded-xl p-4 sm:p-5 mb-5 shadow-sm space-y-5">
      {/* Top Header & Fast KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2B3D63] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#C9A227]" />
            <h3 className="font-serif font-bold text-base sm:text-lg text-[#EDE6D6]">
              Dashboard de Atendimentos & Taxa de Conversão
            </h3>
          </div>
          <p className="text-xs text-[#8C98B4] mt-0.5">
            Acompanhamento diário de contatos realizados via WhatsApp e progressão do funil de vendas.
          </p>
        </div>

        {/* Period Selector & Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {onOpenDailyExport && (
            <button
              type="button"
              onClick={onOpenDailyExport}
              className="flex items-center gap-1.5 bg-[#101B2D] hover:bg-[#1F3057] text-[#C9A227] hover:text-[#EDE6D6] border border-[#2B3D63] hover:border-[#C9A227] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Fechamento
            </button>
          )}

          <div className="flex items-center gap-1 bg-[#101B2D] p-1 rounded-lg border border-[#2B3D63]">
            {(
              [
                { id: '7d', label: '7 Dias' },
                { id: '14d', label: '14 Dias' },
                { id: '30d', label: '30 Dias' },
                { id: 'all', label: 'Tudo' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-[#C9A227] text-[#101B2D] shadow-xs'
                    : 'text-[#8C98B4] hover:text-[#EDE6D6]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mini KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#101B2D]/90 border border-[#2B3D63] rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#6E8F5C] flex items-center justify-between">
            <span>Taxa de Conversão</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-[#6E8F5C] mt-1">
            {conversionRate}%
          </div>
          <div className="text-[10px] text-[#8C98B4] mt-0.5">
            {paidLeads} de {totalLeads} leads viraram alunos
          </div>
        </div>

        <div className="bg-[#101B2D]/90 border border-[#2B3D63] rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#5C7A9E] flex items-center justify-between">
            <span>Eficiência do Contato</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-[#EDE6D6] mt-1">
            {contactedRate}%
          </div>
          <div className="text-[10px] text-[#8C98B4] mt-0.5">
            {contactedLeads} contatados ({contactedConversionRate}% fecharam)
          </div>
        </div>

        <div className="bg-[#101B2D]/90 border border-[#2B3D63] rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#C9A227] flex items-center justify-between">
            <span>Pipeline Quente</span>
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-[#C9A227] mt-1">
            {hotAndPotentialLeads}
          </div>
          <div className="text-[10px] text-[#8C98B4] mt-0.5">leads prontos para fechamento</div>
        </div>

        <div className="bg-[#101B2D]/90 border border-[#2B3D63] rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8C98B4] flex items-center justify-between">
            <span>Volume Total</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-[#EDE6D6] mt-1">
            {totalLeads}
          </div>
          <div className="text-[10px] text-[#8C98B4] mt-0.5">cadastros sincronizados</div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* CHART 1: Volume de Atendimentos por Dia (8 cols) */}
        <div className="lg:col-span-7 bg-[#101B2D]/80 border border-[#2B3D63] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-[#EDE6D6] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
                Volume de Atendimentos Diários
              </div>
              <p className="text-[11px] text-[#8C98B4]">
                Atendimentos realizados no WhatsApp vs. Vendas fechadas por dia
              </p>
            </div>
          </div>

          <div className="w-full h-56">
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#8C98B4]">
                Nenhum atendimento registrado no período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#2B3D63" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#8C98B4"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#2B3D63' }}
                  />
                  <YAxis
                    stroke="#8C98B4"
                    fontSize={10}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: '#2B3D63' }}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />
                  <Bar
                    dataKey="atendimentos"
                    name="Atendimentos (WhatsApp)"
                    fill="#5C7A9E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    type="monotone"
                    dataKey="conversoes"
                    name="Vendas / Pagou"
                    stroke="#6E8F5C"
                    strokeWidth={2.5}
                    dot={{ fill: '#6E8F5C', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: Funil de Conversão de Leads (5 cols) */}
        <div className="lg:col-span-5 bg-[#101B2D]/80 border border-[#2B3D63] rounded-xl p-4 flex flex-col justify-between">
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wider font-bold text-[#EDE6D6] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#6E8F5C]" />
              Funil de Conversão de Leads
            </div>
            <p className="text-[11px] text-[#8C98B4]">
              Progressão dos contatos desde o cadastro até o fechamento
            </p>
          </div>

          <div className="w-full h-56">
            {totalLeads === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#8C98B4]">
                Importe contatos para visualizar o funil de conversão.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelData}
                  layout="vertical"
                  margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#2B3D63" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#8C98B4"
                    fontSize={10}
                    allowDecimals={false}
                    axisLine={{ stroke: '#2B3D63' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="etapa"
                    stroke="#EDE6D6"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#2B3D63' }}
                    width={85}
                  />
                  <Tooltip content={<CustomFunnelTooltip />} />
                  <Bar dataKey="qtd" name="Quantidade" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Conversion by Course Ranking bar (Compact) */}
      {coursePerformance.length > 0 && (
        <div className="border-t border-[#2B3D63] pt-3.5">
          <div className="text-[11px] uppercase tracking-wider font-bold text-[#8C98B4] mb-2 flex items-center justify-between">
            <span>Conversão por Curso de Origem (Top {coursePerformance.length})</span>
            <span className="text-[10px] text-[#C9A227] font-normal">
              Aproveitamento de leads de cursos isolados
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {coursePerformance.map((cp, idx) => (
              <div
                key={idx}
                className="bg-[#101B2D] border border-[#2B3D63] rounded-lg p-2.5 flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-[#EDE6D6] truncate" title={cp.fullName}>
                    {cp.fullName}
                  </div>
                  <div className="text-[10px] text-[#8C98B4]">
                    {cp.contatados}/{cp.total} contatados • {cp.pagos} vendas
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                      cp.conversao > 0
                        ? 'bg-[#6E8F5C]/20 text-[#6E8F5C] border border-[#6E8F5C]/30'
                        : 'bg-[#2B3D63]/50 text-[#8C98B4]'
                    }`}
                  >
                    {cp.conversao}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

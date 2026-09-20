import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Calendar,
  Sparkles,
  Users,
  CheckCircle2,
  Flame,
  Snowflake,
  TrendingUp,
} from 'lucide-react';
import { Contact, Temperature } from '../types';
import {
  exportContactsToExcel,
  exportContactsToCSV,
  generateDailySummaryText,
  todayStr,
  formatDateBR,
} from '../utils/excel';
import { TEMP_COLORS } from '../data/defaults';

interface DailyExportModalProps {
  contacts: Contact[];
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type ExportFilterType = 'all' | 'today' | 'pagou' | 'quente_potencial' | 'morno_frio';

export const DailyExportModal: React.FC<DailyExportModalProps> = ({
  contacts,
  onClose,
  onToast,
}) => {
  const [filterType, setFilterType] = useState<ExportFilterType>('all');
  const [copiedText, setCopiedText] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const today = todayStr();

  // Metrics
  const total = contacts.length;
  const contactedToday = useMemo(
    () => contacts.filter((c) => c.ultimoContato === today),
    [contacts, today]
  );
  const pagouList = useMemo(
    () => contacts.filter((c) => c.temperatura === 'Pagou'),
    [contacts]
  );
  const quenteList = useMemo(
    () => contacts.filter((c) => c.temperatura === 'Quente'),
    [contacts]
  );
  const potencialList = useMemo(
    () => contacts.filter((c) => c.temperatura === 'Potencial'),
    [contacts]
  );
  const mornoList = useMemo(
    () => contacts.filter((c) => c.temperatura === 'Morno'),
    [contacts]
  );
  const frioList = useMemo(
    () => contacts.filter((c) => c.temperatura === 'Frio'),
    [contacts]
  );

  // Filtered contacts based on selection
  const filteredContacts = useMemo(() => {
    switch (filterType) {
      case 'today':
        return contactedToday;
      case 'pagou':
        return pagouList;
      case 'quente_potencial':
        return contacts.filter((c) => c.temperatura === 'Quente' || c.temperatura === 'Potencial');
      case 'morno_frio':
        return contacts.filter((c) => c.temperatura === 'Morno' || c.temperatura === 'Frio');
      case 'all':
      default:
        return contacts;
    }
  }, [filterType, contacts, contactedToday, pagouList]);

  const filterLabel = useMemo(() => {
    switch (filterType) {
      case 'today':
        return 'Contatados Hoje';
      case 'pagou':
        return 'Alunos que Pagaram (Vendas)';
      case 'quente_potencial':
        return 'Quentes e Potenciais';
      case 'morno_frio':
        return 'Mornos e Frios';
      case 'all':
      default:
        return 'Todos os Contatos da Base';
    }
  }, [filterType]);

  const summaryText = useMemo(() => generateDailySummaryText(contacts), [contacts]);

  const handleExportExcel = async () => {
    if (filteredContacts.length === 0) {
      onToast('Nenhum contato encontrado para este filtro.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      const filename = `fechamento-${filterType}-${today}.xlsx`;
      await exportContactsToExcel(filteredContacts, filename, filterLabel);
      onToast(`Planilha Excel colorida baixada com ${filteredContacts.length} contatos!`, 'success');
    } catch (err) {
      console.error('Error generating excel:', err);
      onToast('Erro ao gerar planilha Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredContacts.length === 0) {
      onToast('Nenhum contato encontrado para este filtro.', 'error');
      return;
    }
    const filename = `fechamento-${filterType}-${today}.csv`;
    exportContactsToCSV(filteredContacts, filename);
    onToast(`Arquivo CSV baixado com ${filteredContacts.length} contatos!`, 'success');
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText);
    setCopiedText(true);
    onToast('Relatório copiado para a área de transferência!', 'success');
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-[#111D3E] border border-[#263B6E] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#263B6E] flex items-center justify-between bg-[#0B132B]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#2563EB]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-[#2563EB] tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fechamento de Fim de Dia • {formatDateBR(today)}
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-[#FFFFFF]">
                Exportação Completa e Atualizada
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#FFFFFF] p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-sm">
          {/* Temperature Summary Pills */}
          <div>
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Status da Base Hoje ({total} leads)</span>
              <span className="text-[#2563EB] normal-case">{contactedToday.length} contatados hoje</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="bg-[#0B132B] border border-[#16A34A]/40 p-2.5 rounded-lg flex flex-col items-center text-center">
                <span className="text-[10px] uppercase font-bold text-[#16A34A] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Pagou
                </span>
                <span className="text-base font-bold text-[#FFFFFF] mt-0.5">{pagouList.length}</span>
                <span className="text-[10px] text-[#94A3B8]">
                  {total > 0 ? ((pagouList.length / total) * 100).toFixed(0) : 0}% conv.
                </span>
              </div>

              <div className="bg-[#0B132B] border border-[#2563EB]/40 p-2.5 rounded-lg flex flex-col items-center text-center">
                <span className="text-[10px] uppercase font-bold text-[#2563EB] flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Potencial
                </span>
                <span className="text-base font-bold text-[#FFFFFF] mt-0.5">{potencialList.length}</span>
                <span className="text-[10px] text-[#94A3B8]">negociando</span>
              </div>

              <div className="bg-[#0B132B] border border-[#EA580C]/40 p-2.5 rounded-lg flex flex-col items-center text-center">
                <span className="text-[10px] uppercase font-bold text-[#EA580C] flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Quente
                </span>
                <span className="text-base font-bold text-[#FFFFFF] mt-0.5">{quenteList.length}</span>
                <span className="text-[10px] text-[#94A3B8]">alta chance</span>
              </div>

              <div className="bg-[#0B132B] border border-[#2563EB]/40 p-2.5 rounded-lg flex flex-col items-center text-center">
                <span className="text-[10px] uppercase font-bold text-[#2563EB]">Morno</span>
                <span className="text-base font-bold text-[#FFFFFF] mt-0.5">{mornoList.length}</span>
                <span className="text-[10px] text-[#94A3B8]">dúvidas</span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-[#0B132B] border border-[#DC2626]/40 p-2.5 rounded-lg flex flex-col items-center text-center">
                <span className="text-[10px] uppercase font-bold text-[#DC2626] flex items-center gap-1">
                  <Snowflake className="w-3 h-3" />
                  Frio
                </span>
                <span className="text-base font-bold text-[#FFFFFF] mt-0.5">{frioList.length}</span>
                <span className="text-[10px] text-[#94A3B8]">sem retorno</span>
              </div>
            </div>
          </div>

          {/* Filter Option Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
              Escolha quais contatos deseja exportar:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  filterType === 'all'
                    ? 'bg-[#1C2C55] border-[#2563EB] text-[#FFFFFF]'
                    : 'bg-[#0B132B] border-[#263B6E] text-[#94A3B8] hover:text-[#FFFFFF]'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs text-[#FFFFFF]">Toda a base atualizada</div>
                  <div className="text-[11px] text-[#94A3B8]">Todos os status e temperaturas</div>
                </div>
                <span className="font-bold text-xs bg-[#111D3E] px-2 py-0.5 rounded text-[#2563EB]">
                  {total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('today')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  filterType === 'today'
                    ? 'bg-[#1C2C55] border-[#2563EB] text-[#FFFFFF]'
                    : 'bg-[#0B132B] border-[#263B6E] text-[#94A3B8] hover:text-[#FFFFFF]'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs text-[#FFFFFF]">Contatados Hoje</div>
                  <div className="text-[11px] text-[#94A3B8]">Atendimentos feitos na data</div>
                </div>
                <span className="font-bold text-xs bg-[#111D3E] px-2 py-0.5 rounded text-[#2563EB]">
                  {contactedToday.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('pagou')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  filterType === 'pagou'
                    ? 'bg-[#1C2C55] border-[#6E8F5C] text-[#FFFFFF]'
                    : 'bg-[#0B132B] border-[#263B6E] text-[#94A3B8] hover:text-[#FFFFFF]'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs text-[#6E8F5C]">Apenas Alunos que Pagaram</div>
                  <div className="text-[11px] text-[#94A3B8]">Matrículas fechadas</div>
                </div>
                <span className="font-bold text-xs bg-[#111D3E] px-2 py-0.5 rounded text-[#6E8F5C]">
                  {pagouList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('quente_potencial')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  filterType === 'quente_potencial'
                    ? 'bg-[#1C2C55] border-[#B14432] text-[#FFFFFF]'
                    : 'bg-[#0B132B] border-[#263B6E] text-[#94A3B8] hover:text-[#FFFFFF]'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs text-[#FFFFFF]">Quentes & Potenciais</div>
                  <div className="text-[11px] text-[#94A3B8]">Foco em conversão imediata</div>
                </div>
                <span className="font-bold text-xs bg-[#111D3E] px-2 py-0.5 rounded text-[#2563EB]">
                  {quenteList.length + potencialList.length}
                </span>
              </button>
            </div>
          </div>

          {/* WhatsApp Text Report Preview & Copy */}
          <div className="bg-[#0B132B] border border-[#263B6E] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                Resumo Formatado para Enviar no WhatsApp da Equipe
              </span>
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#FFFFFF] bg-[#111D3E] hover:bg-[#1C2C55] px-2.5 py-1 rounded-md border border-[#263B6E] transition-colors cursor-pointer font-semibold"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#6E8F5C]" />
                    <span className="text-[#6E8F5C]">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-[11px] text-[#94A3B8] whitespace-pre-wrap font-sans bg-[#111D3E]/60 p-2.5 rounded-lg border border-[#263B6E]/60 max-h-28 overflow-y-auto leading-relaxed">
              {summaryText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#263B6E] bg-[#0B132B]/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#94A3B8]">
            Selecionado: <strong className="text-[#FFFFFF]">{filteredContacts.length} contatos</strong> ({filterLabel})
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-[#111D3E] hover:bg-[#1C2C55] text-[#FFFFFF] border border-[#263B6E] hover:border-[#2563EB] px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              title="Baixar formato CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar CSV (.csv)
            </button>

            <button
              type="button"
              id="btn-confirm-excel-export"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-[#0B132B] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isExporting ? 'Formatando Planilha Colorida...' : 'Baixar Planilha Excel Colorida (.xlsx)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

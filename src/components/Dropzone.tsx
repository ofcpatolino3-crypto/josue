import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Sparkles, Trash2, Layers, CheckCircle2, UserPlus, Clipboard } from 'lucide-react';
import { parseSpreadsheetBuffer } from '../utils/excel';
import { Contact } from '../types';

interface DropzoneProps {
  onImportRows: (rows: Partial<Contact>[], batchName?: string) => void;
  onClearAll: () => void;
  hasContacts: boolean;
  isAdmin?: boolean;
  onOpenSmartImport?: () => void;
  onOpenAddManual?: () => void;
  onOpenQuickPaste?: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onImportRows,
  onClearAll,
  hasContacts,
  isAdmin = false,
  onOpenSmartImport,
  onOpenAddManual,
  onOpenQuickPaste,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!hasContacts);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseSpreadsheetBuffer(buffer);

        if (result.contacts.length === 0) {
          throw new Error('Nenhum contato válido (com telefone, e-mail ou nome) foi encontrado na planilha.');
        }

        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        onImportRows(result.contacts, fileNameWithoutExt);
      } catch (err: any) {
        console.error('Spreadsheet parse error:', err);
        alert(err.message || 'Não foi possível ler o arquivo. Certifique-se de que é uma planilha válida (.xlsx, .xls ou .csv).');
      }
    };
    reader.onerror = () => {
      alert('Falha ao abrir arquivo do seu computador.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
      e.target.value = ''; // reset
    }
  };

  return (
    <div className="mb-3 flex flex-col gap-2">
      {/* Hidden file input always available */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="hidden"
      />

      {hasContacts && !isExpanded ? (
        /* Compact bar when contacts already exist */
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#172644]/80 border border-[#2B3D63] rounded-lg px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenSmartImport && (
              <button
                type="button"
                onClick={onOpenSmartImport}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#C9A227] to-[#8C6D1F] text-[#101B2D] px-3 py-1 rounded-md font-bold transition-all shadow-sm cursor-pointer hover:brightness-110"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Importador de Planilhas (Com Distribuição)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] px-2.5 py-1 rounded-md font-semibold border border-[#2B3D63] transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#C9A227]" />
              {isAdmin ? 'Importar Planilha Direta' : 'Importar (.xlsx, .csv)'}
            </button>

            {onOpenQuickPaste && (
              <button
                type="button"
                onClick={onOpenQuickPaste}
                className="flex items-center gap-1.5 bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#4ADE80] px-2.5 py-1 rounded-md font-semibold border border-[#22C55E]/40 transition-colors cursor-pointer"
                title="Colar contatos direto (Ctrl+V)"
              >
                <Clipboard className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span>📋 Colar Contatos</span>
              </button>
            )}

            {onOpenAddManual && (
              <button
                type="button"
                onClick={onOpenAddManual}
                className="flex items-center gap-1.5 bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#C9A227] px-2.5 py-1 rounded-md font-semibold border border-[#2B3D63] transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>+ Novo Manual</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-[#8C98B4] hover:text-[#EDE6D6] underline text-[11px] cursor-pointer"
            >
              Abrir área de arrastar
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Tem certeza que deseja apagar todos os contatos da lista?')) {
                  onClearAll();
                }
              }}
              className="text-[#8C98B4] hover:text-[#B14432] flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
            >
              <Trash2 className="w-3 h-3" />
              Limpar base
            </button>
          </div>
        </div>
      ) : (
        /* Full Dropzone Area */
        <>
          <div
            id="dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-xl border-1.5 border-dashed transition-all cursor-pointer bg-[#172644] ${
              isDragging
                ? 'border-[#C9A227] bg-[#1F3057]'
                : 'border-[#2B3D63] hover:border-[#C9A227]/70'
            }`}
          >
            <div className="flex items-start gap-3.5 text-center sm:text-left">
              <div className="w-10 h-10 rounded-lg bg-[#1F3057] text-[#C9A227] flex items-center justify-center shrink-0 mt-0.5 border border-[#2B3D63]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#EDE6D6] flex items-center justify-center sm:justify-start gap-2">
                  {isAdmin
                    ? 'Importar planilha para distribuir à equipe (.xlsx, .xls, .csv)'
                    : 'Importar planilha (.xlsx, .xls, .csv)'}
                  <UploadCloud className="w-4 h-4 text-[#8C98B4]" />
                </div>
                <div className="text-xs text-[#8C98B4] mt-1 leading-relaxed">
                  ✓ Reconhecimento automático em <strong className="text-[#EDE6D6]">qualquer ordem de colunas</strong>: Nome, WhatsApp, E-mail, Curso, Temperatura, Datas, Observações.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenSmartImport && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSmartImport();
                  }}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-[#C9A227] to-[#8C6D1F] hover:brightness-110 text-[#101B2D] font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition-all shadow-md cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Importador com Distribuição</span>
                </button>
              )}

              <button
                type="button"
                id="dz-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] hover:text-[#C9A227] font-bold text-xs sm:text-sm px-4 py-2 rounded-lg border border-[#2B3D63] transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                Escolher Planilha
              </button>

              {onOpenQuickPaste && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenQuickPaste();
                  }}
                  className="flex items-center gap-1.5 bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#4ADE80] font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg border border-[#22C55E]/40 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  title="Colar contatos do WhatsApp, Excel ou texto (Ctrl+V)"
                >
                  <Clipboard className="w-4 h-4 text-[#4ADE80]" />
                  <span>📋 Colar Contatos (Ctrl+V)</span>
                </button>
              )}

              {onOpenAddManual && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAddManual();
                  }}
                  className="flex items-center gap-1.5 bg-[#172644] hover:bg-[#1F3057] text-[#EDE6D6] hover:text-[#C9A227] font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg border border-[#2B3D63] transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4 text-[#C9A227]" />
                  <span>+ Novo Manual</span>
                </button>
              )}
            </div>
          </div>

          {/* Auxiliary bar */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-3">
              {hasContacts && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-[#8C98B4] hover:text-[#EDE6D6] text-[11px] cursor-pointer"
                >
                  Ocultar área
                </button>
              )}
            </div>

            {hasContacts && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Tem certeza que deseja apagar todos os contatos?')) {
                    onClearAll();
                  }
                }}
                className="text-[#8C98B4] hover:text-[#B14432] flex items-center gap-1 cursor-pointer transition-colors py-0.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar todos os contatos
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

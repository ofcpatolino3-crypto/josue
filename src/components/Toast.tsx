import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<Props> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        const isErr = toast.type === 'error';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-lg border shadow-xl backdrop-blur-md transition-all duration-200 ${
              isErr
                ? 'bg-[#172644]/95 border-[#B14432] text-[#EDE6D6]'
                : isInfo
                ? 'bg-[#172644]/95 border-[#5C7A9E] text-[#EDE6D6]'
                : 'bg-[#172644]/95 border-[#6E8F5C] text-[#EDE6D6]'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isErr ? (
                <AlertCircle className="w-5 h-5 text-[#B14432] shrink-0 mt-0.5" />
              ) : isInfo ? (
                <Info className="w-5 h-5 text-[#5C7A9E] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#6E8F5C] shrink-0 mt-0.5" />
              )}
              <div className="text-xs sm:text-sm font-medium leading-snug">{toast.text}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#8C98B4] hover:text-[#EDE6D6] p-0.5 transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

import React from 'react';
import { AlertTriangle, CheckCircle, Info, X, ShieldAlert } from 'lucide-react';

interface CustomModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  confirmText = 'موافق',
  cancelText = 'إلغاء',
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-emerald-600" />;
      case 'error':
        return <ShieldAlert className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      default:
        return <Info className="w-6 h-6 text-sky-600" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-sky-50 text-sky-800 border-sky-200';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in select-none"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-2xl border ${getBgColor()}`}>
              {getIcon()}
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 text-slate-700 dark:text-slate-300 text-xs font-semibold leading-relaxed whitespace-pre-line">
          {message}
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          {onConfirm && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-white font-bold shadow-sm transition-all cursor-pointer text-xs ${
              type === 'error' || type === 'warning'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-sky-700 hover:bg-sky-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

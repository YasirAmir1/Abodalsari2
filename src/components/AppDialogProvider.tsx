import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

type DialogKind = 'alert' | 'confirm';
type DialogType = 'success' | 'warning' | 'error' | 'info';

type DialogRequest = {
  id: number;
  kind: DialogKind;
  title: string;
  message: string;
  type?: DialogType;
};

interface AppDialogContextValue {
  showAlert: (message: string, title?: string, type?: DialogType) => void;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export const useAppDialogs = () => {
  const context = useContext(AppDialogContext);
  if (!context) throw new Error('useAppDialogs must be used inside AppDialogProvider');
  return context;
};

export const AppDialogProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [dialogs, setDialogs] = useState<DialogRequest[]>([]);
  const nextId = useRef(0);
  const confirmResolvers = useRef(new Map<number, (confirmed: boolean) => void>());

  const showAlert = useCallback((message: string, title = 'تنبيه', type?: DialogType) => {
    const id = ++nextId.current;
    // Auto-detect type if not provided
    let detectedType: DialogType = type || 'info';
    if (!type) {
      const combined = `${title} ${message}`.toLowerCase();
      if (combined.includes('نجاح') || combined.includes('تم ') || combined.includes('تمت')) {
        detectedType = 'success';
      } else if (combined.includes('خطأ') || combined.includes('فشل') || combined.includes('تعذر')) {
        detectedType = 'error';
      } else if (combined.includes('تحذير') || combined.includes('تنبيه')) {
        detectedType = 'warning';
      }
    }
    setDialogs((current) => [...current, { id, kind: 'alert', title, message, type: detectedType }]);
  }, []);

  const showConfirm = useCallback((message: string, title = 'تأكيد الإجراء') => new Promise<boolean>((resolve) => {
    const id = ++nextId.current;
    confirmResolvers.current.set(id, resolve);
    setDialogs((current) => [...current, { id, kind: 'confirm', title, message, type: 'warning' }]);
  }), []);

  const activeDialog = dialogs[0];
  const completeDialog = useCallback((dialog: DialogRequest, confirmed: boolean) => {
    setDialogs((current) => current.filter((item) => item.id !== dialog.id));
    const resolve = confirmResolvers.current.get(dialog.id);
    if (resolve) {
      confirmResolvers.current.delete(dialog.id);
      resolve(confirmed);
    }
  }, []);

  useEffect(() => {
    if (!activeDialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') completeDialog(activeDialog, false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog, completeDialog]);

  const renderIcon = (dialog: DialogRequest) => {
    if (dialog.kind === 'confirm') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    switch (dialog.type) {
      case 'success':
        return (
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case 'error':
        return (
          <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  const content = activeDialog ? (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs select-none"
      onMouseDown={() => completeDialog(activeDialog, false)}
    >
      <section
        role={activeDialog.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`app-dialog-title-${activeDialog.id}`}
        aria-describedby={`app-dialog-message-${activeDialog.id}`}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {renderIcon(activeDialog)}
            <h2 id={`app-dialog-title-${activeDialog.id}`} className="text-base font-black text-slate-900 dark:text-white">
              {activeDialog.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => completeDialog(activeDialog, false)}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p id={`app-dialog-message-${activeDialog.id}`} className="py-5 whitespace-pre-wrap break-words text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-300">
          {activeDialog.message}
        </p>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          {activeDialog.kind === 'confirm' && (
            <button
              type="button"
              onClick={() => completeDialog(activeDialog, false)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              إلغاء
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => completeDialog(activeDialog, true)}
            className={`rounded-xl px-5 py-2 text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${
              activeDialog.kind === 'confirm'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-sky-800 hover:bg-sky-900'
            }`}
          >
            {activeDialog.kind === 'confirm' ? 'تأكيد' : 'حسنًا'}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <AppDialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {typeof document !== 'undefined' && content ? createPortal(content, document.body) : null}
    </AppDialogContext.Provider>
  );
};

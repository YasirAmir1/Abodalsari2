import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DialogRequest = {
  id: number;
  kind: 'alert' | 'confirm';
  title: string;
  message: string;
};

interface AppDialogContextValue {
  showAlert: (message: string, title?: string) => void;
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

  const showAlert = useCallback((message: string, title = 'تنبيه') => {
    const id = ++nextId.current;
    setDialogs((current) => [...current, { id, kind: 'alert', title, message }]);
  }, []);

  const showConfirm = useCallback((message: string, title = 'تأكيد الإجراء') => new Promise<boolean>((resolve) => {
    const id = ++nextId.current;
    confirmResolvers.current.set(id, resolve);
    setDialogs((current) => [...current, { id, kind: 'confirm', title, message }]);
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

  const content = activeDialog ? (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={() => completeDialog(activeDialog, false)}
    >
      <section
        role={activeDialog.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`app-dialog-title-${activeDialog.id}`}
        aria-describedby={`app-dialog-message-${activeDialog.id}`}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        dir="rtl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={`app-dialog-title-${activeDialog.id}`} className="text-lg font-black text-slate-900 dark:text-white">
          {activeDialog.title}
        </h2>
        <p id={`app-dialog-message-${activeDialog.id}`} className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600 dark:text-slate-300">
          {activeDialog.message}
        </p>
        <div className="mt-6 flex justify-start gap-2">
          {activeDialog.kind === 'confirm' && (
            <button
              type="button"
              autoFocus
              onClick={() => completeDialog(activeDialog, false)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
          )}
          <button
            type="button"
            autoFocus={activeDialog.kind === 'alert'}
            onClick={() => completeDialog(activeDialog, true)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors ${
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

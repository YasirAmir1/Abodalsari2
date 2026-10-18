import React, { useState } from 'react';
import { AlertTriangle, Trash2, ShieldAlert, CheckSquare, X } from 'lucide-react';

interface DeleteAllSubscribersModalProps {
  subscribersCount: number;
  onClose: () => void;
  onConfirmDeleteAll: () => void;
}

export const DeleteAllSubscribersModal: React.FC<DeleteAllSubscribersModalProps> = ({
  subscribersCount,
  onClose,
  onConfirmDeleteAll
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isValidInput =
    confirmationInput.trim().toUpperCase() === 'DELETE' ||
    confirmationInput.trim() === 'حذف' ||
    confirmationInput.trim() === '1234';

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isChecked) {
      setErrorMsg('يرجى الموافقة على الإقرار قبل المتابعة');
      return;
    }
    if (!isValidInput) {
      setErrorMsg('رمز التأكيد غير صحيح. اكتب DELETE أو حذف أو 1234');
      return;
    }
    onConfirmDeleteAll();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-red-200 dark:border-red-900/60 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-red-100 dark:border-red-950">
          <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
            <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/80 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                حذف جميع المشتركين (تصفير شامل)
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-0.5">
                تنبيه أمني عالي الخطورة - إجراء إداري نهائي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Impact Warning Banner */}
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-red-900 dark:text-red-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>إجمالي المشتركين المشمولين بالتصفير:</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-red-600 text-white font-extrabold text-xs font-mono shadow-xs">
              {subscribersCount} مشترك
            </span>
          </div>

          <div className="text-xs text-red-800 dark:text-red-300 space-y-1.5 pt-2 border-t border-red-200/60 dark:border-red-900/60 leading-relaxed font-medium">
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>حذف الدائم بالقواعد (Database Persistence):</strong> سيتم مسح كافة سجلات المشتركين بشكل كامل ولن تظهر حتى عند إعادة تحميل الصفحة.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>تصفير الوكلاء والديون (Cascade Clean):</strong> سيتم تحديث وتصفير عدادات الوكلاء والديون المرتبطة فوراً عبر كل المستويات.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>إلغاء الجلسات والرموز:</strong> إلغاء ربط الأجهزة المخصصة وإبطال كافة رموز الاستجابة السريعة (QR) النشطة.</span>
            </div>
          </div>
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleConfirm} className="mt-5 space-y-4 text-xs">
          {/* Step 1 Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                setIsChecked(e.target.checked);
                if (e.target.checked) setErrorMsg('');
              }}
              className="mt-0.5 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
            />
            <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug">
              أقر بصفتي مديراً للمنظومة بأنني أريد حذف جميع المشتركين نهائياً، وأدرك تماماً أنه لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
            </span>
          </label>

          {/* Step 2 Typing DELETE */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              للتأكيد، يرجى كتابة <span className="font-mono text-red-600 dark:text-red-400 font-black bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-200">DELETE</span> أو <span className="font-bold text-red-600 dark:text-red-400 font-black bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-200">حذف</span> أو الرمز <span className="font-mono text-red-600 dark:text-red-400 font-black bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-200">1234</span>:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => {
                setConfirmationInput(e.target.value);
                setErrorMsg('');
              }}
              placeholder="اكتب DELETE أو حذف أو 1234 هنا..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 font-mono text-sm"
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="text-red-600 dark:text-red-400 font-bold text-xs bg-red-50 dark:bg-red-950/80 p-2.5 rounded-xl border border-red-200 dark:border-red-900/80 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={!isChecked || !isValidInput}
              className={`px-5 py-2.5 rounded-xl text-white font-extrabold flex items-center gap-2 shadow-md transition-all ${
                isChecked && isValidInput
                  ? 'bg-red-600 hover:bg-red-700 cursor-pointer active:scale-95'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>تأكيد الحذف الشامل والنهائي</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

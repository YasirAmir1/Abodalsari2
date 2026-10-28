import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Subscriber } from '../types';

interface DeactivateSubscriberModalProps {
  subscriber: Subscriber;
  onClose: () => void;
  onConfirmDeactivate: (subscriberId: string) => void;
}

export const DeactivateSubscriberModal: React.FC<DeactivateSubscriberModalProps> = ({
  subscriber,
  onClose,
  onConfirmDeactivate
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full my-auto p-3.5 sm:p-5 shadow-2xl border border-red-200 dark:border-red-900/60 max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-y-auto overscroll-contain animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-red-100 dark:border-red-950">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-sm sm:text-base">
            <span className="text-lg">⚠️</span>
            <span>تأكيد إلغاء تفعيل اشتراك المشترك</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Subscriber Summary Box */}
        <div className="mt-2.5 sm:mt-3 p-2.5 sm:p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">اسم المشترك:</span>
            <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">{subscriber.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">رقم الجهاز:</span>
            <span className="font-mono font-bold text-sky-800 dark:text-sky-300">{subscriber.deviceId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">الحالة الحالية:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
              فعال
            </span>
          </div>
        </div>

        {/* Warning Card with Red Border */}
        <div className="mt-2.5 sm:mt-3 p-2.5 sm:p-3 rounded-xl bg-red-50/70 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 text-xs">
          <h4 className="font-black text-red-800 dark:text-red-200 text-xs sm:text-[13px] mb-1.5">
            هل أنت متأكد من رغبتك في إطفاء وإلغاء تفعيل اشتراك هذا المشترك؟
          </h4>
          <ul className="space-y-1 text-slate-700 dark:text-slate-300 leading-snug font-medium text-[11px] sm:text-xs">
            <li className="flex items-start gap-1.5">
              <span className="text-red-500 font-bold">•</span>
              <span>تحويل حالة الاشتراك إلى <strong className="text-red-700 dark:text-red-300 font-bold">غير فعال</strong> في قاعدة البيانات والنظام فوراً.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-red-500 font-bold">•</span>
              <span>تصفير ومسح حقول تاريخ التجديد وتاريخ البدء والانتهاء.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-red-500 font-bold">•</span>
              <span>تصفير ومسح كافة بيانات ومبالغ وطرق الدفع الخاصة بالاشتراك.</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 sm:mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
          <button
            onClick={() => onConfirmDeactivate(subscriber.id)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black shadow-md transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <span>❌ تأكيد إلغاء التفعيل وتفريغ البيانات</span>
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors cursor-pointer text-xs"
          >
            تراجع وإلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

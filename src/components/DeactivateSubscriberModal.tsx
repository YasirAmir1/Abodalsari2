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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
        {/* Header matching Screenshot 4 */}
        <div className="flex items-center justify-between pb-3 border-b border-red-100">
          <div className="flex items-center gap-2 text-red-600 font-black text-base">
            <span className="text-xl">⚠️</span>
            <span>تأكيد إلغاء تفعيل اشتراك المشترك</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subscriber Summary Box matching Screenshot 4 */}
        <div className="mt-4 p-4 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">اسم المشترك:</span>
            <span className="font-extrabold text-slate-900 text-sm">{subscriber.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">رقم الجهاز:</span>
            <span className="font-mono font-bold text-sky-800">{subscriber.deviceId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">الحالة الحالية:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              فعال
            </span>
          </div>
        </div>

        {/* Warning Card with Red Border matching Screenshot 4 */}
        <div className="mt-4 p-4 rounded-2xl bg-red-50/60 border-2 border-red-200 text-xs">
          <h4 className="font-black text-red-800 text-sm mb-3">
            هل أنت متأكد من رغبتك في إطفاء وإلغاء تفعيل اشتراك هذا المشترك؟
          </h4>
          <ul className="space-y-2 text-slate-700 leading-relaxed font-medium">
            <li className="flex items-start gap-1.5">
              <span className="text-red-500 font-bold">•</span>
              <span>تحويل حالة الاشتراك إلى <strong className="text-red-700 font-bold">غير فعال</strong> في قاعدة البيانات والنظام فوراً.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-red-500 font-bold">•</span>
              <span>تصفير (مسح) حقول تاريخ التجديد وتاريخ البدء وتاريخ التفعيل.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-red-500 font-bold">•</span>
              <span>تصفير (مسح) حقول تاريخ الانتهاء والاستحقاق.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-red-500 font-bold">•</span>
              <span>تصفير (مسح) كافة بيانات ومبالغ وطرق الدفع الخاصة بالاشتراك.</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons matching Screenshot 4 */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={() => onConfirmDeactivate(subscriber.id)}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>❌ تأكيد إلغاء التفعيل وتفريغ البيانات</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
          >
            تراجع وإلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { Subscriber } from '../types';

interface DeleteSubscriberModalProps {
  subscriber: Subscriber;
  onClose: () => void;
  onConfirmDelete: (subscriberId: string) => void;
}

export const DeleteSubscriberModal: React.FC<DeleteSubscriberModalProps> = ({
  subscriber,
  onClose,
  onConfirmDelete
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-red-100">
          <div className="flex items-center gap-2 text-red-600 font-black text-base">
            <Trash2 className="w-5 h-5" />
            <span>تأكيد الحذف النهائي للمشترك</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subscriber Summary */}
        <div className="mt-4 p-4 rounded-2xl bg-red-50/50 border border-red-100 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">اسم المشترك:</span>
            <span className="font-extrabold text-slate-900 text-sm">{subscriber.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">رقم الجهاز:</span>
            <span className="font-mono font-bold text-sky-800">{subscriber.deviceId}</span>
          </div>
        </div>

        {/* Warning Card */}
        <div className="mt-4 p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-xs">
          <h4 className="font-black text-red-800 text-sm mb-2">
            ⚠️ هل أنت متأكد تماماً من رغبتك في حذف المشترك بشكل نهائي؟
          </h4>
          <p className="text-slate-700 leading-relaxed font-medium">
            سيتم مسح المشترك وجميع بياناته ومعاملاته (اشتراكات، فواتير، ديون) من النظام وقاعدة البيانات بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={() => onConfirmDelete(subscriber.id)}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>🗑️ نعم، حذف المشترك نهائياً</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
          >
            تراجع وإلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

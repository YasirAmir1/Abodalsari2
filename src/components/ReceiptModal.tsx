import React from 'react';
import { Printer, Radio, QrCode, CheckCircle2, Tv } from 'lucide-react';
import { Invoice } from '../types';

interface ReceiptModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ invoice, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 no-print">
          <h3 className="font-extrabold text-sm text-slate-800">معاينة وصل القبض والاشتراك</h3>
          <button onClick={onClose} className="text-slate-400 p-1">
            ✕
          </button>
        </div>

        {/* Printable Thermal Receipt Card */}
        <div id="thermal-receipt" className="p-4 my-2 border-2 border-dashed border-slate-300 rounded-2xl bg-white text-slate-900 text-xs">
          {/* Header */}
          <div className="text-center pb-3 border-b border-slate-200">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Radio className="w-5 h-5 text-sky-800" />
              <h2 className="font-black text-base text-slate-900">شركة الساري للبث الأرضي</h2>
            </div>
            <p className="text-[10px] text-slate-600 font-bold">
              الوكيل المعتمد لقنوات الرابعة الرياضية - صلاح الدين
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
              هاتف الإدارة: 07726218685 | العلم - فلكة البورصة
            </p>
          </div>

          {/* Receipt Info */}
          <div className="py-3 space-y-1.5 border-b border-slate-200 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">رقم الوصل:</span>
              <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">التاريخ:</span>
              <span className="font-mono text-slate-700">{invoice.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">اسم المشترك:</span>
              <span className="font-bold text-slate-900">{invoice.subscriberName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">رقم الجهاز / السيريال:</span>
              <span className="font-mono font-bold text-sky-900">{invoice.deviceId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">الوكيل المعتمد:</span>
              <span className="font-semibold text-slate-800">{invoice.agentName}</span>
            </div>
          </div>

          {/* Service Details */}
          <div className="py-3 border-b border-slate-200 space-y-1">
            <div className="flex justify-between font-bold text-xs">
              <span>نوع الخدمة:</span>
              <span>{invoice.packageType}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">المبلغ الإجمالي:</span>
              <span className="font-mono font-bold">{invoice.amount.toLocaleString()} د.ع</span>
            </div>
            <div className="flex justify-between text-[11px] text-emerald-700 font-bold">
              <span>المدفوع نقدياً:</span>
              <span className="font-mono">{invoice.paidAmount.toLocaleString()} د.ع</span>
            </div>
            {invoice.remainingAmount > 0 && (
              <div className="flex justify-between text-[11px] text-red-600 font-bold">
                <span>المتبقي في الذمة:</span>
                <span className="font-mono">{invoice.remainingAmount.toLocaleString()} د.ع</span>
              </div>
            )}
          </div>

          {/* Footer QR & Stamp */}
          <div className="pt-3 flex items-center justify-between">
            <div className="p-1 border border-slate-200 rounded-lg">
              <QrCode className="w-12 h-12 text-slate-800" />
            </div>
            <div className="text-left text-[9px] text-slate-400">
              <div className="font-bold text-slate-700">ختم وتوقيع الوكيل المعتمد</div>
              <div className="mt-4 border-b border-slate-400 w-24"></div>
              <div className="mt-1">نظام الساري الرسمي</div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex items-center justify-end gap-2 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
          >
            إغلاق
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الوصل</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, MessageSquare, X, Check } from 'lucide-react';
import { Invoice } from '../types';

interface InvoiceSuccessModalProps {
  invoice: Invoice;
  startDate: string;
  endDate: string;
  phone?: string;
  onClose: () => void;
  onWhatsApp: (phone: string, text: string) => void;
}

export const InvoiceSuccessModal: React.FC<InvoiceSuccessModalProps> = ({
  invoice,
  startDate,
  endDate,
  phone = '',
  onClose,
  onWhatsApp
}) => {
  const handleDownload = () => {
    const svgElement = document.getElementById('success-invoice-qr-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_QR_${invoice.deviceId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendWhatsApp = () => {
    const text = `🎉 تم بنجاح تجديد اشتراكك في شبكة الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية!
المشترك: ${invoice.subscriberName}
رقم الجهاز: ${invoice.deviceId}
قيمة الفاتورة: ${invoice.amount.toLocaleString()} د.ع
تاريخ البدء: ${startDate}
تاريخ الانتهاء: ${endDate}
شكراً لاختياركم شبكة الساري.`;
    onWhatsApp(phone, text);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
        {/* Header matching Screenshot 5 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-800 font-black text-base">
            <span className="text-xl">🎉</span>
            <span>تم تسجيل الفاتورة بنجاح</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details Card matching Screenshot 5 */}
        <div className="mt-4 p-4 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500">اسم المشترك: </span>
              <span className="font-extrabold text-slate-900">{invoice.subscriberName}</span>
            </div>
            <div>
              <span className="text-slate-500">نوع البيع: </span>
              <span className="font-bold text-sky-800">{invoice.packageType}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500">كود الجهاز: </span>
              <span className="font-mono font-bold text-sky-900">{invoice.deviceId}</span>
            </div>
            <div>
              <span className="text-slate-500">قيمة الفاتورة: </span>
              <span className="font-black text-sky-950 font-mono">{invoice.amount.toLocaleString()} د.ع</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-200/60 text-[11px]">
            <div>
              <span className="text-slate-500">تاريخ البدء: </span>
              <span className="font-mono text-slate-700">{startDate}</span>
            </div>
            <div>
              <span className="text-slate-500">تاريخ الانتهاء: </span>
              <span className="font-mono font-bold text-slate-900">{endDate}</span>
            </div>
          </div>
        </div>

        {/* QR Code Container matching Screenshot 5 */}
        <div className="my-5 flex flex-col items-center text-center">
          <div className="font-bold text-slate-700 text-xs mb-3">
            📱 QR Code لرقم الجهاز ({invoice.deviceId}):
          </div>

          <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-sm">
            <QRCodeSVG
              id="success-invoice-qr-svg"
              value={invoice.deviceId}
              size={170}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="text-[11px] text-slate-400 mt-3 font-medium">
            يمكن مسح هذا الرمز ضوئياً للوصول الفوري لرقم الجهاز وتفاصيل المشترك
          </div>
        </div>

        {/* Bottom Actions matching Screenshot 5 */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {/* Left in RTL */}
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-sky-900 hover:bg-sky-800 text-white rounded-xl font-black shadow-sm transition-colors"
          >
            تم
          </button>

          {/* Right in RTL */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <Download className="w-4 h-4 text-sky-700" />
              <span>تحميل</span>
            </button>

            <button
              onClick={handleSendWhatsApp}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <MessageSquare className="w-4 h-4 fill-emerald-100" />
              <span>واتساب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

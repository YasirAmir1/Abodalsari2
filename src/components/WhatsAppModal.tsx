import React, { useState } from 'react';
import { MessageSquare, Send, Copy, ExternalLink, Sparkles, Check } from 'lucide-react';
import { Subscriber } from '../types';
import { storageService } from '../services/storageService';

interface WhatsAppModalProps {
  subscriber: Subscriber;
  initialTemplate?: 'renew' | 'reminder' | 'debt' | 'custom';
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ subscriber, initialTemplate, onClose }) => {
  const isDebt = subscriber.paymentStatus === 'debt' || subscriber.paymentStatus === 'partial';
  const defaultType = initialTemplate || (isDebt ? 'debt' : 'renew');
  const [templateType, setTemplateType] = useState<'renew' | 'reminder' | 'debt' | 'custom'>(defaultType);
  const [copied, setCopied] = useState(false);

  const defaultTemplates = {
    renew: `عزيزي المشترك (${subscriber.name})،
تم بنجاح تفعيل / تجديد اشتراكك في باقة قنوات الرابعة الرياضية عبر شبكة الساري للبث الأرضي.

📺 رقم الجهاز: ${subscriber.deviceId}
📦 نوع الباقة: ${subscriber.subscriptionType}
📅 تاريخ الانتهاء: ${subscriber.endDate}
💰 المبلغ: ${subscriber.amount.toLocaleString()} د.ع

شكراً لثقتكم بشبكة الساري - وكيل قنوات الرابعة في صلاح الدين.
لأي استفسار: هاتف الإدارة: 07726218685`,

    reminder: `عزيزي المشترك (${subscriber.name})،
نود تذكيرك بأن اشتراكك في شبكة الساري للبث الأرضي وقنوات الرابعة الرياضية سينتهي بتاريخ (${subscriber.endDate}).

لتفادي انقطاع البث والمباريات، يرجى التجديد عبر زيارة المركز أو أقرب وكيل معتمد في منطقتك.
رقم الجهاز: ${subscriber.deviceId}

لأي استفسار: هاتف الإدارة: 07726218685`,

    debt: `عزيزي المشترك (${subscriber.name})،
تحية طيبة من شركة الساري للبث الأرضي.
يرجى التفضل بمراجعة المركز أو الوكيل لتسديد المبلغ المستحق بذمتكم والبالغ (${subscriber.amount.toLocaleString()} د.ع) الخاص باشتراك جهازك (${subscriber.deviceId}).

شاكرين حسن تعاونكم معنا.
لأي استفسار: هاتف الإدارة: 07726218685`,

    custom: `مرحباً بك أستاذ ${subscriber.name}، بخصوص جهاز البث الأرضي رقم (${subscriber.deviceId})...\n\nلأي استفسار: هاتف الإدارة: 07726218685`
  };

  const [messageText, setMessageText] = useState(defaultTemplates[defaultType]);

  const handleSelectTemplate = (type: 'renew' | 'reminder' | 'debt' | 'custom') => {
    setTemplateType(type);
    setMessageText(defaultTemplates[type]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const link = storageService.createWhatsAppLink(subscriber.phone, messageText);
    window.open(link, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full my-auto p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-700">
            <MessageSquare className="w-5 h-5 fill-emerald-100" />
            <h3 className="font-extrabold text-base">إرسال إشعار واتساب للمشترك</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 p-1">
            ✕
          </button>
        </div>

        {/* Subscriber Info Chip */}
        <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-slate-900">{subscriber.name}</div>
            <div className="text-slate-500 font-mono">الهاتف: {subscriber.phone || 'غير مسجل'}</div>
          </div>
          <div className="text-left font-mono font-bold text-sky-800">
            جهاز: {subscriber.deviceId}
          </div>
        </div>

        {/* Quick Templates Buttons */}
        <div className="mt-4">
          <label className="block font-bold text-slate-700 text-xs mb-1.5">اختر نموذج الرسالة السريعة:</label>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => handleSelectTemplate('renew')}
              className={`p-2 rounded-xl border font-bold text-center transition-all ${
                templateType === 'renew'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              🎉 تأكيد التجديد
            </button>
            <button
              type="button"
              onClick={() => handleSelectTemplate('reminder')}
              className={`p-2 rounded-xl border font-bold text-center transition-all ${
                templateType === 'reminder'
                  ? 'bg-amber-50 border-amber-500 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              ⏳ قرب الانتهاء
            </button>
            <button
              type="button"
              onClick={() => handleSelectTemplate('debt')}
              className={`p-2 rounded-xl border font-bold text-center transition-all ${
                templateType === 'debt'
                  ? 'bg-red-50 border-red-500 text-red-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              💳 تذكير بالسداد
            </button>
          </div>
        </div>

        {/* Message Editor */}
        <div className="mt-4">
          <label className="block font-bold text-slate-700 text-xs mb-1">نص الرسالة المرسلة:</label>
          <textarea
            rows={7}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="w-full p-3 rounded-2xl border border-slate-300 text-xs text-slate-800 leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ النص' : 'نسخ الرسالة'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
            >
              إلغاء
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2 shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>إرسال عبر واتساب الآن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

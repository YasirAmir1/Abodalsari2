import React, { useState } from 'react';
import {
  Tv,
  Users,
  CreditCard,
  PlusCircle,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Send,
  Package,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Agent, PendingRenewalRequest, PricingRow, Product, Subscriber, SubscriptionDuration } from '../types';
import { getPriceByDuration } from '../utils/pricingUtils';

const SubscriberDetail: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({
  label,
  value,
  className = ''
}) => (
  <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 ${className}`}>
    <dt className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</dt>
    <dd dir="auto" className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold text-slate-800 dark:text-slate-200">
      {value ?? '—'}
    </dd>
  </div>
);

interface AgentPortalViewProps {
  currentAgent: Agent;
  subscribers: Subscriber[];
  products: Product[];
  pricing: PricingRow[];
  onSubmitRenewalOrder: (order: Omit<PendingRenewalRequest, 'id' | 'status'>) => void;
  onOpenWhatsApp: (sub: Subscriber) => void;
  onUpdateBranding: (agentId: string, branding: Partial<Agent>) => void;
  onSelectDeviceQr?: (deviceId: string, subscriberName?: string, agentName?: string) => void;
}

export const AgentPortalView: React.FC<AgentPortalViewProps> = ({
  currentAgent,
  subscribers,
  products,
  pricing,
  onSubmitRenewalOrder,
  onOpenWhatsApp,
  onUpdateBranding,
  onSelectDeviceQr
}) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderSentToast, setOrderSentToast] = useState(false);
  const [expandedSubscriberId, setExpandedSubscriberId] = useState<string | null>(null);

  // Order form state
  const [selectedSubId, setSelectedSubId] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [showSubSuggestions, setShowSubSuggestions] = useState(false);
  const [orderDuration, setOrderDuration] = useState<SubscriptionDuration>('1 شهر');
  const [orderNotes, setOrderNotes] = useState('');

  // Agent's subscribers
  const agentSubs = subscribers.filter(
    (s) => s.agentId === currentAgent.id || s.agentName === currentAgent.name
  );

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    let sub = agentSubs.find((s) => s.id === selectedSubId);
    if (!sub && subSearchQuery.trim()) {
      sub = agentSubs.find((s) => s.name.toLowerCase().includes(subSearchQuery.toLowerCase()) || s.deviceId === subSearchQuery);
    }
    if (!sub) {
      alert('يرجى اختيار أو كتابة اسم مشترك صحيح التابع لوكالتك');
      return;
    }

    const price = getPriceByDuration(currentAgent.id, orderDuration, pricing);

    const rawDev = (sub.deviceId || '').trim();
    const finalDev = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';

    onSubmitRenewalOrder({
      subscriberId: sub.id,
      subscriberName: sub.name,
      deviceId: finalDev,
      subscriberPhone: sub.phone,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      duration: orderDuration,
      amount: price,
      requestDate: new Date().toISOString().split('T')[0],
      notes: orderNotes
    });

    setShowOrderModal(false);
    setSelectedSubId('');
    setSubSearchQuery('');
    setOrderNotes('');
    setOrderSentToast(true);
    setTimeout(() => setOrderSentToast(false), 4000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Agent Brand Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-2xl flex items-center justify-center shadow-lg">
            {currentAgent.avatarInitials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-400 text-slate-900 font-extrabold px-2.5 py-0.5 rounded-full">
                وكيل رسمي معتمد
              </span>
              <span className="text-xs text-sky-200 font-mono font-bold">{currentAgent.code}</span>
            </div>
            <h2 className="text-2xl font-black mt-1">
              {currentAgent.customShopName || currentAgent.name}
            </h2>
            <p className="text-xs text-sky-200 mt-0.5">
              وكيل قنوات الرابعة الرياضية - {currentAgent.region} | هاتف: {currentAgent.phone}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowOrderModal(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ طلب تجديد إلكتروني فوري</span>
          </button>
        </div>
      </div>

      {/* 4 Agent Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي مبيعات الوكالة</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {currentAgent.totalSales.toLocaleString()} <span className="text-xs font-bold text-slate-400">د.ع</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">مبيعات تراكمية موثقة</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">المبلغ المسدد للمركز</div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-2 font-mono">
            {currentAgent.totalPaid.toLocaleString()} <span className="text-xs font-bold text-emerald-400">د.ع</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">حسابات مقبوضة</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">الرصيد المتبقي بذمتك (الديون)</div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-2 font-mono">
            {currentAgent.totalDebt.toLocaleString()} <span className="text-xs font-bold text-red-400">د.ع</span>
          </div>
          <div className="text-[11px] text-red-500 mt-1">
            {currentAgent.totalDebt > 0 ? 'مستحق السداد للمركز' : 'الحساب خالص'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">المشتركون التابعون لوكالتك</div>
          <div className="text-2xl font-black text-sky-800 dark:text-sky-400 mt-2 font-mono">
            {agentSubs.length} <span className="text-xs font-bold text-slate-400">مشترك</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {agentSubs.filter((s) => s.status === 'active').length} فعال حالياً
          </div>
        </div>
      </div>

      {/* Agent's Subscribers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">مشتركو باقات الرابعة التابعون لمكتبك</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              بيانات المشتركين المسجلين لهذا الوكيل، وتتحدث تلقائياً عند تعديلها من لوحة الإدارة
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3 px-4">اسم المشترك</th>
                <th className="py-3 px-3">رقم الجهاز</th>
                <th className="py-3 px-3">الهاتف</th>
                <th className="py-3 px-3">نوع الباقة</th>
                <th className="py-3 px-3">المبلغ</th>
                <th className="py-3 px-3">حالة البث</th>
                <th className="py-3 px-3">تاريخ الانتهاء</th>
                <th className="py-3 px-4 text-center">التفاصيل والإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {agentSubs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا يوجد مشتركون مسجلون لهذا الوكيل حالياً.
                  </td>
                </tr>
              ) : (
                agentSubs.map((sub) => {
                  const isExpanded = expandedSubscriberId === sub.id;
                  const statusLabel = sub.status === 'active'
                    ? 'فعال'
                    : sub.status === 'expiring_soon'
                      ? 'قريب الانتهاء'
                      : 'غير فعال';
                  const paymentStatusLabel = sub.paymentStatus === 'paid'
                    ? 'مسدد'
                    : sub.paymentStatus === 'partial'
                      ? 'دفع جزئي'
                      : sub.paymentStatus === 'debt'
                        ? 'دين'
                        : 'غير محدد';

                  return (
                    <React.Fragment key={sub.id}>
                      <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{sub.name || '—'}</td>
                        <td className="py-3 px-3 font-mono">
                          <button
                            onClick={() => onSelectDeviceQr && onSelectDeviceQr(sub.deviceId, sub.name, currentAgent.name)}
                            className="font-bold text-sky-800 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                            title="عرض رمز QR للجهاز"
                          >
                            <span>📱 {sub.deviceId || '—'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{sub.phone || '—'}</td>
                        <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">{sub.subscriptionType || '—'}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {(sub.amount ?? 0).toLocaleString()} <span className="text-[10px] text-slate-400">د.ع</span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'active'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : sub.status === 'expiring_soon'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{sub.endDate || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedSubscriberId(isExpanded ? null : sub.id)}
                              aria-expanded={isExpanded}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              <span>{isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
                            </button>
                            {sub.status !== 'active' && (
                              <button
                                onClick={() => {
                                  setSelectedSubId(sub.id);
                                  setSubSearchQuery(sub.name);
                                  setShowOrderModal(true);
                                }}
                                className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>طلب تجديد</span>
                              </button>
                            )}
                            <button
                              onClick={() => onOpenWhatsApp(sub)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
                              title="إرسال رسالة واتساب"
                            >
                              <MessageSquare className="w-4 h-4 fill-emerald-100" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-950/40">
                          <td colSpan={8} className="p-3 md:p-4">
                            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                              <SubscriberDetail label="معرّف المشترك" value={sub.id} />
                              <SubscriberDetail label="اسم المشترك" value={sub.name || '—'} />
                              <SubscriberDetail label="رقم الهاتف" value={sub.phone || '—'} />
                              <SubscriberDetail label="رقم الجهاز" value={sub.deviceId || '—'} />
                              <SubscriberDetail label="الوكيل" value={sub.agentName || currentAgent.name || '—'} />
                              <SubscriberDetail label="معرّف الوكيل" value={sub.agentId || currentAgent.id || '—'} />
                              <SubscriberDetail label="نوع الاشتراك" value={sub.subscriptionType || '—'} />
                              <SubscriberDetail label="حالة الاشتراك" value={statusLabel} />
                              <SubscriberDetail label="حالة الدفع" value={paymentStatusLabel} />
                              <SubscriberDetail label="قيمة الاشتراك" value={`${(sub.amount ?? 0).toLocaleString()} د.ع`} />
                              <SubscriberDetail label="المبلغ الأصلي" value={sub.originalAmount == null ? '—' : `${sub.originalAmount.toLocaleString()} د.ع`} />
                              <SubscriberDetail label="المبلغ المدفوع" value={sub.paidAmount == null ? '—' : `${sub.paidAmount.toLocaleString()} د.ع`} />
                              <SubscriberDetail label="تاريخ التسوية" value={sub.settleDate || '—'} />
                              <SubscriberDetail label="تاريخ بدء الاشتراك" value={sub.startDate || '—'} />
                              <SubscriberDetail label="تاريخ انتهاء الاشتراك" value={sub.endDate || '—'} />
                              <SubscriberDetail label="تاريخ التسجيل" value={sub.createdAt || '—'} />
                              <SubscriberDetail label="العنوان" value={sub.address || '—'} className="sm:col-span-2" />
                              <SubscriberDetail label="ملاحظات الإدارة" value={sub.notes || '—'} className="sm:col-span-2 lg:col-span-2" />
                            </dl>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Submit Electronic Renewal Order */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">إرسال طلب تجديد إلكتروني للمركز</h3>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اختر المشترك أو اكتب اسم المشترك *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={subSearchQuery}
                    onChange={(e) => {
                      setSubSearchQuery(e.target.value);
                      setShowSubSuggestions(true);
                      const found = agentSubs.find(
                        (s) => s.name.toLowerCase() === e.target.value.toLowerCase() || s.deviceId === e.target.value
                      );
                      if (found) setSelectedSubId(found.id);
                      else setSelectedSubId('');
                    }}
                    onFocus={() => setShowSubSuggestions(true)}
                    placeholder="ابحث بالاسم أو رقم الجهاز أو اكتب اسم المشترك..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                    autoComplete="off"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showSubSuggestions && subSearchQuery.trim().length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {agentSubs
                        .filter((s) => s.name.toLowerCase().includes(subSearchQuery.toLowerCase()) || s.deviceId.includes(subSearchQuery))
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubId(s.id);
                              setSubSearchQuery(s.name);
                              setShowSubSuggestions(false);
                            }}
                            className="w-full px-3 py-2 text-right hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center justify-between transition-colors text-xs cursor-pointer"
                          >
                            <span className="font-bold text-slate-800 dark:text-slate-200">{s.name} - جهاز: {s.deviceId}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {s.status === 'active' ? 'فعال' : 'منتهي'}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">باقة التجديد المطلوبة</label>
                <select
                  value={orderDuration}
                  onChange={(e) => setOrderDuration(e.target.value as SubscriptionDuration)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value="1 شهر">1 شهر (سعر الوكيل: 22,000 د.ع)</option>
                  <option value="شهرين">شهرين (سعر الوكيل: 36,000 د.ع)</option>
                  <option value="3 أشهر">3 أشهر (سعر الوكيل: 54,000 د.ع)</option>
                  <option value="6 أشهر">6 أشهر (سعر الوكيل: 100,000 د.ع)</option>
                  <option value="سنة">سنة كاملة (سعر الوكيل: 190,000 د.ع)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظة إضافية للمركز</label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="مثال: المشترك دفع كاش، يرجى تفعيل الجهاز فوراً..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                📢 فور إرسال الطلب، سيصل تنبيه صوتي فوري للوحة المركز الرئيسي في صفحة "الطلبات المعلقة" لاعتماده وتفعيله مباشرة.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 disabled:opacity-40 shadow-sm cursor-pointer"
                >
                  إرسال الطلب للمركز الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Sent Toast */}
      {orderSentToast && (
        <div className="fixed bottom-6 left-6 bg-sky-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in z-50 border border-sky-400" dir="rtl">
          <CheckCircle className="w-5 h-5 text-amber-400" />
          <span>تم إرسال طلب التجديد بنجاح إلى المركز الرئيسي مع إشعار صوتي فوري!</span>
        </div>
      )}
    </div>
  );
};


function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا').replace(/ة/g, 'ه');
}

function doesSubscriberBelongToAgent(sub: { agentId?: string; agentName?: string }, agent: Agent): boolean {
  if (!sub || !agent) return false;
  if (sub.agentId && agent.id && sub.agentId === agent.id) return true;
  const subName = normalizeStr(sub.agentName);
  const agentName = normalizeStr(agent.name);
  const agentCode = normalizeStr(agent.code);
  if (subName && agentName && (subName === agentName || subName.includes(agentName) || agentName.includes(subName))) return true;
  if (subName && agentCode && (subName === agentCode || subName.includes(agentCode))) return true;
  return false;
}

import React, { useMemo, useState } from 'react';
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
  ChevronUp,
  Trash2
} from 'lucide-react';
import { Agent, PendingRenewalRequest, PricingRow, Product, Subscriber, SubscriptionDuration } from '../types';
import { getPriceByDuration } from '../utils/pricingUtils';
import { useAppDialogs } from './AppDialogProvider';
import { useVirtualizedRows } from './useVirtualizedRows';

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
  pendingRequests: PendingRenewalRequest[];
  onSubmitRenewalOrder: (order: Omit<PendingRenewalRequest, 'id' | 'status'>) => void;
  onOpenWhatsApp: (sub: Subscriber) => void;
  onUpdateBranding: (agentId: string, branding: Partial<Agent>) => void;
  onSelectDeviceQr?: (deviceId: string, subscriberName?: string, agentName?: string) => void;
  onDeleteRequest: (requestId: string) => boolean;
}

export const AgentPortalView: React.FC<AgentPortalViewProps> = ({
  currentAgent,
  subscribers,
  products,
  pricing,
  pendingRequests,
  onSubmitRenewalOrder,
  onOpenWhatsApp,
  onUpdateBranding,
  onSelectDeviceQr,
  onDeleteRequest
}) => {
  const { showAlert, showConfirm } = useAppDialogs();
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDeviceSaleModal, setShowDeviceSaleModal] = useState(false);
  const [expandedSubscriberId, setExpandedSubscriberId] = useState<string | null>(null);
  const [subscriberPaymentFilter, setSubscriberPaymentFilter] = useState<'all' | 'cash' | 'debt'>('all');
  const [subscriberBroadcastFilter, setSubscriberBroadcastFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Order form state
  const [selectedSubId, setSelectedSubId] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [showSubSuggestions, setShowSubSuggestions] = useState(false);
  const [orderDuration, setOrderDuration] = useState<SubscriptionDuration>('1 شهر');
  const [orderNotes, setOrderNotes] = useState('');

  // New Device Sale form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubPhone, setNewSubPhone] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newSubNotes, setNewSubNotes] = useState('');

  // Agent's subscribers
  const agentSubs = useMemo(() => subscribers.filter(
    (s) => doesSubscriberBelongToAgent(s, currentAgent)
  ), [currentAgent, subscribers]);
  const activeAgentSubsCount = useMemo(
    () => agentSubs.filter((subscriber) => subscriber.status === 'active').length,
    [agentSubs]
  );
  const filteredAgentSubs = useMemo(() => agentSubs.filter((subscriber) => {
    const isCash = subscriber.paymentStatus === 'paid';
    const isDebt = subscriber.paymentStatus === 'debt' || subscriber.paymentStatus === 'partial';
    const isBroadcastActive = subscriber.status === 'active' || subscriber.status === 'expiring_soon';

    if (subscriberPaymentFilter === 'cash' && !isCash) return false;
    if (subscriberPaymentFilter === 'debt' && !isDebt) return false;
    if (subscriberBroadcastFilter === 'active' && !isBroadcastActive) return false;
    if (subscriberBroadcastFilter === 'inactive' && isBroadcastActive) return false;
    return true;
  }), [agentSubs, subscriberBroadcastFilter, subscriberPaymentFilter]);
  const subSuggestions = useMemo(() => {
    const query = subSearchQuery.trim().toLowerCase();
    if (!query) return [];

    const matches: Subscriber[] = [];
    for (const subscriber of agentSubs) {
      if (subscriber.name.toLowerCase().includes(query) || subscriber.deviceId.includes(subSearchQuery.trim())) {
        matches.push(subscriber);
        if (matches.length === 8) break;
      }
    }
    return matches;
  }, [agentSubs, subSearchQuery]);
  const {
    scrollRef: agentSubscribersTableRef,
    handleScroll: handleAgentSubscribersTableScroll,
    visibleRows: visibleAgentSubs,
    topSpacerHeight: agentSubscribersTopSpacerHeight,
    bottomSpacerHeight: agentSubscribersBottomSpacerHeight
  } = useVirtualizedRows(filteredAgentSubs, 64, 650, 8, expandedSubscriberId ? Number.MAX_SAFE_INTEGER : 80);
  const agentPendingRequests = useMemo(
    () => pendingRequests.filter((request) =>
      request.status === 'pending' &&
      doesSubscriberBelongToAgent(request, currentAgent)
    ),
    [currentAgent, pendingRequests]
  );

  const handleCancelPendingRequest = async (request: PendingRenewalRequest) => {
    const confirmed = await showConfirm(
      `هل تريد إلغاء طلب ${request.subscriberName}؟`,
      'تأكيد إلغاء الطلب'
    );
    if (!confirmed) return;

    if (onDeleteRequest(request.id)) {
      showAlert('تم إلغاء الطلب المعلق.', 'إلغاء الطلب', 'success');
    } else {
      showAlert('تعذر إلغاء الطلب؛ ربما تمت معالجته من الإدارة.', 'الطلب غير متاح', 'warning');
    }
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    let sub = agentSubs.find((s) => s.id === selectedSubId);
    if (!sub && subSearchQuery.trim()) {
      sub = agentSubs.find((s) => s.name.toLowerCase().includes(subSearchQuery.toLowerCase()) || s.deviceId === subSearchQuery);
    }
    if (!sub) {
      showAlert('يرجى اختيار أو كتابة اسم مشترك صحيح التابع لوكالتك', 'بيانات المشترك غير صحيحة');
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
    showAlert('تم إرسال طلب التجديد بنجاح إلى المركز الرئيسي مع إشعار صوتي فوري!', 'تأكيد إرسال الطلب', 'success');
  };

  const handleSubmitDeviceSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) {
      showAlert('يرجى إدخال اسم المشترك الجديد', 'خطأ في البيانات');
      return;
    }
    const agentPricing = pricing.find((row) => row.agentId === currentAgent.id)
      || pricing.find((row) => row.isReference)
      || pricing[0];
    const devicePrice = agentPricing?.newDevicePrice ?? 50000;

    const rawDev = (newDeviceId || '').trim();
    const finalDev = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : `00${Math.floor(100000 + Math.random() * 900000)}`;

    onSubmitRenewalOrder({
      subscriberId: `new-sub-${Date.now()}`,
      subscriberName: newSubName,
      deviceId: finalDev,
      subscriberPhone: newSubPhone,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      duration: '-',
      amount: devicePrice,
      requestDate: new Date().toISOString().split('T')[0],
      notes: `طلب بيع وتسجيل جهاز جديد: ${newSubNotes}`
    });

    setShowDeviceSaleModal(false);
    setNewSubName('');
    setNewSubPhone('');
    setNewDeviceId('');
    setNewSubNotes('');
    showAlert('تم إرسال طلب بيع الجهاز الجديد بنجاح إلى المركز الرئيسي لاعتماده وتفعيله!', 'تأكيد طلب بيع جهاز جديد', 'success');
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
          <button
            onClick={() => setShowDeviceSaleModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Tv className="w-4 h-4" />
            <span>+ بيع جهاز جديد</span>
          </button>
        </div>
      </div>

      {/* Requests awaiting the main center's approval */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200 dark:border-amber-900/60 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-amber-100 dark:border-amber-900/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">الطلبات المعلقة لدى الإدارة</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">طلبات التجديد وبيع الأجهزة التي تنتظر الاعتماد</p>
          </div>
          <span className="shrink-0 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black">
            {agentPendingRequests.length}
          </span>
        </div>

        {agentPendingRequests.length === 0 ? (
          <div className="px-4 py-7 text-center text-xs font-semibold text-slate-400">لا توجد طلبات بانتظار الاعتماد</div>
        ) : (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {agentPendingRequests.map((request) => {
              const isDeviceSale = request.subscriberId.startsWith('new-sub-') || request.duration === '-';
              return (
                <article key={request.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-black ${
                        isDeviceSale
                          ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300'
                          : 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                      }`}>
                        {isDeviceSale ? 'بيع جهاز جديد' : 'تجديد اشتراك'}
                      </span>
                      <h4 className="mt-2 font-extrabold text-sm text-slate-900 dark:text-slate-100">{request.subscriberName}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCancelPendingRequest(request)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/70 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      إلغاء الطلب
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                    <div><span className="text-slate-500 dark:text-slate-400">الهاتف: </span><span className="font-mono font-bold text-slate-800 dark:text-slate-200">{request.subscriberPhone || '—'}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">رقم الجهاز: </span><span className="font-mono font-bold text-slate-800 dark:text-slate-200">{request.deviceId || '—'}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">{isDeviceSale ? 'نوع البيع: ' : 'مدة الاشتراك: '}</span><span className="font-bold text-slate-800 dark:text-slate-200">{isDeviceSale ? 'جهاز جديد فقط' : request.duration}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">المبلغ: </span><span className="font-mono font-black text-slate-900 dark:text-slate-100">{(Number(request.amount) || 0).toLocaleString()} د.ع</span></div>
                    <div className="col-span-2"><span className="text-slate-500 dark:text-slate-400">تاريخ الطلب: </span><span className="font-mono text-slate-700 dark:text-slate-300">{request.requestDate || '—'}</span></div>
                    {request.notes && <div className="col-span-2 text-slate-600 dark:text-slate-300 break-words">{request.notes}</div>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 4 Agent Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي مبيعات الوكالة</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {currentAgent.totalSales.toLocaleString()} <span className="text-xs font-bold text-slate-400">د.ع</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">إجمالي المبيعات نقداً وديناً</div>
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
            {activeAgentSubsCount} فعال حالياً
          </div>
        </div>
      </div>

      {/* Agent's Subscribers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">مشتركو باقات الرابعة التابعون لمكتبك</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              بيانات المشتركين المسجلين لهذا الوكيل، وتتحدث تلقائياً عند تعديلها من لوحة الإدارة
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <label htmlFor="agent-subscriber-payment-filter" className="block">
              <span className="block mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">تصنيف حسب طريقة الدفع</span>
              <select
                id="agent-subscriber-payment-filter"
                value={subscriberPaymentFilter}
                onChange={(event) => setSubscriberPaymentFilter(event.target.value as 'all' | 'cash' | 'debt')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">كل طرق الدفع</option>
                <option value="cash">نقد</option>
                <option value="debt">دين</option>
              </select>
            </label>
            <label htmlFor="agent-subscriber-broadcast-filter" className="block">
              <span className="block mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">تصنيف حسب حالة البث</span>
              <select
                id="agent-subscriber-broadcast-filter"
                value={subscriberBroadcastFilter}
                onChange={(event) => setSubscriberBroadcastFilter(event.target.value as 'all' | 'active' | 'inactive')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">كل حالات البث</option>
                <option value="active">فعال</option>
                <option value="inactive">غير فعال</option>
              </select>
            </label>
          </div>
        </div>

        <div
          ref={agentSubscribersTableRef}
          onScroll={handleAgentSubscribersTableScroll}
          className="max-h-[70vh] overflow-auto"
        >
          <table className="w-full min-w-[1120px] text-right text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3 px-4">اسم المشترك</th>
                <th className="py-3 px-3">رقم الجهاز</th>
                <th className="py-3 px-3">الهاتف</th>
                <th className="py-3 px-3">نوع الباقة</th>
                <th className="py-3 px-3">المبلغ</th>
                <th className="py-3 px-3">طريقة الدفع</th>
                <th className="py-3 px-3">حالة البث</th>
                <th className="py-3 px-3">تاريخ البدء</th>
                <th className="py-3 px-3">تاريخ الانتهاء</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAgentSubs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {agentSubs.length === 0 ? 'لا يوجد مشتركون مسجلون لهذا الوكيل حالياً.' : 'لا يوجد مشتركون مطابقون للتصنيفات المحددة.'}
                  </td>
                </tr>
              ) : (
                <>
                {agentSubscribersTopSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={10} style={{ height: agentSubscribersTopSpacerHeight, padding: 0, border: 0 }} />
                  </tr>
                )}
                {visibleAgentSubs.map((sub) => {
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
                  const paymentMethodLabel = sub.paymentStatus === 'paid'
                    ? 'نقد'
                    : sub.paymentStatus === 'debt' || sub.paymentStatus === 'partial'
                      ? 'دين'
                      : '—';

                  return (
                    <React.Fragment key={sub.id}>
                      <tr className="h-16 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
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
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentMethodLabel === 'نقد'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : paymentMethodLabel === 'دين'
                              ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            {paymentMethodLabel}
                          </span>
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
                        <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{sub.startDate || '—'}</td>
                        <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{sub.endDate || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {sub.status !== 'active' && (
                              <button
                                onClick={() => {
                                  setSelectedSubId(sub.id);
                                  setSubSearchQuery(sub.name);
                                  setShowOrderModal(true);
                                }}
                                className="shrink-0 whitespace-nowrap px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
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
                          <td colSpan={10} className="p-3 md:p-4">
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
                })}
                {agentSubscribersBottomSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={10} style={{ height: agentSubscribersBottomSpacerHeight, padding: 0, border: 0 }} />
                  </tr>
                )}
                </>
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
                      {subSuggestions.map((s) => (
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

      {/* Modal: Submit New Device Sale Order */}
      {showDeviceSaleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Tv className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">طلب بيع جهاز جديد وتفعيل</h3>
              </div>
              <button onClick={() => setShowDeviceSaleModal(false)} className="text-slate-400 p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDeviceSale} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المشترك الجديد *</label>
                <input
                  type="text"
                  required
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="أدخل اسم المشترك الثلاثي..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={newSubPhone}
                  onChange={(e) => setNewSubPhone(e.target.value)}
                  placeholder="0770xxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الجهاز (اختياري، يولد تلقائياً إن ترك فارغاً)</label>
                <input
                  type="text"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  placeholder="00..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>



              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظة إضافية للمركز</label>
                <textarea
                  rows={2}
                  value={newSubNotes}
                  onChange={(e) => setNewSubNotes(e.target.value)}
                  placeholder="ملاحظات حول تسليم الجهاز أو الدفع..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeviceSaleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm cursor-pointer"
                >
                  إرسال طلب بيع الجهاز للمركز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

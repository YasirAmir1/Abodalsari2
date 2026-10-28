import React, { useMemo, useState } from 'react';
import {
  Search,
  Users2,
  Calendar,
  CheckCircle2,
  QrCode,
  Trash2,
  RefreshCw,
  AlertTriangle,
  MessageCircle,
  Filter,
  Sparkles,
  Clock,
  Wallet,
  ShieldCheck,
  X,
  CreditCard,
  Phone,
  BellRing,
  Bell,
  FileSpreadsheet
} from 'lucide-react';
import { Agent, Invoice, PricingRow, Subscriber } from '../types';
import { excelService } from '../services/excelService';
import { DeleteSubscriberModal } from './DeleteSubscriberModal';
import { RenewSubscriptionModal } from './RenewSubscriptionModal';
import { buildSubscriberDebtMap, getSubscriberOutstandingDebt, getSubscriberDebtOverdueInfo } from '../utils/calculationUtils';

interface ActiveSubscribersViewProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  agents: Agent[];
  pricing: PricingRow[];
  onSelectDeviceQr: (deviceId: string, subscriberName?: string, agentName?: string) => void;
  onUpdateSubscriber: (sub: Subscriber) => void;
  onDeleteSubscriber: (id: string) => void;
  onRenewSubscriber: (updatedSubscriber: Subscriber, isDebt: boolean, amount: number) => void;
  onOpenWhatsApp: (sub: Subscriber) => void;
}

export const ActiveSubscribersView: React.FC<ActiveSubscribersViewProps> = ({
  subscribers,
  invoices,
  agents,
  pricing,
  onSelectDeviceQr,
  onUpdateSubscriber,
  onDeleteSubscriber,
  onRenewSubscriber,
  onOpenWhatsApp
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'debt'>('all');
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [deletingSubscriber, setDeletingSubscriber] = useState<Subscriber | null>(null);
  const [renewingSubscriber, setRenewingSubscriber] = useState<Subscriber | null>(null);

  const debtMap = useMemo(() => buildSubscriberDebtMap(invoices), [invoices]);

  // Active subscribers list
  const activeSubscribers = useMemo(() => {
    return subscribers.filter((s) => s.status === 'active' || (s.isActive === true && s.status !== 'inactive'));
  }, [subscribers]);

  // Aggregate stats for Active Subscribers
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let paidCount = 0;
    let debtCount = 0;
    let totalDebtAmount = 0;

    activeSubscribers.forEach((s) => {
      totalRevenue += Number(s.amount) || 0;
      const debt = getSubscriberOutstandingDebt(s, debtMap);
      if (debt > 0) {
        debtCount += 1;
        totalDebtAmount += debt;
      } else {
        paidCount += 1;
      }
    });

    return {
      totalActive: activeSubscribers.length,
      totalRevenue,
      paidCount,
      debtCount,
      totalDebtAmount
    };
  }, [activeSubscribers, debtMap]);

  // Agent counts for active subscribers
  const subscriberCountsByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    activeSubscribers.forEach((sub) => {
      const id = sub.agentId || 'agent-main';
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return counts;
  }, [activeSubscribers]);

  // Remaining days calculation
  const getRemainingDaysInfo = (endDateStr: string) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    if (isNaN(end.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days;
  };

  // Filtered subscribers based on Search, Agent, and Payment status
  const filteredSubscribers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return activeSubscribers.filter((sub) => {
      // Agent filter
      if (agentFilter !== 'all') {
        const subAgentId = sub.agentId || 'agent-main';
        if (subAgentId !== agentFilter) return false;
      }

      // Payment status filter
      if (paymentFilter !== 'all') {
        const debt = getSubscriberOutstandingDebt(sub, debtMap);
        if (paymentFilter === 'paid' && debt > 0) return false;
        if (paymentFilter === 'debt' && debt <= 0) return false;
      }

      // Search filter
      if (query) {
        const matchName = sub.name?.toLowerCase().includes(query);
        const matchDevice = sub.deviceId?.toLowerCase().includes(query);
        const matchPhone = sub.phone?.includes(query);
        const matchAgent = sub.agentName?.toLowerCase().includes(query);
        return matchName || matchDevice || matchPhone || matchAgent;
      }

      return true;
    });
  }, [activeSubscribers, searchTerm, agentFilter, paymentFilter, debtMap]);

  const handleExportActiveSubscribersExcel = () => {
    excelService.exportSubscribers(activeSubscribers, `مشتركو_الساري_الفعالون_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 dark:from-slate-950 dark:via-sky-950/70 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-sky-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                نشط لحظياً
              </span>
              <span className="text-xs font-medium text-slate-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
                {activeSubscribers.length} مشترك فعال
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>المشتركون الفعالون</span>
              <Sparkles className="w-6 h-6 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              متابعة وإدارة كافة الاشتراكات النشطة في المركز الرئيسي ولدى الوكلاء المعتمدين، مع إمكانية التجديد المباشر ومراسلة المشتركين عبر واتساب.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setAgentFilter('all');
                setPaymentFilter('all');
              }}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 flex items-center gap-2 shadow-xs"
              title="إعادة ضبط الفلاتر"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة الضبط</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Stat Cards Inside Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mt-7 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">إجمالي الفعالين</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.totalActive}</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">الإيراد الشهري</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {stats.totalRevenue.toLocaleString()} <span className="text-[11px] font-normal text-slate-300">د.ع</span>
              </p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">مسدد بالكامل</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.paidCount}</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">مشتركين بذمة</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-rose-300">{stats.debtCount}</span>
                {stats.totalDebtAmount > 0 && (
                  <span className="text-[11px] text-rose-200 font-mono">
                    ({stats.totalDebtAmount.toLocaleString()} د.ع)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Card: Search, Filters & Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-5">
        
        {/* Search & Fast Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3.5 justify-between">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="البحث باسم المشترك، رقم الجهاز، الهاتف، أو اسم الوكيل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 text-sm font-medium transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Payment Status Toggles */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 self-start md:self-auto">
            <button
              onClick={() => setPaymentFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                paymentFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              الكل ({activeSubscribers.length})
            </button>
            <button
              onClick={() => setPaymentFilter('paid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                paymentFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>المسدد ({stats.paidCount})</span>
            </button>
            <button
              onClick={() => setPaymentFilter('debt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                paymentFilter === 'debt'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>بذمة ({stats.debtCount})</span>
            </button>
          </div>
        </div>

        {/* Agent Filter Pill Bar */}
        <div className="p-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/50 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-1">
            <Users2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            تصنيف حسب الوكيل:
          </span>

          <button
            onClick={() => setAgentFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              agentFilter === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
            }`}
          >
            <span>كافة الوكلاء والمركز</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              agentFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-150 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {activeSubscribers.length}
            </span>
          </button>

          <button
            onClick={() => setAgentFilter('agent-main')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              agentFilter === 'agent-main'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
            }`}
          >
            <span>المركز الرئيسي</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              agentFilter === 'agent-main' ? 'bg-white/20 text-white' : 'bg-slate-150 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {subscriberCountsByAgent.get('agent-main') || 0}
            </span>
          </button>

          {agents.filter(a => a.id !== 'agent-main').map((ag) => {
            const count = subscriberCountsByAgent.get(ag.id) || 0;
            const isSelected = agentFilter === ag.id;

            return (
              <button
                key={ag.id}
                onClick={() => setAgentFilter(ag.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
                }`}
              >
                <span>{ag.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-150 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results Counter Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
          <p>
            عرض <span className="font-bold text-slate-800 dark:text-slate-200">{filteredSubscribers.length}</span> من أصل <span className="font-bold">{activeSubscribers.length}</span> مشترك فعال
          </p>
          {(searchTerm || agentFilter !== 'all' || paymentFilter !== 'all') && (
            <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
              (تصفية نشطة)
            </span>
          )}
        </div>

        {/* Modern Table Container */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">المشترك</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">رقم الجهاز</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">الوكيل</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">نوع الاشتراك</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">المبلغ</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">فترة الاشتراك</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">الدفع والذمة</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide">الحالة</th>
                  <th className="px-4 py-3.5 text-xs font-black tracking-wide text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <Users2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                          لا توجد نتائج مطابقة
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          لم يتم العثور على مشتركين فعالين يطابقون خيارات البحث أو التصفية الحالية.
                        </p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setAgentFilter('all');
                            setPaymentFilter('all');
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 transition-colors"
                        >
                          إعادة ضبط خيارات البحث
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSubscribers.map((s) => {
                    const overdueInfo = getSubscriberDebtOverdueInfo(s, invoices, 50000, debtMap);
                    const subDebt = overdueInfo.debtAmount;
                    const isOverdue20Days = overdueInfo.isOverdue20Days;
                    const overdueDays = overdueInfo.overdueDays;
                    const isHighDebt = overdueInfo.isHighDebt;
                    const daysRemaining = getRemainingDaysInfo(s.endDate);
                    const isExpiringSoon = daysRemaining !== null && daysRemaining <= 5 && daysRemaining >= 0;

                    return (
                      <tr
                        key={s.id}
                        className={`group transition-colors ${
                          isOverdue20Days
                            ? 'bg-red-50/90 dark:bg-red-950/40 hover:bg-red-100/90 dark:hover:bg-red-950/60 border-r-4 border-r-red-600 dark:border-r-red-500'
                            : isHighDebt
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                            : 'hover:bg-sky-50/40 dark:hover:bg-slate-850/60'
                        }`}
                      >
                        {/* Subscriber Name & Avatar */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className={`w-9 h-9 rounded-xl ${
                                isOverdue20Days
                                  ? 'bg-gradient-to-tr from-red-600 to-rose-700 ring-2 ring-red-400'
                                  : 'bg-gradient-to-tr from-sky-600 to-indigo-600'
                              } text-white font-black text-xs flex items-center justify-center shadow-xs`}>
                                {s.name ? s.name.trim().charAt(0) : 'م'}
                              </div>
                              {isOverdue20Days && (
                                <span
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900 animate-bounce"
                                  title={`دين متأخر تجاوز 20 يوماً (${overdueDays} يوماً)`}
                                >
                                  <BellRing className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className={`font-black text-sm truncate ${isOverdue20Days ? 'text-red-950 dark:text-red-100' : 'text-slate-900 dark:text-slate-100'}`}>
                                  {s.name}
                                </p>
                                {isOverdue20Days && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700 text-[10px] font-black shrink-0 animate-pulse"
                                    title={`دين متأخر منذ ${overdueDays} يوماً بمبلغ ${subDebt.toLocaleString()} د.ع`}
                                  >
                                    <BellRing className="w-2.5 h-2.5 text-red-600" />
                                    <span>متأخر {overdueDays} يوم</span>
                                  </span>
                                )}
                              </div>
                              {s.phone && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone className="w-2.5 h-2.5 opacity-70" />
                                  <span>{s.phone}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Device ID with QR Trigger */}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => onSelectDeviceQr(s.deviceId, s.name, s.agentName)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 font-mono text-xs font-bold transition-all border border-slate-200/80 dark:border-slate-700 group-hover:border-sky-300"
                            title="عرض وتكبير رمز QR الخاص بالجهاز"
                          >
                            <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>{s.deviceId}</span>
                          </button>
                        </td>

                        {/* Agent */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            !s.agentId || s.agentId === 'agent-main'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50'
                          }`}>
                            {s.agentName || 'المركز الرئيسي'}
                          </span>
                        </td>

                        {/* Subscription Type */}
                        <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {s.subscriptionType || '1 شهر'}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          <span className="font-black text-sky-800 dark:text-sky-300 text-sm">
                            {(Number(s.amount) || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 mr-1">د.ع</span>
                        </td>

                        {/* Subscription Period & Expiry Days */}
                        <td className="px-4 py-3.5 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                              <span>{s.startDate || '-'}</span>
                              <span className="text-slate-400">←</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{s.endDate || '-'}</span>
                            </div>
                            {daysRemaining !== null && (
                              <div className="flex items-center gap-1">
                                {isExpiringSoon ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.2 rounded-md">
                                    <Clock className="w-2.5 h-2.5" />
                                    متبقي {daysRemaining} يوم
                                  </span>
                                ) : daysRemaining > 5 ? (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    متبقي {daysRemaining} يوم
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-500 font-bold">
                                    انتهى
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Payment Status & Debt */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                              subDebt === 0
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            }`}>
                              {subDebt === 0 ? 'مسدد' : 'بذمة'}
                            </span>
                            {subDebt > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold"
                                title={`المبلغ المتبقي: ${subDebt.toLocaleString()} د.ع`}
                              >
                                <span>{subDebt.toLocaleString()} د.ع</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Active Status */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-black text-xs bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200/70 dark:border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            فعال
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* WhatsApp Direct Action */}
                            <button
                              onClick={() => onOpenWhatsApp(s)}
                              className="p-2 rounded-xl text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all border border-emerald-200/60 dark:border-emerald-800/40"
                              title="إرسال رسالة واتساب"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            {/* Device QR Action */}
                            <button
                              onClick={() => onSelectDeviceQr(s.deviceId, s.name, s.agentName)}
                              className="p-2 rounded-xl text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-all border border-sky-200/60 dark:border-sky-800/40"
                              title="عرض رمز QR للجهاز"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>

                            {/* Renew Subscription Action */}
                            <button
                              onClick={() => setRenewingSubscriber(s)}
                              className="p-2 rounded-xl text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all border border-indigo-200/60 dark:border-indigo-800/40"
                              title="تجديد / تمديد الاشتراك"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>

                            {/* Delete Action */}
                            <button
                              onClick={() => setDeletingSubscriber(s)}
                              className="p-2 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all border border-rose-200/60 dark:border-rose-800/40"
                              title="حذف المشترك"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Actions Toolbar: Export Active Subscribers to Excel */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>تصدير بيانات المشتركين الفعالين (Excel)</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                {activeSubscribers.length} مشترك فعال
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تصدير ملف إكسل رسمي وشامل لكافة المشتركين الفعالين في المنظومة مع أرقام الأجهزة، الوكلاء، والتواريخ والاشتراكات.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportActiveSubscribersExcel}
          className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2.5 cursor-pointer shrink-0"
          title="تصدير جميع المشتركين الفعالين إلى ملف Excel"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>تصدير ملف Excel</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/20 text-white font-black">
            {activeSubscribers.length}
          </span>
        </button>
      </div>

      {/* Renew Subscription Modal */}
      {renewingSubscriber && (
        <RenewSubscriptionModal
          subscriber={renewingSubscriber}
          agents={agents}
          pricing={pricing}
          onClose={() => setRenewingSubscriber(null)}
          onSaveAndActivate={(updated, isDebt, amount) => {
            onRenewSubscriber(updated, isDebt, amount);
            setRenewingSubscriber(null);
          }}
          onWhatsApp={(sub) => onOpenWhatsApp(sub)}
          forceMainCenter={true}
        />
      )}

      {/* Delete Subscriber Modal */}
      {deletingSubscriber && (
        <DeleteSubscriberModal
          subscriber={deletingSubscriber}
          onClose={() => setDeletingSubscriber(null)}
          onConfirmDelete={(id) => {
            onDeleteSubscriber(id);
            setDeletingSubscriber(null);
          }}
        />
      )}
    </div>
  );
};

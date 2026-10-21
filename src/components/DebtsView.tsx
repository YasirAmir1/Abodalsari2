
function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا').replace(/ة/g, 'ه');
}

function doesSubscriberBelongToAgentFilter(sub: Subscriber, filterId: string, agents: Agent[]): boolean {
  if (filterId === 'all') return true;
  const targetAgent = agents.find((a) => a.id === filterId || normalizeStr(a.name) === normalizeStr(filterId));
  if (!targetAgent) {
    return sub.agentId === filterId || normalizeStr(sub.agentName) === normalizeStr(filterId);
  }
  if (sub.agentId && targetAgent.id && sub.agentId === targetAgent.id) return true;
  const subName = normalizeStr(sub.agentName);
  const agentName = normalizeStr(targetAgent.name);
  const agentCode = normalizeStr(targetAgent.code);
  if (subName && agentName && (subName === agentName || subName.includes(agentName) || agentName.includes(subName))) return true;
  if (subName && agentCode && (subName === agentCode || subName.includes(agentCode))) return true;
  return false;
}

import React, { useMemo, useState } from 'react';
import {
  Hourglass,
  Clock,
  DollarSign,
  Send,
  MessageSquare,
  CheckCircle,
  CreditCard,
  User,
  Users2,
  Search,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { Agent, Invoice, Subscriber } from '../types';
import { excelService } from '../services/excelService';
import { useAppDialogs } from './AppDialogProvider';
import { SecurityActionModal } from './SecurityActionModal';
import { useVirtualizedRows } from './useVirtualizedRows';
import { getSubscriberOutstandingDebt } from '../utils/calculationUtils';

interface DebtsViewProps {
  agents: Agent[];
  invoices: Invoice[];
  subscribers: Subscriber[];
  onSettleAgentDebt: (agentId: string, amount: number) => void;
  onSettleSubscriberDebt: (subscriberId: string, amount: number) => void;
  onResetAgentData: (agentId: string) => void;
  onOpenWhatsApp: (sub: Subscriber) => void;
  onSelectDeviceQr?: (deviceId: string, subscriberName?: string, agentName?: string) => void;
  onDeleteSubscriber: (subscriberId: string) => void;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  agents,
  invoices,
  subscribers,
  onSettleAgentDebt,
  onSettleSubscriberDebt,
  onResetAgentData,
  onOpenWhatsApp,
  onSelectDeviceQr,
  onDeleteSubscriber
}) => {
  const { showConfirm } = useAppDialogs();
  const [activeTab, setActiveTab] = useState<'agents' | 'subscribers'>('agents');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const [debtSearchTerm, setDebtSearchTerm] = useState<string>('');
  const [subscriberToPay, setSubscriberToPay] = useState<Subscriber | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [securityModalConfig, setSecurityModalConfig] = useState<{
    isOpen: boolean;
    actionName: string;
    targetDescription: string;
    targetId?: string;
    details: Array<{ label: string; value: string | number; isHighlight?: boolean }>;
    confirmButtonText: string;
    onExecute: () => void;
  } | null>(null);
  const paymentSubscriber = subscriberToPay
    ? subscribers.find((subscriber) => subscriber.id === subscriberToPay.id) || null
    : null;
  const paymentSubscriberDebt = paymentSubscriber
    ? getSubscriberOutstandingDebt(paymentSubscriber, invoices)
    : 0;

  const debtSubscribers = useMemo(
    () => subscribers.filter((subscriber) => getSubscriberOutstandingDebt(subscriber, invoices) > 0),
    [invoices, subscribers]
  );
  const totalSalesAmount = useMemo(() => invoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0), [invoices]);
  const totalPaidAmount = useMemo(() => invoices.reduce((sum, invoice) => {
    const amount = Number(invoice.amount) || 0;
    const paidAmount = Number.isFinite(Number(invoice.paidAmount))
      ? Number(invoice.paidAmount)
      : Math.max(0, amount - (Number(invoice.remainingAmount) || 0));
    return sum + Math.max(0, paidAmount);
  }, 0), [invoices]);
  const grandTotalDebt = useMemo(
    () => debtSubscribers.reduce((sum, subscriber) => sum + getSubscriberOutstandingDebt(subscriber, invoices), 0),
    [debtSubscribers, invoices]
  );
  const formatMoney = (amount: number) => Math.max(0, Number.isFinite(amount) ? amount : 0).toLocaleString();

  const computedAgents = useMemo(() => {
    const agentIndexesById = new Map<string, number>();
    const agentIndexesByName = new Map<string, number[]>();
    agents.forEach((agent, index) => {
      agentIndexesById.set(agent.id, index);
      const matchingIndexes = agentIndexesByName.get(agent.name) || [];
      matchingIndexes.push(index);
      agentIndexesByName.set(agent.name, matchingIndexes);
    });
    const totals = agents.map(() => ({ debt: 0, sales: 0, paid: 0 }));

    subscribers.forEach((subscriber) => {
      const subscriberDebt = getSubscriberOutstandingDebt(subscriber, invoices);
      if (subscriberDebt <= 0) return;
      const matchingIndexes = new Set<number>();
      const idIndex = agentIndexesById.get(subscriber.agentId);
      if (idIndex !== undefined) matchingIndexes.add(idIndex);
      (agentIndexesByName.get(subscriber.agentName) || []).forEach((index) => matchingIndexes.add(index));
      matchingIndexes.forEach((index) => {
        totals[index].debt += subscriberDebt;
      });
    });

    invoices.forEach((invoice) => {
      const matchingIndexes = invoice.agentId
        ? [agentIndexesById.get(invoice.agentId)].filter((index): index is number => index !== undefined)
        : agentIndexesByName.get(invoice.agentName) || [];
      const amount = Number(invoice.amount) || 0;
      const paidAmount = Number.isFinite(Number(invoice.paidAmount))
        ? Number(invoice.paidAmount)
        : Math.max(0, amount - (Number(invoice.remainingAmount) || 0));
      matchingIndexes.forEach((index) => {
        totals[index].sales += amount;
        totals[index].paid += Math.max(0, paidAmount);
      });
    });

    return agents.map((agent, index) => ({
      ...agent,
      invoiceSalesAmount: totals[index].sales,
      invoicePaidAmount: totals[index].paid,
      totalDebt: totals[index].debt,
      hasDebt: totals[index].debt > 0
    }));
  }, [agents, invoices, subscribers]);

  // Filter Agents Table
  const filteredAgents = useMemo(() => computedAgents.filter((ag) => {
    if (selectedAgentFilter !== 'all' && ag.id !== selectedAgentFilter && ag.name !== selectedAgentFilter) {
      return false;
    }
    if (debtSearchTerm.trim()) {
      const term = debtSearchTerm.toLowerCase();
      const matchName = ag.name.toLowerCase().includes(term);
      const matchCode = ag.code.toLowerCase().includes(term);
      const matchRegion = ag.region.toLowerCase().includes(term);
      return matchName || matchCode || matchRegion;
    }
    return true;
  }), [computedAgents, debtSearchTerm, selectedAgentFilter]);
  const financialSummaryAgents = useMemo(() => activeTab === 'agents'
    ? filteredAgents
    : computedAgents.filter((ag) => selectedAgentFilter === 'all' || ag.id === selectedAgentFilter || ag.name === selectedAgentFilter),
  [activeTab, computedAgents, filteredAgents, selectedAgentFilter]);

  // Filter Subscribers Debt Table
  const filteredDebtSubscribers = useMemo(() => debtSubscribers.filter((sub) => {
    if (!doesSubscriberBelongToAgentFilter(sub, selectedAgentFilter, agents)) {
      return false;
    }
    if (debtSearchTerm.trim()) {
      const term = debtSearchTerm.toLowerCase();
      const matchName = sub.name.toLowerCase().includes(term);
      const matchPhone = sub.phone.includes(term);
      const matchDevice = sub.deviceId.includes(term);
      const matchAgent = sub.agentName.toLowerCase().includes(term);
      return matchName || matchPhone || matchDevice || matchAgent;
    }
    return true;
  }), [debtSearchTerm, debtSubscribers, selectedAgentFilter]);
  const {
    scrollRef: debtSubscribersTableRef,
    handleScroll: handleDebtSubscribersTableScroll,
    visibleRows: visibleDebtSubscribers,
    topSpacerHeight: debtSubscribersTopSpacerHeight,
    bottomSpacerHeight: debtSubscribersBottomSpacerHeight
  } = useVirtualizedRows(filteredDebtSubscribers, 64);

  const handleExportExcel = () => {
    if (activeTab === 'agents') {
      const exportData = agents.map(ag => ({
        name: ag.name,
        agentName: 'المركز الرئيسي',
        code: ag.code,
        totalAmount: ag.totalSales,
        paidAmount: ag.totalPaid,
        remainingAmount: ag.totalDebt,
        dueDate: 'مستحق',
        notes: ag.region
      }));
      excelService.exportDebts(exportData, 'ديون_الوكلاء_المستحقة.xlsx');
    } else {
      const exportData = debtSubscribers.map((sub) => {
        const subscriberInvoices = invoices.filter((invoice) => invoice.subscriberId === sub.id);
        const invoiceAmount = subscriberInvoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0);
        const invoicePaid = subscriberInvoices.reduce((sum, invoice) => sum + (Number(invoice.paidAmount) || 0), 0);
        const remainingAmount = getSubscriberOutstandingDebt(sub, invoices);
        return {
          name: sub.name,
          agentName: sub.agentName,
          code: sub.deviceId,
          totalAmount: invoiceAmount || sub.originalAmount || ((sub.debtAmount || sub.amount) + (sub.paidAmount || 0)),
          paidAmount: invoicePaid || sub.paidAmount || 0,
          remainingAmount,
          dueDate: sub.endDate,
          notes: sub.subscriptionType
        };
      });
      excelService.exportDebts(exportData, 'ديون_المشتركين_المباشرة.xlsx');
    }
  };

  const submitSubscriberPayment = () => {
    if (!paymentSubscriber) return;
    const amount = Number(paymentAmount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > paymentSubscriberDebt) return;
    onSettleSubscriberDebt(paymentSubscriber.id, amount);
    setSubscriberToPay(null);
    setPaymentAmount('');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Excel Export */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">إدارة المطالبات والتحصيلات المالية</div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">سجل الديون والمستحقات</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            متابعة ذمم الوكلاء والمشتركين، إرسال تذكيرات سداد فورية عبر واتساب، وتسجيل دفعات السداد
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            title="تصدير بيانات الديون إلى ملف إكسل"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Main financial summary: values are derived directly from current invoices and subscriber balances. */}
      <section aria-label="الملخص المالي العام" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-xs dark:border-sky-900 dark:bg-sky-950/30">
          <div className="text-xs font-bold text-sky-800 dark:text-sky-300">مبلغ المبيعات — الإجمالي العام</div>
          <div className="mt-2 break-all font-mono text-2xl font-black leading-tight text-sky-900 dark:text-sky-100">
            {formatMoney(totalSalesAmount)} <span className="text-xs font-bold">د.ع</span>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-xs dark:border-red-900 dark:bg-red-950/30">
          <div className="text-xs font-bold text-red-800 dark:text-red-300">مبلغ الدين الكلي — الإجمالي العام</div>
          <div className="mt-2 break-all font-mono text-2xl font-black leading-tight text-red-700 dark:text-red-200">
            {formatMoney(grandTotalDebt)} <span className="text-xs font-bold">د.ع</span>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-xs dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">مبلغ المسدد — الإجمالي العام</div>
          <div className="mt-2 break-all font-mono text-2xl font-black leading-tight text-emerald-700 dark:text-emerald-200">
            {formatMoney(totalPaidAmount)} <span className="text-xs font-bold">د.ع</span>
          </div>
        </div>
      </section>

      {/* Switch Tab: Agent Debts vs Subscriber Debts */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'agents'
              ? 'bg-sky-900 dark:bg-sky-800 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Users2 className="w-4 h-4" />
          <span>ديون الوكلاء المستحقة ({computedAgents.filter((a) => a.totalDebt > 0).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subscribers')}
          className={`px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'subscribers'
              ? 'bg-sky-900 dark:bg-sky-800 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>ديون المشتركين المباشرة ({debtSubscribers.length})</span>
        </button>
      </div>

      {/* Classification by Agent Name at the top of the table (تصنيف حسب اسم الوكيل) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Agent Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-1">
            <Filter className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>تصنيف حسب اسم الوكيل:</span>
          </span>

          {/* All Agents */}
          <button
            onClick={() => setSelectedAgentFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedAgentFilter === 'all'
                ? 'bg-sky-900 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>جميع الوكلاء</span>
            <span className="text-[10px] opacity-80">
              ({activeTab === 'agents' ? agents.length : debtSubscribers.length})
            </span>
          </button>

          {/* Individual Agent Pills */}
          {computedAgents.map((ag) => {
            const isSelected = selectedAgentFilter === ag.id || selectedAgentFilter === ag.name;
            const hasDebt = ag.totalDebt > 0;
            return (
              <button
                key={ag.id}
                onClick={() => setSelectedAgentFilter(isSelected ? 'all' : ag.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-900 text-white shadow-xs ring-2 ring-sky-300'
                    : hasDebt
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{ag.name}</span>
                {hasDebt ? (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-red-500/20 text-white' : 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300'
                  }`}>
                    {ag.totalDebt.toLocaleString()} د.ع
                  </span>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-emerald-500/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  }`}>
                    غير مديون
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search input in Debts view */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="بحث بالاسم، الرمز، أو الهاتف..."
            value={debtSearchTerm}
            onChange={(e) => setDebtSearchTerm(e.target.value)}
            className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Agent and main-office financial summaries */}
      <section className="space-y-3" aria-label="الملخص المالي لكل وكيل">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">ملخص المبيعات والديون والتسديدات حسب الوكيل</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">يشمل المركز الرئيسي، وتتحدث القيم تلقائياً مع تسجيل أو تعديل المعاملات.</p>
        </div>
        {financialSummaryAgents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            لا توجد نتائج مطابقة لخيارات البحث والتصنيف.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {financialSummaryAgents.map((ag) => (
              <article key={ag.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h4 className="mb-3 flex min-w-0 items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100" title={ag.name}>
                  <span className="truncate">{ag.name}</span>
                  {ag.id === 'agent-main' && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">الرئيسي</span>}
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="min-w-0 rounded-xl bg-sky-50 p-3 dark:bg-sky-950/30">
                    <div className="text-[11px] font-bold text-sky-800 dark:text-sky-300">مبلغ المبيعات</div>
                    <div className="mt-1 break-all font-mono text-base font-black text-sky-900 dark:text-sky-100">{formatMoney(ag.invoiceSalesAmount)} <span className="text-[10px]">د.ع</span></div>
                  </div>
                  <div className="min-w-0 rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
                    <div className="text-[11px] font-bold text-red-800 dark:text-red-300">مبلغ الدين الكلي</div>
                    <div className="mt-1 break-all font-mono text-base font-black text-red-700 dark:text-red-200">{formatMoney(ag.totalDebt)} <span className="text-[10px]">د.ع</span></div>
                  </div>
                  <div className="min-w-0 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                    <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">مبلغ المسدد</div>
                    <div className="mt-1 break-all font-mono text-base font-black text-emerald-700 dark:text-emerald-200">{formatMoney(ag.invoicePaidAmount)} <span className="text-[10px]">د.ع</span></div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Agents Debt Table */}
      {activeTab === 'agents' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-black text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>جدول مديونية الوكلاء المستحقة للمركز الرئيسي</span>
            <span className="text-xs text-slate-400 font-normal">
              عرض {filteredAgents.length} من {agents.length} وكيل
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="py-3 px-4">اسم الوكيل</th>
                  <th className="py-3 px-3">إجمالي المبيعات</th>
                  <th className="py-3 px-3">المسدد للرئيسية</th>
                  <th className="py-3 px-3">الدين المتبقي</th>
                  <th className="py-3 px-4 text-center">إجراءات التحصيل</th>
                  <th className="py-3 px-4 text-center">تصفير السجلات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      لا يوجد وكلاء يطابقون خيار التصنيف المحدد
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((ag) => {
                    const hasDebt = ag.totalDebt > 0;
                    return (
                      <tr key={ag.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {ag.name}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {ag.totalSales.toLocaleString()} د.ع
                        </td>
                        <td className="py-3.5 px-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          {ag.totalPaid.toLocaleString()} د.ع
                        </td>
                        <td className="py-3.5 px-3 font-mono font-black text-red-600 dark:text-red-400 text-sm">
                          {ag.totalDebt.toLocaleString()} د.ع
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {hasDebt ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSecurityModalConfig({
                                    isOpen: true,
                                    actionName: `تصفير وحذف ديون الوكيل (${ag.name})`,
                                    targetDescription: `أنت على وشك تصفير وحذف كافة الديون المسجلة على الوكيل (${ag.name}) بالكامل بمبلغ ${ag.totalDebt.toLocaleString()} د.ع، وتحويل رصيد ديونه إلى صفر. هذا الإجراء الإداري نهائي ولا يمكن التراجع عنه بعد تنفيذه.`,
                                    targetId: ag.id,
                                    details: [
                                      { label: 'اسم الوكيل', value: ag.name },
                                      { label: 'رمز الوكيل', value: ag.code },
                                      { label: 'المنطقة', value: ag.region },
                                      { label: 'إجمالي الدين المراد تصفيره', value: `${ag.totalDebt.toLocaleString()} د.ع`, isHighlight: true }
                                    ],
                                    confirmButtonText: 'تأكيد تصفير دين الوكيل نهائياً',
                                    onExecute: () => onSettleAgentDebt(ag.id, ag.totalDebt)
                                  });
                                }}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                title="حذف/تصفير الدين بالكامل (إجراء أمني عالي الخطورة)"
                              >
                                حذف الدين
                              </button>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                              غير مطلوب
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setSecurityModalConfig({
                                isOpen: true,
                                actionName: `تصفير شامل لسجلات ومبيعات الوكيل (${ag.name})`,
                                targetDescription: `تحذير أمني عالي الخطورة: سيتم تصفير ومسح كافة المبيعات والديون والتسديدات المسجلة للوكيل (${ag.name}) نهائياً لتبدأ حساباته ومبيعاته من الصفر. هذا الإجراء الإداري نهائي لا رجعة فيه.`,
                                targetId: ag.id,
                                details: [
                                  { label: 'اسم الوكيل', value: ag.name },
                                  { label: 'رمز الوكيل', value: ag.code },
                                  { label: 'المبيعات التي ستصفر', value: `${ag.totalSales.toLocaleString()} د.ع`, isHighlight: true },
                                  { label: 'الديون التي ستصفر', value: `${ag.totalDebt.toLocaleString()} د.ع`, isHighlight: true },
                                  { label: 'المبالغ المسددة السابقة', value: `${ag.totalPaid.toLocaleString()} د.ع` }
                                ],
                                confirmButtonText: 'تأكيد التصفير الشامل للوكيل',
                                onExecute: () => onResetAgentData(ag.id)
                              });
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            title="تصفير كافة المبيعات والديون للوكيل (إجراء أمني عالي الخطورة)"
                          >
                            <span>تصفير</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Subscribers Debt Table */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-black text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>قائمة المشتركين المسجلين كـ دين</span>
            <span className="text-xs text-slate-400 font-normal">
              عرض {filteredDebtSubscribers.length} من {debtSubscribers.length} مشترك
            </span>
          </div>

          <div
            ref={debtSubscribersTableRef}
            onScroll={handleDebtSubscribersTableScroll}
            className="max-h-[70vh] overflow-auto"
          >
            <table className="w-full text-right text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="py-3 px-4">اسم المشترك</th>
                  <th className="py-3 px-3">رقم الجهاز</th>
                  <th className="py-3 px-3">الهاتف</th>
                  <th className="py-3 px-3">الوكيل المسؤول</th>
                  <th className="py-3 px-3">مبلغ الدين</th>
                  <th className="py-3 px-3">تاريخ الانتهاء</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDebtSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      لا يوجد مشتركون بديون يطابقون خيار التصنيف المحدد
                    </td>
                  </tr>
                ) : (
                  <>
                  {debtSubscribersTopSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={7} style={{ height: debtSubscribersTopSpacerHeight, padding: 0, border: 0 }} />
                    </tr>
                  )}
                  {visibleDebtSubscribers.map((sub) => (
                    <tr key={sub.id} className="h-16 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">{sub.name}</td>
                      <td className="py-3.5 px-3 font-mono">
                        <button
                          onClick={() => onSelectDeviceQr && onSelectDeviceQr(sub.deviceId, sub.name, sub.agentName)}
                          className="font-bold text-sky-800 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                          title="عرض رمز QR للجهاز"
                        >
                          <span>📱 {sub.deviceId}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400">{sub.phone}</td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800 font-semibold text-[11px]">
                          {sub.agentName}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-black text-red-600 dark:text-red-400">
                        {getSubscriberOutstandingDebt(sub, invoices).toLocaleString()} د.ع
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-500 dark:text-slate-400">{sub.endDate}</td>
                      <td className="py-3.5 px-4 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => onOpenWhatsApp(sub)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>تذكير</span>
                        </button>
                        <button
                          onClick={() => {
                            setSubscriberToPay(sub);
                            setPaymentAmount('');
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          تسديد دفعة
                        </button>
                        <button
                          onClick={async () => {
                            if (await showConfirm('هل أنت متأكد من حذف بيانات هذا المشترك نهائياً؟', 'حذف المشترك')) {
                              onDeleteSubscriber(sub.id);
                            }
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                  {debtSubscribersBottomSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={7} style={{ height: debtSubscribersBottomSpacerHeight, padding: 0, border: 0 }} />
                    </tr>
                  )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paymentSubscriber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" dir="rtl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscriber-payment-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 id="subscriber-payment-title" className="text-lg font-black text-slate-900 dark:text-white">
                  تسجيل دفعة للمشترك
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{paymentSubscriber.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSubscriberToPay(null)}
                className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm dark:bg-red-950/30">
              <span className="text-slate-600 dark:text-slate-300">الدين المتبقي: </span>
              <strong className="font-mono text-red-700 dark:text-red-300">
                {paymentSubscriberDebt.toLocaleString()} د.ع
              </strong>
            </div>

            <label htmlFor="subscriber-payment-amount" className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              مبلغ الدفعة (د.ع)
            </label>
            <input
              id="subscriber-payment-amount"
              type="number"
              min="1"
              max={paymentSubscriberDebt}
              step="1"
              inputMode="numeric"
              autoFocus
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-lg text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="أدخل المبلغ"
            />
            <button
              type="button"
              onClick={() => setPaymentAmount(String(paymentSubscriberDebt))}
              className="mt-2 text-xs font-bold text-sky-700 hover:underline dark:text-sky-400"
            >
              تسديد كامل الدين
            </button>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubscriberToPay(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitSubscriberPayment}
                disabled={!Number.isInteger(Number(paymentAmount)) || Number(paymentAmount) <= 0 || Number(paymentAmount) > paymentSubscriberDebt}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                حفظ الدفعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Security Warning & Final Administrative Action Modal for Debt Zeroing */}
      {securityModalConfig && (
        <SecurityActionModal
          isOpen={securityModalConfig.isOpen}
          actionType="RESET_DEBT"
          actionName={securityModalConfig.actionName}
          targetDescription={securityModalConfig.targetDescription}
          targetId={securityModalConfig.targetId}
          details={securityModalConfig.details}
          confirmButtonText={securityModalConfig.confirmButtonText}
          onConfirm={() => {
            securityModalConfig.onExecute();
            setSecurityModalConfig(null);
          }}
          onClose={() => setSecurityModalConfig(null)}
        />
      )}
    </div>
  );
};

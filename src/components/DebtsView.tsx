import React, { useMemo, useState } from 'react';
import {
  Hourglass,
  Clock,
  DollarSign,
  MessageSquare,
  CheckCircle,
  CreditCard,
  User,
  Users2,
  Search,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
  QrCode,
  Trash2,
  Sparkles,
  TrendingUp,
  Wallet,
  ShieldCheck,
  X,
  Phone,
  BellRing,
  Bell
} from 'lucide-react';
import { Agent, Invoice, Subscriber } from '../types';
import { excelService } from '../services/excelService';
import { useAppDialogs } from './AppDialogProvider';
import { SecurityActionModal } from './SecurityActionModal';
import { useVirtualizedRows } from './useVirtualizedRows';
import {
  getSubscriberOutstandingDebt,
  buildSubscriberDebtMap,
  calculateAgentSubscriberDebt,
  getSubscriberDebtOverdueInfo
} from '../utils/calculationUtils';

function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا').replace(/ة/g, 'ه');
}

function parsePaymentAmount(value: string): number | null {
  const normalized = value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const codePoint = digit.charCodeAt(0);
      return String(codePoint - (codePoint >= 0x06f0 ? 0x06f0 : 0x0660));
    })
    .replace(/[,\u066c\s]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : null;
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

  const debtMap = useMemo(() => buildSubscriberDebtMap(invoices), [invoices]);

  const paymentSubscriber = subscriberToPay
    ? subscribers.find((subscriber) => subscriber.id === subscriberToPay.id) || subscriberToPay
    : null;
  const paymentSubscriberDebt = paymentSubscriber
    ? getSubscriberOutstandingDebt(paymentSubscriber, debtMap)
    : 0;
  const parsedPaymentAmount = parsePaymentAmount(paymentAmount);

  const debtSubscribers = useMemo(
    () => subscribers.filter((subscriber) => getSubscriberOutstandingDebt(subscriber, debtMap) > 0),
    [debtMap, subscribers]
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
    () => debtSubscribers.reduce((sum, subscriber) => sum + getSubscriberOutstandingDebt(subscriber, debtMap), 0),
    [debtMap, debtSubscribers]
  );
  const formatMoney = (amount: number) => Math.max(0, Number.isFinite(amount) ? amount : 0).toLocaleString();

  const agentIndexesById = useMemo(
    () => new Map(agents.map((agent, index) => [agent.id, index])),
    [agents]
  );
  const agentIndexesByName = useMemo(() => {
    const indexes = new Map<string, number[]>();
    agents.forEach((agent, index) => {
      [agent.name, agent.code].forEach((name) => {
        const normalizedName = normalizeStr(name);
        if (!normalizedName) return;
        indexes.set(normalizedName, [...(indexes.get(normalizedName) || []), index]);
      });
    });
    return indexes;
  }, [agents]);

  const computedAgents = useMemo(() => {
    const totals = agents.map((agent) => ({
      debt: calculateAgentSubscriberDebt(agent.id, agent.name, subscribers, debtMap),
      sales: 0,
      paid: 0
    }));

    invoices.forEach((invoice) => {
      const indexById = invoice.agentId ? agentIndexesById.get(invoice.agentId) : undefined;
      const matchingIndexes = indexById !== undefined
        ? [indexById]
        : agentIndexesByName.get(normalizeStr(invoice.agentName)) || [];
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
  }, [agents, agentIndexesById, agentIndexesByName, invoices, subscribers, debtMap]);

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
  }), [debtSearchTerm, debtSubscribers, selectedAgentFilter, agents]);

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
    if (parsedPaymentAmount === null || parsedPaymentAmount <= 0 || parsedPaymentAmount > paymentSubscriberDebt) return;
    onSettleSubscriberDebt(paymentSubscriber.id, parsedPaymentAmount);
    setSubscriberToPay(null);
    setPaymentAmount('');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Hero Command Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 dark:from-slate-950 dark:via-sky-950/70 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-sky-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-72 h-72 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                إدارة المطالبات والتحصيلات المالية
              </span>
              <span className="text-xs font-medium text-slate-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
                {debtSubscribers.length} مشترك بذمة
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>سجل الديون والمستحقات</span>
              <Sparkles className="w-6 h-6 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              متابعة ذمم الوكلاء والمشتركين بدقة، إرسال تذكيرات سداد فورية عبر واتساب، وتسجيل دفعات السداد الجزئي أو الكلي لحظياً.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer border border-emerald-500/40 active:scale-95"
              title="تصدير بيانات الديون إلى ملف إكسل منسق"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        {/* 3 Main Financial Summary KPI Cards Inside Hero */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mt-7 pt-6 border-t border-white/10">
          {/* Total Sales */}
          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">إجمالي المبيعات العامة</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
                {formatMoney(totalSalesAmount)} <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </p>
            </div>
          </div>

          {/* Grand Total Debt */}
          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">مبلغ الدين الكلي المستحق</p>
              <p className="text-xl sm:text-2xl font-black text-rose-300 mt-0.5 font-mono">
                {formatMoney(grandTotalDebt)} <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </p>
            </div>
          </div>

          {/* Total Paid Amount */}
          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">إجمالي المبالغ المسددة</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5 font-mono">
                {formatMoney(totalPaidAmount)} <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container: Tabs, Filters, Summaries, and Tables */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-6">
        
        {/* Switch Tab: Agent Debts vs Subscriber Debts */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'agents'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users2 className="w-4 h-4" />
              <span>ديون الوكلاء المستحقة</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeTab === 'agents' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {computedAgents.filter((a) => a.totalDebt > 0).length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('subscribers')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'subscribers'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>ديون المشتركين المباشرة</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeTab === 'subscribers' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {debtSubscribers.length}
              </span>
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="البحث بالاسم، الرمز، أو الهاتف..."
              value={debtSearchTerm}
              onChange={(e) => setDebtSearchTerm(e.target.value)}
              className="w-full pr-10 pl-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            {debtSearchTerm && (
              <button
                onClick={() => setDebtSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Classification by Agent Bar */}
        <div className="p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-1">
            <Filter className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>تصنيف حسب الوكيل:</span>
          </span>

          {/* All Agents Button */}
          <button
            onClick={() => setSelectedAgentFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedAgentFilter === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
            }`}
          >
            <span>جميع الوكلاء والمركز</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              selectedAgentFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-150 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-xs'
                    : hasDebt
                    ? 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <span>{ag.name}</span>
                {hasDebt ? (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                  }`}>
                    {ag.totalDebt.toLocaleString()} د.ع
                  </span>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  }`}>
                    مسدد
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Agent Financial Summary Grid Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>ملخص المبيعات والديون والتسديدات حسب الوكلاء</span>
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              تحديث فوري مع كل حركة سداد
            </span>
          </div>

          {financialSummaryAgents.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد بيانات مطابقة لخيارات البحث أو التصنيف الحالية.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {financialSummaryAgents.map((ag) => (
                <article
                  key={ag.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850/60 p-4 shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center font-mono">
                        {ag.name.charAt(0)}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate" title={ag.name}>
                        {ag.name}
                      </h4>
                    </div>
                    {ag.id === 'agent-main' && (
                      <span className="shrink-0 rounded-md bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        المركز الرئيسي
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2.5 border border-slate-150 dark:border-slate-700/60">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">المبيعات</div>
                      <div className="mt-1 font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                        {formatMoney(ag.invoiceSalesAmount)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-2.5 border border-rose-200/60 dark:border-rose-800/60">
                      <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300">الدين الكلي</div>
                      <div className="mt-1 font-mono text-xs font-black text-rose-600 dark:text-rose-300">
                        {formatMoney(ag.totalDebt)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5 border border-emerald-200/60 dark:border-emerald-800/60">
                      <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">المسدد</div>
                      <div className="mt-1 font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                        {formatMoney(ag.invoicePaidAmount)}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: Agents Debt Table */}
        {activeTab === 'agents' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                جدول مديونية الوكلاء المستحقة للمركز الرئيسي
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                عرض {filteredAgents.length} من أصل {agents.length} وكيل
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                      <th className="py-3.5 px-4 font-black">اسم الوكيل</th>
                      <th className="py-3.5 px-3 font-black">إجمالي المبيعات</th>
                      <th className="py-3.5 px-3 font-black">المسدد للرئيسية</th>
                      <th className="py-3.5 px-3 font-black">الدين المتبقي</th>
                      <th className="py-3.5 px-4 font-black text-center">إجراءات التحصيل</th>
                      <th className="py-3.5 px-4 font-black text-center">تصفير السجلات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAgents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                          لا يوجد وكلاء يطابقون خيار التصنيف أو البحث المحدد
                        </td>
                      </tr>
                    ) : (
                      filteredAgents.map((ag) => {
                        const hasDebt = ag.totalDebt > 0;
                        return (
                          <tr
                            key={ag.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                              hasDebt ? 'bg-rose-50/40 dark:bg-rose-950/15' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                  {ag.name.charAt(0)}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block">
                                    {ag.name}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {ag.code || ag.region}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {ag.totalSales.toLocaleString()} <span className="text-[10px] text-slate-400">د.ع</span>
                            </td>
                            <td className="py-3.5 px-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                              {ag.totalPaid.toLocaleString()} <span className="text-[10px] text-emerald-500">د.ع</span>
                            </td>
                            <td className="py-3.5 px-3 font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                              {ag.totalDebt.toLocaleString()} <span className="text-[10px] text-rose-400">د.ع</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {hasDebt ? (
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
                                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                  title="حذف وتصفير الدين بالكامل"
                                >
                                  حذف الدين
                                </button>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                  مسدد بالكامل
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
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="تصفير كافة المبيعات والديون للوكيل"
                              >
                                <span>تصفير شامل</span>
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
          </div>
        ) : (
          /* Tab 2: Subscribers Debt Table */
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                قائمة المشتركين المسجلين كـ دين
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                عرض {filteredDebtSubscribers.length} من أصل {debtSubscribers.length} مشترك مطلوب
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden bg-white dark:bg-slate-900">
              <div
                ref={debtSubscribersTableRef}
                onScroll={handleDebtSubscribersTableScroll}
                className="max-h-[70vh] overflow-auto"
              >
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="py-3.5 px-4 font-black">المشترك</th>
                      <th className="py-3.5 px-3 font-black">رقم الجهاز</th>
                      <th className="py-3.5 px-3 font-black">الهاتف</th>
                      <th className="py-3.5 px-3 font-black">الوكيل المسؤول</th>
                      <th className="py-3.5 px-3 font-black">مبلغ الدين</th>
                      <th className="py-3.5 px-3 font-black">تاريخ الانتهاء</th>
                      <th className="py-3.5 px-4 font-black text-center">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDebtSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                          لا يوجد مشتركون بديون يطابقون خيار التصنيف أو البحث المحدد
                        </td>
                      </tr>
                    ) : (
                      <>
                        {debtSubscribersTopSpacerHeight > 0 && (
                          <tr aria-hidden="true">
                            <td colSpan={7} style={{ height: debtSubscribersTopSpacerHeight, padding: 0, border: 0 }} />
                          </tr>
                        )}
                        {visibleDebtSubscribers.map((sub) => {
                          const overdueInfo = getSubscriberDebtOverdueInfo(sub, invoices, 50000, debtMap);
                          const outstandingDebt = overdueInfo.debtAmount;
                          const isOverdue20Days = overdueInfo.isOverdue20Days;
                          const overdueDays = overdueInfo.overdueDays;

                          return (
                            <tr
                              key={sub.id}
                              className={`h-16 transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${
                                isOverdue20Days
                                  ? 'bg-red-50/90 dark:bg-red-950/40 hover:bg-red-100/90 dark:hover:bg-red-950/60 border-r-4 border-r-red-600 dark:border-r-red-500'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-850/50'
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative shrink-0">
                                    <div className={`w-8 h-8 rounded-lg ${
                                      isOverdue20Days
                                        ? 'bg-gradient-to-tr from-red-600 to-rose-700 ring-2 ring-red-400'
                                        : 'bg-gradient-to-tr from-rose-500 to-amber-500'
                                    } text-white font-black text-xs flex items-center justify-center`}>
                                      {sub.name ? sub.name.trim().charAt(0) : 'م'}
                                    </div>
                                    {isOverdue20Days && (
                                      <span
                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs ring-1 ring-white dark:ring-slate-900 animate-bounce"
                                        title={`تنبيه: دين متأخر تجاوز 20 يوماً (${overdueDays} يوماً)`}
                                      >
                                        <BellRing className="w-2 h-2" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`font-bold text-sm ${isOverdue20Days ? 'text-red-950 dark:text-red-100' : 'text-slate-900 dark:text-slate-100'}`}>
                                      {sub.name}
                                    </span>
                                    {isOverdue20Days && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700 text-[10px] font-black shrink-0 animate-pulse"
                                        title={`دين متأخر منذ ${overdueDays} يوماً`}
                                      >
                                        <Bell className="w-2.5 h-2.5 text-red-600" />
                                        <span>متأخر {overdueDays} يوم</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-3 font-mono">
                                <button
                                  onClick={() => onSelectDeviceQr && onSelectDeviceQr(sub.deviceId, sub.name, sub.agentName)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-xs font-bold transition-all border border-slate-200/80 dark:border-slate-700 cursor-pointer"
                                  title="عرض رمز QR للجهاز"
                                >
                                  <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                  <span>{sub.deviceId}</span>
                                </button>
                              </td>

                              <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                                {sub.phone ? (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5 opacity-60" />
                                    <span>{sub.phone}</span>
                                  </span>
                                ) : (
                                  <span>-</span>
                                )}
                              </td>

                              <td className="py-3.5 px-3">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-[11px]">
                                  {sub.agentName || 'المركز الرئيسي'}
                                </span>
                              </td>

                              <td className="py-3.5 px-3 font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                                {outstandingDebt.toLocaleString()} <span className="text-[10px] text-rose-400 font-sans">د.ع</span>
                              </td>

                              <td className="py-3.5 px-3 font-mono text-slate-500 dark:text-slate-400 text-xs">
                                {sub.endDate || '-'}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* WhatsApp Reminder */}
                                  <button
                                    onClick={() => onOpenWhatsApp(sub)}
                                    className="p-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                    title="إرسال تذكير سداد عبر واتساب"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>تذكير</span>
                                  </button>

                                  {/* Settle Payment */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubscriberToPay(sub);
                                      setPaymentAmount('');
                                    }}
                                    className="p-2 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                    title="تسجيل دفعة سداد للمشترك"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    <span>تسديد دفعة</span>
                                  </button>

                                  {/* Delete */}
                                  <button
                                    onClick={async () => {
                                      if (await showConfirm('هل أنت متأكد من حذف بيانات هذا المشترك نهائياً؟', 'حذف المشترك')) {
                                        onDeleteSubscriber(sub.id);
                                      }
                                    }}
                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
                                    title="حذف المشترك"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
          </div>
        )}
      </div>

      {/* Settle Subscriber Payment Modal */}
      {paymentSubscriber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscriber-payment-title"
            className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in"
          >
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 id="subscriber-payment-title" className="text-lg font-black text-slate-900 dark:text-white">
                  تسجيل دفعة للمشترك
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{paymentSubscriber.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSubscriberToPay(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 p-4 text-xs border border-rose-200 dark:border-rose-800/60">
              <span className="text-slate-600 dark:text-slate-300">الدين المتبقي الحالي: </span>
              <strong className="font-mono text-base text-rose-700 dark:text-rose-300 font-black mr-1">
                {paymentSubscriberDebt.toLocaleString()} د.ع
              </strong>
            </div>

            <label htmlFor="subscriber-payment-amount" className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300">
              مبلغ الدفعة المراد تسديده (د.ع)
            </label>
            <div className="relative">
              <input
                id="subscriber-payment-amount"
                type="text"
                inputMode="numeric"
                autoFocus
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 font-mono text-lg font-black text-slate-900 dark:text-white outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                placeholder="أدخل المبلغ..."
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                د.ع
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPaymentAmount(String(paymentSubscriberDebt))}
              className="mt-2 text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>تسديد كامل الدين دفعة واحدة ({paymentSubscriberDebt.toLocaleString()} د.ع)</span>
            </button>

            <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSubscriberToPay(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitSubscriberPayment}
                disabled={parsedPaymentAmount === null || parsedPaymentAmount <= 0 || parsedPaymentAmount > paymentSubscriberDebt}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-xs"
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

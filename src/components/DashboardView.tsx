import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Hourglass,
  Radio,
  ChevronLeft,
  ArrowUpRight,
  FileSpreadsheet,
  CalendarRange,
  BarChart3,
  PieChart,
  Users,
  Users2,
  Plus,
  Sparkles,
  Wallet,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight
} from 'lucide-react';
import {
  calculateTotalSales,
  calculateTotalDebts,
  getSubscriberOutstandingDebt,
  buildSubscriberDebtMap,
  getSalesChartData,
  getMonthlyFinancialSummary
} from '../utils/calculationUtils';
import { Agent, Invoice, Subscriber } from '../types';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  agents: Agent[];
  subscribers: Subscriber[];
  invoices: Invoice[];
  onNavigate: (tab: NavTab) => void;
  onOpenNewSale: () => void;
  onExportExcel: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  agents,
  subscribers,
  invoices,
  onNavigate,
  onOpenNewSale,
  onExportExcel
}) => {
  const [activeChartPoint, setActiveChartPoint] = useState<number | null>(null);

  const debtMap = useMemo(() => buildSubscriberDebtMap(invoices), [invoices]);

  // System-wide total sales & debts
  const totalSales = useMemo(() => calculateTotalSales(invoices), [invoices]);
  const totalDebts = useMemo(() => calculateTotalDebts(subscribers, invoices), [subscribers, invoices]);

  // Count of debt records across the system
  const totalDebtRecordsCount = useMemo(
    () => subscribers.filter((subscriber) => getSubscriberOutstandingDebt(subscriber, debtMap) > 0).length,
    [subscribers, debtMap]
  );

  const activeAgentsCount = agents.filter((a) => a.id !== 'agent-main').length;
  const totalOperations = invoices.length;

  // Active vs Inactive Subscription metrics
  const totalSubsCount = subscribers.length;
  const activeSubsCount = useMemo(
    () => subscribers.filter((s) => s.status === 'active' || (s.isActive === true && s.status !== 'inactive')).length,
    [subscribers]
  );
  const inactiveSubsCount = useMemo(
    () => subscribers.filter((s) => s.status === 'inactive' || (!s.isActive && s.status !== 'active' && s.status !== 'expiring_soon')).length,
    [subscribers]
  );
  const expiringSubsCount = useMemo(
    () => subscribers.filter((s) => s.status === 'expiring_soon').length,
    [subscribers]
  );

  const activePercent = totalSubsCount > 0 ? Math.round((activeSubsCount / totalSubsCount) * 100) : 0;
  const inactivePercent = totalSubsCount > 0 ? Math.round((inactiveSubsCount / totalSubsCount) * 100) : 0;
  const expiringPercent = totalSubsCount > 0 ? Math.max(0, 100 - activePercent - inactivePercent) : 0;

  // Donut geometry for radius 46
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const activeDash = (activeSubsCount / (totalSubsCount || 1)) * donutCircumference;
  const inactiveDash = (inactiveSubsCount / (totalSubsCount || 1)) * donutCircumference;
  const expiringDash = (expiringSubsCount / (totalSubsCount || 1)) * donutCircumference;

  // Today's sales calculation
  const todaySales = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return invoices
      .filter((inv) => inv.date && inv.date.startsWith(todayStr))
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [invoices]);

  // This month's sales calculation
  const thisMonthSales = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;
    return invoices
      .filter((inv) => inv.date && inv.date.startsWith(prefix))
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [invoices]);

  // Chart data points (Last 7 days)
  const chartDays = useMemo(() => getSalesChartData(invoices), [invoices]);

  const maxAmount = useMemo(() => {
    const max = Math.max(...chartDays.map((d) => d.amount));
    return max === 0 ? 100000 : max;
  }, [chartDays]);

  const svgPoints = useMemo(() => {
    return chartDays.map((d, i) => {
      const x = 50 + i * 100;
      const y = 180 - (d.amount / maxAmount) * 145;
      return { ...d, cx: x, cy: y };
    });
  }, [chartDays, maxAmount]);

  const pathD = useMemo(() => {
    if (svgPoints.length === 0) return '';
    return svgPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.cx} ${pt.cy}`).join(' ');
  }, [svgPoints]);

  const areaD = useMemo(() => {
    if (svgPoints.length === 0) return '';
    const lastPt = svgPoints[svgPoints.length - 1];
    const firstPt = svgPoints[0];
    return `${pathD} L ${lastPt.cx} 180 L ${firstPt.cx} 180 Z`;
  }, [pathD, svgPoints]);

  // Monthly Financial Summary
  const monthlySummary = useMemo(() => getMonthlyFinancialSummary(invoices), [invoices]);

  // Growth Chart Data (Last 6 months)
  const growthChartData = useMemo(() => {
    const data = [...monthlySummary].reverse().slice(-6);
    if (data.length === 0) return [];

    const maxSales = Math.max(...data.map((d) => d.sales)) || 1000000;
    return data.map((d, i) => {
      const x = 50 + i * (600 / (data.length - 1 || 1));
      const y = 145 - (d.sales / maxSales) * 115;
      return { ...d, x, y };
    });
  }, [monthlySummary]);

  const growthPathD = useMemo(() => {
    if (growthChartData.length === 0) return '';
    return growthChartData.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  }, [growthChartData]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Unified Executive Command Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 dark:from-slate-950 dark:via-sky-950/70 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-sky-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative group shrink-0">
              <img
                src="/logo.png"
                alt="الساري للبث الأرضي"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-full bg-white p-1 shadow-lg ring-2 ring-sky-400/50 group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  شبكة البث متصلة لحظياً
                </span>
                <span className="text-xs font-medium text-slate-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
                  المركز الرئيسي (صلاح الدين)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                <span>الداشبورد العام للمركز</span>
                <Sparkles className="w-6 h-6 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                شركة الساري للبث الأرضي - الوكيل الرسمي والحصري لقنوات الرابعة الرياضية في صلاح الدين.
              </p>
            </div>
          </div>

          {/* Action Shortcut Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenNewSale}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer border border-sky-400/40"
              title="تسجيل عملية بيع جديدة أو تجديد اشتراك"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>تسجيل بيع جديد</span>
            </button>

            <button
              onClick={onExportExcel}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-2xl text-xs font-bold transition-all border border-white/15 flex items-center gap-2 shadow-xs cursor-pointer backdrop-blur-xs"
              title="تصدير تقرير شامل إلى ملف إكسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير إكسل</span>
            </button>
          </div>
        </div>

        {/* Central Real-Time Summary Cards inside Hero */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mt-7 pt-6 border-t border-white/10">
          {/* Active Subscribers */}
          <div
            onClick={() => onNavigate('active_subscribers')}
            className="bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5 cursor-pointer group"
            title="اضغط لعرض قائمة المشتركين الفعالين"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <span>المشتركون النشطون</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
                {activeSubsCount.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-300 font-sans">مشترك</span>
              </div>
            </div>
          </div>

          {/* This Month Sales */}
          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-300 font-medium">مبيعات هذا الشهر</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
                {thisMonthSales.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </div>
            </div>
          </div>

          {/* Remaining Debts */}
          <div
            onClick={() => onNavigate('debts')}
            className="bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5 cursor-pointer group"
            title="اضغط للانتقال إلى تفاصيل الديون والذمم"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-300 font-medium">الديون المتبقية</div>
              <div className="text-xl sm:text-2xl font-black text-rose-300 mt-0.5 font-mono">
                {totalDebts.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Main Core KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: إجمالي المبيعات */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500 group-hover:w-2.5 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المبيعات الكلية</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/40 shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline gap-1 font-mono">
              <span>{totalSales.toLocaleString()}</span>
              <span className="text-xs font-normal text-slate-400 font-sans">د.ع</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>عدد العمليات المسجلة:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{totalOperations} عملية</span>
          </div>
        </div>

        {/* Card 2: مبيعات اليوم */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-sky-400 dark:hover:border-sky-500/50 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sky-500 group-hover:w-2.5 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مبيعات اليوم</span>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-800/40 shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline gap-1 font-mono">
              <span>{todaySales.toLocaleString()}</span>
              <span className="text-xs font-normal text-slate-400 font-sans">د.ع</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>معدل النشاط الحالي:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              مباشر لحظياً
            </span>
          </div>
        </div>

        {/* Card 3: الوكلاء النشطون */}
        <div
          onClick={() => onNavigate('agents')}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
          title="اضغط لعرض وإدارة الوكلاء"
        >
          <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500 group-hover:w-2.5 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الوكلاء النشطون</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/40 shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline gap-1 font-mono">
              <span>{activeAgentsCount}</span>
              <span className="text-xs font-normal text-slate-400 font-sans">وكيل معتمد</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>نطاق التغطية:</span>
            <span className="font-bold text-indigo-700 dark:text-indigo-300">مستقرة (صلاح الدين)</span>
          </div>
        </div>

        {/* Card 4: الديون المستحقة */}
        <div
          onClick={() => onNavigate('debts')}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-rose-400 dark:hover:border-rose-500/50 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          title="اضغط للانتقال إلى تفاصيل الديون والذمم بالسستم"
        >
          <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500 group-hover:w-2.5 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              الديون المستحقة (الشاملة)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-800/40 shadow-xs">
              <Hourglass className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight flex items-baseline gap-1 font-mono">
              <span>{totalDebts.toLocaleString()}</span>
              <span className="text-xs font-normal text-rose-400 font-sans">د.ع</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>سجلات الديون المعلقة:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{totalDebtRecordsCount} مشترك</span>
          </div>
        </div>
      </div>

      {/* Row of Agent Quick Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-black text-sm text-slate-800 dark:text-slate-200">
              ملخص مراكز التوزيع والوكلاء المعتمدين
            </h3>
          </div>
          <button
            onClick={() => onNavigate('agents')}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>إدارة كافة الوكلاء</span>
            <ChevronLeft className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {agents.map((agent) => {
            const isMain = agent.id === 'agent-main';
            return (
              <div
                key={agent.id}
                onClick={() => onNavigate('agents')}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group hover:border-sky-400 dark:hover:border-sky-500"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center font-mono">
                      {agent.name.charAt(0)}
                    </span>
                    {isMain && (
                      <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.2 rounded-md">
                        الرئيسي
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {agent.name}
                  </div>
                </div>

                <div className="my-2.5 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>مبيعات:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                      {agent.totalSales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>مسدد:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                      {agent.totalPaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span className={agent.totalDebt > 0 ? 'text-rose-500 font-bold' : ''}>متبقي:</span>
                    <span className={`font-bold font-mono ${agent.totalDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {agent.totalDebt.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between group-hover:text-sky-600 dark:group-hover:text-sky-400">
                  <span>عرض التفاصيل</span>
                  <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle Analytics Section: Sales Movement & Subscription Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Movement Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">
                  مخطط حركة المبيعات لآخر 7 أيام
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تتبع إجمالي المبيعات اليومية المحققة عبر المركز وكافة الوكلاء
                </p>
              </div>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                بالدينار العراقي (د.ع)
              </span>
            </div>

            {/* SVG Area / Line Chart with Crisp Aesthetics */}
            <div className="relative h-64 w-full">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines */}
                <line x1="0" y1="180" x2="700" y2="180" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />
                <line x1="0" y1="120" x2="700" y2="120" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />
                <line x1="0" y1="60" x2="700" y2="60" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />

                {/* Area Fill */}
                <path d={areaD} fill="url(#areaGradient)" />

                {/* Line Path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
                {svgPoints.map((pt, i) => (
                  <g key={i} className="cursor-pointer">
                    {pt.label && (
                      <text
                        x={pt.cx}
                        y={pt.cy - 12}
                        textAnchor="middle"
                        className="text-xs font-bold fill-slate-700 dark:fill-slate-300 font-mono"
                        style={{ fontSize: '12px' }}
                      >
                        {pt.label}
                      </text>
                    )}
                    <circle
                      cx={pt.cx}
                      cy={pt.cy}
                      r="6"
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth="3"
                      className="hover:r-8 transition-all"
                      onMouseEnter={() => setActiveChartPoint(i)}
                      onMouseLeave={() => setActiveChartPoint(null)}
                    />
                  </g>
                ))}
              </svg>

              {/* Days Labels Row */}
              <div className="flex justify-between px-6 mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                {chartDays.map((d, index) => (
                  <span
                    key={index}
                    className={activeChartPoint === index ? 'text-sky-600 dark:text-sky-400 font-black' : ''}
                  >
                    {d.day}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Ratio Circular / Donut Summary Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-100 dark:border-emerald-800/40">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">حالة الاشتراكات</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">الفعالة مقابل غير الفعالة</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 font-mono">
                {totalSubsCount} مشترك
              </span>
            </div>

            {/* Circular / Donut SVG Graphic */}
            <div className="flex flex-col items-center justify-center my-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  {/* Background Track Circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="none"
                    className="stroke-slate-100 dark:stroke-slate-800"
                    strokeWidth="11"
                  />

                  {/* Active Segment (Emerald Green) */}
                  {activeSubsCount > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={donutRadius}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="11"
                      strokeDasharray={`${activeDash} ${donutCircumference - activeDash}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  )}

                  {/* Inactive Segment (Rose Red) */}
                  {inactiveSubsCount > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={donutRadius}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="11"
                      strokeDasharray={`${inactiveDash} ${donutCircumference - inactiveDash}`}
                      strokeDashoffset={-activeDash}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  )}

                  {/* Expiring Soon Segment (Amber) */}
                  {expiringSubsCount > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={donutRadius}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="11"
                      strokeDasharray={`${expiringDash} ${donutCircumference - expiringDash}`}
                      strokeDashoffset={-(activeDash + inactiveDash)}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  )}
                </svg>

                {/* Center label inside donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight font-mono">{activePercent}%</span>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                    فعال
                  </span>
                </div>
              </div>
            </div>

            {/* Legend list with counts and percentages */}
            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div
                onClick={() => onNavigate('active_subscribers')}
                className="flex items-center justify-between p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                title="اضغط لعرض المشتركين الفعالين فقط"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                  <span>اشتراكات فعالة:</span>
                </span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-1.5">
                  <span>{activeSubsCount.toLocaleString()}</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans font-bold">({activePercent}%)</span>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-transform group-hover:-translate-x-0.5" />
                </span>
              </div>

              <div
                onClick={() => onNavigate('subscribers')}
                className="flex items-center justify-between p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                title="اضغط لعرض كافة المشتركين"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" />
                  <span>اشتراكات غير فعالة:</span>
                </span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-1.5">
                  <span>{inactiveSubsCount.toLocaleString()}</span>
                  <span className="text-[11px] text-rose-500 dark:text-rose-400 font-sans font-bold">({inactivePercent}%)</span>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-transform group-hover:-translate-x-0.5" />
                </span>
              </div>

              {expiringSubsCount > 0 && (
                <div
                  onClick={() => onNavigate('subscribers')}
                  className="flex items-center justify-between p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  title="اشتراكات تنتهي قريباً"
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                    <span>منتهية قريباً:</span>
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-1.5">
                    <span>{expiringSubsCount.toLocaleString()}</span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-sans font-bold">({expiringPercent}%)</span>
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-transform group-hover:-translate-x-0.5" />
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => onNavigate('active_subscribers')}
              className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs group"
              title="الانتقال إلى صفحة المشتركين الفعالين"
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>المشتركون الفعالون</span>
              <ChevronLeft className="w-3 h-3 text-emerald-500 transition-transform group-hover:-translate-x-0.5" />
            </button>
            <button
              onClick={() => onNavigate('subscribers')}
              className="py-2.5 px-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer group"
              title="الانتقال إلى صفحة كافة المشتركين"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>كافة المشتركين</span>
              <ChevronLeft className="w-3 h-3 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Financial Summary & Growth Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table: Monthly Summary */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold border border-sky-100 dark:border-sky-800/40">
                <CalendarRange className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg">الملخص المالي الشهري</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">سجل حركة الإيرادات والتحصيلات والديون للأشهر السابقة</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              البيانات التاريخية
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs">
                  <th className="pb-3 pr-2">الشهر</th>
                  <th className="pb-3">إجمالي المبيعات</th>
                  <th className="pb-3">المدفوعات</th>
                  <th className="pb-3">الديون المتبقية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {monthlySummary.slice(0, 6).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 pr-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {item.monthName} {item.year}
                    </td>
                    <td className="py-3.5 font-black text-slate-900 dark:text-slate-100 font-mono text-sm">
                      {item.sales.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans">د.ع</span>
                    </td>
                    <td className="py-3.5 font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {item.paid.toLocaleString()} <span className="text-[10px] text-emerald-400 font-sans">د.ع</span>
                    </td>
                    <td className="py-3.5 font-bold text-rose-500 dark:text-rose-400 font-mono text-sm">
                      {item.debt.toLocaleString()} <span className="text-[10px] text-rose-400 font-sans">د.ع</span>
                    </td>
                  </tr>
                ))}
                {monthlySummary.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                      لا توجد بيانات متاحة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Growth Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold border border-indigo-100 dark:border-indigo-800/40">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg">نمو المبيعات شهرياً</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">مسار الإيرادات لآخر 6 أشهر</p>
              </div>
            </div>

            <div className="relative min-h-[190px] w-full">
              {growthChartData.length > 0 ? (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 700 180" preserveAspectRatio="none">
                  {/* Horizontal Gridlines */}
                  <line x1="0" y1="150" x2="700" y2="150" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />
                  <line x1="0" y1="100" x2="700" y2="100" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />
                  <line x1="0" y1="50" x2="700" y2="50" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />

                  {/* Growth Path */}
                  <path
                    d={growthPathD}
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-sm"
                  />

                  {/* Points */}
                  {growthChartData.map((pt, i) => (
                    <g key={i}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5"
                        fill="#ffffff"
                        stroke="#4f46e5"
                        strokeWidth="3"
                      />
                      <text
                        x={pt.x}
                        y={172}
                        textAnchor="middle"
                        className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500"
                      >
                        {pt.monthName}
                      </text>
                    </g>
                  ))}
                </svg>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm italic">
                  بانتظار اكتمال بيانات الأشهر القادمة
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">معدل النشاط والنمو:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                مستقر وإيجابي
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

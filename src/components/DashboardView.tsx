import React, { useState } from 'react';
import {
  TrendingUp,
  Hourglass,
  Radio,
  BadgeDollarSign,
  ChevronLeft,
  ArrowUpRight,
  ShieldCheck,
  Send,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Agent, Invoice, Subscriber } from '../types';

interface DashboardViewProps {
  agents: Agent[];
  subscribers: Subscriber[];
  invoices: Invoice[];
  onNavigate: (tab: any) => void;
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

  // Calculations - System-wide total sales & debts across ALL agents and HQ (المركز الرئيسي)
  const totalSales = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Total system debt: Sum of debts for all agents including HQ ('agent-main') and all debt subscribers
  const agentDebtsTotal = agents.reduce((sum, ag) => sum + (ag.totalDebt || 0), 0);
  const subscriberDebtsTotal = subscribers
    .filter((s) => s.paymentStatus === 'debt')
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const totalDebts = Math.max(agentDebtsTotal, subscriberDebtsTotal);

  // Count of debt records across HQ and all agents in the system
  const debtSubscribersCount = subscribers.filter((s) => s.paymentStatus === 'debt').length;
  const debtAgentsCount = agents.filter((a) => a.totalDebt > 0).length;
  const totalDebtRecordsCount = debtSubscribersCount > 0 ? debtSubscribersCount : debtAgentsCount;

  const activeAgentsCount = agents.filter((a) => a.id !== 'agent-main').length;
  const totalOperations = invoices.length;

  // Chart data points matching Screenshot 1
  const chartDays = [
    { day: 'الأحد', amount: 315000, label: '315k' },
    { day: 'الإثنين', amount: 15000, label: '15k' },
    { day: 'الثلاثاء', amount: 97000, label: '97k' },
    { day: 'الأربعاء', amount: 22000, label: '22k' },
    { day: 'الخميس', amount: 8000, label: '8k' },
    { day: 'الجمعة', amount: 0, label: '0' },
    { day: 'السبت', amount: 0, label: '0' }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner matching Screenshot 1 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-1">
            <span>مساء الخير والنشاط</span>
            <span>🌙</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">الداشبورد العام للمركز</h2>
          <p className="text-sm text-slate-500 mt-1">
            نظرة شاملة ومباشرة على المبيعات، الوكلاء، والديون القائمة لشبكة الساري للبث الأرضي
          </p>
        </div>

        {/* Action Shortcut Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenNewSale}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ تسجيل بيع جديد</span>
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير إكسل</span>
          </button>
        </div>
      </div>

      {/* 4 Main Metric Cards (Matching Screenshot 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: إجمالي المبيعات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المبيعات</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
              💰
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{totalSales.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">د.ع</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>عدد العمليات الإجمالي:</span>
            <span className="font-bold text-slate-700">{totalOperations} عملية</span>
          </div>
        </div>

        {/* Card 2: مبيعات اليوم */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مبيعات اليوم</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>0</span>
              <span className="text-xs font-bold text-slate-400">د.ع</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>معدل النشاط الحالي:</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              مباشر
            </span>
          </div>
        </div>

        {/* Card 3: الوكلاء النشطون */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الوكلاء النشطون</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5 text-sky-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{activeAgentsCount}</span>
              <span className="text-xs font-bold text-slate-400">وكيل</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>تغطية شبكة الساري:</span>
            <span className="font-bold text-sky-700">مستقرة (صلاح الدين)</span>
          </div>
        </div>

        {/* Card 4: الديون المستحقة (شاملة كل الوكلاء والرئيسية) */}
        <div
          onClick={() => onNavigate('debts')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-red-300 transition-all cursor-pointer group"
          title="اضغط للانتقال إلى تفاصيل الديون والمستحقات بالسستم"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 group-hover:text-red-600 transition-colors">
              الديون المستحقة (الوكلاء والرئيسية)
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Hourglass className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-red-600 tracking-tight flex items-baseline gap-1">
              <span>{totalDebts.toLocaleString()}</span>
              <span className="text-xs font-bold text-red-400">د.ع</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>إجمالي الديون غير المسددة:</span>
            <span className="font-bold text-red-600">{totalDebtRecordsCount} سجل</span>
          </div>
        </div>
      </div>

      {/* Row of 6 Agent Quick Cards (Matching Screenshot 1) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {agents.map((agent) => {
          const isMain = agent.id === 'agent-main';
          return (
            <div
              key={agent.id}
              onClick={() => onNavigate('agents')}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer text-center flex flex-col justify-between group hover:border-sky-400"
            >
              <div className="font-bold text-sm text-slate-800 group-hover:text-sky-700 transition-colors">
                {agent.name}
              </div>

              <div className="my-2.5 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>مبيعات:</span>
                  <span className="font-semibold text-slate-700">{agent.totalSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>مسدد:</span>
                  <span className="font-semibold text-slate-700">{agent.totalPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className={agent.totalDebt > 0 ? 'text-red-500 font-bold' : ''}>متبقي:</span>
                  <span className={`font-bold ${agent.totalDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {agent.totalDebt.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-center gap-1 group-hover:text-sky-600">
                <span>التفاصيل</span>
                <ChevronLeft className="w-3 h-3" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales Movement Chart (Matching Screenshot 1) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-slate-900 text-lg">مخطط حركة المبيعات لآخر 7 أيام</h3>
          <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 border border-slate-200">
            بالدينار العراقي
          </span>
        </div>

        {/* SVG Area / Line Chart with Crisp Aesthetics */}
        <div className="relative h-64 w-full">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            <line x1="0" y1="180" x2="700" y2="180" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="120" x2="700" y2="120" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="60" x2="700" y2="60" stroke="#f1f5f9" strokeWidth="1" />

            {/* Area Fill */}
            {/* Coordinates calculated for 7 days: X at 50, 150, 250, 350, 450, 550, 650 */}
            <path
              d="M 50 180 L 50 25 L 150 170 L 250 110 L 350 160 L 450 175 L 550 180 L 650 180 L 650 180 Z"
              fill="url(#areaGradient)"
            />

            {/* Line Path matching Screenshot 1 curve */}
            <path
              d="M 50 25 L 150 170 L 250 110 L 350 160 L 450 175 L 550 180 L 650 180"
              fill="none"
              stroke="#0369a1"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {[
              { cx: 50, cy: 25, label: '315k', val: '315,000 د.ع' },
              { cx: 150, cy: 170, label: '', val: '15,000 د.ع' },
              { cx: 250, cy: 110, label: '97k', val: '97,000 د.ع' },
              { cx: 350, cy: 160, label: '22k', val: '22,000 د.ع' },
              { cx: 450, cy: 175, label: '', val: '8,000 د.ع' },
              { cx: 550, cy: 180, label: '', val: '0 د.ع' },
              { cx: 650, cy: 180, label: '', val: '0 د.ع' }
            ].map((pt, i) => (
              <g key={i} className="cursor-pointer">
                {pt.label && (
                  <text
                    x={pt.cx}
                    y={pt.cy - 12}
                    textAnchor="middle"
                    className="text-xs font-bold fill-slate-700"
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
          <div className="flex justify-between px-6 mt-4 text-xs font-bold text-slate-500">
            {chartDays.map((d, index) => (
              <span
                key={index}
                className={activeChartPoint === index ? 'text-sky-700 font-extrabold' : ''}
              >
                {d.day}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

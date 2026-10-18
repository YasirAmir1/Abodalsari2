import React, { useState } from 'react';
import {
  Calendar,
  CreditCard,
  Tv,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronLeft,
  Settings,
  DollarSign,
  TrendingUp,
  Receipt,
  Users,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  FileSpreadsheet,
  Eye,
  EyeOff
} from 'lucide-react';
import { Agent, Subscriber } from '../types';
import { excelService } from '../services/excelService';

interface AgentsViewProps {
  agents: Agent[];
  subscribers: Subscriber[];
  onSettleDebt: (agentId: string, amount: number, note?: string) => void;
  onUpdateAgentBranding: (agentId: string, branding: Partial<Agent>) => void;
  onViewSubscribers: (agentId: string) => void;
  onViewSales: (agentId: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  subscribers,
  onSettleDebt,
  onUpdateAgentBranding,
  onViewSubscribers,
  onViewSales
}) => {
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});

  const togglePasswordVisibility = (agentId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  // Modals
  const [settlingAgent, setSettlingAgent] = useState<Agent | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNote, setSettleNote] = useState('');

  const [brandingAgent, setBrandingAgent] = useState<Agent | null>(null);
  const [customShopName, setCustomShopName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customRegion, setCustomRegion] = useState('');

  // Filter & Sort non-main agents
  let fieldAgents = agents.filter((a) => a.id !== 'agent-main');
  if (sortOrder === 'asc') {
    fieldAgents = [...fieldAgents].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } else if (sortOrder === 'desc') {
    fieldAgents = [...fieldAgents].sort((a, b) => b.name.localeCompare(a.name, 'ar'));
  }

  const handleOpenSettle = (ag: Agent) => {
    setSettlingAgent(ag);
    setSettleAmount(ag.totalDebt);
    setSettleNote('');
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingAgent || settleAmount <= 0) return;
    onSettleDebt(settlingAgent.id, settleAmount, settleNote);
    setSettlingAgent(null);
  };

  const handleOpenBranding = (ag: Agent) => {
    setBrandingAgent(ag);
    setCustomShopName(ag.customShopName || ag.name);
    setCustomPhone(ag.phone);
    setCustomRegion(ag.region);
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandingAgent) return;
    onUpdateAgentBranding(brandingAgent.id, {
      customShopName,
      phone: customPhone,
      region: customRegion
    });
    setBrandingAgent(null);
  };

  const handleExportAgentsExcel = () => {
    const exportData = fieldAgents.map((ag, index) => ({
      'ت': index + 1,
      'اسم الوكيل': ag.name,
      'رمز الوكيل': ag.code,
      'المنطقة': ag.region,
      'المشتركون الفعالون': ag.activeSubscriptions,
      'المشتركون المنتهون': ag.inactiveSubscriptions,
      'إجمالي المبيعات (د.ع)': ag.totalSales,
      'المسدد للرئيسية (د.ع)': ag.totalPaid,
      'الدين المستحق (د.ع)': ag.totalDebt,
      'الهاتف': ag.phone
    }));
    excelService.exportDebts(
      exportData.map(d => ({
        name: d['اسم الوكيل'],
        agentName: d['المنطقة'],
        code: d['رمز الوكيل'],
        totalAmount: d['إجمالي المبيعات (د.ع)'],
        paidAmount: d['المسدد للرئيسية (د.ع)'],
        remainingAmount: d['الدين المستحق (د.ع)'],
        dueDate: 'نشط',
        notes: `فعال: ${d['المشتركون الفعالون']} | منتهي: ${d['المشتركون المنتهون']} | الهاتف: ${d['الهاتف']}`
      })),
      'تقرير_أداء_الوكلاء_الساري.xlsx'
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Title Header & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="text-xs font-bold text-slate-400 mb-1">{fieldAgents.length} وكيل معتمد</div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>قائمة الوكلاء المعتمدين وملخص الأداء المالي</span>
            <span className="text-xl">📊</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إحصائيات تفصيلية بالمبيعات، التسديدات، الأجهزة المتبقية، الديون والاشتراكات لكل وكيل
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sorting Buttons as requested */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? null : 'asc')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                sortOrder === 'asc' ? 'bg-sky-900 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
              title="ترتيب أبجدي من الألف إلى الياء"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>ترتيب أ-ي</span>
            </button>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? null : 'desc')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                sortOrder === 'desc' ? 'bg-sky-900 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
              title="ترتيب أبجدي من الياء إلى الألف"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>ترتيب ي-أ</span>
            </button>
          </div>

          {/* View Mode Toggle: Grid Cards vs Dynamic Table */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-sky-900 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>بطاقات</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-sky-900 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>جدول</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>تحديد تاريخ التقرير:</span>
          </span>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">من تاريخ:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">إلى تاريخ:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <button
            onClick={() => {}}
            className="px-3.5 py-1.5 bg-sky-700 text-white rounded-xl font-bold hover:bg-sky-800 cursor-pointer shadow-xs"
          >
            تطبيق 🔍
          </button>

          {/* Quick period buttons */}
          <div className="flex flex-wrap items-center gap-1 mr-auto">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'yesterday', label: 'أمس' },
              { id: 'this_week', label: 'هذا الأسبوع' },
              { id: 'this_month', label: 'هذا الشهر' },
              { id: 'last_month', label: 'الشهر الماضي' },
              { id: 'this_year', label: 'هذا العام' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setDateFilter(btn.id as any)}
                className={`px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                  dateFilter === btn.id
                    ? 'bg-sky-800 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conditional View: Grid Cards vs Dynamic Summary Table */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {fieldAgents.map((ag) => {
            const hasDebt = ag.totalDebt > 0;
            return (
              <div
                key={ag.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Agent Header */}
                  <div className="flex items-start justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        hasDebt
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {hasDebt ? 'عليه ديون مستحقة' : 'حساب خالص'}
                    </span>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-900 dark:text-slate-100">{ag.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ag.code}</div>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-sky-900 text-white font-black flex items-center justify-center text-sm shadow-xs">
                        {ag.avatarInitials}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Subscriber Stats */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">إجمالي المبيعات</div>
                      <div className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                        {ag.totalSales.toLocaleString()} <span className="text-[10px]">د.ع</span>
                      </div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-950/40 p-2.5 rounded-2xl border border-red-200 dark:border-red-900 text-center">
                      <div className="text-[10px] text-red-600 dark:text-red-400 font-bold">الديون المستحقة</div>
                      <div className="font-mono font-black text-red-600 dark:text-red-400 text-sm mt-0.5">
                        {ag.totalDebt.toLocaleString()} <span className="text-[10px]">د.ع</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Count Badges */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">مشتركون فعالون</div>
                      <div className="font-mono font-black text-emerald-800 dark:text-emerald-200 text-sm">
                        {ag.activeSubscriptions}
                      </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                      <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">منتهون / غير فعال</div>
                      <div className="font-mono font-black text-amber-800 dark:text-amber-200 text-sm">
                        {ag.inactiveSubscriptions}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
                    <span>رقعة التغطية:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{ag.region}</span>
                  </div>

                  {/* Agent Credentials as requested */}
                  <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">اسم المستخدم:</span>
                      <span className="font-mono font-bold text-sky-800 dark:text-sky-300">{ag.username || 'agent'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">الرمز السري:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {visiblePasswords[ag.id] ? (ag.password || '123456') : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(ag.id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 transition-colors cursor-pointer"
                          title={visiblePasswords[ag.id] ? 'إخفاء الرمز' : 'إظهار الرمز'}
                        >
                          {visiblePasswords[ag.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => handleOpenSettle(ag)}
                      className="py-1.5 px-2 bg-sky-900 hover:bg-sky-800 text-white rounded-xl text-[11px] font-bold text-center transition-colors cursor-pointer"
                    >
                      تسديد الديون
                    </button>
                    <button
                      onClick={() => onViewSales(ag.id)}
                      className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold text-center transition-colors cursor-pointer"
                    >
                      سجل المبيعات
                    </button>
                    <button
                      onClick={() => onViewSubscribers(ag.id)}
                      className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold text-center transition-colors cursor-pointer"
                    >
                      عرض المشتركين
                    </button>
                  </div>

                  <button
                    onClick={() => handleOpenBranding(ag)}
                    className="w-full py-1.5 px-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-900 dark:text-amber-200 rounded-xl text-[11px] font-bold text-center border border-amber-200 dark:border-amber-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>تخصيص هوية الوكيل وإعدادات البوابة</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dynamic Summary Table View with detailed columns */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-black text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>جدول الأداء المالي والميداني التفصيلي للوكلاء</span>
            <span className="text-xs text-slate-400 font-normal">عرض {fieldAgents.length} وكيل</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="py-3.5 px-4">اسم الوكيل والرمز</th>
                  <th className="py-3.5 px-3">منطقة التغطية</th>
                  <th className="py-3.5 px-3 text-center">مشتركون فعالون</th>
                  <th className="py-3.5 px-3 text-center">مشتركون منتهون</th>
                  <th className="py-3.5 px-3">إجمالي المبيعات</th>
                  <th className="py-3.5 px-3">المسدد للرئيسية</th>
                  <th className="py-3.5 px-3">الديون المستحقة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fieldAgents.map((ag) => {
                  const hasDebt = ag.totalDebt > 0;
                  return (
                    <tr key={ag.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-sky-900 text-white font-bold flex items-center justify-center text-xs">
                            {ag.avatarInitials}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-slate-100">{ag.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{ag.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-medium">{ag.region}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-xs">
                          {ag.activeSubscriptions}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono font-bold text-xs">
                          {ag.inactiveSubscriptions}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {ag.totalSales.toLocaleString()} د.ع
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {ag.totalPaid.toLocaleString()} د.ع
                      </td>
                      <td className="py-3.5 px-3 font-mono font-black text-red-600 dark:text-red-400 text-sm">
                        {ag.totalDebt.toLocaleString()} د.ع
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenSettle(ag)}
                            className="px-2.5 py-1.5 bg-sky-900 hover:bg-sky-800 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            تسديد
                          </button>
                          <button
                            onClick={() => onViewSales(ag.id)}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            المبيعات
                          </button>
                          <button
                            onClick={() => onViewSubscribers(ag.id)}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            المشتركون
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FOOTER OF AGENTS PAGE: Excel Export & Summary Card as requested */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-emerald-950/40 p-6 rounded-3xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">تصدير تقرير أداء الوكلاء الشامل</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              تصدير كافة بيانات المبيعات، الاشتراكات الفعالة، والديون المستحقة لجميع الوكلاء إلى ملف Excel معتمد.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportAgentsExcel}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>تصدير تقرير الوكلاء (Excel)</span>
        </button>
      </div>

      {/* Settle Debt Modal */}
      {settlingAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                تسديد ديون الوكيل: {settlingAgent.name}
              </h3>
              <button onClick={() => setSettlingAgent(null)} className="text-slate-400 p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-900 flex justify-between items-center">
                <span className="font-bold text-red-800 dark:text-red-300">إجمالي الدين المستحق حالياً:</span>
                <span className="font-black text-red-900 dark:text-red-200 font-mono text-base">
                  {settlingAgent.totalDebt.toLocaleString()} د.ع
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المبلغ المراد تسديده (د.ع) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  max={settlingAgent.totalDebt}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظة / وصل الاستلام</label>
                <input
                  type="text"
                  placeholder="مثال: تسديد نقد يدوي في المركز أو حوالة زين كاش"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingAgent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-900 text-white font-bold hover:bg-sky-800 shadow-sm cursor-pointer"
                >
                  تأكيد وقبض التسديد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customize Agent Branding Modal */}
      {brandingAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                تخصيص هوية الوكيل: {brandingAgent.name}
              </h3>
              <button onClick={() => setBrandingAgent(null)} className="text-slate-400 p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBranding} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المكتب / المتجر التجاري</label>
                <input
                  type="text"
                  value={customShopName}
                  onChange={(e) => setCustomShopName(e.target.value)}
                  placeholder="اسم يظهر في الفاتورة وبوابة الوكيل"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف الرسمي للتواصل والواتساب</label>
                <input
                  type="tel"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المنطقة ورقعة التغطية الميدانية</label>
                <input
                  type="text"
                  value={customRegion}
                  onChange={(e) => setCustomRegion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBrandingAgent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 cursor-pointer"
                >
                  حفظ وتطبيق الهوية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

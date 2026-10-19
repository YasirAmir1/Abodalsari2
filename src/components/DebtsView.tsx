import React, { useState } from 'react';
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
import { Agent, Subscriber } from '../types';
import { excelService } from '../services/excelService';

interface DebtsViewProps {
  agents: Agent[];
  subscribers: Subscriber[];
  onSettleAgentDebt: (agentId: string, amount: number) => void;
  onSettleSubscriberDebt: (subscriberId: string) => void;
  onResetAgentData: (agentId: string) => void;
  onOpenWhatsApp: (sub: Subscriber) => void;
  onSelectDeviceQr?: (deviceId: string, subscriberName?: string, agentName?: string) => void;
  onDeleteSubscriber: (subscriberId: string) => void;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  agents,
  subscribers,
  onSettleAgentDebt,
  onSettleSubscriberDebt,
  onResetAgentData,
  onOpenWhatsApp,
  onSelectDeviceQr,
  onDeleteSubscriber
}) => {
  const [activeTab, setActiveTab] = useState<'agents' | 'subscribers'>('agents');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const [debtSearchTerm, setDebtSearchTerm] = useState<string>('');

  const computedAgents = agents.map((ag) => {
    const agentDebtSubs = subscribers.filter(
      (s) => s.paymentStatus === 'debt' && (s.agentId === ag.id || s.agentName === ag.name)
    );
    const calculatedDebt = agentDebtSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
    return {
      ...ag,
      totalDebt: calculatedDebt,
      hasDebt: calculatedDebt > 0
    };
  });

  const totalAgentDebts = computedAgents.reduce((sum, ag) => sum + ag.totalDebt, 0);
  const debtSubscribers = subscribers.filter((s) => s.paymentStatus === 'debt');
  const grandTotalDebt = totalAgentDebts;

  // Filter Agents Table
  const filteredAgents = computedAgents.filter((ag) => {
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
  });

  // Filter Subscribers Debt Table
  const filteredDebtSubscribers = debtSubscribers.filter((sub) => {
    if (selectedAgentFilter !== 'all' && sub.agentId !== selectedAgentFilter && sub.agentName !== selectedAgentFilter) {
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
  });

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
      const exportData = debtSubscribers.map(sub => ({
        name: sub.name,
        agentName: sub.agentName,
        code: sub.deviceId,
        totalAmount: sub.amount,
        paidAmount: 0,
        remainingAmount: sub.amount,
        dueDate: sub.endDate,
        notes: sub.subscriptionType
      }));
      excelService.exportDebts(exportData, 'ديون_المشتركين_المباشرة.xlsx');
    }
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
          {/* Total Debts Display Card */}
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-5 py-2.5 rounded-2xl text-center shadow-xs">
            <div className="text-xl font-black text-red-600 dark:text-red-400 font-mono">
              {grandTotalDebt.toLocaleString()} <span className="text-xs font-bold text-red-500">د.ع</span>
            </div>
            <div className="text-[11px] text-red-700 dark:text-red-300 font-bold">إجمالي الديون القائمة</div>
          </div>

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
          <span>ديون الوكلاء المستحقة ({agents.filter((a) => a.totalDebt > 0).length})</span>
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
          {agents.map((ag) => {
            const isSelected = selectedAgentFilter === ag.id || selectedAgentFilter === ag.name;
            const subDebtsForAgent = debtSubscribers.filter((s) => s.agentId === ag.id || s.agentName === ag.name).length;
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
                {activeTab === 'agents' ? (
                  hasDebt ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300">
                      {ag.totalDebt.toLocaleString()} د.ع
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      غير مديون
                    </span>
                  )
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {subDebtsForAgent}
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
                                  const amount = prompt(`أدخل مبلغ التسديد للوكيل ${ag.name}:`, String(ag.totalDebt));
                                  if (amount && Number(amount) > 0) {
                                    onSettleAgentDebt(ag.id, Number(amount));
                                  }
                                }}
                                className="px-3.5 py-1.5 bg-sky-900 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                              >
                                تسديد دفعة
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف/تصفير دين الوكيل ${ag.name} بالكامل؟`)) {
                                    onSettleAgentDebt(ag.id, ag.totalDebt);
                                  }
                                }}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                title="حذف/تصفير الدين بالكامل"
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
                              if (confirm(`تحذير: هل أنت متأكد من تصفير (المبيعات، الديون، والمبالغ المسددة) للوكيل ${ag.name}؟ هذا الإجراء نهائي.`)) {
                                onResetAgentData(ag.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            title="تصفير كافة المبيعات والديون للوكيل"
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

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
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
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      لا يوجد مشتركون بديون يطابقون خيار التصنيف المحدد
                    </td>
                  </tr>
                ) : (
                  filteredDebtSubscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
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
                        {sub.amount.toLocaleString()} د.ع
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
                            if (confirm('هل أنت متأكد من تصفير دين هذا المشترك؟')) {
                              onSettleSubscriberDebt(sub.id);
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          تصفير الدين
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف بيانات هذا المشترك نهائياً؟')) {
                              onDeleteSubscriber(sub.id);
                            }
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

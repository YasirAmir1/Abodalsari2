import React, { useState, useMemo, useEffect } from 'react';
import {
  DollarSign,
  Save,
  RotateCcw,
  CheckCircle2,
  Lightbulb,
  Building2,
  Tv,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  Edit2,
  Undo2,
  RefreshCw,
  Filter,
  Users
} from 'lucide-react';
import { Agent, Invoice, PricingRow, Subscriber } from '../types';
import { useAppDialogs } from './AppDialogProvider';
import { SecurityActionModal } from './SecurityActionModal';
import { ReportsView } from './ReportsView';

interface PricingViewProps {
  pricing: PricingRow[];
  agents: Agent[];
  subscribers: Subscriber[];
  invoices: Invoice[];
  onSavePricing: (rows: PricingRow[]) => void;
  onUpdateAgent: (agentId: string, branding: Partial<Agent>) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  pricing = [],
  agents = [],
  subscribers = [],
  invoices = [],
  onSavePricing,
  onUpdateAgent
}) => {
  const { showAlert } = useAppDialogs();
  
  const SYSTEM_DEFAULTS = {
    newDevice: 25000,
    oneMonth: 22000,
    twoMonths: 44000,
    threeMonths: 66000
  };

  const getFullPricingRows = (currentPricing: PricingRow[], currentAgents: Agent[]): PricingRow[] => {
    const agentsToUse = (currentAgents && currentAgents.length > 0) ? currentAgents : [];
    
    if (agentsToUse.length === 0) return [];
    
    const result: PricingRow[] = [];
    agentsToUse.forEach(agent => {
      if (!agent || !agent.id) return;
      
      const existing = (currentPricing || []).find(p => p.agentId === agent.id);
      
      const creds = {
        username: existing?.username || agent.username || '',
        password: existing?.password || agent.password || ''
      };

      if (existing) {
        result.push({
          ...existing,
          ...creds,
          agentName: agent.name || 'جهة غير مسماة',
          agentCode: agent.code || agent.id
        });
      } else {
        result.push({
          agentId: agent.id,
          agentName: agent.name || 'جهة غير مسماة',
          agentCode: agent.code || agent.id,
          newDevicePrice: SYSTEM_DEFAULTS.newDevice,
          oneMonthPrice: SYSTEM_DEFAULTS.oneMonth,
          twoMonthsPrice: SYSTEM_DEFAULTS.twoMonths,
          threeMonthsPrice: SYSTEM_DEFAULTS.threeMonths,
          status: agent.id === 'agent-main' ? 'معتمدة (المرجع)' : 'مسودة',
          isReference: agent.id === 'agent-main',
          ...creds
        });
      }
    });

    return result.sort((a, b) => {
      if (a.agentId === 'agent-main') return -1;
      if (b.agentId === 'agent-main') return 1;
      return (a.agentName || '').localeCompare((b.agentName || ''), 'ar');
    });
  };

  const [rows, setRows] = useState<PricingRow[]>(() => getFullPricingRows(pricing, agents));
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editingCredentials, setEditingCredentials] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentFull = getFullPricingRows(pricing, agents);
    const newModified = new Set<string>();
    
    rows.forEach(row => {
      const original = currentFull.find(r => r.agentId === row.agentId);
      if (original) {
        const isDifferent = 
          row.newDevicePrice !== original.newDevicePrice ||
          row.oneMonthPrice !== original.oneMonthPrice ||
          row.twoMonthsPrice !== original.twoMonthsPrice ||
          row.threeMonthsPrice !== original.threeMonthsPrice ||
          row.status !== original.status ||
          row.username !== original.username ||
          row.password !== original.password;
        
        if (isDifferent) {
          newModified.add(row.agentId);
        }
      }
    });
    setModifiedIds(newModified);
  }, [rows, pricing, agents]);

  useEffect(() => {
    const fullRows = getFullPricingRows(pricing, agents);
    if (modifiedIds.size === 0 && fullRows.length > 0) {
      setRows(fullRows);
    }
  }, [pricing, agents, modifiedIds.size]);

  const handleCellChange = (index: number, field: keyof PricingRow, value: number | string) => {
    const updated = [...rows];
    if (updated[index]) {
      updated[index] = { ...updated[index], [field]: value } as PricingRow;
      setRows(updated);
    }
  };

  const togglePasswordVisibility = (agentId: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const toggleEditingCredentials = (agentId: string) => {
    setEditingCredentials(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const handleApplyWholesaleAll = () => {
    const updated = rows.map((r) => ({
      ...r,
      newDevicePrice: SYSTEM_DEFAULTS.newDevice,
      oneMonthPrice: SYSTEM_DEFAULTS.oneMonth,
      twoMonthsPrice: SYSTEM_DEFAULTS.twoMonths,
      threeMonthsPrice: SYSTEM_DEFAULTS.threeMonths,
      status: (r.agentId === 'agent-main' ? 'معتمدة (المرجع)' : 'معتمدة (تطبق في البيع)') as any
    }));
    setRows(updated);
  };

  const handleResetToSystemDefaults = () => {
    const updated = rows.map((r) => ({
      ...r,
      newDevicePrice: SYSTEM_DEFAULTS.newDevice,
      oneMonthPrice: SYSTEM_DEFAULTS.oneMonth,
      twoMonthsPrice: SYSTEM_DEFAULTS.twoMonths,
      threeMonthsPrice: SYSTEM_DEFAULTS.threeMonths
    }));
    setRows(updated);
    showAlert('تمت إعادة تعيين القيم إلى أسعار النظام الافتراضية.', 'إعادة تعيين', 'info');
  };

  const handleSaveAll = () => {
    if (rows.length === 0) {
      showAlert('لا توجد بيانات أسعار لحفظها.', 'تنبيه', 'warning');
      return;
    }
    setShowSecurityModal(true);
  };

  const handleConfirmSavePricing = () => {
    onSavePricing(rows);
    setModifiedIds(new Set());
    showAlert('تم حفظ وتثبيت أسعار الوكلاء والمركز بنجاح!', 'تثبيت الأسعار', 'success');
    setShowSecurityModal(false);
  };

  const centerRow = rows.find((r) => r.agentId === 'agent-main') || rows[0];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 dark:from-slate-950 dark:via-sky-950/70 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-sky-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                <DollarSign className="w-3.5 h-3.5" />
                جدول التسعير الرسمي
              </span>
              <span className="text-xs font-medium text-slate-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
                {rows.length} جهة بيع
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>الأسعار والرسائل</span>
              <Sparkles className="w-6 h-6 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              جدول تفاعلي شامل لتحديد أسعار الأجهزة وتجديد الاشتراكات لكل وكيل بشكل مستقل مع إدارة أمنية بيانات الدخول.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={modifiedIds.size === 0}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                modifiedIds.size > 0 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse' 
                : 'bg-white/10 text-slate-400 cursor-not-allowed border border-white/5'
              }`}
              title="حفظ التغييرات"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التغييرات ({modifiedIds.size})</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-800/40 shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي جهات البيع</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">{rows.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/40 shadow-xs">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">تعديلات معلقة</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">{modifiedIds.size}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-800/40 shadow-xs">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">سعر الجهاز (مرجع)</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              {centerRow?.newDevicePrice?.toLocaleString() || 0} <span className="text-xs font-normal">د.ع</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/40 shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">حالة النظام</p>
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-1">نظام التسعير نشط</p>
          </div>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-600" />
            جدول الأسعار وإدارة بيانات الوكلاء
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToSystemDefaults}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-300 text-[11px] font-bold transition-all border border-slate-200 dark:border-slate-700"
            >
              إعادة تعيين للأصل
            </button>
            <button
              onClick={handleApplyWholesaleAll}
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold hover:bg-amber-100 transition-all"
            >
              تطبيق أسعار الجملة للكل
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="py-4 px-5">الجهة / الوكيل المسؤول</th>
                <th className="py-4 px-3 text-center">سعر الجهاز الجديد</th>
                <th className="py-4 px-3 text-center">باقة شهر واحد</th>
                <th className="py-4 px-3 text-center">باقة شهرين</th>
                <th className="py-4 px-3 text-center">باقة 3 أشهر</th>
                <th className="py-4 px-5 text-center">حالة الاعتماد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, index) => {
                const isModified = modifiedIds.has(row.agentId);
                const isHQ = row.agentId === 'agent-main';
                
                return (
                  <tr key={row.agentId} className={`transition-colors duration-200 ${isModified ? 'bg-amber-50/20 dark:bg-amber-950/10' : (isHQ ? 'bg-sky-50/20 dark:bg-sky-950/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20')}`}>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs border ${isHQ ? 'bg-sky-900 text-white border-sky-800' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                          {row.agentName.substring(0, 1)}
                        </div>
                        <div className="flex-1 min-w-[150px]">
                          <div className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            {row.agentName}
                            {isHQ && <span className="bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase">HQ</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{row.agentCode}</div>
                          
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                             {editingCredentials.has(row.agentId) ? (
                               <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                                 <input type="text" value={row.username || ''} onChange={(e) => handleCellChange(index, 'username', e.target.value)} className="text-[10px] w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 font-mono outline-hidden focus:ring-1 focus:ring-sky-500" placeholder="المستخدم" />
                                 <div className="relative">
                                   <input type={visiblePasswords.has(row.agentId) ? "text" : "password"} value={row.password || ''} onChange={(e) => handleCellChange(index, 'password', e.target.value)} className="text-[10px] w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 font-mono outline-hidden focus:ring-1 focus:ring-sky-500" placeholder="الرمز" />
                                   <button type="button" onClick={() => togglePasswordVisibility(row.agentId)} className="absolute left-1 top-1 text-slate-400"><Eye className="w-3 h-3" /></button>
                                 </div>
                                 <button type="button" onClick={() => toggleEditingCredentials(row.agentId)} className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md w-full">تأكيد</button>
                               </div>
                             ) : (
                               <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                                 <div className="flex flex-col gap-0.5 text-[10px]">
                                    <span className="text-slate-400 font-bold">مستخدم: <span className="text-slate-900 dark:text-slate-200">{row.username || '---'}</span></span>
                                    <span className="text-slate-400 font-bold">رمز: <span className="text-slate-900 dark:text-slate-200 font-mono">{visiblePasswords.has(row.agentId) ? (row.password || '---') : '••••••'}</span></span>
                                 </div>
                                 <div className="flex flex-col gap-1">
                                    <button onClick={() => togglePasswordVisibility(row.agentId)} className="p-1 text-slate-400 hover:text-sky-600"><Eye className="w-3 h-3" /></button>
                                    <button onClick={() => toggleEditingCredentials(row.agentId)} className="p-1 text-slate-400 hover:text-amber-600"><Edit2 className="w-3 h-3" /></button>
                                 </div>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-3"><input type="number" value={row.newDevicePrice || 0} onChange={(e) => handleCellChange(index, 'newDevicePrice', Number(e.target.value))} className={`w-28 px-3 py-2 rounded-xl border text-center font-bold text-xs focus:ring-2 focus:ring-sky-500 outline-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 ${isModified ? 'border-amber-300' : ''}`} /></td>
                    <td className="py-4 px-3"><input type="number" value={row.oneMonthPrice || 0} onChange={(e) => handleCellChange(index, 'oneMonthPrice', Number(e.target.value))} className={`w-28 px-3 py-2 rounded-xl border text-center font-bold text-xs focus:ring-2 focus:ring-sky-500 outline-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 ${isModified ? 'border-amber-300' : ''}`} /></td>
                    <td className="py-4 px-3"><input type="number" value={row.twoMonthsPrice || 0} onChange={(e) => handleCellChange(index, 'twoMonthsPrice', Number(e.target.value))} className={`w-28 px-3 py-2 rounded-xl border text-center font-bold text-xs focus:ring-2 focus:ring-sky-500 outline-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 ${isModified ? 'border-amber-300' : ''}`} /></td>
                    <td className="py-4 px-3"><input type="number" value={row.threeMonthsPrice || 0} onChange={(e) => handleCellChange(index, 'threeMonthsPrice', Number(e.target.value))} className={`w-28 px-3 py-2 rounded-xl border text-center font-bold text-xs focus:ring-2 focus:ring-sky-500 outline-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 ${isModified ? 'border-amber-300' : ''}`} /></td>
                    
                    <td className="py-4 px-5 text-center">
                      <button
                        onClick={() => {
                          const updated = [...rows];
                          updated[index].status = updated[index].status.includes('معتمدة') ? 'مسودة' : (isHQ ? 'معتمدة (المرجع)' : 'معتمدة (تطبق في البيع)');
                          setRows(updated);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                          row.status.includes('معتمدة') 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {row.status}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ReportsView agents={agents} subscribers={subscribers} invoices={invoices} />

      {showSecurityModal && (
        <SecurityActionModal
          isOpen={showSecurityModal}
          actionType="SAVE_PRICING"
          actionName="حفظ وتثبيت الأسعار الجديدة"
          targetDescription="تأكيد التثبيت النهائي لجدول الأسعار المحدث. سيؤدي هذا الإجراء إلى تحديث السحابة وإعادة حساب المديونيات لكافة الوكلاء فوراً."
          details={[
            { label: 'عدد الجهات التي تم تعديلها', value: `${modifiedIds.size} جهة` },
            { label: 'سعر الاشتراك (المركز)', value: `${centerRow?.oneMonthPrice?.toLocaleString()} د.ع` }
          ]}
          confirmButtonText="تأكيد وحفظ التغييرات"
          onConfirm={handleConfirmSavePricing}
          onClose={() => setShowSecurityModal(false)}
        />
      )}
    </div>
  );
};

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
  RefreshCw,
  Undo2
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

  useEffect(() => {
    console.log('[PricingView] Props updated:', {
      pricingCount: (pricing || []).length,
      agentsCount: (agents || []).length,
      firstAgentName: agents && agents[0]?.name
    });
  }, [pricing, agents]);
  
  // System Default Prices
  const SYSTEM_DEFAULTS = {
    newDevice: 25000,
    oneMonth: 22000,
    twoMonths: 44000,
    threeMonths: 66000
  };

  const getFullPricingRows = (currentPricing: PricingRow[], currentAgents: Agent[]): PricingRow[] => {
    // Defensive check: if no agents, we can't show rows. 
    // However, we should at least try to show the reference/main center if possible.
    const agentsToUse = (currentAgents && currentAgents.length > 0) ? currentAgents : [];
    
    if (agentsToUse.length === 0) {
      console.warn('[PricingView] No agents provided to getFullPricingRows');
      return [];
    }
    
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
      const nameA = a.agentName || '';
      const nameB = b.agentName || '';
      return nameA.localeCompare(nameB, 'ar');
    });
  };

  const [rows, setRows] = useState<PricingRow[]>(() => getFullPricingRows(pricing, agents));
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editingCredentials, setEditingCredentials] = useState<Set<string>>(new Set());

  // Track modifications
  useEffect(() => {
    const currentFull = getFullPricingRows(pricing, agents);
    if (currentFull.length === 0 && rows.length > 0) return; // Don't wipe local state if props momentarily empty

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

  // Sync state with props when props change (only if not locally modified to avoid overwriting user typing)
  useEffect(() => {
    const fullRows = getFullPricingRows(pricing, agents);
    if (modifiedIds.size === 0 && fullRows.length > 0) {
      setRows(fullRows);
    }
  }, [pricing, agents, modifiedIds.size]);

  const handleCellChange = (
    index: number,
    field: keyof PricingRow,
    value: number | string
  ) => {
    const updated = [...rows];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        [field]: value
      } as PricingRow;
      setRows(updated);
    }
  };

  const togglePasswordVisibility = (agentId: string) => {
    const next = new Set(visiblePasswords);
    if (next.has(agentId)) next.delete(agentId);
    else next.add(agentId);
    setVisiblePasswords(next);
  };

  const toggleEditingCredentials = (agentId: string) => {
     const next = new Set(editingCredentials);
     if (next.has(agentId)) next.delete(agentId);
     else next.add(agentId);
     setEditingCredentials(next);
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
    showAlert('تمت إعادة تعيين القيم إلى أسعار النظام الافتراضية. يرجى الضغط على حفظ لتثبيتها.', 'إعادة تعيين', 'info');
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
    setModifiedIds(new Set()); // Clear modified flags after save
    showAlert('تم حفظ وتثبيت أسعار الوكلاء والمركز بنجاح وإعادة حساب القياسات!', 'تثبيت الأسعار', 'success');
    setShowSecurityModal(false);
  };

  const centerRow = rows.find((r) => r.agentId === 'agent-main') || rows[0] || {
    newDevicePrice: SYSTEM_DEFAULTS.newDevice,
    oneMonthPrice: SYSTEM_DEFAULTS.oneMonth,
    twoMonthsPrice: SYSTEM_DEFAULTS.twoMonths,
    threeMonthsPrice: SYSTEM_DEFAULTS.threeMonths
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-sky-700 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            جدول التسعير الرسمي الموحد
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            الأسعار والرسائل (جدول أسعار الوكلاء والمركز)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            جدول تفاعلي شامل لتحديد أسعار الأجهزة وتجديد الاشتراكات لكل وكيل بشكل مستقل
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetToSystemDefaults}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
            title="العودة لأسعار النظام الأساسية (22/44/66)"
          >
            <Undo2 className="w-4 h-4" />
            <span>إعادة تعيين للأصل</span>
          </button>

          <button
            onClick={handleApplyWholesaleAll}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-all border border-amber-200 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>تطبيق أسعار الجملة للكل</span>
          </button>

          <button
            onClick={handleSaveAll}
            className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-all flex items-center gap-2 active:scale-95 ${
              modifiedIds.size > 0 ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse' : 'bg-sky-900 hover:bg-sky-800'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>حفظ التغييرات ({modifiedIds.size})</span>
          </button>
        </div>
      </div>

      {/* Important Notice Box */}
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Lightbulb className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="font-bold text-sky-950 text-xs">تنبيه المزامنة الفورية:</h4>
          <p className="text-sky-800 text-xs mt-0.5 leading-relaxed">
            عند الضغط على "حفظ التغييرات"، سيتم تحديث الأسعار في السحابة فوراً وإعادة حساب كافة ديون الوكلاء وأرباحهم بناءً على الأسعار الجديدة.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 font-bold text-[10px] uppercase tracking-wider">
            <span>إجمالي جهات البيع</span>
            <Building2 className="w-4 h-4 text-sky-700" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">{rows.length}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 font-bold text-[10px] uppercase tracking-wider">
            <span>تعديلات معلقة</span>
            <div className={`w-2 h-2 rounded-full ${modifiedIds.size > 0 ? 'bg-amber-500 animate-ping' : 'bg-slate-300'}`} />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">{modifiedIds.size}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 font-bold text-[10px] uppercase tracking-wider">
            <span>سعر الجهاز الموحد</span>
            <Tv className="w-4 h-4 text-sky-700" />
          </div>
          <div className="text-2xl font-black text-sky-900 mt-2 font-mono">
            {centerRow?.newDevicePrice?.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 font-bold text-[10px] uppercase tracking-wider">
            <span>حالة الأسعار</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-sm font-bold text-emerald-800 mt-2">نظام التسعير نشط</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900">📊 جدول الأسعار التفاعلي (إدخال مباشر)</h3>
          {modifiedIds.size > 0 && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
              يوجد تعديلات غير محفوظة
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-4 px-5 min-w-[200px]">الجهة / الوكيل المسؤول</th>
                <th className="py-4 px-3 text-center">سعر الجهاز الجديد</th>
                <th className="py-4 px-3 text-center">باقة شهر واحد</th>
                <th className="py-4 px-3 text-center">باقة شهرين</th>
                <th className="py-4 px-3 text-center">باقة 3 أشهر</th>
                <th className="py-4 px-5 text-center">حالة الاعتماد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-medium">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    جاري تحميل بيانات التراخيص والأسعار...
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const isModified = modifiedIds.has(row.agentId);
                  const isHQ = row.agentId === 'agent-main';
                  
                  return (
                    <tr key={row.agentId} className={`transition-colors duration-200 ${isModified ? 'bg-amber-50/40' : (isHQ ? 'bg-sky-50/20' : 'hover:bg-slate-50/50')}`}>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs border ${isHQ ? 'bg-sky-900 text-white border-sky-800' : 'bg-white text-slate-700 border-slate-200'}`}>
                            {row.agentName.substring(0, 1)}
                          </div>
                          <div className="flex-1">
                            <div className="font-black text-slate-900 flex items-center gap-1.5">
                              {row.agentName}
                              {isHQ && <span className="bg-sky-100 text-sky-700 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">HQ</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono tracking-tight">{row.agentCode}</div>
                            
                            {/* Credentials Section */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100/60">
                               {editingCredentials.has(row.agentId) ? (
                                 <div className="space-y-1.5 bg-sky-50/50 p-2 rounded-xl border border-sky-100 animate-in fade-in zoom-in-95 duration-200">
                                   <div className="flex items-center gap-1">
                                      <span className="text-[8px] font-bold text-slate-400 whitespace-nowrap min-w-[50px]">المستخدم:</span>
                                      <input 
                                        type="text" 
                                        value={row.username || ''} 
                                        onChange={(e) => handleCellChange(index, 'username', e.target.value)}
                                        className="text-[10px] w-full px-2 py-1 border border-slate-200 rounded-lg bg-white font-mono focus:ring-1 focus:ring-sky-400 outline-none"
                                        placeholder="اسم المستخدم"
                                      />
                                   </div>
                                   <div className="flex items-center gap-1">
                                      <span className="text-[8px] font-bold text-slate-400 whitespace-nowrap min-w-[50px]">الرمز:</span>
                                      <div className="relative w-full">
                                        <input 
                                          type={visiblePasswords.has(row.agentId) ? "text" : "password"} 
                                          value={row.password || ''} 
                                          onChange={(e) => handleCellChange(index, 'password', e.target.value)}
                                          className="text-[10px] w-full px-2 py-1 border border-slate-200 rounded-lg bg-white font-mono focus:ring-1 focus:ring-sky-400 outline-none pr-7"
                                          placeholder="الرمز السري"
                                        />
                                        <button 
                                          type="button"
                                          onClick={() => togglePasswordVisibility(row.agentId)}
                                          className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 p-1"
                                        >
                                          {visiblePasswords.has(row.agentId) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                   </div>
                                   <div className="flex justify-end">
                                     <button 
                                       type="button"
                                       onClick={() => toggleEditingCredentials(row.agentId)}
                                       className="text-[9px] font-black text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
                                     >
                                       تم (تأكيد)
                                     </button>
                                   </div>
                                 </div>
                               ) : (
                                 <div className="flex items-center justify-between gap-2 bg-slate-50/50 hover:bg-slate-50 p-2 rounded-xl border border-slate-100/80 transition-colors group/creds">
                                   <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className="text-[8px] text-slate-400 font-bold">مستخدم:</span>
                                        <span className="text-[10px] font-mono font-black text-sky-800 truncate">{row.username || '---'}</span>
                                      </div>
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className="text-[8px] text-slate-400 font-bold">رمز:</span>
                                        <span className="text-[10px] font-mono font-bold text-slate-500 truncate">
                                          {visiblePasswords.has(row.agentId) ? (row.password || '---') : '••••••'}
                                        </span>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-0.5 opacity-40 group-hover/creds:opacity-100 transition-opacity">
                                      <button 
                                        type="button"
                                        onClick={() => togglePasswordVisibility(row.agentId)}
                                        className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-sky-600 transition-colors shadow-xs border border-transparent hover:border-slate-100"
                                        title="إظهار / إخفاء الرمز"
                                      >
                                        {visiblePasswords.has(row.agentId) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => toggleEditingCredentials(row.agentId)}
                                        className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-amber-600 transition-colors shadow-xs border border-transparent hover:border-slate-100"
                                        title="تعديل بيانات الدخول"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                   </div>
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Inputs with visual distinction */}
                      <td className="py-4 px-3">
                        <div className="relative group max-w-[120px] mx-auto">
                          <input
                            type="number"
                            value={row.newDevicePrice || 0}
                            onChange={(e) => handleCellChange(index, 'newDevicePrice', Number(e.target.value))}
                            className={`w-full px-3 py-2 rounded-xl border text-center font-bold text-sm transition-all focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none ${
                              isModified ? 'border-amber-300 bg-white shadow-sm ring-1 ring-amber-100' : 'border-slate-200 bg-slate-50/50 group-hover:bg-white'
                            }`}
                          />
                        </div>
                      </td>
                      
                      <td className="py-4 px-3">
                        <div className="relative group max-w-[120px] mx-auto">
                          <input
                            type="number"
                            value={row.oneMonthPrice || 0}
                            onChange={(e) => handleCellChange(index, 'oneMonthPrice', Number(e.target.value))}
                            className={`w-full px-3 py-2 rounded-xl border text-center font-bold text-sm transition-all focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none ${
                              isModified ? 'border-amber-300 bg-white shadow-sm ring-1 ring-amber-100' : 'border-slate-200 bg-slate-50/50 group-hover:bg-white'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-3">
                        <div className="relative group max-w-[120px] mx-auto">
                          <input
                            type="number"
                            value={row.twoMonthsPrice || 0}
                            onChange={(e) => handleCellChange(index, 'twoMonthsPrice', Number(e.target.value))}
                            className={`w-full px-3 py-2 rounded-xl border text-center font-bold text-sm transition-all focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none ${
                              isModified ? 'border-amber-300 bg-white shadow-sm ring-1 ring-amber-100' : 'border-slate-200 bg-slate-50/50 group-hover:bg-white'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-3">
                        <div className="relative group max-w-[120px] mx-auto">
                          <input
                            type="number"
                            value={row.threeMonthsPrice || 0}
                            onChange={(e) => handleCellChange(index, 'threeMonthsPrice', Number(e.target.value))}
                            className={`w-full px-3 py-2 rounded-xl border text-center font-bold text-sm transition-all focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none ${
                              isModified ? 'border-amber-300 bg-white shadow-sm ring-1 ring-amber-100' : 'border-slate-200 bg-slate-50/50 group-hover:bg-white'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={() => {
                            const updated = [...rows];
                            updated[index].status = updated[index].status.includes('معتمدة') ? 'مسودة' : (isHQ ? 'معتمدة (المرجع)' : 'معتمدة (تطبق في البيع)');
                            setRows(updated);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all active:scale-90 ${
                            row.status.includes('معتمدة') 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-xs' 
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {row.status}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-5 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
            <button
              onClick={handleSaveAll}
              disabled={modifiedIds.size === 0}
              className={`px-8 py-3 rounded-2xl text-sm font-black shadow-lg transition-all flex items-center gap-2 ${
                modifiedIds.size > 0 
                ? 'bg-sky-900 hover:bg-sky-800 text-white cursor-pointer active:scale-95' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Save className="w-5 h-5" />
              <span>تثبيت وحفظ التغييرات الآن</span>
            </button>
            
            {modifiedIds.size > 0 && (
              <button 
                onClick={() => setRows(getFullPricingRows(pricing, agents))}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline underline-offset-4 decoration-slate-300"
              >
                تجاهل التعديلات الحالية
              </button>
            )}
           </div>
           
           <div className="text-[11px] text-slate-500 font-bold flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
             <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
             نظام التسعير الرقمي المعتمد - كافة المبالغ بالدينار العراقي (IQD)
           </div>
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

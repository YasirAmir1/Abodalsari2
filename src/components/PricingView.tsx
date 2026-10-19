import React, { useState } from 'react';
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
  Edit2
} from 'lucide-react';
import { Agent, PricingRow } from '../types';

interface PricingViewProps {
  pricing: PricingRow[];
  agents: Agent[];
  onSavePricing: (rows: PricingRow[]) => void;
  onUpdateAgent: (agentId: string, branding: Partial<Agent>) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({ pricing, agents, onSavePricing, onUpdateAgent }) => {
  const [rows, setRows] = useState<PricingRow[]>(pricing);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [editingAgentCredentials, setEditingAgentCredentials] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (agentId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const handleCellChange = (
    index: number,
    field: keyof Omit<PricingRow, 'agentId' | 'agentName' | 'agentCode' | 'status' | 'isReference'>,
    value: number
  ) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setRows(updated);
  };

  const handleApplyWholesaleAll = () => {
    const wholesaleNewDevice = 45000;
    const wholesaleMonth = 22000;
    const wholesale2Months = 36000;
    const wholesale3Months = 54000;

    const updated = rows.map((r) => {
      if (r.isReference) return r;
      return {
        ...r,
        newDevicePrice: wholesaleNewDevice,
        oneMonthPrice: wholesaleMonth,
        twoMonthsPrice: wholesale2Months,
        threeMonthsPrice: wholesale3Months
      };
    });
    setRows(updated);
  };

  const handleApplyWholesaleSingle = (index: number) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      newDevicePrice: 45000,
      oneMonthPrice: 22000,
      twoMonthsPrice: 36000,
      threeMonthsPrice: 54000
    };
    setRows(updated);
  };

  const handleApplyCenterPricesSingle = (index: number) => {
    const center = rows.find((r) => r.isReference) || rows[0];
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      newDevicePrice: center.newDevicePrice,
      oneMonthPrice: center.oneMonthPrice,
      twoMonthsPrice: center.twoMonthsPrice,
      threeMonthsPrice: center.threeMonthsPrice
    };
    setRows(updated);
  };

  const handleResetDefault = (index: number) => {
    const updated = [...rows];
    if (updated[index].isReference) {
      updated[index] = {
        ...updated[index],
        newDevicePrice: 50000,
        oneMonthPrice: 25000,
        twoMonthsPrice: 50000,
        threeMonthsPrice: 75000
      };
    } else {
      updated[index] = {
        ...updated[index],
        newDevicePrice: 45000,
        oneMonthPrice: 22000,
        twoMonthsPrice: 36000,
        threeMonthsPrice: 54000
      };
    }
    setRows(updated);
  };

  const handleSaveAll = () => {
    onSavePricing(rows);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const centerRow = rows.find((r) => r.isReference) || rows[0];

  return (
    <div className="space-y-6">
      {/* Header matching Screenshot 7 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-sky-700 mb-1">جدول التسعير الرسمي الموحد</div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            الأسعار والرسائل (جدول أسعار الوكلاء والمركز)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            جدول تفاعلي شامل لتحديد أسعار الأجهزة وتجديد الاشتراكات لكل وكيل بشكل مستقل مع التثبيت الفوري في العمليات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleApplyWholesaleAll}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>تطبيق أسعار الجملة للكل</span>
          </button>

          <button
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الأسعار</span>
          </button>
        </div>
      </div>

      {/* Important Notice Box matching Screenshot 7 */}
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Lightbulb className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="font-bold text-sky-950 text-xs">ملاحظة هامة حول تثبيت الأسعار:</h4>
          <p className="text-sky-800 text-xs mt-0.5 leading-relaxed">
            حفظ الأسعار لا يغيّر أي سعر محفوظ في عمليات سابقة - السعر الجديد يثبت داخل العملية الجديدة فقط من لحظة الحفظ.
          </p>
        </div>
      </div>

      {/* 4 Stat Cards matching Screenshot 7 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: إجمالي جهات البيع */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي جهات البيع</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-sky-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3 font-mono">
            {rows.length} <span className="text-xs font-bold text-slate-500">جهة</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">المركز الرئيسي + {rows.length - 1} وكيل</div>
        </div>

        {/* Card 2: الأسعار المعتمدة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الأسعار المعتمدة</span>
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3 font-mono">
            {rows.length} <span className="text-xs font-bold text-slate-500">جهة معتمدة</span>
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">تطبق فوراً عند إنشاء البيع</div>
        </div>

        {/* Card 3: الأسعار المسودة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الأسعار المسودة</span>
            <div className="w-3.5 h-3.5 rounded-full bg-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3 font-mono">
            0 <span className="text-xs font-bold text-slate-500">مسودة</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">لم تُعتمد بعد للبيع</div>
        </div>

        {/* Card 4: سعر جهاز المركز (المرجع) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">سعر جهاز المركز (المرجع)</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <Tv className="w-4 h-4 text-sky-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-900 mt-3 font-mono">
            {centerRow.newDevicePrice.toLocaleString()} <span className="text-xs font-bold text-slate-500">د.ع</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">سعر البيع المباشر للمشترك</div>
        </div>
      </div>

      {/* Pricing Matrix Table with Inline Editing matching Screenshot 7 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              📊 جدول الأسعار التفاعلي لكافة الوكلاء والمركز الرئيسي (Inline Editing)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              يمكن تعديل أي حقل سعر مباشرة داخل الجدول ثم الضغط على "حفظ الأسعار"
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">الجهة / الوكيل</th>
                <th className="py-3 px-3">جهاز جديد (د.ع)</th>
                <th className="py-3 px-3">شهر (د.ع)</th>
                <th className="py-3 px-3">شهرين (د.ع)</th>
                <th className="py-3 px-3">3 أشهر (د.ع)</th>
                <th className="py-3 px-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => {
                const agent = agents.find((a) => a.id === row.agentId);
                const isEditing = editingAgentCredentials === row.agentId;
                const [tempUsername, setTempUsername] = useState(agent?.username || '');
                const [tempPassword, setTempPassword] = useState(agent?.password || '');

                return (
                  <React.Fragment key={row.agentId}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.isReference ? 'bg-sky-50/30' : ''
                      }`}
                    >
                      {/* Agent Name & Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="font-bold text-slate-900">{row.agentName}</div>
                            <div className="text-[10px] text-sky-700 font-mono font-medium">
                              {row.agentCode}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* New Device Price Input */}
                      <td className="py-3 px-3 font-mono">
                        <input
                          type="number"
                          step={500}
                          value={row.newDevicePrice}
                          onChange={(e) =>
                            handleCellChange(index, 'newDevicePrice', Number(e.target.value))
                          }
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 font-bold text-slate-800"
                        />
                      </td>

                      {/* 1 Month Price Input */}
                      <td className="py-3 px-3 font-mono">
                        <input
                          type="number"
                          step={500}
                          value={row.oneMonthPrice}
                          onChange={(e) =>
                            handleCellChange(index, 'oneMonthPrice', Number(e.target.value))
                          }
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 font-bold text-slate-800"
                        />
                      </td>

                      {/* 2 Months Price Input */}
                      <td className="py-3 px-3 font-mono">
                        <input
                          type="number"
                          step={500}
                          value={row.twoMonthsPrice}
                          onChange={(e) =>
                            handleCellChange(index, 'twoMonthsPrice', Number(e.target.value))
                          }
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 font-bold text-slate-800"
                        />
                      </td>

                      {/* 3 Months Price Input */}
                      <td className="py-3 px-3 font-mono">
                        <input
                          type="number"
                          step={500}
                          value={row.threeMonthsPrice}
                          onChange={(e) =>
                            handleCellChange(index, 'threeMonthsPrice', Number(e.target.value))
                          }
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 font-bold text-slate-800"
                        />
                      </td>

                      {/* Status Pill */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit ${
                            row.isReference
                              ? 'bg-sky-100 text-sky-800 border border-sky-300'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{row.status}</span>
                        </span>
                      </td>
                    </tr>
                    {/* Credentials Row */}
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="py-2 px-4">
                        <div className="flex items-center gap-4 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">اسم المستخدم:</span>
                            {isEditing ? (
                              <input
                                value={tempUsername}
                                onChange={(e) => setTempUsername(e.target.value)}
                                className="px-2 py-1 rounded border border-slate-300"
                              />
                            ) : (
                              <span className="font-mono text-slate-800">{agent?.username || '-'}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">الرمز السري:</span>
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <input
                                  type={visiblePasswords[row.agentId] ? 'text' : 'password'}
                                  value={tempPassword}
                                  onChange={(e) => setTempPassword(e.target.value)}
                                  className="px-2 py-1 rounded border border-slate-300"
                                />
                              ) : (
                                <span className="font-mono text-slate-800">
                                  {visiblePasswords[row.agentId] ? (agent?.password || '-') : '••••••••'}
                                </span>
                              )}
                              <button onClick={() => togglePasswordVisibility(row.agentId)} className="text-slate-500 hover:text-slate-700">
                                {visiblePasswords[row.agentId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (isEditing) {
                                onUpdateAgent(row.agentId, { username: tempUsername, password: tempPassword });
                                setEditingAgentCredentials(null);
                              } else {
                                setEditingAgentCredentials(row.agentId);
                              }
                            }}
                            className="mr-auto px-3 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            {isEditing ? 'حفظ' : 'تعديل'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Button Bar matching Screenshot 7 */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleSaveAll}
            className="w-full sm:w-auto px-6 py-2.5 bg-sky-900 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>حفظ وتثبيت الأسعار لكافة الوكلاء والمركز</span>
          </button>

          <div className="text-[11px] text-slate-400">
            ℹ️ الأسعار بالدينار العراقي (د.ع). الوكيل الذي حالته "معتمدة" تُطبق أسعاره تلقائياً عند تسجيل البيع.
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {showSavedToast && (
        <div className="fixed bottom-6 left-6 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in z-50">
          <CheckCircle2 className="w-4 h-4" />
          <span>تم حفظ وتثبيت أسعار الوكلاء والمركز بنجاح!</span>
        </div>
      )}
    </div>
  );
};

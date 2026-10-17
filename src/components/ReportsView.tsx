import React from 'react';
import {
  FileText,
  Target,
  Radio,
  TrendingUp,
  Download,
  CheckCircle,
  Wifi,
  Signal,
  BarChart3
} from 'lucide-react';
import { Agent, Invoice, Subscriber } from '../types';
import { excelService } from '../services/excelService';

interface ReportsViewProps {
  agents: Agent[];
  subscribers: Subscriber[];
  invoices: Invoice[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ agents, subscribers, invoices }) => {
  const towers = [
    { city: 'برج تكريت المركزي', status: 'ممتاز', strength: 99, freq: '522 MHz UHF', channels: 'الرابعة 1, 2, 3, News, Sports' },
    { city: 'برج سامراء والجبيرية', status: 'ممتاز', strength: 98, freq: '546 MHz UHF', channels: 'الرابعة الرياضية HD' },
    { city: 'برج بلد والدجيل', status: 'مستقر', strength: 96, freq: '570 MHz UHF', channels: 'الرابعة الرياضية HD' },
    { city: 'برج بيجي والصينية', status: 'مستقر', strength: 95, freq: '594 MHz UHF', channels: 'الرابعة الرياضية HD' },
    { city: 'برج الدور والبوعجيل', status: 'ممتاز', strength: 97, freq: '618 MHz UHF', channels: 'الرابعة الرياضية HD' },
    { city: 'برج الشرقاط والساحل الأيسر', status: 'جيد جداً', strength: 93, freq: '642 MHz UHF', channels: 'الرابعة الرياضية HD' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-sky-700 mb-1">التقارير التحليلية والأهداف التشغيلية</div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">التقارير والأهداف وحالة البث الأرضي</h2>
          <p className="text-xs text-slate-500 mt-1">
            متابعة إنجاز الأهداف الشهرية للوكلاء ورصد سلامة إشارة أبراج البث الرقمي في عموم محافظة صلاح الدين
          </p>
        </div>

        <button
          onClick={() => excelService.exportInvoices(invoices)}
          className="px-4 py-2.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>تصدير التقرير التحليلي الشامل (Excel)</span>
        </button>
      </div>

      {/* Agents Monthly Targets Progress */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-sky-700" />
            <h3 className="font-extrabold text-sm text-slate-900">متابعة هدف الاشتراكات الشهري للوكلاء (Target: 100 اشتراك)</h3>
          </div>
          <span className="text-xs font-bold text-slate-400">تحديث دوري دقيق</span>
        </div>

        <div className="space-y-4">
          {agents.filter((a) => a.id !== 'agent-main').map((ag) => {
            const goal = 100;
            const progress = Math.min(100, Math.round((ag.devicesCount / goal) * 100));
            return (
              <div key={ag.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <div className="font-bold text-slate-900">{ag.name} ({ag.region})</div>
                  <div className="text-slate-500">
                    <span className="font-bold text-sky-800 font-mono">{ag.devicesCount}</span> / {goal} جهاز
                    <span className="mr-2 text-emerald-700 font-bold">({progress}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-600 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terrestrial Transmission Towers Status across Salah al-Din */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-sky-700 animate-pulse" />
            <h3 className="font-extrabold text-sm text-slate-900">
              حالة وتغطية أبراج شبكة الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            كافة المحطات تعمل بكفاءة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {towers.map((tower, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-sky-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{tower.city}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    {tower.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>قوة الإشارة الرقمية:</span>
                    <span className="font-bold text-sky-700 font-mono">{tower.strength}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>تردد البث الهوائي:</span>
                    <span className="font-mono text-slate-700">{tower.freq}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>القنوات المنقولة:</span>
                    <span className="text-[11px] text-slate-500 font-medium">{tower.channels}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Signal className="w-3.5 h-3.5 text-emerald-600" />
                  إشارة مستقرة DVB-T2
                </span>
                <span>تحديث لحظي</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

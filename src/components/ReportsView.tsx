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
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="الساري للبث الأرضي"
            className="w-14 h-14 object-contain rounded-full shadow-2xs border border-slate-100 dark:border-slate-800 shrink-0"
          />
          <div>
            <div className="text-xs font-semibold text-sky-700 dark:text-sky-400 mb-1">التقارير التحليلية والأهداف التشغيلية</div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">التقارير والأهداف وحالة البث الأرضي</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              شركة الساري للبث الأرضي - متابعة إنجاز الأهداف الشهرية للوكلاء ورصد سلامة إشارة أبراج البث الرقمي في عموم محافظة صلاح الدين
            </p>
          </div>
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

    </div>
  );
};

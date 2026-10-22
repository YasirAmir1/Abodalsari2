import React, { useMemo, useState } from 'react';
import {
  Search,
  Users2,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { Agent, Invoice, Subscriber } from '../types';

interface ActiveSubscribersViewProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  agents: Agent[];
}

export const ActiveSubscribersView: React.FC<ActiveSubscribersViewProps> = ({
  subscribers,
  invoices,
  agents
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const activeSubscribers = useMemo(() => {
    return subscribers.filter((s) => s.status === 'active' && s.isActive);
  }, [subscribers]);

  const filteredSubscribers = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return activeSubscribers.filter(
      (s) => s.name.toLowerCase().includes(query) || s.deviceId.includes(query)
    );
  }, [activeSubscribers, searchTerm]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">المشتركون الفعالون</h2>
        
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="البحث باسم المشترك أو رقم الجهاز..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">المشترك</th>
                <th className="px-4 py-3">رقم الجهاز</th>
                <th className="px-4 py-3">الوكيل</th>
                <th className="px-4 py-3">نوع الاشتراك</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">تاريخ البداية</th>
                <th className="px-4 py-3">تاريخ الانتهاء</th>
                <th className="px-4 py-3">الدفع</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredSubscribers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{s.deviceId}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.agentName || 'المركز الرئيسي'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.subscriptionType}</td>
                  <td className="px-4 py-3 font-bold text-sky-700 dark:text-sky-300">{s.amount.toLocaleString()} د.ع</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.startDate}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.endDate}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      s.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {s.paymentStatus === 'paid' ? 'نقدي' : 'دين'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> فعال
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

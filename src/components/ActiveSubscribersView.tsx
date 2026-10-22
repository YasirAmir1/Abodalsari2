import React, { useMemo, useState } from 'react';
import {
  Search,
  Users2,
  Calendar,
  CheckCircle2,
  QrCode,
  Edit2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Agent, Invoice, PricingRow, Subscriber } from '../types';
import { DeleteSubscriberModal } from './DeleteSubscriberModal';
import { RenewSubscriptionModal } from './RenewSubscriptionModal';

interface ActiveSubscribersViewProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  agents: Agent[];
  pricing: PricingRow[];
  onSelectDeviceQr: (deviceId: string, subscriberName?: string, agentName?: string) => void;
  onUpdateSubscriber: (sub: Subscriber) => void;
  onDeleteSubscriber: (id: string) => void;
  onRenewSubscriber: (updatedSubscriber: Subscriber, isDebt: boolean, amount: number) => void;
  onOpenWhatsApp: (sub: Subscriber) => void;
}

export const ActiveSubscribersView: React.FC<ActiveSubscribersViewProps> = ({
  subscribers,
  invoices,
  agents,
  pricing,
  onSelectDeviceQr,
  onUpdateSubscriber,
  onDeleteSubscriber,
  onRenewSubscriber,
  onOpenWhatsApp
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [deletingSubscriber, setDeletingSubscriber] = useState<Subscriber | null>(null);
  const [renewingSubscriber, setRenewingSubscriber] = useState<Subscriber | null>(null);

  const activeSubscribers = useMemo(() => {
    return subscribers.filter((s) => s.status === 'active' && s.isActive);
  }, [subscribers]);

  const subscriberCountsByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    activeSubscribers.forEach((sub) => {
      const id = sub.agentId || 'agent-main';
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return counts;
  }, [activeSubscribers]);

  const filteredSubscribers = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return activeSubscribers.filter((sub) => {
      // Agent filter
      if (agentFilter !== 'all') {
        const subAgentId = sub.agentId || 'agent-main';
        if (subAgentId !== agentFilter) return false;
      }
      
      // Search filter
      const matchName = sub.name.toLowerCase().includes(query);
      const matchDevice = sub.deviceId.includes(query);
      return matchName || matchDevice;
    });
  }, [activeSubscribers, searchTerm, agentFilter]);

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

        {/* Agent Classification Filter Bar */}
        <div className="mt-4 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-1">
            <Users2 className="w-4 h-4 text-sky-600" />
            تصنيف حسب الوكيل:
          </span>

          <button
            onClick={() => setAgentFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              agentFilter === 'all'
                ? 'bg-sky-900 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>كافة الوكلاء والمركز</span>
            <span className="text-[10px] opacity-80 font-mono">({activeSubscribers.length})</span>
          </button>

          <button
            onClick={() => setAgentFilter('agent-main')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              agentFilter === 'agent-main'
                ? 'bg-sky-800 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>المركز الرئيسي</span>
            <span className="text-[10px] opacity-80 font-mono">({subscriberCountsByAgent.get('agent-main') || 0})</span>
          </button>

          {agents.filter(a => a.id !== 'agent-main').map((ag) => {
            const count = subscriberCountsByAgent.get(ag.id) || 0;
            const isSelected = agentFilter === ag.id;

            return (
              <button
                key={ag.id}
                onClick={() => setAgentFilter(ag.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-sky-800 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{ag.name}</span>
                <span className="text-[10px] opacity-80 font-mono">({count})</span>
              </button>
            );
          })}
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
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredSubscribers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{s.name}</td>
                  <td className="px-4 py-3 font-mono">
                    <button
                      onClick={() => onSelectDeviceQr(s.deviceId, s.name, s.agentName)}
                      className="text-sky-700 dark:text-sky-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      title="اضغط لعرض رمز QR للجهاز"
                    >
                      <QrCode className="w-3.5 h-3.5 text-sky-600 opacity-70" />
                      <span>{s.deviceId}</span>
                    </button>
                  </td>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setRenewingSubscriber(s)}
                        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                        title="تعديل الاشتراك"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingSubscriber(s)}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="حذف المشترك"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {renewingSubscriber && (
        <RenewSubscriptionModal
          subscriber={renewingSubscriber}
          agents={agents}
          pricing={pricing}
          onClose={() => setRenewingSubscriber(null)}
          onSaveAndActivate={(updated, isDebt, amount) => {
            onRenewSubscriber(updated, isDebt, amount);
            setRenewingSubscriber(null);
          }}
          onWhatsApp={(sub) => onOpenWhatsApp(sub)}
          forceMainCenter={true}
        />
      )}

      {deletingSubscriber && (
        <DeleteSubscriberModal
          subscriber={deletingSubscriber}
          onClose={() => setDeletingSubscriber(null)}
          onConfirmDelete={(id) => {
            onDeleteSubscriber(id);
            setDeletingSubscriber(null);
          }}
        />
      )}
    </div>
  );
};

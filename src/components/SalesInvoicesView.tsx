import React, { useState } from 'react';
import {
  ShoppingCart,
  Search,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';
import { calculateTotalSales } from '../utils/calculationUtils';
import { Agent, Invoice, Subscriber } from '../types';
import { excelService } from '../services/excelService';
import { useAppDialogs } from './AppDialogProvider';

interface SalesInvoicesViewProps {
  invoices: Invoice[];
  agents: Agent[];
  onOpenReceipt: (inv: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onSelectDeviceQr?: (deviceId: string, subscriberName?: string, agentName?: string) => void;
}

export const SalesInvoicesView: React.FC<SalesInvoicesViewProps> = ({
  invoices,
  agents,
  onOpenReceipt,
  onDeleteInvoice,
  onSelectDeviceQr
}) => {
  const { showConfirm } = useAppDialogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const filteredInvoices = invoices.filter((inv) => {
    if (agentFilter !== 'all' && inv.agentId !== agentFilter) return false;
    if (paymentFilter !== 'all' && inv.paymentStatus !== paymentFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        inv.subscriberName.toLowerCase().includes(term) ||
        inv.deviceId.includes(term) ||
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.agentName.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalSalesSum = calculateTotalSales(invoices);
  const totalPaidSum = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const totalRemainingDebt = invoices.reduce((s, i) => s + (i.remainingAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-sky-700 mb-1">سجل المبيعات والفوترة المتكامل</div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">سجل فواتير المبيعات</h2>
          <p className="text-xs text-slate-500 mt-1">
            إصدار ومتابعة فواتير الاشتراكات، الأجهزة، والملحقات، وإصدار وصولات القبض الحرارية
          </p>
        </div>

        <button
          onClick={() => excelService.exportInvoices(invoices)}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>تصدير تقرير المبيعات (Excel)</span>
        </button>
      </div>

      {/* 3 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500">إجمالي قيمة الفواتير</div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {totalSalesSum.toLocaleString()} <span className="text-xs font-bold text-slate-400">د.ع</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{invoices.length} عملية بيع مسجلة</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500">المبالغ المقبوضة نقدياً</div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
            {totalPaidSum.toLocaleString()} <span className="text-xs font-bold text-emerald-400">د.ع</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">مدفوعات مؤكدة</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500">مجموع الديون القائمة على الفواتير</div>
          <div className="text-2xl font-black text-red-600 mt-2 font-mono">
            {totalRemainingDebt.toLocaleString()} <span className="text-xs font-bold text-red-400">د.ع</span>
          </div>
          <div className="text-[11px] text-red-500 mt-1">بانتظار التحصيل</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">كافة الوكلاء والمركز</option>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.name}
              </option>
            ))}
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">كافة حالات الدفع</option>
            <option value="paid">مسدد بالكامل</option>
            <option value="debt">دين قائم</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم الفاتورة، المشترك، الجهاز..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">رقم الفاتورة</th>
                <th className="py-3 px-4">المشترك / الجهاز</th>
                <th className="py-3 px-3">الوكيل</th>
                <th className="py-3 px-3">الباقة</th>
                <th className="py-3 px-3">المبلغ</th>
                <th className="py-3 px-3">المدفوع / المتبقي</th>
                <th className="py-3 px-3">الحالة</th>
                <th className="py-3 px-3">التاريخ</th>
                <th className="py-3 px-4 text-center">وصل قبض</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-sky-800">
                    {inv.invoiceNumber}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{inv.subscriberName}</div>
                    <button
                      onClick={() => onSelectDeviceQr && onSelectDeviceQr(inv.deviceId, inv.subscriberName, inv.agentName)}
                      className="font-mono text-[11px] text-sky-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      title="عرض رمز QR للجهاز"
                    >
                      <span>📱 {inv.deviceId}</span>
                    </button>
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                      {inv.agentName}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-semibold text-slate-700">
                    {inv.packageType}
                  </td>

                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {inv.amount.toLocaleString()} د.ع
                  </td>

                  <td className="py-3 px-3 text-[11px]">
                    <div className="text-emerald-700 font-bold">
                      مدفوع: {inv.paidAmount.toLocaleString()} د.ع
                    </div>
                    {inv.remainingAmount > 0 && (
                      <div className="text-red-600 font-bold">
                        متبقي: {inv.remainingAmount.toLocaleString()} د.ع
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        inv.paymentStatus === 'paid'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {inv.paymentStatus === 'paid' ? 'مسدد بالكامل' : 'دين'}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                    {inv.date}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onOpenReceipt(inv)}
                        className="p-1.5 rounded-lg text-sky-700 hover:bg-sky-50 transition-colors"
                        title="معاينة وطباعة وصل القبض"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (await showConfirm('هل أنت متأكد من حذف هذه الفاتورة؟', 'حذف الفاتورة')) {
                            onDeleteInvoice(inv.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        title="حذف الفاتورة"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
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

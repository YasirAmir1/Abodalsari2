import React, { useMemo, useState } from 'react';
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
import { SecurityActionModal } from './SecurityActionModal';
import { useVirtualizedRows } from './useVirtualizedRows';

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
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);

  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
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
  }), [agentFilter, invoices, paymentFilter, searchTerm]);

  const totalSalesSum = useMemo(() => calculateTotalSales(invoices), [invoices]);
  const totalPaidSum = useMemo(() => invoices.reduce((s, i) => s + (i.paidAmount || 0), 0), [invoices]);
  const totalRemainingDebt = useMemo(() => invoices.reduce((s, i) => s + (i.remainingAmount || 0), 0), [invoices]);
  const {
    scrollRef: invoicesTableRef,
    handleScroll: handleInvoicesTableScroll,
    visibleRows: visibleInvoices,
    topSpacerHeight: invoicesTopSpacerHeight,
    bottomSpacerHeight: invoicesBottomSpacerHeight
  } = useVirtualizedRows(filteredInvoices, 64);

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
        <div
          ref={invoicesTableRef}
          onScroll={handleInvoicesTableScroll}
          className="max-h-[70vh] overflow-auto"
        >
          <table className="w-full text-right text-xs border-collapse">
            <thead className="sticky top-0 z-10">
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
              {invoicesTopSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={9} style={{ height: invoicesTopSpacerHeight, padding: 0, border: 0 }} />
                </tr>
              )}
              {visibleInvoices.map((inv) => (
                <tr key={inv.id} className="h-16 hover:bg-slate-50/80 transition-colors">
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
                        className="p-1.5 rounded-lg text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                        title="معاينة وطباعة وصل القبض"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingInvoice(inv)}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="حذف الفاتورة نهائياً (إجراء أمني)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {invoicesBottomSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={9} style={{ height: invoicesBottomSpacerHeight, padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* High-Security Warning & Final Administrative Action Modal for Invoice Deletion */}
      {deletingInvoice && (
        <SecurityActionModal
          isOpen={!!deletingInvoice}
          actionType="DELETE_INVOICE"
          actionName={`حذف فاتورة المبيعات (${deletingInvoice.invoiceNumber})`}
          targetDescription={`أنت على وشك حذف الفاتورة رقم ${deletingInvoice.invoiceNumber} الصادرة للمشترك (${deletingInvoice.subscriberName}) نهائياً من سجلات النظام المالية والفوترة، وتعديل المبالغ والديون المحتسبة المرتبطة بها.`}
          targetId={deletingInvoice.id}
          details={[
            { label: 'رقم الفاتورة', value: deletingInvoice.invoiceNumber },
            { label: 'اسم المشترك', value: deletingInvoice.subscriberName },
            { label: 'معرف الجهاز', value: deletingInvoice.deviceId },
            { label: 'الوكيل المسجل', value: deletingInvoice.agentName },
            { label: 'قيمة الفاتورة', value: `${deletingInvoice.amount.toLocaleString()} د.ع`, isHighlight: true },
            { label: 'حالة السداد', value: deletingInvoice.paymentStatus === 'paid' ? 'مسدد نقداً' : 'دين قائم' },
            { label: 'تاريخ الفاتورة', value: deletingInvoice.date }
          ]}
          confirmButtonText="تأكيد حذف الفاتورة نهائياً"
          onConfirm={() => {
            onDeleteInvoice(deletingInvoice.id);
            setDeletingInvoice(null);
          }}
          onClose={() => setDeletingInvoice(null)}
        />
      )}
    </div>
  );
};

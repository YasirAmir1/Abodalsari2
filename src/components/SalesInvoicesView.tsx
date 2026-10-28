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
  X,
  Sparkles,
  Wallet,
  ReceiptText,
  Trash2,
  QrCode,
  ArrowDownRight
} from 'lucide-react';
import { calculateTotalSales } from '../utils/calculationUtils';
import { Agent, Invoice, Subscriber } from '../types';
import { excelService } from '../services/excelService';
import { SecurityActionModal } from './SecurityActionModal';
import { useVirtualizedRows } from './useVirtualizedRows';

interface SalesInvoicesViewProps {
  invoices: Invoice[];
  agents: Agent[];
  onOpenReceipt: (inv: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onSelectDeviceQr?: (deviceId: string, subscriberName?: string, agentName?: string) => void;
}

const SalesInvoicesViewComponent: React.FC<SalesInvoicesViewProps> = ({
  invoices,
  agents,
  onOpenReceipt,
  onDeleteInvoice,
  onSelectDeviceQr
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);

  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
    if (agentFilter !== 'all' && inv.agentId !== agentFilter) return false;
    if (paymentFilter !== 'all' && inv.paymentStatus !== paymentFilter) return false;
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      return (
        inv.subscriberName.toLowerCase().includes(term) ||
        inv.deviceId.includes(term) ||
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.agentName.toLowerCase().includes(term)
      );
    }
    return true;
  }), [agentFilter, invoices, paymentFilter, searchTerm]);

  const stats = useMemo(() => {
    const totalSales = calculateTotalSales(invoices);
    const totalPaid = invoices.reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
    const totalDebt = invoices.reduce((s, i) => s + (Number(i.remainingAmount) || 0), 0);
    return { totalSales, totalPaid, totalDebt };
  }, [invoices]);

  const {
    scrollRef: invoicesTableRef,
    handleScroll: handleInvoicesTableScroll,
    visibleRows: visibleInvoices,
    topSpacerHeight: invoicesTopSpacerHeight,
    bottomSpacerHeight: invoicesBottomSpacerHeight
  } = useVirtualizedRows(filteredInvoices, 64);

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
                <ReceiptText className="w-3.5 h-3.5" />
                سجل الفواتير والمبيعات
              </span>
              <span className="text-xs font-medium text-slate-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
                {invoices.length} فاتورة مسجلة
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>سجل المبيعات والفوترة</span>
              <Sparkles className="w-6 h-6 text-amber-400" />
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => excelService.exportInvoices(invoices)}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 flex items-center gap-2 shadow-xs cursor-pointer backdrop-blur-xs"
              title="تصدير تقرير المبيعات الكامل إلى Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير تقرير المبيعات</span>
            </button>
          </div>
        </div>

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mt-7 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">إجمالي قيمة الفواتير</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
                {stats.totalSales.toLocaleString()} <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">المبالغ المقبوضة</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
                {stats.totalPaid.toLocaleString()} <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">الديون القائمة</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
                {stats.totalDebt.toLocaleString()} <span className="text-xs font-normal text-slate-300 font-sans">د.ع</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-1">
            <Filter className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            تصفية الفواتير:
          </span>

          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="all">كافة الوكلاء</option>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.name}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="all">كافة حالات الدفع</option>
            <option value="paid">مسدد بالكامل</option>
            <option value="debt">دين قائم</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم الفاتورة، المشترك، الجهاز..."
            className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 text-slate-900 dark:text-slate-100 font-medium"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div
          ref={invoicesTableRef}
          onScroll={handleInvoicesTableScroll}
          className="max-h-[60vh] overflow-auto"
        >
          <table className="w-full text-right text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-4 px-4 font-black">رقم الفاتورة</th>
                <th className="py-4 px-4 font-black">المشترك / الجهاز</th>
                <th className="py-4 px-3 font-black">الوكيل</th>
                <th className="py-4 px-3 font-black">الباقة</th>
                <th className="py-4 px-3 font-black">المبلغ الكلي</th>
                <th className="py-4 px-3 font-black">المدفوع / المتبقي</th>
                <th className="py-4 px-3 font-black">الحالة</th>
                <th className="py-4 px-3 font-black">التاريخ</th>
                <th className="py-4 px-4 text-center font-black">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoicesTopSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={9} style={{ height: invoicesTopSpacerHeight, padding: 0, border: 0 }} />
                </tr>
              )}
              {visibleInvoices.map((inv) => (
                <tr key={inv.id} className="h-16 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-sky-700 dark:text-sky-400 text-sm">
                    {inv.invoiceNumber}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{inv.subscriberName}</div>
                    <button
                      onClick={() => onSelectDeviceQr && onSelectDeviceQr(inv.deviceId, inv.subscriberName, inv.agentName)}
                      className="font-mono text-[11px] text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer flex items-center gap-1.5 mt-0.5"
                      title="معرف الجهاز"
                    >
                      <span>{inv.deviceId}</span>
                    </button>
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                      {inv.agentName}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                    {inv.packageType}
                  </td>

                  <td className="py-3 px-3 font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                    {inv.amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans">د.ع</span>
                  </td>

                  <td className="py-3 px-3 text-[11px] font-mono">
                    <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                      {inv.paidAmount.toLocaleString()} <span className="text-[10px] font-sans">د.ع</span>
                    </div>
                    {inv.remainingAmount > 0 && (
                      <div className="text-rose-600 dark:text-rose-400 font-black">
                        {inv.remainingAmount.toLocaleString()} <span className="text-[10px] font-sans">د.ع</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                        inv.paymentStatus === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {inv.paymentStatus === 'paid' ? 'مسدد بالكامل' : 'دين'}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-400 dark:text-slate-500 text-[11px]">
                    {inv.date}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onOpenReceipt(inv)}
                        className="p-2 rounded-xl text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors border border-sky-100 dark:border-sky-800 cursor-pointer"
                        title="معاينة وطباعة وصل القبض"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingInvoice(inv)}
                        className="p-2 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors border border-rose-100 dark:border-rose-800 cursor-pointer"
                        title="حذف الفاتورة نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
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

      {/* Deletion Confirmation Modal */}
      {deletingInvoice && (
        <SecurityActionModal
          isOpen={!!deletingInvoice}
          actionType="DELETE_INVOICE"
          actionName={`حذف فاتورة المبيعات (${deletingInvoice.invoiceNumber})`}
          targetDescription={`أنت على وشك حذف الفاتورة رقم ${deletingInvoice.invoiceNumber} الصادرة للمشترك (${deletingInvoice.subscriberName}) نهائياً. سيتم إيقاف تفعيل اشتراك المشترك تلقائياً، وحذف أو خصم الدين المرتبط بالفاتورة من سجل الديون وحساب الوكيل.`}
          targetId={deletingInvoice.id}
          details={[
            { label: 'رقم الفاتورة', value: deletingInvoice.invoiceNumber },
            { label: 'اسم المشترك', value: deletingInvoice.subscriberName },
            { label: 'معرف الجهاز', value: deletingInvoice.deviceId },
            { label: 'الوكيل المسجل', value: deletingInvoice.agentName },
            { label: 'قيمة الفاتورة', value: `${deletingInvoice.amount.toLocaleString()} د.ع`, isHighlight: true },
            { label: 'حالة السداد', value: deletingInvoice.paymentStatus === 'paid' ? 'مسدد نقداً' : 'دين قائم' },
            { label: 'تاريخ الفاتورة', value: deletingInvoice.date },
            { label: 'الإجراء المترتب', value: 'إيقاف تفعيل الاشتراك وخصم الدين تلقائياً', isHighlight: true }
          ]}
          confirmButtonText="تأكيد حذف الفاتورة وإيقاف التفعيل"
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

export const SalesInvoicesView = React.memo(SalesInvoicesViewComponent);

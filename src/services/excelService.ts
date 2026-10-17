import * as XLSX from 'xlsx';
import { DeviceCode, Invoice, Subscriber } from '../types';

export const excelService = {
  exportSubscribers(subscribers: Subscriber[], fileName = 'تقرير_مشتركي_الساري_للبث_الارضي.xlsx') {
    const data = subscribers.map((sub, index) => ({
      'ت': index + 1,
      'اسم المشترك': sub.name,
      'رقم الهاتف': sub.phone,
      'رقم الجهاز': sub.deviceId,
      'الوكيل المسؤول': sub.agentName,
      'نوع الباقة': sub.subscriptionType,
      'الحالة': sub.status === 'active' ? 'فعال' : sub.status === 'expiring_soon' ? 'منتهي قريباً' : 'غير فعال',
      'حالة الدفع': sub.paymentStatus === 'paid' ? 'مسدد' : sub.paymentStatus === 'debt' ? 'دين' : 'جزئي',
      'المبلغ (د.ع)': sub.amount,
      'تاريخ البدء': sub.startDate,
      'تاريخ الانتهاء': sub.endDate,
      'العنوان / المنطقة': sub.address || '',
      'الملاحظات': sub.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'المشتركون');
    XLSX.writeFile(workbook, fileName);
  },

  exportInvoices(invoices: Invoice[], fileName = 'تقرير_مبيعات_وفواتير_الساري.xlsx') {
    const data = invoices.map((inv, index) => ({
      'ت': index + 1,
      'رقم الفاتورة': inv.invoiceNumber,
      'تاريخ العملية': inv.date,
      'المشترك': inv.subscriberName,
      'رقم الجهاز': inv.deviceId,
      'الوكيل': inv.agentName,
      'نوع الباقة / العملية': inv.packageType,
      'المبلغ الإجمالي (د.ع)': inv.amount,
      'المدفوع (د.ع)': inv.paidAmount,
      'المتبقي (دين)': inv.remainingAmount,
      'حالة السداد': inv.paymentStatus === 'paid' ? 'مسدد بالكامل' : inv.paymentStatus === 'debt' ? 'دين قائم' : 'سداد جزئي',
      'ملاحظات': inv.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الفواتير والمبيعات');
    XLSX.writeFile(workbook, fileName);
  },

  exportDebts(
    debts: Array<{
      name: string;
      agentName: string;
      code: string;
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      dueDate: string;
      settleDate?: string;
      notes?: string;
    }>,
    fileName = 'سجل_الديون_والمستحقات_الساري.xlsx'
  ) {
    const data = debts.map((d, index) => ({
      'ت': index + 1,
      'المدين': d.name,
      'الجهة / الوكيل': d.agentName,
      'رقم الجهاز / الفاتورة': d.code,
      'المبلغ الكلي (د.ع)': d.totalAmount,
      'المسدد (د.ع)': d.paidAmount,
      'المتبقي (د.ع)': d.remainingAmount,
      'تاريخ الاستحقاق': d.dueDate,
      'تاريخ التسديد': d.settleDate || '-',
      'ملاحظات': d.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الديون والمستحقات');
    XLSX.writeFile(workbook, fileName);
  },

  exportBarcodes(codes: DeviceCode[], fileName = 'أكواد_وباركود_أجهزة_الساري.xlsx') {
    const data = codes.map((c, index) => ({
      'ت': index + 1,
      'كود الجهاز / السيريال (16 رقم)': c.code,
      'الحالة': c.status === 'available' ? 'متاح' : c.status === 'assigned' ? 'مخصص لمشترك' : 'معطل',
      'المشترك المخصص له': c.assignedToSubscriber || '-',
      'الوكيل': c.assignedToAgent || '-',
      'تاريخ التوليد': c.generatedDate
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الأكواد');
    XLSX.writeFile(workbook, fileName);
  },

  async importSubscribersFromExcel(file: File): Promise<Partial<Subscriber>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

          const parsed: Partial<Subscriber>[] = json.map((row, idx) => {
            const name = String(row['اسم المشترك'] || row['الاسم'] || row['Name'] || `مشترك جديد ${idx + 1}`);
            const phone = String(row['رقم الهاتف'] || row['الهاتف'] || row['Phone'] || '');
            const deviceId = String(row['رقم الجهاز'] || row['الجهاز'] || row['Device'] || `00${Math.floor(100000 + Math.random() * 900000)}`);
            const agentName = String(row['الوكيل'] || row['الوكيل المسؤول'] || 'المركز الرئيسي');
            const type = (row['نوع الباقة'] || '1 شهر') as Subscriber['subscriptionType'];

            return {
              id: `imported-${Date.now()}-${idx}`,
              name,
              phone,
              deviceId,
              agentName,
              subscriptionType: type,
              status: 'inactive',
              paymentStatus: 'paid',
              amount: 0,
              startDate: '-',
              endDate: '-',
              createdAt: new Date().toISOString().split('T')[0]
            };
          });

          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
};

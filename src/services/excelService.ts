import * as XLSX from 'xlsx';
import { Agent, DeviceCode, Invoice, Subscriber, SubscriptionDuration } from '../types';

function findRowValue(row: Record<string, unknown>, keys: string[]): unknown {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
    const normalizedTarget = k.toLowerCase().replace(/[\s\-_/]/g, '');
    const foundKey = rowKeys.find((rk) => {
      const normalizedRowKey = rk.toLowerCase().replace(/[\s\-_/]/g, '');
      return normalizedRowKey === normalizedTarget || normalizedRowKey.includes(normalizedTarget) || normalizedTarget.includes(normalizedRowKey);
    });
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
      return row[foundKey];
    }
  }
  return undefined;
}

function isHQName(s: string): boolean {
  if (!s) return false;
  const n = s.toLowerCase().replace(/[\s\-_]/g, '');
  return (
    n.includes('رئيسي') ||
    n.includes('رئيسيه') ||
    n.includes('المركز') ||
    n.includes('الساري') ||
    n.includes('اداره') ||
    n.includes('ادارة') ||
    n === 'hq' ||
    n === 'main'
  );
}

function matchAgent(raw: string, agents: Agent[]): { agentId: string; agentName: string } {
  if (!raw || !raw.trim()) {
    const main = agents.find((a) => a.id === 'agent-main') || agents[0];
    return { agentId: main?.id || 'agent-main', agentName: main?.name || 'المركز الرئيسي' };
  }
  const clean = raw.trim();
  const lower = clean.toLowerCase();

  const byIdOrCode = agents.find(
    (a) => a.id.toLowerCase() === lower || a.code.toLowerCase() === lower
  );
  if (byIdOrCode) return { agentId: byIdOrCode.id, agentName: byIdOrCode.name };

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-_]/g, '');

  const targetNorm = norm(clean);

  for (const ag of agents) {
    if (norm(ag.name) === targetNorm || norm(ag.customShopName || '') === targetNorm || norm(ag.username || '') === targetNorm) {
      return { agentId: ag.id, agentName: ag.name };
    }
  }

  for (const ag of agents) {
    const agNameNorm = norm(ag.name);
    if (ag.id !== 'agent-main' && agNameNorm.length > 2 && targetNorm.includes(agNameNorm)) {
      return { agentId: ag.id, agentName: ag.name };
    }
    const shopNorm = norm(ag.customShopName || '');
    if (shopNorm.length > 3 && targetNorm.includes(shopNorm)) {
      return { agentId: ag.id, agentName: ag.name };
    }
  }

  if (targetNorm.includes('ساهر')) {
    const ag = agents.find((a) => a.id === 'agent-01');
    if (ag) return { agentId: ag.id, agentName: ag.name };
  }
  if (targetNorm.includes('عبدالله') || targetNorm.includes('عبد الله') || targetNorm.includes('عبد')) {
    const ag = agents.find((a) => a.id === 'agent-02');
    if (ag) return { agentId: ag.id, agentName: ag.name };
  }
  if (targetNorm.includes('شامل')) {
    const ag = agents.find((a) => a.id === 'agent-03');
    if (ag) return { agentId: ag.id, agentName: ag.name };
  }
  if (targetNorm.includes('ليث')) {
    const ag = agents.find((a) => a.id === 'agent-04');
    if (ag) return { agentId: ag.id, agentName: ag.name };
  }
  if (targetNorm.includes('فجر') || targetNorm.includes('محمود')) {
    const ag = agents.find((a) => a.id === 'agent-05');
    if (ag) return { agentId: ag.id, agentName: ag.name };
  }
  if (isHQName(clean)) {
    const ag = agents.find((a) => a.id === 'agent-main') || agents[0];
    if (ag) return { agentId: ag.id, agentName: ag.name };
  }

  const main = agents.find((a) => a.id === 'agent-main') || agents[0];
  return { agentId: main?.id || 'agent-main', agentName: main?.name || 'المركز الرئيسي' };
}

function formatDeviceId(val: unknown): string {
  if (!val) {
    return `00${Math.floor(100000 + Math.random() * 900000)}`;
  }
  let clean = '';
  if (typeof val === 'number') {
    clean = BigInt(Math.floor(val)).toString();
  } else {
    clean = String(val).trim().replace(/[^0-9]/g, '');
  }
  if (!clean) {
    return `00${Math.floor(100000 + Math.random() * 900000)}`;
  }
  return clean.startsWith('00') ? clean : `00${clean}`;
}

function formatPhone(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const s = Math.floor(val).toString();
    return s.startsWith('7') ? `0${s}` : s;
  }
  return String(val).trim();
}

function parseDuration(val: unknown): SubscriptionDuration {
  if (!val) return '1 شهر';
  const s = String(val).trim().toLowerCase();
  if (s.includes('شهرين') || s.includes('2') || s.includes('شهرآن')) return 'شهرين';
  if (s.includes('3') || s.includes('ثلاث') || s.includes('3 اشهر')) return '3 أشهر';
  if (s.includes('6') || s.includes('ست') || s.includes('6 اشهر')) return '6 أشهر';
  if (s.includes('سنة') || s.includes('عام') || s.includes('12') || s.includes('سنه')) return 'سنة';
  return '1 شهر';
}

function parseStatus(val: unknown, endDateStr: string): 'active' | 'inactive' | 'expiring_soon' {
  if (!val) {
    if (endDateStr) {
      const today = new Date().getTime();
      const end = new Date(endDateStr).getTime();
      if (end < today) return 'inactive';
      const diffDays = (end - today) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7 && diffDays >= 0) return 'expiring_soon';
      if (end > today) return 'active';
    }
    return 'inactive';
  }
  const s = String(val).trim().toLowerCase();
  if (s.includes('فعال') || s.includes('نشط') || s.includes('active') || s.includes('ساري')) return 'active';
  if (s.includes('قريب') || s.includes('expiring')) return 'expiring_soon';
  return 'inactive';
}

function parsePaymentStatus(val: unknown): 'paid' | 'debt' {
  if (!val) return 'paid';
  const s = String(val).trim().toLowerCase();
  if (s.includes('دين') || s.includes('متبقي') || s.includes('debt') || s.includes('غير مسدد')) return 'debt';
  return 'paid';
}

function calculateDefaultPrice(subscriptionType: string): number {
  switch (subscriptionType) {
    case 'شهرين':
      return 36000;
    case '3 أشهر':
      return 54000;
    case '6 أشهر':
      return 100000;
    case 'سنة':
      return 190000;
    case '1 شهر':
    default:
      return 22000;
  }
}

function formatExcelDate(val: unknown, addDays = 0): string {
  if (!val) return '';
  try {
    if (typeof val === 'number') {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj) {
        const d = new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d + addDays));
        return d.toISOString().split('T')[0];
      }
    }
    const str = String(val).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        let y = parts[2];
        if (y.length === 2) y = '20' + y;
        const m = parts[1].padStart(2, '0');
        const d = parts[0].padStart(2, '0');
        const dateObj = new Date(`${y}-${m}-${d}`);
        if (!isNaN(dateObj.getTime())) {
          if (addDays > 0) {
            dateObj.setDate(dateObj.getDate() + addDays);
          }
          return dateObj.toISOString().split('T')[0];
        }
      }
    }
    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      if (addDays > 0) {
        dateObj.setDate(dateObj.getDate() + addDays);
      }
      return dateObj.toISOString().split('T')[0];
    }
  } catch {}
  return '';
}

function formatAndWriteWorkbook(
  workbook: XLSX.WorkBook,
  worksheet: XLSX.WorkSheet,
  data: Record<string, unknown>[],
  sheetName: string,
  fileName: string
) {
  // Set Right-To-Left layout for Arabic support
  worksheet['!dir'] = 'rtl';
  worksheet['!views'] = [{ RTL: true }];

  // Auto-calculate column widths
  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    const colWidths = keys.map((key) => {
      let maxLen = String(key).length;
      data.forEach((row) => {
        const val = String(row[key] ?? '');
        if (val.length > maxLen) {
          maxLen = val.length;
        }
      });
      return { wch: Math.max(maxLen + 4, 12) };
    });
    worksheet['!cols'] = colWidths;

    // Enable auto filter on table headers
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: range.e.r, c: range.e.c }
      })
    };
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

export const excelService = {
  exportSubscribers(
    subscribers: Subscriber[],
    fileName = `تقرير_مشتركي_الساري_${new Date().toISOString().split('T')[0]}.xlsx`
  ) {
    const activeCount = subscribers.filter((s) => s.status === 'active').length;
    const expiringCount = subscribers.filter((s) => s.status === 'expiring_soon').length;
    const inactiveCount = subscribers.filter((s) => s.status === 'inactive').length;
    const totalAmount = subscribers.reduce((sum, s) => sum + (s.amount || 0), 0);

    const data: Record<string, unknown>[] = subscribers.map((sub, index) => ({
      'ت': index + 1,
      'اسم المشترك': sub.name || '-',
      'رقم الهاتف': sub.phone || '-',
      'رقم الجهاز': sub.deviceId || '-',
      'الوكيل المسؤول': sub.agentName || 'المركز الرئيسي',
      'نوع الباقة': sub.status === 'active' && sub.amount > 0 ? sub.subscriptionType : (sub.subscriptionType || '-'),
      'الحالة': sub.status === 'active' ? 'فعال' : sub.status === 'expiring_soon' ? 'منتهي قريباً' : 'غير فعال',
      'حالة الدفع': sub.paymentStatus === 'paid' ? 'مسدد بالكامل' : sub.paymentStatus === 'debt' ? 'دين قائم' : 'سداد جزئي',
      'المبلغ (د.ع)': sub.amount > 0 ? sub.amount : 0,
      'تاريخ البدء': sub.startDate || '-',
      'تاريخ الانتهاء': sub.endDate || '-',
      'العنوان / المنطقة': sub.address || '-',
      'الملاحظات': sub.notes || '-'
    }));

    if (subscribers.length > 0) {
      data.push({
        'ت': 'Σ',
        'اسم المشترك': `الإجمالي: ${subscribers.length} مشترك`,
        'رقم الهاتف': '-',
        'رقم الجهاز': '-',
        'الوكيل المسؤول': '-',
        'نوع الباقة': '-',
        'الحالة': `فعال (${activeCount}) | منتهي قريباً (${expiringCount}) | غير فعال (${inactiveCount})`,
        'حالة الدفع': '-',
        'المبلغ (د.ع)': totalAmount,
        'تاريخ البدء': '-',
        'تاريخ الانتهاء': '-',
        'العنوان / المنطقة': '-',
        'الملاحظات': 'تقرير مالي وإداري معتمد من منظومة الساري'
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    formatAndWriteWorkbook(workbook, worksheet, data, 'المشتركون', fileName);
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
    formatAndWriteWorkbook(workbook, worksheet, data, 'الفواتير والمبيعات', fileName);
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
    formatAndWriteWorkbook(workbook, worksheet, data, 'الديون والمستحقات', fileName);
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
    formatAndWriteWorkbook(workbook, worksheet, data, 'الأكواد', fileName);
  },

  async importSubscribersFromExcel(
    file: File,
    agents: Agent[] = []
  ): Promise<{ subscribers: Subscriber[]; newAgents: Agent[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            reject(new Error('ملف فارغ أو تالف.'));
            return;
          }
          const data = new Uint8Array(arrayBuffer);
          let workbook;
          try {
            workbook = XLSX.read(data, { type: 'array' });
          } catch (readErr) {
            reject(new Error('تعذر قراءة ملف الإكسل. يجدر التأكد من أن الملف بصيغة صالحة (.xlsx أو .xls) وغير تالف.'));
            return;
          }

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error('ملف الإكسل لا يحتوي على أي صفحات (Sheets).'));
            return;
          }

          const allSubscribers: Subscriber[] = [];
          const discoveredAgentsMap = new Map<string, Agent>();
          const knownAgents = [...agents];
          const todayStr = new Date().toISOString().split('T')[0];

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) return;

            const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            if (!json || json.length === 0) return;

            const sheetMatch = matchAgent(sheetName, knownAgents);
            const isSheetExplicitAgent = sheetMatch.agentId !== 'agent-main' || isHQName(sheetName);

            json.forEach((row) => {
              const rawName = findRowValue(row, [
                'اسم المشترك', 'الاسم', 'اسم الزبون', 'المشترك', 'الزبون', 'العميل',
                'اسم العميل / المشترك', 'اسم المشترك الثلاثي', 'Name', 'Subscriber', 'Customer'
              ]);
              const name = String(rawName || '').trim();

              const rawDeviceId = findRowValue(row, [
                'رقم الجهاز', 'الجهاز', 'كود الجهاز', 'سيريال الجهاز', 'السيريال',
                'رقم الكرت', 'الكرت', 'كود الكرت', 'Device', 'DeviceId', 'Device ID',
                'Serial', 'Serial Number', 'Card', 'Card Number'
              ]);
              const deviceId = formatDeviceId(rawDeviceId);

              if (!name && !rawDeviceId) return;

              const rawPhone = findRowValue(row, [
                'رقم الهاتف', 'الهاتف', 'الموبايل', 'رقم الموبايل', 'هاتف', 'موبايل',
                'phone', 'Phone', 'Mobile'
              ]);
              const phone = formatPhone(rawPhone);

              const rawAgent = findRowValue(row, [
                'الوكيل', 'اسم الوكيل', 'الوكيل المسؤول', 'المكتب', 'اسم المكتب',
                'الوكيل / المكتب', 'الوكيل/المكتب', 'اسم المكتب / الوكيل', 'اسم المكتب/الوكيل',
                'الفرع', 'الجهة', 'المركز', 'الوكيل المعتمد', 'الوكيل التابع له',
                'الجهة التابع لها', 'الموزع', 'اسم الموزع', 'الوكلاء', 'وكيل',
                'المعتمد', 'نقطة البيع', 'Agent', 'Agent Name', 'AgentName', 'Shop', 'Office',
                'Dealer', 'Distributor', 'Branch'
              ]);

              let finalAgentId = 'agent-main';
              let finalAgentName = 'المركز الرئيسي';

              if (rawAgent && String(rawAgent).trim()) {
                const agentStr = String(rawAgent).trim();
                const matched = matchAgent(agentStr, [...knownAgents, ...Array.from(discoveredAgentsMap.values())]);
                finalAgentId = matched.agentId;
                finalAgentName = matched.agentName;

                if (finalAgentId === 'agent-main' && !isHQName(agentStr)) {
                  const existing = Array.from(discoveredAgentsMap.values()).find(
                    (a) => a.name.toLowerCase() === agentStr.toLowerCase() || (a.customShopName && a.customShopName.toLowerCase() === agentStr.toLowerCase())
                  );
                  if (existing) {
                    finalAgentId = existing.id;
                    finalAgentName = existing.name;
                  } else {
                    const newId = `agent-ext-${discoveredAgentsMap.size + 1}`;
                    const newAgent: Agent = {
                      id: newId,
                      code: `AG-${String(knownAgents.length + discoveredAgentsMap.size + 1).padStart(2, '0')}`,
                      name: agentStr,
                      phone: '',
                      region: 'منطقة الوكيل',
                      totalSales: 0,
                      totalPaid: 0,
                      totalDebt: 0,
                      devicesCount: 0,
                      activeSubscriptions: 0,
                      inactiveSubscriptions: 0,
                      hasDebt: false,
                      avatarInitials: agentStr.substring(0, 2),
                      colorScheme: 'from-sky-600 to-indigo-700',
                      customShopName: agentStr,
                      username: `agent_${discoveredAgentsMap.size + 1}`,
                      password: '123'
                    };
                    discoveredAgentsMap.set(newId, newAgent);
                    finalAgentId = newId;
                    finalAgentName = agentStr;
                  }
                }
              } else if (isSheetExplicitAgent) {
                finalAgentId = sheetMatch.agentId;
                finalAgentName = sheetMatch.agentName;
              }

              // Validation & Fallback: ensure agentId exists in known agents or discovered agents
              const allKnown = [...knownAgents, ...Array.from(discoveredAgentsMap.values())];
              const validAgent = allKnown.find((a) => a.id === finalAgentId);
              if (!validAgent && finalAgentId !== 'agent-main') {
                finalAgentId = 'agent-main';
                finalAgentName = 'المركز الرئيسي';
              }

              const rawAddress = findRowValue(row, ['العنوان / المنطقة', 'العنوان', 'المنطقة', 'رقعة التغطية', 'المحافظة', 'Address', 'Region']);
              const address = String(rawAddress || '').trim();

              const rawNotes = findRowValue(row, ['الملاحظات', 'الملاحظة', 'ملاحظات', 'ملاحظة', 'Notes']);
              const notes = String(rawNotes || '').trim();

              const rawDuration = findRowValue(row, ['نوع الباقة', 'الباقة', 'نوع الاشتراك', 'مدة الاشتراك', 'الاشتراك', 'الفترة', 'Package', 'Subscription', 'Duration']);
              const rawStartDate = findRowValue(row, ['تاريخ البدء', 'تاريخ التفعيل', 'تاريخ الاشتراك', 'البدء', 'التفعيل', 'Start Date', 'StartDate']);
              const rawEndDate = findRowValue(row, ['تاريخ الانتهاء', 'تاريخ النفاذ', 'الانتهاء', 'النفاذ', 'End Date', 'EndDate']);
              const rawStatus = findRowValue(row, ['الحالة', 'حالة البث', 'حالة الاشتراك', 'Status']);
              const rawPayment = findRowValue(row, ['حالة الدفع', 'حالة السداد', 'الدفع', 'السداد', 'Payment', 'Payment Status']);
              const rawAmount = findRowValue(row, ['المبلغ', 'المبلغ (د.ع)', 'السعر', 'القيمة', 'Amount', 'Price']);

              const subscriptionType = rawDuration ? parseDuration(rawDuration) : '-';
              const startDate = rawStartDate ? formatExcelDate(rawStartDate, 0) : '-';
              
              let durationDays = 30;
              if (subscriptionType === 'شهرين') durationDays = 60;
              else if (subscriptionType === '3 أشهر') durationDays = 90;
              else if (subscriptionType === '6 أشهر') durationDays = 180;
              else if (subscriptionType === 'سنة') durationDays = 365;

              const endDate = rawEndDate ? formatExcelDate(rawEndDate, durationDays) : '-';
              const status = rawStatus ? parseStatus(rawStatus, endDate) : 'inactive';
              const paymentStatus = rawPayment ? parsePaymentStatus(rawPayment) : '-';
              
              const amount = rawAmount !== undefined && rawAmount !== null && Number(rawAmount) > 0
                ? Number(rawAmount)
                : 0;

              allSubscribers.push({
                id: `imported-${deviceId}-${allSubscribers.length + 1}`,
                name: name || `مشترك جديد ${allSubscribers.length + 1}`,
                phone,
                deviceId,
                agentId: finalAgentId,
                agentName: finalAgentName,
                subscriptionType,
                status,
                paymentStatus,
                amount,
                startDate,
                endDate,
                address,
                notes,
                createdAt: todayStr
              });
            });
          });

          if (allSubscribers.length === 0) {
            reject(new Error('لم يتم العثور على أي بيانات مشتركين صالحة في ملف الإكسل. يرجى التأكد من تطابق أسماء الأعمدة (مثل: اسم المشترك، رقم الجهاز).'));
            return;
          }

          resolve({
            subscribers: allSubscribers,
            newAgents: Array.from(discoveredAgentsMap.values())
          });
        } catch (err: any) {
          reject(new Error(err?.message || 'حدث خطأ غير متوقع أثناء معالجة ملف الإكسل.'));
        }
      };
      reader.onerror = () => reject(new Error('فشل قراءة ملف الإكسل من القرص.'));
      reader.readAsArrayBuffer(file);
    });
  }
};

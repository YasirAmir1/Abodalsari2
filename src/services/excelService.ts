import * as XLSX from 'xlsx';
import { Agent, DeviceCode, Invoice, Subscriber } from '../types';

function findRowValue(row: Record<string, unknown>, keys: string[]): unknown {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
    // Normalize target key (remove spaces, slashes, etc.)
    const normalizedTarget = k.toLowerCase().replace(/[\s\-_/]/g, '');
    
    // Find matching key in row (normalize row key similarly)
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

  // 1. Direct match on ID or Code
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

  // 2. Exact normalized name match
  for (const ag of agents) {
    if (norm(ag.name) === targetNorm || norm(ag.customShopName || '') === targetNorm || norm(ag.username || '') === targetNorm) {
      return { agentId: ag.id, agentName: ag.name };
    }
  }

  // 3. Substring contains match
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

  // 4. Specific agent nickname keywords
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

  // Fallback to main center
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

export const excelService = {
  exportSubscribers(subscribers: Subscriber[], fileName = 'تقرير_مشتركي_الساري_للبث_الارضي.xlsx') {
    const data = subscribers.map((sub, index) => ({
      'ت': index + 1,
      'اسم المشترك': sub.name,
      'رقم الهاتف': sub.phone,
      'رقم الجهاز': sub.deviceId,
      'الوكيل المسؤول': sub.agentName,
      'نوع الباقة': sub.status === 'active' && sub.amount > 0 ? sub.subscriptionType : '-',
      'الحالة': sub.status === 'active' ? 'فعال' : sub.status === 'expiring_soon' ? 'منتهي قريباً' : 'غير فعال',
      'حالة الدفع': sub.status === 'active' ? (sub.paymentStatus === 'paid' ? 'مسدد' : 'دين') : '-',
      'المبلغ (د.ع)': sub.amount > 0 ? sub.amount : 0,
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

  async importSubscribersFromExcel(
    file: File,
    agents: Agent[] = []
  ): Promise<{ subscribers: Subscriber[]; newAgents: Agent[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const allSubscribers: Subscriber[] = [];
          const discoveredAgentsMap = new Map<string, Agent>();
          const knownAgents = [...agents];

          const todayStr = new Date().toISOString().split('T')[0];

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) return;

            const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            if (!json || json.length === 0) return;

            // Check if sheetName corresponds to an agent
            const sheetMatch = matchAgent(sheetName, knownAgents);
            const isSheetExplicitAgent = sheetMatch.agentId !== 'agent-main' || isHQName(sheetName);

            json.forEach((row, idx) => {
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

              // Skip row if no name and no device ID
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

                // If matched to main center but raw text was clearly a specific agent name (not HQ):
                if (finalAgentId === 'agent-main' && !isHQName(agentStr)) {
                  const existing = Array.from(discoveredAgentsMap.values()).find(
                    (a) => a.name.toLowerCase() === agentStr.toLowerCase()
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

              // Populate fields from parsed values
              const subscriptionType = parseDuration(rawDuration) || '1 شهر';
              const startDate = formatExcelDate(rawStartDate, 0) || todayStr;
              
              let durationDays = 30;
              if (subscriptionType === 'شهرين') durationDays = 60;
              else if (subscriptionType === '3 أشهر') durationDays = 90;
              else if (subscriptionType === '6 أشهر') durationDays = 180;
              else if (subscriptionType === 'سنة') durationDays = 365;

              const endDate = formatExcelDate(rawEndDate, durationDays);
              // Default to 'active' if status parsing fails
              const status = parseStatus(rawStatus, endDate) || 'active';
              // Default to 'paid' if payment status parsing fails
              const paymentStatus = parsePaymentStatus(rawPayment) || 'paid';
              
              const amount = typeof rawAmount === 'number' && rawAmount > 0
                ? rawAmount
                : Number(rawAmount) > 0
                ? Number(rawAmount)
                : calculateDefaultPrice(subscriptionType);

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

          resolve({
            subscribers: allSubscribers,
            newAgents: Array.from(discoveredAgentsMap.values())
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
};

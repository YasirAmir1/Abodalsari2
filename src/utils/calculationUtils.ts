import type { Invoice, Subscriber } from '../types';

export const getInvoiceRemainingAmount = (invoice: Invoice): number => {
  const remaining = Number(invoice?.remainingAmount);
  if (Number.isFinite(remaining)) return Math.max(0, remaining);
  const amount = Number(invoice?.amount) || 0;
  const paid = Number(invoice?.paidAmount) || 0;
  return Math.max(0, amount - paid);
};

export const buildSubscriberDebtMap = (invoices: Invoice[] = []): Map<string, number> => {
  const map = new Map<string, number>();
  if (!invoices) return map;
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    if (inv && inv.subscriberId) {
      const remaining = getInvoiceRemainingAmount(inv);
      const current = map.get(inv.subscriberId) || 0;
      map.set(inv.subscriberId, current + remaining);
    }
  }
  return map;
};

export const getSubscriberOutstandingDebt = (
  subscriber: Subscriber,
  invoicesOrDebtMap?: Invoice[] | Map<string, number>
): number => {
  if (!subscriber) return 0;

  // 1. If subscriber is explicitly marked paid with 0 debtAmount
  if (subscriber.paymentStatus === 'paid' && (!subscriber.debtAmount || subscriber.debtAmount <= 0)) {
    return 0;
  }

  // 2. Check if subscriber has invoices
  if (invoicesOrDebtMap instanceof Map) {
    if (invoicesOrDebtMap.has(subscriber.id)) {
      return Math.max(0, invoicesOrDebtMap.get(subscriber.id) || 0);
    }
  } else if (Array.isArray(invoicesOrDebtMap) && invoicesOrDebtMap.length > 0) {
    const hasInvoices = invoicesOrDebtMap.some((inv) => inv && inv.subscriberId === subscriber.id);
    if (hasInvoices) {
      const debtMap = buildSubscriberDebtMap(invoicesOrDebtMap);
      return Math.max(0, debtMap.get(subscriber.id) || 0);
    }
  }

  // 3. Fallback for legacy subscribers without invoice records
  if (Number.isFinite(Number(subscriber.debtAmount))) {
    return Math.max(0, Number(subscriber.debtAmount));
  }

  if (subscriber.paymentStatus === 'debt' || subscriber.paymentStatus === 'partial') {
    const amt = Number(subscriber.amount) || 0;
    const paid = Number(subscriber.paidAmount) || 0;
    return Math.max(0, amt - paid);
  }

  return 0;
};

export const calculateTotalSales = (invoices: any[]): number => {
  if (!invoices) return 0;
  let sum = 0;
  for (let i = 0; i < invoices.length; i++) {
    sum += Number(invoices[i]?.amount) || 0;
  }
  return sum;
};

export const calculateTotalDebts = (subscribers: Subscriber[], invoices: Invoice[] = []): number => {
  if (!subscribers || subscribers.length === 0) return 0;
  const debtMap = buildSubscriberDebtMap(invoices);
  let total = 0;
  for (let i = 0; i < subscribers.length; i++) {
    total += getSubscriberOutstandingDebt(subscribers[i], debtMap);
  }
  return total;
};

export const calculateAgentSales = (agentId: string, invoices: any[]): number => {
  if (!invoices) return 0;
  let sum = 0;
  for (let i = 0; i < invoices.length; i++) {
    if (invoices[i]?.agentId === agentId) {
      sum += Number(invoices[i]?.amount) || 0;
    }
  }
  return sum;
};

export const calculateAgentDebt = (agentId: string, subscribers: Subscriber[], invoices: Invoice[] = []): number => {
  if (!subscribers || subscribers.length === 0) return 0;
  const debtMap = buildSubscriberDebtMap(invoices);
  let total = 0;
  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    if (sub.agentId === agentId || sub.agentName) {
      total += getSubscriberOutstandingDebt(sub, debtMap);
    }
  }
  return total;
};

export const calculateAgentSubscriberDebt = (
  agentId: string,
  agentName: string,
  subscribers: Subscriber[],
  debtMap: Map<string, number>
): number => {
  let total = 0;
  for (let i = 0; i < subscribers.length; i++) {
    const subscriber = subscribers[i];
    if (subscriber.agentId === agentId || subscriber.agentName === agentName) {
      total += getSubscriberOutstandingDebt(subscriber, debtMap);
    }
  }
  return total;
};

function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا').replace(/ة/g, 'ه');
}

function doesSubscriberBelongToAgent(sub: Subscriber, agent: any): boolean {
  if (!sub || !agent) return false;
  if (sub.agentId && agent.id && sub.agentId === agent.id) return true;
  const subName = normalizeStr(sub.agentName);
  const agentName = normalizeStr(agent.name);
  const agentCode = normalizeStr(agent.code);
  if (subName && agentName && (subName === agentName || subName.includes(agentName) || agentName.includes(subName))) return true;
  if (subName && agentCode && (subName === agentCode || subName.includes(agentCode))) return true;
  return false;
}

function doesInvoiceBelongToAgent(inv: Invoice, agent: any): boolean {
  if (!inv || !agent) return false;
  if (inv.agentId && agent.id && inv.agentId === agent.id) return true;
  const invName = normalizeStr(inv.agentName);
  const agentName = normalizeStr(agent.name);
  const agentCode = normalizeStr(agent.code);
  if (invName && agentName && (invName === agentName || invName.includes(agentName) || agentName.includes(invName))) return true;
  if (invName && agentCode && (invName === agentCode || invName.includes(agentCode))) return true;
  return false;
}

function getInvoiceAmount(invoice: Invoice): number {
  const amount = Number(invoice?.amount);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function computeUpdatedAgents(agents: any[], subscribers: Subscriber[], invoices: Invoice[]): any[] {
  const debtMap = buildSubscriberDebtMap(invoices);
  return agents.map((agent) => {
    const agentSubscribers = subscribers.filter((sub) => doesSubscriberBelongToAgent(sub, agent));
    const activeSubscribers = agentSubscribers.filter((sub) => sub.status === 'active');
    const inactiveSubscribers = agentSubscribers.filter((sub) => sub.status !== 'active');
    const agentInvoices = invoices.filter((inv) => doesInvoiceBelongToAgent(inv, agent));

    let invoiceSales = 0;
    for (let i = 0; i < agentInvoices.length; i++) {
      invoiceSales += getInvoiceAmount(agentInvoices[i]);
    }

    let subscriberDebt = 0;
    const countedSubIds = new Set<string>();
    for (let i = 0; i < agentSubscribers.length; i++) {
      const sub = agentSubscribers[i];
      subscriberDebt += getSubscriberOutstandingDebt(sub, debtMap);
      if (sub.id) countedSubIds.add(sub.id);
    }

    let additionalInvoiceDebt = 0;
    for (let i = 0; i < agentInvoices.length; i++) {
      const inv = agentInvoices[i];
      if (!inv.subscriberId || !countedSubIds.has(inv.subscriberId)) {
        additionalInvoiceDebt += getInvoiceRemainingAmount(inv);
      }
    }

    const calculatedDebt = Math.max(0, subscriberDebt + additionalInvoiceDebt);

    const totalSales = agentInvoices.length > 0
      ? invoiceSales
      : Math.max(0, Number(agent.totalSales) || 0);

    const totalDebt = (agentSubscribers.length > 0 || agentInvoices.length > 0)
      ? calculatedDebt
      : Math.max(0, Number(agent.totalDebt) || 0);

    const totalPaid = Math.max(0, totalSales - totalDebt);
    const hasDebt = totalDebt > 0;

    return {
      ...agent,
      devicesCount: agentSubscribers.length,
      activeSubscriptions: activeSubscribers.length,
      inactiveSubscriptions: inactiveSubscribers.length,
      totalSales,
      totalDebt,
      totalPaid,
      hasDebt
    };
  });
}

export function getSalesChartData(invoices: Invoice[] = []) {
  const daysInArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const chartData = [];
  
  // Get last 7 days including today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - i);
    
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayName = daysInArabic[targetDate.getDay()];
    
    // Sum invoice amounts for this date
    const dailyTotal = invoices
      .filter(inv => inv.date && inv.date.startsWith(dateStr))
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      
    // Format label (e.g., 315k or 15k)
    let label = '0';
    if (dailyTotal >= 1000) {
      label = (dailyTotal / 1000).toFixed(dailyTotal % 1000 === 0 ? 0 : 1) + 'k';
    } else if (dailyTotal > 0) {
      label = dailyTotal.toString();
    }

    chartData.push({
      day: dayName,
      amount: dailyTotal,
      label: label === '0' ? '' : label,
      fullLabel: dailyTotal.toLocaleString() + ' د.ع'
    });
  }

  return chartData;
}

export function getMonthlyFinancialSummary(invoices: Invoice[] = []) {
  const monthsInArabic = [
    'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
    'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
  ];
  
  const monthlyMap = new Map<string, { 
    monthName: string, 
    year: number, 
    month: number,
    sales: number, 
    paid: number, 
    debt: number 
  }>();

  // Process all invoices to group by month
  invoices.forEach(inv => {
    if (!inv.date) return;
    const date = new Date(inv.date);
    const month = date.getMonth();
    const year = date.getFullYear();
    const key = `${year}-${month}`;

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, {
        monthName: monthsInArabic[month],
        year,
        month,
        sales: 0,
        paid: 0,
        debt: 0
      });
    }

    const entry = monthlyMap.get(key)!;
    entry.sales += Number(inv.amount) || 0;
    entry.paid += Number(inv.paidAmount) || 0;
    entry.debt += Number(inv.remainingAmount) || 0;
  });

  // Convert map to array and sort by date (descending for table, ascending for chart)
  const summary = Array.from(monthlyMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return summary;
}

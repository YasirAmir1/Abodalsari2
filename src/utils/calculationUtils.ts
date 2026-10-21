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
      if (remaining > 0) {
        map.set(inv.subscriberId, (map.get(inv.subscriberId) || 0) + remaining);
      }
    }
  }
  return map;
};

export const getSubscriberOutstandingDebt = (
  subscriber: Subscriber,
  invoicesOrDebtMap?: Invoice[] | Map<string, number>
): number => {
  if (!subscriber) return 0;
  if (invoicesOrDebtMap instanceof Map) {
    const debtFromMap = invoicesOrDebtMap.get(subscriber.id);
    if (debtFromMap !== undefined) {
      return debtFromMap;
    }
  } else if (Array.isArray(invoicesOrDebtMap) && invoicesOrDebtMap.length > 0) {
    const debtMap = buildSubscriberDebtMap(invoicesOrDebtMap);
    const debtFromMap = debtMap.get(subscriber.id);
    if (debtFromMap !== undefined) {
      return debtFromMap;
    }
  }

  const legacyBalance = Number.isFinite(Number(subscriber.debtAmount))
    ? Number(subscriber.debtAmount)
    : (subscriber.paymentStatus === 'debt' || subscriber.paymentStatus === 'partial' ? Number(subscriber.amount) : 0);
  return Math.max(0, Number.isFinite(legacyBalance) ? legacyBalance : 0);
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
    if (sub.agentId === agentId) {
      total += getSubscriberOutstandingDebt(sub, debtMap);
    }
  }
  return total;
};

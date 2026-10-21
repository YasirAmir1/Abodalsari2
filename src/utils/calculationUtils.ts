import type { Invoice, Subscriber } from '../types';

export const getInvoiceRemainingAmount = (invoice: Invoice) => {
  const remaining = Number(invoice.remainingAmount);
  if (Number.isFinite(remaining)) return Math.max(0, remaining);
  const amount = Number(invoice.amount) || 0;
  const paid = Number(invoice.paidAmount) || 0;
  return Math.max(0, amount - paid);
};

export const getSubscriberOutstandingDebt = (subscriber: Subscriber, invoices: Invoice[] = []) => {
  const subscriberInvoices = invoices.filter((invoice) => invoice.subscriberId === subscriber.id);
  if (subscriberInvoices.length > 0) {
    return subscriberInvoices.reduce((sum, invoice) => sum + getInvoiceRemainingAmount(invoice), 0);
  }

  const legacyBalance = Number.isFinite(Number(subscriber.debtAmount))
    ? Number(subscriber.debtAmount)
    : (subscriber.paymentStatus === 'debt' || subscriber.paymentStatus === 'partial' ? Number(subscriber.amount) : 0);
  return Math.max(0, Number.isFinite(legacyBalance) ? legacyBalance : 0);
};

export const calculateTotalSales = (invoices: any[]) => {
  return (invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
};

export const calculateTotalDebts = (subscribers: Subscriber[], invoices: Invoice[] = []) => {
  return (subscribers || []).reduce((sum, subscriber) => sum + getSubscriberOutstandingDebt(subscriber, invoices), 0);
};

export const calculateAgentSales = (agentId: string, invoices: any[]) => {
  return (invoices || [])
    .filter((inv) => inv.agentId === agentId)
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
};

export const calculateAgentDebt = (agentId: string, subscribers: Subscriber[], invoices: Invoice[] = []) => {
  return (subscribers || [])
    .filter((subscriber) => subscriber.agentId === agentId)
    .reduce((sum, subscriber) => sum + getSubscriberOutstandingDebt(subscriber, invoices), 0);
};

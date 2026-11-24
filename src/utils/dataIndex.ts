import type { Agent, Invoice, Subscriber } from '../types';

export interface SubscriberSearchIndex {
  items: Subscriber[];
  byStatus: Map<string, number[]>;
  byAgentId: Map<string, number[]>;
  byDeviceId: Map<string, Subscriber>;
  byId: Map<string, Subscriber>;
  searchKeys: string[];
  startDateKeys: string[];
  endDateKeys: string[];
  createdAtKeys: string[];
}

export interface InvoiceSearchIndex {
  items: Invoice[];
  byAgentId: Map<string, number[]>;
  byPaymentStatus: Map<string, number[]>;
  bySubscriberId: Map<string, number[]>;
  searchKeys: string[];
  dateKeys: string[];
}

export function createSubscriberIndex(subscribers: Subscriber[]): SubscriberSearchIndex {
  const byStatus = new Map<string, number[]>();
  const byAgentId = new Map<string, number[]>();
  const byDeviceId = new Map<string, Subscriber>();
  const byId = new Map<string, Subscriber>();
  const searchKeys = new Array<string>(subscribers.length);
  const startDateKeys = new Array<string>(subscribers.length);
  const endDateKeys = new Array<string>(subscribers.length);
  const createdAtKeys = new Array<string>(subscribers.length);

  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    if (!sub) continue;

    if (sub.id) byId.set(sub.id, sub);
    if (sub.deviceId) byDeviceId.set(sub.deviceId, sub);

    const statusKey = sub.status || '';
    let statusBucket = byStatus.get(statusKey);
    if (!statusBucket) {
      statusBucket = [];
      byStatus.set(statusKey, statusBucket);
    }
    statusBucket.push(i);

    const agentKey = sub.agentId || 'agent-main';
    let agentBucket = byAgentId.get(agentKey);
    if (!agentBucket) {
      agentBucket = [];
      byAgentId.set(agentKey, agentBucket);
    }
    agentBucket.push(i);

    searchKeys[i] = `${(sub.name || '').toLowerCase()}\u0000${sub.phone || ''}\u0000${(sub.deviceId || '').toLowerCase()}\u0000${(sub.agentName || '').toLowerCase()}`;
    startDateKeys[i] = sub.startDate ? sub.startDate.split('T')[0] : '';
    endDateKeys[i] = sub.endDate ? sub.endDate.split('T')[0] : '';
    createdAtKeys[i] = sub.createdAt ? sub.createdAt.split('T')[0] : '';
  }

  return {
    items: subscribers,
    byStatus,
    byAgentId,
    byDeviceId,
    byId,
    searchKeys,
    startDateKeys,
    endDateKeys,
    createdAtKeys
  };
}

export function querySubscribersWithIndex(
  index: SubscriberSearchIndex,
  options: {
    statusFilter?: string;
    agentFilter?: string;
    agents?: Agent[];
    dateFieldFilter?: 'startDate' | 'endDate' | 'createdAt';
    dateStartFilter?: string;
    dateEndFilter?: string;
    searchTerm?: string;
    predicate?: (sub: Subscriber, idx: number) => boolean;
  }
): Subscriber[] {
  const {
    statusFilter = 'all',
    agentFilter = 'all',
    agents = [],
    dateFieldFilter = 'startDate',
    dateStartFilter = '',
    dateEndFilter = '',
    searchTerm = '',
    predicate
  } = options;

  const trimmedQuery = searchTerm.trim().toLowerCase();
  const dateArray =
    dateFieldFilter === 'endDate'
      ? index.endDateKeys
      : dateFieldFilter === 'createdAt'
      ? index.createdAtKeys
      : index.startDateKeys;

  let targetAgentName = '';
  if (agentFilter !== 'all' && agentFilter !== 'agent-main') {
    const foundAgent = agents.find((a) => a.id === agentFilter);
    if (foundAgent) targetAgentName = foundAgent.name;
  }

  // Narrow candidate indices using indexed buckets when available
  let candidateIndices: number[] | null = null;
  if (statusFilter !== 'all') {
    const statusBucket = index.byStatus.get(statusFilter) || [];
    candidateIndices = statusBucket;
  }
  if (agentFilter !== 'all' && agentFilter !== 'agent-main' && !targetAgentName) {
    const agentBucket = index.byAgentId.get(agentFilter) || [];
    if (!candidateIndices || agentBucket.length < candidateIndices.length) {
      candidateIndices = agentBucket;
    }
  }

  const results: Subscriber[] = [];
  const count = candidateIndices ? candidateIndices.length : index.items.length;

  for (let k = 0; k < count; k++) {
    const i = candidateIndices ? candidateIndices[k] : k;
    const sub = index.items[i];
    if (!sub) continue;

    if (statusFilter !== 'all' && sub.status !== statusFilter) continue;

    if (agentFilter !== 'all') {
      if (agentFilter === 'agent-main') {
        const isMain = sub.agentId === 'agent-main' || sub.agentName === 'المركز الرئيسي' || !sub.agentId || sub.agentName === 'الأدمن';
        if (!isMain) continue;
      } else if (sub.agentId !== agentFilter && (!targetAgentName || sub.agentName !== targetAgentName)) {
        continue;
      }
    }

    if (dateStartFilter || dateEndFilter) {
      const subDate = dateArray[i];
      if (dateStartFilter && (!subDate || subDate < dateStartFilter)) continue;
      if (dateEndFilter && (!subDate || subDate > dateEndFilter)) continue;
    }

    if (trimmedQuery && !index.searchKeys[i].includes(trimmedQuery)) continue;

    if (predicate && !predicate(sub, i)) continue;

    results.push(sub);
  }

  return results;
}

export function createInvoiceIndex(invoices: Invoice[]): InvoiceSearchIndex {
  const byAgentId = new Map<string, number[]>();
  const byPaymentStatus = new Map<string, number[]>();
  const bySubscriberId = new Map<string, number[]>();
  const searchKeys = new Array<string>(invoices.length);
  const dateKeys = new Array<string>(invoices.length);

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    if (!inv) continue;

    const agentKey = inv.agentId || 'agent-main';
    let agentBucket = byAgentId.get(agentKey);
    if (!agentBucket) {
      agentBucket = [];
      byAgentId.set(agentKey, agentBucket);
    }
    agentBucket.push(i);

    const payKey = inv.paymentStatus || '';
    let payBucket = byPaymentStatus.get(payKey);
    if (!payBucket) {
      payBucket = [];
      byPaymentStatus.set(payKey, payBucket);
    }
    payBucket.push(i);

    if (inv.subscriberId) {
      let subBucket = bySubscriberId.get(inv.subscriberId);
      if (!subBucket) {
        subBucket = [];
        bySubscriberId.set(inv.subscriberId, subBucket);
      }
      subBucket.push(i);
    }

    searchKeys[i] = `${(inv.subscriberName || '').toLowerCase()}\u0000${(inv.deviceId || '').toLowerCase()}\u0000${(inv.invoiceNumber || '').toLowerCase()}\u0000${(inv.agentName || '').toLowerCase()}`;
    dateKeys[i] = inv.date ? inv.date.split('T')[0] : '';
  }

  return {
    items: invoices,
    byAgentId,
    byPaymentStatus,
    bySubscriberId,
    searchKeys,
    dateKeys
  };
}

export function queryInvoicesWithIndex(
  index: InvoiceSearchIndex,
  options: {
    agentFilter?: string;
    paymentFilter?: string;
    searchTerm?: string;
  }
): Invoice[] {
  const { agentFilter = 'all', paymentFilter = 'all', searchTerm = '' } = options;
  const trimmedQuery = searchTerm.trim().toLowerCase();

  let candidateIndices: number[] | null = null;
  if (agentFilter !== 'all') {
    candidateIndices = index.byAgentId.get(agentFilter) || [];
  }
  if (paymentFilter !== 'all') {
    const payBucket = index.byPaymentStatus.get(paymentFilter) || [];
    if (!candidateIndices || payBucket.length < candidateIndices.length) {
      candidateIndices = payBucket;
    }
  }

  const results: Invoice[] = [];
  const count = candidateIndices ? candidateIndices.length : index.items.length;

  for (let k = 0; k < count; k++) {
    const i = candidateIndices ? candidateIndices[k] : k;
    const inv = index.items[i];
    if (!inv) continue;

    if (agentFilter !== 'all' && inv.agentId !== agentFilter) continue;
    if (paymentFilter !== 'all' && inv.paymentStatus !== paymentFilter) continue;
    if (trimmedQuery && !index.searchKeys[i].includes(trimmedQuery)) continue;

    results.push(inv);
  }

  return results;
}

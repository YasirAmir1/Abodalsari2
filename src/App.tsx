
function syncAgentsAndPersist(
  currentState: AppState,
  updatedSubscribers: Subscriber[],
  updatedInvoices: Invoice[],
  failureMessage = 'Could not sync agent state:'
): AppState {
  const updatedAgents = computeUpdatedAgents(currentState.agents, updatedSubscribers, updatedInvoices);
  return {
    ...currentState,
    subscribers: updatedSubscribers,
    invoices: updatedInvoices,
    agents: updatedAgents,
    lastUpdatedTimestamp: Date.now()
  };
}



function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا').replace(/ة/g, 'ه');
}

function doesSubscriberBelongToAgent(sub: Subscriber, agent: Agent): boolean {
  if (!sub || !agent) return false;
  if (sub.agentId && agent.id && sub.agentId === agent.id) return true;
  const subName = normalizeStr(sub.agentName);
  const agentName = normalizeStr(agent.name);
  const agentCode = normalizeStr(agent.code);
  if (subName && agentName && (subName === agentName || subName.includes(agentName) || agentName.includes(subName))) return true;
  if (subName && agentCode && (subName === agentCode || subName.includes(agentCode))) return true;
  return false;
}

function doesInvoiceBelongToAgent(inv: Invoice, agent: Agent): boolean {
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

function computeUpdatedAgents(agents: Agent[], subscribers: Subscriber[], invoices: Invoice[]): Agent[] {
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


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  Agent,
  DeviceCode,
  Invoice,
  PendingRenewalRequest,
  PricingRow,
  Product,
  SecurityAlert,
  Subscriber,
  SubscriptionDuration,
  SystemUser,
  PaymentStatus
} from './types';
import { RefreshCw, X } from 'lucide-react';
import { AppState, storageService } from './services/storageService';
import { firebaseService } from './services/firebaseService';
import { syncManager } from './services/firebase-sync';
import { appFeatures } from './services/app-features';
import { soundService } from './services/soundService';
import { getInvoiceRemainingAmount, getSubscriberOutstandingDebt, buildSubscriberDebtMap } from './utils/calculationUtils';

import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { useAppDialogs } from './components/AppDialogProvider';

const USER_SESSION_KEY = 'alsari_auth_user_v1';
const DATABASE_CONNECTION_ERROR = 'تعذر الاتصال بقاعدة البيانات المباشرة. ستستأنف المزامنة عند عودة الاتصال.';
const DashboardView = lazy(() => import('./components/DashboardView').then(({ DashboardView }) => ({ default: DashboardView })));
const SubscribersView = lazy(() => import('./components/SubscribersView').then(({ SubscribersView }) => ({ default: SubscribersView })));
const PendingRequestsView = lazy(() => import('./components/PendingRequestsView').then(({ PendingRequestsView }) => ({ default: PendingRequestsView })));
const AgentsView = lazy(() => import('./components/AgentsView').then(({ AgentsView }) => ({ default: AgentsView })));
const ProductsView = lazy(() => import('./components/ProductsView').then(({ ProductsView }) => ({ default: ProductsView })));
const QrCodesView = lazy(() => import('./components/QrCodesView').then(({ QrCodesView }) => ({ default: QrCodesView })));
const PricingView = lazy(() => import('./components/PricingView').then(({ PricingView }) => ({ default: PricingView })));
const SalesInvoicesView = lazy(() => import('./components/SalesInvoicesView').then(({ SalesInvoicesView }) => ({ default: SalesInvoicesView })));
const DebtsView = lazy(() => import('./components/DebtsView').then(({ DebtsView }) => ({ default: DebtsView })));
const ActiveSubscribersView = lazy(() => import('./components/ActiveSubscribersView').then(({ ActiveSubscribersView }) => ({ default: ActiveSubscribersView })));
const AgentPortalView = lazy(() => import('./components/AgentPortalView').then(({ AgentPortalView }) => ({ default: AgentPortalView })));
const WhatsAppModal = lazy(() => import('./components/WhatsAppModal').then(({ WhatsAppModal }) => ({ default: WhatsAppModal })));
const ReceiptModal = lazy(() => import('./components/ReceiptModal').then(({ ReceiptModal }) => ({ default: ReceiptModal })));
const DeviceQrModal = lazy(() => import('./components/DeviceQrModal').then(({ DeviceQrModal }) => ({ default: DeviceQrModal })));
const InvoiceSuccessModal = lazy(() => import('./components/InvoiceSuccessModal').then(({ InvoiceSuccessModal }) => ({ default: InvoiceSuccessModal })));

export default function App() {
  const { showAlert } = useAppDialogs();
  const [state, setState] = useState<AppState>(() => {
    const loaded = storageService.loadState();
    const freshAgents = computeUpdatedAgents(loaded.agents, loaded.subscribers, loaded.invoices);
    return { ...loaded, agents: freshAgents };
  });
  const [isRemoteReady, setIsRemoteReady] = useState(false);
  const stateRef = useRef(state);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Current logged in user
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  });

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('agent-01');

  // Modals state
  const [activeWhatsAppSub, setActiveWhatsAppSub] = useState<Subscriber | null>(null);
  const [activeReceiptInvoice, setActiveReceiptInvoice] = useState<Invoice | null>(null);
  const [selectedDeviceForQr, setSelectedDeviceForQr] = useState<{
    deviceId: string;
    subscriberName?: string;
    agentName?: string;
  } | null>(null);

  const [invoiceSuccessData, setInvoiceSuccessData] = useState<{
    invoice: Invoice;
    startDate: string;
    endDate: string;
    phone?: string;
  } | null>(null);

  // Filter pass-through
  const [subscribersAgentFilter, setSubscribersAgentFilter] = useState<string | undefined>(undefined);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const syncToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMountedRef = useRef(true);

  const showSyncToast = useCallback((message: string, durationMs = 4000) => {
    if (syncToastTimerRef.current) {
      clearTimeout(syncToastTimerRef.current);
      syncToastTimerRef.current = null;
    }
    setSyncToast(message);
    if (durationMs > 0) {
      syncToastTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setSyncToast(null);
        }
      }, durationMs);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (syncToastTimerRef.current) {
        clearTimeout(syncToastTimerRef.current);
      }
    };
  }, []);

  // Dark mode state matching reference image
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('alsari_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [themeToast, setThemeToast] = useState<string | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('alsari_theme', 'dark'); } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('alsari_theme', 'light'); } catch {}
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setThemeToast(next ? 'الوضع الليلي' : 'الوضع النهاري');
      setTimeout(() => setThemeToast(null), 3500);
      return next;
    });
  };

  // Centralized state update function
  const updateAppState = (
    updates: Partial<AppState>,
    failureMessage = 'تعذرت مزامنة البيانات:'
  ) => {
    const currentState = stateRef.current;
    const nextState = {
      ...currentState,
      ...updates,
      lastUpdatedTimestamp: Date.now()
    };

    // If subscribers or invoices changed, recompute agent metrics immediately
    if (updates.subscribers || updates.invoices || updates.agents) {
      nextState.agents = computeUpdatedAgents(
        updates.agents || currentState.agents,
        updates.subscribers || currentState.subscribers,
        updates.invoices || currentState.invoices
      );
    }

    persistStateImmediately(nextState, failureMessage, true);
  };

  const persistStateImmediately = (nextState: AppState, failureMessage: string, atomic = false) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const committedState: AppState = {
      ...nextState,
      lastUpdatedTimestamp: Date.now()
    };

    stateRef.current = committedState;
    storageService.saveState(committedState);
    setState(committedState);

    void firebaseService.saveRemoteState(committedState, true, atomic).catch((error) => {
      console.warn(failureMessage, error);
      if (isMountedRef.current) {
        showSyncToast('تم حفظ التعديلات محلياً بنجاح (وضع عدم الاتصال).', 3500);
      }
    });
  };


  // Expire subscriptions against the local calendar date after the first
  // server synchronization, and recheck periodically while the app is open.
  // Invoice balances remain the ledger source, so clearing subscription fields
  // does not erase unpaid amounts or payment history.
  useEffect(() => {
    if (!isRemoteReady) return;

    const expireSubscriptions = () => {
      const currentState = stateRef.current;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      let changed = false;

      const debtMap = buildSubscriberDebtMap(currentState.invoices);
      const subscribers = currentState.subscribers.map((subscriber) => {
        if (subscriber.status !== 'active' || !subscriber.endDate || subscriber.endDate === '-') return subscriber;
        if (subscriber.endDate > today) return subscriber;

        changed = true;
        const outstandingDebt = getSubscriberOutstandingDebt(subscriber, debtMap);
        return {
          ...subscriber,
          status: 'inactive' as const,
          subscriptionType: '' as SubscriptionDuration,
          startDate: '',
          endDate: '',
          amount: 0,
          paymentStatus: '' as const,
          debtAmount: outstandingDebt > 0 ? outstandingDebt : undefined,
          originalAmount: subscriber.originalAmount,
          paidAmount: subscriber.paidAmount,
          settleDate: subscriber.settleDate
        };
      });

      if (!changed) return;

      const agents = computeUpdatedAgents(currentState.agents, subscribers, currentState.invoices);

      persistStateImmediately({ ...currentState, subscribers, agents }, 'Could not sync expired subscriptions:');
    };

    expireSubscriptions();
    const timer = window.setInterval(expireSubscriptions, 60_000);
    window.addEventListener('focus', expireSubscriptions);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', expireSubscriptions);
    };
  }, [isRemoteReady]);

  // --- Effect 2: Real-time Firestore listener (cross-device sync) & AppFeatures streams ---
  useEffect(() => {
    if (!currentUser) {
      syncManager.stopListening();
      setIsRemoteReady(false);
      return;
    }

    const unsubscribe = syncManager.startListening((remoteState) => {
      if (!remoteState) return;

      const filteredState = storageService.filterOutDeleted(remoteState);
      const stateWithAgentMetrics = {
        ...filteredState,
        agents: computeUpdatedAgents(filteredState.agents, filteredState.subscribers, filteredState.invoices)
      };

      // Save to localStorage immediately so a subsequent reload retains fresh remote state
      storageService.saveState(stateWithAgentMetrics);

      stateRef.current = stateWithAgentMetrics;
      setState(stateWithAgentMetrics);
    });

    const unsubscribeStatus = firebaseService.onSyncStatusChange((status) => {
      if (status === 'connected' && isMountedRef.current) {
        setIsRemoteReady(true);
        if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
        setSyncToast(null);
      }
      if (status === 'offline' && isMountedRef.current) {
        if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
        setSyncToast(null);
      }
      if (status === 'error' && isMountedRef.current) {
        showSyncToast(DATABASE_CONNECTION_ERROR, 4000);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [currentUser?.id]);

  // Current selected agent
  const currentAgent = state.agents.find((a) => a.id === selectedAgentId) || state.agents[1];

  // Auth Handlers
  const handleLogin = async (user: SystemUser, remoteState?: AppState) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }

    if (user.role === 'وكيل معتمد' && user.agentId) {
      setIsAgentMode(true);
      setSelectedAgentId(user.agentId);
      setCurrentTab('agent_portal');
    } else {
      setIsAgentMode(false);
      setCurrentTab('dashboard');
    }
    soundService.playSuccess();

    try {
      const freshRemote = remoteState || await firebaseService.fetchFreshRemoteState();
      if (freshRemote) {
        const filtered = storageService.filterOutDeleted(freshRemote);
        stateRef.current = filtered;
        storageService.saveState(filtered);
        setState(filtered);
        setIsRemoteReady(true);
      }
    } catch (err) {
      console.warn('Could not fetch initial cloud state on login:', err);
    }
  };

  const handleLogout = () => {
    syncManager.stopListening();
    setIsRemoteReady(false);
    setCurrentUser(null);
    try {
      localStorage.removeItem(USER_SESSION_KEY);
    } catch {
      // ignore
    }
  };

  const handleManualSync = async () => {
    setSyncToast('جاري المزامنة...');
    try {
      const freshRemote = await firebaseService.fetchFreshRemoteState();
      if (freshRemote) {
        const filtered = storageService.filterOutDeleted(freshRemote);
        stateRef.current = filtered;
        storageService.saveState(filtered);
        setState(filtered);
        setSyncToast('تم تحديث البيانات بنجاح.');
      } else {
        setSyncToast('لا توجد بيانات جديدة.');
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncToast('فشلت المزامنة. حاول مجدداً.');
    }
    setTimeout(() => setSyncToast(null), 3000);
  };

  const handleToggleAgentMode = () => {
    const nextMode = !isAgentMode;
    setIsAgentMode(nextMode);
    if (nextMode) {
      setCurrentTab('agent_portal');
    } else {
      setCurrentTab('dashboard');
    }
  };

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    setSubscribersAgentFilter(undefined);
  };

  // Open QR modal helper
  const handleOpenDeviceQr = (deviceId: string, subscriberName?: string, agentName?: string) => {
    setSelectedDeviceForQr({ deviceId, subscriberName, agentName });
  };

  const handleDeleteInvoice = (id: string) => {
    storageService.addDeletedInvoiceId(id);
    const currentState = stateRef.current;
    const invoiceToDelete = currentState.invoices.find((invoice) => invoice.id === id);
    if (!invoiceToDelete) return;

    const deletedInvoiceAmount = getInvoiceAmount(invoiceToDelete);
    const deletedInvoicePaidAmount = Math.max(0, Number.isFinite(invoiceToDelete.paidAmount) ? invoiceToDelete.paidAmount : 0);
    const deletedInvoiceDebt = getInvoiceRemainingAmount(invoiceToDelete);
    const updatedInvoices = currentState.invoices.filter((invoice) => invoice.id !== id);

    const updatedSubscribers = currentState.subscribers.map((subscriber): Subscriber => {
      if (subscriber.id !== invoiceToDelete.subscriberId) return subscriber;

      const remainingDebt = Math.max(
        0,
        getSubscriberOutstandingDebt(subscriber, currentState.invoices) - deletedInvoiceDebt
      );

      return {
        ...subscriber,
        status: 'inactive' as const,
        subscriptionType: '',
        paymentStatus: '',
        amount: 0,
        debtAmount: remainingDebt > 0 ? remainingDebt : undefined,
        originalAmount: undefined,
        paidAmount: undefined,
        settleDate: undefined,
        startDate: '',
        endDate: ''
      };
    });

    void firebaseService.deleteInvoice(id);
    const updatedAgents = computeUpdatedAgents(currentState.agents, updatedSubscribers, updatedInvoices);

    const newState: AppState = {
      ...currentState,
      invoices: updatedInvoices,
      subscribers: updatedSubscribers,
      agents: updatedAgents,
      deletedInvoiceIds: Array.from(new Set([...(currentState.deletedInvoiceIds || []), id])),
      lastUpdatedTimestamp: Date.now()
    };

    persistStateImmediately(newState, 'Could not immediately sync invoice deletion:', true);
    soundService.playSuccess();
  };

  // Add Subscriber / New Sale
  const handleAddSubscriber = (
    subData: Partial<Subscriber>,
    isSale = true,
    isPaid = false,
    saleKind: 'subscription' | 'device' = 'subscription',
    pendingRequestId?: string
  ) => {
    const currentState = stateRef.current;
    storageService.setAllSubscribersCleared(false);
    const newId = `sub-${Date.now()}`;
    const rawDevId = (subData.deviceId || '').trim();
    const cleanDevId = rawDevId
      ? (rawDevId.startsWith('00') ? rawDevId : `00${rawDevId}`)
      : `00${Math.floor(100000 + Math.random() * 900000)}`;

    const deletedSet = storageService.getDeletedSubscriberIds();
    if (deletedSet.has(newId) || deletedSet.has(cleanDevId)) {
      deletedSet.delete(newId);
      deletedSet.delete(cleanDevId);
      try {
        localStorage.setItem('alsari_deleted_subscribers_v1', JSON.stringify(Array.from(deletedSet)));
      } catch {}
    }

    const assignedAgent = currentState.agents.find(
      (agent) => agent.id === subData.agentId || agent.name === subData.agentName
    );
    const newSub: Subscriber = {
      id: newId,
      name: subData.name || 'مشترك جديد',
      phone: subData.phone || '',
      deviceId: cleanDevId,
      agentId: assignedAgent?.id || subData.agentId || 'agent-main',
      agentName: assignedAgent?.name || subData.agentName || 'المركز الرئيسي',
      subscriptionType: saleKind === 'device' ? '-' : (subData.subscriptionType || '1 شهر'),
      status: saleKind === 'device' ? 'inactive' : (subData.status || 'active'),
      paymentStatus: isPaid ? 'paid' : (subData.paymentStatus || 'debt'),
      amount: subData.amount ?? 25000,
      startDate: subData.startDate || new Date().toISOString().split('T')[0],
      endDate: saleKind === 'device' ? '-' : (subData.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
      address: subData.address || '',
      notes: subData.notes || '',
      createdAt: new Date().toISOString().split('T')[0],
      isActive: saleKind === 'subscription'
    };

    let updatedInvoices = currentState.invoices;
    let updatedAgents = currentState.agents;
    let registeredInvoice: Invoice | null = null;

    if (isSale) {
      registeredInvoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${Date.now()}`,
        subscriberId: newSub.id,
        subscriberName: newSub.name,
        deviceId: newSub.deviceId,
        agentId: newSub.agentId,
        agentName: newSub.agentName,
        packageType: saleKind === 'device' ? 'بيع جهاز جديد فقط' : `اشتراك ${newSub.subscriptionType}`,
        amount: newSub.amount,
        paidAmount: isPaid ? newSub.amount : 0,
        remainingAmount: isPaid ? 0 : newSub.amount,
        paymentStatus: isPaid ? 'paid' : 'debt',
        date: newSub.startDate,
        notes: newSub.notes
      };
      updatedInvoices = [registeredInvoice, ...currentState.invoices];

      // Update Agent Financials
      updatedAgents = currentState.agents.map((ag) => {
        if (ag.id === newSub.agentId) {
          const newDebt = isPaid ? ag.totalDebt : ag.totalDebt + newSub.amount;
          const newPaid = isPaid ? ag.totalPaid + newSub.amount : ag.totalPaid;
          return {
            ...ag,
            totalSales: ag.totalSales + newSub.amount,
            totalPaid: newPaid,
            totalDebt: newDebt,
            activeSubscriptions: ag.activeSubscriptions + (newSub.status === 'active' ? 1 : 0),
            devicesCount: ag.devicesCount + 1,
            hasDebt: newDebt > 0
          };
        }
        return ag;
      });
    }

    updateAppState({
      subscribers: [newSub, ...currentState.subscribers],
      invoices: updatedInvoices,
      pendingRequests: pendingRequestId
        ? currentState.pendingRequests.filter((request) => request.id !== pendingRequestId)
        : currentState.pendingRequests
    }, 'Could not immediately sync the new subscriber:');

    soundService.playSuccess();

    if (registeredInvoice) {
      setInvoiceSuccessData({
        invoice: registeredInvoice,
        startDate: newSub.startDate,
        endDate: newSub.endDate,
        phone: newSub.phone
      });
    }
  };

  const handleUpdateSubscriber = (updated: Subscriber) => {
    const currentState = stateRef.current;
    let cleanDevId = (updated.deviceId || '').trim();
    if (cleanDevId && !cleanDevId.startsWith('00')) {
      cleanDevId = '00' + cleanDevId;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let finalStatus = updated.status;
    if (updated.endDate && updated.endDate !== '-' && updated.endDate >= todayStr) {
      if (updated.status !== 'inactive') {
        finalStatus = 'active';
      }
    }
    const fixedSub = { 
      ...updated, 
      deviceId: cleanDevId, 
      status: finalStatus,
      isActive: finalStatus === 'active' || updated.isActive
    };
    const updatedSubscribers = currentState.subscribers.map((s) => (s.id === updated.id ? fixedSub : s));
    
    updateAppState(
      { subscribers: updatedSubscribers },
      'Could not immediately sync the subscriber update:'
    );
  };

  const handleImportSubscribers = ({ subscribers: importedSubs, newAgents = [] }: { subscribers: Subscriber[], newAgents: Agent[] }) => {
    storageService.setAllSubscribersCleared(false);
    const deletedSet = storageService.getDeletedSubscriberIds();
    importedSubs.forEach((sub) => {
      deletedSet.delete(sub.id);
      if (sub.deviceId) {
        deletedSet.delete(sub.deviceId);
        if (!sub.deviceId.startsWith('00')) {
          deletedSet.delete('00' + sub.deviceId);
        }
      }
    });
    try {
      localStorage.setItem('alsari_deleted_subscribers_v1', JSON.stringify(Array.from(deletedSet)));
    } catch {}

    const currentState = stateRef.current;
    const remainingDeletedIds = storageService.getDeletedSubscriberIds();
    const existingMap = new Map<string, Subscriber>();

    currentState.subscribers.forEach((subscriber) => {
      if (!remainingDeletedIds.has(subscriber.id) && !remainingDeletedIds.has(subscriber.deviceId)) {
        existingMap.set(subscriber.deviceId, subscriber);
      }
    });

    importedSubs.forEach((subscriber) => {
      if (!remainingDeletedIds.has(subscriber.id) && !remainingDeletedIds.has(subscriber.deviceId)) {
        let deviceId = (subscriber.deviceId || '').trim();
        if (deviceId && !deviceId.startsWith('00')) {
          deviceId = '00' + deviceId;
        }
        existingMap.set(deviceId, { ...subscriber, deviceId });
      }
    });

    const updatedSubscribers = Array.from(existingMap.values());

    let currentAgents = [...currentState.agents];
    newAgents.forEach((newAgent) => {
      if (!currentAgents.some((agent) => agent.id === newAgent.id || agent.name.toLowerCase() === newAgent.name.toLowerCase())) {
        currentAgents.push(newAgent);
      }
    });

    const updatedAgents = currentAgents.map((agent) => {
      const agentSubscribers = updatedSubscribers.filter((subscriber) =>
        subscriber.agentId === agent.id ||
        (subscriber.agentName && agent.name && (
          subscriber.agentName.trim().toLowerCase() === agent.name.trim().toLowerCase() ||
          subscriber.agentName.includes(agent.name) ||
          agent.name.includes(subscriber.agentName)
        ))
      );
      const activeSubscribers = agentSubscribers.filter((subscriber) => subscriber.status === 'active');
      return {
        ...agent,
        devicesCount: agentSubscribers.length,
        activeSubscriptions: activeSubscribers.length,
        inactiveSubscriptions: agentSubscribers.length - activeSubscribers.length
      };
    });

    updateAppState({
      subscribers: updatedSubscribers
    }, 'Could not immediately sync imported subscribers:');
    soundService.playSuccess();
  };

  const handleDeleteSubscriber = async (id: string) => {
    const sub = state.subscribers.find((s) => s.id === id);
    if (sub) {
      storageService.addDeletedSubscriberId(sub.id);
      if (sub.deviceId) {
        storageService.addDeletedSubscriberId(sub.deviceId);
      }
      void firebaseService.deleteSubscriber(sub.id);
    } else {
      storageService.addDeletedSubscriberId(id);
      void firebaseService.deleteSubscriber(id);
    }

    const subDeviceId = sub?.deviceId;

    const remainingSubscribers = state.subscribers.filter(
      (s) => s.id !== id && (subDeviceId ? s.deviceId !== subDeviceId : true)
    );

    // Completely remove invoices of deleted subscriber
    const remainingInvoices = state.invoices.filter(
      (inv) => {
        const isMatch = inv.subscriberId === id || (subDeviceId && inv.deviceId === subDeviceId);
        if (isMatch && inv.id) {
          void firebaseService.deleteInvoice(inv.id);
        }
        return !isMatch;
      }
    );

    // Completely remove pending requests of deleted subscriber
    const remainingPendingRequests = state.pendingRequests.filter(
      (req) => req.subscriberId !== id && (subDeviceId ? req.deviceId !== subDeviceId : true)
    );

    // Recalculate agent stats
    const updatedAgents = state.agents.map((ag) => {
      const agSubs = remainingSubscribers.filter((s) => s.agentId === ag.id);
      const activeSubs = agSubs.filter((s) => s.status === 'active');
      const totalAgentDebt = agSubs.reduce(
        (sum, subscriber) => sum + getSubscriberOutstandingDebt(subscriber, remainingInvoices),
        0
      );
      const totalAgentSales = remainingInvoices
        .filter((invoice) => invoice.agentId === ag.id)
        .reduce((sum, invoice) => sum + getInvoiceAmount(invoice), 0);

      return {
        ...ag,
        devicesCount: agSubs.length,
        activeSubscriptions: activeSubs.length,
        inactiveSubscriptions: agSubs.length - activeSubs.length,
        totalDebt: totalAgentDebt,
        totalSales: totalAgentSales,
        hasDebt: totalAgentDebt > 0
      };
    });

    updateAppState({
      subscribers: remainingSubscribers,
      invoices: remainingInvoices,
      pendingRequests: remainingPendingRequests,
      agents: updatedAgents
    }, 'Could not immediately sync subscriber deletion:');
    
    soundService.playSuccess();
  };

  const handleDeleteAllSubscribers = async () => {
    // التحقق من الصلاحيات
    if (currentUser?.role !== 'مدير رئيسي') {
      showAlert('غير مصرح لك بتنفيذ هذه العملية. تواصل مع المدير الرئيسي.', 'صلاحيات غير كافية');
      return;
    }

    try {
      storageService.markAllSubscribersAsDeleted(state.subscribers || []);

      const resetAgents = (state.agents || []).map((ag) => ({
        ...ag,
        devicesCount: 0,
        activeSubscriptions: 0,
        inactiveSubscriptions: 0,
        totalDebt: 0,
        totalSales: 0,
        hasDebt: false
      }));

      const resetCodes = (state.codes || []).map((c) => ({
        ...c,
        status: 'available' as const,
        assignedToSubscriber: undefined
      }));

      const newState: AppState = {
        ...state,
        subscribers: [],
        invoices: [],
        pendingRequests: [],
        agents: resetAgents,
        codes: resetCodes,
        lastUpdatedTimestamp: Date.now()
      };

      try {
        localStorage.removeItem('alsari_deleted_subscribers_v1');
        localStorage.removeItem('alsari_deleted_invoices_v1');
        localStorage.removeItem('alsari_all_subscribers_cleared_v1');
      } catch {}

      storageService.saveState(newState);
      setState(newState);

      await firebaseService.saveRemoteState(newState, true, true);

      soundService.playSuccess();
      setSyncToast('تم تصفير التطبيق والموقع وحذف كافة البيانات والسجلات بنجاح 🗑️✨');
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err: any) {
      console.error('Delete all subscribers error:', err);
      throw new Error(err?.message || 'حدث خطأ أثناء عملية الحذف الشامل في قاعدة البيانات.');
    }
  };

  // Deactivate Subscriber (Reset information to blank and status to inactive)
  // Deactivate Subscriber:
  // 1. Reset subscriber info: status = 'inactive', startDate = '-', endDate = '-', amount = 0, subscriptionType = '-', paymentStatus = '-'
  // 2. Remove all related sales invoices (removes invoice line from sales page)
  // 3. Remove all related pending renewal requests
  // 4. Fully recalculate agent financials and counters (removes agent debt and sales that came from this subscriber)
  const handleDeactivateSubscriber = async (subscriberId: string) => {
    const currentState = stateRef.current;
    const sub = currentState.subscribers.find((s) => s.id === subscriberId);
    if (!sub) return;
    const subDeviceId = sub.deviceId;
    const deactivatedSub: Subscriber = {
      ...sub,
      status: 'inactive',
      startDate: '-',
      endDate: '-',
      amount: 0,
      debtAmount: 0,
      subscriptionType: '-',
      paymentStatus: '-',
      isActive: false
    };
    const updatedSubscribers = currentState.subscribers.map((s) =>
      s.id === subscriberId ? deactivatedSub : s
    );
    const remainingInvoices = currentState.invoices.filter(
      (inv) => inv.subscriberId !== subscriberId && (subDeviceId ? inv.deviceId !== subDeviceId : true)
    );
    const remainingPendingRequests = currentState.pendingRequests.filter(
      (req) => req.subscriberId !== subscriberId && (subDeviceId ? req.deviceId !== subDeviceId : true)
    );

    updateAppState(
      {
        subscribers: updatedSubscribers,
        invoices: remainingInvoices,
        pendingRequests: remainingPendingRequests
      },
      'Could not immediately sync subscriber deactivation:'
    );
    soundService.playSuccess();
  };

  const handleRenewSubscriber = (
    updatedSubscriber: Subscriber,
    isDebt: boolean,
    amount: number,
    pendingRequestId?: string
  ) => {
    const currentState = stateRef.current;
    const currentSubscriber = currentState.subscribers.find((subscriber) => subscriber.id === updatedSubscriber.id);
    const wasActive = currentSubscriber?.status === 'active';
    const rawDev = (updatedSubscriber.deviceId || '').trim();
    const cleanDev = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';
    const finalSubscriber: Subscriber = {
      ...updatedSubscriber,
      deviceId: cleanDev,
      status: 'active',
      isActive: true,
      amount,
      debtAmount: isDebt ? amount : 0,
      originalAmount: amount,
      paidAmount: isDebt ? 0 : amount,
      paymentStatus: isDebt ? 'debt' : 'paid',
      settleDate: isDebt ? undefined : updatedSubscriber.startDate
    };

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${Date.now()}`,
      subscriberId: finalSubscriber.id,
      subscriberName: finalSubscriber.name,
      deviceId: finalSubscriber.deviceId,
      agentId: finalSubscriber.agentId,
      agentName: finalSubscriber.agentName,
      packageType: `تجديد باقة ${finalSubscriber.subscriptionType}`,
      amount: amount,
      paidAmount: isDebt ? 0 : amount,
      remainingAmount: isDebt ? amount : 0,
      paymentStatus: isDebt ? 'debt' : 'paid',
      date: finalSubscriber.startDate,
      notes: 'تجديد اشتراك رسمي معتمد'
    };

    const updatedAgents = currentState.agents.map((ag) => {
      if (ag.id === updatedSubscriber.agentId || (updatedSubscriber.agentName && ag.name === updatedSubscriber.agentName)) {
        const newDebt = isDebt ? ag.totalDebt + amount : ag.totalDebt;
        const newPaid = isDebt ? ag.totalPaid : ag.totalPaid + amount;
        return {
          ...ag,
          totalSales: ag.totalSales + amount,
          totalDebt: newDebt,
          totalPaid: newPaid,
          activeSubscriptions: ag.activeSubscriptions + (wasActive ? 0 : 1),
          inactiveSubscriptions: Math.max(0, ag.inactiveSubscriptions - (wasActive ? 0 : 1)),
          hasDebt: newDebt > 0
        };
      }
      return ag;
    });

    updateAppState({
      subscribers: currentState.subscribers.map((subscriber) =>
        subscriber.id === finalSubscriber.id ? finalSubscriber : subscriber
      ),
      invoices: [newInvoice, ...currentState.invoices],
      agents: updatedAgents,
      pendingRequests: pendingRequestId
        ? currentState.pendingRequests.filter((request) => request.id !== pendingRequestId)
        : currentState.pendingRequests
    }, 'Could not immediately sync subscriber renewal:');

    soundService.playSuccess();

    // Show Invoice Success Modal matching Screenshot 5!
    setInvoiceSuccessData({
      invoice: newInvoice,
      startDate: finalSubscriber.startDate,
      endDate: finalSubscriber.endDate,
      phone: finalSubscriber.phone
    });
  };

  // Pending Requests Approvals
  const handleApprovePendingRequest = (
    requestId: string,
    overrides?: {
      amount?: number;
      startDate?: string;
      duration?: SubscriptionDuration;
      paymentStatus?: PaymentStatus;
    }
  ) => {
    const currentState = stateRef.current;
    const req = currentState.pendingRequests.find((r) => r.id === requestId && r.status === 'pending');
    if (!req) return;

    const isNewDeviceSale = req.subscriberId.startsWith('new-sub-') || req.duration === '-';
    const sDate = overrides?.startDate || new Date().toISOString().split('T')[0];
    const requestedDuration = overrides?.duration || (req.duration && req.duration !== '-' ? req.duration : '1 شهر');
    const supportedDurations: SubscriptionDuration[] = ['1 شهر', 'شهرين', '3 أشهر'];
    const dur = supportedDurations.includes(requestedDuration) ? requestedDuration : '1 شهر';
    const amt = overrides?.amount !== undefined ? overrides.amount : req.amount;
    const stat = isNewDeviceSale ? 'inactive' : 'active';
    const payStat = overrides?.paymentStatus || 'paid';
    const expDate = new Date(sDate);
    const months = dur === 'شهرين' ? 2 : dur === '3 أشهر' ? 3 : 1;
    expDate.setMonth(expDate.getMonth() + months);
    const endDate = expDate.toISOString().split('T')[0];

    let targetSubscriber: Subscriber;
    let updatedSubscribers: Subscriber[];

    if (isNewDeviceSale) {
      const rawDev = (req.deviceId || '').trim();
      const cleanDev = rawDev
        ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`)
        : `00${Math.floor(100000 + Math.random() * 900000)}`;
      const assignedAgent = currentState.agents.find(
        (agent) => agent.id === req.agentId || agent.name === req.agentName
      );
      targetSubscriber = {
        id: req.subscriberId.startsWith('new-sub-') ? req.subscriberId : 'sub-' + Date.now(),
        name: req.subscriberName,
        phone: req.subscriberPhone,
        deviceId: cleanDev,
        agentId: assignedAgent?.id || req.agentId || 'agent-main',
        agentName: assignedAgent?.name || req.agentName || 'المركز الرئيسي',
        subscriptionType: '-',
        status: stat,
        paymentStatus: payStat,
        amount: amt,
        originalAmount: amt,
        paidAmount: payStat === 'paid' ? amt : 0,
        debtAmount: payStat === 'debt' ? amt : 0,
        startDate: '-',
        endDate: '-',
        notes: req.notes || 'بيع جهاز جديد وتفعيل عبر الوكيل',
        createdAt: req.requestDate || new Date().toISOString().split('T')[0]
      };
      updatedSubscribers = [targetSubscriber, ...currentState.subscribers];
    } else {
      const sub = currentState.subscribers.find((s) => s.id === req.subscriberId);
      if (!sub) {
        showAlert('تعذر اعتماد التجديد لأن سجل المشترك غير موجود. أبقينا الطلب معلقاً للمراجعة.', 'تعذر اعتماد الطلب', 'error');
        return;
      }
      targetSubscriber = {
        ...sub,
        status: stat,
        subscriptionType: dur,
        amount: (sub.amount || 0) + amt,
        startDate: sDate,
        endDate,
        paymentStatus: payStat === 'paid' && sub.paymentStatus !== 'debt' ? 'paid' : 'debt',
        paidAmount: payStat === 'paid' ? (sub.paidAmount || 0) + amt : (sub.paidAmount || 0),
        debtAmount: payStat === 'debt' ? (sub.debtAmount || 0) + amt : (sub.debtAmount || 0),
        isActive: true
      };
      updatedSubscribers = currentState.subscribers.map((s) => (s.id === targetSubscriber.id ? targetSubscriber : s));
    }

    const newInvoice: Invoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: 'INV-' + Date.now(),
      subscriberId: targetSubscriber.id,
      subscriberName: targetSubscriber.name,
      deviceId: targetSubscriber.deviceId,
      agentId: targetSubscriber.agentId,
      agentName: targetSubscriber.agentName,
      packageType: isNewDeviceSale ? 'بيع جهاز جديد فقط' : 'تجديد باقة ' + dur,
      amount: amt,
      paidAmount: payStat === 'paid' ? amt : 0,
      remainingAmount: payStat === 'debt' ? amt : 0,
      paymentStatus: payStat,
      date: sDate,
      notes: req.notes || 'اعتماد طلب رسمي معتمد'
    };

    const updatedInvoices = [newInvoice, ...currentState.invoices];
    const updatedPendingRequests = currentState.pendingRequests.map((request) =>
      request.id === requestId ? { ...request, status: 'approved' as const } : request
    );
    const updatedAgents = computeUpdatedAgents(currentState.agents, updatedSubscribers, updatedInvoices);
    const targetAgent = updatedAgents.find((ag) => ag.id === targetSubscriber.agentId) || updatedAgents[0];

    const nextFullState: AppState = {
      ...currentState,
      subscribers: updatedSubscribers,
      invoices: updatedInvoices,
      pendingRequests: updatedPendingRequests,
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };

    updateAppState({
      subscribers: updatedSubscribers,
      invoices: updatedInvoices,
      pendingRequests: updatedPendingRequests
    }, 'Could not immediately sync pending request approval:');

    appFeatures.broadcastAdminUpdate({
      action: 'APPROVE_PENDING_REQUEST',
      requestId,
      subscriberId: targetSubscriber.id,
      agentId: targetSubscriber.agentId,
      timestamp: Date.now()
    });
    firebaseService.broadcastLocalChange(nextFullState);
    soundService.playSuccess();
  };

  const handleRejectPendingRequest = (requestId: string) => {
    const currentState = stateRef.current;
    const req = currentState.pendingRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;
    persistStateImmediately({
      ...currentState,
      pendingRequests: currentState.pendingRequests.map((request) =>
        request.id === requestId ? { ...request, status: 'rejected' as const } : request
      ),
      // If it was a 'new-sub-' ID, also remove it from subscribers if it was added as 'inactive'
      subscribers: req?.subscriberId.startsWith('new-sub-') 
        ? currentState.subscribers.filter((s) => s.id !== req.subscriberId)
        : currentState.subscribers
    }, 'Could not reject the pending request:');
  };

  const handleCancelAgentPendingRequest = (requestId: string): boolean => {
    const currentState = stateRef.current;
    const request = currentState.pendingRequests.find((item) => item.id === requestId);
    if (
      !request ||
      request.status !== 'pending' ||
      (request.agentId !== currentAgent.id && request.agentName !== currentAgent.name)
    ) {
      return false;
    }

    persistStateImmediately({
      ...currentState,
      pendingRequests: currentState.pendingRequests.map((item) =>
        item.id === requestId ? { ...item, status: 'cancelled' as const } : item
      ),
      subscribers: request.subscriberId.startsWith('new-sub-')
        ? currentState.subscribers.filter((subscriber) => subscriber.id !== request.subscriberId)
        : currentState.subscribers
    }, 'Could not cancel the agent pending request:');
    return true;
  };

  const handleSimulateIncomingRequest = () => {
    const randomAgent = state.agents.filter((a) => a.id !== 'agent-main')[Math.floor(Math.random() * 5)];
    const randomSub = state.subscribers.find((s) => s.agentId === randomAgent.id) || state.subscribers[0];

    const newRequest: PendingRenewalRequest = {
      id: `req-${Date.now()}`,
      subscriberId: randomSub.id,
      subscriberName: randomSub.name,
      deviceId: randomSub.deviceId,
      subscriberPhone: randomSub.phone,
      agentId: randomAgent.id,
      agentName: randomAgent.name,
      duration: '1 شهر',
      amount: 22000,
      requestDate: new Date().toISOString().split('T')[0],
      notes: 'طلب تجديد إلكتروني عبر تطبيق الوكيل',
      status: 'pending'
    };

    updateAppState({
      pendingRequests: [newRequest, ...stateRef.current.pendingRequests.filter((request) => request.id !== newRequest.id)]
    });

    soundService.playPendingAlert();

    showAlert(`ورد طلب تجديد جديد من الوكيل (${randomAgent.name}) للمشترك ${randomSub.name}`, 'طلب تجديد اشتراك جديد');
  };

  // Settle Agent Debt
  const handleSettleAgentDebt = (agentId: string, paymentAmount: number, note?: string) => {
    const currentState = stateRef.current;
    const targetAgent = currentState.agents.find((a) => a.id === agentId);
    if (!targetAgent) return;

    const amount = Math.trunc(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    // 1. Find all invoices belonging to this agent with remaining debt (oldest first)
    const agentInvoices = currentState.invoices
      .map((invoice, index) => ({ invoice, index }))
      .filter(({ invoice }) => doesInvoiceBelongToAgent(invoice, targetAgent))
      .sort((a, b) => a.invoice.date.localeCompare(b.invoice.date) || a.index - b.index);

    const updatedInvoices = currentState.invoices.slice();
    let unappliedPayment = amount;

    for (const { index } of agentInvoices) {
      if (unappliedPayment <= 0) break;
      const invoice = updatedInvoices[index];
      const invoiceRemaining = getInvoiceRemainingAmount(invoice);
      if (invoiceRemaining <= 0) continue;

      const appliedPayment = Math.min(unappliedPayment, invoiceRemaining);
      const remainingAmount = invoiceRemaining - appliedPayment;
      updatedInvoices[index] = {
        ...invoice,
        paidAmount: (invoice.paidAmount || 0) + appliedPayment,
        remainingAmount,
        paymentStatus: remainingAmount === 0 ? 'paid' : 'partial'
      };
      unappliedPayment -= appliedPayment;
    }

    // 2. If there's still unapplied payment or no invoices, apply across agent's subscribers with outstanding debt
    const updatedSubscribers = currentState.subscribers.map((sub): Subscriber => {
      if (!doesSubscriberBelongToAgent(sub, targetAgent)) return sub;
      const subDebt = getSubscriberOutstandingDebt(sub, updatedInvoices);
      if (subDebt <= 0 || unappliedPayment <= 0) return sub;

      const applied = Math.min(unappliedPayment, subDebt);
      unappliedPayment -= applied;
      const remainingDebt = subDebt - applied;
      return {
        ...sub,
        paidAmount: (sub.paidAmount || 0) + applied,
        debtAmount: remainingDebt,
        amount: sub.status === 'inactive' ? 0 : remainingDebt,
        paymentStatus: remainingDebt === 0 ? 'paid' : 'partial',
        settleDate: new Date().toISOString().split('T')[0]
      };
    });

    // 3. Recompute agent metrics
    const updatedAgents = computeUpdatedAgents(currentState.agents, updatedSubscribers, updatedInvoices);

    const newState: AppState = {
      ...currentState,
      subscribers: updatedSubscribers,
      invoices: updatedInvoices,
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };

    persistStateImmediately(newState, 'Could not immediately sync agent debt settlement:', true);

    appFeatures.broadcastAdminUpdate({
      action: 'SETTLE_DEBT',
      agentId,
      amount,
      timestamp: Date.now()
    });
    firebaseService.broadcastLocalChange(newState);
    soundService.playSuccess();
  };

  // Apply a subscriber payment to their outstanding balance and related invoices.
  const handleSettleSubscriberDebt = (subscriberId: string, paymentAmount: number) => {
    const currentState = stateRef.current;
    const subscriber = currentState.subscribers.find((s) => s.id === subscriberId);
    const amount = Math.trunc(paymentAmount);
    const currentDebt = subscriber ? getSubscriberOutstandingDebt(subscriber, currentState.invoices) : 0;
    if (!subscriber || !Number.isFinite(amount) || amount <= 0 || amount > currentDebt) return;

    const remainingDebt = Math.max(0, currentDebt - amount);
    const isExpiredSubscription = subscriber.status === 'inactive' &&
      !subscriber.subscriptionType && !subscriber.startDate && !subscriber.endDate;
    const subscriberInvoiceAmount = currentState.invoices
      .filter((invoice) => invoice.subscriberId === subscriberId)
      .reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0);

    const updatedSubscribers = currentState.subscribers.map((s): Subscriber => {
      if (s.id !== subscriberId) return s;
      const paidAmount = (s.paidAmount || 0) + amount;
      return {
        ...s,
        originalAmount: s.originalAmount ?? (subscriberInvoiceAmount || ((s.debtAmount ?? s.amount) + (s.paidAmount || 0))),
        paidAmount,
        amount: isExpiredSubscription ? 0 : remainingDebt,
        debtAmount: remainingDebt,
        paymentStatus: remainingDebt === 0 ? 'paid' : (isExpiredSubscription ? '' : 'partial'),
        settleDate: isExpiredSubscription ? undefined : new Date().toISOString().split('T')[0]
      };
    });

    // Apply the payment to the subscriber's oldest outstanding invoices first.
    const invoicePaymentOrder = currentState.invoices
      .map((invoice, index) => ({ invoice, index }))
      .filter(({ invoice }) => invoice.subscriberId === subscriberId)
      .sort((a, b) => a.invoice.date.localeCompare(b.invoice.date) || a.index - b.index);
    const updatedInvoices = currentState.invoices.slice();
    let unappliedPayment = amount;

    for (const { index } of invoicePaymentOrder) {
      if (unappliedPayment <= 0) break;
      const invoice = updatedInvoices[index];
      const invoiceRemaining = getInvoiceRemainingAmount(invoice);
      if (invoiceRemaining <= 0) continue;

      const appliedPayment = Math.min(unappliedPayment, invoiceRemaining);
      const remainingAmount = invoiceRemaining - appliedPayment;
      updatedInvoices[index] = {
        ...invoice,
        paidAmount: (invoice.paidAmount || 0) + appliedPayment,
        remainingAmount,
        paymentStatus: remainingAmount === 0 ? 'paid' : 'partial'
      };
      unappliedPayment -= appliedPayment;
    }

    const updatedAgents = computeUpdatedAgents(currentState.agents, updatedSubscribers, updatedInvoices);

    const newState: AppState = {
      ...currentState,
      subscribers: updatedSubscribers,
      invoices: updatedInvoices,
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };
    persistStateImmediately(newState, 'Could not immediately sync subscriber payment:', true);

    appFeatures.broadcastAdminUpdate({
      action: 'SETTLE_DEBT',
      subscriberId,
      amount,
      timestamp: Date.now()
    });
    firebaseService.broadcastLocalChange(newState);
    soundService.playSuccess();
  };

  // Reset Agent Data
  const handleResetAgentData = (agentId: string) => {
    const currentState = stateRef.current;
    const updatedAgents = currentState.agents.map((ag) => {
      if (ag.id === agentId) {
        return {
          ...ag,
          totalSales: 0,
          totalPaid: 0,
          totalDebt: 0,
          hasDebt: false
        };
      }
      return ag;
    });

    persistStateImmediately({
      ...currentState,
      agents: updatedAgents
    }, 'Could not sync reset agent data:', true);
    soundService.playSuccess();
  };

  // Update Agent Branding
  const handleUpdateAgentBranding = (agentId: string, branding: Partial<Agent>) => {
    const currentState = stateRef.current;
    const updatedAgents = currentState.agents.map((ag) => (ag.id === agentId ? { ...ag, ...branding } : ag));
    persistStateImmediately({
      ...currentState,
      agents: updatedAgents
    }, 'Could not sync agent branding:', true);
  };

  // Product Inventory Handlers
  const handleAddProduct = (prodData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...prodData,
      id: `prod-${Date.now()}`
    };
    updateAppState({ products: [newProd, ...stateRef.current.products] });
  };

  const handleUpdateProduct = (updated: Product) => {
    updateAppState({
      products: stateRef.current.products.map((product) => (product.id === updated.id ? updated : product))
    });
  };

  const handleDeleteProduct = (id: string) => {
    updateAppState({ products: stateRef.current.products.filter((product) => product.id !== id) });
  };

  const handleAdjustStock = (id: string, delta: number) => {
    updateAppState({
      products: stateRef.current.products.map((product) =>
        product.id === id ? { ...product, stock: Math.max(0, product.stock + delta) } : product
      )
    });
  };

  // QR Codes Handlers
  const handleAddCode = (codeStr: string) => {
    const newCode: DeviceCode = {
      id: `c-${Date.now()}`,
      code: codeStr,
      status: 'available',
      generatedDate: new Date().toISOString().split('T')[0]
    };
    updateAppState({ codes: [newCode, ...stateRef.current.codes] });
  };

  const handleBatchGenerateCodes = (count: number) => {
    const newCodes: DeviceCode[] = [];
    const today = new Date().toISOString().split('T')[0];
    for (let i = 0; i < count; i++) {
      const random16 = '8492' + Math.floor(100000000000 + Math.random() * 900000000000).toString();
      newCodes.push({
        id: `c-${Date.now()}-${i}`,
        code: random16,
        status: 'available',
        generatedDate: today
      });
    }
    updateAppState({ codes: [...newCodes, ...stateRef.current.codes] });
  };

  const handleDeleteCode = (id: string) => {
    updateAppState({ codes: stateRef.current.codes.filter((code) => code.id !== id) });
  };

  const handleClearAllCodes = () => {
    updateAppState({ codes: [] });
  };

  // Pricing Handlers
  const handleSavePricing = (rows: PricingRow[]) => {
    updateAppState({ pricing: rows });
    soundService.playSuccess();
  };

  // If not logged in, display Login Page matching Screenshot 1!
  if (!currentUser) {
    return <LoginView users={state.users} agents={state.agents} onLogin={handleLogin} />;
  }

  // Titles mapping
  const pageTitles: Record<NavTab, string> = {
    dashboard: 'لوحة تحكم المركز',
    sales: 'سجل فواتير المبيعات والاشتراكات',
    subscribers: 'إدارة المشتركين والاشتراكات',
    debts: 'سجل الديون والمستحقات المالية',
    pending: 'الطلبات المعلقة (طلبات التجديد الواردة)',
    agents: 'ملخص الأداء المالي والميداني للوكلاء',
    barcodes: 'إدارة أكواد وأجهزة QR',
    products: 'إدارة المنتجات والمعدات والمخزن',
    pricing: 'جدول أسعار الوكلاء والمركز',
    agent_portal: `بوابة الوكيل (${currentAgent.name})`,
    active_subscribers: 'المشتركون الفعالون'
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#080E21] text-slate-100' : 'bg-slate-50 text-slate-800'} flex font-sans antialiased transition-colors duration-200`} dir="rtl">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        pendingCount={state.pendingRequests.filter((request) => request.status === 'pending').length}
        subscribersCount={state.subscribers.length}
        isAgentMode={isAgentMode}
        onToggleAgentMode={handleToggleAgentMode}
        selectedAgentName={currentAgent.name}
        onLogout={handleLogout}
        isDark={isDarkMode}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <Header
          pageTitle={pageTitles[currentTab]}
          currentTab={currentTab}
          isAgentMode={isAgentMode}
          agentsList={state.agents.filter((a) => a.id !== 'agent-main')}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onLogout={handleLogout}
          isDark={isDarkMode}
          onToggleDark={handleToggleDarkMode}
          onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          onSync={handleManualSync}
        />

        {/* Dynamic Views */}
        <main className="p-4 md:p-6 max-w-7xl w-full mx-auto flex-1">
          <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm font-semibold text-slate-500" role="status">جاري تحميل الصفحة...</div>}>
          {currentTab === 'dashboard' && (
            <DashboardView
              agents={state.agents}
              subscribers={state.subscribers}
              invoices={state.invoices}
              onNavigate={setCurrentTab}
              onOpenNewSale={() => setCurrentTab('subscribers')}
              onExportExcel={async () => {
                const { excelService } = await import('./services/excelService');
                excelService.exportInvoices(stateRef.current.invoices);
              }}
            />
          )}

          {currentTab === 'active_subscribers' && (
            <ActiveSubscribersView
              subscribers={state.subscribers}
              invoices={state.invoices}
              agents={state.agents}
            />
          )}

          {currentTab === 'subscribers' && (
            <SubscribersView
              subscribers={isAgentMode ? state.subscribers.filter((s) => s.agentId === currentAgent.id || s.agentName === currentAgent.name) : state.subscribers}
              invoices={state.invoices}
              agents={state.agents}
              pricing={state.pricing}
              onAddSubscriber={handleAddSubscriber}
              onUpdateSubscriber={handleUpdateSubscriber}
              onDeleteSubscriber={handleDeleteSubscriber}
              onRenewSubscriber={handleRenewSubscriber}
              onDeactivateSubscriber={handleDeactivateSubscriber}
              onDeleteAllSubscribersHandler={handleDeleteAllSubscribers}
              onOpenWhatsApp={setActiveWhatsAppSub}
              onSelectDeviceQr={handleOpenDeviceQr}
              onImportSubscribers={handleImportSubscribers}
              currentAgentFilter={isAgentMode ? currentAgent.id : subscribersAgentFilter}
              isMainCenterView={!isAgentMode}
              isAdmin={currentUser?.role === 'مدير رئيسي' && !isAgentMode}
            />
          )}

          {currentTab === 'sales' && (
            <SalesInvoicesView
              invoices={isAgentMode ? state.invoices.filter((i) => i.agentId === currentAgent.id || i.agentName === currentAgent.name) : state.invoices}
              agents={state.agents}
              onOpenReceipt={setActiveReceiptInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onSelectDeviceQr={handleOpenDeviceQr}
            />
          )}

          {currentTab === 'debts' && (
            <DebtsView
              agents={isAgentMode ? state.agents.filter((a) => a.id === currentAgent.id) : state.agents}
              invoices={isAgentMode ? state.invoices.filter((i) => i.agentId === currentAgent.id || i.agentName === currentAgent.name) : state.invoices}
              subscribers={isAgentMode ? state.subscribers.filter((s) => s.agentId === currentAgent.id || s.agentName === currentAgent.name) : state.subscribers}
              onSettleAgentDebt={handleSettleAgentDebt}
              onSettleSubscriberDebt={handleSettleSubscriberDebt}
              onResetAgentData={handleResetAgentData}
              onOpenWhatsApp={setActiveWhatsAppSub}
              onSelectDeviceQr={handleOpenDeviceQr}
              onDeleteSubscriber={handleDeleteSubscriber}
            />
          )}

          {currentTab === 'pending' && (
            <PendingRequestsView
              pendingRequests={isAgentMode
                ? state.pendingRequests.filter((r) => r.status === 'pending' && (r.agentId === currentAgent.id || r.agentName === currentAgent.name))
                : state.pendingRequests.filter((r) => r.status === 'pending')}
              agents={state.agents}
              subscribers={state.subscribers}
              onApproveRequest={handleApprovePendingRequest}
              onRejectRequest={handleRejectPendingRequest}
              onSimulateIncomingRequest={handleSimulateIncomingRequest}
            />
          )}

          {currentTab === 'agents' && (
            <AgentsView
              agents={state.agents}
              subscribers={state.subscribers}
              onSettleDebt={handleSettleAgentDebt}
              onUpdateAgentBranding={handleUpdateAgentBranding}
              onViewSubscribers={(agentId) => {
                setSubscribersAgentFilter(agentId);
                setCurrentTab('subscribers');
              }}
              onViewSales={() => {
                setCurrentTab('sales');
              }}
            />
          )}

          {currentTab === 'barcodes' && (
            <QrCodesView
              codes={state.codes}
              onAddCode={handleAddCode}
              onBatchGenerate={handleBatchGenerateCodes}
              onDeleteCode={handleDeleteCode}
              onClearAllCodes={handleClearAllCodes}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              products={state.products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onAdjustStock={handleAdjustStock}
            />
          )}

          {currentTab === 'pricing' && (
            <PricingView
              pricing={state.pricing}
              agents={state.agents}
              subscribers={state.subscribers}
              invoices={state.invoices}
              onSavePricing={handleSavePricing}
              onUpdateAgent={handleUpdateAgentBranding}
            />
          )}

          {currentTab === 'agent_portal' && (
            <AgentPortalView
              currentAgent={currentAgent}
              subscribers={state.subscribers}
              invoices={state.invoices}
              products={state.products}
              pricing={state.pricing}
              pendingRequests={state.pendingRequests}
              onSubmitRenewalOrder={(order) => {
                const newReq: PendingRenewalRequest = {
                  ...order,
                  id: `req-${Date.now()}`,
                  status: 'pending'
                };
                const currentState = stateRef.current;
                persistStateImmediately({
                  ...currentState,
                  pendingRequests: [newReq, ...currentState.pendingRequests.filter((request) => request.id !== newReq.id)]
                }, 'Could not immediately sync the agent request:');
                soundService.playPendingAlert();
              }}
              onDeleteRequest={handleCancelAgentPendingRequest}
              onOpenWhatsApp={setActiveWhatsAppSub}
              onUpdateBranding={handleUpdateAgentBranding}
              onSelectDeviceQr={handleOpenDeviceQr}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* WhatsApp Modal */}
      <Suspense fallback={null}>
      {activeWhatsAppSub && (
        <WhatsAppModal
          subscriber={activeWhatsAppSub}
          onClose={() => setActiveWhatsAppSub(null)}
        />
      )}

      {/* Printable Receipt Modal */}
      {activeReceiptInvoice && (
        <ReceiptModal
          invoice={activeReceiptInvoice}
          onClose={() => setActiveReceiptInvoice(null)}
        />
      )}

      {/* Device QR Code Modal (triggered by clicking device ID anywhere) */}
      {selectedDeviceForQr && (
        <DeviceQrModal
          deviceId={selectedDeviceForQr.deviceId}
          subscriberName={selectedDeviceForQr.subscriberName}
          agentName={selectedDeviceForQr.agentName}
          onClose={() => setSelectedDeviceForQr(null)}
        />
      )}

      {/* Invoice Success Modal matching Screenshot 5 */}
      {invoiceSuccessData && (
        <InvoiceSuccessModal
          invoice={invoiceSuccessData.invoice}
          startDate={invoiceSuccessData.startDate}
          endDate={invoiceSuccessData.endDate}
          phone={invoiceSuccessData.phone}
          onClose={() => setInvoiceSuccessData(null)}
          onWhatsApp={(phone, text) => {
            const link = storageService.createWhatsAppLink(phone, text);
            window.open(link, '_blank');
          }}
        />
      )}
      </Suspense>

      {/* Toast Notification for Sync & Data Refresh */}
      {syncToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900/95 dark:bg-slate-100/95 backdrop-blur-md text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200 border border-slate-800 dark:border-slate-200 max-w-sm">
          {syncToast.includes('جاري') ? (
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          )}
          <span className="flex-1 leading-relaxed">{syncToast}</span>
          <button
            onClick={() => {
              if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
              setSyncToast(null);
            }}
            className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-slate-200 text-slate-400 dark:text-slate-600 hover:text-white dark:hover:text-slate-900 transition-colors cursor-pointer shrink-0"
            title="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toast Notification for Theme Toggle matching screenshot bottom-left */}
      {themeToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#0E1B38] border border-sky-600/70 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">ℹ</span>
          <span>{themeToast}</span>
        </div>
      )}
    </div>
  );
}

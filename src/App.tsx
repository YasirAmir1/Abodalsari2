/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
import { RefreshCw } from 'lucide-react';
import { AppState, storageService } from './services/storageService';
import { firebaseService } from './services/firebaseService';
import { syncManager } from './services/firebase-sync';
import { soundService } from './services/soundService';
import { excelService } from './services/excelService';

import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { SubscribersView } from './components/SubscribersView';
import { PendingRequestsView } from './components/PendingRequestsView';
import { AgentsView } from './components/AgentsView';
import { ProductsView } from './components/ProductsView';
import { QrCodesView } from './components/QrCodesView';
import { PricingView } from './components/PricingView';
import { SalesInvoicesView } from './components/SalesInvoicesView';
import { DebtsView } from './components/DebtsView';
import { ReportsView } from './components/ReportsView';
import { AgentPortalView } from './components/AgentPortalView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { ReceiptModal } from './components/ReceiptModal';
import { DeviceQrModal } from './components/DeviceQrModal';
import { InvoiceSuccessModal } from './components/InvoiceSuccessModal';
import { useAppDialogs } from './components/AppDialogProvider';

const USER_SESSION_KEY = 'alsari_auth_user_v1';

function mergePendingLocalAdds(remoteState: AppState, localState: AppState): { state: AppState; merged: boolean } {
  const remoteTimestamp = remoteState.lastUpdatedTimestamp || 0;
  const localTimestamp = localState.lastUpdatedTimestamp || 0;
  if (localTimestamp < remoteTimestamp) return { state: remoteState, merged: false };

  const remoteSubscribers = remoteState.subscribers || [];
  const localSubscribers = localState.subscribers || [];
  const remoteIds = new Set(remoteSubscribers.map((subscriber) => subscriber.id));
  const remoteDeviceIds = new Set(remoteSubscribers.map((subscriber) => subscriber.deviceId).filter(Boolean));
  const pendingSubscribers = localSubscribers.filter(
    (subscriber) => !remoteIds.has(subscriber.id) && (!subscriber.deviceId || !remoteDeviceIds.has(subscriber.deviceId))
  );

  const remoteInvoices = remoteState.invoices || [];
  const invoiceIds = new Set(remoteInvoices.map((invoice) => invoice.id));
  const pendingInvoices = (localState.invoices || []).filter((invoice) => !invoiceIds.has(invoice.id));
  const remoteRequestIds = new Set((remoteState.pendingRequests || []).map((request) => request.id));
  const pendingRequests = (localState.pendingRequests || []).filter((request) => !remoteRequestIds.has(request.id));
  const remoteAgentIds = new Set((remoteState.agents || []).map((agent) => agent.id));
  const localAgentsById = new Map<string, Agent>();
  (localState.agents || []).forEach((agent) => localAgentsById.set(agent.id, agent));
  const remoteAgents = remoteState.agents || [];
  const pendingAgents = (localState.agents || []).filter((agent) => !remoteAgentIds.has(agent.id));
  const pendingAgentIds = new Set(pendingSubscribers.map((subscriber) => subscriber.agentId));

  if (pendingSubscribers.length === 0 && pendingInvoices.length === 0 && pendingRequests.length === 0 && pendingAgents.length === 0) {
    return { state: remoteState, merged: false };
  }

  return {
    state: {
      ...remoteState,
      subscribers: [...pendingSubscribers, ...remoteSubscribers],
      invoices: [...pendingInvoices, ...remoteInvoices],
      pendingRequests: [...pendingRequests, ...(remoteState.pendingRequests || [])],
      agents: [
        ...pendingAgents,
        ...remoteAgents.map((agent) =>
          pendingAgentIds.has(agent.id) ? localAgentsById.get(agent.id) || agent : agent
        )
      ],
      lastUpdatedTimestamp: Date.now()
    },
    merged: true
  };
}

export default function App() {
  const { showAlert } = useAppDialogs();
  const [state, setState] = useState<AppState>(() => storageService.loadState());
  const [isRemoteReady, setIsRemoteReady] = useState(false);
  const stateRef = useRef(state);

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleGlobalRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    // Clear quota so manual refresh always reaches Firestore
    try {
      let remote: AppState | null = null;
      try {
        remote = await firebaseService.fetchRemoteState();
      } catch (netErr) {
        console.warn('Network or Firestore fetch exception caught during refresh:', netErr);
      }

      if (!isMountedRef.current) return;

      if (remote && typeof remote === 'object' && remote.subscribers) {
        const { state: reconciled, merged } = mergePendingLocalAdds(remote, stateRef.current);
        const filtered = storageService.filterOutDeleted(reconciled);
        // Mark as remote update so state-effect does NOT echo back to Firestore
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        isRemoteUpdateRef.current = true;
        stateRef.current = filtered;
        setState(filtered);
        storageService.saveState(filtered);
        setIsRemoteReady(true);
        setSyncToast('تم تحديث البيانات ومزامنتها بنجاح');
        soundService.playSuccess();
        if (merged) {
          void firebaseService.saveRemoteState(filtered, true).catch((error) => {
            console.error('Could not restore locally pending subscribers to Firestore:', error);
            if (isMountedRef.current) {
              setSyncToast('تعذرت استعادة بعض المشتركين المحفوظين محلياً إلى قاعدة البيانات.');
            }
          });
        }
      } else {
        const local = storageService.loadState();
        if (local) {
          stateRef.current = local;
          setState(local);
        }
        setSyncToast('تعذر جلب أحدث البيانات من الخادم. يتم عرض البيانات المحلية حالياً.');
      }
    } catch (e: any) {
      console.error('Detailed Refresh & Sync error log:', e);
      if (isMountedRef.current) {
        setSyncToast('تعذر مزامنة البيانات، يرجى التحقق من الاتصال');
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
        setTimeout(() => {
          if (isMountedRef.current) {
            setSyncToast(null);
          }
        }, 3500);
      }
    }
  };

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

  // --- Refs for sync coordination ---
  // Flag set to true when we are applying a REMOTE update so the save-effect
  // does not echo it back to Firestore (would create a write loop).
  const isRemoteUpdateRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const persistStateImmediately = (nextState: AppState, failureMessage: string) => {
    const committedState: AppState = {
      ...nextState,
      lastUpdatedTimestamp: Date.now()
    };

    stateRef.current = committedState;
    storageService.saveState(committedState);
    setState(committedState);

    void firebaseService.saveRemoteState(committedState, true).catch((error) => {
      console.error(failureMessage, error);
      if (isMountedRef.current) {
        setSyncToast('تعذرت مزامنة التغييرات مع الأجهزة الأخرى. تحقق من الاتصال بالإنترنت.');
      }
    });
  };

  // --- Effect 1: Persist locally + push to Firestore on every local change ---
  useEffect(() => {
    // Always save to localStorage for offline resilience
    storageService.saveState(state);

    // If this state change originated from a REMOTE snapshot, skip the write
    // back to Firestore (it is already there).
    if (!isRemoteReady) return;

    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    if (firebaseService.isQuotaExceeded()) return;

    // Debounce: wait 1.5 s of inactivity before writing so rapid local edits
    // collapse into a single Firestore write.
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void firebaseService.saveRemoteState(state).catch((error) => {
        console.error('Could not sync local state to Firestore:', error);
        if (isMountedRef.current) {
          setSyncToast('تعذرت مزامنة التغييرات مع الأجهزة الأخرى. تحقق من الاتصال بالإنترنت.');
        }
      });
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state, isRemoteReady]);

  // --- Effect 2: Real-time Firestore listener (cross-device sync) ---
  useEffect(() => {
    if (!currentUser) {
      syncManager.stopListening();
      setIsRemoteReady(false);
      return;
    }

    const unsubscribe = syncManager.startListening((remoteState) => {
      if (!remoteState) return;

      // Recover subscriber additions that were saved locally while an earlier
      // Firestore write was pending or unavailable, then apply local tombstones.
      const { state: reconciledState, merged } = mergePendingLocalAdds(remoteState, stateRef.current);
      const filteredState = storageService.filterOutDeleted(reconciledState);

      // Save to localStorage immediately so a subsequent reload retains fresh remote state
      storageService.saveState(filteredState);

      // Mark as remote so Effect 1 does NOT write it back to Firestore
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      isRemoteUpdateRef.current = true;
      stateRef.current = filteredState;
      setState(filteredState);
      if (merged) {
        void firebaseService.saveRemoteState(filteredState, true).catch((error) => {
          console.error('Could not restore locally pending subscribers to Firestore:', error);
          if (isMountedRef.current) {
            setSyncToast('تعذرت استعادة بعض المشتركين المحفوظين محلياً إلى قاعدة البيانات.');
          }
        });
      }
    });

    const unsubscribeStatus = firebaseService.onSyncStatusChange((status) => {
      if (status === 'connected' && isMountedRef.current) setIsRemoteReady(true);
      if (status === 'error' && isMountedRef.current) {
        setSyncToast('تعذر الاتصال بقاعدة البيانات المباشرة. ستستأنف المزامنة عند عودة الاتصال.');
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
  const handleLogin = (user: SystemUser, remoteState?: AppState) => {
    if (remoteState) {
      const latestState = storageService.filterOutDeleted(remoteState);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      isRemoteUpdateRef.current = true;
      stateRef.current = latestState;
      storageService.saveState(latestState);
      setState(latestState);
      setIsRemoteReady(true);
    }

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
    const currentState = stateRef.current;
    const invoiceToDelete = currentState.invoices.find((invoice) => invoice.id === id);
    if (!invoiceToDelete) return;

    const deletedInvoiceAmount = Math.max(0, Number.isFinite(invoiceToDelete.amount) ? invoiceToDelete.amount : 0);
    const deletedInvoicePaidAmount = Math.max(0, Number.isFinite(invoiceToDelete.paidAmount) ? invoiceToDelete.paidAmount : 0);
    const deletedInvoiceDebt = Math.max(
      0,
      Number.isFinite(invoiceToDelete.remainingAmount)
        ? invoiceToDelete.remainingAmount
        : deletedInvoiceAmount - deletedInvoicePaidAmount
    );
    const updatedInvoices = currentState.invoices.filter((invoice) => invoice.id !== id);

    const updatedSubscribers = currentState.subscribers.map((subscriber): Subscriber => {
      if (subscriber.id !== invoiceToDelete.subscriberId) return subscriber;

      const currentDebt = Math.max(0, Number.isFinite(subscriber.amount) ? subscriber.amount : 0);
      const remainingDebt = Math.max(0, currentDebt - deletedInvoiceDebt);
      const currentPaidAmount = Math.max(0, subscriber.paidAmount || 0);
      const remainingPaidAmount = Math.max(0, currentPaidAmount - deletedInvoicePaidAmount);
      const currentOriginalAmount = subscriber.originalAmount ?? currentDebt + currentPaidAmount;
      const hasRemainingDebt = remainingDebt > 0;

      return {
        ...subscriber,
        status: 'inactive' as const,
        subscriptionType: '',
        paymentStatus: hasRemainingDebt
          ? (remainingPaidAmount > 0 ? 'partial' as const : 'debt' as const)
          : '',
        amount: remainingDebt,
        originalAmount: hasRemainingDebt
          ? Math.max(remainingDebt + remainingPaidAmount, currentOriginalAmount - deletedInvoiceAmount)
          : undefined,
        paidAmount: hasRemainingDebt ? remainingPaidAmount : undefined,
        settleDate: hasRemainingDebt ? subscriber.settleDate : undefined,
        startDate: '',
        endDate: ''
      };
    });

    const updatedAgents = currentState.agents.map((agent) => {
      const agentSubscribers = updatedSubscribers.filter(
        (subscriber) => subscriber.agentId === agent.id || subscriber.agentName === agent.name
      );
      const activeSubscribers = agentSubscribers.filter((subscriber) => subscriber.status === 'active');
      const totalDebt = agentSubscribers
        .filter((subscriber) => subscriber.paymentStatus === 'debt' || subscriber.paymentStatus === 'partial')
        .reduce((sum, subscriber) => sum + (subscriber.amount || 0), 0);
      const totalSales = updatedInvoices
        .filter((invoice) => invoice.agentId === agent.id)
        .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

      return {
        ...agent,
        devicesCount: agentSubscribers.length,
        activeSubscriptions: activeSubscribers.length,
        inactiveSubscriptions: agentSubscribers.length - activeSubscribers.length,
        totalSales,
        totalDebt,
        totalPaid: Math.max(0, totalSales - totalDebt),
        hasDebt: totalDebt > 0
      };
    });

    const newState: AppState = {
      ...currentState,
      invoices: updatedInvoices,
      subscribers: updatedSubscribers,
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    stateRef.current = newState;
    storageService.saveState(newState);
    setState(newState);
    void firebaseService.saveRemoteState(newState, true).catch((error) => {
      console.error('Could not immediately sync invoice deletion:', error);
      if (isMountedRef.current) {
        setSyncToast('تم حذف الفاتورة محلياً وتعذرت مزامنة التعديلات حالياً');
        setTimeout(() => {
          if (isMountedRef.current) setSyncToast(null);
        }, 3500);
      }
    });
    soundService.playSuccess();
  };

  // Add Subscriber / New Sale
  const handleAddSubscriber = (
    subData: Partial<Subscriber>,
    isSale = true,
    isPaid = false,
    saleKind: 'subscription' | 'device' = 'subscription'
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
      subscriptionType: subData.subscriptionType || '1 شهر',
      status: subData.status || 'active',
      paymentStatus: isPaid ? 'paid' : (subData.paymentStatus || 'debt'),
      amount: subData.amount || 25000,
      startDate: subData.startDate || new Date().toISOString().split('T')[0],
      endDate: subData.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      address: subData.address || '',
      notes: subData.notes || '',
      createdAt: new Date().toISOString().split('T')[0]
    };

    let updatedInvoices = currentState.invoices;
    let updatedAgents = currentState.agents;
    let registeredInvoice: Invoice | null = null;

    if (isSale) {
      registeredInvoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${String(currentState.invoices.length + 1).padStart(3, '0')}`,
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

    persistStateImmediately({
      ...currentState,
      subscribers: [newSub, ...currentState.subscribers],
      invoices: updatedInvoices,
      agents: updatedAgents
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
    const fixedSub = { ...updated, deviceId: cleanDevId };
    persistStateImmediately({
      ...currentState,
      subscribers: currentState.subscribers.map((s) => (s.id === updated.id ? fixedSub : s))
    }, 'Could not immediately sync the subscriber update:');
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

    persistStateImmediately({
      ...currentState,
      subscribers: updatedSubscribers,
      agents: updatedAgents
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
    } else {
      storageService.addDeletedSubscriberId(id);
    }

    const subDeviceId = sub?.deviceId;

    const remainingSubscribers = state.subscribers.filter(
      (s) => s.id !== id && (subDeviceId ? s.deviceId !== subDeviceId : true)
    );

    // Completely remove invoices of deleted subscriber
    const remainingInvoices = state.invoices.filter(
      (inv) => inv.subscriberId !== id && (subDeviceId ? inv.deviceId !== subDeviceId : true)
    );

    // Completely remove pending requests of deleted subscriber
    const remainingPendingRequests = state.pendingRequests.filter(
      (req) => req.subscriberId !== id && (subDeviceId ? req.deviceId !== subDeviceId : true)
    );

    // Recalculate agent stats
    const updatedAgents = state.agents.map((ag) => {
      const agSubs = remainingSubscribers.filter((s) => s.agentId === ag.id);
      const activeSubs = agSubs.filter((s) => s.status === 'active');
      const debtSubs = agSubs.filter((s) => s.paymentStatus === 'debt' || s.paymentStatus === 'partial');
      const totalAgentDebt = debtSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalAgentSales = remainingInvoices
        .filter((invoice) => invoice.agentId === ag.id)
        .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

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

    const newState: AppState = {
      ...state,
      subscribers: remainingSubscribers,
      invoices: remainingInvoices,
      pendingRequests: remainingPendingRequests,
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };

    storageService.saveState(newState);
    setState(newState);
    try {
      await firebaseService.saveRemoteState(newState);
    } catch (e) {
      console.warn('Immediate remote save on delete failed:', e);
    }
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

      const newState: AppState = {
        ...state,
        subscribers: [],
        invoices: [],
        pendingRequests: [],
        agents: resetAgents,
        lastUpdatedTimestamp: Date.now()
      };

      storageService.saveState(newState);
      setState(newState);

      // State-effect debounce-writes to Firestore automatically


      soundService.playSuccess();
      setSyncToast('تم حذف جميع المشتركين وتصفير السجلات بنجاح 🗑️');
      setTimeout(() => setSyncToast(null), 3500);
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
    const sub = state.subscribers.find((s) => s.id === subscriberId);
    if (!sub) return;

    const subDeviceId = sub.deviceId;

    const deactivatedSub: Subscriber = {
      ...sub,
      status: 'inactive',
      startDate: '-',
      endDate: '-',
      amount: 0,
      subscriptionType: '-',
      paymentStatus: '-'
    };

    const updatedSubscribers = state.subscribers.map((s) =>
      s.id === subscriberId ? deactivatedSub : s
    );

    // Remove sales invoices associated with this subscriber (by id or deviceId)
    const remainingInvoices = state.invoices.filter(
      (inv) => inv.subscriberId !== subscriberId && (subDeviceId ? inv.deviceId !== subDeviceId : true)
    );

    // Remove any pending requests associated with this subscriber
    const remainingPendingRequests = state.pendingRequests.filter(
      (req) => req.subscriberId !== subscriberId && (subDeviceId ? req.deviceId !== subDeviceId : true)
    );

    // Recalculate agent stats based on updatedSubscribers & remainingInvoices
    const updatedAgents = state.agents.map((ag) => {
      const agSubs = updatedSubscribers.filter((s) => s.agentId === ag.id);
      const activeSubs = agSubs.filter((s) => s.status === 'active');
      const debtSubs = agSubs.filter((s) => s.paymentStatus === 'debt' || s.paymentStatus === 'partial');
      const totalAgentDebt = debtSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalAgentSales = remainingInvoices
        .filter((invoice) => invoice.agentId === ag.id)
        .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

      // Total paid is sales minus remaining debt
      const totalAgentPaid = Math.max(0, totalAgentSales - totalAgentDebt);

      return {
        ...ag,
        devicesCount: agSubs.length,
        activeSubscriptions: activeSubs.length,
        inactiveSubscriptions: agSubs.length - activeSubs.length,
        totalDebt: totalAgentDebt,
        totalSales: totalAgentSales,
        totalPaid: totalAgentPaid,
        hasDebt: totalAgentDebt > 0
      };
    });

    const newState: AppState = {
      ...state,
      subscribers: updatedSubscribers,
      invoices: remainingInvoices,
      pendingRequests: remainingPendingRequests,
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };

    storageService.saveState(newState);
    setState(newState);
    try {
      await firebaseService.saveRemoteState(newState);
    } catch (e) {
      console.warn('Immediate remote save on deactivate failed:', e);
    }
    soundService.playSuccess();
  };
  // Instant Renewal Handler
  const handleRenewSubscriber = (
    updatedSubscriber: Subscriber,
    isDebt: boolean,
    amount: number
  ) => {
    const currentState = stateRef.current;
    const currentSubscriber = currentState.subscribers.find((subscriber) => subscriber.id === updatedSubscriber.id);
    const wasActive = currentSubscriber?.status === 'active';
    const rawDev = (updatedSubscriber.deviceId || '').trim();
    const cleanDev = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';
    const finalSubscriber = { ...updatedSubscriber, deviceId: cleanDev };

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(currentState.invoices.length + 1).padStart(3, '0')}`,
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
      if (ag.id === updatedSubscriber.agentId) {
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

    const newState: AppState = {
      ...currentState,
      subscribers: currentState.subscribers.map((subscriber) =>
        subscriber.id === finalSubscriber.id ? finalSubscriber : subscriber
      ),
      invoices: [newInvoice, ...currentState.invoices],
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };

    // Keep the local snapshot and the single Firestore payload in sync. The
    // persistence effect will deduplicate this payload after its debounce.
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    stateRef.current = newState;
    storageService.saveState(newState);
    setState(newState);
    void firebaseService.saveRemoteState(newState, true).catch((error) => {
      console.error('Could not immediately sync subscriber renewal:', error);
      if (isMountedRef.current) {
        setSyncToast('تم تسجيل التجديد محلياً وتعذرت مزامنته حالياً');
        setTimeout(() => {
          if (isMountedRef.current) setSyncToast(null);
        }, 3500);
      }
    });

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
      status?: 'active' | 'inactive';
      amount?: number;
      startDate?: string;
      duration?: SubscriptionDuration;
      paymentStatus?: PaymentStatus;
    }
  ) => {
    const req = state.pendingRequests.find((r) => r.id === requestId);
    if (!req) return;

    const sub = state.subscribers.find((s) => s.id === req.subscriberId);
    if (sub) {
      const sDate = overrides?.startDate || new Date().toISOString().split('T')[0];
      const dur = overrides?.duration || req.duration;
      const amt = overrides?.amount !== undefined ? overrides.amount : req.amount;
      const stat = overrides?.status || 'active';
      const payStat = overrides?.paymentStatus || 'paid';

      const expDate = new Date(sDate);
      if (dur === '1 شهر') expDate.setMonth(expDate.getMonth() + 1);
      else if (dur === 'شهرين') expDate.setMonth(expDate.getMonth() + 2);
      else if (dur === '3 أشهر') expDate.setMonth(expDate.getMonth() + 3);
      else if (dur === '6 أشهر') expDate.setMonth(expDate.getMonth() + 6);
      else expDate.setFullYear(expDate.getFullYear() + 1);

      const updatedSub: Subscriber = {
        ...sub,
        status: stat,
        subscriptionType: dur,
        amount: amt,
        startDate: sDate,
        endDate: expDate.toISOString().split('T')[0],
        paymentStatus: payStat
      };

      handleRenewSubscriber(updatedSub, payStat === 'debt', amt);
    }

    setState((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter((r) => r.id !== requestId)
    }));

    soundService.playSuccess();
  };

  const handleRejectPendingRequest = (requestId: string) => {
    setState((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter((r) => r.id !== requestId)
    }));
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

    setState((prev) => ({
      ...prev,
      pendingRequests: [newRequest, ...prev.pendingRequests]
    }));

    soundService.playPendingAlert();

    showAlert(`ورد طلب تجديد جديد من الوكيل (${randomAgent.name}) للمشترك ${randomSub.name}`, 'طلب تجديد اشتراك جديد');
  };

  // Settle Agent Debt
  const handleSettleAgentDebt = (agentId: string, amount: number, note?: string) => {
    const updatedAgents = state.agents.map((ag) => {
      if (ag.id === agentId) {
        const newDebt = Math.max(0, ag.totalDebt - amount);
        return {
          ...ag,
          totalDebt: newDebt,
          totalPaid: ag.totalPaid + amount,
          hasDebt: newDebt > 0
        };
      }
      return ag;
    });

    setState({
      ...state,
      agents: updatedAgents
    });
    soundService.playSuccess();
  };

  // Apply a subscriber payment to their outstanding balance and related invoices.
  const handleSettleSubscriberDebt = (subscriberId: string, paymentAmount: number) => {
    const currentState = stateRef.current;
    const subscriber = currentState.subscribers.find((s) => s.id === subscriberId);
    const amount = Math.trunc(paymentAmount);
    if (!subscriber || !Number.isFinite(amount) || amount <= 0 || amount > subscriber.amount) return;

    const remainingDebt = Math.max(0, subscriber.amount - amount);
    const updatedSubscribers = currentState.subscribers.map((s): Subscriber => {
      if (s.id !== subscriberId) return s;
      const paidAmount = (s.paidAmount || 0) + amount;
      return {
        ...s,
        originalAmount: s.originalAmount ?? (s.amount + (s.paidAmount || 0)),
        paidAmount,
        amount: remainingDebt,
        paymentStatus: remainingDebt === 0 ? 'paid' : 'partial',
        settleDate: new Date().toISOString().split('T')[0]
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
      const invoiceRemaining = Math.max(
        0,
        invoice.remainingAmount ?? (invoice.amount - (invoice.paidAmount || 0))
      );
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

    const updatedAgents = currentState.agents.map((ag) => {
      const agSubs = updatedSubscribers.filter((s) => s.agentId === ag.id);
      const activeSubs = agSubs.filter((s) => s.status === 'active');
      const debtSubs = agSubs.filter((s) => s.paymentStatus === 'debt' || s.paymentStatus === 'partial');
      const totalAgentDebt = debtSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
      return {
        ...ag,
        devicesCount: agSubs.length,
        activeSubscriptions: activeSubs.length,
        inactiveSubscriptions: agSubs.length - activeSubs.length,
        totalDebt: totalAgentDebt,
        totalSales: ag.totalSales,
        hasDebt: totalAgentDebt > 0
      };
    });

    const newState: AppState = {
      ...currentState,
      subscribers: updatedSubscribers,
      invoices: updatedInvoices,
      agents: updatedAgents,
      lastUpdatedTimestamp: Date.now()
    };
    stateRef.current = newState;
    storageService.saveState(newState);
    setState(newState);
    void firebaseService.saveRemoteState(newState, true).catch((error) => {
      console.error('Could not immediately sync subscriber payment:', error);
      if (isMountedRef.current) {
        setSyncToast('تم تسجيل الدفعة محلياً وتعذرت مزامنتها حالياً');
        setTimeout(() => {
          if (isMountedRef.current) setSyncToast(null);
        }, 3500);
      }
    });
    soundService.playSuccess();
  };

  // Reset Agent Data
  const handleResetAgentData = (agentId: string) => {
    const updatedAgents = state.agents.map((ag) => {
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

    setState({
      ...state,
      agents: updatedAgents
    });
    soundService.playSuccess();
  };

  // Update Agent Branding
  const handleUpdateAgentBranding = (agentId: string, branding: Partial<Agent>) => {
    setState({
      ...state,
      agents: state.agents.map((ag) => (ag.id === agentId ? { ...ag, ...branding } : ag))
    });
  };

  // Product Inventory Handlers
  const handleAddProduct = (prodData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...prodData,
      id: `prod-${Date.now()}`
    };
    setState({
      ...state,
      products: [newProd, ...state.products]
    });
  };

  const handleUpdateProduct = (updated: Product) => {
    setState({
      ...state,
      products: state.products.map((p) => (p.id === updated.id ? updated : p))
    });
  };

  const handleDeleteProduct = (id: string) => {
    setState({
      ...state,
      products: state.products.filter((p) => p.id !== id)
    });
  };

  const handleAdjustStock = (id: string, delta: number) => {
    setState({
      ...state,
      products: state.products.map((p) => {
        if (p.id === id) {
          return { ...p, stock: Math.max(0, p.stock + delta) };
        }
        return p;
      })
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
    setState({
      ...state,
      codes: [newCode, ...state.codes]
    });
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
    setState({
      ...state,
      codes: [...newCodes, ...state.codes]
    });
  };

  const handleDeleteCode = (id: string) => {
    setState({
      ...state,
      codes: state.codes.filter((c) => c.id !== id)
    });
  };

  const handleClearAllCodes = () => {
    setState({
      ...state,
      codes: []
    });
  };

  // Pricing Handlers
  const handleSavePricing = (rows: PricingRow[]) => {
    setState({
      ...state,
      pricing: rows
    });
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
    reports: 'التقارير التحليلية وأبراج البث',
    products: 'إدارة المنتجات والمعدات والمخزن',
    pricing: 'جدول أسعار الوكلاء والمركز',
    agent_portal: `بوابة الوكيل (${currentAgent.name})`
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#080E21] text-slate-100' : 'bg-slate-50 text-slate-800'} flex font-sans antialiased transition-colors duration-200`} dir="rtl">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        pendingCount={state.pendingRequests.length}
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
          onRefresh={handleGlobalRefresh}
          isRefreshing={isRefreshing}
          isAgentMode={isAgentMode}
          agentsList={state.agents.filter((a) => a.id !== 'agent-main')}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onLogout={handleLogout}
          isDark={isDarkMode}
          onToggleDark={handleToggleDarkMode}
          onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {/* Dynamic Views */}
        <main className="p-4 md:p-6 max-w-7xl w-full mx-auto flex-1">
          {currentTab === 'dashboard' && (
            <DashboardView
              agents={state.agents}
              subscribers={state.subscribers}
              invoices={state.invoices}
              onNavigate={setCurrentTab}
              onOpenNewSale={() => setCurrentTab('subscribers')}
              onExportExcel={() => excelService.exportInvoices(state.invoices)}
            />
          )}

          {currentTab === 'subscribers' && (
            <SubscribersView
              subscribers={state.subscribers}
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
              currentAgentFilter={subscribersAgentFilter}
              isMainCenterView={!isAgentMode}
              isAdmin={currentUser.role === 'مدير رئيسي' && !isAgentMode}
            />
          )}

          {currentTab === 'sales' && (
            <SalesInvoicesView
              invoices={state.invoices}
              agents={state.agents}
              onOpenReceipt={setActiveReceiptInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onSelectDeviceQr={handleOpenDeviceQr}
            />
          )}

          {currentTab === 'debts' && (
            <DebtsView
              agents={state.agents}
              invoices={state.invoices}
              subscribers={state.subscribers}
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
              pendingRequests={state.pendingRequests}
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

          {currentTab === 'reports' && (
            <ReportsView
              agents={state.agents}
              subscribers={state.subscribers}
              invoices={state.invoices}
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
              onSavePricing={handleSavePricing}
              onUpdateAgent={handleUpdateAgentBranding}
            />
          )}

          {currentTab === 'agent_portal' && (
            <AgentPortalView
              currentAgent={currentAgent}
              subscribers={state.subscribers}
              products={state.products}
              pricing={state.pricing}
              onSubmitRenewalOrder={(order) => {
                const newReq: PendingRenewalRequest = {
                  ...order,
                  id: `req-${Date.now()}`,
                  status: 'pending'
                };
                setState((prev) => ({
                  ...prev,
                  pendingRequests: [newReq, ...prev.pendingRequests]
                }));
                soundService.playPendingAlert();
              }}
              onOpenWhatsApp={setActiveWhatsAppSub}
              onUpdateBranding={handleUpdateAgentBranding}
              onSelectDeviceQr={handleOpenDeviceQr}
            />
          )}
        </main>
      </div>

      {/* WhatsApp Modal */}
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

      {/* Toast Notification for Sync & Data Refresh */}
      {syncToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>{syncToast}</span>
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

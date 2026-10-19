/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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

const USER_SESSION_KEY = 'alsari_auth_user_v1';

export default function App() {
  const [state, setState] = useState<AppState>(() => storageService.loadState());

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
        const filtered = storageService.filterOutDeleted(remote);
        // Mark as remote update so state-effect does NOT echo back to Firestore
        isRemoteUpdateRef.current = true;
        setState(filtered);
        storageService.saveState(filtered);
      } else {
        const local = storageService.loadState();
        if (local) {
          setState(local);
        }
      }
      setSyncToast('تم تحديث البيانات ومزامنتها بنجاح');
      soundService.playSuccess();
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

  // --- Effect 1: Persist locally + push to Firestore on every local change ---
  useEffect(() => {
    // Always save to localStorage for offline resilience
    storageService.saveState(state);

    // If this state change originated from a REMOTE snapshot, skip the write
    // back to Firestore (it is already there).
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    if (firebaseService.isQuotaExceeded()) return;

    // Debounce: wait 1.5 s of inactivity before writing so rapid local edits
    // collapse into a single Firestore write.
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      firebaseService.saveRemoteState(state);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state]);

  // --- Effect 2: Real-time Firestore listener (cross-device sync) ---
  useEffect(() => {
    // Clear quota at start so listener always connects

    const unsubscribe = firebaseService.subscribeToRemoteState((remoteState) => {
      if (!remoteState) return;

      // Apply the deleted-subscriber filter so deletions propagate cross-device
      const filteredState = storageService.filterOutDeleted(remoteState);

      // Save to localStorage immediately so a subsequent reload retains fresh remote state
      storageService.saveState(filteredState);

      // Mark as remote so Effect 1 does NOT write it back to Firestore
      isRemoteUpdateRef.current = true;
      setState(filteredState);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Current selected agent
  const currentAgent = state.agents.find((a) => a.id === selectedAgentId) || state.agents[1];

  // Auth Handlers
  const handleLogin = (user: SystemUser) => {
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
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((inv) => inv.id !== id)
    }));
    soundService.playSuccess();
  };

  // Add Subscriber / New Sale
  const handleAddSubscriber = (subData: Partial<Subscriber>, isSale = true, isPaid = false) => {
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

    const newSub: Subscriber = {
      id: newId,
      name: subData.name || 'مشترك جديد',
      phone: subData.phone || '',
      deviceId: cleanDevId,
      agentId: subData.agentId || 'agent-main',
      agentName: subData.agentName || 'المركز الرئيسي',
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

    let updatedInvoices = state.invoices;
    let updatedAgents = state.agents;
    let registeredInvoice: Invoice | null = null;

    if (isSale) {
      registeredInvoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${String(state.invoices.length + 1).padStart(3, '0')}`,
        subscriberId: newSub.id,
        subscriberName: newSub.name,
        deviceId: newSub.deviceId,
        agentId: newSub.agentId,
        agentName: newSub.agentName,
        packageType: `اشتراك ${newSub.subscriptionType}`,
        amount: newSub.amount,
        paidAmount: isPaid ? newSub.amount : 0,
        remainingAmount: isPaid ? 0 : newSub.amount,
        paymentStatus: isPaid ? 'paid' : 'debt',
        date: newSub.startDate,
        notes: newSub.notes
      };
      updatedInvoices = [registeredInvoice, ...state.invoices];

      // Update Agent Financials
      updatedAgents = state.agents.map((ag) => {
        if (ag.id === newSub.agentId) {
          const newDebt = isPaid ? ag.totalDebt : ag.totalDebt + newSub.amount;
          const newPaid = isPaid ? ag.totalPaid + newSub.amount : ag.totalPaid;
          return {
            ...ag,
            totalSales: ag.totalSales + newSub.amount,
            totalPaid: newPaid,
            totalDebt: newDebt,
            activeSubscriptions: ag.activeSubscriptions + 1,
            devicesCount: ag.devicesCount + 1,
            hasDebt: newDebt > 0
          };
        }
        return ag;
      });
    }

    setState({
      ...state,
      subscribers: [newSub, ...state.subscribers],
      invoices: updatedInvoices,
      agents: updatedAgents
    });

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
    let cleanDevId = (updated.deviceId || '').trim();
    if (cleanDevId && !cleanDevId.startsWith('00')) {
      cleanDevId = '00' + cleanDevId;
    }
    const fixedSub = { ...updated, deviceId: cleanDevId };
    setState({
      ...state,
      subscribers: state.subscribers.map((s) => (s.id === updated.id ? fixedSub : s))
    });
  };

  const handleImportSubscribers = ({ subscribers: importedSubs, newAgents = [] }: { subscribers: Subscriber[], newAgents: Agent[] }) => {
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

    setState((prev) => {
      const deletedSet = storageService.getDeletedSubscriberIds();
      const existingMap = new Map<string, Subscriber>();
      
      prev.subscribers.forEach((s) => {
        if (!deletedSet.has(s.id) && !deletedSet.has(s.deviceId)) {
          existingMap.set(s.deviceId, s);
        }
      });

      importedSubs.forEach((sub) => {
        if (!deletedSet.has(sub.id) && !deletedSet.has(sub.deviceId)) {
          let devId = (sub.deviceId || '').trim();
          if (devId && !devId.startsWith('00')) {
            devId = '00' + devId;
          }
          const fixedSub = { ...sub, deviceId: devId };
          existingMap.set(devId, fixedSub);
        }
      });

      const updatedSubscribers = Array.from(existingMap.values());

      let currentAgents = [...prev.agents];
      newAgents.forEach((na) => {
        if (!currentAgents.some((a) => a.id === na.id || a.name.toLowerCase() === na.name.toLowerCase())) {
          currentAgents.push(na);
        }
      });

      const updatedAgents = currentAgents.map((ag) => {
        const agSubs = updatedSubscribers.filter((s) =>
          s.agentId === ag.id ||
          (s.agentName && ag.name && (
            s.agentName.trim().toLowerCase() === ag.name.trim().toLowerCase() ||
            s.agentName.includes(ag.name) ||
            ag.name.includes(s.agentName)
          ))
        );
        const activeSubs = agSubs.filter((s) => s.status === 'active');
        return {
          ...ag,
          devicesCount: agSubs.length,
          activeSubscriptions: activeSubs.length,
          inactiveSubscriptions: agSubs.length - activeSubs.length
        };
      });

      const newState: AppState = {
        ...prev,
        subscribers: updatedSubscribers,
        agents: updatedAgents,
        lastUpdatedTimestamp: Date.now()
      };
      storageService.saveState(newState);
      return newState;
    });
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
      const debtSubs = agSubs.filter((s) => s.paymentStatus === 'debt');
      const totalAgentDebt = debtSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalAgentSales = agSubs.reduce((sum, s) => sum + (s.amount || 0), 0);

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
      alert('غير مصرح لك بتنفيذ هذه العملية. تواصل مع المدير الرئيسي.');
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
      const debtSubs = agSubs.filter((s) => s.paymentStatus === 'debt');
      const totalAgentDebt = debtSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalAgentSales = agSubs.reduce((sum, s) => sum + (s.amount || 0), 0);

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
    const rawDev = (updatedSubscriber.deviceId || '').trim();
    const cleanDev = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';
    const finalSubscriber = { ...updatedSubscriber, deviceId: cleanDev };

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-${String(state.invoices.length + 1).padStart(3, '0')}`,
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

    const updatedAgents = state.agents.map((ag) => {
      if (ag.id === updatedSubscriber.agentId) {
        const newDebt = isDebt ? ag.totalDebt + amount : ag.totalDebt;
        const newPaid = isDebt ? ag.totalPaid : ag.totalPaid + amount;
        return {
          ...ag,
          totalSales: ag.totalSales + amount,
          totalDebt: newDebt,
          totalPaid: newPaid,
          activeSubscriptions: ag.activeSubscriptions + 1,
          inactiveSubscriptions: Math.max(0, ag.inactiveSubscriptions - 1),
          hasDebt: newDebt > 0
        };
      }
      return ag;
    });

    setState({
      ...state,
      subscribers: state.subscribers.map((s) => (s.id === finalSubscriber.id ? finalSubscriber : s)),
      invoices: [newInvoice, ...state.invoices],
      agents: updatedAgents
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

  // Request Web Notifications permission on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

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

    // Trigger Desktop Web Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('طلب تجديد اشتراك جديد - مركز الساري', {
          body: `ورد طلب تجديد جديد من الوكيل (${randomAgent.name}) للمشترك ${randomSub.name}`,
          icon: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=128&q=80'
        });
      } catch {
        // ignore if blocked
      }
    }
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

  // Settle Subscriber Debt (Set debt to 0, status to paid, update invoice)
  const handleSettleSubscriberDebt = (subscriberId: string) => {
    const updatedSubscribers = state.subscribers.map((s): Subscriber => {
      if (s.id === subscriberId) {
        return { ...s, paymentStatus: 'paid' as PaymentStatus, amount: 0 };
      }
      return s;
    });

    const updatedInvoices = state.invoices.map((inv): Invoice => {
      if (inv.subscriberId === subscriberId && inv.paymentStatus === 'debt') {
        return {
          ...inv,
          paymentStatus: 'paid' as PaymentStatus,
          paidAmount: inv.amount,
          remainingAmount: 0
        };
      }
      return inv;
    });

    // Recalculate agent stats
    const updatedAgents = state.agents.map((ag) => {
      const agSubs = updatedSubscribers.filter((s) => s.agentId === ag.id);
      const activeSubs = agSubs.filter((s) => s.status === 'active');
      const debtSubs = agSubs.filter((s) => s.paymentStatus === 'debt');
      const totalAgentDebt = debtSubs.reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalAgentSales = agSubs.reduce((sum, s) => sum + (s.amount || 0), 0);

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

    setState({
      ...state,
      subscribers: updatedSubscribers,
      invoices: updatedInvoices,
      agents: updatedAgents
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
              onSavePricing={handleSavePricing}
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { AppState, storageService } from './services/storageService';
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
import { AdminAccountsView } from './components/AdminAccountsView';
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
      setThemeToast(next ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري');
      setTimeout(() => setThemeToast(null), 3500);
      return next;
    });
  };

  // Auto persist on state change
  useEffect(() => {
    storageService.saveState(state);
  }, [state]);

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
    const newSub: Subscriber = {
      id: newId,
      name: subData.name || 'مشترك جديد',
      phone: subData.phone || '',
      deviceId: subData.deviceId || `00${Math.floor(100000 + Math.random() * 900000)}`,
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
    setState({
      ...state,
      subscribers: state.subscribers.map((s) => (s.id === updated.id ? updated : s))
    });
  };

  const handleDeleteSubscriber = (id: string) => {
    const sub = state.subscribers.find((s) => s.id === id);
    const updatedAgents = state.agents.map((ag) => {
      if (sub && (ag.id === sub.agentId || ag.name === sub.agentName)) {
        return {
          ...ag,
          activeSubscriptions: sub.status === 'active' ? Math.max(0, ag.activeSubscriptions - 1) : ag.activeSubscriptions,
          inactiveSubscriptions: sub.status === 'inactive' ? Math.max(0, ag.inactiveSubscriptions - 1) : ag.inactiveSubscriptions,
          totalDebt: sub.paymentStatus === 'debt' ? Math.max(0, ag.totalDebt - sub.amount) : ag.totalDebt,
          totalSales: Math.max(0, ag.totalSales - sub.amount)
        };
      }
      return ag;
    });

    setState({
      ...state,
      subscribers: state.subscribers.filter((s) => s.id !== id),
      agents: updatedAgents
    });
    soundService.playSuccess();
  };

  // Deactivate Subscriber (Reset information to blank and status to inactive)
  const handleDeactivateSubscriber = (subscriberId: string) => {
    const sub = state.subscribers.find((s) => s.id === subscriberId);
    if (!sub) return;

    const deactivatedSub: Subscriber = {
      ...sub,
      status: 'inactive',
      startDate: '-',
      endDate: '-',
      amount: 0,
      subscriptionType: '1 شهر',
      paymentStatus: 'paid'
    };

    const updatedAgents = state.agents.map((ag) => {
      if (ag.id === sub.agentId) {
        return {
          ...ag,
          activeSubscriptions: Math.max(0, ag.activeSubscriptions - 1),
          inactiveSubscriptions: ag.inactiveSubscriptions + 1
        };
      }
      return ag;
    });

    setState({
      ...state,
      subscribers: state.subscribers.map((s) => (s.id === subscriberId ? deactivatedSub : s)),
      agents: updatedAgents
    });

    soundService.playSuccess();
  };

  // Instant Renewal Handler
  const handleRenewSubscriber = (
    updatedSubscriber: Subscriber,
    isDebt: boolean,
    amount: number
  ) => {
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-${String(state.invoices.length + 1).padStart(3, '0')}`,
      subscriberId: updatedSubscriber.id,
      subscriberName: updatedSubscriber.name,
      deviceId: updatedSubscriber.deviceId,
      agentId: updatedSubscriber.agentId,
      agentName: updatedSubscriber.agentName,
      packageType: `تجديد باقة ${updatedSubscriber.subscriptionType}`,
      amount: amount,
      paidAmount: isDebt ? 0 : amount,
      remainingAmount: isDebt ? amount : 0,
      paymentStatus: isDebt ? 'debt' : 'paid',
      date: updatedSubscriber.startDate,
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
      subscribers: state.subscribers.map((s) => (s.id === updatedSubscriber.id ? updatedSubscriber : s)),
      invoices: [newInvoice, ...state.invoices],
      agents: updatedAgents
    });

    soundService.playSuccess();

    // Show Invoice Success Modal matching Screenshot 5!
    setInvoiceSuccessData({
      invoice: newInvoice,
      startDate: updatedSubscriber.startDate,
      endDate: updatedSubscriber.endDate,
      phone: updatedSubscriber.phone
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

  // User Accounts & Security Handlers
  const handleAddUser = (userData: Omit<SystemUser, 'id'>) => {
    const newUser: SystemUser = {
      ...userData,
      id: `user-${Date.now()}`
    };
    setState({
      ...state,
      users: [...state.users, newUser]
    });
  };

  const handleUpdateUser = (updated: SystemUser) => {
    setState({
      ...state,
      users: state.users.map((u) => (u.id === updated.id ? updated : u))
    });
  };

  const handleDeleteUser = (id: string) => {
    setState({
      ...state,
      users: state.users.filter((u) => u.id !== id)
    });
  };

  const handleTriggerSecurityTest = () => {
    const alert: SecurityAlert = {
      id: `sec-${Date.now()}`,
      type: 'mass_delete',
      title: 'رصد محاولة تعديل أسعار خارج النطاق',
      description: 'نظام المراقبة الأمني سجل نشاطاً غير مألوف في جدول تسعير الوكلاء، وتم حفظ نسخة أمان احترازية.',
      timestamp: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      severity: 'high',
      read: false
    };

    setState((prev) => ({
      ...prev,
      securityAlerts: [alert, ...prev.securityAlerts]
    }));

    soundService.playPendingAlert();
  };

  // Backup & Restore Handlers
  const handleDownloadBackup = () => {
    storageService.exportBackupJson(state);
  };

  const handleRestoreBackup = async (file: File) => {
    try {
      const restored = await storageService.importBackupJson(file);
      setState(restored);
      soundService.playSuccess();
      alert('تم استعادة النسخة الاحتياطية بنجاح!');
    } catch {
      alert('فشل في قراءة ملف النسخة الاحتياطية');
    }
  };

  const handleResetData = () => {
    localStorage.removeItem('alsari_broadcasting_v1');
    setState(storageService.loadState());
    soundService.playSuccess();
  };

  // If not logged in, display Login Page matching Screenshot 1!
  if (!currentUser) {
    return <LoginView users={state.users} onLogin={handleLogin} />;
  }

  // Titles mapping
  const pageTitles: Record<NavTab, string> = {
    dashboard: 'الداشبورد العام للمركز',
    sales: 'سجل فواتير المبيعات والاشتراكات',
    subscribers: 'إدارة المشتركين والاشتراكات',
    debts: 'سجل الديون والمستحقات المالية',
    pending: 'الطلبات المعلقة (طلبات التجديد الواردة)',
    agents: 'ملخص الأداء المالي والميداني للوكلاء',
    barcodes: 'إدارة أكواد وأجهزة QR',
    reports: 'التقارير التحليلية وأبراج البث',
    products: 'إدارة المنتجات والمعدات والمخزن',
    pricing: 'جدول أسعار الوكلاء والمركز',
    admin: 'حساب الادمن والأمان والنسخ الاحتياطي',
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <Header
          pageTitle={pageTitles[currentTab]}
          securityAlerts={state.securityAlerts}
          pendingCount={state.pendingRequests.length}
          onRefresh={() => setState(storageService.loadState())}
          onDownloadBackup={handleDownloadBackup}
          isAgentMode={isAgentMode}
          onToggleAgentMode={handleToggleAgentMode}
          agentsList={state.agents.filter((a) => a.id !== 'agent-main')}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onLogout={handleLogout}
          isDark={isDarkMode}
          onToggleDark={handleToggleDarkMode}
        />

        {/* Dynamic Views */}
        <main className="p-6 max-w-7xl w-full mx-auto flex-1">
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
              onOpenWhatsApp={setActiveWhatsAppSub}
              onSelectDeviceQr={handleOpenDeviceQr}
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
              onOpenWhatsApp={setActiveWhatsAppSub}
              onSelectDeviceQr={handleOpenDeviceQr}
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

          {currentTab === 'admin' && (
            <AdminAccountsView
              users={state.users}
              securityAlerts={state.securityAlerts}
              lastBackupDate={state.lastBackupDate}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onDownloadBackup={handleDownloadBackup}
              onRestoreBackup={handleRestoreBackup}
              onResetData={handleResetData}
              onTriggerSecurityTest={handleTriggerSecurityTest}
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

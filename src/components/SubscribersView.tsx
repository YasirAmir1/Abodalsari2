import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Search,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  MessageSquare,
  Edit2,
  Trash2,
  X,
  QrCode,
  Sparkles,
  Calendar,
  CheckCircle2,
  UserCheck,
  DollarSign,
  History,
  AlertTriangle,
  BellRing,
  Bell,
  Users,
  Users2,
  Phone,
  Wallet,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { Agent, Invoice, PricingRow, Subscriber, SubscriptionDuration } from '../types';
import { excelService } from '../services/excelService';
import { storageService } from '../services/storageService';
import { getPriceByDuration } from '../utils/pricingUtils';
import {
  buildSubscriberDebtMap,
  getSubscriberOutstandingDebt,
  getSubscriberDebtOverdueInfo,
  SubscriberDebtOverdueInfo
} from '../utils/calculationUtils';
import { RenewSubscriptionModal } from './RenewSubscriptionModal';
import { DeactivateSubscriberModal } from './DeactivateSubscriberModal';
import { DeleteSubscriberModal } from './DeleteSubscriberModal';
import { DeleteAllSubscribersModal } from './DeleteAllSubscribersModal';
import { CustomModal } from './CustomModal';
import { useAppDialogs } from './AppDialogProvider';
import { useVirtualizedRows } from './useVirtualizedRows';

interface SubscribersViewProps {
  subscribers: Subscriber[];
  invoices: Invoice[];
  agents: Agent[];
  pricing: PricingRow[];
  onAddSubscriber: (sub: Partial<Subscriber>, isSale: boolean, paid: boolean, saleKind?: 'subscription' | 'device') => void;
  onUpdateSubscriber: (sub: Subscriber) => void;
  onDeleteSubscriber: (id: string) => void;
  onRenewSubscriber: (updatedSubscriber: Subscriber, isDebt: boolean, amount: number) => void;
  onDeactivateSubscriber: (subscriberId: string) => void;
  onDeleteAllSubscribersHandler: () => Promise<void> | void;
  onOpenWhatsApp: (sub: Subscriber) => void;
  onSelectDeviceQr: (deviceId: string, subscriberName?: string, agentName?: string) => void;
  onImportSubscribers?: (data: { subscribers: Subscriber[], newAgents: Agent[] }) => void;
  currentAgentFilter?: string;
  isMainCenterView?: boolean;
  isAdmin?: boolean;
}

const SubscribersViewComponent: React.FC<SubscribersViewProps> = ({
  subscribers,
  invoices,
  agents,
  pricing,
  onAddSubscriber,
  onUpdateSubscriber,
  onDeleteSubscriber,
  onRenewSubscriber,
  onDeactivateSubscriber,
  onDeleteAllSubscribersHandler,
  onOpenWhatsApp,
  onSelectDeviceQr,
  onImportSubscribers,
  currentAgentFilter,
  isMainCenterView = true,
  isAdmin = false
}) => {
  const { showAlert } = useAppDialogs();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expiring_soon'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>(currentAgentFilter || 'all');
  const [debtThreshold, setDebtThreshold] = useState<number>(50000);
  const [onlyHighDebt, setOnlyHighDebt] = useState<boolean>(false);
  const [onlyOverdueDebt, setOnlyOverdueDebt] = useState<boolean>(false);
  const debtMap = useMemo(() => buildSubscriberDebtMap(invoices), [invoices]);
  const [historySubscriber, setHistorySubscriber] = useState<Subscriber | null>(null);
  const subscriberInvoiceHistory = useMemo(
    () => historySubscriber
      ? invoices
          .filter((invoice) => invoice.subscriberId === historySubscriber.id)
          .sort((first, second) => second.date.localeCompare(first.date))
      : [],
    [historySubscriber, invoices]
  );

  const subscribersForView = useMemo(() => {
    if (!isAdmin) return subscribers;

    const uniqueSubscribers: Subscriber[] = [];
    const indexesById = new Map<string, number>();
    const indexesByDeviceId = new Map<string, number>();

    subscribers.forEach((subscriber) => {
      const id = (subscriber.id || '').trim();
      const rawDeviceId = (subscriber.deviceId || '').trim().replace(/\s+/g, '');
      const deviceId = rawDeviceId
        ? (rawDeviceId.startsWith('00') ? rawDeviceId : `00${rawDeviceId}`)
        : '';
      const duplicateIndex = (id ? indexesById.get(id) : undefined)
        ?? (deviceId ? indexesByDeviceId.get(deviceId) : undefined);

      if (duplicateIndex === undefined) {
        const index = uniqueSubscribers.push(subscriber) - 1;
        if (id) indexesById.set(id, index);
        if (deviceId) indexesByDeviceId.set(deviceId, index);
        return;
      }

      const existing = uniqueSubscribers[duplicateIndex];
      const subscriberHasAgent = (Boolean(subscriber.agentId) && subscriber.agentId !== 'agent-main')
        || (Boolean(subscriber.agentName) && subscriber.agentName !== 'المركز الرئيسي');
      const existingHasAgent = (Boolean(existing.agentId) && existing.agentId !== 'agent-main')
        || (Boolean(existing.agentName) && existing.agentName !== 'المركز الرئيسي');

      if (subscriberHasAgent && !existingHasAgent) uniqueSubscribers[duplicateIndex] = subscriber;
      if (id) indexesById.set(id, duplicateIndex);
      if (deviceId) indexesByDeviceId.set(deviceId, duplicateIndex);
    });

    return uniqueSubscribers;
  }, [isAdmin, subscribers]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [renewingSubscriber, setRenewingSubscriber] = useState<Subscriber | null>(null);
  const [deactivatingSubscriber, setDeactivatingSubscriber] = useState<Subscriber | null>(null);
  const [deletingSubscriber, setDeletingSubscriber] = useState<Subscriber | null>(null);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [modalInfo, setModalInfo] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  // Helper to calculate end date from start date & duration
  const calculateEndDate = (startDateStr: string, duration: SubscriptionDuration): string => {
    if (!startDateStr) return '';
    const date = new Date(startDateStr);
    if (isNaN(date.getTime())) return '';
    const result = new Date(date);
    const months = duration === 'شهرين' ? 2 : duration === '3 أشهر' ? 3 : 1;
    result.setMonth(result.getMonth() + months);
    return result.toISOString().split('T')[0];
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const [showAgentRenewalModal, setShowAgentRenewalModal] = useState(false);
  const [agentRenewalCustomerName, setAgentRenewalCustomerName] = useState('');
  const [selectedAgentSubscriber, setSelectedAgentSubscriber] = useState<Subscriber | null>(null);
  const [showAgentRenewalSuggestions, setShowAgentRenewalSuggestions] = useState(false);
  const [agentRenewalDuration, setAgentRenewalDuration] = useState<SubscriptionDuration>('1 شهر');
  const [agentRenewalStartDate, setAgentRenewalStartDate] = useState(todayStr);
  const [agentRenewalEndDate, setAgentRenewalEndDate] = useState(() => calculateEndDate(todayStr, '1 شهر'));
  const [agentRenewalPayment, setAgentRenewalPayment] = useState<'paid' | 'debt'>('debt');

  // New Sale Form State
  const [newSubName, setNewSubName] = useState('');
  const [newSubPhone, setNewSubPhone] = useState('');
  const [newSubDeviceId, setNewSubDeviceId] = useState('');
  const [newSubAgentId, setNewSubAgentId] = useState('agent-main');
  const [newSaleType, setNewSaleType] = useState<'renewal' | 'device'>('device');
  const [newSubType, setNewSubType] = useState<SubscriptionDuration>('1 شهر');
  const [newSubPaymentStatus, setNewSubPaymentStatus] = useState<'paid' | 'debt'>('debt');
  const [newSaleDate, setNewSaleDate] = useState(todayStr);
  const [newSubStartDate, setNewSubStartDate] = useState(todayStr);
  const [newSubEndDate, setNewSubEndDate] = useState(() => calculateEndDate(todayStr, '1 شهر'));
  const [newSubNotes, setNewSubNotes] = useState('');
  const [matchedSubscriber, setMatchedSubscriber] = useState<Subscriber | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  // Auto calculate price based on selected agent and package
  const selectedAgent = agents.find((agent) => agent.id === newSubAgentId)
    || (newSubAgentId === 'agent-main' ? agents.find((agent) => agent.id === 'agent-main') : undefined)
    || agents[0];
  const selectedAgentPricing = selectedAgent?.id === 'agent-main' || newSubAgentId === 'agent-main'
    ? pricing.find((row) => row.agentId === 'agent-main') || pricing.find((row) => row.isReference)
    : pricing.find((row) => row.agentId === newSubAgentId)
      || (selectedAgent ? pricing.find((row) => row.agentCode === selectedAgent.code) : undefined)
      || (selectedAgent
        ? pricing.find((row) => row.agentName.trim().toLocaleLowerCase() === selectedAgent.name.trim().toLocaleLowerCase())
        : undefined);
  const newDevicePrice = Number(selectedAgentPricing?.newDevicePrice) || 0;
  const calculatedPrice = getPriceByDuration(selectedAgent?.id || newSubAgentId, newSubType, pricing);

  const openNewSaleModal = () => {
    setNewSaleType('device');
    setNewSubName('');
    setNewSubPhone('');
    setNewSubDeviceId('');
    setNewSubAgentId(agents.find((agent) => agent.id === 'agent-main')?.id || agents[0]?.id || 'agent-main');
    setNewSubType('1 شهر');
    setNewSubPaymentStatus('debt');
    setNewSaleDate(todayStr);
    setNewSubStartDate(todayStr);
    setNewSubEndDate(calculateEndDate(todayStr, '1 شهر'));
    setNewSubNotes('');
    setMatchedSubscriber(null);
    setShowNameSuggestions(false);
    setShowAddModal(true);
  };

  // When subscriber name is typed, check if it matches existing subscriber
  const handleNameChange = (val: string) => {
    setNewSubName(val);
    setShowNameSuggestions(val.trim().length > 0);

    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setMatchedSubscriber(null);
      return;
    }

    const exactMatch = subscribersForView.find((s) => s.name.trim().toLowerCase() === trimmed);
    if (exactMatch) {
      selectExistingSubscriber(exactMatch);
    } else {
      setMatchedSubscriber(null);
    }
  };

  const selectExistingSubscriber = (sub: Subscriber) => {
    setNewSubName(sub.name);
    setMatchedSubscriber(sub);
    setShowNameSuggestions(false);
    if (sub.phone) setNewSubPhone(sub.phone);
    if (sub.deviceId) setNewSubDeviceId(sub.deviceId);
    if (sub.agentId) setNewSubAgentId(sub.agentId);
    if (sub.subscriptionType) {
      const supportedDurations = ['1 شهر', 'شهرين', '3 أشهر'] as const;
      const duration: SubscriptionDuration = supportedDurations.find(
        (candidate) => candidate === sub.subscriptionType
      ) || '1 شهر';
      setNewSubType(duration);
      setNewSubEndDate(calculateEndDate(newSubStartDate, duration));
    }
  };

  const handleDurationChange = (type: SubscriptionDuration) => {
    setNewSubType(type);
    setNewSubEndDate(calculateEndDate(newSubStartDate, type));
  };

  const handleStartDateChange = (startDateVal: string) => {
    setNewSubStartDate(startDateVal);
    setNewSubEndDate(calculateEndDate(startDateVal, newSubType));
  };

  const agentOwnedSubscribers = useMemo(() => subscribersForView.filter((sub) =>
    (Boolean(sub.agentId) || Boolean(sub.agentName)) &&
    sub.agentId !== 'agent-main' && sub.agentName !== 'المركز الرئيسي'
  ), [subscribersForView]);

  const subscriberCountsByAgent = useMemo(() => {
    const agentIndexesById = new Map<string, number>();
    const agentIndexesByName = new Map<string, number[]>();
    agents.forEach((agent, index) => {
      agentIndexesById.set(agent.id, index);
      const matchingIndexes = agentIndexesByName.get(agent.name) || [];
      matchingIndexes.push(index);
      agentIndexesByName.set(agent.name, matchingIndexes);
    });

    const counts = agents.map(() => 0);
    subscribersForView.forEach((subscriber) => {
      const matchingIndexes = new Set<number>();
      const idIndex = agentIndexesById.get(subscriber.agentId);
      if (idIndex !== undefined) matchingIndexes.add(idIndex);
      (agentIndexesByName.get(subscriber.agentName) || []).forEach((index) => matchingIndexes.add(index));
      matchingIndexes.forEach((index) => counts[index]++);
    });
    const countsByAgent = new Map<string, number>();
    agents.forEach((agent, index) => countsByAgent.set(agent.id, counts[index]));
    return countsByAgent;
  }, [agents, subscribersForView]);

  const agentRenewalPrice = useMemo(() => {
    if (!selectedAgentSubscriber) return 0;

    const subscriberAgentName = selectedAgentSubscriber.agentName?.trim().toLocaleLowerCase();
    const assignedAgent = agents.find((agent) =>
      agent.id === selectedAgentSubscriber.agentId
    ) || agents.find((agent) =>
      subscriberAgentName &&
      agent.name.trim().toLocaleLowerCase() === subscriberAgentName
    ) || agents.find(a => a.id === 'agent-main') || agents[0];
    
    if (!assignedAgent) return 0;

    const assignedAgentName = assignedAgent.name.trim().toLocaleLowerCase();
    const agentPricing = pricing.find((row) => row.agentId === assignedAgent.id)
      || pricing.find((row) => row.agentCode === assignedAgent.code || row.agentName?.trim().toLocaleLowerCase() === assignedAgentName);
    if (!agentPricing) return 0;

    const priceByDuration: Record<SubscriptionDuration, number> = {
      '1 شهر': Number(agentPricing.oneMonthPrice),
      'شهرين': Number(agentPricing.twoMonthsPrice),
      '3 أشهر': Number(agentPricing.threeMonthsPrice),
      '-': 0,
      '': 0
    };
    const price = priceByDuration[agentRenewalDuration];
    return Number.isFinite(price) && price > 0 ? price : 0;
  }, [agentRenewalDuration, agents, pricing, selectedAgentSubscriber]);

  const openAgentRenewalModal = () => {
    const startDate = todayStr;
    setAgentRenewalCustomerName('');
    setSelectedAgentSubscriber(null);
    setShowAgentRenewalSuggestions(false);
    setAgentRenewalDuration('1 شهر');
    setAgentRenewalStartDate(startDate);
    setAgentRenewalEndDate(calculateEndDate(startDate, '1 شهر'));
    setAgentRenewalPayment('debt');
    setShowAgentRenewalModal(true);
  };

  const selectAgentRenewalSubscriber = (subscriber: Subscriber) => {
    const supportedDurations = ['1 شهر', 'شهرين', '3 أشهر'] as const;
    const duration: SubscriptionDuration = supportedDurations.find(
      (candidate) => candidate === subscriber.subscriptionType
    ) || '1 شهر';
    setSelectedAgentSubscriber(subscriber);
    setAgentRenewalCustomerName(subscriber.name);
    setShowAgentRenewalSuggestions(false);
    setAgentRenewalDuration(duration);
    setAgentRenewalStartDate(todayStr);
    setAgentRenewalEndDate(calculateEndDate(todayStr, duration));
    setAgentRenewalPayment('debt');
  };

  const handleAgentRenewalCustomerNameChange = (value: string) => {
    setAgentRenewalCustomerName(value);
    setShowAgentRenewalSuggestions(value.trim().length > 0);
    const normalized = value.trim().toLocaleLowerCase();
    const exactMatch = agentOwnedSubscribers.find(
      (sub) => sub.name.trim().toLocaleLowerCase() === normalized
    );

    if (exactMatch) {
      selectAgentRenewalSubscriber(exactMatch);
    } else {
      setSelectedAgentSubscriber(null);
    }
  };

  const handleAgentSubscriberRenewal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAgentSubscriber || !agentRenewalEndDate || agentRenewalPrice <= 0) return;

    const isDebt = agentRenewalPayment === 'debt';
    const renewedSubscriber: Subscriber = {
      ...selectedAgentSubscriber,
      agentId: selectedAgentSubscriber.agentId,
      agentName: selectedAgentSubscriber.agentName,
      subscriptionType: agentRenewalDuration,
      status: 'active',
      paymentStatus: isDebt ? 'debt' : 'paid',
      amount: agentRenewalPrice,
      originalAmount: agentRenewalPrice,
      paidAmount: isDebt ? 0 : agentRenewalPrice,
      settleDate: isDebt ? undefined : agentRenewalStartDate,
      startDate: agentRenewalStartDate,
      endDate: agentRenewalEndDate
    };

    onRenewSubscriber(renewedSubscriber, isDebt, agentRenewalPrice);
    setShowAgentRenewalModal(false);
    setSelectedAgentSubscriber(null);
  };

  const handleSendInactiveRenewalWhatsApp = (sub: Subscriber) => {
    const rawPhone = (sub.phone || '').trim();
    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');

    if (!cleanDigits) {
      showAlert(
        `المشترك "${sub.name}" لا يمتلك رقم هاتف مسجل. يرجى الضغط على زر (تعديل) وإضافة رقم الهاتف أولاً لإرسال رسالة الواتساب.`,
        'لا يوجد رقم هاتف',
        'warning'
      );
      return;
    }

    const message = `مرحباً بك أخي المشترك (${sub.name}) 🌸

نود إعلامك بأن اشتراكك في شبكة الساري للبث الرقمي لجهاز رقم (${sub.deviceId}) غير فعال حالياً 🔴.

✨ هل ترغب في تجديد اشتراكك الآن والاستمتاع بمشاهدة بدون انقطاع؟ 📺
يسرنا تواصلك معنا لتجديد الاشتراك ومواصلة التمتع بأقوى المزايا:
⚽ تغطية كاملة وشاملة لكافة المباريات والبطولات الحصرية بأعلى دقة واستقرار تام وبدون أي تقطيع.
🎬 باقة متكاملة من قنوات الأفلام، المسلسلات، الوثائقيات وبرامج الأطفال لجميع أفراد العائلة بجودة فائقة (FHD).
⚡ تفعيل وتجديد فوري لجهازك دون الحاجة للانتظار.
🛠️ دعم فني مخصص وخدمة سريعة في أي وقت لضمان رضاكم.

إذا كنت ترغب بالتجديد أو الاستفسار عن باقاتنا وعروضنا الخاصة، فقط رد على هذه الرسالة وسنكون بخدمتك فوراً! 🤝

مع تحيات: إدارة المركز الرئيسي - شبكة الساري للبث الرقمي
هاتف الإدارة: 07726218685`;

    const link = storageService.createWhatsAppLink(rawPhone, message);
    window.open(link, '_blank');
  };

  const handleSendOverdueDebtWhatsApp = (sub: Subscriber, debtAmount: number, overdueDays: number) => {
    const rawPhone = (sub.phone || '').trim();
    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');

    if (!cleanDigits) {
      showAlert(
        `المشترك "${sub.name}" لا يمتلك رقم هاتف مسجل. يرجى الضغط على زر (تعديل) وإضافة رقم الهاتف أولاً لإرسال رسالة الواتساب.`,
        'لا يوجد رقم هاتف',
        'warning'
      );
      return;
    }

    const message = `السلام عليكم أخي المشترك الكريم (${sub.name}) 🌸
تحية طيبة من إدارة شبكة الساري للبث الرقمي.

نود تذكيركم بوجود رصيد دين مستحق بذمتكم بمبلغ (${debtAmount.toLocaleString()} د.ع) لجهاز رقم (${sub.deviceId})، والمتأخر منذ ${overdueDays} يوماً ⚠️.

يرجى التفضل بمراجعة الوكيل المسؤول (${sub.agentName || 'المركز الرئيسي'}) أو الاتصال بنا لتسوية الحساب لضمان استمرار الخدمة دون انقطاع.

شاكرين لكم حسن تعاونكم الدائم معنا 🤝.

إدارة شبكة الساري للبث الرقمي
هاتف الإدارة: 07726218685`;

    const link = storageService.createWhatsAppLink(rawPhone, message);
    window.open(link, '_blank');
  };

  // Precomputed debt overdue details map for all subscribers
  const subscriberDebtInfoMap = useMemo(() => {
    const map = new Map<string, SubscriberDebtOverdueInfo>();
    subscribersForView.forEach((sub) => {
      map.set(sub.id, getSubscriberDebtOverdueInfo(sub, invoices, debtThreshold, debtMap));
    });
    return map;
  }, [subscribersForView, invoices, debtThreshold, debtMap]);

  // Filter logic
  const filteredSubscribers = useMemo(() => subscribersForView.filter((sub) => {
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
    if (onlyOverdueDebt) {
      const info = subscriberDebtInfoMap.get(sub.id);
      if (!info?.isOverdue20Days) return false;
    }
    if (onlyHighDebt) {
      const debt = getSubscriberOutstandingDebt(sub, debtMap);
      if (debt < debtThreshold) return false;
    }
    if (agentFilter !== 'all') {
      if (agentFilter === 'agent-main') {
        const isMain = sub.agentId === 'agent-main' || sub.agentName === 'المركز الرئيسي' || !sub.agentId || sub.agentName === 'الأدمن';
        if (!isMain) return false;
      } else {
        const matchAgentId = sub.agentId === agentFilter;
        const targetAgent = agents.find((a) => a.id === agentFilter);
        const matchAgentName = targetAgent && sub.agentName === targetAgent.name;
        if (!matchAgentId && !matchAgentName) return false;
      }
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = sub.name.toLowerCase().includes(term);
      const matchPhone = sub.phone.includes(term);
      const matchDevice = sub.deviceId.includes(term);
      const matchAgent = sub.agentName.toLowerCase().includes(term);
      return matchName || matchPhone || matchDevice || matchAgent;
    }
    return true;
  }), [agentFilter, agents, debtMap, debtThreshold, onlyHighDebt, onlyOverdueDebt, searchTerm, statusFilter, subscriberDebtInfoMap, subscribersForView]);

  const { activeCount, inactiveCount, expiringCount, highDebtCount, overdueDebtCount, totalOverdueDebtAmount } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let expiring = 0;
    let highDebt = 0;
    let overdueDebt = 0;
    let totalOverdue = 0;

    subscribersForView.forEach((sub) => {
      if (sub.status === 'active') active += 1;
      if (sub.status === 'inactive') inactive += 1;
      if (sub.status === 'expiring_soon') expiring += 1;
      const info = subscriberDebtInfoMap.get(sub.id);
      if (info?.isHighDebt) highDebt += 1;
      if (info?.isOverdue20Days) {
        overdueDebt += 1;
        totalOverdue += info.debtAmount;
      }
    });

    return {
      activeCount: active,
      inactiveCount: inactive,
      expiringCount: expiring,
      highDebtCount: highDebt,
      overdueDebtCount: overdueDebt,
      totalOverdueDebtAmount: totalOverdue
    };
  }, [subscribersForView, subscriberDebtInfoMap]);

  const totalSubscribersDebt = useMemo(() => {
    return subscribersForView.reduce((sum, s) => sum + getSubscriberOutstandingDebt(s, debtMap), 0);
  }, [subscribersForView, debtMap]);
  const {
    scrollRef: subscriberTableRef,
    handleScroll: handleSubscriberTableScroll,
    visibleRows: visibleSubscribers,
    topSpacerHeight: subscriberTopSpacerHeight,
    bottomSpacerHeight: subscriberBottomSpacerHeight
  } = useVirtualizedRows(filteredSubscribers, 64);

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubDeviceId.trim()) return;

    const currentAgent = agents.find((a) => a.id === newSubAgentId) || agents[0];
    const rawDev = newSubDeviceId.trim();
    const cleanDeviceId = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';
    const isDeviceSale = newSaleType === 'device';
    const saleAmount = isDeviceSale ? newDevicePrice : calculatedPrice;

    if (saleAmount <= 0) {
      setModalInfo({
        isOpen: true,
        title: 'السعر غير متوفر',
        message: 'يرجى تحديد سعر الجهاز أو الاشتراك للوكيل في صفحة الأسعار قبل تسجيل البيع.',
        type: 'warning'
      });
      return;
    }

    if (!isDeviceSale && !matchedSubscriber) {
      setModalInfo({
        isOpen: true,
        title: 'اختر مشتركاً للتجديد',
        message: 'ابحث عن المشترك واختره من قائمة النتائج قبل تجديد اشتراكه.',
        type: 'warning'
      });
      return;
    }

    if (isDeviceSale) {
      onAddSubscriber(
        {
          name: newSubName.trim(),
          phone: newSubPhone.trim(),
          deviceId: cleanDeviceId,
          agentId: currentAgent.id,
          agentName: currentAgent.name,
          subscriptionType: '-',
          status: 'inactive',
          paymentStatus: newSubPaymentStatus,
          amount: saleAmount,
          startDate: newSaleDate || todayStr,
          endDate: '-',
          address: '',
          notes: newSubNotes.trim()
        },
        true,
        newSubPaymentStatus === 'paid',
        'device'
      );
    } else {
      const startDate = newSubStartDate || todayStr;
      const endDate = newSubEndDate || calculateEndDate(startDate, newSubType);
      const renewedSubscriber: Subscriber = {
        ...matchedSubscriber!,
        name: newSubName.trim(),
        phone: newSubPhone.trim(),
        deviceId: cleanDeviceId,
        subscriptionType: newSubType,
        status: 'active',
        paymentStatus: newSubPaymentStatus,
        amount: saleAmount,
        originalAmount: saleAmount,
        paidAmount: newSubPaymentStatus === 'paid' ? saleAmount : 0,
        settleDate: newSubPaymentStatus === 'paid' ? startDate : undefined,
        startDate,
        endDate,
        notes: newSubNotes.trim() || matchedSubscriber!.notes || ''
      };
      onRenewSubscriber(renewedSubscriber, newSubPaymentStatus === 'debt', saleAmount);
    }

    // Reset
    setNewSubName('');
    setNewSubPhone('');
    setNewSubDeviceId('');
    setNewSubNotes('');
    setMatchedSubscriber(null);
    setShowNameSuggestions(false);
    setNewSaleType('device');
    setNewSaleDate(todayStr);
    setNewSubStartDate(todayStr);
    setNewSubEndDate(calculateEndDate(todayStr, '1 شهر'));
    setShowAddModal(false);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const imported = await excelService.importSubscribersFromExcel(file, agents);
        if (imported.subscribers.length === 0) {
          setModalInfo({ isOpen: true, title: 'تنبيه', message: 'لم يتم العثور على أي بيانات مشتركين صالحة في ملف الإكسل.', type: 'warning' });
          return;
        }

        if (onImportSubscribers) {
          onImportSubscribers(imported);
        } else {
          imported.subscribers.forEach((sub) => {
            onAddSubscriber(sub, false, true);
          });
        }
        setModalInfo({ isOpen: true, title: 'نجاح الاستيراد', message: `تم بنجاح استيراد ${imported.subscribers.length} مشترك وربطهم بوكلائهم بنجاح!`, type: 'success' });
        e.target.value = '';
      } catch (err: any) {
        console.error('Import error:', err);
        setModalInfo({ isOpen: true, title: 'خطأ', message: 'حدث خطأ أثناء استيراد الملف. يرجى التأكد من أن الملف بصيغة إكسل (.xlsx أو .xls) ويحتوي على الأعمدة المطلوبة.', type: 'error' });
      }
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Hero Banner with Live KPIs */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 dark:from-slate-950 dark:via-sky-950/70 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-sky-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                <Users className="w-3.5 h-3.5" />
                دليل وسجل المشتركين
              </span>
              <span className="text-xs font-medium text-slate-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
                {subscribersForView.length} مشترك مسجل
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>سجل المشتركين العام</span>
              <Sparkles className="w-6 h-6 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              إدارة وتوثيق كافة المشتركين في المنظومة، فرز الحالات (فعال / غير فعال / منتهي)، ضبط سقف الديون، والوصول الفوري لرموز الأجهزة QR مع إمكانية التجديد المباشر.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAgentFilter('all');
                setOnlyHighDebt(false);
                setOnlyOverdueDebt(false);
              }}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 flex items-center gap-2 shadow-xs cursor-pointer"
              title="إعادة ضبط كافة الفلاتر وخيارات البحث"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة الضبط</span>
            </button>
          </div>
        </div>

        {/* 4 Quick KPI Summary Cards Inside Hero */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mt-7 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">إجمالي المشتركين</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{subscribersForView.length}</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">الاشتراكات الفعالة</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-300">{activeCount}</span>
                <span className="text-[11px] text-emerald-400/90 font-bold">
                  ({Math.round((activeCount / (subscribersForView.length || 1)) * 100)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <X className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">غير الفعالين</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-rose-300">{inactiveCount}</span>
                <span className="text-[11px] text-rose-400/90 font-bold">
                  ({Math.round((inactiveCount / (subscribersForView.length || 1)) * 100)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl ${overdueDebtCount > 0 ? 'bg-red-500/25 text-red-300 border-red-500/40 ring-1 ring-red-400/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'} flex items-center justify-center shrink-0 border`}>
              {overdueDebtCount > 0 ? (
                <BellRing className="w-5 h-5 text-red-400 animate-bounce" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">ديون معلقة</p>
              <p className="text-lg sm:text-xl font-black text-amber-300 mt-0.5 font-mono">
                {totalSubscribersDebt.toLocaleString()} <span className="text-[10px] text-slate-300 font-sans">د.ع</span>
              </p>
              {overdueDebtCount > 0 && (
                <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-red-200 bg-red-900/60 border border-red-500/40 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>{overdueDebtCount} متأخر (+20 يوم)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Card: Filters & Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-5">
        
        {/* Status Filter Bar */}
        <div className="p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-1">
              <span className="text-amber-500">⚡</span>
              تصنيف حسب حالة الاشتراك:
            </span>

            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              <span>الكل</span>
              <span className="text-[10px] font-mono opacity-80">({subscribersForView.length})</span>
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>فعال</span>
              <span className="text-[10px] font-mono opacity-80">({activeCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>غير فعال</span>
              <span className="text-[10px] font-mono opacity-80">({inactiveCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('expiring_soon')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'expiring_soon'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              <span>⏳</span>
              <span>منتهي قريباً</span>
              <span className="text-[10px] font-mono opacity-80">({expiringCount})</span>
            </button>
          </div>

          {/* Overdue & High Debt Filter Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOnlyOverdueDebt((prev) => !prev)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                onlyOverdueDebt
                  ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-400'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40'
              }`}
              title="تصفية المشتركين الذين لديهم ديون متأخرة تجاوزت 20 يوماً فقط"
            >
              <BellRing className={`w-3.5 h-3.5 ${onlyOverdueDebt ? 'text-white' : 'text-red-600 dark:text-red-400'} animate-bounce`} />
              <span>ديون متأخرة (+20 يوم)</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-black ${
                  onlyOverdueDebt ? 'bg-white/20 text-white' : 'bg-red-200 dark:bg-red-800 text-red-950 dark:text-red-100'
                }`}
              >
                {overdueDebtCount}
              </span>
            </button>

            <button
              onClick={() => setOnlyHighDebt((prev) => !prev)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                onlyHighDebt
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'
              }`}
              title={`تصفية المشتركين الذين تتجاوز ديونهم ${debtThreshold.toLocaleString()} د.ع`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline-block" />
              <span>ديون مرتفعة (≥ {debtThreshold.toLocaleString()} د.ع)</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  onlyHighDebt ? 'bg-white/20 text-white' : 'bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100'
                }`}
              >
                {highDebtCount}
              </span>
            </button>
          </div>
        </div>

        {/* Agent Classification Filter Bar */}
        <div className="p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-1">
            <Users2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            تصنيف حسب الوكيل والمركز:
          </span>

          <button
            onClick={() => setAgentFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              agentFilter === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
            }`}
          >
            <span>كافة الوكلاء والمركز</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              agentFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-150 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {subscribersForView.length}
            </span>
          </button>

          <button
            onClick={() => setAgentFilter('agent-main')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              agentFilter === 'agent-main'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
            }`}
          >
            <span>المركز الرئيسي (الأدمن)</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              agentFilter === 'agent-main' ? 'bg-white/20 text-white' : 'bg-slate-150 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {subscriberCountsByAgent.get('agent-main') || 0}
            </span>
          </button>

          {agents.filter(a => a.id !== 'agent-main').map((ag) => {
            const count = subscriberCountsByAgent.get(ag.id) || 0;
            const isSelected = agentFilter === ag.id;

            return (
              <button
                key={ag.id}
                onClick={() => setAgentFilter(ag.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-300'
                }`}
              >
                <span>{ag.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-150 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Count & Threshold Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث بالاسم، رقم الجهاز، رقم الهاتف، أو اسم الوكيل..."
              className="w-full pr-10 pl-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 text-xs font-medium transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Counter Text */}
            <div className="text-xs text-slate-600 dark:text-slate-400 font-bold px-1">
              عرض <span className="text-slate-900 dark:text-white font-black">{filteredSubscribers.length}</span> من أصل <span className="text-slate-900 dark:text-white font-black">{subscribersForView.length}</span> مشترك
            </div>

            {/* Debt Threshold Selector */}
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
              <span className="font-bold text-slate-700 dark:text-slate-300">سقف تمييز الديون:</span>
              <select
                value={debtThreshold}
                onChange={(e) => setDebtThreshold(Number(e.target.value))}
                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-0.5 text-xs font-black text-rose-600 dark:text-rose-400 focus:outline-hidden focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                <option value={25000}>25,000 د.ع</option>
                <option value={50000}>50,000 د.ع (افتراضي)</option>
                <option value={75000}>75,000 د.ع</option>
                <option value={100000}>100,000 د.ع</option>
                <option value={150000}>150,000 د.ع</option>
              </select>
            </div>
          </div>
        </div>

        {/* Visual Notification Alert Banner for Overdue Debts > 20 Days */}
        {overdueDebtCount > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 dark:from-red-950/40 dark:via-rose-950/30 dark:to-amber-950/20 border-2 border-red-400/60 dark:border-red-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs animate-bounce">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-red-900 dark:text-red-200 flex items-center gap-2">
                  <span>تنبيه ديون متأخرة تجاوزت 20 يوماً:</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-mono font-black">
                    {overdueDebtCount} {overdueDebtCount === 1 ? 'مشترك' : 'مشتركين'}
                  </span>
                </h3>
                <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                  يوجد مشتركون بذمتهم ديون غير مسددة تجاوزت 20 يوماً بإجمالي{' '}
                  <strong className="font-mono text-red-900 dark:text-red-100 font-black">
                    {totalOverdueDebtAmount.toLocaleString()} د.ع
                  </strong>
                  . تم تمييز الصفوف باللون الأحمر وإضافة أيقونة الجرس 🔔 لتنبيه الإدارة ومتابعة التحصيل الفوري.
                </p>
              </div>
            </div>
            <button
              onClick={() => setOnlyOverdueDebt((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 self-end sm:self-center ${
                onlyOverdueDebt
                  ? 'bg-red-700 text-white ring-2 ring-red-400'
                  : 'bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/40'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{onlyOverdueDebt ? 'عرض كافة المشتركين' : 'تصفية المتأخرين فقط'}</span>
            </button>
          </div>
        )}

        {/* Table Container */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden bg-white dark:bg-slate-900">
          <div
            ref={subscriberTableRef}
            onScroll={handleSubscriberTableScroll}
            className="max-h-[70vh] overflow-auto"
          >
            <table className="w-full text-right text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-4 font-black tracking-wide">المشترك / الهاتف</th>
                  <th className="py-3.5 px-3 font-black tracking-wide">رقم الجهاز والـ QR</th>
                  <th className="py-3.5 px-3 font-black tracking-wide">الوكيل المسؤول</th>
                  <th className="py-3.5 px-3 font-black tracking-wide text-center">الحالة والتنبيهات</th>
                  <th className="py-3.5 px-4 font-black tracking-wide text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-4 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <Users2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                          لا توجد نتائج مطابقة
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          لم يتم العثور على مشتركين يطابقون خيارات البحث أو التصفية الحالية.
                        </p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setStatusFilter('all');
                            setAgentFilter('all');
                            setOnlyHighDebt(false);
                            setOnlyOverdueDebt(false);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
                        >
                          إعادة ضبط خيارات البحث
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {subscriberTopSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={5} style={{ height: subscriberTopSpacerHeight, padding: 0, border: 0 }} />
                      </tr>
                    )}
                    {visibleSubscribers.map((sub) => {
                      const isActive = sub.status === 'active';
                      const isMainCenterSub = sub.agentName === 'المركز الرئيسي' || sub.agentId === 'agent-main';
                      const info = subscriberDebtInfoMap.get(sub.id) || getSubscriberDebtOverdueInfo(sub, invoices, debtThreshold, debtMap);
                      const isOverdue20Days = info.isOverdue20Days;
                      const overdueDays = info.overdueDays;
                      const subDebt = info.debtAmount;
                      const isHighDebt = info.isHighDebt;

                      return (
                        <tr
                          key={sub.id}
                          className={`h-16 transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${
                            isOverdue20Days
                              ? 'bg-red-50/90 dark:bg-red-950/40 hover:bg-red-100/90 dark:hover:bg-red-950/60 border-r-4 border-r-red-600 dark:border-r-red-500 shadow-2xs'
                              : isHighDebt
                              ? 'bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/30 border-r-4 border-r-rose-500'
                              : isActive
                              ? 'hover:bg-emerald-50/30 dark:hover:bg-slate-850/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'
                          }`}
                        >
                          {/* Subscriber Avatar & Name & Phone */}
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <div className={`w-9 h-9 rounded-xl ${
                                  isOverdue20Days
                                    ? 'bg-gradient-to-tr from-red-600 to-rose-700 ring-2 ring-red-400 shadow-xs'
                                    : 'bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-xs'
                                } text-white font-black text-xs flex items-center justify-center`}>
                                  {sub.name ? sub.name.trim().charAt(0) : 'م'}
                                </div>
                                {isOverdue20Days && (
                                  <span
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900 animate-bounce"
                                    title={`تنبيه حرج: دين متأخر تجاوز 20 يوماً (${overdueDays} يوماً)`}
                                  >
                                    <BellRing className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`font-bold text-sm ${isOverdue20Days ? 'text-red-950 dark:text-red-100' : 'text-slate-900 dark:text-slate-100'}`}>
                                    {sub.name}
                                  </span>
                                  {isOverdue20Days && (
                                    <span
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700 text-[10px] font-black tracking-tight shrink-0 shadow-2xs animate-pulse"
                                      title={`دين متأخر منذ ${overdueDays} يوماً (المبلغ المستحق: ${subDebt.toLocaleString()} د.ع)`}
                                    >
                                      <BellRing className="w-3 h-3 text-red-600 dark:text-red-400" />
                                      <span>متأخر {overdueDays} يوم ({subDebt.toLocaleString()} د.ع)</span>
                                    </span>
                                  )}
                                  {!isOverdue20Days && isHighDebt && (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[10px] font-black tracking-tight shrink-0 shadow-2xs"
                                      title={`تجاوز سقف الدين (${debtThreshold.toLocaleString()} د.ع)`}
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                      <span>دين: {subDebt.toLocaleString()} د.ع</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  {sub.phone ? (
                                    <>
                                      <Phone className="w-2.5 h-2.5 opacity-70" />
                                      <span>{sub.phone}</span>
                                    </>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Device ID (Clicking anywhere on deviceId opens QR Code Modal) & Fast Renewal */}
                          <td className="py-3 px-3 font-mono">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => onSelectDeviceQr(sub.deviceId, sub.name, sub.agentName)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-xs font-bold transition-all border border-slate-200/80 dark:border-slate-700 cursor-pointer"
                                title="اضغط لعرض وتكبير رمز QR للجهاز"
                              >
                                <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 opacity-80" />
                                <span>{sub.deviceId}</span>
                              </button>

                              {!isActive && (
                                <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700 pr-3">
                                  <button
                                    onClick={() => setRenewingSubscriber(sub)}
                                    className="px-2.5 py-1 bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-900/60 rounded-lg text-[10px] font-black transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap border border-sky-200 dark:border-sky-800/50"
                                    title="تجديد من المركز الرئيسي"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>تجديد للرئيسية</span>
                                  </button>
                                  {!isMainCenterSub && (
                                    <button
                                      onClick={() => {
                                        selectAgentRenewalSubscriber(sub);
                                        setShowAgentRenewalModal(true);
                                      }}
                                      className="px-2.5 py-1 bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/60 rounded-lg text-[10px] font-black transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap border border-teal-200 dark:border-teal-800/50"
                                      title="تجديد للوكيل التابع له"
                                    >
                                      <UserCheck className="w-2.5 h-2.5" />
                                      <span>تجديد للوكيل</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Responsible Agent */}
                          <td className="py-3 px-3">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                              !sub.agentId || sub.agentId === 'agent-main' || sub.agentName === 'المركز الرئيسي'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50'
                            }`}>
                              {sub.agentName || 'المركز الرئيسي'}
                            </span>
                          </td>

                          {/* Status & Alerts Column */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive 
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                {isActive ? 'فعال' : 'غير فعال'}
                              </span>
                              {isOverdue20Days ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white shadow-xs animate-pulse"
                                  title={`دين متأخر تجاوز 20 يوماً (${overdueDays} يوم)`}
                                >
                                  <Bell className="w-2.5 h-2.5" />
                                  <span>متأخر {overdueDays} يوم</span>
                                </span>
                              ) : isHighDebt ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  <span>مطلوب</span>
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Actions: History, Edit, WhatsApp, Deactivate (X), Delete */}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* WhatsApp Reminder for Overdue Debt */}
                              {isOverdue20Days && (
                                <button
                                  type="button"
                                  onClick={() => handleSendOverdueDebtWhatsApp(sub, subDebt, overdueDays)}
                                  className="p-2 rounded-xl text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors border border-red-300 dark:border-red-800 cursor-pointer"
                                  title={`إرسال تذكير بالدين المتأخر (${overdueDays} يوم) عبر واتساب`}
                                  aria-label={`إرسال تذكير بالدين المتأخر عبر واتساب لـ ${sub.name}`}
                                >
                                  <BellRing className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                              )}

                              {isAdmin && (
                                <button
                                  onClick={() => setHistorySubscriber(sub)}
                                  className="p-2 rounded-xl text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors border border-sky-100 dark:border-sky-800 cursor-pointer"
                                  title="السجل المالي للمشترك"
                                  aria-label={`السجل المالي للمشترك ${sub.name}`}
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              )}

                              {/* Edit */}
                              <button
                                onClick={() => setEditingSubscriber(sub)}
                                className="p-2 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors border border-amber-100 dark:border-amber-800 cursor-pointer"
                                title="تعديل بيانات المشترك"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* WhatsApp Button: Appears only for inactive subscribers adjacent to Edit */}
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleSendInactiveRenewalWhatsApp(sub)}
                                  className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors border border-emerald-100 dark:border-emerald-800 cursor-pointer"
                                  title="إرسال رسالة تشجيع وعرض تجديد عبر واتساب"
                                  aria-label={`إرسال رسالة تشجيع وتجديد عبر واتساب لـ ${sub.name}`}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              )}

                              {/* Deactivate Button (X): Appears only for active subscribers */}
                              {isActive && (
                                <button
                                  onClick={() => setDeactivatingSubscriber(sub)}
                                  className="p-2 rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors border border-red-100 dark:border-red-800 cursor-pointer"
                                  title="إلغاء تفعيل الاشتراك وتفريغ البيانات"
                                >
                                  <X className="w-4 h-4 stroke-[3]" />
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => setDeletingSubscriber(sub)}
                                className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/40 cursor-pointer"
                                title="حذف المشترك نهائياً"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {subscriberBottomSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={5} style={{ height: subscriberBottomSpacerHeight, padding: 0, border: 0 }} />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Legend */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>دليل التنبيهات المرئية:</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                <span className="font-bold text-red-700 dark:text-red-300 flex items-center gap-1">
                  <BellRing className="w-3 h-3 text-red-600" />
                  صف أحمر + جرس: دين متأخر تجاوز 20 يوماً
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                <span className="font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  صف وردي: تجاوز سقف المديونية ({debtThreshold.toLocaleString()} د.ع)
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">اشتراك فعال مسدد</span>
              </span>
            </div>
            {overdueDebtCount > 0 && (
              <span className="font-mono font-bold text-red-600 dark:text-red-400">
                إجمالي ديون متأخرة (+20 يوم): {totalOverdueDebtAmount.toLocaleString()} د.ع
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Subscriber Management Actions Toolbar at the bottom */}
      <div dir="rtl" className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => setShowDeleteAllModal(true)}
          className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          title="حذف جميع المشتركين نهائياً (تصفير شامل)"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>حذف جميع المشتركين</span>
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label
            className="cursor-pointer px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all"
            title="استيراد قائمة المشتركين من ملف Excel"
          >
            <Upload className="w-4 h-4" />
            <span>استيراد مشتركين</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
          </label>

          <button
            onClick={() => {
              const filterTag = agentFilter !== 'all' || statusFilter !== 'all' || searchTerm ? '_المفلترة' : '';
              const dateStr = new Date().toISOString().split('T')[0];
              excelService.exportSubscribers(
                filteredSubscribers,
                `قائمة_المشتركين${filterTag}_${dateStr}.xlsx`
              );
            }}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            title="تصدير قائمة المشتركين المعروضة حالياً إلى ملف إكسل منسق"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>تصدير قائمة المشتركين (Excel)</span>
          </button>
        </div>
      </div>

      {historySubscriber && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscriber-financial-history-title"
            className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
              <div>
                <h3 id="subscriber-financial-history-title" className="font-black text-slate-900 dark:text-white">السجل المالي للمشترك</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{historySubscriber.name} · الجهاز {historySubscriber.deviceId}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistorySubscriber(null)}
                className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="إغلاق سجل المشترك"
              >
                إغلاق
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto p-5">
              {subscriberInvoiceHistory.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">لا توجد معاملات مالية مسجلة لهذا المشترك.</p>
              ) : (
                <div className="space-y-3">
                  {subscriberInvoiceHistory.map((invoice) => (
                    <article key={invoice.id} className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-700 dark:bg-slate-800/60 sm:grid-cols-2 lg:grid-cols-4">
                      <div><span className="text-slate-500 dark:text-slate-400">رقم الفاتورة: </span><strong className="font-mono text-slate-900 dark:text-slate-100">{invoice.invoiceNumber}</strong></div>
                      <div><span className="text-slate-500 dark:text-slate-400">المعاملة: </span><strong className="text-slate-900 dark:text-slate-100">{invoice.packageType}</strong></div>
                      <div><span className="text-slate-500 dark:text-slate-400">التاريخ: </span><strong className="font-mono text-slate-900 dark:text-slate-100">{invoice.date}</strong></div>
                      <div><span className="text-slate-500 dark:text-slate-400">طريقة الدفع: </span><strong className="text-slate-900 dark:text-slate-100">{invoice.paymentStatus === 'paid' ? 'نقد' : invoice.paymentStatus === 'partial' ? 'دفع جزئي' : 'دين'}</strong></div>
                      <div><span className="text-slate-500 dark:text-slate-400">المبلغ: </span><strong className="font-mono text-slate-900 dark:text-slate-100">{invoice.amount.toLocaleString()} د.ع</strong></div>
                      <div><span className="text-slate-500 dark:text-slate-400">المسدد: </span><strong className="font-mono text-emerald-700 dark:text-emerald-300">{(invoice.paidAmount || 0).toLocaleString()} د.ع</strong></div>
                      <div><span className="text-slate-500 dark:text-slate-400">المتبقي: </span><strong className="font-mono text-red-700 dark:text-red-300">{(invoice.remainingAmount || 0).toLocaleString()} د.ع</strong></div>
                      <div><span className="text-slate-500 dark:text-slate-400">الوكيل: </span><strong className="text-slate-900 dark:text-slate-100">{invoice.agentName}</strong></div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}


      {showAgentRenewalModal && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1000] animate-in fade-in"
          dir="rtl"
          onClick={() => setShowAgentRenewalModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-subscriber-renewal-title"
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                <RefreshCw className="w-5 h-5" />
                <h3 id="agent-subscriber-renewal-title" className="font-extrabold text-lg text-slate-900 dark:text-white">
                  تجديد اشتراك للوكيل ({selectedAgentSubscriber?.agentName || 'بحث عن مشترك...'})
                </h3>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setShowAgentRenewalModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAgentSubscriberRenewal} className="mt-5 space-y-4 text-sm">
              <div className="relative">
                <label htmlFor="agent-renewal-customer-name" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الزبون *
                </label>
                <input
                  id="agent-renewal-customer-name"
                  type="text"
                  required
                  autoComplete="off"
                  value={agentRenewalCustomerName}
                  onChange={(event) => handleAgentRenewalCustomerNameChange(event.target.value)}
                  onFocus={() => {
                    if (agentRenewalCustomerName.trim()) setShowAgentRenewalSuggestions(true);
                  }}
                  placeholder="اكتب اسم المشترك للبحث"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
                />

                {showAgentRenewalSuggestions && agentRenewalCustomerName.trim() && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {agentOwnedSubscribers
                      .filter((subscriber) => subscriber.name.toLocaleLowerCase().includes(agentRenewalCustomerName.trim().toLocaleLowerCase()))
                      .slice(0, 8)
                      .map((subscriber) => (
                        <button
                          key={subscriber.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectAgentRenewalSubscriber(subscriber)}
                          className="w-full px-3 py-2.5 text-right hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span className="block font-bold text-slate-800 dark:text-slate-200">{subscriber.name}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            الوكيل: {subscriber.agentName} · الجهاز: {subscriber.deviceId}
                          </span>
                        </button>
                      ))}
                    {agentOwnedSubscribers.every((subscriber) => !subscriber.name.toLocaleLowerCase().includes(agentRenewalCustomerName.trim().toLocaleLowerCase())) && (
                      <div className="px-3 py-3 text-xs text-slate-500">لم يتم العثور على مشترك تابع لوكيل بهذا الاسم.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المالك / الوكيل</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedAgentSubscriber?.agentName || ''}
                    placeholder="يظهر بعد اختيار المشترك"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الجهاز</label>
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    value={selectedAgentSubscriber?.deviceId || ''}
                    placeholder="—"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-left font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    value={selectedAgentSubscriber?.phone || ''}
                    placeholder="—"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-left font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المبلغ / السعر (د.ع)</label>
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    value={selectedAgentSubscriber && agentRenewalPrice > 0 ? agentRenewalPrice.toLocaleString('en-US') : ''}
                    placeholder={selectedAgentSubscriber ? 'لا يوجد سعر لهذه المدة في أسعار الوكيل' : 'يُحسب بعد اختيار المشترك'}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-left font-mono font-bold text-slate-700 dark:text-slate-300"
                  />
                  {selectedAgentSubscriber && agentRenewalPrice <= 0 && (
                    <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                      لا يوجد سعر معتمد لهذه المدة لدى وكيل المشترك. حدّث سعر الوكيل من صفحة الأسعار.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-renewal-duration" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نوع الاشتراك *</label>
                  <select
                    id="agent-renewal-duration"
                    value={agentRenewalDuration}
                    onChange={(event) => {
                      const duration = event.target.value as SubscriptionDuration;
                      setAgentRenewalDuration(duration);
                      setAgentRenewalEndDate(calculateEndDate(agentRenewalStartDate, duration));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="1 شهر">شهر</option>
                    <option value="شهرين">شهرين</option>
                    <option value="3 أشهر">3 أشهر</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="agent-renewal-payment" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع *</label>
                  <select
                    id="agent-renewal-payment"
                    value={agentRenewalPayment}
                    onChange={(event) => setAgentRenewalPayment(event.target.value as 'paid' | 'debt')}
                    className={`w-full px-3 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-900 font-bold transition-colors focus:ring-2 ${
                      agentRenewalPayment === 'paid'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500'
                        : 'border-red-500 text-red-600 dark:text-red-400 focus:ring-red-500'
                    }`}
                  >
                    <option value="paid" className="text-emerald-600 dark:text-emerald-400 font-bold">نقدي — مدفوع</option>
                    <option value="debt" className="text-red-600 dark:text-red-400 font-bold">دين — يسجل كمستحق</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-renewal-start-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ البدء *</label>
                  <input
                    id="agent-renewal-start-date"
                    type="date"
                    required
                    value={agentRenewalStartDate}
                    onChange={(event) => {
                      const startDate = event.target.value;
                      setAgentRenewalStartDate(startDate);
                      setAgentRenewalEndDate(calculateEndDate(startDate, agentRenewalDuration));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الانتهاء (يُحسب تلقائيًا)</label>
                  <input
                    type="date"
                    readOnly
                    value={agentRenewalEndDate}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAgentRenewalModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!selectedAgentSubscriber || !agentRenewalEndDate || agentRenewalPrice <= 0}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold shadow-sm active:scale-95 transition-all"
                >
                  حفظ وتفعيل الاشتراك
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: New Sale / Subscriber */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {newSaleType === 'device' ? 'بيع جهاز جديد' : 'تجديد اشتراك'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSale} className="mt-4 space-y-4 text-xs">
              <div>
                <label htmlFor="new-sale-type" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نوع البيع *
                </label>
                <select
                  id="new-sale-type"
                  value={newSaleType}
                  onChange={(event) => setNewSaleType(event.target.value as 'renewal' | 'device')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 text-sm font-semibold"
                >
                  <option value="renewal">تجديد اشتراك</option>
                  <option value="device">جهاز جديد</option>
                </select>
              </div>

              <div className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المشترك بالكامل *
                </label>
                <input
                  type="text"
                  required
                  value={newSubName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => {
                    if (newSubName.trim()) setShowNameSuggestions(true);
                  }}
                  placeholder="مثال: أحمد عبد الله الجبوري"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 text-sm"
                  autoComplete="off"
                />

                {/* Auto-suggestions list for existing subscribers */}
                {showNameSuggestions && newSubName.trim().length > 0 && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {subscribersForView
                      .filter((s) => s.name.toLowerCase().includes(newSubName.toLowerCase()))
                      .slice(0, 5)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectExistingSubscriber(s)}
                          className="w-full px-3 py-2 text-right hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{s.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              جهاز: {s.deviceId} • وكيل: {s.agentName}
                            </span>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300 font-mono">
                            {s.subscriptionType}
                          </span>
                        </button>
                      ))}
                  </div>
                )}

                {matchedSubscriber && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>تم التعرف على المشترك وجلب الوكيل ({matchedSubscriber.agentName}) والمبلغ المعتمد تلقائياً</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف (واتساب) *</label>
                  <input
                    type="tel"
                    required
                    value={newSubPhone}
                    onChange={(e) => setNewSubPhone(e.target.value)}
                    placeholder="0770xxxxxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 text-sm font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">رقم الجهاز / السيريال *</label>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={newSubDeviceId}
                      onChange={(e) => setNewSubDeviceId(e.target.value)}
                      onBlur={() => {
                        const trimmed = newSubDeviceId.trim();
                        if (trimmed && !trimmed.startsWith('00')) {
                          setNewSubDeviceId('00' + trimmed);
                        }
                      }}
                      placeholder="مثال: 00217875"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const currentAgent = agents.find((a) => a.id === newSubAgentId) || agents[0];
                        if (onSelectDeviceQr && newSubDeviceId.trim()) {
                          onSelectDeviceQr(newSubDeviceId, newSubName || 'مشترك جديد', currentAgent.name);
                        } else {
                          showAlert('يرجى إدخال رقم الجهاز أولاً', 'رقم الجهاز مطلوب');
                        }
                      }}
                      className="absolute left-2.5 p-1 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="عرض أو طباعة QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الوكيل المسؤول / المركز الرئيسي</label>
                  <select
                    value={newSubAgentId}
                    onChange={(e) => setNewSubAgentId(e.target.value)}
                    disabled={newSaleType === 'renewal' && Boolean(matchedSubscriber)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-sky-500 text-xs font-semibold"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.id === 'agent-main' ? 'المركز الرئيسي' : ag.name}
                      </option>
                    ))}
                  </select>
                </div>

                {newSaleType === 'renewal' && <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">مدة الاشتراك</label>
                  <select
                    value={newSubType}
                    onChange={(e) => handleDurationChange(e.target.value as SubscriptionDuration)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 text-xs font-semibold"
                  >
                    <option value="1 شهر">1 شهر (30 يوماً)</option>
                    <option value="شهرين">شهرين (60 يوماً)</option>
                    <option value="3 أشهر">3 أشهر (90 يوماً)</option>
                  </select>
                </div>}
              </div>

              {newSaleType === 'renewal' && <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300">
                    <Calendar className="w-4 h-4 text-sky-600" />
                      <span>تواريخ الاشتراك (تُحسب تلقائياً حسب مدة الاشتراك)</span>
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-900 dark:text-sky-300 font-mono font-bold">
                    {newSubType}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-[11px]">
                      تاريخ بدء الاشتراك *
                    </label>
                    <input
                      type="date"
                      required
                      value={newSubStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-[11px]">
                      تاريخ انتهاء الاشتراك *
                    </label>
                    <input
                      type="date"
                      required
                      value={newSubEndDate}
                      onChange={(e) => setNewSubEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              </div>}

              {newSaleType === 'device' && (
                <div>
                  <label htmlFor="new-device-sale-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاريخ البيع *
                  </label>
                  <input
                    id="new-device-sale-date"
                    type="date"
                    required
                    value={newSaleDate}
                    onChange={(event) => setNewSaleDate(event.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              {/* Price is sourced from the assigned agent's pricing row. */}
              <div className="p-3.5 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-slate-800 dark:to-sky-950/50 border border-sky-200 dark:border-sky-800/80 rounded-2xl flex items-center justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sky-950 dark:text-sky-200 text-xs">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{newSaleType === 'device' ? 'المبلغ المعتمد للجهاز:' : 'المبلغ المعتمد للاشتراك:'}</span>
                  </div>
                  <div className="text-[11px] text-sky-700 dark:text-sky-400 mt-0.5">
                    الجهة المحددة: <span className="font-bold text-sky-900 dark:text-sky-200">{selectedAgent?.id === 'agent-main' ? 'المركز الرئيسي' : selectedAgent?.name}</span>
                    {newSaleType === 'renewal' && <> • الباقة: <span className="font-bold text-sky-900 dark:text-sky-200">{newSubType}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    aria-label="المبلغ"
                    dir="ltr"
                    value={(newSaleType === 'device' ? newDevicePrice : calculatedPrice).toLocaleString('en-US')}
                    className="w-36 px-3 py-2 rounded-xl border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900 text-left text-lg font-black font-mono text-sky-950 dark:text-sky-100"
                  />
                  <span className="text-xs font-normal text-sky-700 dark:text-sky-300">د.ع</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">طريقة السداد *</label>
                <select
                  value={newSubPaymentStatus}
                  onChange={(e) => setNewSubPaymentStatus(e.target.value as 'paid' | 'debt')}
                  className={`w-full px-3 py-2 rounded-xl border-2 bg-white dark:bg-slate-800 font-bold focus:ring-2 ${
                    newSubPaymentStatus === 'paid'
                      ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 focus:ring-emerald-500'
                      : 'border-red-400 text-red-600 dark:text-red-300 focus:ring-red-500'
                  }`}
                >
                  <option value="paid" className="text-emerald-700 font-bold">نقد (مسدد نقدياً)</option>
                  <option value="debt" className="text-red-600 font-bold">دين (تسجيل كـ دين)</option>
                </select>
              </div>

              {/* Note: Region field has been hidden as requested */}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  value={newSubNotes}
                  onChange={(e) => setNewSubNotes(e.target.value)}
                  placeholder="أي ملاحظات حول التثبيت أو رقم الجهاز أو طريقة الدفع..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={(newSaleType === 'device' ? newDevicePrice : calculatedPrice) <= 0 || (newSaleType === 'renewal' && !matchedSubscriber)}
                  className="px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold shadow-sm active:scale-95 transition-all"
                >
                  {newSaleType === 'device' ? 'حفظ وتسجيل بيع الجهاز' : 'حفظ وتفعيل الاشتراك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Renew Subscription matching Screenshot 3 */}
      {renewingSubscriber && (
        <RenewSubscriptionModal
          subscriber={renewingSubscriber}
          agents={agents}
          pricing={pricing}
          onClose={() => setRenewingSubscriber(null)}
          onSaveAndActivate={(updated, isDebt, amount) => {
            onRenewSubscriber(updated, isDebt, amount);
            setRenewingSubscriber(null);
          }}
          onWhatsApp={(sub) => onOpenWhatsApp(sub)}
          forceMainCenter={true}
        />
      )}

      {/* Modal: Deactivate Confirmation matching Screenshot 4 */}
      {deactivatingSubscriber && (
        <DeactivateSubscriberModal
          subscriber={deactivatingSubscriber}
          onClose={() => setDeactivatingSubscriber(null)}
          onConfirmDeactivate={(id) => {
            onDeactivateSubscriber(id);
            setDeactivatingSubscriber(null);
          }}
        />
      )}

      {/* Modal: Edit Subscriber Info */}
      {editingSubscriber && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">تعديل بيانات المشترك</h3>
              <button
                onClick={() => setEditingSubscriber(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المشترك</label>
                <input
                  type="text"
                  value={editingSubscriber.name}
                  onChange={(e) => setEditingSubscriber({ ...editingSubscriber, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={editingSubscriber.phone}
                  onChange={(e) => setEditingSubscriber({ ...editingSubscriber, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">رقم الجهاز *</label>
                  <button
                    type="button"
                    onClick={() => onSelectDeviceQr(editingSubscriber.deviceId, editingSubscriber.name, editingSubscriber.agentName)}
                    className="text-[11px] text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>عرض QR كود كامل</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editingSubscriber.deviceId}
                  onChange={(e) => setEditingSubscriber({ ...editingSubscriber, deviceId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-sky-500 font-bold"
                />

                {/* QR Code preview box */}
                <div className="mt-2.5 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">رمز الاستجابة السريعة (QR Code)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">يمثل رمز الجهاز المعتمد في المنظومة</span>
                  </div>
                  <div className="p-1.5 bg-white rounded-xl shadow-xs border border-slate-200 dark:border-slate-700">
                    <QRCodeSVG
                      value={editingSubscriber.deviceId}
                      size={64}
                      level="M"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المالك / الوكيل *</label>
                <select
                  value={editingSubscriber.agentId}
                  onChange={(e) => {
                    const selectedAgent = agents.find(a => a.id === e.target.value);
                    setEditingSubscriber({ 
                      ...editingSubscriber, 
                      agentId: e.target.value,
                      agentName: selectedAgent?.name || 'المركز الرئيسي'
                    });
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                >
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العنوان / المنطقة</label>
                <input
                  type="text"
                  value={editingSubscriber.address || ''}
                  onChange={(e) => setEditingSubscriber({ ...editingSubscriber, address: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSubscriber(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rawDev = editingSubscriber.deviceId.trim();
                    const cleanDev = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';
                    onUpdateSubscriber({ ...editingSubscriber, deviceId: cleanDev });
                    setEditingSubscriber(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold shadow-xs active:scale-95 transition-all"
                >
                  حفظ التعديلات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Delete Subscriber Confirmation */}
      {deletingSubscriber && (
        <DeleteSubscriberModal
          subscriber={deletingSubscriber}
          onClose={() => setDeletingSubscriber(null)}
          onConfirmDelete={(id) => {
            onDeleteSubscriber(id);
            setDeletingSubscriber(null);
          }}
        />
      )}

      {/* Modal: Delete All Subscribers Confirmation */}
      {showDeleteAllModal && (
        <DeleteAllSubscribersModal
          subscribersCount={subscribersForView.length}
          onClose={() => setShowDeleteAllModal(false)}
          onConfirmDeleteAll={async () => {
            if (onDeleteAllSubscribersHandler) {
              await onDeleteAllSubscribersHandler();
            }
            setShowDeleteAllModal(false);
          }}
        />
      )}

      {/* Modal: Info / Warning Notification Modal */}
      <CustomModal
        isOpen={modalInfo.isOpen}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type || 'info'}
        onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}
      />
    </div>
  );
};

export const SubscribersView = React.memo(SubscribersViewComponent);

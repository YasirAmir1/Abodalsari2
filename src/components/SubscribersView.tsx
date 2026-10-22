import React, { useMemo, useState } from 'react';
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
  History
} from 'lucide-react';
import { Agent, Invoice, PricingRow, Subscriber, SubscriptionDuration } from '../types';
import { excelService } from '../services/excelService';
import { getPriceByDuration } from '../utils/pricingUtils';
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
      agent.id === selectedAgentSubscriber.agentId && agent.id !== 'agent-main'
    ) || agents.find((agent) =>
      agent.id !== 'agent-main' &&
      subscriberAgentName &&
      agent.name.trim().toLocaleLowerCase() === subscriberAgentName
    );
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

  // Filter logic
  const filteredSubscribers = useMemo(() => subscribersForView.filter((sub) => {
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
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
  }), [agentFilter, agents, isAdmin, searchTerm, statusFilter, subscribersForView]);

  const { activeCount, inactiveCount, expiringCount } = useMemo(() => subscribersForView.reduce((counts, subscriber) => {
    if (subscriber.status === 'active') counts.activeCount += 1;
    if (subscriber.status === 'inactive') counts.inactiveCount += 1;
    if (subscriber.status === 'expiring_soon') counts.expiringCount += 1;
    return counts;
  }, { activeCount: 0, inactiveCount: 0, expiringCount: 0 }), [subscribersForView]);
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
    <div className="space-y-4">
      {/* Top Filter and Action Bar matching Screenshot 2 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <span className="text-amber-500">⚡</span>
            تصنيف حسب حالة الاشتراك:
          </span>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>الكل</span>
            <span className="text-[10px] opacity-80">{subscribersForView.length}</span>
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>فعال</span>
            <span className="text-[10px] opacity-80">{activeCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'inactive'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span>غير فعال</span>
            <span className="text-[10px] opacity-80">{inactiveCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('expiring_soon')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'expiring_soon'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span>⏳</span>
            <span>منتهي قريباً</span>
            <span className="text-[10px] opacity-80">{expiringCount}</span>
          </button>
        </div>

        {/* New sale action */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openNewSaleModal}
            className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>بيع جهاز جديد</span>
          </button>
          <button
            onClick={openAgentRenewalModal}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تجديد اشتراك مشتركين الوكيل</span>
          </button>
        </div>
      </div>

      {/* Agent Classification Filter Bar below Status Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-1">
          <span className="w-2 h-2 rounded-full bg-sky-600" />
          تصنيف بأسماء الوكلاء والرئيسية:
        </span>

        <button
          onClick={() => setAgentFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
            agentFilter === 'all'
              ? 'bg-sky-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span>كافة الوكلاء والمركز</span>
          <span className="text-[10px] opacity-80 font-mono">({subscribersForView.length})</span>
        </button>

        <button
          onClick={() => setAgentFilter('agent-main')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
            agentFilter === 'agent-main'
              ? 'bg-sky-800 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>المركز الرئيسي (الأدمن)</span>
        </button>

        {agents.map((ag) => {
          const count = subscriberCountsByAgent.get(ag.id) || 0;
          const isSelected = agentFilter === ag.id;

          return (
            <button
              key={ag.id}
              onClick={() => setAgentFilter(ag.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-sky-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{ag.name}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub Header: Counter & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          <div className="text-xs text-slate-500 font-bold">
            عرض {filteredSubscribers.length} من إجمالي {subscribersForView.length} مشترك
          </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Agent Filter Dropdown */}
          {!isAdmin && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            >
              <option value="all">كافة الوكلاء والمركز</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name}
                </option>
              ))}
            </select>
          )}

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم، رقم الجهاز، الهاتف..."
              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Table Matching Screenshot 2 Exactly */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div
          ref={subscriberTableRef}
          onScroll={handleSubscriberTableScroll}
          className="max-h-[70vh] overflow-auto"
        >
          <table className="w-full text-right text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">المشترك / الهاتف</th>
                <th className="py-3 px-3">رقم الجهاز</th>
                <th className="py-3 px-3">الوكيل المسؤول</th>
                <th className="py-3 px-3">نوع الاشتراك ℹ️</th>
                <th className="py-3 px-3">الحالة والدفع</th>
                <th className="py-3 px-3">المبلغ ℹ️</th>
                <th className="py-3 px-3">تاريخ البدء/الانتهاء</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriberTopSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={8} style={{ height: subscriberTopSpacerHeight, padding: 0, border: 0 }} />
                </tr>
              )}
              {visibleSubscribers.map((sub) => {
                const isActive = sub.status === 'active';
                const isMainCenterSub = sub.agentName === 'المركز الرئيسي' || sub.agentId === 'agent-main';

                // RULES FROM USER REQUEST:
                // 1. "زر تجديد يظهر لمشتركين الرئيسية فقط ويختفي من مشتركين الوكلاء في صفحة المشتركين للرئيسية"
                // 2. "يختفي زر تجديد من المشتركين الحالتهم فعال"
                // 3. "زر تجديد لا يظهر للزبون الغير فعال" -> only shows when sub belongs to main center and is inactive
                const canShowRenewButton = isMainCenterSub && !isActive;

                return (
                  <tr
                    key={sub.id}
                    className={`h-16 hover:bg-slate-50/80 transition-colors ${
                      isActive ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    {/* Subscriber Name & Phone */}
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {isActive && <span className="w-1.5 h-6 bg-emerald-500 rounded-full shrink-0" />}
                        <div>
                          <div className="font-bold text-slate-900 text-[13px]">{sub.name}</div>
                          <div className="text-[11px] text-slate-400">{sub.phone || '-'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Device ID (Clicking anywhere on deviceId opens QR Code Modal!) + Green Renew Button */}
                    <td className="py-3 px-3 font-mono">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectDeviceQr(sub.deviceId, sub.name, sub.agentName)}
                          className="text-sky-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                          title="اضغط لعرض رمز QR للجهاز"
                        >
                          <QrCode className="w-3.5 h-3.5 text-sky-600 opacity-70" />
                          <span>{sub.deviceId}</span>
                        </button>

                        {/* Renew button matching user request conditions */}
                        {canShowRenewButton && (
                          <button
                            onClick={() => setRenewingSubscriber(sub)}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            title="تجديد الاشتراك"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>تجديد</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Responsible Agent */}
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                        {sub.agentName}
                      </span>
                    </td>

                    {/* Subscription Type */}
                    <td className="py-3 px-3">
                      {sub.amount > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 font-bold flex items-center gap-1 w-fit">
                          <span>{sub.subscriptionType}</span>
                          <span>📅</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Status & Payment */}
                    <td className="py-3 px-3">
                      {isActive ? (
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] w-fit">
                            فعال
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                              sub.paymentStatus === 'debt'
                                ? 'bg-red-100 text-red-700'
                                : sub.paymentStatus === 'partial'
                                  ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {sub.paymentStatus === 'debt' ? 'دين' : sub.paymentStatus === 'partial' ? 'دفع جزئي' : 'مسدد'}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px]">
                          غير فعال
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3">
                      {sub.amount > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold text-xs border border-red-200">
                          {sub.amount.toLocaleString()} د.ع
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Dates */}
                    <td className="py-3 px-3 text-[11px] text-slate-600">
                      {isActive ? (
                        <div>
                          <div>بدء: {sub.startDate}</div>
                          <div className="text-slate-500 font-semibold">انتهاء: {sub.endDate}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Actions: Edit, Deactivate (X), Delete */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {isAdmin && (
                          <button
                            onClick={() => setHistorySubscriber(sub)}
                            className="p-1.5 rounded-lg text-sky-700 hover:bg-sky-50 transition-colors border border-transparent hover:border-sky-200"
                            title="السجل المالي للمشترك"
                            aria-label={`السجل المالي للمشترك ${sub.name}`}
                          >
                            <History className="w-4 h-4" />
                          </button>
                        )}
                        {/* Edit */}
                        <button
                          onClick={() => setEditingSubscriber(sub)}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors border border-transparent hover:border-amber-200"
                          title="تعديل بيانات المشترك"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Deactivate Button (X): Opens Deactivate Confirmation Modal matching Screenshot 4 */}
                        <button
                          onClick={() => setDeactivatingSubscriber(sub)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
                          title="إلغاء تفعيل الاشتراك وتفريغ البيانات"
                        >
                          <X className="w-4 h-4 stroke-[3]" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeletingSubscriber(sub)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200 cursor-pointer"
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
                  <td colSpan={8} style={{ height: subscriberBottomSpacerHeight, padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
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

      {/* Subscriber management actions at the bottom of the table */}
      <div dir="rtl" className="mt-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => setShowDeleteAllModal(true)}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          title="حذف جميع المشتركين نهائياً (تصفير شامل)"
        >
          <Trash2 className="w-4 h-4" />
          <span>حذف جميع المشتركين</span>
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label
            className="cursor-pointer px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
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

      {showAgentRenewalModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
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
                  تجديد اشتراك مشترك الوكيل
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="paid">نقدي — مدفوع</option>
                    <option value="debt">دين — يسجل كمستحق</option>
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
        </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-800">تعديل بيانات المشترك</h3>
              <button onClick={() => setEditingSubscriber(null)} className="text-slate-400 p-1">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المشترك</label>
                <input
                  type="text"
                  value={editingSubscriber.name}
                  onChange={(e) => setEditingSubscriber({ ...editingSubscriber, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={editingSubscriber.phone}
                  onChange={(e) => setEditingSubscriber({ ...editingSubscriber, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">رقم الجهاز *</label>
                  <button
                    type="button"
                    onClick={() => onSelectDeviceQr(editingSubscriber.deviceId, editingSubscriber.name, editingSubscriber.agentName)}
                    className="text-[11px] text-sky-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                />

                {/* QR Code preview box */}
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">رمز الاستجابة السريعة (QR Code)</span>
                    <span className="text-[10px] text-slate-500">يمثل رمز الجهاز المعتمد في المنظومة</span>
                  </div>
                  <div className="p-1.5 bg-white border border-slate-300 rounded-xl shadow-xs">
                    <QRCodeSVG
                      value={editingSubscriber.deviceId}
                      size={64}
                      level="M"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المالك / الوكيل *</label>
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان / المنطقة</label>
                <input
                  type="text"
                  value={editingSubscriber.address || ''}
                  onChange={(e) => setEditingSubscriber({ ...editingSubscriber, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSubscriber(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
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
                  className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800"
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

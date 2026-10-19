export type SubscriptionStatus = 'active' | 'inactive' | 'expiring_soon';
export type PaymentStatus = 'paid' | 'debt' | 'partial' | '-' | '';
export type SubscriptionDuration = '1 شهر' | 'شهرين' | '3 أشهر' | '6 أشهر' | 'سنة' | '-' | '';

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  deviceId: string; // 8 to 16 digits
  agentId: string;
  agentName: string;
  subscriptionType: SubscriptionDuration;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  amount: number;
  originalAmount?: number;
  paidAmount?: number;
  settleDate?: string;
  startDate: string;
  endDate: string;
  notes?: string;
  address?: string;
  createdAt: string;
}


export interface Agent {
  id: string;
  code: string; // e.g. AG-01, AG-02
  name: string;
  phone: string;
  region: string; // e.g. 0770 - ØªÙƒØ±ÙŠØªØŒ Ø³Ø§Ù…Ø±Ø§Ø¡ØŒ Ø¨Ù„Ø¯ØŒ Ø§Ù„Ø¯Ø¬ÙŠÙ„
  totalSales: number;
  totalPaid: number;
  totalDebt: number;
  devicesCount: number;
  activeSubscriptions: number;
  inactiveSubscriptions: number;
  hasDebt: boolean;
  avatarInitials: string;
  colorScheme?: string;
  customShopName?: string;
  username?: string;
  password?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: 'Ø£Ø±ÙŠÙ„' | 'ÙƒØ§Ø¨Ù„Ø§Øª' | 'Ø±ÙŠÙ…ÙˆÙ†Øª' | 'ÙÙŠØ´' | 'Ø£Ø¬Ù‡Ø²Ø© Ø¬Ø¯ÙŠØ¯Ø©' | 'Ø£Ø¬Ù‡Ø²Ø© Ù…Ø³ØªØ¹Ù…Ù„Ø©';
  price: number;
  stock: number;
  unit?: string;
  description: string;
  imageUrl: string;
}

export interface PricingRow {
  agentId: string;
  agentName: string;
  agentCode: string;
  newDevicePrice: number;
  oneMonthPrice: number;
  twoMonthsPrice: number;
  threeMonthsPrice: number;
  sixMonthsPrice: number;
  oneYearPrice: number;
  status: 'Ù…Ø¹ØªÙ…Ø¯Ø© (Ø§Ù„Ù…Ø±Ø¬Ø¹)' | 'Ù…Ø¹ØªÙ…Ø¯Ø© (ØªØ·Ø¨Ù‚ ÙÙŠ Ø§Ù„Ø¨ÙŠØ¹)' | 'Ù…Ø³ÙˆØ¯Ø©';
  isReference?: boolean;
}

export interface PendingRenewalRequest {
  id: string;
  subscriberId: string;
  subscriberName: string;
  deviceId: string;
  subscriberPhone: string;
  agentId: string;
  agentName: string;
  duration: SubscriptionDuration;
  amount: number;
  requestDate: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  subscriberId: string;
  subscriberName: string;
  deviceId: string;
  agentId: string;
  agentName: string;
  packageType: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  date: string;
  notes?: string;
}

export interface DeviceCode {
  id: string;
  code: string; // 16-digit or 8-digit
  status: 'available' | 'assigned' | 'faulty';
  assignedToSubscriber?: string;
  assignedToAgent?: string;
  generatedDate: string;
}

export interface SystemUser {
  id: string;
  username: string;
  displayName: string;
  role: 'Ù…Ø¯ÙŠØ± Ø±Ø¦ÙŠØ³ÙŠ' | 'Ù…Ø­Ø§Ø³Ø¨' | 'Ù…ÙˆØ¸Ù Ù…Ø¨ÙŠØ¹Ø§Øª' | 'ÙˆÙƒÙŠÙ„ Ù…Ø¹ØªÙ…Ø¯' | 'Ø¯Ø¹Ù… ÙÙ†ÙŠ';
  agentCode?: string;
  agentId?: string;
  passwordMasked: string;
  createdAt: string;
  lastLogin?: string;
}

export interface SecurityAlert {
  id: string;
  type: 'debt_warning' | 'unusual_login' | 'mass_delete' | 'repeated_failure';
  title: string;
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  read: boolean;
}

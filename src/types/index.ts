export type SubscriptionStatus = 'active' | 'inactive' | 'expiring_soon';
export type PaymentStatus = 'paid' | 'debt' | 'partial' | '';
export type SubscriptionDuration = '1 شهر' | 'شهرين' | '3 أشهر' | '6 أشهر' | 'سنة' | '';

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
  region: string; // e.g. 0770 - تكريت، سامراء، بلد، الدجيل
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
  category: 'أريل' | 'كابلات' | 'ريمونت' | 'فيش' | 'أجهزة جديدة' | 'أجهزة مستعملة';
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
  status: 'معتمدة (المرجع)' | 'معتمدة (تطبق في البيع)' | 'مسودة';
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
  role: 'مدير رئيسي' | 'محاسب' | 'موظف مبيعات' | 'وكيل معتمد' | 'دعم فني';
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

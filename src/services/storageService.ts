import {
  INITIAL_AGENTS,
  INITIAL_CODES,
  INITIAL_INVOICES,
  INITIAL_PRICING,
  INITIAL_PRODUCTS,
  INITIAL_SECURITY_ALERTS,
  INITIAL_SUBSCRIBERS,
  INITIAL_USERS
} from '../data/mockData';
import {
  Agent,
  DeviceCode,
  Invoice,
  PendingRenewalRequest,
  PricingRow,
  Product,
  SecurityAlert,
  Subscriber,
  SystemUser
} from '../types';

export interface AppState {
  subscribers: Subscriber[];
  agents: Agent[];
  products: Product[];
  pricing: PricingRow[];
  invoices: Invoice[];
  codes: DeviceCode[];
  users: SystemUser[];
  pendingRequests: PendingRenewalRequest[];
  securityAlerts: SecurityAlert[];
  lastBackupDate: string;
}

const STORAGE_KEY = 'alsari_broadcasting_v1';

export const storageService = {
  loadState(): AppState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }

    return {
      subscribers: INITIAL_SUBSCRIBERS,
      agents: INITIAL_AGENTS,
      products: INITIAL_PRODUCTS,
      pricing: INITIAL_PRICING,
      invoices: INITIAL_INVOICES,
      codes: INITIAL_CODES,
      users: INITIAL_USERS,
      pendingRequests: [],
      securityAlerts: INITIAL_SECURITY_ALERTS,
      lastBackupDate: new Date().toISOString()
    };
  },

  saveState(state: AppState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  },

  exportBackupJson(state: AppState) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `alsari_broadcasting_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  async importBackupJson(file: File): Promise<AppState> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed && Array.isArray(parsed.subscribers)) {
            resolve(parsed);
          } else {
            reject(new Error('ملف النسخة الاحتياطية غير صالح'));
          }
        } catch {
          reject(new Error('تعذر قراءة ملف JSON'));
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  createWhatsAppLink(phone: string, message: string): string {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('07')) {
      cleanPhone = '964' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7')) {
      cleanPhone = '964' + cleanPhone;
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
};

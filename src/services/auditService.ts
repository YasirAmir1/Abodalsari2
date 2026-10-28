/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AdministrativeAuditLog {
  id: string;
  action: 'DELETE_INVOICE' | 'RESET_DEBT' | 'SAVE_PRICING' | 'SETTLE_AGENT_DEBT';
  title: string;
  description: string;
  timestamp: string;
  userId: string;
  userName: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

const AUDIT_STORAGE_KEY = 'alsari_admin_audit_logs_v1';
const USER_SESSION_KEY = 'alsari_auth_user_v1';

export const auditService = {
  getCurrentUserInfo(): { userId: string; userName: string } {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(USER_SESSION_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          return {
            userId: user.id || user.username || 'admin',
            userName: user.displayName || user.username || 'المدير الرئيسي'
          };
        }
      }
    } catch {
      // fallback
    }
    return {
      userId: 'system-admin',
      userName: 'المدير الرئيسي'
    };
  },

  logAction(entry: {
    action: AdministrativeAuditLog['action'];
    title: string;
    description: string;
    targetId?: string;
    userId?: string;
    userName?: string;
    details?: Record<string, unknown>;
  }): AdministrativeAuditLog {
    const user = this.getCurrentUserInfo();
    const finalUserId = entry.userId || user.userId;
    const finalUserName = entry.userName || user.userName;

    const logEntry: AdministrativeAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: entry.action,
      title: entry.title,
      description: entry.description,
      timestamp: new Date().toISOString(),
      userId: finalUserId,
      userName: finalUserName,
      targetId: entry.targetId,
      details: entry.details
    };

    try {
      const existing = this.getLogs();
      const updated = [logEntry, ...existing].slice(0, 500); // keep up to 500 records
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to persist audit log to localStorage:', err);
    }

    // Print explicit high-visibility audit event to console for security auditing
    console.info(
      `%c[AUDIT - HIGH SECURITY ACTION] ${logEntry.action} by ${logEntry.userName} (${logEntry.userId}) at ${logEntry.timestamp}: ${logEntry.description}`,
      'background: #7f1d1d; color: #fecaca; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
      logEntry.details || {}
    );

    // Dispatch window event for external audit monitors
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alsari:audit-logged', { detail: logEntry })
      );
    }

    return logEntry;
  },

  getLogs(): AdministrativeAuditLog[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored) as AdministrativeAuditLog[];
        }
      }
    } catch {
      // fallback
    }
    return [];
  },

  clearLogs(): void {
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
    } catch {}
  }
};

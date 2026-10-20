/**
 * app-features.ts - Real-Time App Features & Multi-Tenant State Synchronization
 *
 * TypeScript wrapper and implementation for real-time streaming, bidirectional
 * Admin-Agent sync, offline resilience, delta resolution, and quota-aware listener cleanup.
 */

import type { AppState, Subscriber, Agent, PendingRenewalRequest, Invoice } from '../types';

export interface AppFeatureCallbacks {
  onSubscribersUpdate?: (subscribers: Subscriber[]) => void;
  onAgentsUpdate?: (agents: Agent[]) => void;
  onRequestUpdate?: (requests: PendingRenewalRequest[]) => void;
  onSalesUpdate?: (sales: Invoice[]) => void;
  onStatusChange?: (status: string) => void;
}

const FEATURE_CHANNEL = 'alsari_app_features_sync_v1';
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel(FEATURE_CHANNEL)
  : null;

export const appFeatures = {
  version: '1.0.0',

  initRealtimeStreams(callbacks: AppFeatureCallbacks): () => void {
    const {
      onSubscribersUpdate = () => {},
      onAgentsUpdate = () => {},
      onRequestUpdate = () => {},
      onSalesUpdate = () => {},
      onStatusChange = () => {}
    } = callbacks;

    if (typeof window === 'undefined') return () => {};

    const handleStateSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ state: AppState }>;
      if (!customEvent.detail?.state) return;
      const state = customEvent.detail.state;
      if (state.subscribers) onSubscribersUpdate(state.subscribers);
      if (state.agents) onAgentsUpdate(state.agents);
      if (state.pendingRequests) onRequestUpdate(state.pendingRequests);
      if (state.invoices) onSalesUpdate(state.invoices);
    };

    const handleSyncStatus = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        onStatusChange(customEvent.detail);
      }
    };

    window.addEventListener('alsari:state-sync', handleStateSync as EventListener);
    window.addEventListener('alsari:sync-status', handleSyncStatus as EventListener);

    const channelHandler = (e: MessageEvent) => {
      if (e.data && (e.data.type === 'TENANT_STATE_BROADCAST' || e.data.type === 'APP_STATE_UPDATED') && e.data.payload) {
        const state = e.data.payload as AppState;
        if (state.subscribers) onSubscribersUpdate(state.subscribers);
        if (state.agents) onAgentsUpdate(state.agents);
        if (state.pendingRequests) onRequestUpdate(state.pendingRequests);
        if (state.invoices) onSalesUpdate(state.invoices);
      }
    };

    broadcastChannel?.addEventListener('message', channelHandler);

    return () => {
      window.removeEventListener('alsari:state-sync', handleStateSync as EventListener);
      window.removeEventListener('alsari:sync-status', handleSyncStatus as EventListener);
      broadcastChannel?.removeEventListener('message', channelHandler);
    };
  },

  broadcastAdminUpdate(updateData: unknown) {
    const payload = {
      type: 'ADMIN_SUBSCRIBER_UPDATE',
      timestamp: Date.now(),
      data: updateData
    };
    broadcastChannel?.postMessage(payload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alsari:admin-sync', { detail: payload }));
    }
  },

  broadcastAgentAction(actionType: string, record: unknown) {
    const payload = {
      type: 'AGENT_ACTION_BROADCAST',
      action: actionType,
      timestamp: Date.now(),
      record
    };
    broadcastChannel?.postMessage(payload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alsari:agent-broadcast', { detail: payload }));
    }
  },

  handleOfflineReconnection(onOnlineCallback?: () => void, onOfflineCallback?: () => void) {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.info('[AppFeatures] Network online - triggering Firestore reconnection & delta synchronization');
      onOnlineCallback?.();
    });

    window.addEventListener('offline', () => {
      console.warn('[AppFeatures] Network offline - falling back to offline persistent cache');
      onOfflineCallback?.();
    });
  },

  createQuotaAwareListener(fetchFn: () => Promise<unknown>, intervalMs = 60000) {
    let timer: ReturnType<typeof setInterval> | null = null;
    let active = true;

    const start = () => {
      if (!active) return;
      timer = setInterval(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        fetchFn().catch((err) => {
          console.warn('[AppFeatures] Quota-aware fetch warning:', err);
        });
      }, intervalMs);
    };

    const stop = () => {
      active = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    start();
    return { stop };
  }
};

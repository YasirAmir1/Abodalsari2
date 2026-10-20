/**
 * app-features.js - Real-Time App Features & Multi-Tenant State Synchronization
 *
 * Manages global real-time event streaming (`onSnapshot`), bidirectional Admin-Agent
 * synchronization, offline persistence with automatic reconnection and delta resolution,
 * and quota-aware listener lifecycle management.
 */

(function (global) {
  'use strict';

  var FEATURE_CHANNEL = 'alsari_app_features_sync_v1';
  var channel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(FEATURE_CHANNEL);
    }
  } catch (e) {
    console.warn('[AppFeatures] BroadcastChannel not supported:', e);
  }

  var AppFeatures = {
    version: '1.0.0',

    // 1. Initialize Real-Time Sync Handlers across Core Modules (Subscribers, Agents, Requests, Sales)
    initRealtimeStreams: function (callbacks) {
      var onSubscribersUpdate = callbacks.onSubscribersUpdate || function () {};
      var onAgentsUpdate = callbacks.onAgentsUpdate || function () {};
      var onRequestUpdate = callbacks.onRequestUpdate || function () {};
      var onSalesUpdate = callbacks.onSalesUpdate || function () {};
      var onStatusChange = callbacks.onStatusChange || function () {};

      if (typeof window === 'undefined') return function () {};

      var handleStateSync = function (event) {
        if (!event || !event.detail || !event.detail.state) return;
        var state = event.detail.state;
        if (state.subscribers) onSubscribersUpdate(state.subscribers);
        if (state.agents) onAgentsUpdate(state.agents);
        if (state.pendingRequests) onRequestUpdate(state.pendingRequests);
        if (state.invoices) onSalesUpdate(state.invoices);
      };

      var handleSyncStatus = function (event) {
        if (event && event.detail) {
          onStatusChange(event.detail);
        }
      };

      window.addEventListener('alsari:state-sync', handleStateSync);
      window.addEventListener('alsari:sync-status', handleSyncStatus);

      var channelHandler = function (e) {
        if (e.data && (e.data.type === 'TENANT_STATE_BROADCAST' || e.data.type === 'APP_STATE_UPDATED') && e.data.payload) {
          var state = e.data.payload;
          if (state.subscribers) onSubscribersUpdate(state.subscribers);
          if (state.agents) onAgentsUpdate(state.agents);
          if (state.pendingRequests) onRequestUpdate(state.pendingRequests);
          if (state.invoices) onSalesUpdate(state.invoices);
        }
      };

      if (channel) {
        channel.addEventListener('message', channelHandler);
      }

      // Cleanup function to remove listeners upon session termination or logout
      return function cleanup() {
        window.removeEventListener('alsari:state-sync', handleStateSync);
        window.removeEventListener('alsari:sync-status', handleSyncStatus);
        if (channel) {
          channel.removeEventListener('message', channelHandler);
        }
      };
    },

    // 2. Bidirectional Admin-Agent Synchronization
    broadcastAdminUpdate: function (updateData) {
      var payload = {
        type: 'ADMIN_SUBSCRIBER_UPDATE',
        timestamp: Date.now(),
        data: updateData
      };
      if (channel) {
        channel.postMessage(payload);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alsari:admin-sync', { detail: payload }));
      }
    },

    broadcastAgentAction: function (actionType, record) {
      var payload = {
        type: 'AGENT_ACTION_BROADCAST',
        action: actionType,
        timestamp: Date.now(),
        record: record
      };
      if (channel) {
        channel.postMessage(payload);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alsari:agent-broadcast', { detail: payload }));
      }
    },

    // 3. Offline Persistence & Automatic Reconnection / Delta Resolution
    handleOfflineReconnection: function (onOnlineCallback, onOfflineCallback) {
      if (typeof window === 'undefined') return;

      window.addEventListener('online', function () {
        console.info('[AppFeatures] Network online - triggering Firestore reconnection & delta synchronization');
        if (typeof onOnlineCallback === 'function') onOnlineCallback();
      });

      window.addEventListener('offline', function () {
        console.warn('[AppFeatures] Network offline - falling back to offline persistent cache');
        if (typeof onOfflineCallback === 'function') onOfflineCallback();
      });
    },

    // 4. Quota-Aware Listener Manager & Cleanup
    createQuotaAwareListener: function (fetchFn, intervalMs) {
      var timer = null;
      var active = true;

      function start() {
        if (!active) return;
        timer = setInterval(function () {
          if (typeof navigator !== 'undefined' && !navigator.onLine) return;
          fetchFn().catch(function (err) {
            console.warn('[AppFeatures] Quota-aware fetch warning:', err);
          });
        }, intervalMs || 60000);
      }

      function stop() {
        active = false;
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      start();
      return { stop: stop };
    }
  };

  global.AppFeatures = AppFeatures;
})(typeof window !== 'undefined' ? window : this);

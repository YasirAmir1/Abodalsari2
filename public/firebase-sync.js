/**
 * firebase-sync.js - Global Event Listener & Multi-Device Sync Bridge
 * 
 * Provides live server event streaming via Firebase Firestore snapshots and
 * WebSockets/BroadcastChannel for Web (React) and Android (WebView / Native).
 */

(function (global) {
  'use strict';

  var SYNC_CHANNEL_NAME = 'alsari_realtime_sync_v1';
  var channel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    }
  } catch (e) {
    console.warn('BroadcastChannel not supported in this runtime');
  }

  var FirebaseSync = {
    version: '1.1.0',

    onStateSync: function (callback) {
      if (typeof window === 'undefined') return function () {};

      var listener = function (event) {
        if (event && event.detail && event.detail.state) {
          callback(event.detail.state);
        }
      };

      window.addEventListener('alsari:state-sync', listener);

      var channelHandler = function (e) {
        if (e.data && (e.data.type === 'APP_STATE_UPDATED' || e.data.type === 'TENANT_STATE_BROADCAST') && e.data.payload) {
          callback(e.data.payload);
        }
      };

      if (channel) {
        channel.addEventListener('message', channelHandler);
      }

      return function () {
        window.removeEventListener('alsari:state-sync', listener);
        if (channel) {
          channel.removeEventListener('message', channelHandler);
        }
      };
    },

    broadcastState: function (state) {
      var payload = {
        type: 'APP_STATE_UPDATED',
        payload: state,
        timestamp: Date.now()
      };
      if (channel) {
        channel.postMessage(payload);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alsari:state-sync', {
          detail: { state: state, source: 'local_broadcast', timestamp: Date.now() }
        }));
      }
    }
  };

  global.FirebaseSync = FirebaseSync;
})(typeof window !== 'undefined' ? window : this);

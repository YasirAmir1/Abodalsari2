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
    version: '1.0.0',

    onStateSync: function (callback) {
      if (typeof window === 'undefined') return;

      var listener = function (event) {
        if (event && event.detail && event.detail.state) {
          callback(event.detail.state);
        }
      };

      window.addEventListener('alsari:state-sync', listener);

      if (channel) {
        channel.addEventListener('message', function (e) {
          if (e.data && e.data.type === 'APP_STATE_UPDATED' && e.data.payload) {
            callback(e.data.payload);
          }
        });
      }

      return function () {
        window.removeEventListener('alsari:state-sync', listener);
      };
    },

    broadcastState: function (state) {
      if (channel) {
        channel.postMessage({
          type: 'APP_STATE_UPDATED',
          payload: state,
          timestamp: Date.now()
        });
      }
    }
  };

  global.FirebaseSync = FirebaseSync;
})(typeof window !== 'undefined' ? window : this);

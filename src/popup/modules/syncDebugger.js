/**
 * WebSocket Debugger Module - Manages Live Packet Stream, Latency & Quick Test Controls
 * 
 * Provides interactive HUD for testing real-time WebSocket communication between
 * browser extension and mobile companion app.
 */

import {
  sendTimerMessage,
  sendTestPing,
  onReceiveMessage,
  onSystemMessage
} from '../services/websocketService.js';

let syncDebugLog = null;
let syncLatencyBadge = null;

/**
 * Log structured packet to the terminal UI
 * @param {'SENT'|'RECV'|'ACK'|'ERR'|'SYS'} type 
 * @param {string} msg 
 * @param {string} [meta] 
 */
export function logPacket(type, msg, meta = '') {
  console.log(`[WS-${type}]`, msg, meta);
  if (!syncDebugLog) return;

  const line = document.createElement('div');
  line.style.marginBottom = '3px';
  line.style.display = 'flex';
  line.style.alignItems = 'flex-start';
  line.style.gap = '4px';

  const time = new Date().toLocaleTimeString('id-ID', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  let badgeClass = 'badge-sys';
  if (type === 'SENT') badgeClass = 'badge-sent';
  else if (type === 'RECV') badgeClass = 'badge-recv';
  else if (type === 'ACK') badgeClass = 'badge-ack';
  else if (type === 'ERR') badgeClass = 'badge-err';

  line.innerHTML = `
    <span style="color: #475569; flex-shrink: 0;">${time}</span>
    <span class="log-packet-badge ${badgeClass}">${type}</span>
    <span style="color: #cbd5e1; word-break: break-all; flex: 1;">${msg} ${meta ? `<span style="color: #818cf8; font-size: 7.5px;">(${meta})</span>` : ''}</span>
  `;

  syncDebugLog.appendChild(line);
  syncDebugLog.scrollTop = syncDebugLog.scrollHeight;
}

/**
 * Log generic system message to UI
 */
export function logToUI(msg, color = '#94a3b8') {
  logPacket('SYS', msg);
}

/**
 * Update RTT latency badge in HUD
 */
export function updateLatencyUI(latencyMs) {
  if (!syncLatencyBadge) return;

  syncLatencyBadge.textContent = `RTT: ${latencyMs} ms`;
  if (latencyMs < 150) {
    syncLatencyBadge.style.color = '#34d399';
    syncLatencyBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
  } else if (latencyMs < 400) {
    syncLatencyBadge.style.color = '#fbbf24';
    syncLatencyBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
  } else {
    syncLatencyBadge.style.color = '#f87171';
    syncLatencyBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
  }
}

/**
 * Clear all debug logs in the terminal
 */
export function clearDebugLogs() {
  if (syncDebugLog) syncDebugLog.innerHTML = '';
}

/**
 * Initialize the Debugger HUD listeners & stream hooks
 */
export function initSyncDebugger() {
  syncDebugLog = document.getElementById('sync-debug-log');
  syncLatencyBadge = document.getElementById('sync-latency-badge');

  const btnDbgPing = document.getElementById('btn-dbg-ping');
  const btnDbgAlert = document.getElementById('btn-dbg-alert');
  const btnDbgFocusOn = document.getElementById('btn-dbg-focus-on');
  const btnDbgFocusOff = document.getElementById('btn-dbg-focus-off');
  const inputDbgCustomMsg = document.getElementById('input-dbg-custom-msg');
  const btnDbgSendCustom = document.getElementById('btn-dbg-send-custom');
  const btnDbgCopyLogs = document.getElementById('btn-dbg-copy-logs');
  const btnDbgClearLogs = document.getElementById('btn-dbg-clear-logs');

  // Ping Test Action
  if (btnDbgPing) {
    btnDbgPing.addEventListener('click', () => {
      logPacket('SENT', 'PING_TEST');
      const sent = sendTestPing((ack, ms) => {
        updateLatencyUI(ms);
        logPacket('ACK', 'Pong received from server', `${ms}ms`);
      });
      if (!sent) logPacket('ERR', 'Gagal kirim ping: Socket belum terhubung');
    });
  }

  // Shock Alert Action
  if (btnDbgAlert) {
    btnDbgAlert.addEventListener('click', () => {
      logPacket('SENT', 'CRITICAL_DOOMSCROLL_ALERT');
      const sent = sendTimerMessage('CRITICAL_DOOMSCROLL_ALERT', (ack, ms) => {
        updateLatencyUI(ms);
        logPacket('ACK', 'Alert broadcast confirmed', `${ms}ms`);
      });
      if (!sent) logPacket('ERR', 'Gagal kirim alert: Socket belum terhubung');
    });
  }

  // Start Focus Action
  if (btnDbgFocusOn) {
    btnDbgFocusOn.addEventListener('click', () => {
      logPacket('SENT', 'on (timer_start)');
      const sent = sendTimerMessage('on', (ack, ms) => {
        updateLatencyUI(ms);
        logPacket('ACK', 'Timer ON confirmed', `${ms}ms`);
      });
      if (!sent) logPacket('ERR', 'Gagal kirim: Socket belum terhubung');
    });
  }

  // Stop Focus Action
  if (btnDbgFocusOff) {
    btnDbgFocusOff.addEventListener('click', () => {
      logPacket('SENT', 'off (timer_stop)');
      const sent = sendTimerMessage('off', (ack, ms) => {
        updateLatencyUI(ms);
        logPacket('ACK', 'Timer OFF confirmed', `${ms}ms`);
      });
      if (!sent) logPacket('ERR', 'Gagal kirim: Socket belum terhubung');
    });
  }

  // Custom Message Action
  if (btnDbgSendCustom && inputDbgCustomMsg) {
    const handleSendCustom = () => {
      const text = inputDbgCustomMsg.value.trim();
      if (!text) return;
      logPacket('SENT', text);
      const sent = sendTimerMessage(text, (ack, ms) => {
        updateLatencyUI(ms);
        logPacket('ACK', 'Custom message confirmed', `${ms}ms`);
      });
      if (!sent) logPacket('ERR', 'Gagal kirim: Socket belum terhubung');
      inputDbgCustomMsg.value = '';
    };

    btnDbgSendCustom.addEventListener('click', handleSendCustom);
    inputDbgCustomMsg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSendCustom();
    });
  }

  // Clear Logs Action
  if (btnDbgClearLogs) {
    btnDbgClearLogs.addEventListener('click', clearDebugLogs);
  }

  // Copy Logs Action
  if (btnDbgCopyLogs) {
    btnDbgCopyLogs.addEventListener('click', () => {
      if (!syncDebugLog) return;
      const logsText = syncDebugLog.innerText || syncDebugLog.textContent;
      navigator.clipboard.writeText(logsText).then(() => {
        if (window.Swal) {
          window.Swal.fire({
            title: 'Tersalin!',
            text: 'Log debug WebSocket berhasil disalin.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#f8fafc'
          });
        }
      });
    });
  }

  // Socket Stream Event Hooks
  onReceiveMessage((data) => {
    logPacket('RECV', data.message || JSON.stringify(data), `From: ${data.sender ? data.sender.substring(0, 6) : 'anon'}`);
  });

  onSystemMessage((msg) => {
    logPacket('SYS', msg);
  });

  // Service Worker Messages
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'syncDebugLog') {
        logPacket(msg.type || 'SYS', msg.message, msg.meta);
      }
      if (msg.action === 'doomscrollDetected') {
        logPacket('SENT', 'CRITICAL_DOOMSCROLL_ALERT', `Domain: ${msg.domain || 'web'}`);
      }
    });
  }
}

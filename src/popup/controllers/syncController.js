/**
 * Sync Controller Module - Manages phone sync via QR Code + WebSocket
 * 
 * Handles:
 * - Requesting roomId from backend
 * - Storing roomId in chrome.storage.local
 * - Connecting to Socket.IO WebSocket
 * - Generating QR Code with roomId
 * - Displaying connection status
 */

import { ENV_CONFIG } from '../../config.js';
import { getStorage, setStorage } from '../services/storageService.js';
import {
  connectWebSocket,
  disconnectWebSocket,
  getConnectionStatus,
  onConnectionChange,
  sendTimerMessage,
  sendTimerEvent,
  sendTestPing,
  onReceiveMessage,
  onSystemMessage
} from '../services/websocketService.js';
import { getAuthSession, refreshAuthToken } from '../services/authService.js';

/**
 * Initialize the Sync Controller
 * Binds UI elements in the Settings Modal for phone sync & Pairing Debugger HUD
 */
export function initSyncController() {
  const syncModal = document.getElementById('sync-modal');
  const btnCloseSyncModal = document.getElementById('btn-close-sync-modal');
  const btnHeaderSync = document.getElementById('btn-header-sync');
  const headerSyncLabel = document.getElementById('header-sync-label');
  const btnDashboardSync = document.getElementById('btn-dashboard-sync');

  const btnGenerateQr = document.getElementById('btn-generate-sync-qr');
  const syncQrContainer = document.getElementById('sync-qr-container');
  const syncQrCanvas = document.getElementById('sync-qr-canvas');
  const syncStatusBadge = document.getElementById('sync-status-badge');
  const syncStatusText = document.getElementById('sync-status-text');
  const syncRoomIdDisplay = document.getElementById('sync-room-id-display');
  const btnDisconnectSync = document.getElementById('btn-disconnect-sync');
  const syncDebugLog = document.getElementById('sync-debug-log');
  const syncLatencyBadge = document.getElementById('sync-latency-badge');

  // Debugger HUD Buttons
  const btnDbgPing = document.getElementById('btn-dbg-ping');
  const btnDbgAlert = document.getElementById('btn-dbg-alert');
  const btnDbgFocusOn = document.getElementById('btn-dbg-focus-on');
  const btnDbgFocusOff = document.getElementById('btn-dbg-focus-off');
  const inputDbgCustomMsg = document.getElementById('input-dbg-custom-msg');
  const btnDbgSendCustom = document.getElementById('btn-dbg-send-custom');
  const btnDbgCopyLogs = document.getElementById('btn-dbg-copy-logs');
  const btnDbgClearLogs = document.getElementById('btn-dbg-clear-logs');

  function openSyncModal() {
    if (syncModal) syncModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeSyncModal() {
    if (syncModal) syncModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  if (btnHeaderSync) {
    btnHeaderSync.addEventListener('click', openSyncModal);
  }

  if (btnDashboardSync) {
    btnDashboardSync.addEventListener('click', openSyncModal);
  }

  if (btnCloseSyncModal) {
    btnCloseSyncModal.addEventListener('click', closeSyncModal);
  }

  /**
   * Helper to write structured packet logs to UI terminal
   */
  function logPacket(type, msg, meta = '') {
    console.log(`[WS-${type}]`, msg, meta);
    if (!syncDebugLog) return;

    const line = document.createElement('div');
    line.style.marginBottom = '3px';
    line.style.display = 'flex';
    line.style.alignItems = 'flex-start';
    line.style.gap = '4px';

    const time = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

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

  function logToUI(msg, color = '#94a3b8') {
    logPacket('SYS', msg);
  }

  function updateLatencyUI(latencyMs) {
    if (syncLatencyBadge) {
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
  }

  /**
   * Update the connection status badge UI
   */
  function updateStatusUI(connected) {
    if (syncStatusBadge) {
      if (connected) {
        syncStatusBadge.className = 'sync-status-badge sync-connected';
        if (syncStatusText) syncStatusText.textContent = 'Terhubung';
      } else {
        syncStatusBadge.className = 'sync-status-badge sync-disconnected';
        if (syncStatusText) syncStatusText.textContent = 'Terputus';
      }
    }

    if (btnHeaderSync) {
      if (connected) {
        btnHeaderSync.className = 'btn-sync-chip sync-connected';
        if (headerSyncLabel) headerSyncLabel.textContent = 'Sync';
      } else {
        btnHeaderSync.className = 'btn-sync-chip sync-disconnected';
        if (headerSyncLabel) headerSyncLabel.textContent = 'Pair HP';
      }
    }
  }

  /**
   * Generate QR Code from roomId and render into the container
   */
  function generateQrCode(roomId) {
    if (!syncQrCanvas) return;

    const cleanRoomId = String(roomId || '').trim();
    if (!cleanRoomId || cleanRoomId === '[object Object]') {
      syncQrCanvas.innerHTML = `<span style="color: #f87171; font-size: 10px;">Room ID tidak valid</span>`;
      return;
    }

    // Clear previous QR
    syncQrCanvas.innerHTML = '';

    // Use QRCode library (loaded from lib/qrcode.min.js)
    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(syncQrCanvas, {
          text: cleanRoomId,
          width: 160,
          height: 160,
          colorDark: '#f8fafc',
          colorLight: '#0f172a',
          correctLevel: QRCode.CorrectLevel.M
        });
        console.log('[Sync Controller] QR Code generated for roomId:', cleanRoomId);
      } catch (err) {
        console.error('[Sync Controller] QR Code generation error:', err);
        syncQrCanvas.innerHTML = `<span style="color: #f87171; font-size: 10px;">Gagal membuat QR Code</span>`;
      }
    } else {
      console.error('[Sync Controller] QRCode library not loaded');
      syncQrCanvas.innerHTML = `<span style="color: #f87171; font-size: 10px;">QR Library tidak tersedia</span>`;
    }
  }

  /**
   * Show the QR container with generated QR + status
   */
  function showSyncUI(roomId) {
    const cleanRoomId = String(roomId || '').trim();
    if (!cleanRoomId || cleanRoomId === '[object Object]') {
      hideSyncUI();
      return;
    }

    if (syncQrContainer) syncQrContainer.classList.remove('hidden');
    if (syncRoomIdDisplay) syncRoomIdDisplay.textContent = cleanRoomId;
    if (btnGenerateQr) btnGenerateQr.textContent = '🔄 Regenerate QR Code';
    generateQrCode(cleanRoomId);
  }

  /**
   * Hide the QR container and reset UI
   */
  function hideSyncUI() {
    if (syncQrContainer) syncQrContainer.classList.add('hidden');
    if (syncRoomIdDisplay) syncRoomIdDisplay.textContent = '';
    if (btnGenerateQr) btnGenerateQr.textContent = '🔗 Generate QR Code';
    updateStatusUI(false);
  }

  /**
   * Request roomId from backend API
   */
  async function requestRoomId(isRetry = false) {
    const url = ENV_CONFIG.SYNC_ROOM_URL;
    logToUI(`Step 1: Requesting roomId from: ${url}`, '#fbbf24');

    if (!url) {
      throw new Error('Sync Room URL not configured');
    }

    // Get current auth token
    const t0 = performance.now();
    logToUI('Fetching auth session...', '#94a3b8');
    let { accessToken } = await getAuthSession();
    logToUI(`Auth session retrieved in ${(performance.now() - t0).toFixed(0)}ms, hasToken: ${!!accessToken}`, '#94a3b8');

    if (!accessToken) {
      throw new Error('Login diperlukan untuk sinkronisasi. Silakan login terlebih dahulu.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const t1 = performance.now();
      logToUI('Sending GET request to backend...', '#94a3b8');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      logToUI(`Backend responded in ${(performance.now() - t1).toFixed(0)}ms, status: ${response.status}`, '#94a3b8');

      const t2 = performance.now();
      const data = await response.json();
      logToUI(`Response parsed: ${JSON.stringify(data)} (${(performance.now() - t2).toFixed(0)}ms)`, '#94a3b8');

      // Check if access token is expired or unauthorized
      const isExpired = response.status === 401 || (data && data.message && (
        data.message.toLowerCase().includes('expired') ||
        data.message.toLowerCase().includes('unauthorized') ||
        data.message.toLowerCase().includes('invalid token')
      ));

      if (isExpired && !isRetry) {
        logToUI('🔄 Access token expired! Attempting automatic token refresh...', '#f59e0b');
        try {
          accessToken = await refreshAuthToken();
          logToUI('✅ Token refreshed! Retrying requestRoomId...', '#34d399');
          return await requestRoomId(true);
        } catch (refreshErr) {
          logToUI(`❌ Token refresh failed: ${refreshErr.message}`, '#f87171');
          throw new Error('Sesi login telah berakhir. Silakan login kembali.');
        }
      }

      let extractedRoomId = data.roomId;
      if (typeof extractedRoomId === 'object' && extractedRoomId !== null) {
        extractedRoomId = extractedRoomId.roomId || extractedRoomId.id || extractedRoomId.room || extractedRoomId.code || '';
      }

      // If backend returned {} (empty object) or invalid value, generate a clean readable roomId string
      if (!extractedRoomId || typeof extractedRoomId !== 'string' || extractedRoomId.trim() === '' || extractedRoomId === '[object Object]') {
        const { currentUser } = await getAuthSession();
        const userId = currentUser?.id || 'U';
        const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
        extractedRoomId = `ROOM-${userId}-${randomSuffix}`;
        logToUI(`⚠️ Backend returned object for roomId, resolved to: ${extractedRoomId}`, '#f59e0b');
      } else {
        extractedRoomId = String(extractedRoomId).trim();
      }

      return extractedRoomId;
    } catch (err) {
      clearTimeout(timeoutId);
      logToUI(`❌ requestRoomId error: ${err.name} - ${err.message}`, '#f87171');
      if (err.name === 'AbortError') {
        throw new Error('Request timeout saat mendapatkan Room ID');
      }
      throw err;
    }
  }

  /**
   * Full sync flow: request roomId → save → connect WS → generate QR
   */
  async function startSyncFlow() {
    const flowStart = performance.now();
    if (syncDebugLog) syncDebugLog.innerHTML = ''; // Clear previous logs
    logToUI('========== SYNC FLOW START ==========', '#818cf8');

    if (btnGenerateQr) {
      btnGenerateQr.disabled = true;
      btnGenerateQr.textContent = '⏳ Menghubungkan...';
    }

    try {
      // Step 1: Request roomId from backend
      const t1 = performance.now();
      const roomId = await requestRoomId();
      logToUI(`Step 1 DONE: Got roomId "${roomId}" (${(performance.now() - t1).toFixed(0)}ms)`, '#34d399');

      // Step 2: Save to chrome.storage.local
      const t2 = performance.now();
      await setStorage({ syncRoomId: roomId });
      logToUI(`Step 2 DONE: Saved to storage (${(performance.now() - t2).toFixed(0)}ms)`, '#34d399');

      // Step 3: Connect to Rivet WebSocket
      const t3 = performance.now();
      logToUI('Step 3: Connecting WebSocket...', '#94a3b8');
      await connectWebSocket(roomId);
      logToUI(`Step 3 DONE: WebSocket connected (${(performance.now() - t3).toFixed(0)}ms)`, '#34d399');

      // Step 4: Show QR Code
      const t4 = performance.now();
      logToUI('Step 4: Generating QR Code...', '#94a3b8');
      showSyncUI(roomId);
      logToUI(`Step 4 DONE: QR Code rendered (${(performance.now() - t4).toFixed(0)}ms)`, '#34d399');

      updateStatusUI(true);

      logToUI(`========== SYNC FLOW COMPLETE (${(performance.now() - flowStart).toFixed(0)}ms total) ==========`, '#10b981');

      if (btnGenerateQr) {
        btnGenerateQr.disabled = false;
        btnGenerateQr.textContent = '🔄 Regenerate QR Code';
      }
    } catch (err) {
      logToUI(`========== SYNC FLOW FAILED (${(performance.now() - flowStart).toFixed(0)}ms) ==========`, '#f87171');
      logToUI(`Error: ${err.message}`, '#f87171');

      if (btnGenerateQr) {
        btnGenerateQr.disabled = false;
        btnGenerateQr.textContent = '🔗 Generate QR Code';
      }

      updateStatusUI(false);

      // Show error via SweetAlert if available
      if (window.Swal) {
        window.Swal.fire({
          title: 'Gagal Sinkronisasi',
          text: err.message || 'Tidak dapat terhubung ke server.',
          icon: 'error',
          background: '#1e293b',
          color: '#f8fafc'
        });
      } else {
        alert('Gagal sinkronisasi: ' + (err.message || 'Tidak dapat terhubung ke server.'));
      }
    }
  }

  /**
   * Disconnect and clear sync state
   */
  function disconnectSync() {
    disconnectWebSocket();
    setStorage({ syncRoomId: null });
    hideSyncUI();
    console.log('[Sync Controller] Disconnected and cleared');
  }

  // --- Event Listeners ---
  if (btnGenerateQr) {
    btnGenerateQr.addEventListener('click', startSyncFlow);
  }

  if (btnDisconnectSync) {
    btnDisconnectSync.addEventListener('click', disconnectSync);
  }

  // --- Debugger HUD Action Listeners ---
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

  if (btnDbgClearLogs && syncDebugLog) {
    btnDbgClearLogs.addEventListener('click', () => {
      syncDebugLog.innerHTML = '';
    });
  }

  if (btnDbgCopyLogs && syncDebugLog) {
    btnDbgCopyLogs.addEventListener('click', () => {
      const logsText = syncDebugLog.innerText || syncDebugLog.textContent;
      navigator.clipboard.writeText(logsText).then(() => {
        if (window.Swal) {
          window.Swal.fire({
            title: 'Copied!',
            text: 'Debugger logs copied to clipboard.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#f8fafc'
          });
        } else {
          alert('Logs copied!');
        }
      });
    });
  }

  // --- Real-time Socket Event Stream Listeners ---
  onReceiveMessage((data) => {
    logPacket('RECV', data.message || JSON.stringify(data), `From: ${data.sender ? data.sender.substring(0, 6) : 'anon'}`);
  });

  onSystemMessage((msg) => {
    logPacket('SYS', msg);
  });

  // Listen to background service worker events
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

  // Listen for connection status changes
  onConnectionChange((connected) => {
    updateStatusUI(connected);
    if (connected) {
      logPacket('SYS', 'Socket connection established & joined room');
    } else {
      logPacket('SYS', 'Socket disconnected');
      if (syncLatencyBadge) syncLatencyBadge.textContent = 'RTT: -- ms';
    }
  });

  // --- Auto-restore from storage on init ---
  getStorage(['syncRoomId']).then(async (items) => {
    const saved = items.syncRoomId;
    if (saved && typeof saved === 'string' && saved.trim() !== '' && saved !== '[object Object]') {
      console.log('[Sync Controller] Found saved roomId, auto-reconnecting:', saved);
      try {
        await connectWebSocket(saved);
        showSyncUI(saved);
        updateStatusUI(true);
      } catch (err) {
        console.warn('[Sync Controller] Auto-reconnect failed:', err.message);
        showSyncUI(saved);
        updateStatusUI(false);
      }
    } else if (saved === '[object Object]' || (saved && typeof saved === 'object')) {
      // Clear corrupt saved roomId
      setStorage({ syncRoomId: null });
      hideSyncUI();
    }
  });

  return {
    startSyncFlow,
    disconnectSync,
    updateStatusUI
  };
}

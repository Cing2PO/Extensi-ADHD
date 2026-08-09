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
import { connectWebSocket, disconnectWebSocket, getConnectionStatus, onConnectionChange } from '../services/websocketService.js';
import { getAuthSession, refreshAuthToken } from '../services/authService.js';

/**
 * Initialize the Sync Controller
 * Binds UI elements in the Settings Modal for phone sync
 */
export function initSyncController() {
  const btnGenerateQr = document.getElementById('btn-generate-sync-qr');
  const syncQrContainer = document.getElementById('sync-qr-container');
  const syncQrCanvas = document.getElementById('sync-qr-canvas');
  const syncStatusBadge = document.getElementById('sync-status-badge');
  const syncStatusText = document.getElementById('sync-status-text');
  const syncRoomIdDisplay = document.getElementById('sync-room-id-display');
  const btnDisconnectSync = document.getElementById('btn-disconnect-sync');
  const syncDebugLog = document.getElementById('sync-debug-log');

  /**
   * Helper to write logs to UI container
   */
  function logToUI(msg, color = '#94a3b8') {
    console.log(msg); // still log to console
    if (syncDebugLog) {
      const line = document.createElement('div');
      line.style.color = color;
      line.style.marginBottom = '2px';
      
      const time = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      line.textContent = `[${time}] ${msg}`;
      
      syncDebugLog.appendChild(line);
      // Auto scroll to bottom
      syncDebugLog.scrollTop = syncDebugLog.scrollHeight;
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
  }

  /**
   * Generate QR Code from roomId and render into the container
   */
  function generateQrCode(roomId) {
    if (!syncQrCanvas) return;

    // Clear previous QR
    syncQrCanvas.innerHTML = '';

    // Use QRCode library (loaded from lib/qrcode.min.js)
    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(syncQrCanvas, {
          text: roomId,
          width: 160,
          height: 160,
          colorDark: '#f8fafc',
          colorLight: '#0f172a',
          correctLevel: QRCode.CorrectLevel.M
        });
        console.log('[Sync Controller] QR Code generated for roomId:', roomId);
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
    if (syncQrContainer) syncQrContainer.classList.remove('hidden');
    if (syncRoomIdDisplay) syncRoomIdDisplay.textContent = roomId;
    if (btnGenerateQr) btnGenerateQr.textContent = '🔄 Regenerate QR Code';
    generateQrCode(roomId);
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

      if (!response.ok || !data.roomId) {
        throw new Error(data.message || `Failed to get roomId (HTTP ${response.status})`);
      }

      return data.roomId;
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

  // Listen for connection status changes
  onConnectionChange((connected) => {
    updateStatusUI(connected);
  });

  // --- Auto-restore from storage on init ---
  getStorage(['syncRoomId']).then(async (items) => {
    if (items.syncRoomId) {
      console.log('[Sync Controller] Found saved roomId, auto-reconnecting:', items.syncRoomId);
      try {
        await connectWebSocket(items.syncRoomId);
        showSyncUI(items.syncRoomId);
        updateStatusUI(true);
      } catch (err) {
        console.warn('[Sync Controller] Auto-reconnect failed:', err.message);
        // Still show QR but with disconnected status
        showSyncUI(items.syncRoomId);
        updateStatusUI(false);
      }
    }
  });

  return {
    startSyncFlow,
    disconnectSync,
    updateStatusUI
  };
}

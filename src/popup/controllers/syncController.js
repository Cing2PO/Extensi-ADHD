/**
 * Sync Controller Module - Manages Mobile Sync via QR Code & WebSocket
 * 
 * Features:
 * - Auto-generates & renders QR Code on login & modal open
 * - Refresh QR Code token on demand
 * - Connects & manages Socket.IO room lifecycle
 * - Displays connection status in header and modal
 */

import { ENV_CONFIG } from '../../config.js';
import { getStorage, setStorage } from '../services/storageService.js';
import {
  connectWebSocket,
  disconnectWebSocket,
  getConnectionStatus,
  onConnectionChange
} from '../services/websocketService.js';
import { getAuthSession, refreshAuthToken, generateQrToken } from '../services/authService.js';
import { initSyncDebugger, logToUI, logPacket } from '../modules/syncDebugger.js';

/**
 * Initialize the Sync Controller
 * @param {Object} [callbacks]
 * @param {Function} [callbacks.onRequestAuth]
 */
export function initSyncController(callbacks = {}) {
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
  const syncAuthNotice = document.getElementById('sync-auth-notice');
  const btnSyncToLogin = document.getElementById('btn-sync-to-login');

  // Initialize modular debugger HUD
  initSyncDebugger();

  async function openSyncModal() {
    if (syncModal) syncModal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    const { accessToken } = await getAuthSession();
    if (!accessToken) {
      if (syncAuthNotice) syncAuthNotice.classList.remove('hidden');
      if (syncQrContainer) syncQrContainer.classList.add('hidden');
      updateStatusUI(false);
      return;
    }

    if (syncAuthNotice) syncAuthNotice.classList.add('hidden');
    if (syncQrContainer) syncQrContainer.classList.remove('hidden');

    const status = getConnectionStatus();
    if (!status.connected || !syncQrCanvas || syncQrCanvas.children.length === 0) {
      startSyncFlow();
    }
  }

  function closeSyncModal() {
    if (syncModal) syncModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function updateStatusUI(connected) {
    if (syncStatusBadge) {
      syncStatusBadge.className = connected ? 'sync-status-badge sync-connected' : 'sync-status-badge sync-disconnected';
      if (syncStatusText) syncStatusText.textContent = connected ? 'Terhubung' : 'Terputus';
    }

    if (btnHeaderSync) {
      btnHeaderSync.className = connected ? 'btn-sync-chip sync-connected' : 'btn-sync-chip sync-disconnected';
      if (headerSyncLabel) headerSyncLabel.textContent = connected ? 'Sync' : 'Pair HP';
    }
  }

  function generateQrCode(qrContent) {
    if (!syncQrCanvas) return;
    const cleanContent = String(qrContent || '').trim();
    if (!cleanContent || cleanContent === '[object Object]') {
      syncQrCanvas.innerHTML = `<span style="color: var(--cancel); font-size: 10px;">Token QR tidak valid</span>`;
      return;
    }

    syncQrCanvas.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(syncQrCanvas, {
          text: cleanContent,
          width: 155,
          height: 155,
          colorDark: '#ffffff',
          colorLight: '#020805',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (err) {
        console.error('[Sync Controller] QR Code error:', err);
        syncQrCanvas.innerHTML = `<span style="color: var(--cancel); font-size: 10px;">Gagal membuat QR Code</span>`;
      }
    } else {
      syncQrCanvas.innerHTML = `<span style="color: var(--cancel); font-size: 10px;">QR Library tidak tersedia</span>`;
    }
  }

  /**
   * Show the QR container with generated QR + status
   */
  function showSyncUI(roomId, qrContent) {
    const cleanRoomId = String(roomId || '').trim();

    if (syncAuthNotice) syncAuthNotice.classList.add('hidden');
    if (syncQrContainer) syncQrContainer.classList.remove('hidden');
    if (syncRoomIdDisplay) syncRoomIdDisplay.textContent = cleanRoomId || '-';
    if (btnGenerateQr) btnGenerateQr.textContent = '🔄 Refresh QR Code';

    generateQrCode(qrContent || cleanRoomId);
  }

  /**
   * Hide the QR container and reset UI
   */
  function hideSyncUI() {
    if (syncQrCanvas) syncQrCanvas.innerHTML = '';
    if (syncRoomIdDisplay) syncRoomIdDisplay.textContent = '-';
    if (btnGenerateQr) btnGenerateQr.textContent = '🔄 Refresh QR Code';
    updateStatusUI(false);
  }

  /**
   * Request roomId from session cache or backend API
   */
  async function requestRoomId(isRetry = false) {
    const { accessToken, roomId: sessionRoomId } = await getAuthSession();

    // Use already cached roomId from auth session if available
    if (sessionRoomId && typeof sessionRoomId === 'string' && sessionRoomId.trim() !== '' && sessionRoomId !== '[object Object]') {
      logToUI(`Using cached Room ID: ${sessionRoomId}`, 'var(--primary)');
      return sessionRoomId.trim();
    }

    if (!accessToken) {
      throw new Error('Login diperlukan untuk sinkronisasi. Silakan login terlebih dahulu.');
    }

    const url = ENV_CONFIG.SYNC_ROOM_URL;
    logToUI(`Requesting roomId from: ${url}`, 'var(--accent)');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.status === 401 && !isRetry) {
        logToUI('🔄 Access token expired. Refreshing token...', 'var(--accent)');
        await refreshAuthToken();
        return await requestRoomId(true);
      }

      let extractedRoomId = data.roomId;
      if (typeof extractedRoomId === 'object' && extractedRoomId !== null) {
        extractedRoomId = extractedRoomId.roomId || extractedRoomId.id || extractedRoomId.room || '';
      }

      if (!extractedRoomId || typeof extractedRoomId !== 'string' || extractedRoomId.trim() === '') {
        const { currentUser } = await getAuthSession();
        const userId = currentUser?.id || 'U';
        extractedRoomId = `ROOM-${userId}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      } else {
        extractedRoomId = String(extractedRoomId).trim();
      }

      return extractedRoomId;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timeout saat mendapatkan Room ID');
      }
      throw err;
    }
  }

  /**
   * Full sync flow: resolve roomId → connect WS → generate QR token → render QR
   */
  async function startSyncFlow(forceRefresh = false) {
    const flowStart = performance.now();
    logToUI(forceRefresh ? 'Refreshing QR Code token...' : 'Starting auto-sync flow...', 'var(--primary)');

    if (btnGenerateQr) {
      btnGenerateQr.disabled = true;
      btnGenerateQr.textContent = '⏳ Memperbarui...';
    }

    try {
      // Step 1: Resolve roomId
      const roomId = await requestRoomId();
      await setStorage({ syncRoomId: roomId });

      // Step 2: Connect WebSocket room
      await connectWebSocket(roomId);

      // Step 3: Generate fresh QR login token
      let qrContent = roomId;
      try {
        const loginToken = await generateQrToken();
        qrContent = loginToken;
        logToUI('QR login token created successfully', 'var(--primary)');
      } catch (qrErr) {
        logToUI(`Using roomId fallback for QR: ${qrErr.message}`, 'var(--accent)');
      }

      // Step 4: Show QR Code
      showSyncUI(roomId, qrContent);
      updateStatusUI(true);

      logToUI(`Sync ready in ${(performance.now() - flowStart).toFixed(0)}ms`, 'var(--primary)');
    } catch (err) {
      logToUI(`Sync error: ${err.message}`, 'var(--cancel)');
      updateStatusUI(false);
    } finally {
      if (btnGenerateQr) {
        btnGenerateQr.disabled = false;
        btnGenerateQr.textContent = '🔄 Refresh QR Code';
      }
    }
  }

  /**
   * Auto-sync callback invoked on successful login
   */
  async function autoSyncOnLogin(roomId) {
    console.log('[Sync Controller] Auto-sync triggered upon login with roomId:', roomId);
    if (roomId) {
      await setStorage({ syncRoomId: roomId });
    }
    startSyncFlow();
  }

  /**
   * Disconnect and clear sync state
   */
  function disconnectSync() {
    disconnectWebSocket();
    setStorage({ syncRoomId: null });
    hideSyncUI();
    console.log('[Sync Controller] Disconnected & cleared sync state');
  }

  // --- Event Listeners ---
  if (btnHeaderSync) btnHeaderSync.addEventListener('click', openSyncModal);
  if (btnDashboardSync) btnDashboardSync.addEventListener('click', openSyncModal);
  if (btnCloseSyncModal) btnCloseSyncModal.addEventListener('click', closeSyncModal);

  if (btnGenerateQr) {
    btnGenerateQr.addEventListener('click', () => startSyncFlow(true));
  }

  if (btnDisconnectSync) {
    btnDisconnectSync.addEventListener('click', disconnectSync);
  }

  if (btnSyncToLogin) {
    btnSyncToLogin.addEventListener('click', () => {
      closeSyncModal();
      if (typeof callbacks.onRequestAuth === 'function') {
        callbacks.onRequestAuth();
      }
    });
  }

  // Connection status listener
  onConnectionChange((connected) => {
    updateStatusUI(connected);
    if (connected) {
      logPacket('SYS', 'Socket connection active in room');
    } else {
      logPacket('SYS', 'Socket disconnected');
    }
  });

  // Auto-restore / auto-connect on startup
  getStorage(['syncRoomId']).then(async (items) => {
    const saved = items.syncRoomId;
    if (saved && typeof saved === 'string' && saved.trim() !== '' && saved !== '[object Object]') {
      try {
        await connectWebSocket(saved);
        updateStatusUI(true);
      } catch (e) {
        updateStatusUI(false);
      }
    }
  });

  return {
    openSyncModal,
    closeSyncModal,
    startSyncFlow,
    autoSyncOnLogin,
    disconnectSync,
    updateStatusUI
  };
}

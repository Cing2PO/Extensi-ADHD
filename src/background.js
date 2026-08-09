/**
 * ADHD Standalone Focus Coach - Background Script (Service Worker)
 * 
 * Manages native WebSocket connection to Socket.IO relay server in background
 * and automatically forwards doomscrolling alerts and Pomodoro status to mobile app.
 */

import { ENV_CONFIG } from './config.js';

console.log("[Background Service Worker] Initializing...");

const SOCKET_SERVER_WS = "wss://extensi-adhd-websocket.onrender.com/socket.io/?EIO=4&transport=websocket";

let ws = null;
let currentRoomId = null;
let isSocketConnected = false;

/**
 * Notify the open Popup Debugger HUD about packets sent from background
 */
function notifyPopupLog(type, message, meta = '') {
  chrome.runtime.sendMessage({
    action: 'syncDebugLog',
    type: type,
    message: message,
    meta: meta
  }).catch(() => {
    // Popup might be closed, perfectly normal
  });
}

/**
 * Initialize or maintain Native WebSocket connection in Service Worker
 */
function connectBackgroundWebSocket() {
  chrome.storage.local.get(['syncRoomId'], (items) => {
    const roomId = items.syncRoomId;
    if (!roomId || roomId === '[object Object]' || typeof roomId !== 'string') {
      disconnectBackgroundWebSocket();
      return;
    }

    const cleanRoomId = roomId.trim();
    if (ws && isSocketConnected && currentRoomId === cleanRoomId) {
      return;
    }

    currentRoomId = cleanRoomId;
    disconnectBackgroundWebSocket();

    console.log(`[Background SW] Connecting Native WebSocket: ${SOCKET_SERVER_WS} (Room: ${cleanRoomId})`);

    try {
      ws = new WebSocket(SOCKET_SERVER_WS);

      ws.onopen = () => {
        console.log('[Background SW] WebSocket Connected to Socket.IO server.');
      };

      ws.onmessage = (event) => {
        const data = String(event.data || '');

        // 1. Engine.IO open packet
        if (data.startsWith('0')) {
          // Reply with Socket.IO Connect packet
          ws.send('40');
        } 
        // 2. Socket.IO Connected packet
        else if (data.startsWith('40')) {
          isSocketConnected = true;
          console.log(`%c[Background SW] Socket.IO Connected! Joining Room: ${currentRoomId}`, 'color: #10b981; font-weight: bold;');
          // Join room
          ws.send('42' + JSON.stringify(['joinRoom', { roomId: currentRoomId }]));
          notifyPopupLog('SYS', `Background SW joined room: ${currentRoomId}`);
        } 
        // 3. Heartbeat Ping from Server
        else if (data === '2') {
          // Reply Pong
          ws.send('3');
        }
      };

      ws.onerror = (err) => {
        console.warn('[Background SW] WebSocket error:', err);
        isSocketConnected = false;
      };

      ws.onclose = (event) => {
        console.log('[Background SW] WebSocket closed:', event.code, event.reason);
        isSocketConnected = false;
        ws = null;
        // Auto-reconnect after 4 seconds if roomId is still configured
        setTimeout(() => {
          if (currentRoomId) connectBackgroundWebSocket();
        }, 4000);
      };
    } catch (err) {
      console.error('[Background SW] WebSocket exception:', err);
    }
  });
}

function disconnectBackgroundWebSocket() {
  if (ws) {
    try { ws.close(); } catch (e) {}
    ws = null;
  }
  isSocketConnected = false;
}

/**
 * Emit a message to the active sync room via Native WebSocket
 */
function sendSyncMessage(message, callback) {
  chrome.storage.local.get(['syncRoomId'], (items) => {
    const roomId = items.syncRoomId;
    if (!roomId || roomId === '[object Object]') {
      console.warn('[Background SW] Cannot send message: no active syncRoomId.');
      if (callback) callback(false);
      return;
    }

    const cleanRoomId = String(roomId).trim();
    const packet = '42' + JSON.stringify(['sendMessage', { roomId: cleanRoomId, message: String(message) }]);

    if (ws && isSocketConnected) {
      console.log(`%c[Background SW] Emitting '${message}' to room '${cleanRoomId}'`, 'color: #ef4444; font-weight: bold;');
      ws.send(packet);
      notifyPopupLog('SENT', message, `Room: ${cleanRoomId}`);
      if (callback) callback(true);
    } else {
      console.log(`[Background SW] WebSocket offline. Opening dedicated connection for '${message}'...`);
      try {
        const tempWs = new WebSocket(SOCKET_SERVER_WS);
        tempWs.onmessage = (e) => {
          const d = String(e.data || '');
          if (d.startsWith('0')) {
            tempWs.send('40');
          } else if (d.startsWith('40')) {
            tempWs.send('42' + JSON.stringify(['joinRoom', { roomId: cleanRoomId }]));
            tempWs.send(packet);
            console.log(`%c[Background SW] Dedicated '${message}' successfully delivered!`, 'color: #10b981; font-weight: bold;');
            notifyPopupLog('SENT', message, `Room: ${cleanRoomId}`);
            setTimeout(() => tempWs.close(), 1000);
            if (callback) callback(true);
          }
        };
        tempWs.onerror = () => {
          if (callback) callback(false);
        };
      } catch (e) {
        if (callback) callback(false);
      }
    }
  });
}

// Start background socket on boot
connectBackgroundWebSocket();

// Listen for syncRoomId updates in storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.syncRoomId) {
    console.log('[Background SW] syncRoomId changed, re-syncing socket...');
    connectBackgroundWebSocket();
  }
});

// --- MESSAGES FROM CONTENT SCRIPT / POPUP ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'doomscrollDetected') {
    console.log("%c[Background SW] Doomscroll Triggered! Broadcasting CRITICAL_DOOMSCROLL_ALERT to mobile phone...", "color: #ef4444; font-weight: bold; font-size: 13px;");
    console.log("Domain:", message.domain, "Score:", message.score, "Task:", message.currentTask);

    notifyPopupLog('SYS', `Doomscroll detected on ${message.domain || 'web'}`);
    
    // Broadcast the critical alert to mobile phone via WebSocket
    sendSyncMessage('CRITICAL_DOOMSCROLL_ALERT', (delivered) => {
      sendResponse({ status: delivered ? 'delivered_to_phone' : 'offline' });
    });

    return true; // Keep async response channel open
  }

  if (message.action === 'sendSyncMessage') {
    sendSyncMessage(message.message, (delivered) => {
      sendResponse({ success: delivered });
    });
    return true;
  }
});

// --- POMODORO BACKGROUND ENGINE ---
let pomodoroCheckInterval = null;

function startPomodoroBackgroundTicker() {
  if (pomodoroCheckInterval) return;
  pomodoroCheckInterval = setInterval(() => {
    chrome.storage.local.get(['pomodoroSession'], (items) => {
      if (chrome.runtime.lastError || !items.pomodoroSession) return;
      const session = items.pomodoroSession;
      if (!session.isActive || !session.isRunning || !session.targetTimestamp) return;

      const remainingSeconds = Math.ceil((session.targetTimestamp - Date.now()) / 1000);
      if (remainingSeconds <= 0) {
        // Advance session phase
        const nextIndex = session.currentIndex + 1;
        if (session.plan && nextIndex < session.plan.length) {
          const nextBlock = session.plan[nextIndex];
          const newTarget = Date.now() + (nextBlock.minutes * 60 * 1000);
          const updatedSession = {
            ...session,
            currentIndex: nextIndex,
            phase: nextBlock.type,
            targetTimestamp: newTarget,
            pausedRemainingSeconds: null
          };
          chrome.storage.local.set({ pomodoroSession: updatedSession });
          console.log(`[Pomodoro Engine] Advanced to phase: ${nextBlock.type}`);
        } else {
          // Completed all blocks
          const finishedSession = {
            ...session,
            isActive: false,
            isRunning: false,
            phase: 'done',
            targetTimestamp: null,
            pausedRemainingSeconds: 0
          };
          chrome.storage.local.set({ pomodoroSession: finishedSession });
          console.log('[Pomodoro Engine] Pomodoro session completed!');
          // Send OFF to phone when pomodoro finishes
          sendSyncMessage('off');
        }
      }
    });
  }, 1000);
}

startPomodoroBackgroundTicker();

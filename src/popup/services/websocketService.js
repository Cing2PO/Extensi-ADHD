/**
 * WebSocket Service - Manages Socket.IO connection for Pomodoro sync
 * 
 * Target Server: https://extensi-adhd-websocket.onrender.com/
 * Connects via Socket.IO, joins room using backend roomId,
 * and emits timer messages with payload format:
 * {
 *   "roomId": string,
 *   "message": string
 * }
 */

import { ENV_CONFIG } from '../../config.js';

let socket = null;
let currentRoomId = null;
let isConnected = false;
let connectionChangeCallbacks = [];

/**
 * Get Socket.IO factory function from global scope
 */
function getSocketIo() {
  if (typeof io !== 'undefined') return io;
  if (typeof window !== 'undefined' && window.io) return window.io;
  return null;
}

/**
 * Notify all registered listeners about connection status change
 */
function notifyConnectionChange(status) {
  isConnected = status;
  connectionChangeCallbacks.forEach(cb => {
    try { cb(status); } catch (e) { console.error('[WS Service] Callback error:', e); }
  });
}

let receiveMessageCallbacks = [];
let systemMessageCallbacks = [];

/**
 * Connect to Socket.IO server with the given roomId
 * @param {string} roomId - Room ID obtained from backend
 * @returns {Promise<boolean>}
 */
export function connectWebSocket(roomId) {
  return new Promise((resolve, reject) => {
    const ioFn = getSocketIo();
    if (!ioFn) {
      const err = new Error('Socket.IO library (socket.io.min.js) tidak ditemukan.');
      console.error('[WS Service]', err.message);
      reject(err);
      return;
    }

    if (socket && isConnected && currentRoomId === roomId) {
      console.log('[WS Service] Already connected to room:', roomId);
      resolve(true);
      return;
    }

    // Close existing connection if any
    disconnectWebSocket();
    currentRoomId = String(roomId);

    const targetUrl = ENV_CONFIG.SOCKET_IO_URL || 'https://extensi-adhd-websocket.onrender.com';
    console.log(`[WS Service] Connecting to Socket.IO server: ${targetUrl}`);

    try {
      socket = ioFn(targetUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000
      });
    } catch (err) {
      console.error('[WS Service] Socket initialization error:', err);
      reject(err);
      return;
    }

    const timeout = setTimeout(() => {
      if (socket && !socket.connected) {
        console.warn('[WS Service] Connection timeout');
        socket.disconnect();
        reject(new Error('Koneksi WebSocket (Socket.IO) timeout.'));
      }
    }, 12000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log('%c[WS Service] Connected to Socket.IO! Socket ID: ' + socket.id, 'color: #10b981; font-weight: bold;');
      
      // 1. Join room using format: { roomId: string }
      socket.emit('joinRoom', { roomId: currentRoomId });
      console.log(`[WS Service] Emitted joinRoom for roomId: '${currentRoomId}'`);

      notifyConnectionChange(true);
      resolve(true);
    });

    socket.on('systemMessage', (msg) => {
      console.log('[WS Service] System Message from server:', msg);
      systemMessageCallbacks.forEach(cb => {
        try { cb(msg); } catch (e) { console.error('[WS Service] systemMessage callback error:', e); }
      });
    });

    socket.on('receiveMessage', (data) => {
      console.log('[WS Service] Receive Message in Room:', data);
      receiveMessageCallbacks.forEach(cb => {
        try { cb(data); } catch (e) { console.error('[WS Service] receiveMessage callback error:', e); }
      });
    });

    socket.on('disconnect', (reason) => {
      clearTimeout(timeout);
      console.log(`[WS Service] Socket disconnected: ${reason}`);
      notifyConnectionChange(false);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      console.error('[WS Service] Socket connect_error:', error);
      notifyConnectionChange(false);
    });
  });
}

/**
 * Disconnect from Socket.IO server
 */
export function disconnectWebSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) { /* ignore */ }
    socket = null;
  }
  currentRoomId = null;
  notifyConnectionChange(false);
}

/**
 * Emit a message to the room via Socket.IO
 * Format: { "roomId": string, "message": string }
 * 
 * @param {string} message - Message string
 * @param {Function} [ackCallback] - Optional ack callback receiving (response, latencyMs)
 * @returns {boolean}
 */
export function sendTimerMessage(message, ackCallback) {
  if (!socket || !socket.connected || !currentRoomId) {
    console.warn('[WS Service] Cannot send message - socket not connected or no roomId.', { connected: socket?.connected, roomId: currentRoomId });
    return false;
  }

  const payload = {
    roomId: String(currentRoomId),
    message: String(message)
  };

  const startTime = performance.now();
  console.log('%c[WS Service] Emitting sendMessage:', 'color: #818cf8; font-weight: bold;', payload);

  socket.emit('sendMessage', payload, (response) => {
    const latencyMs = Math.round(performance.now() - startTime);
    console.log(`[WS Service] Ack response from server (${latencyMs}ms):`, response);
    if (typeof ackCallback === 'function') {
      ackCallback(response, latencyMs);
    }
  });

  return true;
}

/**
 * Send timer event mapped to "on" or "off" status message
 * @param {Object|string} eventData - Timer event object or string ("on" / "off")
 */
export function sendTimerEvent(eventData) {
  let messageStr = 'off';

  if (typeof eventData === 'string') {
    messageStr = eventData;
  } else if (eventData && typeof eventData === 'object') {
    if (eventData.type === 'timer_start' || eventData.phase === 'work' || eventData.status === 'on' || eventData.isOn === true) {
      messageStr = 'on';
    } else if (eventData.type === 'timer_pause' || eventData.type === 'timer_stop' || eventData.phase === 'break' || eventData.status === 'off' || eventData.isOn === false) {
      messageStr = 'off';
    } else {
      messageStr = eventData.message || (eventData.phase === 'work' ? 'on' : 'off');
    }
  }

  return sendTimerMessage(messageStr);
}

/**
 * Send a Test Ping to measure Round-Trip Latency
 * @param {Function} callback - Callback function receiving (response, latencyMs)
 * @returns {boolean}
 */
export function sendTestPing(callback) {
  return sendTimerMessage('PING_TEST', callback);
}

/**
 * Get current WebSocket connection status details
 * @returns {{ connected: boolean, roomId: string|null, socketId: string|null, serverUrl: string }}
 */
export function getConnectionStatus() {
  return {
    connected: isConnected && socket?.connected,
    roomId: currentRoomId,
    socketId: socket?.id || null,
    serverUrl: ENV_CONFIG.SOCKET_IO_URL || 'https://extensi-adhd-websocket.onrender.com'
  };
}

/**
 * Register a callback for connection status changes
 * @param {function(boolean): void} callback
 * @returns {function} Unsubscribe function
 */
export function onConnectionChange(callback) {
  connectionChangeCallbacks.push(callback);
  return () => {
    connectionChangeCallbacks = connectionChangeCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Register a callback for incoming messages in room
 * @param {function(Object): void} callback
 * @returns {function} Unsubscribe function
 */
export function onReceiveMessage(callback) {
  receiveMessageCallbacks.push(callback);
  return () => {
    receiveMessageCallbacks = receiveMessageCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Register a callback for system messages
 * @param {function(string): void} callback
 * @returns {function} Unsubscribe function
 */
export function onSystemMessage(callback) {
  systemMessageCallbacks.push(callback);
  return () => {
    systemMessageCallbacks = systemMessageCallbacks.filter(cb => cb !== callback);
  };
}

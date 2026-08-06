/**
 * ADHD Standalone Focus Coach - Background Script (Service Worker)
 * 
 * Manages the WebSocket connection (mocked for standalone testing) and forwards 
 * scrolling event alerts to the virtual backend.
 */

import { encrypt, decrypt } from './utils/encryption.js';
import { ENV_CONFIG } from './config.js';

// WebSocket State
let socket = null;
let isSocketConnected = false;
const REVERB_WS_URL = ENV_CONFIG?.REVERB_WS_URL || "ws://localhost:8000/app/reverb";

console.log("[Background Service Worker] Initializing...");

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'doomscrollDetected') {
    const rawPayload = {
      domain: message.domain,
      score: message.score,
      currentTask: message.currentTask,
      timestamp: Date.now()
    };

    console.log("%c[Background Script] Received Doomscroll Event from Content Script:", "color: #f59e0b; font-weight: bold;");
    console.log("Raw Payload:", rawPayload);

    // Encrypt the payload using encryption utility
    const encryptedHex = encrypt(JSON.stringify(rawPayload));

    if (isSocketConnected && socket) {
      socket.send(encryptedHex);
      sendResponse({ status: 'sent', encrypted: encryptedHex });
    } else {
      sendResponse({ status: 'buffered_offline' });
    }
    return true; // Keep response channel open for async execution
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
        }
      }
    });
  }, 1000);
}

startPomodoroBackgroundTicker();


/**
 * ADHD Standalone Focus Coach - Background Script (Service Worker)
 * 
 * Manages the WebSocket connection (mocked for standalone testing) and forwards 
 * scrolling event alerts to the virtual backend.
 */

import { encrypt, decrypt } from './utils/encryption.js';

// Simulated WebSocket State
let mockSocket = null;
let isSocketConnected = false;
const REVERB_MOCK_URL = "ws://localhost:8000/app/reverb";

console.log("[Background Service Worker] Initializing...");

// Auto-initialize mock connection
connectMockWebSocket();

function connectMockWebSocket() {
  console.log(`[Mock WebSocket] Connecting to Reverb server at ${REVERB_MOCK_URL}...`);
  
  // Simulate network latency for connection
  setTimeout(() => {
    isSocketConnected = true;
    mockSocket = {
      send: (encryptedData) => {
        // Log the sending of encrypted data
        console.log("%c[Mock WebSocket] Sending Encrypted Payload to Server:", "color: #3b82f6; font-weight: bold;");
        console.log(`Payload (Hex): ${encryptedData}`);
        
        // Let's decrypt it in the log just to verify it works
        try {
          const decrypted = decrypt(encryptedData);
          console.log(`Decrypted verification output on server side:`, JSON.parse(decrypted));
        } catch (e) {
          console.error("Mock Server failed to decrypt payload:", e);
        }

        // Simulate server receiving and acknowledging the doomscroll event
        simulateServerEventAcknowledgment(encryptedData);
      }
    };
    console.log("%c[Mock WebSocket] Connection established successfully (Mock Server Mode).", "color: #10b981; font-weight: bold;");
  }, 1000);
}

/**
 * Simulates a server event acknowledgment and cross-platform intervention trigger.
 */
function simulateServerEventAcknowledgment(encryptedData) {
  setTimeout(() => {
    try {
      const parsedData = JSON.parse(decrypt(encryptedData));
      console.log("%c[Mock Server Response] Acknowledged doomscroll event on domain: " + parsedData.domain, "color: #ef4444; font-weight: bold;");
      
      // Simulate triggering the mobile app cross-platform intervention
      console.log("%c[Mock Cross-Platform Hub] BROADCASTING EVENT -> Mobile ADHD App", "background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px;");
      console.log(`[Mock Mobile Haptic Alert] Triggering vibration and brown noise waveforms for task: "${parsedData.currentTask || 'No task active'}"`);
      
      // Broadcast back an acknowledgment to all open extension content scripts
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && (tab.url.startsWith("http") || tab.url.startsWith("https"))) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'DOOMSCROLL_SERVER_ACK',
              domain: parsedData.domain,
              score: parsedData.score,
              timestamp: parsedData.timestamp
            }).catch(() => {
              // Ignore errors for tabs where extension content script is not loaded
            });
          }
        });
      });
    } catch (e) {
      console.error("Error in simulation response:", e);
    }
  }, 1200);
}

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

    // Encrypt the payload using encryption utility (XOR with binary representation of ASCII '5')
    const encryptedHex = encrypt(JSON.stringify(rawPayload));

    if (isSocketConnected && mockSocket) {
      mockSocket.send(encryptedHex);
      sendResponse({ status: 'sent', encrypted: encryptedHex });
    } else {
      console.warn("[Background Script] Mock WebSocket is not connected. Simulating buffer and reconnecting...");
      connectMockWebSocket();
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


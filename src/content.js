/**
 * ADHD Standalone Focus Check - Content Script
 * 
 * Injected globally. Checks domain blacklist from chrome.storage.local (supporting
 * toggled states), tracks scroll metrics, and injects the soft-block overlay.
 */

(function () {
  const DEFAULT_BLACKLIST = [
    { domain: 'youtube.com', enabled: true },
    { domain: 'x.com', enabled: true },
    { domain: 'twitter.com', enabled: true },
    { domain: 'instagram.com', enabled: true },
    { domain: 'tiktok.com', enabled: true },
    { domain: 'facebook.com', enabled: true }
  ];

  // Map popup slider settings to numeric score thresholds
  const SENSITIVITY_MAP = {
    'lenient': 14000,
    'balanced': 8000,
    'strict': 1000
  };

  // --- CONFIGURATION CONSTANTS ---
  const TICK_RATE_MS = 500;            // Throttling window for heuristic math (2Hz frequency)
  const SCORE_DECAY = 250;             // Score decay per ticker tick when user is idle or reading slowly
  const VELOCITY_WEIGHT = 2.5;         // Multiplier weight for scrolling velocity
  const INTERACTION_TIMEOUT_MS = 8000; // Duration (8s) before interaction absence multiplier begins scaling up

  // --- STATE TRACKING ---
  let distractionScore = 0;
  let accumulatedScrollInTick = 0;
  let maxScrollYReached = window.scrollY;
  let lastScrollY = window.scrollY;
  let lastTickTime = performance.now();
  let lastInteractionTime = performance.now();

  let rootContainer = null;
  let shadowRootNode = null;
  let tickIntervalId = null;
  let isEngineRunning = false;

  // Settings cached from local storage
  let isProtectionActive = true;
  let currentTask = "";
  let doomscrollThreshold = 8000;
  let pomodoroSession = null;

  // --- PRIVACY & CONTEXT GUARDRAIL ---
  function isContextValid() {
    return !!chrome.runtime?.id;
  }

  // --- LOGIC PART 2: THROTTLED HEURISTICS & PASSIVE LISTENERS ---

  function handleScroll() {
    const currentScrollY = window.scrollY;
    const delta = Math.abs(currentScrollY - lastScrollY);

    accumulatedScrollInTick += delta;
    lastScrollY = currentScrollY;

    if (currentScrollY > maxScrollYReached) {
      maxScrollYReached = currentScrollY;
    }
  }

  function handleInteraction(e) {
    if (e.type === 'keydown') {
      const scrollKeys = ['ArrowDown', 'ArrowUp', 'Space', ' ', 'PageDown', 'PageUp', 'Home', 'End'];
      if (scrollKeys.includes(e.key)) {
        return;
      }
    }

    lastInteractionTime = performance.now();
    distractionScore = 0;
  }

  // --- LOGIC PART 3: DOOMSCROLL SCORE CALCULATION ---

  function runHeuristicsTick() {
    if (!isContextValid()) {
      cleanup();
      return;
    }

    const now = performance.now();
    const dt = now - lastTickTime;
    lastTickTime = now;

    const timeSinceInteraction = now - lastInteractionTime;

    if (accumulatedScrollInTick > 0) {
      const velocity = accumulatedScrollInTick / dt;

      // Interaction absence multiplier scales if user scrolls > 8s without typing/clicking
      let interactionAbsenceFactor = 1.0;
      if (timeSinceInteraction > INTERACTION_TIMEOUT_MS) {
        interactionAbsenceFactor = 1.0 + ((timeSinceInteraction - INTERACTION_TIMEOUT_MS) / 5000);
      }

      // Doomscroll score formula: distance * velocity weight * absence scaling
      const scoreDelta = accumulatedScrollInTick * (1 + (velocity * VELOCITY_WEIGHT)) * interactionAbsenceFactor;
      distractionScore += scoreDelta;
      accumulatedScrollInTick = 0;
    } else {
      distractionScore = Math.max(0, distractionScore - SCORE_DECAY);
    }

    if (distractionScore >= doomscrollThreshold && !isOverlayVisible()) {
      triggerIntervention();
    }
  }

  // --- LOGIC PART 4: SOFT-BLOCK EXECUTION (SHADOW DOM) ---

  function injectOverlay() {
    if (rootContainer) return;

    rootContainer = document.createElement('adhd-standalone-root');
    rootContainer.style.position = 'fixed';
    rootContainer.style.zIndex = '2147483647';
    rootContainer.style.top = '0';
    rootContainer.style.left = '0';

    shadowRootNode = rootContainer.attachShadow({ mode: 'closed' });

    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = chrome.runtime.getURL('src/overlay.css');
    shadowRootNode.appendChild(linkElement);

    const overlayMarkup = document.createElement('div');
    overlayMarkup.className = 'focus-overlay';

    let promptText = "You seem to be caught in a loop. Is this helpful right now?";
    if (currentTask.trim().length > 0) {
      promptText = `You seem to be caught in a loop. You planned to focus on: <strong>"${escapeHtml(currentTask)}"</strong>. Is this helpful right now?`;
    }

    overlayMarkup.innerHTML = `
      <div class="focus-card">
        <div class="focus-icon-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4m0 4h.01"></path>
          </svg>
        </div>
        <h2 class="focus-title">Focus Check</h2>
        <p class="focus-description" id="focus-desc">${promptText}</p>
        <div class="focus-actions">
          <button class="focus-btn btn-working" id="btn-working">Yes, I am working</button>
          <button class="focus-btn btn-exit" id="btn-exit">No, get me out</button>
        </div>
      </div>
    `;

    shadowRootNode.appendChild(overlayMarkup);
    document.body.appendChild(rootContainer);

    // --- LOGIC PART 5: OVERLAY INTERACTION ---
    shadowRootNode.getElementById('btn-working').addEventListener('click', handleKeepWorking);
    shadowRootNode.getElementById('btn-exit').addEventListener('click', handleGetMeOut);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Check visibility inside shadow DOM
  function isOverlayVisible() {
    if (!rootContainer || !shadowRootNode) return false;
    const overlay = shadowRootNode.querySelector('.focus-overlay');
    return overlay && overlay.classList.contains('visible');
  }

  // --- FIX 3: Block scroll when overlay is visible ---
  function blockScroll(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  function enableScrollBlock() {
    document.addEventListener('wheel', blockScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', blockScroll, { passive: false, capture: true });
    document.addEventListener('keydown', blockScrollKeys, { capture: true });
    document.body.style.overflow = 'hidden';
  }

  function disableScrollBlock() {
    document.removeEventListener('wheel', blockScroll, { capture: true });
    document.removeEventListener('touchmove', blockScroll, { capture: true });
    document.removeEventListener('keydown', blockScrollKeys, { capture: true });
    document.body.style.overflow = '';
  }

  function blockScrollKeys(e) {
    const scrollKeys = ['ArrowDown', 'ArrowUp', ' ', 'PageDown', 'PageUp', 'Home', 'End'];
    if (scrollKeys.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function triggerIntervention() {
    injectOverlay();

    const descEl = shadowRootNode.getElementById('focus-desc');
    if (descEl) {
      if (currentTask.trim().length > 0) {
        descEl.innerHTML = `You seem to be caught in a loop. You planned to focus on: <strong>"${escapeHtml(currentTask)}"</strong>. Is this helpful right now?`;
      } else {
        descEl.textContent = "You seem to be caught in a loop. Is this helpful right now?";
      }
    }

    // Trigger animation and enable scroll block
    setTimeout(() => {
      if (shadowRootNode) {
        const overlay = shadowRootNode.querySelector('.focus-overlay');
        if (overlay) {
          overlay.classList.add('visible');
          enableScrollBlock(); // Block scrolling while overlay is shown
        }
      }
    }, 50);

    // Send event alert to background service worker (which forwards it to WebSocket)
    if (isContextValid()) {
      console.log(`[Content Script] Distraction threshold reached (${Math.round(distractionScore)} >= ${doomscrollThreshold}). Sending event to background service worker...`);
      chrome.runtime.sendMessage({
        action: 'doomscrollDetected',
        domain: window.location.hostname,
        score: Math.round(distractionScore),
        currentTask: currentTask
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Content Script] Failed to send message to background script:", chrome.runtime.lastError.message);
        } else {
          console.log("[Content Script] Message successfully delivered to background. Sync status:", response?.status);
        }
      });
    }
  }

  function handleKeepWorking(e) {
    e.stopPropagation();
    if (shadowRootNode) {
      const overlay = shadowRootNode.querySelector('.focus-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
      }
    }
    disableScrollBlock(); // Re-enable scrolling
    distractionScore = 0;
    accumulatedScrollInTick = 0;
    lastInteractionTime = performance.now();

    // Increment refocus count
    if (isContextValid()) {
      chrome.storage.local.get(['refocusCount'], (items) => {
        const count = items.refocusCount || 0;
        chrome.storage.local.set({ refocusCount: count + 1 }, () => {
          console.log(`[Refocus Tally] Count incremented: ${count + 1}`);
        });
      });
    }
  }

  function handleGetMeOut(e) {
    e.stopPropagation();
    disableScrollBlock(); // Re-enable scrolling before redirecting
    window.location.href = 'about:blank';
  }

  // --- ENGINE LIFECYCLE MANAGEMENT ---

  function init() {
    if (isEngineRunning) return;

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleScroll, { passive: true });
    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('input', handleInteraction, { passive: true });

    tickIntervalId = setInterval(runHeuristicsTick, TICK_RATE_MS);
    isEngineRunning = true;
    lastTickTime = performance.now();
    lastInteractionTime = performance.now();
    distractionScore = 0;
    accumulatedScrollInTick = 0;
  }

  function cleanup() {
    if (!isEngineRunning) return;

    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('wheel', handleScroll);
    window.removeEventListener('click', handleInteraction);
    window.removeEventListener('keydown', handleInteraction);
    window.removeEventListener('input', handleInteraction);

    if (tickIntervalId) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }

    if (rootContainer) {
      rootContainer.remove();
      rootContainer = null;
      shadowRootNode = null;
    }
    isEngineRunning = false;
  }

  // --- DOMAIN & PROTECTION WATCHER ---

  function checkAndSetEngine() {
    if (!isContextValid()) {
      cleanup();
      return;
    }

    chrome.storage.local.get([
      'blacklist',
      'isProtectionActive',
      'sensitivity',
      'currentTask',
      'pomodoroSession'
    ], (items) => {
      if (chrome.runtime.lastError) return;

      isProtectionActive = items.isProtectionActive !== false;
      currentTask = items.currentTask || '';
      pomodoroSession = items.pomodoroSession || null;

      const sensitivity = items.sensitivity || 'balanced';
      doomscrollThreshold = SENSITIVITY_MAP[sensitivity] || 8000;

      // --- FIX 1: Parse blacklist FIRST before using it ---
      let storedList = items.blacklist;
      let blacklist = [];
      if (storedList) {
        blacklist = storedList.map(item => {
          if (typeof item === 'string') {
            return { domain: item, enabled: true };
          }
          return item;
        });
      } else {
        blacklist = DEFAULT_BLACKLIST;
        chrome.storage.local.set({ blacklist: DEFAULT_BLACKLIST });
      }

      const isPomodoroWorkBlock = !!(pomodoroSession?.isActive && pomodoroSession.isRunning && pomodoroSession.phase === 'work');
      const isBlacklisted = blacklist.some(item =>
        (window.location.hostname === item.domain || window.location.hostname.endsWith('.' + item.domain)) && item.enabled === true
      );

      // --- FIX 2: Pomodoro work phase blocks ALL sites, not just blacklist ---
      // If protection is off, never run. Otherwise:
      // - If no pomodoro: only block blacklisted sites
      // - If pomodoro work phase active: block ALL sites (full focus mode)
      // - If pomodoro break/paused: only block blacklisted sites
      if (!isProtectionActive) {
        cleanup();
        return;
      }

      const shouldRun = isPomodoroWorkBlock || isBlacklisted;

      if (shouldRun) {
        init();
      } else {
        cleanup();
      }
    });
  }

  function handleStorageChanges(changes, namespace) {
    if (namespace !== 'local') return;

    if (changes.blacklist || changes.isProtectionActive || changes.sensitivity || changes.currentTask || changes.pomodoroSession) {
      checkAndSetEngine();
    }
    if (changes.pomodoroSession || changes.showFloatingWidget || changes.isProtectionActive) {
      renderPomodoroFloatingState();
    }
  }

  // --- LOGIC PART 6: FLOATING POMODORO OVERLAY (PILL + MODAL POPUP) ---
  let pomoRootContainer = null;
  let pomoShadowRootNode = null;
  let pomoTickerIntervalId = null;
  let isPomoModalOpen = false;
  let isPomoHiddenByUser = false;

  function injectPomodoroFloatingWidget() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          renderPomodoroFloatingState();
        }, { once: true });
        return;
      }
      return;
    }

    if (pomoRootContainer && pomoRootContainer.isConnected) return;

    if (!pomoRootContainer) {
      pomoRootContainer = document.createElement('adhd-pomodoro-floating-root');
      pomoShadowRootNode = pomoRootContainer.attachShadow({ mode: 'closed' });

      const linkElement = document.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = chrome.runtime.getURL('src/overlay.css');
      pomoShadowRootNode.appendChild(linkElement);

      const wrapper = document.createElement('div');
      wrapper.className = 'adhd-pomo-wrapper';
      wrapper.id = 'adhd-pomo-wrapper';

      wrapper.innerHTML = `
        <!-- Minimalist Floating Pill Badge -->
        <div class="adhd-pomo-pill" id="adhd-pomo-pill" title="Klik untuk membuka menu Pomodoro & Target Task">
          <span class="adhd-pomo-pill-dot" id="adhd-pomo-pill-dot"></span>
          <span class="adhd-pomo-pill-phase" id="adhd-pomo-pill-phase">Focus</span>
          <span class="adhd-pomo-pill-time" id="adhd-pomo-pill-time">25:00</span>
        </div>

        <!-- Glassmorphic Modal Popover (Opens on pill click) -->
        <div class="adhd-pomo-modal hidden" id="adhd-pomo-modal">
          <div class="adhd-pomo-modal-header">
            <div class="adhd-pomo-status-badge work" id="adhd-pomo-badge">
              <span class="adhd-pomo-dot"></span>
              <span id="adhd-pomo-badge-text">Focus Work</span>
            </div>
            <button class="adhd-pomo-btn-icon" id="adhd-pomo-btn-close-modal" title="Tutup Menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Active Task Display -->
          <div class="adhd-pomo-task-box">
            <span class="adhd-pomo-task-label">🎯 Target Saat Ini</span>
            <div class="adhd-pomo-task-text" id="adhd-pomo-task-text">Belum ada tugas aktif</div>
          </div>

          <!-- Countdown Timer -->
          <div class="adhd-pomo-timer-display" id="adhd-pomo-modal-time">25:00</div>

          <!-- Controls Column -->
          <div class="adhd-pomo-modal-actions">
            <div style="display: flex; gap: 6px;">
              <button class="adhd-pomo-ctrl-btn btn-toggle-run" id="adhd-pomo-btn-toggle" style="flex: 1;">Pause</button>
              <button class="adhd-pomo-ctrl-btn btn-skip-phase" id="adhd-pomo-btn-skip" style="flex: 1;">Skip ➔</button>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="adhd-pomo-ctrl-btn btn-done-task" id="adhd-pomo-btn-done" style="flex: 1; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399;">Selesai Tugas ✓</button>
              <button class="adhd-pomo-ctrl-btn btn-stop-session" id="adhd-pomo-btn-stop" style="flex: 1; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5;">Stop Sesi</button>
            </div>
          </div>
        </div>
      `;

      pomoShadowRootNode.appendChild(wrapper);
      setupPomoPillDragAndClick(wrapper);

      const btnCloseModal = pomoShadowRootNode.getElementById('adhd-pomo-btn-close-modal');
      const btnToggle = pomoShadowRootNode.getElementById('adhd-pomo-btn-toggle');
      const btnSkip = pomoShadowRootNode.getElementById('adhd-pomo-btn-skip');
      const btnDone = pomoShadowRootNode.getElementById('adhd-pomo-btn-done');
      const btnStop = pomoShadowRootNode.getElementById('adhd-pomo-btn-stop');

      btnCloseModal.addEventListener('click', (e) => {
        e.stopPropagation();
        closePomoModal();
      });

      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePomoToggleClick();
      });

      btnSkip.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePomoSkipClick();
      });

      btnDone.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePomoDoneClick();
      });

      btnStop.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePomoStopClick();
      });
    }

    if (!pomoRootContainer.isConnected) {
      document.body.appendChild(pomoRootContainer);
    }
  }

  function togglePomoModal() {
    isPomoModalOpen = !isPomoModalOpen;
    if (!pomoShadowRootNode) return;
    const modal = pomoShadowRootNode.getElementById('adhd-pomo-modal');
    if (isPomoModalOpen) {
      modal.classList.remove('hidden');
      refreshTaskTextInModal();
    } else {
      modal.classList.add('hidden');
    }
  }

  function closePomoModal() {
    isPomoModalOpen = false;
    if (pomoShadowRootNode) {
      const modal = pomoShadowRootNode.getElementById('adhd-pomo-modal');
      modal?.classList.add('hidden');
    }
  }

  function refreshTaskTextInModal() {
    if (!isContextValid() || !pomoShadowRootNode) return;
    chrome.storage.local.get(['currentTask'], (items) => {
      const taskTextEl = pomoShadowRootNode.getElementById('adhd-pomo-task-text');
      if (taskTextEl) {
        taskTextEl.textContent = items.currentTask?.trim() ? items.currentTask : "Belum ada tugas spesifik";
      }
    });
  }

  function setupPomoPillDragAndClick(wrapperEl) {
    const pillEl = pomoShadowRootNode.getElementById('adhd-pomo-pill');
    let isDragging = false;
    let dragDistance = 0;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    try {
      const savedPos = localStorage.getItem('adhd_pomo_floating_pos');
      if (savedPos) {
        const { left, top } = JSON.parse(savedPos);
        wrapperEl.style.left = `${left}px`;
        wrapperEl.style.top = `${top}px`;
        wrapperEl.style.right = 'auto';
        wrapperEl.style.bottom = 'auto';
      }
    } catch (e) {}

    const onMouseDown = (e) => {
      if (e.target.closest('button')) return;
      isDragging = false;
      dragDistance = 0;
      startX = e.clientX;
      startY = e.clientY;

      const rect = wrapperEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      dragDistance = Math.hypot(dx, dy);

      if (dragDistance > 5) {
        isDragging = true;
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const maxLeft = Math.max(10, window.innerWidth - wrapperEl.offsetWidth - 10);
        const maxTop = Math.max(10, window.innerHeight - wrapperEl.offsetHeight - 10);
        newLeft = Math.max(10, Math.min(maxLeft, newLeft));
        newTop = Math.max(10, Math.min(maxTop, newTop));

        wrapperEl.style.left = `${newLeft}px`;
        wrapperEl.style.top = `${newTop}px`;
        wrapperEl.style.right = 'auto';
        wrapperEl.style.bottom = 'auto';
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isDragging) {
        const rect = wrapperEl.getBoundingClientRect();
        try {
          localStorage.setItem('adhd_pomo_floating_pos', JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
        } catch (e) {}
      } else {
        togglePomoModal();
      }
    };

    pillEl.addEventListener('mousedown', onMouseDown);
  }

  function formatFloatingTime(totalSeconds) {
    const safeSec = Math.max(0, Math.floor(totalSeconds));
    const m = String(Math.floor(safeSec / 60)).padStart(2, '0');
    const s = String(safeSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function getFloatingRemainingSeconds(session) {
    if (!session || !session.isActive) return 0;
    if (!session.isRunning) {
      return session.pausedRemainingSeconds != null ? session.pausedRemainingSeconds : 0;
    }
    if (!session.targetTimestamp) return 0;
    return Math.max(0, Math.ceil((session.targetTimestamp - Date.now()) / 1000));
  }

  function renderPomodoroFloatingState() {
    if (!isContextValid()) return;

    chrome.storage.local.get(['pomodoroSession', 'showFloatingWidget', 'currentTask', 'isProtectionActive'], (items) => {
      if (chrome.runtime.lastError) return;
      const isProtectionActive = items.isProtectionActive !== false;
      const session = items.pomodoroSession;
      const showWidget = items.showFloatingWidget !== false;

      const shouldDisplay = isProtectionActive && showWidget && !isPomoHiddenByUser && session && session.isActive;

      if (!shouldDisplay) {
        if (pomoRootContainer) {
          pomoRootContainer.remove();
          pomoRootContainer = null;
          pomoShadowRootNode = null;
        }
        if (pomoTickerIntervalId) {
          clearInterval(pomoTickerIntervalId);
          pomoTickerIntervalId = null;
        }
        return;
      }

      injectPomodoroFloatingWidget();
      updatePomoFloatingUI(session, items.currentTask);

      if (!pomoTickerIntervalId) {
        pomoTickerIntervalId = setInterval(() => {
          if (!isContextValid()) {
            if (pomoTickerIntervalId) clearInterval(pomoTickerIntervalId);
            return;
          }
          chrome.storage.local.get(['pomodoroSession', 'currentTask'], (tItems) => {
            if (tItems.pomodoroSession) {
              updatePomoFloatingUI(tItems.pomodoroSession, tItems.currentTask);
            }
          });
        }, 1000);
      }
    });
  }

  function updatePomoFloatingUI(session, activeTaskText) {
    if (!pomoShadowRootNode || !session) return;

    const pillDotEl = pomoShadowRootNode.getElementById('adhd-pomo-pill-dot');
    const pillPhaseEl = pomoShadowRootNode.getElementById('adhd-pomo-pill-phase');
    const pillTimeEl = pomoShadowRootNode.getElementById('adhd-pomo-pill-time');

    const badgeEl = pomoShadowRootNode.getElementById('adhd-pomo-badge');
    const badgeTextEl = pomoShadowRootNode.getElementById('adhd-pomo-badge-text');
    const modalTimeEl = pomoShadowRootNode.getElementById('adhd-pomo-modal-time');
    const taskTextEl = pomoShadowRootNode.getElementById('adhd-pomo-task-text');
    const btnToggle = pomoShadowRootNode.getElementById('adhd-pomo-btn-toggle');

    const isBreak = session.phase === 'break';
    if (isBreak) {
      if (pillDotEl) pillDotEl.className = 'adhd-pomo-pill-dot break';
      if (pillPhaseEl) pillPhaseEl.textContent = 'Break';
      if (badgeEl && badgeTextEl) {
        badgeEl.className = 'adhd-pomo-status-badge break';
        badgeTextEl.textContent = 'Short Break';
      }
    } else {
      if (pillDotEl) pillDotEl.className = 'adhd-pomo-pill-dot';
      if (pillPhaseEl) pillPhaseEl.textContent = 'Focus';
      if (badgeEl && badgeTextEl) {
        badgeEl.className = 'adhd-pomo-status-badge work';
        badgeTextEl.textContent = 'Focus Work';
      }
    }

    const remSec = getFloatingRemainingSeconds(session);
    const timeStr = formatFloatingTime(remSec);
    if (pillTimeEl) pillTimeEl.textContent = timeStr;
    if (modalTimeEl) modalTimeEl.textContent = timeStr;

    if (taskTextEl && activeTaskText !== undefined) {
      taskTextEl.textContent = activeTaskText?.trim() ? activeTaskText : "Belum ada tugas spesifik";
    }

    if (btnToggle) {
      btnToggle.textContent = session.isRunning ? 'Pause' : 'Lanjut';
    }
  }

  function handlePomoToggleClick() {
    if (!isContextValid()) return;
    chrome.storage.local.get(['pomodoroSession'], (items) => {
      const session = items.pomodoroSession;
      if (!session) return;

      if (session.isRunning) {
        const remSec = getFloatingRemainingSeconds(session);
        session.isRunning = false;
        session.pausedRemainingSeconds = remSec;
        session.targetTimestamp = null;
      } else {
        const remSec = session.pausedRemainingSeconds != null ? session.pausedRemainingSeconds : ((session.plan?.[session.currentIndex]?.minutes || 25) * 60);
        session.isRunning = true;
        session.targetTimestamp = Date.now() + (remSec * 1000);
        session.pausedRemainingSeconds = null;
      }

      chrome.storage.local.set({ pomodoroSession: session }, () => {
        renderPomodoroFloatingState();
      });
    });
  }

  function handlePomoSkipClick() {
    if (!isContextValid()) return;
    chrome.storage.local.get(['pomodoroSession'], (items) => {
      const session = items.pomodoroSession;
      if (!session || !session.plan) return;

      const nextIndex = session.currentIndex + 1;
      if (nextIndex < session.plan.length) {
        const nextBlock = session.plan[nextIndex];
        const durationSec = nextBlock.minutes * 60;
        session.currentIndex = nextIndex;
        session.phase = nextBlock.type;
        session.targetTimestamp = session.isRunning ? (Date.now() + durationSec * 1000) : null;
        session.pausedRemainingSeconds = session.isRunning ? null : durationSec;
      } else {
        session.isActive = false;
        session.isRunning = false;
        session.phase = 'done';
        session.targetTimestamp = null;
        session.pausedRemainingSeconds = 0;
      }

      chrome.storage.local.set({ pomodoroSession: session }, () => {
        renderPomodoroFloatingState();
      });
    });
  }

  function handlePomoDoneClick() {
    if (!isContextValid()) return;
    chrome.storage.local.get(['magicTaskState', 'pomodoroSession', 'refocusCount', 'pomodoroWorkMinutes', 'pomodoroBreakMinutes', 'currentTask'], (items) => {
      const state = items.magicTaskState;
      let session = items.pomodoroSession;
      const count = items.refocusCount || 0;

      let nextTaskText = '';
      let nextDurationMinutes = items.pomodoroWorkMinutes || 25;
      let isFinishedAll = false;

      if (state && state.steps && state.steps.length) {
        const curIdx = typeof state.currentStepIndex === 'number' ? state.currentStepIndex : 0;
        const nxtIdx = curIdx + 1;

        if (nxtIdx < state.steps.length) {
          state.currentStepIndex = nxtIdx;
          nextTaskText = state.steps[nxtIdx].text;
          nextDurationMinutes = state.steps[nxtIdx].minutes || items.pomodoroWorkMinutes || 25;
        } else {
          state.completed = true;
          state.currentStepIndex = state.steps.length;
          isFinishedAll = true;
          nextTaskText = '';
        }
      }

      if (session && session.isActive) {
        if (isFinishedAll) {
          const breakM = items.pomodoroBreakMinutes || 5;
          session.phase = 'break';
          session.targetTimestamp = session.isRunning ? (Date.now() + breakM * 60 * 1000) : null;
          session.pausedRemainingSeconds = session.isRunning ? null : (breakM * 60);
        } else {
          session.phase = 'work';
          session.targetTimestamp = session.isRunning ? (Date.now() + nextDurationMinutes * 60 * 1000) : null;
          session.pausedRemainingSeconds = session.isRunning ? null : (nextDurationMinutes * 60);
        }
      }

      chrome.storage.local.set({
        magicTaskState: state,
        currentTask: nextTaskText,
        pomodoroSession: session,
        refocusCount: count + 1
      }, () => {
        refreshTaskTextInModal();
        renderPomodoroFloatingState();
      });
    });
  }

  function handlePomoStopClick() {
    if (!isContextValid()) return;
    chrome.storage.local.set({ pomodoroSession: null }, () => {
      renderPomodoroFloatingState();
    });
  }

  // Listen for simulated socket broadcasts from background.js
  if (isContextValid()) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'DOOMSCROLL_SERVER_ACK') {
        console.log(`%c[Content Script] Simulated Cross-Platform Sync Received for Domain: ${message.domain}`, "color: #10b981; font-weight: bold;");
      }
    });
  }

  checkAndSetEngine();
  renderPomodoroFloatingState();

  chrome.storage.onChanged.addListener(handleStorageChanges);
})();


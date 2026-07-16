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
    linkElement.href = chrome.runtime.getURL('overlay.css');
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

  function isOverlayVisible() {
    if (!rootContainer || !shadowRootNode) return false;
    const overlay = shadowRootNode.querySelector('.focus-overlay');
    return overlay && overlay.classList.contains('visible');
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

    setTimeout(() => {
      if (shadowRootNode) {
        const overlay = shadowRootNode.querySelector('.focus-overlay');
        if (overlay) overlay.classList.add('visible');
      }
    }, 50);
  }

  function handleKeepWorking(e) {
    e.stopPropagation();
    if (shadowRootNode) {
      const overlay = shadowRootNode.querySelector('.focus-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
      }
    }
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
      'currentTask'
    ], (items) => {
      if (chrome.runtime.lastError) return;

      isProtectionActive = items.isProtectionActive !== false;
      currentTask = items.currentTask || '';

      const sensitivity = items.sensitivity || 'balanced';
      doomscrollThreshold = SENSITIVITY_MAP[sensitivity] || 8000;

      if (!isProtectionActive) {
        cleanup();
        return;
      }

      let storedList = items.blacklist;
      let blacklist = [];
      if (storedList) {
        // Upgrade legacy flat string formats if encountered
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

      const currentHost = window.location.hostname;

      // Target matches if domain matches AND domain is set to active (enabled === true)
      const isBlacklisted = blacklist.some(item =>
        (currentHost === item.domain || currentHost.endsWith('.' + item.domain)) && item.enabled === true
      );

      if (isBlacklisted) {
        init();
      } else {
        cleanup();
      }
    });
  }

  function handleStorageChanges(changes, namespace) {
    if (namespace !== 'local') return;

    if (changes.blacklist || changes.isProtectionActive || changes.sensitivity || changes.currentTask) {
      checkAndSetEngine();
    }
  }

  checkAndSetEngine();

  chrome.storage.onChanged.addListener(handleStorageChanges);
})();

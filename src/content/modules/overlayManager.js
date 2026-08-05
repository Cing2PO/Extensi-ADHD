/**
 * Overlay Manager Module - Manages Soft-Block Shadow DOM Overlay & Floating Pomodoro Widget
 */

export class OverlayManager {
  constructor({ onKeepWorking, onGetMeOut, onPomoAction }) {
    this.onKeepWorking = onKeepWorking;
    this.onGetMeOut = onGetMeOut;
    this.onPomoAction = onPomoAction;

    this.rootContainer = null;
    this.shadowRootNode = null;

    this.pomoRootContainer = null;
    this.pomoShadowRootNode = null;
    this.pomoTickerIntervalId = null;
    this.isPomoModalOpen = false;
    this.isPomoHiddenByUser = false;

    this.blockScroll = this.blockScroll.bind(this);
    this.blockScrollKeys = this.blockScrollKeys.bind(this);
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  isContextValid() {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  }

  // --- SOFT-BLOCK OVERLAY ---
  injectOverlay(currentTask = '') {
    if (this.rootContainer) return;

    this.rootContainer = document.createElement('adhd-standalone-root');
    this.rootContainer.style.position = 'fixed';
    this.rootContainer.style.zIndex = '2147483647';
    this.rootContainer.style.top = '0';
    this.rootContainer.style.left = '0';

    this.shadowRootNode = this.rootContainer.attachShadow({ mode: 'closed' });

    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = chrome.runtime.getURL('src/overlay.css');
    this.shadowRootNode.appendChild(linkElement);

    const overlayMarkup = document.createElement('div');
    overlayMarkup.className = 'focus-overlay';

    let promptText = "You seem to be caught in a loop. Is this helpful right now?";
    if (currentTask.trim().length > 0) {
      promptText = `You seem to be caught in a loop. You planned to focus on: <strong>"${this.escapeHtml(currentTask)}"</strong>. Is this helpful right now?`;
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

    this.shadowRootNode.appendChild(overlayMarkup);
    document.body.appendChild(this.rootContainer);

    this.shadowRootNode.getElementById('btn-working').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideOverlay();
      if (this.onKeepWorking) this.onKeepWorking();
    });

    this.shadowRootNode.getElementById('btn-exit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.disableScrollBlock();
      if (this.onGetMeOut) this.onGetMeOut();
      else window.location.href = 'about:blank';
    });
  }

  isOverlayVisible() {
    if (!this.rootContainer || !this.shadowRootNode) return false;
    const overlay = this.shadowRootNode.querySelector('.focus-overlay');
    return overlay && overlay.classList.contains('visible');
  }

  showOverlay(currentTask = '') {
    this.injectOverlay(currentTask);

    const descEl = this.shadowRootNode?.getElementById('focus-desc');
    if (descEl) {
      if (currentTask.trim().length > 0) {
        descEl.innerHTML = `You seem to be caught in a loop. You planned to focus on: <strong>"${this.escapeHtml(currentTask)}"</strong>. Is this helpful right now?`;
      } else {
        descEl.textContent = "You seem to be caught in a loop. Is this helpful right now?";
      }
    }

    setTimeout(() => {
      if (this.shadowRootNode) {
        const overlay = this.shadowRootNode.querySelector('.focus-overlay');
        if (overlay) {
          overlay.classList.add('visible');
          this.enableScrollBlock();
        }
      }
    }, 50);
  }

  hideOverlay() {
    if (this.shadowRootNode) {
      const overlay = this.shadowRootNode.querySelector('.focus-overlay');
      if (overlay) overlay.classList.remove('visible');
    }
    this.disableScrollBlock();
  }

  removeOverlay() {
    if (this.rootContainer) {
      this.disableScrollBlock();
      this.rootContainer.remove();
      this.rootContainer = null;
      this.shadowRootNode = null;
    }
  }

  blockScroll(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  blockScrollKeys(e) {
    const scrollKeys = ['ArrowDown', 'ArrowUp', ' ', 'PageDown', 'PageUp', 'Home', 'End'];
    if (scrollKeys.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  enableScrollBlock() {
    document.addEventListener('wheel', this.blockScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', this.blockScroll, { passive: false, capture: true });
    document.addEventListener('keydown', this.blockScrollKeys, { capture: true });
    document.body.style.overflow = 'hidden';
  }

  disableScrollBlock() {
    document.removeEventListener('wheel', this.blockScroll, { capture: true });
    document.removeEventListener('touchmove', this.blockScroll, { capture: true });
    document.removeEventListener('keydown', this.blockScrollKeys, { capture: true });
    document.body.style.overflow = '';
  }

  // --- FLOATING POMODORO WIDGET ---
  injectPomodoroFloatingWidget() {
    const targetParent = document.body || document.documentElement;
    if (!targetParent) return;
    if (this.pomoRootContainer && this.pomoRootContainer.isConnected) return;

    if (!this.pomoRootContainer) {
      this.pomoRootContainer = document.createElement('adhd-pomodoro-floating-root');
      this.pomoRootContainer.style.position = 'fixed';
      this.pomoRootContainer.style.top = '0';
      this.pomoRootContainer.style.left = '0';
      this.pomoRootContainer.style.width = '0';
      this.pomoRootContainer.style.height = '0';
      this.pomoRootContainer.style.zIndex = '2147483646';
      this.pomoRootContainer.style.display = 'block';
      this.pomoRootContainer.style.pointerEvents = 'none';

      this.pomoShadowRootNode = this.pomoRootContainer.attachShadow({ mode: 'closed' });

      const linkElement = document.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = chrome.runtime.getURL('src/overlay.css');
      this.pomoShadowRootNode.appendChild(linkElement);

      const wrapper = document.createElement('div');
      wrapper.className = 'adhd-pomo-wrapper';
      wrapper.id = 'adhd-pomo-wrapper';
      wrapper.style.position = 'fixed';
      wrapper.style.bottom = '32px';
      wrapper.style.right = '32px';
      wrapper.style.zIndex = '2147483646';
      wrapper.style.pointerEvents = 'auto';

      wrapper.innerHTML = `
        <div class="adhd-pomo-pill" id="adhd-pomo-pill" title="Klik untuk membuka menu Pomodoro & Target Task">
          <span class="adhd-pomo-pill-dot" id="adhd-pomo-pill-dot"></span>
          <span class="adhd-pomo-pill-phase" id="adhd-pomo-pill-phase">Focus</span>
          <span class="adhd-pomo-pill-time" id="adhd-pomo-pill-time">25:00</span>
        </div>

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

          <div class="adhd-pomo-task-box">
            <span class="adhd-pomo-task-label">🎯 Target Saat Ini</span>
            <div class="adhd-pomo-task-text" id="adhd-pomo-task-text">Belum ada tugas aktif</div>
          </div>

          <div class="adhd-pomo-timer-display" id="adhd-pomo-modal-time">25:00</div>

          <div class="adhd-pomo-debug-box" style="margin-bottom: 10px; padding: 8px 10px; background: rgba(20, 184, 166, 0.08); border: 1px dashed rgba(45, 212, 191, 0.3); border-radius: 10px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; align-items: center; color: #2dd4bf; font-weight: 700;">
              <span>🔍 Sensor Website</span>
              <span id="adhd-pomo-debug-domain" style="color: #f1f5f9; font-weight: 600;">mendeteksi...</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: #94a3b8; margin-top: 4px; font-size: 10px;">
              <span>📜 Scroll / Swipe:</span>
              <span id="adhd-pomo-debug-scroll" style="color: #34d399; font-weight: 700;">0 px</span>
            </div>
          </div>

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

      this.pomoShadowRootNode.appendChild(wrapper);
      this.setupPomoPillDragAndClick(wrapper);

      this.pomoShadowRootNode.getElementById('adhd-pomo-btn-close-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePomoModal();
      });

      this.pomoShadowRootNode.getElementById('adhd-pomo-btn-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onPomoAction) this.onPomoAction('toggle');
      });

      this.pomoShadowRootNode.getElementById('adhd-pomo-btn-skip').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onPomoAction) this.onPomoAction('skip');
      });

      this.pomoShadowRootNode.getElementById('adhd-pomo-btn-done').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onPomoAction) this.onPomoAction('done');
      });

      this.pomoShadowRootNode.getElementById('adhd-pomo-btn-stop').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onPomoAction) this.onPomoAction('stop');
      });
    }

    if (!this.pomoRootContainer.isConnected) {
      targetParent.appendChild(this.pomoRootContainer);
    }
  }

  togglePomoModal() {
    this.isPomoModalOpen = !this.isPomoModalOpen;
    if (!this.pomoShadowRootNode) return;
    const modal = this.pomoShadowRootNode.getElementById('adhd-pomo-modal');
    if (this.isPomoModalOpen) {
      modal?.classList.remove('hidden');
    } else {
      modal?.classList.add('hidden');
    }
  }

  closePomoModal() {
    this.isPomoModalOpen = false;
    if (this.pomoShadowRootNode) {
      const modal = this.pomoShadowRootNode.getElementById('adhd-pomo-modal');
      modal?.classList.add('hidden');
    }
  }

  setupPomoPillDragAndClick(wrapperEl) {
    const pillEl = this.pomoShadowRootNode.getElementById('adhd-pomo-pill');
    let isDragging = false;
    let dragDistance = 0;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    try {
      const savedPos = localStorage.getItem('adhd_pomo_floating_pos');
      if (savedPos) {
        const { left, top } = JSON.parse(savedPos);
        if (typeof left === 'number' && typeof top === 'number' && left >= 0 && top >= 0 && left < (window.innerWidth - 60) && top < (window.innerHeight - 30)) {
          wrapperEl.style.left = `${left}px`;
          wrapperEl.style.top = `${top}px`;
          wrapperEl.style.right = 'auto';
          wrapperEl.style.bottom = 'auto';
        } else {
          localStorage.removeItem('adhd_pomo_floating_pos');
        }
      }
    } catch (e) { }

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
        } catch (e) { }
      } else {
        this.togglePomoModal();
      }
    };

    pillEl.addEventListener('mousedown', onMouseDown);
  }

  updatePomoFloatingUI(session, activeTaskText) {
    if (!this.pomoShadowRootNode || !session) return;

    const pillDotEl = this.pomoShadowRootNode.getElementById('adhd-pomo-pill-dot');
    const pillPhaseEl = this.pomoShadowRootNode.getElementById('adhd-pomo-pill-phase');
    const pillTimeEl = this.pomoShadowRootNode.getElementById('adhd-pomo-pill-time');

    const badgeEl = this.pomoShadowRootNode.getElementById('adhd-pomo-badge');
    const badgeTextEl = this.pomoShadowRootNode.getElementById('adhd-pomo-badge-text');
    const modalTimeEl = this.pomoShadowRootNode.getElementById('adhd-pomo-modal-time');
    const taskTextEl = this.pomoShadowRootNode.getElementById('adhd-pomo-task-text');
    const btnToggle = this.pomoShadowRootNode.getElementById('adhd-pomo-btn-toggle');

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

    const remSec = this.getFloatingRemainingSeconds(session);
    const timeStr = this.formatFloatingTime(remSec);
    if (pillTimeEl) pillTimeEl.textContent = timeStr;
    if (modalTimeEl) modalTimeEl.textContent = timeStr;

    if (taskTextEl && activeTaskText !== undefined) {
      taskTextEl.textContent = activeTaskText?.trim() ? activeTaskText : "Belum ada tugas spesifik";
    }

    if (btnToggle) {
      btnToggle.textContent = session.isRunning ? 'Pause' : 'Lanjut';
    }
  }

  updatePomoFloatingDebug(metrics) {
    if (!this.pomoShadowRootNode || !metrics) return;
    const domainEl = this.pomoShadowRootNode.getElementById('adhd-pomo-debug-domain');
    const scrollEl = this.pomoShadowRootNode.getElementById('adhd-pomo-debug-scroll');
    if (domainEl && metrics.domain) {
      domainEl.textContent = metrics.domain;
    }
    if (scrollEl && metrics.totalScrollPx !== undefined) {
      scrollEl.textContent = `${metrics.totalScrollPx.toLocaleString()} px (pos: ${metrics.scrollY || 0}px)`;
    }
  }

  getFloatingRemainingSeconds(session) {
    if (!session || !session.isActive) return 0;
    if (!session.isRunning) {
      return session.pausedRemainingSeconds != null ? session.pausedRemainingSeconds : 0;
    }
    if (!session.targetTimestamp) return 0;
    return Math.max(0, Math.ceil((session.targetTimestamp - Date.now()) / 1000));
  }

  formatFloatingTime(totalSeconds) {
    const safeSec = Math.max(0, Math.floor(totalSeconds));
    const m = String(Math.floor(safeSec / 60)).padStart(2, '0');
    const s = String(safeSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  removePomodoroWidget() {
    if (this.pomoRootContainer) {
      this.pomoRootContainer.remove();
      this.pomoRootContainer = null;
      this.pomoShadowRootNode = null;
    }
    if (this.pomoTickerIntervalId) {
      clearInterval(this.pomoTickerIntervalId);
      this.pomoTickerIntervalId = null;
    }
  }
}

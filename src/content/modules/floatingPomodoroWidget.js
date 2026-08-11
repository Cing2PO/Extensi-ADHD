/**
 * Floating Pomodoro Widget Module - Manages the draggable floating timer pill on web pages
 * 
 * Renders a Shadow DOM floating widget that shows the current Pomodoro timer state,
 * with a collapsible modal for controls (pause, skip, done, stop).
 * 
 * Extracted from overlayManager.js for single-responsibility separation.
 */

import { formatPomodoroTime, getPomodoroRemainingSeconds } from '../../shared/pomodoroUtils.js';

export class FloatingPomodoroWidget {
  constructor({ onPomoAction }) {
    this.onPomoAction = onPomoAction;

    this.pomoRootContainer = null;
    this.pomoShadowRootNode = null;
    this.pomoTickerIntervalId = null;
    this.isPomoModalOpen = false;
    this.isPomoHiddenByUser = false;
  }

  isContextValid() {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  }

  injectWidget() {
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
            <span class="adhd-pomo-task-label" style="display:flex;align-items:center;gap:4px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              Target Saat Ini
            </span>
            <div class="adhd-pomo-task-text" id="adhd-pomo-task-text">Belum ada tugas aktif</div>
          </div>

          <div class="adhd-pomo-timer-display" id="adhd-pomo-modal-time">25:00</div>

          <div class="adhd-pomo-debug-box" style="margin-bottom: 10px; padding: 8px 10px; background: rgba(42, 198, 122, 0.08); border: 1px dashed rgba(42, 198, 122, 0.3); border-radius: 10px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; align-items: center; color: #2ac67a; font-weight: 700;">
              <span style="display:flex;align-items:center;gap:4px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                Sensor Website
              </span>
              <span id="adhd-pomo-debug-domain" style="color: #f1f5f9; font-weight: 600;">mendeteksi...</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: #94a3b8; margin-top: 4px; font-size: 10px;">
              <span>Scroll / Swipe:</span>
              <span id="adhd-pomo-debug-scroll" style="color: #2ac67a; font-weight: 700;">0 px</span>
            </div>
          </div>

          <div class="adhd-pomo-modal-actions">
            <div style="display: flex; gap: 6px;">
              <button class="adhd-pomo-ctrl-btn btn-toggle-run" id="adhd-pomo-btn-toggle" style="flex: 1;">Pause</button>
              <button class="adhd-pomo-ctrl-btn btn-skip-phase" id="adhd-pomo-btn-skip" style="flex: 1;">Skip ➔</button>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="adhd-pomo-ctrl-btn btn-done-task" id="adhd-pomo-btn-done" style="flex: 1; background: rgba(42, 198, 122, 0.2); border: 1px solid rgba(42, 198, 122, 0.4); color: #2ac67a;">Selesai Tugas</button>
              <button class="adhd-pomo-ctrl-btn btn-stop-session" id="adhd-pomo-btn-stop" style="flex: 1; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5;">Stop Sesi</button>
            </div>
          </div>
        </div>
      `;

      this.pomoShadowRootNode.appendChild(wrapper);
      this.setupPillDragAndClick(wrapper);

      this.pomoShadowRootNode.getElementById('adhd-pomo-btn-close-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeModal();
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

  toggleModal() {
    this.isPomoModalOpen = !this.isPomoModalOpen;
    if (!this.pomoShadowRootNode) return;
    const modal = this.pomoShadowRootNode.getElementById('adhd-pomo-modal');
    if (this.isPomoModalOpen) {
      modal?.classList.remove('hidden');
    } else {
      modal?.classList.add('hidden');
    }
  }

  closeModal() {
    this.isPomoModalOpen = false;
    if (this.pomoShadowRootNode) {
      const modal = this.pomoShadowRootNode.getElementById('adhd-pomo-modal');
      modal?.classList.add('hidden');
    }
  }

  setupPillDragAndClick(wrapperEl) {
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
        this.toggleModal();
      }
    };

    pillEl.addEventListener('mousedown', onMouseDown);
  }

  updateUI(session, activeTaskText) {
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

    const remSec = getPomodoroRemainingSeconds(session);
    const timeStr = formatPomodoroTime(remSec);
    if (pillTimeEl) pillTimeEl.textContent = timeStr;
    if (modalTimeEl) modalTimeEl.textContent = timeStr;

    if (taskTextEl && activeTaskText !== undefined) {
      taskTextEl.textContent = activeTaskText?.trim() ? activeTaskText : "Belum ada tugas spesifik";
    }

    if (btnToggle) {
      btnToggle.textContent = session.isRunning ? 'Pause' : 'Lanjut';
    }
  }

  updateDebug(metrics) {
    if (!this.pomoShadowRootNode || !metrics) return;
    const domainEl = this.pomoShadowRootNode.getElementById('adhd-pomo-debug-domain');
    const scrollEl = this.pomoShadowRootNode.getElementById('adhd-pomo-debug-scroll');
    if (domainEl && metrics.domain) {
      domainEl.textContent = metrics.domain;
    }
    if (scrollEl) {
      if (metrics.isShortVideo) {
        scrollEl.textContent = `${metrics.swipeCount || 0} Video (${(metrics.totalScrollPx || 0).toLocaleString()} px)`;
      } else if (metrics.totalScrollPx !== undefined) {
        scrollEl.textContent = `${(metrics.totalScrollPx || 0).toLocaleString()} px (pos: ${metrics.scrollY || 0}px)`;
      }
    }
  }

  removeWidget() {
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

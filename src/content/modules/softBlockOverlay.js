/**
 * Soft-Block Overlay Module - Manages the distraction intervention overlay
 * 
 * Renders a Shadow DOM overlay that blocks the page when doomscrolling is detected.
 * Users can acknowledge ("Yes, I am working") or exit ("No, get me out").
 * 
 * Extracted from overlayManager.js for single-responsibility separation.
 */

export class SoftBlockOverlay {
  constructor({ onKeepWorking, onGetMeOut }) {
    this.onKeepWorking = onKeepWorking;
    this.onGetMeOut = onGetMeOut;

    this.rootContainer = null;
    this.shadowRootNode = null;

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

    let promptText = "Sistem mendeteksi aktivitas doomscrolling tanpa sadar. Mari istirahatkan pikiranmu sejenak.";
    if (currentTask.trim().length > 0) {
      promptText = `Sistem mendeteksi aktivitas browsing di luar fokus. Tugas aktif Anda: <strong>"${this.escapeHtml(currentTask)}"</strong>. Apakah Anda ingin kembali fokus?`;
    }

    overlayMarkup.innerHTML = `
      <div class="focus-card">
        <div class="focus-icon-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h2 class="focus-title">Tarik Napas Sejenak...</h2>
        <div class="focus-subtitle" style="color: #38bdf8; font-size: 13px; font-weight: 700; margin-bottom: 16px; letter-spacing: 0.5px;">Anti-Doomscroll Shield</div>
        <p class="focus-description" id="focus-desc">${promptText}</p>
        <div class="focus-actions">
          <button class="focus-btn btn-working" id="btn-working">Kembali Fokus</button>
          <button class="focus-btn btn-exit" id="btn-exit">Tutup Halaman</button>
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
}

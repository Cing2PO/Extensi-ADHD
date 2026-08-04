/**
 * Rules Controller Module - Handles Blacklist Domain CRUD, Active Site Detection & Sensitivity Slider
 */

import { setStorage, SENSITIVITY_STEPS, SENSITIVITY_VALUES, DEFAULT_BLACKLIST } from '../services/storageService.js';
import { getSwalTheme } from '../modules/themeManager.js';

export function initRulesController({ onStartPomodoro }) {
  const protectionToggle = document.getElementById('protection-toggle');
  const sensitivitySlider = document.getElementById('sensitivity-slider');
  const sliderValLabel = document.getElementById('slider-val-label');

  const activeSiteLabel = document.getElementById('active-site-label');
  const activeHostDisplay = document.getElementById('active-host');
  const btnQuickToggle = document.getElementById('btn-quick-toggle');

  const addForm = document.getElementById('add-form');
  const manualDomainInput = document.getElementById('manual-domain-input');
  const blacklistScrollArea = document.getElementById('blacklist-scroll-area');

  const pomodoroWorkInput = document.getElementById('pomodoro-work-input');
  const pomodoroBreakInput = document.getElementById('pomodoro-break-input');
  const floatingPomodoroToggle = document.getElementById('floating-pomodoro-toggle');

  const btnStartQuickPomodoro = document.getElementById('btn-start-quick-pomodoro');
  const btnStartPomodoroRules = document.getElementById('btn-start-pomodoro-rules');

  let blacklist = [];
  let currentActiveDomain = null;

  // --- Auto-Sync Listeners ---
  if (protectionToggle) {
    protectionToggle.addEventListener('change', () => {
      setStorage({ isProtectionActive: protectionToggle.checked });
    });
  }

  if (floatingPomodoroToggle) {
    floatingPomodoroToggle.addEventListener('change', () => {
      setStorage({ showFloatingWidget: floatingPomodoroToggle.checked });
    });
  }

  if (pomodoroWorkInput) {
    pomodoroWorkInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(90, parseInt(pomodoroWorkInput.value, 10) || 25));
      pomodoroWorkInput.value = val;
      setStorage({ pomodoroWorkMinutes: val });
    });
  }

  if (pomodoroBreakInput) {
    pomodoroBreakInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(30, parseInt(pomodoroBreakInput.value, 10) || 5));
      pomodoroBreakInput.value = val;
      setStorage({ pomodoroBreakMinutes: val });
    });
  }

  if (sensitivitySlider) {
    sensitivitySlider.addEventListener('input', () => {
      const step = parseInt(sensitivitySlider.value, 10);
      const sensitivityString = SENSITIVITY_STEPS[step] || 'balanced';
      updateSliderLabel(sensitivityString);
      setStorage({ sensitivity: sensitivityString });
    });
  }

  function updateSliderLabel(val) {
    if (sliderValLabel) {
      sliderValLabel.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    }
  }

  // --- Quick Toggle Button & Domain Detection ---
  function extractDomainFromUrl(urlString) {
    try {
      const url = new URL(urlString);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      let host = url.hostname;
      if (host.startsWith('www.')) host = host.slice(4);
      return host;
    } catch (e) {
      return null;
    }
  }

  function setInactiveDomainState(message) {
    currentActiveDomain = null;
    if (activeSiteLabel) activeSiteLabel.textContent = "Current Context";
    if (activeHostDisplay) activeHostDisplay.textContent = message;
    if (btnQuickToggle) btnQuickToggle.style.display = 'none';
  }

  function updateQuickToggleButton() {
    if (!currentActiveDomain || !btnQuickToggle) return;
    const matched = blacklist.find(item => item.domain === currentActiveDomain);

    if (matched) {
      if (matched.enabled) {
        activeSiteLabel.textContent = "Focus Check: Restricting";
        btnQuickToggle.textContent = "Allow Site";
        btnQuickToggle.className = "btn-quick-toggle is-restricted";
      } else {
        activeSiteLabel.textContent = "Focus Check: Paused";
        btnQuickToggle.textContent = "Restrict Site";
        btnQuickToggle.className = "btn-quick-toggle is-allowed";
      }
    } else {
      activeSiteLabel.textContent = "Focus Check: Allowed";
      btnQuickToggle.textContent = "Restrict Site";
      btnQuickToggle.className = "btn-quick-toggle is-allowed";
    }
  }

  function detectActiveTabDomain() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
          setInactiveDomainState("Unable to detect tab context");
          return;
        }

        const url = tabs[0]?.url;
        if (!url) {
          setInactiveDomainState("Empty page context");
          return;
        }

        const domain = extractDomainFromUrl(url);
        if (!domain) {
          setInactiveDomainState("System / Browser Page");
          return;
        }

        currentActiveDomain = domain;
        if (activeHostDisplay) activeHostDisplay.textContent = domain;
        if (btnQuickToggle) btnQuickToggle.style.display = 'block';

        updateQuickToggleButton();
      });
    }
  }

  if (btnQuickToggle) {
    btnQuickToggle.addEventListener('click', () => {
      if (!currentActiveDomain) return;

      const matched = blacklist.find(item => item.domain === currentActiveDomain);
      if (matched) {
        matched.enabled = !matched.enabled;
      } else {
        blacklist.push({ domain: currentActiveDomain, enabled: true });
      }

      setStorage({ blacklist }).then(() => {
        updateQuickToggleButton();
        renderBlacklistArea();
      });
    });
  }

  // --- Blacklist Management ---
  function renderBlacklistArea() {
    if (!blacklistScrollArea) return;
    blacklistScrollArea.innerHTML = '';

    if (blacklist.length === 0) {
      blacklistScrollArea.innerHTML = '<div style="font-size: 11px; color:#64748b; text-align:center; padding:12px 0;">No restricted zones.</div>';
      return;
    }

    blacklist.forEach((itemObj) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'blacklist-item-clean';
      rowEl.style.marginTop = '4px';

      rowEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <svg style="width: 14px; height: 14px; color: #a78bfa; flex-shrink: 0; opacity: 0.85;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18" />
          </svg>
          <span class="domain-name" style="${itemObj.enabled ? '' : 'opacity: 0.45; text-decoration: line-through;'}">${itemObj.domain}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <label class="switch-small">
            <input type="checkbox" class="zone-toggle-cb">
            <span class="slider-small"></span>
          </label>
          <button class="btn-delete-zone" title="Delete restricted domain">
             <svg style="width: 13px; height: 13px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
             </svg>
          </button>
        </div>
      `;

      const domainSpan = rowEl.querySelector('.domain-name');
      const toggleInput = rowEl.querySelector('.zone-toggle-cb');
      toggleInput.checked = itemObj.enabled;

      toggleInput.addEventListener('change', () => {
        itemObj.enabled = toggleInput.checked;
        setStorage({ blacklist }).then(() => {
          if (itemObj.enabled) {
            domainSpan.style.opacity = '1';
            domainSpan.style.textDecoration = 'none';
          } else {
            domainSpan.style.opacity = '0.45';
            domainSpan.style.textDecoration = 'line-through';
          }
          updateQuickToggleButton();
        });
      });

      const deleteBtn = rowEl.querySelector('.btn-delete-zone');
      deleteBtn.addEventListener('click', () => {
        if (window.Swal) {
          window.Swal.fire({
            title: 'Hapus Zona?',
            text: `Apakah Anda yakin ingin menghapus '${itemObj.domain}' dari Restricted Zones?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal',
            ...getSwalTheme()
          }).then((result) => {
            if (result.isConfirmed) {
              const domainIndex = blacklist.findIndex(item => item.domain === itemObj.domain);
              if (domainIndex !== -1) {
                blacklist.splice(domainIndex, 1);
                setStorage({ blacklist }).then(() => {
                  renderBlacklistArea();
                  updateQuickToggleButton();
                  window.Swal.fire({
                    title: 'Dihapus!',
                    text: 'Domain berhasil dihapus.',
                    icon: 'success',
                    timer: 1000,
                    showConfirmButton: false,
                    ...getSwalTheme()
                  });
                });
              }
            }
          });
        }
      });

      blacklistScrollArea.appendChild(rowEl);
    });
  }

  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawVal = manualDomainInput.value.trim();
      if (!rawVal) return;

      let sanitized = rawVal.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
      sanitized = sanitized.split('/')[0].split('?')[0].split(':')[0];

      const parts = sanitized.split('.');
      if (parts.length < 2 || parts.some(p => p.length === 0)) {
        if (window.Swal) {
          window.Swal.fire({
            title: 'Domain Tidak Valid',
            text: 'Masukkan domain yang benar (misal: reddit.com)',
            icon: 'error',
            ...getSwalTheme()
          });
        }
        return;
      }

      const exists = blacklist.some(item => item.domain === sanitized);
      if (exists) {
        if (window.Swal) {
          window.Swal.fire({
            title: 'Domain Sudah Ada',
            text: 'Domain tersebut sudah masuk dalam restricted zones.',
            icon: 'warning',
            ...getSwalTheme()
          });
        }
        manualDomainInput.value = '';
        return;
      }

      blacklist.push({ domain: sanitized, enabled: true });
      manualDomainInput.value = '';

      setStorage({ blacklist }).then(() => {
        renderBlacklistArea();
        updateQuickToggleButton();
      });
    });
  }

  if (btnStartQuickPomodoro && onStartPomodoro) {
    btnStartQuickPomodoro.addEventListener('click', onStartPomodoro);
  }

  if (btnStartPomodoroRules && onStartPomodoro) {
    btnStartPomodoroRules.addEventListener('click', () => {
      onStartPomodoro();
      if (window.Swal) {
        window.Swal.fire({
          title: 'Pomodoro Dimulai!',
          text: 'Floating timer sekarang aktif melayang di halaman web Anda.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          ...getSwalTheme()
        });
      }
    });
  }

  function setInitialRules({ items }) {
    if (protectionToggle) {
      protectionToggle.checked = items.isProtectionActive !== false;
    }

    const sensitivity = items.sensitivity || 'balanced';
    const stepVal = SENSITIVITY_VALUES[sensitivity] || 2;
    if (sensitivitySlider) sensitivitySlider.value = stepVal;
    updateSliderLabel(sensitivity);

    let storedList = items.blacklist;
    if (storedList) {
      blacklist = storedList.map(item => {
        if (typeof item === 'string') return { domain: item, enabled: true };
        return item;
      });
    } else {
      blacklist = DEFAULT_BLACKLIST;
      setStorage({ blacklist: DEFAULT_BLACKLIST });
    }

    if (pomodoroWorkInput) pomodoroWorkInput.value = items.pomodoroWorkMinutes || 25;
    if (pomodoroBreakInput) pomodoroBreakInput.value = items.pomodoroBreakMinutes || 5;
    if (floatingPomodoroToggle) floatingPomodoroToggle.checked = items.showFloatingWidget !== false;

    renderBlacklistArea();
    detectActiveTabDomain();
  }

  return {
    setInitialRules,
    renderBlacklistArea,
    detectActiveTabDomain
  };
}

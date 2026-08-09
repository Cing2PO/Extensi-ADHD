/**
 * Rules Controller Module - Handles Blacklist Domain CRUD, Active Site Detection & Sensitivity Slider
 */

import { setStorage, SENSITIVITY_STEPS, SENSITIVITY_VALUES, DEFAULT_BLACKLIST } from '../services/storageService.js';
import { getSwalTheme } from '../modules/themeManager.js';

export function initRulesController({ onStartPomodoro }) {
  const protectionToggle = document.getElementById('protection-toggle');
  const guardMasterToggle = document.getElementById('guard-master-toggle');
  const sensitivitySlider = document.getElementById('sensitivity-slider');
  const sliderValLabel = document.getElementById('slider-val-label');

  const btnSettingsGear = document.getElementById('btn-settings-gear');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');

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

  // --- Horizontal Mouse Wheel Scroll for Blacklist ---
  if (blacklistScrollArea) {
    blacklistScrollArea.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        blacklistScrollArea.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // --- Auto-Sync Listeners ---
  if (protectionToggle) {
    protectionToggle.addEventListener('change', () => {
      setStorage({ isProtectionActive: protectionToggle.checked });
      if (guardMasterToggle) guardMasterToggle.checked = protectionToggle.checked;
    });
  }

  if (guardMasterToggle) {
    guardMasterToggle.addEventListener('change', () => {
      setStorage({ isProtectionActive: guardMasterToggle.checked });
      if (protectionToggle) protectionToggle.checked = guardMasterToggle.checked;
    });
  }

  function openSettingsModal() {
    if (settingsModal) settingsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  if (btnSettingsGear) {
    btnSettingsGear.addEventListener('click', openSettingsModal);
  }

  if (btnCloseSettingsModal) {
    btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
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

  // --- Blacklist Management (Horizontal 3-Row Grid) ---
  function renderBlacklistArea() {
    if (!blacklistScrollArea) return;
    blacklistScrollArea.innerHTML = '';

    const countBadge = document.getElementById('blacklist-count-badge');
    const activeCount = blacklist.filter(item => item.enabled).length;
    if (countBadge) {
      countBadge.textContent = `${activeCount}/${blacklist.length} Aktif`;
    }

    if (blacklist.length === 0) {
      blacklistScrollArea.innerHTML = '<div style="font-size: 10px; color:#64748b; text-align:center; padding:12px 0; width: 100%;">Belum ada domain blacklist.</div>';
      return;
    }

    const columnCount = Math.ceil(blacklist.length / 3);

    for (let colIdx = 0; colIdx < columnCount; colIdx++) {
      const colEl = document.createElement('div');
      colEl.className = 'blacklist-col';

      const startIdx = colIdx * 3;
      const endIdx = Math.min(startIdx + 3, blacklist.length);
      const chunk = blacklist.slice(startIdx, endIdx);

      chunk.forEach((itemObj) => {
        const itemEl = document.createElement('div');
        itemEl.className = `blacklist-item-compact ${itemObj.enabled ? 'is-blocked' : 'disabled'}`;

        itemEl.innerHTML = `
          <svg style="width: 12px; height: 12px; color: ${itemObj.enabled ? '#2dd4bf' : '#64748b'}; flex-shrink: 0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18" />
          </svg>
          <span class="domain-text" title="${itemObj.domain}">${itemObj.domain}</span>
          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <label class="switch-small" style="transform: scale(0.7); transform-origin: center;">
              <input type="checkbox" class="zone-toggle-cb" ${itemObj.enabled ? 'checked' : ''}>
              <span class="slider-small"></span>
            </label>
            <button class="btn-delete-zone" title="Hapus domain" style="background: none; border: none; padding: 2px; cursor: pointer; color: #ef4444; display: flex; align-items: center;">
               <svg style="width: 11px; height: 11px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
            </button>
          </div>
        `;

        const toggleInput = itemEl.querySelector('.zone-toggle-cb');
        toggleInput.addEventListener('change', () => {
          itemObj.enabled = toggleInput.checked;
          setStorage({ blacklist }).then(() => {
            if (itemObj.enabled) {
              itemEl.classList.add('is-blocked');
              itemEl.classList.remove('disabled');
            } else {
              itemEl.classList.remove('is-blocked');
              itemEl.classList.add('disabled');
            }
            if (countBadge) {
              const currentActive = blacklist.filter(i => i.enabled).length;
              countBadge.textContent = `${currentActive}/${blacklist.length} Aktif`;
            }
            updateQuickToggleButton();
          });
        });

        const deleteBtn = itemEl.querySelector('.btn-delete-zone');
        deleteBtn.addEventListener('click', () => {
          if (window.Swal) {
            window.Swal.fire({
              title: 'Hapus Domain?',
              text: `Hapus '${itemObj.domain}' dari Blacklist?`,
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Hapus',
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
                  });
                }
              }
            });
          } else {
            const domainIndex = blacklist.findIndex(item => item.domain === itemObj.domain);
            if (domainIndex !== -1) {
              blacklist.splice(domainIndex, 1);
              setStorage({ blacklist }).then(() => {
                renderBlacklistArea();
                updateQuickToggleButton();
              });
            }
          }
        });

        colEl.appendChild(itemEl);
      });

      blacklistScrollArea.appendChild(colEl);
    }
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
    if (guardMasterToggle) {
      guardMasterToggle.checked = items.isProtectionActive !== false;
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

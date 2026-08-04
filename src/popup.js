/**
 * ADHD Standalone Focus Coach - Popup Controller (Accordion Edition)
 * 
 * Manages click navigation between subpages, active tab domain checking,
 * range sensitivity mappings, and accordion list renders.
 */

// --- CONFIGURATION & API ENDPOINTS ---
const API_CONFIG = {
  get MAGIC_TODO_URL() {
    return (window.ENV_CONFIG && window.ENV_CONFIG.MAGIC_TODO_URL) 
      ? window.ENV_CONFIG.MAGIC_TODO_URL 
      : 'https://extensi-adhd-backend.vercel.app/api/generate-todos';
  },
  TIMEOUT_MS: (window.ENV_CONFIG && window.ENV_CONFIG.API_TIMEOUT_MS) || 8000,
  USE_MOCK_FALLBACK: (window.ENV_CONFIG && window.ENV_CONFIG.USE_MOCK_FALLBACK !== undefined) 
    ? window.ENV_CONFIG.USE_MOCK_FALLBACK 
    : true
};

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const subpages = document.querySelectorAll('.subpage');

  // Theme Toggle Elements
  const themeToggle = document.getElementById('theme-toggle');
  const moonIcon = themeToggle.querySelector('.moon-icon');
  const sunIcon = themeToggle.querySelector('.sun-icon');

  // Input / Control Elements
  const protectionToggle = document.getElementById('protection-toggle');
  const sensitivitySlider = document.getElementById('sensitivity-slider');
  const sliderValLabel = document.getElementById('slider-val-label');

  const activeSiteLabel = document.getElementById('active-site-label');
  const activeHostDisplay = document.getElementById('active-host');
  const btnQuickToggle = document.getElementById('btn-quick-toggle');

  const addForm = document.getElementById('add-form');
  const manualDomainInput = document.getElementById('manual-domain-input');
  const blacklistScrollArea = document.getElementById('blacklist-scroll-area');
  const refocusCounter = document.getElementById('refocus-counter');

  // Magic To-Do UI Elements
  const magicInputPanel = document.getElementById('magic-input-panel');
  const magicLoadingPanel = document.getElementById('magic-loading-panel');
  const magicResultsPanel = document.getElementById('magic-results-panel');
  const magicCongratsPanel = document.getElementById('magic-congrats-panel');

  const magicTaskInput = document.getElementById('magic-task-input');
  const magicDurationInput = document.getElementById('magic-duration-input');
  const btnNegotiate = document.getElementById('btn-negotiate');
  const magicStepsList = document.getElementById('magic-steps-list');
  const magicStepCountLabel = document.getElementById('magic-step-count-label');
  const btnAddMagicItem = document.getElementById('btn-add-magic-item');
  const btnResetMagic = document.getElementById('btn-reset-magic');
  const btnNewMagic = document.getElementById('btn-new-magic');
  const magicPomodoroPanel = document.getElementById('magic-pomodoro-panel');
  const magicPomodoroStatus = document.getElementById('magic-pomodoro-status');
  const magicPomodoroTimer = document.getElementById('magic-pomodoro-timer');
  const btnPausePomodoro = document.getElementById('btn-pause-pomodoro');
  const btnResetPomodoro = document.getElementById('btn-reset-pomodoro');

  // Pomodoro Settings Inputs & Quick Action Elements
  const pomodoroWorkInput = document.getElementById('pomodoro-work-input');
  const pomodoroBreakInput = document.getElementById('pomodoro-break-input');
  const floatingPomodoroToggle = document.getElementById('floating-pomodoro-toggle');
  const btnStartQuickPomodoro = document.getElementById('btn-start-quick-pomodoro');
  const btnStartPomodoroRules = document.getElementById('btn-start-pomodoro-rules');
  const btnStartMagicFocus = document.getElementById('btn-start-magic-focus');

  // Focus Dashboard Elements
  const focusActiveContainer = document.getElementById('focus-active-container');
  const focusEmptyState = document.getElementById('focus-empty-state');
  const focusActiveContent = document.getElementById('focus-active-content');
  const focusTaskDisplay = document.getElementById('focus-task-display');
  const btnDashboardComplete = document.getElementById('btn-dashboard-complete');
  const btnDashboardCancel = document.getElementById('btn-dashboard-cancel');
  const btnGoToMagic = document.getElementById('btn-go-to-magic');

  let magicTaskState = null;
  let pomodoroSession = null;
  let pomodoroTimerInterval = null;

  // Local state cache
  let blacklist = [];
  let currentActiveDomain = null;

  // Defaults (represented as objects)
  const DEFAULT_BLACKLIST = [
    { domain: 'youtube.com', enabled: true },
    { domain: 'x.com', enabled: true },
    { domain: 'twitter.com', enabled: true },
    { domain: 'instagram.com', enabled: true },
    { domain: 'tiktok.com', enabled: true },
    { domain: 'facebook.com', enabled: true }
  ];

  const SENSITIVITY_STEPS = {
    1: 'lenient',
    2: 'balanced',
    3: 'strict'
  };

  const SENSITIVITY_VALUES = {
    'lenient': 1,
    'balanced': 2,
    'strict': 3
  };

  // --- LOGIC PART 1: TAB NAVIGATION ---

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      subpages.forEach(p => p.classList.add('hidden'));

      btn.classList.add('active');
      const targetPageId = btn.getAttribute('data-page');
      const targetPage = document.getElementById(targetPageId);
      if (targetPage) {
        targetPage.classList.remove('hidden');
      }
    });
  });

  // --- THEME TOGGLER & HELPERS ---
  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-theme');
    if (isLight) {
      document.body.classList.remove('light-theme');
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
      chrome.storage.local.set({ theme: 'dark' });
    } else {
      document.body.classList.add('light-theme');
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
      chrome.storage.local.set({ theme: 'light' });
    }
  });

  function getSwalTheme() {
    const isLight = document.body.classList.contains('light-theme');
    return {
      background: isLight ? '#ffffff' : '#1e293b',
      color: isLight ? '#0f172a' : '#f8fafc',
      confirmButtonColor: '#0d9488',
      cancelButtonColor: '#ef4444'
    };
  }

  // --- LOGIC PART 2: STATE INITIALIZATION ---

  function initPopup() {
    chrome.storage.local.get([
      'isProtectionActive',
      'currentTask',
      'sensitivity',
      'blacklist',
      'refocusCount',
      'magicTaskState',
      'pomodoroSession',
      'theme',
      'pomodoroWorkMinutes',
      'pomodoroBreakMinutes'
    ], (items) => {
      if (chrome.runtime.lastError) return;

      // Restore Theme
      const savedTheme = items.theme || 'dark';
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      } else {
        document.body.classList.remove('light-theme');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }

      // 0. Restore Magic To-Do State
      if (!items.magicTaskState) {
        magicTaskState = null;
      } else {
        magicTaskState = items.magicTaskState;
        if (magicTaskState.steps && magicTaskState.currentStepIndex == null) {
          magicTaskState.currentStepIndex = 0;
        }
      }

      if (items.pomodoroSession) {
        pomodoroSession = items.pomodoroSession;
      } else {
        pomodoroSession = null;
      }

      renderMagicStateUI();
      startPomodoroTimer();

      // 1. Protection Toggle
      const isProtectionActive = items.isProtectionActive !== false;
      if (protectionToggle) protectionToggle.checked = isProtectionActive;

      // 2. Current Task Input & Active Dashboard Rendering
      const currentTaskText = items.currentTask || '';
      renderFocusTab(currentTaskText);

      // 3. Sensitivity Slider
      const sensitivity = items.sensitivity || 'balanced';
      const stepVal = SENSITIVITY_VALUES[sensitivity] || 2;
      if (sensitivitySlider) sensitivitySlider.value = stepVal;
      updateSliderLabel(sensitivity);

      // 4. Blacklist Array
      let storedList = items.blacklist;
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

      // 5. Positive Analytics Counter
      if (refocusCounter) refocusCounter.textContent = items.refocusCount || 0;

      // 6. Pomodoro Settings
      const savedWorkMin = items.pomodoroWorkMinutes || 25;
      const savedBreakMin = items.pomodoroBreakMinutes || 5;
      if (pomodoroWorkInput) pomodoroWorkInput.value = savedWorkMin;
      if (pomodoroBreakInput) pomodoroBreakInput.value = savedBreakMin;
      if (floatingPomodoroToggle) {
        floatingPomodoroToggle.checked = items.showFloatingWidget !== false;
      }

      // Render zones and check tab domain
      renderBlacklistArea();
      detectActiveTabDomain();
    });
  }

  // --- LOGIC PART 3: SETTINGS AUTO-SYNC ---

  if (protectionToggle) {
    protectionToggle.addEventListener('change', () => {
      chrome.storage.local.set({ isProtectionActive: protectionToggle.checked }, () => {
        console.log(`[Storage Sync] Protection state toggled: ${protectionToggle.checked}`);
      });
    });
  }


  // --- Pomodoro Settings Auto-Save ---
  if (floatingPomodoroToggle) {
    floatingPomodoroToggle.addEventListener('change', () => {
      chrome.storage.local.set({ showFloatingWidget: floatingPomodoroToggle.checked });
    });
  }

  if (pomodoroWorkInput) {
    pomodoroWorkInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(90, parseInt(pomodoroWorkInput.value, 10) || 25));
      pomodoroWorkInput.value = val;
      chrome.storage.local.set({ pomodoroWorkMinutes: val });
    });
  }

  if (pomodoroBreakInput) {
    pomodoroBreakInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(30, parseInt(pomodoroBreakInput.value, 10) || 5));
      pomodoroBreakInput.value = val;
      chrome.storage.local.set({ pomodoroBreakMinutes: val });
    });
  }


  sensitivitySlider.addEventListener('input', () => {
    const step = parseInt(sensitivitySlider.value, 10);
    const sensitivityString = SENSITIVITY_STEPS[step] || 'balanced';

    updateSliderLabel(sensitivityString);
    chrome.storage.local.set({ sensitivity: sensitivityString }, () => {
      console.log(`[Storage Sync] Sensitivity mode set to: ${sensitivityString}`);
    });
  });

  function updateSliderLabel(val) {
    sliderValLabel.textContent = val.charAt(0).toUpperCase() + val.slice(1);
  }

  // --- LOGIC PART 4: ACTIVE TAB QUICK TOGGLE ---

  function detectActiveTabDomain() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
        setInactiveDomainState("Unable to detect tab context");
        return;
      }

      const activeTab = tabs[0];
      const url = activeTab.url;

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
      activeHostDisplay.textContent = domain;
      btnQuickToggle.style.display = 'block';

      updateQuickToggleButton();
    });
  }

  function setInactiveDomainState(message) {
    currentActiveDomain = null;
    activeSiteLabel.textContent = "Current Context";
    activeHostDisplay.textContent = message;
    btnQuickToggle.style.display = 'none';
  }

  function extractDomainFromUrl(urlString) {
    try {
      const url = new URL(urlString);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      let host = url.hostname;
      if (host.startsWith('www.')) {
        host = host.slice(4);
      }
      return host;
    } catch (e) {
      return null;
    }
  }

  function updateQuickToggleButton() {
    if (!currentActiveDomain) return;

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

  btnQuickToggle.addEventListener('click', () => {
    if (!currentActiveDomain) return;

    const matched = blacklist.find(item => item.domain === currentActiveDomain);
    if (matched) {
      matched.enabled = !matched.enabled;
    } else {
      blacklist.push({ domain: currentActiveDomain, enabled: true });
    }

    chrome.storage.local.set({ blacklist: blacklist }, () => {
      updateQuickToggleButton();
      renderBlacklistArea();
    });
  });

  // --- LOGIC PART 5: CLEAN BLACKLIST MANAGER ---

  function renderBlacklistArea() {
    blacklistScrollArea.innerHTML = '';

    if (blacklist.length === 0) {
      blacklistScrollArea.innerHTML = '<div style="font-size: 11px; color:#64748b; text-align:center; padding:12px 0;">No restricted zones.</div>';
      return;
    }

    blacklist.forEach((itemObj, index) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'blacklist-item-clean';
      rowEl.style.marginTop = '4px';

      rowEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <!-- Globe / Web Icon -->
          <svg style="width: 14px; height: 14px; color: #a78bfa; flex-shrink: 0; opacity: 0.85;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18" />
          </svg>
          <span class="domain-name" style="${itemObj.enabled ? '' : 'opacity: 0.45; text-decoration: line-through;'}">${itemObj.domain}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <!-- Sleek Switch Toggle -->
          <label class="switch-small">
            <input type="checkbox" class="zone-toggle-cb">
            <span class="slider-small"></span>
          </label>
          <!-- Delete Trash Button -->
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

      // Handle toggle switch event
      toggleInput.addEventListener('change', () => {
        itemObj.enabled = toggleInput.checked;
        chrome.storage.local.set({ blacklist: blacklist }, () => {
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

      // Handle delete click event
      // Handle delete click event
      const deleteBtn = rowEl.querySelector('.btn-delete-zone');
      deleteBtn.addEventListener('click', () => {
        Swal.fire({
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
              chrome.storage.local.set({ blacklist: blacklist }, () => {
                renderBlacklistArea();
                updateQuickToggleButton();
                Swal.fire({
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
      });

      blacklistScrollArea.appendChild(rowEl);
    });
  }

  // Handle manual addition submit
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawVal = manualDomainInput.value.trim();
    if (!rawVal) return;

    let sanitized = rawVal.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
    sanitized = sanitized.split('/')[0].split('?')[0].split(':')[0];

    const parts = sanitized.split('.');
    if (parts.length < 2 || parts.some(p => p.length === 0)) {
      Swal.fire({
        title: 'Domain Tidak Valid',
        text: 'Masukkan domain yang benar (misal: reddit.com)',
        icon: 'error',
        ...getSwalTheme()
      });
      return;
    }

    const exists = blacklist.some(item => item.domain === sanitized);
    if (exists) {
      Swal.fire({
        title: 'Domain Sudah Ada',
        text: 'Domain tersebut sudah masuk dalam restricted zones.',
        icon: 'warning',
        ...getSwalTheme()
      });
      manualDomainInput.value = '';
      return;
    }

    blacklist.push({ domain: sanitized, enabled: true });
    manualDomainInput.value = '';

    chrome.storage.local.set({ blacklist: blacklist }, () => {
      renderBlacklistArea();
      updateQuickToggleButton();
    });
  });

  // --- LOGIC PART 6: MAGIC TO-DO CONTROLLER ---

  function renderMagicStateUI() {
    magicInputPanel.classList.add('hidden');
    magicLoadingPanel.classList.add('hidden');
    magicResultsPanel.classList.add('hidden');
    magicCongratsPanel.classList.add('hidden');

    if (!magicTaskState) {
      magicInputPanel.classList.remove('hidden');
      renderPomodoroPanel();
      return;
    }

    if (magicTaskState.completed) {
      magicCongratsPanel.classList.remove('hidden');
      renderPomodoroPanel();
    } else {
      magicResultsPanel.classList.remove('hidden');
      renderMagicSteps();
      renderPomodoroPanel();
    }
  }

  function getMagicStepIndexForTask(taskText) {
    if (!magicTaskState || !magicTaskState.steps?.length) return -1;
    if (typeof magicTaskState.currentStepIndex === 'number' && magicTaskState.steps[magicTaskState.currentStepIndex]?.text === taskText) {
      return magicTaskState.currentStepIndex;
    }
    const matchIndex = magicTaskState.steps.findIndex(step => step.text === taskText);
    if (matchIndex !== -1) return matchIndex;
    return typeof magicTaskState.currentStepIndex === 'number' ? magicTaskState.currentStepIndex : 0;
  }

  function advanceMagicStep(currentTaskText) {
    if (!magicTaskState || !magicTaskState.steps?.length) return '';
    const currentIndex = getMagicStepIndexForTask(currentTaskText);
    const nextIndex = currentIndex + 1;

    if (nextIndex < magicTaskState.steps.length) {
      magicTaskState.currentStepIndex = nextIndex;
      magicTaskState.completed = false;
      chrome.storage.local.set({ magicTaskState });
      return magicTaskState.steps[nextIndex].text;
    }

    magicTaskState.currentStepIndex = magicTaskState.steps.length;
    magicTaskState.completed = true;
    chrome.storage.local.set({ magicTaskState });
    return '';
  }

  function generateMockSteps(taskText) {
    const cleanTask = taskText.trim() || "tugas Anda";

    return [
      { text: `Persiapkan ruang kerja & buka aplikasi penunjang untuk "${cleanTask}"`, minutes: 5 },
      { text: `Bikin kerangka outline/konsep kasar isi dari "${cleanTask}"`, minutes: 10 },
      { text: `Fokus penuh kerjakan inti tugas "${cleanTask}" (pasang Brown Noise!)`, minutes: 15 },
      { text: `Merapikan hasil kerja akhir "${cleanTask}" dan simpan progress Anda`, minutes: 5 }
    ];
  }

  function buildPomodoroPlan(totalMinutes) {
    const plan = [];
    const workMin = Math.max(1, parseInt(pomodoroWorkInput.value, 10) || 25);
    const breakMin = Math.max(1, parseInt(pomodoroBreakInput.value, 10) || 5);
    let remaining = Math.max(workMin, Number(totalMinutes) || 60);

    while (remaining > 0) {
      const workMinutes = Math.min(workMin, remaining);
      plan.push({ type: 'work', minutes: workMinutes });
      remaining -= workMinutes;

      if (remaining <= 0) break;

      const breakMinutes = Math.min(breakMin, remaining);
      if (breakMinutes > 0) {
        plan.push({ type: 'break', minutes: breakMinutes });
        remaining -= breakMinutes;
      }
    }

    return plan;
  }

  function formatPomodoroTime(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const seconds = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function getPomodoroRemainingSeconds(session) {
    if (!session || !session.isActive) return 0;
    if (!session.isRunning) {
      return session.pausedRemainingSeconds != null ? session.pausedRemainingSeconds : 0;
    }
    if (!session.targetTimestamp) return 0;
    return Math.max(0, Math.ceil((session.targetTimestamp - Date.now()) / 1000));
  }

  function savePomodoroSession() {
    chrome.storage.local.set({ pomodoroSession: pomodoroSession }, () => {
      renderPomodoroPanel();
    });
  }

  function renderPomodoroPanel() {
    if (!pomodoroSession || !pomodoroSession.isActive) {
      magicPomodoroPanel.classList.add('hidden');
      return;
    }

    magicPomodoroPanel.classList.remove('hidden');

    const currentBlock = pomodoroSession.plan?.[pomodoroSession.currentIndex] || null;
    const phaseLabel = pomodoroSession.phase === 'break' ? 'Istirahat' : 'Kerja';
    const remSec = getPomodoroRemainingSeconds(pomodoroSession);
    const timerText = formatPomodoroTime(remSec);

    if (magicPomodoroStatus) {
      magicPomodoroStatus.textContent = `${phaseLabel} • ${currentBlock?.minutes || 0} menit`;
    }

    if (magicPomodoroTimer) {
      magicPomodoroTimer.textContent = timerText;
    }

    if (btnPausePomodoro) {
      btnPausePomodoro.textContent = pomodoroSession.isRunning ? 'Pause' : 'Lanjut';
    }
  }

  function startPomodoroTimer() {
    if (pomodoroTimerInterval) {
      clearInterval(pomodoroTimerInterval);
    }

    pomodoroTimerInterval = setInterval(() => {
      if (!pomodoroSession || !pomodoroSession.isActive) return;

      const remSec = getPomodoroRemainingSeconds(pomodoroSession);
      renderPomodoroPanel();

      if (pomodoroSession.isRunning && remSec <= 0) {
        if (pomodoroSession.currentIndex + 1 < (pomodoroSession.plan || []).length) {
          pomodoroSession.currentIndex += 1;
          const nextBlock = pomodoroSession.plan[pomodoroSession.currentIndex];
          pomodoroSession.phase = nextBlock.type;
          pomodoroSession.targetTimestamp = Date.now() + (nextBlock.minutes * 60 * 1000);
          pomodoroSession.pausedRemainingSeconds = null;
          savePomodoroSession();
        } else {
          pomodoroSession.isActive = false;
          pomodoroSession.isRunning = false;
          pomodoroSession.phase = 'done';
          pomodoroSession.targetTimestamp = null;
          pomodoroSession.pausedRemainingSeconds = 0;
          savePomodoroSession();
          Swal.fire({
            title: 'Pomodoro selesai!',
            text: 'Sesi fokus Anda telah rampung. Istirahatlah sejenak atau mulai lagi.',
            icon: 'success',
            timer: 1800,
            showConfirmButton: false,
            ...getSwalTheme()
          });
        }
      }
    }, 1000);
  }

  function resetPomodoroSession() {
    if (pomodoroTimerInterval) {
      clearInterval(pomodoroTimerInterval);
      pomodoroTimerInterval = null;
    }
    pomodoroSession = null;
    chrome.storage.local.set({ pomodoroSession: null }, () => {
      renderPomodoroPanel();
    });
  }

  btnNegotiate.addEventListener('click', async () => {
    const taskText = magicTaskInput.value.trim();
    const totalMinutes = Math.max(15, Number(magicDurationInput.value) || 60);

    if (!taskText) {
      Swal.fire({
        title: 'Input Kosong',
        text: 'Tuliskan tugas raksasa yang ingin Anda pecah!',
        icon: 'warning',
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    magicInputPanel.classList.add('hidden');
    magicLoadingPanel.classList.remove('hidden');

    let generatedSteps = null;

    try {
      if (API_CONFIG.MAGIC_TODO_URL) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS || 5000);

        const response = await fetch(API_CONFIG.MAGIC_TODO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            prompt: taskText
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawSteps = data.todos || data.steps || data.milestones || data.data;
          if (Array.isArray(rawSteps) && rawSteps.length > 0) {
            const perTaskMinutes = Math.max(5, Math.round(totalMinutes / rawSteps.length));
            generatedSteps = rawSteps.map(item => ({
              text: typeof item === 'string' ? item : (item.task || item.text || item.title || item.name),
              minutes: typeof item === 'object' ? (item.minutes || item.estimated_minutes || perTaskMinutes) : perTaskMinutes
            }));
          }
        }
      }
    } catch (err) {
      console.warn("[Magic To-Do API Notice] Fallback to local decomposer:", err.message);
    }

    if (!generatedSteps || !generatedSteps.length) {
      generatedSteps = generateMockSteps(taskText);
    }

    magicTaskState = {
      taskName: taskText,
      steps: generatedSteps,
      currentStepIndex: 0,
      completed: false,
      totalMinutes: totalMinutes
    };

    chrome.storage.local.set({
      magicTaskState: magicTaskState
    }, () => {
      magicLoadingPanel.classList.add('hidden');
      renderMagicStateUI();
    });
  });

  if (btnStartMagicFocus) {
    btnStartMagicFocus.addEventListener('click', () => {
      if (!magicTaskState || !magicTaskState.steps?.length) return;
      const firstTaskText = magicTaskState.steps[magicTaskState.currentStepIndex || 0]?.text || magicTaskState.steps[0].text;
      const totalMinutes = magicTaskState.totalMinutes || Number(magicDurationInput.value) || 60;

      const plan = buildPomodoroPlan(totalMinutes);
      const firstBlockMin = plan[0]?.minutes || 25;
      pomodoroSession = {
        isActive: true,
        isRunning: true,
        totalMinutes,
        plan,
        currentIndex: 0,
        phase: plan[0]?.type || 'work',
        targetTimestamp: Date.now() + (firstBlockMin * 60 * 1000),
        pausedRemainingSeconds: null,
        showFloatingWidget: true
      };

      if (floatingPomodoroToggle) {
        floatingPomodoroToggle.checked = true;
      }

      chrome.storage.local.set({
        currentTask: firstTaskText,
        pomodoroSession: pomodoroSession,
        showFloatingWidget: true
      }, () => {
        renderFocusTab(firstTaskText);
        startPomodoroTimer();

        // Switch active tab to Focus Page
        document.querySelector('.tab-btn.active')?.classList.remove('active');
        const focusTabBtn = document.querySelector('.tab-btn[data-page="tab-focus-page"]');
        focusTabBtn?.classList.add('active');
        document.querySelectorAll('.subpage').forEach(page => page.classList.add('hidden'));
        document.getElementById('tab-focus-page')?.classList.remove('hidden');

        Swal.fire({
          title: 'Fokus Dimulai! 🚀',
          text: `Target: "${firstTaskText}". Floating Timer sekarang aktif di halaman web Anda!`,
          icon: 'success',
          timer: 1800,
          showConfirmButton: false,
          ...getSwalTheme()
        });
      });
    });
  }

  function renderMagicSteps() {
    magicStepsList.innerHTML = '';
    if (!magicTaskState || !magicTaskState.steps) return;

    magicTaskState.steps.forEach((step, index) => {
      const li = document.createElement('li');
      li.className = 'magic-step-item';

      const content = document.createElement('div');
      content.className = 'magic-step-content';

      const textarea = document.createElement('textarea');
      textarea.className = 'magic-step-textarea';
      textarea.spellcheck = false;
      textarea.value = step.text;

      const meta = document.createElement('span');
      meta.className = 'magic-step-meta';
      meta.textContent = `${step.minutes}m`;

      content.appendChild(textarea);
      content.appendChild(meta);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete-step';
      deleteBtn.title = 'Hapus to-do ini';
      deleteBtn.textContent = '×';

      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'btn-sync-focus';
      syncBtn.title = 'Set sebagai fokus aktif sekarang';
      syncBtn.textContent = 'Fokus';

      textarea.addEventListener('input', () => {
        magicTaskState.steps[index].text = textarea.value;
        chrome.storage.local.set({ magicTaskState: magicTaskState });
      });

      deleteBtn.addEventListener('click', () => {
        magicTaskState.steps.splice(index, 1);
        chrome.storage.local.set({ magicTaskState: magicTaskState }, () => {
          renderMagicStateUI();
        });
      });

      syncBtn.addEventListener('click', () => {
        const stepFocusText = step.text;
        magicTaskState.currentStepIndex = index;
        magicTaskState.completed = false;
        chrome.storage.local.set({ magicTaskState: magicTaskState, currentTask: stepFocusText }, () => {
          console.log(`[Magic To-Do Sync] Sync active focus to: "${stepFocusText}"`);
          renderFocusTab(stepFocusText);
          syncBtn.textContent = 'Synced! ✓';
          syncBtn.style.color = '#10b981';
          syncBtn.style.borderColor = '#10b981';
          setTimeout(() => {
            syncBtn.textContent = 'Fokus';
            syncBtn.style.color = '';
            syncBtn.style.borderColor = '';
          }, 1500);
        });
      });

      li.appendChild(content);
      li.appendChild(deleteBtn);
      li.appendChild(syncBtn);
      magicStepsList.appendChild(li);
    });
    magicStepCountLabel.textContent = `${magicTaskState.steps.length} item`;
  }

  function updateMagicProgress() {
    if (!magicTaskState || !magicTaskState.steps) return;
    const totalSteps = magicTaskState.steps.length;
    magicStepCountLabel.textContent = `${totalSteps} item`;
  }

  function resetMagicState() {
    magicTaskState = null;
    magicTaskInput.value = '';
    magicDurationInput.value = '60';
    chrome.storage.local.set({ magicTaskState: null, pomodoroSession: null, currentTask: '' }, () => {
      pomodoroSession = null;
      renderMagicStateUI();
    });
  }

  btnResetMagic.addEventListener('click', () => {
    Swal.fire({
      title: 'Reset Tugas?',
      text: 'Daftar to-do Anda akan dihapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, reset!',
      cancelButtonText: 'Batal',
      ...getSwalTheme()
    }).then((result) => {
      if (result.isConfirmed) {
        resetMagicState();
        Swal.fire({
          title: 'Direset!',
          text: 'Daftar to-do baru dapat dibuat.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          ...getSwalTheme()
        });
      }
    });
  });

  btnNewMagic.addEventListener('click', () => {
    resetPomodoroSession();
    resetMagicState();
  });

  btnPausePomodoro.addEventListener('click', () => {
    if (!pomodoroSession) return;
    if (pomodoroSession.isRunning) {
      const remSec = getPomodoroRemainingSeconds(pomodoroSession);
      pomodoroSession.isRunning = false;
      pomodoroSession.pausedRemainingSeconds = remSec;
      pomodoroSession.targetTimestamp = null;
    } else {
      const remSec = pomodoroSession.pausedRemainingSeconds != null ? pomodoroSession.pausedRemainingSeconds : ((pomodoroSession.plan?.[pomodoroSession.currentIndex]?.minutes || 25) * 60);
      pomodoroSession.isRunning = true;
      pomodoroSession.targetTimestamp = Date.now() + (remSec * 1000);
      pomodoroSession.pausedRemainingSeconds = null;
    }
    savePomodoroSession();
    startPomodoroTimer();
  });

  function startNewPomodoroSession() {
    const workM = Math.max(1, parseInt(pomodoroWorkInput?.value, 10) || 25);
    const breakM = Math.max(1, parseInt(pomodoroBreakInput?.value, 10) || 5);

    const plan = [
      { type: 'work', minutes: workM },
      { type: 'break', minutes: breakM },
      { type: 'work', minutes: workM },
      { type: 'break', minutes: breakM }
    ];

    pomodoroSession = {
      isActive: true,
      isRunning: true,
      totalMinutes: workM * 2 + breakM * 2,
      plan,
      currentIndex: 0,
      phase: 'work',
      targetTimestamp: Date.now() + (workM * 60 * 1000),
      pausedRemainingSeconds: null,
      showFloatingWidget: floatingPomodoroToggle ? floatingPomodoroToggle.checked : true
    };

    chrome.storage.local.set({ pomodoroSession: pomodoroSession }, () => {
      renderPomodoroPanel();
      startPomodoroTimer();
    });
  }

  if (btnStartQuickPomodoro) {
    btnStartQuickPomodoro.addEventListener('click', () => {
      startNewPomodoroSession();
    });
  }

  if (btnStartPomodoroRules) {
    btnStartPomodoroRules.addEventListener('click', () => {
      startNewPomodoroSession();
      Swal.fire({
        title: 'Pomodoro Dimulai!',
        text: 'Floating timer sekarang aktif melayang di halaman web Anda.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        ...getSwalTheme()
      });
    });
  }

  btnResetPomodoro.addEventListener('click', () => {
    resetPomodoroSession();
  });

  btnAddMagicItem.addEventListener('click', () => {
    if (!magicTaskState) return;
    magicTaskState.steps.push({ text: 'New To-Do item', minutes: 5 });
    chrome.storage.local.set({ magicTaskState: magicTaskState }, () => {
      renderMagicStateUI();
    });
  });

  // Sync back when currentTask or magicTaskState is changed
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.currentTask) {
        const newVal = changes.currentTask.newValue || '';
        renderFocusTab(newVal);
      }
      if (changes.magicTaskState) {
        magicTaskState = changes.magicTaskState.newValue || null;
        renderMagicStateUI();
      }
      if (changes.pomodoroSession) {
        pomodoroSession = changes.pomodoroSession.newValue || null;
        renderPomodoroPanel();
        startPomodoroTimer();
      }
    }
  });

  // --- LOGIC PART 7: FOCUS ACTIVE DASHBOARD ---

  function renderFocusTab(currentTaskText) {
    if (!currentTaskText) {
      focusEmptyState.classList.remove('hidden');
      focusActiveContent.classList.add('hidden');
      updateFocusProgress(0, 0);
      return;
    }

    focusEmptyState.classList.add('hidden');
    focusActiveContent.classList.remove('hidden');
    focusTaskDisplay.textContent = currentTaskText;
    updateFocusProgressFromState(currentTaskText);
  }

  function updateFocusProgress(completedCount, totalCount) {
    const fill = document.getElementById('focus-progress-fill');
    const label = document.getElementById('focus-progress-label');
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${completedCount} / ${totalCount}`;
  }

  function updateFocusProgressFromState(currentTaskText) {
    if (!magicTaskState || !magicTaskState.steps?.length) {
      updateFocusProgress(0, 0);
      return;
    }

    const total = magicTaskState.steps.length;
    const currentIndex = getMagicStepIndexForTask(currentTaskText);
    const completed = currentIndex < 0 ? 0 : currentIndex + 1;
    updateFocusProgress(completed, total);
  }

  // Dashboard Button Handlers
  btnDashboardComplete.addEventListener('click', () => {
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

      const storagePayload = {
        magicTaskState: state,
        refocusCount: count + 1,
        currentTask: nextTaskText,
        pomodoroSession: session
      };

      chrome.storage.local.set(storagePayload, () => {
        if (refocusCounter) refocusCounter.textContent = count + 1;
        renderFocusTab(nextTaskText);
        if (typeof confetti === 'function') {
          confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        }
      });
    });
  });

  btnDashboardCancel.addEventListener('click', () => {
    chrome.storage.local.set({ currentTask: '' }, () => {
      renderFocusTab('');
      console.log("[Focus Dashboard] Focus skipped.");
    });
  });

  btnGoToMagic.addEventListener('click', () => {
    document.querySelector('.tab-btn.active')?.classList.remove('active');
    const magicTab = document.querySelector('.tab-btn[data-page="tab-magic-page"]');
    magicTab?.classList.add('active');
    document.querySelectorAll('.subpage').forEach(page => page.classList.add('hidden'));
    document.getElementById('tab-magic-page')?.classList.remove('hidden');
  });

  // Launch initial settings load
  initPopup();
});

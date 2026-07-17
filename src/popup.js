/**
 * ADHD Standalone Focus Coach - Popup Controller (Accordion Edition)
 * 
 * Manages click navigation between subpages, active tab domain checking,
 * range sensitivity mappings, and accordion list renders.
 */

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
  const taskInput = document.getElementById('task-input');
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
  const magicTimeInput = document.getElementById('magic-time-input');
  const btnNegotiate = document.getElementById('btn-negotiate');
  const magicStepsList = document.getElementById('magic-steps-list');
  const magicProgressBar = document.getElementById('magic-progress-bar');
  const magicProgressLabel = document.getElementById('magic-progress-label');
  const btnResetMagic = document.getElementById('btn-reset-magic');
  const btnNewMagic = document.getElementById('btn-new-magic');

  // Focus Dashboard Elements
  const focusInputContainer = document.getElementById('focus-input-container');
  const focusActiveContainer = document.getElementById('focus-active-container');
  const focusStepBadge = document.getElementById('focus-step-badge');
  const focusMasterDisplay = document.getElementById('focus-master-display');
  const focusTaskDisplay = document.getElementById('focus-task-display');
  const focusMagicAddon = document.getElementById('focus-magic-addon');
  const focusMagicBar = document.getElementById('focus-magic-bar');
  const focusMagicPercent = document.getElementById('focus-magic-percent');
  const btnDashboardComplete = document.getElementById('btn-dashboard-complete');
  const btnDashboardCancel = document.getElementById('btn-dashboard-cancel');

  let magicTaskState = null;

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
      'theme'
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

      // 0. Restore Magic To-Do State (Pre-populate with mock if empty)
      if (!items.magicTaskState) {
        magicTaskState = {
          taskName: "Menulis Laporan Akhir Proyek",
          totalMinutes: 45,
          steps: [
            { text: "Persiapkan dokumen referensi & buka editor word", minutes: 5, checked: false },
            { text: "Bikin kerangka outline/konsep kasar isi dari Laporan Akhir", minutes: 10, checked: false },
            { text: "Fokus penuh kerjakan inti tugas Laporan (pasang Brown Noise!)", minutes: 25, checked: false },
            { text: "Merapikan hasil kerja akhir dan ekspor ke PDF", minutes: 5, checked: false }
          ],
          completed: false
        };
        chrome.storage.local.set({ magicTaskState: magicTaskState });
      } else {
        magicTaskState = items.magicTaskState;
      }
      renderMagicStateUI();

      // 1. Protection Toggle
      const isProtectionActive = items.isProtectionActive !== false;
      protectionToggle.checked = isProtectionActive;

      // 2. Current Task Input & Active Dashboard Rendering
      const currentTaskText = items.currentTask || '';
      taskInput.value = currentTaskText;
      renderFocusTab(currentTaskText);

      // 3. Sensitivity Slider
      const sensitivity = items.sensitivity || 'balanced';
      const stepVal = SENSITIVITY_VALUES[sensitivity] || 2;
      sensitivitySlider.value = stepVal;
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
      refocusCounter.textContent = items.refocusCount || 0;

      // Render zones and check tab domain
      renderBlacklistArea();
      detectActiveTabDomain();
    });
  }

  // --- LOGIC PART 3: SETTINGS AUTO-SYNC ---

  protectionToggle.addEventListener('change', () => {
    chrome.storage.local.set({ isProtectionActive: protectionToggle.checked }, () => {
      console.log(`[Storage Sync] Protection state toggled: ${protectionToggle.checked}`);
    });
  });

  taskInput.addEventListener('input', () => {
    chrome.storage.local.set({ currentTask: taskInput.value }, () => {
      console.log(`[Storage Sync] Task prompt updated: "${taskInput.value}"`);
    });
  });

  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = taskInput.value.trim();
      if (val) {
        chrome.storage.local.set({ currentTask: val }, () => {
          renderFocusTab(val);
        });
      }
    }
  });

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
    // Hide all panels by default
    magicInputPanel.classList.add('hidden');
    magicLoadingPanel.classList.add('hidden');
    magicResultsPanel.classList.add('hidden');
    magicCongratsPanel.classList.add('hidden');

    if (!magicTaskState) {
      magicInputPanel.classList.remove('hidden');
      return;
    }

    if (magicTaskState.completed) {
      magicCongratsPanel.classList.remove('hidden');
    } else {
      magicResultsPanel.classList.remove('hidden');
      renderMagicSteps();
      updateMagicProgress();
    }
  }

  function generateMockSteps(taskText, minutes) {
    const cleanTask = taskText.trim() || "tugas Anda";
    const totalMin = parseInt(minutes, 10) || 30;

    // Proportional breakdown based on total minutes
    const t1 = Math.max(1, Math.round(totalMin * 0.1));
    const t2 = Math.max(2, Math.round(totalMin * 0.25));
    const t3 = Math.max(5, Math.round(totalMin * 0.5));
    const t4 = Math.max(1, totalMin - (t1 + t2 + t3));

    return [
      { text: `Persiapkan ruang kerja & buka aplikasi penunjang untuk "${cleanTask}"`, minutes: t1, checked: false },
      { text: `Bikin kerangka outline/konsep kasar isi dari "${cleanTask}"`, minutes: t2, checked: false },
      { text: `Fokus penuh kerjakan inti tugas "${cleanTask}" (pasang Brown Noise!)`, minutes: t3, checked: false },
      { text: `Merapikan hasil kerja akhir "${cleanTask}" dan simpan progress Anda`, minutes: t4, checked: false }
    ];
  }

  btnNegotiate.addEventListener('click', () => {
    const taskText = magicTaskInput.value.trim();
    const timeVal = magicTimeInput.value;

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
    if (!timeVal || parseInt(timeVal, 10) <= 0) {
      Swal.fire({
        title: 'Waktu Tidak Valid',
        text: 'Masukkan estimasi waktu minimal 5 menit!',
        icon: 'warning',
        ...getSwalTheme()
      });
      return;
    }

    // Hide inputs, show spinner
    magicInputPanel.classList.add('hidden');
    magicLoadingPanel.classList.remove('hidden');

    // Simulate AI negotiations with a premium loader experience
    setTimeout(() => {
      const generatedSteps = generateMockSteps(taskText, timeVal);
      magicTaskState = {
        taskName: taskText,
        totalMinutes: parseInt(timeVal, 10),
        steps: generatedSteps,
        completed: false
      };

      chrome.storage.local.set({ magicTaskState: magicTaskState }, () => {
        magicLoadingPanel.classList.add('hidden');
        renderMagicStateUI();
      });
    }, 1500); // 1.5 seconds loading state
  });

  function renderMagicSteps() {
    magicStepsList.innerHTML = '';
    if (!magicTaskState || !magicTaskState.steps) return;

    magicTaskState.steps.forEach((step, index) => {
      const li = document.createElement('li');
      li.className = 'magic-step-item';
      if (step.checked) {
        li.classList.add('checked');
      }

      li.innerHTML = `
        <input type="checkbox" class="magic-step-cb" ${step.checked ? 'checked' : ''}>
        <span class="magic-step-text">${step.text} (${step.minutes}m)</span>
        <button class="btn-sync-focus" title="Set sebagai fokus aktif sekarang">Fokus</button>
      `;

      // Checkbox event
      const cb = li.querySelector('.magic-step-cb');
      cb.addEventListener('change', () => {
        magicTaskState.steps[index].checked = cb.checked;
        if (cb.checked) {
          li.classList.add('checked');
          // Dopaminergic trigger: confetti!
          if (typeof confetti === 'function') {
            confetti({
              particleCount: 30,
              spread: 40,
              origin: { y: 0.85 }
            });
          }
        } else {
          li.classList.remove('checked');
        }

        // Verify if all steps are completed
        const allCompleted = magicTaskState.steps.every(s => s.checked);
        if (allCompleted) {
          magicTaskState.completed = true;
          if (typeof confetti === 'function') {
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.7 }
            });
          }
        }

        chrome.storage.local.set({ magicTaskState: magicTaskState }, () => {
          updateMagicProgress();
          if (allCompleted) {
            renderMagicStateUI();
          }
        });
      });

      // Focus synchronization event
      const syncBtn = li.querySelector('.btn-sync-focus');
      syncBtn.addEventListener('click', () => {
        // Sync active step to Current Task in chrome storage and UI
        const stepFocusText = `[Milestone ${index + 1}] ${step.text}`;
        chrome.storage.local.set({ currentTask: stepFocusText }, () => {
          taskInput.value = stepFocusText;
          console.log(`[Magic To-Do Sync] Sync active focus to: "${stepFocusText}"`);
          
          // Micro animation feedback
          syncBtn.textContent = "Synced! ✓";
          syncBtn.style.color = "#10b981";
          syncBtn.style.borderColor = "#10b981";
          
          setTimeout(() => {
            syncBtn.textContent = "Fokus";
            syncBtn.style.color = "";
            syncBtn.style.borderColor = "";
          }, 1500);
        });
      });

      magicStepsList.appendChild(li);
    });
  }

  function updateMagicProgress() {
    if (!magicTaskState || !magicTaskState.steps) return;
    const totalSteps = magicTaskState.steps.length;
    const completedSteps = magicTaskState.steps.filter(s => s.checked).length;
    const percentage = Math.round((completedSteps / totalSteps) * 100);

    magicProgressBar.style.width = `${percentage}%`;
    magicProgressLabel.textContent = `${percentage}% Selesai`;
  }

  function resetMagicState() {
    magicTaskState = null;
    magicTaskInput.value = '';
    magicTimeInput.value = '';
    chrome.storage.local.set({ magicTaskState: null }, () => {
      renderMagicStateUI();
    });
  }

  btnResetMagic.addEventListener('click', () => {
    Swal.fire({
      title: 'Reset Tugas?',
      text: 'Progress langkah mikro Anda saat ini akan dihapus!',
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
          text: 'Tugas Anda telah dibersihkan.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          ...getSwalTheme()
        });
      }
    });
  });
  
  btnNewMagic.addEventListener('click', resetMagicState);

  // Sync back when currentTask or magicTaskState is changed
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.currentTask) {
        const newVal = changes.currentTask.newValue || '';
        taskInput.value = newVal;
        renderFocusTab(newVal);
      }
      if (changes.magicTaskState) {
        magicTaskState = changes.magicTaskState.newValue || null;
        renderMagicStateUI();
        if (!focusActiveContainer.classList.contains('hidden')) {
          renderFocusTab(taskInput.value);
        }
      }
    }
  });

  // --- LOGIC PART 7: FOCUS ACTIVE DASHBOARD ---

  function renderFocusTab(currentTaskText) {
    if (!currentTaskText) {
      focusInputContainer.classList.remove('hidden');
      focusActiveContainer.classList.add('hidden');
      return;
    }

    focusInputContainer.classList.add('hidden'); // Ensure input is hidden
    focusActiveContainer.classList.remove('hidden');

    // Check if the current task belongs to the active Magic To-Do task
    const isMilestone = currentTaskText.startsWith('[Milestone ') || (magicTaskState && currentTaskText.includes(magicTaskState.taskName));

    if (isMilestone && magicTaskState && magicTaskState.steps) {
      // Show milestone badges & progress bar
      focusStepBadge.classList.remove('hidden');
      focusMagicAddon.classList.remove('hidden');
      focusMasterDisplay.textContent = magicTaskState.taskName;

      // Parse step index from currentTaskText, e.g. "[Milestone X]"
      let activeIndex = -1;
      const match = currentTaskText.match(/^\[Milestone (\d+)\]/);
      if (match) {
        activeIndex = parseInt(match[1], 10) - 1;
      } else {
        // Fallback to first unchecked step
        activeIndex = magicTaskState.steps.findIndex(s => !s.checked);
      }

      // If activeIndex is valid, show details of that specific step
      if (activeIndex >= 0 && activeIndex < magicTaskState.steps.length) {
        const step = magicTaskState.steps[activeIndex];
        focusTaskDisplay.textContent = `${step.text} (${step.minutes}m)`;
        focusStepBadge.textContent = `Langkah ${activeIndex + 1} dari ${magicTaskState.steps.length}`;
      } else {
        // Fallback if index out of bounds
        focusTaskDisplay.textContent = currentTaskText;
        focusStepBadge.classList.add('hidden');
      }

      // Calculate and display progress bar
      const totalSteps = magicTaskState.steps.length;
      const completedSteps = magicTaskState.steps.filter(s => s.checked).length;
      const percentage = Math.round((completedSteps / totalSteps) * 100);
      focusMagicBar.style.width = `${percentage}%`;
      focusMagicPercent.textContent = `${percentage}%`;
    } else {
      // Normal manual task
      focusStepBadge.classList.add('hidden');
      focusMagicAddon.classList.add('hidden');
      focusMasterDisplay.textContent = "FOKUS MANDIRI";
      focusTaskDisplay.textContent = currentTaskText;
    }
  }

  // Dashboard Button Handlers
  btnDashboardComplete.addEventListener('click', () => {
    const currentTaskText = taskInput.value;
    const isMilestone = currentTaskText.startsWith('[Milestone ') || (magicTaskState && currentTaskText.includes(magicTaskState.taskName));

    if (isMilestone && magicTaskState && magicTaskState.steps) {
      // Parse active index
      let activeIndex = -1;
      const match = currentTaskText.match(/^\[Milestone (\d+)\]/);
      if (match) {
        activeIndex = parseInt(match[1], 10) - 1;
      } else {
        activeIndex = magicTaskState.steps.findIndex(s => !s.checked);
      }

      if (activeIndex >= 0 && activeIndex < magicTaskState.steps.length) {
        // Mark current step as checked
        magicTaskState.steps[activeIndex].checked = true;

        // Check if all steps are completed
        const allCompleted = magicTaskState.steps.every(s => s.checked);
        if (allCompleted) {
          magicTaskState.completed = true;
          
          // Clear currentTask focus, update magic state, fire big confetti
          chrome.storage.local.set({ currentTask: '', magicTaskState: magicTaskState }, () => {
            taskInput.value = '';
            renderFocusTab('');
            if (typeof confetti === 'function') {
              confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            }
          });
        } else {
          // Advance to next unchecked step
          const nextIndex = magicTaskState.steps.findIndex((s, idx) => idx > activeIndex && !s.checked);
          const finalNextIndex = nextIndex !== -1 ? nextIndex : magicTaskState.steps.findIndex(s => !s.checked);
          
          const nextStep = magicTaskState.steps[finalNextIndex];
          const nextTaskText = `[Milestone ${finalNextIndex + 1}] ${nextStep.text}`;
          
          chrome.storage.local.set({ currentTask: nextTaskText, magicTaskState: magicTaskState }, () => {
            taskInput.value = nextTaskText;
            renderFocusTab(nextTaskText);
            if (typeof confetti === 'function') {
              confetti({ particleCount: 40, spread: 45, origin: { y: 0.8 } });
            }
          });
        }
      }
    } else {
      // Completed manual task
      chrome.storage.local.get(['refocusCount'], (items) => {
        const currentCount = items.refocusCount || 0;
        chrome.storage.local.set({ refocusCount: currentCount + 1, currentTask: '' }, () => {
          refocusCounter.textContent = currentCount + 1;
          taskInput.value = '';
          renderFocusTab('');
          if (typeof confetti === 'function') {
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
          }
        });
      });
    }
  });

  btnDashboardCancel.addEventListener('click', () => {
    chrome.storage.local.set({ currentTask: '' }, () => {
      taskInput.value = '';
      renderFocusTab('');
      console.log("[Focus Dashboard] Focus cancelled.");
    });
  });

  // Launch initial settings load
  initPopup();
});

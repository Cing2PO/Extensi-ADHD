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

  // --- LOGIC PART 2: STATE INITIALIZATION ---

  function initPopup() {
    chrome.storage.local.get([
      'isProtectionActive',
      'currentTask',
      'sensitivity',
      'blacklist',
      'refocusCount'
    ], (items) => {
      if (chrome.runtime.lastError) return;

      // 1. Protection Toggle
      const isProtectionActive = items.isProtectionActive !== false;
      protectionToggle.checked = isProtectionActive;

      // 2. Current Task Input
      taskInput.value = items.currentTask || '';

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

  // --- LOGIC PART 5: EXPANDABLE BLACKLIST MANAGER ---

  function renderBlacklistArea() {
    blacklistScrollArea.innerHTML = '';

    if (blacklist.length === 0) {
      blacklistScrollArea.innerHTML = '<div style="font-size: 11px; color:#475569; text-align:center; padding:10px 0;">No restricted zones.</div>';
      return;
    }

    blacklist.forEach((itemObj, index) => {
      // 1. Accordion Container
      const itemEl = document.createElement('div');
      itemEl.className = 'blacklist-item';

      // 2. Clickable Header
      const headerEl = document.createElement('div');
      headerEl.className = 'blacklist-item-header';
      headerEl.innerHTML = `
        <span class="domain-name" style="${itemObj.enabled ? '' : 'opacity: 0.45; text-decoration: line-through;'}">${itemObj.domain}</span>
        <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;

      const labelEl = headerEl.querySelector('.domain-name');

      // 3. Hidden Drawer Body
      const bodyEl = document.createElement('div');
      bodyEl.className = 'blacklist-item-body';
      bodyEl.style.maxHeight = '0px'; // Collapsed by default

      // Submenu Wrapper
      const menuEl = document.createElement('div');
      menuEl.className = 'item-menu';

      // Row A: Pause Toggle
      const rowToggle = document.createElement('div');
      rowToggle.className = 'menu-row';
      rowToggle.innerHTML = `
        <span>Restrict scrolls</span>
        <label class="switch-small">
          <input type="checkbox">
          <span class="slider-small"></span>
        </label>
      `;

      const toggleInput = rowToggle.querySelector('input');
      toggleInput.checked = itemObj.enabled;

      toggleInput.addEventListener('change', (e) => {
        e.stopPropagation();
        itemObj.enabled = toggleInput.checked;
        chrome.storage.local.set({ blacklist: blacklist }, () => {
          if (!itemObj.enabled) {
            labelEl.style.opacity = '0.45';
            labelEl.style.textDecoration = 'line-through';
          } else {
            labelEl.style.opacity = '1';
            labelEl.style.textDecoration = 'none';
          }
          updateQuickToggleButton();
        });
      });

      // Row B: Delete button
      const rowDelete = document.createElement('div');
      rowDelete.className = 'menu-row';
      rowDelete.innerHTML = `
        <span>Remove zone</span>
        <button class="btn-remove-small">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </button>
      `;

      const deleteBtn = rowDelete.querySelector('button');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        blacklist.splice(index, 1);
        chrome.storage.local.set({ blacklist: blacklist }, () => {
          renderBlacklistArea();
          updateQuickToggleButton();
        });
      });

      menuEl.appendChild(rowToggle);
      menuEl.appendChild(rowDelete);
      bodyEl.appendChild(menuEl);

      itemEl.appendChild(headerEl);
      itemEl.appendChild(bodyEl);

      // --- LOGIC: DRAWER ACCORDION TOGGLING ---
      headerEl.addEventListener('click', () => {
        const isExpanded = itemEl.classList.contains('expanded');

        // Collapse any other open drawers
        const siblingItems = blacklistScrollArea.querySelectorAll('.blacklist-item');
        siblingItems.forEach(sib => {
          if (sib !== itemEl && sib.classList.contains('expanded')) {
            sib.classList.remove('expanded');
            sib.querySelector('.blacklist-item-body').style.maxHeight = '0px';
          }
        });

        // Toggle focus item drawer height transition
        if (isExpanded) {
          itemEl.classList.remove('expanded');
          bodyEl.style.maxHeight = '0px';
        } else {
          itemEl.classList.add('expanded');
          bodyEl.style.maxHeight = bodyEl.scrollHeight + 'px'; // Dynamic content height scaling
        }
      });

      blacklistScrollArea.appendChild(itemEl);
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
      alert('Please enter a valid domain (e.g. reddit.com)');
      return;
    }

    const exists = blacklist.some(item => item.domain === sanitized);
    if (exists) {
      alert('Domain is already restricted.');
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

  // Launch initial settings load
  initPopup();
});

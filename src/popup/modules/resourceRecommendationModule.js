/**
 * Resource Recommendation Module - Manages on-demand AI learning resource curation for to-do items
 * 
 * Complies with Rule 7: Modular, clean separation, highly scalable, and < 300 lines.
 */

import { fetchResourceRecommendations } from '../services/apiService.js';
import { getStorage, setStorage } from '../services/storageService.js';

const TYPE_CONFIG = {
  Documentation: { icon: '📖', label: 'Dokumentasi', colorClass: 'type-docs' },
  Video: { icon: '🎥', label: 'Video Tutorial', colorClass: 'type-video' },
  Article: { icon: '📄', label: 'Artikel & Panduan', colorClass: 'type-article' },
  Tool: { icon: '🛠️', label: 'Alat / Editor', colorClass: 'type-tool' },
  Search: { icon: '🔍', label: 'Pencarian Terarah', colorClass: 'type-search' }
};

/**
 * Persists step resources to Chrome Local Storage
 */
async function persistStepResources(step) {
  try {
    const { magicTaskState } = await getStorage(['magicTaskState']);
    if (magicTaskState && Array.isArray(magicTaskState.steps)) {
      const targetStep = magicTaskState.steps.find(s => 
        (step.id && s.id === step.id) || (s.text === step.text)
      );
      if (targetStep) {
        targetStep.resources = step.resources;
      }
      await setStorage({ magicTaskState });
    }
  } catch (err) {
    console.warn('[ResourceRecommendationModule] Gagal menyimpan ke storage:', err);
  }
}

/**
 * Extracts a readable domain/hostname from a URL string
 */
function getHostname(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Tautan Eksternal';
  }
}

/**
 * Escapes HTML characters for security
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Creates the skeleton placeholder cards while AI is generating recommendations
 */
function renderSkeletonLoading() {
  return `
    <div class="resource-loading-box">
      <div class="resource-loading-header">
        <div class="resource-spinner"></div>
        <span>Gemini AI sedang mengkurasi materi terbaik...</span>
      </div>
      <div class="resource-skeleton-cards">
        <div class="resource-skeleton-card"></div>
        <div class="resource-skeleton-card"></div>
        <div class="resource-skeleton-card"></div>
      </div>
    </div>
  `;
}

/**
 * Renders the empty state CTA card with dedicated "Minta Rekomendasi AI" button
 */
function renderEmptyState() {
  return `
    <div class="resource-empty-card">
      <div class="resource-empty-info">
        <span class="resource-empty-icon">💡</span>
        <div class="resource-empty-desc">
          <div class="resource-empty-title">Referensi Belajar & Tools AI</div>
          <div class="resource-empty-sub">Minta Gemini AI untuk mengkurasi tutorial, dokumentasi resmi, dan alat praktis untuk langkah tugas ini.</div>
        </div>
      </div>
      <button type="button" class="btn-request-ai-resource">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>✨ Minta Rekomendasi AI</span>
      </button>
    </div>
  `;
}

/**
 * Renders the list of curated resource cards
 */
function renderResourceList(resources) {
  const itemsHtml = resources.map((item) => {
    const typeInfo = TYPE_CONFIG[item.type] || { icon: '🔗', label: item.type || 'Referensi', colorClass: 'type-docs' };
    const domain = getHostname(item.url);

    return `
      <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="resource-card" title="Buka ${item.title}">
        <div class="resource-card-left">
          <span class="resource-type-badge ${typeInfo.colorClass}">
            <span class="resource-badge-icon">${typeInfo.icon}</span>
            <span class="resource-badge-label">${typeInfo.label}</span>
          </span>
          <div class="resource-title">${escapeHtml(item.title || 'Materi Belajar')}</div>
          <div class="resource-domain">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>${escapeHtml(domain)}</span>
          </div>
        </div>
        <div class="resource-card-arrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </div>
      </a>
    `;
  }).join('');

  return `
    <div class="resource-list-container">
      <div class="resource-list-header">
        <span class="resource-list-title">💡 Referensi Terkurasi:</span>
        <button type="button" class="btn-refresh-resources" title="Kurasi ulang rekomendasi dengan AI">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Perbarui</span>
        </button>
      </div>
      <div class="resource-cards-grid">
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Triggers the AI recommendation fetch for a specific step
 */
async function requestStepResources(step, panel) {
  panel.innerHTML = renderSkeletonLoading();

  try {
    const resources = await fetchResourceRecommendations(step.text);
    step.resources = resources; // Cache on step object
    await persistStepResources(step); // Persist to Chrome Local Storage
    panel.innerHTML = renderResourceList(resources);
    attachPanelListeners(step, panel);
  } catch (err) {
    panel.innerHTML = `
      <div class="resource-error-box">
        <span class="resource-error-text">⚠️ ${escapeHtml(err.message || 'Gagal memuat rekomendasi.')}</span>
        <button type="button" class="btn-retry-resource">Coba Lagi</button>
      </div>
    `;

    const retryBtn = panel.querySelector('.btn-retry-resource');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        requestStepResources(step, panel);
      });
    }
  }
}

/**
 * Attaches event listeners inside the panel (Request AI & Refresh buttons)
 */
function attachPanelListeners(step, panel) {
  // Prevent any click inside panel from bubbling up and closing the dropdown
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const requestBtn = panel.querySelector('.btn-request-ai-resource');
  if (requestBtn) {
    requestBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      requestStepResources(step, panel);
    });
  }

  const refreshBtn = panel.querySelector('.btn-refresh-resources');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      requestStepResources(step, panel);
    });
  }
}

/**
 * Toggles the dropdown under a specific to-do step item
 * @param {Object} step Step object ({ id, text, minutes, resources })
 * @param {HTMLElement} stepLiElement The <li> container of the step
 */
export function toggleStepDropdown(step, stepLiElement) {
  if (!step || !stepLiElement) return;

  let panel = stepLiElement.querySelector('.magic-step-resources-panel');

  // If already open -> collapse & remove
  if (panel) {
    stepLiElement.classList.remove('is-dropdown-open');
    panel.classList.add('collapsing');
    setTimeout(() => {
      if (panel && panel.parentElement) {
        panel.remove();
      }
    }, 200);
    return;
  }

  // Open dropdown
  stepLiElement.classList.add('is-dropdown-open');
  panel = document.createElement('div');
  panel.className = 'magic-step-resources-panel';
  stepLiElement.appendChild(panel);

  // If resources already cached -> render list
  if (Array.isArray(step.resources) && step.resources.length > 0) {
    panel.innerHTML = renderResourceList(step.resources);
  } else {
    // Show empty state with dedicated "Minta Rekomendasi AI" CTA button
    panel.innerHTML = renderEmptyState();
  }

  attachPanelListeners(step, panel);
}

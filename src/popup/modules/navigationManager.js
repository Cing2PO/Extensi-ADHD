/**
 * Navigation Manager Module - Handles Tab Switching
 */

export function switchToTab(pageId) {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const subpages = document.querySelectorAll('.subpage');

  tabButtons.forEach(b => b.classList.remove('active'));
  subpages.forEach(p => p.classList.add('hidden'));

  const targetBtn = document.querySelector(`.tab-btn[data-page="${pageId}"]`);
  const targetPage = document.getElementById(pageId);

  if (targetBtn) targetBtn.classList.add('active');
  if (targetPage) targetPage.classList.remove('hidden');
}

export function initNavigationManager() {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.getAttribute('data-page');
      if (pageId) {
        switchToTab(pageId);
      }
    });
  });
}

/**
 * Theme Manager Module - Handles Light/Dark Theme Switcher
 */

import { setStorage } from '../services/storageService.js';

export function initThemeManager(savedTheme = 'dark') {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  const moonIcon = themeToggle.querySelector('.moon-icon');
  const sunIcon = themeToggle.querySelector('.sun-icon');

  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    setStorage({ theme: newTheme });
  });

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
    } else {
      document.body.classList.remove('light-theme');
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
    }
  }
}

export function getSwalTheme() {
  const isLight = document.body.classList.contains('light-theme');
  return {
    background: isLight ? '#ffffff' : '#1e293b',
    color: isLight ? '#0f172a' : '#f8fafc',
    confirmButtonColor: '#0d9488',
    cancelButtonColor: '#ef4444'
  };
}

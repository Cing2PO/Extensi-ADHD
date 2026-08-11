/**
 * Theme Manager Module - Handles Light/Dark Theme Switcher
 */

import { setStorage } from '../services/storageService.js';
import { THEME_COLORS } from '../../shared/colors.js';

export function initThemeManager(savedTheme = 'dark') {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  const moonIcon = themeToggle.querySelector('.moon-icon');
  const sunIcon = themeToggle.querySelector('.sun-icon');

  const themeStatusText = document.getElementById('theme-status-text');

  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    setStorage({ theme: newTheme });
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
      if (themeStatusText) themeStatusText.textContent = 'Mode Terang (Light)';
    } else {
      document.body.classList.remove('light-theme');
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
      if (themeStatusText) themeStatusText.textContent = 'Mode Gelap (Dark)';
    }
  }
}

export function getSwalTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.classList.contains('light-theme');
  const palette = isLight ? THEME_COLORS.light : THEME_COLORS.dark;
  return {
    background: palette.background,
    color: palette.text,
    confirmButtonColor: palette.primary,
    cancelButtonColor: palette.cancel
  };
}

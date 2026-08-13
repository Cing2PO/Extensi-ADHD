/**
 * Flow Tether Strict Color System (JavaScript Module)
 * Single Source of Truth for all programmatic color values.
 * 
 * ONLY uses the 5 user-defined palette colors + red cancel color.
 * Fonts strictly use solid Black and White.
 */

export const THEME_COLORS = {
  light: {
    text: '#0f172a',
    background: '#f7fdfa',
    primary: '#0e8149',
    secondary: '#0e8149',
    accent: '#047857',
    cancel: '#dc2626',
    fontWhite: '#ffffff',
    fontBlack: '#000000',
    fontOnPrimary: '#ffffff',
    textRgb: [15, 23, 42],
    backgroundRgb: [247, 253, 250],
    primaryRgb: [14, 129, 73],
    secondaryRgb: [14, 129, 73],
    accentRgb: [4, 120, 87],
    cancelRgb: [220, 38, 38]
  },
  dark: {
    text: '#f8fafc',
    background: '#020805',
    primary: '#2ac67a',
    secondary: '#0e8149',
    accent: '#04be64',
    cancel: '#ef4444',
    fontWhite: '#ffffff',
    fontBlack: '#000000',
    fontOnPrimary: '#000000',
    textRgb: [248, 250, 252],
    backgroundRgb: [2, 8, 5],
    primaryRgb: [42, 198, 122],
    secondaryRgb: [14, 129, 73],
    accentRgb: [4, 190, 100],
    cancelRgb: [239, 68, 68]
  }
};

/**
 * Returns the current theme's color palette
 * @param {string} theme 'light' | 'dark'
 * @returns {typeof THEME_COLORS.dark}
 */
export function getThemePalette(theme = 'dark') {
  return THEME_COLORS[theme] || THEME_COLORS.dark;
}

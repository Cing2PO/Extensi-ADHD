/**
 * Flow Tether Strict Color System (JavaScript Module)
 * Single Source of Truth for all programmatic color values.
 * 
 * ONLY uses the 5 user-defined palette colors + red cancel color.
 * Fonts strictly use solid Black and White.
 */

export const THEME_COLORS = {
  light: {
    text: '#000000',
    background: '#f7fdfa',
    primary: '#39d58a',
    secondary: '#7ef1ba',
    accent: '#41fba1',
    cancel: '#ef4444',
    fontWhite: '#ffffff',
    fontBlack: '#000000',
    fontOnPrimary: '#000000',
    textRgb: [0, 0, 0],
    backgroundRgb: [247, 253, 250],
    primaryRgb: [57, 213, 138],
    secondaryRgb: [126, 241, 186],
    accentRgb: [65, 251, 161],
    cancelRgb: [239, 68, 68]
  },
  dark: {
    text: '#ffffff',
    background: '#020805',
    primary: '#2ac67a',
    secondary: '#0e8149',
    accent: '#04be64',
    cancel: '#ef4444',
    fontWhite: '#ffffff',
    fontBlack: '#000000',
    fontOnPrimary: '#000000',
    textRgb: [255, 255, 255],
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

/**
 * Theme system for Saccadic.
 * Uses CSS custom properties applied to :root.
 * Themes are extensible — add any theme ID + config object.
 */

export const THEMES = {
  dark: {
    id: 'dark',
    name: 'Dark',
    '--sacc-bg': '#0d1117',
    '--sacc-text': '#e6edf3',
    '--sacc-accent': '#ff4444',
    '--sacc-muted': '#7d8590',
    '--sacc-surface': '#161b22',
    '--sacc-border': '#30363d',
    '--sacc-line': '#444d56',
    '--sacc-orp': '#ff4444',
  },
  light: {
    id: 'light',
    name: 'Light',
    '--sacc-bg': '#ffffff',
    '--sacc-text': '#1f2328',
    '--sacc-accent': '#cc2222',
    '--sacc-muted': '#636c76',
    '--sacc-surface': '#f6f8fa',
    '--sacc-border': '#d0d7de',
    '--sacc-line': '#afb8c1',
    '--sacc-orp': '#cc2222',
  },
  highContrast: {
    id: 'highContrast',
    name: 'High Contrast',
    '--sacc-bg': '#000000',
    '--sacc-text': '#ffffff',
    '--sacc-accent': '#ffcc00',
    '--sacc-muted': '#aaaaaa',
    '--sacc-surface': '#111111',
    '--sacc-border': '#555555',
    '--sacc-line': '#888888',
    '--sacc-orp': '#ffcc00',
  },
  deuteranopia: {
    id: 'deuteranopia',
    name: 'Colorblind (Deuteranopia)',
    '--sacc-bg': '#1a1a2e',
    '--sacc-text': '#e0e0e0',
    '--sacc-accent': '#00b4d8',
    '--sacc-muted': '#888888',
    '--sacc-surface': '#16213e',
    '--sacc-border': '#2a2a4a',
    '--sacc-line': '#5a5a8a',
    '--sacc-orp': '#00b4d8',
  },
};

export const DEFAULT_THEME = 'dark';

class ThemeManager {
  constructor() {
    this._current = DEFAULT_THEME;
  }

  /** Apply a theme by ID. Updates CSS custom properties on :root. */
  apply(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, val]) => {
      if (key.startsWith('--')) root.style.setProperty(key, val);
    });
    root.setAttribute('data-theme', themeId);
    this._current = themeId;
    localStorage.setItem('saccadic-theme', themeId);
  }

  /** Detect system preference and apply. */
  applySystem() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.apply(prefersDark ? 'dark' : 'light');
  }

  /** Restore saved theme from localStorage, or apply system default. */
  init() {
    const saved = localStorage.getItem('saccadic-theme');
    if (saved && THEMES[saved]) {
      this.apply(saved);
    } else {
      this.applySystem();
    }
    // Re-apply on system theme change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!localStorage.getItem('saccadic-theme')) {
        this.applySystem();
      }
    });
  }

  get current() { return this._current; }
}

export const themeManager = new ThemeManager();

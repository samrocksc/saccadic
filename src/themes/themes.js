/**
 * Theme system for Saccadic.
 *
 * Themes are plain objects of CSS custom properties applied to :root, so
 * adding one is a data change, not a code change — see registerTheme().
 *
 * 'system' is a pseudo-theme: it holds no colours of its own and instead
 * resolves to `dark` or `light` from the OS preference, tracking it live.
 */

export const THEMES = {
  cowabunga: {
    id: 'cowabunga',
    name: 'Cowabunga',
    '--sacc-bg': '#ffffff',
    '--sacc-text': '#000000',
    '--sacc-accent': '#ff00ff',
    '--sacc-muted': '#666666',
    '--sacc-surface': '#f5f5f5',
    '--sacc-border': '#000000',
    '--sacc-line': '#000000',
    '--sacc-orp': '#ff00ff',
    '--sacc-shadow': '4px 4px 0px #ff00ff',
    '--sacc-radius': '0px',
    '--sacc-border-width': '2px',
  },
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
    '--sacc-shadow': 'none',
    '--sacc-radius': '8px',
    '--sacc-border-width': '1px',
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
    '--sacc-shadow': 'none',
    '--sacc-radius': '8px',
    '--sacc-border-width': '1px',
  },
  system: {
    id: 'system',
    name: 'System',
    // Resolved at apply() time to `dark` or `light`.
    resolves: true,
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
    '--sacc-shadow': 'none',
    '--sacc-radius': '0px',
    '--sacc-border-width': '2px',
  },
  deuteranopia: {
    id: 'deuteranopia',
    name: 'Deuteranopia',
    '--sacc-bg': '#1a1a2e',
    '--sacc-text': '#e0e0e0',
    '--sacc-accent': '#00b4d8',
    '--sacc-muted': '#888888',
    '--sacc-surface': '#16213e',
    '--sacc-border': '#2a2a4a',
    '--sacc-line': '#5a5a8a',
    '--sacc-orp': '#00b4d8',
    '--sacc-shadow': 'none',
    '--sacc-radius': '8px',
    '--sacc-border-width': '1px',
  },
};

/**
 * First-run default. 'system' follows the OS light/dark preference, per the
 * project brief; every other theme (including Cowabunga) is one click away and
 * is remembered once chosen.
 */
export const DEFAULT_THEME = 'system';

/**
 * Register an additional theme at runtime.
 * @param {{id: string, name: string} & Record<string, string>} theme
 */
export function registerTheme(theme) {
  if (!theme?.id) throw new Error('registerTheme: theme.id is required');
  THEMES[theme.id] = theme;
  return THEMES[theme.id];
}

// localStorage keys — these literals are also referenced by the inline
// pre-paint script in index.html. Keep both in sync.
const THEME_KEY = 'saccadic-theme';
const ORP_COLOR_KEY = 'saccadic-orp-color';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * localStorage throws outright in Safari private mode and when a browser is
 * configured to block site data. Theme init runs during connectedCallback, so
 * an unguarded throw there takes the whole app down instead of costing a
 * saved preference.
 */
const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, val) {
    try { localStorage.setItem(key, val); return true; } catch { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); return true; } catch { return false; }
  },
};

function prefersDark() {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

class ThemeManager {
  constructor() {
    this._current = DEFAULT_THEME;   // what the user picked (may be 'system')
    this._resolved = DEFAULT_THEME;  // the concrete theme actually painted
    this._customOrp = null;          // user override; null = use theme default
    this._mediaBound = false;
  }

  /** Resolve a possibly-virtual theme id to a concrete one. */
  _resolve(themeId) {
    if (THEMES[themeId]?.resolves) return prefersDark() ? 'dark' : 'light';
    return themeId;
  }

  /**
   * Apply a theme by ID. Updates CSS custom properties on :root.
   * @param {string} themeId
   * @param {{persist?: boolean}} [opts]
   */
  apply(themeId, { persist = true } = {}) {
    if (!THEMES[themeId]) return;

    const resolvedId = this._resolve(themeId);
    const theme = THEMES[resolvedId];
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme).forEach(([key, val]) => {
      if (key.startsWith('--')) root.style.setProperty(key, val);
    });

    root.setAttribute('data-theme', resolvedId);
    root.setAttribute('data-theme-choice', themeId);

    this._current = themeId;
    this._resolved = resolvedId;

    if (persist) storage.set(THEME_KEY, themeId);

    // Re-apply custom ORP colour on top — themes shouldn't clobber user preference
    if (this._customOrp) {
      root.style.setProperty('--sacc-orp', this._customOrp);
    }
  }

  /**
   * Set a custom ORP highlight color, overriding the current theme's accent.
   * Persists across sessions.
   */
  setCustomOrpColor(color) {
    if (!color) return;
    this._customOrp = color;
    document.documentElement.style.setProperty('--sacc-orp', color);
    storage.set(ORP_COLOR_KEY, color);
  }

  /** Clear the custom ORP color and restore the active theme's accent. */
  clearCustomOrpColor() {
    this._customOrp = null;
    storage.remove(ORP_COLOR_KEY);
    // Re-apply theme to reset --sacc-orp to its theme default
    this.apply(this._current);
  }

  /** Switch to following the OS light/dark preference. */
  applySystem() {
    this.apply('system');
  }

  /** Restore saved theme + custom ORP color from localStorage, or apply the default. */
  init() {
    // Load custom orp first so it survives the initial theme apply
    const savedOrp = storage.get(ORP_COLOR_KEY);
    if (savedOrp) this._customOrp = savedOrp;

    const saved = storage.get(THEME_KEY);
    // Don't persist on init — writing the default back would make it
    // indistinguishable from a deliberate user choice on the next load.
    this.apply(saved && THEMES[saved] ? saved : DEFAULT_THEME, { persist: false });

    this._bindSystemListener();
  }

  /**
   * Repaint when the OS flips light/dark, but only while the user is actually
   * on 'system'. The previous guard checked whether a theme was stored at all,
   * which apply() had already made permanently true — so it never fired.
   */
  _bindSystemListener() {
    if (this._mediaBound || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      if (THEMES[this._current]?.resolves) {
        this.apply(this._current, { persist: false });
      }
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange); // older Safari
    this._mediaBound = true;
  }

  get current() { return this._current; }
  get resolved() { return this._resolved; }
  get customOrpColor() { return this._customOrp; }
}

export const themeManager = new ThemeManager();

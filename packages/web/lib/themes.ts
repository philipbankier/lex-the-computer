export type ThemeColors = {
  bg: string;
  fg: string;
  card: string;
  cardFg: string;
  border: string;
  primary: string;
  primaryFg: string;
  secondary: string;
  secondaryFg: string;
  accent: string;
  accentFg: string;
  muted: string;
  mutedFg: string;
  destructive: string;
  destructiveFg: string;
};

export type Theme = {
  name: string;
  mode: 'dark' | 'light';
  colors: ThemeColors;
};

export const themes: Theme[] = [
  // --- Dark themes ---
  {
    name: 'Midnight',
    mode: 'dark',
    colors: {
      bg: '#0a0e1a', fg: '#e2e8f0', card: '#111827', cardFg: '#e2e8f0',
      border: '#1e293b', primary: '#3b82f6', primaryFg: '#ffffff',
      secondary: '#1e293b', secondaryFg: '#94a3b8', accent: '#6366f1', accentFg: '#ffffff',
      muted: '#1e293b', mutedFg: '#64748b', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Forest',
    mode: 'dark',
    colors: {
      bg: '#0c1a0c', fg: '#d4e5d4', card: '#142214', cardFg: '#d4e5d4',
      border: '#1f3a1f', primary: '#22c55e', primaryFg: '#ffffff',
      secondary: '#1a2e1a', secondaryFg: '#86b086', accent: '#16a34a', accentFg: '#ffffff',
      muted: '#1a2e1a', mutedFg: '#5a8c5a', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Sunset',
    mode: 'dark',
    colors: {
      bg: '#1a0e0a', fg: '#f5e6df', card: '#2a1510', cardFg: '#f5e6df',
      border: '#3d1f15', primary: '#f97316', primaryFg: '#ffffff',
      secondary: '#2d1a12', secondaryFg: '#c49a84', accent: '#ea580c', accentFg: '#ffffff',
      muted: '#2d1a12', mutedFg: '#a07860', destructive: '#dc2626', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Ocean',
    mode: 'dark',
    colors: {
      bg: '#0a1520', fg: '#d0e8f5', card: '#0f1f30', cardFg: '#d0e8f5',
      border: '#1a3050', primary: '#06b6d4', primaryFg: '#ffffff',
      secondary: '#142840', secondaryFg: '#7db4d4', accent: '#0891b2', accentFg: '#ffffff',
      muted: '#142840', mutedFg: '#5a96b8', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Espresso',
    mode: 'dark',
    colors: {
      bg: '#1a1410', fg: '#e8ddd4', card: '#2a2018', cardFg: '#e8ddd4',
      border: '#3d2e22', primary: '#d4a574', primaryFg: '#1a1410',
      secondary: '#2d2218', secondaryFg: '#b89c82', accent: '#c48a56', accentFg: '#1a1410',
      muted: '#2d2218', mutedFg: '#8a7462', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Neon',
    mode: 'dark',
    colors: {
      bg: '#0a0a12', fg: '#e8e8f0', card: '#12121e', cardFg: '#e8e8f0',
      border: '#1e1e35', primary: '#00ffcc', primaryFg: '#0a0a12',
      secondary: '#1a1a2e', secondaryFg: '#a0a0cc', accent: '#ff00ff', accentFg: '#ffffff',
      muted: '#1a1a2e', mutedFg: '#6a6a9a', destructive: '#ff3366', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Slate',
    mode: 'dark',
    colors: {
      bg: '#101214', fg: '#d4d8dc', card: '#1a1d21', cardFg: '#d4d8dc',
      border: '#282c32', primary: '#8b95a5', primaryFg: '#ffffff',
      secondary: '#1e2228', secondaryFg: '#8b95a5', accent: '#6b7585', accentFg: '#ffffff',
      muted: '#1e2228', mutedFg: '#585f6a', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Ember',
    mode: 'dark',
    colors: {
      bg: '#140a0a', fg: '#f5d8d0', card: '#201010', cardFg: '#f5d8d0',
      border: '#3a1818', primary: '#ef4444', primaryFg: '#ffffff',
      secondary: '#2a1414', secondaryFg: '#c48080', accent: '#dc2626', accentFg: '#ffffff',
      muted: '#2a1414', mutedFg: '#8a5252', destructive: '#f97316', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Mocha',
    mode: 'dark',
    colors: {
      bg: '#181210', fg: '#e8dcd0', card: '#241c16', cardFg: '#e8dcd0',
      border: '#382a20', primary: '#c8a882', primaryFg: '#181210',
      secondary: '#2c2018', secondaryFg: '#a08c74', accent: '#b89468', accentFg: '#181210',
      muted: '#2c2018', mutedFg: '#7a6a58', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Cobalt',
    mode: 'dark',
    colors: {
      bg: '#0a1028', fg: '#d0d8f5', card: '#101840', cardFg: '#d0d8f5',
      border: '#1a2860', primary: '#4f6ef7', primaryFg: '#ffffff',
      secondary: '#142050', secondaryFg: '#8090cc', accent: '#3b5ce4', accentFg: '#ffffff',
      muted: '#142050', mutedFg: '#5a6aaa', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Graphite',
    mode: 'dark',
    colors: {
      bg: '#0e0e0e', fg: '#d0d0d0', card: '#1a1a1a', cardFg: '#d0d0d0',
      border: '#2a2a2a', primary: '#a0a0a0', primaryFg: '#0e0e0e',
      secondary: '#222222', secondaryFg: '#888888', accent: '#808080', accentFg: '#ffffff',
      muted: '#222222', mutedFg: '#555555', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Dusk',
    mode: 'dark',
    colors: {
      bg: '#12101e', fg: '#dcd4f0', card: '#1c1830', cardFg: '#dcd4f0',
      border: '#2a2444', primary: '#a78bfa', primaryFg: '#12101e',
      secondary: '#221e38', secondaryFg: '#9888c4', accent: '#8b5cf6', accentFg: '#ffffff',
      muted: '#221e38', mutedFg: '#6a5a98', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  // --- Light themes ---
  {
    name: 'Snowfall',
    mode: 'light',
    colors: {
      bg: '#f8fafc', fg: '#0f172a', card: '#ffffff', cardFg: '#0f172a',
      border: '#e2e8f0', primary: '#3b82f6', primaryFg: '#ffffff',
      secondary: '#f1f5f9', secondaryFg: '#475569', accent: '#6366f1', accentFg: '#ffffff',
      muted: '#f1f5f9', mutedFg: '#94a3b8', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Lavender',
    mode: 'light',
    colors: {
      bg: '#f5f0ff', fg: '#1e1040', card: '#ffffff', cardFg: '#1e1040',
      border: '#e4d8f8', primary: '#8b5cf6', primaryFg: '#ffffff',
      secondary: '#ede5ff', secondaryFg: '#5b3e8a', accent: '#7c3aed', accentFg: '#ffffff',
      muted: '#ede5ff', mutedFg: '#9180b0', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Rose',
    mode: 'light',
    colors: {
      bg: '#fff5f5', fg: '#2d1a1e', card: '#ffffff', cardFg: '#2d1a1e',
      border: '#fce0e4', primary: '#e11d48', primaryFg: '#ffffff',
      secondary: '#ffe4ea', secondaryFg: '#7a3040', accent: '#be123c', accentFg: '#ffffff',
      muted: '#ffe4ea', mutedFg: '#a0707a', destructive: '#dc2626', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Arctic',
    mode: 'light',
    colors: {
      bg: '#f0f9ff', fg: '#0c2440', card: '#ffffff', cardFg: '#0c2440',
      border: '#d4eaf8', primary: '#0284c7', primaryFg: '#ffffff',
      secondary: '#e0f2fe', secondaryFg: '#2a5a7a', accent: '#0369a1', accentFg: '#ffffff',
      muted: '#e0f2fe', mutedFg: '#6a9ab8', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Sage',
    mode: 'light',
    colors: {
      bg: '#f2f8f2', fg: '#142014', card: '#ffffff', cardFg: '#142014',
      border: '#d4e8d4', primary: '#16a34a', primaryFg: '#ffffff',
      secondary: '#e4f2e4', secondaryFg: '#2a5a2a', accent: '#15803d', accentFg: '#ffffff',
      muted: '#e4f2e4', mutedFg: '#6a9a6a', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Peach',
    mode: 'light',
    colors: {
      bg: '#fff8f0', fg: '#2a1810', card: '#ffffff', cardFg: '#2a1810',
      border: '#f8e0cc', primary: '#ea580c', primaryFg: '#ffffff',
      secondary: '#fff0e0', secondaryFg: '#7a4a2a', accent: '#c2410c', accentFg: '#ffffff',
      muted: '#fff0e0', mutedFg: '#b08868', destructive: '#dc2626', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Mint',
    mode: 'light',
    colors: {
      bg: '#f0fdf4', fg: '#0a2014', card: '#ffffff', cardFg: '#0a2014',
      border: '#c8f0d8', primary: '#10b981', primaryFg: '#ffffff',
      secondary: '#d8f8e8', secondaryFg: '#1a5a38', accent: '#059669', accentFg: '#ffffff',
      muted: '#d8f8e8', mutedFg: '#5aa07a', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
  {
    name: 'Sand',
    mode: 'light',
    colors: {
      bg: '#faf8f2', fg: '#2a2418', card: '#ffffff', cardFg: '#2a2418',
      border: '#e8e0d0', primary: '#b08c54', primaryFg: '#ffffff',
      secondary: '#f0ece0', secondaryFg: '#6a5838', accent: '#9a7a44', accentFg: '#ffffff',
      muted: '#f0ece0', mutedFg: '#a09078', destructive: '#ef4444', destructiveFg: '#ffffff',
    },
  },
];

export function getTheme(name: string): Theme | undefined {
  return themes.find((t) => t.name === name);
}

export function applyTheme(theme: Theme | null) {
  const root = document.documentElement;
  if (!theme) {
    // Reset to default dark
    root.style.setProperty('--bg', '#0b0b0c');
    root.style.setProperty('--fg', '#f5f5f7');
    root.style.setProperty('--card', '#141416');
    root.style.setProperty('--card-fg', '#f5f5f7');
    root.style.setProperty('--border', 'rgba(255,255,255,0.1)');
    root.style.setProperty('--primary', '#ffffff');
    root.style.setProperty('--primary-fg', '#0b0b0c');
    root.style.setProperty('--secondary', 'rgba(255,255,255,0.1)');
    root.style.setProperty('--secondary-fg', 'rgba(255,255,255,0.8)');
    root.style.setProperty('--accent', '#6366f1');
    root.style.setProperty('--accent-fg', '#ffffff');
    root.style.setProperty('--muted', 'rgba(255,255,255,0.05)');
    root.style.setProperty('--muted-fg', 'rgba(255,255,255,0.5)');
    root.style.setProperty('--destructive', '#ef4444');
    root.style.setProperty('--destructive-fg', '#ffffff');
    root.classList.remove('light');
    root.classList.add('dark');
    return;
  }
  const c = theme.colors;
  root.style.setProperty('--bg', c.bg);
  root.style.setProperty('--fg', c.fg);
  root.style.setProperty('--card', c.card);
  root.style.setProperty('--card-fg', c.cardFg);
  root.style.setProperty('--border', c.border);
  root.style.setProperty('--primary', c.primary);
  root.style.setProperty('--primary-fg', c.primaryFg);
  root.style.setProperty('--secondary', c.secondary);
  root.style.setProperty('--secondary-fg', c.secondaryFg);
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--accent-fg', c.accentFg);
  root.style.setProperty('--muted', c.muted);
  root.style.setProperty('--muted-fg', c.mutedFg);
  root.style.setProperty('--destructive', c.destructive);
  root.style.setProperty('--destructive-fg', c.destructiveFg);
  root.classList.toggle('dark', theme.mode === 'dark');
  root.classList.toggle('light', theme.mode === 'light');
}

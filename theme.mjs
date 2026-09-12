export const THEME_STORAGE_KEY = 'escuadra-site-theme';

export function isTheme(value) {
  return value === 'light' || value === 'dark';
}

export function resolveTheme(storedTheme, systemPrefersDark) {
  if (isTheme(storedTheme)) return storedTheme;
  return systemPrefersDark ? 'dark' : 'light';
}

export function nextTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}

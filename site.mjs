// site.mjs
import { THEME_STORAGE_KEY, nextTheme, resolveTheme } from './theme.mjs';

const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');
let hasSavedPreference = false;

function setTheme(theme, persist) {
  root.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      hasSavedPreference = true;
    } catch {
      hasSavedPreference = false;
    }
  }
  for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    // Translated pages carry their own labels in data-label-*; the others keep English.
    const labels = toggle.dataset;
    const next = nextTheme(theme);
    toggle.setAttribute(
      'aria-label',
      (next === 'dark' ? labels.labelToDark : labels.labelToLight) ?? `Switch to ${next} theme`,
    );
    const label = toggle.querySelector('[data-theme-toggle-label]');
    if (label) {
      label.textContent =
        (theme === 'dark' ? labels.labelDark : labels.labelLight) ??
        (theme === 'dark' ? 'Dark' : 'Light');
    }
  }
}

function initialiseTheme() {
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY); } catch {}
  hasSavedPreference = savedTheme === 'light' || savedTheme === 'dark';
  setTheme(resolveTheme(savedTheme, media.matches), false);
  for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
    toggle.addEventListener('click', () => setTheme(nextTheme(root.dataset.theme), true));
  }
  media.addEventListener('change', (event) => {
    if (!hasSavedPreference) setTheme(resolveTheme(null, event.matches), false);
  });
}

function initialiseReveals() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries, currentObserver) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15 });
  items.forEach((item) => observer.observe(item));
}

initialiseTheme();
initialiseReveals();

/**
 * Centrale applicatiestate.
 *
 * Alle schermen lezen hier uit en schrijven hier naartoe. Componenten houden
 * geen eigen kopie van filters, thema of modus bij. Wijzigingen worden via een
 * subscribe-mechanisme uitgezonden zodat er precies een renderpad bestaat.
 */

import { getDataMode, setDataMode, hasBackend } from './data-provider.js';

const PERSIST_KEY = 'aizy.state';
const THEME_KEY = 'aizy.theme';

// Alleen deze sleutels worden bewaard tussen sessies.
const PERSISTED_KEYS = ['view', 'theme', 'customerId', 'channel', 'period', 'comparison'];

const listeners = new Set();

function detectInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

const persisted = loadPersisted();

export const state = {
  // Navigatie
  page: 'overview',
  view: persisted.view ?? 'agency', // 'agency' | 'customer'
  presentation: false,

  // Weergave
  theme: persisted.theme ?? detectInitialTheme(),

  // Data
  dataMode: getDataMode(),
  backendAvailable: hasBackend(),

  // Filters
  customerId: persisted.customerId ?? 'all',
  channel: persisted.channel ?? 'all',
  period: persisted.period ?? 'deze-maand',
  comparison: persisted.comparison ?? 'vorige-periode',

  // Laadstatus per bron, zodat schermen loading/empty/error kunnen tonen
  resources: {},
};

function persist() {
  const snapshot = {};
  for (const key of PERSISTED_KEYS) snapshot[key] = state[key];
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
  } catch {
    // Opslag kan geblokkeerd zijn. De applicatie blijft werken zonder persistentie.
  }
}

/**
 * Werkt de state bij en informeert alle abonnees.
 */
export function setState(patch) {
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (state[key] !== value) {
      state[key] = value;
      changed = true;
    }
  }
  if (!changed) return;

  if ('theme' in patch) {
    localStorage.setItem(THEME_KEY, state.theme);
    applyTheme();
  }
  if ('dataMode' in patch) {
    setDataMode(state.dataMode);
  }

  persist();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Zet het thema op het root-element. Alle kleuren komen uit semantische
 * tokens die op [data-theme] zijn gedefinieerd.
 */
export function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

export function toggleTheme() {
  setState({ theme: state.theme === 'dark' ? 'light' : 'dark' });
}

/**
 * Registreert de status van een databron zodat schermen kunnen reageren
 * op loading, empty, error of partial zonder eigen bookkeeping.
 */
export function setResource(key, resultObject) {
  state.resources = { ...state.resources, [key]: resultObject };
  listeners.forEach((fn) => fn(state));
}

export function getResource(key) {
  return state.resources[key] ?? null;
}

import { pokemonPrefs } from './data.js';

const STORAGE_KEY = 'pokopia-settings';

export let settings = { owned: {} };

let saveTimeout = null;

export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      settings = JSON.parse(stored);
    }
    if (!settings.owned) settings.owned = {};
  } catch (e) {
    console.warn('Could not load settings, using defaults');
    settings = { owned: {} };
  }
  updateOwnedBadge();
}

export function saveSettings() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      showSaveIndicator();
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }, 300);
}

function showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

export function addOwned(name, world = '') {
  if (!pokemonPrefs[name]) return;
  settings.owned[name] = { world };
  saveSettings();
  updateOwnedBadge();
}

export function removeOwned(name) {
  delete settings.owned[name];
  saveSettings();
  updateOwnedBadge();
}

export function setWorld(name, world) {
  if (settings.owned[name]) {
    settings.owned[name].world = world;
    saveSettings();
  }
}

export function isOwned(name) {
  return name in settings.owned;
}

export function getWorld(name) {
  return settings.owned[name]?.world || '';
}

export function getOwnedInWorld(world) {
  return Object.entries(settings.owned)
    .filter(([_, info]) => info.world === world)
    .map(([name]) => name);
}

export function updateOwnedBadge() {
  const count = Object.keys(settings.owned).length;
  const el = document.getElementById('owned-count-badge');
  if (el) el.textContent = count;
}

export function importSettings(data) {
  if (data && data.owned) {
    settings = data;
    if (!settings.owned) settings.owned = {};
    saveSettings();
    updateOwnedBadge();
  }
}

export function exportSettings() {
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PokemonIOwn.json';
  a.click();
  URL.revokeObjectURL(url);
}

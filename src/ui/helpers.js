import { getHabitat } from '../data.js';

export function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function worldToClass(world) {
  const map = {
    'Withered Wasteland': 'wasteland',
    'Bleak Beach': 'beach',
    'Rocky Ridges': 'ridges',
    'Sparkling Skylands': 'skylands',
    'Pallet Town': 'pallet',
  };
  return map[world] || 'unassigned';
}

export function habitatBadge(name) {
  const h = getHabitat(name);
  if (!h) return '';
  return `<span class="habitat-badge habitat-${h.toLowerCase()}">${esc(h)}</span>`;
}

export function renderTags(container, items, onRemove) {
  container.innerHTML = items.map((item, i) =>
    `<span class="tag">${esc(item)}<button data-index="${i}">&times;</button></span>`
  ).join('');
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
  });
}

export function showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

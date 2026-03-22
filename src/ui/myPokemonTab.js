import { WORLDS } from '../data.js';
import { settings, isOwned, getWorld, addOwned, removeOwned, setWorld, importSettings, exportSettings } from '../settings.js';
import { setupAutocomplete } from './autocomplete.js';
import { esc, worldToClass } from './helpers.js';
import { showPokemonInfo } from './infoTab.js';

export function renderMyPokemon() {
  const search = (document.getElementById('my-search')?.value || '').toLowerCase();
  const statsEl = document.getElementById('world-stats');
  const worldFilter = statsEl.dataset.filter || '';

  const worldCounts = {};
  for (const w of WORLDS) worldCounts[w] = 0;
  let unassigned = 0;
  for (const [name, info] of Object.entries(settings.owned)) {
    if (info.world && worldCounts[info.world] !== undefined) {
      worldCounts[info.world]++;
    } else {
      unassigned++;
    }
  }
  statsEl.innerHTML = WORLDS.map(w => `
    <div class="world-stat ${worldToClass(w)} ${worldFilter === w ? 'active' : ''}" data-world="${esc(w)}">
      <div class="world-name">${esc(w)}</div>
      <div class="world-count">${worldCounts[w]}</div>
    </div>
  `).join('') + `
    <div class="world-stat ${worldFilter === 'Unassigned' ? 'active' : ''}" data-world="Unassigned" style="border-top-color: var(--text-dim);">
      <div class="world-name">Unassigned</div>
      <div class="world-count">${unassigned}</div>
    </div>
  `;

  let owned = Object.keys(settings.owned).sort();

  if (search) {
    owned = owned.filter(p => p.toLowerCase().includes(search));
  }
  if (worldFilter === 'Unassigned') {
    owned = owned.filter(p => !getWorld(p));
  } else if (worldFilter) {
    owned = owned.filter(p => getWorld(p) === worldFilter);
  }

  const grid = document.getElementById('my-pokemon-grid');
  if (owned.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <p>${Object.keys(settings.owned).length === 0
        ? 'No Pokemon added yet. Use the search above to add your Pokemon!'
        : 'No Pokemon match your filter.'}</p>
    </div>`;
    return;
  }

  grid.innerHTML = owned.map(p => {
    const world = getWorld(p);
    return `<div class="owned-card" data-pokemon="${esc(p)}">
      <span class="name" data-action="info">${esc(p)}</span>
      <select data-action="world">
        <option value="" ${!world ? 'selected' : ''}>-- Select World --</option>
        ${WORLDS.map(w => `<option value="${w}" ${world === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}
      </select>
      <button class="remove-btn" data-action="remove" title="Remove">&times;</button>
    </div>`;
  }).join('');

  grid.addEventListener('click', handleGridClick);
  grid.querySelectorAll('select[data-action="world"]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const card = e.target.closest('.owned-card');
      setWorld(card.dataset.pokemon, e.target.value);
      renderMyPokemon();
    });
  });
}

function handleGridClick(e) {
  const card = e.target.closest('.owned-card');
  if (!card) return;
  const name = card.dataset.pokemon;

  if (e.target.closest('[data-action="info"]')) {
    showPokemonInfo(name);
  } else if (e.target.closest('[data-action="remove"]')) {
    removeOwned(name);
    renderMyPokemon();
  }
}

export function initMyPokemonTab() {
  setupAutocomplete(
    document.getElementById('my-add-input'),
    document.getElementById('my-add-autocomplete'),
    (name) => {
      addOwned(name);
      renderMyPokemon();
    },
    (p) => !isOwned(p)
  );

  document.getElementById('my-search')?.addEventListener('input', () => renderMyPokemon());

  document.getElementById('world-stats').addEventListener('click', (e) => {
    const stat = e.target.closest('.world-stat');
    if (!stat) return;
    const statsEl = document.getElementById('world-stats');
    const world = stat.dataset.world;
    statsEl.dataset.filter = statsEl.dataset.filter === world ? '' : world;
    renderMyPokemon();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    exportSettings();
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          importSettings(data);
          renderMyPokemon();
        } catch (err) {
          alert('Invalid settings file.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });
}

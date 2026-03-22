import { pokemonPrefs, catToPokemon, getHabitat, getFamily, getFamilyMembers } from '../data.js';
import { isOwned, getWorld, addOwned } from '../settings.js';
import { setupAutocomplete } from './autocomplete.js';
import { esc, worldToClass, habitatBadge } from './helpers.js';
import { switchTab } from './tabs.js';

export function showPokemonInfo(name) {
  switchTab('info');
  document.getElementById('info-input').value = name;
  renderPokemonInfo(name);
}

export function renderPokemonInfo(name) {
  const container = document.getElementById('info-results');
  if (!pokemonPrefs[name]) {
    container.innerHTML = `<div class="empty-state">Pokemon not found</div>`;
    return;
  }
  const cats = [...pokemonPrefs[name]].sort();
  const owned = isOwned(name);
  const world = getWorld(name);

  container.innerHTML = `
    <div class="info-card">
      <h3>${esc(name)}</h3>
      <p style="color: var(--text-dim); margin-bottom: 16px;">
        Likes ${cats.length} categories
        ${getHabitat(name) ? ` &middot; ${habitatBadge(name)} habitat` : ''}
        ${getFamily(name) >= 0 ? ` &middot; Family: ${getFamilyMembers(name).map(esc).join(' &rarr; ')}` : ''}
        ${owned ? ` &middot; <span class="owned-marker ${world ? 'world-' + worldToClass(world) : 'world-unassigned'}" style="padding:3px 10px;border-radius:12px;font-size:12px;">${esc(world) || 'Owned (no world)'}</span>` : ''}
        ${!owned ? ` &middot; <button class="btn btn-sm btn-success" data-action="add-owned" data-pokemon="${esc(name)}">Add to My Pokemon</button>` : ''}
      </p>
      <div class="info-cats">
        ${cats.map(c => {
          const members = [...catToPokemon[c]].sort();
          return `<div class="info-cat" title="${members.length} Pokemon like this">${esc(c)} (${members.length})</div>`;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelector('[data-action="add-owned"]')?.addEventListener('click', () => {
    addOwned(name);
    renderPokemonInfo(name);
  });
}

export function initInfoTab() {
  setupAutocomplete(
    document.getElementById('info-input'),
    document.getElementById('info-autocomplete'),
    (name) => {
      document.getElementById('info-input').value = name;
      renderPokemonInfo(name);
    }
  );
}

import { allPokemon, pokemonPrefs } from '../data.js';
import { isOwned, getWorld, addOwned, removeOwned } from '../settings.js';
import { esc, worldToClass } from './helpers.js';
import { showPokemonInfo } from './infoTab.js';
import { spriteImg } from '../sprites.js';

export function renderPokemonList(filter = '') {
  const v = document.getElementById('list-search')?.value || filter;
  const list = allPokemon.filter(p => p.toLowerCase().includes(v.toLowerCase()));
  document.getElementById('list-count').textContent = `${list.length} of ${allPokemon.length} Pokemon`;

  const container = document.getElementById('pokemon-list');
  container.innerHTML = list.map(p => {
    const owned = isOwned(p);
    const world = getWorld(p);
    return `<div class="pokemon-list-item" data-pokemon="${esc(p)}">
      <span>${spriteImg(p)}${owned ? '<span class="world-dot ' + worldToClass(world || '') + '"></span>' : ''}${esc(p)}</span>
      <span class="count">${pokemonPrefs[p].size} cats</span>
      <button class="own-btn ${owned ? 'owned' : ''}" data-action="toggle-own" title="${owned ? 'Remove from My Pokemon' : 'Add to My Pokemon'}">${owned ? '&#10003;' : '+'}</button>
    </div>`;
  }).join('');
}

export function initListTab() {
  document.getElementById('list-search').addEventListener('input', (e) => {
    renderPokemonList(e.target.value);
  });

  document.getElementById('pokemon-list').addEventListener('click', (e) => {
    const item = e.target.closest('.pokemon-list-item');
    if (!item) return;
    const name = item.dataset.pokemon;

    if (e.target.closest('[data-action="toggle-own"]')) {
      e.stopPropagation();
      if (isOwned(name)) {
        removeOwned(name);
      } else {
        addOwned(name);
      }
      renderPokemonList();
    } else {
      showPokemonInfo(name);
    }
  });
}

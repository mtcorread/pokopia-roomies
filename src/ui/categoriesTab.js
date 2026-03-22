import { pokemonPrefs, catToPokemon, getHabitat, getFamily, getFamilyMembers } from '../data.js';
import { isOwned, getWorld } from '../settings.js';
import { esc, worldToClass, habitatBadge } from './helpers.js';
import { showPokemonInfo } from './infoTab.js';

export function renderCategoryList(filter = '') {
  const cats = Object.keys(catToPokemon).sort();
  const filtered = cats.filter(c => c.toLowerCase().includes(filter.toLowerCase()));
  const listEl = document.getElementById('cat-list');
  const detailEl = document.getElementById('cat-detail');

  detailEl.style.display = 'none';
  listEl.style.display = '';

  listEl.innerHTML = `<div class="cat-grid">
    ${filtered.map(c => {
      const members = catToPokemon[c];
      const ownedCount = [...members].filter(p => isOwned(p)).length;
      return `<div class="cat-card" data-category="${esc(c)}">
        <div class="cat-name">${esc(c)}</div>
        <div class="cat-count">${members.size} Pokemon${ownedCount > 0 ? ` · ${ownedCount} owned` : ''}</div>
      </div>`;
    }).join('')}
  </div>`;

  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.cat-card');
    if (card) showCategoryDetail(card.dataset.category);
  });
}

export function showCategoryDetail(catName) {
  const listEl = document.getElementById('cat-list');
  const detailEl = document.getElementById('cat-detail');

  listEl.style.display = 'none';
  detailEl.style.display = '';

  const members = [...(catToPokemon[catName] || [])].sort();

  detailEl.innerHTML = `
    <div class="cat-detail-header">
      <button class="cat-back-btn" data-action="back">&larr; Back</button>
      <h2 style="color:var(--gold);">${esc(catName)}</h2>
      <span style="color:var(--text-dim);font-size:14px;">${members.length} Pokemon</span>
    </div>
    ${members.map(p => {
      const cats = [...pokemonPrefs[p]].sort();
      const h = getHabitat(p);
      const owned = isOwned(p);
      const world = getWorld(p);
      const fam = getFamily(p) >= 0 ? getFamilyMembers(p) : null;
      return `<div class="cat-pokemon-card" data-pokemon="${esc(p)}">
        <div class="pkmn-name">
          ${owned ? '<span class="world-dot ' + worldToClass(world || '') + '"></span>' : ''}${esc(p)}
          ${h ? ' ' + habitatBadge(p) : ''}
          ${owned ? '<span style="font-size:11px;color:var(--success);margin-left:6px;">OWNED</span>' : ''}
        </div>
        <div class="pkmn-meta">
          ${cats.map(c => `<span class="pkmn-cat ${c === catName ? 'current' : ''}">${esc(c)}</span>`).join('')}
        </div>
        ${fam ? `<div style="font-size:12px;color:var(--text-dim);width:100%;">Family: ${fam.map(esc).join(' → ')}</div>` : ''}
      </div>`;
    }).join('')}
  `;

  detailEl.querySelector('[data-action="back"]').addEventListener('click', () => {
    renderCategoryList(document.getElementById('cat-search')?.value || '');
  });

  detailEl.addEventListener('click', (e) => {
    const card = e.target.closest('.cat-pokemon-card');
    if (card) showPokemonInfo(card.dataset.pokemon);
  });
}

export function initCategoriesTab() {
  document.getElementById('cat-search')?.addEventListener('input', (e) => {
    renderCategoryList(e.target.value);
  });
}

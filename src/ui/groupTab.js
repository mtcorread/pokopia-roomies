import { sharedCategories } from '../data.js';
import { isOwned, getWorld } from '../settings.js';
import { findBestGroups } from '../optimizer.js';
import { setupAutocomplete } from './autocomplete.js';
import { esc, worldToClass, habitatBadge, renderTags } from './helpers.js';
import { showPokemonInfo } from './infoTab.js';

let mustInclude = [];

function updateIncludeTags() {
  renderTags(document.getElementById('include-tags'), mustInclude, (idx) => {
    mustInclude.splice(idx, 1);
    updateIncludeTags();
  });
}

function renderGroupResults(results, groupSize) {
  const container = document.getElementById('group-results');
  if (results.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No compatible groups found. Try a different world or add more Pokemon.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="results-header">
      <h2>Best Groups of ${groupSize}</h2>
      <span class="results-count">${results.length} results</span>
    </div>
    ${results.map((r, i) => `
      <div class="result-card">
        <div class="result-top">
          <span class="result-rank">${i + 1}</span>
          <span style="font-weight:600;font-size:16px;">Group #${i + 1}</span>
          <span class="result-score">${r.categories.size} shared categor${r.categories.size === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="result-pokemon">
          ${r.group.map(p => {
            const w = getWorld(p);
            const wClass = w ? worldToClass(w) : '';
            return `<span class="pokemon-badge" data-pokemon="${esc(p)}" title="${esc(w)}">${isOwned(p) && w ? '<span class="world-dot ' + wClass + '"></span>' : ''}${esc(p)} ${habitatBadge(p)}</span>`;
          }).join('')}
        </div>
        <div class="result-categories">
          ${[...r.categories].sort().map(c => `<span class="cat-badge">${esc(c)}</span>`).join('')}
        </div>
      </div>
    `).join('')}
  `;

  container.addEventListener('click', handlePokemonClick);
}

function handlePokemonClick(e) {
  const badge = e.target.closest('.pokemon-badge');
  if (badge) {
    showPokemonInfo(badge.dataset.pokemon);
  }
}

export function initGroupTab() {
  setupAutocomplete(
    document.getElementById('include-input'),
    document.getElementById('include-autocomplete'),
    (name) => {
      if (!mustInclude.includes(name)) {
        mustInclude.push(name);
        updateIncludeTags();
      }
    }
  );

  document.getElementById('btn-find').addEventListener('click', () => {
    const size = parseInt(document.getElementById('group-size').value) || 4;
    const topN = parseInt(document.getElementById('max-results').value) || 20;
    const ownedOnly = document.getElementById('owned-only').checked;
    const worldFilter = document.getElementById('world-filter').value;
    const respectHabitats = document.getElementById('respect-habitats').checked;
    const container = document.getElementById('group-results');

    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Finding best groups...</p></div>`;

    setTimeout(() => {
      const results = findBestGroups(size, topN,
        mustInclude.length > 0 ? mustInclude : null,
        ownedOnly, worldFilter, respectHabitats
      );
      renderGroupResults(results, size);
    }, 50);
  });
}

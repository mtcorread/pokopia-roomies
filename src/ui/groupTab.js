import {
  sharedCategories, getGroupHabitatConflicts, familyBonds,
  getFamily, sameFamily,
} from '../data.js';
import { planAll } from '../optimizer.js';
import { esc, habitatBadge } from './helpers.js';
import { showPokemonPopup } from './infoTab.js';

function renderGroupResults(result, houseSize) {
  const container = document.getElementById('group-results');

  if (result.houses.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <p>No compatible groups could be formed. Try disabling habitat constraints.</p>
    </div>`;
    return;
  }

  const totalPokemon = result.houses.reduce((s, h) => s + h.length, 0) + result.leftover.length;

  let html = `
    <div class="plan-summary">
      <div class="plan-stat">
        <div class="value">${totalPokemon}</div>
        <div class="label">Pokemon</div>
      </div>
      <div class="plan-stat">
        <div class="value">${result.houses.length}</div>
        <div class="label">${houseSize === 0 ? 'Clusters' : 'Groups'}</div>
      </div>
      <div class="plan-stat">
        <div class="value">${result.totalScore}</div>
        <div class="label">Total Shared Categories</div>
      </div>
      <div class="plan-stat">
        <div class="value">${result.leftover.length}</div>
        <div class="label">Ungrouped</div>
      </div>
      ${result.familyBondsTotal > 0 ? `<div class="plan-stat">
        <div class="value" style="color:#b388ff;">${result.familyBondsTotal}</div>
        <div class="label">Family Bonds</div>
      </div>` : ''}
      ${result.habitatConflicts > 0 ? `<div class="plan-stat">
        <div class="value" style="color:var(--accent);">${result.habitatConflicts}</div>
        <div class="label">Habitat Conflicts</div>
      </div>` : ''}
    </div>
  `;

  const evoColorPalette = ['#b388ff', '#82b1ff', '#80cbc4', '#fff176', '#ffab91', '#ce93d8'];

  result.houses.forEach((house, i) => {
    const cats = sharedCategories(house);
    const conflicts = getGroupHabitatConflicts(house);
    const bonds = familyBonds(house);
    const scoreClass = cats.size >= 3 ? 'good' : cats.size >= 1 ? 'ok' : 'bad';
    const houseClass = cats.size === 0 ? 'no-shared' : '';

    const familyColors = {};
    let colorIdx = 0;
    for (let a = 0; a < house.length; a++) {
      for (let b = a + 1; b < house.length; b++) {
        if (sameFamily(house[a], house[b])) {
          const fam = getFamily(house[a]);
          if (!familyColors[fam]) {
            familyColors[fam] = evoColorPalette[colorIdx % evoColorPalette.length];
            colorIdx++;
          }
        }
      }
    }

    html += `
      <div class="plan-house ${houseClass}">
        <div class="plan-house-header">
          <h3>${houseSize === 0 ? 'Cluster' : 'Group'} ${i + 1} <span style="color:var(--text-dim);font-weight:400;font-size:13px;">(${house.length} Pokemon)</span></h3>
          <div>
            ${bonds > 0 ? `<span style="font-size:13px;color:#b388ff;margin-right:12px;">&#9829; ${bonds} family bond${bonds > 1 ? 's' : ''}</span>` : ''}
            <span class="plan-house-score ${scoreClass}">${cats.size} shared categor${cats.size === 1 ? 'y' : 'ies'}</span>
          </div>
        </div>
        <div class="result-pokemon">
          ${house.map(p => {
            const fam = getFamily(p);
            const famColor = familyColors[fam];
            const border = famColor ? `border: 2px solid ${famColor}` : '';
            return `<span class="pokemon-badge" data-pokemon="${esc(p)}" style="${border}">${esc(p)} ${habitatBadge(p)}</span>`;
          }).join('')}
        </div>
        ${cats.size > 0 ? `<div class="result-categories">
          ${[...cats].sort().map(c => `<span class="cat-badge">${esc(c)}</span>`).join('')}
        </div>` : '<div style="color:var(--text-dim);font-size:13px;">No categories in common</div>'}
        ${conflicts.length > 0 ? `<div class="conflict-warning">
          Habitat conflicts: ${conflicts.map(c => `${esc(c.a)} (${esc(c.habA)}) vs ${esc(c.b)} (${esc(c.habB)})`).join(', ')}
        </div>` : ''}
      </div>
    `;
  });

  if (result.leftover.length > 0) {
    html += `
      <div class="plan-house leftover">
        <div class="plan-house-header">
          <h3>Ungrouped (${result.leftover.length} remaining)</h3>
          <span class="plan-house-score bad">Need more roommates</span>
        </div>
        <div class="result-pokemon">
          ${result.leftover.map(p => `<span class="pokemon-badge" data-pokemon="${esc(p)}">${esc(p)} ${habitatBadge(p)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  container.addEventListener('click', (e) => {
    const badge = e.target.closest('.pokemon-badge');
    if (badge) showPokemonPopup(badge.dataset.pokemon);
  });
}

export function initGroupTab() {
  document.getElementById('btn-find').addEventListener('click', () => {
    const houseSize = parseInt(document.getElementById('group-house-size').value);
    const respectHabitats = document.getElementById('group-respect-habitats').checked;
    const evoPriority = document.getElementById('group-evo-priority').checked;
    const container = document.getElementById('group-results');

    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Finding best groups for all Pokemon...</p></div>`;

    setTimeout(() => {
      const result = planAll(houseSize, respectHabitats, evoPriority);
      renderGroupResults(result, houseSize);
    }, 50);
  });
}

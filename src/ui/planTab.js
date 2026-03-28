import {
  sharedCategories, getGroupHabitatConflicts, familyBonds,
  allPokemon, getFamily, sameFamily, pokemonPrefs,
} from '../data.js';
import { planWithPool } from '../optimizer.js';
import { settings, getWorld } from '../settings.js';
import { esc, habitatBadge } from './helpers.js';
import { showPokemonPopup } from './infoTab.js';
import { spriteImg } from '../sprites.js';

function renderPlanResults(result, mode) {
  const container = document.getElementById('plan-results');
  const isAuto = mode === 'auto';

  if (result.houses.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <p>No compatible groups could be formed. Try changing your filters or disabling habitat constraints.</p>
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
        <div class="label">${isAuto ? 'Clusters' : 'Houses'}</div>
      </div>
      <div class="plan-stat">
        <div class="value">${result.totalScore}</div>
        <div class="label">Compatibility Score</div>
      </div>
      <div class="plan-stat">
        <div class="value">${result.leftover.length}</div>
        <div class="label">Unhoused</div>
      </div>
      ${result.familyBondsTotal > 0 ? `<div class="plan-stat">
        <div class="value" style="color:var(--clr-primary-a0);">${result.familyBondsTotal}</div>
        <div class="label">Family Bonds</div>
      </div>` : ''}
      ${result.habitatConflicts > 0 ? `<div class="plan-stat">
        <div class="value" style="color:var(--accent);">${result.habitatConflicts}</div>
        <div class="label">Habitat Conflicts</div>
      </div>` : ''}
    </div>
  `;

  const evoColorPalette = ['#8e7bcf', '#388cfa', '#009f42', '#f0ad4e', '#cf7b91', '#7566a9'];

  const absorbedInfo = result.absorbedInfo || {};

  result.houses.forEach((house, i) => {
    const coreMembers = house.filter(p => !absorbedInfo[p]);
    const absorbedMembers = house.filter(p => absorbedInfo[p]);
    const cats = sharedCategories(coreMembers.length >= 2 ? coreMembers : house);
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

    function renderBadge(p) {
      const fam = getFamily(p);
      const famColor = familyColors[fam];
      const border = famColor ? `border: 2px solid ${famColor}` : '';
      return `<span class="pokemon-badge" data-pokemon="${esc(p)}" style="${border}">${spriteImg(p)}${esc(p)} ${habitatBadge(p)}</span>`;
    }

    html += `
      <div class="plan-house ${houseClass}">
        <div class="plan-house-header">
          <h3>${isAuto ? 'Cluster' : 'House'} ${i + 1} <span style="color:var(--text-dim);font-weight:400;font-size:13px;">(${house.length} Pokemon)</span></h3>
          <div>
            ${bonds > 0 ? `<span style="font-size:13px;color:var(--clr-primary-a0);margin-right:12px;">&#9829; ${bonds} family bond${bonds > 1 ? 's' : ''}</span>` : ''}
            <span class="plan-house-score ${scoreClass}">${cats.size} shared categor${cats.size === 1 ? 'y' : 'ies'}</span>
          </div>
        </div>
        <div class="result-pokemon">
          ${coreMembers.map(renderBadge).join('')}
        </div>
        ${cats.size > 0 ? `<div class="result-categories">
          ${[...cats].sort().map(c => `<span class="cat-badge">${esc(c)}</span>`).join('')}
        </div>` : '<div style="color:var(--text-dim);font-size:13px;">No categories in common</div>'}
        ${(() => {
          // Find sub-groups: categories shared by 2+ members but not everyone
          const allCatsInHouse = new Set();
          for (const p of coreMembers) {
            for (const c of pokemonPrefs[p]) allCatsInHouse.add(c);
          }
          const subGroups = [];
          for (const cat of allCatsInHouse) {
            if (cats.has(cat)) continue; // skip group-wide categories
            const members = coreMembers.filter(p => pokemonPrefs[p].has(cat));
            if (members.length >= 2) {
              subGroups.push({ cat, members });
            }
          }
          if (subGroups.length === 0) return '';
          // Deduplicate: group categories that have the exact same members
          const byMembers = {};
          for (const sg of subGroups) {
            const key = sg.members.sort().join('|');
            if (!byMembers[key]) byMembers[key] = { members: sg.members, cats: [] };
            byMembers[key].cats.push(sg.cat);
          }
          const groups = Object.values(byMembers).sort((a, b) => b.members.length - a.members.length);
          return `<div style="margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:12px; color:var(--text-dim); margin-bottom:6px;">Sub-groups:</div>
            ${groups.map(g =>
              `<div style="margin-bottom:6px; font-size:13px;">
                <span style="color:var(--text-dim);">${g.members.map(p => esc(p)).join(', ')}</span>
                &mdash; ${g.cats.sort().map(c => `<span class="cat-badge" style="font-size:11px;">${esc(c)}</span>`).join(' ')}
              </div>`
            ).join('')}
          </div>`;
        })()}
        ${absorbedMembers.length > 0 ? `
          <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:12px; color:var(--text-dim); margin-bottom:8px;">Joined via shared categories:</div>
            ${absorbedMembers.map(p => {
              const info = absorbedInfo[p];
              const connections = info.connections.map(c =>
                `${esc(c.member)} (${[...c.shared].sort().map(cat => esc(cat)).join(', ')})`
              ).join('; ');
              return `<div style="margin-bottom:6px;">
                ${renderBadge(p)}
                <span style="font-size:12px; color:var(--text-dim);"> shares with ${connections}</span>
              </div>`;
            }).join('')}
          </div>
        ` : ''}
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
          <h3>Unhoused (${result.leftover.length} remaining)</h3>
          <span class="plan-house-score bad">Need more roommates</span>
        </div>
        <div class="result-pokemon">
          ${result.leftover.map(p => `<span class="pokemon-badge" data-pokemon="${esc(p)}">${spriteImg(p)}${esc(p)} ${habitatBadge(p)}</span>`).join('')}
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

function getPool() {
  const ownedOnly = document.getElementById('plan-owned-only').checked;
  const worldFilter = document.getElementById('plan-world').value;

  if (!ownedOnly) {
    return [...allPokemon];
  }

  let owned = Object.keys(settings.owned);
  if (worldFilter) {
    owned = owned.filter(p => getWorld(p) === worldFilter);
  }
  return owned;
}

export function initPlanTab() {
  const ownedToggle = document.getElementById('plan-owned-only');
  const worldRow = document.getElementById('plan-world-row');
  const modeSelect = document.getElementById('plan-house-mode');
  const sizeGroup = document.getElementById('plan-size-group');

  ownedToggle.addEventListener('change', () => {
    worldRow.style.display = ownedToggle.checked ? 'flex' : 'none';
  });

  modeSelect.addEventListener('change', () => {
    sizeGroup.style.display = modeSelect.value === 'auto' ? 'none' : '';
  });

  document.getElementById('btn-plan').addEventListener('click', () => {
    const modeType = modeSelect.value;
    const number = parseInt(document.getElementById('plan-house-number').value) || 4;
    const mode = modeType === 'auto' ? 'auto' : `${modeType}-${number}`;
    const respectHabitats = document.getElementById('plan-respect-habitats').checked;
    const evoPriority = document.getElementById('plan-evo-priority').checked;
    const container = document.getElementById('plan-results');
    const pool = getPool();

    const ownedOnly = document.getElementById('plan-owned-only').checked;
    const label = ownedOnly ? 'your Pokemon' : 'all Pokemon';
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Optimizing housing for ${esc(label)}...</p></div>`;

    setTimeout(() => {
      const result = planWithPool(pool, mode, respectHabitats, evoPriority);
      renderPlanResults(result, mode);
    }, 50);
  });
}

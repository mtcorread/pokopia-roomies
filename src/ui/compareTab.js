import { pokemonPrefs, sharedCategories } from '../data.js';
import { setupAutocomplete } from './autocomplete.js';
import { esc, renderTags } from './helpers.js';

let compareList = [];

function updateCompareTags() {
  renderTags(document.getElementById('compare-tags'), compareList, (idx) => {
    compareList.splice(idx, 1);
    updateCompareTags();
  });
}

export function initCompareTab() {
  setupAutocomplete(
    document.getElementById('compare-input'),
    document.getElementById('compare-autocomplete'),
    (name) => {
      if (!compareList.includes(name)) {
        compareList.push(name);
        updateCompareTags();
      }
    }
  );

  document.getElementById('btn-compare').addEventListener('click', () => {
    const container = document.getElementById('compare-results');
    if (compareList.length < 2) {
      container.innerHTML = `<div class="empty-state"><p>Add at least 2 Pokemon to compare</p></div>`;
      return;
    }

    const common = sharedCategories(compareList);
    let html = `<div class="compare-grid">`;

    html += `<div class="compare-section shared">
      <h3>Shared Categories (${common.size})</h3>
      <div class="info-cats">
        ${common.size > 0
          ? [...common].sort().map(c => `<span class="info-cat">${esc(c)}</span>`).join('')
          : '<p style="color:var(--text-dim)">No shared categories</p>'}
      </div>
    </div>`;

    for (const name of compareList) {
      const unique = new Set([...pokemonPrefs[name]].filter(c => !common.has(c)));
      html += `<div class="compare-section unique">
        <h3>Only ${esc(name)} (${unique.size})</h3>
        <div class="info-cats">
          ${unique.size > 0
            ? [...unique].sort().map(c => `<span class="info-cat">${esc(c)}</span>`).join('')
            : '<p style="color:var(--text-dim)">Nothing unique - all categories are shared!</p>'}
        </div>
      </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  });

  document.getElementById('btn-compare-clear').addEventListener('click', () => {
    compareList = [];
    updateCompareTags();
    document.getElementById('compare-results').innerHTML = '';
  });
}

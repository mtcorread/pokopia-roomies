import { allPokemon } from '../data.js';
import { isOwned, getWorld } from '../settings.js';
import { worldToClass } from './helpers.js';
import { spriteImg } from '../sprites.js';

export function setupAutocomplete(inputEl, listEl, onSelect, filterFn) {
  let highlighted = -1;
  let items = [];

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLowerCase();
    if (!q) { listEl.classList.remove('show'); return; }

    let source = allPokemon;
    if (filterFn) source = source.filter(filterFn);

    const matches = source.filter(p => p.toLowerCase().includes(q)).slice(0, 15);
    items = matches;
    highlighted = -1;
    listEl.innerHTML = matches.map((m, i) => {
      const owned = isOwned(m);
      const world = getWorld(m);
      const wClass = world ? 'world-' + worldToClass(world) : '';
      return `<div class="autocomplete-item" data-index="${i}">
        <span>${spriteImg(m)}${m}</span>
        ${owned ? `<span class="owned-marker ${wClass}">${world || 'Owned'}</span>` : ''}
      </div>`;
    }).join('');
    listEl.classList.toggle('show', matches.length > 0);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (!listEl.classList.contains('show')) {
      if (e.key === 'Enter') {
        const q = inputEl.value.trim();
        let source = allPokemon;
        if (filterFn) source = source.filter(filterFn);
        const exact = source.find(p => p.toLowerCase() === q.toLowerCase());
        if (exact) { onSelect(exact); inputEl.value = ''; }
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, items.length - 1);
      updateHL();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      updateHL();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < items.length) {
        onSelect(items[highlighted]);
        inputEl.value = '';
        listEl.classList.remove('show');
      }
    } else if (e.key === 'Escape') {
      listEl.classList.remove('show');
    }
  });

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (item) {
      onSelect(items[parseInt(item.dataset.index)]);
      inputEl.value = '';
      listEl.classList.remove('show');
    }
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.classList.remove('show');
    }
  });

  function updateHL() {
    listEl.querySelectorAll('.autocomplete-item').forEach((el, i) => {
      el.classList.toggle('highlighted', i === highlighted);
    });
  }
}

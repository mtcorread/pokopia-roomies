import { renderPokemonList } from './listTab.js';
import { renderCategoryList } from './categoriesTab.js';
import { renderMyPokemon } from './myPokemonTab.js';

export function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabName}`));
  if (tabName === 'list') renderPokemonList();
  if (tabName === 'categories') renderCategoryList();
  if (tabName === 'my') renderMyPokemon();
}

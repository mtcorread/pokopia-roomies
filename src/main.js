import './style.css';
import { initData } from './data.js';
import { loadSettings } from './settings.js';
import { switchTab } from './ui/tabs.js';
import { initPlanTab } from './ui/planTab.js';
import { initMyPokemonTab } from './ui/myPokemonTab.js';
import { initInfoTab } from './ui/infoTab.js';
import { initCompareTab } from './ui/compareTab.js';
import { initCategoriesTab } from './ui/categoriesTab.js';
import { initListTab } from './ui/listTab.js';

// Init data and settings
initData();
loadSettings();

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// Init all tabs
initPlanTab();
initMyPokemonTab();
initInfoTab();
initCompareTab();
initCategoriesTab();
initListTab();

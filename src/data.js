import POKOPIA_DATA from './pokopia-data.json';

export const WORLDS = ['Withered Wasteland', 'Bleak Beach', 'Rocky Ridges', 'Sparkling Skylands', 'Pallet Town'];

export const pokemonPrefs = {};
export const catToPokemon = {};
export const pokemonHabitat = {};
export const pokemonFamily = {};
export const familyMembers = {};
export const HABITAT_CONFLICTS = {
  Bright: ['Dark'],
  Dark: ['Bright', 'Warm'],
  Warm: ['Humid', 'Dark', 'Cool'],
  Humid: ['Warm', 'Dry'],
  Dry: ['Humid'],
  Cool: ['Warm'],
};

export let allPokemon = [];

export function initData() {
  const data = POKOPIA_DATA;

  for (const [category, info] of Object.entries(data.categories)) {
    catToPokemon[category] = new Set(info.pokemon);
    for (const p of info.pokemon) {
      if (!pokemonPrefs[p]) pokemonPrefs[p] = new Set();
      pokemonPrefs[p].add(category);
    }
  }

  if (data.habitats) {
    for (const [habitat, pList] of Object.entries(data.habitats)) {
      for (const p of pList) {
        pokemonHabitat[p] = habitat;
      }
    }
  }

  if (data.evolution_families) {
    data.evolution_families.forEach((members, idx) => {
      familyMembers[idx] = members;
      for (const p of members) {
        pokemonFamily[p] = idx;
      }
    });
  }

  allPokemon = Object.keys(pokemonPrefs).sort();
}

export function getHabitat(name) {
  return pokemonHabitat[name] || '';
}

export function habitatsConflict(h1, h2) {
  if (!h1 || !h2) return false;
  return (HABITAT_CONFLICTS[h1] || []).includes(h2);
}

export function groupHasHabitatConflict(group) {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if (habitatsConflict(getHabitat(group[i]), getHabitat(group[j]))) {
        return true;
      }
    }
  }
  return false;
}

export function getGroupHabitatConflicts(group) {
  const conflicts = [];
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const h1 = getHabitat(group[i]), h2 = getHabitat(group[j]);
      if (habitatsConflict(h1, h2)) {
        conflicts.push({ a: group[i], habA: h1, b: group[j], habB: h2 });
      }
    }
  }
  return conflicts;
}

export function getFamily(name) {
  return pokemonFamily[name] !== undefined ? pokemonFamily[name] : -1;
}

export function getFamilyMembers(name) {
  const fam = getFamily(name);
  return fam >= 0 ? familyMembers[fam] : [name];
}

export function sameFamily(a, b) {
  const fa = getFamily(a), fb = getFamily(b);
  return fa >= 0 && fa === fb;
}

export function familyBonds(group) {
  let bonds = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if (sameFamily(group[i], group[j])) bonds++;
    }
  }
  return bonds;
}

export function sharedCategories(group) {
  if (group.length === 0) return new Set();
  const sets = group.map(p => pokemonPrefs[p]);
  if (!sets[0]) return new Set();
  let result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    if (!sets[i]) return new Set();
    result = new Set([...result].filter(c => sets[i].has(c)));
  }
  return result;
}

export function setIntersection(a, b) {
  return new Set([...a].filter(x => b.has(x)));
}

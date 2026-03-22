import {
  allPokemon, pokemonPrefs,
  sharedCategories, setIntersection,
  getHabitat, habitatsConflict, groupHasHabitatConflict, getGroupHabitatConflicts,
  getFamily, sameFamily, familyBonds,
} from './data.js';
import { settings, isOwned, getWorld } from './settings.js';

// Cluster scoring: prioritizes group-wide shared categories, sub-group pairs as tiebreaker
// Formula: (groupWideCats^2 * groupSize * 100) + subGroupHappyPairs
export function happyPairsScore(members) {
  if (members.length < 2) return 0;
  const len = members.length;
  const catCounts = {};
  for (const p of members) {
    for (const c of pokemonPrefs[p]) {
      catCounts[c] = (catCounts[c] || 0) + 1;
    }
  }
  let groupWideCats = 0;
  let subGroupPairs = 0;
  for (const c in catCounts) {
    const n = catCounts[c];
    if (n === len) {
      groupWideCats++;
    } else if (n >= 2) {
      subGroupPairs += (n * (n - 1)) / 2;
    }
  }
  // Group-wide categories dominate: squared so 2 shared > 1 shared by far
  return (groupWideCats * groupWideCats) * len * 100 + subGroupPairs;
}

// Per-pokemon fit: how many group-wide categories does this pokemon participate in
function pokemonFit(pokemon, cluster) {
  const cats = sharedCategories(cluster);
  let fit = 0;
  for (const c of cats) {
    if (pokemonPrefs[pokemon].has(c)) fit++;
  }
  return fit;
}

// Efficient merge delta: counts only NEW cross-cluster happy pairs
function happyPairsDelta(a, b) {
  const catCountsA = {};
  for (const p of a) {
    for (const c of pokemonPrefs[p]) {
      catCountsA[c] = (catCountsA[c] || 0) + 1;
    }
  }
  const catCountsB = {};
  for (const p of b) {
    for (const c of pokemonPrefs[p]) {
      catCountsB[c] = (catCountsB[c] || 0) + 1;
    }
  }
  let delta = 0;
  for (const c in catCountsA) {
    if (catCountsB[c]) {
      delta += catCountsA[c] * catCountsB[c];
    }
  }
  return delta;
}

export function getPool(ownedOnly, worldFilter) {
  let pool = allPokemon;
  if (ownedOnly) {
    pool = pool.filter(p => isOwned(p));
  }
  if (worldFilter) {
    pool = pool.filter(p => isOwned(p) && getWorld(p) === worldFilter);
  }
  return pool;
}

export function findBestGroups(groupSize, topN, mustInclude, ownedOnly, worldFilter, respectHabitats) {
  const pool = getPool(ownedOnly, worldFilter);
  if (mustInclude && mustInclude.length > 0) {
    return findWithMustInclude(groupSize, topN, mustInclude, pool, respectHabitats);
  }
  return findGlobal(groupSize, topN, pool, respectHabitats);
}

function findWithMustInclude(groupSize, topN, mustInclude, pool, respectHabitats) {
  const forcedCats = sharedCategories(mustInclude);
  if (forcedCats.size === 0) return [];

  const remainingSlots = groupSize - mustInclude.length;
  if (remainingSlots <= 0) {
    return [{ group: [...mustInclude], categories: forcedCats, habitatConflict: groupHasHabitatConflict(mustInclude) }];
  }

  const mustSet = new Set(mustInclude);
  const candidates = [];
  for (const p of pool) {
    if (mustSet.has(p)) continue;
    if (respectHabitats && mustInclude.some(m => habitatsConflict(getHabitat(m), getHabitat(p)))) continue;
    const overlap = setIntersection(pokemonPrefs[p], forcedCats);
    if (overlap.size > 0) {
      candidates.push({ name: p, overlap: overlap.size });
    }
  }
  candidates.sort((a, b) => b.overlap - a.overlap);
  const cPool = candidates.map(c => c.name).slice(0, 80);

  const results = [];
  const seen = new Set();

  function combine(start, current) {
    if (current.length === remainingSlots) {
      const group = [...mustInclude, ...current].sort();
      const key = group.join('|');
      if (seen.has(key)) return;
      seen.add(key);
      if (respectHabitats && groupHasHabitatConflict(group)) return;
      const common = sharedCategories(group);
      if (common.size > 0) {
        results.push({ group, categories: common, habitatConflict: false });
      }
      return;
    }
    const remaining = remainingSlots - current.length;
    for (let i = start; i <= cPool.length - remaining; i++) {
      if (respectHabitats) {
        const newP = cPool[i];
        const conflict = current.some(c => habitatsConflict(getHabitat(c), getHabitat(newP)));
        if (conflict) continue;
      }
      current.push(cPool[i]);
      combine(i + 1, current);
      current.pop();
      if (results.length > topN * 10) return;
    }
  }

  combine(0, []);
  results.sort((a, b) => b.categories.size - a.categories.size);
  return results.slice(0, topN);
}

function findGlobal(groupSize, topN, pool, respectHabitats) {
  const sorted = [...pool].sort((a, b) =>
    pokemonPrefs[b].size - pokemonPrefs[a].size
  );
  const searchPool = sorted.slice(0, 150);

  const pairScores = [];
  for (let i = 0; i < searchPool.length; i++) {
    for (let j = i + 1; j < searchPool.length; j++) {
      if (respectHabitats && habitatsConflict(getHabitat(searchPool[i]), getHabitat(searchPool[j]))) continue;
      const common = setIntersection(pokemonPrefs[searchPool[i]], pokemonPrefs[searchPool[j]]);
      if (common.size > 0) {
        pairScores.push({ p1: searchPool[i], p2: searchPool[j], cats: common, score: common.size });
      }
    }
  }
  pairScores.sort((a, b) => b.score - a.score);

  if (groupSize === 2) {
    return pairScores.slice(0, topN).map(ps => ({
      group: [ps.p1, ps.p2].sort(),
      categories: ps.cats,
      habitatConflict: false,
    }));
  }

  const results = [];
  const seen = new Set();
  const topPairs = pairScores.slice(0, 300);

  for (const { p1, p2, cats: pairCats } of topPairs) {
    const compatible = [];
    for (const p of searchPool) {
      if (p === p1 || p === p2) continue;
      if (respectHabitats && (habitatsConflict(getHabitat(p), getHabitat(p1)) || habitatsConflict(getHabitat(p), getHabitat(p2)))) continue;
      const overlap = setIntersection(pokemonPrefs[p], pairCats);
      if (overlap.size > 0) {
        compatible.push({ name: p, overlap: overlap.size });
      }
    }
    compatible.sort((a, b) => b.overlap - a.overlap);
    const compat = compatible.map(c => c.name).slice(0, 50);

    const remaining = groupSize - 2;
    if (compat.length < remaining) continue;

    let count = 0;
    function expand(start, current) {
      if (current.length === remaining) {
        const group = [p1, p2, ...current].sort();
        const key = group.join('|');
        if (seen.has(key)) return;
        seen.add(key);
        if (respectHabitats && groupHasHabitatConflict(group)) return;
        const common = sharedCategories(group);
        if (common.size > 0) {
          results.push({ group, categories: common, habitatConflict: false });
        }
        count++;
        return;
      }
      const rem = remaining - current.length;
      for (let i = start; i <= compat.length - rem; i++) {
        if (respectHabitats) {
          const newP = compat[i];
          if (current.some(c => habitatsConflict(getHabitat(c), getHabitat(newP)))) continue;
        }
        current.push(compat[i]);
        expand(i + 1, current);
        current.pop();
        if (count > 200) return;
      }
    }

    expand(0, []);
    if (results.length > topN * 20) break;
  }

  results.sort((a, b) => b.categories.size - a.categories.size);
  return results.slice(0, topN);
}

export function planAll(houseSize, respectHabitats, evoPriority) {
  const pool = [...allPokemon];
  return planWithPool(pool, houseSize, respectHabitats, evoPriority);
}

export function planWithPool(pool, mode, respectHabitats, evoPriority) {
  if (mode === 'auto') return planAutoWithPool(pool, respectHabitats, evoPriority);
  const [type, sizeStr] = mode.split('-');
  const size = parseInt(sizeStr);
  if (type === 'max') return planMaxWithPool(pool, size, respectHabitats, evoPriority);
  return planFixedWithPool(pool, size, respectHabitats, evoPriority);
}

function planAutoWithPool(pool, respectHabitats, evoPriority) {

  if (pool.length === 0) return { houses: [], leftover: [], totalScore: 0, habitatConflicts: 0, familyBondsTotal: 0 };

  let clusters = pool.map(p => [p]);

  function clusterScore(c) {
    return happyPairsScore(c);
  }

  function canMerge(a, b) {
    if (respectHabitats) {
      const merged = [...a, ...b];
      if (groupHasHabitatConflict(merged)) return false;
    }
    // All members of merged cluster must share at least 1 category
    const merged = [...a, ...b];
    if (sharedCategories(merged).size === 0) return false;
    return true;
  }

  function mergeScore(a, b) {
    let score = happyPairsDelta(a, b);
    if (evoPriority) {
      for (const pa of a) {
        for (const pb of b) {
          if (sameFamily(pa, pb)) score += 50;
        }
      }
    }
    return score;
  }

  // Phase 1: Merge clusters greedily
  let improved = true;
  while (improved) {
    improved = false;
    let bestI = -1, bestJ = -1, bestScore = 0;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (!canMerge(clusters[i], clusters[j])) continue;
        const s = mergeScore(clusters[i], clusters[j]);
        if (s > bestScore) {
          bestScore = s;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestI >= 0) {
      clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]];
      clusters.splice(bestJ, 1);
      improved = true;
    }
  }

  // Phase 2: Local search — move pokemon between clusters to improve total score
  let houses = clusters.filter(c => c.length >= 2);
  let singletons = clusters.filter(c => c.length === 1).map(c => c[0]);

  function groupValid(group) {
    if (!respectHabitats) return true;
    return !groupHasHabitatConflict(group);
  }

  let localImproved = true;
  let localIterations = 0;
  const maxLocalIterations = 300;

  while (localImproved && localIterations < maxLocalIterations) {
    localImproved = false;
    localIterations++;

    // Try swapping members between two clusters
    for (let i = 0; i < houses.length; i++) {
      for (let j = i + 1; j < houses.length; j++) {
        for (let a = 0; a < houses[i].length; a++) {
          for (let b = 0; b < houses[j].length; b++) {
            const scoreBefore = clusterScore(houses[i]) + clusterScore(houses[j]);
            const tmpI = [...houses[i]];
            const tmpJ = [...houses[j]];
            [tmpI[a], tmpJ[b]] = [tmpJ[b], tmpI[a]];
            if (!groupValid(tmpI) || !groupValid(tmpJ)) continue;
            // Both clusters must still have at least 1 shared category
            if (sharedCategories(tmpI).size === 0 || sharedCategories(tmpJ).size === 0) continue;
            const scoreAfter = clusterScore(tmpI) + clusterScore(tmpJ);
            if (scoreAfter > scoreBefore) {
              houses[i] = tmpI;
              houses[j] = tmpJ;
              localImproved = true;
            }
          }
        }
      }
    }

    // Try moving a pokemon from one cluster to another
    for (let i = 0; i < houses.length; i++) {
      for (let a = 0; a < houses[i].length; a++) {
        const p = houses[i][a];
        for (let j = 0; j < houses.length; j++) {
          if (i === j) continue;
          const srcWithout = houses[i].filter((_, idx) => idx !== a);
          const dstWith = [...houses[j], p];
          if (!groupValid(dstWith)) continue;
          // Source must still be valid (2+ members with shared categories)
          if (srcWithout.length < 2 || sharedCategories(srcWithout).size === 0) continue;
          if (sharedCategories(dstWith).size === 0) continue;
          const scoreBefore = clusterScore(houses[i]) + clusterScore(houses[j]);
          const scoreAfter = clusterScore(srcWithout) + clusterScore(dstWith);
          if (scoreAfter > scoreBefore) {
            houses[i] = srcWithout;
            houses[j] = dstWith;
            localImproved = true;
          }
        }
      }
    }

    // Clean up any clusters that became too small
    const newSingletons = houses.filter(h => h.length < 2).flatMap(h => h);
    houses = houses.filter(h => h.length >= 2);
    singletons.push(...newSingletons);
  }

  houses.sort((a, b) => clusterScore(b) - clusterScore(a));

  // Phase 3: Try to absorb singletons into existing clusters

  // absorbedInfo: { pokemon -> { connections: [{member, shared: Set}] } }
  const absorbedInfo = {};
  const absorbed = new Set();
  for (const p of singletons) {
    let bestHouse = -1, bestScore = -1;
    for (let h = 0; h < houses.length; h++) {
      let pairOverlap = 0;
      for (const member of houses[h]) {
        pairOverlap += setIntersection(pokemonPrefs[p], pokemonPrefs[member]).size;
      }
      if (pairOverlap === 0) continue;
      if (respectHabitats) {
        const test = [...houses[h], p];
        if (groupHasHabitatConflict(test)) continue;
      }
      if (pairOverlap > bestScore) {
        bestScore = pairOverlap;
        bestHouse = h;
      }
    }
    if (bestHouse >= 0) {
      const connections = [];
      for (const member of houses[bestHouse]) {
        const shared = setIntersection(pokemonPrefs[p], pokemonPrefs[member]);
        if (shared.size > 0) {
          connections.push({ member, shared });
        }
      }
      houses[bestHouse].push(p);
      absorbed.add(p);
      absorbedInfo[p] = { connections };
    }
  }

  const leftover = singletons.filter(p => !absorbed.has(p));

  let habitatConflicts = 0;
  for (const h of houses) habitatConflicts += getGroupHabitatConflicts(h).length;
  let familyBondsTotal = 0;
  for (const h of houses) familyBondsTotal += familyBonds(h);
  const totalScore = houses.reduce((sum, h) => sum + clusterScore(h), 0);

  return { houses, leftover, totalScore, habitatConflicts, familyBondsTotal, absorbedInfo, iterations: 0 };
}

export function planWorld(world, houseSize, respectHabitats, evoPriority) {
  const pool = Object.entries(settings.owned)
    .filter(([_, info]) => info.world === world)
    .map(([name]) => name);
  return planWithPool(pool, houseSize, respectHabitats, evoPriority);
}

function planMaxWithPool(pool, maxSize, respectHabitats, evoPriority) {
  if (pool.length === 0) return { houses: [], leftover: [], totalScore: 0, habitatConflicts: 0, familyBondsTotal: 0 };

  function groupScore(group) {
    return happyPairsScore(group);
  }

  function canAdd(group, p) {
    if (group.length >= maxSize) return false;
    if (respectHabitats) {
      const h = getHabitat(p);
      for (const g of group) {
        if (habitatsConflict(h, getHabitat(g))) return false;
      }
    }
    // Must share at least 1 category with at least 1 member
    for (const g of group) {
      if (setIntersection(pokemonPrefs[p], pokemonPrefs[g]).size > 0) return true;
    }
    return false;
  }

  function groupValid(group) {
    if (!respectHabitats) return true;
    return !groupHasHabitatConflict(group);
  }

  // Build pairwise scores
  const compat = {};
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const shared = setIntersection(pokemonPrefs[pool[i]], pokemonPrefs[pool[j]]);
      const key = pool[i] + '|' + pool[j];
      compat[key] = shared.size;
    }
  }

  function pairScore(a, b) {
    const key = a < b ? a + '|' + b : b + '|' + a;
    return compat[key] || 0;
  }

  let remaining = new Set(pool);
  let houses = [];

  // Pre-seed with evolution families
  if (evoPriority) {
    const familiesInPool = {};
    for (const p of pool) {
      const fam = getFamily(p);
      if (fam < 0) continue;
      if (!familiesInPool[fam]) familiesInPool[fam] = [];
      familiesInPool[fam].push(p);
    }

    const sortedFamilies = Object.values(familiesInPool)
      .filter(members => members.length >= 2)
      .sort((a, b) => b.length - a.length);

    for (const famMembers of sortedFamilies) {
      const available = famMembers.filter(p => remaining.has(p));
      if (available.length < 2) continue;
      if (respectHabitats && groupHasHabitatConflict(available)) continue;

      if (available.length <= maxSize) {
        for (const p of available) remaining.delete(p);
        houses.push([...available]);
      } else {
        for (let i = 0; i < available.length; i += maxSize) {
          const chunk = available.slice(i, i + maxSize);
          if (chunk.length >= 2) {
            for (const p of chunk) remaining.delete(p);
            houses.push(chunk);
          }
        }
      }
    }
  }

  // Greedy: build houses from pairs, grow up to maxSize
  const failedPairs = new Set();

  while (remaining.size >= 2) {
    const rem = [...remaining];

    let bestPair = null, bestPairScore = -1;
    for (let i = 0; i < rem.length; i++) {
      for (let j = i + 1; j < rem.length; j++) {
        const pairKey = rem[i] + '|' + rem[j];
        if (failedPairs.has(pairKey)) continue;
        if (respectHabitats && habitatsConflict(getHabitat(rem[i]), getHabitat(rem[j]))) continue;
        let s = pairScore(rem[i], rem[j]);
        if (s === 0) continue;
        if (evoPriority && sameFamily(rem[i], rem[j])) s += 100;
        if (s > bestPairScore) {
          bestPairScore = s;
          bestPair = [rem[i], rem[j]];
        }
      }
    }

    if (!bestPair) break;

    let group = [...bestPair];

    // Grow up to maxSize
    while (group.length < maxSize) {
      let bestAdd = null, bestAddScore = -1;
      for (const p of remaining) {
        if (group.includes(p)) continue;
        if (!canAdd(group, p)) continue;
        const testGroup = [...group, p];
        let score = happyPairsScore(testGroup);
        if (evoPriority && group.some(g => sameFamily(g, p))) score += 50;
        if (score > bestAddScore) {
          bestAddScore = score;
          bestAdd = p;
        }
      }
      if (bestAdd) {
        group.push(bestAdd);
      } else {
        break;
      }
    }

    if (group.length < 2) {
      failedPairs.add(bestPair[0] + '|' + bestPair[1]);
      continue;
    }

    for (const p of group) remaining.delete(p);
    houses.push(group);
  }

  let leftover = [...remaining];

  // Local search: swap between houses + swap with leftover
  let improved = true;
  let iterations = 0;
  const maxIterations = 500;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < houses.length; i++) {
      for (let j = i + 1; j < houses.length; j++) {
        for (let a = 0; a < houses[i].length; a++) {
          for (let b = 0; b < houses[j].length; b++) {
            const scoreBefore = groupScore(houses[i]) + groupScore(houses[j]);
            const tmpI = [...houses[i]];
            const tmpJ = [...houses[j]];
            [tmpI[a], tmpJ[b]] = [tmpJ[b], tmpI[a]];
            if (!groupValid(tmpI) || !groupValid(tmpJ)) continue;
            const scoreAfter = groupScore(tmpI) + groupScore(tmpJ);
            if (scoreAfter > scoreBefore) {
              houses[i] = tmpI;
              houses[j] = tmpJ;
              improved = true;
            }
          }
        }
      }

      for (let a = 0; a < houses[i].length; a++) {
        for (let l = 0; l < leftover.length; l++) {
          const tmpH = [...houses[i]];
          tmpH[a] = leftover[l];
          if (!groupValid(tmpH)) continue;
          const scoreBefore = groupScore(houses[i]);
          const scoreAfter = groupScore(tmpH);
          if (scoreAfter > scoreBefore) {
            const old = houses[i][a];
            houses[i] = tmpH;
            leftover[l] = old;
            improved = true;
          }
        }
      }
    }
  }

  // Try to absorb leftover into existing houses that have room
  const absorbed = new Set();
  for (const p of leftover) {
    let bestHouse = -1, bestScore = -1;
    for (let h = 0; h < houses.length; h++) {
      if (houses[h].length >= maxSize) continue;
      let pairOverlap = 0;
      for (const member of houses[h]) {
        pairOverlap += setIntersection(pokemonPrefs[p], pokemonPrefs[member]).size;
      }
      if (pairOverlap === 0) continue;
      if (respectHabitats) {
        const test = [...houses[h], p];
        if (groupHasHabitatConflict(test)) continue;
      }
      if (pairOverlap > bestScore) {
        bestScore = pairOverlap;
        bestHouse = h;
      }
    }
    if (bestHouse >= 0) {
      houses[bestHouse].push(p);
      absorbed.add(p);
    }
  }
  leftover = leftover.filter(p => !absorbed.has(p));

  let habitatConflicts = 0;
  for (const h of houses) habitatConflicts += getGroupHabitatConflicts(h).length;

  houses.sort((a, b) => groupScore(b) - groupScore(a));

  let familyBondsTotal = 0;
  for (const h of houses) familyBondsTotal += familyBonds(h);

  return {
    houses,
    leftover,
    totalScore: houses.reduce((sum, h) => sum + groupScore(h), 0),
    habitatConflicts,
    familyBondsTotal,
    iterations,
  };
}

function planFixedWithPool(pool, houseSize, respectHabitats, evoPriority) {
  if (pool.length === 0) return { houses: [], leftover: [], totalScore: 0, habitatConflicts: 0, familyBondsTotal: 0 };

  function groupScore(group) {
    return happyPairsScore(group);
  }

  function totalScoreFn(houses) {
    return houses.reduce((sum, h) => sum + groupScore(h), 0);
  }

  function canAdd(group, p) {
    if (!respectHabitats) return true;
    const h = getHabitat(p);
    for (const g of group) {
      if (habitatsConflict(h, getHabitat(g))) return false;
    }
    return true;
  }

  function groupValid(group) {
    if (!respectHabitats) return true;
    return !groupHasHabitatConflict(group);
  }

  // Build pairwise compatibility matrix
  const compat = {};
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const shared = setIntersection(pokemonPrefs[pool[i]], pokemonPrefs[pool[j]]);
      const key = pool[i] + '|' + pool[j];
      compat[key] = shared.size;
    }
  }

  function pairScore(a, b) {
    const key = a < b ? a + '|' + b : b + '|' + a;
    return compat[key] || 0;
  }

  // Step 0: Pre-seed houses with evolution families
  let remaining = new Set(pool);
  let houses = [];

  if (evoPriority) {
    const familiesInPool = {};
    for (const p of pool) {
      const fam = getFamily(p);
      if (fam < 0) continue;
      if (!familiesInPool[fam]) familiesInPool[fam] = [];
      familiesInPool[fam].push(p);
    }

    const sortedFamilies = Object.values(familiesInPool)
      .filter(members => members.length >= 2)
      .sort((a, b) => b.length - a.length);

    for (const famMembers of sortedFamilies) {
      const available = famMembers.filter(p => remaining.has(p));
      if (available.length < 2) continue;
      if (respectHabitats && groupHasHabitatConflict(available)) continue;

      if (available.length <= houseSize) {
        for (const p of available) remaining.delete(p);
        houses.push([...available]);
      } else {
        for (let i = 0; i < available.length; i += houseSize) {
          const chunk = available.slice(i, i + houseSize);
          if (chunk.length >= 2) {
            for (const p of chunk) remaining.delete(p);
            houses.push(chunk);
          }
        }
      }
    }

    // Fill up partial houses
    for (let h = 0; h < houses.length; h++) {
      while (houses[h].length < houseSize && remaining.size > 0) {
        let bestAdd = null, bestAddScore = -1;
        for (const p of remaining) {
          if (!canAdd(houses[h], p)) continue;
          const testGroup = [...houses[h], p];
          let score = happyPairsScore(testGroup);
          if (evoPriority && houses[h].some(g => sameFamily(g, p))) score += 50;
          if (score > bestAddScore) {
            bestAddScore = score;
            bestAdd = p;
          }
        }
        if (bestAdd) {
          houses[h].push(bestAdd);
          remaining.delete(bestAdd);
        } else {
          break;
        }
      }
    }
  }

  // Step 1: Greedy assignment for remaining Pokemon
  // BUG FIX: Track failed pairs so we don't retry them, and continue instead of breaking
  const failedPairs = new Set();

  while (remaining.size >= houseSize) {
    const rem = [...remaining];

    let bestPair = null, bestPairScore = -1;
    for (let i = 0; i < rem.length; i++) {
      for (let j = i + 1; j < rem.length; j++) {
        const pairKey = rem[i] + '|' + rem[j];
        if (failedPairs.has(pairKey)) continue;
        if (respectHabitats && habitatsConflict(getHabitat(rem[i]), getHabitat(rem[j]))) continue;
        let s = pairScore(rem[i], rem[j]);
        if (evoPriority && sameFamily(rem[i], rem[j])) s += 100;
        if (s > bestPairScore) {
          bestPairScore = s;
          bestPair = [rem[i], rem[j]];
        }
      }
    }

    if (!bestPair) break;

    let group = [...bestPair];

    while (group.length < houseSize) {
      let bestAdd = null, bestAddScore = -1;

      for (const p of remaining) {
        if (group.includes(p)) continue;
        if (!canAdd(group, p)) continue;
        const testGroup = [...group, p];
        let score = happyPairsScore(testGroup);
        if (evoPriority && group.some(g => sameFamily(g, p))) score += 50;
        if (score > bestAddScore) {
          bestAddScore = score;
          bestAdd = p;
        }
      }

      if (bestAdd) {
        group.push(bestAdd);
      } else {
        break;
      }
    }

    if (group.length < houseSize) {
      // Mark this pair as failed and try the next one
      failedPairs.add(bestPair[0] + '|' + bestPair[1]);
      continue;
    }

    for (const p of group) remaining.delete(p);
    houses.push(group);
  }

  let leftover = [...remaining];

  // Step 2: Local search improvement
  let improved = true;
  let iterations = 0;
  const maxIterations = 500;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < houses.length; i++) {
      for (let j = i + 1; j < houses.length; j++) {
        for (let a = 0; a < houses[i].length; a++) {
          for (let b = 0; b < houses[j].length; b++) {
            const scoreBefore = groupScore(houses[i]) + groupScore(houses[j]);
            const tmpI = [...houses[i]];
            const tmpJ = [...houses[j]];
            [tmpI[a], tmpJ[b]] = [tmpJ[b], tmpI[a]];
            if (!groupValid(tmpI) || !groupValid(tmpJ)) continue;
            const scoreAfter = groupScore(tmpI) + groupScore(tmpJ);
            if (scoreAfter > scoreBefore) {
              houses[i] = tmpI;
              houses[j] = tmpJ;
              improved = true;
            }
          }
        }
      }

      for (let a = 0; a < houses[i].length; a++) {
        for (let l = 0; l < leftover.length; l++) {
          const tmpH = [...houses[i]];
          tmpH[a] = leftover[l];
          if (!groupValid(tmpH)) continue;
          const scoreBefore = groupScore(houses[i]);
          const scoreAfter = groupScore(tmpH);
          if (scoreAfter > scoreBefore) {
            const old = houses[i][a];
            houses[i] = tmpH;
            leftover[l] = old;
            improved = true;
          }
        }
      }
    }
  }

  let habitatConflicts = 0;
  for (const h of houses) habitatConflicts += getGroupHabitatConflicts(h).length;

  houses.sort((a, b) => groupScore(b) - groupScore(a));

  let familyBondsTotal = 0;
  for (const h of houses) familyBondsTotal += familyBonds(h);

  return {
    houses,
    leftover,
    totalScore: totalScoreFn(houses),
    habitatConflicts,
    familyBondsTotal,
    iterations,
  };
}

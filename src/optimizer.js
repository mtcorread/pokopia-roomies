import {
  allPokemon, pokemonPrefs,
  sharedCategories, setIntersection,
  getHabitat, habitatsConflict, groupHasHabitatConflict, getGroupHabitatConflicts,
  getFamily, sameFamily, familyBonds,
} from './data.js';
import { settings, isOwned, getWorld } from './settings.js';

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

export function planWorldAuto(world, respectHabitats, evoPriority) {
  const pool = Object.entries(settings.owned)
    .filter(([_, info]) => info.world === world)
    .map(([name]) => name);

  if (pool.length === 0) return { houses: [], leftover: [], totalScore: 0, habitatConflicts: 0, familyBondsTotal: 0 };

  let clusters = pool.map(p => [p]);

  function clusterScore(c) {
    if (c.length < 2) return 0;
    return sharedCategories(c).size;
  }

  function canMerge(a, b) {
    const merged = [...a, ...b];
    if (respectHabitats && groupHasHabitatConflict(merged)) return false;
    if (sharedCategories(merged).size === 0) return false;
    return true;
  }

  function mergeScore(a, b) {
    const merged = [...a, ...b];
    let score = sharedCategories(merged).size * 1000;
    if (evoPriority) {
      for (const pa of a) {
        for (const pb of b) {
          if (sameFamily(pa, pb)) score += 500;
        }
      }
    }
    return score;
  }

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

  const houses = clusters.filter(c => c.length >= 2).sort((a, b) => clusterScore(b) - clusterScore(a));
  const leftover = clusters.filter(c => c.length === 1).map(c => c[0]);

  let habitatConflicts = 0;
  for (const h of houses) habitatConflicts += getGroupHabitatConflicts(h).length;
  let familyBondsTotal = 0;
  for (const h of houses) familyBondsTotal += familyBonds(h);
  const totalScore = houses.reduce((sum, h) => sum + clusterScore(h), 0);

  return { houses, leftover, totalScore, habitatConflicts, familyBondsTotal, iterations: 0 };
}

export function planWorld(world, houseSize, respectHabitats, evoPriority) {
  if (houseSize === 0) return planWorldAuto(world, respectHabitats, evoPriority);

  const pool = Object.entries(settings.owned)
    .filter(([_, info]) => info.world === world)
    .map(([name]) => name);

  if (pool.length === 0) return { houses: [], leftover: [], totalScore: 0, habitatConflicts: 0, familyBondsTotal: 0 };

  function groupScore(group) {
    if (group.length < 2) return 0;
    return sharedCategories(group).size;
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
          const testCats = sharedCategories(testGroup);
          let score = testCats.size * 1000;
          for (const g of houses[h]) score += pairScore(p, g);
          if (houses[h].some(g => sameFamily(g, p))) score += 500;
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
        const testCats = sharedCategories(testGroup);
        let score = testCats.size * 1000;
        for (const g of group) score += pairScore(p, g);
        if (evoPriority && group.some(g => sameFamily(g, p))) score += 5000;
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

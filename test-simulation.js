// test-simulation.js — จำลองสถานการณ์จริง 10 รอบ เล่น 2 ชั่วโมง เกมละ 15 แต้ม

const SESSION_MINUTES = 120;   // 2 ชั่วโมง
const GAME_MIN = 10;           // เร็วสุด (นาที)
const GAME_MAX = 20;           // ช้าสุด (นาที)
const CHANGEOVER = 2;          // พักระหว่างเกม (นาที)
const MIN_GAME_TO_START = 10;  // ต้องมีเวลาเหลืออย่างน้อยเท่านี้จึงเริ่มเกม
const NUM_ROUNDS = 10;

const fixedPlayerList = [
  { name: "ฟลุค", gender: "male" },
  { name: "ไผ่",  gender: "male" },
  { name: "นิกกี้", gender: "male" },
  { name: "อาย",  gender: "female" },
  { name: "ที",   gender: "male" },
  { name: "ใหม่", gender: "male" },
  { name: "ต้นหอม", gender: "male" },
  { name: "เวย์", gender: "male" },
  { name: "อายอาย", gender: "female" },
  { name: "แชมป์", gender: "male" },
];

// ========== ฟังก์ชัน logic (copy จาก script.js) ==========

function initPlayers() {
  return fixedPlayerList.map((p) => ({
    name: p.name, gender: p.gender, played: 0, waitCount: 0, waited: 0,
  }));
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPairKey(p1, p2) {
  return [p1.name, p2.name].sort().join("|");
}

function removeDuplicateByKey(arr, key) {
  const seen = new Set();
  return arr.filter((item) => {
    if (seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  });
}

function selectBalancedPlayers(players, lastLosers) {
  const available = players.filter(
    (p) => p.waitCount === 0 && !lastLosers.includes(p.name)
  );
  if (available.length < 4) return [];
  const minPlayed = Math.min(...available.map((p) => p.played));
  const leastPlayed = available.filter((p) => p.played === minPlayed);
  if (leastPlayed.length >= 4) return shuffleArray(leastPlayed).slice(0, 4);
  const remaining = available
    .filter((p) => p.played !== minPlayed)
    .sort((a, b) => a.played - b.played || b.waited - a.waited);
  return leastPlayed.concat(remaining.slice(0, 4 - leastPlayed.length));
}

function buildTeams(selected, pairHistory) {
  const males = selected.filter((p) => p.gender === "male");
  const females = selected.filter((p) => p.gender === "female");
  let configs;
  if (females.length >= 2 && males.length >= 2) {
    configs = [
      [[males[0], females[0]], [males[1], females[1]]],
      [[males[0], females[1]], [males[1], females[0]]],
    ];
  } else if (females.length === 1 && males.length >= 3) {
    configs = [
      [[males[0], females[0]], [males[1], males[2]]],
      [[males[1], females[0]], [males[0], males[2]]],
      [[males[2], females[0]], [males[0], males[1]]],
    ];
  } else {
    configs = [
      [[selected[0], selected[1]], [selected[2], selected[3]]],
      [[selected[0], selected[2]], [selected[1], selected[3]]],
      [[selected[0], selected[3]], [selected[1], selected[2]]],
    ];
  }
  configs.sort((a, b) => {
    const score = (cfg) =>
      (pairHistory[getPairKey(cfg[0][0], cfg[0][1])] || 0) +
      (pairHistory[getPairKey(cfg[1][0], cfg[1][1])] || 0);
    return score(a) - score(b);
  });
  return [{ team: configs[0][0] }, { team: configs[0][1] }];
}

function selectBestPair(candidates, pairHistory) {
  if (candidates.length <= 2) return candidates.slice(0, 2);
  let best = { pair: [candidates[0], candidates[1]] };
  best.played = best.pair[0].played + best.pair[1].played;
  best.waited = best.pair[0].waited + best.pair[1].waited;
  best.pairScore = pairHistory[getPairKey(best.pair[0], best.pair[1])] || 0;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const tp = candidates[i].played + candidates[j].played;
      const tw = candidates[i].waited + candidates[j].waited;
      const ps = pairHistory[getPairKey(candidates[i], candidates[j])] || 0;
      if (
        tp < best.played ||
        (tp === best.played && tw > best.waited) ||
        (tp === best.played && tw === best.waited && ps < best.pairScore)
      ) {
        best = { pair: [candidates[i], candidates[j]], played: tp, waited: tw, pairScore: ps };
      }
    }
  }
  return best.pair;
}

// ========== จำลองหนึ่ง session ==========

function simulateSession(sessionNum) {
  let players = initPlayers();
  let pairHistory = {};
  let lastLosers = [];
  let currentChampion = null;
  let championWinCount = 0;
  const matches = [];
  let timeUsed = 0;

  function getRandomMatch() {
    const sel = selectBalancedPlayers(players, lastLosers);
    if (sel.length < 4) return null;
    return buildTeams(sel, pairHistory);
  }

  function getChampionMatch(winnerTeam) {
    const remaining = players
      .filter((p) => !winnerTeam.some((w) => w.name === p.name) && p.waitCount === 0)
      .sort((a, b) => a.played - b.played || b.waited - a.waited);
    if (remaining.length < 2) return null;
    const minP = Math.min(...remaining.map((p) => p.played));
    const least = remaining.filter((p) => p.played === minP);
    let cands =
      least.length >= 2 ? least
      : least.length === 1 ? removeDuplicateByKey([...least, ...remaining], "name")
      : remaining;
    return [{ team: winnerTeam }, { team: selectBestPair(cands, pairHistory) }];
  }

  let currentMatch = getRandomMatch();

  while (true) {
    const gameDuration = Math.round(GAME_MIN + Math.random() * (GAME_MAX - GAME_MIN));
    if (timeUsed + gameDuration > SESSION_MINUTES) break;
    if (!currentMatch) {
      currentMatch = getRandomMatch();
      if (!currentMatch) break;
    }

    timeUsed += gameDuration + CHANGEOVER;

    const winnerIndex = Math.random() < 0.5 ? 0 : 1;
    const winnerTeam = currentMatch[winnerIndex].team;
    const loserTeam = currentMatch[1 - winnerIndex].team;

    matches.push({
      num: matches.length + 1,
      t1: currentMatch[0].team.map((p) => p.name).join("+"),
      t2: currentMatch[1].team.map((p) => p.name).join("+"),
      winner: winnerTeam.map((p) => p.name).join("+"),
      duration: gameDuration,
      timeUsed,
      type: currentChampion ? `defend${championWinCount}` : "random",
    });

    [...winnerTeam, ...loserTeam].forEach((pl) => {
      const f = players.find((p) => p.name === pl.name);
      if (f) { f.played++; f.waited = 0; }
    });
    loserTeam.forEach((pl) => {
      const f = players.find((p) => p.name === pl.name);
      if (f) f.waitCount = 2;
    });
    players.forEach((p) => { if (p.waitCount > 0) p.waitCount--; });
    players.forEach((p) => {
      const inGame = [...winnerTeam, ...loserTeam].some((x) => x.name === p.name);
      if (!inGame && p.waitCount === 0) p.waited = (p.waited || 0) + 1;
    });
    lastLosers = loserTeam.map((p) => p.name);
    [winnerTeam, loserTeam].forEach((team) => {
      if (team.length >= 2) {
        const key = getPairKey(team[0], team[1]);
        pairHistory[key] = (pairHistory[key] || 0) + 1;
      }
    });

    const wKey = winnerTeam.map((p) => p.name).join("+");
    if (currentChampion === wKey) championWinCount++;
    else { currentChampion = wKey; championWinCount = 1; }

    if (championWinCount >= 2) {
      winnerTeam.forEach((pl) => {
        const f = players.find((p) => p.name === pl.name);
        if (f) f.waitCount = 1;
      });
      currentChampion = null; championWinCount = 0;
      currentMatch = getRandomMatch();
    } else {
      const cm = getChampionMatch(winnerTeam);
      if (!cm) { currentChampion = null; championWinCount = 0; currentMatch = getRandomMatch(); }
      else currentMatch = cm;
    }
  }

  return { sessionNum, matches, players, pairHistory, timeUsed };
}

// ========== แสดงผล ==========

const LINE  = "─".repeat(68);
const DLINE = "═".repeat(68);

// สะสม stats ทุก session สำหรับ summary
const allPlayedByName = {};
const allPairCounts = {};
const gamesPerSession = [];
fixedPlayerList.forEach((p) => { allPlayedByName[p.name] = []; });

console.log(DLINE);
console.log("  🏸 จำลองสถานการณ์จริง: 10 รอบ | เล่น 2 ชั่วโมง | เกมละ 15 แต้ม");
console.log(DLINE);

for (let r = 1; r <= NUM_ROUNDS; r++) {
  const { matches, players, pairHistory, timeUsed } = simulateSession(r);
  gamesPerSession.push(matches.length);

  // บันทึกสำหรับ summary
  players.forEach((p) => allPlayedByName[p.name].push(p.played));
  Object.entries(pairHistory).forEach(([k, v]) => {
    allPairCounts[k] = (allPairCounts[k] || 0) + v;
  });

  const playedVals = players.map((p) => p.played);
  const minP = Math.min(...playedVals), maxP = Math.max(...playedVals);
  const hrs = Math.floor(timeUsed / 60), mins = timeUsed % 60;

  console.log(`\n${LINE}`);
  console.log(`  รอบที่ ${r}  |  ${matches.length} เกม  |  เวลาที่ใช้ ${hrs}ชม.${mins}นาที  |  ต่าง ${maxP - minP} เกม`);
  console.log(LINE);

  // ตาราง match
  console.log("  เกม  เวลา  ทีม 1              vs  ทีม 2              ชนะ                ประเภท");
  matches.forEach((m) => {
    const h = Math.floor(m.timeUsed / 60), mn = String(m.timeUsed % 60).padStart(2, "0");
    const t1 = m.t1.padEnd(18), t2 = m.t2.padEnd(18), w = m.winner.padEnd(18);
    const typeLabel = m.type === "random" ? "🎲สุ่ม" : `👑defend${m.type.slice(6)}`;
    console.log(`  ${String(m.num).padStart(2)}   ${h}:${mn}  ${t1} vs  ${t2} → ${w} ${typeLabel}`);
  });

  // สถิติผู้เล่น
  const sorted = [...players].sort((a, b) => b.played - a.played);
  console.log("\n  ผู้เล่น    เล่น  รอ   กราฟ");
  sorted.forEach((p) => {
    const bar = "█".repeat(p.played) + "░".repeat(Math.max(0, maxP - p.played));
    console.log(`  ${p.name.padEnd(8)}  ${String(p.played).padStart(2)}    ${String(p.waited).padStart(2)}   ${bar}`);
  });

  // คู่ที่เล่นซ้ำมาก
  const topPairs = Object.entries(pairHistory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxPair = topPairs[0]?.[1] || 0;
  console.log(`\n  คู่ที่เล่นด้วยกันบ่อย (สูงสุด ${maxPair} ครั้ง):`);
  topPairs.forEach(([pair, cnt]) => {
    console.log(`    ${pair.padEnd(22)} ${"■".repeat(cnt)} (${cnt})`);
  });
}

// ========== สรุปรวม 10 รอบ ==========
console.log(`\n${DLINE}`);
console.log("  📊 สรุปรวม 10 รอบ");
console.log(DLINE);

const avgGames = (gamesPerSession.reduce((a, b) => a + b, 0) / NUM_ROUNDS).toFixed(1);
const minGames = Math.min(...gamesPerSession);
const maxGames = Math.max(...gamesPerSession);
console.log(`\n  จำนวนเกมต่อรอบ: เฉลี่ย ${avgGames}  |  น้อยสุด ${minGames}  |  มากสุด ${maxGames}`);
console.log(`  การกระจาย: ${gamesPerSession.join(", ")}`);

console.log("\n  จำนวนเกมสะสมทุกรอบ (mean ± min–max):");
fixedPlayerList.forEach((fp) => {
  const vals = allPlayedByName[fp.name];
  const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  const mn  = Math.min(...vals), mx = Math.max(...vals);
  const bar = "█".repeat(Math.round(parseFloat(avg)));
  console.log(`  ${fp.name.padEnd(8)}  avg=${avg}  [${mn}–${mx}]  ${bar}`);
});

console.log("\n  คู่ที่เล่นด้วยกันสะสมมากสุด (10 รอบรวม):");
const topAll = Object.entries(allPairCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
topAll.forEach(([pair, cnt]) => {
  const bar = "■".repeat(Math.round(cnt / 2));
  console.log(`  ${pair.padEnd(22)} ${cnt} ครั้ง  ${bar}`);
});

const allCounts = Object.values(allPairCounts);
const pairAvg = (allCounts.reduce((a, b) => a + b, 0) / allCounts.length).toFixed(1);
const pairMax = Math.max(...allCounts), pairMin = Math.min(...allCounts);
console.log(`\n  ความถี่คู่: เฉลี่ย ${pairAvg}  |  สูงสุด ${pairMax}  |  ต่ำสุด ${pairMin}`);

console.log(`\n${DLINE}`);
console.log("  ✅ จบการทดสอบ");
console.log(DLINE);

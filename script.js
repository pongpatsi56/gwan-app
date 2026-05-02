// ========== ตัวแปร ==========
let players = JSON.parse(localStorage.getItem("players")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let currentMatch = JSON.parse(localStorage.getItem("currentMatch")) || null;
let currentChampion =
  JSON.parse(localStorage.getItem("currentChampion")) || null;
let championWinCount = parseInt(localStorage.getItem("championWinCount")) || 0;
let lastLosers = JSON.parse(localStorage.getItem("lastLosers")) || [];
let pairHistory = JSON.parse(localStorage.getItem("pairHistory")) || {};

players.forEach((p) => {
  if (p.waitCount === undefined) p.waitCount = 0;
  if (p.waited === undefined) p.waited = 0;
});

let allFixedPlayersSelected = true; // ✅ เริ่มต้นคือ "เลือกทั้งหมด"
const fixedPlayerList = [
  { name: "ฟลุค", gender: "male" },
  { name: "ไผ่", gender: "male" },
  { name: "นิกกี้", gender: "male" },
  { name: "อาย", gender: "female" },
  { name: "ที", gender: "male" },
  { name: "ใหม่", gender: "male" },
  { name: "ต้นหอม", gender: "male" },
  { name: "เวย์", gender: "male" },
  { name: "อายอาย", gender: "female" },
  { name: "แชมป์", gender: "male" },
];

// ========== เริ่มต้น ==========
renderPlayerList();
renderGame();
renderSummary();
renderHistory();
renderFixedPlayersList();
updateInputStateAfterGameStarted();

// ========== เพิ่มผู้เล่น ==========
function addPlayer() {
  const name = document.getElementById("playerName").value.trim();
  let gender = document.querySelector(
    'input[name="playerGender"]:checked'
  ).value;

  if (!name) return;

  players.push({ name, gender, played: 0, waitCount: 0 });
  saveState();
  document.getElementById("playerName").value = "";
  renderPlayerList();
  renderSummary();
  toggleStartButton();
}

// ========== แสดงรายชื่อผู้เล่น ==========
function renderPlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";

  players.forEach((player, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${index + 1}. ${player.name} (${player.gender === "male" ? "ช" : "ญ"})
      <button onclick="removePlayer(${index})" style="margin-left: 10px;" class="delete-btn">❌</button>
    `;
    list.appendChild(li);
  });
}

// ========== จัดเกมใหม่ ==========
function renderGame() {
  if (currentMatch) {
    showMatch();
    return;
  }

  if (players.length < 4) {
    document.getElementById("currentMatch").innerHTML =
      "❗ ต้องมีผู้เล่นอย่างน้อย 4 คน";
    document.getElementById("winnerButtons").innerHTML = "";
    return;
  }

  const selectedPlayers = selectBalancedPlayers();
  if (selectedPlayers.length < 4) {
    document.getElementById("currentMatch").innerHTML =
      "❗ ไม่มีผู้เล่นเพียงพอ (บางคนพักอยู่)";
    document.getElementById("winnerButtons").innerHTML = "";
    return;
  }

  currentMatch = buildTeams(selectedPlayers);
  saveState();
  showMatch();
}

// ========== เลือกผู้เล่นสมดุล ==========
// คนที่ waitCount = 0 และ played น้อยที่สุดก่อน
function selectBalancedPlayers() {
  if (players.length < 4) return [];

  const availablePlayers = players.filter(
    (p) => p.waitCount === 0 && !lastLosers.includes(p.name)
  );
  if (availablePlayers.length < 4) return [];

  const minPlayed = Math.min(...availablePlayers.map((p) => p.played));
  const leastPlayed = availablePlayers.filter((p) => p.played === minPlayed);

  if (leastPlayed.length >= 4) {
    shuffleArray(leastPlayed);
    return leastPlayed.slice(0, 4);
  }

  const remaining = availablePlayers
    .filter((p) => p.played !== minPlayed)
    .sort((a, b) => a.played - b.played || b.waited - a.waited);

  return leastPlayed.concat(remaining.slice(0, 4 - leastPlayed.length));
}

// ========== แสดงคู่ที่กำลังแข่ง ==========
function showMatch() {
  const table = document.getElementById("currentMatch");
  table.innerHTML = `
    <tr>
      <th class="col-number">ทีม</th>
      <th>ผู้เล่น</th>
      <th>เลือกผู้ชนะ</th>
    </tr>
  `;

  currentMatch.forEach((pair, index) => {
    const teamNames = pair.team.map((p) => p.name).join(" + ");
    const row = `
      <tr>
        <td>ทีม ${index + 1}</td>
        <td style="max-width: 300px; overflow-x: auto;">
          <div style="overflow-x: auto;">${teamNames}</div>
        </td>
        <td>
          <button onclick="chooseWinner(${index})">✅ ทีม ${
      index + 1
    } ชนะ</button>
        </td>
      </tr>
    `;
    table.innerHTML += row;
  });
}
// ========== เลือกผู้ชนะ ==========
function chooseWinner(winnerIndex) {
  const winnerTeam = currentMatch[winnerIndex].team;
  const loserTeam = currentMatch[1 - winnerIndex].team;

  const winnerNames = winnerTeam.map((p) => p.name).join(" + ");
  const loserNames = loserTeam.map((p) => p.name).join(" + ");

  const confirmWin = confirm(
    `ยืนยันว่า "${winnerNames}" ชนะเหนือ "${loserNames}" ใช่หรือไม่?`
  );
  if (!confirmWin) return;

  // เพิ่มจำนวนเกมที่เล่นให้ทุกคนในแมตช์
  [...winnerTeam, ...loserTeam].forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) {
      found.played++;
      found.waited = 0; // 🔄 ได้เล่นแล้ว รีเซ็ต waited
    }
  });

  // ผู้แพ้ต้องพัก 2 เกม
  loserTeam.forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) found.waitCount = 2;
  });

  // ลด waitCount ให้ทุกคนที่ยังรอ
  players.forEach((p) => {
    if (p.waitCount > 0) p.waitCount--;
  });

  // ✅ เพิ่มตรงนี้: เพิ่ม waited ให้กับคนที่ไม่ได้ลงเล่นและไม่ได้ติด waitCount
  players.forEach((p) => {
    const isInGame =
      winnerTeam.some((w) => w.name === p.name) ||
      loserTeam.some((l) => l.name === p.name);

    if (!isInGame) {
      if (p.waitCount === 0) {
        p.waited = (p.waited || 0) + 1;
      }
    }
  });

  // เก็บชื่อผู้แพ้ล่าสุด
  lastLosers = loserTeam.map((p) => p.name);
  localStorage.setItem("lastLosers", JSON.stringify(lastLosers));

  // บันทึกประวัติการแข่งขัน
  history.push({
    winner: winnerTeam.map((p) => p.name),
    loser: loserTeam.map((p) => p.name),
  });

  // อัพเดตประวัติคู่
  [winnerTeam, loserTeam].forEach((team) => {
    if (team.length >= 2) {
      const key = getPairKey(team[0], team[1]);
      pairHistory[key] = (pairHistory[key] || 0) + 1;
    }
  });

  // จัดการแชมป์
  const winnerKey = winnerTeam.map((p) => p.name).join("+");
  if (currentChampion === winnerKey) {
    championWinCount++;
  } else {
    currentChampion = winnerKey;
    championWinCount = 1;
  }

  // ถ้าแชมป์ชนะครบ 2 เกม → ออกทั้งสองฝั่ง
  if (championWinCount >= 2) {
    winnerTeam.forEach((player) => {
      const found = players.find((p) => p.name === player.name);
      if (found) found.waitCount = 1;
    });
    currentChampion = null;
    championWinCount = 0;
    renderRandomMatch();
  } else {
    // แมตช์ต่อไป: แชมป์ vs คนที่ยังไม่เล่น
    const remainingPlayers = players
      .filter(
        (p) => !winnerTeam.some((w) => w.name === p.name) && p.waitCount === 0
      )
      .sort((a, b) => a.played - b.played || b.waited - a.waited);

    if (remainingPlayers.length < 2) {
      currentChampion = null;
      championWinCount = 0;
      renderRandomMatch();
    } else {
      const minPlayed = Math.min(...remainingPlayers.map((p) => p.played));
      const leastPlayed = remainingPlayers.filter((p) => p.played === minPlayed);

      let nextOpponents =
        leastPlayed.length >= 2
          ? leastPlayed
          : leastPlayed.length === 1
          ? removeDuplicateByKey([...leastPlayed, ...remainingPlayers], "name")
          : remainingPlayers;

      const maxWaited = Math.max(...nextOpponents.map((p) => p.waited));
      const mostWaited = nextOpponents.filter((p) => p.waited === maxWaited);

      if (mostWaited.length > 2) {
        shuffleArray(nextOpponents);
      }

      const newOpponent = selectBestPair(nextOpponents);

      currentMatch = [{ team: winnerTeam }, { team: newOpponent }];
      showMatch();
    }
  }

  saveState();
  updateInputStateAfterGameStarted();
  renderSummary();
  renderHistory();
}

function confirmFixedPlayers() {
  const confirmed = confirm("ยืนยันผู้เล่นที่มาตามที่เลือกใช่หรือไม่?");
  if (!confirmed) return;

  players = []; // ล้างก่อนเพิ่มใหม่

  fixedPlayerList.forEach((player, index) => {
    const checkbox = document.getElementById(`fixedPlayer-${index}`);
    if (checkbox.checked) {
      players.push({
        name: player.name,
        gender: player.gender,
        played: 0,
        waitCount: 0,
        waited: 0,
      });
    }
  });

  saveState();
  renderPlayerList();
  renderSummary();
  renderGame();
  toggleStartButton();
}

function toggleSelectAllFixedPlayers() {
  fixedPlayerList.forEach((_, index) => {
    const checkbox = document.getElementById(`fixedPlayer-${index}`);
    if (checkbox) checkbox.checked = allFixedPlayersSelected;
  });

  const btn = document.getElementById("btnToggleSelectAll");

  if (allFixedPlayersSelected) {
    btn.textContent = "🚫 ยกเลิกทั้งหมด";
    btn.style.backgroundColor = "#f8d6d6"; // แดงอ่อน
    btn.style.color = "#a10000";
  } else {
    btn.textContent = "☑️ เลือกทั้งหมด";
    btn.style.backgroundColor = "#d4f7d4"; // เขียวอ่อน
    btn.style.color = "#065f0a";
  }

  allFixedPlayersSelected = !allFixedPlayersSelected;
}

function updateInputStateAfterGameStarted() {
  const hasStarted = currentMatch !== null || history.length > 0;

  // ปุ่ม / ช่องกรอก
  const addBtn = document.querySelector('button[onclick="addPlayer()"]');
  const confirmBtn = document.querySelector(
    'button[onclick="confirmFixedPlayers()"]'
  );
  const playerInput = document.getElementById("playerName");
  const startBtn = document.getElementById("btnStartGame");
  const shuffleBtn = document.querySelector(
    'button[onclick="shufflePlayers()"]'
  );
  const toggleSelectAllBtn = document.getElementById("btnToggleSelectAll");

  if (addBtn) addBtn.disabled = hasStarted;
  if (confirmBtn) confirmBtn.disabled = hasStarted;
  if (playerInput) playerInput.disabled = hasStarted;
  if (startBtn) startBtn.disabled = hasStarted;
  if (shuffleBtn) shuffleBtn.disabled = hasStarted;
  if (toggleSelectAllBtn) toggleSelectAllBtn.disabled = hasStarted;

  // ปรับสีจาง
  [
    addBtn,
    confirmBtn,
    playerInput,
    startBtn,
    shuffleBtn,
    toggleSelectAllBtn,
  ].forEach((el) => {
    if (el) el.style.opacity = hasStarted ? "0.5" : "1";
  });

  // Disable checkbox ผู้เล่นประจำ
  fixedPlayerList.forEach((_, index) => {
    const checkbox = document.getElementById(`fixedPlayer-${index}`);
    if (checkbox) checkbox.disabled = hasStarted;
  });

  // ปุ่มลบผู้เล่น
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.disabled = hasStarted;
    btn.style.opacity = hasStarted ? "0.5" : "1";
  });
}

// ========== สรุป ==========
function renderSummary() {
  const table = document.getElementById("gameSummary");
  table.innerHTML = `
    <tr>
      <th>ชื่อ</th>
      <th class="col-number">เล่นแล้ว</th>
      <th class="col-number">นั่งรอแล้ว</th>
      <th class="col-number">พึ่งออก</th>
    </tr>
  `;

  const sorted = [...players].sort((a, b) => b.played - a.played);
  sorted.forEach((p) => {
    table.innerHTML += `
      <tr>
        <td title="${p.name}">${p.name}</td>
        <td class="col-number">${p.played}</td>
        <td class="col-number">${p.waited || 0}</td>
        <td class="col-number">${p.waitCount > 0 ? "✅" : ""}</td>
      </tr>
    `;
  });
}
// ========== ประวัติ ==========
function renderHistory() {
  const table = document.getElementById("matchHistory");
  table.innerHTML = `
    <tr>
      <th class="col-number">เกมที่</th>
      <th>ทีมชนะ 🏆</th>
      <th>ทีมแพ้ ❌</th>
    </tr>
  `;

  if (history.length === 0) {
    table.innerHTML += `
      <tr><td colspan="3">ยังไม่มีประวัติการแข่งขัน</td></tr>
    `;
    return;
  }

  history.forEach((match, index) => {
    table.innerHTML += `
      <tr>
        <td class="col-number">${index + 1}</td>
        <td title="${match.winner.join(" + ")}">${match.winner.join(" + ")}</td>
        <td title="${match.loser.join(" + ")}">${match.loser.join(" + ")}</td>
      </tr>
    `;
  });
}

function renderFixedPlayersList() {
  const container = document.getElementById("fixedPlayersList");
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "fixed-players-table";

  fixedPlayerList.forEach((player, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "fixed-player-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `fixedPlayer-${index}`;
    checkbox.dataset.name = player.name;
    checkbox.dataset.gender = player.gender;
    checkbox.checked = true;

    const span = document.createElement("span");
    span.innerText = player.name;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(span);
    grid.appendChild(wrapper);
  });

  container.appendChild(grid);
}
// ========== ล้างข้อมูล ==========
function resetAll() {
  if (!confirm("ล้างข้อมูลทั้งหมดจริงหรือไม่?")) return;
  players = [];
  history = [];
  currentMatch = null;
  currentChampion = null;
  championWinCount = 0;
  lastLosers = [];
  pairHistory = {};

  localStorage.clear();

  renderPlayerList();
  renderGame();
  renderSummary();
  renderHistory();
  updateInputStateAfterGameStarted(); // 👈 เพิ่มตรงนี้
}

// ========== บันทึก ==========
function saveState() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("history", JSON.stringify(history));
  localStorage.setItem("currentMatch", JSON.stringify(currentMatch));
  localStorage.setItem("currentChampion", JSON.stringify(currentChampion));
  localStorage.setItem("championWinCount", championWinCount.toString());
  localStorage.setItem("lastLosers", JSON.stringify(lastLosers));
  localStorage.setItem("pairHistory", JSON.stringify(pairHistory));
}

// ========== ลบผู้เล่น ==========
function removePlayer(index) {
  const player = players[index];
  const confirmDelete = confirm(
    `คุณแน่ใจหรือไม่ว่าต้องการลบ "${player.name}"?`
  );
  if (!confirmDelete) return;

  players.splice(index, 1);
  saveState();
  renderPlayerList();
  renderSummary();
  renderGame();
}

// ========== สุ่มตำแหน่ง ==========
function shufflePlayers() {
  if (players.length < 2) {
    alert("ต้องมีผู้เล่นอย่างน้อย 2 คนเพื่อสับตำแหน่ง");
    return;
  }

  const confirmShuffle = confirm("คุณต้องการสุ่มลำดับผู้เล่นใหม่ใช่หรือไม่?");
  if (!confirmShuffle) return;

  shuffleArray(players);
  saveState();
  renderPlayerList();
}

// ========== สุ่ม Array ==========
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function removeDuplicateByKey(arr, key) {
  const seen = new Set();
  return arr.filter((item) => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

// ========== สร้างคู่ใหม่แบบสุ่ม ==========
function renderRandomMatch() {
  const selected = selectBalancedPlayers();
  if (selected.length < 4) {
    currentMatch = null;
    document.getElementById("currentMatch").innerHTML =
      "❗ ไม่มีผู้เล่นเพียงพอสำหรับแมตช์ใหม่";
    document.getElementById("winnerButtons").innerHTML = "";
    return;
  }

  currentMatch = buildTeams(selected);
  saveState();
  showMatch();
}

// ========== key คู่ผู้เล่น ==========
function getPairKey(p1, p2) {
  return [p1.name, p2.name].sort().join("|");
}

// ========== จัดทีมตามเพศ + หลีกเลี่ยงคู่ซ้ำ ==========
function buildTeams(selected) {
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

// ========== เลือกคู่ที่ดีที่สุด (played น้อย → waited มาก → คู่ซ้ำน้อย) ==========
function selectBestPair(candidates) {
  if (candidates.length <= 2) return candidates.slice(0, 2);
  let bestPair = [candidates[0], candidates[1]];
  let bestPlayed = bestPair[0].played + bestPair[1].played;
  let bestWaited = bestPair[0].waited + bestPair[1].waited;
  let bestPairScore = pairHistory[getPairKey(bestPair[0], bestPair[1])] || 0;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const totalPlayed = candidates[i].played + candidates[j].played;
      const totalWaited = candidates[i].waited + candidates[j].waited;
      const pairScore = pairHistory[getPairKey(candidates[i], candidates[j])] || 0;
      if (
        totalPlayed < bestPlayed ||
        (totalPlayed === bestPlayed && totalWaited > bestWaited) ||
        (totalPlayed === bestPlayed && totalWaited === bestWaited && pairScore < bestPairScore)
      ) {
        bestPair = [candidates[i], candidates[j]];
        bestPlayed = totalPlayed;
        bestWaited = totalWaited;
        bestPairScore = pairScore;
      }
    }
  }
  return bestPair;
}

// ========== ปุ่มเริ่ม ==========
function toggleStartButton() {
  const btn = document.getElementById("btnStartGame");
  if (!btn) return;
  btn.style.display = players.length >= 4 ? "inline-block" : "none";
}

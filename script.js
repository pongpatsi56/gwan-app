// ========== ตัวแปร ==========
let players = [];
let history = [];
let currentMatch = null;
let currentChampion = null;
let championWinCount = 0;
let lastLosers = [];
let pairHistory = {};
let creatorUid = null;

let allFixedPlayersSelected = true;
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

// ========== Firebase ==========
const db = firebase.firestore();
const auth = firebase.auth();
const SESSION_DOC = db.collection("sessions").doc("main");

function isCreator() {
  const user = auth.currentUser;
  return user !== null && user.uid === creatorUid;
}

// canEdit: true ถ้าเป็น creator หรือยังไม่มี creator (first-come)
function canEdit() {
  const user = auth.currentUser;
  return user !== null && (creatorUid === null || user.uid === creatorUid);
}

async function loginWithGoogle() {
  try {
    await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (e) {
    alert("Login ไม่สำเร็จ: " + e.message);
  }
}

async function logout() {
  await auth.signOut();
}

function updateAuthUI(user) {
  const status = document.getElementById("authStatus");
  const loginBtn = document.getElementById("btnLogin");
  const logoutBtn = document.getElementById("btnLogout");
  if (!status) return;

  if (user && user.uid === creatorUid) {
    status.textContent = `🔑 Creator: ${user.displayName}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else if (user && creatorUid === null) {
    status.textContent = `✅ ${user.displayName} — กดยืนยันผู้เล่นเพื่อเป็น Creator`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else if (user) {
    status.textContent = `👁 ${user.displayName} — ดูอย่างเดียว`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else {
    status.textContent = "👁 ดูอย่างเดียว — เข้าสู่ระบบเพื่อเป็น Creator";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }

  updateInputStateAfterGameStarted();
}

function applyState(data) {
  creatorUid = data.creatorUid || null;
  players = data.players || [];
  history = data.history || [];
  currentMatch = data.currentMatch || null;
  currentChampion = data.currentChampion || null;
  championWinCount = data.championWinCount || 0;
  lastLosers = data.lastLosers || [];
  pairHistory = data.pairHistory || {};

  players.forEach((p) => {
    if (p.waitCount === undefined) p.waitCount = 0;
    if (p.waited === undefined) p.waited = 0;
  });

  renderPlayerList();
  renderGame();
  renderSummary();
  renderHistory();
  renderFixedPlayersList();
  updateInputStateAfterGameStarted();
}

// Subscribe: real-time listener
SESSION_DOC.onSnapshot((doc) => {
  if (doc.exists) {
    applyState(doc.data());
  } else {
    renderPlayerList();
    renderGame();
    renderSummary();
    renderHistory();
    renderFixedPlayersList();
    updateInputStateAfterGameStarted();
  }
});

// Auth state listener
auth.onAuthStateChanged((user) => {
  updateAuthUI(user);
});

// ========== บันทึก ==========
function saveState() {
  const uid = auth.currentUser?.uid || null;
  const effectiveCreatorUid = creatorUid || uid;

  SESSION_DOC.set({
    creatorUid: effectiveCreatorUid,
    players,
    history,
    currentMatch,
    currentChampion,
    championWinCount,
    lastLosers,
    pairHistory,
  }).catch((err) => console.error("บันทึกไม่สำเร็จ:", err));
}

// ========== เพิ่มผู้เล่น ==========
function addPlayer() {
  if (!canEdit()) return;
  const name = document.getElementById("playerName").value.trim();
  let gender = document.querySelector(
    'input[name="playerGender"]:checked'
  ).value;

  if (!name) return;

  players.push({ name, gender, played: 0, waitCount: 0, waited: 0 });
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
  if (!canEdit() && !currentMatch) return;

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
    const winBtnDisabled = !isCreator() ? "disabled style='opacity:0.4'" : "";
    const row = `
      <tr>
        <td>ทีม ${index + 1}</td>
        <td style="max-width: 300px; overflow-x: auto;">
          <div style="overflow-x: auto;">${teamNames}</div>
        </td>
        <td>
          <button onclick="chooseWinner(${index})" ${winBtnDisabled}>✅ ทีม ${index + 1} ชนะ</button>
        </td>
      </tr>
    `;
    table.innerHTML += row;
  });
}

// ========== เลือกผู้ชนะ ==========
function chooseWinner(winnerIndex) {
  if (!isCreator()) return;

  const winnerTeam = currentMatch[winnerIndex].team;
  const loserTeam = currentMatch[1 - winnerIndex].team;

  const winnerNames = winnerTeam.map((p) => p.name).join(" + ");
  const loserNames = loserTeam.map((p) => p.name).join(" + ");

  const confirmWin = confirm(
    `ยืนยันว่า "${winnerNames}" ชนะเหนือ "${loserNames}" ใช่หรือไม่?`
  );
  if (!confirmWin) return;

  [...winnerTeam, ...loserTeam].forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) {
      found.played++;
      found.waited = 0;
    }
  });

  loserTeam.forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) found.waitCount = 2;
  });

  players.forEach((p) => {
    if (p.waitCount > 0) p.waitCount--;
  });

  players.forEach((p) => {
    const isInGame =
      winnerTeam.some((w) => w.name === p.name) ||
      loserTeam.some((l) => l.name === p.name);
    if (!isInGame && p.waitCount === 0) {
      p.waited = (p.waited || 0) + 1;
    }
  });

  lastLosers = loserTeam.map((p) => p.name);

  history.push({
    winner: winnerTeam.map((p) => p.name),
    loser: loserTeam.map((p) => p.name),
  });

  [winnerTeam, loserTeam].forEach((team) => {
    if (team.length >= 2) {
      const key = getPairKey(team[0], team[1]);
      pairHistory[key] = (pairHistory[key] || 0) + 1;
    }
  });

  const winnerKey = winnerTeam.map((p) => p.name).join("+");
  if (currentChampion === winnerKey) {
    championWinCount++;
  } else {
    currentChampion = winnerKey;
    championWinCount = 1;
  }

  if (championWinCount >= 2) {
    winnerTeam.forEach((player) => {
      const found = players.find((p) => p.name === player.name);
      if (found) found.waitCount = 1;
    });
    currentChampion = null;
    championWinCount = 0;
    renderRandomMatch();
  } else {
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
  if (!canEdit()) return;
  const confirmed = confirm("ยืนยันผู้เล่นที่มาตามที่เลือกใช่หรือไม่?");
  if (!confirmed) return;

  players = [];

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
    btn.style.backgroundColor = "#f8d6d6";
    btn.style.color = "#a10000";
  } else {
    btn.textContent = "☑️ เลือกทั้งหมด";
    btn.style.backgroundColor = "#d4f7d4";
    btn.style.color = "#065f0a";
  }

  allFixedPlayersSelected = !allFixedPlayersSelected;
}

function updateInputStateAfterGameStarted() {
  const hasStarted = currentMatch !== null || history.length > 0;
  const creator = isCreator();
  const editable = canEdit();

  // ปุ่ม / ช่องกรอก
  const addBtn = document.querySelector('button[onclick="addPlayer()"]');
  const confirmBtn = document.querySelector('button[onclick="confirmFixedPlayers()"]');
  const playerInput = document.getElementById("playerName");
  const startBtn = document.getElementById("btnStartGame");
  const shuffleBtn = document.querySelector('button[onclick="shufflePlayers()"]');
  const toggleSelectAllBtn = document.getElementById("btnToggleSelectAll");
  const resetBtn = document.querySelector('button[onclick="resetAll()"]');

  const setupDisabled = !editable || hasStarted;

  if (addBtn) addBtn.disabled = setupDisabled;
  if (confirmBtn) confirmBtn.disabled = setupDisabled;
  if (playerInput) playerInput.disabled = setupDisabled;
  if (startBtn) startBtn.disabled = !creator || hasStarted;
  if (shuffleBtn) shuffleBtn.disabled = setupDisabled;
  if (toggleSelectAllBtn) toggleSelectAllBtn.disabled = setupDisabled;
  if (resetBtn) resetBtn.disabled = !creator;

  [addBtn, confirmBtn, playerInput, startBtn, shuffleBtn, toggleSelectAllBtn].forEach((el) => {
    if (el) el.style.opacity = setupDisabled ? "0.5" : "1";
  });
  if (resetBtn) resetBtn.style.opacity = !creator ? "0.5" : "1";

  fixedPlayerList.forEach((_, index) => {
    const checkbox = document.getElementById(`fixedPlayer-${index}`);
    if (checkbox) checkbox.disabled = setupDisabled;
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.disabled = setupDisabled;
    btn.style.opacity = setupDisabled ? "0.5" : "1";
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
    table.innerHTML += `<tr><td colspan="3">ยังไม่มีประวัติการแข่งขัน</td></tr>`;
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
  if (!isCreator()) return;
  if (!confirm("ล้างข้อมูลทั้งหมดจริงหรือไม่?")) return;

  players = [];
  history = [];
  currentMatch = null;
  currentChampion = null;
  championWinCount = 0;
  lastLosers = [];
  pairHistory = {};

  saveState();
  renderPlayerList();
  renderGame();
  renderSummary();
  renderHistory();
  updateInputStateAfterGameStarted();
}

// ========== ลบผู้เล่น ==========
function removePlayer(index) {
  if (!canEdit()) return;
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
  if (!canEdit()) return;
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

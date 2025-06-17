// ========== ตัวแปร ==========
let players = JSON.parse(localStorage.getItem("players")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let currentMatch = JSON.parse(localStorage.getItem("currentMatch")) || null;
let currentChampion =
  JSON.parse(localStorage.getItem("currentChampion")) || null;
let championWinCount = parseInt(localStorage.getItem("championWinCount")) || 0;

// ให้แน่ใจว่าแต่ละคนมี waitCount
players.forEach((p) => {
  if (p.waitCount === undefined) p.waitCount = 0;
});

// ========== เริ่มต้น ==========
renderPlayerList();
renderGame();
renderSummary();
renderHistory();

// ========== เพิ่มผู้เล่น ==========
function addPlayer() {
  const name = document.getElementById("playerName").value.trim();
  const gender = document.getElementById("playerGender").value;
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

  const males = selectedPlayers.filter((p) => p.gender === "male");
  const females = selectedPlayers.filter((p) => p.gender === "female");

  if (females.length >= 2) {
    currentMatch = [
      { team: [males[0], females[0]] },
      { team: [males[1], females[1]] },
    ];
  } else if (females.length === 1 && males.length >= 3) {
    currentMatch = [
      { team: [males[0], females[0]] },
      { team: [males[1], males[2]] },
    ];
  } else {
    currentMatch = [
      { team: [selectedPlayers[0], selectedPlayers[1]] },
      { team: [selectedPlayers[2], selectedPlayers[3]] },
    ];
  }

  saveState();
  showMatch();
}

// ========== เลือกผู้เล่นสมดุล ==========
// คนที่ waitCount = 0 และ played น้อยที่สุดก่อน
function selectBalancedPlayers() {
  if (players.length < 4) return [];

  const availablePlayers = players.filter((p) => p.waitCount === 0);
  if (availablePlayers.length < 4) return [];

  const minPlayed = Math.min(...availablePlayers.map((p) => p.played));
  const leastPlayed = availablePlayers.filter((p) => p.played === minPlayed);

  if (leastPlayed.length >= 4) {
    shuffleArray(leastPlayed);
    return leastPlayed.slice(0, 4);
  }

  const remaining = availablePlayers
    .filter((p) => p.played !== minPlayed)
    .sort((a, b) => a.played - b.played);

  return leastPlayed.concat(remaining.slice(0, 4 - leastPlayed.length));
}

// ========== แสดงคู่ที่กำลังแข่ง ==========
function showMatch() {
  const div = document.getElementById("currentMatch");
  div.innerHTML = "";

  currentMatch.forEach((pair, index) => {
    const teamNames = pair.team.map((p) => p.name).join(" + ");
    div.innerHTML += `<div><strong>ทีม ${
      index + 1
    }:</strong> ${teamNames}</div>`;
  });

  const winnerButtons = document.getElementById("winnerButtons");
  winnerButtons.innerHTML = "";
  currentMatch.forEach((pair, index) => {
    const btn = document.createElement("button");
    btn.textContent = `ทีม ${index + 1} ชนะ`;
    btn.onclick = () => chooseWinner(index);
    winnerButtons.appendChild(btn);
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

  // เพิ่มจำนวนเกม
  [...winnerTeam, ...loserTeam].forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) found.played++;
  });

  // ผู้แพ้พัก 1 เกม
  loserTeam.forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) found.waitCount = 1;
  });

  // ลด waitCount คนอื่น
  players.forEach((p) => {
    if (p.waitCount > 0) p.waitCount--;
  });

  // เพิ่มประวัติ
  history.push({
    winner: winnerTeam.map((p) => p.name),
    loser: loserTeam.map((p) => p.name),
  });

  const winnerKey = winnerTeam.map((p) => p.name).join("+");
  if (currentChampion === winnerKey) {
    championWinCount++;
  } else {
    currentChampion = winnerKey;
    championWinCount = 1;
  }

  if (championWinCount >= 2) {
    currentChampion = null;
    championWinCount = 0;
    renderRandomMatch();
  } else {
    const remainingPlayers = players.filter(
      (p) => !winnerTeam.some((w) => w.name === p.name) && p.waitCount === 0
    );

    const minPlayed = Math.min(...remainingPlayers.map((p) => p.played));
    const leastPlayed = remainingPlayers.filter((p) => p.played === minPlayed);
    let nextOpponents =
      leastPlayed.length >= 2 ? leastPlayed : remainingPlayers;

    shuffleArray(nextOpponents);
    const newOpponent = nextOpponents.slice(0, 2);

    currentMatch = [{ team: winnerTeam }, { team: newOpponent }];
    showMatch();
  }

  saveState();
  renderSummary();
  renderHistory();
}

// ========== สรุป ==========
function renderSummary() {
  const div = document.getElementById("gameSummary");
  div.innerHTML = "";

  const sorted = [...players].sort((a, b) => b.played - a.played);
  sorted.forEach((p) => {
    div.innerHTML += `<div>${p.name}: ${p.played} เกม</div>`;
  });

  // ✅ เพิ่มบรรทัดนี้เพื่อแสดงค่า min played
  if (players.length > 0) {
    const minPlayed = Math.min(...players.map((p) => p.played));
    div.innerHTML += `<hr><div><strong>🧮 เล่นน้อยสุด:</strong> ${minPlayed} เกม</div>`;
  }
}

// ========== ประวัติ ==========
function renderHistory() {
  const ul = document.getElementById("matchHistory");
  ul.innerHTML = "";

  if (history.length === 0) {
    ul.innerHTML = "<li>ยังไม่มีประวัติการแข่งขัน</li>";
    return;
  }

  history.forEach((match, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>เกมที่ ${index + 1}</strong>: 
      🏆 <span style="color:green">${match.winner.join(" + ")}</span> 
      ชนะ 
      ❌ <span style="color:red">${match.loser.join(" + ")}</span>
    `;
    ul.appendChild(li);
  });
}

// ========== ล้างข้อมูล ==========
function resetAll() {
  if (!confirm("ล้างข้อมูลทั้งหมดจริงหรือไม่?")) return;
  players = [];
  history = [];
  currentMatch = null;
  currentChampion = null;
  championWinCount = 0;

  localStorage.clear();

  renderPlayerList();
  renderGame();
  renderSummary();
  renderHistory();
}

// ========== บันทึก ==========
function saveState() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("history", JSON.stringify(history));
  localStorage.setItem("currentMatch", JSON.stringify(currentMatch));
  localStorage.setItem("currentChampion", JSON.stringify(currentChampion));
  localStorage.setItem("championWinCount", championWinCount.toString());
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

// ========== สร้างคู่ใหม่แบบสุ่ม ==========
function renderRandomMatch() {
  const selected = selectBalancedPlayers();
  const males = selected.filter((p) => p.gender === "male");
  const females = selected.filter((p) => p.gender === "female");

  if (females.length >= 2) {
    currentMatch = [
      { team: [males[0], females[0]] },
      { team: [males[1], females[1]] },
    ];
  } else if (females.length === 1 && males.length >= 3) {
    currentMatch = [
      { team: [males[0], females[0]] },
      { team: [males[1], males[2]] },
    ];
  } else {
    currentMatch = [
      { team: [selected[0], selected[1]] },
      { team: [selected[2], selected[3]] },
    ];
  }

  showMatch();
}

// ========== ปุ่มเริ่ม ==========
function toggleStartButton() {
  const btn = document.getElementById("btnStartGame");
  if (!btn) return;
  btn.style.display = players.length >= 4 ? "inline-block" : "none";
}

// ========== ตัวแปร ==========
let players = JSON.parse(localStorage.getItem("players")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let currentMatch = JSON.parse(localStorage.getItem("currentMatch")) || null;
let currentChampion = JSON.parse(localStorage.getItem("currentChampion")) || null;
let championWinCount = parseInt(localStorage.getItem("championWinCount")) || 0;

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

  players.push({ name, gender, played: 0 });
  saveState();
  document.getElementById("playerName").value = "";
  renderPlayerList();
  renderSummary();
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
  if (players.length < 4) {
    document.getElementById("currentMatch").innerHTML =
      "❗ ต้องมีผู้เล่นอย่างน้อย 4 คน";
    document.getElementById("winnerButtons").innerHTML = "";
    return;
  }

  // เลือก 4 คนที่เล่นน้อยสุดแบบสมดุล
  const selectedPlayers = selectBalancedPlayers();

  // แยกชายหญิง
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

  showMatch();
}

// ฟังก์ชันเลือกผู้เล่น 4 คนที่เล่นน้อยสุดสมดุล
function selectBalancedPlayers() {
  if (players.length < 4) return [];

  // เรียงตามจำนวนเกมที่เล่นจากน้อยไปมาก
  const sorted = [...players].sort((a, b) => a.played - b.played);

  let selected = [];
  let targetPlayedCount = sorted[0].played; // จำนวนเกมน้อยสุด

  // เลือกคนที่เล่นเท่ากับน้อยสุดก่อน
  selected = sorted.filter((p) => p.played === targetPlayedCount);

  // ถ้าไม่ครบ 4 คน ให้เพิ่มคนเล่นเกมถัดไป
  let index = selected.length;
  while (selected.length < 4 && index < sorted.length) {
    selected.push(sorted[index]);
    index++;
  }

  // ตัดเหลือ 4 คนถ้าจำนวนมากกว่า 4
  if (selected.length > 4) {
    selected = selected.slice(0, 4);
  }

  return selected;
}

// ========== แสดงคู่ที่กำลังเล่น ==========
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

// ========== เมื่อเลือกผู้ชนะ ==========
function chooseWinner(winnerIndex) {
  const winnerTeam = currentMatch[winnerIndex].team;
  const loserTeam = currentMatch[1 - winnerIndex].team;

  const winnerNames = winnerTeam.map((p) => p.name).join(" + ");
  const loserNames = loserTeam.map((p) => p.name).join(" + ");

  const confirmWin = confirm(
    `ยืนยันว่า "${winnerNames}" ชนะเหนือ "${loserNames}" ใช่หรือไม่?`
  );
  if (!confirmWin) return;

  // อัปเดตจำนวนเกม
  [...winnerTeam, ...loserTeam].forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) found.played++;
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
    // แชมป์ครบ 2 เกม ออกทั้งทีม
    currentChampion = null;
    championWinCount = 0;
    renderRandomMatch();
  } else {
    // แชมป์อยู่ต่อ → หาทีมใหม่มาเจอ
    const remainingPlayers = players.filter(
      (p) => !winnerTeam.some((w) => w.name === p.name)
    );
    shuffleArray(remainingPlayers);
    const newOpponent = remainingPlayers.slice(0, 2);

    currentMatch = [{ team: winnerTeam }, { team: newOpponent }];
    showMatch();
  }

  saveState();
  renderSummary();
  renderHistory();
}

// ========== แสดงสรุปการเล่น ==========
function renderSummary() {
  const div = document.getElementById("gameSummary");
  div.innerHTML = "";

  const sorted = [...players].sort((a, b) => b.played - a.played);
  sorted.forEach((p) => {
    div.innerHTML += `<div>${p.name}: ${p.played} เกม</div>`;
  });
}

// ========== แสดงประวัติการแข่งขัน ==========
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

// ========== ล้างข้อมูลทั้งหมด ==========
function resetAll() {
  if (!confirm("ล้างข้อมูลทั้งหมดจริงหรือไม่?")) return;
  players = [];
  history = [];
  currentMatch = null;
  currentChampion = null;
  championWinCount = 0;

  localStorage.removeItem("players");
  localStorage.removeItem("history");
  localStorage.removeItem("currentMatch");
  localStorage.removeItem("currentChampion");
  localStorage.removeItem("championWinCount");

  renderPlayerList();
  renderGame();
  renderSummary();
  renderHistory();
}

// ========== บันทึกลง localStorage ==========
function saveState() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("history", JSON.stringify(history));
  localStorage.setItem("currentMatch", JSON.stringify(currentMatch));
  localStorage.setItem("currentChampion", JSON.stringify(currentChampion));
  localStorage.setItem("championWinCount", championWinCount.toString());
}

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

function shufflePlayers() {
  if (players.length < 2) {
    alert("ต้องมีผู้เล่นอย่างน้อย 2 คนเพื่อสับตำแหน่ง");
    return;
  }

  const confirmShuffle = confirm("คุณต้องการสุ่มลำดับผู้เล่นใหม่ใช่หรือไม่?");
  if (!confirmShuffle) return;

  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  saveState();
  renderPlayerList();
}

// ========== ฟังก์ชันช่วยสุ่ม array ==========
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ========== จัดคู่แบบสุ่มสมดุล ==========
function renderRandomMatch() {
  const selected = selectBalancedPlayers();

  // แยกชายหญิง
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
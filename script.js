// ========== ตัวแปร ==========
let players = JSON.parse(localStorage.getItem("players")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let currentMatch = JSON.parse(localStorage.getItem("currentMatch")) || null;
let currentChampion =
  JSON.parse(localStorage.getItem("currentChampion")) || null;
let championWinCount = parseInt(localStorage.getItem("championWinCount")) || 0;

// ตรวจสอบให้แน่ใจว่า player แต่ละคนมี waitCount
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
      "❗ ไม่มีผู้เล่นเพียงพอ (บางคนยังรออยู่)";
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

// ========== เลือกผู้เล่นสมดุล และยังไม่รอ ==========
function selectBalancedPlayers() {
  const available = players.filter((p) => p.waitCount === 0);
  if (available.length < 4) return [];

  const sorted = [...available].sort((a, b) => a.played - b.played);
  const zeroPlayed = sorted.filter((p) => p.played === 0);
  let selected =
    zeroPlayed.length >= 4 ? zeroPlayed.slice(0, 4) : sorted.slice(0, 4);

  if (selected.length < 4) {
    const remaining = sorted.filter((p) => !selected.includes(p));
    selected = selected.concat(remaining.slice(0, 4 - selected.length));
  }

  return selected;
}

// ========== แสดงคู่ปัจจุบัน ==========
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

// ========== ฟังก์ชันเช็กคนที่เคยเล่นคู่กัน ==========
function havePlayedTogether(p1, p2) {
  return history.some((match) => {
    const teams = [match.winner, match.loser];
    return teams.some(
      (team) => team.includes(p1.name) && team.includes(p2.name)
    );
  });
}

// ========== เมื่อเลือกผู้ชนะ ==========
function chooseWinner(winnerIndex) {
  const winnerTeam = currentMatch[winnerIndex].team;
  const loserTeam = currentMatch[1 - winnerIndex].team;

  const winnerNames = winnerTeam.map((p) => p.name).join(" + ");
  const loserNames = loserTeam.map((p) => p.name).join(" + ");

  if (
    !confirm(`ยืนยันว่า "${winnerNames}" ชนะเหนือ "${loserNames}" ใช่หรือไม่?`)
  )
    return;

  [...winnerTeam, ...loserTeam].forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) found.played++;
  });

  // ผู้แพ้ต้องพัก 2 เกม
  loserTeam.forEach((player) => {
    const found = players.find((p) => p.name === player.name);
    if (found) found.waitCount = 2;
  });

  // ลด waitCount ของคนอื่นลง
  players.forEach((p) => {
    if (p.waitCount > 0) p.waitCount--;
  });

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
    let remainingPlayersSorted = players
      .filter(
        (p) => !winnerTeam.some((w) => w.name === p.name) && p.waitCount === 0
      )
      .sort((a, b) => a.played - b.played);

    let newOpponent = null;
    for (let i = 0; i < remainingPlayersSorted.length; i++) {
      for (let j = i + 1; j < remainingPlayersSorted.length; j++) {
        const p1 = remainingPlayersSorted[i];
        const p2 = remainingPlayersSorted[j];
        if (!havePlayedTogether(p1, p2)) {
          newOpponent = [p1, p2];
          break;
        }
      }
      if (newOpponent) break;
    }

    if (!newOpponent) {
      newOpponent = remainingPlayersSorted.slice(0, 2);
    }

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
    div.innerHTML += `<div>${p.name}: ${p.played} เกม ${
      p.waitCount > 0 ? `(รอ ${p.waitCount})` : ""
    }</div>`;
  });
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

// ========== Save ==========
function saveState() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("history", JSON.stringify(history));
  localStorage.setItem("currentMatch", JSON.stringify(currentMatch));
  localStorage.setItem("currentChampion", JSON.stringify(currentChampion));
  localStorage.setItem("championWinCount", championWinCount.toString());
}

function removePlayer(index) {
  if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${players[index].name}"?`)) return;
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

  if (!confirm("คุณต้องการสุ่มลำดับผู้เล่นใหม่ใช่หรือไม่?")) return;

  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  saveState();
  renderPlayerList();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

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

function toggleStartButton() {
  const btn = document.getElementById("btnStartGame");
  if (!btn) return;
  btn.style.display = players.length >= 4 ? "inline-block" : "none";
}

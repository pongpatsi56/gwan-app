// ========== ตัวแปร ==========
let players = JSON.parse(localStorage.getItem("players")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let currentMatch = null;
let currentChampion = null;
let championWinCount = 0;

// ========== เริ่มต้น ==========
renderPlayerList();
renderGame();
renderSummary();

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
  const ul = document.getElementById("playerList");
  ul.innerHTML = "";
  players.forEach((p, i) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.gender === "male" ? "ช" : "ญ"})`;
    ul.appendChild(li);
  });
}

// ========== จัดเกมใหม่ ==========
function renderGame() {
  if (players.length < 4) {
    document.getElementById("currentMatch").innerHTML = "❗ ต้องมีผู้เล่นอย่างน้อย 4 คน";
    return;
  }

  // เลือก 4 คนที่เล่นน้อยสุด
  const sortedPlayers = [...players].sort((a, b) => a.played - b.played);
  const candidates = sortedPlayers.slice(0, 6);

  // พยายามจัดคู่ผสมก่อน
  const males = candidates.filter(p => p.gender === "male");
  const females = candidates.filter(p => p.gender === "female");

  let match = [];

  if (females.length >= 2) {
    match.push({ team: [males[0], females[0]] });
    match.push({ team: [males[1], females[1]] });
  } else if (females.length === 1 && males.length >= 3) {
    match.push({ team: [males[0], females[0]] });
    match.push({ team: [males[1], males[2]] });
  } else {
    // จับชาย + ชาย
    match.push({ team: [males[0], males[1]] });
    match.push({ team: [males[2], males[3]] });
  }

  currentMatch = match;
  showMatch();
}

// ========== แสดงคู่ที่กำลังเล่น ==========
function showMatch() {
  const div = document.getElementById("currentMatch");
  div.innerHTML = "";

  currentMatch.forEach((pair, index) => {
    const teamNames = pair.team.map(p => p.name).join(" + ");
    div.innerHTML += `<div><strong>ทีม ${index + 1}:</strong> ${teamNames}</div>`;
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
// function chooseWinner(winnerIndex) {
//   const winnerTeam = currentMatch[winnerIndex].team;
//   const loserTeam = currentMatch[1 - winnerIndex].team;

//   // นับเกมให้ทุกคน
//   [...winnerTeam, ...loserTeam].forEach(player => {
//     const found = players.find(p => p.name === player.name);
//     if (found) found.played++;
//   });

//   // แชมป์ระบบ
//   const winnerKey = winnerTeam.map(p => p.name).join("+");

//   if (
//     currentChampion &&
//     currentChampion === winnerKey
//   ) {
//     championWinCount++;
//   } else {
//     currentChampion = winnerKey;
//     championWinCount = 1;
//   }

//   if (championWinCount >= 2) {
//     // แชมป์ครบ 2 เกม → ออกทั้งทีม
//     currentChampion = null;
//     championWinCount = 0;
//   }

//   // เก็บลง history (optional)
//   history.push({
//     winner: winnerTeam.map(p => p.name),
//     loser: loserTeam.map(p => p.name),
//   });

//   saveState();
//   renderGame();
//   renderSummary();
// }

function chooseWinner(winnerIndex) {
  const winnerTeam = currentMatch[winnerIndex].team;
  const loserTeam = currentMatch[1 - winnerIndex].team;

  const winnerNames = winnerTeam.map(p => p.name).join(" + ");
  const loserNames = loserTeam.map(p => p.name).join(" + ");

  const confirmWin = confirm(`ยืนยันว่า "${winnerNames}" ชนะเหนือ "${loserNames}" ใช่หรือไม่?`);

  if (!confirmWin) return;

  // นับเกมให้ทุกคน
  [...winnerTeam, ...loserTeam].forEach(player => {
    const found = players.find(p => p.name === player.name);
    if (found) found.played++;
  });

  // ระบบแชมป์
  const winnerKey = winnerTeam.map(p => p.name).join("+");

  if (
    currentChampion &&
    currentChampion === winnerKey
  ) {
    championWinCount++;
  } else {
    currentChampion = winnerKey;
    championWinCount = 1;
  }

  if (championWinCount >= 2) {
    // แชมป์ครบ 2 เกม → ออกทั้งทีม
    currentChampion = null;
    championWinCount = 0;
  }

  // เก็บลง history
  history.push({
    winner: winnerTeam.map(p => p.name),
    loser: loserTeam.map(p => p.name),
  });

  saveState();
  renderGame();
  renderSummary();
}

// ========== แสดงสรุปการเล่น ==========
function renderSummary() {
  const div = document.getElementById("gameSummary");
  div.innerHTML = "";

  const sorted = [...players].sort((a, b) => b.played - a.played);
  sorted.forEach(p => {
    div.innerHTML += `<div>${p.name}: ${p.played} เกม</div>`;
  });
}

// ========== ล้างข้อมูลทั้งหมด ==========
function resetAll() {
  if (!confirm("ล้างข้อมูลทั้งหมดจริงหรือไม่?")) return;
  players = [];
  currentMatch = null;
  currentChampion = null;
  championWinCount = 0;
  history = [];
  saveState();
  renderPlayerList();
  renderGame();
  renderSummary();
}

// ========== บันทึกลง localStorage ==========
function saveState() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("history", JSON.stringify(history));
}
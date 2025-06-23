// ========== ตัวแปร ==========
let players = JSON.parse(localStorage.getItem("players")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let currentMatch = JSON.parse(localStorage.getItem("currentMatch")) || null;
let currentChampion =
  JSON.parse(localStorage.getItem("currentChampion")) || null;
let championWinCount = parseInt(localStorage.getItem("championWinCount")) || 0;
let lastLosers = JSON.parse(localStorage.getItem("lastLosers")) || [];

players.forEach((p) => {
  if (p.waitCount === undefined) p.waitCount = 0;
  if (p.waited === undefined) p.waited = 0;
});

// ========== เริ่มต้น ==========
renderPlayerList();
renderGame();
renderSummary();
renderHistory();

// ========== เพิ่มผู้เล่น ==========
function addPlayer() {
  const name = document.getElementById("playerName").value.trim();
  let gender= document.querySelector('input[name="playerGender"]:checked').value;
 
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
    .sort((a, b) => a.played - b.played);

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

  // จัดการแชมป์
  const winnerKey = winnerTeam.map((p) => p.name).join("+");
  if (currentChampion === winnerKey) {
    championWinCount++;
  } else {
    currentChampion = winnerKey;
    championWinCount = 1;
  }

  // ถ้าแชมป์ชนะ 2 ครั้งติดต่อกัน → สร้างแมตช์ใหม่แบบสุ่ม
  if (championWinCount >= 2) {
    currentChampion = null;
    championWinCount = 0;
    renderRandomMatch();
  } else {
    // แมตช์ต่อไป: แชมป์ vs คนที่ยังไม่เล่น
    const remainingPlayers = players
      .filter(
        (p) => !winnerTeam.some((w) => w.name === p.name) && p.waitCount === 0
      )
      .sort((a, b) => a.played - b.played);

    const minPlayed = Math.min(...remainingPlayers.map((p) => p.played));
    const leastPlayed = remainingPlayers.filter((p) => p.played === minPlayed);

    let nextOpponents =
      leastPlayed.length >= 2
        ? leastPlayed
        : leastPlayed.length === 1
        ? [...leastPlayed, ...remainingPlayers]
        : remainingPlayers;

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
  const table = document.getElementById("gameSummary");
  table.innerHTML = `
    <tr>
      <th>ชื่อ</th>
      <th class="col-number">เล่นแล้ว</th>
      <th class="col-number">พักอยู่</th>
      <th class="col-number">นั่งรอแล้ว</th>
    </tr>
  `;

  const sorted = [...players].sort((a, b) => b.played - a.played);
  sorted.forEach((p) => {
    table.innerHTML += `
      <tr>
        <td title="${p.name}">${p.name}</td>
        <td class="col-number">${p.played}</td>
        <td class="col-number">${p.waitCount || 0}</td>
        <td class="col-number">${p.waited || 0}</td>
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

// ========== ล้างข้อมูล ==========
function resetAll() {
  if (!confirm("ล้างข้อมูลทั้งหมดจริงหรือไม่?")) return;
  players = [];
  history = [];
  currentMatch = null;
  currentChampion = null;
  championWinCount = 0;
  lastLosers = [];

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
  localStorage.setItem("lastLosers", JSON.stringify(lastLosers));
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
  if (selected.length < 4) {
    currentMatch = null;
    document.getElementById("currentMatch").innerHTML =
      "❗ ไม่มีผู้เล่นเพียงพอสำหรับแมตช์ใหม่";
    document.getElementById("winnerButtons").innerHTML = "";
    return;
  }

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

  saveState(); // เพิ่มให้แน่ใจว่า state ใหม่ถูกบันทึก
  showMatch();
}

// ========== ปุ่มเริ่ม ==========
function toggleStartButton() {
  const btn = document.getElementById("btnStartGame");
  if (!btn) return;
  btn.style.display = players.length >= 4 ? "inline-block" : "none";
}

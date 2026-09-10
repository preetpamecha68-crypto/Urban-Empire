const socket = io();
let mode = "participant";
let teamId = localStorage.getItem("ue_team_id");
let gmAuthed = false;
let latest = null;

const $ = id => document.getElementById(id);
const money = n => `₹${Number(n || 0).toFixed(2)} Cr`;

function setMode(next) {
  mode = next;
  $("participant").classList.toggle("hidden", next !== "participant");
  $("screen").classList.toggle("hidden", next !== "screen");
  $("gm").classList.toggle("hidden", next !== "gm");
  $("login").classList.toggle("hidden", !(next === "gm" && !gmAuthed));
  if (next === "gm" && !gmAuthed) $("gmPassword").focus();
  render(latest);
}

$("gmLoginForm").addEventListener("submit", e => {
  e.preventDefault();
  $("gmLoginMsg").textContent = "Checking…";
  socket.emit("gmLogin", $("gmPassword").value);
});

socket.on("gmAuth", result => {
  if (result.ok) {
    gmAuthed = true;
    $("gmPassword").value = "";
    $("gmLoginMsg").textContent = "";
    setMode("gm");
  } else if (result.loggedOut) {
    gmAuthed = false;
    setMode("gm");
  } else {
    gmAuthed = false;
    $("gmLoginMsg").textContent = result.message || "Login failed.";
  }
});

$("logoutBtn").addEventListener("click", () => socket.emit("gmLogout"));
$("startBtn").addEventListener("click", () => socket.emit("gmStart"));
$("closeBtn").addEventListener("click", () => socket.emit("gmClose"));
$("nextBtn").addEventListener("click", () => socket.emit("gmNext"));
$("resetBtn").addEventListener("click", () => {
  if (confirm("Reset the entire auction?")) socket.emit("gmReset");
});

$("joinForm").addEventListener("submit", e => {
  e.preventDefault();
  socket.emit("join", {
    name: $("teamName").value,
    budget: Number($("budget").value)
  });
});

$("bidBtn").addEventListener("click", () => socket.emit("bid"));

socket.on("joined", ({teamId:id}) => {
  teamId = id;
  localStorage.setItem("ue_team_id", id);
  $("joinPanel").classList.add("hidden");
  $("participantPanel").classList.remove("hidden");
});

socket.on("errorMessage", msg => {
  $("pMsg").textContent = msg;
  $("gmLoginMsg").textContent = msg;
  setTimeout(() => { $("pMsg").textContent = ""; }, 3500);
});

socket.on("state", data => {
  latest = data;
  render(data);
});

function render(data) {
  if (!data) return;
  const cityText = data.city ? `${data.city.number}. ${data.city.name}` : "Lobby";
  const stateText = data.status === "bidding" ? `${data.city.state} • Bidding OPEN • Starting bid ${money(data.city.start)}`
    : data.status === "closed" ? `Round closed${data.roundWinner ? ` • Winner: ${data.roundWinner}` : " • No winner"}`
    : data.status === "finished" ? "Auction finished"
    : "Waiting for GM";

  $("pCity").textContent = cityText;
  $("pState").textContent = stateText;
  $("pTimer").textContent = data.status === "bidding" ? data.timer : "--";
  $("pBid").textContent = money(data.currentBid);
  $("pLeader").textContent = leaderName(data);
  $("gCity").textContent = cityText;
  $("gState").textContent = stateText;
  $("gTimer").textContent = data.status === "bidding" ? data.timer : "--";
  $("gBid").textContent = money(data.currentBid);
  $("gLeader").textContent = leaderName(data);
  $("gWinner").textContent = data.roundWinner || "—";

  const me = data.teams.find(t => t.id === teamId);
  if (me) {
    $("joinPanel").classList.add("hidden");
    $("participantPanel").classList.remove("hidden");
    $("pBudget").textContent = money(me.budget);
    $("pStatus").textContent = me.spectator ? "Spectator — your team already won a city" : "Active bidder";
    $("bidBtn").disabled = data.status !== "bidding" || me.spectator || data.highestTeamId === me.id;
  } else if (!teamId) {
    $("joinPanel").classList.remove("hidden");
  }

  $("teams").innerHTML = data.teams.length
    ? data.teams.map(t => `<div class="team-row"><span><b>${escapeHtml(t.name)}</b> ${t.spectator ? "• SPECTATOR" : ""} ${t.connected ? "" : "• OFFLINE"}</span><span>${money(t.budget)}</span></div>`).join("")
    : '<div class="muted">No teams joined yet.</div>';

  $("history").innerHTML = data.history.length
    ? data.history.map(h => `<div class="history-row"><span>#${h.round} ${escapeHtml(h.city)}</span><span>${h.winner ? `${escapeHtml(h.winner)} • ${money(h.finalBid)}` : "No winner"}</span></div>`).join("")
    : '<div class="muted">No completed rounds.</div>';

  $("sCity").textContent = cityText;
  $("sState").textContent = stateText;
  $("sBid").textContent = money(data.currentBid);
  $("sLeader").textContent = leaderName(data);
  $("sTimer").textContent = data.status === "bidding" ? data.timer : "--";
}

function leaderName(data) {
  const t = data.teams.find(x => x.id === data.highestTeamId);
  return t ? t.name : "—";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

setMode("participant");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const GM_PASSWORD = process.env.GM_PASSWORD || "CHANGE-ME";

const cities = [
  ["Udaipur","Rajasthan",2.50],["Mumbai","Maharashtra",5.00],["Delhi","Delhi (NCT)",4.50],
  ["Bengaluru","Karnataka",4.20],["Chennai","Tamil Nadu",3.50],["Kolkata","West Bengal",3.00],
  ["Hyderabad","Telangana",3.80],["Pune","Maharashtra",3.30],["Ahmedabad","Gujarat",3.20],
  ["Jaipur","Rajasthan",2.90],["Lucknow","Uttar Pradesh",2.50],["Chandigarh","Chandigarh (UT)",2.60],
  ["Kochi","Kerala",2.70],["Mysuru","Karnataka",2.20],["Goa","Goa",2.90],
  ["Varanasi","Uttar Pradesh",2.30],["Amritsar","Punjab",2.20],["Srinagar","Jammu & Kashmir",2.00],
  ["Shimla","Himachal Pradesh",1.80],["Manali","Himachal Pradesh",1.80],
  ["Rishikesh","Uttarakhand",1.90],["Dehradun","Uttarakhand",2.00],
  ["Darjeeling","West Bengal",1.70],["Gangtok","Sikkim",1.70],["Ooty","Tamil Nadu",1.60],
  ["Pondicherry","Puducherry (UT)",1.60],["Munnar","Kerala",1.50],["Hampi","Karnataka",1.50],
  ["Agra","Uttar Pradesh",2.30],["Jodhpur","Rajasthan",1.90]
].map(([name,state,start], i) => ({ number:i+1, name, state, start }));

const state = {
  roundIndex: -1,
  status: "lobby",
  timer: 0,
  timerId: null,
  teams: new Map(),
  history: [],
  currentBid: 0,
  highestTeamId: null,
  roundWinner: null
};

function publicState() {
  const city = cities[state.roundIndex] || null;
  return {
    roundIndex: state.roundIndex,
    city,
    status: state.status,
    timer: state.timer,
    currentBid: state.currentBid,
    highestTeamId: state.highestTeamId,
    roundWinner: state.roundWinner,
    teams: [...state.teams.values()].map(t => ({
      id:t.id, name:t.name, budget:t.budget, spent:t.spent,
      won:t.won, spectator:t.spectator, connected:t.connected
    })),
    history: state.history
  };
}

function broadcast() {
  io.emit("state", publicState());
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function startTimer() {
  stopTimer();
  state.timer = 15;
  state.timerId = setInterval(() => {
    state.timer -= 1;
    if (state.timer <= 0) {
      state.timer = 0;
      stopTimer();
      closeRound();
    }
    broadcast();
  }, 1000);
}

function startRound() {
  if (state.status === "bidding" || state.roundIndex >= cities.length - 1) return false;
  state.roundIndex += 1;
  state.status = "bidding";
  state.currentBid = cities[state.roundIndex].start;
  state.highestTeamId = null;
  state.roundWinner = null;
  startTimer();
  broadcast();
  return true;
}

function closeRound() {
  if (state.status !== "bidding") return false;
  stopTimer();
  state.status = "closed";

  const city = cities[state.roundIndex];
  let winner = state.highestTeamId ? state.teams.get(state.highestTeamId) : null;

  if (winner) {
    winner.budget -= state.currentBid;
    winner.spent += state.currentBid;
    winner.won += 1;
    winner.spectator = true;
    state.roundWinner = winner.name;
  } else {
    state.roundWinner = null;
  }

  state.history.push({
    round: city.number,
    city: city.name,
    state: city.state,
    start: city.start,
    finalBid: winner ? state.currentBid : null,
    winner: winner ? winner.name : null
  });

  broadcast();
  return true;
}

function nextRound() {
  if (state.status !== "closed") return false;
  if (state.roundIndex >= cities.length - 1) {
    state.status = "finished";
    broadcast();
    return true;
  }
  return startRound();
}

function resetGame() {
  stopTimer();
  state.roundIndex = -1;
  state.status = "lobby";
  state.timer = 0;
  state.currentBid = 0;
  state.highestTeamId = null;
  state.roundWinner = null;
  state.history = [];
  for (const team of state.teams.values()) {
    team.budget = team.startBudget;
    team.spent = 0;
    team.won = 0;
    team.spectator = false;
  }
  broadcast();
}

function isGM(socket) {
  return socket.data.isGM === true;
}

io.on("connection", socket => {
  socket.emit("state", publicState());

  socket.on("gmLogin", password => {
    if (typeof password !== "string") return socket.emit("gmAuth", { ok:false, message:"Invalid password." });
    if (password === GM_PASSWORD) {
      socket.data.isGM = true;
      socket.emit("gmAuth", { ok:true });
      socket.emit("state", publicState());
    } else {
      socket.emit("gmAuth", { ok:false, message:"Incorrect GM password." });
    }
  });

  socket.on("gmLogout", () => {
    socket.data.isGM = false;
    socket.emit("gmAuth", { ok:false, loggedOut:true });
  });

  socket.on("join", ({name, budget}) => {
    if (state.status !== "lobby") return socket.emit("errorMessage", "Teams can only join before the auction starts.");
    const cleanName = String(name || "").trim().slice(0, 30);
    const startingBudget = Number(budget);
    if (!cleanName) return socket.emit("errorMessage", "Enter a team name.");
    if (!Number.isFinite(startingBudget) || startingBudget <= 0) return socket.emit("errorMessage", "Enter a valid starting budget.");
    if ([...state.teams.values()].some(t => t.name.toLowerCase() === cleanName.toLowerCase()))
      return socket.emit("errorMessage", "That team name is already taken.");

    state.teams.set(socket.id, {
      id:socket.id, name:cleanName, budget:startingBudget, startBudget:startingBudget,
      spent:0, won:0, spectator:false, connected:true
    });
    socket.emit("joined", {teamId:socket.id});
    broadcast();
  });

  socket.on("reconnectTeam", teamId => {
    const team = state.teams.get(teamId);
    if (!team) return socket.emit("errorMessage", "Team session expired. Please join again.");
    if (team.connected) return socket.emit("errorMessage", "That team is already connected.");
    state.teams.delete(teamId);
    team.id = socket.id;
    team.connected = true;
    state.teams.set(socket.id, team);
    socket.emit("joined", {teamId:socket.id});
    broadcast();
  });

  socket.on("bid", () => {
    const team = state.teams.get(socket.id);
    if (!team) return socket.emit("errorMessage", "Join as a team first.");
    if (state.status !== "bidding") return socket.emit("errorMessage", "Bidding is not open.");
    if (team.spectator) return socket.emit("errorMessage", "Your team has already won a city and can only spectate.");
    if (state.highestTeamId === socket.id) return socket.emit("errorMessage", "You already have the highest bid.");

    const nextBid = state.highestTeamId === null
      ? state.currentBid
      : Number((state.currentBid + 0.05).toFixed(2));

    if (team.budget < nextBid) return socket.emit("errorMessage", "Your remaining budget is too low for this bid.");

    state.currentBid = nextBid;
    state.highestTeamId = socket.id;
    startTimer();
    broadcast();
  });

  socket.on("gmStart", () => { if (isGM(socket)) startRound(); else socket.emit("errorMessage","GM login required."); });
  socket.on("gmClose", () => { if (isGM(socket)) closeRound(); else socket.emit("errorMessage","GM login required."); });
  socket.on("gmNext", () => { if (isGM(socket)) nextRound(); else socket.emit("errorMessage","GM login required."); });
  socket.on("gmReset", () => { if (isGM(socket)) resetGame(); else socket.emit("errorMessage","GM login required."); });

  socket.on("disconnect", () => {
    const team = state.teams.get(socket.id);
    if (team) {
      team.connected = false;
      broadcast();
    }
  });
});

app.use(express.static("public"));

app.get("/gm", (_, res) => res.sendFile(require("path").join(__dirname, "public", "index.html")));
app.get("/screen", (_, res) => res.sendFile(require("path").join(__dirname, "public", "index.html")));
app.get("/health", (_, res) => res.json({ok:true}));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Urban Empire running on port ${PORT}`);
});

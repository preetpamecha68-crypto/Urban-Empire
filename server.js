const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const GM_PASSWORD = process.env.GM_PASSWORD || "urban123";

const cities = [
  ["Udaipur","Rajasthan",2.50],["Mumbai","Maharashtra",5.00],
  ["Delhi","Delhi (NCT)",4.50],["Bengaluru","Karnataka",4.20],
  ["Chennai","Tamil Nadu",3.50],["Kolkata","West Bengal",3.00],
  ["Hyderabad","Telangana",3.80],["Pune","Maharashtra",3.30],
  ["Ahmedabad","Gujarat",3.20],["Jaipur","Rajasthan",2.90],
  ["Lucknow","Uttar Pradesh",2.50],["Chandigarh","Chandigarh (UT)",2.60],
  ["Kochi","Kerala",2.70],["Mysuru","Karnataka",2.20],
  ["Goa","Goa",2.90],["Varanasi","Uttar Pradesh",2.30],
  ["Amritsar","Punjab",2.20],["Srinagar","Jammu & Kashmir",2.00],
  ["Shimla","Himachal Pradesh",1.80],["Manali","Himachal Pradesh",1.80],
  ["Rishikesh","Uttarakhand",1.90],["Dehradun","Uttarakhand",2.00],
  ["Darjeeling","West Bengal",1.70],["Gangtok","Sikkim",1.70],
  ["Ooty","Tamil Nadu",1.60],["Pondicherry","Puducherry (UT)",1.60],
  ["Munnar","Kerala",1.50],["Hampi","Karnataka",1.50],
  ["Agra","Uttar Pradesh",2.30],["Jodhpur","Rajasthan",1.90]
].map(([name,state,start],i)=>({round:i+1,name,state,start}));

const state = {
  roundIndex: 0,
  status: "lobby", // lobby | bidding | closed | finished
  timer: 15,
  timerId: null,
  teams: new Map(),
  history: [],
  currentBid: 0,
  highestTeamId: null,
  roundWinner: null
};

function publicState() {
  const city = cities[state.roundIndex];
  return {
    status: state.status,
    roundIndex: state.roundIndex,
    totalRounds: cities.length,
    city,
    currentBid: state.currentBid,
    highestTeamId: state.highestTeamId,
    timer: state.timer,
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
    if (state.status !== "bidding") return;
    state.timer--;
    if (state.timer <= 0) closeRound();
    broadcast();
  }, 1000);
}

function startRound() {
  if (state.roundIndex >= cities.length) {
    state.status = "finished";
    broadcast();
    return;
  }
  const city = cities[state.roundIndex];
  state.status = "bidding";
  state.currentBid = city.start;
  state.highestTeamId = null;
  state.roundWinner = null;
  startTimer();
  broadcast();
}

function closeRound() {
  stopTimer();
  if (state.status !== "bidding") return;

  const city = cities[state.roundIndex];
  if (state.highestTeamId) {
    const team = state.teams.get(state.highestTeamId);
    if (team) {
      team.budget -= state.currentBid;
      team.spent += state.currentBid;
      team.won.push({round:city.round, city:city.name, bid:state.currentBid});
      team.spectator = true;
      state.roundWinner = {teamId:team.id, teamName:team.name, bid:state.currentBid};
      state.history.push({
        round:city.round, city:city.name,
        winner:team.name, bid:state.currentBid
      });
    }
  } else {
    state.roundWinner = {teamId:null, teamName:null, bid:null};
    state.history.push({round:city.round, city:city.name, winner:null, bid:null});
  }
  state.status = "closed";
  broadcast();
}

function nextRound() {
  if (state.status !== "closed") return;
  state.roundIndex++;
  if (state.roundIndex >= cities.length) {
    state.status = "finished";
    broadcast();
    return;
  }
  startRound();
}

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_,res)=>res.json({ok:true}));

io.on("connection", socket => {
  socket.emit("state", publicState());

  socket.on("join", ({name,budget}) => {
    name = String(name || "").trim().slice(0,32);
    budget = Number(budget) || 10;
    if (!name) return socket.emit("errorMsg","Enter a team name.");
    if ([...state.teams.values()].some(t => t.name.toLowerCase() === name.toLowerCase()))
      return socket.emit("errorMsg","That team name is already taken.");

    const id = socket.id;
    state.teams.set(id,{
      id,name,budget,spent:0,won:[],spectator:false,connected:true
    });
    socket.data.teamId = id;
    socket.emit("joined",{teamId:id});
    broadcast();
  });

  socket.on("reconnectTeam", ({teamId}) => {
    const team = state.teams.get(teamId);
    if (!team) return socket.emit("errorMsg","Team session not found.");
    socket.data.teamId = teamId;
    team.connected = true;
    broadcast();
  });

  socket.on("bid", () => {
    const team = state.teams.get(socket.data.teamId);
    if (!team) return socket.emit("errorMsg","Join a team first.");
    if (state.status !== "bidding") return socket.emit("errorMsg","Bidding is closed.");
    if (team.spectator) return socket.emit("errorMsg","You are in spectator mode.");
    if (state.highestTeamId === team.id) return socket.emit("errorMsg","You already have the highest bid.");

    const nextBid = state.highestTeamId ? state.currentBid + 0.05 : state.currentBid;
    if (team.budget < nextBid) return socket.emit("errorMsg","Not enough budget for this bid.");

    state.currentBid = nextBid;
    state.highestTeamId = team.id;
    state.timer = 15;
    broadcast();
  });

  socket.on("gmLogin", ({password}) => {
    if (password === GM_PASSWORD) socket.emit("gmAuth", {ok:true});
    else socket.emit("gmAuth", {ok:false});
  });

  socket.on("gmStart", () => startRound());
  socket.on("gmClose", () => closeRound());
  socket.on("gmNext", () => nextRound());
  socket.on("gmReset", () => {
    stopTimer();
    state.roundIndex=0; state.status="lobby"; state.timer=15;
    state.currentBid=0; state.highestTeamId=null; state.roundWinner=null;
    state.history=[];
    for (const t of state.teams.values()) {
      t.budget=10; t.spent=0; t.won=[]; t.spectator=false;
    }
    broadcast();
  });

  socket.on("disconnect", () => {
    const id = socket.data.teamId;
    if (id && state.teams.has(id)) {
      state.teams.get(id).connected = false;
      broadcast();
    }
  });
});

server.listen(PORT,"0.0.0.0",()=>console.log(`Urban Empire running on ${PORT}`));

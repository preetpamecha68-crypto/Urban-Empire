const socket = io();
let S = null;
let teamId = localStorage.getItem("ue_team_id");
let mode = new URLSearchParams(location.search).get("mode") || "participant";
let gm = false;

const money = n => `₹${Number(n||0).toFixed(2)} Cr`;

function render(){
  if(mode==="gm") return renderGM();
  if(mode==="screen") return renderScreen();
  if(!teamId) return renderJoin();
  const me = S?.teams?.find(t=>t.id===teamId);
  if(!me) return renderJoin();
  const c=S.city;
  document.getElementById("app").innerHTML=`
  <div class="wrap">
    <div class="top"><div class="brand">URBAN EMPIRE</div><div>${me.name} · ${money(me.budget)} remaining</div></div>
    <div class="grid">
      <div class="card city">
        <div class="round">Round ${c.round} / 30</div>
        <h1>${c.name}</h1><div class="state">${c.state}</div>
        <div class="price">${money(S.currentBid)}</div>
        <div class="muted">Starting bid ${money(c.start)}</div>
        <div style="margin:25px 0" class="timer">${S.status==="bidding" ? S.timer+"s" : S.status.toUpperCase()}</div>
        <button class="bid" ${S.status!=="bidding"||me.spectator||S.highestTeamId===teamId?"disabled":""} onclick="bid()">
          ${me.spectator ? "👀 SPECTATOR MODE" : S.highestTeamId===teamId ? "✓ HIGHEST BID" : "BID + ₹0.05 CR"}
        </button>
        ${S.roundWinner?`<div class="winner">🏆 ${S.roundWinner.teamName||"No sale"} ${S.roundWinner.bid?`— ${money(S.roundWinner.bid)}`:""}</div>`:""}
      </div>
      <div class="card">
        <h3>YOUR EMPIRE</h3>
        <p>Spent: <b>${money(me.spent)}</b></p>
        <p>Cities won: <b>${me.won.length}</b></p>
        <hr/>
        <h3>TEAMS</h3>
        <div class="teams">${S.teams.map(t=>`<div class="team"><span>${t.name}</span><span>${t.spectator?"👀":(t.id===S.highestTeamId?"🔨":"🟢")}</span></div>`).join("")}</div>
      </div>
    </div>
  </div>`;
}

function renderJoin(){
 document.getElementById("app").innerHTML=`<div class="wrap"><div class="card" style="max-width:500px;margin:80px auto">
 <div class="brand">URBAN EMPIRE</div><p class="muted">Virtual Auction · 30 Rounds</p>
 <input class="input" id="teamName" placeholder="Team name"/>
 <input class="input" id="budget" type="number" value="10" step=".05" placeholder="Starting budget in Cr"/>
 <button class="bid" onclick="join()">ENTER AUCTION</button>
 <p id="err" class="muted"></p></div></div>`;
}
function join(){
 const name=document.getElementById("teamName").value;
 const budget=document.getElementById("budget").value;
 socket.emit("join",{name,budget});
}
function bid(){socket.emit("bid")}
function renderGM(){
 document.getElementById("app").innerHTML=`<div class="wrap"><div class="top"><div class="brand">URBAN EMPIRE · GM</div><span>${S?.status||"Loading"}</span></div>
 <div class="grid"><div class="card city"><div class="round">Round ${S?.city?.round||1} / 30</div><h1>${S?.city?.name||"Lobby"}</h1>
 <div class="state">${S?.city?.state||""}</div><div class="price">${S?money(S.currentBid):"—"}</div><div class="timer">${S?.timer||15}s</div>
 <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
 <button class="action" onclick="socket.emit('gmStart')">▶ START</button><button class="action" onclick="socket.emit('gmClose')">🔨 CLOSE</button>
 <button class="action" onclick="socket.emit('gmNext')">➡ NEXT ROUND</button><button class="action danger" onclick="socket.emit('gmReset')">RESET</button></div></div>
 <div class="card"><h3>TEAMS</h3><div class="teams">${(S?.teams||[]).map(t=>`<div class="team"><span>${t.name}<br><small>${t.spectator?"Spectator":"Active"}</small></span><span>${money(t.budget)}</span></div>`).join("")}</div></div></div>
 <div class="card" style="margin-top:18px"><h3>AUCTION HISTORY</h3><table class="history"><tr><th>Round</th><th>City</th><th>Winner</th><th>Bid</th></tr>${(S?.history||[]).map(x=>`<tr><td>${x.round}</td><td>${x.city}</td><td>${x.winner||"No sale"}</td><td>${x.bid?money(x.bid):"—"}</td></tr>`).join("")}</table></div></div>`;
}
function renderScreen(){
 const c=S?.city||{round:1,name:"Waiting",state:""};
 document.getElementById("app").innerHTML=`<div class="wrap screen"><div class="top"><div class="brand">URBAN EMPIRE</div><div>ROUND ${c.round} / 30</div></div>
 <div class="card city"><div class="round">${S?.status==="bidding"?"LIVE AUCTION":"AUCTION DISPLAY"}</div><h1>${c.name}</h1><div class="state">${c.state}</div>
 <div class="price">${S?money(S.currentBid):"—"}</div><div class="timer">${S?.timer||15}s</div>
 <p>${S?.highestTeamId ? "🔨 "+(S.teams.find(t=>t.id===S.highestTeamId)?.name||"") : "Awaiting first bid"}</p>
 ${S?.roundWinner?`<div class="winner">🏆 SOLD TO ${S.roundWinner.teamName||"NO ONE"}</div>`:""}</div></div>`;
}

socket.on("state", s=>{S=s; render()});
socket.on("joined", x=>{teamId=x.teamId;localStorage.setItem("ue_team_id",teamId);render()});
socket.on("errorMsg", m=>{const e=document.getElementById("err");if(e)e.textContent=m;else alert(m)});
render();

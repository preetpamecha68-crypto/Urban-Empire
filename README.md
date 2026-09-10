# Urban Empire — Virtual Auction

A real-time 30-round auction game for Urban Empire.

## Features
- 30-city auction sequence
- Live bidding with Socket.IO
- GM controls
- Team budgets
- Automatic winner lockout
- Spectator mode after a team wins
- Auction timer
- Projector mode
- No external services required for the MVP

## Local run
```bash
npm install
GM_PASSWORD=urban123 npm start
```

On Windows PowerShell:
```powershell
$env:GM_PASSWORD="urban123"
npm start
```

Open:
- Participant: http://localhost:3000
- GM: http://localhost:3000/?mode=gm
- Projector: http://localhost:3000/?mode=screen

## Render
Create a Render Web Service from this GitHub repository:
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `GM_PASSWORD`

Render automatically redeploys when the connected Git branch changes.

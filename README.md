# Urban Empire Auction — Version 2

## What's new
- Proper Game Master login screen.
- GM actions are authorized server-side after login.
- GM password comes from the `GM_PASSWORD` environment variable.
- Participants cannot access GM controls just by changing the URL.
- 30-city auction sequence included.
- 15-second bid timer.
- Winner lockout/spectator mode.
- Projector mode.
- Realtime Socket.IO bidding.

## Pages
- Participant: `/`
- Game Master: `/gm`
- Projector: `/screen`

## Render
Build command: `npm install`
Start command: `npm start`

Set this Render environment variable:
`GM_PASSWORD=your-secret-password`

Do not commit `.env` or the real GM password to GitHub.

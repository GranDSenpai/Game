# Fogline Tactics (online)

A two-player fog-of-war strategy game. One small Node.js server runs every match and
sends each player only what their own base and units can see, so nobody can peek.

## Play on your own computer first

1. Install Node.js 18 or newer from https://nodejs.org
2. In this folder run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000, click **Create a game**, then open the invite link in a
   second browser window to play against yourself.

## Put it online for free (Render)

1. Make a free account at https://github.com and create a new repository.
   Upload everything in this folder **except** `node_modules`.
2. Make a free account at https://render.com (sign in with GitHub).
3. Click **New → Web Service**, pick your repository, and use:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: **Free**
4. Click **Create Web Service**. After a minute or two you get an address like
   `https://fogline-tactics.onrender.com`.
5. Open it, click **Create a game**, and send the invite link to your friend.

Things to know about the free plan:
- The server goes to sleep after 15 minutes with nobody playing. The next visit wakes it,
  which takes about a minute.
- Games live in the server's memory. If the server sleeps or restarts, games in progress
  are lost. Refreshing the page or a dropped connection is fine; you rejoin your seat.

## Rebalancing

All numbers live at the top of `public/game.js`:
- `CONFIG`: board size, starting gold, income and interest thresholds, base HP, vision,
  recruits per turn, unit cap.
- `UNITS`: every unit's cost, HP, attack, movement and attack pattern.

Change them, push to GitHub, and Render redeploys automatically.

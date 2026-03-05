# Deployment Guide — Mac Mini (Local Network)

Two processes run on your Mac mini:
- **Backend** — Node.js/Express on port 3001
- **Frontend** — Vite/React on port 5173 (dev) or served as static files via the backend (prod)

Both kept alive with **PM2** (process manager), auto-starting on login.

---

## 1. Prerequisites (one-time setup)

Open Terminal on your Mac mini and run these one at a time.

### Install Homebrew (if not already installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Install Node.js
```bash
brew install node
node --version   # should print v20 or higher
```

### Install PM2 (process manager — keeps the server alive)
```bash
npm install -g pm2
```

---

## 2. Project structure on your Mac mini

We'll put everything in your home folder:
```
~/belgian-finance/
├── backend/       ← the Node.js API (from this project)
└── frontend/      ← the Vite/React app (new)
```

---

## 3. Set up the backend

### Clone or copy the files
If you have a GitHub repo:
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git belgian-finance
cd ~/belgian-finance/backend
```

Or if copying manually, create the folder and paste the files in:
```bash
mkdir -p ~/belgian-finance/backend
# copy all files from the backend/ folder here
```

### Install dependencies
```bash
cd ~/belgian-finance/backend
npm install
```

### Create your .env file
```bash
cp .env.example .env
nano .env
```

Fill in your two keys:
```
CBE_API_TOKEN=your_token_from_crossroadsbankenterprises
NBB_CBSO_API_KEY=your_key_from_developer_uat2_cbso_nbb_be
NBB_ENV=uat2
PORT=3001
NODE_ENV=production
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

### Test it works
```bash
node src/index.js
# Should print: Running on http://localhost:3001
# Ctrl+C to stop
```

---

## 4. Set up the frontend

### Create a new Vite + React app
```bash
cd ~/belgian-finance
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

### Replace the default App
```bash
# Delete the default files
rm src/App.jsx src/App.css src/index.css

# Copy your dashboard component
cp ~/belgian-finance/backend/frontend.jsx src/App.jsx
```

### Configure the API URL
```bash
nano .env
```
Add:
```
VITE_API_URL=http://localhost:3001/api
```

### Update main.jsx (remove CSS import)
```bash
nano src/main.jsx
```
Replace the contents with:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### Test the frontend
```bash
npm run dev
# Opens at http://localhost:5173
```

Open your browser to http://localhost:5173 — the app should load.

---

## 5. Build the frontend and serve it from the backend

Instead of running two separate servers, we'll build the frontend into static files and serve them from Express. This means only one process to manage.

### Build the frontend
```bash
cd ~/belgian-finance/frontend
npm run build
# Creates a dist/ folder with static files
```

### Tell the backend to serve the frontend
In `~/belgian-finance/backend/src/index.js`, add these lines just before the 404 handler:

```js
// Serve built frontend
const path = require("path");
app.use(express.static(path.join(__dirname, "../../frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});
```

### Test the combined setup
```bash
cd ~/belgian-finance/backend
node src/index.js
```
Open http://localhost:3001 — you should see the full app.

---

## 6. Keep it running with PM2

### Start the backend with PM2
```bash
cd ~/belgian-finance/backend
pm2 start src/index.js --name "belgian-finance"
```

### Check it's running
```bash
pm2 status
# Should show belgian-finance as "online"
```

### Auto-start on Mac login
```bash
pm2 startup launchd
# PM2 will print a command — copy and run it (it starts with sudo)

pm2 save
# Saves the current process list so it restores after restart
```

### Useful PM2 commands
```bash
pm2 logs belgian-finance      # view live logs
pm2 restart belgian-finance   # restart after code changes
pm2 stop belgian-finance      # stop the server
pm2 monit                     # live dashboard
```

---

## 7. Find your Mac mini's local IP

Other devices on your network can reach the app via your Mac mini's IP.

```bash
ipconfig getifaddr en0
# Prints something like: 192.168.1.42
```

Then from any device on the same WiFi, open:
```
http://192.168.1.42:3001
```

### Make the IP permanent (recommended)
In your router's admin panel (usually http://192.168.1.1), find the DHCP settings and assign a **static/reserved IP** to your Mac mini's MAC address. This prevents the IP from changing.

To find your Mac mini's MAC address:
```bash
networksetup -getmacaddress en0
```

---

## 8. Rebuilding after code changes

When you update code (e.g. pull from GitHub):

```bash
# Update backend
cd ~/belgian-finance/backend
git pull
npm install        # only if package.json changed
pm2 restart belgian-finance

# Update frontend
cd ~/belgian-finance/frontend
git pull
npm install        # only if package.json changed
npm run build      # rebuild static files
pm2 restart belgian-finance   # backend serves the new build
```

---

## 9. Quick-reference: URL cheatsheet

| What | URL |
|---|---|
| App (on Mac mini itself) | http://localhost:3001 |
| App (from other device on WiFi) | http://192.168.1.42:3001 ← your actual IP |
| API health check | http://localhost:3001/api/health |
| Person search | http://localhost:3001/api/persons/search?q=Jan |
| Company financials | http://localhost:3001/api/financials/person/12345678 |
| PM2 logs | `pm2 logs belgian-finance` in Terminal |

---

## Troubleshooting

**Port already in use:**
```bash
lsof -i :3001
kill -9 <PID>
```

**PM2 not starting on login:**
```bash
pm2 unstartup launchd
pm2 startup launchd   # run the printed command again
pm2 save
```

**CORS error in browser:**
Make sure `ALLOWED_ORIGINS` in `.env` includes the origin, or for local use the default `localhost:3000` and `localhost:5173` are already allowed.

**NBB API returns 401:**
Your `NBB_CBSO_API_KEY` is wrong or the subscription isn't active yet. Check the developer portal at https://developer.uat2.cbso.nbb.be.

**CBE API returns 401:**
Your `CBE_API_TOKEN` has expired or the plan limit is reached. Check https://en.login.kbodata.app.

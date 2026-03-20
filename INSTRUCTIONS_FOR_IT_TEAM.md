# Deployment Instructions for IT Team

Hello IT Team, 

We have modernized the app's deployment approach so that the **backend Node server automatically serves the compiled static files of the frontend**. This resolves issues where frontend updates weren't showing up because `npm run dev` or `vite preview` was being used incorrectly.

## Why was it holding a connection and not updating?
Vite (`npm run dev` or `vite preview`) creates persistent WebSocket connections for Hot Module Replacement (HMR) and development. It is meant for local dev only. For production, the frontend MUST be built (`npm run build`) and served statically.

## How to deploy the application now?

### Option 1: Docker (Recommended)
A `Dockerfile` has been added to the root directory which handles Building the frontend to `/dist` and setting up the backend.

```bash
docker build -t ii2-app .
# Runs the container. The backend automatically serves the built frontend on port 5000!
docker run -d -p 5000:5000 ii2-app 
```

### Option 2: Manual / Jenkins without Docker
If you are directly pulling from GitHub and restarting via PM2 or a standard Pipeline, here are the steps:

```bash
# 1. Pull latest code
git pull origin main

# 2. Install all dependencies (Uses the root package.json script)
npm run install:all

# 3. Build frontend and Start Backend
npm run build:frontend
# Restart script for PM2 or systemd:
pm2 restart backend
```

**Note:** To start the node application, simply run `npm start` from the `backend/` directory or `npm start` from root. It will run `node src/server.js` matching `.env`. Nginx proxying is optional but recommended.

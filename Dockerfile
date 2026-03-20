# Use stable Node.js 20 image
FROM node:20-slim

WORKDIR /app

# Copy all root project files (package.json, backend, frontend)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install root dependencies (if any) and backend dependencies
RUN npm install --prefix backend --omit=dev

# Copy backend source code
COPY backend ./backend

# Copy frontend build (Assumes frontend is built on the Jenkins host)
COPY frontend/dist ./frontend/dist

# The backend/src/app.js looks for '../../frontend/dist' relative to itself
# So the structure /app/backend/src and /app/frontend/dist works perfectly.

WORKDIR /app/backend
EXPOSE 5000

# Start the server
CMD ["node", "src/server.js"]

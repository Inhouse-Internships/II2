# Stage 1: Build the frontend (Vite React App)
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Backend and copy built frontend
FROM node:18
WORKDIR /app

# Setup backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --production
COPY backend/ ./

# Verify backend directory files are copied
RUN ls -la

# Copy built frontend output into the correct location so backend can serve it
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# The backend runs on port 5000 by default (set by your env config)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]

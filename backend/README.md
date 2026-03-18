# Internship Management System Backend

This is the backend service for the Internship Management System, built with Node.js, Express, and MongoDB.

## Project Structure

The project follows a standard modular architecture for scalability and maintainability.

- **`src/`**: Contains the main application source code.
  - **`api/`**: API related code (to be further modularized if needed).
    - **`controllers/`**: Logic for handling requests and generating responses.
    - **`routes/`**: Route definitions mapping endpoints to controllers.
    - **`middlewares/`**: Custom Express middlewares (auth, validation, error handling).
  - **`config/`**: Configuration files for database, environment variables, and third-party services.
  - **`models/`**: Mongoose schemas and models.
  - **`services/`**: Cross-cutting business logic or third-party service integrations.
  - **`utils/`**: Shared utility functions and constants.
  - **`app.js`**: Express application setup and middleware configuration.
  - **`server.js`**: Application entry point.
  - **`mailer.js`**: Email service configuration and wrapper.

- **`scripts/`**: Maintenance, migration, and utility scripts.
- **`node_modules/`**: Project dependencies.
- **`.env`**: Environment variables (not tracked by Git).
- **`package.json`**: Project metadata and dependency definitions.

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file in the root directory based on `.env.example`.

3. **Run in Development**:
   ```bash
   npm run dev
   ```

4. **Run in Production**:
   ```bash
   npm start
   ```

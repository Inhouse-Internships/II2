# Internship Management System Frontend

A high-performance student internship management dashboard built with React, Vite, and Material-UI.

## Key Features

- **Blazing Fast Performance**: Sub-1s initial loads through route-based code splitting and component lazy loading.
- **Batch API Integration**: Consolidates multiple data requests into single round-trips for maximum efficiency.
- **Premium Aesthetics**: Modern, responsive UI with sleek animations and a professional color palette.
- **Role-Based Access**: Specialized dashboards for Students, Faculty, HODs, and Administrators.

## Project Structure

- **`src/`**: Main application source.
  - **`core/`**: Critical infrastructure (API services, auth utilities, hooks, constants).
  - **`components/`**: Shared reusable UI components.
  - **`pages/`**: View components organized by user role.
  - **`layouts/`**: Navigation and structural shell components.
  - **`assets/`**: Static assets and global styles.
  - **`App.jsx`**: Main routing and application shell.
  - **`main.jsx`**: Application entry point.

## Technology Stack

- **React 19**
- **Vite 7** (with SWC for lightning-fast HMR)
- **Material-UI (MUI)**
- **React Router 7**
- **Notistack** (for notifications)

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Create a `.env` file with `VITE_API_TARGET=http://localhost:5000`.

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

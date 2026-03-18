# Inhouse Internships 2.0

A high-performance Internship Management System designed for universities. This project provides a unified platform for Students, Faculty, HODs, and Administrators to manage, track, and approve internships within the institution.

## 🚀 Overview

Inhouse Internships 2.0 is built with a modern tech stack focused on speed, security, and professional aesthetics. It automates the entire internship lifecycle from project creation and student application to attendance tracking and final approval.

## 📂 Project Structure

The repository is organized into two main components:

- **[frontend/](./frontend)**: A React 19 application built with Vite and Material-UI (MUI). It features role-based dashboards, route-based code splitting, and a premium dark-themed UI.
- **[backend/](./backend)**: A Node.js/Express service using MongoDB. It handles authentication (JWT + OTP), session auditing, email notifications, and business logic for internship management.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite 7, Material-UI, React Router 7, Notistack.
- **Backend**: Node.js, Express, MongoDB (Mongoose), JSON Web Tokens (JWT), Nodemailer.
- **Other utilities**: ESM (Frontend), CommonJS (Backend), ESLint, Prettier.

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas instance)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd II2
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Fill in your MONGO_URI, JWT_SECRET, and SMTP details in .env
   ```

3. **Setup Frontend**:
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env
   # Ensure VITE_API_TARGET matches your backend URL (default: http://localhost:5000)
   ```

### Running Locally

You can use the provided batch script to start both servers at once:
```bash
./start_servers.bat
```
Alternatively, run them manually:
- Backend: `cd backend && npm run dev`
- Frontend: `cd frontend && npm run dev`

## 🛡️ Security Features

- **JWT Authentication**: Secure stateless authentication with token versioning for instant logout/revocation.
- **Login Auditing**: All login attempts (success/fail) are logged with IP addresses for security monitoring.
- **OTP Verification**: Email OTPs required for registration and password resets.
- **Input Validation**: Strict schema validation for all API requests.


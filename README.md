# Splitwise Clone

A full-stack expense-sharing web application inspired by Splitwise. Built as a Spreetail internship assignment.

**Live App**: `[Add deployed Vercel URL here]`
**Backend API**: `[Add Render/Railway URL here]`

---

## AI Tools Used

- **Claude (Anthropic)** — Primary AI collaborator used for:
  - Structured product discovery interview
  - Generating `AI_CONTEXT.md` (source of truth)
  - Generating `BUILD_PLAN.md`, `PRD_SUMMARY.md`
  - Code generation for backend services, React components, and database schema

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + React Router v6 + Tailwind CSS |
| Backend | Node.js 20 + Express |
| Primary DB | MySQL 8 (PlanetScale or Railway) via Prisma ORM |
| Cache | Redis 7 (Upstash) |
| Real-time | Socket.io v4 |
| Blob Storage | Azure Blob Storage |
| Auth | JWT (httpOnly cookie) + Google OAuth2 (Passport.js) |

---

## Local Setup

### Prerequisites
- Node.js 20+
- MySQL 8 running locally (or a PlanetScale connection string)
- Redis running locally (or an Upstash URL)
- Azure Storage Account (optional — set `ENABLE_UPLOADS=false` to skip)
- Google OAuth2 credentials (Client ID + Secret from Google Cloud Console)

### 1. Clone the repo
```bash
git clone https://github.com/your-username/splitwise-clone.git
cd splitwise-clone
```

### 2. Set up the backend
```bash
cd server
npm install
cp .env.example .env
# Fill in .env values (see Environment Variables section below)
npx prisma migrate dev --name init
npm run dev
```

### 3. Set up the frontend
```bash
cd client
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000/api/v1
# Set VITE_SOCKET_URL=http://localhost:5000
npm run dev
```

App runs at `http://localhost:5173`. Backend at `http://localhost:5000`.

---

## Environment Variables

### Backend (`server/.env`)
```
DATABASE_URL=mysql://root:password@localhost:3306/splitwise
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback
AZURE_STORAGE_CONNECTION_STRING=your_azure_connection_string
AZURE_CONTAINER_NAME=splitwise-uploads
ENABLE_UPLOADS=true
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
PORT=5000
```

### Frontend (`client/.env`)
```
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

## Deployment

### Frontend → Vercel
1. Connect GitHub repo to Vercel
2. Set root directory to `client`
3. Add env vars: `VITE_API_URL`, `VITE_SOCKET_URL`
4. Deploy

### Backend → Render
1. Create new Web Service
2. Set root directory to `server`
3. Build command: `npm install && npx prisma generate`
4. Start command: `node index.js`
5. Add all env vars from `server/.env`

### Database → PlanetScale
1. Create database on PlanetScale
2. Get connection string → set as `DATABASE_URL`
3. Run `npx prisma migrate deploy` from server directory

### Redis → Upstash
1. Create Redis database on Upstash
2. Copy REST URL → set as `REDIS_URL`

---

## Key Files

| File | Purpose |
|---|---|
| `AI_CONTEXT.md` | Complete working context — source of truth for the entire app |
| `BUILD_PLAN.md` | Day-by-day execution plan with MoSCoW prioritization |
| `PRD_SUMMARY.md` | Product Requirements Document with user stories and success metrics |
| `server/prisma/schema.prisma` | Database schema |
| `server/src/services/balanceService.js` | Debt simplification algorithm |
| `server/src/services/splitService.js` | All 4 split method calculators |
| `server/src/socket/socketHandler.js` | All Socket.io event handlers |

---

## Features

- ✅ Email + password registration and login
- ✅ Google OAuth2 sign-in
- ✅ JWT stored in secure httpOnly cookies
- ✅ Create groups, invite by email or search existing users
- ✅ Add/remove members (admin only)
- ✅ Create expenses with 4 split methods: equal, unequal, percentage, shares
- ✅ Custom notes per participant split
- ✅ Simplified debt view (minimize transactions algorithm)
- ✅ Group balance summary + individual balance summary
- ✅ Two-party settlement confirmation flow
- ✅ Real-time group chat (Socket.io)
- ✅ Real-time expense comments (Socket.io)
- ✅ In-app notifications
- ✅ Image upload for expenses and settlement proof (Azure Blob)

---

## Running Tests
```bash
cd server
npm test
```

Tests cover: balance simplification algorithm, all 4 split calculators, auth middleware, settlement state transitions.

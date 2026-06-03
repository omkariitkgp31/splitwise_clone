# BUILD_PLAN.md
> Splitwise Clone — 2-Day Execution Plan
> Based entirely on agreed context in AI_CONTEXT.md

---

## Product Research Summary

### How Splitwise was studied
- Analyzed the assignment specification (JSON) which enumerates core features
- Studied Splitwise's public UX patterns via documentation and product descriptions
- Identified the core value loop: Add expense → split → track balance → settle

### Key Learnings
1. **Balance simplification is the killer feature** — not just tracking splits, but minimizing how many payments actually need to happen
2. **Groups are the unit of trust** — all expenses, balances, and chats are scoped to a group
3. **Settlement is a two-party act** — one person can't unilaterally say "I paid you"
4. **Real-time matters for chat** — expense comments are how disputes get resolved

### Core Workflows Identified
1. Register → Create group → Invite members
2. Add expense → Choose split method → View updated balances
3. Initiate settlement → Counterparty confirms → Balances update
4. Chat in group or on a specific expense in real time

### Product Assumptions Made
- All users share a single currency (no FX)
- One admin per group (creator)
- Expenses can be soft-deleted but not edited after settlement is confirmed against them
- Invite tokens expire in 24 hours

---

## Architecture

### Tech Stack
See `AI_CONTEXT.md` § 6 (Tech Stack)

### Database Schema
See `AI_CONTEXT.md` § 7 (Database Schema) — 10 MySQL tables + 3 Redis key patterns

### API Design
See `AI_CONTEXT.md` § 8 (API Design) — ~35 REST endpoints + 8 Socket.io events each direction

### Frontend Structure
See `AI_CONTEXT.md` § 9 — 7 pages, 25+ components, 3 contexts

### Deployment Approach
- Frontend → Vercel (auto-deploy from GitHub `main`)
- Backend → Render Web Service (Node 20, `node index.js`)
- DB → PlanetScale (serverless MySQL) or Railway MySQL
- Redis → Upstash (serverless, free tier)
- Blobs → Azure Blob Storage

---

## Day-by-Day Build Plan

---

### DAY 1 — Foundation + Core Backend

#### Morning (0–3h): Project Scaffolding
- [ ] Init GitHub repo with monorepo structure: `/client`, `/server`
- [ ] `server/`: `npm init`, install Express, Prisma, Socket.io, Passport, JWT, Redis (ioredis), Multer, Azure SDK, Nodemailer
- [ ] `client/`: `npm create vite@latest` (React), install React Router, Axios, Tailwind, socket.io-client
- [ ] Set up Prisma schema (mirrors SQL in AI_CONTEXT.md)
- [ ] Run `prisma migrate dev` against local MySQL
- [ ] Create `.env` files from templates
- [ ] Write `README.md` with setup instructions

#### Late Morning (3–5h): Auth Backend
- [ ] `POST /auth/register` — hash password (bcrypt), create user, issue JWT + refresh token, set httpOnly cookie
- [ ] `POST /auth/login` — verify credentials, issue tokens
- [ ] `POST /auth/logout` — clear cookie, delete refresh token
- [ ] `GET /auth/google` + `GET /auth/google/callback` — Passport Google OAuth2 strategy
- [ ] `GET /auth/me` — verify JWT middleware, return user
- [ ] Auth middleware (`middleware/auth.js`) — verify httpOnly cookie JWT on protected routes

#### Afternoon (5–8h): Groups Backend
- [ ] `POST /groups` — create group, assign creator as admin, add to `group_members`
- [ ] `GET /groups` — list groups for current user
- [ ] `GET /groups/:id` — group detail + members
- [ ] `POST /groups/:id/members` — add existing user (search result)
- [ ] `DELETE /groups/:id/members/:userId` — remove member (admin only)
- [ ] `POST /groups/:id/invite` — create `group_invites` record, send invite email via Nodemailer
- [ ] `GET /invite/:token` + `POST /invite/:token/accept` — validate token, auto-join group on accept

#### Evening (8–10h): Expense Backend
- [ ] `POST /groups/:id/expenses` — create expense + splits (all 4 methods), image upload to Azure Blob, invalidate Redis balance cache
- [ ] `GET /groups/:id/expenses` — list expenses (paginated, 20/page)
- [ ] `GET /expenses/:id` — expense detail + splits + payer info
- [ ] `DELETE /expenses/:id` — soft delete (`is_deleted = true`)
- [ ] `services/splitService.js` — implement all 4 split calculators with validation + rounding logic

---

### DAY 1 — Foundation + Core Frontend (parallel or after backend)

#### Evening (8–11h): Auth + Layout Frontend
- [ ] `App.jsx` — set up React Router, wrap with AuthContext + SocketContext
- [ ] `ProtectedRoute.jsx` — redirect to /login if not authed
- [ ] `LoginPage.jsx` — email/password form + "Sign in with Google" button
- [ ] `RegisterPage.jsx` — name/email/password form
- [ ] `Navbar.jsx` — logo, group list link, notification bell, avatar/logout
- [ ] Connect `AuthContext` — `GET /auth/me` on app load, expose user + logout

---

### DAY 2 — Balance, Settlement, Chat, Frontend Completion, Deploy

#### Morning (0–3h): Balances + Settlements Backend
- [ ] `services/balanceService.js`:
  - Compute net balance per user from `expense_splits` and confirmed `settlements`
  - Greedy min-transactions debt simplification algorithm
  - Cache result in Redis with TTL; invalidate on expense or settlement change
- [ ] `GET /groups/:id/balances` — return simplified debt list (from Redis cache or recompute)
- [ ] `GET /groups/:id/balances/me` — current user's net position
- [ ] `POST /groups/:id/settlements` — create settlement (`pending_confirmation`), emit Socket.io event to payee
- [ ] `PATCH /settlements/:id/confirm` — payee confirms, update status, invalidate balance cache, notify payer
- [ ] `PATCH /settlements/:id/reject` — payee rejects, notify payer

#### Late Morning (3–5h): Socket.io + Chat Backend
- [ ] `socket/socketHandler.js` — authenticate socket via cookie JWT, set up rooms
- [ ] Handle `join:group`, `leave:group`, `join:expense`, `leave:expense`
- [ ] Handle `send:group-message` → save to `group_messages` → broadcast `new:group-message`
- [ ] Handle `send:expense-comment` → save to `expense_comments` → broadcast `new:expense-comment`
- [ ] On expense creation → emit `expense:created` + `balance:updated` to group room
- [ ] On settlement confirm/reject → emit targeted events + `balance:updated`
- [ ] `GET /groups/:id/messages` — last 50 messages for group chat history
- [ ] `GET /expenses/:id/comments` — all comments for expense

#### Afternoon (5–9h): Frontend — Groups, Expenses, Balances, Settlements
- [ ] `DashboardPage.jsx` — list all groups, total you owe / are owed across all groups
- [ ] `GroupPage.jsx` — tabs: Expenses | Balances | Chat
  - Expenses tab: `ExpenseList` + "Add Expense" button
  - Balances tab: `SimplifiedDebtList` + "Settle Up" button per debt
  - Chat tab: `GroupChat` with real-time Socket.io
- [ ] `CreateExpenseModal.jsx` — description, amount, date, paid by, category, image upload, `SplitMethodSelector`
- [ ] `SplitMethodSelector.jsx` — 4-tab selector; validates input before allowing submit
- [ ] `ExpenseDetailPage.jsx` — splits table, payer, `ExpenseComments` (real-time)
- [ ] `BalanceSummary.jsx` + `SimplifiedDebtList.jsx` — show who owes whom
- [ ] `SettleUpModal.jsx` — pre-filled amount, note, proof image, submit
- [ ] `SettlementList.jsx` — pending confirmations with Confirm/Reject buttons

#### Late Afternoon (9–11h): Notifications + Polish + Deploy
- [ ] `NotificationBell.jsx` — badge count, dropdown list, mark as read
- [ ] Connect `SocketContext` — on `notification:new`, update context state
- [ ] `InviteAcceptPage.jsx` — validate token, show group name, register/login prompt
- [ ] `ProfilePage.jsx` — update name, avatar upload
- [ ] Error boundaries + loading states on all pages
- [ ] Tailwind polish pass — spacing, mobile responsiveness, consistent color palette
- [ ] **Deploy**:
  - Push to GitHub
  - Connect Vercel to `/client` folder
  - Create Render Web Service for `/server`
  - Set all env vars in dashboards
  - Run `prisma migrate deploy` against PlanetScale
  - Smoke test all critical flows on deployed URL
- [ ] Update `README.md` with deployed URL
- [ ] Final pass on `AI_CONTEXT.md` — add any changes made during implementation

---

## MoSCoW Prioritization

### Must Have (MVP — launch-blocking)
| Feature | RICE Score |
|---|---|
| Email + Google Auth | (500 × 3 × 0.95) / 3 = **475** |
| Group create + invite | (500 × 3 × 0.9) / 4 = **337** |
| Create expense (all 4 splits) | (500 × 3 × 0.9) / 5 = **270** |
| Simplified balance display | (500 × 3 × 0.9) / 3 = **450** |
| Settlement (2-party confirm) | (500 × 3 × 0.85) / 4 = **318** |
| Real-time group + expense chat | (500 × 2 × 0.8) / 5 = **160** |

### Should Have (Important, not launch-blocking)
- In-app notifications (settlement request, expense added)
- Image upload on expenses
- Invite email for non-existing users
- Profile page (name/avatar update)

### Could Have (Nice-to-have if time allows)
- Expense categories + filtering
- Pagination controls in UI
- Settlement proof image upload
- Group avatar upload

### Won't Have (V1 — explicitly out of scope)
- Mobile app
- Payment gateway (Venmo/UPI)
- Multi-currency
- Recurring expenses
- Email notifications beyond invites
- Activity feed / audit log
- Friends outside groups

---

## AI Collaboration Process

### How AI was instructed
AI was given the role of "Senior PM + discovery partner" via a structured system prompt. Before any implementation, it conducted a structured discovery interview covering: goals, tech stack, auth, groups, expenses, balances, settlements, chat, routing, real-time, and deployment.

### Questions asked by AI
22 structured questions across 4 phases (see `AI_CONTEXT.md` § 15 for full log)

### Evolution of the plan
1. Started with assignment spec (JSON)
2. Discovery interview filled in all gaps
3. `AI_CONTEXT.md` produced as source of truth
4. `BUILD_PLAN.md` derived from `AI_CONTEXT.md`
5. Implementation follows build plan; `AI_CONTEXT.md` updated on any deviation

### Maintenance of AI_CONTEXT.md
Updated after every discovery session and after any implementation decision that deviates from the plan. Sections updated: schema changes, new trade-offs, known limitations, prompts log.

---

## Known Trade-offs

| Simplification | Reason | Impact |
|---|---|---|
| No email for every notification | Saves SMTP quota + complexity | Users must check in-app |
| Single currency | Scope control | No international groups |
| No expense edit after creation | Prevents balance inconsistency | Must delete + recreate |
| Redis cache (not event sourcing) | Simpler | No balance history |
| Last 50 messages only in chat | Performance | Long-running groups lose history |
| No horizontal scaling of Socket.io | Single instance for MVP | Fine for demo/eval purposes |

---

*Generated from AI_CONTEXT.md after full discovery session. Do not modify this file without updating AI_CONTEXT.md first.*

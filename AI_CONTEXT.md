# AI_CONTEXT.md
> **Source of Truth for the Splitwise Clone Project**
> Maintained continuously. Any evaluator should be able to paste this file into an AI tool and recreate a near-identical application.

---

## 1. Product Understanding

### What is Splitwise?
Splitwise is a bill-splitting and expense-sharing web/mobile app. It allows groups of people (friends, roommates, travel companions) to:
- Log shared expenses
- Track who paid and who owes what
- Simplify debts (minimize number of transactions to settle all balances)
- Settle up with recorded payments

### What we are building
A simplified but fully functional Splitwise-inspired web application with:
- Authentication (Email/Password + Google OAuth)
- Group management with admin/member roles
- Expense creation with 4 split methods
- Debt simplification algorithm (minimize transactions)
- Two-party settlement confirmation flow
- Real-time chat per expense AND per group (Socket.io)
- Balance summaries (group + individual)
- Image upload support (Azure Blob Storage)
- Deployed publicly with full documentation

---

## 2. Product Scope

### In Scope (MVP)
| Feature | Detail |
|---|---|
| Auth | Email+password registration/login, Google OAuth, JWT in httpOnly cookie |
| Groups | Create, invite (email or search), add/remove members, admin role |
| Expenses | Create with 4 split methods, custom notes per split, attach image |
| Balances | Simplified debt view (minimize transactions), group + individual summary |
| Settlements | Record payment, requires confirmation from both parties |
| Chat | Real-time comments per expense + real-time group chat (Socket.io) |
| Notifications | In-app: settlement requests, expense added, group invite |

### Out of Scope (V1)
- Mobile app (web only)
- Payment gateway integration (Venmo, UPI, etc.)
- Activity feed / audit log
- Currency conversion / multi-currency
- Recurring expenses
- Email notifications (invites use email, but no transactional email system)
- Friends list outside of groups
- Public groups

---

## 3. User Personas

**Primary User — "The Organizer"**
- Creates and manages groups (trips, households, events)
- Adds most expenses, wants quick split entry
- Needs to see who owes what at a glance

**Secondary User — "The Participant"**
- Added to a group by someone else
- Views their personal balance, settles debts
- May comment on expenses to dispute or clarify

---

## 4. Core Workflows

### 4.1 Registration & Login
1. User visits `/register` → enters name, email, password → account created
2. OR clicks "Sign in with Google" → OAuth flow → account created/linked
3. On success → JWT issued → stored in `httpOnly` cookie → redirect to `/dashboard`
4. Protected routes: any route except `/login`, `/register`, `/invite/:token` requires valid JWT

### 4.2 Group Creation & Invite Flow
1. User clicks "New Group" → enters group name, optional description, optional avatar image
2. On group creation → creator is assigned `admin` role
3. Admin adds members:
   - **Search existing users**: type name or email → live search → select → added immediately
   - **Invite by email (non-existing user)**: enter email → invite record created → invite email sent with link `/invite/:token` → on registration, user auto-joins group
4. Admin can remove any member (except self if other admins exist)
5. Admin cannot be demoted; only the group creator is admin (no co-admin in MVP)

### 4.3 Expense Creation
1. Inside a group → click "Add Expense"
2. Fill in: description, total amount, date, paid by (dropdown of group members), category (optional), image (optional → Azure Blob)
3. Choose split method:
   - **Equal**: amount / number of members (rounded to 2 decimal places; remainder goes to payer)
   - **Unequal**: manually enter exact amount per member (must sum to total)
   - **Percentage**: enter % per member (must sum to 100%)
   - **Shares**: enter share count per member (e.g. 2:1:1); system calculates proportional amounts
4. Optional: add a custom note per participant split
5. On save → expense written to MySQL → balance cache in Redis invalidated for this group → Socket.io event emitted to group room

### 4.4 Balance Calculation (Debt Simplification)
- Raw balances computed per pair from all unsettled expenses
- Simplification algorithm: net each person's total owed/owes, then greedily match largest creditor with largest debtor (standard min-transactions algorithm)
- Result: minimum set of directed payments to settle the group
- Stored in Redis (`group:{groupId}:balances`) with TTL; invalidated on any expense add/edit/delete or settlement

### 4.5 Settlement Flow
1. User A sees they owe User B → clicks "Settle Up"
2. Enters amount (pre-filled with simplified balance), optional note, optional proof image
3. Settlement created with status `PENDING_CONFIRMATION`
4. User B gets in-app notification → reviews → clicks "Confirm" or "Reject"
5. On confirm → settlement status → `CONFIRMED` → balance recalculated → Redis cache invalidated
6. On reject → status → `REJECTED` → User A notified

### 4.6 Real-Time Chat
- **Expense chat**: each expense has a comments thread; messages stored in MySQL `expense_comments` table; Socket.io room = `expense:{expenseId}`
- **Group chat**: each group has a persistent chat; messages stored in MySQL `group_messages` table; Socket.io room = `group:{groupId}:chat`
- On joining a group page → client joins Socket.io room
- On joining an expense detail page → client joins expense room
- Messages delivered in real-time; history loaded via REST API on mount

---

## 5. Implementation Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth tokens | JWT in httpOnly cookie | XSS-safe; no JS access to token |
| Session refresh | Refresh token stored in DB, access token 15min TTL | Security best practice |
| Balance store | Redis key-value | Fast reads; balances are derived data, not source of truth |
| Image storage | Azure Blob Storage | Blob data separate from relational data; CDN-ready |
| Real-time | Socket.io over WebSockets | Handles reconnection, rooms, namespaces out of the box |
| Debt algorithm | Greedy min-transaction (net balances) | O(n log n), correct, industry standard |
| Split rounding | Remainder to payer | Avoids 1-cent discrepancies |
| Settlement confirmation | Both parties confirm | Prevents unilateral manipulation of balances |

---

## 6. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18.x |
| Routing | React Router | v6 |
| State Management | React Context + useReducer (no Redux) | — |
| Styling | Tailwind CSS | v3 |
| HTTP Client | Axios | — |
| Real-time (client) | socket.io-client | v4 |
| Backend | Node.js + Express | 20.x LTS |
| Auth | Passport.js (local + Google OAuth2) | — |
| JWT | jsonwebtoken + cookie-parser | — |
| ORM | Prisma | v5 |
| Primary DB | MySQL | 8.x |
| Cache | Redis | 7.x |
| Real-time (server) | Socket.io | v4 |
| File Upload | Multer + @azure/storage-blob | — |
| Email (invites) | Nodemailer (SMTP or SendGrid) | — |
| Deployment (FE) | Vercel | — |
| Deployment (BE) | Render or Railway | — |
| Deployment (DB) | PlanetScale (MySQL) or Railway MySQL | — |
| Deployment (Redis) | Upstash Redis (free tier) | — |
| Deployment (Blobs) | Azure Blob Storage | — |

---

## 7. Database Schema

### Tables

```sql
-- Users
CREATE TABLE users (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255),               -- NULL for OAuth users
  google_id   VARCHAR(255) UNIQUE,
  avatar_url  TEXT,
  created_at  DATETIME DEFAULT NOW(),
  updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(512) UNIQUE NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME DEFAULT NOW()
);

-- Groups
CREATE TABLE `groups` (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  avatar_url  TEXT,
  created_by  VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at  DATETIME DEFAULT NOW(),
  updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- Group Members
CREATE TABLE group_members (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  group_id    VARCHAR(36) NOT NULL REFERENCES `groups`(id) ON DELETE CASCADE,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        ENUM('admin','member') DEFAULT 'member',
  joined_at   DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_group_user (group_id, user_id)
);

-- Group Invites
CREATE TABLE group_invites (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  group_id    VARCHAR(36) NOT NULL REFERENCES `groups`(id) ON DELETE CASCADE,
  invited_by  VARCHAR(36) NOT NULL REFERENCES users(id),
  email       VARCHAR(255) NOT NULL,
  token       VARCHAR(255) UNIQUE NOT NULL,
  status      ENUM('pending','accepted','expired') DEFAULT 'pending',
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  group_id     VARCHAR(36) NOT NULL REFERENCES `groups`(id) ON DELETE CASCADE,
  description  VARCHAR(255) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_by      VARCHAR(36) NOT NULL REFERENCES users(id),
  split_method ENUM('equal','unequal','percentage','shares') NOT NULL,
  category     VARCHAR(50),
  image_url    TEXT,
  expense_date DATE NOT NULL,
  is_deleted   BOOLEAN DEFAULT FALSE,
  created_by   VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at   DATETIME DEFAULT NOW(),
  updated_at   DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- Expense Splits (one row per participant per expense)
CREATE TABLE expense_splits (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  expense_id   VARCHAR(36) NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id      VARCHAR(36) NOT NULL REFERENCES users(id),
  owed_amount  DECIMAL(12,2) NOT NULL,
  share_value  DECIMAL(12,4),             -- used for 'shares' split type
  percentage   DECIMAL(5,2),             -- used for 'percentage' split type
  custom_note  TEXT,
  UNIQUE KEY uq_expense_user (expense_id, user_id)
);

-- Settlements
CREATE TABLE settlements (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  group_id       VARCHAR(36) NOT NULL REFERENCES `groups`(id),
  payer_id       VARCHAR(36) NOT NULL REFERENCES users(id),
  payee_id       VARCHAR(36) NOT NULL REFERENCES users(id),
  amount         DECIMAL(12,2) NOT NULL,
  note           TEXT,
  proof_url      TEXT,
  status         ENUM('pending_confirmation','confirmed','rejected') DEFAULT 'pending_confirmation',
  initiated_at   DATETIME DEFAULT NOW(),
  confirmed_at   DATETIME,
  updated_at     DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- Expense Comments (expense-level chat)
CREATE TABLE expense_comments (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  expense_id  VARCHAR(36) NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id),
  message     TEXT NOT NULL,
  created_at  DATETIME DEFAULT NOW()
);

-- Group Messages (group-level chat)
CREATE TABLE group_messages (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  group_id    VARCHAR(36) NOT NULL REFERENCES `groups`(id) ON DELETE CASCADE,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id),
  message     TEXT NOT NULL,
  created_at  DATETIME DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        ENUM('expense_added','settlement_request','settlement_confirmed','settlement_rejected','group_invite') NOT NULL,
  payload     JSON,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  DATETIME DEFAULT NOW()
);
```

### Redis Keys

| Key Pattern | Value | TTL |
|---|---|---|
| `group:{groupId}:balances` | JSON: simplified debt list | 1 hour (invalidated on write) |
| `group:{groupId}:members` | JSON: member list | 30 min |
| `user:{userId}:groups` | JSON: group summary list | 30 min |

---

## 8. API Design

### Base URL
`/api/v1`

### Auth Routes
```
POST   /auth/register          Register with email+password
POST   /auth/login             Login → set httpOnly JWT cookie
POST   /auth/logout            Clear cookie
GET    /auth/google            Redirect to Google OAuth
GET    /auth/google/callback   OAuth callback → set cookie → redirect
GET    /auth/me                Get current user from cookie
POST   /auth/refresh           Refresh access token using refresh token
```

### User Routes
```
GET    /users/search?q=        Search users by name or email
GET    /users/:id/profile      Get user profile
PATCH  /users/me               Update own name/avatar
```

### Group Routes
```
GET    /groups                 List groups for current user
POST   /groups                 Create group
GET    /groups/:id             Get group detail (members, recent expenses)
PATCH  /groups/:id             Update group name/description (admin only)
DELETE /groups/:id             Delete group (admin only)
POST   /groups/:id/members     Add member (search result)
DELETE /groups/:id/members/:userId  Remove member (admin only)
POST   /groups/:id/invite      Invite by email → create invite record + send email
GET    /invite/:token          Validate invite token (public route)
POST   /invite/:token/accept   Accept invite (auto-joins group after registration)
```

### Expense Routes
```
GET    /groups/:id/expenses    List expenses in group (paginated)
POST   /groups/:id/expenses    Create expense
GET    /expenses/:id           Get expense detail + splits
PATCH  /expenses/:id           Edit expense (creator or admin)
DELETE /expenses/:id           Soft delete expense (creator or admin)
```

### Balance Routes
```
GET    /groups/:id/balances    Get simplified debt list for group
GET    /groups/:id/balances/me Get current user's balance summary in group
```

### Settlement Routes
```
GET    /groups/:id/settlements          List settlements in group
POST   /groups/:id/settlements          Initiate settlement
PATCH  /settlements/:id/confirm         Confirm settlement (payee only)
PATCH  /settlements/:id/reject          Reject settlement (payee only)
```

### Chat Routes
```
GET    /expenses/:id/comments           Get expense comment history
GET    /groups/:id/messages             Get group chat history (paginated)
```
> Messages are sent via Socket.io events, not REST POST. History is loaded via REST on mount.

### Notification Routes
```
GET    /notifications                   Get all notifications for user
PATCH  /notifications/:id/read          Mark as read
PATCH  /notifications/read-all          Mark all as read
```

### Socket.io Events

**Client → Server**
| Event | Payload | Description |
|---|---|---|
| `join:group` | `{ groupId }` | Join group chat room |
| `leave:group` | `{ groupId }` | Leave group chat room |
| `join:expense` | `{ expenseId }` | Join expense comment room |
| `leave:expense` | `{ expenseId }` | Leave expense room |
| `send:group-message` | `{ groupId, message }` | Send group chat message |
| `send:expense-comment` | `{ expenseId, message }` | Send expense comment |

**Server → Client**
| Event | Payload | Description |
|---|---|---|
| `new:group-message` | `{ message, user, timestamp }` | Broadcast to group room |
| `new:expense-comment` | `{ comment, user, timestamp }` | Broadcast to expense room |
| `expense:created` | `{ expense }` | Notify group members of new expense |
| `balance:updated` | `{ groupId }` | Tell clients to refetch balances |
| `settlement:requested` | `{ settlement }` | Notify payee |
| `settlement:confirmed` | `{ settlement }` | Notify payer |
| `settlement:rejected` | `{ settlement }` | Notify payer |
| `notification:new` | `{ notification }` | Push in-app notification |

---

## 9. Frontend Structure

```
src/
├── api/                     # Axios instances + API call functions
│   ├── axios.js             # Base axios config (withCredentials: true)
│   ├── auth.js
│   ├── groups.js
│   ├── expenses.js
│   ├── balances.js
│   ├── settlements.js
│   ├── chat.js
│   └── notifications.js
├── components/
│   ├── auth/
│   │   ├── LoginForm.jsx
│   │   └── RegisterForm.jsx
│   ├── groups/
│   │   ├── GroupCard.jsx
│   │   ├── GroupList.jsx
│   │   ├── CreateGroupModal.jsx
│   │   ├── InviteMemberModal.jsx
│   │   └── MemberList.jsx
│   ├── expenses/
│   │   ├── ExpenseCard.jsx
│   │   ├── ExpenseList.jsx
│   │   ├── CreateExpenseModal.jsx
│   │   ├── SplitMethodSelector.jsx
│   │   └── ExpenseDetail.jsx
│   ├── balances/
│   │   ├── BalanceSummary.jsx
│   │   └── SimplifiedDebtList.jsx
│   ├── settlements/
│   │   ├── SettleUpModal.jsx
│   │   └── SettlementList.jsx
│   ├── chat/
│   │   ├── GroupChat.jsx
│   │   └── ExpenseComments.jsx
│   ├── notifications/
│   │   └── NotificationBell.jsx
│   └── shared/
│       ├── Navbar.jsx
│       ├── ProtectedRoute.jsx
│       ├── Avatar.jsx
│       ├── Modal.jsx
│       └── Spinner.jsx
├── context/
│   ├── AuthContext.jsx       # Current user, login/logout
│   ├── SocketContext.jsx     # Socket.io connection
│   └── NotificationContext.jsx
├── hooks/
│   ├── useAuth.js
│   ├── useSocket.js
│   └── useBalances.js
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx     # All groups overview + total balance
│   ├── GroupPage.jsx         # Group detail: expenses + chat + balances
│   ├── ExpenseDetailPage.jsx # Expense splits + comments
│   ├── SettlementsPage.jsx
│   ├── InviteAcceptPage.jsx  # /invite/:token
│   └── ProfilePage.jsx
├── utils/
│   ├── splitCalculators.js   # Equal, unequal, percentage, shares logic
│   └── debtSimplifier.js     # Client-side balance display helper
├── App.jsx                   # Router + context providers
└── main.jsx
```

### Route Map
```
/                    → redirect to /dashboard if authed, else /login
/login               → LoginPage (public)
/register            → RegisterPage (public)
/invite/:token       → InviteAcceptPage (public)
/dashboard           → DashboardPage (protected)
/groups/:id          → GroupPage (protected)
/groups/:id/expenses/:expId → ExpenseDetailPage (protected)
/groups/:id/settlements     → SettlementsPage (protected)
/profile             → ProfilePage (protected)
```

---

## 10. Backend Structure

```
server/
├── prisma/
│   └── schema.prisma         # Prisma schema (mirrors SQL above)
├── src/
│   ├── config/
│   │   ├── db.js             # Prisma client
│   │   ├── redis.js          # ioredis client
│   │   └── passport.js       # Passport strategies
│   ├── middleware/
│   │   ├── auth.js           # JWT verification from cookie
│   │   ├── groupMember.js    # Verify user is in group
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── group.routes.js
│   │   ├── expense.routes.js
│   │   ├── balance.routes.js
│   │   ├── settlement.routes.js
│   │   ├── chat.routes.js
│   │   └── notification.routes.js
│   ├── controllers/          # One file per domain, maps to routes
│   ├── services/
│   │   ├── balanceService.js # Debt simplification algorithm
│   │   ├── splitService.js   # Split method calculations
│   │   ├── emailService.js   # Nodemailer invite emails
│   │   └── blobService.js    # Azure Blob upload
│   ├── socket/
│   │   └── socketHandler.js  # All Socket.io event handlers
│   └── app.js                # Express app + socket.io setup
└── index.js                  # Entry point
```

---

## 11. Deployment Plan

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploy from `main` branch; env: `VITE_API_URL` |
| Backend | Render (Web Service) | Node 20, start: `node index.js`; env vars in dashboard |
| MySQL | PlanetScale or Railway MySQL | Connection string in `DATABASE_URL` |
| Redis | Upstash Redis | Free tier; `REDIS_URL` env var |
| Azure Blob | Azure Storage Account | Container: `splitwise-uploads`; public read |

### Environment Variables

**Backend (.env)**
```
DATABASE_URL=mysql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-backend.render.com/api/v1/auth/google/callback
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_CONTAINER_NAME=splitwise-uploads
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

**Frontend (.env)**
```
VITE_API_URL=https://your-backend.render.com/api/v1
VITE_SOCKET_URL=https://your-backend.render.com
```

---

## 12. Testing Plan

| Type | Tool | Coverage Target |
|---|---|---|
| Unit (services) | Jest | Balance algorithm, split calculators |
| Integration (API) | Supertest + Jest | Auth, expense CRUD, settlement flow |
| Manual (UI) | Browser | All 4 split methods, settlement confirm/reject, chat |
| E2E (optional V2) | Playwright | Full user journey |

Key test cases:
- Equal split with odd-cent remainder → goes to payer
- Percentage split not summing to 100% → validation error
- Settlement confirmed → balance recalculated
- Socket.io message delivery to correct room only
- Invite token expiry (24h) → 410 response

---

## 13. Trade-offs & Simplifications

| Decision | Simplification | What's lost |
|---|---|---|
| No email notifications for every event | Only invite emails sent | Users must check in-app notifications |
| No audit log / activity feed | Expenses have created_at only | No change history visible |
| No multi-currency | All amounts assumed same currency | International groups not supported |
| Redis balance cache, not event sourcing | Simpler but requires cache invalidation logic | No balance history over time |
| No admin demotion | Creator is permanent admin | Inflexible for long-lived groups |
| Soft delete only for expenses | `is_deleted` flag, not physical delete | DB grows over time |
| No pagination on group chat (initial) | Load last 50 messages | Poor UX for very active groups |

---

## 14. Known Limitations

- Azure Blob Storage requires an Azure account; if unavailable, image upload can be disabled via `ENABLE_UPLOADS=false` env flag
- Google OAuth requires verified domain in production; local testing uses `http://localhost:3000` callback
- PlanetScale free tier has connection limits; app uses Prisma connection pooling
- Socket.io requires sticky sessions if scaling horizontally (not a concern for MVP single-instance deploy)
- Invite emails may land in spam without SPF/DKIM configuration

---

## 15. Prompts & AI Responses Log

### Session 1 — Discovery Interview

**Q: Primary goal?**
A: Balance all three — quality, speed, and documentation

**Q: Tech stack?**
A: React + Node.js/Express + MySQL + Redis + Azure Blob

**Q: Auth methods?**
A: Email + password + Google OAuth

**Q: Session management?**
A: JWT in httpOnly cookie

**Q: User onboarding?**
A: Anyone can register with email

**Q: Group permissions?**
A: Creator is always admin

**Q: Invite/add members?**
A: Name + email search (existing users added directly; non-existing get invite email)

**Q: Split methods?**
A: All 4 (equal, unequal, percentage, shares) + custom notes per split

**Q: Balance display?**
A: Simplified debts (minimize transactions)

**Q: Who can settle?**
A: Both parties must confirm

**Q: Chat scope?**
A: Both expense-level comments AND group chat

**Q: Frontend routing?**
A: React Router v6 + protected route guards

**Q: Real-time transport?**
A: Socket.io (WebSockets)

**Q: Deployment?**
A: Vercel (FE) + Render/Railway (BE) + PlanetScale/Railway (DB)

---

*Last updated: Session 1 — Discovery Complete. Build plan generated.*

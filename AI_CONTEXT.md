# AI Context — Splitwise Clone Implementation Detail

This document logs the design implementation details, database adjustments, and architectural decisions made throughout the project lifecycles.

## 🗂️ Modules & Structural Overview

### 1. Database Schema (`server/prisma/schema.prisma`)
- Modified the `SplitMethod` enum to align exactly with the C++ business logic values:
  ```prisma
  enum SplitMethod {
    EQUAL
    EXACT
    PERCENT
  }
  ```
- Executed `npx prisma db push --accept-data-loss` to synchronize MySQL tables safely on the development environment without interactive terminal prompts.

### 2. Business Logic & Calculations (`server/src/services/splitService.js`)
- Translation of C++ business classes (`Expense` and `SplitwiseSystem`):
  - **`splitEqual`**: Divides the total amount among all participants using double/float division.
  - **`splitExact`**: Validates that the sum of exact splits matches the `totalAmount` within a `0.01` tolerance.
  - **`splitPercent`**: Validates that percentages sum to exactly `100` (within `0.01` tolerance) and computes the exact shares.
  - **`calculateSplits`**: Acts as a dispatcher routing the calculation based on the selected method.

### 3. Cache Management (`server/src/services/balanceService.js`)
- **Redis Connection Awareness**: Implemented status-based logic (`redis.status === 'ready'`) for deleting `balances:${groupId}` in ioredis. This safeguards the server process from hanging indefinitely if the Redis server is offline or experiencing connectivity issues.

### 4. Controller & Routers (`server/src/controllers/expense.controller.js` & `server/src/routes/expense.routes.js`)
- **Secure Ordering**: Placed `/users/me/expenses` route registration before `/expenses/:id` to prevent Express route resolver conflicts (where `'me'` would otherwise be matching the `:id` parameter).
- **Multipart Uploads**: Configured memory-storage multer middleware for receipt images. Files are uploaded to Azure Blob storage (if `ENABLE_UPLOADS` is not explicitly `'false'`).
- **Real-Time Synchronizations**: Emits `expense:created` and `balance:updated` socket events to room-specific groups (`group:${groupId}`).

---

## 🚀 Deployed Environment Specifications
- **Hosting Environments**:
  - Backend: Render Web Service (Root: `/server`)
  - Frontend: Vercel Project (Root: `/client`)
- **Reverse Proxy Header Support**: Enabled `app.set('trust proxy', 1)` to correctly decode secure cross-site session cookies behind Render's load balancers.
- **Production Cookies**:
  - `secure: true`
  - `sameSite: 'none'`

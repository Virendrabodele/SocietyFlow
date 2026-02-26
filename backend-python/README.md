# SocietyFlow - Python/FastAPI Backend

Python rewrite of the original TypeScript/Express backend.  
The HTML frontend works with this backend unchanged — same API endpoints, same JSON responses.

## Stack

| TypeScript (original) | Python (this) |
|---|---|
| Express.js | FastAPI |
| Prisma ORM | SQLAlchemy (async) |
| Zod validation | Pydantic v2 |
| jsonwebtoken | python-jose |
| bcrypt | passlib[bcrypt] |
| BullMQ (Redis queues) | redis-py (extend as needed) |
| `npx prisma migrate` | `alembic upgrade head` |

## Project Structure

```
app/
├── main.py                  # FastAPI app, routes registration
├── core/
│   ├── config.py            # Settings (from .env)
│   ├── security.py          # JWT + password hashing
│   └── dependencies.py      # Auth middleware (get_current_user etc.)
├── db/
│   └── database.py          # Async SQLAlchemy engine + session
├── models/
│   └── models.py            # All SQLAlchemy models (mirrors Prisma schema)
├── schemas/
│   └── schemas.py           # Pydantic request/response schemas (replaces Zod)
├── services/
│   └── invoice_service.py   # Invoice generation logic
└── api/v1/routes/
    ├── auth.py              # POST /auth/register, /login, /refresh, /logout
    ├── societies.py         # CRUD /societies + access grants
    ├── members.py           # CRUD /societies/:id/members
    ├── billing.py           # Billing heads + line items
    ├── invoices.py          # Invoice generation + payments + receipts
    ├── bank_accounts.py     # Bank account + payment upload verification
    ├── reports.py           # Collection summary, aging, member ledger
    └── health.py            # /health/live + /health/ready

alembic/                     # Database migrations (replaces `prisma migrate`)
```

## Quick Start

### 1. Clone & Setup

```bash
cd societyflow-python-backend
cp .env.example .env
# Edit .env with your values
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run with Docker (recommended)

```bash
docker-compose up -d
# Run migrations
docker-compose exec api alembic upgrade head
```

### 4. Or run locally

```bash
# Start PostgreSQL and Redis first, then:
alembic upgrade head
uvicorn app.main:app --reload --port 3000
```

API available at: http://localhost:3000  
Swagger docs: http://localhost:3000/docs

## API Endpoints

All endpoints match the original TypeScript backend exactly.

### Auth
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Societies
```
POST   /api/v1/societies
GET    /api/v1/societies
GET    /api/v1/societies/:id
PUT    /api/v1/societies/:id
POST   /api/v1/societies/:id/access
```

### Members
```
POST   /api/v1/societies/:id/members
POST   /api/v1/societies/:id/members/bulk
GET    /api/v1/societies/:id/members
GET    /api/v1/societies/:id/members/:memberId
PUT    /api/v1/societies/:id/members/:memberId
DELETE /api/v1/societies/:id/members/:memberId
```

### Billing
```
POST /api/v1/societies/:id/billing-heads
GET  /api/v1/societies/:id/billing-heads
POST /api/v1/societies/:id/billing-line-items
GET  /api/v1/societies/:id/billing-line-items
```

### Invoices & Payments
```
POST /api/v1/societies/:id/invoices/generate
GET  /api/v1/societies/:id/invoices
GET  /api/v1/societies/:id/invoices/:invoiceId
POST /api/v1/societies/:id/invoices/:invoiceId/payments
POST /api/v1/societies/:id/invoices/:invoiceId/receipt
POST /api/v1/societies/:id/invoices/:invoiceId/payment-upload
```

### Bank Account & Payment Verification
```
POST   /api/v1/societies/:id/bank-account
GET    /api/v1/societies/:id/bank-account
PUT    /api/v1/societies/:id/bank-account
DELETE /api/v1/societies/:id/bank-account
GET    /api/v1/societies/:id/payment-uploads
POST   /api/v1/societies/:id/payment-uploads/:uploadId/verify
```

### Reports
```
GET /api/v1/societies/:id/reports/collection-summary
GET /api/v1/societies/:id/reports/aging
GET /api/v1/societies/:id/reports/member-ledger/:memberId
```

### Health
```
GET /health/live
GET /health/ready
```

## Database Migrations (Alembic = Prisma migrate)

```bash
# Create a migration after changing models.py
alembic revision --autogenerate -m "add new table"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

## Connecting the HTML Frontend

Your HTML frontend calls the same URLs — no changes needed.  
Just update the API base URL if you changed the port:

```javascript
// In your HTML files, find and update:
const API_BASE = "http://localhost:3000/api/v1";
```

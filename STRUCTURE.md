# Project Directory Structure

```
reachinbox-outbox/
│
├── backend/                          # Node.js + Express + BullMQ Backend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── prisma.ts            # Prisma client singleton
│   │   │   ├── queue.ts             # BullMQ queue configuration
│   │   │   ├── mailer.ts            # Nodemailer SMTP transport
│   │   │   └── rateLimiter.ts       # Redis-backed rate limiter (sliding window)
│   │   │
│   │   ├── routes/
│   │   │   ├── users.ts             # POST /api/users/sync - OAuth user sync
│   │   │   ├── senders.ts           # CRUD for sender accounts
│   │   │   ├── emailJobs.ts         # POST /api/email-jobs/schedule - Main scheduling endpoint
│   │   │   └── stats.ts             # GET /api/stats - Dashboard metrics
│   │   │
│   │   ├── index.ts                 # Express server entry point
│   │   └── worker.ts                # BullMQ worker (separate process)
│   │
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (Users, Senders, EmailJobs)
│   │   └── migrations/
│   │       └── 20260117000000_init/
│   │           └── migration.sql    # Initial migration SQL
│   │
│   ├── Dockerfile                   # Multi-stage Docker build for API
│   ├── Dockerfile.worker            # Multi-stage Docker build for worker
│   ├── package.json                 # Backend dependencies
│   ├── tsconfig.json                # TypeScript config
│   ├── .env.example                 # Environment template
│   ├── .gitignore
│   └── README.md                    # Backend-specific docs
│
├── frontend/                         # Next.js 14 (App Router) Frontend
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts     # NextAuth configuration (Google OAuth)
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx             # Main dashboard (protected route)
│   │   │
│   │   ├── layout.tsx               # Root layout with SessionProvider
│   │   ├── page.tsx                 # Landing page (Google sign-in)
│   │   └── globals.css              # Tailwind + CSS variables
│   │
│   ├── components/
│   │   ├── Composer.tsx             # CSV upload + scheduling form
│   │   ├── EmailTable.tsx           # Real-time table (scheduled/sent)
│   │   └── Providers.tsx            # NextAuth SessionProvider wrapper
│   │
│   ├── lib/
│   │   └── api.ts                   # Axios client for backend API
│   │
│   ├── types/
│   │   └── next-auth.d.ts           # NextAuth TypeScript definitions
│   │
│   ├── Dockerfile                   # Next.js standalone build
│   ├── package.json                 # Frontend dependencies
│   ├── tsconfig.json                # TypeScript config
│   ├── next.config.js               # Next.js config (standalone output)
│   ├── tailwind.config.js           # Tailwind CSS config
│   ├── postcss.config.js            # PostCSS config
│   ├── .env.example                 # Environment template
│   └── .gitignore
│
├── docker-compose.yml               # Full-stack orchestration
│   │   Services:
│   │   - postgres (PostgreSQL 15)
│   │   - redis (Redis 7 with AOF persistence)
│   │   - backend (Express API on port 3001)
│   │   - worker (BullMQ worker)
│   │   - frontend (Next.js on port 3000)
│
├── .env.example                     # Root environment template
├── .gitignore                       # Git ignore rules
├── README.md                        # Main documentation
└── SETUP.md                         # Step-by-step setup guide
```

## Key Files Explained

### Backend Core Files

#### `backend/src/lib/rateLimiter.ts`
- **Purpose**: Redis-backed hourly rate limiter
- **Algorithm**: Sliding window using Redis sorted sets
- **Key Methods**:
  - `checkLimit()` - Check if sender can send
  - `incrementCount()` - Record a send
  - `getNextAvailableTime()` - Calculate when limit resets
- **Special Feature**: Jobs are **rescheduled**, not failed, when limit is hit

#### `backend/src/worker.ts`
- **Purpose**: BullMQ worker that processes email jobs
- **Concurrency**: 5 parallel jobs
- **Features**:
  - 2-second mandatory delay between sends
  - Checks rate limit before sending
  - Moves job to delayed state if rate limit hit
  - Exponential backoff retry (5s → 25s → 125s)
  - Updates database status (PENDING → SENT/FAILED)

#### `backend/src/routes/emailJobs.ts`
- **POST /api/email-jobs/schedule**:
  1. Parses CSV data
  2. Creates EmailJob records in database
  3. Adds delayed jobs to BullMQ (using DB ID as job ID)
  4. Idempotent: Same DB ID = same BullMQ job

#### `backend/prisma/schema.prisma`
- **User**: OAuth users from Google
- **Sender**: Email accounts with hourly limits
- **EmailJob**: Individual scheduled emails with status tracking
- **Indexes**: Optimized for queries by senderId, status, scheduledAt

### Frontend Core Files

#### `frontend/components/Composer.tsx`
- **CSV Upload**: Drag-and-drop or click to upload
- **CSV Parsing**: Uses `papaparse` library
- **Validation**: Filters out rows without valid emails
- **Form Fields**:
  - Default subject/body (fallback if CSV columns missing)
  - Start time (datetime-local input)
  - Delay between emails
  - Hourly rate limit

#### `frontend/components/EmailTable.tsx`
- **Real-time Updates**: Polls API every 5 seconds
- **Two Modes**: Scheduled vs. Sent tabs
- **Actions**: Cancel scheduled emails
- **Status Icons**: Visual indicators for each status
- **Auto-refresh**: Triggered by `refreshTrigger` prop

#### `frontend/app/dashboard/page.tsx`
- **Auth Check**: Redirects to login if not authenticated
- **Sender Management**: Create/select sender accounts
- **Stats Cards**: Live metrics (scheduled, sent, failed, 24h activity)
- **Tab Navigation**: Switch between Scheduled and Sent views

### Docker & DevOps Files

#### `docker-compose.yml`
- **postgres**: Persistent volume for data
- **redis**: AOF (append-only file) for persistence
- **backend**: Runs migrations on startup
- **worker**: Separate container for job processing
- **frontend**: Standalone Next.js build
- **Networks**: All services on `reachinbox-network`

#### `backend/Dockerfile`
- **Stage 1**: Install dependencies
- **Stage 2**: Build TypeScript + generate Prisma
- **Stage 3**: Production runtime (minimal image)
- **User**: Runs as non-root user `appuser`

## Data Flow

### Scheduling Flow
```
User uploads CSV → Composer.tsx
    ↓
POST /api/email-jobs/schedule → emailJobs.ts
    ↓
Create EmailJob in PostgreSQL (status: SCHEDULED)
    ↓
Add to BullMQ with delay → Redis
    ↓
Worker picks up job at scheduled time
    ↓
Check rate limit (rateLimiter.ts)
    ↓
If limit OK: Send email → Update DB (status: SENT)
If limit hit: Reschedule → Redis (delayed state)
```

### Rate Limiting Flow
```
Before send → checkLimit(senderId, hourlyLimit)
    ↓
Redis ZREMRANGEBYSCORE (clean old entries)
    ↓
Redis ZCARD (count recent sends)
    ↓
count < limit?
    ├─ YES: Send email → incrementCount()
    └─ NO: getNextAvailableTime() → moveToDelayed()
```

## Environment Variables

### Required for Backend
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email provider

### Required for Frontend
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXTAUTH_URL` - Frontend URL
- `NEXTAUTH_SECRET` - Session encryption secret
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth credentials

## Port Mapping

| Service    | Internal | External | Purpose                    |
|------------|----------|----------|----------------------------|
| Frontend   | 3000     | 3000     | Next.js web UI             |
| Backend    | 3001     | 3001     | Express REST API           |
| PostgreSQL | 5432     | 5432     | Database (dev access)      |
| Redis      | 6379     | 6379     | Queue + cache (dev access) |

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Queue**: BullMQ (Redis-backed)
- **Database**: PostgreSQL 15
- **ORM**: Prisma
- **Email**: Nodemailer
- **Validation**: Zod

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: NextAuth.js
- **HTTP Client**: Axios
- **CSV Parsing**: PapaParse
- **Icons**: Lucide React
- **Date Formatting**: date-fns

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Database Migrations**: Prisma Migrate
- **Process Management**: Docker restart policies

## Scalability Notes

- **Horizontal Scaling**: Run multiple worker containers
- **Database**: Add read replicas for dashboard queries
- **Redis**: Use Redis Cluster for high availability
- **Rate Limiting**: Shared across all worker instances via Redis
- **Queue**: BullMQ automatically distributes jobs across workers

## Security Considerations

- **OAuth**: Only Google authentication (no password storage)
- **CORS**: Restricted to `FRONTEND_URL`
- **SQL Injection**: Protected by Prisma ORM
- **Rate Limiting**: Prevents abuse (per sender, not global)
- **Docker**: Containers run as non-root users
- **Secrets**: Environment variables (never committed)

---

This structure ensures:
✅ Clean separation of concerns
✅ Easy to test (modular design)
✅ Production-ready (Docker + persistence)
✅ Scalable (distributed workers)
✅ Maintainable (TypeScript + clear naming)

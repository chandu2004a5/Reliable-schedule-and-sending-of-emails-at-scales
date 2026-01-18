# ReachInbox Outbox

> **Production-ready email scheduling service with real-time dashboard**

A full-stack application for scheduling and managing bulk email campaigns with advanced rate limiting, real-time tracking, and automatic retry mechanisms.

![Tech Stack](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

## 🎯 Features

### Core Functionality
- ✅ **Bulk Email Scheduling** - Upload CSV files and schedule emails with customizable delays
- ✅ **Real Google OAuth** - Secure authentication with NextAuth.js
- ✅ **Redis-Backed Rate Limiting** - Hourly limits per sender with automatic rescheduling
- ✅ **Real-Time Dashboard** - Live updates via polling (auto-refresh every 5 seconds)
- ✅ **Distributed Queue System** - BullMQ with delayed jobs (NO CRON)
- ✅ **Automatic Retries** - Exponential backoff for failed SMTP attempts
- ✅ **Container Restart Resilience** - Jobs persist across Docker restarts
- ✅ **Idempotent Operations** - Database IDs used as queue job IDs

### Technical Highlights
- **Worker Concurrency**: 5 parallel jobs with 2-second mandatory delay
- **Rate Limiting**: Sliding window algorithm with Redis sorted sets
- **Job Persistence**: PostgreSQL + Redis AOF (append-only file)
- **Error Handling**: 3 retry attempts with 5s → 25s → 125s backoff
- **SMTP Transport**: Ethereal Email for testing (easily swap for production SMTP)

## 🏗️ Architecture

```
┌─────────────────┐
│   Next.js UI    │ ← User uploads CSV, sets schedule
│  (Port 3000)    │
└────────┬────────┘
         │
         ↓ REST API
┌─────────────────┐
│  Express.js API │ ← Creates EmailJobs in DB
│  (Port 3001)    │   Adds delayed jobs to BullMQ
└────────┬────────┘
         │
         ↓
┌─────────────────┐    ┌──────────────┐
│   PostgreSQL    │←──→│    Redis     │
│  (Job Records)  │    │ (Queue + RL) │
└─────────────────┘    └──────┬───────┘
                              │
                              ↓
                    ┌──────────────────┐
                    │   BullMQ Worker  │
                    │  (5 concurrent)  │
                    │  - Rate Limiter  │
                    │  - 2s delay      │
                    │  - Retry logic   │
                    └────────┬─────────┘
                             │
                             ↓ SMTP
                    ┌──────────────────┐
                    │  Ethereal Email  │
                    └──────────────────┘
```

## 📂 Project Structure

```
reachinbox-outbox/
├── backend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── prisma.ts           # Database client
│   │   │   ├── queue.ts            # BullMQ configuration
│   │   │   ├── mailer.ts           # Nodemailer setup
│   │   │   └── rateLimiter.ts      # Redis rate limiter
│   │   ├── routes/
│   │   │   ├── users.ts            # User sync (OAuth)
│   │   │   ├── senders.ts          # Sender CRUD
│   │   │   ├── emailJobs.ts        # Job scheduling
│   │   │   └── stats.ts            # Dashboard stats
│   │   ├── index.ts                # Express server
│   │   └── worker.ts               # BullMQ worker
│   ├── prisma/
│   │   └── schema.prisma           # Database schema
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/ # NextAuth config
│   │   ├── dashboard/              # Main dashboard
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing page
│   │   └── globals.css
│   ├── components/
│   │   ├── Composer.tsx            # CSV upload & schedule form
│   │   ├── EmailTable.tsx          # Scheduled/sent tables
│   │   └── Providers.tsx           # NextAuth provider
│   ├── lib/
│   │   └── api.ts                  # API client (Axios)
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml              # Full stack orchestration
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- [Ethereal Email Account](https://ethereal.email/) (free, instant setup)
- [Google OAuth Credentials](https://console.cloud.google.com/) (for authentication)

### 1. Clone & Configure

```bash
git clone <your-repo>
cd reachinbox-outbox

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Get Credentials

#### Ethereal Email (SMTP Testing)
1. Visit https://ethereal.email/
2. Click "Create Ethereal Account"
3. Copy credentials to `.env`:
   ```
   SMTP_USER=your-user@ethereal.email
   SMTP_PASS=your-password
   ```

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials
5. Add authorized redirect: `http://localhost:3000/api/auth/callback/google`
6. Copy credentials to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-secret
   ```

#### Generate NextAuth Secret
```bash
openssl rand -base64 32
# Copy output to .env as NEXTAUTH_SECRET
```

### 3. Run with Docker

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

### 4. Access the Application

1. Open http://localhost:3000
2. Click "Continue with Google"
3. Create a sender account
4. Upload a CSV file (format: `email,subject,body`)
5. Set start time, delay, and hourly limit
6. Watch real-time updates in the dashboard!

## 🔧 Development Setup

### Backend

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start PostgreSQL and Redis (via Docker)
docker-compose up -d postgres redis

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start API server
npm run dev

# In another terminal, start worker
npm run worker
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Start Next.js dev server
npm run dev
```

## 📊 Database Schema

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  senders       Sender[]
}

model Sender {
  id            String     @id @default(cuid())
  userId        String
  email         String
  name          String?
  hourlyLimit   Int        @default(50)
  delaySeconds  Int        @default(2)
  isActive      Boolean    @default(true)
  emailJobs     EmailJob[]
}

model EmailJob {
  id            String      @id @default(cuid())
  senderId      String
  recipient     String
  subject       String
  body          String
  status        EmailStatus @default(PENDING)
  scheduledAt   DateTime
  sentAt        DateTime?
  error         String?
  retryCount    Int         @default(0)
  maxRetries    Int         @default(3)
}

enum EmailStatus {
  PENDING
  SCHEDULED
  SENT
  FAILED
}
```

## 🎛️ Rate Limiting Explained

### How It Works

The rate limiter uses **Redis sorted sets** with a **sliding window** algorithm:

1. **Tracking**: Each email send is stored as a sorted set entry with timestamp as score
2. **Checking**: Before sending, we count entries within the last hour
3. **Enforcement**: If limit is hit, the job is moved to delayed state (not failed)
4. **Rescheduling**: Jobs automatically retry when the next hour window opens

### Example Flow

```
Sender has hourlyLimit = 50

Hour 0:00 - 1:00 → 50 emails sent ✅
Hour 1:00 - Job 51 arrives → Rate limit hit!
  ↓
Worker calculates: "Oldest entry expires at 1:05"
  ↓
Job 51 moved to delayed state until 1:05 ⏰
  ↓
At 1:05 → Job 51 automatically retries ✅
```

### Key Implementation

```typescript
// From backend/src/lib/rateLimiter.ts
async checkLimit(senderId: string, hourlyLimit: number) {
  const oneHourAgo = Date.now() - 3600 * 1000;
  
  // Remove old entries
  await redis.zremrangebyscore(key, 0, oneHourAgo);
  
  // Count recent sends
  const count = await redis.zcard(key);
  
  return {
    allowed: count < hourlyLimit,
    remainingSlots: hourlyLimit - count,
    resetAt: /* oldest entry + 1 hour */
  };
}
```

## 🔄 Job Persistence & Recovery

### How Jobs Survive Restarts

1. **Database**: All jobs are stored in PostgreSQL with status
2. **Redis AOF**: Redis runs with `appendonly yes` for persistence
3. **BullMQ**: Uses database IDs as job IDs (idempotency)
4. **Recovery**: On restart, BullMQ reads from Redis, worker resumes

### Testing Persistence

```bash
# Schedule some emails
# ...

# Stop containers
docker-compose down

# Restart
docker-compose up -d

# Check: Jobs still in Redis, worker resumes processing
docker-compose logs -f worker
```

## 📧 CSV Format

Your CSV should have an `email` column (required) and optionally `subject` and `body`:

```csv
email,subject,body
john@example.com,Hello John,Welcome to our service!
jane@example.com,Hello Jane,Thanks for signing up.
bob@example.com,,This uses the default subject
alice@example.com,Custom Subject,
```

- If `subject` or `body` is missing, the form's default values are used
- Invalid emails (no `@`) are automatically filtered out

## 🐛 Troubleshooting

### Worker not processing jobs
```bash
# Check worker logs
docker-compose logs -f worker

# Verify Redis connection
docker-compose exec redis redis-cli ping

# Check BullMQ queue
docker-compose exec redis redis-cli KEYS "*email-queue*"
```

### Emails not sending
```bash
# Test SMTP connection
docker-compose exec backend npx tsx -e "
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({...});
  await t.verify();
"

# Check Ethereal inbox: https://ethereal.email/messages
```

### Database connection failed
```bash
# Check PostgreSQL status
docker-compose ps postgres

# Run migrations manually
docker-compose exec backend npx prisma migrate deploy
```

## 🧪 Testing Rate Limiting

```bash
# Create a sender with hourlyLimit=5
# Upload CSV with 10 emails
# Set startTime to now, delay=1 second

# Watch logs:
docker-compose logs -f worker

# You'll see:
# ✅ Jobs 1-5 sent immediately
# ⏰ Jobs 6-10 rescheduled for next hour
# ✅ After 1 hour, jobs 6-10 resume
```

## 🚢 Production Deployment

### Environment Variables for Production

```bash
# Backend
DATABASE_URL=postgresql://user:pass@prod-db:5432/reachinbox
REDIS_HOST=prod-redis.example.com
SMTP_HOST=smtp.sendgrid.net  # or AWS SES, Mailgun, etc.
SMTP_USER=apikey
SMTP_PASS=your-api-key
FRONTEND_URL=https://yourdomain.com

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<secure-secret>
```

### Recommended Setup

1. **Database**: Managed PostgreSQL (AWS RDS, Supabase, Railway)
2. **Redis**: Managed Redis (AWS ElastiCache, Upstash, Redis Cloud)
3. **SMTP**: Production service (SendGrid, AWS SES, Mailgun)
4. **Hosting**: 
   - Backend: Docker on AWS ECS/Fargate, Railway, Render
   - Frontend: Vercel, Netlify, or with backend
5. **Monitoring**: Add Sentry, LogRocket, or DataDog

### Docker Production Build

```bash
# Build optimized images
docker-compose -f docker-compose.yml build

# Push to registry
docker tag reachinbox-backend your-registry/backend:latest
docker push your-registry/backend:latest
```

## 📈 Scaling Considerations

- **Worker Scaling**: Run multiple worker containers (BullMQ handles concurrency)
- **Redis**: Use Redis Cluster for high availability
- **Database**: Use read replicas for dashboard queries
- **Rate Limiting**: Adjust `hourlyLimit` per sender tier (free/paid)

## 🤝 Contributing

Contributions welcome! Please follow:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

MIT License - feel free to use this in your own projects!

## 🙏 Acknowledgments

- **BullMQ** - Robust queue system
- **Prisma** - Excellent ORM
- **NextAuth.js** - Seamless OAuth
- **Ethereal Email** - Perfect for testing

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

---

**Built with ❤️ for production use**
#   R e l i a b l e - s c h e d u l i n d - a n d - s e n d i n g - o f - e m a i l s -  
 #   R e l i a b l e - s c h e d u l i n d - a n d - s e n d i n g - o f - e m a i l s -  
 #   R e l i a b l e - s c h e d u l i n d - a n d - s e n d i n g - o f - e m a i l s - a t - s c a l e  
 #   R e l i a b l e - s c h e d u l i n d - a n d - s e n d i n g - o f - e m a i l s - a t - s c a l e  
 
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
...

**Built with ❤️ for production use**

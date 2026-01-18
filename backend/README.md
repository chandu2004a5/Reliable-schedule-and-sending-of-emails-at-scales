# Backend - ReachInbox Outbox

Production-ready email scheduling service backend built with Node.js, TypeScript, Express, BullMQ, Redis, and PostgreSQL.

## Features

- **Distributed Email Scheduling**: BullMQ-based delayed job processing (NO CRON)
- **Rate Limiting**: Redis-backed hourly rate limiter with automatic job rescheduling
- **Idempotency**: Database IDs used as BullMQ job IDs to prevent duplicate scheduling
- **Persistence**: Jobs survive container restarts
- **Retry Logic**: Exponential backoff for failed SMTP attempts
- **Concurrency Control**: Configurable parallel job processing
- **Mandatory Delays**: 2-second delay between email sends

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Generate Prisma client and run migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

5. Start the worker (in a separate terminal):
```bash
# Development
npm run worker

# Production
npm run worker:prod
```

## API Endpoints

### Senders
- `GET /api/senders?userId={userId}` - Get all senders for a user
- `GET /api/senders/:id` - Get a single sender
- `POST /api/senders` - Create a new sender
- `PATCH /api/senders/:id` - Update a sender
- `DELETE /api/senders/:id` - Delete a sender

### Email Jobs
- `POST /api/email-jobs/schedule` - Schedule emails from CSV
- `GET /api/email-jobs?senderId={senderId}&status={status}` - Get email jobs
- `GET /api/email-jobs/:id` - Get a single email job
- `DELETE /api/email-jobs/:id` - Cancel an email job

### Stats
- `GET /api/stats?senderId={senderId}` - Get statistics for a sender

## Architecture

### Rate Limiting Strategy

The rate limiter uses Redis sorted sets to implement a sliding window algorithm:

1. Each sender has a sorted set in Redis with timestamps as scores
2. Before sending, we check if the count within the last hour exceeds the limit
3. If limit is hit, the job is moved to delayed state until the next available slot
4. Old entries are automatically cleaned up

### Job Persistence

- All jobs are stored in PostgreSQL with SCHEDULED status
- BullMQ jobs use database IDs as job IDs (idempotency)
- On container restart:
  - PostgreSQL retains all job records
  - Redis (with persistence enabled) retains job queue state
  - Worker automatically resumes processing

### Worker Behavior

- Processes 5 jobs concurrently
- Enforces 2-second delay between sends
- On rate limit hit: reschedules job instead of failing
- Retry strategy: 3 attempts with exponential backoff (5s, 25s, 125s)

## Development

```bash
# Watch mode
npm run dev

# Type checking
npx tsc --noEmit

# Prisma Studio
npm run prisma:studio
```

# Quick Reference Guide

## Common Commands

### Starting & Stopping

```bash
# Start all services
./start.sh
# or
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove all data (reset)
docker-compose down -v

# Restart a specific service
docker-compose restart worker
docker-compose restart backend
```

### Viewing Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f worker
docker-compose logs -f backend
docker-compose logs -f frontend

# View last 100 lines
docker-compose logs --tail=100 worker

# View logs since timestamp
docker-compose logs --since 2024-01-17T10:00:00 worker
```

### Database Operations

```bash
# Open Prisma Studio (database GUI)
cd backend
docker-compose exec backend npx prisma studio

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Reset database
docker-compose exec backend npx prisma migrate reset

# Generate Prisma client
docker-compose exec backend npx prisma generate

# Direct PostgreSQL access
docker-compose exec postgres psql -U postgres -d reachinbox
```

### Redis Operations

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Check Redis keys
docker-compose exec redis redis-cli KEYS "*"

# Check email queue
docker-compose exec redis redis-cli KEYS "*email-queue*"

# View rate limiter keys
docker-compose exec redis redis-cli KEYS "rate_limit:*"

# Check Redis memory usage
docker-compose exec redis redis-cli INFO memory

# Flush all Redis data (careful!)
docker-compose exec redis redis-cli FLUSHALL
```

### Worker Operations

```bash
# Check worker status
docker-compose ps worker

# Restart worker
docker-compose restart worker

# View worker logs in real-time
docker-compose logs -f worker

# Execute command in worker container
docker-compose exec worker npm run --version
```

## API Endpoints Reference

### Authentication
- `GET /api/auth/signin` - Sign in page
- `GET /api/auth/callback/google` - OAuth callback

### Users
- `POST /api/users/sync` - Sync user from OAuth

### Senders
- `GET /api/senders?userId={userId}` - Get all senders
- `GET /api/senders/:id` - Get single sender
- `POST /api/senders` - Create sender
- `PATCH /api/senders/:id` - Update sender
- `DELETE /api/senders/:id` - Delete sender

### Email Jobs
- `POST /api/email-jobs/schedule` - Schedule emails from CSV
- `GET /api/email-jobs?senderId={id}&status={status}` - Get jobs
- `GET /api/email-jobs/:id` - Get single job
- `DELETE /api/email-jobs/:id` - Cancel job

### Stats
- `GET /api/stats?senderId={id}` - Get dashboard statistics

## Testing Scenarios

### Test 1: Basic Email Scheduling
```bash
# Create a simple CSV file
cat > test.csv << EOF
email,subject,body
test1@example.com,Test 1,Hello from test 1
test2@example.com,Test 2,Hello from test 2
EOF

# Upload via dashboard UI
# Set start time to 1 minute from now
# Check logs: docker-compose logs -f worker
```

### Test 2: Rate Limiting
```bash
# Create CSV with 15 emails
# Set hourly limit to 5
# Set delay to 2 seconds
# Watch worker logs - should see rescheduling
docker-compose logs -f worker | grep "Rate limit"
```

### Test 3: Container Restart Persistence
```bash
# Schedule 20 emails for 10 minutes from now
# Stop containers
docker-compose down

# Wait 2 minutes
# Restart
docker-compose up -d

# Jobs should still be scheduled
docker-compose logs -f worker
```

### Test 4: Retry Mechanism
```bash
# Set invalid SMTP credentials in .env
SMTP_USER=invalid@example.com
SMTP_PASS=wrongpassword

# Restart backend and worker
docker-compose restart backend worker

# Schedule an email
# Watch logs - should see 3 retry attempts
docker-compose logs -f worker | grep "retry"
```

## Useful SQL Queries

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d reachinbox

# Count jobs by status
SELECT status, COUNT(*) FROM email_jobs GROUP BY status;

# View recent jobs
SELECT id, recipient, subject, status, scheduled_at 
FROM email_jobs 
ORDER BY created_at DESC 
LIMIT 10;

# Check senders
SELECT id, email, name, hourly_limit, is_active FROM senders;

# Jobs scheduled in next hour
SELECT COUNT(*) 
FROM email_jobs 
WHERE scheduled_at > NOW() AND scheduled_at < NOW() + INTERVAL '1 hour';

# Failed jobs with errors
SELECT recipient, error, retry_count 
FROM email_jobs 
WHERE status = 'FAILED' 
ORDER BY updated_at DESC;
```

## Environment Variables Quick Reference

### Backend
```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/reachinbox?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user@ethereal.email
SMTP_PASS=your-ethereal-password
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://localhost:3000
```

### Frontend
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Troubleshooting Commands

### Check Service Health
```bash
# Backend health check
curl http://localhost:3001/health | jq

# PostgreSQL connection
docker-compose exec backend npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`SELECT NOW()\`.then(console.log);
"

# Redis connection
docker-compose exec backend npx tsx -e "
const Redis = require('ioredis');
const redis = new Redis({ host: 'redis' });
redis.ping().then(console.log);
"

# SMTP connection
docker-compose exec backend npx tsx -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
t.verify().then(() => console.log('SMTP OK')).catch(console.error);
"
```

### View Container Resources
```bash
# Container stats
docker stats

# Disk usage
docker system df

# Inspect container
docker inspect reachinbox-backend

# View container processes
docker-compose top
```

### Clean Up
```bash
# Remove stopped containers
docker-compose rm

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Clean everything (careful!)
docker system prune -a
```

## Performance Monitoring

### Check Queue Stats
```bash
docker-compose exec redis redis-cli << EOF
KEYS *email-queue*
LLEN bull:email-queue:waiting
LLEN bull:email-queue:active
ZCARD bull:email-queue:delayed
EOF
```

### Check Rate Limiter
```bash
# View all rate limit keys
docker-compose exec redis redis-cli KEYS "rate_limit:*"

# Check specific sender's rate limit
docker-compose exec redis redis-cli ZRANGE rate_limit:sender:{sender-id} 0 -1 WITHSCORES
```

### Database Performance
```bash
docker-compose exec postgres psql -U postgres -d reachinbox -c "
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables;
"
```

## Development Workflow

### Local Development (without Docker)
```bash
# Terminal 1: PostgreSQL + Redis
docker-compose up -d postgres redis

# Terminal 2: Backend API
cd backend
npm install
npm run dev

# Terminal 3: Worker
cd backend
npm run worker

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

### Running Tests (when implemented)
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

### Database Migrations
```bash
# Create new migration
cd backend
npx prisma migrate dev --name add_new_field

# Apply migrations
npx prisma migrate deploy

# View migration status
npx prisma migrate status
```

## Production Checklist

- [ ] Generate secure NEXTAUTH_SECRET
- [ ] Set production SMTP credentials
- [ ] Use managed PostgreSQL (AWS RDS, Supabase)
- [ ] Use managed Redis (AWS ElastiCache, Upstash)
- [ ] Set NODE_ENV=production
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure log aggregation
- [ ] Set up backups for PostgreSQL
- [ ] Enable Redis persistence (AOF + RDB)
- [ ] Configure rate limiting per tier
- [ ] Set up CI/CD pipeline
- [ ] Add health check endpoints
- [ ] Configure container resource limits

## Useful Aliases (add to ~/.bashrc or ~/.zshrc)

```bash
# Docker Compose shortcuts
alias dc='docker-compose'
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
alias dcps='docker-compose ps'
alias dcrestart='docker-compose restart'

# ReachInbox specific
alias rib-start='cd ~/path/to/reachinbox-outbox && ./start.sh'
alias rib-logs='cd ~/path/to/reachinbox-outbox && docker-compose logs -f'
alias rib-worker='cd ~/path/to/reachinbox-outbox && docker-compose logs -f worker'
alias rib-db='cd ~/path/to/reachinbox-outbox && docker-compose exec postgres psql -U postgres -d reachinbox'
alias rib-redis='cd ~/path/to/reachinbox-outbox && docker-compose exec redis redis-cli'
```

---

**Pro Tip**: Bookmark this file for quick access to common operations! 🔖

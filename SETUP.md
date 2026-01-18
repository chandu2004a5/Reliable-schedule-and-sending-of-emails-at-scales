# Setup Guide - ReachInbox Outbox

## Complete Setup Instructions

### Step 1: Get SMTP Credentials (Ethereal Email)

1. Visit https://ethereal.email/
2. Click "Create Ethereal Account" (no signup required)
3. You'll see credentials like:
   ```
   Host: smtp.ethereal.email
   Port: 587
   User: john.doe123@ethereal.email
   Pass: ABC123XYZ456
   ```
4. Keep this page open - you'll need it for step 3

### Step 2: Get Google OAuth Credentials

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable APIs:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth Client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Click "Create"
5. Copy the Client ID and Client Secret

### Step 3: Configure Environment Variables

```bash
# In project root, create .env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Fill in:
```bash
# Ethereal Email credentials from Step 1
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user@ethereal.email
SMTP_PASS=your-ethereal-password

# Google OAuth from Step 2
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret

# Generate NextAuth secret
NEXTAUTH_SECRET=run-this-command-to-generate-secret
```

Generate NextAuth secret:
```bash
openssl rand -base64 32
# Copy output and paste as NEXTAUTH_SECRET
```

### Step 4: Start the Application

```bash
# Make sure Docker is running
docker --version

# Start all services
docker-compose up -d

# Watch the logs
docker-compose logs -f
```

Wait for services to be ready:
- ✅ PostgreSQL migrations applied
- ✅ Backend API started on port 3001
- ✅ Worker started and connected to Redis
- ✅ Frontend started on port 3000

### Step 5: Access the Application

1. Open browser to http://localhost:3000
2. Click "Continue with Google"
3. Sign in with your Google account
4. You'll be redirected to the dashboard

### Step 6: Create Your First Sender

1. In the dashboard, click "Add Sender"
2. Enter your email address (can be any email)
3. Optionally add a name
4. Click "Create"

### Step 7: Schedule Your First Campaign

1. Create a test CSV file (`leads.csv`):
   ```csv
   email,subject,body
   test1@example.com,Hello Test 1,This is a test email
   test2@example.com,Hello Test 2,Another test email
   test3@example.com,Hello Test 3,Third test email
   ```

2. In the dashboard:
   - Click "Click to upload" and select your CSV
   - Set "Default Subject" (optional if CSV has subjects)
   - Set "Default Email Body" (optional if CSV has bodies)
   - Set "Start Time" to 2 minutes from now
   - Set "Delay" to 5 seconds
   - Set "Hourly Limit" to 10
   - Click "Schedule X Emails"

3. Switch to "Scheduled" tab to see your queued emails

4. Wait for start time - watch emails move to "Sent" tab

### Step 8: View Sent Emails (Ethereal)

1. Go back to https://ethereal.email/
2. Click on your account (top right)
3. Click "Messages" to see all sent emails
4. Click any email to view preview

### Step 9: Test Rate Limiting

1. Create a CSV with 15 emails
2. Set hourly limit to 5
3. Schedule the campaign
4. Watch worker logs:
   ```bash
   docker-compose logs -f worker
   ```
5. You'll see:
   - First 5 emails sent immediately ✅
   - Jobs 6-15 rescheduled for next hour ⏰
   - After 1 hour, remaining emails sent ✅

## Troubleshooting

### "Error: connect ECONNREFUSED" on backend
```bash
# Wait for PostgreSQL to be ready
docker-compose logs postgres

# Restart backend if needed
docker-compose restart backend
```

### "SMTP connection failed"
```bash
# Verify your Ethereal credentials in .env
cat .env | grep SMTP

# Test connection
docker-compose exec backend npx tsx -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: '${SMTP_HOST}',
  port: 587,
  auth: { user: '${SMTP_USER}', pass: '${SMTP_PASS}' }
});
t.verify().then(() => console.log('OK')).catch(console.error);
"
```

### "Google Sign-In failed"
1. Check OAuth redirect URI matches exactly:
   `http://localhost:3000/api/auth/callback/google`
2. Verify Google+ API is enabled
3. Check Client ID/Secret in `.env`

### Worker not processing jobs
```bash
# Check Redis connection
docker-compose exec redis redis-cli ping

# Check BullMQ queue
docker-compose exec redis redis-cli KEYS "*"

# Restart worker
docker-compose restart worker
```

## Development Mode

To run without Docker (for development):

### Backend
```bash
cd backend
npm install

# Start local PostgreSQL and Redis
docker-compose up -d postgres redis

# Create .env
cp .env.example .env
# Edit DATABASE_URL to use localhost:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reachinbox?schema=public"
# REDIS_HOST="localhost"

# Run migrations
npm run prisma:generate
npm run prisma:migrate

# Start API (terminal 1)
npm run dev

# Start worker (terminal 2)
npm run worker
```

### Frontend
```bash
cd frontend
npm install

# Create .env.local
cp .env.example .env.local
# Edit to use localhost:
# NEXT_PUBLIC_API_URL="http://localhost:3001"

# Start Next.js
npm run dev
```

## Production Deployment

### 1. Environment Variables
Update `.env` with production values:
- Use managed PostgreSQL (AWS RDS, Supabase)
- Use managed Redis (AWS ElastiCache, Upstash)
- Use production SMTP (SendGrid, AWS SES, Mailgun)
- Set `NEXTAUTH_URL` to your domain
- Generate secure `NEXTAUTH_SECRET`

### 2. Docker Registry
```bash
# Build images
docker-compose build

# Tag and push
docker tag reachinbox-backend your-registry/backend:latest
docker tag reachinbox-frontend your-registry/frontend:latest
docker push your-registry/backend:latest
docker push your-registry/frontend:latest
```

### 3. Deploy
- **Railway**: Connect GitHub, auto-deploy
- **AWS ECS**: Use Fargate with ECR
- **Render**: Docker deploy from registry
- **Vercel**: Frontend only (separate backend)

### 4. Monitoring
Add error tracking:
```bash
npm install @sentry/node @sentry/nextjs
```

## Useful Commands

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f worker

# Restart service
docker-compose restart backend

# Stop all
docker-compose down

# Stop and remove volumes (reset database)
docker-compose down -v

# Execute command in container
docker-compose exec backend npm run prisma:studio

# Check service status
docker-compose ps
```

## Next Steps

1. **Customize email templates** - Add HTML templates to `emailJobs.ts`
2. **Add webhooks** - Notify external services on email sent
3. **Implement analytics** - Track open rates, click rates
4. **Add email validation** - Verify emails before scheduling
5. **Create API keys** - Allow programmatic access
6. **Add user roles** - Admin, sender, viewer permissions
7. **Implement billing** - Stripe integration for paid tiers

## Support

- Check the main [README.md](README.md) for architecture details
- See [Rate Limiting explanation](README.md#-rate-limiting-explained)
- Review [Persistence strategy](README.md#-job-persistence--recovery)

---

**Happy scheduling! 📧**

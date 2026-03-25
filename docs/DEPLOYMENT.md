# SwasthyaAI v3.0 — Deployment Guide

## Prerequisites
- Node.js v18+
- PostgreSQL 14+
- (Optional) Twilio/MSG91/Fast2SMS for SMS
- (Optional) Anthropic API key for AI features
- (Optional) SMTP credentials for email

---

## Local Development

### Step 1 — Create PostgreSQL database
```bash
psql -U postgres
CREATE DATABASE swasthya_ai;
\q
```

### Step 2 — Backend setup
```bash
cd SwasthyaAI/backend
cp .env.example .env
```

Edit `.env` — minimum required:
```
DB_PASSWORD=your_postgres_password
JWT_SECRET=any_64_char_random_string
JWT_REFRESH_SECRET=another_64_char_random_string
```

```bash
npm install
npm run db:migrate   # Runs all 3 SQL migrations
npm run db:seed      # Loads demo data
npm run dev          # Starts on http://localhost:5000
```

### Step 3 — Frontend setup
```bash
cd SwasthyaAI/frontend
npm install
npm run dev          # Starts on http://localhost:5173
```

Open: **http://localhost:5173**

---

## Demo Login Credentials
| Role    | Credential              | Password     |
|---------|-------------------------|--------------|
| Patient | Mobile: +919876500002   | Password123! |
| Doctor  | MCI: MCI-2019-DL-48291  | Password123! |
| Admin   | admin@swasthya.ai       | Password123! |

Demo Ops Cases: **CC-2026-01001** · **PA-2026-01001**

---

## Environment Variables Reference

### Required
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=swasthya_ai
DB_USER=postgres
DB_PASSWORD=                # YOUR password
JWT_SECRET=                 # 64+ random chars
JWT_REFRESH_SECRET=         # 64+ random chars (different from above)
```

### Optional — SMS (pick one provider)
```
SMS_PROVIDER=console        # Options: twilio | msg91 | fast2sms | console
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx

MSG91_AUTH_KEY=xxx
MSG91_SENDER_ID=SWASTH

FAST2SMS_API_KEY=xxx
```

### Optional — Email
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
```

### Optional — AI (enables full AI features)
```
ANTHROPIC_API_KEY=sk-ant-xxx
```
Without this key: AI chat uses offline fallbacks, coding/PA use rule-based engine.

### Optional — Video
```
VIDEO_PROVIDER=jitsi         # Options: jitsi | daily | twilio_video
JITSI_DOMAIN=meet.jit.si     # Works immediately, zero cost

# For Daily.co:
DAILY_API_KEY=xxx
DAILY_DOMAIN=your-domain.daily.co

# For Twilio Video:
TWILIO_VIDEO_API_KEY_SID=SKxxx
TWILIO_VIDEO_API_KEY_SECRET=xxx
```
Jitsi works out of the box with no API key.

---

## Production Deployment

### Build frontend
```bash
cd frontend && npm run build
# Output in frontend/dist/
```

### Backend with PM2
```bash
npm install -g pm2
cd backend
NODE_ENV=production pm2 start src/server.js --name swasthya-api
pm2 startup && pm2 save
```

### Nginx config
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/SwasthyaAI/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }

    # Uploads
    location /uploads {
        proxy_pass http://localhost:5000;
    }
}
```

---

## Troubleshooting

**"Cannot connect to database"**
→ Check DB_* vars in .env, ensure PostgreSQL is running:
```bash
sudo service postgresql start
```

**"SMS not sending"**
→ Set SMS_PROVIDER=console — OTPs will appear in server logs.

**"AI features not working"**
→ Set ANTHROPIC_API_KEY — without it, fallback to rule-based engine.

**"Port 5000 in use"**
```bash
lsof -ti:5000 | xargs kill
```

**Migration errors ("already exists")**
→ Normal if migrating an existing DB. The migrate.js handles these gracefully.

---

## Architecture Summary

```
Frontend (React/Vite)  →  Vite proxy  →  Backend (Express)
                                         ↓
                                    PostgreSQL 14+
                                         ↓
                                    Socket.IO (WS)
                                         ↓
                                    Claude AI (optional)
```

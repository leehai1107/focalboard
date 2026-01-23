# Focalboard Railway Deployment Guide

## Setup Instructions

### 1. Local Development
```bash
cd docker
cp .env.railway .env
# Edit .env with your local PostgreSQL connection string
docker-compose up -d
```

### 2. Railway Deployment

#### Option A: Using Railway CLI
```bash
railway login
railway init
railway up
```

#### Option B: Using Railway Dashboard
1. Create a new project on Railway
2. Connect your GitHub repository
3. Add PostgreSQL database service
4. Set environment variables in Railway dashboard:

**Required Environment Variables:**
```
FOCALBOARD_DBTYPE=postgres
FOCALBOARD_DBCONFIG=${DATABASE_URL}
FOCALBOARD_SERVERROOT=https://your-app.up.railway.app
FOCALBOARD_PORT=8000
```

**Optional Environment Variables:**
```
FOCALBOARD_SESSION_EXPIRE_TIME=2592000
FOCALBOARD_SESSION_REFRESH_TIME=18000
FOCALBOARD_TELEMETRY=false
```

### 3. Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `FOCALBOARD_DBTYPE` | Database type | `postgres` or `sqlite3` |
| `FOCALBOARD_DBCONFIG` | Database connection string | `postgres://user:pass@host:port/db` |
| `FOCALBOARD_SERVERROOT` | Public URL of your app | `https://yourapp.railway.app` |
| `FOCALBOARD_PORT` | Internal port (Railway auto-assigns) | `8000` |
| `FOCALBOARD_SESSION_EXPIRE_TIME` | Session expiration (seconds) | `2592000` (30 days) |
| `FOCALBOARD_SESSION_REFRESH_TIME` | Session refresh (seconds) | `18000` (5 hours) |
| `FOCALBOARD_TELEMETRY` | Enable/disable telemetry | `true` or `false` |

### 4. Railway-Specific Notes

- Railway automatically provides `DATABASE_URL` when you add a PostgreSQL service
- Railway assigns `PORT` automatically - use `${PORT}` in your config
- Railway provides `RAILWAY_PUBLIC_DOMAIN` for your public URL

### 5. Verify Deployment

After deployment, check logs:
```bash
railway logs
```

Your Focalboard should be accessible at your Railway public domain.

# Bikes for Cities Workflow & Environment Strategy

This guide outlines the standard workflow for developing locally, testing features, managing secure environment variables, and committing changes gracefully between the local machine and the production server.

## 1. Local Development Setup

When working locally on your machine, your code strictly points to your local development containers.

### Local Database & Services
Run:
```bash
docker-compose up -d
```
Because of our `127.0.0.1` port bindings in `docker-compose.yml`, this will safely instantiate:
- `b4c_database` at `localhost:4000`
- `b4c_backend_api` at `localhost:4001`
- `b4c_tile_server` at `localhost:4002`

### Frontend Connectivity
Your local Vite app automatically reads the `frontend/.env.development` file which assigns:
```env
VITE_API_URL=http://localhost:4001/api
VITE_TILE_SERVER_URL=http://localhost:4002
```
This forces local tests strictly onto your local PostgreSQL database schemas. 

## 2. Testing against the Production Server (without committing)

Occasionally, you might build a feature locally but need to test it against the massive datastores present only on the remote server. 

**Steps to test Production Data locally:**
1. Open `frontend/.env.development` temporarily.
2. Change the URLs to match the remote server domains:
   ```env
   VITE_API_URL=https://api.your-production-server.com/api
   VITE_TILE_SERVER_URL=https://api.your-production-server.com/tiles
   ```
3. Your local server (`localhost:5173`) will continue to run, but will fetch remote records. Since `localhost:5173` is explicitly whitelisted in the remote CORS settings (`main.py` when `ENVIRONMENT=development`), the remote server will accept these requests!
4. **Important:** REVERT `.env.development` to localhost strings before your final commit.

## 3. Commit & Deployment Workflow

You should only commit your code when tests pass smoothly on your local configuration.

### Deployment Flow:
1. **Commit and Push:**
   ```bash
   git add .
   git commit -m "feat: new interactive maps over tiles"
   git push origin main
   ```
2. **Frontend Deployment:** Vercel automatically detects the push and begins building your frontend. Because Vercel has its own *Environment Configuration*, it securely builds using the `VITE_API_URL` matching the remote server (as configured inside Vercel Dashboard).
3. **Backend Deployment:** SSH into your Linux Server:
   ```bash
   cd /opt/bikes-for-cities
   git pull origin main
   docker-compose up -d --build
   ```

## 4. Secure Variables (Passwords & Origins)

Never check passwords or DB credentials into GitHub! Ensure absolute security over these variables:
- The `ENVIRONMENT=production` variable must ONLY live in your server's base `/opt/bikes-for-cities/.env` file. This tells `.main.py` "I am on the remote machine, only serve the vercel domain". 
- Keep a `/.env.example` in GitHub showing necessary keys, but let the primary `/.env` continue to be git-ignored.
- Since we use identical docker binds (`127.0.0.1:4001:8000`), no `docker-compose.yml` hacks are required between environments.

# Deployment Configuration Summary

## ✅ Changes Made

### 1. **deploy-compose.yml** - Updated for your custom deployment
   - **Port Configuration:**
     - API container: Port `3081:3080` (avoids conflicts with ports 3000, 8123)
     - Nginx container: Port `3082:80` (internal, proxied by host nginx)
   - **Container Names:** All prefixed with `-App` to avoid conflicts
     - `LibreChat-API-App`
     - `LibreChat-NGINX-App`
     - `chat-mongodb-app`
     - `chat-meilisearch-app`
     - `vectordb-app`
     - `rag_api-app`
   - **Build Configuration:** Set to build from your source code (since you have customizations)
   - **Volume Names:** Updated to avoid conflicts (`pgdata2-app`)

### 2. **client/nginx.conf** - Updated for your subdomain
   - Changed `server_name` from `localhost` to `app.construct.chat`

### 3. **librechat.yaml** - Version updated
   - Updated version from `1.2.1` to `1.2.8` (latest)

### 4. **New Files Created:**
   - `DEPLOYMENT_GUIDE.md` - Complete step-by-step deployment guide
   - `deploy.sh` - Automated deployment script (for Linux/Mac)
   - `DEPLOYMENT_SUMMARY.md` - This file

## 🚀 Next Steps on Your Server

### Step 1: Push Changes to GitHub
```bash
git add .
git commit -m "Configure deployment for app.construct.chat"
git push origin main
```

### Step 2: On Your Server - Clone and Setup

```bash
# SSH into your server
ssh user@your-server-ip

# Clone your repository
git clone https://github.com/charley-forey/LibreChat.git
cd LibreChat/

# Create .env file
cp .env.example .env
nano .env
# IMPORTANT: Update CREDS_IV, CREDS_KEY, JWT_SECRET, JWT_REFRESH_SECRET
# Set ALLOW_REGISTRATION=false after creating your account
# Set DOMAIN_CLIENT=https://app.construct.chat
# Set DOMAIN_SERVER=https://app.construct.chat
```

### Step 3: Configure Host Nginx

Create nginx configuration on your host:

```bash
sudo nano /etc/nginx/sites-available/app.construct.chat
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name app.construct.chat;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.construct.chat;

    # Update these paths to match your SSL certificate location
    ssl_certificate /etc/letsencrypt/live/app.construct.chat/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.construct.chat/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 25M;

    location / {
        proxy_pass http://localhost:3082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/app.construct.chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Set Up SSL Certificate

```bash
sudo certbot --nginx -d app.construct.chat
```

### Step 5: Deploy the Application

**Option A: Using the deployment script (recommended)**
```bash
chmod +x deploy.sh
./deploy.sh
# Choose option 1 to build and start
```

**Option B: Manual deployment**
```bash
# Make sure Docker is running
sudo systemctl start docker

# Build and start (requires sufficient RAM - 4GB+ recommended)
sudo docker-compose -f ./deploy-compose.yml up -d --build

# OR if you built the image elsewhere and pushed to registry:
# Edit deploy-compose.yml to use the image instead of build
# Then:
sudo docker-compose -f ./deploy-compose.yml pull
sudo docker-compose -f ./deploy-compose.yml up -d
```

### Step 6: Verify Deployment

```bash
# Check container status
docker ps

# View logs
docker-compose -f ./deploy-compose.yml logs -f

# Access the app
# Open https://app.construct.chat in your browser
```

### Step 7: Create Admin Account

If `ALLOW_REGISTRATION=true` in `.env`:
- Register through the web interface
- Then set `ALLOW_REGISTRATION=false` and restart

If `ALLOW_REGISTRATION=false`:
```bash
npm run create-user
```

## 📋 Important Notes

### Building Docker Image

Since you have custom code, you **must** build your own Docker image. The upstream pre-built images won't have your customizations.

**If your server has low RAM:**
1. Build the image on a different machine (local or CI/CD)
2. Push to GitHub Container Registry or Docker Hub
3. Update `deploy-compose.yml` to use the image instead of building

**To build and push to GitHub Container Registry:**
```bash
# Build
docker build -f Dockerfile.multi --target api-build -t ghcr.io/charley-forey/librechat-dev-api:latest .

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u charley-forey --password-stdin

# Push
docker push ghcr.io/charley-forey/librechat-dev-api:latest
```

### Port Summary

- **Port 3000:** Your existing website (construct.chat)
- **Port 8123:** Your existing Procore app (procore.construct.chat)
- **Port 3081:** LibreChat API (internal, not exposed to internet)
- **Port 3082:** LibreChat Nginx (proxied by host nginx on port 443)

### Container Isolation

All containers are prefixed with `-App` to avoid conflicts with any existing LibreChat instances you might have.

## 🔄 Updating Your Deployment

```bash
# Pull latest changes
git pull origin main

# If you need to merge upstream changes:
git fetch upstream
git merge upstream/main
# Resolve conflicts if any
git push origin main

# Rebuild and restart
./deploy.sh
# OR manually:
sudo docker-compose -f ./deploy-compose.yml down
sudo docker-compose -f ./deploy-compose.yml up -d --build
```

## 🆘 Troubleshooting

See `DEPLOYMENT_GUIDE.md` for detailed troubleshooting steps.

Common issues:
- **Port conflicts:** Check with `sudo lsof -i :PORT`
- **Container won't start:** Check logs with `docker-compose -f ./deploy-compose.yml logs`
- **502 Bad Gateway:** Verify containers are running and nginx config is correct
- **Build fails:** Server may not have enough RAM - build elsewhere and push to registry

## 📚 Additional Resources

- Full deployment guide: `DEPLOYMENT_GUIDE.md`
- LibreChat docs: https://docs.librechat.ai
- Your repository: https://github.com/charley-forey/LibreChat

## ✅ Checklist

Before deploying, make sure:
- [ ] Docker and Docker Compose installed on server
- [ ] Domain `app.construct.chat` points to server IP
- [ ] `.env` file created with secure secrets
- [ ] Host nginx configured for reverse proxy
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Ports 3081 and 3082 are available
- [ ] Sufficient RAM for building (or image pre-built)

Good luck with your deployment! 🚀


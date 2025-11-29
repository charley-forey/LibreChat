# LibreChat Deployment Guide for app.construct.chat

This guide will walk you through deploying your custom LibreChat fork to `https://app.construct.chat` on your remote server.

## Prerequisites

- Ubuntu server with Docker and Docker Compose installed
- Domain `app.construct.chat` pointing to your server IP
- Existing nginx setup on the host (for reverse proxy)
- Ports 3000 and 8123 already in use (your other services)
- This app will use port **3081** for the API and **3082** for internal nginx

## Important Notes

⚠️ **Since you're using a custom fork with modifications, you MUST build your own Docker image.** The pre-built upstream images won't contain your customizations.

## Part I: Server Setup (Docker Installation)

If Docker is not already installed on your server, follow these steps:

### 1. Update and Install Docker Dependencies

```bash
sudo apt update
sudo apt install apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release
```

### 2. Add Docker Repository

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
```

### 3. Install Docker

```bash
sudo apt install docker-ce
sudo usermod -aG docker $USER
sudo reboot
```

After rebooting, switch back to your user:
```bash
su - <yourusername>
```

### 4. Verify Docker

```bash
sudo systemctl status docker
```

### 5. Install Docker Compose

```bash
sudo curl -L https://github.com/docker/compose/releases/download/v2.26.1/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose -v
```

### 6. Install Git and Node.js (Optional but Recommended)

```bash
sudo apt install git nodejs npm
```

## Part II: Clone and Setup Your Fork

### 1. Clone Your Repository

```bash
# Clone your fork
git clone https://github.com/charley-forey/LibreChat.git
cd LibreChat/

# Verify you're on the correct branch
git branch
```

### 2. Create Environment File

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file
nano .env
```

**IMPORTANT: Update these security values!**

Generate new secrets at: https://www.librechat.ai/toolkit/creds_generator

Find and replace these in your `.env` file:
- `CREDS_IV` (must be 32 hex characters)
- `CREDS_KEY` (must be 64 hex characters)
- `JWT_SECRET` (must be 64 hex characters)
- `JWT_REFRESH_SECRET` (must be 64 hex characters)

**Recommended settings:**
```bash
# Disable registration after creating your admin account
ALLOW_REGISTRATION=false

# Set your domain
DOMAIN_CLIENT=https://app.construct.chat
DOMAIN_SERVER=https://app.construct.chat
```

Save and exit: `CTRL + X`, then `Y`, then `ENTER`

### 3. Verify Configuration Files

The following files have been pre-configured:
- ✅ `deploy-compose.yml` - Uses port 3081, builds from your source
- ✅ `client/nginx.conf` - Configured for `app.construct.chat`
- ✅ `librechat.yaml` - Already configured with your custom settings

## Part III: Build and Deploy

### Option A: Build on the Server (Requires Sufficient RAM)

If your server has enough RAM (recommended 4GB+ for building):

```bash
# Start Docker if not running
sudo systemctl start docker

# Build and start the containers
sudo docker-compose -f ./deploy-compose.yml up -d --build
```

### Option B: Build Elsewhere and Push to Registry (Recommended for Low RAM)

If your server doesn't have enough RAM to build:

1. **Build on a local machine or CI/CD:**

```bash
# On your local machine or CI/CD
docker build -f Dockerfile.multi --target api-build -t ghcr.io/charley-forey/librechat-dev-api:latest .

# Push to GitHub Container Registry (requires authentication)
docker push ghcr.io/charley-forey/librechat-dev-api:latest
```

2. **On the server, update deploy-compose.yml:**

Edit `deploy-compose.yml` and comment out the build section, uncomment the image line:
```yaml
services:
  api:
    # build:
    #   context: .
    #   dockerfile: Dockerfile.multi
    #   target: api-build
    image: ghcr.io/charley-forey/librechat-dev-api:latest
```

3. **Pull and start:**

```bash
sudo docker-compose -f ./deploy-compose.yml pull
sudo docker-compose -f ./deploy-compose.yml up -d
```

### Verify Containers are Running

```bash
docker ps
```

You should see:
- `LibreChat-API-App` (port 3081)
- `LibreChat-NGINX-App` (port 3082)
- `chat-mongodb-app`
- `chat-meilisearch-app`
- `vectordb-app`
- `rag_api-app`

## Part IV: Configure Host Nginx Reverse Proxy

Since you already have nginx running on your host, you need to add a reverse proxy configuration for `app.construct.chat`.

### 1. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/app.construct.chat
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name app.construct.chat;

    # Redirect HTTP to HTTPS (if you have SSL)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.construct.chat;

    # SSL Configuration (adjust paths to your certificates)
    ssl_certificate /etc/letsencrypt/live/app.construct.chat/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.construct.chat/privkey.pem;
    
    # SSL Settings (recommended)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Increase body size for file uploads
    client_max_body_size 25M;

    # Proxy to Docker container
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

### 2. Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/app.construct.chat /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### 3. Set Up SSL Certificate (if not already done)

```bash
sudo certbot --nginx -d app.construct.chat
```

## Part V: Access and Initial Setup

1. **Access the application:**
   - Open `https://app.construct.chat` in your browser

2. **Create your admin account:**
   - If `ALLOW_REGISTRATION=true`, register through the UI
   - If `ALLOW_REGISTRATION=false`, create via command line:
   ```bash
   npm run create-user
   ```

3. **Disable registration** (if you enabled it temporarily):
   ```bash
   nano .env
   # Set ALLOW_REGISTRATION=false
   # Restart containers
   npm run stop:deployed
   npm run start:deployed
   ```

## Part VI: Updating Your Deployment

Since you're using a custom fork, updates work differently:

### Update Process

```bash
# Pull latest changes from your fork
git pull origin main

# If upstream has updates you want to merge:
git fetch upstream
git merge upstream/main
# Resolve any conflicts
git push origin main

# Rebuild and restart
npm run stop:deployed
npm run start:deployed --build
# OR if using pre-built images:
# docker-compose -f ./deploy-compose.yml pull
# npm run start:deployed
```

### Manual Update (Alternative)

```bash
# Stop containers
docker compose -f ./deploy-compose.yml down

# Pull latest code
git pull

# Rebuild (if building on server)
docker compose -f ./deploy-compose.yml build

# Start containers
docker compose -f ./deploy-compose.yml up -d
```

## Part VII: Useful Commands

### View Logs

```bash
# All containers
docker compose -f ./deploy-compose.yml logs -f

# Specific container
docker compose -f ./deploy-compose.yml logs -f api
```

### Stop/Start

```bash
npm run stop:deployed
npm run start:deployed
```

### Check Container Status

```bash
docker ps
docker compose -f ./deploy-compose.yml ps
```

### Access Container Shell

```bash
docker exec -it LibreChat-API-App /bin/bash
```

### Backup Database

```bash
docker exec chat-mongodb-app mongodump --out /data/backup
docker cp chat-mongodb-app:/data/backup ./backup-$(date +%Y%m%d)
```

## Troubleshooting

### Port Already in Use

If you get port conflicts:
```bash
# Check what's using the port
sudo lsof -i :3081
sudo lsof -i :3082

# Kill the process or change ports in deploy-compose.yml
```

### Container Won't Start

```bash
# Check logs
docker compose -f ./deploy-compose.yml logs

# Check Docker status
sudo systemctl status docker
```

### Nginx 502 Bad Gateway

- Verify container is running: `docker ps`
- Check container logs: `docker logs LibreChat-NGINX-App`
- Verify port mapping: `docker port LibreChat-NGINX-App`
- Check host nginx config: `sudo nginx -t`

### Can't Access Application

- Verify DNS: `nslookup app.construct.chat`
- Check firewall: `sudo ufw status`
- Verify SSL certificate: `sudo certbot certificates`
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`

## Security Recommendations

1. ✅ Change all default secrets in `.env`
2. ✅ Set `ALLOW_REGISTRATION=false` after creating admin account
3. ✅ Use strong passwords for MongoDB (if exposing)
4. ✅ Keep Docker and system packages updated
5. ✅ Regularly backup your database
6. ✅ Monitor logs for suspicious activity
7. ✅ Use firewall rules to restrict access

## Next Steps

- Configure your API keys in the web interface
- Set up your custom endpoints in `librechat.yaml`
- Configure email settings if needed
- Set up automated backups
- Monitor resource usage

## Support

For issues specific to your custom fork, check:
- Your repository: https://github.com/charley-forey/LibreChat
- LibreChat documentation: https://docs.librechat.ai
- LibreChat Discord: https://discord.librechat.ai


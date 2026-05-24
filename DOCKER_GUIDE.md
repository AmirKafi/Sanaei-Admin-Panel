# Docker Deployment Guide

## پروژه Dockerize شده است ✅

فایل‌های مربوطه:
- `Dockerfile` - تصویر Docker برای اپلیکیشن
- `docker-compose.yml` - orchestration برای اجرای سرویس‌ها
- `.dockerignore` - فایل‌هایی که نباید در تصویر Docker کپی شوند
- `.dockerenv.example` - نمونه متغیرهای محیطی

## نحوه استفاده

### 1. آماده‌سازی سرور
```bash
# نیازمندی‌ها:
# - Docker و Docker Compose نصب شده باشند
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 2. آپلود پروژه
پروژه را به سرور منتقل کنید:
```bash
scp -r ./ user@your-server:/path/to/sanaei-admin-panel
ssh user@your-server
cd /path/to/sanaei-admin-panel
```

### 3. تنظیمات محیطی
```bash
# کپی کردن فایل نمونه
cp .dockerenv.example .env

# ویرایش متغیرهای محیطی (مهم!)
nano .env
```

**متغیرهای حتمی:**
- `NEXTAUTH_SECRET` - کلید امنیتی (باید تغییر بدهید)
- `NEXTAUTH_URL` - آدرس دامنه سرور (مثال: https://yourserver.com)

### 4. اجرای اپلیکیشن

#### گزینه 1: Docker Compose (توصیه شده)
```bash
# بیلد و اجرا
docker-compose up -d

# مشاهده لاگ‌ها
docker-compose logs -f

# توقف
docker-compose down

# توقف و حذف داده‌ها
docker-compose down -v
```

#### گزینه 2: Docker مستقیم
```bash
# بیلد کردن
docker build -t sanaei-admin-panel .

# اجرا
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/prisma.db \
  -e NEXTAUTH_SECRET=your-secret \
  -e NEXTAUTH_URL=http://your-domain \
  -v sanaei_data:/app/data \
  --name sanaei-admin-panel \
  sanaei-admin-panel
```

### 5. تنظیمات Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## مشاکل عام و حل‌ها

### 1. بنیاد تصویر ناموفق
```bash
# پاک کردن cache
docker system prune -a
docker-compose build --no-cache
```

### 2. خطای دیتابیس
```bash
# بررسی volume
docker volume ls
docker volume inspect sanaei_data

# حذف و بازنشانی
docker-compose down -v
docker-compose up -d
```

### 3. خطای مجوز
```bash
# اطمینان از حقوق Docker
sudo usermod -aG docker $USER
newgrp docker
```

## مانیتورینگ

```bash
# مشاهده وضعیت
docker-compose ps

# لاگ‌های real-time
docker-compose logs -f app

# ورود به کانتینر
docker-compose exec app sh

# وضعیت سیستم
docker stats
```

## تحدیث اپلیکیشن

```bash
# pull کردن آخرین تغییرات
git pull

# بیلد مجدد
docker-compose build --no-cache

# اجرای مجدد
docker-compose up -d
```

## Backup و Restore

```bash
# Backup دیتابیس
docker-compose exec app cp /app/data/prisma.db /app/data/prisma.db.backup

# Restore دیتابیس
docker-compose exec app cp /app/data/prisma.db.backup /app/data/prisma.db
```

## پاکت‌های سیستمی

کانتینر از Node.js 20 Alpine استفاده می‌کند:
- اندازه کوچک و بهینه
- نیازمندی‌های کم
- امن و پایدار

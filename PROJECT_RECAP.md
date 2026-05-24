# پروژه Sanaei Admin Panel - خلاصه جامع

## 📋 درباره پروژه

**نام پروژه:** Sanaei Admin Panel

**هدف پروژه:** ساخت یک پنل مدیریت ادمین برای مدیریت سرویس Sanaei/3X-UI (VPN/Proxy) با امکانات زیر:
- مدیریت و همگام‌سازی **Inbounds**
- مدیریت **کلاینت‌ها** و مشاهده جزئیات مصرف
- نمایش **آمار و نمودارها**
- پیکربندی **تنظیمات پنل**
- پشتیبانی از **مهاجرت کلاینت‌ها بین Inbound‌ها**

## 🧱 معماری کلی

- **Frontend:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS + Radix UI + Lucide React
- **Backend:** API routes داخلی Next.js
- **Database:** SQLite با Prisma ORM
- **Charting:** Recharts
- **Forms:** React Hook Form

---

## ✅ وضعیت فعلی پروژه

### صفحات اصلی موجود
- ✅ `app/(admin)/page.tsx` → **Dashboard**: آمار کلی، traffic by inbound، top clients
- ✅ `app/(admin)/clients/page.tsx` → **Clients**: لیست کلاینت‌ها، فیلترها، جستجو و عملیات پایه
- ✅ `app/(admin)/clients/[id]/page.tsx` → **Client detail page**: جزئیات هر کلاینت، وضعیت فعال/غیرفعال، مصرف و نمودارها
- ✅ `app/(admin)/inbounds/page.tsx` → **Inbounds**: لیست inbounds، دکمه Sync و وضعیت‌ها
- ✅ `app/(admin)/settings/page.tsx` → **Settings**: ذخیره و بارگذاری تنظیمات پنل
- ✅ `app/login/page.tsx` → **Login**: صفحه ورود به سیستم
- ✅ `app/sub/[subId]/page.tsx` → **Subscription Page**: نمایش اطلاعات اشتراک به کاربر نهایی

### API و backend
- ✅ `app/api/auth/*` → سیستم احراز هویت (Login, Logout, Session)
- ✅ `app/api/clients/route.ts` → GET / POST لیست کلاینت‌ها
- ✅ `app/api/clients/[id]/route.ts` → GET جزئیات و DELETE کلاینت
- ✅ `app/api/inbounds/route.ts` → GET لیست inbounds
- ✅ `app/api/inbounds/[id]/route.ts` → عملیات مربوط به inbound
- ✅ `app/api/inbounds/[id]/addClient/route.ts` → افزودن کلاینت به inbound
- ✅ `app/api/inbounds/migrateClients/route.ts` → مهاجرت کلاینت‌ها بین inbounds
- ✅ `app/api/settings/route.ts` → GET/POST تنظیمات
- ✅ `app/api/usage/check/route.ts` → بررسی مصرف کاربران
- ✅ `app/api/sub/[subId]/route.ts` → ارائه کانفیگ‌ها و اطلاعات اشتراک

### Migration & Sync
- ✅ **مهاجرت کلاینت‌ها** بین inbounds با `MigrationDialog`
- ✅ **Sync** اطلاعات inbounds از پنل Sanaei
- ✅ Preview و نمایش نتیجه مهاجرت
- ✅ کد migration در `lib/migration.ts`

### Database و مدل‌ها
- ✅ مدل `Client`
- ✅ مدل `Inbound`
- ✅ مدل رابطه `ClientInbound`
- ✅ مدل `UsageSnapshot`
- ✅ مدل `Setting`
- ✅ اتصال Prisma به SQLite

### UI و تجربه کاربری
- ✅ کامپوننت‌های پایه Card, Button, Input, Table, Dialog, Badge, Checkbox, Select
- ✅ طراحی responsive و Dark Mode
- ✅ نمایش نمودارها با Recharts
- ✅ استفاده از Toast و Alert برای بازخورد کاربر
- ✅ Sidebar ادمین برای ناوبری

### ابزار و کتابخانه‌های کلیدی
- `next` 15.1.x
- `react` 19
- `prisma` 5.x
- `tailwindcss` 4
- `zod` (برای Validation)
- `vitest` (برای Testing)
- `@radix-ui/*`
- `recharts`
- `react-hook-form`
- `lucide-react`

---

## 🔍 نقاط قوت فعلی

- رابط کاربری مدرن و کامل برای مدیریت کلاینت‌ها
- سیستم مهاجرت (Migration) هوشمند بین Inbound‌ها
- سیستم همگام‌سازی (Sync) خودکار با پنل Sanaei
- پشتیبانی از چندین پروتکل و Inbound مختلف
- معماری تمیز با استفاده از TypeScript و Prisma
- وجود تست‌های واحد برای بخش‌های منطقی حساس (Logic)
- دارای CI/CD برای تضمین کیفیت کد

---

## ⚠️ مشکلات و موارد باقی‌مانده

### 1. Authentication & Authorization
- ✅ ورود به سیستم پایه پیاده‌سازی شده
- ❌ پیاده‌سازی Middleware برای محافظت سراسری از مسیرها
- ❌ مدیریت نقش‌ها (Roles) - فعلاً فقط یک ادمین وجود دارد

### 2. Validation و خطاها
- ✅ استفاده از Zod برای اعتبارسنجی داده‌ها در API
- ❌ بهبود نمایش خطاهای سرور در سمت کلاینت (User-friendly errors)
- ❌ تکمیل حالت‌های loading و skeleton در تمام بخش‌ها

### 3. تست و کیفیت کد
- ✅ تست‌های واحد (Unit Tests) برای کتابخانه‌های اصلی (lib)
- ❌ تست‌های انتگرال (Integration tests) برای API routes
- ❌ تست‌های E2E با Playwright/Cypress

### 4. استقرار و تولید
- ✅ فایل CI/CD در GitHub Actions موجود است
- ❌ مستندات استقرار (Docker/Vercel)
- ❌ تنظیمات Production (مانند دیتابیس خارجی در صورت نیاز)

### 5. قابلیت‌های پیشرفته
- ✅ جستجو و فیلتر روی جداول کلاینت‌ها
- ❌ Export به CSV/Excel
- ❌ Backup/Restore دیتابیس
- ❌ سیستم نوتیفیکیشن (Telegram/Discord) برای مصرف ترافیک

---

## 📊 ارزیابی وضعیت فعلی

| حوزه | وضعیت فعلی |
|------|-------------|
| Backend API | عالی — کامل و با Validation |
| Frontend | عالی — مدرن و Responsive |
| Client Management | کامل (CRUD + Migration) |
| Inbound Management | کامل (Sync + Management) |
| Authentication | خوب — پایه پیاده شده |
| Testing | خوب — تست‌های واحد موجود است |
| Deployment | متوسط — دارای CI ولی نیاز به مستندات |
| Documentation | نیاز به بهبود |

---

## 🎯 پیشنهاد اولویت‌های بعدی

1. افزودن **Middleware** برای محافظت از مسیرهای ادمین
2. افزودن قابلیت **Export** اطلاعات کلاینت‌ها
3. پیاده‌سازی **سیستم اطلاع‌رسانی** (Telegram Bot)
4. تکمیل **مستندات استقرار** (Dockerize کردن پروژه)
5. افزودن **تست‌های انتگرال** برای APIها

---

## 📝 یادداشت نهایی

پروژه پیشرفت بسیار خوبی داشته و بخش‌های اصلی (Core) شامل مدیریت کلاینت، مهاجرت و همگام‌سازی به خوبی کار می‌کنند. اکنون تمرکز باید بر روی نهایی‌سازی امنیت (Middleware) و قابلیت‌های جانبی مانند گزارش‌گیری و اطلاع‌رسانی باشد.

**آخرین بروزرسانی:** 23 مه 2026



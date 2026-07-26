🖋️ Scriptorium — Premium Assignment Writing Platform
A production-ready, login-free assignment ordering platform. Handwritten & typed assignments, automatic AI page counting, backend-only pricing, Cash on Delivery, and Telegram as the order management system.
1. Architecture
Layer
Technology
Hosting
Frontend
Vanilla HTML/CSS/JS (no build step)
GitHub Pages (free)
Backend
Node.js + Express
Render (free tier)
Database
Supabase Postgres (Free Plan)
Supabase
File Storage
Supabase Storage (Free Plan)
Supabase
Page Counting
pdf-lib / pdf-parse + Tesseract.js OCR
Runs on backend
Order Management
Telegram Bot API
Telegram
Payment
Cash on Delivery (no gateway)
N/A
Why this stack: No login/auth system needed (per requirements) so a heavy framework adds no value on the frontend — plain JS deploys instantly to GitHub Pages with zero build tooling. Express gives the most reliable free hosting story on Render while supporting every required library (PDF parsing, OCR, Telegram Bot API, PDF generation). Supabase Free Plan covers Postgres + file storage in one place, and orders are deleted the moment they're marked "delivered" — so the free tier's storage limits are never a concern.
2. Folder Structure
scriptorium/
├── frontend/               → deploy to GitHub Pages
│   ├── index.html          (customer-facing app)
│   ├── admin.html          (optional lightweight admin panel)
│   └── assets/              (all CSS/JS)
├── backend/                → deploy to Render
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── services/
│       └── routes/
└── database/
    └── schema.sql           → run in Supabase SQL Editor
3. Supabase Setup
Go to https://supabase.com → New Project (free tier).
Once created, go to SQL Editor → paste the entire contents of database/schema.sql → Run.
Go to Storage → New Bucket → name it exactly assignment-uploads → set Private (not public).
Go to Project Settings → API → copy:
Project URL → becomes SUPABASE_URL
service_role key (NOT the anon key) → becomes SUPABASE_SERVICE_ROLE_KEY
⚠️ Never expose the service_role key in frontend code — it belongs only in the backend's environment variables.
4. Telegram Bot Setup
Open Telegram, search @BotFather, send /newbot.
Follow the prompts to name your bot. BotFather gives you a bot token → this is TELEGRAM_BOT_TOKEN.
To get your Chat ID:
Send any message to your new bot first.
Visit https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates in a browser.
Find "chat":{"id": ...} in the JSON response → that number is TELEGRAM_CHAT_ID.
If using a group, add the bot to the group first, send a message, then repeat the same step (group chat IDs are negative numbers — that's normal).
5. Backend Deployment (Render)
Push the backend/ folder to a GitHub repo (or the whole scriptorium/ repo — Render lets you set a root directory).
Go to https://render.com → New → Web Service → connect your repo.
Settings:
Root Directory: backend
Build Command: npm install
Start Command: npm start
Instance Type: Free
Add all variables from backend/.env.example under Environment.
Deploy. Copy your live URL (e.g. https://scriptorium-backend.onrender.com).
Free Render services spin down after inactivity and take ~30-50s to wake on the next request — this is normal for the free tier.
6. Frontend Deployment (GitHub Pages)
In frontend/assets/config.js, set:
const API_BASE_URL = "https://scriptorium-backend.onrender.com/api";
Push the frontend/ folder contents to a GitHub repo (e.g. as the root, or /docs folder).
Repo → Settings → Pages → Source: deploy from branch → select main and / (root) (or /docs).
Your site will be live at https://yourusername.github.io/your-repo/.
Go back to Render → update ALLOWED_ORIGINS env var to this exact URL → redeploy backend.
7. Admin Panel
Visit https://yourusername.github.io/your-repo/admin.html, log in with your ADMIN_SECRET. From here you can view orders, view the uploaded file, mark an order "processing", or mark it delivered — which permanently deletes the order and its file from Supabase (Telegram retains the full record). This panel is optional; Telegram alone is sufficient to run the business.
8. Environment Variables Reference
See backend/.env.example. All are required except where noted.
Variable
Description
ALLOWED_ORIGINS
Comma-separated frontend URL(s) for CORS
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
From Supabase project settings
SUPABASE_STORAGE_BUCKET
Defaults to assignment-uploads
TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
From BotFather setup above
ADMIN_SECRET
Password for the admin panel (choose something strong)
MAX_UPLOAD_SIZE_MB
Defaults to 20
9. API Reference
Method
Route
Purpose
POST
/api/upload/preview-count
Upload files → get auto-detected page count (no storage)
POST
/api/coupons/validate
Validate a coupon code, get discount preview
POST
/api/orders
Create order (files + all fields) → returns order confirmation + invoice
POST
/api/admin/login
Exchange admin secret for a session token
GET
/api/admin/orders?status=
List orders (optional status filter)
GET
/api/admin/orders/:id/file-url
Signed temporary URL to the uploaded file
PATCH
/api/admin/orders/:id/status
Set status to pending/processing
DELETE
/api/admin/orders/:id
Mark delivered → purge order + file permanently
GET
/api/health
Uptime check
All admin routes (except /login) require header: Authorization: Bearer <token>.
10. Local Development / Testing
Backend:
cd backend
npm install
cp .env.example .env   # fill in real values
npm run dev            # http://localhost:4000
Frontend: set API_BASE_URL in assets/config.js to http://localhost:4000/api, then simply open frontend/index.html in a browser (or serve with any static server, e.g. npx serve frontend).
Manual test checklist:
[ ] Upload a PDF → correct page count appears
[ ] Upload multiple images → page count = image count
[ ] Try uploading a >20MB file → rejected with clear error
[ ] Complete an order → check Telegram receives message + files + invoice
[ ] Check Supabase orders table has the new row
[ ] Open Orders tab → order appears with working invoice download
[ ] Admin panel → mark order delivered → row disappears from Supabase & admin panel, Telegram message still there
[ ] Apply a coupon (WELCOME10 or FLAT50) → discount reflected correctly
11. Troubleshooting
Issue
Fix
CORS error in browser console
Check ALLOWED_ORIGINS on Render exactly matches your GitHub Pages URL (no trailing slash)
Telegram message not received
Re-check TELEGRAM_CHAT_ID — must message the bot first before calling getUpdates
"File too large" on small files
Check MAX_UPLOAD_SIZE_MB env var is set correctly on Render
Page count seems wrong on scanned PDF
Encrypted/corrupted PDFs fall back to pdf-parse; if both fail, re-export the PDF
Backend takes ~40s to respond first time
Normal Render free-tier cold start — consider a free uptime-ping service if this matters to you
Admin login fails
Double check ADMIN_SECRET matches exactly (case-sensitive) between Render env and what you type
Order created but Supabase row missing
Check Render logs — likely an RLS/service-role key issue; confirm you used the service_role key, not anon
12. Security Notes
All pricing is calculated server-side only (pricing.service.js) — the frontend estimate is cosmetic and never trusted.
Page counts are always recomputed server-side at order submission — never client-editable.
File uploads are validated by MIME type and size, held only in memory (never written to disk).
Admin auth uses a stateless signed token (HMAC) — no session table required.
Rate limiting applied globally, with stricter limits on uploads and admin login.
All user input is sanitized (XSS-stripped) before storage or use in Telegram messages.

// Central config: loads and validates all environment variables in one place.
// Every other file imports from here instead of touching process.env directly.
require('dotenv').config();

function required(name) {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    throw new Error(`[CONFIG] Missing required environment variable: ${name}`);
  }
  return val;
}

function optional(name, fallback) {
  const val = process.env[name];
  return val === undefined || val === '' ? fallback : val;
}

const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '4000'), 10),

  // CORS - your GitHub Pages frontend URL(s), comma-separated
  allowedOrigins: required('ALLOWED_ORIGINS').split(',').map((s) => s.trim()),

  // Supabase
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseStorageBucket: optional('SUPABASE_STORAGE_BUCKET', 'assignment-uploads'),

  // Telegram
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  telegramChatId: required('TELEGRAM_CHAT_ID'),

  // Admin panel (no user table - single shared secret)
  adminSecret: required('ADMIN_SECRET'),

  // Uploads
  maxUploadSizeMB: parseInt(optional('MAX_UPLOAD_SIZE_MB', '20'), 10),
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ],

  // Pricing (paise-free, plain rupees, backend-only source of truth)
  pricing: {
    handwritten: {
      '2-3': 8,
      '3-5': 6,
      '5-7': 4,
    },
    typed: 3,
    materials: {
      ruledPaperPerSheet: 1.5,
      punchRuledPerSheet: 1.5,
      interleavedPerPage: 1.5,
      blankPerPage: 1.5,
      transparentCover: 10,
      plasticClip: 30,
      hardCover: 15,
      blackCover: 10,
      brownCover: 10,
      customCover: 10,
      plasticSheetProtector: 20,
      nameSlip: 0,
    },
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // per IP per window (general)
    uploadMax: 20, // stricter for upload endpoint
  },
};

module.exports = config;
  

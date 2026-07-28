// ─────────────────────────────────────────────
//  config.js — Scriptorium frontend configuration
// ─────────────────────────────────────────────

// ⚠️ Set this to your deployed backend URL after deploying to Render.
// Example: "https://scriptorium-backend.onrender.com/api"
const API_BASE_URL = "https://scriptorium-a2x0.onrender.com/api";

// These numbers MIRROR the backend's pricing.service.js for a live on-screen
// ESTIMATE only. They are never sent to the server and never used to charge
// the customer — the backend recomputes the authoritative final price from
// scratch on every order (see pricing.service.js). Keep these two in sync
// manually if you ever change prices.
const PRICING_ESTIMATE = {
  handwritten: { "2-3": 8, "3-5": 6, "5-7": 4 },
  typed: 3,
  materials: {
    ruled_a4: 1.5, hindi_ruled: 1.5, punch_ruled: 1.5, punch_blank: 1.5, punch_interleaved: 1.5,
    a4_white: 0, a4: 0, a4_hole_punch: 0,
  },
  cover: { none: 0, transparent_plastic: 10, plastic_clip: 30, hard_cover: 15 },
  addons: { black_cover: 10, brown_cover: 10, custom_cover: 10, plastic_sheet_protector: 20, name_slip: 0 },
};

const APP_VERSION = "1.0.0";
const MAX_UPLOAD_SIZE_MB = 20;

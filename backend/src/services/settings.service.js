const supabase = require('../config/supabaseClient');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

async function getSetting(key) {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).single();
  if (error || !data) return null;
  return data.value;
}

async function getAllSettings() {
  const { data, error } = await supabase.from('app_settings').select('key, value, updated_at');
  if (error) throw new AppError(`Failed to load settings: ${error.message}`, 500, 'SETTINGS_LOAD_FAILED');
  const map = {};
  data.forEach((row) => (map[row.key] = row.value));
  return map;
}

async function setSetting(key, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new AppError(`Failed to update setting: ${error.message}`, 500, 'SETTINGS_UPDATE_FAILED');
  return value;
}

// Merges DB-stored pricing overrides on top of the hardcoded defaults in config,
// so a partial/missing settings row never breaks pricing - it just falls back.
async function getPricingRates() {
  const stored = await getSetting('pricing');
  if (!stored) return config.pricing;
  return {
    handwritten: { ...config.pricing.handwritten, ...(stored.handwritten || {}) },
    typed: stored.typed ?? config.pricing.typed,
    materials: { ...config.pricing.materials, ...(stored.materials || {}) },
  };
}

// Resolves the Telegram chat ID to actually send to: admin-set override takes
// priority (so admin can switch device/SIM without redeploying), falls back to env var.
async function getTelegramChatId() {
  const stored = await getSetting('telegram_chat_id');
  return stored || config.telegramChatId;
}

async function areOrdersOpen() {
  const stored = await getSetting('orders_open');
  return stored === null ? true : stored !== false;
}

async function getFlipCardText() {
  const stored = await getSetting('flip_card_text');
  return stored || 'Every assignment is crafted with care, precision, and a touch of ink-stained passion.';
}

module.exports = {
  getSetting,
  getAllSettings,
  setSetting,
  getPricingRates,
  getTelegramChatId,
  areOrdersOpen,
  getFlipCardText,
};

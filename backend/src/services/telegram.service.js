const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

// polling: false — we only ever SEND messages/documents, never receive commands.
// This keeps the integration simple and avoids needing a webhook endpoint.
const bot = new TelegramBot(config.telegramBotToken, { polling: false });

// Escapes characters that break Telegram's legacy Markdown parser
function esc(text) {
  return String(text ?? '').replace(/([_*`\[])/g, '\\$1');
}

function formatOrderMessage(order) {
  const pb = order.price_breakdown;
  const addonsList = (order.addons || []).length
    ? order.addons.map((a) => a.replace(/_/g, ' ')).join(', ')
    : 'None';

  return (
    `📖 *NEW SCRIPTORIUM ORDER*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *Order ID:* ${esc(order.order_code)}\n` +
    `🕐 *Order Time:* ${new Date(order.created_at).toLocaleString('en-IN')}\n\n` +
    `👤 *Customer*\n` +
    `Name: ${esc(order.customer_name)}\n` +
    `Phone: ${esc(order.phone_number)}\n` +
    `Alt Phone: ${esc(order.alternate_number || 'N/A')}\n\n` +
    `📍 *Shipping Address*\n` +
    `${esc(order.address_line)}\n${esc(order.city)}, ${esc(order.state)} - ${esc(order.pin_code)}\n` +
    `Landmark: ${esc(order.landmark || 'N/A')}\n\n` +
    `📝 *Assignment Details*\n` +
    `Type: ${order.assignment_type === 'handwritten' ? 'Handwritten' : 'Typed'}\n` +
    `Paper: ${esc(order.paper_type.replace(/_/g, ' '))}\n` +
    `Delivery: ${esc(order.delivery_option)} days\n` +
    `Cover: ${esc(order.cover_option.replace(/_/g, ' '))}\n` +
    `Add-ons: ${esc(addonsList)}\n` +
    `Page Count (auto-detected): *${order.page_count}*\n\n` +
    `💰 *Price Breakdown*\n` +
    `Base (${pb.pageCount} pg @ ₹${pb.perPageRate}): ₹${pb.baseCost}\n` +
    `Material: ₹${pb.materialCost}\n` +
    `Cover: ₹${pb.coverCost}\n` +
    `Add-ons: ₹${pb.addonsCost}\n` +
    (pb.discount > 0 ? `Coupon (${esc(pb.couponCode)}): -₹${pb.discount}\n` : '') +
    `*Final Amount: ₹${pb.finalAmount}*\n\n` +
    `💳 *Payment:* Cash on Delivery\n` +
    (order.customer_note ? `\n🗒️ *Customer Note:*\n${esc(order.customer_note)}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Status: ⏳ Pending — mark delivered in Admin Panel when complete.`
  );
}

/**
 * Sends the full order notification to the configured Telegram chat:
 * 1. Formatted text message with every order detail
 * 2. The uploaded assignment file(s) as document attachments
 * 3. The generated invoice PDF as a document attachment
 * Telegram itself becomes the permanent order record since the DB row
 * is purged once the order is marked delivered.
 */
async function sendOrderNotification(order, uploadedFiles, invoiceBuffer, chatId = config.telegramChatId) {
  await bot.sendMessage(chatId, formatOrderMessage(order), { parse_mode: 'Markdown' });

  for (const file of uploadedFiles) {
    await bot.sendDocument(
      chatId,
      file.buffer,
      { caption: `📎 Assignment file: ${file.originalname}` },
      { filename: file.originalname, contentType: file.mimetype }
    );
  }

  await bot.sendDocument(
    chatId,
    invoiceBuffer,
    { caption: `🧾 Invoice for ${order.order_code}` },
    { filename: `Invoice-${order.order_code}.pdf`, contentType: 'application/pdf' }
  );
}

module.exports = { sendOrderNotification };

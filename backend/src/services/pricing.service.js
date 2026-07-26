const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

// Maps paper_type value (sent by frontend as a fixed enum, never a price) to its
// per-page/per-sheet material cost. Values of 0 mean "included in base rate".
const PAPER_MATERIAL_COST = {
  a4_white: 0,
  ruled_a4: config.pricing.materials.ruledPaperPerSheet,
  hindi_ruled: config.pricing.materials.ruledPaperPerSheet,
  punch_ruled: config.pricing.materials.punchRuledPerSheet,
  punch_blank: config.pricing.materials.blankPerPage,
  punch_interleaved: config.pricing.materials.interleavedPerPage,
  a4: 0,
  a4_hole_punch: 0,
};

const COVER_COST = {
  none: 0,
  transparent_plastic: config.pricing.materials.transparentCover,
  plastic_clip: config.pricing.materials.plasticClip,
  hard_cover: config.pricing.materials.hardCover,
};

const ADDON_COST = {
  black_cover: config.pricing.materials.blackCover,
  brown_cover: config.pricing.materials.brownCover,
  custom_cover: config.pricing.materials.customCover,
  plastic_sheet_protector: config.pricing.materials.plasticSheetProtector,
  name_slip: config.pricing.materials.nameSlip,
};

const VALID_PAPER_TYPES = {
  handwritten: ['a4_white', 'ruled_a4', 'hindi_ruled', 'punch_ruled', 'punch_blank', 'punch_interleaved'],
  typed: ['a4', 'a4_hole_punch'],
};

const VALID_DELIVERY = ['2-3', '3-5', '5-7'];
const VALID_COVERS = Object.keys(COVER_COST);
const VALID_ADDONS = Object.keys(ADDON_COST);

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Computes the final order price entirely server-side.
 * @param {Object} order - { assignmentType, paperType, deliveryOption, coverOption, addons, pageCount }
 * @param {Object|null} coupon - pre-validated coupon row from DB { type, value } or null
 */
function calculateOrderPrice(order, coupon = null) {
  const { assignmentType, paperType, deliveryOption, coverOption, addons = [], pageCount } = order;

  // --- Validation: reject anything not in our known enums (defense against tampering) ---
  if (!['handwritten', 'typed'].includes(assignmentType)) {
    throw new AppError('Invalid assignment type.', 400, 'INVALID_ASSIGNMENT_TYPE');
  }
  if (!VALID_PAPER_TYPES[assignmentType].includes(paperType)) {
    throw new AppError('Invalid paper type for this assignment type.', 400, 'INVALID_PAPER_TYPE');
  }
  if (!VALID_DELIVERY.includes(deliveryOption)) {
    throw new AppError('Invalid delivery option.', 400, 'INVALID_DELIVERY');
  }
  if (!VALID_COVERS.includes(coverOption)) {
    throw new AppError('Invalid cover option.', 400, 'INVALID_COVER');
  }
  for (const addon of addons) {
    if (!VALID_ADDONS.includes(addon)) {
      throw new AppError(`Invalid add-on: ${addon}`, 400, 'INVALID_ADDON');
    }
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new AppError('Invalid page count.', 400, 'INVALID_PAGE_COUNT');
  }

  // --- Base writing/typing cost ---
  const perPageRate =
    assignmentType === 'handwritten' ? config.pricing.handwritten[deliveryOption] : config.pricing.typed;
  const baseCost = round2(perPageRate * pageCount);

  // --- Material (paper) cost ---
  const materialRate = PAPER_MATERIAL_COST[paperType];
  const materialCost = round2(materialRate * pageCount);

  // --- Cover cost (flat, one-time) ---
  const coverCost = COVER_COST[coverOption];

  // --- Add-on costs (flat, one-time each) ---
  const addonBreakdown = addons.map((a) => ({ key: a, cost: ADDON_COST[a] }));
  const addonsCost = round2(addonBreakdown.reduce((sum, a) => sum + a.cost, 0));

  const subtotal = round2(baseCost + materialCost + coverCost + addonsCost);

  // --- Coupon discount ---
  let discount = 0;
  if (coupon) {
    if (coupon.type === 'flat') {
      discount = Math.min(coupon.value, subtotal);
    } else if (coupon.type === 'percentage') {
      discount = round2((subtotal * coupon.value) / 100);
    }
  }

  const finalAmount = round2(Math.max(subtotal - discount, 0));

  return {
    perPageRate,
    pageCount,
    baseCost,
    materialCost,
    coverCost,
    addonsCost,
    addonBreakdown,
    subtotal,
    couponCode: coupon ? coupon.code : null,
    discount: round2(discount),
    finalAmount,
  };
}

module.exports = { calculateOrderPrice, VALID_PAPER_TYPES, VALID_DELIVERY, VALID_COVERS, VALID_ADDONS };

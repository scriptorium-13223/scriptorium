const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

// Enum keys never change (frontend sends these fixed strings) - only the NUMBERS
// behind them are admin-editable via settings.service.js -> getPricingRates().
const VALID_PAPER_TYPES = {
  handwritten: ['a4_white', 'ruled_a4', 'hindi_ruled', 'punch_ruled', 'punch_blank', 'punch_interleaved'],
  typed: ['a4', 'a4_hole_punch'],
};
const VALID_DELIVERY = ['2-3', '3-5', '5-7'];
const VALID_COVERS = ['none', 'transparent_plastic', 'plastic_clip', 'hard_cover'];
const VALID_ADDONS = ['black_cover', 'brown_cover', 'custom_cover', 'plastic_sheet_protector', 'name_slip'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Builds the paper-type -> per-page material cost map from whatever rates are
// currently active (DB overrides merged over hardcoded defaults).
function buildMaterialCostMap(rates) {
  return {
    a4_white: 0,
    ruled_a4: rates.materials.ruledPaperPerSheet,
    hindi_ruled: rates.materials.ruledPaperPerSheet,
    punch_ruled: rates.materials.punchRuledPerSheet,
    punch_blank: rates.materials.blankPerPage,
    punch_interleaved: rates.materials.interleavedPerPage,
    a4: 0,
    a4_hole_punch: 0,
  };
}
function buildCoverCostMap(rates) {
  return {
    none: 0,
    transparent_plastic: rates.materials.transparentCover,
    plastic_clip: rates.materials.plasticClip,
    hard_cover: rates.materials.hardCover,
  };
}
function buildAddonCostMap(rates) {
  return {
    black_cover: rates.materials.blackCover,
    brown_cover: rates.materials.brownCover,
    custom_cover: rates.materials.customCover,
    plastic_sheet_protector: rates.materials.plasticSheetProtector,
    name_slip: rates.materials.nameSlip,
  };
}

/**
 * Computes the final order price entirely server-side.
 * @param {Object} order - { assignmentType, paperType, deliveryOption, coverOption, addons, pageCount }
 * @param {Object|null} coupon - pre-validated coupon row from DB { type, value } or null
 * @param {Object} rates - current pricing rates (from settings.service.getPricingRates()); defaults to hardcoded config
 */
function calculateOrderPrice(order, coupon = null, rates = config.pricing) {
  const { assignmentType, paperType, deliveryOption, coverOption, addons = [], pageCount } = order;

  const MATERIAL_COST = buildMaterialCostMap(rates);
  const COVER_COST = buildCoverCostMap(rates);
  const ADDON_COST = buildAddonCostMap(rates);

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
  const perPageRate = assignmentType === 'handwritten' ? rates.handwritten[deliveryOption] : rates.typed;
  const baseCost = round2(perPageRate * pageCount);

  // --- Material (paper) cost ---
  const materialCost = round2(MATERIAL_COST[paperType] * pageCount);

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

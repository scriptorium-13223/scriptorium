const PDFDocument = require('pdfkit');

/**
 * Generates a professional invoice PDF as an in-memory Buffer (never written to disk).
 * Uses only server-calculated figures already stored on the order - no client input.
 */
function generateInvoicePDF(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const ink = '#001621';
    const accent = '#ff4103';
    const grey = '#666666';

    // Header
    doc.rect(0, 0, doc.page.width, 90).fill(ink);
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('Scriptorium', 40, 28);
    doc.fontSize(9).font('Helvetica').fillColor('#cdd7dc').text('Premium Assignment Writing Service', 40, 56);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(accent).text('INVOICE', 0, 30, { align: 'right', width: doc.page.width - 40 });
    doc.fontSize(9).font('Helvetica').fillColor('#ffffff').text(order.order_code, 0, 50, { align: 'right', width: doc.page.width - 40 });

    let y = 115;
    doc.fillColor('#000000');

    doc.fontSize(9).fillColor(grey).text('Order Date:', 40, y);
    doc.fontSize(9).fillColor('#000').font('Helvetica-Bold').text(new Date(order.created_at).toLocaleString('en-IN'), 110, y);
    doc.font('Helvetica').fillColor(grey).text('Payment:', 320, y);
    doc.font('Helvetica-Bold').fillColor(accent).text('Cash on Delivery', 380, y);
    y += 25;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('BILL TO', 40, y);
    y += 15;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(order.customer_name, 40, y);
    y += 15;
    doc.font('Helvetica').fontSize(9).fillColor(grey).text(`Phone: ${order.phone_number}`, 40, y);
    y += 12;
    doc.text(`${order.address_line}, ${order.city}, ${order.state} - ${order.pin_code}`, 40, y, { width: 500 });
    y += 25;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('ASSIGNMENT DETAILS', 40, y);
    y += 16;

    const details = [
      ['Type', order.assignment_type === 'handwritten' ? 'Handwritten Assignment' : 'Typed Assignment'],
      ['Paper Type', order.paper_type.replace(/_/g, ' ')],
      ['Delivery', `${order.delivery_option} days`],
      ['Cover', order.cover_option.replace(/_/g, ' ')],
      ['Page Count', String(order.page_count)],
    ];
    details.forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(9).fillColor(grey).text(label, 40, y, { width: 150 });
      doc.font('Helvetica-Bold').fillColor('#000').text(value, 200, y);
      y += 15;
    });
    y += 10;

    // Price breakdown table
    doc.rect(40, y, 515, 22).fill(ink);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9).text('Description', 50, y + 7);
    doc.text('Amount (₹)', 0, y + 7, { align: 'right', width: 545 });
    y += 22;

    const pb = order.price_breakdown;
    const rows = [
      [`Writing/Typing (${pb.pageCount} pages @ ₹${pb.perPageRate}/page)`, pb.baseCost],
      ['Paper Material Cost', pb.materialCost],
      ['Cover Charge', pb.coverCost],
    ];
    if (pb.addonBreakdown && pb.addonBreakdown.length) {
      pb.addonBreakdown.forEach((a) => rows.push([`Add-on: ${a.key.replace(/_/g, ' ')}`, a.cost]));
    }

    doc.fillColor('#000');
    rows.forEach((r, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f7f4ef';
      doc.rect(40, y, 515, 18).fill(bg);
      doc.fillColor('#000').font('Helvetica').fontSize(9).text(r[0], 50, y + 5);
      doc.text(r[1].toFixed(2), 0, y + 5, { align: 'right', width: 545 });
      y += 18;
    });

    doc.moveTo(40, y).lineTo(555, y).strokeColor('#cccccc').stroke();
    y += 8;
    doc.font('Helvetica').fontSize(9).fillColor(grey).text('Subtotal', 350, y);
    doc.font('Helvetica-Bold').fillColor('#000').text(pb.subtotal.toFixed(2), 0, y, { align: 'right', width: 545 });
    y += 15;

    if (pb.discount > 0) {
      doc.font('Helvetica').fillColor(grey).text(`Coupon (${pb.couponCode || ''})`, 350, y);
      doc.font('Helvetica-Bold').fillColor(accent).text(`- ${pb.discount.toFixed(2)}`, 0, y, { align: 'right', width: 545 });
      y += 15;
    }

    doc.rect(340, y, 215, 26).fill(accent);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(12).text('Grand Total', 350, y + 7);
    doc.text(`Rs. ${pb.finalAmount.toFixed(2)}`, 0, y + 7, { align: 'right', width: 545 });

    // Footer
    doc.fontSize(8).fillColor(grey).text(
      'Thank you for choosing Scriptorium. This is a system-generated invoice.',
      40,
      750,
      { align: 'center', width: 515 }
    );

    doc.end();
  });
}

module.exports = { generateInvoicePDF };

// Shared lead helpers, used by both the website server (server.js, to put a
// "Reply on WhatsApp" button on the notification) and the bot (bot.js, for the
// /leads card) so the two produce the same link.
function waDigits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

// A wa.me link that opens WhatsApp to the lead's number with a friendly opener
// pre-filled. Returns null when the lead left no usable number (they only gave
// an email) — the caller then shows no WhatsApp button.
function waLink(lead) {
  const d = waDigits(lead && lead.whatsapp);
  if (d.length < 7) return null;
  const greet = `Hi ${(lead && lead.name) || 'there'}, thanks for your enquiry`
    + (lead && lead.tour ? ` about the ${lead.tour} tour` : '')
    + ` with Azat Tours!`;
  return `https://wa.me/${d}?text=${encodeURIComponent(greet)}`;
}

module.exports = { waDigits, waLink };

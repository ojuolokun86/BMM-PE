let baileys = null;

async function getBaileys() {
  if (!baileys) {
    baileys = await import('@whiskeysockets/baileys');
  }
  return baileys;
}

module.exports = { getBaileys };
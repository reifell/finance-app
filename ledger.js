const fs = require('fs');
const path = require('path');

const LEDGER_FILE = path.join(__dirname, 'processed_ledger.json');

function loadLedger() {
  if (!fs.existsSync(LEDGER_FILE)) return {};
  return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
}

function saveLedger(ledger) {
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

function isProcessed(transactionId) {
  const ledger = loadLedger();
  return !!ledger[transactionId];
}

function markProcessed(transactionId, meta = {}) {
  const ledger = loadLedger();
  ledger[transactionId] = { processedAt: new Date().toISOString(), ...meta };
  saveLedger(ledger);
}

/**
 * Retorna a data (ISO) da transação mais recente já processada, ou null
 * se o ledger estiver vazio (primeira vez rodando o app).
 */
function getLastProcessedDate() {
  const ledger = loadLedger();
  const dates = Object.values(ledger)
    .map(entry => entry.date)
    .filter(Boolean)
    .map(d => new Date(d));

  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}

module.exports = { isProcessed, markProcessed, getLastProcessedDate };

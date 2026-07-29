const { getSheetsClient, SPREADSHEET_ID } = require('./google_client');

const LEDGER_SHEET_NAME = '_app_ledger';
const DIAS_RETENCAO = 60; // entradas mais antigas que isso são podadas automaticamente
const HEADER = ['transactionId', 'date', 'despesa', 'valor', 'processedAt'];

async function ensureLedgerSheetExists(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existe = meta.data.sheets.some(s => s.properties.title === LEDGER_SHEET_NAME);
  if (existe) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: LEDGER_SHEET_NAME } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${LEDGER_SHEET_NAME}'!A1:E1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER] },
  });
}

async function readAllRows(sheets) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${LEDGER_SHEET_NAME}'!A2:E`, // pula o header
  });
  return resp.data.values || [];
}

function rowToEntry(row) {
  const [transactionId, date, despesa, valor, processedAt] = row;
  return { transactionId, date, despesa, valor: parseFloat(valor), processedAt };
}

function podarAntigas(entries) {
  const corte = new Date();
  corte.setDate(corte.getDate() - DIAS_RETENCAO);
  return entries.filter(e => e.date && new Date(e.date) >= corte);
}

/**
 * Carrega o conjunto de IDs de transação já processados (pra checagem rápida
 * durante o pipeline, sem precisar de uma chamada de API por transação).
 */
async function loadProcessedIds() {
  const sheets = await getSheetsClient();
  await ensureLedgerSheetExists(sheets);
  const rows = await readAllRows(sheets);
  return new Set(rows.map(r => r[0]));
}

/**
 * Grava um lote de transações processadas de uma vez (mais eficiente que
 * uma chamada por item), e aproveita pra podar entradas com mais de
 * 60 dias, então o ledger não cresce infinitamente.
 */
async function markProcessedBatch(novasEntradas) {
  const sheets = await getSheetsClient();
  await ensureLedgerSheetExists(sheets);

  const existentes = (await readAllRows(sheets)).map(rowToEntry);
  const agora = new Date().toISOString();
  const novas = novasEntradas.map(e => ({
    transactionId: e.transactionId,
    date: e.date,
    despesa: e.despesa,
    valor: e.valor,
    processedAt: agora,
  }));

  const combinadas = podarAntigas([...existentes, ...novas]);

  const valores = combinadas.map(e => [e.transactionId, e.date, e.despesa, String(e.valor), e.processedAt]);

  // Reescreve a aba inteira (limpa e grava de novo) — simples e correto,
  // já que o volume aqui é pequeno (só ~60 dias de transações).
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${LEDGER_SHEET_NAME}'!A2:E100000`,
  });

  if (valores.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LEDGER_SHEET_NAME}'!A2`,
      valueInputOption: 'RAW',
      requestBody: { values: valores },
    });
  }
}

/**
 * Retorna a data (Date) da transação mais recente já processada, ou null
 * se o ledger estiver vazio (primeira vez rodando, ou planilha nova).
 */
async function getLastProcessedDate() {
  const sheets = await getSheetsClient();
  await ensureLedgerSheetExists(sheets);
  const rows = await readAllRows(sheets);
  const dates = rows.map(r => r[1]).filter(Boolean).map(d => new Date(d));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}

module.exports = { loadProcessedIds, markProcessedBatch, getLastProcessedDate };

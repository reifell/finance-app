const { getSheetsClient, SPREADSHEET_ID } = require('./google_client');

const MONTH_COLUMNS = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']; // Jan..Dez

// Aceita tanto ponto quanto vírgula como separador decimal (a planilha, na
// localidade pt-BR do usuário, usa vírgula; entradas antigas podem ter ponto).
const SAFE_ARITHMETIC = /^[0-9+\-*/(),.\s]+$/;

function safeEval(expr) {
  if (!SAFE_ARITHMETIC.test(expr)) return null;
  // Normaliza vírgula decimal pra ponto (formato que o JS entende),
  // já que dentro de uma expressão aritmética simples não há uso legítimo de vírgula.
  const normalizado = expr.replace(/,/g, '.');
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${normalizado});`)();
    return typeof value === 'number' && isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// Separa uma fórmula tipo "65+312.13+24-10" em termos de nível superior: [65, 312.13, 24, -10]
// Respeita parênteses (não quebra dentro deles).
function splitTopLevelTerms(body) {
  const terms = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === '+' || ch === '-') && depth === 0 && current.trim() !== '') {
      terms.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') terms.push(current);
  return terms;
}

function extractValuesFromCell(rawValue) {
  if (rawValue == null) return [];
  if (typeof rawValue === 'number') return [rawValue];

  let str = String(rawValue).trim();
  if (str.startsWith('=')) str = str.slice(1);

  const terms = splitTopLevelTerms(str);
  const values = [];
  for (const term of terms) {
    const val = safeEval(term);
    if (val !== null) values.push(val);
  }
  return values;
}

/**
 * Constrói um índice: { "2026-07": { "153.25": [{despesa, row, categoria, grupo}, ...], ... } }
 * pra permitir busca rápida por (ano-mês, valor absoluto).
 * @param {string} year
 * @param {Array} categories - lista dinâmica (buscar com fetchCategories(), em categories_dynamic.js)
 */
async function buildAmountIndex(year, categories) {
  const sheets = await getSheetsClient();

  const minRow = Math.min(...categories.map(c => c.row));
  const maxRow = Math.max(...categories.map(c => c.row));

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${year}'!E${minRow}:P${maxRow}`,
    valueRenderOption: 'FORMULA',
  });

  const rows = resp.data.values || [];
  const index = {}; // "YYYY-MM" -> { "valorArredondado": [ {despesa,row,categoria,grupo} ] }

  for (const cat of categories) {
    const rowOffset = cat.row - minRow;
    const rowValues = rows[rowOffset] || [];

    MONTH_COLUMNS.forEach((_, monthIdx) => {
      const cellRaw = rowValues[monthIdx];
      const values = extractValuesFromCell(cellRaw);
      if (values.length === 0) return;

      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      if (!index[monthKey]) index[monthKey] = {};

      for (const v of values) {
        const roundedKey = Math.abs(v).toFixed(2);
        if (!index[monthKey][roundedKey]) index[monthKey][roundedKey] = [];
        index[monthKey][roundedKey].push({
          despesa: cat.despesa,
          row: cat.row,
          categoria: cat.categoria,
          grupo: cat.grupo,
        });
      }
    });
  }

  return index;
}

/**
 * Busca um valor no índice, pro mês da data da transação.
 * Retorna: null (sem match), { match: {...} } (match único, confiável),
 * ou { ambiguous: [...] } (mais de uma categoria com esse valor nesse mês).
 */
function lookupAmount(index, transactionDate, amount) {
  const d = new Date(transactionDate);
  const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const roundedKey = Math.abs(amount).toFixed(2);

  const monthData = index[monthKey];
  if (!monthData) return null;

  const matches = monthData[roundedKey];
  if (!matches || matches.length === 0) return null;

  // Agrupa por despesa: múltiplas ocorrências do MESMO valor na MESMA categoria
  // (ex: três compras de R$13 no mesmo lugar no mesmo mês) não são ambiguidade real.
  const uniqueByDespesa = [];
  const seen = new Set();
  for (const m of matches) {
    if (!seen.has(m.despesa)) {
      seen.add(m.despesa);
      uniqueByDespesa.push(m);
    }
  }

  if (uniqueByDespesa.length === 1) return { match: uniqueByDespesa[0] };
  return { ambiguous: uniqueByDespesa };
}

module.exports = { buildAmountIndex, lookupAmount };

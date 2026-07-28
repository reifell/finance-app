const { getSheetsClient, SPREADSHEET_ID } = require('./google_client');

const MONTH_COLUMNS = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']; // Jan..Dez

function monthColumnFor(dateIso) {
  const d = new Date(dateIso);
  const monthIndex = d.getUTCMonth(); // 0-11
  return { column: MONTH_COLUMNS[monthIndex], year: d.getUTCFullYear() };
}

// O Sheets, na localidade pt-BR do usuário, espera vírgula como separador
// decimal dentro de fórmulas digitadas — "3.9" não é interpretado como número.
function formatarValorParaFormula(valor) {
  // Arredonda pra 2 casas evitando problemas de ponto flutuante (ex: 59.199999999)
  const arredondado = Math.round(valor * 100) / 100;
  return arredondado.toString().replace('.', ',');
}

/**
 * Acrescenta `valor` na célula de (despesaRow, mês da data da transação),
 * no estilo "+valor" encadeado à fórmula existente — igual ao hábito manual do usuário.
 * Se a célula estiver vazia, começa uma fórmula nova (=valor).
 */
async function appendValueToCell(row, dateIso, valor) {
  const sheets = await getSheetsClient();
  const { column, year } = monthColumnFor(dateIso);
  const range = `'${year}'!${column}${row}`;
  const valorFormatado = formatarValorParaFormula(valor);

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: 'FORMULA',
  });

  const currentRaw = (current.data.values && current.data.values[0] && current.data.values[0][0]) || '';
  const currentStr = String(currentRaw).trim();

  let newFormula;
  if (!currentStr) {
    newFormula = `=${valorFormatado}`;
  } else if (currentStr.startsWith('=')) {
    newFormula = `${currentStr}+${valorFormatado}`;
  } else {
    // célula tinha um número puro (não fórmula) — vira fórmula preservando o valor antigo
    newFormula = `=${currentStr}+${valorFormatado}`;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED', // pra ser interpretado como fórmula, não texto literal
    requestBody: { values: [[newFormula]] },
  });

  return { range, previousFormula: currentStr, newFormula };
}

module.exports = { appendValueToCell };

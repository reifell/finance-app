const { getSheetsClient, SPREADSHEET_ID } = require('./google_client');
const { ehGrupoValido } = require('./known_groups');

const MONTH_COLUMNS_COUNT = 12; // E..P

const IGNORAR_TEXTO = /^(despesa|receita|total)/i;

// Fórmula que referencia OUTRAS células (ex: "=SOMA(E30:E40)") indica uma
// linha de TOTAL/resumo, diferente de um lançamento individual (só números).
const REFERENCIA_CELULA = /[A-Za-z]{1,2}\d+/;

function pareceLinhaDeTotal(monthCells) {
  return monthCells.some(cell => {
    if (typeof cell !== 'string' || !cell.startsWith('=')) return false;
    return REFERENCIA_CELULA.test(cell);
  });
}

/**
 * Lê dinamicamente a hierarquia direto da aba do ano informado.
 *
 * Só textos que batem com a lista em known_groups.js viram um "novo grupo"
 * (colunas A ou B) — qualquer outro texto nessas colunas é ignorado como
 * legenda/instrução, e o grupo anterior continua valendo. Isso evita que
 * textos de ajuda espalhados pela planilha corrompam a hierarquia.
 *
 * Nomes de despesa duplicados entre seções diferentes (ex: "Outros" aparece
 * em Receitas, Investimentos e Adicionais) são desambiguados automaticamente,
 * recebendo o grupo como sufixo SÓ nos casos que colidem — assim o rótulo
 * fica limpo na maioria das vezes, e só fica mais específico onde precisa.
 */
async function fetchCategories(year) {
  const sheets = await getSheetsClient();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${year}'!A1:P300`,
    valueRenderOption: 'FORMULA',
  });

  const rows = resp.data.values || [];
  const brutas = [];
  let grupoA = null;
  let grupoB = null;
  let categoriaAtual = null;

  rows.forEach((row, idx) => {
    const linhaReal = idx + 1;
    const [a, b, c, d, ...resto] = row;
    const monthCells = resto.slice(0, MONTH_COLUMNS_COUNT);

    if (ehGrupoValido(a)) {
      grupoA = a.trim();
      grupoB = null;
      categoriaAtual = null;
    }
    if (ehGrupoValido(b)) grupoB = b.trim();
    if (c && c.trim() && !ehGrupoValido(c)) categoriaAtual = c.trim();

    const grupoFinal = grupoB || grupoA;
    const despesaTexto = d && d.trim();

    if (!despesaTexto) return;
    if (IGNORAR_TEXTO.test(despesaTexto)) return;
    if (!grupoFinal) return;
    if (pareceLinhaDeTotal(monthCells)) return;

    brutas.push({
      row: linhaReal,
      grupo: grupoFinal,
      categoria: categoriaAtual,
      despesa: despesaTexto,
    });
  });

  // Desambigua nomes de despesa duplicados (ex: "Outros" em várias seções),
  // só nos casos que realmente colidem.
  const contagem = {};
  brutas.forEach(c => { contagem[c.despesa] = (contagem[c.despesa] || 0) + 1; });

  const categorias = brutas.map(c => ({
    ...c,
    despesa: contagem[c.despesa] > 1 ? `${c.despesa} (${c.grupo})` : c.despesa,
  }));

  categorias.sort((a, b) => a.row - b.row);
  return categorias;
}

module.exports = { fetchCategories };

const { getSheetsClient, SPREADSHEET_ID } = require('./google_client');

// Linhas que aparecem na coluna D mas NÃO são despesas de verdade
// (cabeçalhos e linhas de total) — ficam de fora da lista de categorias.
const IGNORAR_DESPESA = /^(despesa|total)/i;

/**
 * Lê dinamicamente a hierarquia Grupo (col B) > Categoria (col C) > Despesa (col D)
 * direto da aba do ano informado. Como o usuário pode editar a planilha manualmente
 * (adicionar novas linhas de despesa, por exemplo), isso é buscado a cada chamada —
 * não depende de um arquivo estático que precisaria ser atualizado à mão.
 *
 * Funciona rastreando o último valor não-vazio visto nas colunas B e C conforme
 * desce pelas linhas (igual à lógica que você já usa pra organizar a planilha:
 * o grupo/categoria só é escrito uma vez, no topo do bloco).
 */
async function fetchCategories(year) {
  const sheets = await getSheetsClient();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${year}'!B1:D200`, // faixa generosa; cobre a planilha inteira com folga
  });

  const rows = resp.data.values || [];
  const categorias = [];
  let grupoAtual = null;
  let categoriaAtual = null;

  rows.forEach((row, idx) => {
    const linhaReal = idx + 1; // porque a faixa começa em B1
    const [b, c, d] = row;

    if (b && b.trim()) grupoAtual = b.trim();
    if (c && c.trim()) categoriaAtual = c.trim();

    if (d && d.trim() && !IGNORAR_DESPESA.test(d.trim())) {
      categorias.push({
        row: linhaReal,
        grupo: grupoAtual,
        categoria: categoriaAtual,
        despesa: d.trim(),
      });
    }
  });

  return categorias;
}

module.exports = { fetchCategories };

// Nomes de GRUPO válidos, exatamente como aparecem na planilha (comparação
// sem acento/case, mas edite aqui se adicionar um grupo novo na planilha).
// Qualquer texto nas colunas A/B que NÃO estiver nesta lista é ignorado
// (tratado como legenda/instrução, não como um novo grupo) — o grupo anterior
// continua valendo.

const GRUPOS_VALIDOS = [
  'Receitas',
  'Investimentos',
  'Despesas',
  'Fixas',
  'Variáveis',
  'Extras',
  'Adicionais',
];

function normalizar(texto) {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SET_NORMALIZADO = new Set(GRUPOS_VALIDOS.map(normalizar));

function ehGrupoValido(texto) {
  if (!texto) return false;
  return SET_NORMALIZADO.has(normalizar(texto));
}

module.exports = { ehGrupoValido };

// Transações que NÃO são despesas de verdade — são dinheiro se movendo entre
// suas próprias contas/produtos, não gasto de fato. Se contadas como despesa,
// gerariam contagem duplicada (cartão) ou não fazem sentido no controle (investimento).
//
// São listas de trechos (case-insensitive) que, se aparecerem na descrição,
// excluem a transação do fluxo de classificação de despesas.
//
// ATENÇÃO: são padrões vistos até agora. Se o texto do banco mudar de formato
// (ex: outro cartão, outro tipo de aplicação), pode precisar adicionar aqui.

const CREDIT_CARD_PAYMENT_PATTERNS = [
  'debito automatico.*pers.*black', // fatura do PERSONNALITE MC BLACK
  // 'debito automatico.*uniclass',  // fatura do ITAU UNICLASS VISA INFINITE — ainda não visto nos dados, ativar quando confirmar o texto real
];

const INVESTMENT_TRANSFER_PATTERNS = [
  'aplicacao.*aplicacao', // ex: "Aplicação APLICACAO PERSONDIF INT"
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isInternalTransfer(description) {
  const norm = normalize(description);
  const allPatterns = [...CREDIT_CARD_PAYMENT_PATTERNS, ...INVESTMENT_TRANSFER_PATTERNS];
  return allPatterns.some(p => new RegExp(p).test(norm));
}

module.exports = { isInternalTransfer };

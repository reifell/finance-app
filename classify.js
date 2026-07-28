const fs = require('fs');
const path = require('path');
const keywordRules = require('./rules.js');

const MEMORY_FILE = path.join(__dirname, 'merchant_memory.json');

function loadMemory() {
  if (!fs.existsSync(MEMORY_FILE)) return {};
  return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// Normaliza descrição de transação pra comparação: minúsculas, sem acento, sem espaços extras
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrai um "identificador de estabelecimento" estável da descrição bruta do banco.
// Descrições do Itaú/Pluggy costumam vir tipo "COMPRA CARTAO SUPERMERCADO XYZ LTDA 12/34"
// Aqui fazemos uma normalização simples; pode precisar de ajuste fino depois com dados reais.
function merchantKey(description) {
  return normalize(description)
    .replace(/\b\d{2}\/\d{2}\b/g, '')      // remove datas tipo 12/34
    .replace(/\b\d{4,}\b/g, '')            // remove números longos (parcelas, ids)
    .replace(/compra cartao|compra debito|pix (enviado|recebido) ?-?/g, '')
    .trim();
}

function findCategoryInfo(despesaName, categories) {
  return categories.find(c => c.despesa === despesaName) || null;
}

/**
 * Classifica uma transação.
 * @param {string} description - descrição bruta vinda do Pluggy
 * @param {number} amount - valor da transação (negativo = saída, positivo = entrada)
 * @param {Array} categories - lista de categorias (buscar com fetchCategories(), em categories_dynamic.js)
 * @returns {object} resultado da classificação
 */
function classify(description, amount, categories) {
  const memory = loadMemory();
  const key = merchantKey(description);

  // 1. Memória (aprendida com respostas anteriores do usuário) — maior confiança
  if (memory[key]) {
    const despesa = memory[key];
    const info = findCategoryInfo(despesa, categories);
    return {
      status: 'confident',
      source: 'memory',
      despesa,
      categoria: info?.categoria,
      grupo: info?.grupo,
      row: info?.row,
    };
  }

  // 2. Regras de palavra-chave — confiança média
  const normDesc = normalize(description);
  for (const [despesa, keywords] of Object.entries(keywordRules)) {
    if (keywords.some(kw => normDesc.includes(kw))) {
      const info = findCategoryInfo(despesa, categories);
      return {
        status: 'confident',
        source: 'keyword',
        despesa,
        categoria: info?.categoria,
        grupo: info?.grupo,
        row: info?.row,
      };
    }
  }

  // 3. Sem confiança — precisa perguntar ao usuário
  return {
    status: 'uncertain',
    source: null,
    despesa: null,
    merchantKey: key,
    rawDescription: description,
    amount,
    candidates: categories.map(c => ({ despesa: c.despesa, categoria: c.categoria, grupo: c.grupo, row: c.row })),
  };
}

/**
 * Chamar isso quando o usuário responder o popup/tela de revisão,
 * pra memorizar a escolha e não perguntar de novo pro mesmo estabelecimento.
 */
function learn(description, despesaEscolhida) {
  const memory = loadMemory();
  const key = merchantKey(description);
  memory[key] = despesaEscolhida;
  saveMemory(memory);
}

module.exports = { classify, learn, merchantKey, normalize };

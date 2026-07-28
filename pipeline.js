require('dotenv').config();
const { classify } = require('./classify');
const { buildAmountIndex, lookupAmount } = require('./sheet_reconciler');
const { isInternalTransfer } = require('./internal_transfers');
const { isProcessed, getLastProcessedDate } = require('./ledger');
const { fetchCategories } = require('./categories_dynamic');

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const ITEM_ID = process.env.PLUGGY_ITEM_ID;

async function getApiKey() {
  const resp = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  });
  const data = await resp.json();
  if (!data.apiKey) throw new Error('Falha na autenticação: ' + JSON.stringify(data));
  return data.apiKey;
}

async function getAccounts(apiKey, itemId) {
  const resp = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, {
    headers: { 'X-API-KEY': apiKey },
  });
  const data = await resp.json();
  if (!data.results) throw new Error('Falha ao buscar contas: ' + JSON.stringify(data));
  return data.results;
}

async function getTransactions(apiKey, accountId, from, to) {
  let page = 1;
  let all = [];
  while (true) {
    const url = `https://api.pluggy.ai/transactions?accountId=${accountId}&from=${from}&to=${to}&page=${page}&pageSize=100`;
    const resp = await fetch(url, { headers: { 'X-API-KEY': apiKey } });
    const data = await resp.json();
    if (!data.results) throw new Error('Falha ao buscar transações: ' + JSON.stringify(data));
    all = all.concat(data.results);
    if (page >= data.totalPages) break;
    page++;
  }
  return all;
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

const isRendimentoAutomatico = (t) => /rend\.?\s*pago\s*aplic/i.test(t.description);

/**
 * Roda o pipeline completo: busca transações, filtra ruído/transferências,
 * classifica com memória+regras+reconciliação, e separa em:
 *  - confidentes: prontas pra escrever direto
 *  - incertas: precisam de decisão do usuário (popup)
 * Transações já processadas antes (ledger) são automaticamente puladas.
 */
const MARGEM_SEGURANCA_DIAS = 3; // volta alguns dias antes da última data processada, pra pegar transações que ainda estavam pendentes/compensando
const PADRAO_PRIMEIRA_RODADA_DIAS = 30;

/**
 * Roda o pipeline completo: descobre automaticamente o período (a partir da
 * última transação já processada, com margem de segurança), busca transações,
 * filtra ruído/transferências, classifica com memória+regras+reconciliação,
 * e separa em confidentes (prontas pra escrever) e incertas (precisam de popup).
 *
 * `daysBackOverride` é opcional — só usado se você quiser forçar um período
 * manualmente (ex: pra reprocessar um intervalo maior de propósito).
 */
async function runPipeline(daysBackOverride) {
  const apiKey = await getApiKey();
  const accounts = await getAccounts(apiKey, ITEM_ID);

  const to = new Date();
  let from;
  let periodoOrigem;

  if (daysBackOverride) {
    from = new Date();
    from.setDate(from.getDate() - daysBackOverride);
    periodoOrigem = 'manual';
  } else {
    const ultimaData = getLastProcessedDate();
    if (ultimaData) {
      from = new Date(ultimaData);
      from.setDate(from.getDate() - MARGEM_SEGURANCA_DIAS);
      periodoOrigem = 'auto (última transação processada, com margem de segurança)';
    } else {
      from = new Date();
      from.setDate(from.getDate() - PADRAO_PRIMEIRA_RODADA_DIAS);
      periodoOrigem = `auto (primeira rodada, padrão de ${PADRAO_PRIMEIRA_RODADA_DIAS} dias)`;
    }
  }

  const fromStr = formatDate(from);
  const toStr = formatDate(to);

  let allTransactions = [];
  for (const account of accounts) {
    const txs = await getTransactions(apiKey, account.id, fromStr, toStr);
    allTransactions = allTransactions.concat(
      txs.map(t => ({ ...t, accountName: account.name, accountType: account.type }))
    );
  }

  const YEAR = String(to.getFullYear());
  const categories = await fetchCategories(YEAR);
  const amountIndex = await buildAmountIndex(YEAR, categories);

  const confidentes = [];
  const incertas = [];
  let ignoradasRendimento = 0;
  let ignoradasTransferencia = 0;
  let jaProcessadas = 0;

  for (const t of allTransactions) {
    if (isProcessed(t.id)) {
      jaProcessadas++;
      continue;
    }
    if (isRendimentoAutomatico(t)) {
      ignoradasRendimento++;
      continue;
    }
    if (isInternalTransfer(t.description)) {
      ignoradasTransferencia++;
      continue;
    }

    const isExpense = t.type === 'DEBIT';
    const valorAbsoluto = Math.abs(t.amount);
    if (!isExpense) continue; // receitas fora do escopo por enquanto

    const base = {
      transactionId: t.id,
      date: t.date,
      description: t.description,
      valorAbsoluto,
    };

    const result = classify(t.description, valorAbsoluto, categories);
    if (result.status === 'confident') {
      confidentes.push({ ...base, despesa: result.despesa, categoria: result.categoria, grupo: result.grupo, row: result.row, source: result.source });
      continue;
    }

    const reconciled = lookupAmount(amountIndex, t.date, valorAbsoluto);
    if (reconciled && reconciled.match) {
      confidentes.push({ ...base, despesa: reconciled.match.despesa, categoria: reconciled.match.categoria, grupo: reconciled.match.grupo, row: reconciled.match.row, source: 'planilha' });
    } else {
      incertas.push({
        ...base,
        candidatos: reconciled && reconciled.ambiguous ? reconciled.ambiguous.map(m => m.despesa) : [],
      });
    }
  }

  return {
    periodo: { from: fromStr, to: toStr, origem: periodoOrigem },
    ignoradasRendimento,
    ignoradasTransferencia,
    jaProcessadas,
    confidentes,
    incertas,
  };
}

module.exports = { runPipeline };

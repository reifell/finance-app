require('dotenv').config();
const express = require('express');
const path = require('path');
const { runPipeline } = require('./pipeline');
const { learn } = require('./classify');
const { appendValueToCell } = require('./writer');
const { markProcessed } = require('./ledger');
const { fetchCategories } = require('./categories_dynamic');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Lista de despesas pro dropdown do frontend — buscada da planilha viva a cada chamada,
// então categorias novas que você criar manualmente na planilha aparecem sem precisar mexer no código.
app.get('/api/categories', async (req, res) => {
  try {
    const year = String(new Date().getFullYear());
    const categories = await fetchCategories(year);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Roda o pipeline completo (Pluggy -> classificação) e devolve confidentes + incertas
app.post('/api/sync', async (req, res) => {
  try {
    const days = req.body.days ? parseInt(req.body.days, 10) : undefined;
    const result = await runPipeline(days);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Recebe a decisão final do usuário pra uma lista de transações (confirmadas na tela de revisão)
 * e escreve cada uma na planilha. Formato esperado de cada item:
 * { transactionId, date, description, valorAbsoluto, despesa, memorize }
 */
app.post('/api/confirm', async (req, res) => {
  const items = req.body.items || [];
  const resultados = [];

  const year = String(new Date().getFullYear());
  const categories = await fetchCategories(year);

  for (const item of items) {
    try {
      const catInfo = categories.find(c => c.despesa === item.despesa);
      if (!catInfo) {
        resultados.push({ transactionId: item.transactionId, ok: false, error: `Despesa "${item.despesa}" não encontrada na planilha (foi renomeada ou removida?)` });
        continue;
      }

      if (item.memorize) {
        learn(item.description, item.despesa);
      }

      const writeResult = await appendValueToCell(catInfo.row, item.date, item.valorAbsoluto);
      markProcessed(item.transactionId, { despesa: item.despesa, valor: item.valorAbsoluto, date: item.date });

      resultados.push({
        transactionId: item.transactionId,
        ok: true,
        despesa: item.despesa,
        categoria: catInfo.categoria,
        grupo: catInfo.grupo,
        valor: item.valorAbsoluto,
        cell: writeResult.range,
      });
    } catch (err) {
      console.error(err);
      resultados.push({ transactionId: item.transactionId, ok: false, error: err.message });
    }
  }

  // Resumo por grupo/categoria, pra tela de resumo final
  const resumo = {};
  for (const r of resultados) {
    if (!r.ok) continue;
    const key = `${r.grupo} > ${r.categoria}`;
    resumo[key] = (resumo[key] || 0) + r.valor;
  }

  res.json({ resultados, resumo, total: resultados.filter(r => r.ok).reduce((s, r) => s + r.valor, 0) });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

// Regras de PONTO DE PARTIDA, baseadas em nomes comuns de estabelecimentos no Brasil.
// NÃO vêm do seu histórico real (não temos descrição de transação nos dados antigos).
// Edite/apague à vontade — a memória por estabelecimento (merchant_memory.json)
// sempre tem prioridade sobre isso e cresce com suas respostas reais.
//
// Formato: despesa (precisa bater exatamente com o campo "despesa" em categories.json)
// -> lista de palavras/trechos (case-insensitive, sem acento) que, se aparecerem
// na descrição da transação, sugerem essa despesa.

module.exports = {
  'Supermercado': ['pao de acucar', 'carrefour', 'extra hiper', 'zaffari', 'assai', 'atacad', 'mercado', 'supermerc', 'condor', 'angeloni', 'bistek', 'acougue', 'fiambreria', 'casa carnes', 'casa de carnes', 'armazem'],
  'Academia': ['smartfit', 'smart fit', 'bluefit', 'academia'],
  'netflix': ['netflix'],
  'spotfy': ['spotify'],
  'youtube': ['youtube', 'google *you', 'google one'],
  'amazon': ['amazon', 'amzn', 'prime video'],
  'hbo': ['hbo', 'max streaming'],
  'taxi': ['uber', '99app', '99*', '99pop', '99tecnologia', 'patinete'],
  'Restaurantes/bares': ['restaurante', 'pizzaria', 'burger', 'churrascaria', 'espeto', 'caos bar', 'fruto coletivo', 'espaco 512'],
  'Lanche/almoço': ['ifood', 'rappi', 'lanchonete', 'ifd*', 'espaco 32'],
  'Padaria': ['padaria', 'panificadora'],
  'Combustível': ['posto', 'ipiranga', 'shell', 'petrobras', 'combustivel', 'auto posto'],
  'Internet': ['vivo fibra', 'net virtua', 'claro net', 'oi fibra'],
  'Luz': ['enel', 'cpfl', 'light sa', 'cemig', 'copel'],
  'Água': ['sabesp', 'corsan', 'copasa', 'sanepar'],
  'Condomínio': ['condominio'],
  'Medicamentos': ['drogaria', 'farmacia', 'drogasil', 'droga raia', 'pague menos', 'farmatec', 'panvel'],
  'Cabeleireiro': ['salao', 'barbearia'],
  'Roupas': ['renner', 'c&a', 'riachuelo', 'zara'],
  'Viagens': ['gol linhas'], // confirmado pelo usuário; outras cias aéreas ainda não mapeadas
};

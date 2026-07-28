const { learn } = require('./classify');

// Confirmado pelo usuário: PIX pra Leila é faxina
learn('Pix enviado por Whatsapp LEILA TERESINHA GONCALVES', 'faxina');

console.log('Memória atualizada. Veja merchant_memory.json');

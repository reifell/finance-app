# Setup — Controle de Despesas (Itaú → Google Sheets)

## 1. Pré-requisitos
- [Node.js](https://nodejs.org) versão 18 ou mais nova instalado
- Confirme no terminal: `node -v`

## 2. Arquivos do projeto
Todos esses arquivos precisam estar na mesma pasta:

```
finance-app/
├── server.js
├── pipeline.js
├── classify.js
├── rules.js
├── sheet_reconciler.js
├── internal_transfers.js
├── sheet_ledger.js
├── writer.js
├── google_client.js
├── categories_dynamic.js
├── package.json
├── .env                        <- você cria a partir do .env.example
├── service-account-key.json    <- você baixa do Google Cloud
└── public/
    └── index.html
```

## 3. Instalar dependências
Na pasta do projeto:
```bash
npm install
```

## 4. Conectar ao Pluggy (dados bancários)
1. Crie uma conta em https://dashboard.pluggy.ai e uma Aplicação
2. Pegue `CLIENT_ID` e `CLIENT_SECRET` da aplicação
3. Conecte sua conta do Itaú via **Meu Pluggy** (https://meu.pluggy.ai) — login com Open Finance, sem custo
4. No Dashboard, abra sua Aplicação → **"Ir para Demo"** → conecte o conector **MeuPluggy** → copie o **Item ID** gerado (menu de três pontinhos)

## 5. Conectar ao Google Sheets
1. No [Google Cloud Console](https://console.cloud.google.com), crie/abra um projeto
2. Ative a **Google Sheets API**
3. Crie uma **Service Account** (IAM e administrador → Contas de serviço) e gere uma chave **JSON**
4. Renomeie o arquivo baixado para `service-account-key.json` e coloque na pasta do projeto
5. Abra o `service-account-key.json`, copie o campo `client_email`
6. Na sua planilha do Google Sheets, clique em **Compartilhar** e adicione esse e-mail como **Editor**
7. **Importante:** a planilha precisa ser um Google Sheets nativo (não um `.xlsx` só hospedado no Drive) — se for `.xlsx`, use **Arquivo → Salvar como Planilhas Google** primeiro

## 6. Preencher o `.env`
Copie `.env.example` para um novo arquivo chamado `.env` e preencha:
```
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
PLUGGY_ITEM_ID=...
GOOGLE_SPREADSHEET_ID=...        (trecho da URL da planilha entre /d/ e /edit)
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account-key.json
```

## 7. Rodar
```bash
node server.js
```
Abra no navegador: **http://localhost:3000**

Se a porta 3000 já estiver em uso:
```bash
PORT=4000 node server.js
```

## 8. Usar
1. Clique em **Sincronizar** — o app detecta sozinho o período (baseado na última transação já processada)
2. Revise a tabela: itens em destaque (âmbar) precisam de categoria escolhida no dropdown
3. Marque "memorizar" nos que quiser que o app lembre pra próxima vez
4. Clique em **Confirmar tudo e gravar na planilha**

## Segurança
- **Nunca** compartilhe `.env` ou `service-account-key.json`, nem suba eles pro Git
- Se usar Git, adicione ambos no `.gitignore` antes do primeiro commit

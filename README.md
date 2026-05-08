# IGD Dashboard — Servidor Node.js

## Estrutura
```
igd-server/
├── server.js        # Entrada principal
├── routes.js        # Todas as rotas da API
├── data.js          # Leitura/cache dos dados da planilha
├── sheets.js        # Conector Google Sheets API
├── cache.js         # Cache em memória
├── utils.js         # Utilitários
├── api.js           # Arquivo para substituir no frontend
├── render.yaml      # Configuração do Render
├── package.json
├── .env             # NÃO commitar no Git
└── public/          # Cole aqui os arquivos do frontend
    ├── index.html
    └── js/
        ├── api.js   ← substituir pelo api.js deste projeto
        ├── app.js
        └── ...
```

## Setup local

1. Instalar dependências:
```bash
npm install
```

2. Criar o `.env` com as credenciais (já está criado com os valores corretos)

3. Rodar:
```bash
npm run dev
```

## Deploy no Render

### 1. Preparar o repositório

1. Crie um repositório no GitHub (pode ser privado)
2. Copie todos estes arquivos para o repositório
3. Copie os arquivos do frontend para a pasta `public/`
4. Substitua o `public/js/api.js` pelo `api.js` deste projeto
5. **NÃO commite o `.env`** — ele está no `.gitignore`

### 2. Deploy no Render

1. Acesse [render.com](https://render.com) e crie uma conta
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. O Render vai detectar o `render.yaml` automaticamente
5. Na tela de configuração, adicione a variável de ambiente:
   - **GOOGLE_PRIVATE_KEY**: cole o conteúdo do campo `private_key` do arquivo JSON (com as aspas)
6. Clique **"Deploy"**

### 3. Após o deploy

- A URL do seu app será algo como `https://igd-dashboard.onrender.com`
- No plano gratuito o servidor "dorme" após 15min sem uso — plano pago ($7/mês) fica sempre ativo

## Variáveis de ambiente necessárias no Render

| Variável | Valor |
|---|---|
| SPREADSHEET_ID | `1ehXhBEU4O16I_eor58241osEBhHViHztaedkV9tsors` |
| GOOGLE_CLIENT_EMAIL | `igd-sheets@igd-dashboard.iam.gserviceaccount.com` |
| GOOGLE_PRIVATE_KEY | *(conteúdo do private_key do JSON)* |
| CACHE_TTL | `300` |
| NODE_ENV | `production` |

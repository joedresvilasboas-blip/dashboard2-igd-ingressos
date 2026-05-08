# Dashboard IGD — Ingressos

PWA para gestão comercial de ingressos da equipe IGD.

## Setup

### 1. GitHub Pages

1. Crie um repositório público no GitHub chamado `dashboard-igd-ingressos`
2. Faça upload de todos os arquivos desta pasta
3. Vá em **Settings → Pages → Source: Deploy from branch → main**
4. Acesse: `https://joedresvilasboas-blip.github.io/dashboard-igd-ingressos`

### 2. Google Apps Script

1. Abra sua planilha no Google Sheets
2. Extensões → Apps Script
3. Cole o conteúdo de `backend/Code.gs`
4. Deploy → Novo deploy → Web App → Qualquer pessoa
5. Copie a URL gerada

### 3. Configurar URL da API

Abra `js/api.js` e substitua:
```js
BASE_URL: 'https://script.google.com/macros/s/SEU_ID_AQUI/exec',
```
pela URL do seu Web App.

### 4. Senhas

As senhas padrão são:
- **Admin:** `igd@admin2026`
- **Vendedor:** `igd@vendas2026`

Para alterar, gere o SHA-256 da nova senha em [emn178.github.io/online-tools/sha256.html](https://emn178.github.io/online-tools/sha256.html) e substitua em `js/auth.js`.

### 5. Instalar como App

**iPhone:** Abrir no Safari → Compartilhar → Adicionar à Tela de Início  
**Android:** Abrir no Chrome → Menu → Adicionar à tela inicial

## Estrutura

```
dashboard-igd-ingressos/
├── index.html          # Shell do PWA
├── manifest.json       # Configuração PWA
├── sw.js               # Service Worker (offline)
├── css/
│   └── app.css         # Estilos
├── js/
│   ├── app.js          # Router principal
│   ├── auth.js         # Autenticação
│   ├── api.js          # Conector GAS
│   ├── login.js        # Tela de login
│   ├── dashboard.js    # Dashboard
│   ├── estrelas.js     # Estrelas
│   ├── ranking.js      # Ranking
│   ├── relatorios.js   # Relatórios
│   ├── upload.js       # Upload CSV
│   └── cadastros.js    # Cadastros
└── icons/
    ├── icon-192.png    # Ícone PWA
    └── icon-512.png    # Ícone PWA
```

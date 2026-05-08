// ====================================================
// SERVER.JS — Servidor principal Node.js
// IGD Dashboard Backend
// ====================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const routes  = require('./routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve os arquivos estáticos do frontend (pasta public/)
app.use(express.static(path.join(__dirname, 'public')));

// Todas as rotas da API em /api
app.use('/api', routes);

// Compatibilidade: o frontend atual usa uma única BASE_URL que recebe `action`
// Esta rota unifica GET e POST para manter compatibilidade sem mudar o frontend
app.all('/exec', async (req, res) => {
  const action = req.query.action || req.body?.action || '';
  if (!action) return res.json({ erro: 'action obrigatória' });

  // Redireciona internamente para a rota correta
  req.url = `/api/${action}`;
  req.path = `/${action}`;
  routes.handle(req, res, () => res.json({ erro: `Rota não encontrada: ${action}` }));
});

// Fallback: serve o index.html para qualquer rota não encontrada (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ IGD Dashboard rodando na porta ${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}`);
  console.log(`   API:      http://localhost:${PORT}/api`);
});

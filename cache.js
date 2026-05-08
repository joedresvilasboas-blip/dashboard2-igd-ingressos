// ====================================================
// CACHE.JS — Cache em memória com TTL
// ====================================================
const NodeCache = require('node-cache');
require('dotenv').config();

const TTL = parseInt(process.env.CACHE_TTL) || 300; // 5 minutos
const cache = new NodeCache({ stdTTL: TTL, checkperiod: 60 });

// Nomes das abas
const ABA = {
  VENDAS:       'VENDAS',
  VENDEDORES:   'VENDEDORES',
  EQUIPES:      'EQUIPES',
  EVENTOS:      'EVENTOS',
  OCS:          'OCS_PLANOS',
  CALENDARIO:   'CALENDARIO',
  CONFIG:       'CONFIG',
  REGRAS_CANAL: 'REGRAS_CANAL',
  RD_VENDEDORES:'RD_VENDEDORES',
};

// Nomes das colunas da aba VENDAS
const V_NOMES = {
  ID:          'ID_CENTRAL',
  DT_PAG:      'DATA_PAGAMENTO',
  DT_REG:      'DATA_REGISTRO',
  COD_VEND:    'COD_VENDEDOR',
  NOME_VEND:   'NOME_VENDEDOR',
  EQUIPE:      'EQUIPE',
  NOME_CLI:    'NOME_CLIENTE',
  EMAIL:       'EMAIL',
  FONE:        'FONE',
  PLANO:       'PLANO',
  OC:          'OC',
  EVENTO:      'EVENTO',
  CANAL:       'CANAL',
  CANAL_MACRO: 'CANAL_MACRO',
  CATEGORIA:   'CATEGORIA',
  HC:          'HCs',
  VALOR:       'VALOR',
  STATUS:      'STATUS',
  PONTOS:      'PONTOS',
  SEMANA:      'SEMANA',
  MES:         'MES',
  DT_CANCEL:   'DT_CANCELAMENTO',
  ID_VENDA:    'ID_VENDA',
  CPF:         'CPF',
};

function get(key) { return cache.get(key); }
function set(key, val) { cache.set(key, val); }
function del(key) { cache.del(key); }
function flush() { cache.flushAll(); }

module.exports = { cache, get, set, del, flush, ABA, V_NOMES };

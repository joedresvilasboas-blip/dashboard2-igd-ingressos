// ====================================================
// DATA.JS — Leitura centralizada de todas as abas
// ====================================================
const { lerAba } = require('./sheets');
const { get, set, ABA, V_NOMES } = require('./cache');
const { buildColMap, toDateStr } = require('./utils');

let _colMap = null;

async function getColMap() {
  if (_colMap) return _colMap;
  const rows = await lerAba(ABA.VENDAS);
  if (!rows.length) return {};
  _colMap = buildColMap(rows[0]);
  return _colMap;
}

function resetColMap() { _colMap = null; }

// Acessa valor por chave semântica (V_NOMES)
async function vv(row, chave) {
  const map = await getColMap();
  const nomeCol = V_NOMES[chave];
  const idx = map[nomeCol];
  if (idx === undefined) return '';
  return row[idx] !== undefined ? row[idx] : '';
}

// Lê todas as linhas de VENDAS (sem cabeçalho), com cache
async function getVendasRows() {
  const cached = get('vendas_rows');
  if (cached) return cached;

  const rows = await lerAba(ABA.VENDAS);
  if (rows.length < 2) return [];

  // Guarda cabeçalho no colMap
  _colMap = buildColMap(rows[0]);

  // Retorna apenas linhas de dados (sem cabeçalho)
  const data = rows.slice(1);
  set('vendas_rows', data);
  return data;
}

async function getVendedores() {
  const cached = get('vendedores');
  if (cached) return cached;
  const rows = await lerAba(ABA.VENDEDORES);
  if (rows.length < 2) return [];
  const data = rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({
      codigo:   String(r[0]||'').trim(),
      nome:     String(r[1]||'').trim(),
      apelido:  String(r[2]||'').trim(),
      equipe:   String(r[3]||'').trim(),
      nivel:    String(r[4]||'JUNIOR').trim().toUpperCase(),
      ativo:    String(r[5]||'').trim().toUpperCase() === 'SIM',
      dtInicio: String(r[6]||'').trim(),
    }));
  set('vendedores', data);
  return data;
}

async function getEquipes() {
  const cached = get('equipes');
  if (cached) return cached;
  const rows = await lerAba(ABA.EQUIPES);
  if (rows.length < 2) return [];
  const data = rows.slice(1)
    .filter(r => r[0])
    .map(r => ({ nome: String(r[0]||'').trim(), lider: String(r[1]||'').trim() }));
  set('equipes', data);
  return data;
}

async function getEventos() {
  const cached = get('eventos');
  if (cached) return cached;
  const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const rows = await lerAba(ABA.EVENTOS);
  if (rows.length < 2) return [];
  const data = rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => {
      let mesAno = r[4];
      if (mesAno && mesAno.toString().includes('/')) {
        // formato DD/MM/YYYY do Sheets
        const d = new Date(mesAno);
        if (!isNaN(d)) mesAno = meses[d.getMonth()] + String(d.getFullYear()).slice(2);
      }
      return {
        codigo:    String(r[0]||'').trim(),
        nome:      String(r[1]||'').trim(),
        produto:   String(r[2]||'').trim(),
        cidade:    String(r[3]||'').trim(),
        mesAno:    String(mesAno||'').trim(),
        dtIniVend: String(r[5]||'').trim().slice(0,10),
        dtEvento:  String(r[6]||'').trim().slice(0,10),
        dtFimEv:   String(r[7]||'').trim().slice(0,10),
        capacidade: parseInt(r[8]) || '',
      };
    });
  set('eventos', data);
  return data;
}

async function getOCs() {
  const cached = get('ocs');
  if (cached) return cached;
  const rows = await lerAba(ABA.OCS);
  if (rows.length < 2) return [];
  const data = rows.slice(1)
    .filter(r => r[0])
    .map(r => ({
      oc:         String(r[0]||'').trim(),
      plano:      String(r[1]||'').trim(),
      eventoCod:  String(r[2]||'').trim(),
      canal:      String(r[3]||'').trim(),
      categoria:  String(r[4]||'').trim(),
      canalMacro: String(r[5]||'').trim(),
    }));
  set('ocs', data);
  return data;
}

async function getCalendario() {
  const cached = get('calendario');
  if (cached) return cached;
  const rows = await lerAba(ABA.CALENDARIO);
  if (rows.length < 2) return [];
  const data = rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => {
      const strIni = String(r[1]||'').trim().slice(0,10);
      const strFim = String(r[2]||'').trim().slice(0,10);
      const pI = strIni.split('-'), pF = strFim.split('-');
      return {
        num:    parseInt(r[0]),
        strIni, strFim,
        label:  `${pI[2]}/${pI[1]} a ${pF[2]}/${pF[1]}`,
        mes:    String(r[3]||'').trim(),
      };
    });
  set('calendario', data);
  return data;
}

async function getConfig() {
  const cached = get('config');
  if (cached) return cached;
  const rows = await lerAba(ABA.CONFIG);
  const cfg = { META_JUNIOR: 10, META_PLENO: 16 };
  rows.slice(1).forEach(r => { if (r[0]) cfg[String(r[0]).trim()] = r[1]; });
  set('config', cfg);
  return cfg;
}

async function getRegrasCanal() {
  const cached = get('regras_canal');
  if (cached) return cached;
  const rows = await lerAba(ABA.REGRAS_CANAL);
  if (rows.length < 2) return [];
  const data = rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({
      padrao:     String(r[0]||'').trim(),
      canal:      String(r[1]||'').trim(),
      tipo:       String(r[2]||'contem').trim(),
      canalMacro: String(r[3]||'').trim(),
      fonte:      String(r[4]||'OC').trim().toUpperCase(),
    }));
  set('regras_canal', data);
  return data;
}

// Invalida todo o cache
function invalidarCache() {
  const { flush } = require('./cache');
  flush();
  _colMap = null;
}

module.exports = {
  getColMap, resetColMap, vv,
  getVendasRows, getVendedores, getEquipes, getEventos,
  getOCs, getCalendario, getConfig, getRegrasCanal,
  invalidarCache,
};

// ====================================================
// UTILS.JS — Utilitários gerais
// ====================================================

const TZ = 'America/Sao_Paulo';

function hojeStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function dataStr(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return dataStr(val);
  const s = String(val).trim();
  // YYYY-MM-DD (já no formato correto)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY ou D/M/YYYY (padrão brasileiro)
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // Número serial do Excel/Sheets (dias desde 30/12/1899)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial > 40000 && serial < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return d.toISOString().slice(0, 10);
    }
  }
  return '';
}

function parsarData(str) {
  if (!str) return null;
  str = String(str).trim();
  let m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], 0);
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1]);
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  return null;
}

function fmtBR(str) {
  if (!str) return '';
  const p = String(str).split('-');
  if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
  return str;
}

function fmtMoeda(v) {
  return 'R$ ' + Number(v || 0).toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function isCancelado(status) {
  return String(status || '').trim().toUpperCase() === 'CANCELADO';
}

function buildColMap(header) {
  const map = {};
  header.forEach((nome, i) => { if (nome) map[String(nome).trim()] = i; });
  return map;
}

function v(row, colMap, nomeCol) {
  const idx = colMap[nomeCol];
  if (idx === undefined) return '';
  return row[idx] !== undefined ? row[idx] : '';
}

function getFeriados(ano) {
  const a = ano % 19, b = Math.floor(ano/100), c = ano % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const mes = Math.floor((h+l-7*m+114)/31);
  const dia = ((h+l-7*m+114) % 31) + 1;
  const pascoa = new Date(ano, mes-1, dia);
  const add = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
  const fmt = d => String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const moveis = [add(pascoa,-48), add(pascoa,-47), add(pascoa,-2), pascoa, add(pascoa,60)];
  const fixos = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'];
  const todos = fixos.map(f => `${ano}-${f}`);
  moveis.forEach(d => todos.push(`${d.getFullYear()}-${fmt(d)}`));
  return todos;
}

function isDiaUtil(strD) {
  const d = new Date(strD + 'T12:00:00');
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !getFeriados(d.getFullYear()).includes(strD);
}

function diasUteisEntre(strIni, strFim) {
  let count = 0;
  const cur = new Date(strIni + 'T12:00:00');
  const fim = new Date(strFim + 'T12:00:00');
  while (cur <= fim) {
    const s = cur.toLocaleDateString('sv-SE');
    if (isDiaUtil(s)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

module.exports = {
  TZ, hojeStr, dataStr, toDateStr, parsarData, fmtBR, fmtMoeda,
  isCancelado, buildColMap, v, getFeriados, isDiaUtil, diasUteisEntre
};

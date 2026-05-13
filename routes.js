// ====================================================
// ROUTES.JS — Todas as rotas da API
// ====================================================
const express = require('express');
const router = express.Router();
const { lerAba, escreverRange, adicionarLinhas } = require('./sheets');
const {
  getVendasRows, getVendedores, getEquipes, getEventos,
  getOCs, getCalendario, getConfig, getRegrasCanal, invalidarCache, getColMap, resetColMap
} = require('./data');
const { ABA, V_NOMES } = require('./cache');
const {
  hojeStr, toDateStr, fmtBR, fmtMoeda, isCancelado,
  parsarData, dataStr, diasUteisEntre
} = require('./utils');

// ====================================================
// HELPERS
// ====================================================
function vRow(row, colMap, chave) {
  const nomeCol = V_NOMES[chave];
  const idx = colMap[nomeCol];
  if (idx === undefined) return '';
  return row[idx] !== undefined ? row[idx] : '';
}

function inferirCategoria(plano) {
  const p = (plano || '').toUpperCase();
  if (p.includes('UPGRADE')) return 'UPGRADE';
  if (p.includes('VIP') || p.includes('CAT2')) return 'VIP';
  if (p.includes('ESSENTIAL') || p.includes('CAT1')) return 'ESSENTIAL';
  return 'NORMAL';
}

function extrairHC(plano) {
  const m = plano.match(/(\d+)\s*TKT/i);
  return m ? parseInt(m[1]) : 1;
}

function inferirEvento(plano) {
  if (!plano) return '';
  const partes = plano.split('|').map(p => p.trim());
  if (partes.length >= 2) {
    const sigla = partes[0], mesAno = partes[1];
    let local = '';
    for (let i = 2; i < partes.length; i++) {
      if (/^PRES\s+/i.test(partes[i])) { local = partes[i].replace(/^PRES\s+/i,'').trim(); break; }
    }
    return local ? `${sigla} ${local} - ${mesAno}` : `${sigla} - ${mesAno}`;
  }
  return partes[0] || '';
}

async function inferirCanal(oc, plano) {
  const regras = await getRegrasCanal();
  const prioridade = { igual_a: 1, comeca_com: 2, termina_com: 3, contem: 4 };
  regras.sort((a, b) => {
    const pa = prioridade[a.tipo] || 99, pb = prioridade[b.tipo] || 99;
    if (pa !== pb) return pa - pb;
    return b.padrao.length - a.padrao.length;
  });

  function testar(texto, r) {
    const p = r.padrao.toUpperCase();
    if (r.tipo === 'igual_a')     return texto === p;
    if (r.tipo === 'comeca_com')  return texto.startsWith(p);
    if (r.tipo === 'termina_com') return texto.endsWith(p);
    return texto.includes(p);
  }

  const ocUp = (oc || '').toUpperCase(), planoUp = (plano || '').toUpperCase();
  if (planoUp) {
    for (const r of regras) {
      if (r.fonte === 'PLANO' && testar(planoUp, r)) return { canal: r.canal, canalMacro: r.canalMacro || '' };
    }
  }
  if (ocUp) {
    for (const r of regras) {
      if (r.fonte !== 'PLANO' && testar(ocUp, r)) return { canal: r.canal, canalMacro: r.canalMacro || '' };
    }
  }
  return { canal: '', canalMacro: '' };
}

// ====================================================
// PING
// ====================================================
router.post('/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));
router.get('/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ====================================================
// CONFIG
// ====================================================
router.get('/config', async (req, res) => {
  try {
    const cfg   = await getConfig();
    const sems  = await getCalendario();
    const hojeS = hojeStr();

    const mesesVistos = {}, meses = [];
    sems.forEach(s => {
      if (s.mes && !mesesVistos[s.mes]) {
        mesesVistos[s.mes] = true;
        const semsDoMes = sems.filter(x => x.mes === s.mes);
        meses.push({
          nome: s.mes,
          strIni: semsDoMes[0].strIni,
          strFim: semsDoMes[semsDoMes.length-1].strFim,
          inicio: new Date(semsDoMes[0].strIni).getTime(),
          fim:    new Date(semsDoMes[semsDoMes.length-1].strFim + 'T23:59:59').getTime(),
        });
      }
    });

    let mesVigIdx = meses.length - 1;
    meses.forEach((m, i) => { if (hojeS >= m.strIni && hojeS <= m.strFim) mesVigIdx = i; });
    let semVigIdx = null;
    sems.forEach((s, i) => { if (hojeS >= s.strIni && hojeS <= s.strFim) semVigIdx = i; });

    const regras = await getRegrasCanal();
    const canaisSet = {};
    regras.forEach(r => { if (r.canal) canaisSet[r.canal] = true; });
    const eventosSet = {};
    (await getEventos()).forEach(e => { if (e.nome) eventosSet[e.nome] = true; });

    res.json({
      meses, semanas: sems, mesVigIdx, semVigIdx, hojeStr: hojeS,
      metaJunior: parseInt(cfg.META_JUNIOR) || 10,
      metaPleno:  parseInt(cfg.META_PLENO)  || 16,
      vendedores: await getVendedores(),
      equipes:    await getEquipes(),
      eventos:    await getEventos(),
      canais:     Object.keys(canaisSet).sort(),
      categorias: ['NORMAL','ESSENTIAL','VIP','UPGRADE'],
      status:     ['PAGO','GRATUITO','CANCELADO'],
      eventosFiltro: Object.keys(eventosSet).sort(),
      canaisMacro:   ['VA','VD','RC','GT'],
    });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// INVALIDAR CACHE
// ====================================================
router.post('/invalidar_cache', (req, res) => {
  invalidarCache();
  res.json({ ok: true });
});

// ====================================================
// ESTRELAS
// ====================================================
router.get('/estrelas', async (req, res) => {
  try {
    const cfg   = await getConfig();
    const mj    = parseInt(cfg.META_JUNIOR) || 10;
    const mp    = parseInt(cfg.META_PLENO)  || 16;
    const sems  = await getCalendario();
    const vends = (await getVendedores()).filter(v => v.ativo);
    const hojeS = hojeStr();
    const colMap = await getColMap();
    const vendas = await getVendasRows();

    let semVig = null;
    sems.forEach(s => { if (hojeS >= s.strIni && hojeS <= s.strFim) semVig = s; });

    function calcEstrelas(ptsPorSem) {
      // Arredonda para 6 casas para evitar erro de ponto flutuante (1/3 + 1/3 + ... != 5)
      const r6 = n => Math.round(n * 1000000) / 1000000;

      let acum = [], total = 0;
      ptsPorSem.forEach(v => {
        const int = Math.floor(v / mj), resto = v - int * mj;
        total = r6(total + int + (resto >= mj/2 ? 1/3 : 0));
        acum.push(total);
      });
      const jr_max = acum.length ? acum[acum.length-1] : 0;
      // Usa tolerância de 0.001 para evitar falha por ponto flutuante
      const st = acum.filter(a => a < 4.999).length;
      const ja = st <= 0 ? 0 : acum[st-1];
      const vt = st >= ptsPorSem.length ? 0 : ptsPorSem[st];
      const pontosParaPromover = (15 - Math.round(ja * 3)) * (mj / 2);
      const vs = Math.max(0, vt - pontosParaPromover);
      let pl = 0;
      ptsPorSem.forEach((v, i) => {
        const pts = i > st ? v : (i === st ? vs : 0);
        const int = Math.floor(pts / mp), resto = pts - int * mp;
        pl = r6(pl + int + (resto >= mp/2 ? 1/3 : 0));
      });
      const res = jr_max >= 4.999 ? 5 + pl : jr_max;
      let nivel, estrelas;
      if (res >= 9.999)     { nivel = 'SENIOR'; estrelas = 5; }
      else if (res >= 4.999) { nivel = 'PLENO';  estrelas = res - 5; }
      else                   { nivel = 'JUNIOR'; estrelas = res; }
      return { nivel, estrelas: Math.round(estrelas*1000)/1000,
        inteiras: Math.floor(estrelas),
        tercos: Math.round((estrelas - Math.floor(estrelas)) * 3),
        meta: nivel === 'PLENO' ? mp : mj };
    }

    const vendedores = vends.map(vend => {
      const ptsPorSem = sems.map(s => {
        let total = 0;
        vendas.forEach(row => {
          if (String(vRow(row, colMap, 'COD_VEND')).trim() !== vend.codigo) return;
          if (String(vRow(row, colMap, 'CANAL')).trim() !== 'VA SALES') return;
          const strD = toDateStr(vRow(row, colMap, 'DT_PAG'));
          if (strD >= s.strIni && strD <= s.strFim) total += parseFloat(vRow(row, colMap, 'PONTOS')) || 0;
        });
        return total;
      });
      const calc = calcEstrelas(ptsPorSem);
      let ptsSemVig = 0;
      if (semVig) {
        vendas.forEach(row => {
          if (String(vRow(row, colMap, 'COD_VEND')).trim() !== vend.codigo) return;
          if (String(vRow(row, colMap, 'CANAL')).trim() !== 'VA SALES') return;
          const strD = toDateStr(vRow(row, colMap, 'DT_PAG'));
          if (strD >= semVig.strIni && strD <= semVig.strFim) ptsSemVig += parseFloat(vRow(row, colMap, 'PONTOS')) || 0;
        });
      }
      const meta = calc.meta, resto = ptsSemVig % meta;
      const falta = ptsSemVig === 0 ? meta : (resto >= meta/2 ? meta - resto : Math.ceil(meta/2) - resto);
      return {
        codigo: vend.codigo, nome: vend.nome, equipe: vend.equipe,
        nivel: calc.nivel, estrelas: calc.estrelas, inteiras: calc.inteiras, tercos: calc.tercos,
        ptsSemVig, falta, pct: Math.round((resto / meta) * 100),
        completa: ptsSemVig > 0 && (Math.floor(ptsSemVig/meta) > 0 || resto >= meta/2),
      };
    });

    vendedores.sort((a, b) => {
      const o = { SENIOR:0, PLENO:1, JUNIOR:2 };
      if (o[a.nivel] !== o[b.nivel]) return o[a.nivel] - o[b.nivel];
      return b.estrelas - a.estrelas;
    });
    res.json({ vendedores });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// RANKING
// ====================================================
// ====================================================
// RANKING TIME — aceita filtros de mês, semana, evento, canal, status
// ====================================================
router.post('/ranking_time', async (req, res) => {
  try {
    const { strIni, strFim, canal, evento, status } = req.body;
    const colMap  = await getColMap();
    const dados   = await getVendasRows();
    const vends   = await getVendedores();
    const mapaApelido = {};
    vends.forEach(v => { mapaApelido[v.codigo] = { apelido: v.apelido || v.nome, equipe: v.equipe, nivel: v.nivel }; });

    const indMap = {};
    dados.forEach(row => {
      const canalRow  = String(vRow(row, colMap, 'CANAL') || '').trim();
      const eventoRow = String(vRow(row, colMap, 'EVENTO')|| '').trim();
      const statusRow = String(vRow(row, colMap, 'STATUS')|| '').trim().toUpperCase();
      const strD      = toDateStr(vRow(row, colMap, 'DT_PAG'));

      // Filtros
      if (canal  && canalRow  !== canal)  return;
      if (evento && eventoRow !== evento) return;
      if (status && statusRow !== status) return;
      if (!strD) return;
      if (strIni && strD < strIni) return;
      if (strFim && strD > strFim) return;
      // Canal padrão: só VA e RC se não filtrado
      if (!canal && canalRow !== 'VA SALES' && canalRow !== 'RC SALES') return;

      const cod  = String(vRow(row, colMap, 'COD_VEND') || '').trim();
      const nome = String(vRow(row, colMap, 'NOME_VEND')|| '').trim();
      const hc   = parseFloat(vRow(row, colMap, 'HC'))   || 0;
      const val  = parseFloat(String(vRow(row, colMap, 'VALOR')||'0').replace('R$','').replace(/[\s.]/g,'').replace(',','.')) || 0;
      const pts  = parseFloat(vRow(row, colMap, 'PONTOS'))|| 0;

      if (!indMap[cod]) indMap[cod] = { codigo: cod, nome, apelido: mapaApelido[cod]?.apelido || nome, headcounts: 0, vendas: 0, faturamento: 0, pontos: 0 };
      indMap[cod].headcounts  += hc;
      indMap[cod].vendas      += 1;
      indMap[cod].faturamento += val;
      indMap[cod].pontos      += pts;
    });

    const individual = Object.values(indMap).sort((a,b) => b.headcounts - a.headcounts);
    res.json({ ok: true, individual });
  } catch(e) { res.json({ erro: e.message }); }
});

router.post('/ranking', async (req, res) => {
  try {
    const { strIni, strFim, semNum } = req.body;
    const colMap = await getColMap();
    const dados  = await getVendasRows();
    const equipes = await getEquipes();
    const mapaLdr = {}, mapaApelido = {};
    equipes.forEach(e => { mapaLdr[e.nome] = e.lider; });
    (await getVendedores()).forEach(v => { mapaApelido[v.codigo] = v.apelido || v.nome; });

    const indMap = {}, eqMap = {};
    dados.forEach(row => {
      if (String(vRow(row, colMap, 'CANAL')).trim() !== 'VA SALES') return;
      const strD = toDateStr(vRow(row, colMap, 'DT_PAG'));
      if (!strD || strD < strIni || strD > strFim) return;
      const cod  = String(vRow(row, colMap, 'COD_VEND')).trim();
      const nome = String(vRow(row, colMap, 'NOME_VEND')).trim().split(' ').slice(0,2).join(' ');
      const eq   = String(vRow(row, colMap, 'EQUIPE')).trim() || 'Sem Equipe';
      const cat  = String(vRow(row, colMap, 'CATEGORIA')).trim().toUpperCase();
      const pts  = parseFloat(vRow(row, colMap, 'PONTOS')) || 0;
      const hc   = parseFloat(vRow(row, colMap, 'HC')) || 0;
      const hcConc = cat === 'UPGRADE' ? 0 : hc;
      const val  = parseFloat(String(vRow(row, colMap, 'VALOR')||'0').replace('R$','').replace(/\s/g,'').replace(/\.(\d{3})/g,'$1').replace(',','.')) || 0;
      if (!indMap[cod]) indMap[cod] = { codigo:cod, nome, apelido: mapaApelido[cod]||nome, pontos:0, headcounts:0, valor:0, primeiraVenda:strD };
      indMap[cod].pontos += pts; indMap[cod].headcounts += hcConc; indMap[cod].valor += val;
      if (strD < indMap[cod].primeiraVenda) indMap[cod].primeiraVenda = strD;
      if (!eqMap[eq]) eqMap[eq] = { equipe:eq, lider:mapaLdr[eq]||'—', pontos:0, headcounts:0, valor:0, primeiraVenda:strD };
      eqMap[eq].pontos += pts; eqMap[eq].headcounts += hcConc; eqMap[eq].valor += val;
    });

    const M = ['🥇','🥈','🥉'];
    const cmp = (a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.headcounts !== a.headcounts) return b.headcounts - a.headcounts;
      if (b.valor !== a.valor) return b.valor - a.valor;
      return a.primeiraVenda < b.primeiraVenda ? -1 : 1;
    };
    const proc = arr => arr.sort(cmp).map((v, i) => {
      v.posicao = i < 3 ? M[i] : String(i+1);
      v.pontos = Math.round(v.pontos*10)/10;
      v.headcounts = Math.round(v.headcounts);
      return v;
    });

    res.json({ individual: proc(Object.values(indMap)), equipes: proc(Object.values(eqMap)) });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// DASHBOARD
// ====================================================
router.post('/dashboard', async (req, res) => {
  try {
    const f = req.body.filtros || {};
    const colMap = await getColMap();
    const dados  = await getVendasRows();
    const hojeS  = hojeStr();

    const match = (filtro, valor) => {
      if (!filtro || filtro.length === 0) return true;
      if (Array.isArray(filtro)) return filtro.length === 0 || filtro.includes(valor);
      return filtro === valor;
    };

    let totalHC = 0, totalValor = 0, hojeHC = 0;
    const vendAtivos = {}, porMes = {}, porCanalMacro = {}, porCanal = {};
    const porCategoria = {}, porEvento = {}, ranking = {}, porDia = {}, porDiaDetalhe = {};

    dados.forEach(row => {
      const canal = String(vRow(row,colMap,'CANAL')||'').trim();
      const evento = String(vRow(row,colMap,'EVENTO')||'').trim();
      const mes = String(vRow(row,colMap,'MES')||'').trim();
      const semana = String(vRow(row,colMap,'SEMANA')||'').trim();
      const cat = String(vRow(row,colMap,'CATEGORIA')||'').trim();
      const canalMacro = String(vRow(row,colMap,'CANAL_MACRO')||'').trim();
      const codVend = String(vRow(row,colMap,'COD_VEND')||'').trim();
      const nomeVend = String(vRow(row,colMap,'NOME_VEND')||'').trim().split(' ').slice(0,2).join(' ');
      const status = String(vRow(row,colMap,'STATUS')||'').trim().toUpperCase();

      if (!match(f.mes, mes)) return;
      if (!match(f.semana, semana)) return;
      if (!match(f.canal, canal)) return;
      if (!match(f.canalMacro, canalMacro)) return;
      if (!match(f.evento, evento)) return;
      if (!match(f.categoria, cat)) return;
      if (!match(f.status, status)) return;

      const hc  = parseInt(vRow(row,colMap,'HC')) || 0;
      const val = parseFloat(String(vRow(row,colMap,'VALOR')||'0').replace('R$','').replace(/\s/g,'').replace(',','.')) || 0;
      const pts = parseFloat(vRow(row,colMap,'PONTOS')) || 0;
      const strD = toDateStr(vRow(row,colMap,'DT_PAG'));

      totalHC += hc; totalValor += val;
      if (strD === hojeS) hojeHC += hc;
      if (codVend) vendAtivos[codVend] = true;
      if (mes) { porMes[mes] = (porMes[mes]||0) + hc; }
      if (canalMacro) { porCanalMacro[canalMacro] = (porCanalMacro[canalMacro]||0) + hc; }
      if (canal) { porCanal[canal] = (porCanal[canal]||0) + hc; }
      if (cat) { porCategoria[cat] = (porCategoria[cat]||0) + hc; }
      if (evento) { porEvento[evento] = (porEvento[evento]||0) + hc; }
      if (strD) {
        if (!porDia[strD]) porDia[strD] = { hc:0, valor:0 };
        porDia[strD].hc += hc; porDia[strD].valor += val;
        if (!porDiaDetalhe[strD]) porDiaDetalhe[strD] = { canal:{}, evento:{}, categoria:{}, ranking:{} };
        if (canal) porDiaDetalhe[strD].canal[canal] = (porDiaDetalhe[strD].canal[canal]||0) + hc;
        if (evento) porDiaDetalhe[strD].evento[evento] = (porDiaDetalhe[strD].evento[evento]||0) + hc;
        if (cat) porDiaDetalhe[strD].categoria[cat] = (porDiaDetalhe[strD].categoria[cat]||0) + hc;
        if (codVend) {
          if (!porDiaDetalhe[strD].ranking[codVend]) porDiaDetalhe[strD].ranking[codVend] = { nome:nomeVend, hc:0 };
          porDiaDetalhe[strD].ranking[codVend].hc += hc;
        }
      }
      if (canal === 'VA SALES' && codVend) {
        if (!ranking[codVend]) ranking[codVend] = { codigo:codVend, nome:nomeVend, hc:0, pontos:0 };
        ranking[codVend].hc += hc; ranking[codVend].pontos += pts;
      }
    });

    const sems = await getCalendario();
    const ordemMes = [];
    sems.forEach(s => { if (s.mes && !ordemMes.includes(s.mes)) ordemMes.push(s.mes); });
    const toArr = obj => Object.keys(obj).map(k => ({ nome:k, hc:obj[k] })).sort((a,b) => b.hc-a.hc);

    res.json({
      totalHC, totalValor: Math.round(totalValor*100)/100,
      vendedoresAtivos: Object.keys(vendAtivos).length,
      hojeHC, hojeStr: fmtBR(hojeS),
      porMes: ordemMes.filter(m => porMes[m]).map(m => ({ nome:m, hc:porMes[m] })),
      porCanalMacro: toArr(porCanalMacro), porCanal: toArr(porCanal),
      porCategoria:  toArr(porCategoria),  porEvento:  toArr(porEvento),
      ranking: Object.values(ranking).sort((a,b) => b.pontos-a.pontos),
      porDia: Object.keys(porDia).sort().map(d => ({ data:d, hc:porDia[d].hc, valor:Math.round(porDia[d].valor*100)/100 })),
      porDiaDetalhe: Object.fromEntries(Object.keys(porDiaDetalhe).map(d => {
        const det = porDiaDetalhe[d];
        return [d, {
          canal:     Object.keys(det.canal).map(k => ({ nome:k, hc:det.canal[k] })).sort((a,b) => b.hc-a.hc),
          evento:    Object.keys(det.evento).map(k => ({ nome:k, hc:det.evento[k] })).sort((a,b) => b.hc-a.hc),
          categoria: Object.keys(det.categoria).map(k => ({ nome:k, hc:det.categoria[k] })).sort((a,b) => b.hc-a.hc),
          ranking:   Object.values(det.ranking).sort((a,b) => b.hc-a.hc).slice(0,10),
        }];
      })),
    });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// RELATÓRIO DIÁRIO
// ====================================================
router.get('/relatorio_diario', async (req, res) => {
  try {
    const hojeS = hojeStr();
    const colMap = await getColMap();
    const dados  = await getVendasRows();
    const eventosInfo = await getEventos();

    const mapaEventosFuturos = {};
    eventosInfo.forEach(e => {
      const dtFim = toDateStr(e.dtFimEv) || toDateStr(e.dtEvento) || '';
      const dtEv  = toDateStr(e.dtEvento) || '9999-99-99';
      if (dtFim >= hojeS) mapaEventosFuturos[e.nome] = dtEv;
    });

    const eventos = {};
    dados.forEach(row => {
      const canal = String(vRow(row,colMap,'CANAL')||'').trim();
      if (canal !== 'VA SALES' && canal !== 'RC SALES') return;
      const ev = String(vRow(row,colMap,'EVENTO')||'').trim();
      if (!ev || !mapaEventosFuturos.hasOwnProperty(ev)) return;
      const hc  = parseFloat(vRow(row,colMap,'HC')) || 0;
      const cat = String(vRow(row,colMap,'CATEGORIA')||'').trim().toUpperCase();
      if (!eventos[ev]) eventos[ev] = { nome:ev, totalHC:0, vaHC:0, rcHC:0, normalHC:0, vipHC:0, upgradeHC:0 };
      eventos[ev].totalHC += hc;
      if (canal === 'VA SALES') eventos[ev].vaHC += hc;
      if (canal === 'RC SALES') eventos[ev].rcHC += hc;
      if (cat === 'NORMAL' || cat === 'ESSENTIAL') eventos[ev].normalHC += hc;
      else if (cat === 'VIP') eventos[ev].vipHC += hc;
      else if (cat.includes('UPGRADE')) eventos[ev].upgradeHC += hc;
    });

    const blocos = Object.values(eventos).sort((a, b) => {
      const da = mapaEventosFuturos[a.nome] || '9999-99-99';
      const db = mapaEventosFuturos[b.nome] || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    if (!blocos.length) return res.json({ texto: 'Sem dados de eventos futuros' });

    const linhas = ['📊 *REPORT DE VENDAS DE INGRESSOS - IS*'];
    blocos.forEach(b => {
      linhas.push('');
      linhas.push('📍*' + b.nome + '*');
      linhas.push('——————————————');
      linhas.push('> • Total Headcounts: ' + b.totalHC);
      linhas.push('> • VA Sales: ' + b.vaHC + '  |  RC Sales: ' + b.rcHC);
      linhas.push('> ');
      linhas.push('> • Normal: ' + b.normalHC + '  |  VIP: ' + b.vipHC + '  |  Upgrade: ' + b.upgradeHC);
    });

    res.json({ texto: linhas.join('\n') });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// RELATÓRIO SEMANAL — VA SALES
// ====================================================
router.get('/relatorio_semanal', async (req, res) => {
  try {
    const semNum = parseInt(req.query.semana) || 0;
    const sems   = await getCalendario();
    const sem    = sems.find(s => s.num === semNum);
    if (!sem) return res.json({ texto: 'Semana não encontrada' });

    const colMap = await getColMap();
    const dados  = await getVendasRows();
    const eventosInfo = await getEventos();
    const mapaData = {};
    eventosInfo.forEach(e => { mapaData[e.nome] = e.dtEvento || '9999-99-99'; });

    const bloco = () => ({ totalVendas:0,totalHC:0,totalValor:0,normalVendas:0,normalHC:0,vipVendas:0,vipHC:0,upgradeVendas:0,upgradeHC:0,cancelVendas:0,cancelHC:0 });
    const acumular = (obj, hc, val, cat, isCancel) => {
      obj.totalVendas++; obj.totalHC += hc; obj.totalValor += val;
      if (cat === 'NORMAL' || cat === 'ESSENTIAL') { obj.normalVendas++; obj.normalHC += hc; }
      else if (cat === 'VIP') { obj.vipVendas++; obj.vipHC += hc; }
      else if (cat.includes('UPGRADE')) { obj.upgradeVendas++; obj.upgradeHC += hc; }
      if (isCancel) { obj.cancelVendas++; obj.cancelHC += hc; }
    };

    const total = bloco(), eventos = {};
    dados.forEach(row => {
      if (String(vRow(row,colMap,'CANAL')).trim() !== 'VA SALES') return;
      const strD = toDateStr(vRow(row,colMap,'DT_PAG'));
      if (strD < sem.strIni || strD > sem.strFim) return;
      const ev  = String(vRow(row,colMap,'EVENTO')).trim() || 'Sem evento';
      const hc  = parseFloat(vRow(row,colMap,'HC')) || 0;
      const val = parseFloat(String(vRow(row,colMap,'VALOR')||'0').replace('R$','').replace(/\s/g,'').replace(/\.(\d{3})/g,'$1').replace(',','.')) || 0;
      const cat = String(vRow(row,colMap,'CATEGORIA')).trim().toUpperCase();
      const isCancel = isCancelado(vRow(row,colMap,'STATUS'));
      if (!eventos[ev]) { eventos[ev] = bloco(); eventos[ev].nome = ev; }
      acumular(total, hc, val, cat, isCancel);
      acumular(eventos[ev], hc, val, cat, isCancel);
    });

    const blocoTexto = (b, titulo) => [
      titulo, '——————————————',
      `> • *Vendas:* ${b.totalVendas} | *Headcounts:* ${b.totalHC} | *Faturamento:* ${fmtMoeda(b.totalValor)}`,
      `> • Normal: ${b.normalVendas} Vendas | ${b.normalHC} Headcounts`,
      `> • VIP: ${b.vipVendas} Vendas | ${b.vipHC} Headcounts`,
      `> • Upgrade: ${b.upgradeVendas} Vendas | ${b.upgradeHC} Headcounts`,
      `> ❌ Cancelamentos: ${b.cancelVendas} Vendas | ${b.cancelHC} Headcounts`,
    ].join('\n');

    const ordenados = Object.values(eventos).sort((a, b) => {
      const da = mapaData[a.nome] || '9999-99-99', db = mapaData[b.nome] || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    const linhas = [`*REPORT DE VENDAS DE INGRESSOS - SEMANA ${semNum} - ${sem.label}*`, '', blocoTexto(total, '📊*INGRESSOS TOTAIS — VA SALES:*')];
    ordenados.forEach(ev => { linhas.push(''); linhas.push(blocoTexto(ev, `📍*${ev.nome}*`)); });
    res.json({ texto: linhas.join('\n') });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// RELATÓRIO SEMANAL — RC SALES
// ====================================================
router.post('/relatorio_semanal_rc', async (req, res) => {
  try {
    const semNum = parseInt(req.body.semana) || 0;
    const sems   = await getCalendario();
    const sem    = sems.find(s => s.num === semNum);
    if (!sem) return res.json({ texto: 'Semana não encontrada' });

    const colMap = await getColMap();
    const dados  = await getVendasRows();
    const eventosInfo = await getEventos();
    const mapaData = {};
    eventosInfo.forEach(e => { mapaData[e.nome] = e.dtEvento || '9999-99-99'; });

    const bloco = () => ({ totalVendas:0,totalHC:0,totalValor:0,normalVendas:0,normalHC:0,vipVendas:0,vipHC:0,upgradeVendas:0,upgradeHC:0,cancelVendas:0,cancelHC:0 });
    const acumular = (obj, hc, val, cat, isCancel) => {
      obj.totalVendas++; obj.totalHC += hc; obj.totalValor += val;
      if (cat === 'NORMAL' || cat === 'ESSENTIAL') { obj.normalVendas++; obj.normalHC += hc; }
      else if (cat === 'VIP') { obj.vipVendas++; obj.vipHC += hc; }
      else if (cat.includes('UPGRADE')) { obj.upgradeVendas++; obj.upgradeHC += hc; }
      if (isCancel) { obj.cancelVendas++; obj.cancelHC += hc; }
    };

    const total = bloco(), eventos = {};
    dados.forEach(row => {
      if (String(vRow(row,colMap,'CANAL')).trim() !== 'RC SALES') return;
      const strD = toDateStr(vRow(row,colMap,'DT_PAG'));
      if (strD < sem.strIni || strD > sem.strFim) return;
      const ev  = String(vRow(row,colMap,'EVENTO')).trim() || 'Sem evento';
      const hc  = parseFloat(vRow(row,colMap,'HC')) || 0;
      const val = parseFloat(String(vRow(row,colMap,'VALOR')||'0').replace('R$','').replace(/\s/g,'').replace(/\.(\d{3})/g,'$1').replace(',','.')) || 0;
      const cat = String(vRow(row,colMap,'CATEGORIA')).trim().toUpperCase();
      const isCancel = isCancelado(vRow(row,colMap,'STATUS'));
      if (!eventos[ev]) { eventos[ev] = bloco(); eventos[ev].nome = ev; }
      acumular(total, hc, val, cat, isCancel);
      acumular(eventos[ev], hc, val, cat, isCancel);
    });

    const blocoTexto = (b, titulo) => [
      titulo, '——————————————',
      `> • *Vendas:* ${b.totalVendas} | *Headcounts:* ${b.totalHC} | *Faturamento:* ${fmtMoeda(b.totalValor)}`,
      `> • Normal: ${b.normalVendas} Vendas | ${b.normalHC} Headcounts`,
      `> • VIP: ${b.vipVendas} Vendas | ${b.vipHC} Headcounts`,
      `> • Upgrade: ${b.upgradeVendas} Vendas | ${b.upgradeHC} Headcounts`,
      `> ❌ Cancelamentos: ${b.cancelVendas} Vendas | ${b.cancelHC} Headcounts`,
    ].join('\n');

    const ordenados = Object.values(eventos).sort((a, b) => {
      const da = mapaData[a.nome] || '9999-99-99', db = mapaData[b.nome] || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    const linhas = [`*REPORT DE VENDAS DE INGRESSOS - SEMANA ${semNum} - ${sem.label}*`, '', blocoTexto(total, '📊*INGRESSOS TOTAIS — RC SALES:*')];
    ordenados.forEach(ev => { linhas.push(''); linhas.push(blocoTexto(ev, `📍*${ev.nome}*`)); });
    res.json({ texto: linhas.join('\n') });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// SEMÁFORO
// ====================================================
router.post('/get_semaforo', async (req, res) => {
  try {
    const hojeS = hojeStr();
    const hoje  = new Date(hojeS + 'T12:00:00');
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioMesStr = inicioMes.toLocaleDateString('sv-SE');
    const colMap = await getColMap();
    const rows   = await getVendasRows();
    const ultimaVenda = {}, faturamentoMes = {};

    rows.forEach(row => {
      const canal = String(vRow(row,colMap,'CANAL')||'').trim();
      if (canal !== 'VA SALES') return;
      if (String(vRow(row,colMap,'STATUS')||'').trim().toUpperCase() === 'CANCELADO') return;
      const cod  = String(vRow(row,colMap,'COD_VEND')||'').trim();
      const strD = toDateStr(vRow(row,colMap,'DT_PAG'));
      if (!cod || !strD) return;
      if (!ultimaVenda[cod] || strD > ultimaVenda[cod]) ultimaVenda[cod] = strD;
      if (strD >= inicioMesStr) {
        const val = parseFloat(String(vRow(row,colMap,'VALOR')||'0').replace('R$','').replace(/\s/g,'').replace(',','.')) || 0;
        faturamentoMes[cod] = (faturamentoMes[cod] || 0) + val;
      }
    });

    const vendedores = (await getVendedores()).filter(v => v.ativo);
    const resultado = vendedores.map(v => {
      const ultima = ultimaVenda[v.codigo];
      let diasSem = 0;
      if (!ultima) {
        diasSem = diasUteisEntre(v.dtInicio || hojeS, hojeS);
      } else {
        const dUltima = new Date(ultima + 'T12:00:00');
        dUltima.setDate(dUltima.getDate() + 1);
        const strProximo = dUltima.toLocaleDateString('sv-SE');
        diasSem = strProximo > hojeS ? 0 : diasUteisEntre(strProximo, hojeS);
      }
      const status = diasSem >= 4 ? 'vermelho' : diasSem >= 2 ? 'amarelo' : 'verde';
      return {
        codigo: v.codigo, nome: v.nome, apelido: v.apelido || v.nome,
        equipe: v.equipe, nivel: v.nivel.toLowerCase(),
        faturamento: Math.round((faturamentoMes[v.codigo]||0)*100)/100,
        ultimaVenda: ultima || '', diasSemVenda: diasSem, status,
      };
    });

    resultado.sort((a, b) => {
      const ord = { vermelho:0, amarelo:1, verde:2 };
      if (ord[a.status] !== ord[b.status]) return ord[a.status] - ord[b.status];
      return b.diasSemVenda - a.diasSemVenda;
    });
    res.json({ ok: true, semaforo: resultado });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// META SEMANAL
// ====================================================
router.post('/get_meta_semanal', async (req, res) => {
  try {
    const { strIni, strFim, canal, equipe } = req.body;
    const META = 375;
    const colMap = await getColMap();
    const rows   = await getVendasRows();
    let realizado = 0;

    rows.forEach(row => {
      const cat = String(vRow(row,colMap,'CATEGORIA')||'').trim();
      if (cat === 'UPGRADE') return;
      if (String(vRow(row,colMap,'STATUS')||'').trim().toUpperCase() === 'CANCELADO') return;
      if (canal && String(vRow(row,colMap,'CANAL')||'').trim() !== canal) return;
      if (equipe && String(vRow(row,colMap,'EQUIPE')||'').trim() !== equipe) return;
      const strD = toDateStr(vRow(row,colMap,'DT_PAG'));
      if (strIni && strD < strIni) return;
      if (strFim && strD > strFim) return;
      realizado += parseInt(vRow(row,colMap,'HC')) || 0;
    });

    res.json({ meta: META, realizado, pct: Math.round(realizado/META*100), falta: Math.max(0, META-realizado) });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// NOVOS VENDEDORES
// ====================================================
router.post('/get_novos_vendedores', async (req, res) => {
  try {
    const hojeS = hojeStr();
    const hoje  = new Date(hojeS + 'T12:00:00');
    const vendedores = (await getVendedores()).filter(v => v.ativo && v.dtInicio);
    const novos = vendedores
      .filter(v => {
        const dtIni = new Date(v.dtInicio + 'T12:00:00');
        const diff = Math.floor((hoje - dtIni) / 86400000);
        return diff >= 0 && diff <= 30;
      })
      .map(v => {
        const dtIni = new Date(v.dtInicio + 'T12:00:00');
        const dias = Math.floor((hoje - dtIni) / 86400000);
        return { codigo:v.codigo, nome:v.nome, apelido:v.apelido||v.nome, equipe:v.equipe, dtInicio:v.dtInicio, diasNaEmpresa:dias, diasRestantes:30-dias };
      })
      .sort((a,b) => a.diasRestantes - b.diasRestantes);
    res.json({ ok:true, novos });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// GET LISTAS (vendedores, equipes, eventos, etc.)
// ====================================================
router.get('/get_vendedores',  async (req, res) => { try { res.json({ lista: await getVendedores() }); } catch(e) { res.json({ erro: e.message }); } });
router.get('/get_equipes',     async (req, res) => { try { res.json({ lista: await getEquipes() }); }    catch(e) { res.json({ erro: e.message }); } });
router.get('/get_eventos',     async (req, res) => { try { res.json({ lista: await getEventos() }); }    catch(e) { res.json({ erro: e.message }); } });
router.get('/get_ocs',         async (req, res) => { try { res.json({ lista: await getOCs() }); }        catch(e) { res.json({ erro: e.message }); } });
router.get('/get_calendario',  async (req, res) => { try { res.json({ lista: await getCalendario() }); } catch(e) { res.json({ erro: e.message }); } });
router.get('/get_regras_canal',async (req, res) => { try { res.json({ regras: await getRegrasCanal() }); } catch(e) { res.json({ erro: e.message }); } });

// ====================================================
// SALVAR VENDEDOR
// ====================================================
router.post('/salvar_vendedor', async (req, res) => {
  try {
    const b = req.body;
    const { del } = require('./cache');
    const rows = await lerAba(ABA.VENDEDORES);
    const { escreverRange, adicionarLinhas } = require('./sheets');
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]||'').trim() === String(b.codigo).trim()) {
        await escreverRange(`${ABA.VENDEDORES}!A${i+1}:G${i+1}`, [[b.codigo, b.nome, b.apelido||'', b.equipe||'', (b.nivel||'JUNIOR').toUpperCase(), b.ativo ? 'SIM':'NAO', b.dtInicio||'']]);
        del('vendedores');
        return res.json({ ok:true, acao:'atualizado' });
      }
    }
    await adicionarLinhas(ABA.VENDEDORES, [[b.codigo, b.nome, b.apelido||'', b.equipe||'', (b.nivel||'JUNIOR').toUpperCase(), b.ativo ? 'SIM':'NAO', b.dtInicio||'']]);
    del('vendedores');
    res.json({ ok:true, acao:'inserido' });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// SALVAR EQUIPE
// ====================================================
router.post('/salvar_equipe', async (req, res) => {
  try {
    const b = req.body;
    const { del } = require('./cache');
    const rows = await lerAba(ABA.EQUIPES);
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]||'').trim() === String(b.nome).trim()) {
        await escreverRange(`${ABA.EQUIPES}!A${i+1}:B${i+1}`, [[b.nome, b.lider||'']]);
        del('equipes');
        return res.json({ ok:true, acao:'atualizado' });
      }
    }
    await adicionarLinhas(ABA.EQUIPES, [[b.nome, b.lider||'']]);
    del('equipes');
    res.json({ ok:true, acao:'inserido' });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// SALVAR EVENTO
// ====================================================
router.post('/salvar_evento', async (req, res) => {
  try {
    const b = req.body;
    const { del } = require('./cache');
    const codigo = b.nome || b.codigo || '';
    const linha = [codigo, b.nome, b.produto||'IGR', b.cidade||'', b.mesAno||'', b.dtIniVend||'', b.dtEvento||'', b.dtFimEv||'', parseInt(b.capacidade)||''];
    const rows = await lerAba(ABA.EVENTOS);
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]||'').trim() === codigo) {
        await escreverRange(`${ABA.EVENTOS}!A${i+1}:I${i+1}`, [linha]);
        del('eventos');
        return res.json({ ok:true, acao:'atualizado' });
      }
    }
    await adicionarLinhas(ABA.EVENTOS, [linha]);
    del('eventos');
    res.json({ ok:true, acao:'inserido' });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// SALVAR REGRA CANAL
// ====================================================
router.post('/salvar_regra_canal', async (req, res) => {
  try {
    const b = req.body;
    const { del } = require('./cache');
    const rows = await lerAba(ABA.REGRAS_CANAL);
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]||'').trim() === String(b.padrao).trim()) {
        await escreverRange(`${ABA.REGRAS_CANAL}!B${i+1}:E${i+1}`, [[b.canal, b.tipo||'contem', b.canalMacro||'', b.fonte||'OC']]);
        del('regras_canal');
        return res.json({ ok:true });
      }
    }
    await adicionarLinhas(ABA.REGRAS_CANAL, [[b.padrao, b.canal, b.tipo||'contem', b.canalMacro||'', b.fonte||'OC']]);
    del('regras_canal');
    res.json({ ok:true });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// DELETAR REGRA CANAL
// ====================================================
router.post('/deletar_regra_canal', async (req, res) => {
  try {
    const { padrao } = req.body;
    const { del } = require('./cache');
    const { google } = require('googleapis');
    const sheets = require('./sheets');

    const rows = await lerAba(ABA.REGRAS_CANAL);
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][0]||'').trim() === String(padrao).trim()) {
        // Deleta a linha usando batchUpdate
        const auth = new (require('googleapis').google.auth.JWT)(
          process.env.GOOGLE_CLIENT_EMAIL, null,
          process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/spreadsheets']
        );
        const api = require('googleapis').google.sheets({ version:'v4', auth });
        // Primeiro pega o sheetId
        const meta = await api.spreadsheets.get({ spreadsheetId: sheets.SPREADSHEET_ID });
        const sheet = meta.data.sheets.find(s => s.properties.title === ABA.REGRAS_CANAL);
        if (sheet) {
          await api.spreadsheets.batchUpdate({
            spreadsheetId: sheets.SPREADSHEET_ID,
            requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension:'ROWS', startIndex: i, endIndex: i+1 } } }] }
          });
        }
        del('regras_canal');
        return res.json({ ok:true });
      }
    }
    res.json({ ok:true });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// DELETAR GENÉRICO (vendedor, equipe, evento)
// ====================================================
router.post('/deletar', async (req, res) => {
  try {
    const { tipo, id } = req.body;
    const mapaAba = { vendedor: ABA.VENDEDORES, equipe: ABA.EQUIPES, evento: ABA.EVENTOS };
    const nomeAba = mapaAba[tipo];
    if (!nomeAba) return res.json({ erro: 'Tipo inválido' });
    const { del } = require('./cache');
    const { google } = require('googleapis');

    const rows = await lerAba(nomeAba);
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]||'').trim() === String(id).trim()) {
        const auth = new (require('googleapis').google.auth.JWT)(
          process.env.GOOGLE_CLIENT_EMAIL, null,
          process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/spreadsheets']
        );
        const api = require('googleapis').google.sheets({ version:'v4', auth });
        const { SPREADSHEET_ID } = require('./sheets');
        const meta = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheet = meta.data.sheets.find(s => s.properties.title === nomeAba);
        if (sheet) {
          await api.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension:'ROWS', startIndex: i, endIndex: i+1 } } }] }
          });
        }
        del(tipo + 's');
        del('vendedores'); del('equipes'); del('eventos');
        return res.json({ ok:true });
      }
    }
    res.json({ ok:true });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// UPLOAD CSV
// ====================================================
router.post('/upload_csv', async (req, res) => {
  try {
    const linhas = req.body.linhas || [];
    if (!linhas.length) return res.json({ erro: 'Nenhuma linha recebida' });

    const { del } = require('./cache');
    const colMap = await getColMap();
    const vendasRows = await getVendasRows();
    const sems    = await getCalendario();
    const vends   = await getVendedores();
    const ocs     = await getOCs();
    const eventos = await getEventos();

    const mapaVend = {}, mapaOC = {}, mapaEvento = {};
    vends.forEach(v => { mapaVend[v.codigo] = v; });
    ocs.forEach(o => { mapaOC[o.oc+'|'+o.plano] = o; mapaOC[o.oc] = o; });
    eventos.forEach(e => { mapaEvento[e.codigo] = e; mapaEvento[e.nome] = e; });

    // Índice de IDs existentes
    const idCol = colMap[V_NOMES['ID']];
    const idsExistentes = {};
    vendasRows.forEach((r, i) => {
      const id = String(r[idCol]||'').trim();
      if (id) idsExistentes[id] = i + 2;
    });

    // Lê o colMap atual da planilha para gravar nas colunas certas
    resetColMap();
    const uploadColMap = await getColMap();

    let importados = 0, atualizados = 0, erros = 0;
    const novasLinhas = [], linhasAtualizar = [];

    for (const l of linhas) {
      const id = String(l['Id da Central']||'').trim();
      if (!id) { erros++; continue; }

      const codVend  = String(l['Código do Vendedor']||'').trim();
      const plano    = String(l['Plano']||'').trim();
      const oc       = String(l['Código de Oferta']||'').trim();
      const dtPagStr = String(l['Data de Pagamento']||'').trim();
      const dtRegStr = String(l['Data de Registro']||'').trim();
      const valor    = parseFloat(String(l['Valor']||'0').replace(',','.')) || 0;
      const status   = String(l['Status']||'').trim();
      const nomeCli  = String(l['Nome']||'').trim();
      const email    = String(l['Email']||'').trim();
      const fone     = String(l['Celular']||'').trim();
      const dtCancel = String(l['Data Cancelamento']||'').trim();
      const idVenda  = String(l['ID da Venda']||'').trim();
      const cpf      = String(l['Documento Fiscal']||'').trim().replace(/\D/g,'');

      const vend     = mapaVend[codVend] || { nome:'⚠️ NÃO CADASTRADO', equipe:'', nivel:'JUNIOR' };
      const ocInfo   = mapaOC[oc+'|'+plano] || mapaOC[oc] || {};
      const inferido = await inferirCanal(oc, plano);
      const canal    = ocInfo.canal      || inferido.canal;
      const canalMacro = ocInfo.canalMacro || inferido.canalMacro;
      const evCod    = ocInfo.eventoCod  || '';
      const evInfo   = mapaEvento[evCod] || {};
      let evento     = evInfo.nome || evCod || '';
      if (!evento) evento = inferirEvento(plano);

      const categoria = inferirCategoria(plano);
      const hc        = extrairHC(plano);
      const statusFinal = (status.toUpperCase() === 'PAGO' && valor === 0) ? 'GRATUITO' : status;

      let pontos = 0;
      if (categoria === 'UPGRADE') pontos = 1;
      else if (categoria === 'VIP') pontos = 3;
      else pontos = 2;

      // Extrai YYYY-MM-DD diretamente da string sem usar Date (evita problema de fuso)
      const extrairStrD = (str) => {
        if (!str) return '';
        // DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY
        const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
        // YYYY-MM-DD
        const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m2) return str.slice(0,10);
        return '';
      };

      const strDPag    = extrairStrD(dtPagStr);
      const strDReg    = extrairStrD(dtRegStr);
      const dtPagSalvar = dtPagStr || ''; // preserva original do CSV
      const dtRegSalvar = dtRegStr || '';

      // Função auxiliar para achar semana/mês dado um strD (YYYY-MM-DD)
      const acharSemana = (strD) => {
        let sem = '', m = '';
        if (strD) sems.forEach(s => { if (strD >= s.strIni && strD <= s.strFim) { sem = s.num; m = s.mes; } });
        return { semana: sem, mes: m };
      };

      // Tenta data de pagamento primeiro; fallback para data de registro
      const strDRef = strDPag || strDReg;

      const { semana, mes } = acharSemana(strDRef);

      // Log para debug (remover após confirmar funcionamento)
      if (!semana && strDRef) {
        console.warn(`[UPLOAD] Sem semana para data ${strDRef} — verifique o calendário`);
        console.warn(`[UPLOAD] Primeira semana: ${sems[0]?.strIni} / Última: ${sems[sems.length-1]?.strFim}`);
      }

      // Monta linha respeitando a ordem das colunas do colMap
      const totalCols = Math.max(...Object.values(uploadColMap)) + 1;
      const dadosLinha = new Array(totalCols).fill('');
      const setCol = (chave, valor) => {
        const nomeCol = V_NOMES[chave];
        const idx = uploadColMap[nomeCol];
        if (idx !== undefined) dadosLinha[idx] = valor !== undefined && valor !== null ? valor : '';
      };
      setCol('ID',        id);
      setCol('DT_PAG',    dtPagSalvar);
      setCol('DT_REG',    dtRegSalvar);
      setCol('COD_VEND',  codVend);
      setCol('NOME_VEND', vend.nome);
      setCol('EQUIPE',    vend.equipe);
      setCol('NOME_CLI',  nomeCli);
      setCol('EMAIL',     email);
      setCol('FONE',      fone);
      setCol('PLANO',     plano);
      setCol('OC',        oc);
      setCol('EVENTO',    evento);
      setCol('CANAL',     canal);
      setCol('CANAL_MACRO', canalMacro);
      setCol('CATEGORIA', categoria);
      setCol('HC',        hc);
      setCol('VALOR',     valor);
      setCol('STATUS',    statusFinal);
      setCol('PONTOS',    pontos);
      setCol('SEMANA',    semana);
      setCol('MES',       mes);
      setCol('DT_CANCEL', dtCancel || '');
      setCol('ID_VENDA',  idVenda);
      setCol('CPF',       cpf);

      if (idsExistentes[id]) {
        linhasAtualizar.push({ linha: idsExistentes[id], dados: dadosLinha });
        atualizados++;
      } else {
        novasLinhas.push(dadosLinha);
        importados++;
      }
    }

    // Atualiza existentes em batch (uma única chamada à API)
    if (linhasAtualizar.length) {
      const { google } = require('googleapis');
      const sheetsModule = require('./sheets');
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL, null,
        (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
        ['https://www.googleapis.com/auth/spreadsheets']
      );
      const api = google.sheets({ version: 'v4', auth });
      const data = linhasAtualizar.map(item => ({
        range: `${ABA.VENDAS}!A${item.linha}`,
        values: [item.dados],
      }));
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetsModule.SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data },
      });
    }

    // Insere novas em uma única chamada
    if (novasLinhas.length) {
      await adicionarLinhas(ABA.VENDAS, novasLinhas);
    }

    del('vendas_rows');
    res.json({ importados, atualizados, erros, ocsNaoId:[], planosNaoId:[], semCanal:[] });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// EVENTOS DASHBOARD
// ====================================================
router.post('/eventos', async (req, res) => {
  try {
    const f = req.body.filtros || {};
    const hojeS = hojeStr();
    const colMap = await getColMap();
    const eventosInfo = await getEventos();
    const vendas = await getVendasRows();

    const match = (filtro, valor) => {
      if (!filtro || filtro.length === 0) return true;
      if (Array.isArray(filtro)) return filtro.length === 0 || filtro.includes(valor);
      return filtro === valor;
    };

    const mapaEv = {};
    eventosInfo.forEach(e => {
      const dtFimStr = e.dtFimEv || '';
      const dtStr    = e.dtEvento || '';
      let diasRestantes = 0;
      if (dtStr) {
        const diff = new Date(dtStr+'T12:00:00') - new Date(hojeS+'T12:00:00');
        diasRestantes = Math.ceil(diff / 86400000);
      }
      mapaEv[e.nome] = {
        nome: e.nome, dtEvento: dtStr ? dtStr.slice(8)+'/'+dtStr.slice(5,7) : '—',
        dtEventoStr: dtStr, capacidade: parseInt(e.capacidade)||0,
        futuro: dtFimStr >= hojeS, diasRestantes: diasRestantes > 0 ? diasRestantes : 0,
        vendTotal:0, vendNormal:0, vendEssential:0, vendVip:0, vendUpgrade:0, vendVaRc:0,
        pct:0, pctNormal:0, pctVip:0, pctUpgrade:0, canais:{},
      };
    });

    vendas.forEach(row => {
      const ev  = String(vRow(row,colMap,'EVENTO')||'').trim();
      const canal = String(vRow(row,colMap,'CANAL')||'').trim();
      const canalMacro = String(vRow(row,colMap,'CANAL_MACRO')||'').trim();
      const cat = String(vRow(row,colMap,'CATEGORIA')||'').trim().toUpperCase();
      const mes = String(vRow(row,colMap,'MES')||'').trim();
      const statusR = String(vRow(row,colMap,'STATUS')||'').trim().toUpperCase();
      const hc  = parseFloat(vRow(row,colMap,'HC')) || 0;
      if (!mapaEv[ev]) return;
      if (!match(f.canal, canal)) return;
      if (!match(f.categoria, cat)) return;
      if (!match(f.mes, mes)) return;
      if (f.status && f.status.length > 0 && !match(f.status, statusR)) return;
      mapaEv[ev].vendTotal += hc;
      if (cat === 'ESSENTIAL') mapaEv[ev].vendEssential += hc;
      if (cat === 'NORMAL' || cat === 'ESSENTIAL') mapaEv[ev].vendNormal += hc;
      if (cat === 'VIP') mapaEv[ev].vendVip += hc;
      if (cat === 'UPGRADE') mapaEv[ev].vendUpgrade += hc;
      if (canal === 'VA SALES' || canal === 'RC SALES') mapaEv[ev].vendVaRc += hc;
      if (canal) {
        if (!mapaEv[ev].canais[canal]) mapaEv[ev].canais[canal] = { hc:0, macro:canalMacro };
        mapaEv[ev].canais[canal].hc += hc;
      }
    });

    const eventos = Object.values(mapaEv).map(ev => {
      const cap = ev.capacidade || 0;
      ev.pct        = cap > 0 ? Math.round(ev.vendTotal   / cap * 100) : 0;
      ev.pctNormal  = cap > 0 ? Math.round(ev.vendNormal  / cap * 100) : 0;
      ev.pctVip     = cap > 0 ? Math.round(ev.vendVip     / cap * 100) : 0;
      ev.pctUpgrade = cap > 0 ? Math.round(ev.vendUpgrade / cap * 100) : 0;
      ev.canaisArr  = Object.keys(ev.canais).map(k => ({ nome:k, hc:ev.canais[k].hc, macro:ev.canais[k].macro })).sort((a,b) => b.hc-a.hc);
      delete ev.canais;
      return ev;
    });
    eventos.sort((a,b) => { const da=a.dtEventoStr||'9999', db=b.dtEventoStr||'9999'; return da<db?-1:da>db?1:0; });
    res.json({ eventos });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// GET PERFIL VENDEDOR
// ====================================================
router.post('/get_perfil_vendedor', async (req, res) => {
  try {
    const { codigo, semanas: nSems = 8, strIni: bStrIni, strFim: bStrFim } = req.body;
    if (!codigo) return res.json({ erro: 'Código obrigatório' });

    const cal  = await getCalendario();
    const hoje = hojeStr();
    let sems;
    if (bStrIni && bStrFim) {
      sems = cal.filter(s => s.strIni >= bStrIni && s.strFim <= bStrFim);
      if (!sems.length) sems = cal.filter(s => s.strFim >= bStrIni && s.strIni <= bStrFim);
    } else {
      sems = cal.filter(s => s.strFim <= hoje).slice(-parseInt(nSems));
    }
    if (!sems.length) return res.json({ erro: 'Sem semanas' });

    const strIni = bStrIni || sems[0].strIni;
    const strFim = bStrFim || sems[sems.length-1].strFim;
    const vends  = await getVendedores();
    const vend   = vends.find(v => v.codigo === codigo);
    if (!vend) return res.json({ erro: 'Vendedor não encontrado' });

    const colMap = await getColMap();
    const rows   = await getVendasRows();
    const vendas = rows
      .filter(row => {
        const cod = String(vRow(row,colMap,'COD_VEND')||'').trim();
        const strD = toDateStr(vRow(row,colMap,'DT_PAG'));
        return cod === codigo && strD >= strIni && strD <= strFim;
      })
      .map(row => ({
        data:      toDateStr(vRow(row,colMap,'DT_PAG')),
        canal:     String(vRow(row,colMap,'CANAL')||'').trim(),
        categoria: String(vRow(row,colMap,'CATEGORIA')||'').trim().toUpperCase(),
        status:    String(vRow(row,colMap,'STATUS')||'').trim().toUpperCase(),
        hc:        parseInt(vRow(row,colMap,'HC')) || 0,
        pontos:    parseFloat(vRow(row,colMap,'PONTOS')) || 0,
        valor:     parseFloat(String(vRow(row,colMap,'VALOR')||'0').replace('R$','').replace(/\s/g,'').replace(',','.')) || 0,
      }));

    const porSemana = sems.map(sem => {
      const vs = vendas.filter(v => v.data >= sem.strIni && v.data <= sem.strFim);
      let va=0,rc=0,upgrade=0,cancelados=0,hcTotal=0,pontos=0,faturamento=0;
      vs.forEach(v => {
        if (v.status === 'CANCELADO') { cancelados += v.hc; return; }
        if (v.categoria === 'UPGRADE') { upgrade += v.hc; return; }
        if (v.canal === 'VA SALES') va += v.hc;
        if (v.canal === 'RC SALES') rc += v.hc;
        hcTotal += v.hc; pontos += v.pontos; faturamento += v.valor;
      });
      return { semana:sem.num, strIni:sem.strIni, strFim:sem.strFim, hc:hcTotal, va, rc, upgrade, cancelados, pontos:Math.round(pontos), faturamento:Math.round(faturamento*100)/100, horas:'0h 00min', horasSeg:0, atend:0, entrv:0, diasAtivos:0, txAtend:0, txEntrv:0, hcPorHora:0, pace:'—' };
    });

    let totHC=0,totVA=0,totRC=0,totUpg=0,totCanc=0,totPts=0,totFat=0;
    porSemana.forEach(s => { totHC+=s.hc; totVA+=s.va; totRC+=s.rc; totUpg+=s.upgrade; totCanc+=s.cancelados; totPts+=s.pontos; totFat+=s.faturamento; });

    res.json({
      ok:true,
      vendedor: { codigo:vend.codigo, nome:vend.nome, apelido:vend.apelido||vend.nome, equipe:vend.equipe, dtInicio:vend.dtInicio, nivel:vend.nivel.toLowerCase() },
      periodo:  { strIni, strFim, semanas:sems.length },
      totais:   { hc:totHC, va:totVA, rc:totRC, upgrade:totUpg, cancelados:totCanc, pontos:totPts, faturamento:Math.round(totFat*100)/100, _semanas:sems.length, horas:'0h 00min', atend:0, entrv:0, diasAtivos:0, txAtend:0, txEntrv:0, hcPorHora:0, pace:'—' },
      porSemana,
    });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// REGISTRO DIÁRIO — STATUS DO TIME
// Lê as vendas da planilha principal filtrando pela data
// ====================================================
router.post('/rd_status_time', async (req, res) => {
  try {
    const { data } = req.body; // formato DD/MM/YYYY
    if (!data) return res.json({ ok: true, resultados: [] });

    // Converte DD/MM/YYYY → YYYY-MM-DD para comparar com strD
    const partes = data.split('/');
    const dataISO = partes.length === 3
      ? `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`
      : data;

    const colMap  = await getColMap();
    const rows    = await getVendasRows();
    const vends   = (await getVendedores()).filter(v => v.ativo);

    // Para cada vendedor, verifica se tem alguma venda no dia
    const resultados = vends.map(v => {
      const vendasDia = rows.filter(row => {
        const cod  = String(vRow(row, colMap, 'COD_VEND') || '').trim();
        const strD = toDateStr(vRow(row, colMap, 'DT_PAG'));
        return cod === v.codigo && strD === dataISO;
      });
      const preencheu = vendasDia.length > 0;
      const hcTotal   = vendasDia.reduce((s, r) => s + (parseInt(vRow(r, colMap, 'HC')) || 0), 0);
      return {
        codigo: v.codigo,
        nome:   v.apelido || v.nome,
        equipe: v.equipe,
        preencheu,
        horas:  preencheu ? '—' : '',
        atend:  0,
        entrv:  0,
        head:   hcTotal,
      };
    });

    resultados.sort((a, b) => {
      if (a.preencheu !== b.preencheu) return a.preencheu ? -1 : 1;
      return (a.nome||'').localeCompare(b.nome||'');
    });

    res.json({ ok: true, resultados });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// REGISTRO DIÁRIO — VENDAS DO TIME
// Retorna vendas do dia agrupadas por vendedor
// ====================================================
router.post('/rd_vendas_time', async (req, res) => {
  try {
    const { data } = req.body; // formato DD/MM/YYYY
    if (!data) return res.json({ ok: true, resultados: [], totalGeral: 0 });

    const partes = data.split('/');
    const dataISO = partes.length === 3
      ? `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`
      : data;

    const colMap = await getColMap();
    const rows   = await getVendasRows();
    const vends  = (await getVendedores()).filter(v => v.ativo);

    const mapaApelido = {};
    vends.forEach(v => { mapaApelido[v.codigo] = v.apelido || v.nome; });

    // Agrupa vendas do dia por vendedor
    const porVendedor = {};
    rows.forEach(row => {
      const strD = toDateStr(vRow(row, colMap, 'DT_PAG'));
      if (strD !== dataISO) return;
      const canal = String(vRow(row, colMap, 'CANAL') || '').trim();
      if (canal !== 'VA SALES' && canal !== 'RC SALES') return;

      const cod    = String(vRow(row, colMap, 'COD_VEND')    || '').trim();
      const nome   = mapaApelido[cod] || String(vRow(row, colMap, 'NOME_VEND') || '').trim() || cod;
      const hc     = parseInt(vRow(row, colMap, 'HC')) || 0;
      const cliente= String(vRow(row, colMap, 'NOME_CLIENTE') || vRow(row, colMap, 'NOME_CLI') || '').trim();
      const evento = String(vRow(row, colMap, 'EVENTO')       || '').trim();
      const cat    = String(vRow(row, colMap, 'CATEGORIA')    || '').trim();
      const status = String(vRow(row, colMap, 'STATUS')       || '').trim();

      if (!porVendedor[cod]) porVendedor[cod] = { nome, totalVendas: 0, vendas: [] };
      porVendedor[cod].totalVendas++;
      porVendedor[cod].vendas.push({ cliente, evento, headcounts: hc, categoria: cat, status, obs: '' });
    });

    // Inclui vendedores ativos sem venda no dia
    vends.forEach(v => {
      if (!porVendedor[v.codigo]) {
        porVendedor[v.codigo] = { nome: v.apelido || v.nome, totalVendas: 0, vendas: [] };
      }
    });

    const resultados = Object.values(porVendedor)
      .sort((a, b) => b.totalVendas - a.totalVendas || (a.nome||'').localeCompare(b.nome||''));

    const totalGeral = resultados.reduce((s, v) => s + v.totalVendas, 0);
    res.json({ ok: true, resultados, totalGeral });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// REPROCESSAR CANAIS — relê regras e atualiza CANAL/CANAL_MACRO em todas as vendas
// ====================================================
router.post('/reprocessar_todos_canais', async (req, res) => {
  try {
    const { del } = require('./cache');
    const sheetsModule = require('./sheets');
    const { google } = require('googleapis');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL, null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const api = google.sheets({ version: 'v4', auth });

    const colMap  = await getColMap();
    const rows    = await getVendasRows();
    const regras  = await getRegrasCanal();

    const idxCanal      = colMap[V_NOMES['CANAL']];
    const idxCanalMacro = colMap[V_NOMES['CANAL_MACRO']];
    const idxOC         = colMap[V_NOMES['OC']];
    const idxPlano      = colMap[V_NOMES['PLANO']];

    const data = [];
    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i];
      const oc    = String(row[idxOC]    || '').trim();
      const plano = String(row[idxPlano] || '').trim();
      const { canal, canalMacro } = await inferirCanal(oc, plano);
      if (!canal) continue;
      const linhaPlan = i + 2; // +1 header +1 base0
      const colCanal  = String.fromCharCode(65 + idxCanal);
      const colMacro  = String.fromCharCode(65 + idxCanalMacro);
      data.push({ range: `${ABA.VENDAS}!${colCanal}${linhaPlan}:${colMacro}${linhaPlan}`, values: [[canal, canalMacro]] });
    }

    // batchUpdate em blocos de 1000 para não estourar cota
    const BLOCO = 1000;
    for (let i = 0; i < data.length; i += BLOCO) {
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetsModule.SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: data.slice(i, i + BLOCO) },
      });
    }

    del('vendas_rows');
    res.json({ ok: true, atualizados: data.length });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// REPROCESSAR CATEGORIAS — relê PLANO e atualiza CATEGORIA em todas as vendas
// ====================================================
router.post('/reprocessar_todas_categorias', async (req, res) => {
  try {
    const { del } = require('./cache');
    const sheetsModule = require('./sheets');
    const { google } = require('googleapis');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL, null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const api = google.sheets({ version: 'v4', auth });

    const colMap = await getColMap();
    const rows   = await getVendasRows();
    const idxPlano = colMap[V_NOMES['PLANO']];
    const idxCat   = colMap[V_NOMES['CATEGORIA']];
    const colCat   = String.fromCharCode(65 + idxCat);

    const data = rows.map((row, i) => {
      const plano = String(row[idxPlano] || '').trim();
      const cat   = inferirCategoria(plano);
      return { range: `${ABA.VENDAS}!${colCat}${i + 2}`, values: [[cat]] };
    });

    const BLOCO = 1000;
    for (let i = 0; i < data.length; i += BLOCO) {
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetsModule.SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: data.slice(i, i + BLOCO) },
      });
    }

    del('vendas_rows');
    res.json({ ok: true, atualizados: data.length });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// REPROCESSAR TUDO — semana, mês, canal, categoria, pontos, evento
// ====================================================
router.post('/reprocessar_tudo', async (req, res) => {
  res.json({ ok: true, atualizados: 0, msg: 'iniciado' });
  try {
    const { del } = require('./cache');
    const sheetsModule = require('./sheets');
    const { google } = require('googleapis');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL, null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const api = google.sheets({ version: 'v4', auth });

    del('calendario');
    // Invalida colMap para reler o cabeçalho caso colunas tenham sido reorganizadas
    resetColMap();

    const colMap  = await getColMap();
    const rows    = await getVendasRows();
    const sems    = await getCalendario();
    const ocs     = await getOCs();
    const eventos = await getEventos();
    const vends   = await getVendedores();

    const mapaOC = {}, mapaEvento = {};
    ocs.forEach(o => { mapaOC[o.oc+'|'+o.plano] = o; mapaOC[o.oc] = o; });
    eventos.forEach(e => { mapaEvento[e.codigo] = e; mapaEvento[e.nome] = e; });

    // Mapa de vendedores por código
    const mapaVend = {};
    vends.forEach(v => { mapaVend[v.codigo.trim()] = v; });

    // Índices das colunas que vamos reescrever
    const idx = {
      dtPag:      colMap[V_NOMES['DT_PAG']],
      dtReg:      colMap[V_NOMES['DT_REG']],
      codVend:    colMap[V_NOMES['COD_VEND']],
      nomeVend:   colMap[V_NOMES['NOME_VEND']],
      equipe:     colMap[V_NOMES['EQUIPE']],
      plano:      colMap[V_NOMES['PLANO']],
      oc:         colMap[V_NOMES['OC']],
      canal:      colMap[V_NOMES['CANAL']],
      canalMacro: colMap[V_NOMES['CANAL_MACRO']],
      categoria:  colMap[V_NOMES['CATEGORIA']],
      hc:         colMap[V_NOMES['HC']],
      valor:      colMap[V_NOMES['VALOR']],
      status:     colMap[V_NOMES['STATUS']],
      pontos:     colMap[V_NOMES['PONTOS']],
      semana:     colMap[V_NOMES['SEMANA']],
      mes:        colMap[V_NOMES['MES']],
      evento:     colMap[V_NOMES['EVENTO']],
    };

    const colLetra = n => n < 26 ? String.fromCharCode(65+n) : String.fromCharCode(64+Math.floor(n/26))+String.fromCharCode(65+(n%26));

    // Pré-calcula semana/mês usando toDateStr que já trata Date objects, seriais e DD/MM/YYYY
    const smPre = rows.map(row => {
      const strD = toDateStr(row[idx.dtPag]) || toDateStr(idx.dtReg !== undefined ? row[idx.dtReg] : '');
      if (!strD) return ['', ''];
      const f = sems.find(s => strD >= s.strIni && strD <= s.strFim);
      return [f ? f.num : '', f ? f.mes : ''];
    });


    // Acumula valores por coluna
    const cols = {canal:[], canalMacro:[], categoria:[], pontos:[], hc:[], semana:[], mes:[], evento:[], nomeVend:[], equipe:[]};

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i];
      const plano  = String(row[idx.plano] || '').trim();
      const oc     = String(row[idx.oc]    || '').trim();
      const ocInfo = mapaOC[oc+'|'+plano] || mapaOC[oc] || {};
      const inf    = await inferirCanal(oc, plano);
      const cat    = inferirCategoria(plano);
      const evInfo = mapaEvento[ocInfo.eventoCod || ''] || {};
      const vInfo  = mapaVend[String(row[idx.codVend] || '').trim()] || {};

      cols.canal.push([      ocInfo.canal      || inf.canal      || String(row[idx.canal]      || '').trim() ]);
      cols.canalMacro.push([ ocInfo.canalMacro || inf.canalMacro || String(row[idx.canalMacro] || '').trim() ]);
      cols.categoria.push([  cat ]);
      cols.pontos.push([     cat === 'UPGRADE' ? 1 : cat === 'VIP' ? 3 : 2 ]);
      cols.hc.push([         extrairHC(plano) ]);
      cols.semana.push([     smPre[i][0] ]);
      cols.mes.push([        smPre[i][1] ]);
      cols.evento.push([     evInfo.nome || ocInfo.eventoCod || String(row[idx.evento] || '').trim() || inferirEvento(plano) ]);
      cols.nomeVend.push([   vInfo.nome   || String(row[idx.nomeVend] || '').trim() ]);
      cols.equipe.push([     vInfo.equipe || String(row[idx.equipe]   || '').trim() ]);
    }

    // Uma única chamada com 10 ranges (uma coluna por campo)
    const linhaFim = rows.length + 1;
    const data = Object.entries(cols)
      .filter(([c]) => idx[c] !== undefined)
      .map(([c, vals]) => ({
        range: ABA.VENDAS + '!' + colLetra(idx[c]) + '2:' + colLetra(idx[c]) + linhaFim,
        values: vals,
      }));



    await api.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetsModule.SPREADSHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });

    del('vendas_rows');
    console.log(`[REPROCESSAR] Concluído: ${rows.length} vendas, ${data.length} campos atualizados`);
  } catch(e) { console.error('[REPROCESSAR] Erro:', e.message); }
});

// ====================================================
// REMOVER DUPLICATAS
// Regra: mesmo ID_CENTRAL → mantém CANCELADO se houver,
// senão mantém a mais recente. Remove as demais.
// ====================================================
router.post('/remover_duplicatas', async (req, res) => {
  try {
    const { del } = require('./cache');
    const sheetsModule = require('./sheets');
    const { google } = require('googleapis');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL, null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const api = google.sheets({ version: 'v4', auth });

    const colMap = await getColMap();
    const rows   = await getVendasRows();
    const idxID     = colMap[V_NOMES['ID']];
    const idxStatus = colMap[V_NOMES['STATUS']];

    // Agrupa por ID: { linhaKeep, linhasRemover }
    const mapaID = {}; // id → { idx, status }[]
    rows.forEach((row, i) => {
      const id     = String(row[idxID]     || '').trim();
      const status = String(row[idxStatus] || '').trim().toUpperCase();
      if (!id) return;
      if (!mapaID[id]) mapaID[id] = [];
      mapaID[id].push({ idx: i, status });
    });

    // Para cada ID com duplicata, decide qual manter
    const linhasRemover = []; // índices base-0 das linhas a remover
    for (const [id, ocorrencias] of Object.entries(mapaID)) {
      if (ocorrencias.length <= 1) continue;
      // Prefere CANCELADO; senão última ocorrência (maior idx)
      const cancelado = ocorrencias.find(o => o.status === 'CANCELADO');
      const manter    = cancelado || ocorrencias[ocorrencias.length - 1];
      ocorrencias.forEach(o => { if (o.idx !== manter.idx) linhasRemover.push(o.idx); });
    }

    if (!linhasRemover.length) {
      return res.json({ ok: true, removidas: 0, msg: 'Nenhuma duplicata encontrada' });
    }

    // Pega sheetId da aba VENDAS
    const meta  = await api.spreadsheets.get({ spreadsheetId: sheetsModule.SPREADSHEET_ID });
    const sheet = meta.data.sheets.find(s => s.properties.title === ABA.VENDAS);
    if (!sheet) return res.json({ erro: 'Aba VENDAS não encontrada' });
    const sheetId = sheet.properties.sheetId;

    // Ordena decrescente para deletar de baixo para cima (não deslocar índices)
    linhasRemover.sort((a, b) => b - a);

    // Deleta em blocos de 100 requisições por vez
    const BLOCO = 100;
    for (let i = 0; i < linhasRemover.length; i += BLOCO) {
      const requests = linhasRemover.slice(i, i + BLOCO).map(rowIdx => ({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIdx + 1, endIndex: rowIdx + 2 }
        }
      }));
      await api.spreadsheets.batchUpdate({
        spreadsheetId: sheetsModule.SPREADSHEET_ID,
        requestBody: { requests },
      });
    }

    del('vendas_rows');
    res.json({ ok: true, removidas: linhasRemover.length });
  } catch(e) { res.json({ erro: e.message }); }
});

// Rotas não implementadas (retornam ok para não quebrar o frontend)
// ====================================================
// GET CAPACIDADE EVENTO — pagos, gratuitos, cancelados, presença estimada
// ====================================================
router.post('/get_capacidade_evento', async (req, res) => {
  try {
    const cfg      = await getConfig();
    const rows     = await getVendasRows();
    const colMap   = await getColMap();
    const eventos  = await getEventos();

    const noShowPago     = parseFloat(cfg['NO_SHOW_PAGO']     || 0) || 0;
    const noShowGratuito = parseFloat(cfg['NO_SHOW_GRATUITO'] || 0) || 0;

    // Mapa de status por evento
    const mapaEvento = {};
    rows.forEach(row => {
      const nomeEv  = String(vRow(row, colMap, 'EVENTO')   || '').trim();
      const status  = String(vRow(row, colMap, 'STATUS')   || '').trim().toUpperCase();
      const canal   = String(vRow(row, colMap, 'CANAL')    || '').trim().toUpperCase();
      const hc      = parseInt(vRow(row, colMap, 'HC'))    || 1;
      if (!nomeEv) return;

      if (!mapaEvento[nomeEv]) mapaEvento[nomeEv] = { pagos: 0, gratuitos: 0, cancelados: 0 };
      if (status === 'CANCELADO') {
        mapaEvento[nomeEv].cancelados += hc;
      } else if (canal.includes('GT') || canal.includes('GRATUIT')) {
        mapaEvento[nomeEv].gratuitos += hc;
      } else {
        mapaEvento[nomeEv].pagos += hc;
      }
    });

    // Monta lista de eventos com presença estimada
    const listaEventos = eventos.map(ev => {
      const m   = mapaEvento[ev.nome] || { pagos: 0, gratuitos: 0, cancelados: 0 };
      const cap = parseInt(ev.capacidade) || 0;
      const presencaEstimada = cap > 0
        ? Math.round(m.pagos * (1 - noShowPago / 100) + m.gratuitos * (1 - noShowGratuito / 100))
        : 0;
      const pctOcupacao = cap > 0 ? Math.round(presencaEstimada / cap * 100) : 0;
      return {
        nome: ev.nome,
        codigo: ev.codigo,
        pagos: m.pagos,
        gratuitos: m.gratuitos,
        cancelados: m.cancelados,
        presencaEstimada,
        pctOcupacao,
      };
    });

    res.json({ ok: true, eventos: listaEventos, noShowPago, noShowGratuito });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// SALVAR NO-SHOW — salva % no-show pago e gratuito na aba CONFIG
// ====================================================
router.post('/salvar_noshow_evento', async (req, res) => {
  try {
    const { pago, gratuito } = req.body;
    const rows = await lerAba(ABA.CONFIG);
    const { del } = require('./cache');

    // Procura as linhas NO_SHOW_PAGO e NO_SHOW_GRATUITO na config
    let linhasPago = [], linhasGrat = [], maxLinha = rows.length + 1;
    rows.forEach((r, i) => {
      const chave = String(r[0] || '').trim();
      if (chave === 'NO_SHOW_PAGO')     linhasPago.push(i + 1);
      if (chave === 'NO_SHOW_GRATUITO') linhasGrat.push(i + 1);
    });

    const { google } = require('googleapis');
    const sheetsModule = require('./sheets');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL, null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const api = google.sheets({ version: 'v4', auth });

    const data = [];
    if (linhasPago.length) {
      data.push({ range: `${ABA.CONFIG}!A${linhasPago[0]}:B${linhasPago[0]}`, values: [['NO_SHOW_PAGO', pago]] });
    } else {
      data.push({ range: `${ABA.CONFIG}!A${maxLinha}:B${maxLinha}`, values: [['NO_SHOW_PAGO', pago]] });
      maxLinha++;
    }
    if (linhasGrat.length) {
      data.push({ range: `${ABA.CONFIG}!A${linhasGrat[0]}:B${linhasGrat[0]}`, values: [['NO_SHOW_GRATUITO', gratuito]] });
    } else {
      data.push({ range: `${ABA.CONFIG}!A${maxLinha}:B${maxLinha}`, values: [['NO_SHOW_GRATUITO', gratuito]] });
    }

    await api.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetsModule.SPREADSHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });

    del('config');
    res.json({ ok: true });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// UPLOAD VENDEDORES — insere novos vendedores do CSV
// ====================================================
router.post('/upload_vendedores', async (req, res) => {
  try {
    const { linhas } = req.body; // [{ codigo, nome }]
    if (!linhas || !linhas.length) return res.json({ ok: true, inseridos: 0, ignorados: 0 });

    const { del } = require('./cache');
    const vends = await getVendedores();
    const existentes = new Set(vends.map(v => v.codigo.trim().toUpperCase()));

    const novas = linhas.filter(l => l.codigo && l.nome && !existentes.has(String(l.codigo).trim().toUpperCase()));

    if (novas.length) {
      const rows = novas.map(l => [
        String(l.codigo).trim(),
        String(l.nome).trim(),
        '', // apelido
        'IGD', // equipe
        'JUNIOR', // nivel
        'NÃO', // ativo
        '', // dtInicio
      ]);
      await adicionarLinhas(ABA.VENDEDORES, rows);
      del('vendedores');
    }

    res.json({ ok: true, inseridos: novas.length, ignorados: linhas.length - novas.length });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// VENDAS LISTA — retorna vendas filtradas com paginação
// ====================================================
router.post('/vendas_lista', async (req, res) => {
  try {
    const { filtros = {}, pagina = 1, porPagina = 100 } = req.body;
    const colMap = await getColMap();
    const dados  = await getVendasRows();

    const match = (filtro, valor) => {
      if (!filtro || filtro.length === 0) return true;
      if (Array.isArray(filtro)) return filtro.length === 0 || filtro.includes(valor);
      return filtro === valor;
    };

    const linhas = [];
    dados.forEach((row, i) => {
      const canal      = String(vRow(row,colMap,'CANAL')      ||'').trim();
      const evento     = String(vRow(row,colMap,'EVENTO')     ||'').trim();
      const mes        = String(vRow(row,colMap,'MES')        ||'').trim();
      const semana     = String(vRow(row,colMap,'SEMANA')     ||'').trim();
      const cat        = String(vRow(row,colMap,'CATEGORIA')  ||'').trim();
      const canalMacro = String(vRow(row,colMap,'CANAL_MACRO')||'').trim();
      const status     = String(vRow(row,colMap,'STATUS')     ||'').trim().toUpperCase();

      if (!match(filtros.mes,        mes))        return;
      if (!match(filtros.semana,     semana))      return;
      if (!match(filtros.canal,      canal))       return;
      if (!match(filtros.canalMacro, canalMacro))  return;
      if (!match(filtros.evento,     evento))      return;
      if (!match(filtros.categoria,  cat))         return;
      if (!match(filtros.status,     status))      return;

      linhas.push({
        idx:        i + 2, // linha na planilha
        id:         String(vRow(row,colMap,'ID')        ||'').trim(),
        dtPag:      String(vRow(row,colMap,'DT_PAG')    ||'').trim(),
        dtReg:      String(vRow(row,colMap,'DT_REG')    ||'').trim(),
        codVend:    String(vRow(row,colMap,'COD_VEND')  ||'').trim(),
        nomeVend:   String(vRow(row,colMap,'NOME_VEND') ||'').trim(),
        equipe:     String(vRow(row,colMap,'EQUIPE')    ||'').trim(),
        nomeCli:    String(vRow(row,colMap,'NOME_CLI')  ||'').trim(),
        plano:      String(vRow(row,colMap,'PLANO')     ||'').trim(),
        oc:         String(vRow(row,colMap,'OC')        ||'').trim(),
        evento,
        canal,
        canalMacro,
        categoria:  cat,
        hc:         parseInt(vRow(row,colMap,'HC'))     ||0,
        valor:      parseFloat(String(vRow(row,colMap,'VALOR')||'0').replace('R$','').replace(/\s/g,'').replace(',','.')) ||0,
        status:     String(vRow(row,colMap,'STATUS')    ||'').trim(),
        pontos:     parseFloat(vRow(row,colMap,'PONTOS'))||0,
        semana,
        mes,
        idVenda:    String(vRow(row,colMap,'ID_VENDA')  ||'').trim(),
        link: String(vRow(row,colMap,'ID') ||'').trim()
          ? `https://central.ignicaodigital.com.br/payment/${String(vRow(row,colMap,'ID')||'').trim()}/details`
          : '',
      });
    });

    // Converte DD/MM/YYYY HH:MM:SS → timestamp para ordenar corretamente
    const toTs = (str) => {
      if (!str) return 0;
      const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
      if (!m) return 0;
      return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0), +(m[6]||0)).getTime();
    };
    // Ordena por data de registro decrescente
    linhas.sort((a,b) => (toTs(b.dtReg||b.dtPag)) - (toTs(a.dtReg||a.dtPag)));

    const total = linhas.length;
    const inicio = (pagina - 1) * porPagina;
    const paginas = Math.ceil(total / porPagina);
    const resultado = linhas.slice(inicio, inicio + porPagina);

    res.json({ ok: true, vendas: resultado, total, pagina, paginas });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// GERAR LINKS — popula coluna LINK na planilha VENDAS
// ====================================================
router.post('/gerar_links', async (req, res) => {
  try {
    const { del } = require('./cache');
    const sheetsModule = require('./sheets');
    const { google } = require('googleapis');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL, null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const api = google.sheets({ version: 'v4', auth });

    resetColMap();
    const colMap  = await getColMap();
    const rows    = await getVendasRows();
    const idxID   = colMap[V_NOMES['ID']];
    const idxLink = colMap['LINK'];

    const colLetra = (n) => n < 26 ? String.fromCharCode(65+n) : String.fromCharCode(64+Math.floor(n/26)) + String.fromCharCode(65+(n%26));
    const colID = colLetra(idxID);

    // 1. Converte ID_CENTRAL em HYPERLINK
    const data = rows.map((row, i) => {
      const id = String(row[idxID] || '').trim();
      if (!id) return null;
      const url  = 'https://central.ignicaodigital.com.br/payment/' + id + '/details';
      const link = '=HYPERLINK("' + url + '";"' + id + '")';
      return { range: ABA.VENDAS + '!' + colID + (i + 2), values: [[link]] };
    }).filter(Boolean);

    const BLOCO = 1000;
    for (let i = 0; i < data.length; i += BLOCO) {
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetsModule.SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: data.slice(i, i + BLOCO) },
      });
    }

    // 2. Apaga coluna LINK se existir
    if (idxLink !== undefined) {
      const meta  = await api.spreadsheets.get({ spreadsheetId: sheetsModule.SPREADSHEET_ID });
      const sheet = meta.data.sheets.find(s => s.properties.title === ABA.VENDAS);
      if (sheet) {
        await api.spreadsheets.batchUpdate({
          spreadsheetId: sheetsModule.SPREADSHEET_ID,
          requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'COLUMNS', startIndex: idxLink, endIndex: idxLink + 1 } } }] }
        });
      }
    }

    del('vendas_rows');
    resetColMap();
    res.json({ ok: true, atualizados: data.length });
  } catch(e) { res.json({ erro: e.message }); }
});

// ====================================================
// RELATÓRIO DINÂMICO — gerado com base nos filtros do dashboard
// ====================================================
router.post('/relatorio_dinamico', async (req, res) => {
  try {
    const { filtros = {} } = req.body;
    const colMap      = await getColMap();
    const dados       = await getVendasRows();
    const eventosInfo = await getEventos();
    const sems        = await getCalendario();

    const mapaData = {};
    eventosInfo.forEach(e => { mapaData[e.nome] = e.dtEvento || '9999-99-99'; });

    const match = (filtro, valor) => !filtro || filtro.length === 0 || filtro.includes(valor);

    const bloco = () => ({ totalVendas:0,totalHC:0,totalValor:0,normalVendas:0,normalHC:0,vipVendas:0,vipHC:0,upgradeVendas:0,upgradeHC:0,cancelVendas:0,cancelHC:0 });
    const acumular = (obj, hc, val, cat, isCancel) => {
      obj.totalVendas++; obj.totalHC += hc; obj.totalValor += val;
      if (cat === 'NORMAL' || cat === 'ESSENTIAL') { obj.normalVendas++; obj.normalHC += hc; }
      else if (cat === 'VIP') { obj.vipVendas++; obj.vipHC += hc; }
      else if (cat.includes('UPGRADE')) { obj.upgradeVendas++; obj.upgradeHC += hc; }
      if (isCancel) { obj.cancelVendas++; obj.cancelHC += hc; }
    };

    const total = bloco(), eventos = {}, canaisMap = {};
    dados.forEach(row => {
      const canal      = String(vRow(row,colMap,'CANAL')      ||'').trim();
      const canalMacro = String(vRow(row,colMap,'CANAL_MACRO')||'').trim();
      const ev         = String(vRow(row,colMap,'EVENTO')     ||'').trim() || 'Sem evento';
      const mes        = String(vRow(row,colMap,'MES')        ||'').trim();
      const semana     = String(vRow(row,colMap,'SEMANA')     ||'').trim();
      const cat        = String(vRow(row,colMap,'CATEGORIA')  ||'').trim().toUpperCase();
      const status     = String(vRow(row,colMap,'STATUS')     ||'').trim().toUpperCase();

      if (!match(filtros.mes,        mes))        return;
      if (!match(filtros.semana,     semana))      return;
      if (!match(filtros.canal,      canal))       return;
      if (!match(filtros.canalMacro, canalMacro))  return;
      if (!match(filtros.evento,     ev))          return;
      if (!match(filtros.categoria,  cat))         return;
      if (!match(filtros.status,     status))      return;

      const hc  = parseFloat(vRow(row,colMap,'HC')) || 0;
      const val = parseFloat(String(vRow(row,colMap,'VALOR')||'0').replace('R$','').replace(/[\s.]/g,'').replace(',','.')) || 0;
      const isCancel = status === 'CANCELADO';

      if (!eventos[ev]) { eventos[ev] = bloco(); eventos[ev].nome = ev; }
      acumular(total, hc, val, cat, isCancel);
      acumular(eventos[ev], hc, val, cat, isCancel);
      canaisMap[canal] = (canaisMap[canal] || 0) + hc;
    });

    // Monta label do período
    let labelPeriodo = 'Todos os períodos';
    if (filtros.semana && filtros.semana.length === 1) {
      const sem = sems.find(s => String(s.num) === String(filtros.semana[0]));
      if (sem) labelPeriodo = `Semana ${sem.num} · ${sem.label}`;
    } else if (filtros.mes && filtros.mes.length > 0) {
      labelPeriodo = filtros.mes.join(', ');
    }

    const blocoTexto = (b, titulo) => [
      titulo, '——————————————',
      `> • *Vendas:* ${b.totalVendas} | *Headcounts:* ${b.totalHC} | *Faturamento:* ${fmtMoeda(b.totalValor)}`,
      `> • Normal: ${b.normalVendas} Vendas | ${b.normalHC} HCs`,
      `> • VIP: ${b.vipVendas} Vendas | ${b.vipHC} HCs`,
      `> • Upgrade: ${b.upgradeVendas} Vendas | ${b.upgradeHC} HCs`,
      `> ❌ Cancelamentos: ${b.cancelVendas} Vendas | ${b.cancelHC} HCs`,
    ].join('\n');

    const canaisTexto = Object.entries(canaisMap)
      .sort((a,b) => b[1]-a[1])
      .map(([c,hc]) => `> • ${c}: ${hc} HCs`)
      .join('\n');

    const ordenados = Object.values(eventos).sort((a,b) => {
      const da = mapaData[a.nome]||'9999-99-99', db = mapaData[b.nome]||'9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    const linhas = [
      `*REPORT DE VENDAS DE INGRESSOS*`,
      `📅 ${labelPeriodo}`,
      '',
      blocoTexto(total, '📊*TOTAIS:*'),
    ];
    if (canaisTexto) { linhas.push(''); linhas.push('📡 *Por Canal:*'); linhas.push(canaisTexto); }
    ordenados.forEach(ev => { linhas.push(''); linhas.push(blocoTexto(ev, `📍*${ev.nome}*`)); });

    res.json({ ok: true, texto: linhas.join('\n') });
  } catch(e) { res.json({ erro: e.message }); }
});

const rotasOk = ['/salvar_oc','/deletar_oc','/get_ocs_evento','/salvar_oc_evento','/salvar_plano_evento','/salvar_ocs_lote','/salvar_planos_lote','/vincular_atualizar','/deletar_oc_evento','/deletar_plano_evento','/aplicar_regra_canal','/salvar_calendario','/salvar_canal','/jornada_upgrade','/rd_get_vendedores','/rd_salvar_metricas','/rd_salvar_venda','/rd_taxas_periodo','/rd_salvar_vendedor','/rd_deletar_vendedor'];
rotasOk.forEach(rota => { router.post(rota, (req, res) => res.json({ ok:true })); router.get(rota, (req, res) => res.json({ ok:true })); });

module.exports = router;

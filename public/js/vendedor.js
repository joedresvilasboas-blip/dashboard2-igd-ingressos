// ===== TELA PERFIL DO VENDEDOR =====
const Vendedor = {
  _dados: null,
  _periodoSel: null,
  _mesIdx: undefined,

  async abrir(codigo) {
    App.showScreen('vendedor');
    this._periodoSel = null;
    this._mesIdx = undefined;
    const el = document.getElementById('vendedor-content');
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:60px"><div class="spinner"></div></div>';
    try {
      // Garante que o config está disponível
      if (!App._config) {
        App._config = await API.getConfig();
      }
      const d = await API.getPerfilVendedor(codigo);
      this._dados = d;
      this._renderTela();
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro ao carregar</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },

  // Chamado pelo select de mês
  selecionarMes(idx) {
    const cfg = App._config || {};
    const meses = cfg.meses || [];
    const m = meses[parseInt(idx)];
    if (!m) return;
    this._mesIdx = parseInt(idx);
    this._periodoSel = { tipo: 'mes', nome: m.nome };
    this._renderSemanas();
    this._renderConteudo();
  },

  // Chamado pelos botões de semana
  selecionarPeriodo(tipo, valor) {
    if (tipo === 'mes-completo') {
      const cfg = App._config || {};
      const meses = cfg.meses || [];
      const m = meses[this._mesIdx || 0];
      this._periodoSel = m ? { tipo: 'mes', nome: m.nome } : null;
    } else {
      this._periodoSel = { tipo: 'sem', semana: parseInt(valor) };
    }
    this._renderSemanas();
    this._renderConteudo();
  },

  // Filtra porSemana[] localmente
  _psFiltrado() {
    const ps  = this._dados.porSemana || [];
    const sel = this._periodoSel;
    if (!sel) return ps;
    if (sel.tipo === 'sem') return ps.filter(s => s.semana === sel.semana);
    if (sel.tipo === 'mes') {
      const cfg = App._config || {};
      const cal = cfg.semanas || [];
      const semsDoMes = cal.filter(s => s.mes === sel.nome);
      if (!semsDoMes.length) return ps;
      const nums = new Set(semsDoMes.map(s => s.num));
      return ps.filter(s => nums.has(s.semana));
    }
    return ps;
  },

  _agregarTotais(ps) {
    const t = { hc:0, va:0, rc:0, upgrade:0, cancelados:0, pontos:0, faturamento:0, atend:0, entrv:0, horasSeg:0, diasAtivos:0 };
    ps.forEach(s => {
      t.hc += s.hc; t.va += s.va; t.rc += s.rc; t.upgrade += s.upgrade;
      t.cancelados += s.cancelados; t.pontos += s.pontos; t.faturamento += (s.faturamento || 0);
      t.atend += s.atend; t.entrv += s.entrv; t.horasSeg += s.horasSeg; t.diasAtivos += s.diasAtivos;
    });
    t.txAtend   = t.atend > 0 ? Math.round(t.entrv / t.atend * 100) : 0;
    t.txEntrv   = t.entrv > 0 ? Math.round(t.hc   / t.entrv * 100) : 0;
    t.hcPorHora = t.horasSeg > 0 ? Math.round((t.hc / (t.horasSeg / 3600)) * 10) / 10 : 0;
    const paceSeg = t.hc > 0 && t.horasSeg > 0 ? Math.round(t.horasSeg / t.hc) : 0;
    const ph = Math.floor(paceSeg / 3600), pm = Math.floor((paceSeg % 3600) / 60);
    t.pace  = paceSeg > 0 ? (ph > 0 ? ph+'h'+String(pm).padStart(2,'0')+'min' : pm+'min') : '—';
    const hh = Math.floor(t.horasSeg / 3600), hm = Math.floor((t.horasSeg % 3600) / 60);
    t.horas = hh + 'h ' + String(hm).padStart(2,'0') + 'min';
    t._semanas = ps.length;
    return t;
  },

  _labelPeriodo() {
    const sel = this._periodoSel;
    if (!sel) {
      const cfg = App._config || {};
      const meses = cfg.meses || [];
      const m = meses[this._mesIdx || 0];
      return m ? m.nome : 'Período';
    }
    if (sel.tipo === 'mes') return sel.nome;
    if (sel.tipo === 'sem') return 'Semana ' + sel.semana;
    return '';
  },

  // Renderiza os botões de semana do mês selecionado
  _renderSemanas() {
    const el = document.getElementById('vendedor-semanas');
    if (!el) return;
    const cfg = App._config || {};
    const meses = cfg.meses || [];
    const m = meses[this._mesIdx || 0];
    if (!m) return;

    const ps = this._dados.porSemana || [];
    const todasSems = cfg.semanas || [];
    const sel = this._periodoSel;
    const numsSemDados = new Set(ps.map(s => s.semana));
    const semsDoMes = todasSems.filter(s => s.strIni <= m.strFim && s.strFim >= m.strIni && numsSemDados.has(s.num));
    const isMes = sel && sel.tipo === 'mes' && sel.nome === m.nome;

    el.innerHTML = `<div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0">
      <button onclick="Vendedor.selecionarPeriodo('mes-completo')"
        style="padding:4px 12px;border-radius:20px;border:1px solid ${isMes?'var(--accent)':'var(--border)'};background:${isMes?'var(--accent-dim)':'transparent'};color:${isMes?'var(--accent)':'var(--text-3)'};font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0">
        Mês
      </button>
      ${semsDoMes.map(s => {
        const ativo = sel && sel.tipo === 'sem' && sel.semana === s.num;
        return `<button onclick="Vendedor.selecionarPeriodo('sem',${s.num})"
          style="padding:4px 10px;border-radius:20px;border:1px solid ${ativo?'var(--accent)':'var(--border)'};background:${ativo?'var(--accent-dim)':'transparent'};color:${ativo?'var(--accent)':'var(--text-3)'};font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0;text-align:center;line-height:1.3">
          Sem ${s.num}<br><small style="font-size:9px;opacity:.7">${s.label}</small>
        </button>`;
      }).join('')}
    </div>`;
  },

  // Renderiza só o conteúdo dinâmico (dados do período)
  _renderConteudo() {
    const el = document.getElementById('vendedor-dados');
    if (!el) return;
    const d  = this._dados;
    const v  = d.vendedor;
    const ps = this._psFiltrado();
    const t  = this._agregarTotais(ps);

    el.innerHTML = `
      <!-- RESUMO RÁPIDO -->
      <div style="display:flex;gap:var(--s4);margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--border)">
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--accent);font-family:'Syne',sans-serif">${t.hc}</div>
          <div style="font-size:10px;color:var(--text-3)">HCs</div>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">${t.pontos}</div>
          <div style="font-size:10px;color:var(--text-3)">Pontos</div>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">${ps.length > 0 ? Math.round(t.hc / ps.length * 10) / 10 : 0}</div>
          <div style="font-size:10px;color:var(--text-3)">HC/sem</div>
        </div>
        <div style="margin-left:auto;text-align:right;align-self:center">
          <div style="font-size:12px;font-weight:600;color:var(--accent)">${this._labelPeriodo()}</div>
          <div style="font-size:10px;color:var(--text-3)">${ps.length} semana${ps.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <!-- PRODUÇÃO -->
      <div class="card" style="margin-bottom:var(--s3);margin-top:var(--s3)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Produção</div>
        ${this._graficoEvolucao(ps)}
        <div style="display:flex;gap:var(--s3);margin-top:var(--s4);flex-wrap:wrap">
          ${this._pill('VA Sales',   t.va,      '#e8b86d')}
          ${this._pill('RC Sales',   t.rc,      '#5d9ee8')}
          ${this._pill('Upgrades',   t.upgrade, '#b86de8')}
          ${t.cancelados > 0 ? this._pill('Cancelados', t.cancelados, '#e85d5d') : ''}
        </div>
        ${this._mixCategorias(ps)}
      </div>

      <!-- FUNIL DE CONVERSÃO -->
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Funil de Conversão</div>
        ${this._funil(t)}
      </div>

      <!-- ATIVIDADE -->
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Atividade</div>
        <div style="display:flex;gap:var(--s3);flex-wrap:wrap;margin-bottom:var(--s3)">
          ${this._pill('Horas faladas', t.horas,      'var(--text)')}
          ${this._pill('Dias ativos',   t.diasAtivos,  'var(--text)')}
          ${this._pill('HCs/hora',      t.hcPorHora,   this._corTaxa(t.hcPorHora, 1, 2))}
          ${this._pill('Pace/venda',    t.pace,        'var(--text)')}
        </div>
        ${this._tabelaAtividade(ps)}
      </div>

      <!-- VA vs RC por semana -->
      ${t.va > 0 || t.rc > 0 ? `
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">VA vs RC por semana</div>
        ${this._graficoVaRc(ps)}
      </div>` : ''}

      <!-- FINANCEIRO / ROI -->
      ${this._blocoROI(v, t, ps)}

      <!-- Feedback -->
      <div id="feedback-card" style="display:none" class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s3)">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">💬 Feedback</div>
          <button class="btn btn-sm btn-secondary" onclick="Vendedor.copiarFeedback()">📋 Copiar</button>
        </div>
        <div id="feedback-texto" style="font-size:13px;color:var(--text);line-height:1.7;white-space:pre-wrap"></div>
      </div>`;
  },

  _renderTela() {
    const el  = document.getElementById('vendedor-content');
    const d   = this._dados;
    const v   = d.vendedor;
    const cfg = App._config || {};
    const meses = cfg.meses || [];

    // Inicializa no mês vigente
    if (this._mesIdx === undefined) {
      this._mesIdx = cfg.mesVigIdx >= 0 ? cfg.mesVigIdx : Math.max(0, meses.length - 1);
      const m = meses[this._mesIdx];
      this._periodoSel = m ? { tipo: 'mes', nome: m.nome } : null;
    }

    el.innerHTML = `
      <div style="padding:var(--s4) var(--s5)">

        <!-- CABEÇALHO FIXO -->
        <div class="card" style="margin-bottom:var(--s3)">
          <div style="display:flex;align-items:center;gap:var(--s3)">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--accent);flex-shrink:0">
              ${(v.apelido||v.nome).slice(0,1).toUpperCase()}
            </div>
            <div style="flex:1">
              <div style="font-size:17px;font-weight:700;color:var(--text)">${v.apelido||v.nome}</div>
              <div style="font-size:11px;color:var(--text-3)">${v.equipe||'—'} · ${v.codigo}${v.dtInicio?' · desde '+v.dtInicio.split('-').reverse().join('/'):''}
              </div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="Vendedor.gerarFeedback()">💬 Feedback</button>
          </div>

          <!-- SELETOR: select de mês + botões de semana -->
          <div style="margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--border)">
            <div style="margin-bottom:var(--s2)">
              <select id="vendedor-mes-sel" class="input select" style="width:100%;font-size:12px;padding:6px 10px"
                onchange="Vendedor.selecionarMes(this.value)">
                ${meses.map((m, i) => `<option value="${i}" ${i === this._mesIdx ? 'selected' : ''}>${m.nome}</option>`).join('')}
              </select>
            </div>
            <div id="vendedor-semanas"></div>
          </div>

          <!-- DADOS DINÂMICOS -->
          <div id="vendedor-dados"></div>
        </div>

      </div>`;

    setTimeout(() => {
      this._renderSemanas();
      this._renderConteudo();
    }, 0);
  },

  // ============================================================
  // COMPONENTES
  // ============================================================

  _pill(label, valor, cor) {
    return `<div style="background:var(--bg-3);border-radius:8px;padding:6px 12px;display:flex;flex-direction:column;align-items:center;min-width:70px">
      <div style="font-size:15px;font-weight:700;color:${cor};font-family:'Syne',sans-serif">${valor}</div>
      <div style="font-size:9px;color:var(--text-3);margin-top:2px;text-transform:uppercase;letter-spacing:.04em">${label}</div>
    </div>`;
  },

  _corTaxa(val, bom, otimo) {
    if (val >= otimo) return '#4caf50';
    if (val >= bom)   return '#ff9800';
    return '#e85d5d';
  },

  _graficoEvolucao(ps) {
    if (!ps.length) return '<div style="height:80px;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:12px">Sem dados no período</div>';
    const maxHC = Math.max(...ps.map(s => s.hc), 1);
    const barras = ps.map(s => {
      const pct = Math.round(s.hc / maxHC * 100);
      const cor = s.hc >= 20 ? '#4caf50' : s.hc >= 10 ? '#ff9800' : '#e85d5d';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="font-size:9px;font-weight:600;color:${cor};height:12px">${s.hc||''}</div>
        <div style="width:100%;flex:1;position:relative">
          <div style="position:absolute;bottom:0;left:0;right:0;height:100%;background:var(--bg-3);border-radius:4px"></div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:${pct}%;background:${cor};border-radius:4px;min-height:${pct>0?2:0}px"></div>
        </div>
        <div style="font-size:8px;color:var(--text-3)">S${s.semana}</div>
      </div>`;
    }).join('');
    return `<div style="display:flex;gap:4px;height:80px">${barras}</div>`;
  },

  _mixCategorias(ps) {
    const total = {};
    ps.forEach(s => {
      Object.entries(s.categorias || {}).forEach(([k, v]) => { total[k] = (total[k]||0) + v; });
    });
    const grand = Object.values(total).reduce((a, b) => a + b, 0);
    if (!grand) return '';
    const defs = [
      { key:'NORMAL',    label:'Normal',    cor:'#5d9ee8' },
      { key:'ESSENTIAL', label:'Essential', cor:'#e8b86d' },
      { key:'VIP',       label:'VIP',       cor:'#b86de8' },
      { key:'UPGRADE',   label:'Upgrade',   cor:'#4caf50' },
    ].filter(c => (total[c.key]||0) > 0);
    const barra = defs.map(c => {
      const pct = Math.round((total[c.key]||0) / grand * 100);
      return `<div style="flex:${pct};background:${c.cor};height:100%;min-width:2px" title="${c.label}: ${total[c.key]} (${pct}%)"></div>`;
    }).join('');
    const legenda = defs.map(c => {
      const pct = Math.round((total[c.key]||0) / grand * 100);
      return `<div style="display:flex;align-items:center;gap:5px">
        <div style="width:8px;height:8px;border-radius:2px;background:${c.cor};flex-shrink:0"></div>
        <span style="font-size:11px;color:var(--text-3)">${c.label} <strong style="color:var(--text)">${pct}%</strong> <span style="font-size:10px">(${total[c.key]})</span></span>
      </div>`;
    }).join('');
    return `
      <div style="margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--border)">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:8px">Mix de Categorias</div>
        <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-bottom:8px">${barra}</div>
        <div style="display:flex;gap:var(--s3);flex-wrap:wrap">${legenda}</div>
      </div>`;
  },

  _funil(t) {
    const steps = [
      { label:'Atendimentos', val:t.atend, cor:'var(--text-2)' },
      { label:'Entrevistas',  val:t.entrv, cor:'#e8b86d',
        taxa: t.atend > 0 ? t.txAtend+'%' : null,
        corTaxa: this._corTaxa(t.txAtend, 30, 50) },
      { label:'HCs',          val:t.hc,    cor:'var(--accent)',
        taxa: t.entrv > 0 ? t.txEntrv+'%' : null,
        corTaxa: this._corTaxa(t.txEntrv, 20, 35) },
    ];
    const maxVal = Math.max(t.atend, 1);
    return `<div style="display:flex;align-items:stretch;gap:0">
      ${steps.map((s, i) => `
        <div style="flex:1;text-align:center">
          ${i > 0 && s.taxa
            ? `<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:var(--s2)">
                <div style="font-size:11px;color:var(--text-3)">→</div>
                <div style="font-size:13px;font-weight:700;color:${s.corTaxa}">${s.taxa}</div>
               </div>`
            : `<div style="height:22px;margin-bottom:var(--s2)"></div>`}
          <div style="background:var(--bg-3);border-radius:8px;padding:var(--s3);margin:0 2px">
            <div style="font-size:20px;font-weight:800;color:${s.cor};font-family:'Syne',sans-serif">${s.val}</div>
            <div style="font-size:9px;color:var(--text-3);margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${s.label}</div>
          </div>
          <div style="margin:6px 2px 0;height:4px;background:var(--bg-3);border-radius:2px;overflow:hidden">
            <div style="height:100%;background:${s.cor};width:${Math.round(s.val/maxVal*100)}%;border-radius:2px"></div>
          </div>
        </div>`).join('')}
    </div>`;
  },

  _graficoVaRc(ps) {
    return ps.map(s => {
      const total = s.va + s.rc;
      const pctVA = total > 0 ? Math.round(s.va/total*100) : 0;
      const pctRC = total > 0 ? Math.round(s.rc/total*100) : 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="font-size:10px;color:var(--text-3);min-width:20px">S${s.semana}</div>
        <div style="flex:1;height:8px;background:var(--bg-3);border-radius:4px;overflow:hidden;display:flex">
          <div style="width:${pctVA}%;background:#e8b86d;height:100%"></div>
          <div style="width:${pctRC}%;background:#5d9ee8;height:100%"></div>
        </div>
        <div style="font-size:10px;color:#e8b86d;min-width:32px">${s.va} VA</div>
        <div style="font-size:10px;color:#5d9ee8;min-width:32px">${s.rc} RC</div>
      </div>`;
    }).join('');
  },

  _tabelaAtividade(ps) {
    const header = `<div style="display:grid;grid-template-columns:30px 50px 1fr 1fr 1fr 1fr 1fr;gap:4px;padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px">
      ${['Sem','Horas','Atend','Entrv','A→E%','E→H%','Dias'].map(h =>
        `<div style="font-size:9px;color:var(--text-3);text-transform:uppercase">${h}</div>`).join('')}
    </div>`;
    const linhas = ps.map(s => {
      const corA = this._corTaxa(s.txAtend, 30, 50);
      const corE = this._corTaxa(s.txEntrv, 20, 35);
      return `<div style="display:grid;grid-template-columns:30px 50px 1fr 1fr 1fr 1fr 1fr;gap:4px;padding:4px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text-3)">S${s.semana}</div>
        <div style="font-size:10px;color:var(--text)">${s.horas}</div>
        <div style="font-size:10px;color:var(--text)">${s.atend}</div>
        <div style="font-size:10px;color:var(--text)">${s.entrv}</div>
        <div style="font-size:10px;color:${corA};font-weight:600">${s.txAtend}%</div>
        <div style="font-size:10px;color:${corE};font-weight:600">${s.txEntrv}%</div>
        <div style="font-size:10px;color:var(--text)">${s.diasAtivos}</div>
      </div>`;
    }).join('');
    return header + linhas;
  },

  // ============================================================
  // BLOCO FINANCEIRO / ROI
  // ============================================================
  _fixoNivel(nivel) {
    return { junior:1500, pleno:1800, senior:2200 }[nivel] || null;
  },

  _blocoROI(v, t, ps) {
    const fixo = this._fixoNivel(v.nivel);
    if (!fixo) return `
      <div class="card" style="margin-bottom:var(--s3);border:1px dashed var(--border)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">💰 Financeiro / ROI</div>
        <div style="font-size:12px;color:var(--text-3)">Nível não cadastrado — vá em Cadastros → Vendedores para definir Junior/Pleno/Senior.</div>
      </div>`;

    const faturamento  = t.faturamento || 0;
    const nivelLabel   = { junior:'Junior', pleno:'Pleno', senior:'Senior' }[v.nivel] || v.nivel;
    const labelPer     = this._labelPeriodo();
    const isMesFechado = this._periodoSel && this._periodoSel.tipo === 'mes';
    const custoFixoCalc = isMesFechado ? fixo : Math.round(fixo / 4 * Math.max(ps.length, 1));
    const comissao   = Math.round(faturamento * 0.25);
    const custoTotal = custoFixoCalc + comissao;
    const lucro      = faturamento - custoTotal;
    const roi        = custoTotal > 0 ? Math.round(lucro / custoTotal * 100) : 0;
    const breakeven  = faturamento > 0 && t.hc > 0 ? Math.ceil(custoTotal / (faturamento / t.hc)) : null;
    const corROI  = roi >= 100 ? '#4caf50' : roi >= 0 ? '#ff9800' : '#e85d5d';
    const iconROI = roi >= 100 ? '🟢' : roi >= 0 ? '🟡' : '🔴';
    const obsFixo = isMesFechado
      ? `Custo fixo do mês (${nivelLabel})`
      : `Custo fixo (${ps.length} sem. × ${Utils.moeda(Math.round(fixo/4))})`;

    let projecao = '';
    if (!isMesFechado && ps.length > 0) {
      const faturMensal = Math.round(faturamento / ps.length * 4);
      const comMensal   = Math.round(faturMensal * 0.25);
      const custoMensal = fixo + comMensal;
      const lucroMensal = faturMensal - custoMensal;
      const roiMensal   = custoMensal > 0 ? Math.round(lucroMensal / custoMensal * 100) : 0;
      projecao = `
        <div style="margin-top:var(--s3);padding:var(--s3);background:var(--bg-3);border-radius:var(--r2)">
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">Projeção Mensal</div>
          <div style="display:flex;gap:var(--s4)">
            <div><div style="font-size:15px;font-weight:700;color:var(--text)">${Utils.moeda(faturMensal)}</div><div style="font-size:9px;color:var(--text-3)">Faturamento proj.</div></div>
            <div><div style="font-size:15px;font-weight:700;color:var(--text)">${Utils.moeda(custoMensal)}</div><div style="font-size:9px;color:var(--text-3)">Custo proj.</div></div>
            <div><div style="font-size:15px;font-weight:700;color:${roiMensal>=0?'#4caf50':'#e85d5d'}">${roiMensal}%</div><div style="font-size:9px;color:var(--text-3)">ROI mensal proj.</div></div>
          </div>
        </div>`;
    }

    const linha = (label, val, cor, bold) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text-3)">${label}</div>
        <div style="font-size:13px;font-weight:${bold?700:500};color:${cor||'var(--text)'}">${val}</div>
      </div>`;

    return `
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s3)">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">💰 Financeiro / ROI</div>
          <div style="display:flex;gap:6px;align-items:center">
            <div style="font-size:11px;font-weight:600;color:var(--accent)">${labelPer}</div>
            <div style="font-size:11px;background:var(--bg-3);padding:3px 10px;border-radius:20px;color:var(--text-3)">${nivelLabel}</div>
          </div>
        </div>
        ${faturamento === 0
          ? `<div style="font-size:12px;color:var(--text-3);padding:var(--s2) 0">Sem faturamento no período selecionado.</div>`
          : `
        <div style="display:flex;align-items:center;gap:var(--s4);padding:var(--s3);background:var(--bg-3);border-radius:var(--r2);margin-bottom:var(--s3)">
          <div style="text-align:center;flex:1">
            <div style="font-size:28px;font-weight:800;color:${corROI};font-family:'Syne',sans-serif">${roi}%</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-top:2px">ROI — ${labelPer}</div>
          </div>
          <div style="text-align:center;flex:1;border-left:1px solid var(--border)">
            <div style="font-size:22px;font-weight:800;color:${lucro>=0?'#4caf50':'#e85d5d'};font-family:'Syne',sans-serif">${lucro>=0?'+':''}${Utils.moeda(lucro)}</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Margem gerada</div>
          </div>
        </div>
        ${linha('Faturamento', Utils.moeda(faturamento), 'var(--accent)', true)}
        ${linha('Comissão (25%)', '− '+Utils.moeda(comissao), '#e85d5d')}
        ${linha(obsFixo, '− '+Utils.moeda(custoFixoCalc), '#e85d5d')}
        ${linha('Custo total', Utils.moeda(custoTotal), 'var(--text-2)')}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0">
          <div style="font-size:12px;font-weight:700;color:var(--text)">Margem líquida</div>
          <div style="font-size:14px;font-weight:800;color:${lucro>=0?'#4caf50':'#e85d5d'}">${lucro>=0?'+':''}${Utils.moeda(lucro)}</div>
        </div>
        ${projecao}
        ${breakeven !== null ? `
        <div style="margin-top:var(--s3);font-size:12px;color:var(--text-3)">
          ${iconROI} Break-even: <strong style="color:var(--text)">${breakeven} HCs</strong> para cobrir o custo
          ${t.hc > 0 ? `· Realizou <strong style="color:${t.hc>=breakeven?'#4caf50':'#e85d5d'}">${t.hc} HCs</strong> no período` : ''}
        </div>` : ''}
        `}
      </div>`;
  },

  // ============================================================
  // FEEDBACK
  // ============================================================
  gerarFeedback() {
    if (!this._dados) return;
    const ps   = this._psFiltrado();
    const t    = this._agregarTotais(ps);
    const v    = this._dados.vendedor;
    const nome = v.apelido || v.nome;

    const ultSem = ps[ps.length - 1];
    const antsHC = ps.slice(0,-1).reduce((s,x) => s+x.hc, 0) / Math.max(ps.length-1, 1);
    const tendHC = !ultSem ? 'sem dados'
      : ultSem.hc > antsHC*1.1 ? 'crescente 📈'
      : ultSem.hc < antsHC*0.9 ? 'em queda 📉' : 'estável ➡️';

    const linhas = [];
    linhas.push(`Olá ${nome}! Análise de desempenho — ${this._labelPeriodo()}:\n`);
    linhas.push(`📊 PRODUÇÃO`);
    linhas.push(`• ${t.hc} HCs | Média ${ps.length>0?Math.round(t.hc/ps.length*10)/10:0} HC/semana`);
    linhas.push(`• VA Sales: ${t.va} HCs | RC Sales: ${t.rc} HCs`);
    if (t.upgrade > 0)    linhas.push(`• ${t.upgrade} upgrades`);
    if (t.cancelados > 0) linhas.push(`• ${t.cancelados} cancelamentos`);
    linhas.push(`• Tendência: ${tendHC}\n`);
    if (t.atend > 0) {
      linhas.push(`📞 ATIVIDADE`);
      linhas.push(`• ${t.horas} faladas · ${t.atend} atend → ${t.entrv} entrv (${t.txAtend}%) → ${t.hc} HCs (${t.txEntrv}%)`);
      linhas.push(`• Pace: ${t.pace}\n`);
    }
    const pontos = [];
    if (t.txAtend >= 50) pontos.push('excelente taxa de engajamento');
    if (t.txEntrv >= 35) pontos.push('alta conversão de entrevistas');
    if (t.hcPorHora >= 2) pontos.push('boa produtividade/hora');
    if (t.va >= t.hc * 0.6) pontos.push('forte geração de venda ativa');
    if (pontos.length) linhas.push(`✅ PONTOS FORTES\n• ${pontos.join('\n• ')}\n`);
    const melhorias = [];
    if (t.txAtend < 30 && t.atend > 0) melhorias.push('melhorar abordagem inicial');
    if (t.txEntrv < 20 && t.entrv > 0) melhorias.push('focar no fechamento');
    if (t.hcPorHora < 1 && t.horasSeg > 0) melhorias.push('aumentar produtividade/hora');
    if (t.cancelados > t.hc * 0.15) melhorias.push('reduzir cancelamentos');
    if (t.diasAtivos < ps.length * 3) melhorias.push('trabalhar mais dias por semana');
    if (melhorias.length) linhas.push(`🎯 PONTOS DE ATENÇÃO\n• ${melhorias.join('\n• ')}\n`);
    linhas.push(`Continue evoluindo! 💪`);

    document.getElementById('feedback-texto').textContent = linhas.join('\n');
    document.getElementById('feedback-card').style.display = 'block';
    document.getElementById('feedback-card').scrollIntoView({ behavior: 'smooth' });
  },

  copiarFeedback() {
    navigator.clipboard.writeText(document.getElementById('feedback-texto').textContent)
      .then(() => Utils.toast('Feedback copiado!', 'success'));
  },
};

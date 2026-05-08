// ===== DASHBOARD =====
const Dashboard = {
  config: null,
  dados: null,
  eventosData: null,
  visao: 'geral', // geral | diario | eventos
  filtros: { mes: [], evento: [], canal: [], canalMacro: [], semana: [], categoria: [], status: [] },
  charts: {},
  _dropAberto: null,
  _diaSel: null,
  _chartDia: null,

  async load() {
    const el = document.getElementById('dash-content');
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>';
    try {
      // Carrega config e dados em paralelo
      const [config] = await Promise.all([
        this.config ? Promise.resolve(this.config) : API.get('config'),
      ]);
      this.config = config;
      this.renderFiltros();
      this.renderVisoes();
      await this.atualizar();
      document.addEventListener('click', e => {
        if (this._dropAberto && !this._dropAberto.contains(e.target)) {
          this._dropAberto.querySelector('.dash-dropdown').style.display = 'none';
          this._dropAberto = null;
        }
      });
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro ao carregar</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },

  toggleFiltros() {
    const el = document.getElementById('dash-filtros');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  },

  // ===== VISÕES (Geral / Diário / Eventos) =====
  renderVisoes() {
    const wrap = document.getElementById('dash-visoes');
    if (!wrap) return;
    wrap.innerHTML = `
      <div style="display:flex;gap:6px;padding:8px 20px;background:var(--bg-2);border-bottom:1px solid var(--border);">
        ${this._btnVisao('geral',    'Geral')}
        ${this._btnVisao('diario',   'Diário')}
        ${this._btnVisao('eventos',  'Eventos')}
      </div>`;
  },

  _btnVisao(v, label) {
    const ativo = this.visao === v;
    return `<button onclick="Dashboard.setVisao('${v}')"
      style="font-size:12px;padding:5px 14px;border-radius:20px;border:1px solid ${ativo ? 'var(--accent)' : 'var(--border-2)'};
      background:${ativo ? 'var(--accent-dim)' : 'transparent'};color:${ativo ? 'var(--accent)' : 'var(--text-3)'};
      cursor:pointer;font-weight:${ativo ? '600' : '400'}"
      id="btn-visao-${v}">${label}</button>`;
  },

  setVisao(v) {
    this.visao = v;
    this.renderVisoes();
    if (v === 'eventos') {
      this.renderEventos();
    } else {
      this.atualizar();
    }
  },

  // ===== FILTROS =====
  renderFiltros() {
    const c = this.config;
    const meses   = (c.meses   || []).map(m => m.nome);
    const semanas = (c.semanas || []).map(s => `Sem ${s.num} · ${s.label}`);
    const eventos = c.eventosFiltro || (c.eventos || []).map(e => e.nome);
    const canais  = c.canais     || [];
    const cats    = c.categorias || [];
    const status  = c.status     || [];

    const macros  = c.canaisMacro || ['VA','VD','RC','GT'];

    const filtrosEl = document.getElementById('dash-filtros');
    if (!filtrosEl) return;

    filtrosEl.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:10px 20px;background:var(--bg-2);border-bottom:1px solid var(--border);">
        ${this._dropdown('dash-f-mes',    'Mês',       meses,   'mes',        [])}
        ${this._dropdown('dash-f-sem',    'Semana',    semanas, 'semana',     [])}
        ${this._dropdown('dash-f-evento', 'Evento',    eventos, 'evento',     [])}
        ${this._dropdown('dash-f-macro',  'Canal',     macros,  'canalMacro', [])}
        ${this._dropdown('dash-f-canal',  'Sub-canal', canais,  'canal',      [])}
        ${this._dropdown('dash-f-cat',    'Categoria', cats,    'categoria',  [])}
        ${this._dropdown('dash-f-status', 'Status',    status,  'status',     [])}
        <button class="btn btn-sm btn-secondary" onclick="Dashboard.limparFiltros()">Limpar</button>
      </div>`;
  },

  _dropdown(id, label, items, filtroKey, presel) {
    const sel = this.filtros[filtroKey] || [];
    const opts = items.map(v => {
      const checked = sel.includes(v) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:pointer;font-size:12px;color:var(--text);white-space:nowrap"
        onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
        <input type="checkbox" value="${v}" ${checked}
          onchange="Dashboard.toggleOpcao('${filtroKey}','${v}',this.checked,'${id}')"
          style="accent-color:var(--accent);width:14px;height:14px">
        ${v}
      </label>`;
    }).join('');
    const btnLabel = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : sel.length + ' selecionados';
    const ativo = sel.length > 0 ? 'border-color:var(--accent);color:var(--accent)' : '';
    return `<div style="display:flex;flex-direction:column;gap:3px;position:relative" id="wrap-${id}">
      <span style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">${label}</span>
      <button onclick="Dashboard.toggleDrop('wrap-${id}')"
        style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;
        background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--r2);
        font-size:12px;color:var(--text);cursor:pointer;min-width:120px;${ativo}" id="btn-${id}">
        <span id="lbl-${id}">${btnLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="dash-dropdown" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;
        background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r2);
        min-width:180px;max-height:220px;overflow-y:auto;z-index:100;box-shadow:var(--shadow)">
        <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;font-size:12px;
          color:var(--accent);border-bottom:1px solid var(--border);font-weight:600"
          onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
          <input type="checkbox" onchange="Dashboard.toggleTodos('${filtroKey}','${id}',this.checked)"
            ${sel.length === 0 ? 'checked' : ''}
            style="accent-color:var(--accent);width:14px;height:14px">
          Todos
        </label>
        ${opts}
      </div>
    </div>`;
  },

  toggleDrop(wrapId) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const drop = wrap.querySelector('.dash-dropdown');
    const jaAberto = drop.style.display !== 'none';
    document.querySelectorAll('.dash-dropdown').forEach(d => d.style.display = 'none');
    this._dropAberto = null;
    if (!jaAberto) { drop.style.display = 'block'; this._dropAberto = wrap; }
  },

  toggleOpcao(filtroKey, valor, checked, id) {
    if (!this.filtros[filtroKey]) this.filtros[filtroKey] = [];
    // Para semana, extrai só o número (ex: "Sem 12 · 18/03 a 24/03" → "12")
    const valorReal = filtroKey === 'semana'
      ? String(valor.match(/Sem\s*(\d+)/)?.[1] || valor)
      : valor;
    if (checked) { if (!this.filtros[filtroKey].includes(valorReal)) this.filtros[filtroKey].push(valorReal); }
    else { this.filtros[filtroKey] = this.filtros[filtroKey].filter(v => v !== valorReal); }
    this._atualizarBotao(filtroKey, id);
    if (this.visao === 'eventos') {
      if (filtroKey === 'evento') this._renderListaEventos();
      else this.renderEventos();
    } else this.atualizar();
  },

  toggleTodos(filtroKey, id, checked) {
    const wrap = document.getElementById('wrap-' + id);
    if (!wrap) return;
    // Limpa filtros de semana ao selecionar "Todos"
    if (!checked && filtroKey === 'semana') {
      this.filtros['semana'] = [];
    }
    wrap.querySelectorAll('.dash-dropdown input[type=checkbox]:not(:first-child)').forEach(cb => cb.checked = false);
    this.filtros[filtroKey] = [];
    this._atualizarBotao(filtroKey, id);
    if (this.visao === 'eventos') {
      if (filtroKey === 'evento') this._renderListaEventos();
      else this.renderEventos();
    } else this.atualizar();
  },

  _atualizarBotao(filtroKey, id) {
    const sel = this.filtros[filtroKey] || [];
    const lbl = document.getElementById('lbl-' + id);
    const btn = document.getElementById('btn-' + id);
    const todosCheck = document.querySelector(`#wrap-${id} .dash-dropdown label:first-child input`);
    if (lbl) lbl.textContent = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : sel.length + ' selecionados';
    if (btn) { btn.style.borderColor = sel.length > 0 ? 'var(--accent)' : 'var(--border-2)'; btn.style.color = sel.length > 0 ? 'var(--accent)' : 'var(--text)'; }
    if (todosCheck) todosCheck.checked = sel.length === 0;
  },

  limparFiltros() {
    this.filtros = { mes: [], evento: [], canal: [], canalMacro: [], semana: [], categoria: [], status: [] };
    this.renderFiltros();
    if (this.visao === 'eventos') this.renderEventos();
    else this.atualizar();
  },

  // ===== ATUALIZAR (Geral e Diário) =====
  async atualizar() {
    const el = document.getElementById('dash-content');
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>';
    try {
      const d = await API.post('dashboard', { filtros: this.filtros });
      this.dados = d;
      if (this.visao === 'diario') this.renderDiario(d);
      else this.renderGeral(d);
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },

  // ===== VISÃO GERAL =====
  renderGeral(d) {
    const el = document.getElementById('dash-content');
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s3);margin-bottom:var(--s4)">
        ${this._metrica('Total HCs', d.totalHC, 'headcounts', '')}
        ${this._metrica('Faturamento', 'R$ ' + Number(d.totalValor||0).toLocaleString('pt-BR',{minimumFractionDigits:2}), 'valor total', '')}
        ${this._metrica('Vendedores', d.vendedoresAtivos, 'com vendas', '')}
        ${this._metrica('HCs Hoje', d.hojeHC, d.hojeStr || '', 'accent')}
      </div>
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s4)">HCs por Mês</div>
        <div style="position:relative;height:180px"><canvas id="chart-mes"></canvas></div>
      </div>
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s4)">Canal Macro</div>
        <div id="chart-canal-macro"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s4)">Sub-canal</div>
          <div id="chart-canal"></div>
        </div>
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s4)">Por Categoria</div>
          <div id="chart-cat"></div>
        </div>
      </div>
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s4)">Por Evento</div>
        <div id="chart-evento"></div>
      </div>
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s4)">Ranking Vendedores</div>
        <div id="chart-ranking"></div>
      </div>
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s4)">
          <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em">🔍 Origem dos Upgrades</div>
          <span style="font-size:11px;color:var(--text-3)">Reage aos filtros</span>
        </div>
        <div id="jornada-geral-content"></div>
      </div>`;
    setTimeout(() => { this._renderChartsGeral(d); this._carregarJornadaGeral(); }, 50);
  },

  // ===== VISÃO DIÁRIA =====
  renderDiario(d) {
    const hoje = new Date().toISOString().slice(0,10);
    if (!this._diaSel) this._diaSel = hoje;
    const dias = (d.porDia || []).sort((a,b) => a.data < b.data ? 1 : -1);

    const el = document.getElementById('dash-content');
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s3);margin-bottom:var(--s4)">
        ${this._metrica('Total HCs', d.totalHC, 'headcounts', '')}
        ${this._metrica('Faturamento', 'R$ ' + Number(d.totalValor||0).toLocaleString('pt-BR',{minimumFractionDigits:2}), 'valor total', '')}
        ${this._metrica('Vendedores', d.vendedoresAtivos, 'com vendas', '')}
        ${this._metrica('HCs Hoje', d.hojeHC, d.hojeStr || '', 'accent')}
      </div>
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s4)">HCs por Dia</div>
        <div style="position:relative;height:180px"><canvas id="chart-dia"></canvas></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
        <div class="card">
          <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s3)">Detalhamento por Dia</div>
          <div id="lista-dias"></div>
        </div>
        <div class="card" id="card-detalhe-dia">
          <div style="font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s3)" id="titulo-dia">Selecione um dia</div>
          <div id="detalhe-dia"><div class="empty-sub">Clique em um dia para ver o detalhamento</div></div>
        </div>
      </div>`;

    setTimeout(() => {
      this._renderChartDia(d.porDia || []);
      this._renderListaDias(dias);
      if (this._diaSel) this._renderDetalheDia(d, this._diaSel);
    }, 50);
  },

  _renderChartDia(porDia) {
    if (this._chartDia) { try { this._chartDia.destroy(); } catch(e) {} }
    const canvas = document.getElementById('chart-dia');
    if (!canvas || !porDia.length) return;
    const sorted = [...porDia].sort((a,b) => a.data < b.data ? -1 : 1);
    this._chartDia = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.data.slice(5).split('-').reverse().join('/')),
        datasets: [{ data: sorted.map(d => d.hc),
          backgroundColor: sorted.map(d => d.data === this._diaSel ? '#e8b86d' : 'rgba(232,184,109,0.3)'),
          borderRadius: 3, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: (_, els) => { if (els.length) { this._diaSel = sorted[els[0].index].data; this._renderChartDia(porDia); this._renderDetalheDia(this.dados, this._diaSel); } },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#5a5550', font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 20 }, grid: { display: false } },
          y: { ticks: { color: '#5a5550', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  },

  _renderListaDias(dias) {
    const el = document.getElementById('lista-dias');
    if (!el) return;
    const max = dias.reduce((m,d) => Math.max(m, d.hc), 1);
    el.innerHTML = dias.map(d => {
      const sel = d.data === this._diaSel;
      const pct = Math.round(d.hc / max * 100);
      const dataFmt = d.data.slice(8) + '/' + d.data.slice(5,7);
      return `<div onclick="Dashboard.selecionarDia('${d.data}')" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r2);cursor:pointer;margin-bottom:2px;
        background:${sel ? 'var(--accent-dim)' : 'transparent'};border:1px solid ${sel ? 'var(--accent)' : 'transparent'}">
        <span style="font-size:11px;color:${sel ? 'var(--accent)' : 'var(--text-3)'};min-width:40px;font-weight:${sel?'600':'400'}">${dataFmt}</span>
        <div style="flex:1;height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${sel ? 'var(--accent)' : 'var(--text-3)'};border-radius:3px"></div>
        </div>
        <span style="font-size:11px;font-weight:600;color:${sel ? 'var(--accent)' : 'var(--text)'};min-width:30px;text-align:right">${d.hc}</span>
        <span style="font-size:10px;color:var(--text-3);min-width:70px;text-align:right">R$ ${Number(d.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
      </div>`;
    }).join('') || '<div class="empty-sub">Sem dados</div>';
  },

  selecionarDia(data) {
    this._diaSel = data;
    this._renderChartDia(this.dados.porDia || []);
    this._renderListaDias((this.dados.porDia || []).sort((a,b) => a.data < b.data ? 1 : -1));
    this._renderDetalheDia(this.dados, data);
  },

  _renderDetalheDia(d, data) {
    const titulo = document.getElementById('titulo-dia');
    const el = document.getElementById('detalhe-dia');
    if (!titulo || !el) return;
    const dataFmt = data.slice(8) + '/' + data.slice(5,7) + '/' + data.slice(0,4);
    titulo.textContent = dataFmt;

    const doDia = (d.porDiaDetalhe || {})[data] || { canal: [], evento: [], ranking: [] };

    el.innerHTML = `
      <div style="margin-bottom:var(--s4)">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s2)">Por Canal</div>
        ${this._miniBarras(doDia.canal || [])}
      </div>
      <div style="margin-bottom:var(--s4)">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s2)">Por Categoria</div>
        ${this._miniBarras(doDia.categoria || [], ['#5cb876','#e8b86d','#5d9ee8','#e85d5d'])}
      </div>
      <div style="margin-bottom:var(--s4)">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s2)">Por Evento</div>
        ${this._miniBarras(doDia.evento || [])}
      </div>
      <div>
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s2)">Ranking</div>
        ${this._miniRanking(doDia.ranking || [])}
      </div>`;
  },

  _miniBarras(dados, cores) {
    if (!dados.length) return '<div class="empty-sub">Sem dados</div>';
    const max = dados.reduce((m,d) => Math.max(m, d.hc), 1);
    const CRS = cores || ['#e8b86d','#5cb876','#5d9ee8','#e85d5d','#b86de8'];
    return dados.map((d,i) => `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <div style="font-size:10px;color:var(--text-2);min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.nome}</div>
        <div style="flex:1;height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden">
          <div style="width:${Math.round(d.hc/max*100)}%;height:100%;background:${CRS[i%CRS.length]};border-radius:3px"></div>
        </div>
        <div style="font-size:10px;font-weight:600;color:var(--text);min-width:24px;text-align:right">${d.hc}</div>
      </div>`).join('');
  },

  _miniRanking(dados) {
    if (!dados.length) return '<div class="empty-sub">Sem dados</div>';
    return dados.slice(0,8).map((v,i) => `
      <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:0.5px solid var(--border)">
        <span style="font-size:10px;color:var(--text-3);min-width:16px;text-align:right">${i+1}</span>
        <span style="font-size:11px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.nome}</span>
        <span style="font-size:11px;font-weight:600;color:var(--accent)">${v.hc} HC</span>
      </div>`).join('');
  },

  // ===== VISÃO EVENTOS =====
  async renderEventos() {
    const el = document.getElementById('dash-content');
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>';
    try {
      const [d, capRes] = await Promise.all([
        API.post('eventos', { filtros: this.filtros }),
        API.getCapacidadeEvento(''),
      ]);
      this.eventosData = d.eventos || [];
      // Mapa de capacidade por evento
      this._mapaCapacidade = {};
      (capRes.eventos || []).forEach(e => { this._mapaCapacidade[e.nome] = e; });
      this._noShowPago     = capRes.noShowPago     || 0;
      this._noShowGratuito = capRes.noShowGratuito || 0;
      this._renderListaEventos();
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },

  _filtroEventos: 'proximos',

  _renderListaEventos() {
    const el = document.getElementById('dash-content');
    const f = this._filtroEventos;

    // Usa filtro nativo de evento do topo
    const eventosFiltrados = this.filtros.evento || [];

    let lista = this.eventosData || [];
    if (f === 'proximos')    lista = lista.filter(e => e.futuro);
    else if (f === 'realizados') lista = lista.filter(e => !e.futuro);
    // f === 'todos' → sem filtro de futuro/passado

    if (eventosFiltrados.length > 0) {
      lista = lista.filter(e => eventosFiltrados.includes(e.nome));
    }

    const btnStyle = (v) => `font-size:12px;padding:5px 14px;border-radius:20px;cursor:pointer;
      border:1px solid ${this._filtroEventos===v?'var(--accent)':'var(--border-2)'};
      background:${this._filtroEventos===v?'var(--accent-dim)':'transparent'};
      color:${this._filtroEventos===v?'var(--accent)':'var(--text-3)'}`;

    el.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:var(--s3)">
        <button style="${btnStyle('proximos')}"   onclick="Dashboard._filtroEventos='proximos';Dashboard._renderListaEventos()">Próximos</button>
        <button style="${btnStyle('realizados')}" onclick="Dashboard._filtroEventos='realizados';Dashboard._renderListaEventos()">Realizados</button>
        <button style="${btnStyle('todos')}"      onclick="Dashboard._filtroEventos='todos';Dashboard._renderListaEventos()">Todos</button>
        <div style="margin-left:auto;display:flex;gap:var(--s2);align-items:center">
          <span style="font-size:11px;color:var(--text-3)">No-show:</span>
          <input id="dash-ns-pago" type="number" min="0" max="100" value="${this._noShowPago||0}"
            style="width:48px;padding:3px 6px;font-size:11px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);text-align:center"
            placeholder="%" title="No-show pagos (%)">
          <span style="font-size:10px;color:var(--text-3)">% pago</span>
          <input id="dash-ns-grat" type="number" min="0" max="100" value="${this._noShowGratuito||0}"
            style="width:48px;padding:3px 6px;font-size:11px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);text-align:center"
            placeholder="%" title="No-show gratuitos (%)">
          <span style="font-size:10px;color:var(--text-3)">% grat.</span>
          <button class="btn btn-sm btn-primary" style="padding:3px 10px;font-size:11px" onclick="Dashboard.salvarNoShow()">✓</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">${lista.length} evento${lista.length!==1?'s':''}</div>
      ${lista.map(ev => this._cardEvento(ev)).join('') || '<div class="empty"><div class="empty-title">Nenhum evento encontrado</div></div>'}`;
  },

  _cardEvento(ev) {
    const cap     = this._mapaCapacidade?.[ev.nome];
    const capNum  = parseInt(ev.capacidade) || 0;
    const pctVend = ev.pct || 0;
    const corVend = pctVend >= 100 ? '#e85d5d' : pctVend >= 70 ? '#ff9800' : '#e8b86d';

    // Presença estimada
    const presenca    = cap?.presencaEstimada || 0;
    const pctPresenca = cap?.pctOcupacao      || 0;
    const corPres     = pctPresenca >= 80 ? '#4caf50' : pctPresenca >= 50 ? '#ff9800' : '#e85d5d';

    const diasBadge = ev.futuro
      ? `<span style="font-size:10px;background:var(--accent-dim);color:var(--accent);border-radius:20px;padding:2px 8px;white-space:nowrap">${ev.diasRestantes} dias</span>`
      : `<span style="font-size:10px;background:var(--bg-3);color:var(--text-3);border-radius:20px;padding:2px 8px">realizado</span>`;

    // Badges de categoria
    const badges = [
      { label: 'Normal',    val: ev.vendNormal  - (ev.vendEssential||0), cor: '#5d9ee8' },
      { label: 'Essential', val: ev.vendEssential||0,                    cor: '#b86de8' },
      { label: 'VIP',       val: ev.vendVip,                             cor: '#e8b86d' },
      { label: 'Upgrade',   val: ev.vendUpgrade,                         cor: '#5cb876' },
    ].filter(b => b.val > 0).map(b => `
      <div style="background:var(--bg-3);border-radius:8px;padding:8px 10px;text-align:center;flex:1">
        <div style="font-size:15px;font-weight:700;color:${b.cor}">${b.val}</div>
        <div style="font-size:9px;color:var(--text-3);margin-top:2px">${b.label}</div>
      </div>`).join('');

    // Pagos / Gratuitos / Cancelados
    const resumoHtml = cap ? `
      <div style="display:flex;gap:var(--s2);font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">
        <span>✓ <strong style="color:var(--text)">${cap.pagos}</strong> pagos</span>
        <span>· 🎁 <strong style="color:var(--text)">${cap.gratuitos}</strong> gratuitos</span>
        ${cap.cancelados > 0 ? `<span>· ✕ <strong style="color:#e85d5d">${cap.cancelados}</strong> cancelados</span>` : ''}
      </div>` : '';

    // Canais agrupados por Canal Macro
    const CORES_CANAL = ['#e8b86d','#5cb876','#5d9ee8','#e85d5d','#b86de8','#e8b05d'];
    const canaisArr   = ev.canaisArr || [];
    const macroLabel  = { VA: 'Venda Ativa', VD: 'Venda Direta', RC: 'Recuperação', GT: 'Gratuito' };
    const macroCor    = { VA: '#e8b86d', VD: '#5d9ee8', RC: '#5cb876', GT: '#b86de8' };

    // Agrupa sub-canais por macro
    const gruposMacro = {};
    const semMacro    = [];
    canaisArr.forEach(c => {
      if (c.macro) {
        if (!gruposMacro[c.macro]) gruposMacro[c.macro] = { hc: 0, canais: [] };
        gruposMacro[c.macro].hc += c.hc;
        gruposMacro[c.macro].canais.push(c);
      } else {
        semMacro.push(c);
      }
    });

    const maxHC = Math.max(...Object.values(gruposMacro).map(g => g.hc), ...semMacro.map(c => c.hc), 1);

    const canaisHtml = [
      ...Object.keys(gruposMacro).sort((a,b) => gruposMacro[b].hc - gruposMacro[a].hc).map(m => {
        const g    = gruposMacro[m];
        const pctM = ev.vendTotal > 0 ? Math.round(g.hc / ev.vendTotal * 100) : 0;
        const barM = Math.round(g.hc / maxHC * 100);
        const subs = g.canais.sort((a,b) => b.hc - a.hc).map(c => {
          const pctC = ev.vendTotal > 0 ? Math.round(c.hc / ev.vendTotal * 100) : 0;
          const barC = Math.round(c.hc / maxHC * 100);
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding-left:18px">
            <div style="font-size:10px;color:var(--text-3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</div>
            <div style="flex:1;height:3px;background:var(--bg-3);border-radius:2px;overflow:hidden">
              <div style="width:${barC}%;height:100%;background:${macroCor[m]||'var(--text-3)'};border-radius:2px;opacity:.6"></div>
            </div>
            <div style="font-size:10px;color:var(--text-3);min-width:36px;text-align:right">${c.hc} HC</div>
            <div style="font-size:10px;color:var(--text-3);min-width:28px;text-align:right">${pctC}%</div>
          </div>`;
        }).join('');
        return `
          <div style="margin-bottom:var(--s2)">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <div style="width:8px;height:8px;border-radius:50%;background:${macroCor[m]||'var(--text-3)'};flex-shrink:0"></div>
              <div style="font-size:12px;font-weight:700;color:${macroCor[m]||'var(--text)'};flex:1">${m} <span style="font-weight:400;font-size:10px;color:var(--text-3)">${macroLabel[m]||''}</span></div>
              <div style="flex:1;height:4px;background:var(--bg-3);border-radius:2px;overflow:hidden">
                <div style="width:${barM}%;height:100%;background:${macroCor[m]||'var(--text-3)'};border-radius:2px"></div>
              </div>
              <div style="font-size:11px;font-weight:700;color:var(--text);min-width:36px;text-align:right">${g.hc} HC</div>
              <div style="font-size:10px;color:var(--text-3);min-width:28px;text-align:right">${pctM}%</div>
            </div>
            ${subs}
          </div>`;
      }),
      ...semMacro.map((c, i) => {
        const pct = ev.vendTotal > 0 ? Math.round(c.hc / ev.vendTotal * 100) : 0;
        const bar = Math.round(c.hc / maxHC * 100);
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <div style="width:8px;height:8px;border-radius:50%;background:${CORES_CANAL[i%CORES_CANAL.length]};flex-shrink:0"></div>
          <div style="font-size:11px;color:var(--text-2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</div>
          <div style="flex:1;height:4px;background:var(--bg-3);border-radius:2px;overflow:hidden">
            <div style="width:${bar}%;height:100%;background:${CORES_CANAL[i%CORES_CANAL.length]};border-radius:2px"></div>
          </div>
          <div style="font-size:11px;font-weight:600;color:var(--text);min-width:36px;text-align:right">${c.hc} HC</div>
          <div style="font-size:10px;color:var(--text-3);min-width:28px;text-align:right">${pct}%</div>
        </div>`;
      })
    ].join('');

    return `<div class="card" style="margin-bottom:var(--s3);border-left:3px solid ${ev.futuro ? 'var(--accent)' : 'var(--border)'}">

      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:14px;font-weight:700;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ev.nome}</span>
        <div style="margin-left:var(--s3);flex-shrink:0">${diasBadge}</div>
      </div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s4)">
        📅 ${ev.dtEvento || '—'} · Cap: <strong style="color:var(--text)">${capNum.toLocaleString('pt-BR')}</strong>
      </div>

      <!-- Métricas principais lado a lado -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
        <div>
          <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Vendidos</div>
          <div style="font-size:28px;font-weight:800;font-family:'Syne',sans-serif;color:${capNum > 0 ? corVend : 'var(--text)'};line-height:1">${ev.vendTotal}</div>
          ${capNum > 0 ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${pctVend}% da capacidade</div>` : `<div style="font-size:11px;color:var(--text-3);margin-top:2px">sem capacidade cadastrada</div>`}
        </div>
        ${cap && capNum > 0 ? `<div>
          <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Presença Est.</div>
          <div style="font-size:28px;font-weight:800;font-family:'Syne',sans-serif;color:${corPres};line-height:1">${presenca}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">${pctPresenca}% de ocupação</div>
        </div>` : ''}
      </div>

      <!-- Barra de progresso gradiente -->
      ${capNum > 0 ? (() => {
        const pct2 = cap ? pctPresenca : pctVend;
        // Cor exata do gradiente: vermelho(0) → amarelo(50) → verde(100)
        const r = pct2 <= 50 ? 255 : Math.round(255 - (pct2 - 50) * 5.1);
        const g = pct2 <= 50 ? Math.round(pct2 * 5.1) : 255;
        const barColor = `rgb(${r},${g},50)`;
        return `<div style="margin-bottom:var(--s3)">
          <div style="background:var(--bg-3);border-radius:99px;height:8px;overflow:hidden">
            <div style="height:100%;border-radius:99px;background:${barColor};width:${Math.min(pct2,100)}%;transition:width .6s"></div>
          </div>
        </div>`;
      })() : ''}

      <!-- Pagos / Gratuitos / Cancelados — blocos largos iguais -->
      ${cap && capNum > 0 ? `
      <div style="display:flex;gap:var(--s2);margin-bottom:var(--s3)">
        <div style="background:var(--bg-3);border-radius:8px;padding:8px 10px;text-align:center;flex:1">
          <div style="font-size:15px;font-weight:700;color:var(--text)">${cap.pagos}</div>
          <div style="font-size:9px;color:var(--text-3);margin-top:2px">✓ Pagos</div>
        </div>
        <div style="background:var(--bg-3);border-radius:8px;padding:8px 10px;text-align:center;flex:1">
          <div style="font-size:15px;font-weight:700;color:var(--text)">${cap.gratuitos}</div>
          <div style="font-size:9px;color:var(--text-3);margin-top:2px">🎁 Gratuitos</div>
        </div>
        <div style="background:var(--bg-3);border-radius:8px;padding:8px 10px;text-align:center;flex:1">
          <div style="font-size:15px;font-weight:700;color:${cap.cancelados>0?'#e85d5d':'var(--text)'}">${cap.cancelados}</div>
          <div style="font-size:9px;color:var(--text-3);margin-top:2px">✕ Cancelados</div>
        </div>
      </div>` : resumoHtml}

      <!-- Badges de categoria — blocos largos iguais -->
      ${badges ? `<div style="display:flex;gap:var(--s2);margin-bottom:var(--s3)">${badges}</div>` : ''}

      <!-- Por Canal (accordion hierárquico) -->
      ${canaisArr.length > 0 ? `
      <div style="border-top:1px solid var(--border);padding-top:var(--s3)">
        <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('span:last-child').textContent=this.nextElementSibling.style.display==='none'?'▾':'▴'"
          style="width:100%;display:flex;justify-content:space-between;background:none;border:none;cursor:pointer;padding:0">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Por Canal</span>
          <span style="font-size:11px;color:var(--accent)">${Object.keys(gruposMacro).length} canal${Object.keys(gruposMacro).length!==1?'is':''} macro ▾</span>
        </button>
        <div style="display:none;padding-top:var(--s3)">${canaisHtml}</div>
      </div>` : ''}

      <!-- Jornada do Upgrade (accordion) -->
      ${ev.vendUpgrade > 0 ? `
      <div style="border-top:1px solid var(--border);margin-top:var(--s3)">
        <button onclick="Dashboard.toggleJornada(this, '${ev.nome.replace(/'/g, "\\'")}', event)"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:var(--s3) 0;background:none;border:none;cursor:pointer">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">🔍 Origem dos Upgrades</span>
          <span style="font-size:11px;color:var(--accent)">${ev.vendUpgrade} upgrades ▾</span>
        </button>
        <div class="jornada-body" style="display:none;padding-bottom:var(--s3)">
          <div class="jornada-loading" style="font-size:11px;color:var(--text-3)">Carregando...</div>
        </div>
      </div>` : ''}

    </div>`;
  },

  async salvarNoShow() {
    const pago     = parseFloat(document.getElementById('dash-ns-pago')?.value) || 0;
    const gratuito = parseFloat(document.getElementById('dash-ns-grat')?.value) || 0;
    try {
      await API.salvarNoShowEvento(pago, gratuito);
      this._noShowPago     = pago;
      this._noShowGratuito = gratuito;
      // Recarrega dados de capacidade e re-renderiza
      const capRes = await API.getCapacidadeEvento('');
      this._mapaCapacidade = {};
      (capRes.eventos || []).forEach(e => { this._mapaCapacidade[e.nome] = e; });
      this._renderListaEventos();
      Utils.toast('No-show salvo!', 'success');
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  // ===== HELPERS =====
  _metrica(label, valor, sub, tipo) {
    const accent = tipo === 'accent';
    return `<div class="card card-sm" style="${accent ? 'border-color:var(--accent);background:var(--accent-dim);' : ''}">
      <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s2)">${label}</div>
      <div style="font-size:24px;font-weight:700;font-family:var(--font-display);color:${accent ? 'var(--accent)' : 'var(--text)'};line-height:1">${valor}</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:var(--s1)">${sub}</div>
    </div>`;
  },

  _renderChartsGeral(d) {
    Object.values(this.charts).forEach(c => { try { c.destroy(); } catch(e) {} });
    this.charts = {};
    const ACCENT = '#e8b86d';
    const CORES = ['#e8b86d','#5cb876','#5d9ee8','#e85d5d','#b86de8','#e8b05d','#5de8d4','#e85db0'];

    const canvasMes = document.getElementById('chart-mes');
    if (canvasMes && d.porMes && d.porMes.length) {
      this.charts.mes = new Chart(canvasMes, {
        type: 'bar',
        data: { labels: d.porMes.map(m => m.nome), datasets: [{ data: d.porMes.map(m => m.hc), backgroundColor: ACCENT, borderRadius: 4, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: '#5a5550', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#5a5550', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
      });
    }
    this._renderBarras('chart-canal-macro', d.porCanalMacro || [], ['#e8b86d','#5d9ee8','#5cb876']);
    this._renderBarras('chart-canal', d.porCanal || [], CORES);
    this._renderBarras('chart-cat', d.porCategoria || [], ['#5cb876','#e8b86d','#5d9ee8','#e85d5d']);
    this._renderBarras('chart-evento', d.porEvento || [], CORES);
    this._renderRanking('chart-ranking', d.ranking || []);
  },

  _renderBarras(elId, dados, cores) {
    const el = document.getElementById(elId);
    if (!el) return;
    const max = dados.reduce((m, d) => Math.max(m, d.hc), 1);
    el.innerHTML = dados.map((d, i) => {
      const pct = Math.round((d.hc / max) * 100);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="font-size:11px;color:var(--text-2);min-width:100px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.nome}">${d.nome}</div>
        <div style="flex:1;height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${cores[i%cores.length]};border-radius:3px"></div>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text);min-width:36px;text-align:right">${d.hc}</div>
      </div>`;
    }).join('') || '<div class="empty-sub">Sem dados</div>';
  },

  _renderRanking(elId, dados) {
    const el = document.getElementById(elId);
    if (!el) return;
    const M = ['🥇','🥈','🥉'];
    el.innerHTML = dados.slice(0, 15).map((v, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:0.5px solid var(--border)">
        <span style="font-size:${i<3?'16':'12'}px;min-width:28px;text-align:center;color:var(--text-3)">${i<3?M[i]:i+1}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.nome}</div>
          <div style="font-size:11px;color:var(--text-3)">${v.codigo}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:700;color:var(--accent)">${v.pontos} pts</div>
          <div style="font-size:11px;color:var(--text-3)">${v.hc} HC</div>
        </div>
      </div>`).join('') || '<div class="empty-sub">Sem dados</div>';
  },

  // ===== JORNADA DO UPGRADE =====
  async toggleJornada(btn, eventoNome, event) {
    event.stopPropagation();
    const body = btn.nextElementSibling;
    const aberto = body.style.display !== 'none';

    if (aberto) {
      body.style.display = 'none';
      btn.querySelector('span:last-child').textContent = btn.querySelector('span:last-child').textContent.replace('▴','▾');
      return;
    }

    body.style.display = 'block';
    btn.querySelector('span:last-child').textContent = btn.querySelector('span:last-child').textContent.replace('▾','▴');

    // Já carregado
    if (!body.querySelector('.jornada-loading')) return;

    try {
      const d = await API.getJornadaUpgrade(eventoNome, this.filtros);
      this._renderJornadaBody(body, d);
    } catch(e) {
      body.innerHTML = `<div style="font-size:11px;color:var(--red)">Erro: ${e.message}</div>`;
    }
  },

  _renderJornadaBody(el, d) {
    if (!d.total) { el.innerHTML = '<div style="font-size:11px;color:var(--text-3)">Sem upgrades no período.</div>'; return; }

    const CORES = ['#e8b86d','#5cb876','#5d9ee8','#e85d5d','#b86de8','#e8b05d'];
    const maxCount = d.canais.reduce((m, c) => Math.max(m, c.count), 1);

    const canaisHtml = d.canais.map((c, i) => {
      const pct = Math.round(c.count / d.identificados * 100);
      const barW = Math.round(c.count / maxCount * 100);
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <div style="width:8px;height:8px;border-radius:50%;background:${CORES[i%CORES.length]};flex-shrink:0"></div>
        <div style="font-size:11px;color:var(--text-2);min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.canal}</div>
        <div style="flex:1;height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden">
          <div style="width:${barW}%;height:100%;background:${CORES[i%CORES.length]};border-radius:3px"></div>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text);min-width:20px;text-align:right">${c.count}</div>
        <div style="font-size:10px;color:var(--text-3);min-width:28px;text-align:right">${pct}%</div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div style="display:flex;gap:var(--s4);margin-bottom:var(--s3);flex-wrap:wrap">
        <div>
          <div style="font-size:10px;color:var(--text-3)">Total upgrades</div>
          <div style="font-size:18px;font-weight:700;color:var(--text)">${d.total}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-3)">Origem identificada</div>
          <div style="font-size:18px;font-weight:700;color:var(--green)">${d.identificados} <span style="font-size:12px;font-weight:400">(${d.pct}%)</span></div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-3)">Sem identificação</div>
          <div style="font-size:18px;font-weight:700;color:var(--text-3)">${d.semIdentificacao}</div>
        </div>
      </div>
      ${d.canais.length ? `
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s2)">Canal de origem da compra Normal</div>
        ${canaisHtml}
      ` : '<div style="font-size:11px;color:var(--text-3)">Nenhuma origem identificada.</div>'}`;
  },

  async _carregarJornadaGeral() {
    const el = document.getElementById('jornada-geral-content');
    if (!el) return;
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:var(--s4)"><div class="spinner"></div></div>';
    try {
      const d = await API.getJornadaUpgrade(null, this.filtros);
      this._renderJornadaBody(el, d);
    } catch(e) {
      el.innerHTML = `<div style="font-size:11px;color:var(--red)">Erro: ${e.message}</div>`;
    }
  }
};

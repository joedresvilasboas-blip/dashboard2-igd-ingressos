// ===== TELA TIME =====
const Time = {
  _aba: 'visao',
  _config: null,
  _dados: null,
  _filtroEquipe: 'todas',
  _filtros: { mes: '', semana: '', evento: '', canal: '', status: '' },

  async load() {
    if (!this._config) {
      try { this._config = await API.getConfig(); } catch {}
    }
    this._vendedoresExpandidos = new Set();
    this._renderLayout();
    await this._carregarDados();

    // Fecha dropdowns ao clicar fora
    document.addEventListener('click', e => {
      if (!e.target.closest('[id^="wrap-tf-"]')) {
        document.querySelectorAll('[id^="drop-tf-"]').forEach(d => d.style.display = 'none');
      }
    });
  },

  _renderLayout() {
    const tela = document.getElementById('time-content');
    if (!tela) return;

    const cfg   = this._config || {};
    const sems  = cfg.semanas  || [];
    const meses = cfg.meses    || [];
    const eventos = cfg.eventosFiltro || (cfg.eventos||[]).map(e=>e.nome);

    const opMes    = meses.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
    const opSem    = sems.map(s => `<option value="${s.num}">Sem ${s.num} · ${s.label}</option>`).join('');
    const opEvento = eventos.map(e => `<option value="${e}">${e}</option>`).join('');

    tela.innerHTML = `
      <!-- TOPBAR INTERNA -->
      <div style="background:var(--bg-2);border-bottom:1px solid var(--border);flex-shrink:0">
        <!-- Abas e equipe -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px var(--s5);flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:6px" id="time-tabs">
            <button class="tab active" onclick="Time._mudarAba('visao',this)">Visão Geral</button>
            <button class="tab" onclick="Time._mudarAba('hoje',this)">Hoje</button>
            <button class="tab" onclick="Time._mudarAba('evolucao',this)">Evolução</button>
          </div>
          <div style="display:flex;gap:6px;align-items:center" id="time-equipe-filtros">
            <span style="font-size:11px;color:var(--text-3)">Equipe:</span>
          </div>
        </div>
        <!-- Filtros -->
        <div style="display:flex;gap:8px;padding:0 var(--s5) 10px;flex-wrap:wrap;align-items:flex-end">
          ${this._multiDropdown('Mês',       'fmes',    meses.map(m=>m.nome),          'mes')}
          ${this._multiDropdown('Semana',    'fsem',    sems.map(s=>'Sem '+s.num),     'semana')}
          ${this._multiDropdown('Evento',    'fevento', eventos,                        'evento')}
          ${this._multiDropdown('Canal',     'fcanal',  ['VA SALES','RC SALES'],        'canal')}
          ${this._multiDropdown('Categoria', 'fcat',    ['NORMAL','VIP','ESSENTIAL','UPGRADE'], 'categoria')}
          ${this._multiDropdown('Status',    'fstatus', ['PAGO','CANCELADO'],           'status')}
          <button class="btn btn-sm btn-secondary" onclick="Time._limparFiltros()" style="align-self:flex-end">Limpar</button>
        </div>
      </div>

      <!-- CONTEÚDO -->
      <div class="scroll-area" id="time-main" style="padding:var(--s4) var(--s5)">
        <div style="display:flex;align-items:center;justify-content:center;height:200px">
          <div class="spinner"></div>
        </div>
      </div>`;
  },

  _multiDropdown(label, id, opcoes, chave) {
    const sel = this._filtros[chave] || [];
    const btnLabel = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : sel.length + ' selecionados';
    const ativo = sel.length > 0;
    const opts = opcoes.map(v => `
      <label style="display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:pointer;font-size:12px;
        color:var(--text);white-space:nowrap;user-select:none"
        onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
        <input type="checkbox" value="${v}" ${sel.includes(v)?'checked':''}
          style="accent-color:var(--accent);width:14px;height:14px"
          onchange="Time._toggleFiltro('${chave}','${v}',this.checked,'${id}')"> ${v}
      </label>`).join('');
    return `<div style="display:flex;flex-direction:column;gap:3px;position:relative" id="wrap-tf-${id}">
      <span style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">${label}</span>
      <button onclick="Time._toggleDrop('wrap-tf-${id}')"
        style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;
        background:var(--bg-3);border:1px solid ${ativo?'var(--accent)':'var(--border-2)'};border-radius:var(--r2);
        font-size:12px;color:${ativo?'var(--accent)':'var(--text)'};cursor:pointer;min-width:110px" id="btn-tf-${id}">
        <span id="lbl-tf-${id}">${btnLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div id="drop-tf-${id}" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;
        background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r2);
        min-width:170px;max-height:200px;overflow-y:auto;z-index:200;box-shadow:var(--shadow)">
        <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;font-size:12px;
          color:var(--accent);border-bottom:1px solid var(--border);font-weight:600;user-select:none"
          onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
          <input type="checkbox" ${sel.length===0?'checked':''} style="accent-color:var(--accent);width:14px;height:14px"
            onchange="Time._limparFiltroChave('${chave}','${id}',this.checked)"> Todos
        </label>
        ${opts}
      </div>
    </div>`;
  },

  _toggleDrop(wrapId) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const drop = wrap.querySelector('[id^="drop-tf-"]');
    const jaAberto = drop.style.display !== 'none';
    document.querySelectorAll('[id^="drop-tf-"]').forEach(d => d.style.display = 'none');
    if (!jaAberto) drop.style.display = 'block';
  },

  _toggleFiltro(chave, valor, checked, id) {
    if (!Array.isArray(this._filtros[chave])) this._filtros[chave] = [];
    if (checked) { if (!this._filtros[chave].includes(valor)) this._filtros[chave].push(valor); }
    else { this._filtros[chave] = this._filtros[chave].filter(v => v !== valor); }
    this._atualizarBtnFiltro(chave, id);
    this._dados = null;
    this._carregarDados();
  },

  _limparFiltroChave(chave, id, checked) {
    if (checked) {
      this._filtros[chave] = [];
      document.querySelectorAll(`#drop-tf-${id} input[type=checkbox]:not(:first-of-type)`).forEach(cb => cb.checked = false);
      this._atualizarBtnFiltro(chave, id);
      this._dados = null;
      this._carregarDados();
    }
  },

  _atualizarBtnFiltro(chave, id) {
    const sel = this._filtros[chave] || [];
    const lbl = document.getElementById(`lbl-tf-${id}`);
    const btn = document.getElementById(`btn-tf-${id}`);
    if (lbl) lbl.textContent = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : sel.length + ' selecionados';
    if (btn) { btn.style.borderColor = sel.length > 0 ? 'var(--accent)' : 'var(--border-2)'; btn.style.color = sel.length > 0 ? 'var(--accent)' : 'var(--text)'; }
  },

  _limparFiltros() {
    this._filtros = { mes: [], semana: [], evento: [], canal: [], status: [], categoria: [], _strIni: '', _strFim: '' };
    this._dados = null;
    this._renderLayout();
    this._carregarDados();
  },

  async _carregarDados() {
    const cfg   = this._config || {};
    const sems  = cfg.semanas  || [];
    const hojeS = cfg.hojeStr  || '';
    const semAtual = sems.find(s => hojeS >= s.strIni && hojeS <= s.strFim) || sems[sems.length-1] || {};

    // Usa filtros de data explícitos; se não, resolve pelo filtro de mês/semana; senão usa semana atual
    let strIni = this._filtros._strIni || semAtual.strIni || '';
    let strFim = this._filtros._strFim || semAtual.strFim || '';

    const canal  = this._filtros.canal     || [];
    const evento = this._filtros.evento    || [];
    const status = this._filtros.status    || [];
    const mes    = this._filtros.mes       || [];
    const semana = this._filtros.semana    || [];

    // Resolve datas a partir do filtro de mês ou semana (igual ao que o backend faz)
    if (semana.length) {
      const nums = semana.map(v => String(v).replace('Sem ','').trim());
      const semsF = sems.filter(s => nums.includes(String(s.num)));
      if (semsF.length) { strIni = semsF[0].strIni; strFim = semsF[semsF.length-1].strFim; }
    } else if (mes.length) {
      const semsM = sems.filter(s => mes.includes(s.mes));
      if (semsM.length) { strIni = semsM[0].strIni; strFim = semsM[semsM.length-1].strFim; }
    }

    const el = document.getElementById('time-main');
    if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>';

    try {
      const categoria = this._filtros.categoria || [];

      const [semaforoRes, metaRes, rankingRes] = await Promise.all([
        API.getSemaforo({}),
        API.getMetaSemanal(strIni, strFim, canal.length === 1 ? canal[0] : '', ''),
        API.post('ranking_time', { strIni, strFim, canal, evento, status, categoria, mes, semana }),
      ]);

      const semaforo = semaforoRes.semaforo || [];
      const ranking  = rankingRes.individual || [];

      // Agrupa por equipe
      const equipesMap = {};
      semaforo.forEach(v => {
        const eq = v.equipe || 'Sem equipe';
        if (!equipesMap[eq]) equipesMap[eq] = { nome: eq, vendedores: [], hc: 0, vendas: 0, fat: 0, verde: 0, amarelo: 0, vermelho: 0, supervisores: 0 };
        equipesMap[eq].vendedores.push(v);
        if (v.status === 'verde')      equipesMap[eq].verde++;
        if (v.status === 'amarelo')    equipesMap[eq].amarelo++;
        if (v.status === 'vermelho')   equipesMap[eq].vermelho++;
        if (v.status === 'supervisor') equipesMap[eq].supervisores++;
      });

      ranking.forEach(v => {
        const vend = semaforo.find(s => s.codigo === v.codigo);
        const eq   = vend?.equipe || 'Sem equipe';
        if (equipesMap[eq]) {
          equipesMap[eq].hc     += (v.headcounts  || 0);
          equipesMap[eq].vendas += (v.vendas       || 0);
          equipesMap[eq].fat    += (v.faturamento  || 0);
        }
      });

      this._dados = {
        equipes: Object.values(equipesMap).sort((a,b) => b.hc - a.hc),
        semaforo,
        ranking,
        meta: metaRes,
        semAtual,
        strIni, strFim,
      };

      // Renderiza filtros de equipe
      const equipes = ['todas', ...Object.keys(equipesMap).sort()];
      const filtrosEl = document.getElementById('time-equipe-filtros');
      if (filtrosEl) {
        filtrosEl.innerHTML = `<span style="font-size:11px;color:var(--text-3)">Equipe:</span>` +
          equipes.map(eq => `
            <button onclick="Time._filtrarEquipe('${eq}')"
              id="eq-btn-${eq}"
              style="padding:3px 12px;border-radius:20px;font-size:11px;cursor:pointer;transition:all .2s;
                border:1px solid ${this._filtroEquipe===eq?'var(--accent)':'var(--border)'};
                background:${this._filtroEquipe===eq?'var(--accent-dim)':'transparent'};
                color:${this._filtroEquipe===eq?'var(--accent)':'var(--text-3)'}">
              ${eq === 'todas' ? 'Todas' : eq}
            </button>`).join('');
      }

      this._renderAba();
    } catch(e) {
      const el = document.getElementById('time-main');
      if (el) el.innerHTML = `<div class="empty"><div class="empty-title">Erro: ${e.message}</div></div>`;
    }
  },

  _filtrarEquipe(eq) {
    this._filtroEquipe = eq;
    document.querySelectorAll('[id^="eq-btn-"]').forEach(btn => {
      const isActive = btn.id === `eq-btn-${eq}`;
      btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
      btn.style.background  = isActive ? 'var(--accent-dim)' : 'transparent';
      btn.style.color       = isActive ? 'var(--accent)' : 'var(--text-3)';
    });
    this._renderAba();
  },

  _mudarAba(aba, btn) {
    this._aba = aba;
    document.querySelectorAll('#time-tabs .tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderAba();
  },

  _renderAba() {
    if (!this._dados) return;
    if      (this._aba === 'visao')   this._renderVisao();
    else if (this._aba === 'hoje')    this._renderHojeNovo();
    else if (this._aba === 'evolucao') this._renderEvolucaoNovo();
  },

  // ==================== VISÃO GERAL ====================
  _renderVisao() {
    const el = document.getElementById('time-main');
    if (!el || !this._dados) return;

    const { equipes, semaforo, ranking, meta, semAtual } = this._dados;
    const eq = this._filtroEquipe;

    const equipesVisiveis = eq === 'todas' ? equipes : equipes.filter(e => e.nome === eq);
    const semaforoFiltrado = eq === 'todas' ? semaforo : semaforo.filter(v => v.equipe === eq);
    const rankingFiltrado  = eq === 'todas' ? ranking  : ranking.filter(v => semaforo.find(s => s.codigo === v.codigo && s.equipe === eq));

    const totalHC   = equipesVisiveis.reduce((s, e) => s + e.hc, 0);
    const totalVend = equipesVisiveis.reduce((s, e) => s + e.vendas, 0);
    const totalFat  = equipesVisiveis.reduce((s, e) => s + e.fat, 0);
    const metaHC    = meta.meta || 375;
    const metaPct   = metaHC ? Math.round(totalHC / metaHC * 100) : 0;

    el.innerHTML = `
      <!-- INDICADORES TOPO -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${this._card('TOTAL HC', totalHC, 'headcounts', 'var(--accent)')}
        ${this._card('FATURAMENTO', 'R$ ' + totalFat.toLocaleString('pt-BR',{minimumFractionDigits:2}), totalVend + ' vendas', '#4caf50')}
        ${this._card('META HC', metaPct + '%', totalHC + ' / ' + metaHC, metaPct >= 100 ? '#4caf50' : metaPct >= 60 ? '#ff9800' : '#e85d5d')}
        ${this._card('SEMANA', semAtual.num ? 'Sem ' + semAtual.num : '—', semAtual.label || 'atual', 'var(--text-3)')}
        ${this._card('VENDEDORES ATIVOS', semaforoFiltrado.filter(v => v.status !== 'vermelho' && v.status !== 'supervisor').length, 'de ' + semaforoFiltrado.filter(v => v.status !== 'supervisor').length + ' no time', '#4caf50')}
      </div>

      <!-- CARDS DE EQUIPE -->
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:var(--s3)">Times</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${equipesVisiveis.map(e => this._cardEquipe(e, metaHC, equipes.length)).join('')}
      </div>

      <!-- RANKING -->
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:var(--s3)">Ranking Individual</div>
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden;margin-bottom:var(--s4)">
        <div style="display:grid;grid-template-columns:32px 1fr 80px 70px 100px 70px;gap:8px;padding:8px 12px;
          background:var(--bg-3);border-bottom:1px solid var(--border)">
          ${['#','Vendedor','HC','Vendas','Faturamento','Status'].map(h =>
            `<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:700;letter-spacing:.06em">${h}</div>`
          ).join('')}
        </div>
        ${rankingFiltrado.slice(0,20).map((v, i) => {
          const vend  = semaforo.find(s => s.codigo === v.codigo);
          const isSup = vend?.perfil === 'SUPERVISOR' || vend?.status === 'supervisor';
          const cor   = isSup ? '#f59e0b' : ({ verde:'#4ade80', amarelo:'#fbbf24', vermelho:'#f87171' }[vend?.status||'vermelho']);
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
          return `
            <div onclick="Vendedor.abrir('${v.codigo}')" style="display:grid;grid-template-columns:32px 1fr 80px 70px 100px 70px;gap:8px;
              padding:9px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s"
              onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
              <div style="font-size:12px;font-weight:700;color:var(--text-3);display:flex;align-items:center">${medal}</div>
              <div style="display:flex;flex-direction:column;justify-content:center;min-width:0">
                <div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.apelido||v.nome}</div>
                <div style="font-size:10px;color:var(--text-3)">${vend?.equipe||'—'}</div>
              </div>
              <div style="font-size:14px;font-weight:700;color:var(--accent);display:flex;align-items:center">${v.headcounts||0}</div>
              <div style="font-size:12px;color:var(--text-2);display:flex;align-items:center">${v.vendas||0}</div>
              <div style="font-size:12px;color:var(--text);display:flex;align-items:center">R$ ${(v.faturamento||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
              <div style="display:flex;align-items:center">
                <div style="width:8px;height:8px;border-radius:50%;background:${cor};box-shadow:0 0 5px ${cor}88"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  _card(titulo, valor, sub, cor) {
    return `
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r3);padding:var(--s4)">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:6px">${titulo}</div>
        <div style="font-size:22px;font-weight:800;color:${cor};line-height:1">${valor}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:4px">${sub}</div>
      </div>`;
  },

  _cardEquipe(eq, metaTotal, totalEquipes) {
    const metaEq  = Math.round(metaTotal / totalEquipes);
    const pct     = metaEq ? Math.min(100, Math.round(eq.hc / metaEq * 100)) : 0;
    const corPct  = pct >= 100 ? '#4caf50' : pct >= 60 ? '#ff9800' : '#e85d5d';
    const corBord = pct >= 100 ? 'rgba(76,175,80,.3)' : pct >= 60 ? 'rgba(255,152,0,.3)' : 'rgba(232,93,93,.3)';

    return `
      <div onclick="Time._abrirEquipe('${eq.nome}')" style="background:var(--bg-2);border:1px solid ${corBord};border-radius:var(--r3);
        padding:var(--s4);transition:all .2s;cursor:pointer"
        onmouseenter="this.style.boxShadow='0 4px 20px rgba(0,0,0,.3)';this.style.transform='translateY(-2px)'"
        onmouseleave="this.style.boxShadow='';this.style.transform=''">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--s3)">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text)">${eq.nome}</div>
            <div style="font-size:11px;color:var(--text-3)">${eq.vendedores.length} vendedores</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:800;color:${corPct};line-height:1">${pct}%</div>
            <div style="font-size:9px;color:var(--text-3)">da meta</div>
          </div>
        </div>

        <!-- Barra de progresso -->
        <div style="background:var(--bg-3);border-radius:99px;height:5px;margin-bottom:var(--s3);overflow:hidden">
          <div style="height:100%;border-radius:99px;background:${corPct};width:${pct}%;transition:width .6s"></div>
        </div>

        <!-- Métricas -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--s2);margin-bottom:var(--s3)">
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:700;color:var(--accent)">${eq.hc}</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase">HC</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:700;color:var(--text)">${eq.vendas}</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase">Vendas</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:12px;font-weight:700;color:#4caf50">R$ ${(eq.fat/1000).toFixed(1)}k</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase">Fat.</div>
          </div>
        </div>

        <!-- Semáforo mini -->
        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:3px;font-size:10px;color:#4ade80">
            <div style="width:6px;height:6px;border-radius:50%;background:#4ade80"></div>${eq.verde}
          </div>
          <div style="display:flex;align-items:center;gap:3px;font-size:10px;color:#fbbf24">
            <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24"></div>${eq.amarelo}
          </div>
          <div style="display:flex;align-items:center;gap:3px;font-size:10px;color:#f87171">
            <div style="width:6px;height:6px;border-radius:50%;background:#f87171"></div>${eq.vermelho}
          </div>
          ${eq.supervisores > 0 ? `<div style="display:flex;align-items:center;gap:3px;font-size:10px;color:#f59e0b">⭐${eq.supervisores}</div>` : ''}
        </div>
      </div>`;
  },

  // ==================== DETALHE DA EQUIPE ====================
  _abrirEquipe(nomeEquipe) {
    const el = document.getElementById('time-main');
    if (!el || !this._dados) return;

    const { equipes, semaforo, ranking, meta } = this._dados;
    const eq = equipes.find(e => e.nome === nomeEquipe);
    if (!eq) return;

    const metaEq    = Math.round((meta.meta || 375) / equipes.length);
    const pct       = metaEq ? Math.min(100, Math.round(eq.hc / metaEq * 100)) : 0;
    const corPct    = pct >= 100 ? '#4caf50' : pct >= 60 ? '#ff9800' : '#e85d5d';
    const rankingEq = ranking.filter(v => semaforo.find(s => s.codigo === v.codigo && s.equipe === nomeEquipe));
    const semaforoEq = eq.vendedores;

    el.innerHTML = `
      <!-- Header com voltar -->
      <div style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4)">
        <button onclick="Time._renderVisao()" class="btn btn-sm btn-secondary">← Voltar</button>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text)">${nomeEquipe}</div>
          <div style="font-size:11px;color:var(--text-3)">${eq.vendedores.length} vendedores</div>
        </div>
      </div>

      <!-- Métricas do time -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${this._card('TOTAL HC', eq.hc, 'headcounts', 'var(--accent)')}
        ${this._card('VENDAS', eq.vendas, 'realizadas', 'var(--text)')}
        ${this._card('FATURAMENTO', 'R$ ' + eq.fat.toLocaleString('pt-BR',{minimumFractionDigits:2}), 'no período', '#4caf50')}
        ${this._card('META HC', pct + '%', eq.hc + ' / ' + metaEq + ' HCs', corPct)}
        ${this._card('EM DIA', eq.verde, 'vendedores', '#4ade80')}
        ${this._card('ATENÇÃO', eq.amarelo, 'vendedores', '#fbbf24')}
        ${this._card('RISCO', eq.vermelho, 'vendedores', '#f87171')}
      </div>

      <!-- Barra de progresso da meta -->
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r3);padding:var(--s4);margin-bottom:var(--s4)">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Progresso da Meta</div>
          <div style="font-size:14px;font-weight:800;color:${corPct}">${pct}%</div>
        </div>
        <div style="background:var(--bg-3);border-radius:99px;height:8px;overflow:hidden">
          <div style="height:100%;border-radius:99px;background:${corPct};width:${pct}%;transition:width .8s"></div>
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">${eq.hc} de ${metaEq} HCs · ${metaEq - eq.hc > 0 ? 'Faltam ' + (metaEq - eq.hc) + ' HCs' : '✓ Meta atingida!'}</div>
      </div>

      <!-- Cards dos vendedores -->
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:var(--s3)">Vendedores</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${semaforoEq.map(v => {
          const isSup = v.status === 'supervisor';
          const rv   = rankingEq.find(r => r.codigo === v.codigo) || {};
          const cor  = isSup ? '#f59e0b' : ({ verde:'#4ade80', amarelo:'#fbbf24', vermelho:'#f87171' }[v.status] || '#f87171');
          const bg   = isSup ? 'rgba(245,158,11,.06)' : ({ verde:'rgba(74,222,128,.06)', amarelo:'rgba(251,191,36,.06)', vermelho:'rgba(248,113,113,.06)' }[v.status] || '');
          let dias = v.diasSemVenda || 0;
          if (v.ultimaVenda) {
            const hoje  = new Date(); hoje.setHours(0,0,0,0);
            const ultim = new Date(v.ultimaVenda + 'T00:00:00');
            dias = Math.floor((hoje - ultim) / 86400000);
          }
          const hc  = rv.headcounts  || 0;
          const vnd = rv.vendas      || 0;
          const fat = rv.faturamento || 0;
          const iniciais = (v.apelido||v.nome||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();

          const expandido = this._vendedoresExpandidos?.has(v.codigo);
          return `
            <div id="card-vend-${v.codigo}" style="background:${bg};border:1px solid ${cor}33;border-radius:var(--r3);
              overflow:hidden;transition:all .2s;grid-column:${expandido?'1/-1':''}">
              <!-- Cabeçalho clicável -->
              <div onclick="Time._toggleVendedor('${v.codigo}')"
                style="padding:var(--s4);cursor:pointer;display:flex;flex-direction:column;gap:var(--s3)">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:36px;height:36px;border-radius:50%;background:${cor}22;border:2px solid ${cor}66;
                    display:flex;align-items:center;justify-content:center;font-size:${isSup?'18px':'13px'};font-weight:700;color:${cor};flex-shrink:0">
                    ${isSup ? '⭐' : iniciais}
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.apelido||v.nome}</div>
                    <div style="font-size:10px;color:${isSup?'#f59e0b':'var(--text-3)'}">
                      ${isSup ? '⭐ Supervisor' : (v.nivel||'JUNIOR')} · ${v.codigo}
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    ${isSup
                      ? `<div style="font-size:10px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.15);padding:2px 7px;border-radius:10px">SUP</div>`
                      : `<div style="width:8px;height:8px;border-radius:50%;background:${cor};box-shadow:0 0 6px ${cor}"></div>`}
                    <div style="font-size:14px;color:var(--text-3);transition:transform .2s;transform:${expandido?'rotate(180deg)':'rotate(0deg)'}" id="chevron-${v.codigo}">▾</div>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center">
                  <div>
                    <div style="font-size:18px;font-weight:800;color:var(--accent)">${hc}</div>
                    <div style="font-size:9px;color:var(--text-3);text-transform:uppercase">HC</div>
                  </div>
                  <div>
                    <div style="font-size:18px;font-weight:800;color:var(--text)">${vnd}</div>
                    <div style="font-size:9px;color:var(--text-3);text-transform:uppercase">Vendas</div>
                  </div>
                  <div>
                    <div style="font-size:12px;font-weight:700;color:#4caf50">R$ ${(fat/1000).toFixed(1)}k</div>
                    <div style="font-size:9px;color:var(--text-3);text-transform:uppercase">Fat.</div>
                  </div>
                </div>
                <div style="font-size:11px;font-weight:600;color:${cor};text-align:center">
                  ${isSup ? '⭐ Supervisor' : (dias === 0 ? '✓ Vendeu hoje' : dias + 'd sem venda')}
                </div>
              </div>
              <!-- Conteúdo expandido -->
              <div id="expand-${v.codigo}" style="display:${expandido?'block':'none'};border-top:1px solid ${cor}22">
                <div style="padding:var(--s3);display:flex;align-items:center;justify-content:center">
                  <div class="spinner"></div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // ==================== TOGGLE VENDEDOR ====================
  async _toggleVendedor(codigo) {
    if (!this._vendedoresExpandidos) this._vendedoresExpandidos = new Set();
    const expandEl   = document.getElementById('expand-' + codigo);
    const chevronEl  = document.getElementById('chevron-' + codigo);
    const cardEl     = document.getElementById('card-vend-' + codigo);
    if (!expandEl) return;

    const expandido = this._vendedoresExpandidos.has(codigo);
    if (expandido) {
      this._vendedoresExpandidos.delete(codigo);
      expandEl.style.display = 'none';
      if (chevronEl) chevronEl.style.transform = 'rotate(0deg)';
  
      return;
    }

    this._vendedoresExpandidos.add(codigo);
    if (chevronEl) chevronEl.style.transform = 'rotate(180deg)';

    expandEl.style.display = 'block';
    expandEl.innerHTML = '<div style="padding:var(--s4);display:flex;align-items:center;justify-content:center"><div class="spinner"></div></div>';

    try {
      const d = await API.getPerfilVendedor(codigo);
      const v   = d.vendedor || {};
      const ps  = d.porSemana || [];
      const cfg = Time._config || {};
      const cal = (cfg.semanas || []);
      const hojeS = cfg.hojeStr || '';
      const semAtual = cal.find(s => hojeS >= s.strIni && hojeS <= s.strFim) || cal[cal.length-1] || {};

      // Filtra semanas pelo período ativo (filtro de mês/semana/data)
      const strIni = this._dados?.strIni || semAtual.strIni || '';
      const strFim = this._dados?.strFim || semAtual.strFim || '';
      const psFiltrado = (strIni && strFim)
        ? ps.filter(s => s.strFim >= strIni && s.strIni <= strFim)
        : ps;

      const tGeral = Vendedor._agregarTotais(psFiltrado.length ? psFiltrado : ps);
      // Usa totais gerais para exibição (mais completo)
      const t = tGeral;

      // Label do período exibido
      const periodoLabel = (strIni && strFim && (strIni !== semAtual.strIni || strFim !== semAtual.strFim))
        ? strIni.split('-').reverse().join('/') + ' à ' + strFim.split('-').reverse().join('/')
        : 'Semana Atual · ' + (semAtual.strIni||'').split('-').reverse().join('/') + ' à ' + (semAtual.strFim||'').split('-').reverse().join('/');

      const linha = (label, valor, cor='var(--text)') =>
        `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:11px;color:var(--text-3)">${label}</span>
          <span style="font-size:11px;font-weight:600;color:${cor}">${valor}</span>
        </div>`;

      expandEl.innerHTML = `
        <div style="padding:10px 14px">
          <!-- Período -->
          <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
            ${periodoLabel}
          </div>

          <!-- Gráfico compacto -->
          ${Vendedor._graficoEvolucao(psFiltrado.length ? psFiltrado : ps)}

          <!-- Produção -->
          <div style="margin:10px 0 4px">
            ${linha('HC', t.hc, 'var(--accent)')}
            ${linha('VA Sales', t.va, '#e8b86d')}
            ${linha('RC Sales', t.rc, '#5d9ee8')}
            ${linha('Upgrades', t.upgrade, '#b86de8')}
            ${t.cancelados > 0 ? linha('Cancelados', t.cancelados, '#e85d5d') : ''}
            ${linha('Faturamento', 'R$ ' + (tGeral.faturamento||0).toLocaleString('pt-BR',{minimumFractionDigits:2}), '#4caf50')}
          </div>

          <!-- Atividade -->
          <div style="margin:8px 0 4px">
            ${linha('Horas faladas', tGeral.horas)}
            ${linha('HC/hora', tGeral.hcPorHora, Vendedor._corTaxa(tGeral.hcPorHora,1,2))}
            ${linha('Pace/venda', tGeral.pace)}
            ${linha('Conversão', tGeral.txEntrv + '%', Vendedor._corTaxa(tGeral.txEntrv,20,40))}
          </div>

          <!-- ROI compacto -->
          ${(() => {
            const isSup = (v.perfil||'').toUpperCase() === 'SUPERVISOR';
            const fixos = isSup
              ? { junior:3000, pleno:3500, senior:4000 }
              : { junior:1500, pleno:1800, senior:2200 };
            const fixo  = fixos[(v.nivel||'junior').toLowerCase()];
            if (!fixo || !tGeral.faturamento) return '';
            const comissao   = tGeral.faturamento * 0.25;
            const custoTotal = fixo + comissao;
            const roi        = Math.round((tGeral.faturamento - custoTotal) / custoTotal * 100);
            const cor        = roi >= 0 ? '#4caf50' : '#e85d5d';
            return '<div style="margin:8px 0 4px">' +
              linha('Fixo', 'R$ ' + fixo.toLocaleString('pt-BR')) +
              linha('Comissão', 'R$ ' + comissao.toLocaleString('pt-BR',{minimumFractionDigits:2})) +
              linha('ROI', roi + '%', cor) +
            '</div>';
          })()}

          <!-- Botão -->
          <button class="btn btn-sm btn-secondary" style="width:100%;margin-top:10px;font-size:11px"
            onclick="event.stopPropagation();Vendedor.abrir('${codigo}')">
            Ver perfil completo →
          </button>
        </div>`;
    } catch(e) {
      expandEl.innerHTML = `<div style="padding:var(--s4);color:var(--red);font-size:12px">Erro: ${e.message}</div>`;
    }
  },

  // ==================== HOJE ====================
  _renderHojeNovo() {
    const el = document.getElementById('time-main');
    if (!el || !this._dados) return;

    const { semaforo, semAtual } = this._dados;
    const eq = this._filtroEquipe;
    const lista = eq === 'todas' ? semaforo : semaforo.filter(v => v.equipe === eq);

    const cores  = { verde:'#4ade80', amarelo:'#fbbf24', vermelho:'#f87171', supervisor:'#f59e0b' };
    const labels = { verde:'Em dia', amarelo:'Atenção', vermelho:'Risco', supervisor:'Supervisor' };
    const resumo = { verde:0, amarelo:0, vermelho:0 };
    lista.forEach(v => { if (v.status !== 'supervisor') resumo[v.status]++; });

    el.innerHTML = `
      <!-- Resumo semáforo -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s4)">
        ${['vermelho','amarelo','verde'].map(s => {
          const bg  = { vermelho:'rgba(248,113,113,.1)', amarelo:'rgba(251,191,36,.1)', verde:'rgba(74,222,128,.1)' }[s];
          const cor = cores[s];
          return `
            <div style="background:${bg};border:1px solid ${cor}33;border-radius:var(--r3);padding:var(--s4);text-align:center">
              <div style="font-size:36px;font-weight:800;color:${cor};line-height:1">${resumo[s]}</div>
              <div style="font-size:10px;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.07em;margin-top:4px">${labels[s]}</div>
            </div>`;
        }).join('')}
      </div>

      <!-- Lista vendedores -->
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden;margin-bottom:var(--s4)">
        ${lista.map(v => {
          const isSup = v.status === 'supervisor';
          const cor   = cores[v.status] || '#f87171';
          let dias = v.diasSemVenda || 0;
          if (v.ultimaVenda) {
            const hoje  = new Date(); hoje.setHours(0,0,0,0);
            const ultim = new Date(v.ultimaVenda + 'T00:00:00');
            dias = Math.floor((hoje - ultim) / 86400000);
          }
          return `
            <div onclick="Vendedor.abrir('${v.codigo}')" style="display:flex;align-items:center;gap:12px;padding:11px 14px;
              border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s"
              onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
              ${isSup
                ? `<div style="font-size:14px;flex-shrink:0">⭐</div>`
                : `<div style="width:10px;height:10px;border-radius:50%;background:${cor};box-shadow:0 0 6px ${cor}88;flex-shrink:0"></div>`}
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.apelido||v.nome}</div>
                <div style="font-size:10px;color:var(--text-3)">${v.equipe||'—'} · ${isSup ? 'Supervisor' : v.nivel||''}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:12px;font-weight:600;color:${cor}">${isSup ? 'Supervisor' : (dias === 0 ? 'Vendeu hoje' : dias + 'd sem venda')}</div>
                <div style="font-size:10px;color:var(--text-3)">${v.ultimaVenda ? v.ultimaVenda.split('-').reverse().join('/') : 'Sem vendas'}</div>
              </div>
              <div style="color:var(--text-3);font-size:14px">›</div>
            </div>`;
        }).join('')}
      </div>

      <!-- Registro diário -->
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r3);padding:var(--s4)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s3)">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Registro Diário</div>
          <div style="display:flex;gap:var(--s2)">
            <input type="date" id="rd-data" class="input" style="padding:5px 10px;font-size:12px;width:140px"
              value="${(() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })()}">
            <button class="btn btn-sm btn-primary" onclick="Time.carregarRegistroDiario()">Verificar</button>
          </div>
        </div>
        <div id="rd-content">
          <div style="display:flex;justify-content:center;padding:var(--s4)"><div class="spinner"></div></div>
        </div>
      </div>`;

    setTimeout(() => Time.carregarRegistroDiario(), 0);
  },

  // ==================== EVOLUÇÃO ====================
  _renderEvolucaoNovo() {
    // Reutiliza a lógica existente
    const el = document.getElementById('time-main');
    if (!el) return;
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner"></div></div>';

    const cfg  = this._config || {};
    const sems = cfg.semanas  || [];
    const hojeS = cfg.hojeStr || '';
    const semsPassadas = sems.filter(s => s.strFim <= hojeS).slice(-8);
    const eq = this._filtroEquipe;

    if (!semsPassadas.length) {
      el.innerHTML = '<div class="empty"><div class="empty-title">Sem dados suficientes</div></div>';
      return;
    }

    const metaTotal = eq === 'todas' ? (this._dados?.meta?.meta || 375) : Math.round((this._dados?.meta?.meta || 375) / (this._dados?.equipes?.length || 1));

    Promise.all(
      semsPassadas.map(s => API.getMetaSemanal(s.strIni, s.strFim, '', eq === 'todas' ? '' : eq)
        .then(r => ({ sem: s, ...r, meta: metaTotal })))
    ).then(resultados => {
      const vends = (cfg.vendedores || []).filter(v => v.ativo && (eq === 'todas' || v.equipe === eq));
      el.innerHTML = `
        ${this._renderEvolucaoSemanal(resultados, metaTotal)}
        ${this._renderVelocidade(resultados, vends)}`;
    }).catch(e => {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro: ${e.message}</div></div>`;
    });
  },

  // ==================== MÉTODOS HERDADOS ====================
  carregarRegistroDiario: async function() {
    const el = document.getElementById('rd-content');
    if (!el) return;
    const dataISO = document.getElementById('rd-data')?.value;
    if (!dataISO) return;
    const [a, m, d] = dataISO.split('-');
    const dataBR = `${d}/${m}/${a}`;
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:var(--s4)"><div class="spinner"></div></div>';
    try {
      const [statusRes, vendasRes] = await Promise.all([API.rdStatusTime(dataBR), API.rdVendasTime(dataBR)]);
      const resultados  = statusRes.resultados || [];
      const vendas      = vendasRes.resultados  || [];
      const totalVendas = vendasRes.totalGeral   || 0;

      el.innerHTML = `
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Preenchimento</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:var(--s4)">
          ${resultados.map(v => {
            const cor = v.preencheu ? '#4ade80' : '#f87171';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r2);background:${v.preencheu?'rgba(74,222,128,.06)':'rgba(248,113,113,.06)'}">
              <div style="font-size:13px;color:${cor};width:16px;font-weight:700">${v.preencheu?'✓':'✕'}</div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:var(--text)">${v.nome}</div>
                ${v.preencheu ? `<div style="font-size:10px;color:var(--text-3)">${v.horas} · ${v.atend} atend · ${v.head} HC</div>` : `<div style="font-size:10px;color:var(--text-3)">Não preencheu</div>`}
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">
          Vendas · <span style="color:var(--accent)">${totalVendas}</span>
        </div>
        ${vendas.map(v => `
          <div style="margin-bottom:8px;border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
            <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"
              style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;cursor:pointer;background:var(--bg-3)">
              <span style="font-size:12px;font-weight:600;color:var(--text)">${v.nome}</span>
              <span style="font-size:12px;color:${v.totalVendas>0?'var(--accent)':'var(--text-3)'}">
                ${v.totalVendas} venda${v.totalVendas!==1?'s':''} ▾
              </span>
            </div>
            <div style="${v.totalVendas>0?'':'display:none'}">
              ${v.vendas.map(vd => `
                <div style="padding:9px 12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-size:12px;font-weight:600;color:var(--text)">${vd.cliente||'—'}</div>
                    <div style="font-size:10px;color:var(--text-3)">${vd.evento||'—'} · ${vd.categoria||'—'}</div>
                  </div>
                  <div style="font-size:13px;font-weight:700;color:var(--accent)">${vd.headcounts} HC</div>
                </div>`).join('')}
            </div>
          </div>`).join('')}`;
    } catch(e) {
      el.innerHTML = `<div style="color:var(--red);font-size:12px">Erro: ${e.message}</div>`;
    }
  },

  _renderEvolucaoSemanal(semanas, metaTotal) {
    const META   = metaTotal || 375;
    const maxVal = Math.max(...semanas.map(s => s.realizado), 1);
    const escala = maxVal < META ? META : maxVal;
    const metaPct = Math.round(META / escala * 100);

    const barras = semanas.map((s, i) => {
      const pct = Math.round(s.realizado / escala * 100);
      const cor = s.realizado >= META ? '#4caf50' : s.realizado >= META * 0.7 ? '#ff9800' : '#e85d5d';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="font-size:10px;font-weight:600;color:${cor};height:14px">${s.realizado}</div>
        <div style="width:100%;flex:1;display:flex;flex-direction:column-reverse">
          <div style="width:100%;height:${pct}%;background:${cor};border-radius:0 0 4px 4px;min-height:${pct>0?2:0}px"></div>
          <div style="width:100%;flex:1;background:var(--bg-3);border-radius:4px 4px 0 0"></div>
        </div>
        <div style="font-size:9px;color:var(--text-3);height:12px">S${s.sem.num||i+1}</div>
      </div>`;
    }).join('');

    return `
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r3);padding:var(--s4);margin-bottom:var(--s4)">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--s4)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Evolução Semanal</div>
          <div style="font-size:11px;color:var(--text-3)">Meta: ${META} HCs</div>
        </div>
        <div style="position:relative;height:160px">
          <div style="position:absolute;left:0;right:0;bottom:${metaPct}%;border-top:1px dashed var(--accent);opacity:.5;pointer-events:none">
            <span style="font-size:9px;color:var(--accent);position:absolute;right:0;top:-13px">meta</span>
          </div>
          <div style="display:flex;gap:4px;width:100%;height:100%">${barras}</div>
        </div>
      </div>`;
  },

  _renderVelocidade(semanas, vendedores) {
    const ativos  = vendedores.filter(v => v.ativo).length || 1;
    const ultimas = semanas.slice(-4);
    const media   = ultimas.length ? ultimas.reduce((s,r) => s + r.realizado, 0) / ultimas.length : 0;
    const velMed  = Math.round(media / ativos * 10) / 10;
    const maxVel  = Math.max(...semanas.map(s => s.realizado / ativos), 0.1);

    return `
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r3);padding:var(--s4)">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--s3)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Velocidade HC/Vendedor</div>
          <div style="font-size:11px;color:var(--accent);font-weight:600">Média: ${velMed} HC</div>
        </div>
        ${semanas.map((s,i) => {
          const vel = Math.round(s.realizado / ativos * 10) / 10;
          const pct = Math.round(vel / maxVel * 100);
          const cor = vel >= velMed * 1.1 ? '#4caf50' : vel >= velMed * 0.8 ? '#ff9800' : '#e85d5d';
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="font-size:11px;color:var(--text-3);min-width:24px">S${s.sem.num||i+1}</div>
            <div style="flex:1;height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${cor};border-radius:3px"></div>
            </div>
            <div style="font-size:11px;font-weight:600;color:${cor};min-width:50px;text-align:right">${vel} HC/vend</div>
          </div>`;
        }).join('')}
      </div>`;
  },
};

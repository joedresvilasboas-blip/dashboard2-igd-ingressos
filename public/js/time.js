// ===== TELA TIME =====
const Time = {
  _aba: 'visao',
  _config: null,
  _dados: null,
  _filtroEquipe: 'todas',

  async load() {
    if (!this._config) {
      try { this._config = await API.getConfig(); } catch {}
    }
    this._renderLayout();
    await this._carregarDados();
  },

  _renderLayout() {
    const tela = document.getElementById('time-content');
    if (!tela) return;

    const cfg   = this._config || {};
    const sems  = cfg.semanas  || [];
    const hojeS = cfg.hojeStr  || '';
    const semAtual = sems.find(s => hojeS >= s.strIni && hojeS <= s.strFim) || sems[sems.length-1] || {};

    tela.innerHTML = `
      <!-- TOPBAR INTERNA -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px var(--s5);
        background:var(--bg-2);border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;gap:8px">
        <div style="display:flex;gap:6px" id="time-tabs">
          <button class="tab active" onclick="Time._mudarAba('visao',this)">Visão Geral</button>
          <button class="tab" onclick="Time._mudarAba('hoje',this)">Hoje</button>
          <button class="tab" onclick="Time._mudarAba('evolucao',this)">Evolução</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center" id="time-equipe-filtros">
          <span style="font-size:11px;color:var(--text-3)">Equipe:</span>
        </div>
      </div>

      <!-- CONTEÚDO -->
      <div class="scroll-area" id="time-main" style="padding:var(--s4) var(--s5)">
        <div style="display:flex;align-items:center;justify-content:center;height:200px">
          <div class="spinner"></div>
        </div>
      </div>`;
  },

  async _carregarDados() {
    const cfg   = this._config || {};
    const sems  = cfg.semanas  || [];
    const hojeS = cfg.hojeStr  || '';
    const semAtual = sems.find(s => hojeS >= s.strIni && hojeS <= s.strFim) || sems[sems.length-1] || {};

    try {
      const [semaforoRes, metaRes, rankingRes] = await Promise.all([
        API.getSemaforo({}),
        API.getMetaSemanal(semAtual.strIni||'', semAtual.strFim||'', '', ''),
        API.getRanking(semAtual.strIni||'', semAtual.strFim||'', ''),
      ]);

      const semaforo = semaforoRes.semaforo || [];
      const ranking  = rankingRes.individual || [];

      // Agrupa por equipe
      const equipesMap = {};
      semaforo.forEach(v => {
        const eq = v.equipe || 'Sem equipe';
        if (!equipesMap[eq]) equipesMap[eq] = { nome: eq, vendedores: [], hc: 0, vendas: 0, fat: 0, verde: 0, amarelo: 0, vermelho: 0 };
        equipesMap[eq].vendedores.push(v);
        if (v.status === 'verde')    equipesMap[eq].verde++;
        if (v.status === 'amarelo')  equipesMap[eq].amarelo++;
        if (v.status === 'vermelho') equipesMap[eq].vermelho++;
      });

      ranking.forEach(v => {
        const vend = semaforo.find(s => s.codigo === v.codigo);
        const eq   = vend?.equipe || 'Sem equipe';
        if (equipesMap[eq]) {
          equipesMap[eq].hc    += (v.headcounts || 0);
          equipesMap[eq].vendas += (v.vendas     || 0);
          equipesMap[eq].fat   += (v.faturamento || 0);
        }
      });

      this._dados = {
        equipes: Object.values(equipesMap).sort((a,b) => b.hc - a.hc),
        semaforo,
        ranking,
        meta: metaRes,
        semAtual,
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
        ${this._card('VENDEDORES ATIVOS', semaforoFiltrado.filter(v => v.status !== 'vermelho').length, 'de ' + semaforoFiltrado.length + ' no time', '#4caf50')}
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
          const cor   = { verde:'#4ade80', amarelo:'#fbbf24', vermelho:'#f87171' }[vend?.status||'vermelho'];
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
        <div style="display:flex;gap:4px;justify-content:center">
          <div style="display:flex;align-items:center;gap:3px;font-size:10px;color:#4ade80">
            <div style="width:6px;height:6px;border-radius:50%;background:#4ade80"></div>${eq.verde}
          </div>
          <div style="display:flex;align-items:center;gap:3px;font-size:10px;color:#fbbf24">
            <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24"></div>${eq.amarelo}
          </div>
          <div style="display:flex;align-items:center;gap:3px;font-size:10px;color:#f87171">
            <div style="width:6px;height:6px;border-radius:50%;background:#f87171"></div>${eq.vermelho}
          </div>
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
          const rv   = rankingEq.find(r => r.codigo === v.codigo) || {};
          const cor  = { verde:'#4ade80', amarelo:'#fbbf24', vermelho:'#f87171' }[v.status] || '#f87171';
          const bg   = { verde:'rgba(74,222,128,.06)', amarelo:'rgba(251,191,36,.06)', vermelho:'rgba(248,113,113,.06)' }[v.status] || '';
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

          return `
            <div onclick="Vendedor.abrir('${v.codigo}')" style="background:${bg};border:1px solid ${cor}33;border-radius:var(--r3);
              padding:var(--s4);cursor:pointer;transition:all .2s"
              onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.2)'"
              onmouseleave="this.style.transform='';this.style.boxShadow=''">
              <!-- Avatar e nome -->
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:var(--s3)">
                <div style="width:36px;height:36px;border-radius:50%;background:${cor}22;border:2px solid ${cor}66;
                  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${cor};flex-shrink:0">
                  ${iniciais}
                </div>
                <div style="min-width:0">
                  <div style="font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.apelido||v.nome}</div>
                  <div style="font-size:10px;color:var(--text-3)">${v.nivel||'JUNIOR'} · ${v.codigo}</div>
                </div>
                <div style="width:8px;height:8px;border-radius:50%;background:${cor};box-shadow:0 0 6px ${cor};flex-shrink:0;margin-left:auto"></div>
              </div>

              <!-- Métricas -->
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:var(--s3);text-align:center">
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

              <!-- Status -->
              <div style="font-size:11px;font-weight:600;color:${cor};text-align:center">
                ${dias === 0 ? '✓ Vendeu hoje' : dias + 'd sem venda'}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // ==================== HOJE ====================
  _renderHojeNovo() {
    const el = document.getElementById('time-main');
    if (!el || !this._dados) return;

    const { semaforo, semAtual } = this._dados;
    const eq = this._filtroEquipe;
    const lista = eq === 'todas' ? semaforo : semaforo.filter(v => v.equipe === eq);

    const cores  = { verde:'#4ade80', amarelo:'#fbbf24', vermelho:'#f87171' };
    const labels = { verde:'Em dia', amarelo:'Atenção', vermelho:'Risco' };
    const resumo = { verde:0, amarelo:0, vermelho:0 };
    lista.forEach(v => resumo[v.status]++);

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
          const cor = cores[v.status];
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
              <div style="width:10px;height:10px;border-radius:50%;background:${cor};box-shadow:0 0 6px ${cor}88;flex-shrink:0"></div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.apelido||v.nome}</div>
                <div style="font-size:10px;color:var(--text-3)">${v.equipe||'—'} · ${v.nivel||''}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:12px;font-weight:600;color:${cor}">${dias === 0 ? 'Vendeu hoje' : dias + 'd sem venda'}</div>
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

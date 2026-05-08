// ===== TELA TIME =====
const Time = {
  _aba: 'hoje',
  _config: null,

  async load() {
    if (!this._config) {
      try { this._config = await API.getConfig(); } catch {}
    }
    this.renderAbas();
    this.loadAba(this._aba);
  },

  renderAbas() {
    document.getElementById('time-abas').innerHTML = `
      <div class="tabs" style="padding:0 var(--s5)">
        <button class="tab ${this._aba==='hoje'?'active':''}" onclick="Time.loadAba('hoje',this)">Hoje</button>
        <button class="tab ${this._aba==='evolucao'?'active':''}" onclick="Time.loadAba('evolucao',this)">Evolução</button>
      </div>`;
  },

  loadAba(aba, btn) {
    this._aba = aba;
    document.querySelectorAll('#time-abas .tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else {
      const tabs = document.querySelectorAll('#time-abas .tab');
      const idx = ['hoje','evolucao'].indexOf(aba);
      if (tabs[idx]) tabs[idx].classList.add('active');
    }
    const el = document.getElementById('time-content');
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner"></div></div>';
    if      (aba === 'hoje')     this.loadHoje(el);
    else if (aba === 'evolucao') this.loadEvolucao(el);
  },

  _equipeHoje: 'todas',

  // ===== ABA HOJE =====
  async loadHoje(el) {
    try {
      const cfg      = this._config || {};
      const sems     = cfg.semanas || [];
      const hojeS    = cfg.hojeStr || '';
      const semAtual = sems.find(s => hojeS >= s.strIni && hojeS <= s.strFim) || sems[sems.length-1] || {};

      const [metaRes, semaforoRes, novosRes] = await Promise.all([
        API.getMetaSemanal(semAtual.strIni||'', semAtual.strFim||'', 'VA SALES', ''),
        API.getSemaforo({}),
        API.getNovosVendedores(),
      ]);

      this._semaforoTodos = semaforoRes.semaforo || [];
      this._novosTodos    = novosRes.novos || [];
      this._metaRes       = metaRes;
      this._semAtual      = semAtual;

      // Monta lista de equipes disponíveis sem duplicata
      const equipesSet = new Set(this._semaforoTodos.map(v => v.equipe).filter(e => e));
      const equipes = ['todas', ...Array.from(equipesSet).sort()];

      el.innerHTML = `
        <div style="padding:var(--s4) var(--s5)">

          <!-- Filtro de equipe -->
          <div style="display:flex;gap:var(--s2);margin-bottom:var(--s4);flex-wrap:wrap">
            ${equipes.map(eq => `
              <button onclick="Time._equipeHoje='${eq}';Time._renderHoje()"
                style="padding:4px 14px;border-radius:20px;border:1px solid ${this._equipeHoje===eq?'var(--accent)':'var(--border)'};background:${this._equipeHoje===eq?'var(--accent-dim)':'transparent'};color:${this._equipeHoje===eq?'var(--accent)':'var(--text-3)'};font-size:12px;cursor:pointer">
                ${eq === 'todas' ? 'Todas' : eq}
              </button>`).join('')}
          </div>

          <div id="time-hoje-content"></div>
        </div>`;

      this._renderHoje();
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro ao carregar</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },

  _renderHoje() {
    const el = document.getElementById('time-hoje-content');
    if (!el) return;
    const eq = this._equipeHoje;
    const semaforo = eq === 'todas' ? this._semaforoTodos : this._semaforoTodos.filter(v => v.equipe === eq);
    const novos    = eq === 'todas' ? this._novosTodos    : this._novosTodos.filter(v => v.equipe === eq);
    const meta     = this._metaRes || {};
    const semAtual = this._semAtual || {};

    // Atualiza botões de equipe
    document.querySelectorAll('[onclick*="_equipeHoje"]').forEach(btn => {
      const eqBtn = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
      btn.style.borderColor  = eqBtn === eq ? 'var(--accent)' : 'var(--border)';
      btn.style.background   = eqBtn === eq ? 'var(--accent-dim)' : 'transparent';
      btn.style.color        = eqBtn === eq ? 'var(--accent)' : 'var(--text-3)';
    });

    el.innerHTML = `
      <!-- META SEMANAL -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--s3)">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Meta Semanal</div>
          <div style="font-size:11px;color:var(--text-3)">${semAtual.num ? 'Semana '+semAtual.num : ''}</div>
        </div>
        <div style="display:flex;align-items:baseline;gap:var(--s2);margin-bottom:var(--s3)">
          <div style="font-size:32px;font-weight:800;color:var(--accent);font-family:'Syne',sans-serif">${meta.realizado||0}</div>
          <div style="font-size:14px;color:var(--text-3)">/ ${meta.meta||375} HCs</div>
          <div style="margin-left:auto;font-size:20px;font-weight:700;color:${(meta.pct||0)>=100?'var(--green)':'var(--text)'}">${meta.pct||0}%</div>
        </div>
        <div style="background:var(--bg-3);border-radius:99px;height:8px;overflow:hidden">
          <div style="height:100%;border-radius:99px;background:${(meta.pct||0)>=100?'var(--green)':(meta.pct||0)>=60?'var(--accent)':'#e85d5d'};width:${Math.min(100,meta.pct||0)}%;transition:width .6s"></div>
        </div>
        ${(meta.falta||0) > 0 ? `<div style="font-size:11px;color:var(--text-3);margin-top:var(--s2)">Faltam ${meta.falta} HCs para bater a meta</div>` : `<div style="font-size:11px;color:var(--green);margin-top:var(--s2)">✓ Meta atingida!</div>`}
      </div>

      <!-- SEMÁFORO -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Semáforo do Time${eq !== 'todas' ? ` — ${eq}` : ''}</div>
        ${this._renderSemaforo(semaforo)}
      </div>

      <!-- NOVOS VENDEDORES -->
      ${novos.length ? `
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">🆕 Acompanhamento (30 dias)${eq !== 'todas' ? ` — ${eq}` : ''}</div>
        ${this._renderNovos(novos)}
      </div>` : ''}

      <!-- REGISTRO DIÁRIO -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s3)">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Registro Diário</div>
          <div style="display:flex;gap:var(--s2);align-items:center">
            <input type="date" id="rd-data" class="input" style="padding:5px 10px;font-size:12px;width:140px" value="${(() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })()}">
            <button class="btn btn-sm btn-primary" onclick="Time.carregarRegistroDiario()">Verificar</button>
          </div>
        </div>
        <div id="rd-content">
          <div style="display:flex;justify-content:center;padding:var(--s4)"><div class="spinner"></div></div>
        </div>
      </div>`;

    // Carrega automaticamente o registro do dia anterior
    setTimeout(() => Time.carregarRegistroDiario(), 0);
  },

  _badgeROI(v) {
    const fixos = { junior: 1500, pleno: 1800, senior: 2200 };
    const fixo  = fixos[v.nivel];
    if (!fixo || !v.faturamento) return '';
    const comissao   = v.faturamento * 0.25;
    const custoTotal = fixo + comissao;
    const roi        = Math.round((v.faturamento - custoTotal) / custoTotal * 100);
    const cor  = roi >= 100 ? '#4caf50' : roi >= 0 ? '#ff9800' : '#e85d5d';
    const bg   = roi >= 100 ? 'rgba(76,175,80,.12)' : roi >= 0 ? 'rgba(255,152,0,.12)' : 'rgba(232,93,93,.12)';
    return `<div style="text-align:center;background:${bg};border-radius:8px;padding:4px 8px;flex-shrink:0">
      <div style="font-size:12px;font-weight:700;color:${cor}">${roi}%</div>
      <div style="font-size:9px;color:${cor};opacity:.8">ROI</div>
    </div>`;
  },

    _renderSemaforo(lista) {
    if (!lista.length) return '<div class="empty-sub">Nenhum vendedor ativo</div>';
    const cores = { verde: '#4caf50', amarelo: '#ff9800', vermelho: '#e85d5d' };
    const labels = { verde: 'Em dia', amarelo: 'Atenção', vermelho: 'Risco' };
    const resumo = { verde: 0, amarelo: 0, vermelho: 0 };
    lista.forEach(v => resumo[v.status]++);

    return `
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4)">
        ${['vermelho','amarelo','verde'].map(s => {
          const bg = { vermelho:'rgba(248,113,113,.12)', amarelo:'rgba(251,191,36,.12)', verde:'rgba(74,222,128,.12)' }[s];
          const cor = { vermelho:'#f87171', amarelo:'#fbbf24', verde:'#4ade80' }[s];
          return `
          <div style="flex:1;text-align:center;background:${bg};border-radius:var(--radius);padding:var(--s4)">
            <div style="font-size:28px;font-weight:700;color:${cor};font-family:'Syne',sans-serif">${resumo[s]}</div>
            <div style="font-size:10px;color:${cor};margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${labels[s]}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${lista.map(v => {
          // Calcula dias CORRIDOS (calendário) desde a última venda
          let diasCorridos = v.diasSemVenda;
          if (v.ultimaVenda) {
            const hoje = new Date(); hoje.setHours(0,0,0,0);
            const ultima = new Date(v.ultimaVenda + 'T00:00:00');
            diasCorridos = Math.floor((hoje - ultima) / 86400000);
          }
          const corItem = cores[v.status];
          return `
          <div onclick="Vendedor.abrir('${v.codigo}')" style="display:flex;align-items:center;gap:var(--s3);padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:opacity .2s" onmouseover="this.style.opacity='.7'" onmouseout="this.style.opacity='1'">
            <div style="width:10px;height:10px;border-radius:50%;background:${corItem};flex-shrink:0;box-shadow:0 0 6px ${corItem}88"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.apelido||v.nome}</div>
              <div style="font-size:11px;color:var(--text-3)">${v.equipe||'—'}</div>
            </div>
            ${this._badgeROI(v)}
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:12px;font-weight:600;color:${corItem}">${diasCorridos === 0 ? 'Vendeu hoje' : diasCorridos + ' dia' + (diasCorridos>1?'s':'') + ' sem venda'}</div>
              <div style="font-size:10px;color:var(--text-3)">${v.ultimaVenda ? 'Última: ' + v.ultimaVenda.split('-').reverse().join('/') : 'Sem vendas'}</div>
            </div>
            <div style="color:var(--text-3);font-size:12px;margin-left:4px">›</div>
          </div>`;
        }).join('')}
      </div>`;
  },

  async carregarRegistroDiario() {
    const el = document.getElementById('rd-content');
    if (!el) return;
    const dataISO = document.getElementById('rd-data')?.value;
    if (!dataISO) return;
    const [a, m, d] = dataISO.split('-');
    const dataBR = `${d}/${m}/${a}`;

    el.innerHTML = '<div style="display:flex;justify-content:center;padding:var(--s4)"><div class="spinner"></div></div>';

    try {
      const [statusRes, vendasRes] = await Promise.all([
        API.rdStatusTime(dataBR),
        API.rdVendasTime(dataBR),
      ]);

      const resultados = statusRes.resultados || [];
      const vendas     = vendasRes.resultados  || [];
      const totalVendas = vendasRes.totalGeral  || 0;

      el.innerHTML = `
        <!-- Status de preenchimento -->
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Preenchimento do dia</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:var(--s4)">
          ${resultados.map(v => {
            const cor = v.preencheu ? '#4ade80' : '#f87171';
            const bg  = v.preencheu ? 'rgba(74,222,128,.08)' : 'rgba(248,113,113,.08)';
            const ico = v.preencheu ? '✓' : '✕';
            return `<div style="display:flex;align-items:center;gap:var(--s3);padding:8px 10px;border-radius:var(--r2);background:${bg}">
              <div style="font-size:12px;font-weight:700;color:${cor};width:16px">${ico}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${v.nome}</div>
                ${v.preencheu ? `<div style="font-size:11px;color:var(--text-3)">${v.horas} · ${v.atend} atend · ${v.entrv} entrv · ${v.head} HC</div>` : `<div style="font-size:11px;color:var(--text-3)">Não preencheu</div>`}
              </div>
            </div>`;
          }).join('')}
        </div>

        <!-- Vendas do dia -->
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">
          Vendas do dia
          <span style="margin-left:var(--s2);font-size:12px;font-weight:700;color:var(--accent);background:var(--accent-dim);padding:2px 8px;border-radius:20px">${totalVendas} vendas</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--s2)">
          ${vendas.map(v => `
            <div style="border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
              <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"
                style="display:flex;align-items:center;justify-content:space-between;padding:10px var(--s3);cursor:pointer;background:var(--bg-3)">
                <span style="font-size:13px;font-weight:600;color:var(--text)">${v.nome}</span>
                <div style="display:flex;align-items:center;gap:var(--s2)">
                  <span style="font-size:12px;color:${v.totalVendas>0?'var(--accent)':'var(--text-3)'}">
                    ${v.totalVendas} ${v.totalVendas===1?'venda':'vendas'}
                  </span>
                  <span style="font-size:11px;color:var(--text-3)">▾</span>
                </div>
              </div>
              <div style="${v.totalVendas>0?'':'display:none'}">
                ${v.vendas.map(vd => `
                  <div style="padding:10px var(--s3);border-top:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                      <div style="font-size:13px;font-weight:600;color:var(--text)">${vd.cliente||'—'}</div>
                      <div style="font-size:11px;color:var(--accent);font-weight:600">${vd.headcounts} HC</div>
                    </div>
                    <div style="font-size:11px;color:var(--text-3)">${vd.evento||'—'} · ${vd.categoria||'—'}</div>
                    ${vd.obs ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">📝 ${vd.obs}</div>` : ''}
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;
    } catch(e) {
      el.innerHTML = `<div class="empty-sub" style="color:var(--red)">Erro: ${e.message}</div>`;
    }
  },

  _renderNovos(lista) {
    return lista.map(v => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">${v.apelido||v.nome}</div>
            <div style="font-size:11px;color:var(--text-3)">${v.equipe||'—'} · Iniciou ${v.dtInicio.split('-').reverse().join('/')}</div>
          </div>
          <div style="font-size:12px;color:var(--accent);font-weight:600">${v.diasRestantes}d restantes</div>
        </div>
        <div style="background:var(--bg-3);border-radius:99px;height:5px;overflow:hidden">
          <div style="height:100%;border-radius:99px;background:var(--accent);width:${Math.round(v.diasNaEmpresa/30*100)}%"></div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:4px">${v.diasNaEmpresa} de 30 dias</div>
      </div>`).join('');
  },

  // ===== ABA EVENTOS =====
  async loadEventos(el) {
    try {
      const [capRes] = await Promise.all([API.getCapacidadeEvento('')]);
      const eventos = capRes.eventos || [];

      el.innerHTML = `
        <div style="padding:var(--s4) var(--s5)">

          <!-- Config No-Show -->
          <div class="card card-sm" style="margin-bottom:var(--s4)">
            <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Taxa de No-Show</div>
            <div style="display:flex;gap:var(--s3)">
              <div class="input-group" style="flex:1;margin-bottom:0">
                <label class="input-label">Pagos (%)</label>
                <input id="ns-pago" class="input" type="number" min="0" max="100" value="${capRes.noShowPago||0}" placeholder="0">
              </div>
              <div class="input-group" style="flex:1;margin-bottom:0">
                <label class="input-label">Gratuitos (%)</label>
                <input id="ns-gratuito" class="input" type="number" min="0" max="100" value="${capRes.noShowGratuito||0}" placeholder="0">
              </div>
              <div style="display:flex;align-items:flex-end">
                <button class="btn btn-primary btn-sm" onclick="Time.salvarNoShow()">Salvar</button>
              </div>
            </div>
          </div>

          <!-- Cards de eventos -->
          ${eventos.length ? eventos.map(ev => this._renderEventoCard(ev)).join('') :
            '<div class="empty"><div class="empty-title">Nenhum evento com capacidade cadastrada</div></div>'}
        </div>`;
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro: ${e.message}</div></div>`;
    }
  },

  _renderEventoCard(ev) {
    const pct     = ev.pctOcupacao;
    // Verde quando lotando, amarelo no meio, vermelho quando vazio
    const cor     = pct >= 80 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#e85d5d';
    const dtEv    = ev.dtEvento ? ev.dtEvento.split('-').reverse().join('/') : '—';
    return `
      <div class="card" style="margin-bottom:var(--s3)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--s3)">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text)">${ev.nome}</div>
            <div style="font-size:11px;color:var(--text-3)">${dtEv} · Cap: ${ev.capacidade.toLocaleString('pt-BR')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:800;color:${cor};font-family:'Syne',sans-serif">${pct}%</div>
            <div style="font-size:10px;color:var(--text-3)">ocupação est.</div>
          </div>
        </div>
        <div style="background:var(--bg-3);border-radius:99px;height:8px;overflow:hidden;margin-bottom:var(--s3)">
          <div style="height:100%;border-radius:99px;background:${cor};width:${Math.min(100,pct)}%;transition:width .6s"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s2);text-align:center">
          <div style="background:var(--bg-3);border-radius:var(--radius);padding:var(--s2)">
            <div style="font-size:14px;font-weight:700;color:var(--text)">${ev.pagos}</div>
            <div style="font-size:10px;color:var(--text-3)">Pagos</div>
          </div>
          <div style="background:var(--bg-3);border-radius:var(--radius);padding:var(--s2)">
            <div style="font-size:14px;font-weight:700;color:var(--text)">${ev.gratuitos}</div>
            <div style="font-size:10px;color:var(--text-3)">Gratuitos</div>
          </div>
          <div style="background:var(--bg-3);border-radius:var(--radius);padding:var(--s2)">
            <div style="font-size:14px;font-weight:700;color:#e85d5d">${ev.cancelados}</div>
            <div style="font-size:10px;color:var(--text-3)">Cancelados</div>
          </div>
          <div style="background:var(--bg-3);border-radius:var(--radius);padding:var(--s2)">
            <div style="font-size:14px;font-weight:700;color:${cor}">${ev.presencaEstimada}</div>
            <div style="font-size:10px;color:var(--text-3)">Presença est.</div>
          </div>
        </div>
      </div>`;
  },

  async salvarNoShow() {
    const pago     = parseFloat(document.getElementById('ns-pago').value)     || 0;
    const gratuito = parseFloat(document.getElementById('ns-gratuito').value) || 0;
    try {
      await API.salvarNoShowEvento(pago, gratuito);
      Utils.toast('No-show salvo!', 'success');
      this.loadAba('eventos');
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  _equipeEvolucao: 'todas',

  // ===== ABA EVOLUÇÃO =====
  async loadEvolucao(el) {
    try {
      const cfg  = this._config || {};
      const sems = cfg.semanas || [];
      const hojeS = cfg.hojeStr || '';
      const semsPassadas = sems.filter(s => s.strFim <= hojeS).slice(-8);

      if (!semsPassadas.length) {
        el.innerHTML = '<div class="empty"><div class="empty-title">Sem dados suficientes</div></div>';
        return;
      }

      const vendedores = cfg.vendedores || [];
      const equipesSet = new Set(vendedores.filter(v => v.ativo).map(v => v.equipe).filter(e => e));
      const equipes    = ['todas', ...Array.from(equipesSet).sort()];

      this._semsPassadas = semsPassadas;
      this._vendedores   = vendedores;
      this._nEquipes     = equipesSet.size || 1;

      el.innerHTML = `
        <div style="padding:var(--s4) var(--s5)">
          <div style="display:flex;gap:var(--s2);margin-bottom:var(--s4);flex-wrap:wrap" id="evolucao-filtros">
            ${equipes.map(eq => `
              <button onclick="Time._equipeEvolucao='${eq}';Time._carregarEvolucao()"
                style="padding:4px 14px;border-radius:20px;border:1px solid ${this._equipeEvolucao===eq?'var(--accent)':'var(--border)'};background:${this._equipeEvolucao===eq?'var(--accent-dim)':'transparent'};color:${this._equipeEvolucao===eq?'var(--accent)':'var(--text-3)'};font-size:12px;cursor:pointer">
                ${eq === 'todas' ? 'Todas' : eq}
              </button>`).join('')}
          </div>
          <div id="evolucao-content">
            <div style="display:flex;justify-content:center;padding:20px"><div class="spinner"></div></div>
          </div>
        </div>`;

      await this._carregarEvolucao();
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro: ${e.message}</div></div>`;
    }
  },

  async _carregarEvolucao() {
    const el = document.getElementById('evolucao-content');
    if (!el) return;
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:20px"><div class="spinner"></div></div>';

    // Atualiza botões
    document.querySelectorAll('#evolucao-filtros button').forEach(btn => {
      const eq = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
      btn.style.borderColor = eq === this._equipeEvolucao ? 'var(--accent)' : 'var(--border)';
      btn.style.background  = eq === this._equipeEvolucao ? 'var(--accent-dim)' : 'transparent';
      btn.style.color       = eq === this._equipeEvolucao ? 'var(--accent)' : 'var(--text-3)';
    });

    const eq       = this._equipeEvolucao;
    const semsP    = this._semsPassadas;
    const vends    = this._vendedores;
    // Meta proporcional: 375 total / nEquipes se filtrado por equipe específica
    const metaTotal = eq === 'todas' ? 375 : Math.round(375 / this._nEquipes);

    const resultados = await Promise.all(
      semsP.map(s => API.getMetaSemanal(s.strIni, s.strFim, 'VA SALES', eq === 'todas' ? '' : eq)
        .then(r => ({ sem: s, ...r, meta: metaTotal })))
    );

    const strIni = semsP[0]?.strIni || '';
    const strFim = semsP[semsP.length-1]?.strFim || '';
    const rankingRes = await API.getRanking(strIni, strFim, '');
    let ranking = rankingRes.individual || [];
    if (eq !== 'todas') {
      ranking = ranking.filter(v => {
        const vend = vends.find(x => x.codigo === v.codigo);
        return vend && vend.equipe === eq;
      });
    }

    const vendsEquipe = eq === 'todas'
      ? vends.filter(v => v.ativo)
      : vends.filter(v => v.ativo && v.equipe === eq);

    el.innerHTML = `
      ${this._renderEvolucaoSemanal(resultados, metaTotal)}
      ${this._renderVelocidade(resultados, vendsEquipe)}
      ${this._renderConcentracao(ranking)}`;
  },

  _renderEvolucaoSemanal(semanas, metaTotal) {
    const META   = metaTotal || 375;
    // Escala: usa META como teto se todos abaixo, senão usa o maior valor
    const maxVal = Math.max(...semanas.map(s => s.realizado), 1);
    const escala = maxVal < META ? META : maxVal;
    const metaPct = Math.round(META / escala * 100);

    const barras = semanas.map((s, i) => {
      const pct  = Math.round(s.realizado / escala * 100);
      const cor  = s.realizado >= META ? '#4caf50' : s.realizado >= META * 0.7 ? '#ff9800' : '#e85d5d';
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
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--s4)">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Evolução Semanal — VA SALES</div>
          <div style="font-size:11px;color:var(--text-3)">Meta: ${META} HCs</div>
        </div>
        <div style="position:relative;height:160px">
          <div style="position:absolute;left:0;right:0;bottom:${metaPct}%;border-top:1px dashed var(--accent);opacity:.6;pointer-events:none;z-index:1">
            <span style="font-size:9px;color:var(--accent);position:absolute;right:0;top:-14px">meta</span>
          </div>
          <div style="display:flex;gap:4px;width:100%;height:100%">
            ${barras}
          </div>
        </div>
      </div>`;
  },

  _renderVelocidade(semanas, vendedores) {
    const ativos   = vendedores.filter(v => v.ativo).length || 1;
    const ultimas4 = semanas.slice(-4);
    const mediaHC  = ultimas4.length ? ultimas4.reduce((s,r) => s + r.realizado, 0) / ultimas4.length : 0;
    const velMedia = Math.round(mediaHC / ativos * 10) / 10;
    const maxVel   = Math.max(...semanas.map(s => s.realizado / ativos), 0.1);

    const linhas = semanas.map((s, i) => {
      const vel  = Math.round(s.realizado / ativos * 10) / 10;
      const pct  = Math.round(vel / maxVel * 100);
      const cor  = vel >= velMedia * 1.1 ? '#4caf50' : vel >= velMedia * 0.8 ? '#ff9800' : '#e85d5d';
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="font-size:11px;color:var(--text-3);min-width:24px">S${s.sem.num||i+1}</div>
        <div style="flex:1;height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${cor};border-radius:3px"></div>
        </div>
        <div style="font-size:11px;font-weight:600;color:${cor};min-width:40px;text-align:right">${vel} HC</div>
        <div style="font-size:10px;color:var(--text-3);min-width:50px">/vendedor</div>
      </div>`;
    }).join('');

    return `
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--s4)">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Velocidade — VA SALES sem Upgrades</div>
          <div style="font-size:11px;color:var(--text-3)">Média 4 sem: <strong style="color:var(--accent)">${velMedia} HC/vendedor</strong></div>
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">${ativos} vendedores ativos · <span style="color:#4caf50">verde</span> = acima da média · <span style="color:#ff9800">laranja</span> = na média · <span style="color:#e85d5d">vermelho</span> = abaixo</div>
        ${linhas}
      </div>`;
  },

  _renderConcentracao(ranking) {
    if (!ranking.length) return '';
    // Usa HCs sem upgrades (headcounts diretos)
    const sorted = [...ranking]
      .map(v => ({ ...v, hc: v.headcounts || 0 }))
      .filter(v => v.hc > 0)
      .sort((a,b) => b.hc - a.hc);
    const total = sorted.reduce((s, v) => s + v.hc, 0);
    if (!total) return '';

    const top20pct = Math.max(1, Math.ceil(sorted.length * 0.2));
    const topTotal = sorted.slice(0, top20pct).reduce((s, v) => s + v.hc, 0);
    const topPct   = Math.round(topTotal / total * 100);

    const barras = sorted.slice(0, 15).map((v, i) => {
      const pct = Math.round(v.hc / sorted[0].hc * 100);
      const dest = i < top20pct;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <div style="font-size:11px;color:${dest?'var(--accent)':'var(--text-3)'};min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.apelido||v.nome}</div>
        <div style="flex:1;height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${dest?'var(--accent)':'var(--text-3)'};border-radius:3px;opacity:${dest?1:0.4}"></div>
        </div>
        <div style="font-size:11px;font-weight:600;color:${dest?'var(--accent)':'var(--text-3)'};min-width:36px;text-align:right">${v.hc} HC</div>
      </div>`;
    }).join('');

    const alerta = topPct >= 80
      ? `<div style="font-size:11px;color:#e85d5d;margin-top:var(--s3)">⚠️ Alta concentração — ${top20pct} vendedor${top20pct>1?'es':''} fazem ${topPct}% dos HCs. Risco de dependência.</div>`
      : topPct >= 60
      ? `<div style="font-size:11px;color:#ff9800;margin-top:var(--s3)">Atenção — ${top20pct} vendedor${top20pct>1?'es':''} fazem ${topPct}% dos HCs.</div>`
      : `<div style="font-size:11px;color:#4caf50;margin-top:var(--s3)">✓ Boa distribuição — time equilibrado.</div>`;

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--s3)">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Concentração de Vendas</div>
          <div style="font-size:13px;font-weight:700;color:var(--accent)">${topPct}%</div>
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">
          Top ${top20pct} vendedor${top20pct>1?'es':''} (${Math.round(top20pct/sorted.length*100)}% do time) fazem <strong style="color:var(--text)">${topPct}%</strong> dos HCs (excl. upgrades)
        </div>
        ${barras}
        ${alerta}
      </div>`;
  },
};

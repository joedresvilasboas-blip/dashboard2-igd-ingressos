// ===== VENDAS =====
const Vendas = {
  _filtros: { mes: [], semana: [], evento: [], canal: [], canalMacro: [], categoria: [], status: [] },
  _pagina: 1,
  _porPagina: 100,
  _total: 0,
  _paginas: 0,
  _dropAberto: null,

  async load() {
    if (!App._config) {
      try { App._config = await API.getConfig(); } catch {}
    }
    this._renderFiltros();
    await this._buscar();

    document.addEventListener('click', e => {
      if (this._dropAberto && !this._dropAberto.contains(e.target)) {
        this._dropAberto.querySelector('.vd-dropdown').style.display = 'none';
        this._dropAberto = null;
      }
    });
  },

  _renderFiltros() {
    const c = App._config || {};
    const el = document.getElementById('vendas-filtros');
    if (!el) return;

    const meses   = (c.meses   || []).map(m => m.nome);
    const semanas = (c.semanas || []).map(s => `Sem ${s.num} · ${s.label}`);
    const eventos = c.eventosFiltro || (c.eventos || []).map(e => e.nome);
    const macros  = c.canaisMacro || ['VA','VD','RC','GT'];
    const canais  = c.canais     || [];
    const cats    = c.categorias || [];
    const status  = c.status     || [];

    el.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:10px var(--s5);background:var(--bg-2);border-bottom:1px solid var(--border)">
        ${this._dropdown('vd-f-mes',    'Mês',       meses,   'mes')}
        ${this._dropdown('vd-f-sem',    'Semana',    semanas, 'semana')}
        ${this._dropdown('vd-f-evento', 'Evento',    eventos, 'evento')}
        ${this._dropdown('vd-f-macro',  'Canal',     macros,  'canalMacro')}
        ${this._dropdown('vd-f-canal',  'Sub-canal', canais,  'canal')}
        ${this._dropdown('vd-f-cat',    'Categoria', cats,    'categoria')}
        ${this._dropdown('vd-f-status', 'Status',    status,  'status')}
        <button class="btn btn-sm btn-secondary" onclick="Vendas._limpar()">Limpar</button>
        <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="Vendas._reprocessar(this)">⚡ Reprocessar Tudo</button>
      </div>`;
  },

  _dropdown(id, label, items, filtroKey) {
    const sel = this._filtros[filtroKey] || [];
    const opts = items.map(v => {
      const checked = sel.includes(v) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:pointer;font-size:12px;color:var(--text);white-space:nowrap"
        onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
        <input type="checkbox" value="${v}" ${checked}
          onchange="Vendas._toggleOpcao('${filtroKey}','${v}',this.checked,'${id}')"
          style="accent-color:var(--accent);width:14px;height:14px"> ${v}
      </label>`;
    }).join('');
    const btnLabel = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : sel.length + ' selecionados';
    const ativo = sel.length > 0 ? 'border-color:var(--accent);color:var(--accent)' : '';
    return `<div style="display:flex;flex-direction:column;gap:3px;position:relative" id="wrap-${id}">
      <span style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">${label}</span>
      <button onclick="Vendas._toggleDrop('wrap-${id}')"
        style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;
        background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--r2);
        font-size:12px;color:var(--text);cursor:pointer;min-width:110px;${ativo}" id="btn-${id}">
        <span id="lbl-${id}">${btnLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="vd-dropdown" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;
        background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r2);
        min-width:180px;max-height:220px;overflow-y:auto;z-index:100;box-shadow:var(--shadow)">
        <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;font-size:12px;
          color:var(--accent);border-bottom:1px solid var(--border);font-weight:600"
          onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
          <input type="checkbox" onchange="Vendas._toggleTodos('${filtroKey}','${id}',this.checked)"
            ${sel.length === 0 ? 'checked' : ''}
            style="accent-color:var(--accent);width:14px;height:14px"> Todos
        </label>
        ${opts}
      </div>
    </div>`;
  },

  _toggleDrop(wrapId) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const drop = wrap.querySelector('.vd-dropdown');
    const jaAberto = drop.style.display !== 'none';
    document.querySelectorAll('.vd-dropdown').forEach(d => d.style.display = 'none');
    this._dropAberto = null;
    if (!jaAberto) { drop.style.display = 'block'; this._dropAberto = wrap; }
  },

  _toggleOpcao(filtroKey, valor, checked, id) {
    if (!this._filtros[filtroKey]) this._filtros[filtroKey] = [];
    const valorReal = filtroKey === 'semana'
      ? String(valor.match(/Sem\s*(\d+)/)?.[1] || valor)
      : valor;
    if (checked) { if (!this._filtros[filtroKey].includes(valorReal)) this._filtros[filtroKey].push(valorReal); }
    else { this._filtros[filtroKey] = this._filtros[filtroKey].filter(v => v !== valorReal); }
    const lbl = document.getElementById('lbl-' + id);
    const btn = document.getElementById('btn-' + id);
    const sel = this._filtros[filtroKey];
    if (lbl) lbl.textContent = sel.length === 0 ? 'Todos' : sel.length === 1 ? sel[0] : sel.length + ' selecionados';
    if (btn) { btn.style.borderColor = sel.length > 0 ? 'var(--accent)' : 'var(--border-2)'; btn.style.color = sel.length > 0 ? 'var(--accent)' : 'var(--text)'; }
    this._pagina = 1;
    this._buscar();
  },

  _toggleTodos(filtroKey, id, checked) {
    const wrap = document.getElementById('wrap-' + id);
    if (!wrap) return;
    wrap.querySelectorAll('.vd-dropdown input[type=checkbox]:not(:first-child)').forEach(cb => cb.checked = false);
    this._filtros[filtroKey] = [];
    const lbl = document.getElementById('lbl-' + id);
    const btn = document.getElementById('btn-' + id);
    if (lbl) lbl.textContent = 'Todos';
    if (btn) { btn.style.borderColor = 'var(--border-2)'; btn.style.color = 'var(--text)'; }
    this._pagina = 1;
    this._buscar();
  },

  _limpar() {
    this._filtros = { mes: [], semana: [], evento: [], canal: [], canalMacro: [], categoria: [], status: [] };
    this._pagina = 1;
    this._renderFiltros();
    this._buscar();
  },

  async _buscar() {
    const el = document.getElementById('vendas-content');
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>';
    try {
      const d = await API.post('vendas_lista', { filtros: this._filtros, pagina: this._pagina, porPagina: this._porPagina });
      this._total   = d.total   || 0;
      this._paginas = d.paginas || 1;
      this._renderTabela(d.vendas || []);
    } catch(e) {
      el.innerHTML = `<div class="empty"><div class="empty-title">Erro ao carregar</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },

  _renderTabela(vendas) {
    const el = document.getElementById('vendas-content');

    const cols = [
      { key: 'dtReg',    label: 'Dt. Reg',    w: '120px' },
      { key: 'dtPag',    label: 'Dt. Pag',    w: '120px' },
      { key: 'codVend',  label: 'Cód.',        w: '60px'  },
      { key: 'nomeVend', label: 'Vendedor',    w: '130px' },
      { key: 'equipe',   label: 'Equipe',      w: '90px'  },
      { key: 'nomeCli',  label: 'Cliente',     w: '140px' },
      { key: 'evento',   label: 'Evento',      w: '140px' },
      { key: 'plano',    label: 'Plano',       w: '140px' },
      { key: 'oc',       label: 'OC',          w: '140px' },
      { key: 'canal',    label: 'Canal',       w: '100px' },
      { key: 'canalMacro', label: 'Macro',     w: '60px'  },
      { key: 'categoria',  label: 'Categoria', w: '90px'  },
      { key: 'hc',       label: 'HC',          w: '45px'  },
      { key: 'valor',    label: 'Valor',       w: '90px'  },
      { key: 'pontos',   label: 'Pts',         w: '45px'  },
      { key: 'status',   label: 'Status',      w: '90px'  },
      { key: 'semana',   label: 'Sem',         w: '45px'  },
      { key: 'mes',      label: 'Mês',         w: '80px'  },
    ];

    const corStatus = s => {
      const u = (s||'').toUpperCase();
      if (u === 'CANCELADO') return '#e85d5d';
      if (u === 'PENDENTE')  return '#ff9800';
      return 'var(--green)';
    };

    const thead = `<tr style="background:var(--bg-3);position:sticky;top:0;z-index:2">
      ${cols.map(c => `<th style="padding:8px 10px;font-size:10px;color:var(--text-3);text-transform:uppercase;
        letter-spacing:.06em;white-space:nowrap;text-align:left;min-width:${c.w};font-weight:600;
        border-bottom:1px solid var(--border)">${c.label}</th>`).join('')}
    </tr>`;

    const tbody = vendas.map(v => `
      <tr style="border-bottom:1px solid var(--border)" onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3);white-space:nowrap">${v.dtReg||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-2);white-space:nowrap">${v.dtPag||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3)">${v.codVend}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.nomeVend}">${v.nomeVend}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3)">${v.equipe}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.nomeCli}">${v.nomeCli}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.evento}">${v.evento}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.plano}">${v.plano}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.oc}">${v.oc}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3);white-space:nowrap">${v.canal}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--accent);font-weight:600">${v.canalMacro}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3)">${v.categoria}</td>
        <td style="padding:7px 10px;font-size:12px;font-weight:700;color:var(--accent);text-align:center">${v.hc}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text);text-align:right;white-space:nowrap">R$ ${Number(v.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3);text-align:center">${v.pontos}</td>
        <td style="padding:7px 10px;font-size:11px;font-weight:600;color:${corStatus(v.status)}">${v.status}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3);text-align:center">${v.semana}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text-3)">${v.mes}</td>
      </tr>`).join('');

    // Paginação
    const pag = this._paginas > 1 ? `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px var(--s5);background:var(--bg-2);border-top:1px solid var(--border);flex-shrink:0">
        <span style="font-size:12px;color:var(--text-3)">${this._total.toLocaleString('pt-BR')} registros · Página ${this._pagina} de ${this._paginas}</span>
        <div style="display:flex;gap:var(--s2)">
          <button class="btn btn-sm btn-secondary" ${this._pagina <= 1 ? 'disabled' : ''} onclick="Vendas._irPagina(${this._pagina-1})">← Anterior</button>
          <button class="btn btn-sm btn-secondary" ${this._pagina >= this._paginas ? 'disabled' : ''} onclick="Vendas._irPagina(${this._pagina+1})">Próxima →</button>
        </div>
      </div>` : `<div style="padding:8px var(--s5);background:var(--bg-2);border-top:1px solid var(--border);font-size:12px;color:var(--text-3)">${this._total.toLocaleString('pt-BR')} registros</div>`;

    if (!vendas.length) {
      el.innerHTML = '<div class="empty" style="padding:60px 0"><div class="empty-title">Nenhuma venda encontrada</div><div class="empty-sub">Ajuste os filtros ou importe vendas</div></div>';
      return;
    }

    el.innerHTML = `
      <div style="overflow-x:auto;flex:1;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-family:var(--font-body)">
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
      ${pag}`;
  },

  _irPagina(p) {
    if (p < 1 || p > this._paginas) return;
    this._pagina = p;
    this._buscar();
  },

  async _reprocessar(btn) {
    if (!confirm('Isso vai reprocessar todas as vendas da planilha. Pode demorar. Confirma?')) return;
    Utils.btnLoading(btn, true);
    try {
      const res = await API.post('reprocessar_tudo', {});
      Utils.toast(`✓ ${res.atualizados} vendas reprocessadas!`, 'success');
      await this._buscar();
    } catch {
      Utils.toast('Erro ao reprocessar', 'error');
    }
    Utils.btnLoading(btn, false);
  },
};

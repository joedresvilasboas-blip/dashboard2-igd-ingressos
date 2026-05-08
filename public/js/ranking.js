// ===== RANKING =====
const Ranking = {
  dados: null,
  tipo: 'individual',
  config: null,

  async load() {
    if (!this.config) {
      try {
        this.config = await API.getConfig();
        this.renderNav();
      } catch {}
    }
  },

  renderNav() {
    const c = this.config;
    if (!c) return;

    // Select de meses
    const sel = document.getElementById('ranking-mes');
    sel.innerHTML = (c.meses || []).map((m, i) =>
      `<option value="${i}">${m.nome}</option>`
    ).join('');
    sel.value = String(c.mesVigIdx >= 0 ? c.mesVigIdx : (c.meses.length - 1));
    sel.onchange = () => this.renderSemanas();

    this.renderSemanas();
  },

  renderSemanas() {
    const c = this.config;
    const idx = parseInt(document.getElementById('ranking-mes').value);
    const m = c.meses[idx];
    const hojeS = c.hojeStr;
    const sems = (c.semanas || []).filter(s => s.strIni <= m.strFim && s.strFim >= m.strIni);
    let svIdx = null;
    sems.forEach((s, i) => { if (hojeS >= s.strIni && hojeS <= s.strFim) svIdx = i; });

    const el = document.getElementById('ranking-semanas');
    el.innerHTML = `
      <div style="display:flex;gap:6px;padding:2px 0">
        <button class="tab ${svIdx === null ? 'active' : ''}" data-ini="" data-fim="" data-num=""
          onclick="Ranking.selecionarSem(this)">Mês</button>
        ${sems.map((s, i) => `
          <button class="tab ${i === svIdx ? 'active' : ''}" data-ini="${s.strIni}" data-fim="${s.strFim}" data-num="${s.num}" data-label="${s.label}"
            onclick="Ranking.selecionarSem(this)">
            Sem ${s.num}<br><small style="font-size:10px;opacity:.7">${s.label}</small>
          </button>`).join('')}
      </div>`;

    // Carrega semana vigente
    const btnAtivo = el.querySelector('.tab.active');
    if (btnAtivo) this.selecionarSem(btnAtivo);
    else if (sems.length) this.selecionarSem(el.querySelector('.tab'));
  },

  async selecionarSem(btn) {
    document.querySelectorAll('#ranking-semanas .tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const idx = parseInt(document.getElementById('ranking-mes').value);
    const m = this.config.meses[idx];
    const strIni = btn.dataset.ini || m.strIni;
    const strFim = btn.dataset.fim || m.strFim;
    const semNum = parseInt(btn.dataset.num) || null;
    const label = btn.dataset.label || 'Mês completo';

    document.getElementById('ranking-periodo').textContent = label;

    const el = document.getElementById('ranking-lista');
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:160px"><div class="spinner"></div></div>';

    try {
      this.dados = await API.getRanking(strIni, strFim, semNum);
      this._semLabel = btn.textContent.trim().split('\n')[0];
      this._periodoLabel = label;
      this.renderLista();
    } catch {
      el.innerHTML = '<div class="empty"><div class="empty-title">Erro ao carregar</div></div>';
    }
  },

  setTipo(tipo, btn) {
    this.tipo = tipo;
    document.querySelectorAll('[data-tipo]').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    this.renderLista();
  },

  renderLista() {
    if (!this.dados) return;
    const lista = this.tipo === 'individual' ? this.dados.individual : this.dados.equipes;
    const fe = (this.dados.estrelasSemana) || {};
    const el = document.getElementById('ranking-lista');
    const poly = "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";

    if (!lista || !lista.length) {
      el.innerHTML = '<div class="empty"><div class="empty-title">Sem dados</div><div class="empty-sub">Nenhuma venda no período</div></div>';
      return;
    }

    const totalHC = lista.reduce((s, v) => s + v.headcounts, 0);

    el.innerHTML = `
      <div style="padding:0 var(--s5)">
        <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;margin-bottom:var(--s5)">
          <div style="background:var(--bg-3);padding:8px 12px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">
            Upgrade: 1 pt &nbsp;·&nbsp; Normal: 2 pts &nbsp;·&nbsp; VIP: 3 pts
          </div>
          ${lista.map(v => {
            const nm = this.tipo === 'individual' ? v.nome : v.equipe;
            const sub = this.tipo === 'individual' ? v.codigo : 'Líder: ' + v.lider;
            const pos = v.posicao;
            const isTop = ['🥇','🥈','🥉'].includes(pos);
            const bgTop = pos === '🥇' ? 'rgba(232,184,109,0.06)' : pos === '🥈' ? 'rgba(160,160,160,0.04)' : pos === '🥉' ? 'rgba(200,100,60,0.04)' : '';

            let estHtml = '';
            if (this.tipo === 'individual' && fe[v.codigo] && fe[v.codigo].estrelasSemana > 0) {
              for (let si = 0; si < fe[v.codigo].estrelasSemana; si++) {
                estHtml += `<svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle"><polygon points="${poly}" fill="#EF9F27" stroke="#EF9F27" stroke-width="1"/></svg>`;
              }
            }

            return `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:${bgTop}">
                <span style="font-size:${isTop?'18':'13'}px;min-width:28px;text-align:center;color:${isTop?'inherit':'var(--text-3)'}">${pos}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600;color:var(--text)" class="truncate">${nm}${estHtml ? ' ' + estHtml : ''}</div>
                  <div style="font-size:11px;color:var(--text-3)">${sub}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:13px;font-weight:700;color:var(--accent)">${v.pontos} pts</div>
                  <div style="font-size:11px;color:var(--text-3)">${v.headcounts} HC</div>
                </div>
              </div>`;
          }).join('')}
          <div style="padding:8px 12px;background:var(--bg-3);border-top:1px solid var(--border);font-size:12px;color:var(--text-3);text-align:right;font-weight:600">
            👥 Total HCs: ${totalHC}
          </div>
        </div>
      </div>`;
  },

  copiar() {
    if (!this.dados) return;
    const lista = this.tipo === 'individual' ? this.dados.individual : this.dados.equipes;
    const tipoLabel = this.tipo === 'individual' ? 'INDIVIDUAL' : 'EQUIPES';
    const totalHC = lista.reduce((s, v) => s + v.headcounts, 0);
    const periodo = this._periodoLabel ? `(${this._periodoLabel})` : '';
    const sem = this._semLabel || '';

    let linhas = [`🏆 *RANKING ${tipoLabel} - ${sem} ${periodo}* 🏆`, '', '📌 *Regra de pontuação:*', 'Upgrade: 1 pt | Normal: 2 pts | VIP: 3 pts', ''];
    lista.forEach((v, i) => {
      const nm = this.tipo === 'individual' ? (v.apelido || v.nome) : v.equipe;
      const pts = (v.pontos < 10 ? '0' : '') + v.pontos + ' pt' + (v.pontos !== 1 ? 's' : '');
      const hc = (v.headcounts < 10 ? '0' : '') + v.headcounts + ' HC';
      linhas.push(`${i + 1}. — ${pts} | ${hc} — ${nm}`);
    });
    linhas.push('', `*TOTAL HEADCOUNTS: ${totalHC}*`);

    const texto = linhas.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => Utils.toast('Copiado!', 'success'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = texto; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      Utils.toast('Copiado!', 'success');
    }
  }
};

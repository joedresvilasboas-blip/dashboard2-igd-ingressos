// ===== ESTRELAS =====
const Estrelas = {
  todos: [],
  visiveis: new Set(),

  async load() {
    const el = document.getElementById('estrelas-lista');
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>';

    try {
      const d = await API.getEstrelas();
      this.todos = d.vendedores || [];
      this.visiveis = new Set(this.todos.map(v => v.codigo));
      this.renderFiltros();
      this.renderLista();
      const busca = document.getElementById('estrelas-busca');
      busca.oninput = Utils.debounce(() => this.renderLista(), 200);
    } catch (e) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Erro ao carregar</div><div class="empty-sub">' + e.message + '</div></div>';
    }
  },

  renderFiltros() {
    const niveis = ['SENIOR','PLENO','JUNIOR'];
    const el = document.getElementById('estrelas-filtros');
    el.innerHTML = niveis.map(n => {
      const count = this.todos.filter(v => v.nivel === n).length;
      if (!count) return '';
      return `<button class="chip active" onclick="Estrelas.toggleCat('${n}',this)">${n} <span style="opacity:.6">${count}</span></button>`;
    }).join('');
  },

  toggleCat(nivel, btn) {
    btn.classList.toggle('active');
    const ativo = btn.classList.contains('active');
    this.todos.filter(v => v.nivel === nivel).forEach(v => {
      if (ativo) this.visiveis.add(v.codigo);
      else this.visiveis.delete(v.codigo);
    });
    this.renderLista();
  },

  renderLista() {
    const busca = (document.getElementById('estrelas-busca').value || '').toLowerCase();
    const lista = this.todos.filter(v =>
      this.visiveis.has(v.codigo) &&
      (!busca || v.nome.toLowerCase().includes(busca) || v.codigo.toLowerCase().includes(busca))
    );

    const el = document.getElementById('estrelas-lista');
    if (!lista.length) {
      el.innerHTML = '<div class="empty"><div class="empty-title">Nenhum vendedor</div></div>';
      return;
    }

    const corBarra = { JUNIOR: '#EF9F27', PLENO: '#BA7517', SENIOR: '#639922' };

    el.innerHTML = lista.map(v => {
      const pct = Math.min(100, (v.estrelas / 5) * 100);
      const bc  = corBarra[v.nivel] || '#EF9F27';

      // Incentivo baseado nos dados do backend
      let incentivo = '', faltaPts = '';
      if (v.nivel !== 'SENIOR') {
        if (v.completa) {
          incentivo = `<span style="font-size:11px;color:var(--green);background:var(--green-dim);border-radius:6px;padding:2px 8px">⭐ Estrela conquistada!</span>`;
        } else if (v.pct === 0) {
          incentivo = `<span style="font-size:11px;color:var(--text-3);background:var(--bg-3);border-radius:6px;padding:2px 8px">💪 Vamos começar!</span>`;
        } else if (v.pct <= 30) {
          incentivo = `<span style="font-size:11px;color:var(--accent);background:var(--accent-dim);border-radius:6px;padding:2px 8px">🚀 Bom começo!</span>`;
        } else if (v.pct <= 60) {
          incentivo = `<span style="font-size:11px;color:var(--accent);background:var(--accent-dim);border-radius:6px;padding:2px 8px">🔥 No caminho certo!</span>`;
        } else if (v.pct <= 89) {
          incentivo = `<span style="font-size:11px;color:var(--accent);background:var(--accent-dim);border-radius:6px;padding:2px 8px">⚡ Quase lá!</span>`;
        } else {
          incentivo = `<span style="font-size:11px;color:var(--green);background:var(--green-dim);border-radius:6px;padding:2px 8px">🎯 Vai buscar!</span>`;
        }
        if (v.falta > 0) {
          faltaPts = `<span style="font-size:11px;color:var(--text-3)">Faltam <strong style="color:var(--accent)">${v.falta} pts</strong> ⭐</span>`;
        }
      }

      // Estrelas SVG — inteiras + terços
      const starsHtml = Utils.renderStarsDetailed(v.inteiras, v.tercos, v.nivel);

      return `
        <div class="card card-sm" style="margin-bottom:var(--s3)">
          <div class="flex items-center gap-3" style="margin-bottom:var(--s3)">
            <div class="avatar avatar-gold">${Utils.iniciais(v.nome)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text)" class="truncate">${v.nome}</div>
              <div style="font-size:11px;color:var(--text-3)">${v.codigo} · ${v.equipe || '—'}</div>
            </div>
            <span class="badge badge-neutral">${v.nivel}</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="stars">${starsHtml}</div>
            <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${pct}%;background:${bc}"></div></div>
            <span style="font-size:11px;color:var(--text-3);min-width:48px;text-align:right">${v.inteiras}${v.tercos > 0 ? ' '+v.tercos+'/3' : ''}/5</span>
          </div>
          ${incentivo || faltaPts ? `
          <div class="flex items-center justify-between" style="margin-top:var(--s3);flex-wrap:wrap;gap:var(--s2)">
            ${incentivo}${faltaPts}
          </div>` : ''}
        </div>`;
    }).join('');
  }
};

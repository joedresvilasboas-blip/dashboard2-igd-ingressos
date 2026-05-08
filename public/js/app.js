// ===== APP PRINCIPAL =====

const App = {
  currentScreen: null,
  role: null,

  async init() {
    // Registra service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Verifica sessão
    this.role = AUTH.check();
    if (!this.role) {
      this.showScreen('login');
      return;
    }

    // Configura interface por role
    this.setupNav();
    this.showScreen('dashboard');
  },

  setupNav() {
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar) sidebar.style.display = 'flex';
    const adminItems = document.querySelectorAll('[data-admin]');
    adminItems.forEach(el => {
      if (this.role !== 'admin') el.style.display = 'none';
    });
  },

  showScreen(name) {
    this._telaAnterior = this.currentScreen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + name);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = name;
    }
    // Atualiza sidebar
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.screen === name);
    });
    this.loadScreen(name);
  },

  voltarTela() {
    this.showScreen(this._telaAnterior || 'time');
  },

  async loadScreen(name) {
    // Garante config carregado antes de qualquer tela
    if (!this._config) {
      try { this._config = await API.getConfig(); } catch {}
    }
    switch (name) {
      case 'dashboard':  await Dashboard.load(); break;
      case 'time':       await Time.load(); break;
      case 'vendedor':   break;
      case 'estrelas':   await Estrelas.load(); break;
      case 'ranking':    await Ranking.load(); break;
      case 'relatorios': Relatorios.init(); break;
      case 'upload':     Upload.init(); break;
      case 'cadastros':  Cadastros.init(); break;
    }
  },

  navigate(screen, params = {}) {
    this._navParams = params;
    this.showScreen(screen);
  },

  getNavParams() { return this._navParams || {}; }
};

// ===== UTILITÁRIOS =====
const Utils = {
  // Formata moeda
  moeda(v) {
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  },

  // Formata data
  data(str) {
    if (!str) return '';
    const p = String(str).split(/[-\/T ]/);
    if (p.length >= 3) {
      // yyyy-mm-dd → dd/mm/yyyy
      if (p[0].length === 4) return p[2].slice(0,2)+'/'+p[1]+'/'+p[0];
      // dd/mm/yyyy já
      return p[0]+'/'+p[1]+'/'+p[2];
    }
    return str;
  },

  // Iniciais do nome
  iniciais(nome) {
    const p = String(nome || '').trim().split(' ');
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  },

  // Toast
  toast(msg, type = '') {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast ' + type;
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => t.classList.remove('show'), 3000);
  },

  // Loading state no botão
  btnLoading(btn, loading) {
    if (loading) {
      btn._orig = btn.innerHTML;
      btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn._orig || btn.innerHTML;
      btn.disabled = false;
    }
  },

  // Debounce
  debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // Trunca string
  truncar(str, n = 20) {
    return str && str.length > n ? str.slice(0, n) + '…' : str;
  },

  // SVG estrela
  svgStar(fill, stroke, sw, clipId) {
    const poly = "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";
    let s = `<polygon points="${poly}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
    if (clipId) s += ` clip-path="url(#${clipId})"`;
    return s + '/>';
  },

  // Estrelas com inteiras + terços
  renderStarsDetailed(inteiras, tercos, nivel) {
    const corMap = { JUNIOR: '#EF9F27', PLENO: '#BA7517', SENIOR: '#639922' };
    const c = corMap[nivel] || '#EF9F27';
    let h = '';
    for (let i = 0; i < 5; i++) {
      if (i < inteiras) {
        h += `<svg width="18" height="18" viewBox="0 0 24 24">${this.svgStar(c, c, 1, null)}</svg>`;
      } else if (i === inteiras && tercos > 0) {
        const pct = tercos === 1 ? '33%' : '66%';
        const id = 'st' + Math.random().toString(36).slice(2,7);
        h += `<svg width="18" height="18" viewBox="0 0 24 24"><defs><clipPath id="${id}"><rect x="0" y="0" width="${pct}" height="24"/></clipPath></defs>${this.svgStar('none','#2a2a2a',1.5,null)}${this.svgStar(c,c,1,id)}</svg>`;
      } else {
        h += `<svg width="18" height="18" viewBox="0 0 24 24">${this.svgStar('none','#2a2a2a',1.5,null)}</svg>`;
      }
    }
    return h;
  },

  renderStars(pontos, cor) {
    const corMap = { JUNIOR: '#EF9F27', PLENO: '#BA7517', SENIOR: '#3B6D11' };
    const c = corMap[cor] || cor || '#EF9F27';
    const val = Math.min(pontos, 5);
    let h = '';
    for (let i = 0; i < 5; i++) {
      if (val >= i + 1) {
        h += `<svg width="18" height="18" viewBox="0 0 24 24">${this.svgStar(c, c, 1, null)}</svg>`;
      } else {
        const frac = val - i;
        if (frac > 0.05) {
          const w = Math.round(frac * 24);
          const id = 'sc' + Math.random().toString(36).slice(2, 7);
          h += `<svg width="18" height="18" viewBox="0 0 24 24"><defs><clipPath id="${id}"><rect x="0" y="0" width="${w}" height="24"/></clipPath></defs>${this.svgStar('none', '#2a2a2a', 1.5, null)}${this.svgStar(c, c, 1, id)}</svg>`;
        } else {
          h += `<svg width="18" height="18" viewBox="0 0 24 24">${this.svgStar('none', '#2a2a2a', 1.5, null)}</svg>`;
        }
      }
    }
    return h;
  }
};

// Inicia quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  // Keep-alive: chama o GAS a cada 4 minutos para evitar cold start
  setInterval(() => { API.ping().catch(() => {}); }, 4 * 60 * 1000);
});

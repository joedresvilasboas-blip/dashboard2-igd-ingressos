// ===== AUTENTICAÇÃO =====

const AUTH = {
  SENHAS: {
    admin:    'igd@admin2026',
    vendedor: 'igd@vendas2026'
  },

  SESSION_KEY: 'igd_session',
  SESSION_HOURS: 12,

  check() {
    const s = localStorage.getItem(this.SESSION_KEY);
    if (!s) return null;
    try {
      const { role, expires } = JSON.parse(s);
      if (Date.now() > expires) { this.logout(); return null; }
      return role;
    } catch { return null; }
  },

  login(password) {
    if (password === this.SENHAS.admin) {
      this._saveSession('admin');
      return 'admin';
    }
    if (password === this.SENHAS.vendedor) {
      this._saveSession('vendedor');
      return 'vendedor';
    }
    return null;
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
  },

  _saveSession(role) {
    const expires = Date.now() + this.SESSION_HOURS * 3600 * 1000;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify({ role, expires }));
  },

  isAdmin() { return this.check() === 'admin'; },
  isVendedor() { return this.check() === 'vendedor'; }
};

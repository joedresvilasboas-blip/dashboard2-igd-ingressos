// ===== RELATÓRIOS =====
const Relatorios = {
  init() {
    const el = document.getElementById('relatorios-content');
    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--s3)">
        <h3 style="margin-bottom:var(--s4)">Relatório Diário</h3>
        <div class="input-group">
          <label class="input-label">Data</label>
          <input type="date" id="rel-data" class="input" value="${new Date().toISOString().slice(0,10)}">
        </div>
        <button class="btn btn-primary btn-full" onclick="Relatorios.gerarDiario()">Gerar Relatório</button>
      </div>
      <div class="card" style="margin-bottom:var(--s3)">
        <h3 style="margin-bottom:var(--s4)">Relatório Semanal</h3>
        <div class="input-group">
          <label class="input-label">Semana</label>
          <input type="number" id="rel-semana" class="input" placeholder="Ex: 16" min="1" max="52">
        </div>
        <button class="btn btn-primary btn-full" onclick="Relatorios.gerarSemanal()">Gerar Relatório</button>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:var(--s2);margin-bottom:var(--s4)">
          <h3>Relatório Semanal</h3>
          <span style="font-size:10px;font-weight:700;background:#5d9ee820;color:#5d9ee8;padding:2px 8px;border-radius:99px;letter-spacing:.05em">RC SALES</span>
        </div>
        <div class="input-group">
          <label class="input-label">Semana</label>
          <input type="number" id="rel-semana-rc" class="input" placeholder="Ex: 16" min="1" max="52">
        </div>
        <button class="btn btn-primary btn-full" onclick="Relatorios.gerarSemanalRC()">Gerar Relatório RC SALES</button>
      </div>
      <div id="rel-resultado" style="margin-top:var(--s3)"></div>`;
  },

  async gerarDiario() {
    const data = document.getElementById('rel-data').value;
    const el = document.getElementById('rel-resultado');
    el.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const d = await API.getRelatorioDiario(data);
      this.renderTexto(d.texto);
    } catch { el.innerHTML = '<div class="empty"><div class="empty-title">Erro</div></div>'; }
  },

  async gerarSemanal() {
    const sem = document.getElementById('rel-semana').value;
    const el = document.getElementById('rel-resultado');
    el.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const d = await API.getRelatorioSemanal(sem);
      this.renderTexto(this.ordenarEventosPorData(d.texto));
    } catch { el.innerHTML = '<div class="empty"><div class="empty-title">Erro</div></div>'; }
  },

  async gerarSemanalRC() {
    const sem = document.getElementById('rel-semana-rc').value;
    const el = document.getElementById('rel-resultado');
    el.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const d = await API.getRelatorioSemanalRC(sem);
      this.renderTexto(this.ordenarEventosPorData(d.texto), 'RC SALES');
    } catch { el.innerHTML = '<div class="empty"><div class="empty-title">Erro</div></div>'; }
  },

  // Ordena os blocos de eventos por data (mais próximo primeiro)
  ordenarEventosPorData(texto) {
    if (!texto) return texto;
    const linhas = texto.split('\n');

    // Encontra o índice do cabeçalho (primeira linha com *REPORT...)
    // Separa o cabeçalho geral (tudo antes do primeiro bloco de evento 📍)
    // e o rodapé (tudo depois do último bloco)
    const blocos = [];
    let cabecalho = [];
    let blocoAtual = null;
    let coletandoCabecalho = true;

    for (const linha of linhas) {
      // Detecta início de bloco de evento: linha com 📍 ou emoji + *NOME - MESMÊS*
      const isEvento = /^📍/.test(linha) || /^\s*[📍🎪🎵🎤🎭🏟️]\s*\*/.test(linha);
      if (isEvento) {
        coletandoCabecalho = false;
        if (blocoAtual) blocos.push(blocoAtual);
        blocoAtual = { header: linha, linhas: [], data: this._extrairDataEvento(linha) };
      } else if (coletandoCabecalho) {
        cabecalho.push(linha);
      } else if (blocoAtual) {
        blocoAtual.linhas.push(linha);
      }
    }
    if (blocoAtual) blocos.push(blocoAtual);

    // Se não encontrou blocos com 📍, tenta separar por linhas com * e meses
    if (blocos.length === 0) return texto;

    // Ordena por data crescente (mais próximo primeiro)
    blocos.sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return a.data - b.data;
    });

    const resultado = [
      ...cabecalho,
      ...blocos.map(b => [b.header, ...b.linhas].join('\n'))
    ].join('\n');

    return resultado;
  },

  _extrairDataEvento(linha) {
    // Tenta extrair mês/ano da linha de cabeçalho do evento
    // Ex: "📍 *IMLS SSA - MAI26*" ou "📍 *MPV - JUL26*"
    const meses = { JAN:0, FEV:1, MAR:2, ABR:3, MAI:4, JUN:5, JUL:6, AGO:7, SET:8, OUT:9, NOV:10, DEZ:11 };
    const match = linha.match(/([A-Z]{3})(\d{2})\b/);
    if (match) {
      const mes = meses[match[1]];
      const ano = 2000 + parseInt(match[2]);
      if (mes !== undefined) return new Date(ano, mes, 1);
    }
    return null;
  },

  renderTexto(texto, canal) {
    const el = document.getElementById('rel-resultado');
    const labelCanal = canal
      ? `<span style="font-size:10px;font-weight:700;background:#5d9ee820;color:#5d9ee8;padding:2px 8px;border-radius:99px;letter-spacing:.05em">${canal}</span>`
      : '';
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s4)">
          <div style="display:flex;align-items:center;gap:var(--s2)">
            <h3>Resultado</h3>
            ${labelCanal}
          </div>
          <button class="btn btn-sm btn-secondary" onclick="Relatorios.copiar()">Copiar</button>
        </div>
        <pre id="rel-texto" style="font-family:var(--font-mono);font-size:12px;color:var(--text-2);white-space:pre-wrap;line-height:1.6">${texto}</pre>
      </div>`;
    this._texto = texto;
  },

  copiar() {
    if (!this._texto) return;
    navigator.clipboard?.writeText(this._texto).then(() => Utils.toast('Copiado!', 'success'));
  }
};

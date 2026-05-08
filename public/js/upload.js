// ===== UPLOAD CSV =====
const Upload = {
  linhas: [],
  _naoIdOCs:    [],
  _naoIdPlanos: [],
  _semCanal:    [],
  _eventos:     [],
  _canais:      [],

  init() {
    const el = document.getElementById('upload-content');
    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--s3)">
        <h3 style="margin-bottom:var(--s2)">Importar CSV da Central</h3>
        <p style="margin-bottom:var(--s5)">Selecione um ou mais arquivos CSV exportados da Central de Vendas</p>
        <div id="upload-dropzone" style="
          border:2px dashed var(--border-2);border-radius:var(--r3);
          padding:var(--s10) var(--s5);text-align:center;cursor:pointer;
          transition:border-color var(--t1);margin-bottom:var(--s4)"
          onclick="document.getElementById('upload-file').click()"
          ondragover="Upload.onDragOver(event)"
          ondrop="Upload.onDrop(event)">
          <div style="font-size:32px;margin-bottom:var(--s3)">📂</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:var(--s2)">Toque para selecionar</div>
          <div style="font-size:12px;color:var(--text-3)">ou arraste os arquivos CSV aqui</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:var(--s2)">Múltiplos arquivos permitidos</div>
        </div>
        <input type="file" id="upload-file" accept=".csv" multiple style="display:none" onchange="Upload.onFile(this)">
      </div>
      <div id="upload-preview" style="display:none">
        <div class="card" style="margin-bottom:var(--s3)">
          <div class="flex items-center justify-between" style="margin-bottom:var(--s4)">
            <h3 id="upload-count"></h3>
            <button class="btn btn-sm btn-secondary" onclick="Upload.limpar()">Limpar</button>
          </div>
          <div id="upload-arquivos" style="margin-bottom:var(--s4)"></div>
          <button class="btn btn-primary btn-full" id="btn-importar" onclick="Upload.importar()">
            Importar Vendas
          </button>
        </div>
        <div id="upload-linhas" style="font-size:12px;color:var(--text-3)"></div>
      </div>
      <div id="upload-nao-id"></div>`;
  },

  onDragOver(e) {
    e.preventDefault();
    document.getElementById('upload-dropzone').style.borderColor = 'var(--accent)';
  },

  onDrop(e) {
    e.preventDefault();
    document.getElementById('upload-dropzone').style.borderColor = 'var(--border-2)';
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    if (files.length) this.processarArquivos(files);
  },

  onFile(input) {
    const files = Array.from(input.files);
    if (files.length) this.processarArquivos(files);
  },

  processarArquivos(files) {
    this.linhas = [];
    this._arquivos = [];
    let processados = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const linhas = this.parsearCSV(e.target.result);
        this._arquivos.push({ nome: file.name, count: linhas.length });
        this.linhas = this.linhas.concat(linhas);
        processados++;
        if (processados === files.length) this.renderPreview();
      };
      reader.readAsText(file, 'utf-8');
    });
  },

  parsearCSV(texto) {
    const linhas = texto.split('\n').filter(l => l.trim());
    if (linhas.length < 2) return [];
    const sep = linhas[0].includes(';') ? ';' : ',';
    const cabecalho = this._parseRow(linhas[0], sep);
    return linhas.slice(1).map(l => {
      const cols = this._parseRow(l, sep);
      const obj = {};
      cabecalho.forEach((h, i) => obj[h.trim()] = (cols[i] || '').trim());
      return obj;
    }).filter(l => l['Id da Central'] && (l['Venda Teste'] || '').trim().toUpperCase() !== 'SIM');
  },

  _parseRow(row, sep) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === sep && !inQuotes) { result.push(current); current = ''; }
      else { current += c; }
    }
    result.push(current);
    return result;
  },

  renderPreview() {
    const n = this.linhas.length;
    document.getElementById('upload-preview').style.display = 'block';
    document.getElementById('upload-count').textContent = `${n} venda${n !== 1 ? 's' : ''} encontrada${n !== 1 ? 's' : ''}`;

    const arquivosHtml = (this._arquivos || []).map(a =>
      `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span style="color:var(--text)">📄 ${a.nome}</span>
        <span style="color:var(--text-3)">${a.count} vendas</span>
      </div>`
    ).join('');
    document.getElementById('upload-arquivos').innerHTML = arquivosHtml;

    const preview = this.linhas.slice(0, 5).map(l =>
      `<div style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
        <span>${l['Nome'] || '—'}</span>
        <span style="color:var(--text-3)">${l['Data de Pagamento'] || ''}</span>
      </div>`
    ).join('');
    document.getElementById('upload-linhas').innerHTML =
      `<div class="card card-sm"><div class="section-title" style="margin-bottom:var(--s3)">Prévia</div>${preview}${n > 5 ? `<div style="padding:6px 0;color:var(--text-3)">... e mais ${n-5}</div>` : ''}</div>`;
  },

  async importar() {
    const btn = document.getElementById('btn-importar');
    Utils.btnLoading(btn, true);
    try {
      const LOTE = 500;
      let totalImportados = 0, totalAtualizados = 0, totalErros = 0;
      let ocsNaoId = [], planosNaoId = [], semCanal = [];

      for (let i = 0; i < this.linhas.length; i += LOTE) {
        const lote = this.linhas.slice(i, i + LOTE);
        const progresso = Math.round((i / this.linhas.length) * 100);
        btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></div>${progresso}% — ${i} de ${this.linhas.length}`;

        const res = await API.uploadCSV(lote);
        if (res.erro) { Utils.toast('Erro: ' + res.erro, 'error'); break; }

        totalImportados  += res.importados  || 0;
        totalAtualizados += res.atualizados || 0;
        totalErros       += res.erros       || 0;
        ocsNaoId    = [...new Set([...ocsNaoId,    ...(res.ocsNaoId    || [])])];
        planosNaoId = [...new Set([...planosNaoId, ...(res.planosNaoId || [])])];
        semCanal    = [...new Set([...semCanal,    ...(res.semCanal    || [])])];
      }

      const msgs = [];
      if (totalImportados  > 0) msgs.push(`${totalImportados} importadas`);
      if (totalAtualizados > 0) msgs.push(`${totalAtualizados} atualizadas`);
      if (msgs.length) Utils.toast(msgs.join(' · ') + '!', 'success');
      if (totalErros > 0) Utils.toast(`${totalErros} erros`, 'error');

      this._naoIdOCs    = ocsNaoId;
      this._naoIdPlanos = planosNaoId;
      this._semCanal    = semCanal;

      const temProblemas = ocsNaoId.length || planosNaoId.length || semCanal.length;
      if (temProblemas) {
        try {
          const [cfg, regras] = await Promise.all([API.getConfig(), API.getRegrасCanal()]);
          this._eventos = (cfg.eventos || []).map(e => e.nome).sort();
          this._canais  = [...new Set((regras.regras || []).map(r => r.canal))].sort();
        } catch { this._eventos = []; this._canais = []; }
        this._renderNaoId();
      } else {
        document.getElementById('upload-nao-id').innerHTML = '';
      }

      this.limpar();
    } catch (e) {
      Utils.toast('Erro ao importar: ' + e.message, 'error');
      Utils.btnLoading(btn, false);
    }
  },

  _renderNaoId() {
    const totalNaoId = this._naoIdOCs.length + this._naoIdPlanos.length;
    const totalSemCanal = this._semCanal.length;
    const total = totalNaoId + totalSemCanal;

    if (!total) {
      document.getElementById('upload-nao-id').innerHTML = '';
      return;
    }

    const optsEvento = this._eventos.map(e =>
      `<option value="${e}">${e}</option>`
    ).join('');

    // Item de OC/Plano não vinculado a evento
    const renderItemNaoId = (codigo, tipo) => `
      <div id="nid-${btoa(unescape(encodeURIComponent(codigo))).replace(/[+=\/]/g,'_')}"
        style="padding:var(--s3) 0;border-bottom:1px solid var(--border)">
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text);margin-bottom:var(--s2)">${codigo}</div>
        <div style="display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap">
          <select class="input select" style="flex:1;min-width:160px;font-size:12px;padding:6px 10px"
            id="sel-${btoa(unescape(encodeURIComponent(codigo))).replace(/[+=\/]/g,'_')}">
            <option value="">— Selecionar evento —</option>
            ${optsEvento}
          </select>
          <button class="btn btn-sm btn-primary"
            onclick="Upload.vincular('${codigo.replace(/'/g,"\\'")}','${tipo}')">
            Vincular
          </button>
        </div>
      </div>`;

    // Item de OC sem canal — formulário de criar regra
    const renderItemSemCanal = (oc) => {
      const sid = btoa(unescape(encodeURIComponent(oc))).replace(/[+=\/]/g,'_');
      return `
        <div id="sc-${sid}" style="padding:var(--s3) 0;border-bottom:1px solid var(--border)">
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text);margin-bottom:var(--s2)">${oc}</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s2)">Nenhuma regra de canal encontrada. Crie uma regra:</div>
          <div style="display:flex;gap:var(--s2);flex-wrap:wrap;align-items:center">
            <input id="sc-padrao-${sid}" class="input" placeholder="Padrão (ex: _TF_)"
              style="flex:2;min-width:100px;padding:5px 8px;font-size:12px"
              value="${this._sugerirPadrao(oc)}">
            <select id="sc-tipo-${sid}" class="input select" style="flex:1;min-width:100px;font-size:12px;padding:5px 8px">
              <option value="igual_a">Igual a</option>
              <option value="contem">Contém</option>
              <option value="comeca_com">Começa com</option>
              <option value="termina_com">Termina com</option>
            </select>
            <input id="sc-canal-${sid}" class="input" placeholder="Sub-canal"
              list="sc-canais-list" autocomplete="off"
              style="flex:2;min-width:100px;padding:5px 8px;font-size:12px">
            <select id="sc-macro-${sid}" class="input select" style="flex:1;min-width:90px;font-size:12px;padding:5px 8px">
              <option value="">Canal Macro</option>
              <option value="VA">VA - Venda Ativa</option>
              <option value="VD">VD - Venda Direta</option>
              <option value="RC">RC - Venda Recuperação</option>
              <option value="GT">GT - Gratuito</option>
            </select>
            <button class="btn btn-sm btn-primary"
              onclick="Upload.criarRegra('${oc.replace(/'/g,"\\'")}','${sid}')">
              Criar Regra
            </button>
          </div>
        </div>`;
    };

    let html = `<div class="card" style="margin-top:var(--s4);border-color:var(--accent)">
      <datalist id="sc-canais-list">${this._canais.sort().map(c => `<option value="${c}">`).join('')}</datalist>
      <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:var(--s4)">⚠️ ${total} item${total !== 1 ? 'ns' : ''} precisam de atenção</div>`;

    if (totalNaoId > 0) {
      html += `<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:var(--s3)">
        Sem evento vinculado (${totalNaoId})</div>`;
      if (this._naoIdOCs.length) {
        html += `<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s2)">OCs</div>`;
        html += this._naoIdOCs.map(oc => renderItemNaoId(oc, 'oc')).join('');
      }
      if (this._naoIdPlanos.length) {
        html += `<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin:var(--s3) 0 var(--s2)">Planos</div>`;
        html += this._naoIdPlanos.map(p => renderItemNaoId(p, 'plano')).join('');
      }
    }

    if (totalSemCanal > 0) {
      if (totalNaoId > 0) html += `<div class="divider"></div>`;
      html += `<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:var(--s3)">
        Sem canal identificado (${totalSemCanal})</div>`;
      html += this._semCanal.map(oc => renderItemSemCanal(oc)).join('');
    }

    html += `</div>`;
    document.getElementById('upload-nao-id').innerHTML = html;
  },

  // Sugere um padrão baseado no código da OC
  _sugerirPadrao(oc) {
    const partes = oc.split('_').filter(p => p.length > 1);
    // Pega o último segmento como sugestão
    return partes.length >= 2 ? '_' + partes[partes.length - 1] + '_' : '';
  },

  async criarRegra(oc, sid) {
    const padrao     = document.getElementById('sc-padrao-' + sid)?.value.trim();
    const tipo       = document.getElementById('sc-tipo-'   + sid)?.value || 'contem';
    const canal      = document.getElementById('sc-canal-'  + sid)?.value.trim().toUpperCase();
    const canalMacro = document.getElementById('sc-macro-'  + sid)?.value || '';
    if (!padrao || !canal) { Utils.toast('Preencha padrão e canal', 'error'); return; }
    if (!canalMacro) { Utils.toast('Selecione o Canal Macro', 'error'); return; }

    try {
      await API.salvarRegraCanal({ padrao, tipo, canal, canalMacro });
      const res = await API.aplicarRegraCanal({ padrao, tipo, canal, canalMacro });

      // Remove da lista
      this._semCanal = this._semCanal.filter(x => x !== oc);
      const el = document.getElementById('sc-' + sid);
      if (el) el.remove();

      const msg = res.atualizados > 0
        ? `Regra criada! ${res.atualizados} venda${res.atualizados !== 1 ? 's' : ''} atualizada${res.atualizados !== 1 ? 's' : ''}`
        : `Regra criada para "${canal}"`;
      Utils.toast(msg, 'success');

      if (!this._naoIdOCs.length && !this._naoIdPlanos.length && !this._semCanal.length) {
        document.getElementById('upload-nao-id').innerHTML = '';
      }
    } catch { Utils.toast('Erro ao criar regra', 'error'); }
  },

  async vincular(codigo, tipo) {
    const id  = btoa(unescape(encodeURIComponent(codigo))).replace(/[+=\/]/g, '_');
    const sel = document.getElementById('sel-' + id);
    const evento = sel ? sel.value : '';
    if (!evento) { Utils.toast('Selecione um evento', 'error'); return; }

    const btn = sel.nextElementSibling;
    Utils.btnLoading(btn, true);

    try {
      const res = await API.vincularAtualizar(tipo, codigo, evento);

      if (tipo === 'oc') this._naoIdOCs = this._naoIdOCs.filter(x => x !== codigo);
      else               this._naoIdPlanos = this._naoIdPlanos.filter(x => x !== codigo);

      const el = document.getElementById('nid-' + id);
      if (el) el.remove();

      const msg = res.atualizados > 0
        ? `Vinculado! ${res.atualizados} venda${res.atualizados !== 1 ? 's' : ''} atualizada${res.atualizados !== 1 ? 's' : ''}`
        : `Vinculado a ${evento}!`;
      Utils.toast(msg, 'success');

      if (!this._naoIdOCs.length && !this._naoIdPlanos.length && !this._semCanal.length) {
        document.getElementById('upload-nao-id').innerHTML = '';
      }
    } catch {
      Utils.toast('Erro ao vincular', 'error');
      Utils.btnLoading(btn, false);
    }
  },

  limpar() {
    this.linhas = [];
    this._arquivos = [];
    document.getElementById('upload-preview').style.display = 'none';
    document.getElementById('upload-file').value = '';
  }
};

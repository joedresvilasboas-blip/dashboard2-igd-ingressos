// ===== CADASTROS =====
const Cadastros = {
  init() {
    const el = document.getElementById('cadastros-content');
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
        ${this._menuItem('👤', 'Vendedores', 'vendedores')}
        ${this._menuItem('🏆', 'Equipes', 'equipes')}
        ${this._menuItem('🎪', 'Eventos', 'eventos')}
        ${this._menuItem('📅', 'Calendário', 'calendario')}
        ${this._menuItem('📡', 'Regras de Canal', 'canais')}
        ${this._menuItem('🔗', 'OCs & Planos', 'ocs')}
      </div>`;
  },

  _menuItem(icon, label, id) {
    return `
      <button class="card" style="text-align:center;cursor:pointer;border:1px solid var(--border);padding:var(--s5);transition:border-color var(--t1)"
        onclick="Cadastros.abrirSecao('${id}')"
        onmouseenter="this.style.borderColor='var(--accent)'"
        onmouseleave="this.style.borderColor='var(--border)'">
        <div style="font-size:28px;margin-bottom:var(--s3)">${icon}</div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${label}</div>
      </button>`;
  },

  abrirSecao(secao) {
    const telas = {
      vendedores: CadVendedores,
      equipes:    CadEquipes,
      eventos:    CadEventos,
      calendario: CadCalendario,
      canais:     CadCanais,
      ocs:        CadOCs,
    };
    const tela = telas[secao];
    if (tela) tela.abrir();
  },

  _voltarMenu() {
    this.init();
  }
};

// ===== CADASTRO DE VENDEDORES =====
const CadVendedores = {
  dados: [],

  async abrir() {
    const tela = document.getElementById('cadastros-content');
    if (!tela) return;
    tela.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div style="display:flex;align-items:center;gap:var(--s3);padding:var(--s4) var(--s5);
          border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" onclick="Cadastros._voltarMenu()">← Voltar</button>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Vendedores</div>
          <div style="display:flex;gap:var(--s2);margin-left:auto;flex-wrap:wrap">
            <input type="text" id="cad-busca" class="input" placeholder="Buscar..."
              style="width:150px" oninput="CadVendedores.renderLista()">
            <select id="cad-filtro" class="input select" style="min-width:90px" onchange="CadVendedores.renderLista()">
              <option value="ativo">Ativos</option>
              <option value="todos">Todos</option>
              <option value="inativo">Inativos</option>
            </select>
            <select id="cad-equipe" class="input select" style="min-width:100px" onchange="CadVendedores.renderLista()">
              <option value="todas">Equipes</option>
            </select>
            <button class="btn btn-sm btn-primary" onclick="CadVendedores.novo()">+ Novo</button>
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('vend-file').click()">📥 CSV</button>
            <input type="file" id="vend-file" accept=".csv" style="display:none" onchange="CadVendedores.onFileVendedor(this)">
          </div>
        </div>
        <div id="cad-form" style="display:none;padding:var(--s4) var(--s5);border-bottom:1px solid var(--border);flex-shrink:0"></div>
        <div id="cad-lista" class="scroll-area" style="flex:1;padding:0 var(--s5)"></div>
      </div>`;
    await this.carregar();
  },

  async carregar() {
    const el = document.getElementById('cad-lista');
    el.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const d = await API.getConfig();
      this.dados = d.vendedores || [];
      this.renderLista();
    } catch { el.innerHTML = '<div class="empty"><div class="empty-title">Erro</div></div>'; }
  },

  renderLista() {
    const el = document.getElementById('cad-lista');
    const busca  = (document.getElementById('cad-busca')?.value || '').toLowerCase();
    const filtro = document.getElementById('cad-filtro')?.value || 'ativo';
    const equipe = document.getElementById('cad-equipe')?.value || 'todas';

    // Monta equipes condicionadas ao status selecionado
    const selEq = document.getElementById('cad-equipe');
    if (selEq) {
      const equipesVisiveis = [...new Set(
        this.dados
          .filter(v => filtro === 'todos' || (filtro === 'ativo' && v.ativo) || (filtro === 'inativo' && !v.ativo))
          .map(v => v.equipe).filter(e => e)
      )].sort();
      const valorAtual = selEq.value;
      selEq.innerHTML = '<option value="todas">Equipes</option>' +
        equipesVisiveis.map(eq => `<option value="${eq}" ${eq === valorAtual ? 'selected' : ''}>${eq}</option>`).join('');
    }

    let lista = this.dados
      .filter(v =>
        (!busca || v.nome.toLowerCase().includes(busca) || v.codigo.toLowerCase().includes(busca) || (v.apelido||'').toLowerCase().includes(busca)) &&
        (filtro === 'todos' || (filtro === 'ativo' && v.ativo) || (filtro === 'inativo' && !v.ativo)) &&
        (equipe === 'todas' || v.equipe === equipe)
      )
      .sort((a, b) => {
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
        return a.codigo.localeCompare(b.codigo, undefined, { numeric: true });
      });

    el.innerHTML = lista.map(v => {
      const nivelLabel = { junior: 'Junior', pleno: 'Pleno', senior: 'Senior' };
      const nivelStr   = nivelLabel[v.nivel] || '';
      const dtStr      = v.dtInicio ? v.dtInicio.split('-').reverse().join('/') : '';
      const sub        = [v.equipe, nivelStr, dtStr].filter(Boolean).join(' · ');
      const equipes = [...new Set(this.dados.map(d => d.equipe).filter(Boolean))].sort();
      const optsEq = equipes.map(eq => `<option value="${eq}" ${eq===v.equipe?'selected':''}>${eq}</option>`).join('');
      return `
      <div class="list-item" style="flex-wrap:wrap;gap:var(--s2);align-items:flex-start;padding:var(--s3) var(--s4)">
        <div class="avatar ${v.ativo ? 'avatar-gold' : ''}" style="${!v.ativo ? 'background:var(--bg-3);color:var(--text-3)' : ''}">${Utils.iniciais(v.apelido || v.nome)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${v.ativo ? 'var(--text)' : 'var(--text-3)'}" class="truncate">${v.apelido || v.nome}</div>
          <div style="font-size:11px;color:var(--text-3)">${v.codigo}${sub ? ' · ' + sub : ''}</div>
          <!-- Campos inline editáveis -->
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
            <input type="text" value="${v.apelido||''}" placeholder="Apelido"
              style="font-size:11px;padding:3px 8px;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);width:110px"
              onchange="CadVendedores.salvarCampo('${v.codigo}','apelido',this.value)"
              title="Apelido">
            <input type="date" value="${(() => { const d=v.dtInicio||''; const m=d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m?m[3]+'-'+m[2]+'-'+m[1]:d; })()}"
              style="font-size:11px;padding:3px 8px;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);width:130px"
              onchange="CadVendedores.salvarCampo('${v.codigo}','dtInicio',this.value)"
              title="Data de início">
            <select style="font-size:11px;padding:3px 8px;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);min-width:90px"
              onchange="CadVendedores.salvarCampo('${v.codigo}','equipe',this.value)"
              title="Equipe">
              <option value="">Equipe</option>${optsEq}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:var(--s2);flex-shrink:0">
          <button class="btn btn-sm btn-secondary"
            onclick="CadVendedores.editar('${v.codigo}')"
            title="Editar todos os dados">✏️</button>
          <button class="btn btn-sm ${v.ativo ? 'btn-green' : 'btn-secondary'}"
            onclick="CadVendedores.toggleAtivo('${v.codigo}',${v.ativo})"
            style="${!v.ativo ? 'color:var(--text-3)' : ''}">
            ${v.ativo ? '● Ativo' : '○ Inativo'}
          </button>
        </div>
      </div>`;
    }).join('') || '<div class="empty"><div class="empty-title">Nenhum vendedor</div></div>';
  },

  async salvarCampo(codigo, campo, valor) {
    const v = this.dados.find(x => x.codigo === codigo);
    if (!v || v[campo] === valor.trim()) return;
    v[campo] = valor.trim();
    try {
      await API.salvarVendedor({ ...v });
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  async toggleAtivo(codigo, ativoAtual) {
    const v = this.dados.find(x => x.codigo === codigo);
    if (!v) return;
    try {
      await API.salvarVendedor({ ...v, ativo: !ativoAtual });
      v.ativo = !ativoAtual;
      this.renderLista();
      Utils.toast(v.ativo ? 'Ativado!' : 'Inativado!', 'success');
    } catch { Utils.toast('Erro', 'error'); }
  },

  editar(codigo) {
    const v = this.dados.find(x => x.codigo === codigo);
    if (!v) return;
    document.getElementById('cad-form').innerHTML = this._form(v);
    document.getElementById('cad-form').style.display = 'block';
  },

  novo() {
    document.getElementById('cad-form').innerHTML = this._form({});
    document.getElementById('cad-form').style.display = 'block';
  },

  _form(v) {
    const isSup = (v.perfil || 'VENDEDOR') === 'SUPERVISOR';
    const custos = isSup
      ? { junior: 'R$ 3.000', pleno: 'R$ 3.500', senior: 'R$ 4.000' }
      : { junior: 'R$ 1.500', pleno: 'R$ 1.800', senior: 'R$ 2.200' };
    return `
      <div class="divider"></div>
      <h4 style="margin-bottom:var(--s4)">${v.codigo ? 'Editar' : 'Novo'} Vendedor</h4>
      <div class="input-group">
        <label class="input-label">Código</label>
        <input id="f-codigo" class="input" value="${v.codigo||''}" placeholder="Ex: V001" ${v.codigo ? 'readonly style="opacity:.6"' : ''}>
      </div>
      <div class="input-group">
        <label class="input-label">Nome</label>
        <input id="f-nome" class="input" value="${v.nome||''}" placeholder="Nome completo">
      </div>
      <div class="input-group">
        <label class="input-label">Apelido <span style="color:var(--text-3);font-weight:400">(aparece no ranking)</span></label>
        <input id="f-apelido" class="input" value="${v.apelido||''}" placeholder="Ex: João Silva">
      </div>
      <div class="input-group">
        <label class="input-label">Equipe</label>
        <input id="f-equipe" class="input" value="${v.equipe||''}" placeholder="Ex: HUSKIES">
      </div>
      <div class="input-group">
        <label class="input-label">Data de Início <span style="color:var(--text-3);font-weight:400">(início do contrato)</span></label>
        <input id="f-dtinicio" class="input" type="date" value="${v.dtInicio||''}">
      </div>
      <div class="input-group">
        <label class="input-label">Perfil <span style="color:var(--text-3);font-weight:400">(define função e custo)</span></label>
        <select id="f-perfil" class="input" style="appearance:auto" onchange="CadVendedores._atualizarCustos(this.value)">
          <option value="VENDEDOR"   ${(v.perfil||'VENDEDOR')==='VENDEDOR'   ?'selected':''}>Vendedor</option>
          <option value="SUPERVISOR" ${v.perfil==='SUPERVISOR'?'selected':''}>Supervisor</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Nível <span style="color:var(--text-3);font-weight:400">(define custo fixo)</span></label>
        <select id="f-nivel" class="input" style="appearance:auto">
          <option value="" ${!v.nivel?'selected':''}>— Não definido —</option>
          <option value="JUNIOR"  id="opt-junior"  ${v.nivel==='JUNIOR' ?'selected':''}>${'Junior — ' + custos.junior}</option>
          <option value="PLENO"   id="opt-pleno"   ${v.nivel==='PLENO'  ?'selected':''}>${'Pleno — '  + custos.pleno}</option>
          <option value="SENIOR"  id="opt-senior"  ${v.nivel==='SENIOR' ?'selected':''}>${'Senior — ' + custos.senior}</option>
        </select>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary" style="flex:1" onclick="document.getElementById('cad-form').style.display='none'">Cancelar</button>
        <button class="btn btn-primary" style="flex:1" onclick="CadVendedores.salvar('${v.ativo !== undefined ? v.ativo : false}')">Salvar</button>
      </div>`;
  },

  _atualizarCustos(perfil) {
    const isSup = perfil === 'SUPERVISOR';
    const custos = isSup
      ? { JUNIOR: 'Junior — R$ 3.000', PLENO: 'Pleno — R$ 3.500', SENIOR: 'Senior — R$ 4.000' }
      : { JUNIOR: 'Junior — R$ 1.500', PLENO: 'Pleno — R$ 1.800', SENIOR: 'Senior — R$ 2.200' };
    ['JUNIOR','PLENO','SENIOR'].forEach(n => {
      const el = document.getElementById('opt-' + n.toLowerCase());
      if (el) el.textContent = custos[n];
    });
  },

  async salvar(ativoAtual) {
    const dados = {
      codigo:   document.getElementById('f-codigo').value.trim(),
      nome:     document.getElementById('f-nome').value.trim(),
      apelido:  document.getElementById('f-apelido').value.trim(),
      equipe:   document.getElementById('f-equipe').value.trim(),
      dtInicio: document.getElementById('f-dtinicio').value,
      nivel:    (document.getElementById('f-nivel')?.value || '').toUpperCase(),
      perfil:   document.getElementById('f-perfil')?.value || 'VENDEDOR',
      ativo:    ativoAtual === 'true' || ativoAtual === true,
    };
    if (!dados.codigo || !dados.nome) { Utils.toast('Preencha os campos obrigatórios', 'error'); return; }
    try {
      await API.salvarVendedor(dados);
      Utils.toast('Salvo!', 'success');
      document.getElementById('cad-form').style.display = 'none';
      await this.carregar();
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  // Upload CSV
  onFileVendedor(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const linhas = this._parsearCSV(e.target.result);
      if (!linhas.length) { Utils.toast('Nenhum vendedor encontrado no CSV', 'error'); return; }
      try {
        const res = await API.uploadVendedores(linhas);
        Utils.toast(`${res.inseridos} adicionados · ${res.ignorados} já existiam`, 'success');
        await this.carregar();
      } catch(e) { Utils.toast('Erro ao importar: ' + e.message, 'error'); }
      input.value = '';
    };
    reader.readAsText(file, 'utf-8');
  },

  _parsearCSV(texto) {
    const linhas = texto.split('\n').filter(l => l.trim());
    if (linhas.length < 2) return [];
    const sep = linhas[0].includes(';') ? ';' : ',';
    const cab = linhas[0].split(sep).map(h => h.trim().replace(/"/g,''));
    const idxCodigo = cab.findIndex(h => h.toLowerCase().includes('código') || h.toLowerCase().includes('codigo') || h.toLowerCase() === 'code');
    const idxNome   = cab.findIndex(h => h.toLowerCase() === 'nome' || h.toLowerCase() === 'name');
    if (idxCodigo < 0 || idxNome < 0) return [];
    return linhas.slice(1).map(l => {
      const cols = l.split(sep).map(c => c.trim().replace(/"/g,''));
      return { codigo: cols[idxCodigo]||'', nome: cols[idxNome]||'' };
    }).filter(l => l.codigo && l.nome);
  },


};

// ===== CADASTRO DE EQUIPES =====
const CadEquipes = {
  dados:      [],   // lista de equipes [{nome, lider}]
  vendedores: [],   // lista completa de vendedores (para contar membros)
  _expandido: null, // nome da equipe com membros expandidos

  async abrir() {
    const tela = document.getElementById('cadastros-content');
    if (!tela) return;
    tela.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">

        <!-- HEADER -->
        <div style="display:flex;align-items:center;gap:var(--s3);padding:var(--s4) var(--s5);
          border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" onclick="Cadastros._voltarMenu()">← Voltar</button>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Equipes</div>
          <div style="display:flex;gap:var(--s2);margin-left:auto">
            <input type="text" id="eq-busca" class="input" placeholder="Buscar..."
              style="width:140px" oninput="CadEquipes.renderLista()">
            <button class="btn btn-sm btn-primary" onclick="CadEquipes.nova()">+ Nova</button>
          </div>
        </div>

        <!-- FORMULÁRIO (oculto por padrão) -->
        <div id="eq-form" style="display:none;padding:var(--s4) var(--s5);
          border-bottom:1px solid var(--border);flex-shrink:0"></div>

        <!-- LISTA -->
        <div id="eq-lista" class="scroll-area" style="flex:1;padding:0 var(--s5)">
          <div class="spinner" style="margin:20px auto"></div>
        </div>

      </div>`;
    await this.carregar();
  },

  async carregar() {
    const el = document.getElementById('eq-lista');
    if (!el) return;
    el.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const d = await API.getConfig();
      this.dados      = (d.equipes    || []).sort((a, b) => a.nome.localeCompare(b.nome));
      this.vendedores = (d.vendedores || []);
      this.renderLista();
    } catch {
      el.innerHTML = '<div class="empty"><div class="empty-title">Erro ao carregar</div></div>';
    }
  },

  renderLista() {
    const el = document.getElementById('eq-lista');
    if (!el) return;
    const busca = (document.getElementById('eq-busca')?.value || '').toLowerCase();

    const lista = this.dados.filter(e =>
      !busca ||
      e.nome.toLowerCase().includes(busca) ||
      (e.lider || '').toLowerCase().includes(busca)
    );

    if (!lista.length) {
      el.innerHTML = '<div class="empty"><div class="empty-title">Nenhuma equipe encontrada</div></div>';
      return;
    }

    // Supervisores ativos para o select de líder
    const supervisores = this.vendedores.filter(v => v.perfil === 'SUPERVISOR' && v.ativo);

    el.innerHTML = lista.map(e => {
      const membros  = this.vendedores.filter(v => v.equipe === e.nome);
      const supEq    = membros.filter(v => v.ativo && v.perfil === 'SUPERVISOR');
      const ativos   = membros.filter(v => v.ativo && v.perfil !== 'SUPERVISOR');
      const inativos = membros.filter(v => !v.ativo);
      const expandido = this._expandido === e.nome;

      const supOpts = supervisores.map(s => {
        const label = s.equipe === e.nome ? `⭐ ${s.apelido||s.nome}` : `${s.apelido||s.nome} (${s.equipe||'sem equipe'})`;
        const sel   = e.lider === (s.apelido||s.nome) || e.lider === s.nome;
        return `<option value="${s.apelido||s.nome}" ${sel?'selected':''}>${label}</option>`;
      }).join('');


      // Vendedores disponíveis para adicionar (todos fora dessa equipe, ativos e inativos)
      const disponiveis = this.vendedores.filter(v => v.equipe !== e.nome);
      const dispAtivos   = disponiveis.filter(v => v.ativo).sort((a,b) => (a.apelido||a.nome).localeCompare(b.apelido||b.nome));
      const dispInativos = disponiveis.filter(v => !v.ativo).sort((a,b) => (a.apelido||a.nome).localeCompare(b.apelido||b.nome));
      const toOpt = (v, inativo) => {
        const prefix  = v.perfil === 'SUPERVISOR' ? '⭐ ' : '';
        const sufixEq = v.equipe ? ` (${v.equipe})` : ' (sem equipe)';
        const sufixAt = inativo ? ' — Inativo' : '';
        return `<option value="${v.codigo}">${prefix}${v.apelido||v.nome}${sufixEq}${sufixAt}</option>`;
      };
      const dispOpts = [
        dispAtivos.length   ? `<optgroup label="Ativos">${dispAtivos.map(v => toOpt(v,false)).join('')}</optgroup>`   : '',
        dispInativos.length ? `<optgroup label="Inativos">${dispInativos.map(v => toOpt(v,true)).join('')}</optgroup>` : '',
      ].join('');

      const membrosHtml = expandido ? `
        <div style="margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">
            Membros (${membros.length})
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:var(--s3)">
            ${!membros.length
              ? `<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:var(--s2) 0">Nenhum membro ainda.</div>`
              : [
                  ...supEq.map(v => `
                    <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--r2);background:rgba(245,158,11,.06)">
                      <div style="font-size:16px;flex-shrink:0">⭐</div>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:12px;font-weight:700;color:#f59e0b">${v.apelido||v.nome}</div>
                        <div style="font-size:10px;color:var(--text-3)">${v.codigo} · Supervisor ${v.nivel||''}</div>
                      </div>
                      <button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:var(--r2)"
                        onclick="CadEquipes.removerMembro('${v.codigo.replace(/'/g,"\\'")}','${e.nome.replace(/'/g,"\\'")}')">Remover</button>
                    </div>`),
                  ...ativos.map(v => `
                    <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--r2)">
                      <div class="avatar avatar-gold" style="width:26px;height:26px;font-size:9px;flex-shrink:0">${Utils.iniciais(v.apelido||v.nome)}</div>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:12px;font-weight:600;color:var(--text)">${v.apelido||v.nome}</div>
                        <div style="font-size:10px;color:var(--text-3)">${v.codigo}${v.nivel ? ' · ' + v.nivel : ''}</div>
                      </div>
                      <button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:var(--r2)"
                        onclick="CadEquipes.removerMembro('${v.codigo.replace(/'/g,"\\'")}','${e.nome.replace(/'/g,"\\'")}')">Remover</button>
                    </div>`),
                  ...inativos.map(v => `
                    <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--r2);opacity:.5">
                      <div class="avatar" style="width:26px;height:26px;font-size:9px;flex-shrink:0;background:var(--bg-3);color:var(--text-3)">${Utils.iniciais(v.apelido||v.nome)}</div>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:12px;color:var(--text-3)">${v.apelido||v.nome}</div>
                        <div style="font-size:10px;color:var(--text-3)">${v.codigo} · Inativo</div>
                      </div>
                      <button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:var(--r2)"
                        onclick="CadEquipes.removerMembro('${v.codigo.replace(/'/g,"\\'")}','${e.nome.replace(/'/g,"\\'")}')">Remover</button>
                    </div>`)
                ].join('')
            }
          </div>
          ${disponiveis.length ? `
          <div style="display:flex;gap:var(--s2);align-items:center;padding-top:var(--s3);border-top:1px solid var(--border)">
            <select id="add-vend-${e.nome.replace(/\s/g,'_').replace(/'/g,'')}" class="input" style="appearance:auto;flex:1;font-size:12px;padding:5px 8px">
              <option value="">Selecionar vendedor...</option>
              ${dispOpts}
            </select>
            <button class="btn btn-sm btn-primary"
              onclick="CadEquipes.adicionarMembro('add-vend-${e.nome.replace(/\s/g,'_').replace(/'/g,'')}','${e.nome.replace(/'/g,"\\'")}')">+ Adicionar</button>
          </div>` : `
          <div style="padding-top:var(--s3);border-top:1px solid var(--border);font-size:11px;color:var(--text-3);font-style:italic">
            Todos os vendedores ativos já estão nesta equipe.
          </div>`}
        </div>` : '';

      return `
      <div class="list-item" style="flex-direction:column;align-items:stretch;padding:var(--s3) var(--s4)">
        <div style="display:flex;align-items:center;gap:var(--s3)">
          <div class="avatar avatar-gold" style="font-size:14px;flex-shrink:0">🏆</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text)">${e.nome}</div>
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">
              ${supEq.length ? '⭐ ' + supEq.map(s=>s.apelido||s.nome).join(', ') + ' · ' : ''}${membros.length} membro${membros.length!==1?'s':''} (${ativos.length} vendedor${ativos.length!==1?'es':''})
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:10px;color:var(--text-3)">Líder:</span>
              ${supervisores.length
                ? `<select style="font-size:11px;padding:3px 8px;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);min-width:160px"
                    onchange="CadEquipes.salvarLider('${e.nome.replace(/'/g,"\\'")}',this.value)">
                    <option value="">— Nenhum —</option>${supOpts}
                  </select>`
                : `<input type="text" value="${e.lider||''}" placeholder="Nome do líder"
                    style="font-size:11px;padding:3px 8px;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);width:170px"
                    onchange="CadEquipes.salvarLider('${e.nome.replace(/'/g,"\\'")}',this.value)">`
              }
            </div>
          </div>
          <div style="display:flex;gap:var(--s2);flex-shrink:0;align-items:center">
            <button class="btn btn-sm btn-secondary" onclick="CadEquipes._toggleMembros('${e.nome.replace(/'/g,"\\'")}')">
              ${expandido ? '▲' : '▼'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="CadEquipes.editar('${e.nome.replace(/'/g,"\\'")}')">✏️</button>
          </div>
        </div>
        ${membrosHtml}
      </div>`;
    }).join('');
  },

  _toggleMembros(nome) {
    this._expandido = this._expandido === nome ? null : nome;
    this.renderLista();
  },

  nova() {
    const f = document.getElementById('eq-form');
    f.innerHTML = this._form({});
    f.style.display = 'block';
    document.getElementById('eq-f-nome')?.focus();
  },

  editar(nome) {
    const eq = this.dados.find(e => e.nome === nome);
    if (!eq) return;
    const f = document.getElementById('eq-form');
    f.innerHTML = this._form(eq);
    f.style.display = 'block';
    document.getElementById('eq-f-lider')?.focus();
  },

  _form(eq) {
    const isNovo = !eq.nome;
    const supervisores = this.vendedores.filter(v => v.perfil === 'SUPERVISOR' && v.ativo);
    const supOpts = supervisores.map(s => {
      const label = s.equipe === eq.nome ? `⭐ ${s.apelido||s.nome}` : `${s.apelido||s.nome} (${s.equipe||'sem equipe'})`;
      const sel   = eq.lider === (s.apelido||s.nome) || eq.lider === s.nome;
      return `<option value="${s.apelido||s.nome}" ${sel?'selected':''}>${label}</option>`;
    }).join('');
    return `
      <div class="divider"></div>
      <h4 style="margin-bottom:var(--s4)">${isNovo ? 'Nova Equipe' : 'Editar Equipe'}</h4>
      <div class="input-group">
        <label class="input-label">Nome da Equipe *
          ${!isNovo ? '<span style="color:var(--text-3);font-weight:400">(chave — não pode ser alterado)</span>' : ''}
        </label>
        <input id="eq-f-nome" class="input" value="${eq.nome||''}"
          placeholder="Ex: HUSKIES"
          ${!isNovo ? 'readonly style="opacity:.6;text-transform:uppercase"' : 'style="text-transform:uppercase"'}>
      </div>
      <div class="input-group">
        <label class="input-label">Líder <span style="color:var(--text-3);font-weight:400">(opcional)</span></label>
        ${supervisores.length
          ? `<select id="eq-f-lider" class="input" style="appearance:auto">
               <option value="">— Nenhum —</option>
               ${supOpts}
             </select>`
          : `<div style="font-size:12px;color:var(--text-3);padding:var(--s2) 0;font-style:italic">
               Nenhum supervisor cadastrado. Cadastre um vendedor com Perfil = Supervisor para selecionar aqui.
             </div>
             <input id="eq-f-lider" class="input" value="${eq.lider||''}" placeholder="Nome do líder" style="display:none">`
        }
      </div>
      <div style="display:flex;gap:var(--s2)">
        <button class="btn btn-secondary" style="flex:1"
          onclick="document.getElementById('eq-form').style.display='none'">Cancelar</button>
        <button class="btn btn-primary" style="flex:1"
          onclick="CadEquipes.salvar()">Salvar</button>
      </div>`;
  },

  async salvar() {
    const nome  = (document.getElementById('eq-f-nome')?.value  || '').trim().toUpperCase();
    const lider = (document.getElementById('eq-f-lider')?.value || '').trim();
    if (!nome) { Utils.toast('Nome é obrigatório', 'error'); return; }
    try {
      await API.salvarEquipe({ nome, lider });
      Utils.toast('Equipe salva!', 'success');
      document.getElementById('eq-form').style.display = 'none';
      // Atualiza lista local sem novo fetch
      const idx = this.dados.findIndex(e => e.nome === nome);
      if (idx >= 0) this.dados[idx] = { nome, lider };
      else { this.dados.push({ nome, lider }); this.dados.sort((a, b) => a.nome.localeCompare(b.nome)); }
      this.renderLista();
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  async salvarLider(nome, lider) {
    const eq = this.dados.find(e => e.nome === nome);
    if (!eq || eq.lider === lider.trim()) return;
    eq.lider = lider.trim();
    try {
      await API.salvarEquipe({ nome, lider: eq.lider });
      Utils.toast('Líder atualizado!', 'success');
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  async adicionarMembro(selectId, nomeEquipe) {
    const sel = document.getElementById(selectId);
    const codigo = sel?.value;
    if (!codigo) { Utils.toast('Selecione um vendedor', 'error'); return; }
    const v = this.vendedores.find(x => x.codigo === codigo);
    if (!v) return;
    const equipeAnterior = v.equipe;
    v.equipe = nomeEquipe;
    try {
      await API.salvarVendedor({ ...v });
      Utils.toast(`${v.apelido||v.nome} adicionado à equipe!`, 'success');
      this.renderLista();
    } catch {
      v.equipe = equipeAnterior; // reverte em caso de erro
      Utils.toast('Erro ao salvar', 'error');
    }
  },

  async removerMembro(codigo, nomeEquipe) {
    const v = this.vendedores.find(x => x.codigo === codigo);
    if (!v) return;
    const equipeAnterior = v.equipe;
    v.equipe = '';
    try {
      await API.salvarVendedor({ ...v });
      Utils.toast(`${v.apelido||v.nome} removido da equipe.`, 'success');
      this.renderLista();
    } catch {
      v.equipe = equipeAnterior;
      Utils.toast('Erro ao salvar', 'error');
    }
  },
};

// ===== CADASTRO DE EVENTOS =====
const CadEventos = {
  eventos: [],
  eventoAtual: null,
  ocs: [],
  planos: [],

  async abrir() {
    const tela = document.getElementById('cadastros-content');
    if (!tela) return;
    tela.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div style="display:flex;align-items:center;gap:var(--s3);padding:var(--s4) var(--s5);border-bottom:1px solid var(--border);flex-shrink:0">
          <button class="btn btn-sm btn-secondary" id="ev-btn-voltar" onclick="Cadastros._voltarMenu()">← Voltar</button>
          <div class="modal-title" id="ev-titulo" style="margin:0">Eventos</div>
          <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="CadEventos.novoEvento()">+ Novo</button>
        </div>

        <!-- LISTA DE EVENTOS -->
        <div id="ev-lista-wrap" style="display:flex;flex-direction:column;flex:1;overflow:hidden;padding:var(--s4) var(--s5)">
          <input type="text" id="ev-busca" class="input" placeholder="Buscar evento..."
            style="margin-bottom:var(--s3)" oninput="CadEventos.renderLista()">
          <div id="ev-lista" class="scroll-area" style="flex:1;padding:0">
            <div class="spinner" style="margin:20px auto"></div>
          </div>
        </div>

        <!-- DETALHE DO EVENTO -->
        <div id="ev-detalhe" style="display:none;flex:1;overflow:hidden;flex-direction:column">
          <div style="padding:var(--s4) var(--s5);border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:var(--s3)">
            <button class="btn btn-sm btn-secondary" onclick="CadEventos.voltarLista()">← Eventos</button>
            <div id="ev-detalhe-titulo" style="font-size:14px;font-weight:700;color:var(--text)"></div>
          </div>
          <div class="scroll-area" style="flex:1;padding:var(--s4) var(--s5)">
            <div id="ev-form"></div>

            <div style="margin-top:var(--s5)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s3)">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Planos</div>
                <div style="display:flex;gap:var(--s2)">
                  <button class="btn btn-sm btn-secondary" onclick="CadEventos.reprocessarCategorias()">↺ Reprocessar</button>
                  <button class="btn btn-sm btn-secondary" onclick="CadEventos.mostrarAddPlano()">+ Adicionar</button>
                </div>
              </div>
              <div id="ev-add-plano" style="display:none;margin-bottom:var(--s3)">
                <textarea id="ev-novo-plano" class="input" rows="4"
                  placeholder="Um plano por linha" style="resize:vertical;font-family:var(--font-mono);font-size:12px"></textarea>
                <div style="display:flex;gap:var(--s2);margin-top:var(--s2)">
                  <button class="btn btn-primary btn-sm" onclick="CadEventos.addPlanos()">Adicionar</button>
                  <button class="btn btn-secondary btn-sm" onclick="document.getElementById('ev-add-plano').style.display='none'">Cancelar</button>
                </div>
              </div>
              <div id="ev-planos-lista"></div>
            </div>

            <div style="margin-top:var(--s5)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s3)">
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">OCs</div>
                <div style="display:flex;gap:var(--s2)">
                  <button class="btn btn-sm btn-secondary" onclick="CadEventos.reprocessarCanais()">↺ Reprocessar</button>
                  <button class="btn btn-sm btn-secondary" onclick="CadEventos.mostrarAddOC()">+ Adicionar</button>
                </div>
              </div>
              <div id="ev-add-oc" style="display:none;margin-bottom:var(--s3)">
                <textarea id="ev-nova-oc" class="input" rows="4"
                  placeholder="Uma OC por linha" style="resize:vertical;font-family:var(--font-mono);font-size:12px"></textarea>
                <div style="display:flex;gap:var(--s2);margin-top:var(--s2)">
                  <button class="btn btn-primary btn-sm" onclick="CadEventos.addOCs()">Adicionar</button>
                  <button class="btn btn-secondary btn-sm" onclick="document.getElementById('ev-add-oc').style.display='none'">Cancelar</button>
                </div>
              </div>
              <div id="ev-ocs-lista"></div>
            </div>
          </div>
        </div>
      </div>`;
    await this.carregar();
  },

  async carregar() {
    const el = document.getElementById('ev-lista');
    el.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const d = await API.getConfig();
      this.eventos = (d.eventos || []).sort((a, b) => a.nome.localeCompare(b.nome));
      this.renderLista();
    } catch { el.innerHTML = '<div class="empty"><div class="empty-title">Erro ao carregar</div></div>'; }
  },

  renderLista() {
    const el = document.getElementById('ev-lista');
    const busca = (document.getElementById('ev-busca')?.value || '').toLowerCase();
    const lista = this.eventos.filter(e =>
      !busca || e.nome.toLowerCase().includes(busca) || (e.cidade||'').toLowerCase().includes(busca)
    );
    el.innerHTML = lista.map(e => `
      <div class="list-item" style="cursor:pointer" onclick="CadEventos.abrirEvento('${e.codigo.replace(/'/g,"\\'")}')">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)" class="truncate">${e.nome}</div>
          <div style="font-size:11px;color:var(--text-3)">${e.cidade||'Virtual'} · ${e.mesAno||'—'}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`).join('') || '<div class="empty"><div class="empty-title">Nenhum evento</div></div>';
  },

  novoEvento() {
    this.eventoAtual = null;
    this.ocs = [];
    this.planos = [];
    document.getElementById('ev-titulo').textContent = 'Novo Evento';
    document.getElementById('ev-lista-wrap').style.display = 'none';
    document.getElementById('ev-detalhe').style.display = 'flex';
    this._renderForm({});
    this._renderPlanos();
    this._renderOCs();
  },

  async abrirEvento(codigo) {
    const ev = this.eventos.find(e => e.codigo === codigo);
    if (!ev) return;
    this.eventoAtual = ev;

    document.getElementById('ev-titulo').textContent = ev.nome;
    document.getElementById('ev-lista-wrap').style.display = 'none';
    document.getElementById('ev-detalhe').style.display = 'flex';
    this._renderForm(ev);
    document.getElementById('ev-planos-lista').innerHTML = '<div class="spinner" style="margin:12px auto"></div>';
    document.getElementById('ev-ocs-lista').innerHTML = '<div class="spinner" style="margin:12px auto"></div>';

    try {
      const d = await API.getOCsEvento(ev.codigo);
      this.planos = d.planos || [];
      this.ocs = d.ocs || [];
      this._renderPlanos();
      this._renderOCs();
    } catch {
      Utils.toast('Erro ao carregar OCs/Planos', 'error');
    }
  },

  voltarLista() {
    document.getElementById('ev-detalhe').style.display = 'none';
    document.getElementById('ev-lista-wrap').style.display = 'flex';
    document.getElementById('ev-titulo').textContent = 'Eventos';
    this.carregar();
  },

  _renderForm(ev) {
    document.getElementById('ev-form').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
        <div class="input-group" style="grid-column:1/-1;margin-bottom:0">
          <label class="input-label">Nome do Evento *</label>
          <input id="ev-nome" class="input" value="${ev.nome||''}" placeholder="Ex: IMLS BH - JAN26">
        </div>
        <div class="input-group" style="margin-bottom:0">
          <label class="input-label">Cidade</label>
          <input id="ev-cidade" class="input" value="${ev.cidade||''}" placeholder="Vazio = Virtual">
        </div>
        <div class="input-group" style="margin-bottom:0">
          <label class="input-label">Capacidade</label>
          <input id="ev-capacidade" class="input" type="number" value="${ev.capacidade||''}" placeholder="Ex: 600">
        </div>
        <div class="input-group" style="margin-bottom:0">
          <label class="input-label">Mês/Ano</label>
          <input id="ev-mesano" class="input" value="${ev.mesAno||''}" placeholder="Ex: ABR26">
        </div>
        <div class="input-group" style="margin-bottom:0">
          <label class="input-label">Início das Vendas</label>
          <input id="ev-dtini" class="input" type="date" value="${ev.dtIniVend||''}">
        </div>
        <div class="input-group" style="margin-bottom:0">
          <label class="input-label">Data do Evento</label>
          <input id="ev-dtevento" class="input" type="date" value="${ev.dtEvento||''}">
        </div>
        <div class="input-group" style="grid-column:1/-1;margin-bottom:0">
          <label class="input-label">Data Fim do Evento</label>
          <input id="ev-dtfim" class="input" type="date" value="${ev.dtFimEv||''}">
        </div>
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:var(--s4)" onclick="CadEventos.salvarEvento()">
        Salvar Evento
      </button>
      <div class="divider"></div>`;
  },

  _renderPlanos() {
    const el = document.getElementById('ev-planos-lista');
    if (!this.planos.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:var(--s2) 0">Nenhum plano cadastrado.</div>';
      return;
    }
    el.innerHTML = this.planos.map(p => `
      <div style="display:flex;align-items:center;gap:var(--s2);padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;font-size:12px;font-family:var(--font-mono);color:var(--text)">${p.plano}</div>
        <span style="font-size:10px;background:var(--blue-dim);color:var(--blue);border-radius:20px;padding:2px 8px">${this._inferirCat(p.plano)}</span>
        <button onclick="CadEventos.removerPlano('${p.plano.replace(/'/g,"\\'")}')"
          style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px;padding:0 4px">×</button>
      </div>`).join('');
  },

  _renderOCs() {
    const el = document.getElementById('ev-ocs-lista');
    if (!this.ocs.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:var(--s2) 0">Nenhuma OC cadastrada.</div>';
      return;
    }
    el.innerHTML = this.ocs.map(o => `
      <div style="display:flex;align-items:center;gap:var(--s2);padding:7px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div style="font-size:12px;font-family:var(--font-mono);color:var(--text);min-width:160px;flex:2">${o.oc}</div>
        <input value="${o.canal||''}" placeholder="Canal"
          class="input" style="flex:1;min-width:100px;padding:5px 8px;font-size:12px"
          onblur="CadEventos.atualizarCanalOC('${o.oc.replace(/'/g,"\\'")}', this.value)">
        <button onclick="CadEventos.removerOC('${o.oc.replace(/'/g,"\\'")}')"
          style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px;padding:0 4px;flex-shrink:0">×</button>
      </div>`).join('');
  },

  async atualizarCanalOC(oc, canal) {
    if (!this.eventoAtual) return;
    const item = this.ocs.find(o => o.oc === oc);
    if (item && item.canal === canal) return;
    if (item) item.canal = canal;
    try {
      await API.salvarOCEvento({ oc, canal, eventoCod: this.eventoAtual.codigo });
      Utils.toast('Canal atualizado!', 'success');
    } catch { Utils.toast('Erro ao atualizar canal', 'error'); }
  },

  _inferirCat(plano) {
    const p = (plano||'').toUpperCase();
    if (p.includes('UPGRADE'))  return 'UPGRADE';
    if (p.includes('VIP') || p.includes('CAT2')) return 'VIP';
    if (p.includes('ESSENTIAL') || p.includes('CAT1')) return 'ESSENTIAL';
    return 'NORMAL';
  },

  mostrarAddPlano() {
    const el = document.getElementById('ev-add-plano');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') document.getElementById('ev-novo-plano').focus();
  },

  mostrarAddOC() {
    const el = document.getElementById('ev-add-oc');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') document.getElementById('ev-nova-oc').focus();
  },

  _parsarCodigos(texto) {
    return texto.split(/[\n,;]+/).map(s => s.trim()).filter(s => s.length > 0);
  },

  async addPlanos() {
    const texto = document.getElementById('ev-novo-plano').value.trim();
    if (!texto) { Utils.toast('Digite ao menos um plano', 'error'); return; }
    if (!this.eventoAtual) { Utils.toast('Salve o evento primeiro', 'error'); return; }
    const planos = this._parsarCodigos(texto);
    if (!planos.length) return;
    try {
      const res = await API.salvarPlanosLote(this.eventoAtual.codigo, planos);
      planos.forEach(p => { if (!this.planos.find(x => x.plano === p)) this.planos.push({ plano: p }); });
      this._renderPlanos();
      document.getElementById('ev-novo-plano').value = '';
      document.getElementById('ev-add-plano').style.display = 'none';
      const msg = res.inseridos + ' adicionado' + (res.inseridos !== 1 ? 's' : '');
      const ign = res.ignorados > 0 ? ` · ${res.ignorados} já existia${res.ignorados !== 1 ? 'm' : ''}` : '';
      Utils.toast(msg + ign, 'success');
    } catch { Utils.toast('Erro ao salvar planos', 'error'); }
  },

  async addOCs() {
    const texto = document.getElementById('ev-nova-oc').value.trim();
    if (!texto) { Utils.toast('Digite ao menos uma OC', 'error'); return; }
    if (!this.eventoAtual) { Utils.toast('Salve o evento primeiro', 'error'); return; }
    const ocs = this._parsarCodigos(texto);
    if (!ocs.length) return;
    try {
      const res = await API.salvarOCsLote(this.eventoAtual.codigo, ocs);
      ocs.forEach(oc => { if (!this.ocs.find(o => o.oc === oc)) this.ocs.push({ oc, canal: '' }); });
      this._renderOCs();
      document.getElementById('ev-nova-oc').value = '';
      document.getElementById('ev-add-oc').style.display = 'none';
      const msg = res.inseridos + ' adicionada' + (res.inseridos !== 1 ? 's' : '');
      const ign = res.ignorados > 0 ? ` · ${res.ignorados} já existia${res.ignorados !== 1 ? 'm' : ''}` : '';
      Utils.toast(msg + ign, 'success');
    } catch { Utils.toast('Erro ao salvar OCs', 'error'); }
  },

  async reprocessarCategorias() {
    if (!this.eventoAtual) return;
    try {
      const res = await API.post('reprocessar_categorias_evento', { eventoCod: this.eventoAtual.codigo });
      Utils.toast(`${res.atualizados} plano${res.atualizados !== 1 ? 's' : ''} atualizado${res.atualizados !== 1 ? 's' : ''}!`, 'success');
    } catch { Utils.toast('Erro ao reprocessar', 'error'); }
  },

  async reprocessarCanais() {
    if (!this.eventoAtual) return;
    try {
      const res = await API.post('reprocessar_canais_evento', { eventoCod: this.eventoAtual.codigo });
      // Recarrega OCs com canais atualizados
      const d = await API.getOCsEvento(this.eventoAtual.codigo);
      this.ocs = d.ocs || [];
      this._renderOCs();
      Utils.toast(`${res.atualizados} OC${res.atualizados !== 1 ? 's' : ''} atualizada${res.atualizados !== 1 ? 's' : ''}!`, 'success');
    } catch { Utils.toast('Erro ao reprocessar', 'error'); }
  },

  async removerPlano(plano) {
    if (!this.eventoAtual) return;
    try {
      await API.deletarPlanoEvento(plano, this.eventoAtual.codigo);
      this.planos = this.planos.filter(p => p.plano !== plano);
      this._renderPlanos();
      Utils.toast('Removido', 'success');
    } catch { Utils.toast('Erro ao remover', 'error'); }
  },

  async removerOC(oc) {
    if (!this.eventoAtual) return;
    try {
      await API.deletarOCEvento(oc, this.eventoAtual.codigo);
      this.ocs = this.ocs.filter(o => o.oc !== oc);
      this._renderOCs();
      Utils.toast('Removido', 'success');
    } catch { Utils.toast('Erro ao remover', 'error'); }
  },

  async salvarEvento() {
    const dados = {
      nome:       document.getElementById('ev-nome').value.trim(),
      cidade:     document.getElementById('ev-cidade').value.trim(),
      capacidade: document.getElementById('ev-capacidade').value.trim(),
      mesAno:     document.getElementById('ev-mesano').value.trim(),
      dtIniVend:  document.getElementById('ev-dtini').value,
      dtEvento:   document.getElementById('ev-dtevento').value,
      dtFimEv:    document.getElementById('ev-dtfim').value,
      produto:    'IGR',
    };
    if (!dados.nome) { Utils.toast('Nome é obrigatório', 'error'); return; }
    try {
      await API.salvarEvento(dados);
      this.eventoAtual = { ...dados, codigo: dados.nome };
      Utils.toast('Evento salvo!', 'success');
      const idx = this.eventos.findIndex(e => e.codigo === dados.nome);
      if (idx >= 0) this.eventos[idx] = { ...this.eventos[idx], ...dados, codigo: dados.nome };
      else this.eventos.push({ ...dados, codigo: dados.nome });
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },
};

// ===== CADASTRO DE CALENDÁRIO =====
const CadCalendario = {
  async abrir() {
    Utils.toast('Em breve: Cadastro de Calendário', '');
  }
};

// ===== REGRAS DE CANAL =====
const CadCanais = {
  regras: [],

  async abrir() {
    const tela = document.getElementById('cadastros-content');
    if (!tela) return;
    tela.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div style="display:flex;align-items:center;gap:var(--s3);padding:var(--s4) var(--s5);border-bottom:1px solid var(--border);flex-shrink:0">
          <button class="btn btn-sm btn-secondary" onclick="Cadastros._voltarMenu()">← Voltar</button>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Regras de Canal</div>
        </div>
        <div class="scroll-area" style="flex:1;padding:var(--s4) var(--s5)">
          <div style="font-size:12px;color:var(--text-3);margin-bottom:var(--s4)">
            Define como o canal é inferido automaticamente pelo código da OC.
          </div>
          <div class="card card-sm" style="margin-bottom:var(--s4)">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s3)">Nova Regra</div>
            <div style="display:flex;gap:var(--s2);flex-wrap:wrap;margin-bottom:var(--s3)">
              <input id="rc-padrao" class="input" placeholder="Padrão (ex: _TF_ ou HOTMART)" style="flex:2;min-width:120px">
              <select id="rc-tipo" class="input select" style="flex:1;min-width:110px">
                <option value="igual_a">Igual a</option>
                <option value="contem">Contém</option>
                <option value="comeca_com">Começa com</option>
                <option value="termina_com">Termina com</option>
              </select>
              <select id="rc-fonte" class="input select" style="flex:1;min-width:90px">
                <option value="OC">na OC</option>
                <option value="PLANO">no Plano</option>
              </select>
              <input id="rc-canal" class="input" placeholder="Sub-canal" list="rc-canais-list" style="flex:2;min-width:120px" autocomplete="off">
              <datalist id="rc-canais-list"></datalist>
              <select id="rc-canal-macro" class="input select" style="flex:1;min-width:110px">
                <option value="">Canal Macro *</option>
                <option value="VA">VA - Venda Ativa</option>
                <option value="VD">VD - Venda Direta</option>
                <option value="RC">RC - Venda Recuperação</option>
                <option value="GT">GT - Gratuito</option>
              </select>
              <button class="btn btn-secondary btn-sm" onclick="CadCanais.adicionarRascunho()" style="flex-shrink:0">+ Adicionar</button>
            </div>
            <div id="rc-rascunho" style="display:none;margin-bottom:var(--s3)">
              <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s2)">Pendentes de salvar:</div>
              <div id="rc-rascunho-lista"></div>
              <button class="btn btn-primary btn-full" style="margin-top:var(--s3)" onclick="CadCanais.salvarRascunho()">Salvar Todas na Planilha</button>
            </div>
          </div>
          <div id="rc-lista"><div class="spinner" style="margin:20px auto"></div></div>
        </div>
      </div>`;
    await this.carregar();
  },

  async carregar() {
    const el = document.getElementById('rc-lista');
    el.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const d = await API.getRegrасCanal();
      this.regras = d.regras || [];

      const canaisSet = new Set();
      this.regras.forEach(r => canaisSet.add(r.canal));
      const dl = document.getElementById('rc-canais-list');
      if (dl) dl.innerHTML = [...canaisSet].sort().map(c => `<option value="${c}">`).join('');

      this.renderLista();
    } catch { el.innerHTML = '<div class="empty"><div class="empty-title">Erro ao carregar</div></div>'; }
  },

  renderLista() {
    const el = document.getElementById('rc-lista');
    if (!this.regras.length) {
      el.innerHTML = '<div class="empty"><div class="empty-title">Nenhuma regra cadastrada</div></div>';
      return;
    }

    const porCanal = {};
    this.regras.forEach(r => {
      if (!porCanal[r.canal]) porCanal[r.canal] = [];
      porCanal[r.canal].push(r);
    });

    const tipoLabel  = { igual_a: 'igual a', contem: 'contém', comeca_com: 'começa com', termina_com: 'termina com' };
    const macroColor = { VA: 'var(--accent)', VD: 'var(--blue)', RC: 'var(--green)', GT: 'var(--text-3)' };
    const canaisSet  = new Set(this.regras.map(r => r.canal));

    el.innerHTML = Object.keys(porCanal).sort().map(canal => `
      <div class="card card-sm" style="margin-bottom:var(--s3)">
        <div style="display:flex;align-items:center;gap:var(--s2);margin-bottom:var(--s3)">
          <div style="font-size:12px;font-weight:600;color:var(--accent)">${canal}</div>
          ${porCanal[canal][0].canalMacro ? `<span style="font-size:10px;padding:1px 8px;border-radius:20px;background:var(--bg-3);color:${macroColor[porCanal[canal][0].canalMacro]||'var(--text-3)'};border:1px solid currentColor">${porCanal[canal][0].canalMacro}</span>` : ''}
        </div>
        ${porCanal[canal].map(r => {
          const rid = btoa(r.padrao + '|' + r.tipo).replace(/[+=\/]/g,'_');
          const fonteLabel = r.fonte === 'PLANO' ? '📋 Plano' : '🔗 OC';
          const fonteCor   = r.fonte === 'PLANO' ? 'var(--blue)' : 'var(--text-3)';
          return `
          <div id="regra-${rid}" style="padding:6px 0;border-bottom:1px solid var(--border)">
            <div id="view-${rid}" style="display:flex;align-items:center;gap:var(--s2)">
              <span style="font-size:10px;color:${fonteCor};min-width:52px">${fonteLabel}</span>
              <span style="font-size:11px;color:var(--text-3);min-width:60px">${tipoLabel[r.tipo]||r.tipo}</span>
              <span style="font-family:var(--font-mono);font-size:12px;color:var(--text);flex:1">${r.padrao}</span>
              <button onclick="CadCanais.editarModo('${rid}')"
                style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:13px;padding:0 4px">✏️</button>
              <button onclick="CadCanais.remover('${r.padrao.replace(/'/g,"\\'")}','${r.tipo}')"
                style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px;padding:0 4px">×</button>
            </div>
            <div id="edit-${rid}" style="display:none;flex-wrap:wrap;gap:var(--s2);padding-top:var(--s2)">
              <input id="ep-${rid}" class="input" value="${r.padrao}"
                style="flex:2;min-width:100px;padding:5px 8px;font-size:12px">
              <select id="et-${rid}" class="input select" style="flex:1;min-width:100px;font-size:12px;padding:5px 8px">
                <option value="igual_a" ${r.tipo==='igual_a'?'selected':''}>Igual a</option>
                <option value="contem" ${r.tipo==='contem'?'selected':''}>Contém</option>
                <option value="comeca_com" ${r.tipo==='comeca_com'?'selected':''}>Começa com</option>
                <option value="termina_com" ${r.tipo==='termina_com'?'selected':''}>Termina com</option>
              </select>
              <select id="ef-${rid}" class="input select" style="flex:1;min-width:80px;font-size:12px;padding:5px 8px">
                <option value="OC"    ${(r.fonte||'OC')==='OC'   ?'selected':''}>na OC</option>
                <option value="PLANO" ${r.fonte==='PLANO'?'selected':''}>no Plano</option>
              </select>
              <input id="ec-${rid}" class="input" value="${r.canal}" list="rc-canais-list"
                style="flex:2;min-width:100px;padding:5px 8px;font-size:12px" autocomplete="off">
              <select id="em-${rid}" class="input select" style="flex:1;min-width:90px;font-size:12px;padding:5px 8px">
                <option value="" ${!r.canalMacro?'selected':''}>Macro</option>
                <option value="VA" ${r.canalMacro==='VA'?'selected':''}>VA</option>
                <option value="VD" ${r.canalMacro==='VD'?'selected':''}>VD</option>
                <option value="RC" ${r.canalMacro==='RC'?'selected':''}>RC</option>
                <option value="GT" ${r.canalMacro==='GT'?'selected':''}>GT</option>
              </select>
              <button class="btn btn-primary btn-sm"
                onclick="CadCanais.salvarEdicao('${rid}','${r.padrao.replace(/'/g,"\\'")}','${r.tipo}')">Salvar</button>
              <button class="btn btn-secondary btn-sm"
                onclick="CadCanais.editarModo('${rid}',true)">Cancelar</button>
            </div>
          </div>`;
        }).join('')}
      </div>`).join('');
  },

  editarModo(rid, cancelar = false) {
    document.getElementById('view-' + rid).style.display = cancelar ? 'flex' : 'none';
    document.getElementById('edit-' + rid).style.display = cancelar ? 'none' : 'flex';
  },

  async salvarEdicao(rid, padraoOrig, tipoOrig) {
    const novoPadrao     = document.getElementById('ep-' + rid)?.value.trim();
    const novoTipo       = document.getElementById('et-' + rid)?.value;
    const novaFonte      = document.getElementById('ef-' + rid)?.value || 'OC';
    const novoCanal      = document.getElementById('ec-' + rid)?.value.trim().toUpperCase();
    const novoCanalMacro = document.getElementById('em-' + rid)?.value || '';
    if (!novoPadrao || !novoCanal) { Utils.toast('Preencha todos os campos', 'error'); return; }
    try {
      await API.deletarRegraCanal(padraoOrig, tipoOrig);
      await API.salvarRegraCanal({ padrao: novoPadrao, tipo: novoTipo, fonte: novaFonte, canal: novoCanal, canalMacro: novoCanalMacro });
      const idx = this.regras.findIndex(r => r.padrao === padraoOrig && r.tipo === tipoOrig);
      if (idx >= 0) this.regras[idx] = { padrao: novoPadrao, tipo: novoTipo, fonte: novaFonte, canal: novoCanal, canalMacro: novoCanalMacro };
      this.renderLista();
      Utils.toast('Regra atualizada!', 'success');
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  _rascunho: [],

  adicionarRascunho() {
    const padrao     = document.getElementById('rc-padrao').value.trim();
    const tipo       = document.getElementById('rc-tipo').value;
    const fonte      = document.getElementById('rc-fonte').value || 'OC';
    const canal      = document.getElementById('rc-canal').value.trim().toUpperCase();
    const canalMacro = document.getElementById('rc-canal-macro').value;
    if (!padrao || !canal) { Utils.toast('Preencha padrão e sub-canal', 'error'); return; }
    if (!canalMacro) { Utils.toast('Selecione o Canal Macro', 'error'); return; }

    this._rascunho.push({ padrao, tipo, fonte, canal, canalMacro });
    this._renderRascunho();
    document.getElementById('rc-padrao').value = '';
    document.getElementById('rc-canal').value  = '';
  },

  _renderRascunho() {
    const wrap = document.getElementById('rc-rascunho');
    const lista = document.getElementById('rc-rascunho-lista');
    if (!this._rascunho.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const tipoLabel = { igual_a: 'igual a', contem: 'contém', comeca_com: 'começa com', termina_com: 'termina com' };
    lista.innerHTML = this._rascunho.map((r, i) => `
      <div style="display:flex;align-items:center;gap:var(--s2);padding:5px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:10px;color:var(--text-3);min-width:55px">${tipoLabel[r.tipo]}</span>
        <span style="font-size:10px;background:var(--bg-3);color:var(--text-3);padding:1px 5px;border-radius:10px">${r.fonte}</span>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--text);flex:1">${r.padrao}</span>
        <span style="font-size:11px;color:var(--accent)">${r.canal}</span>
        <span style="font-size:10px;background:var(--bg-3);color:var(--text-3);padding:1px 6px;border-radius:10px">${r.canalMacro}</span>
        <button onclick="CadCanais._removerRascunho(${i})"
          style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:14px;padding:0 2px">×</button>
      </div>`).join('');
  },

  _removerRascunho(i) {
    this._rascunho.splice(i, 1);
    this._renderRascunho();
  },

  async salvarRascunho() {
    if (!this._rascunho.length) return;
    const total = this._rascunho.length;
    try {
      for (const r of this._rascunho) {
        await API.salvarRegraCanal(r);
        if (!this.regras.find(x => x.padrao === r.padrao && x.tipo === r.tipo)) {
          this.regras.push(r);
        }
      }
      this._rascunho = [];
      this._renderRascunho();
      this.renderLista();
      Utils.toast(`${total} regra${total > 1 ? 's' : ''} salva${total > 1 ? 's' : ''}!`, 'success');
    } catch { Utils.toast('Erro ao salvar', 'error'); }
  },

  async remover(padrao, tipo) {
    try {
      await API.deletarRegraCanal(padrao, tipo);
      this.regras = this.regras.filter(r => !(r.padrao === padrao && r.tipo === tipo));
      this.renderLista();
      Utils.toast('Removida!', 'success');
    } catch { Utils.toast('Erro ao remover', 'error'); }
  }
};

// ===== OCs / PLANOS — OPERAÇÕES EM MASSA =====
const CadOCs = {
  async abrir() {
    const tela = document.getElementById('cadastros-content');
    if (!tela) return;
    tela.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div style="display:flex;align-items:center;gap:var(--s3);padding:var(--s4) var(--s5);border-bottom:1px solid var(--border);flex-shrink:0">
          <button class="btn btn-sm btn-secondary" onclick="Cadastros._voltarMenu()">← Voltar</button>
          <div style="font-size:16px;font-weight:700;color:var(--text)">OCs & Planos</div>
          <div style="display:flex;gap:var(--s2);margin-left:auto">
            <button class="btn btn-sm btn-secondary" onclick="CadOCs.abrirVincular()">🔗 Vincular</button>
            <button class="btn btn-sm btn-secondary" onclick="CadOCs.abrirRevisao()">🔍 Revisar OCs</button>
          </div>
        </div>
        <div class="scroll-area" style="flex:1;padding:var(--s4) var(--s5)">
          <div style="font-size:12px;color:var(--text-3);margin-bottom:var(--s4)">
            Operações em massa para todos os eventos. Use com cautela — atualiza a planilha inteira.
          </div>

          <div class="card card-sm" style="margin-bottom:var(--s3);border-color:var(--accent)">
            <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:var(--s2)">⚡ Reprocessar Tudo</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:var(--s4)">
              Atualiza Canal, Canal Macro, Categoria, Evento, Pontos, Semana e Mês em todas as vendas de uma só vez.
            </div>
            <button class="btn btn-primary btn-full" id="btn-rep-tudo" onclick="CadOCs.reprocessarTudo()">⚡ Reprocessar Tudo</button>
            <div id="res-tudo" style="margin-top:var(--s3);font-size:12px;color:var(--text-3)"></div>
          </div>

          <div class="card card-sm" style="margin-bottom:var(--s3)">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:var(--s2)">↺ Reprocessar OCs & Planos</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:var(--s4)">
              Atualiza Canal, Categoria e Canal Macro na aba OCS_PLANOS com base nas regras de canal.
            </div>
            <button class="btn btn-primary btn-full" id="btn-rep-ocs" onclick="CadOCs.reprocessarOCsPlanos()">↺ Reprocessar OCs & Planos</button>
            <div id="res-ocs" style="margin-top:var(--s3);font-size:12px;color:var(--text-3)"></div>
          </div>

          <div class="card card-sm" style="margin-bottom:var(--s3);border-color:#e85d5d">
            <div style="font-size:13px;font-weight:600;color:#e85d5d;margin-bottom:var(--s2)">🧹 Remover Duplicatas</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:var(--s4)">
              Remove vendas com ID duplicado, mantendo somente a primeira ocorrência de cada venda.
            </div>
            <button class="btn btn-full" id="btn-rem-dup" style="background:#e85d5d;color:#fff;border:none" onclick="CadOCs.removerDuplicatas()">
              🧹 Remover Duplicatas
            </button>
            <div id="res-dup" style="margin-top:var(--s3);font-size:12px;color:var(--text-3)"></div>
          </div>
        </div>
      </div>`;
  },

  async reprocessarOCsPlanos() {
    const btn    = document.getElementById('btn-rep-ocs');
    const res_el = document.getElementById('res-ocs');
    Utils.btnLoading(btn, true);
    res_el.textContent = 'Processando...';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
      const raw = await fetch('/api/reprocessar_ocs_planos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: controller.signal,
      });
      clearTimeout(timer);
      const res = await raw.json();
      if (res.erro) throw new Error(res.erro);
      res_el.innerHTML = `<span style="color:var(--green)">✓ ${res.atualizados} OCs & Planos atualizados!</span>`;
    } catch(e) {
      res_el.innerHTML = `<span style="color:var(--red)">Erro: ${e.message}</span>`;
    }
    Utils.btnLoading(btn, false);
  },

  async abrirVincular() {
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-vincular-ocs';
    m.innerHTML = `
      <div class="modal" style="max-height:95vh;display:flex;flex-direction:column;max-width:800px;width:100%">
        <div class="modal-handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s3);flex-shrink:0">
          <div class="modal-title">🔗 Vincular OCs & Planos a Eventos</div>
          <button class="btn btn-sm btn-secondary" onclick="document.getElementById('modal-vincular-ocs').remove()">✕</button>
        </div>
        <div style="display:flex;gap:var(--s2);margin-bottom:var(--s3);flex-shrink:0;border-bottom:1px solid var(--border);padding-bottom:var(--s2)">
          <button id="tab-ocs-btn" class="tab active" onclick="CadOCs._mudarAbaVincular('ocs')">OCs sem cadastro</button>
          <button id="tab-planos-btn" class="tab" onclick="CadOCs._mudarAbaVincular('planos')">Planos sem cadastro</button>
        </div>
        <div id="vincular-acoes" style="display:none;align-items:center;gap:var(--s2);margin-bottom:var(--s3);
          padding:var(--s3);background:var(--accent-dim);border-radius:var(--r2);flex-shrink:0">
          <span id="vincular-sel-count" style="font-size:12px;color:var(--accent);font-weight:600"></span>
          <span style="font-size:12px;color:var(--text-3)">selecionadas — Vincular ao evento:</span>
          <select id="vincular-destino" class="input select" style="flex:1;min-width:160px">
            <option value="">Selecione o evento...</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="CadOCs._vincularSelecionados(this)">Vincular</button>
          <button class="btn btn-sm btn-secondary" onclick="CadOCs._limparSelecaoVincular()">✕</button>
        </div>
        <div id="vincular-busca-wrap" style="margin-bottom:var(--s3);flex-shrink:0">
          <input id="vincular-busca" type="text" class="input" placeholder="Buscar..." oninput="CadOCs._renderVincular()">
        </div>
        <div id="vincular-lista" style="overflow-y:auto;flex:1">
          <div class="spinner" style="margin:40px auto"></div>
        </div>
      </div>`;
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
    this._abaVincular = 'ocs';
    this._selVincular = new Set();
    this._dadosVincular = null;
    await this._carregarVincular();
  },

  _mudarAbaVincular(aba) {
    this._abaVincular = aba;
    this._selVincular = new Set();
    document.getElementById('tab-ocs-btn')?.classList.toggle('active', aba === 'ocs');
    document.getElementById('tab-planos-btn')?.classList.toggle('active', aba === 'planos');
    this._atualizarAcoesVincular();
    this._renderVincular();
  },

  async _carregarVincular() {
    try {
      const d = await API.get('listar_sem_cadastro');
      this._dadosVincular = d;
      const opts = (d.eventos || []).map(e => `<option value="${e.codigo}">${e.nome}</option>`).join('');
      const sel  = document.getElementById('vincular-destino');
      if (sel) sel.innerHTML = '<option value="">Selecione o evento...</option>' + opts;
      this._renderVincular();
    } catch(e) {
      const el = document.getElementById('vincular-lista');
      if (el) el.innerHTML = `<div class="empty"><div class="empty-title">Erro: ${e.message}</div></div>`;
    }
  },

  _renderVincular() {
    const el = document.getElementById('vincular-lista');
    if (!el || !this._dadosVincular) return;
    const busca = (document.getElementById('vincular-busca')?.value || '').toLowerCase();
    const aba   = this._abaVincular;
    const itens = (aba === 'ocs' ? this._dadosVincular.ocs : this._dadosVincular.planos) || [];
    const campo = aba === 'ocs' ? 'oc' : 'plano';
    const filtrados = busca ? itens.filter(i => i[campo].toLowerCase().includes(busca)) : itens;

    if (!filtrados.length) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">✓</div>
        <div class="empty-title">Nenhum ${aba === 'ocs' ? 'OC' : 'Plano'} sem cadastro!</div></div>`;
      return;
    }

    const todosSelected = filtrados.every(i => this._selVincular.has(i[campo]));
    el.innerHTML = `
      <div style="padding:6px 10px;background:var(--bg-3);border-radius:var(--r2);margin-bottom:var(--s2);display:flex;align-items:center;gap:8px">
        <input type="checkbox" ${todosSelected?'checked':''} style="accent-color:var(--accent);width:14px;height:14px"
          onchange="CadOCs._toggleTodosVincular(this.checked)">
        <span style="font-size:11px;color:var(--text-3)">Selecionar todos (${filtrados.length})</span>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
        <div style="display:grid;grid-template-columns:28px 1fr 120px 60px;gap:6px;
          padding:6px 10px;background:var(--bg-3);border-bottom:1px solid var(--border)">
          <div></div>
          <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:600">${aba === 'ocs' ? 'OC' : 'Plano'}</div>
          <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:600">Evento sugerido</div>
          <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:600">Vendas</div>
        </div>
        ${filtrados.map(i => {
          const val = i[campo];
          const sel = this._selVincular.has(val);
          return `<div style="display:grid;grid-template-columns:28px 1fr 120px 60px;gap:6px;
            align-items:center;padding:7px 10px;border-bottom:1px solid var(--border);background:${sel?'var(--accent-dim)':''}">
            <input type="checkbox" ${sel?'checked':''} style="accent-color:var(--accent);width:14px;height:14px"
              onchange="CadOCs._toggleSelVincular('${val.replace(/'/g,"\'")}',this.checked)">
            <div style="font-size:11px;color:var(--text);word-break:break-all">${val}</div>
            <div style="font-size:10px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.eventoSugerido||'—'}</div>
            <div style="font-size:11px;color:var(--accent);font-weight:600;text-align:center">${i.count}</div>
          </div>`;
        }).join('')}
      </div>`;
  },

  _toggleSelVincular(val, checked) {
    if (checked) this._selVincular.add(val);
    else this._selVincular.delete(val);
    this._atualizarAcoesVincular();
  },

  _toggleTodosVincular(checked) {
    const aba   = this._abaVincular;
    const itens = (aba === 'ocs' ? this._dadosVincular?.ocs : this._dadosVincular?.planos) || [];
    const campo = aba === 'ocs' ? 'oc' : 'plano';
    const busca = (document.getElementById('vincular-busca')?.value || '').toLowerCase();
    const filtrados = busca ? itens.filter(i => i[campo].toLowerCase().includes(busca)) : itens;
    filtrados.forEach(i => { if (checked) this._selVincular.add(i[campo]); else this._selVincular.delete(i[campo]); });
    this._atualizarAcoesVincular();
    this._renderVincular();
  },

  _limparSelecaoVincular() {
    this._selVincular = new Set();
    this._atualizarAcoesVincular();
    this._renderVincular();
  },

  _atualizarAcoesVincular() {
    const el = document.getElementById('vincular-acoes');
    const ct = document.getElementById('vincular-sel-count');
    if (!el) return;
    const n = this._selVincular.size;
    el.style.display = n > 0 ? 'flex' : 'none';
    if (ct) ct.textContent = `${n} ${this._abaVincular === 'ocs' ? 'OC' : 'Plano'}${n !== 1 ? 's' : ''}`;
  },

  async _vincularSelecionados(btn) {
    const destino = document.getElementById('vincular-destino')?.value;
    if (!destino) { Utils.toast('Selecione o evento de destino', 'error'); return; }
    if (!this._selVincular.size) return;
    const aba    = this._abaVincular;
    const rota   = aba === 'ocs' ? 'salvar_ocs_lote' : 'salvar_planos_lote';
    const campo  = aba === 'ocs' ? 'ocs' : 'planos';
    const chave  = aba === 'ocs' ? 'oc' : 'plano';
    const nomeEv = document.getElementById('vincular-destino')?.selectedOptions[0]?.text || destino;
    Utils.btnLoading(btn, true);
    try {
      const res = await API.post(rota, { eventoCod: destino, [campo]: [...this._selVincular] });
      if (res.erro) throw new Error(res.erro);
      Utils.toast(`✓ ${res.inseridos} vinculado${res.inseridos !== 1?'s':''} ao evento ${nomeEv}!`, 'success');
      if (aba === 'ocs') this._dadosVincular.ocs = this._dadosVincular.ocs.filter(i => !this._selVincular.has(i[chave]));
      else this._dadosVincular.planos = this._dadosVincular.planos.filter(i => !this._selVincular.has(i[chave]));
      this._selVincular = new Set();
      this._atualizarAcoesVincular();
      this._renderVincular();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
    Utils.btnLoading(btn, false);
  },

  async abrirRevisao() {
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-revisao-ocs';
    m.innerHTML = `
      <div class="modal" style="max-height:95vh;display:flex;flex-direction:column;max-width:800px;width:100%">
        <div class="modal-handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s3);flex-shrink:0">
          <div class="modal-title">🔍 Revisar OCs & Planos</div>
          <button class="btn btn-sm btn-secondary" onclick="document.getElementById('modal-revisao-ocs').remove()">✕</button>
        </div>
        <div id="revisao-filtros" style="display:flex;gap:var(--s2);margin-bottom:var(--s3);flex-shrink:0;flex-wrap:wrap">
          <input id="revisao-busca" type="text" class="input" placeholder="Buscar OC ou Plano..." style="flex:1;min-width:180px" oninput="CadOCs._renderRevisao()">
          <select id="revisao-evento" class="input select" style="min-width:180px" onchange="CadOCs._renderRevisao()">
            <option value="">Todos os eventos</option>
          </select>
        </div>
        <div id="revisao-acoes" style="display:none;align-items:center;gap:var(--s2);margin-bottom:var(--s3);
          padding:var(--s3);background:var(--accent-dim);border-radius:var(--r2);flex-shrink:0">
          <span id="revisao-sel-count" style="font-size:12px;color:var(--accent);font-weight:600"></span>
          <span style="font-size:12px;color:var(--text-3)">selecionadas — Mover para:</span>
          <select id="revisao-destino" class="input select" style="flex:1;min-width:160px">
            <option value="">Selecione o evento...</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="CadOCs._moverSelecionadas(this)">Mover</button>
          <button class="btn btn-sm btn-secondary" onclick="CadOCs._limparSelecao()">✕</button>
        </div>
        <div id="revisao-lista" style="overflow-y:auto;flex:1">
          <div class="spinner" style="margin:40px auto"></div>
        </div>
      </div>`;
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
    await this._carregarRevisao();
  },

  async _carregarRevisao() {
    try {
      const d = await API.get('listar_ocs_planos');
      this._grupos  = d.grupos  || [];
      this._eventos = d.eventos || [];
      this._selecionados = new Set();
      const optsEvento = this._eventos.map(e => `<option value="${e.codigo}">${e.nome}</option>`).join('');
      const selFiltro  = document.getElementById('revisao-evento');
      const selDestino = document.getElementById('revisao-destino');
      if (selFiltro)  selFiltro.innerHTML  = '<option value="">Todos os eventos</option>' + optsEvento;
      if (selDestino) selDestino.innerHTML = '<option value="">Selecione o evento...</option>' + optsEvento;
      this._renderRevisao();
    } catch(e) {
      const el = document.getElementById('revisao-lista');
      if (el) el.innerHTML = `<div class="empty"><div class="empty-title">Erro: ${e.message}</div></div>`;
    }
  },

  _renderRevisao() {
    const el     = document.getElementById('revisao-lista');
    if (!el) return;
    const busca  = (document.getElementById('revisao-busca')?.value || '').toLowerCase();
    const evFilt = document.getElementById('revisao-evento')?.value || '';
    let grupos = this._grupos || [];
    if (evFilt) grupos = grupos.filter(g => g.eventoCod === evFilt);
    const html = grupos.map(g => {
      const itens = g.itens.filter(i => !busca || i.oc.toLowerCase().includes(busca) || (i.plano||'').toLowerCase().includes(busca));
      if (!itens.length) return '';
      const linhas = itens.map(i => {
        const key = i.oc;
        const sel = this._selecionados?.has(key);
        return `<div style="display:grid;grid-template-columns:28px 1fr 1fr 80px 50px;gap:6px;
          align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);background:${sel?'var(--accent-dim)':''}">
          <input type="checkbox" ${sel?'checked':''} style="accent-color:var(--accent);width:14px;height:14px"
            onchange="CadOCs._toggleSelecao('${key.replace(/'/g,"\'")}',this.checked)">
          <div style="font-size:11px;color:var(--text);word-break:break-all">${i.oc}</div>
          <div style="font-size:10px;color:var(--text-3);word-break:break-all">${i.plano||'—'}</div>
          <div style="font-size:10px;color:var(--text-3)">${i.canal||'—'}</div>
          <div style="font-size:10px;font-weight:600;color:var(--accent)">${i.canalMacro||'—'}</div>
        </div>`;
      }).join('');
      if (!linhas) return '';
      return `<div style="margin-bottom:var(--s3)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;
          background:var(--bg-3);border-radius:var(--r2) var(--r2) 0 0;border:1px solid var(--border);border-bottom:none">
          <div><span style="font-size:12px;font-weight:700;color:var(--text)">${g.eventoNome}</span>
            <span style="font-size:10px;color:var(--text-3);margin-left:8px">${itens.length} OCs</span></div>
          <button onclick="CadOCs._selecionarGrupo('${g.eventoCod}',this)"
            style="font-size:10px;color:var(--accent);background:none;border:none;cursor:pointer">Selecionar todas</button>
        </div>
        <div style="border:1px solid var(--border);border-radius:0 0 var(--r2) var(--r2);overflow:hidden">
          <div style="display:grid;grid-template-columns:28px 1fr 1fr 80px 50px;gap:6px;
            padding:5px 10px;background:var(--bg-3);border-bottom:1px solid var(--border)">
            <div></div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:600">OC</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:600">Plano</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:600">Canal</div>
            <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:600">Macro</div>
          </div>
          ${linhas}
        </div>
      </div>`;
    }).join('');
    el.innerHTML = html || '<div class="empty"><div class="empty-title">Nenhuma OC encontrada</div></div>';
  },

  _toggleSelecao(oc, checked) {
    if (!this._selecionados) this._selecionados = new Set();
    if (checked) this._selecionados.add(oc); else this._selecionados.delete(oc);
    this._atualizarAcoesRevisao();
  },

  _selecionarGrupo(eventoCod, btn) {
    const grupo = this._grupos?.find(g => g.eventoCod === eventoCod);
    if (!grupo) return;
    if (!this._selecionados) this._selecionados = new Set();
    const todasSel = grupo.itens.every(i => this._selecionados.has(i.oc));
    grupo.itens.forEach(i => { if (todasSel) this._selecionados.delete(i.oc); else this._selecionados.add(i.oc); });
    btn.textContent = todasSel ? 'Selecionar todas' : 'Desmarcar todas';
    this._renderRevisao(); this._atualizarAcoesRevisao();
  },

  _limparSelecao() {
    this._selecionados = new Set();
    this._renderRevisao(); this._atualizarAcoesRevisao();
  },

  _atualizarAcoesRevisao() {
    const el = document.getElementById('revisao-acoes');
    const ct = document.getElementById('revisao-sel-count');
    if (!el) return;
    const n = this._selecionados?.size || 0;
    el.style.display = n > 0 ? 'flex' : 'none';
    if (ct) ct.textContent = `${n} OC${n !== 1 ? 's' : ''}`;
  },

  async _moverSelecionadas(btn) {
    const destino = document.getElementById('revisao-destino')?.value;
    if (!destino) { Utils.toast('Selecione o evento de destino', 'error'); return; }
    if (!this._selecionados?.size) return;
    const nomeEv = document.getElementById('revisao-destino')?.selectedOptions[0]?.text || destino;
    if (!confirm(`Mover ${this._selecionados.size} OC(s) para "${nomeEv}"?`)) return;
    Utils.btnLoading(btn, true);
    try {
      const res = await API.post('mover_ocs_evento', { ocs: [...this._selecionados], novoEventoCod: destino });
      if (res.erro) throw new Error(res.erro);
      Utils.toast(`✓ ${res.atualizadas} OC(s) movidas!`, 'success');
      this._selecionados = new Set();
      await this._carregarRevisao();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
    Utils.btnLoading(btn, false);
  },

  async removerDuplicatas() {
    const btn    = document.getElementById('btn-rem-dup');
    const res_el = document.getElementById('res-dup');
    if (!confirm('Isso vai apagar vendas duplicadas permanentemente. Confirma?')) return;
    Utils.btnLoading(btn, true);
    res_el.textContent = 'Processando...';
    try {
      const res = await API.post('remover_duplicatas', {});
      res_el.innerHTML = `<span style="color:var(--green)">✓ ${res.removidas} linha${res.removidas !== 1 ? 's' : ''} removida${res.removidas !== 1 ? 's' : ''}!</span>`;
    } catch {
      res_el.innerHTML = `<span style="color:#e85d5d">Erro ao remover</span>`;
    }
    Utils.btnLoading(btn, false);
  },

  async reprocessarTudo() {
    const btn = document.getElementById('btn-rep-tudo');
    const res_el = document.getElementById('res-tudo');
    Utils.btnLoading(btn, true);
    res_el.textContent = 'Processando... pode demorar alguns segundos.';
    try {
      const res = await API.post('reprocessar_tudo', {});
      res_el.innerHTML = `<span style="color:var(--green)">✓ ${res.atualizados} vendas atualizadas!</span>`;
    } catch {
      res_el.innerHTML = `<span style="color:var(--red)">Erro ao reprocessar</span>`;
    }
    Utils.btnLoading(btn, false);
  },

  async reprocessarCanais() {
    const btn = document.getElementById('btn-rep-canais');
    const res_el = document.getElementById('res-canais');
    Utils.btnLoading(btn, true);
    res_el.textContent = 'Processando... pode demorar alguns segundos.';
    try {
      const res = await API.reprocessarTodosCanais();
      res_el.innerHTML = `<span style="color:var(--green)">✓ ${res.atualizadosOCS} OCs e ${res.atualizadosVendas} vendas atualizadas!</span>`;
    } catch {
      res_el.innerHTML = `<span style="color:var(--red)">Erro ao reprocessar</span>`;
    }
    Utils.btnLoading(btn, false);
  },

  async reprocessarCategorias() {
    const btn = document.getElementById('btn-rep-cats');
    const res_el = document.getElementById('res-cats');
    Utils.btnLoading(btn, true);
    res_el.textContent = 'Processando... pode demorar alguns segundos.';
    try {
      const res = await API.reprocessarTodasCategorias();
      res_el.innerHTML = `<span style="color:var(--green)">✓ ${res.atualizados} vendas atualizadas!</span>`;
    } catch {
      res_el.innerHTML = `<span style="color:var(--red)">Erro ao reprocessar</span>`;
    }
    Utils.btnLoading(btn, false);
  },
};

// ===== CONECTOR COM SERVIDOR NODE =====

const API = {
  // Em produção o frontend está no mesmo servidor, então usamos URL relativa
  // Em desenvolvimento local, troque para 'http://localhost:3000/api'
  BASE_URL: '/api',

  async get(action, params = {}) {
    const url = new URL(action, window.location.origin + this.BASE_URL + '/');
    const fullUrl = this.BASE_URL + '/' + action;
    const searchParams = new URLSearchParams(params);
    const queryStr = searchParams.toString();
    const res = await fetch(queryStr ? `${fullUrl}?${queryStr}` : fullUrl);
    if (!res.ok) throw new Error('Erro na API: ' + res.status);
    return res.json();
  },

  async post(action, body = {}) {
    const res = await fetch(this.BASE_URL + '/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Erro na API: ' + res.status);
    return res.json();
  },

  // ===== ENDPOINTS =====

  getDashboard(filtros)   { return this.post('dashboard', { filtros }); },
  getEstrelas()           { return this.get('estrelas'); },
  getRanking(strIni, strFim, semNum) { return this.post('ranking', { strIni, strFim, semNum }); },
  getRelatorioDiario(data){ return this.get('relatorio_diario', { data }); },
  getRelatorioSemanal(semana)   { return this.get('relatorio_semanal', { semana }); },
  getRelatorioSemanalRC(semana) { return this.post('relatorio_semanal_rc', { semana }); },
  getConfig()             { return this.get('config'); },
  salvarVendedor(dados)   { return this.post('salvar_vendedor', dados); },
  uploadVendedores(linhas){ return this.post('upload_vendedores', { linhas }); },
  salvarEquipe(dados)     { return this.post('salvar_equipe', dados); },
  salvarEvento(dados)     { return this.post('salvar_evento', dados); },
  salvarOC(dados)         { return this.post('salvar_oc', dados); },
  deletarOC(oc, plano)    { return this.post('deletar_oc', { oc, plano }); },
  getRegrасCanal()        { return this.get('get_regras_canal'); },
  salvarRegraCanal(dados) { return this.post('salvar_regra_canal', dados); },
  deletarRegraCanal(padrao, tipo) { return this.post('deletar_regra_canal', { padrao, tipo }); },
  aplicarRegraCanal(dados){ return this.post('aplicar_regra_canal', dados); },
  getOCsEvento(eventoCod) { return this.post('get_ocs_evento', { eventoCod }); },
  reprocessarTodosCanais()     { return this.post('reprocessar_todos_canais', {}); },
  reprocessarTodasCategorias() { return this.post('reprocessar_todas_categorias', {}); },
  getSemaforo(filtros)          { return this.post('get_semaforo', filtros || {}); },
  getMetaSemanal(strIni, strFim, canal, equipe) { return this.post('get_meta_semanal', { strIni, strFim, canal: canal||'', equipe: equipe||'' }); },
  getNovosVendedores()          { return this.post('get_novos_vendedores', {}); },
  getCapacidadeEvento(evento)   { return this.post('get_capacidade_evento', { evento }); },
  salvarNoShowEvento(pago, gratuito) { return this.post('salvar_noshow_evento', { pago, gratuito }); },
  salvarCalendario(dados)       { return this.post('salvar_calendario', dados); },
  salvarCanal(dados)            { return this.post('salvar_canal', dados); },
  salvarOCEvento(dados)         { return this.post('salvar_oc_evento', dados); },
  salvarPlanoEvento(dados)      { return this.post('salvar_plano_evento', dados); },
  salvarOCsLote(eventoCod, ocs) { return this.post('salvar_ocs_lote', { eventoCod, ocs }); },
  salvarPlanosLote(eventoCod, planos) { return this.post('salvar_planos_lote', { eventoCod, planos }); },
  vincularAtualizar(tipo, codigo, eventoCod) { return this.post('vincular_atualizar', { tipo, codigo, eventoCod }); },
  reprocessarTodosCanais()   { return this.post('reprocessar_todos_canais', {}); },
  deletarOCEvento(oc, eventoCod) { return this.post('deletar_oc_evento', { oc, eventoCod }); },
  deletarPlanoEvento(plano, eventoCod) { return this.post('deletar_plano_evento', { plano, eventoCod }); },
  deletar(tipo, id)         { return this.post('deletar', { tipo, id }); },
  uploadCSV(linhas)         { return this.post('upload_csv', { linhas }); },
  getUploadStatus()         { return this.get('upload_status'); },
  getPerfilVendedor(codigo, semanas) { return this.post('get_perfil_vendedor', { codigo, semanas: semanas||8 }); },
  getEventosDash(filtros)   { return this.post('eventos', { filtros }); },
  getJornadaUpgrade(evento, filtros) { return this.post('jornada_upgrade', { evento, filtros }); },
  getRegrасCanal()          { return this.get('get_regras_canal'); },
  salvarRegraCanal(dados)   { return this.post('salvar_regra_canal', dados); },
  deletarRegraCanal(padrao, tipo) { return this.post('deletar_regra_canal', { padrao, tipo }); },
  aplicarRegraCanal(dados)  { return this.post('aplicar_regra_canal', dados); },
  invalidarCache()          { return this.post('invalidar_cache', {}); },
  ping()                    { return this.post('ping', {}); },
};

// ===== LOGIN =====
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) ls.style.display = 'none';
  }, 800);

  const btnLogin = document.getElementById('btn-login');
  const inputSenha = document.getElementById('login-senha');
  const erro = document.getElementById('login-erro');

  function tentarLogin() {
    const senha = inputSenha.value.trim();
    if (!senha) return;

    erro.style.display = 'none';
    const role = AUTH.login(senha);

    if (role) {
      App.role = role;
      App.setupNav();
      document.getElementById('main-nav').style.display = 'flex';
      App.showScreen('dashboard');
    } else {
      erro.style.display = 'block';
      inputSenha.value = '';
      inputSenha.focus();
    }
  }

  btnLogin.addEventListener('click', tentarLogin);
  inputSenha.addEventListener('keydown', e => { if (e.key === 'Enter') tentarLogin(); });

  if (AUTH.check()) {
    document.getElementById('main-nav').style.display = 'flex';
  }
});

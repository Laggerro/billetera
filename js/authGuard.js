(function checkAuth() {
  const sessionData = sessionStorage.getItem('session');
  const currentPath = window.location.pathname.split('/').pop();

  // Páginas públicas que no requieren login
  const publicPages = ['index.html', 'tablero-monitor.html', 'registro.html', ''];
  if (publicPages.includes(currentPath)) {
    return; // Permitir acceso libre
  }

  // Si no hay sesión iniciada, mandar a login
  if (!sessionData) {
    window.location.href = 'index.html';
    return;
  }

  const session = JSON.parse(sessionData);

  // Restricción: Si un CAJERO intenta entrar a páginas exclusivas de ADMIN
  const adminOnlyPages = ['admin-dashboard.html', 'logs.html', 'gestion-posnets.html', 'admin-alumnos.html'];
  if (session.rol !== 'ADMIN' && adminOnlyPages.includes(currentPath)) {
    alert("⛔ Acceso denegado: Esta sección requiere rol Administrador.");
    window.location.href = 'cajero-dashboard.html';
  }
})();
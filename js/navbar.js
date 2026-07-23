// js/navbar.js
document.addEventListener('DOMContentLoaded', () => {
  const navbarContainer = document.getElementById('navbar-container');
  if (!navbarContainer) return;

  // Se obtiene el usuario o rol del localStorage / Sesión
  const usuarioSesion = JSON.parse(localStorage.getItem('usuarioBanco')) || {};
  const rol = (usuarioSesion.rol || 'CAJERO').toUpperCase();
  const nombreUsr = usuarioSesion.nombre || usuarioSesion.usuario || 'Operador';

  const esAdmin = rol === 'ADMIN';

  navbarContainer.innerHTML = `
    <nav class="navbar" style="background-color: #2b6cb0; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-weight: bold; font-size: 1.2rem;">🏦 Banco Escolar</span>
        
        <div class="nav-links" style="display: flex; gap: 15px;">
          <!-- Enlaces comunes a Cajeros y Admins -->
          <a href="cajero-dashboard.html" style="color: white; text-decoration: none; font-weight: 500;">🏠 Inicio / Operaciones</a>
          <a href="alta-alumno.html" style="color: white; text-decoration: none; font-weight: 500;">👤 Alta Alumno</a>
          <a href="admin-alumnos.html" style="color: white; text-decoration: none; font-weight: 500;">👥 Directorio General</a>

          <!-- Enlaces Exclusivos del Administrador -->
          ${esAdmin ? `
            <a href="admin-dashboard.html" style="color: #fbd38d; text-decoration: none; font-weight: 600;">📊 Tablero Estado</a>
            <a href="admin-config.html" style="color: #fbd38d; text-decoration: none; font-weight: 600;">⚙️ Configuración Admin</a>
          ` : ''}
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="font-size: 0.9rem; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px;">
          👤 ${nombreUsr} (${rol})
        </span>
        <button id="btnCerrarSesion" style="background: #e53e3e; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Salir
        </button>
      </div>
    </nav>
  `;

  // Evento de cierre de sesión
  document.getElementById('btnCerrarSesion')?.addEventListener('click', () => {
    localStorage.removeItem('usuarioBanco');
    window.location.href = 'index.html'; // o login.html
  });
});
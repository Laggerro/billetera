document.addEventListener('DOMContentLoaded', () => {
  console.log("--> Página cargada y JS listo.");

  const loginForm = document.getElementById('loginForm');
  const errorDiv = document.getElementById('errorMessage');

  if (!loginForm) {
    console.error("CRÍTICO: No se encontró el elemento <form id='loginForm'>");
    return;
  }

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log("--> Clic en el botón de ingresar detectado!");

    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.innerText = '';
    }

    const user = document.getElementById('username')?.value.trim();
    const pass = document.getElementById('password')?.value.trim();

    console.log(`--> Intentando loguear con usuario: "${user}"`);

    // Validar que Supabase esté inicializado correctamente
    if (!window._supabase) {
      mostrarError("Error: No se pudo conectar con Supabase. Revisa supabaseClient.js");
      return;
    }

    try {
      // Consulta a Supabase
      const { data, error } = await window._supabase
        .from('usuarios_banco')
        .select('id, usuario, nombre, rol, password_hash')
        .eq('usuario', user)
        .maybeSingle();

      if (error) {
        console.error("Error devuelto por Supabase:", error);
        mostrarError("Error de base de datos: " + error.message);
        return;
      }

      if (!data) {
        mostrarError("El usuario no existe.");
        return;
      }

      if (data.password_hash !== pass) {
        mostrarError("Contraseña incorrecta.");
        return;
      }

      console.log("--> Login exitoso! Rol del usuario:", data.rol);

      // Guardar datos en la sesión
      sessionStorage.setItem('session', JSON.stringify({
        id: data.id,
        usuario: data.usuario,
        nombre: data.nombre,
        rol: data.rol
      }));

      // Redireccionar según el rol
      if (data.rol === 'ADMIN') {
        window.location.href = 'admin-dashboard.html';
      } else if (data.rol === 'CAJERO') {
        window.location.href = 'cajero-dashboard.html';
      } else if (data.rol === 'CONSULTA') {
        window.location.href = 'consulta-saldo.html';
      } else {
        mostrarError("El usuario no tiene un rol válido asignado.");
      }

    } catch (err) {
      console.error("Error inesperado en el try/catch:", err);
      mostrarError("Ocurrió un error inesperado al procesar la solicitud.");
    }
  });

  // Función auxiliar para mostrar errores
  function mostrarError(mensaje) {
    console.warn("--> Alerta de error:", mensaje);
    if (errorDiv) {
      errorDiv.innerText = mensaje;
      errorDiv.style.display = 'block';
    } else {
      alert(mensaje);
    }
  }
});
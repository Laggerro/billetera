document.addEventListener("DOMContentLoaded", () => {
  console.log("--> Página cargada y JS listo.");

  const loginForm = document.getElementById("loginForm");
  const errorDiv = document.getElementById("errorMessage");

  if (!loginForm) {
    console.error("CRÍTICO: No se encontró el elemento <form id='loginForm'>");
    return;
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    console.log("--> Clic en el botón de ingresar detectado!");

    if (errorDiv) {
      errorDiv.style.display = "none";
      errorDiv.innerText = "";
    }

    const user = document.getElementById("username")?.value.trim();
    const pass = document.getElementById("password")?.value.trim();

    console.log(`--> Intentando loguear con usuario: "${user}"`);

    // Validar que Supabase esté inicializado correctamente
    if (!window._supabase) {
      mostrarError(
        "Error: No se pudo conectar con Supabase. Revisa supabaseClient.js"
      );
      return;
    }

    try {
      // 💡 Consulta a Supabase (INCLUIMOS 'puede_retirar' Y 'activo')
      const { data, error } = await window._supabase
        .from("usuarios_banco")
        .select("id, usuario, nombre, rol, puede_retirar, activo, password_hash")
        .eq("usuario", user)
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

      // Validar si el usuario está activo
      if (data.activo === false) {
        mostrarError("El usuario se encuentra desactivado.");
        return;
      }

      if (data.password_hash !== pass) {
        mostrarError("Contraseña incorrecta.");
        return;
      }

      // Normalizamos el rol a Mayúsculas para evitar fallos por "admin" / "ADMIN"
      const rolNormalizado = (data.rol || "CAJERO").toString().trim().toUpperCase();

      console.log("--> Login exitoso! Rol del usuario:", rolNormalizado);

      // Objeto de sesión formateado (INCLUIMOS 'puede_retirar')
      const usuarioBancoData = {
        id: data.id,
        usuario: data.usuario,
        nombre: data.nombre || data.usuario,
        rol: rolNormalizado,
        puede_retirar: data.puede_retirar === true || data.puede_retirar === 'true' || data.puede_retirar === 1
      };

      // Guardamos tanto en localStorage como en sessionStorage por compatibilidad
      localStorage.setItem("usuarioBanco", JSON.stringify(usuarioBancoData));
      sessionStorage.setItem("session", JSON.stringify(usuarioBancoData));

      // Redirección según rol
      if (rolNormalizado === "ADMIN") {
        window.location.href = "admin-dashboard.html";
      } else if (rolNormalizado === "CAJERO") {
        window.location.href = "cajero-dashboard.html";
      } else {
        alert("Rol de usuario no válido: " + rolNormalizado);
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
      errorDiv.style.display = "block";
    } else {
      alert(mensaje);
    }
  }
});
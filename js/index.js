document.addEventListener("DOMContentLoaded", () => {
  console.log("--> Página cargada y JS listo.");

  // CLAVE SECRETA DEL QR MAESTRO ADMIN
  const QR_MAESTRO_ADMIN = "Alumno-0001";

  const loginForm = document.getElementById("loginForm");
  const errorDiv = document.getElementById("errorMessage");
  const usernameInput = document.getElementById("username");
  const passInput = document.getElementById("password");

  // Elementos del Modal
  const qrModal = document.getElementById("qrModal");
  const qrModalError = document.getElementById("qrModalError");
  const btnCancelQr = document.getElementById("btnCancelQr");
  const inputManualQr = document.getElementById("inputManualQr");
  const btnValidarManual = document.getElementById("btnValidarManual");

  let html5QrcodeScanner = null;
  let usuarioPendienteSesion = null;

  // Si escribe "consulta", quitamos el 'required' del password
  usernameInput?.addEventListener("input", (e) => {
    if (e.target.value.trim().toLowerCase() === "consulta") {
      passInput.removeAttribute("required");
    } else {
      passInput.setAttribute("required", "true");
    }
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (errorDiv) {
      errorDiv.style.display = "none";
      errorDiv.innerText = "";
    }

    const user = usernameInput?.value.trim();
    const pass = passInput?.value.trim();

    // 1. CASO ESPECIAL: "CONSULTA" (Acceso directo libre)
    if (user.toLowerCase() === "consulta") {
      console.log("--> Acceso de Consulta de Saldo directo.");
      window.location.href = "consulta-saldo.html";
      return;
    }

    // Validar conexión a Supabase
    if (!window._supabase) {
      mostrarError("Error: No se pudo conectar con Supabase. Revisa supabaseClient.js");
      return;
    }

    try {
      // 2. BUSCAR EN 'usuarios_banco'
      let { data, error } = await window._supabase
        .from("usuarios_banco")
        .select("id, usuario, nombre, rol, puede_retirar, activo, password_hash")
        .eq("usuario", user)
        .maybeSingle();

      // 3. SI NO ESTÁ EN 'usuarios_banco', BUSCAR EN 'posnets'
      if (!data) {
        const { data: posnetData } = await window._supabase
          .from("posnets")
          .select("id, usuario, nombre_posnet, habilitado, password")
          .eq("usuario", user)
          .maybeSingle();

        if (posnetData) {
          data = {
            id: posnetData.id,
            usuario: posnetData.usuario,
            nombre: posnetData.nombre_posnet,
            rol: "POSNET",
            activo: posnetData.habilitado,
            password_hash: posnetData.password
          };
        }
      }

      if (error || !data) {
        mostrarError("El usuario no existe.");
        return;
      }

      if (data.activo === false) {
        mostrarError("El usuario se encuentra desactivado.");
        return;
      }

      if (data.password_hash !== pass) {
        mostrarError("Contraseña incorrecta.");
        return;
      }

      const rolNormalizado = (data.rol || "CAJERO").toString().trim().toUpperCase();

      usuarioPendienteSesion = {
        id: data.id,
        usuario: data.usuario,
        nombre: data.nombre || data.usuario,
        rol: rolNormalizado,
        puede_retirar: data.puede_retirar === true || data.puede_retirar === 1
      };

      console.log("--> Credenciales OK. Solicitando QR Maestro Admin para rol:", rolNormalizado);

      // PASO 2: ABRIR MODAL / ESCÁNER CÁMARA
      abrirModalQrMaestro();

    } catch (err) {
      console.error("Error inesperado en el try/catch:", err);
      mostrarError("Ocurrió un error inesperado al procesar la solicitud.");
    }
  });

  // --- LÓGICA DEL ESCÁNER MEJORADA PARA MÓVILES Y MANUAL ---
  async function abrirModalQrMaestro() {
    qrModal.classList.remove("d-none");
    if (qrModalError) qrModalError.style.display = "none";
    if (inputManualQr) inputManualQr.value = "";

    // Retardo para asegurar renderizado del DOM en móviles
    setTimeout(async () => {
      try {
        if (!html5QrcodeScanner) {
          html5QrcodeScanner = new Html5Qrcode("qrReader");
        }

        const config = { fps: 10, qrbox: { width: 200, height: 200 } };

        try {
          // Intento 1: Cámara trasera estricta
          await html5QrcodeScanner.start(
            { facingMode: { exact: "environment" } },
            config,
            (decodedText) => procesarCodigoIngresado(decodedText),
            () => { }
          );
        } catch (e1) {
          // Intento 2: Fallback a cámara estándar
          console.warn("Fallo 'exact environment', reintentando con 'environment' estándar...");
          await html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => procesarCodigoIngresado(decodedText),
            () => { }
          );
        }
      } catch (err) {
        console.warn("No se pudo iniciar la cámara (Sin permisos, HTTPS o cámara inexistente):", err);
        mostrarErrorModal("⚠️ Cámara no disponible. Ingrese el código manualmente abajo.");
      }
    }, 300);
  }

  function procesarCodigoIngresado(codigo) {
    if (codigo.trim() === QR_MAESTRO_ADMIN) {
      cerrarModalYApagarCamara(() => {
        // Guardar Sesión
        localStorage.setItem("usuarioBanco", JSON.stringify(usuarioPendienteSesion));
        localStorage.setItem("posnet_session", JSON.stringify(usuarioPendienteSesion));
        sessionStorage.setItem("session", JSON.stringify(usuarioPendienteSesion));

        // Redireccionar
        const rol = usuarioPendienteSesion.rol;
        if (rol === "ADMIN") {
          window.location.href = "admin-dashboard.html";
        } else if (rol === "CAJERO") {
          window.location.href = "cajero-dashboard.html";
        } else if (rol === "POSNET") {
          window.location.href = "posnet.html";
        } else {
          alert("Rol no reconocido: " + rol);
        }
      });
    } else {
      mostrarErrorModal("❌ QR Maestro / Código Inválido");
    }
  }

  // Evento botón ingreso manual
  btnValidarManual?.addEventListener("click", () => {
    const val = inputManualQr.value.trim();
    if (!val) {
      mostrarErrorModal("Escriba un código para validar.");
      return;
    }
    procesarCodigoIngresado(val);
  });

  // Evento botón cancelar
  btnCancelQr?.addEventListener("click", () => {
    cerrarModalYApagarCamara();
  });

  // Apagar cámara de forma segura
  async function cerrarModalYApagarCamara(callback) {
    qrModal.classList.add("d-none");
    if (html5QrcodeScanner) {
      try {
        if (html5QrcodeScanner.isScanning) {
          await html5QrcodeScanner.stop();
        }
      } catch (err) {
        console.warn("Cámara ya detenida o no iniciada:", err);
      }
    }
    if (callback) callback();
  }

  function mostrarErrorModal(mensaje) {
    if (qrModalError) {
      qrModalError.innerText = mensaje;
      qrModalError.style.display = "block";
    }
  }

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
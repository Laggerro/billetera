const IMGBB_API_KEY = "61a76cc12d06bd22948b4b5b76f5b45e";
const SVG_DEFAULT =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg>";

let fotoBlobCapturada = null;
let videoStream = null;
let html5QrcodeScanner = null;
let listaAlumnosCache = []; // Cache local para la búsqueda rápida

document.addEventListener("DOMContentLoaded", async () => {
  const imgPreview = document.getElementById("imgPreview");
  if (imgPreview) imgPreview.src = SVG_DEFAULT;

  // 0. CARGAR COMBOS Y TABLA
  await cargarComboCursos();
  await cargarTablaAlumnos();

  // Evento de búsqueda en tiempo real
  const txtBuscarTabla = document.getElementById("txtBuscarTabla");
  if (txtBuscarTabla) {
    txtBuscarTabla.addEventListener("input", filtrarTablaAlumnos);
  }

  // Cancelar edición
  const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
  if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener("click", resetFormulario);
  }

  // ==========================================
  // 1. LÓGICA PARA ESCANEAR CÓDIGO QR (CORREGIDO)
  // ==========================================
  const btnEscanearQR = document.getElementById("btnEscanearQR");
  if (btnEscanearQR) {
    btnEscanearQR.addEventListener("click", async () => {
      // 🚨 Aseguramos cerrar la cámara de foto de perfil por si quedó abierta
      cerrarCamara();

      const modalLector = document.getElementById("modalLectorQR");
      if (modalLector) modalLector.style.display = "flex";

      // Limpiamos instancia previa de QR
      if (html5QrcodeScanner) {
        try {
          await html5QrcodeScanner.stop();
        } catch (e) {}
        try {
          html5QrcodeScanner.clear();
        } catch (e) {}
      }

      html5QrcodeScanner = new Html5Qrcode("reader");

      const config = {
        fps: 20,
        qrbox: { width: 250, height: 250 }, // Tamaño fijo estándar compatible con todo
        aspectRatio: 1.0,
      };

      // Intentamos usar la cámara trasera/entorno sin forzar resoluciones HD estrictas
      html5QrcodeScanner
        .start(
          { facingMode: "environment" },
          config,
          (qrCodeMessage) => {
            const txtCodigoQR = document.getElementById("txtCodigoQr");
            if (txtCodigoQR) txtCodigoQR.value = qrCodeMessage;
            cerrarLectorQR();
          },
          () => {}, // Ignorar errores de escaneo fotograma a fotograma
        )
        .catch((err) => {
          console.warn(
            "No se pudo abrir cámara trasera, intentando cámara por defecto:",
            err,
          );

          // Fallback: Abre cualquier cámara disponible en el dispositivo (Webcam USB o frontal)
          html5QrcodeScanner
            .start(
              { facingMode: "user" },
              config,
              (qrCodeMessage) => {
                const txtCodigoQR = document.getElementById("txtCodigoQr");
                if (txtCodigoQR) txtCodigoQR.value = qrCodeMessage;
                cerrarLectorQR();
              },
              () => {},
            )
            .catch((finalErr) => {
              console.error("Error definitivo al abrir cámara:", finalErr);
              alert(
                "Error al acceder a la cámara. Asegúrate de dar los permisos correspondientes o estar usando HTTPS.",
              );
              cerrarLectorQR();
            });
        });
    });
  }

  const btnCerrarLector = document.getElementById("btnCerrarLectorQR");
  if (btnCerrarLector) {
    btnCerrarLector.addEventListener("click", cerrarLectorQR);
  }

  function cerrarLectorQR() {
    const modalLector = document.getElementById("modalLectorQR");
    if (html5QrcodeScanner) {
      html5QrcodeScanner
        .stop()
        .then(() => {
          html5QrcodeScanner.clear();
          if (modalLector) modalLector.style.display = "none";
        })
        .catch((err) => {
          if (modalLector) modalLector.style.display = "none";
        });
    } else if (modalLector) {
      modalLector.style.display = "none";
    }
  }

  // ==========================================
  // 2. LÓGICA WEBCAM FOTO PERFIL (CORREGIDO)
  // ==========================================
  const btnAbrirCamara = document.getElementById("btnAbrirCamara");
  if (btnAbrirCamara) {
    btnAbrirCamara.addEventListener("click", async () => {
      // 🚨 Cerramos primero el lector QR por si acaso
      cerrarLectorQR();

      try {
        // Pedimos video flexible sin restricciones de resolución duras
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        const webcam = document.getElementById("webcam");
        if (webcam) {
          webcam.srcObject = videoStream;
          await webcam.play(); // Forzar reproducción del video en celulares
        }

        const modalCamara = document.getElementById("modalCamara");
        if (modalCamara) modalCamara.style.display = "flex";
      } catch (err) {
        console.error("Error al abrir la cámara de fotos:", err);
        alert("Error al abrir la cámara para la foto de perfil.");
      }
    });
  }

  const btnCapturar = document.getElementById("btnCapturar");
  if (btnCapturar) {
    btnCapturar.addEventListener("click", () => {
      const video = document.getElementById("webcam");
      const canvas = document.getElementById("canvasFoto");
      if (!video || !canvas) return;

      const context = canvas.getContext("2d");
      canvas.width = video.videoWidth || 300;
      canvas.height = video.videoHeight || 300;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          fotoBlobCapturada = blob;
          if (imgPreview) imgPreview.src = URL.createObjectURL(blob);
          cerrarCamara();
        },
        "image/jpeg",
        0.85,
      );
    });
  }

  const btnCerrarCamara = document.getElementById("btnCerrarCamara");
  if (btnCerrarCamara) {
    btnCerrarCamara.addEventListener("click", cerrarCamara);
  }

  function cerrarCamara() {
    if (videoStream) {
      // Detenemos explícitamente la cámara para liberar el hardware del teléfono/PC
      videoStream.getTracks().forEach((track) => {
        track.stop();
      });
      videoStream = null;
    }
    const modalCamara = document.getElementById("modalCamara");
    if (modalCamara) modalCamara.style.display = "none";
  }

  // 3. SUBMIT / GUARDAR / ACTUALIZAR ALUMNO
  const formAlta = document.getElementById("formAltaAlumno");
  if (formAlta) {
    formAlta.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btnGuardar");
      if (btn) btn.disabled = true;

      const alumnoId = document.getElementById("alumnoId").value;
      const txtCodigoQR = document.getElementById("txtCodigoQr");
      const codigoQR = txtCodigoQR ? txtCodigoQR.value.trim() : "";
      const dni = document.getElementById("txtDni").value.trim();
      const nombre = document.getElementById("txtNombre").value.trim();
      const curso = document.getElementById("txtCurso").value.trim();
      const pin = document.getElementById("txtPin").value.trim();

      // Validación de PIN
      if (!alumnoId && (pin.length !== 4 || isNaN(pin))) {
        mostrarError(
          "El PIN inicial debe ser obligatoriamente de 4 dígitos numéricos.",
        );
        if (btn) btn.disabled = false;
        return;
      }

      if (alumnoId && pin && (pin.length !== 4 || isNaN(pin))) {
        mostrarError("El nuevo PIN debe tener 4 dígitos numéricos.");
        if (btn) btn.disabled = false;
        return;
      }

      let urlFoto = null;

      try {
        // Subida de foto a ImgBB si se capturó una nueva
        if (fotoBlobCapturada) {
          if (btn) btn.innerText = "Subiendo foto...";
          const formData = new FormData();
          formData.append("image", fotoBlobCapturada);
          const resImgBB = await fetch(
            `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
            {
              method: "POST",
              body: formData,
            },
          );
          const dataImgBB = await resImgBB.json();
          if (dataImgBB.success) {
            urlFoto = dataImgBB.data.url;
          }
        }

        if (btn) btn.innerText = "Guardando...";
        const client = window._supabase || supabase;

        const payload = {
          codigo_qr: codigoQR || null,
          dni: dni,
          nombre_apellido: nombre,
          curso: curso,
        };

        if (pin) payload.pin = pin;

        let error;

        if (alumnoId) {
          // ACTUALIZACIÓN por DNI
          if (urlFoto) payload.foto_url = urlFoto;
          ({ error } = await client
            .from("alumnos")
            .update(payload)
            .eq("dni", alumnoId));
        } else {
          // ALTA NUEVA
          payload.foto_url =
            urlFoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${dni}`;
          payload.saldo = 0.0;
          ({ error } = await client.from("alumnos").insert([payload]));
        }

        if (error) {
          if (error.code === "23505") {
            mostrarError(
              "El DNI o el Código QR ya están registrados en otro alumno.",
            );
          } else {
            mostrarError("Error: " + error.message);
          }
        } else {
          alert(
            alumnoId
              ? `¡Alumno ${nombre} actualizado correctamente!`
              : `¡Alumno ${nombre} registrado con éxito!`,
          );
          resetFormulario();
          await cargarTablaAlumnos();
        }
      } catch (err) {
        console.error(err);
        mostrarError("Ocurrió un error inesperado al procesar la solicitud.");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }
});

// ==========================================
// FUNCIONES DE GESTIÓN DE TABLA Y CURSOS
// ==========================================

async function cargarComboCursos() {
  const selectCurso = document.getElementById("txtCurso");
  if (!selectCurso) return;

  const client = window._supabase || supabase;
  const { data: cursos, error } = await client
    .from("cursos")
    .select("nombre")
    .order("nombre");

  if (!error && cursos && cursos.length > 0) {
    selectCurso.innerHTML =
      '<option value="">-- Seleccionar Curso --</option>' +
      cursos
        .map((c) => `<option value="${c.nombre}">${c.nombre}</option>`)
        .join("");
  } else {
    selectCurso.innerHTML = '<option value="">Sin cursos registrados</option>';
  }
}

async function cargarTablaAlumnos() {
  const tbody = document.getElementById("tblAlumnos");
  if (!tbody) return;

  const client = window._supabase || supabase;
  const { data, error } = await client
    .from("alumnos")
    .select("*")
    .order("nombre_apellido");

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar lista.</td></tr>`;
    return;
  }

  listaAlumnosCache = data || [];
  renderizarTabla(listaAlumnosCache);
}

function renderizarTabla(alumnos) {
  const tbody = document.getElementById("tblAlumnos");
  if (!tbody) return;

  if (alumnos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px;">No hay alumnos encontrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = alumnos
    .map((a) => {
      // Escapamos comillas en el nombre para evitar fallos en el HTML
      const nombreLimpio = (a.nombre_apellido || "").replace(/'/g, "\\'");

      return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px;">
          <img src="${a.foto_url || SVG_DEFAULT}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">
        </td>
        <td style="padding: 8px;"><b>${a.nombre_apellido}</b></td>
        <td style="padding: 8px;">${a.dni}</td>
        <td style="padding: 8px;">${a.curso || "-"}</td>
        <td style="padding: 8px;"><small>${a.codigo_qr || "Sin QR"}</small></td>
        <td style="padding: 8px; text-align: center; white-space: nowrap;">
          <button onclick="editarAlumno('${a.dni}')" class="btn" style="padding: 3px 8px; font-size: 0.8rem; background: #3182ce; color: white;">✏️ Editar</button>
          <button onclick="eliminarAlumno('${a.dni}', '${nombreLimpio}')" class="btn" style="padding: 3px 8px; font-size: 0.8rem; background: #e53e3e; color: white;">🗑️ Baja</button>
        </td>
      </tr>
    `;
    })
    .join("");
}
function filtrarTablaAlumnos(e) {
  const filtro = e.target.value.toLowerCase().trim();
  const filtrados = listaAlumnosCache.filter(
    (a) =>
      (a.nombre_apellido || "").toLowerCase().includes(filtro) ||
      (a.dni || "").toString().includes(filtro) ||
      (a.codigo_qr || "").toLowerCase().includes(filtro),
  );
  renderizarTabla(filtrados);
}

function editarAlumno(dni) {
  const alumno = listaAlumnosCache.find((a) => String(a.dni) === String(dni));
  if (!alumno) return;

  document.getElementById("alumnoId").value = alumno.dni; // Usamos el DNI como ID de referencia
  document.getElementById("txtDni").value = alumno.dni;
  document.getElementById("txtNombre").value = alumno.nombre_apellido;
  document.getElementById("txtCurso").value = alumno.curso || "";
  document.getElementById("txtCodigoQr").value = alumno.codigo_qr || "";

  // PIN opcional en edición
  const txtPin = document.getElementById("txtPin");
  txtPin.value = "";
  txtPin.required = false;
  document.getElementById("helpPin").style.display = "inline";

  // Imagen de preview
  const imgPreview = document.getElementById("imgPreview");
  if (imgPreview) imgPreview.src = alumno.foto_url || SVG_DEFAULT;

  // Cambiar botones e interfaz
  document.getElementById("lblTituloForm").innerText = "✏️ Modificar Alumno";
  document.getElementById("btnGuardar").innerText = "Actualizar Alumno";
  document.getElementById("btnCancelarEdicion").style.display = "inline-block";

  // Scroll suave al formulario
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function eliminarAlumno(dni, nombre) {
  if (!dni || dni === "undefined") {
    alert("Error: DNI no válido.");
    return;
  }

  const client = window._supabase || supabase;
  const dniString = String(dni).trim();

  try {
    // 1. Consultar el saldo actual usando la columna 'dni'
    const { data: alumno, error: errConsulta } = await client
      .from("alumnos")
      .select("saldo, dni")
      .eq("dni", dniString)
      .single();

    if (errConsulta) {
      alert("Error al verificar los datos del alumno: " + errConsulta.message);
      return;
    }

    const saldoActual = Number(alumno.saldo || 0);

    // 2. Armar cartel de advertencia si tiene saldo
    let mensajeConfirmacion = `¿Estás seguro de dar de baja al alumno "${nombre}" (DNI: ${dniString})?`;

    if (saldoActual > 0) {
      mensajeConfirmacion =
        `⚠️ ¡ATENCIÓN! El alumno "${nombre}" TODAVÍA TIENE $${saldoActual.toFixed(2)} DE SALDO EN SU CUENTA.\n\n` +
        `Si continúas, el alumno será eliminado del sistema junto con todo su saldo y sus transacciones.\n\n` +
        `¿Confirmar la baja de todos modos?`;
    }

    if (!confirm(mensajeConfirmacion)) {
      return; // Cancelado
    }

    // 3. Eliminar primero de la tabla transacciones para evitar restricciones de clave foránea
    await client.from("transacciones").delete().eq("alumno_dni", dniString);

    // 4. Eliminar el registro en la tabla alumnos por su DNI
    const { error: errDelete } = await client
      .from("alumnos")
      .delete()
      .eq("dni", dniString);

    if (errDelete) {
      alert("Error al eliminar el alumno: " + errDelete.message);
    } else {
      alert(`El alumno ${nombre} fue dado de baja correctamente.`);
      await cargarTablaAlumnos();
    }
  } catch (err) {
    console.error("Error en eliminación:", err);
    alert("Ocurrió un error inesperado al intentar dar de baja.");
  }
}
function resetFormulario() {
  document.getElementById("formAltaAlumno").reset();
  document.getElementById("alumnoId").value = "";
  fotoBlobCapturada = null;

  const txtPin = document.getElementById("txtPin");
  txtPin.required = true;
  document.getElementById("helpPin").style.display = "none";

  const imgPreview = document.getElementById("imgPreview");
  if (imgPreview) imgPreview.src = SVG_DEFAULT;

  document.getElementById("lblTituloForm").innerText =
    "👤 Registrar Nuevo Alumno";
  document.getElementById("btnGuardar").innerText = "Registrar Alumno";
  document.getElementById("btnCancelarEdicion").style.display = "none";
}

function mostrarError(txt) {
  const msgDiv = document.getElementById("msgAlta");
  if (msgDiv) {
    msgDiv.innerText = txt;
    msgDiv.style.color = "#e53e3e";
    msgDiv.style.display = "block";
  } else {
    alert(txt);
  }
}

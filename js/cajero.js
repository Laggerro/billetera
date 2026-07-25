let alumnoActual = null;
let html5QrcodeScanner = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Validar Sesión del Operador (revisa localStorage o sessionStorage)
  const sessionData = localStorage.getItem('usuarioBanco') || sessionStorage.getItem('session');
  if (!sessionData) {
    window.location.href = 'index.html';
    return;
  }

  const session = JSON.parse(sessionData);

  const lblUsuario = document.getElementById('lblUsuario');
  if (lblUsuario) {
    lblUsuario.innerText = `${session.nombre || session.usuario || 'Usuario'} (${session.rol || 'CAJERO'})`;
  }

  // Habilitar / Ocultar sección de extracción según permisos
  const secExtraccion = document.getElementById('secExtraccion');
  if (secExtraccion) {
    const puedeRetirar = session.puede_retirar === true || session.puede_retirar === 'true' || session.puede_retirar === 1;
    const esAdmin = (session.rol || '').toUpperCase() === 'ADMIN';

    if (puedeRetirar || esAdmin) {
      secExtraccion.style.display = 'block';
    } else {
      secExtraccion.style.display = 'none';
    }
  }

  // Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('usuarioBanco');
      sessionStorage.clear();
      window.location.href = 'index.html';
    });
  }

  // 2. Eventos de Búsqueda
  const btnBuscar = document.getElementById('btnBuscar');
  if (btnBuscar) {
    btnBuscar.addEventListener('click', () => {
      const query = document.getElementById('txtBuscarDni').value.trim();
      if (query) buscarAlumno(query);
    });
  }

  const txtBuscarDni = document.getElementById('txtBuscarDni');
  if (txtBuscarDni) {
    txtBuscarDni.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = txtBuscarDni.value.trim();
        if (query) buscarAlumno(query);
      }
    });
  }

  // Escáner QR
  const btnEscanearQR = document.getElementById('btnEscanearQR');
  if (btnEscanearQR) btnEscanearQR.addEventListener('click', abrirLectorQR);

  const btnCerrarLectorQR = document.getElementById('btnCerrarLectorQR');
  if (btnCerrarLectorQR) btnCerrarLectorQR.addEventListener('click', cerrarLectorQR);

  // Submit Formularios
  const formRecarga = document.getElementById('formRecarga');
  if (formRecarga) formRecarga.addEventListener('submit', procesarRecarga);

  const formResetPin = document.getElementById('formResetPin');
  if (formResetPin) formResetPin.addEventListener('submit', procesarResetPin);

  const formExtraccion = document.getElementById('formExtraccion');
  if (formExtraccion) formExtraccion.addEventListener('submit', procesarExtraccion);
});

// BÚSQUEDA DE ALUMNO
async function buscarAlumno(criterio) {
  try {
    const client = window._supabase || supabase;
    const { data, error } = await client
      .from('alumnos')
      .select('*')
      .or(`dni.eq.${criterio},codigo_qr.eq.${criterio}`)
      .single();

    if (error || !data) {
      alert("Alumno no encontrado. Verificá el DNI o el QR de la tarjeta.");
      const panel = document.getElementById('panelAlumno');
      if (panel) panel.style.display = 'none';
      alumnoActual = null;
      return;
    }

    alumnoActual = data;

    // Actualizar Panel Visual
    const lblNombre = document.getElementById('lblNombre');
    const lblCurso = document.getElementById('lblCurso');
    const lblDni = document.getElementById('lblDni');
    const lblQR = document.getElementById('lblQR');
    const lblSaldo = document.getElementById('lblSaldo');
    const imgAlumno = document.getElementById('imgAlumno');

    if (lblNombre) lblNombre.innerText = data.nombre_apellido;
    if (lblCurso) lblCurso.innerText = data.curso || 'Sin curso';
    if (lblDni) lblDni.innerText = data.dni;
    if (lblQR) lblQR.innerText = data.codigo_qr || 'Sin QR registrado';
    if (lblSaldo) lblSaldo.innerText = `$${Number(data.saldo || 0).toFixed(2)}`;

    const fotoDefault = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0'><circle cx='12' cy='7' r='4'/></svg>";
    if (imgAlumno) imgAlumno.src = data.foto_url || fotoDefault;

    const panelAlumno = document.getElementById('panelAlumno');
    if (panelAlumno) panelAlumno.style.display = 'grid';
  } catch (err) {
    console.error(err);
    alert("Error al realizar la consulta en la base de datos.");
  }
}

// 1. PROCESAR RECARGA DE SALDO (Suma de Saldo vía RPC/POST)
async function procesarRecarga(e) {
  e.preventDefault();
  if (!alumnoActual) return;

  const monto = parseFloat(document.getElementById('montoRecarga').value);
  if (isNaN(monto) || monto <= 0) {
    alert("Ingresá un monto válido.");
    return;
  }

  const sessionData = localStorage.getItem('usuarioBanco') || sessionStorage.getItem('session');
  const session = JSON.parse(sessionData);

  const saldoActual = Number(alumnoActual.saldo || 0);
  const nuevoSaldo = saldoActual + monto;
  const client = window._supabase || supabase;

  try {
    // 💡 Ejecuta la función SQL 'cargar_saldo' por POST (evita errores CORS y PATCH)
    const { error: errUpdate } = await client.rpc('cargar_saldo', {
      p_dni: alumnoActual.dni,
      p_monto: monto
    });

    if (errUpdate) throw errUpdate;

    await client.from('transacciones').insert([{
      alumno_dni: alumnoActual.dni,
      usuario_banco_id: session.id || null,
      monto: monto,
      tipo: 'RECARGA',
      estado: 'OK'
    }]);

    await registrarLog(
      session.usuario || session.nombre,
      session.rol,
      'RECARGA_SALDO',
      `Recarga de $${monto.toFixed(2)} a ${alumnoActual.nombre_apellido}. Saldo anterior: $${saldoActual.toFixed(2)} | Nuevo: $${nuevoSaldo.toFixed(2)}`,
      alumnoActual.dni
    );

    alert(`¡Carga exitosa! Nuevo saldo de ${alumnoActual.nombre_apellido}: $${nuevoSaldo.toFixed(2)}`);
    document.getElementById('formRecarga').reset();
    buscarAlumno(alumnoActual.dni);
  } catch (err) {
    console.error(err);
    alert("Error al procesar la carga: " + err.message);
  }
}

// 2. PROCESAR EXTRACCIÓN DE SALDO (Resta de Saldo vía RPC/POST)
async function procesarExtraccion(e) {
  e.preventDefault();
  if (!alumnoActual) return;

  const monto = parseFloat(document.getElementById('montoExtraccion').value);
  const pinIngresado = document.getElementById('pinExtraccion').value.trim();

  if (isNaN(monto) || monto <= 0) {
    alert("Ingresá un monto válido para extraer.");
    return;
  }

  const saldoActual = Number(alumnoActual.saldo || 0);
  if (monto > saldoActual) {
    alert(`Fondos insuficientes. El alumno solo dispone de $${saldoActual.toFixed(2)}`);
    return;
  }

  if (pinIngresado !== String(alumnoActual.pin)) {
    alert("🔒 PIN incorrecto. El alumno debe ingresar su clave secreta de 4 dígitos.");
    document.getElementById('pinExtraccion').value = '';
    return;
  }

  const sessionData = localStorage.getItem('usuarioBanco') || sessionStorage.getItem('session');
  const session = JSON.parse(sessionData);

  const nuevoSaldo = saldoActual - monto;
  const client = window._supabase || supabase;

  try {
    // 💡 Ejecuta la función SQL 'cargar_saldo' restando la cantidad (vía POST)
    const { error: errUpdate } = await client.rpc('cargar_saldo', {
      p_dni: alumnoActual.dni,
      p_monto: -monto
    });

    if (errUpdate) throw errUpdate;

    await client.from('transacciones').insert([{
      alumno_dni: alumnoActual.dni,
      usuario_banco_id: session.id || null,
      monto: monto,
      tipo: 'EXTRACCION',
      estado: 'OK'
    }]);

    await registrarLog(
      session.usuario || session.nombre,
      session.rol,
      'EXTRACCION_SALDO',
      `Extracción de $${monto.toFixed(2)} entregada a ${alumnoActual.nombre_apellido}. Saldo anterior: $${saldoActual.toFixed(2)} | Nuevo: $${nuevoSaldo.toFixed(2)}`,
      alumnoActual.dni
    );

    alert(`¡Extracción autorizada! Entregar $${monto.toFixed(2)} en efectivo a ${alumnoActual.nombre_apellido}.\nNuevo saldo: $${nuevoSaldo.toFixed(2)}`);
    document.getElementById('formExtraccion').reset();
    buscarAlumno(alumnoActual.dni);
  } catch (err) {
    console.error(err);
    alert("Error al procesar el retiro: " + err.message);
  }
}

// 3. RESTAURAR PIN
async function procesarResetPin(e) {
  e.preventDefault();
  if (!alumnoActual) return;

  const nuevoPin = document.getElementById('nuevoPin').value.trim();
  if (nuevoPin.length !== 4 || isNaN(nuevoPin)) {
    alert("El PIN debe ser una clave numérica de 4 dígitos.");
    return;
  }

  const sessionData = localStorage.getItem('usuarioBanco') || sessionStorage.getItem('session');
  const session = JSON.parse(sessionData);
  const client = window._supabase || supabase;

  try {
    const { error } = await client
      .from('alumnos')
      .update({ pin: nuevoPin })
      .eq('dni', alumnoActual.dni);

    if (error) throw error;

    await registrarLog(
      session.usuario || session.nombre,
      session.rol,
      'RESET_PIN',
      `Restauración de PIN realizada para el alumno ${alumnoActual.nombre_apellido}`,
      alumnoActual.dni
    );

    alert("¡PIN actualizado con éxito!");
    document.getElementById('formResetPin').reset();
    alumnoActual.pin = nuevoPin;
  } catch (err) {
    console.error(err);
    alert("Error al restaurar el PIN: " + err.message);
  }
}

// AUDITORÍA
async function registrarLog(usuario, rol, accion, detalle, alumnoDni = null) {
  try {
    const client = window._supabase || supabase;
    await client.from('logs_sistema').insert([{
      usuario_operador: usuario,
      rol_operador: rol,
      accion: accion,
      detalle: detalle,
      alumno_dni: alumnoDni
    }]);
  } catch (err) {
    console.error("Error al registrar en logs_sistema:", err);
  }
}

// LECTOR QR OPTIMIZADO PARA PC (USB) Y CELULARES
async function abrirLectorQR() {
  const modalLector = document.getElementById('modalLectorQR');
  if (modalLector) modalLector.style.display = 'flex';

  if (html5QrcodeScanner) {
    try {
      await html5QrcodeScanner.stop();
      html5QrcodeScanner.clear();
    } catch (e) {
      // Ignorar limpieza previa
    }
  }

  html5QrcodeScanner = new Html5Qrcode("reader");

  const config = {
    fps: 20,
    qrbox: function (viewfinderWidth, viewfinderHeight) {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      return {
        width: Math.floor(minEdge * 0.8),
        height: Math.floor(minEdge * 0.8)
      };
    },
    aspectRatio: 1.0
  };

  const onScanSuccess = (qrMessage) => {
    const txtBuscar = document.getElementById('txtBuscarDni');
    if (txtBuscar) txtBuscar.value = qrMessage.trim();
    cerrarLectorQR();
    buscarAlumno(qrMessage.trim());
  };

  // Intento con cámara trasera/entorno
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    () => { }
  ).catch(err => {
    console.warn("Reintentando con cámara frontal/USB por defecto...", err);

    // Fallback: abrir cualquier cámara disponible (útil para webcams en PC)
    html5QrcodeScanner.start(
      { facingMode: "user" },
      config,
      onScanSuccess,
      () => { }
    ).catch(finalErr => {
      console.error("Error definitivo al iniciar la cámara:", finalErr);
      alert("No se pudo acceder a la cámara. Revisa los permisos en tu navegador.");
      cerrarLectorQR();
    });
  });
}

function cerrarLectorQR() {
  const modalLector = document.getElementById('modalLectorQR');
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
      if (modalLector) modalLector.style.display = 'none';
    }).catch(() => {
      if (modalLector) modalLector.style.display = 'none';
    });
  } else if (modalLector) {
    modalLector.style.display = 'none';
  }
}
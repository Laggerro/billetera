// Verificar permisos de Administrador
const usuarioSesion = JSON.parse(localStorage.getItem('usuarioBanco')) || JSON.parse(sessionStorage.getItem('session')) || {};
if ((usuarioSesion.rol || '').toUpperCase() !== 'ADMIN') {
  alert("Acceso denegado. Se requieren permisos de Administrador.");
  window.location.href = 'cajero-dashboard.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  await cargarUsuariosBanco();
  await cargarPosnets();
  await cargarCursos();

  // Eventos de Formularios
  document.getElementById('formUsuarioBanco').addEventListener('submit', guardarUsuarioBanco);
  document.getElementById('formPosnet').addEventListener('submit', guardarPosnet);
  document.getElementById('formCurso').addEventListener('submit', guardarCurso);
  document.getElementById('btnCancelarUsr').addEventListener('click', resetFormUsuario);
});

// ==========================================
// 1. GESTIÓN DE USUARIOS (Cajeros / Admins)
// ==========================================
async function cargarUsuariosBanco() {
  const tbody = document.getElementById('tblUsuariosBanco');
  const client = window._supabase || supabase;

  try {
    const { data, error } = await client.from('usuarios_banco').select('*').order('usuario');
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay usuarios.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(u => `
      <tr>
        <td><b>${u.usuario}</b><br><small>${u.nombre || ''}</small></td>
        <td>${u.rol}</td>
        <td>${u.puede_retirar ? '✅ Sí' : '❌ No'}</td>
        <td><span class="badge-status ${u.activo ? 'badge-ok' : 'badge-off'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button onclick="editarUsuario('${u.id}', '${u.usuario}', '${u.nombre}', '${u.rol}', ${u.puede_retirar})" class="btn" style="padding: 2px 6px; font-size: 0.8rem; background: #3182ce; color: white;">✏️ Edit</button>
          <button onclick="toggleEstadoUsuario('${u.id}', ${!u.activo})" class="btn" style="padding: 2px 6px; font-size: 0.8rem; background: ${u.activo ? '#e53e3e' : '#38a169'}; color: white;">${u.activo ? 'Desactivar' : 'Activar'}</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function guardarUsuarioBanco(e) {
  e.preventDefault();
  const client = window._supabase || supabase;

  const id = document.getElementById('usrId').value;
  const usuario = document.getElementById('txtUsrUsuario').value.trim();
  const nombre = document.getElementById('txtUsrNombre').value.trim();
  const passwordHash = document.getElementById('txtUsrPass').value.trim();
  const rol = document.getElementById('selUsrRol').value;
  const puedeRetirar = document.getElementById('chkPuedeRetirar').checked;

  const payload = {
    usuario,
    nombre,
    rol,
    puede_retirar: puedeRetirar,
    activo: true
  };

  if (passwordHash) {
    payload.password_hash = passwordHash;
  }

  try {
    let error;
    if (id) {
      const idNumerico = parseInt(id, 10);
      ({ error } = await client.from('usuarios_banco').update(payload).eq('id', idNumerico));
    } else {
      ({ error } = await client.from('usuarios_banco').insert([payload]));
    }

    if (error) throw error;

    alert(id ? "Usuario actualizado correctamente." : "Usuario creado con éxito.");
    resetFormUsuario();
    await cargarUsuariosBanco();
  } catch (err) {
    alert("Error al guardar usuario: " + err.message);
  }
}

function editarUsuario(id, usuario, nombre, rol, puedeRetirar) {
  document.getElementById('usrId').value = id;
  document.getElementById('txtUsrUsuario').value = usuario;
  document.getElementById('txtUsrNombre').value = nombre;
  document.getElementById('txtUsrPass').value = '';
  document.getElementById('txtUsrPass').placeholder = '(Dejar en blanco para mantener)';
  document.getElementById('txtUsrPass').required = false;
  document.getElementById('selUsrRol').value = rol;
  document.getElementById('chkPuedeRetirar').checked = puedeRetirar;

  document.getElementById('btnGuardarUsr').innerText = "Actualizar Usuario";
  document.getElementById('btnCancelarUsr').style.display = "inline-block";
}

function resetFormUsuario() {
  document.getElementById('formUsuarioBanco').reset();
  document.getElementById('usrId').value = '';
  document.getElementById('txtUsrPass').required = true;
  document.getElementById('txtUsrPass').placeholder = '••••••••';
  document.getElementById('btnGuardarUsr').innerText = "Crear Usuario";
  document.getElementById('btnCancelarUsr').style.display = "none";
}

async function toggleEstadoUsuario(id, nuevoEstado) {
  const client = window._supabase || supabase;
  const idNumerico = parseInt(id, 10);

  const { error } = await client
    .from('usuarios_banco')
    .update({ activo: nuevoEstado })
    .eq('id', idNumerico);

  if (error) {
    console.error("Error de Supabase:", error);
    alert("Error al actualizar: " + error.message);
  } else {
    await cargarUsuariosBanco();
  }
}

// ==========================================
// 2. GESTIÓN DE POSNETS (CORREGIDO)
// ==========================================
// ==========================================
// 2. GESTIÓN DE POSNETS (REVISADO)
// ==========================================
async function cargarPosnets() {
  const tbody = document.getElementById('tblPosnets');
  if (!tbody) return;

  const client = window._supabase || supabase;

  try {
    const { data, error } = await client
      .from('posnets')
      .select('*')
      .order('nombre_posnet', { ascending: true });

    if (error) {
      console.error("Error de Supabase al consultar posnets:", error);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Error al cargar datos: ${error.message}</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay POSNETs configurados.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(p => {
      const monto = Number(p.monto_acumulado || 0).toFixed(2);
      const estadoTexto = p.habilitado ? 'Activo' : 'Inactivo';
      const badgeClase = p.habilitado ? 'badge-ok' : 'badge-off';
      const botonTexto = p.habilitado ? 'Baja' : 'Alta';
      const botonColor = p.habilitado ? '#e53e3e' : '#38a169';

      return `
        <tr>
          <td>
            <b>${p.nombre_posnet || 'Sin nombre'}</b><br>
            <small style="color: #718096;">Usr: ${p.usuario || '-'}</small>
          </td>
          <td>${p.device_id_autorizado || '-'}</td>
          <td>$${monto}</td>
          <td><span class="badge-status ${badgeClase}">${estadoTexto}</span></td>
          <td>
            <button onclick="toggleEstadoPosnet('${p.id}', ${!p.habilitado})" class="btn" style="padding: 2px 6px; font-size: 0.8rem; background: ${botonColor}; color: white;">
              ${botonTexto}
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Error inesperado en cargarPosnets:", err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Error inesperado al cargar lista.</td></tr>`;
  }
}

async function guardarPosnet(e) {
  e.preventDefault();
  const client = window._supabase || supabase;

  const nombre = document.getElementById('txtPosnetNombre').value.trim();
  const usuario = document.getElementById('txtPosnetUsuario').value.trim();
  const pass = document.getElementById('txtPosnetPass').value.trim();
  const serie = document.getElementById('txtPosnetSerie').value.trim();

  const payload = {
    nombre_posnet: nombre,
    usuario: usuario,
    password: pass,
    device_id_autorizado: serie || null,
    habilitado: true,
    monto_acumulado: 0.00,
    cant_transacciones: 0
  };

  const { error } = await client.from('posnets').insert([payload]);

  if (error) {
    alert("Error al registrar POSNET: " + error.message);
    console.error("Detalle del error:", error);
  } else {
    alert("¡POSNET registrado con éxito!");
    document.getElementById('formPosnet').reset();
    await cargarPosnets(); // Recarga la tabla de inmediato
  }
}

async function toggleEstadoPosnet(idUuid, nuevoEstado) {
  const client = window._supabase || supabase;

  // ⚠️ Importante: 'id' en posnets es UUID, NO se convierte con parseInt
  const { error } = await client.from('posnets').update({ habilitado: nuevoEstado }).eq('id', idUuid);
  if (error) {
    alert("Error al cambiar estado del POSNET: " + error.message);
  } else {
    await cargarPosnets();
  }
}

// ==========================================
// 3. CRUD DE CURSOS
// ==========================================
async function cargarCursos() {
  const tbody = document.getElementById('tblCursos');
  const client = window._supabase || supabase;

  const { data } = await client.from('cursos').select('*').order('nombre');
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">No hay cursos cargados.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr>
      <td><b>${c.nombre}</b></td>
      <td style="text-align: right;">
        <button onclick="eliminarCurso('${c.id}')" class="btn" style="padding: 2px 6px; font-size: 0.8rem; background: #e53e3e; color: white;">🗑️ Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function guardarCurso(e) {
  e.preventDefault();
  const client = window._supabase || supabase;
  const nombre = document.getElementById('txtNombreCurso').value.trim();

  const { error } = await client.from('cursos').insert([{ nombre }]);
  if (error) {
    alert("Error al guardar curso: " + error.message);
  } else {
    document.getElementById('formCurso').reset();
    await cargarCursos();
  }
}

async function eliminarCurso(id) {
  if (!confirm("¿Eliminar este curso?")) return;
  const client = window._supabase || supabase;
  const idNumerico = parseInt(id, 10);

  await client.from('cursos').delete().eq('id', idNumerico);
  await cargarCursos();
}
let listaGlobal = [];
let filtroActual = 'TODOS';

document.addEventListener('DOMContentLoaded', async () => {
  await cargarTodo();

  const txtBuscar = document.getElementById('txtBuscarGlobal');
  if (txtBuscar) {
    txtBuscar.addEventListener('keyup', aplicarFiltroYBusqueda);
  }
});

async function cargarTodo() {
  const tbody = document.getElementById('tblEntidades');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Cargando registros del sistema...</td></tr>`;

  listaGlobal = [];
  const client = window._supabase || supabase;

  try {
    // 1. Obtener Alumnos
    const { data: alumnos } = await client.from('alumnos').select('*');
    if (alumnos) {
      alumnos.forEach(a => {
        listaGlobal.push({
          tipo: 'ALUMNOS',
          id: a.dni,
          nombre: a.nombre_apellido,
          detalle: a.curso || 'Sin Curso',
          extra: `$${Number(a.saldo || 0).toFixed(2)}`,
          qr: a.codigo_qr || 'Sin QR',
          badgeClass: 'badge-alumno'
        });
      });
    }

    // 2. Obtener Usuarios Banco (Cajeros y Admins)
    const { data: usuarios } = await client.from('usuarios_banco').select('*');
    if (usuarios) {
      usuarios.forEach(u => {
        const esAdmin = (u.rol || '').toUpperCase() === 'ADMIN';
        listaGlobal.push({
          tipo: esAdmin ? 'ADMINS' : 'CAJEROS',
          id: u.usuario || u.id,
          nombre: u.nombre || u.usuario,
          detalle: `Rol: ${u.rol || 'OPERADOR'}`,
          extra: u.activo ? '🟢 Activo' : '🔴 Inactivo',
          qr: u.puede_retirar ? 'Retiro Permitido' : 'Solo Carga',
          badgeClass: esAdmin ? 'badge-admin' : 'badge-cajero'
        });
      });
    }

    // 3. Obtener POSNETs (Stands de cobro)
    const { data: posnets } = await client.from('posnets').select('*');
    if (posnets) {
      posnets.forEach(p => {
        listaGlobal.push({
          tipo: 'POSNETS',
          id: p.numero_serie || `ID: ${p.id}`,
          nombre: p.nombre_stand,
          detalle: `Stand #${p.id}`,
          extra: p.activo ? '🟢 Conectado' : '🔴 Desconectado',
          qr: p.token_sesion ? 'Token Generado' : 'Sin Token',
          badgeClass: 'badge-posnet'
        });
      });
    }

    aplicarFiltroYBusqueda();

  } catch (err) {
    console.error("Error al cargar la vista unificada:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error al obtener los datos.</td></tr>`;
  }
}

function filtrarEntidad(tipo, btn) {
  filtroActual = tipo;

  // Actualizar estilos de botones
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  aplicarFiltroYBusqueda();
}

function aplicarFiltroYBusqueda() {
  const texto = (document.getElementById('txtBuscarGlobal')?.value || '').toLowerCase();

  const resultado = listaGlobal.filter(item => {
    // Filtro por Pestaña
    const cumpleTipo = (filtroActual === 'TODOS') || (item.tipo === filtroActual);

    // Filtro por Búsqueda de texto
    const cumpleTexto =
      item.id.toString().toLowerCase().includes(texto) ||
      item.nombre.toLowerCase().includes(texto) ||
      item.detalle.toLowerCase().includes(texto) ||
      item.qr.toLowerCase().includes(texto);

    return cumpleTipo && cumpleTexto;
  });

  renderizarTabla(resultado);
}

function renderizarTabla(datos) {
  const tbody = document.getElementById('tblEntidades');
  if (!tbody) return;

  if (datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">No se encontraron registros.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(item => `
    <tr style="border-bottom: 1px solid #edf2f7;">
      <td style="padding: 10px;"><span class="badge-rol ${item.badgeClass}">${item.tipo}</span></td>
      <td style="padding: 10px;"><b>${item.id}</b></td>
      <td style="padding: 10px;">${item.nombre}</td>
      <td style="padding: 10px;">${item.detalle}</td>
      <td style="padding: 10px;"><b>${item.extra}</b></td>
      <td style="padding: 10px; color: #718096; font-size: 0.9rem;">${item.qr}</td>
    </tr>
  `).join('');
}
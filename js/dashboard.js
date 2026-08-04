// Variable global para controlar el temporizador de auto-refresco
let intervalRefresco = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Control de Seguridad
  const sessionData = sessionStorage.getItem('session');
  if (!sessionData) {
    window.location.href = 'index.html';
    return;
  }

  const session = JSON.parse(sessionData);
  const lblUsuario = document.getElementById('lblUsuario');
  if (lblUsuario) lblUsuario.innerText = `${session.nombre || session.usuario} (${session.rol})`;

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      detenerAutoRefresco();
      sessionStorage.clear();
      window.location.href = 'index.html';
    });
  }

  // Carga Inicial
  await actualizarTablero();

  // Iniciar auto-refresco cada 5000 ms (5 segundos)
  iniciarAutoRefresco(5000);
});

// Función centralizadora de actualización
async function actualizarTablero() {
  await cargarMetricas();
  await cargarUltimasTransacciones();
}

function iniciarAutoRefresco(intervaloMs = 5000) {
  detenerAutoRefresco(); // Limpia cualquier temporizador previo

  intervalRefresco = setInterval(async () => {
    // Solo actualiza si la pestaña/ventana está activa (optimización de recursos)
    if (!document.hidden) {
      await actualizarTablero();
    }
  }, intervaloMs);
}

function detenerAutoRefresco() {
  if (intervalRefresco) {
    clearInterval(intervalRefresco);
    intervalRefresco = null;
  }
}


async function cargarMetricas() {
  try {
    const client = window._supabase || supabase;

    // 1. Alumnos y Saldo Circulante en Tarjetas
    const { data: alumnos, error: errAlumnos } = await client
      .from('alumnos')
      .select('saldo');

    if (!errAlumnos && alumnos) {
      const kpiAlumnos = document.getElementById('kpiAlumnos');
      const kpiSaldo = document.getElementById('kpiSaldoCirculante');

      if (kpiAlumnos) kpiAlumnos.innerText = alumnos.length;
      
      const saldoTotal = alumnos.reduce((sum, item) => sum + Number(item.saldo || 0), 0);
      if (kpiSaldo) kpiSaldo.innerText = `$${saldoTotal.toFixed(2)}`;
    }

    // 2. Stands Activos
    const { count: countPosnets, error: errPosnets } = await client
      .from('posnets')
      .select('*', { count: 'exact', head: true })
      .eq('habilitado', true);

    if (!errPosnets) {
      const kpiPosnets = document.getElementById('kpiPosnets');
      if (kpiPosnets) kpiPosnets.innerText = countPosnets || 0;
    }

    // 3. Totales de Movimientos
    const { data: transacciones, error: errTrans } = await client
      .from('transacciones')
      .select('monto, tipo, estado');

    if (!errTrans && transacciones) {
      let totalRecargas = 0;
      let totalVentasStands = 0;
      let totalExtracciones = 0;

      transacciones.forEach(t => {
        const estado = String(t.estado || '').toUpperCase();
        const tipo = String(t.tipo || '').toUpperCase().trim();

        if (estado === 'OK' || estado === 'COMPLETADO') {
          if (tipo === 'RECARGA') {
            totalRecargas += Number(t.monto);
          } else if (tipo === 'COBRO') {
            totalVentasStands += Number(t.monto);
          } else if (tipo === 'EXTRACCION' || tipo === 'RETIRO') {
            totalExtracciones += Number(t.monto);
          }
        }
      });

      // Dinero físico Real en la Caja Central del Banco
      const efectivoEnCaja = totalRecargas - totalExtracciones;

      const kpiEfectivoCaja = document.getElementById('kpiEfectivoCaja');
      const kpiVentasStands = document.getElementById('kpiVentasStands');
      const kpiExtracciones = document.getElementById('kpiExtracciones');

      if (kpiEfectivoCaja) kpiEfectivoCaja.innerText = `$${efectivoEnCaja.toFixed(2)}`;
      if (kpiVentasStands) kpiVentasStands.innerText = `$${totalVentasStands.toFixed(2)}`;
      if (kpiExtracciones) kpiExtracciones.innerText = `$${totalExtracciones.toFixed(2)}`;
    }
  } catch (e) {
    console.error("Error al obtener métricas:", e);
  }
}


async function cargarUltimasTransacciones() {
  const tbody = document.getElementById('tblTransacciones');
  if (!tbody) return;

  try {
    const client = window._supabase || supabase;
    const { data, error } = await client
      .from('transacciones')
      .select(`
        id,
        alumno_dni,
        monto,
        tipo,
        estado,
        fecha_hora,
        posnets (nombre_posnet)
      `)
      .order('fecha_hora', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No hay movimientos registrados aún.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(t => {
      const fecha = new Date(t.fecha_hora).toLocaleString('es-AR');
      const tipoUpper = String(t.tipo || '').toUpperCase();
      
      // Asignación de Badge según tipo
      let badgeClass = 'badge-cobro'; // Default (Rojo/Azul según tu CSS)
      if (tipoUpper === 'RECARGA') {
        badgeClass = 'badge-recarga'; // Verde
      } else if (tipoUpper === 'EXTRACCION') {
        badgeClass = 'bg-warning text-dark'; // Amarillo/Naranja de Bootstrap
      }

      const standNombre = t.posnets ? t.posnets.nombre_posnet : 'Caja Principal';
      return `
        <tr>
          <td>${fecha}</td>
          <td><b>${t.alumno_dni}</b></td>
          <td><span class="badge ${badgeClass}">${t.tipo}</span></td>
          <td>${standNombre}</td>
          <td><b>$${Number(t.monto).toFixed(2)}</b></td>
          <td>${t.estado}</td>
        </tr>
      `;
    }).join('');

  } catch (e) {
    console.error("Error al cargar transacciones:", e);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar historial.</td></tr>`;
  }
}
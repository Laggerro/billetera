document.addEventListener('DOMContentLoaded', async () => {
  // 1. Control de Seguridad: Verificar Sesión Activa
  const sessionData = sessionStorage.getItem('session');
  if (!sessionData) {
    window.location.href = 'index.html';
    return;
  }

  const session = JSON.parse(sessionData);
  document.getElementById('lblUsuario').innerText = `${session.nombre} (${session.rol})`;

  // Botón de Cerrar Sesión
  document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
  });

  // 2. Cargar Métricas y Tablas
  await cargarMetricas();
  await cargarUltimasTransacciones();
});

async function cargarMetricas() {
  try {
    // A. Consultar total de Alumnos y Saldo Circulante
    const { data: alumnos, error: errAlumnos } = await window._supabase
      .from('alumnos')
      .select('saldo');

    if (!errAlumnos && alumnos) {
      document.getElementById('kpiAlumnos').innerText = alumnos.length;
      const saldoTotal = alumnos.reduce((sum, item) => sum + Number(item.saldo || 0), 0);
      document.getElementById('kpiSaldoCirculante').innerText = `$${saldoTotal.toFixed(2)}`;
    }

    // B. Consultar total de Posnets/Stands activos
    const { count: countPosnets, error: errPosnets } = await window._supabase
      .from('postnets')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    if (!errPosnets) {
      document.getElementById('kpiPosnets').innerText = countPosnets || 0;
    }

    // C. Consultar Transacciones para sumar Ingresos (RECARGA) y Egresos (COBRO)
    const { data: transacciones, error: errTrans } = await window._supabase
      .from('transacciones')
      .select('monto, tipo, estado');

    if (!errTrans && transacciones) {
      let totalIngresos = 0;
      let totalEgresos = 0;

      transacciones.forEach(t => {
        if (t.estado === 'OK') {
          if (t.tipo === 'RECARGA') totalIngresos += Number(t.monto);
          if (t.tipo === 'COBRO') totalEgresos += Number(t.monto);
        }
      });

      document.getElementById('kpiIngresos').innerText = `$${totalIngresos.toFixed(2)}`;
      document.getElementById('kpiEgresos').innerText = `$${totalEgresos.toFixed(2)}`;
    }

  } catch (e) {
    console.error("Error al obtener métricas:", e);
  }
}

async function cargarUltimasTransacciones() {
  const tbody = document.getElementById('tblTransacciones');
  
  try {
    const { data, error } = await window._supabase
      .from('transacciones')
      .select(`
        id,
        alumno_dni,
        monto,
        tipo,
        estado,
        fecha_hora,
        postnets ( nombre_stand )
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
      const badgeClass = t.tipo === 'RECARGA' ? 'badge-recarga' : 'badge-cobro';
      const standNombre = t.postnets ? t.postnets.nombre_stand : 'Caja Principal';

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
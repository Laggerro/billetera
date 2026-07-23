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
      sessionStorage.clear();
      window.location.href = 'index.html';
    });
  }

  await cargarMetricas();
  await cargarUltimasTransacciones();
});

async function cargarMetricas() {
  try {
    const client = window._supabase || supabase;

    // Alumnos y Saldo
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

    // Posnets
    const { count: countPosnets, error: errPosnets } = await client
      .from('postnets')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    if (!errPosnets) {
      const kpiPosnets = document.getElementById('kpiPosnets');
      if (kpiPosnets) kpiPosnets.innerText = countPosnets || 0;
    }

    // Transacciones
    const { data: transacciones, error: errTrans } = await client
      .from('transacciones')
      .select('monto, tipo, estado');

    if (!errTrans && transacciones) {
      let totalIngresos = 0;
      let totalEgresos = 0;

      transacciones.forEach(t => {
        if (t.estado === 'OK') {
          if (t.tipo === 'RECARGA') totalIngresos += Number(t.monto);
          if (t.tipo === 'COBRO' || t.tipo === 'EXTRACCION') totalEgresos += Number(t.monto);
        }
      });

      const kpiIngresos = document.getElementById('kpiIngresos');
      const kpiEgresos = document.getElementById('kpiEgresos');
      if (kpiIngresos) kpiIngresos.innerText = `$${totalIngresos.toFixed(2)}`;
      if (kpiEgresos) kpiEgresos.innerText = `$${totalEgresos.toFixed(2)}`;
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
        postnets (nombre_stand)
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
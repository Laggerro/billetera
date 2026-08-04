document.addEventListener("DOMContentLoaded", async () => {
  const sessionData = sessionStorage.getItem("session") || localStorage.getItem("usuarioBanco");
  if (!sessionData) {
    window.location.href = "index.html";
    return;
  }



  const session = JSON.parse(sessionData);
  const lblUsuario = document.getElementById("lblUsuario");
  if (lblUsuario) lblUsuario.innerText = `${session.nombre || session.usuario} (${session.rol})`;

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = "index.html";
  });

  await cargarAuditoria();

  document.getElementById("btnFiltrar")?.addEventListener("click", cargarAuditoria);
  document.getElementById("btnExportar")?.addEventListener("click", cargarAuditoria);
  
  // Búsqueda en tiempo real al escribir
  document.getElementById("txtBuscar")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") cargarAuditoria();
  });
});

async function cargarAuditoria() {
  const tbody = document.getElementById("tblAuditoria");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Consultando registros...</td></tr>`;

  try {
    const client = window._supabase || supabase;
    const filtroTipo = document.getElementById("cmbTipoEvento")?.value || "TODOS";
    const filtroTexto = (document.getElementById("txtBuscar")?.value || "").trim().toLowerCase();

    let registrosUnificados = [];

    // 1. TRANSACCIONES MONETARIAS (Recargas, Cobros, Extracciones)
    if (filtroTipo === "TODOS" || filtroTipo === "RECARGA" || filtroTipo === "COBRO" || filtroTipo === "EXTRACCION") {
      let query = client
        .from("transacciones")
        .select(`
          id,
          alumno_dni,
          monto,
          tipo,
          estado,
          fecha_hora,
          posnets (nombre_posnet),
          usuarios_banco (nombre, usuario)
        `)
        .order("fecha_hora", { ascending: false })
        .limit(100);

      if (filtroTipo !== "TODOS") {
        query = query.eq("tipo", filtroTipo);
      }

      const { data: transacciones, error: errTrans } = await query;

      if (!errTrans && transacciones) {
        transacciones.forEach(t => {
          let operador = "SISTEMA";
          let origen = "Caja Principal";

          if (t.usuarios_banco) {
            operador = `${t.usuarios_banco.nombre} (@${t.usuarios_banco.usuario})`;
            origen = "Caja / Terminal";
          } else if (t.posnets) {
            operador = `POSNET: ${t.posnets.nombre_posnet}`;
            origen = `Stand: ${t.posnets.nombre_posnet}`;
          }

          let claseBadge = "bg-info";
          if (t.tipo === "RECARGA") claseBadge = "bg-success";
          if (t.tipo === "EXTRACCION") claseBadge = "bg-warning text-dark";

          registrosUnificados.push({
            fecha: new Date(t.fecha_hora),
            tipo: t.tipo,
            afectado: `DNI Alumno: ${t.alumno_dni}`,
            operador: operador,
            origen: origen,
            detalle: `$${Number(t.monto).toFixed(2)}`,
            estado: t.estado || "OK",
            claseBadge: claseBadge
          });
        });
      }
    }

    // 2. EVENTOS DE AUDITORÍA (Blanqueos de PIN, Errores, etc.)
    if (filtroTipo === "TODOS" || filtroTipo === "BLANQUEO_PIN" || filtroTipo === "INTENTO_FALLIDO_PIN") {
      let queryLogs = client
        .from("logs_auditoria")
        .select("*")
        .order("fecha_hora", { ascending: false })
        .limit(100);

      if (filtroTipo !== "TODOS") {
        queryLogs = queryLogs.eq("tipo_evento", filtroTipo);
      }

      const { data: logs, error: errLogs } = await queryLogs;

      if (!errLogs && logs) {
        logs.forEach(l => {
          let claseBadge = "bg-secondary";
          if (l.tipo_evento === "BLANQUEO_PIN") claseBadge = "bg-warning text-dark";
          if (l.tipo_evento === "INTENTO_FALLIDO_PIN") claseBadge = "bg-danger";

          registrosUnificados.push({
            fecha: new Date(l.fecha_hora),
            tipo: l.tipo_evento,
            afectado: l.usuario_destino || "N/A",
            operador: l.usuario_origen || "ADMIN/CAJERO",
            origen: "Panel Administrativo",
            detalle: l.detalle || "-",
            estado: "COMPLETADO",
            claseBadge: claseBadge
          });
        });
      }
    }

    // Ordenar cronológicamente descendente
    registrosUnificados.sort((a, b) => b.fecha - a.fecha);

    // Búsqueda por Texto
    if (filtroTexto !== "") {
      registrosUnificados = registrosUnificados.filter(r => 
        String(r.afectado).toLowerCase().includes(filtroTexto) ||
        String(r.operador).toLowerCase().includes(filtroTexto) ||
        String(r.origen).toLowerCase().includes(filtroTexto) ||
        String(r.tipo).toLowerCase().includes(filtroTexto) ||
        String(r.detalle).toLowerCase().includes(filtroTexto)
      );
    }

    if (registrosUnificados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron registros que coincidan.</td></tr>`;
      return;
    }

    tbody.innerHTML = registrosUnificados.map(r => {
      const fechaFormat = r.fecha.toLocaleString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });

      return `
        <tr>
          <td class="text-nowrap">${fechaFormat}</td>
          <td><span class="badge ${r.claseBadge}">${r.tipo}</span></td>
          <td><b>${r.afectado}</b></td>
          <td class="text-warning">${r.operador}</td>
          <td><small class="text-secondary">${r.origen}</small></td>
          <td>${r.detalle}</td>
          <td><span class="badge bg-outline-success border border-secondary">${r.estado}</span></td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Error al cargar auditoría:", err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Error al obtener datos de auditoría.</td></tr>`;
  }
}
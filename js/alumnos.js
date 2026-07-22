document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión
  const sessionData = sessionStorage.getItem('session');
  if (!sessionData) {
    window.location.href = 'index.html';
    return;
  }

  const session = JSON.parse(sessionData);
  document.getElementById('lblUsuario').innerText = `${session.nombre}`;

  document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
  });

  // Cargar lista de alumnos
  await cargarAlumnos();

  // Guardar Alumno
  document.getElementById('formAlumno').addEventListener('submit', registrarAlumno);

  // Filtro de búsqueda en tiempo real
  document.getElementById('txtBuscar').addEventListener('keyup', filtrarTabla);
});

let listaAlumnos = [];

async function cargarAlumnos() {
  const tbody = document.getElementById('tblAlumnos');
  try {
    const { data, error } = await window._supabase
      .from('alumnos')
      .select('*')
      .order('nombre_apellido', { ascending: true });

    if (error) throw error;

    listaAlumnos = data || [];
    renderizarTabla(listaAlumnos);

  } catch (err) {
    console.error("Error al cargar alumnos:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar datos</td></tr>`;
  }
}

function renderizarTabla(datos) {
  const tbody = document.getElementById('tblAlumnos');
  if (datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">No hay alumnos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(a => `
    <tr>
      <td><b>${a.dni}</b></td>
      <td>${a.nombre_apellido}</td>
      <td>${a.curso}</td>
      <td class="text-success"><b>$${Number(a.saldo).toFixed(2)}</b></td>
      <td>
        <button onclick="verQR('${a.dni}', '${a.nombre_apellido}')" style="background:#4a5568; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
          📱 Ver QR
        </button>
      </td>
    </tr>
  `).join('');
}

async function registrarAlumno(e) {
  e.preventDefault();
  const msgDiv = document.getElementById('msgAlumno');
  msgDiv.style.display = 'none';

  const dni = document.getElementById('dni').value.trim();
  const nombre = document.getElementById('nombre').value.trim();
  const curso = document.getElementById('curso').value.trim();
  const pin = document.getElementById('pin').value.trim();

  if (pin.length !== 4 || isNaN(pin)) {
    mostrarMensaje("El PIN debe ser un número de 4 dígitos.", true);
    return;
  }

  try {
    const { error } = await window._supabase
      .from('alumnos')
      .insert([
        { dni, nombre_apellido: nombre, curso, pin, saldo: 0.00 }
      ]);

    if (error) {
      if (error.code === '23505') { // Clave duplicada en postgres
        mostrarMensaje("El DNI ingresado ya se encuentra registrado.", true);
      } else {
        mostrarMensaje("Error al guardar: " + error.message, true);
      }
      return;
    }

    // Éxito
    document.getElementById('formAlumno').reset();
    await cargarAlumnos();
    mostrarMensaje("Alumno registrado con éxito", false);

  } catch (err) {
    console.error(err);
    mostrarMensaje("Error al procesar el registro.", true);
  }
}

function filtrarTabla() {
  const texto = document.getElementById('txtBuscar').value.toLowerCase();
  const filtrados = listaAlumnos.filter(a => 
    a.dni.toLowerCase().includes(texto) || 
    a.nombre_apellido.toLowerCase().includes(texto) ||
    a.curso.toLowerCase().includes(texto)
  );
  renderizarTabla(filtrados);
}

// Generador de QR
let qrContainer = null;

function verQR(dni, nombre) {
  document.getElementById('qrNombre').innerText = nombre;
  document.getElementById('qrDni').innerText = `DNI: ${dni}`;

  const qrBox = document.getElementById('qrcode');
  qrBox.innerHTML = ''; // Limpiar previo

  // Generar QR que contiene simplemente el DNI del alumno
  qrContainer = new QRCode(qrBox, {
    text: dni,
    width: 160,
    height: 160,
    colorDark : "#1a365d",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });

  document.getElementById('modalQR').style.display = 'flex';
}

function cerrarModalQR() {
  document.getElementById('modalQR').style.display = 'none';
}

function imprimirQR() {
  window.print();
}

function mostrarMensaje(texto, esError) {
  const msgDiv = document.getElementById('msgAlumno');
  msgDiv.innerText = texto;
  msgDiv.style.color = esError ? '#e53e3e' : '#38a169';
  msgDiv.style.display = 'block';
}
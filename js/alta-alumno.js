const IMGBB_API_KEY = '61a76cc12d06bd22948b4b5b76f5b45e';
const SVG_DEFAULT = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg>";

let fotoBlobCapturada = null;
let videoStream = null;

// Agregar estas variables arriba en js/alta-alumno.js
let html5QrcodeScanner = null;

// Lógica para Abrir el Escáner QR
document.getElementById('btnEscanearQR').addEventListener('click', () => {
  const modalLector = document.getElementById('modalLectorQR');
  modalLector.style.display = 'flex';

  html5QrcodeScanner = new Html5Qrcode("reader");
  
  html5QrcodeScanner.start(
    { facingMode: "environment" }, // Usa la cámara trasera en móviles o la webcam en PC
    {
      fps: 10,
      qrbox: { width: 220, height: 220 }
    },
    (qrCodeMessage) => {
      // Éxito: Lectura detectada
      document.getElementById('txtCodigoQR').value = qrCodeMessage;
      cerrarLectorQR();
    },
    (errorMessage) => {
      // Búsqueda en progreso (no necesario hacer nada)
    }
  ).catch(err => {
    alert("Error al iniciar el lector de QR: " + err);
    cerrarLectorQR();
  });
});

document.getElementById('btnCerrarLectorQR').addEventListener('click', cerrarLectorQR);

function cerrarLectorQR() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
      document.getElementById('modalLectorQR').style.display = 'none';
    }).catch(err => console.error(err));
  } else {
    document.getElementById('modalLectorQR').style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const imgPreview = document.getElementById('imgPreview');
  if (imgPreview) imgPreview.src = SVG_DEFAULT;

  // Cámara
  document.getElementById('btnAbrirCamara').addEventListener('click', async () => {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400 }, audio: false });
      document.getElementById('webcam').srcObject = videoStream;
      document.getElementById('modalCamara').style.display = 'flex';
    } catch (err) {
      alert("Error al abrir la cámara.");
    }
  });

  document.getElementById('btnCapturar').addEventListener('click', () => {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvasFoto');
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth || 300;
    canvas.height = video.videoHeight || 300;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      fotoBlobCapturada = blob;
      imgPreview.src = URL.createObjectURL(blob);
      cerrarCamara();
    }, 'image/jpeg', 0.85);
  });

  document.getElementById('btnCerrarCamara').addEventListener('click', cerrarCamara);

  function cerrarCamara() {
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());
    document.getElementById('modalCamara').style.display = 'none';
  }

  // Submit de Alta
  document.getElementById('formAltaCajero').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnGuardar');
    btn.disabled = true;

    const codigoQR = document.getElementById('txtCodigoQR').value.trim();
    const dni = document.getElementById('txtDni').value.trim();
    const nombre = document.getElementById('txtNombre').value.trim();
    const curso = document.getElementById('txtCurso').value.trim();
    const pin = document.getElementById('txtPin').value.trim();

    if (pin.length !== 4 || isNaN(pin)) {
      mostrarError("El PIN debe ser de 4 dígitos numéricos.");
      btn.disabled = false;
      return;
    }

    let urlFoto = `https://api.dicebear.com/7.x/bottts/svg?seed=${dni}`;

    try {
      if (fotoBlobCapturada) {
        btn.innerText = "Subiendo foto...";
        const formData = new FormData();
        formData.append('image', fotoBlobCapturada);

        const resImgBB = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData
        });
        const dataImgBB = await resImgBB.json();
        if (dataImgBB.success) urlFoto = dataImgBB.data.url;
      }

      btn.innerText = "Guardando...";
      const { error } = await window._supabase
        .from('alumnos')
        .insert([
          { 
            codigo_qr: codigoQR, 
            dni: dni, 
            nombre_apellido: nombre, 
            curso: curso, 
            foto_url: urlFoto, 
            pin: pin, 
            saldo: 0.00 
          }
        ]);

      if (error) {
        if (error.code === '23505') {
          mostrarError("El DNI o el Código de Tarjeta ya existen en el sistema.");
        } else {
          mostrarError("Error: " + error.message);
        }
      } else {
        alert(`¡Tarjeta asociadas con éxito a ${nombre}! Podés entregarle la tarjeta.`);
        document.getElementById('formAltaCajero').reset();
        imgPreview.src = SVG_DEFAULT;
        fotoBlobCapturada = null;
        document.getElementById('txtCodigoQR').focus(); // Listo para el siguiente
      }

    } catch (err) {
      console.error(err);
      mostrarError("Ocurrió un error inesperado.");
    } finally {
      btn.disabled = false;
      btn.innerText = "Registrar y Vincular Tarjeta";
    }
  });

  function mostrarError(txt) {
    const msgDiv = document.getElementById('msgAlta');
    msgDiv.innerText = txt;
    msgDiv.style.display = 'block';
  }
});
const IMGBB_API_KEY = '61a76cc12d06bd22948b4b5b76f5b45e';
const SVG_DEFAULT = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='110' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg>";

let fotoBlobCapturada = null;
let videoStream = null;

document.addEventListener('DOMContentLoaded', () => {
  const modalCamara = document.getElementById('modalCamara');
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvasFoto');
  const imgPreview = document.getElementById('imgPreview');

  if (imgPreview) imgPreview.src = SVG_DEFAULT;

  // 1. Abrir webcam
  const btnAbrirCamara = document.getElementById('btnAbrirCamara');
  if (btnAbrirCamara) {
    btnAbrirCamara.addEventListener('click', async () => {
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400 }, audio: false });
        if (video) video.srcObject = videoStream;
        if (modalCamara) modalCamara.style.display = 'flex';
      } catch (err) {
        alert("No se pudo acceder a la cámara. Comprobá los permisos del navegador.");
        console.error(err);
      }
    });
  }

  // 2. Capturar foto
  const btnCapturar = document.getElementById('btnCapturar');
  if (btnCapturar) {
    btnCapturar.addEventListener('click', () => {
      if (!canvas || !video) return;
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth || 300;
      canvas.height = video.videoHeight || 300;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        fotoBlobCapturada = blob;
        if (imgPreview) imgPreview.src = URL.createObjectURL(blob);
        cerrarCamara();
      }, 'image/jpeg', 0.85);
    });
  }

  // 3. Cerrar cámara
  const btnCerrarCamara = document.getElementById('btnCerrarCamara');
  if (btnCerrarCamara) btnCerrarCamara.addEventListener('click', cerrarCamara);

  function cerrarCamara() {
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());
    if (modalCamara) modalCamara.style.display = 'none';
  }

  // 4. Procesar Registro
  const formRegistro = document.getElementById('formRegistroAlumno');
  if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnGuardar = document.getElementById('btnGuardar');
      if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Procesando...";
      }

      const dni = document.getElementById('regDni').value.trim();
      const nombre = document.getElementById('regNombre').value.trim();
      const curso = document.getElementById('regCurso').value.trim();
      const pin = document.getElementById('regPin').value.trim();

      if (pin.length !== 4 || isNaN(pin)) {
        mostrarError("El PIN debe ser un número de 4 dígitos.");
        if (btnGuardar) {
          btnGuardar.disabled = false;
          btnGuardar.innerText = "Crear Mi Cuenta";
        }
        return;
      }

      let urlFotoFinal = `https://api.dicebear.com/7.x/bottts/svg?seed=${dni}`;

      try {
        if (fotoBlobCapturada) {
          if (btnGuardar) btnGuardar.innerText = "Subiendo foto...";
          const formData = new FormData();
          formData.append('image', fotoBlobCapturada);

          const resImgBB = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
          });

          const dataImgBB = await resImgBB.json();
          if (dataImgBB.success) {
            urlFotoFinal = dataImgBB.data.url;
          }
        }

        if (btnGuardar) btnGuardar.innerText = "Registrando alumno...";
        const client = window._supabase || supabase;
        const { error } = await client
          .from('alumnos')
          .insert([{
            dni: dni,
            nombre_apellido: nombre,
            curso: curso,
            foto_url: urlFotoFinal,
            pin: pin,
            saldo: 0.00
          }]);

        if (error) {
          if (error.code === '23505') {
            mostrarError("Este DNI ya se encuentra registrado.");
          } else {
            mostrarError("Error al registrarse: " + error.message);
          }
        } else {
          alert("¡Cuenta creada exitosamente! Podés dirigirte al cajero a cargar saldo.");
          formRegistro.reset();
          if (imgPreview) imgPreview.src = SVG_DEFAULT;
          fotoBlobCapturada = null;
        }
      } catch (err) {
        console.error(err);
        mostrarError("Ocurrió un error inesperado.");
      } finally {
        if (btnGuardar) {
          btnGuardar.disabled = false;
          btnGuardar.innerText = "Crear Mi Cuenta";
        }
      }
    });
  }

  function mostrarError(txt) {
    const msgDiv = document.getElementById('msgRegistro');
    if (msgDiv) {
      msgDiv.innerText = txt;
      msgDiv.style.display = 'block';
    } else {
      alert(txt);
    }
  }
});
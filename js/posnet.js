let posnetActual = null;
let montoIngresado = "0";
let qrEscaneadoActual = null;
let html5Qrcode = null;

// Usamos el cliente global inicializado en supabaseClient.js
const getDb = () => window._supabase;

window.onload = async () => {
    // 1. Verificar sesión activa
    const session = localStorage.getItem("posnet_session") || localStorage.getItem("usuarioBanco");

    if (!session) {
        alert("Sesión no válida o expirada. Redirigiendo al Login...");
        window.location.href = "index.html";
        return;
    }

    posnetActual = JSON.parse(session);

    // Verificar que el usuario tenga rol POSNET o ADMIN
    if (posnetActual.rol !== "POSNET" && posnetActual.rol !== "ADMIN") {
        alert("Acceso denegado: Este usuario no tiene permisos de POSNET.");
        window.location.href = "index.html";
        return;
    }

    document.getElementById("posnetNombre").innerText = `🏪 ${posnetActual.nombre || posnetActual.nombre_posnet}`;
    document.getElementById("posnetUsuario").innerText = `Cajero: ${posnetActual.usuario}`;

    await cargarMetricasPOSNET();

    // Inicializamos el objeto Html5Qrcode pero SIN encender la cámara de entrada
    html5Qrcode = new Html5Qrcode("reader");
};

async function cargarMetricasPOSNET() {
    if (!getDb()) return;

    const { data } = await getDb()
        .from("posnets")
        .select("monto_acumulado, cant_transacciones")
        .eq("id", posnetActual.id)
        .maybeSingle();

    if (data) {
        document.getElementById("montoAcumulado").innerText = `$ ${(data.monto_acumulado || 0).toLocaleString()}`;
        document.getElementById("cantVentas").innerText = data.cant_transacciones || 0;
    }
}

// --- TECLADO NUMÉRICO ---
function pressKey(val) {
    if (montoIngresado === "0") montoIngresado = val;
    else montoIngresado += val;
    updateDisplay();
}

function clearKeypad() {
    montoIngresado = "0";
    updateDisplay();
}

function updateDisplay() {
    document.getElementById("displayMonto").innerText = `$ ${parseInt(montoIngresado).toLocaleString()}`;
}

// --- NUEVO FLUJO: BOTÓN COBRAR Y CÁMARA ---

// Se ejecuta al hacer clic en el botón "Cobrar"
async function iniciarCobro() {
    const monto = parseInt(montoIngresado);
    if (monto <= 0) {
        showStatus("🔴 Ingrese un monto mayor a $0 para cobrar", "alert-danger");
        return;
    }

    // Abrir modal de escáner QR
    const modalScannerElem = document.getElementById("modalScanner");
    const modalScanner = new bootstrap.Modal(modalScannerElem);
    modalScanner.show();

    // Encender la cámara
    try {
        await html5Qrcode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            onScanSuccess
        );
        showStatus("📷 Escanee la tarjeta del alumno...", "alert-info");
    } catch (err) {
        console.error("Error al iniciar cámara:", err);
        alert("No se pudo acceder a la cámara del dispositivo.");
        modalScanner.hide();
    }
}

// Al detectar un código QR
async function onScanSuccess(decodedText) {
    // Detener y apagar la cámara de inmediato para ahorrar batería
    await detenerCamara();

    // Cerrar el modal del lector QR
    const modalScannerElem = document.getElementById("modalScanner");
    const modalScanner = bootstrap.Modal.getInstance(modalScannerElem);
    if (modalScanner) modalScanner.hide();

    qrEscaneadoActual = decodedText;

    // Consultar alumno en Supabase
    const { data: alumno, error } = await getDb()
        .from("alumnos")
        .select("nombre_apellido, foto_url")
        .eq("codigo_qr", decodedText)
        .maybeSingle();

    if (error || !alumno) {
        alert("❌ Tarjeta o QR no registrado en el sistema.");
        showStatus("🟡 Ingrese el monto a cobrar", "alert-secondary");
        return;
    }

    // Cargar datos del alumno en el modal del PIN
    document.getElementById("modalAlumnoNombre").innerText = alumno.nombre_apellido;
    document.getElementById("modalAlumnoFoto").src = alumno.foto_url || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    document.getElementById("modalMontoCobrar").innerText = `$ ${parseInt(montoIngresado).toLocaleString()}`;
    document.getElementById("inputPin").value = "";

    // Mostrar modal del PIN
    const modalPin = new bootstrap.Modal(document.getElementById("modalPin"));
    modalPin.show();
    setTimeout(() => document.getElementById("inputPin").focus(), 300);
}

// Apaga físicamente el hardware de la cámara
async function detenerCamara() {
    if (html5Qrcode && html5Qrcode.isScanning) {
        try {
            await html5Qrcode.stop();
        } catch (err) {
            console.error("Error al apagar la cámara:", err);
        }
    }
}

// Cancelar escáner desde el modal QR
async function cancelarEscaneo() {
    await detenerCamara();
    const modalScannerElem = document.getElementById("modalScanner");
    const modalScanner = bootstrap.Modal.getInstance(modalScannerElem);
    if (modalScanner) modalScanner.hide();
    showStatus("🟡 Cobro cancelado", "alert-secondary");
}

// --- CONFIRMACIÓN Y PROCESAMIENTO ---
async function confirmarPago() {
    const pin = document.getElementById("inputPin").value.trim();
    const monto = parseInt(montoIngresado);

    if (pin.length < 4) {
        alert("Ingrese el PIN completo de 4 dígitos");
        return;
    }

    // Ejecutamos el RPC enviando 'COBRO' como tipo
    const { data, error } = await getDb().rpc("procesar_pago_posnet", {
        p_codigo_qr: qrEscaneadoActual,
        p_pin: pin,
        p_monto: monto,
        p_posnet_id: posnetActual.id,
        p_tipo: "COBRO" // 👈 Especificamos el tipo explícito para la transacción
    });

    const modalElement = document.getElementById("modalPin");
    const modal = bootstrap.Modal.getInstance(modalElement);

    if (error || !data.exito) {
        alert(`❌ ${data ? data.mensaje : error.message}`);
        document.getElementById("inputPin").value = "";
        document.getElementById("inputPin").focus();
    } else {
        if (modal) modal.hide();
        showStatus(`✅ ¡PAGO APROBADO! $${monto.toLocaleString()}`, "alert-success");
        clearKeypad();
        await cargarMetricasPOSNET();

        setTimeout(() => {
            showStatus("🟡 Ingrese el monto a cobrar", "alert-secondary");
        }, 3000);
    }
}

function cancelarPago() {
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalPin"));
    if (modal) modal.hide();
    showStatus("🟡 Cobro cancelado", "alert-secondary");
}

function showStatus(text, bgClass) {
    const box = document.getElementById("statusBox");
    if (box) {
        box.className = `status-bar ${bgClass} mt-3`;
        box.innerText = text;
    }
}
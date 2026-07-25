let posnetActual = null;
let montoIngresado = "0";
let qrEscaneadoActual = null;
let html5QrcodeScanner = null;

// Usamos el cliente global inicializado en supabaseClient.js
const getDb = () => window._supabase;

window.onload = async () => {
    // 1. Verificar sesión activa (usando la clave guardada en el Login unificado)
    const session = localStorage.getItem("posnet_session") || localStorage.getItem("usuarioBanco");

    if (!session) {
        alert("Sesión no válida o expirada. Redirigiendo al Login...");
        window.location.href = "index.html"; // 👈 Redirección corregida al Login único
        return;
    }

    posnetActual = JSON.parse(session);

    // Verificar que el usuario tenga rol POSNET
    if (posnetActual.rol !== "POSNET" && posnetActual.rol !== "ADMIN") {
        alert("Acceso denegado: Este usuario no tiene permisos de POSNET.");
        window.location.href = "index.html";
        return;
    }

    document.getElementById("posnetNombre").innerText = `🏪 ${posnetActual.nombre || posnetActual.nombre_posnet}`;
    document.getElementById("posnetUsuario").innerText = `Cajero: ${posnetActual.usuario}`;

    await cargarMetricasPOSNET();
    iniciarCamara();
};

async function cargarMetricasPOSNET() {
    if (!getDb()) return;

    const { data, error } = await getDb()
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

// --- CÁMARA Y ESCÁNER ---
function iniciarCamara() {
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        onScanSuccess
    );
}

async function onScanSuccess(decodedText) {
    const monto = parseInt(montoIngresado);
    if (monto <= 0) {
        showStatus("🔴 Ingrese un monto mayor a $0", "alert-danger");
        return;
    }

    html5QrcodeScanner.pause();
    qrEscaneadoActual = decodedText;

    // Consultar alumno
    const { data: alumno } = await getDb()
        .from("alumnos")
        .select("nombre_apellido, foto_url")
        .eq("codigo_qr", decodedText)
        .maybeSingle();

    if (!alumno) {
        // Si la tarjeta no existe, muestra cartel por 4s y reanuda solo
        showStatus("❌ Tarjeta / QR no registrado", "alert-danger");
        setTimeout(() => {
            showStatus("🟡 Ingrese el monto a cobrar", "alert-secondary");
            html5QrcodeScanner.resume();
        }, 4000);
        return;
    }

    // Cargar datos en el modal
    document.getElementById("modalAlumnoNombre").innerText = alumno.nombre_apellido;
    document.getElementById("modalAlumnoFoto").src = alumno.foto_url || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    document.getElementById("modalMontoCobrar").innerText = `$ ${monto.toLocaleString()}`;
    document.getElementById("inputPin").value = "";

    const modalPin = new bootstrap.Modal(document.getElementById("modalPin"));
    modalPin.show();
    document.getElementById("inputPin").focus();
}

async function confirmarPago() {
    const pin = document.getElementById("inputPin").value.trim();
    const monto = parseInt(montoIngresado);

    if (pin.length < 4) {
        alert("Ingrese el PIN completo de 4 dígitos");
        return;
    }

    // Ejecutamos la función de cobro en Supabase
    const { data, error } = await getDb().rpc("procesar_pago_posnet", {
        p_codigo_qr: qrEscaneadoActual,
        p_pin: pin,
        p_monto: monto,
        p_posnet_id: posnetActual.id
    });

    const modalElement = document.getElementById("modalPin");
    const modal = bootstrap.Modal.getInstance(modalElement);

    if (error || !data.exito) {
        alert(`❌ ${data ? data.mensaje : error.message}`);
        document.getElementById("inputPin").value = "";
        document.getElementById("inputPin").focus();
    } else {
        modal.hide();
        showStatus(`✅ ¡PAGO APROBADO! $${monto}`, "alert-success");
        clearKeypad();
        await cargarMetricasPOSNET();

        setTimeout(() => {
            showStatus("🟡 Ingrese el monto a cobrar", "alert-secondary");
            html5QrcodeScanner.resume();
        }, 2500);
    }
}

function cancelarPago() {
    bootstrap.Modal.getInstance(document.getElementById("modalPin")).hide();
    showStatus("🟡 Cobro cancelado", "alert-secondary");
    html5QrcodeScanner.resume();
}

function showStatus(text, bgClass) {
    const box = document.getElementById("statusBox");
    box.className = `status-bar ${bgClass} mt-3`;
    box.innerText = text;
}
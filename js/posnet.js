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

// --- TECLADO NUMÉRICO DE COBRO ---
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

// --- FLUJO: BOTÓN COBRAR Y CÁMARA ---

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
    // 1. Apagar cámara
    await detenerCamara();

    // 2. Cerrar el modal del lector QR
    const modalScannerElem = document.getElementById("modalScanner");
    const modalScanner = bootstrap.Modal.getInstance(modalScannerElem);
    if (modalScanner) modalScanner.hide();

    qrEscaneadoActual = decodedText;

    // 3. Consultar alumno en Supabase
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

    // 4. Cargar datos del alumno en el modal del PIN
    document.getElementById("modalAlumnoNombre").innerText = alumno.nombre_apellido;
    document.getElementById("modalAlumnoFoto").src = alumno.foto_url || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    document.getElementById("modalMontoCobrar").innerText = `$ ${parseInt(montoIngresado).toLocaleString()}`;

    // Limpiar pantalla del PIN virtual
    clearPin();

    // 5. Mostrar modal del PIN tras pequeño tiempo de espera
    setTimeout(() => {
        const modalPinElem = document.getElementById("modalPin");
        const modalPin = new bootstrap.Modal(modalPinElem);
        modalPin.show();
    }, 300);
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


// --- MANEJO DEL PIN ESTILO .NET (MEMORIA PRIVADA) ---

let pinMemoria = "";

function pressPinKey(num) {
    if (pinMemoria.length < 4) {
        pinMemoria += num;
        actualizarDisplayPin();
    }
}

function deletePinKey() {
    pinMemoria = pinMemoria.slice(0, -1);
    actualizarDisplayPin();
}

function clearPin() {
    pinMemoria = "";
    actualizarDisplayPin();
}

function actualizarDisplayPin() {
    const display = document.getElementById("displayPin");
    if (!display) return;

    if (pinMemoria.length === 0) {
        display.innerText = "____";
    } else {
        display.innerText = "* ".repeat(pinMemoria.length).trim();
    }
}

// Capturar el teclado físico del PC si presiona números o 'Backspace'
document.addEventListener("keydown", (e) => {
    const modalPin = document.getElementById("modalPin");
    if (modalPin && modalPin.classList.contains("show")) {
        if (e.key >= "0" && e.key <= "9") {
            pressPinKey(e.key);
        } else if (e.key === "Backspace") {
            deletePinKey();
        } else if (e.key === "Enter") {
            confirmarPago();
        }
    }
});


// --- CONFIRMAR PAGO ---

async function confirmarPago() {
    const monto = parseInt(montoIngresado);

    if (pinMemoria.length < 4) {
        alert("Ingrese el PIN completo de 4 dígitos");
        return;
    }

    // Verificación de validez del UUID
    if (!posnetActual || !posnetActual.id || posnetActual.id.length < 30) {
        alert("❌ Error de sesión: El ID del POSNET no es un UUID válido. Inicie sesión nuevamente.");
        return;
    }

    // Ejecutamos la función almacenada (RPC)
    const { data, error } = await getDb().rpc("procesar_pago_posnet", {
        p_codigo_qr: qrEscaneadoActual,
        p_pin: pinMemoria,
        p_monto: monto,
        p_posnet_id: posnetActual.id,
        p_tipo: "COBRO"
    });

    if (error || !data.exito) {
        alert(`❌ ${data ? data.mensaje : error.message}`);
        clearPin();
    } else {
        const nombreAlumno = document.getElementById("modalAlumnoNombre").innerText;

        // Ocultar Modal de PIN
        const modalPinElem = document.getElementById("modalPin");
        const modalPin = bootstrap.Modal.getInstance(modalPinElem);
        if (modalPin) modalPin.hide();

        // Cargar datos en Modal de Éxito
        document.getElementById("exitoMonto").innerText = `$ ${monto.toLocaleString()}`;
        document.getElementById("exitoAlumno").innerText = nombreAlumno;

        // Resetear variables y métricas
        clearKeypad();
        clearPin();
        await cargarMetricasPOSNET();

        // Mostrar Modal de Éxito
        setTimeout(() => {
            const modalExitoElem = document.getElementById("modalExito");
            const modalExito = new bootstrap.Modal(modalExitoElem);
            modalExito.show();
        }, 300);
    }
}

// Función para cerrar el modal de éxito
function cerrarExito() {
    const modalExitoElem = document.getElementById("modalExito");
    const modalExito = bootstrap.Modal.getInstance(modalExitoElem);
    if (modalExito) modalExito.hide();

    showStatus("🟡 Ingrese el monto a cobrar", "alert-secondary");
}

function cancelarPago() {
    clearPin();
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalPin"));
    if (modal) modal.hide();
    showStatus("🟡 Cobro cancelado", "alert-secondary");
}

function showStatus(text, bgClass) {
    const box = document.getElementById("statusBox");
    if (box) {
        box.className = `status-bar alert ${bgClass} text-center fw-bold mb-3`;
        box.innerText = text;
    }
}
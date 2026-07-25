

//  const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
//const SUPABASE_KEY = "TU_ANON_KEY";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let html5QrcodeScanner = null;

window.onload = () => {
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess
    );
};

async function onScanSuccess(codigoQr) {
    html5QrcodeScanner.pause();

    // Consultar Alumno en Supabase
    const { data: alumno } = await db.from("alumnos").select("nombre_apellido, curso, saldo, foto_url").eq("codigo_qr", codigoQr).single();

    if (!alumno) {
        // MOSTRAR PANTALLA DE ERROR POR 4 SEGUNDOS
        document.getElementById("viewScan").classList.add("d-none");
        document.getElementById("viewError").classList.remove("d-none");

        iniciarTemporizadorReiniciar("viewError", "progressBarError", 4);
        return;
    }

    // MOSTRAR PANTALLA DE ÉXITO POR 6 SEGUNDOS
    document.getElementById("resNombre").innerText = alumno.nombre_apellido;
    document.getElementById("resCurso").innerText = alumno.curso || "Alumno";
    document.getElementById("resSaldo").innerText = `$ ${alumno.saldo.toLocaleString()}`;
    document.getElementById("resFoto").src = alumno.foto_url || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

    document.getElementById("viewScan").classList.add("d-none");
    document.getElementById("viewResult").classList.remove("d-none");

    iniciarTemporizadorReiniciar("viewResult", "progressBar", 6);
}

function iniciarTemporizadorReiniciar(viewActualId, progressBarId, segundos) {
    let tiempo = segundos;
    const progress = document.getElementById(progressBarId);
    progress.style.width = "100%";

    const interval = setInterval(() => {
        tiempo--;
        progress.style.width = `${(tiempo / segundos) * 100}%`;

        if (tiempo <= 0) {
            clearInterval(interval);
            // Ocultar pantalla actual y volver al escáner
            document.getElementById(viewActualId).classList.add("d-none");
            document.getElementById("viewScan").classList.remove("d-none");
            html5QrcodeScanner.resume();
        }
    }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper de tu API existente en Apps Script (SCRIPT_URL)
// Todas las funciones acá simplemente arman la URL/body y hacen fetch.
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT_URL = process.env.APPS_SCRIPT_URL; // tu SCRIPT_URL, ej: https://script.google.com/macros/s/.../exec

async function readPath(path, params = {}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('path', path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString());
  return resp.json();
}

async function writePath(path, body = {}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('path', path);
  url.searchParams.set('_body', JSON.stringify(body));
  const resp = await fetch(url.toString());
  return resp.json();
}

// ── Funciones de negocio, mapeadas 1:1 a tus endpoints existentes ──────────

async function listarProfesionales() {
  return readPath('profesionales');
}

async function buscarProfesionalPorNombre(nombreParcial) {
  const data = await listarProfesionales();
  const q = (nombreParcial || '').toLowerCase();
  return (data.profesionales || []).filter(
    (p) =>
      p.nombre.toLowerCase().includes(q) ||
      p.especialidad.toLowerCase().includes(q)
  );
}

async function turnosDisponibles(profesionalId, fecha) {
  return readPath('turnos', { profesional_id: profesionalId, fecha });
}

async function crearTurno({ profesional_id, fecha, hora, paciente_nombre, paciente_email, sin_pago }) {
  return writePath('turnos', {
    profesional_id,
    fecha,
    hora,
    paciente_nombre,
    paciente_email,
    sin_pago: !!sin_pago
  });
}

async function turnosDelPaciente(email) {
  return readPath('turnos_paciente', { email });
}

async function getConversacion(telefono) {
  return readPath('conversacion', { telefono });
}

async function guardarConversacion(telefono, estado) {
  return writePath('conversacion', { telefono, estado });
}

module.exports = {
  listarProfesionales,
  buscarProfesionalPorNombre,
  turnosDisponibles,
  crearTurno,
  turnosDelPaciente,
  getConversacion,
  guardarConversacion
};

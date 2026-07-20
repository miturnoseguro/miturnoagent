// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API (Meta) — envío de mensajes
// ─────────────────────────────────────────────────────────────────────────────

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GRAPH_VERSION = 'v20.0';

async function enviarTexto(telefono, texto) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: telefono,
    type: 'text',
    text: { body: texto }
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error('Error enviando WhatsApp:', err);
  }
  return resp.ok;
}

// Extrae el mensaje de texto entrante de un payload de webhook de Meta.
// Devuelve null si el evento no es un mensaje de texto (ej: status update).
function extraerMensajeEntrante(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const mensaje = value?.messages?.[0];
    if (!mensaje) return null;
    if (mensaje.type !== 'text') {
      return { telefono: mensaje.from, texto: null, tipoNoSoportado: mensaje.type };
    }
    return { telefono: mensaje.from, texto: mensaje.text.body };
  } catch (e) {
    return null;
  }
}

module.exports = { enviarTexto, extraerMensajeEntrante };

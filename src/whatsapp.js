// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp vía Twilio (mucho más simple que la API directa de Meta)
// Sandbox para probar ya mismo, y el mismo código sirve para producción
// cuando pidas un número de WhatsApp propio en Twilio.
// ─────────────────────────────────────────────────────────────────────────────

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
// Número "from" de Twilio, formato: whatsapp:+14155238886 (el del Sandbox)
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

async function enviarTexto(telefono, texto) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const params = new URLSearchParams();
  params.set('From', TWILIO_WHATSAPP_FROM);
  params.set('To', telefono.startsWith('whatsapp:') ? telefono : `whatsapp:${telefono}`);
  params.set('Body', texto);

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('Error enviando WhatsApp (Twilio):', err);
  }
  return resp.ok;
}

// Twilio manda el webhook como formulario (application/x-www-form-urlencoded),
// no como JSON. server.js ya está preparado para parsearlo con express.urlencoded().
// req.body llega con campos como: From, To, Body, ProfileName, etc.
function extraerMensajeEntrante(body) {
  try {
    const from = body.From; // ej: "whatsapp:+5491122334455"
    const texto = body.Body;
    if (!from) return null;

    const telefono = from.replace('whatsapp:', '');

    if (!texto) {
      // Mensaje sin texto (audio, imagen, ubicación, etc.)
      return { telefono, texto: null, tipoNoSoportado: body.MediaContentType0 || 'desconocido' };
    }

    return { telefono, texto };
  } catch (e) {
    return null;
  }
}

module.exports = { enviarTexto, extraerMensajeEntrante };

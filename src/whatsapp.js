// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp vía Baileys (no oficial) — conexión tipo WhatsApp Web, sin Meta.
//
// Diferencia clave con la versión de Meta Cloud API: acá no hay webhook.
// La conexión es un socket persistente: se inicia una vez (con iniciar()) y
// empuja los mensajes entrantes por eventos. Por eso server.js ya no expone
// /webhook — en su lugar llama a iniciar(handler) al arrancar.
//
// Primera vez que corras esto: va a aparecer un QR en la terminal. Escaneálo
// desde WhatsApp > Dispositivos vinculados > Vincular un dispositivo.
// La sesión queda guardada en la carpeta ./auth_info (agregala a .gitignore).
// ─────────────────────────────────────────────────────────────────────────────

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth_info');

let sock = null;
let mensajeHandler = null; // callback({ telefono, texto }) que setea server.js

// Arranca (o reconecta) la sesión de WhatsApp. `onMensaje` es el callback que
// se llama por cada mensaje de texto entrante.
async function iniciar(onMensaje) {
  if (onMensaje) mensajeHandler = onMensaje;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Mi Turno Seguro', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escaneá este QR desde WhatsApp > Dispositivos vinculados:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const debeReconectar = statusCode !== DisconnectReason.loggedOut;
      console.log(
        '🔌 Conexión de WhatsApp cerrada.',
        debeReconectar ? 'Reintentando...' : 'Sesión cerrada — borrá auth_info/ y volvé a escanear el QR.'
      );
      if (debeReconectar) iniciar();
    } else if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp (Baileys)');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid || '';
      if (remoteJid.endsWith('@g.us')) continue; // ignoramos grupos por ahora

      const telefono = remoteJid.replace('@s.whatsapp.net', '');
      const texto =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        null;

      if (!mensajeHandler) continue;

      try {
        await mensajeHandler({ telefono, texto });
      } catch (e) {
        console.error('Error en el handler de mensaje entrante:', e);
      }
    }
  });

  return sock;
}

// Misma firma que la versión de Meta: enviarTexto(telefono, texto) -> boolean
async function enviarTexto(telefono, texto) {
  if (!sock) {
    console.error('Error enviando WhatsApp: el socket todavía no está conectado');
    return false;
  }
  const jid = telefono.includes('@') ? telefono : `${telefono}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jid, { text: texto });
    return true;
  } catch (e) {
    console.error('Error enviando WhatsApp:', e);
    return false;
  }
}

module.exports = { iniciar, enviarTexto };

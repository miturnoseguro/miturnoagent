require('dotenv').config();
const express = require('express');
const whatsapp = require('./whatsapp');
const agent = require('./agent');
const appScript = require('./appScriptClient');

const app = express();
// Twilio manda el webhook como formulario (application/x-www-form-urlencoded),
// no como JSON, a diferencia de la API directa de Meta.
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const MAX_HISTORIAL = 20; // mensajes a retener por conversación, para no crecer sin límite

// Nota: Twilio no requiere un paso de verificación GET como pedía Meta.
// Solo hay que configurar la URL de este /webhook en la consola de Twilio.

// ── Recepción de mensajes ───────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Responder rápido a Twilio; el procesamiento sigue en segundo plano.
  res.sendStatus(200);

  const entrante = whatsapp.extraerMensajeEntrante(req.body);
  if (!entrante) return; // status update u otro evento, ignorar

  if (!entrante.texto) {
    await whatsapp.enviarTexto(
      entrante.telefono,
      'Por ahora solo puedo leer mensajes de texto 🙏 ¿Me contás en palabras qué necesitás?'
    );
    return;
  }

  try {
    const { telefono, texto } = entrante;

    // Cargar historial guardado en la hoja Conversaciones (vía Apps Script)
    const conv = await appScript.getConversacion(telefono);
    const historial = conv.estado?.historial || [];

    const { respuestaTexto, historialActualizado } = await agent.procesarMensaje(historial, texto);

    // Recortar historial para no acumular indefinidamente
    const historialRecortado = historialActualizado.slice(-MAX_HISTORIAL);
    await appScript.guardarConversacion(telefono, { historial: historialRecortado });

    await whatsapp.enviarTexto(telefono, respuestaTexto || 'Disculpá, no pude procesar eso.');
  } catch (err) {
    console.error('Error procesando mensaje:', err);
    await whatsapp.enviarTexto(
      entrante.telefono,
      'Tuvimos un problema técnico. Probá de nuevo en un rato 🙏'
    );
  }
});

app.get('/', (_req, res) => res.send('Mi Turno Seguro — agente de WhatsApp activo'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agente escuchando en puerto ${PORT}`));

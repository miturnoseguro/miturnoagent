require('dotenv').config();
const express = require('express');
const whatsapp = require('./src/whatsapp');
const agent = require('./src/agent');
const appScript = require('./src/appScriptClient');

const app = express();
app.use(express.json());

const MAX_HISTORIAL = 20; // mensajes a retener por conversación, para no crecer sin límite

// ── Procesamiento de cada mensaje entrante (antes vivía en POST /webhook) ──
async function procesarEntrante({ telefono, texto }) {
  if (!texto) {
    await whatsapp.enviarTexto(
      telefono,
      'Por ahora solo puedo leer mensajes de texto 🙏 ¿Me contás en palabras qué necesitás?'
    );
    return;
  }

  try {
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
    await whatsapp.enviarTexto(telefono, 'Tuvimos un problema técnico. Probá de nuevo en un rato 🙏');
  }
}

app.get('/', (_req, res) => res.send('Mi Turno Seguro — agente de WhatsApp activo (Baileys)'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agente escuchando en puerto ${PORT}`));

// Arranca la conexión de WhatsApp (va a imprimir un QR la primera vez).
whatsapp.iniciar(procesarEntrante).catch((err) => {
  console.error('No se pudo iniciar la conexión de WhatsApp:', err);
});

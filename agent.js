const Anthropic = require('@anthropic-ai/sdk');
const appScript = require('./appScriptClient');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sos el asistente de WhatsApp de Mi Turno Seguro, una plataforma para
reservar turnos médicos. Hablás en español rioplatense, tono cordial y breve —
estás en WhatsApp, no mandes párrafos largos.

Tu trabajo:
1. Ayudar al paciente a encontrar un profesional (por nombre o especialidad).
2. Mostrarle horarios disponibles para una fecha.
3. Reservar el turno, pidiendo antes su nombre completo y email (necesarios para
   la reserva y el link de pago si el profesional cobra por Mercado Pago).
4. Si la reserva devuelve un init_point (link de pago), pasáselo tal cual para
   que complete el pago.
5. Si el paciente pregunta por sus turnos ya reservados, pedile el email y
   usá la herramienta correspondiente.

Reglas:
- No inventes profesionales, horarios ni precios: siempre usá las herramientas.
- Si falta un dato (fecha, nombre, email), preguntalo antes de reservar.
- Si un horario ya no está disponible, ofrecé otro de la misma lista.
- Nunca dupliques una reserva sin confirmación explícita del paciente.`;

const TOOLS = [
  {
    name: 'buscar_profesional',
    description: 'Busca profesionales por nombre o especialidad (ej: "dermatóloga", "Gómez").',
    input_schema: {
      type: 'object',
      properties: { consulta: { type: 'string', description: 'Nombre o especialidad a buscar' } },
      required: ['consulta']
    }
  },
  {
    name: 'ver_horarios_disponibles',
    description: 'Devuelve los horarios disponibles de un profesional para una fecha dada.',
    input_schema: {
      type: 'object',
      properties: {
        profesional_id: { type: 'string' },
        fecha: { type: 'string', description: 'Formato YYYY-MM-DD' }
      },
      required: ['profesional_id', 'fecha']
    }
  },
  {
    name: 'reservar_turno',
    description: 'Reserva un turno para el paciente. Usar solo tras confirmar profesional, fecha, hora, nombre y email con el paciente.',
    input_schema: {
      type: 'object',
      properties: {
        profesional_id: { type: 'string' },
        fecha: { type: 'string' },
        hora: { type: 'string' },
        paciente_nombre: { type: 'string' },
        paciente_email: { type: 'string' }
      },
      required: ['profesional_id', 'fecha', 'hora', 'paciente_nombre', 'paciente_email']
    }
  },
  {
    name: 'ver_mis_turnos',
    description: 'Lista los turnos reservados de un paciente dado su email.',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string' } },
      required: ['email']
    }
  }
];

async function ejecutarHerramienta(nombre, input) {
  switch (nombre) {
    case 'buscar_profesional':
      return appScript.buscarProfesionalPorNombre(input.consulta);
    case 'ver_horarios_disponibles':
      return appScript.turnosDisponibles(input.profesional_id, input.fecha);
    case 'reservar_turno':
      return appScript.crearTurno(input);
    case 'ver_mis_turnos':
      return appScript.turnosDelPaciente(input.email);
    default:
      return { error: 'Herramienta desconocida: ' + nombre };
  }
}

// historial: array de mensajes { role, content } en formato Anthropic.
// Devuelve { respuestaTexto, historialActualizado }
async function procesarMensaje(historial, mensajeUsuario) {
  const messages = [...historial, { role: 'user', content: mensajeUsuario }];

  // Loop de tool-use: Claude puede pedir varias herramientas antes de responder en texto.
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const respuesta = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages
    });

    messages.push({ role: 'assistant', content: respuesta.content });

    const tieneToolUse = respuesta.content.some((b) => b.type === 'tool_use');
    if (!tieneToolUse) {
      const textoFinal = respuesta.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return { respuestaTexto: textoFinal, historialActualizado: messages };
    }

    const toolResults = [];
    for (const bloque of respuesta.content) {
      if (bloque.type !== 'tool_use') continue;
      const resultado = await ejecutarHerramienta(bloque.name, bloque.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: bloque.id,
        content: JSON.stringify(resultado)
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return {
    respuestaTexto: 'Perdón, tuve un problema procesando tu pedido. ¿Podés reformularlo?',
    historialActualizado: messages
  };
}

module.exports = { procesarMensaje };

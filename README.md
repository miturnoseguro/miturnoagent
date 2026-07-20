# Agente de WhatsApp — Mi Turno Seguro

Bot de WhatsApp que conversa con el paciente, consulta disponibilidad y reserva
turnos usando tu Apps Script existente como única fuente de datos. No reemplaza
tu backend: lo llama.

## Arquitectura

```
Paciente (WhatsApp)
   │
   ▼
Meta WhatsApp Cloud API  ──webhook──▶  server.js (Node/Express)
                                            │
                                            ├─▶ Claude (decide qué hacer)
                                            │
                                            └─▶ Apps Script (tu API actual:
                                                 profesionales, turnos,
                                                 disponibilidad, conversacion)
                                                     │
                                                     └─▶ Google Sheets + Mercado Pago
```

El estado de cada conversación (qué se habló, qué eligió el paciente) se
guarda en una hoja nueva `Conversaciones` de tu mismo spreadsheet — no hace
falta una base de datos adicional.

## 1. Preparar el Apps Script

1. Abrí tu proyecto de Apps Script actual.
2. Pegá el contenido de `AGREGAR_A_CODE_GS.js` (las funciones nuevas) y aplicá
   los 4 cambios indicados en los comentarios (agregar rutas a `SHEETS`,
   `routeRead` y `routeWrite`).
3. Ejecutá una vez la función `crearHojaConversaciones()` desde el editor
   para crear la hoja nueva.
4. **Importante:** para que el bot pueda guardar el teléfono del paciente,
   agregá una columna `paciente_telefono` a la hoja `Turnos` y actualizá
   `crearTurnoData()` para guardarla cuando venga del canal WhatsApp (te lo
   dejo como ajuste fino, avisame si querés que te lo prepare).
5. Volvé a implementar el Apps Script como Web App (Deploy > Manage
   deployments > Edit > New version) para que los cambios queden activos en
   el mismo `SCRIPT_URL` que ya usás.

## 2. Crear la app de WhatsApp en Meta

1. Entrá a [developers.facebook.com](https://developers.facebook.com) →
   crear una app tipo "Business".
2. Agregarle el producto **WhatsApp**.
3. En "API Setup" vas a ver un número de prueba, un `Temporary access token`
   y el `Phone number ID`. Para producción real necesitás verificar tu
   negocio y usar un número propio — pero para probar podés arrancar con el
   número de test que te da Meta.
4. Estos datos van en tu `.env`: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.

## 3. Configurar el webhook

1. Desplegá este proyecto (ver sección 4) para tener una URL pública, por
   ejemplo `https://tu-agente.onrender.com`.
2. En Meta, en la sección "Webhook" de tu app de WhatsApp, configurá:
   - **Callback URL**: `https://tu-agente.onrender.com/webhook`
   - **Verify token**: el mismo valor que pusiste en `WHATSAPP_VERIFY_TOKEN`
3. Suscribite al campo `messages`.

## 4. Deploy

Cualquier hosting que corra Node de forma persistente sirve — Render,
Railway, Fly.io. (Evitá funciones serverless con cold-start muy agresivo si
querés respuestas rápidas, aunque también funcionan.)

Pasos genéricos (ejemplo con Render):
1. Subí esta carpeta a un repo de GitHub.
2. En Render: New → Web Service → conectá el repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Cargá las variables de entorno del `.env.example` en el panel de Render.
5. Deploy. Copiá la URL pública y usala en el webhook de Meta (paso 3).

## 5. Probar

Mandale un WhatsApp al número de prueba de Meta: "Hola, quiero un turno con
un dermatólogo para el jueves". El agente debería buscar profesionales,
mostrar horarios y guiar la reserva.

## Notas y próximos pasos sugeridos

- **Pagos**: cuando el agente reserva con Mercado Pago, te devuelve el
  `init_point` (link de pago) y se lo pasa al paciente como texto. Si querés
  que se vea como botón, se puede migrar a un mensaje "interactive" de la
  Cloud API — te lo armo si te interesa.
- **Confirmación post-pago por WhatsApp**: tu webhook de MP ya marca el turno
  como `confirmado`. Para que el paciente reciba el aviso por WhatsApp
  (no solo el profesional), hay que guardar su teléfono en la reserva y
  llamar a `enviarWhatsAppOficial()` desde `handleWebhookData()` — dejé el
  bloque comentado en `AGREGAR_A_CODE_GS.js`.
- **Multi-negocio**: si en algún momento tu app deja de ser mono-tenant,
  este agente ya está listo para eso — cada `profesional_id` viaja
  explícito en cada llamada.
- **Costos**: WhatsApp Cloud API cobra por conversación (no por mensaje)
  luego de la ventana gratuita; revisá el pricing actual en Meta for
  Developers antes de escalar.

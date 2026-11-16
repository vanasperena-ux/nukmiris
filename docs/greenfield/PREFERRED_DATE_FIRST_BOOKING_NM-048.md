# NM-048 — Flujo opcional: preguntar fecha preferida antes de mostrar horarios

**Fecha de decisión:** 2026-11-15  
**Estado:** OPEN — decisión funcional del propietario documentada; **NO AUTORIZADO PARA IMPLEMENTACIÓN**  
**Prioridad:** P2 (propuesta de backlog; revisar antes de lanzamiento)  
**Alcance:** por negocio, no por servicio; no cambia el flujo actual hasta implementación/aprobación explícita.  
**Autoridad relevante:** Decisión 147 — exactamente un servicio por cita.

## Propósito

Permitir que negocios cuyos clientes suelen tener una fecha concreta en mente pidan **primero la fecha preferida**, antes de ofrecer horarios. El flujo actual **“mostrar próximas disponibilidades primero”** se mantiene como comportamiento predeterminado y no se modifica en SE-1.

## Experiencia del propietario

En la futura interfaz de configuración de reservas, mostrar una sola opción por negocio:

**«Preguntar primero por la fecha preferida»**  
- **Desactivado (predeterminado)**: conservar íntegro el flujo actual de servicio → dos próximos horarios → más horarios / elegir fecha, según las reglas ya aceptadas.
- **Activado**: después de elegir un servicio (o directamente cuando solo existe uno), solicitar una fecha al cliente antes de buscar horarios.
- La elección se guarda por negocio. Ninguna configuración de Juanita puede alterar la de Bernard.
- El ajuste afecta a **nuevas conversaciones de reserva**; una reserva iniciada debe continuar con su flujo y ofertas existentes sin reescrituras inesperadas al cambiar el toggle.
- No cambiar la forma de asignación automática del empleado ni introducir selector de empleado.

## Experiencia del cliente en WhatsApp: toggle ON

1. Cliente entra por `menu`, `cita` o el acceso actual permitido; conservar las respuestas, los resúmenes de citas próximas y los controles de intención que ya estén aprobados.
2. Cliente selecciona **exactamente un servicio** si hay varios activos; si existe solo uno, se reutiliza el paso directo del servicio.
3. NukMiris pregunta: **«¿Qué día prefieres para tu cita? Puedes escribir, por ejemplo, “20 de noviembre” o “viernes”.»**
4. La fecha se interpreta en la zona horaria del negocio y se valida con las reglas existentes: no se admiten fechas pasadas, fuera del horizonte, imposibles o ambiguas sin aclaración. Se deben conservar rutas de recuperación (`menu`, etc.).
5. Buscar desde la **fecha preferida inclusive**, sin ofrecer fechas previas en la primera respuesta. Ordenar cronológicamente las disponibilidades válidas del servicio y recursos/empleados calificados; no reservar nada al mostrar ofertas.
6. Presentar **exactamente dos opciones de horario disponibles**, si existen al menos dos dentro del horizonte, y como **tercera opción «Elegir otra fecha»**:
   - **Dos o más horarios el día elegido**: mostrar los dos primeros de ese día.
   - **Un horario el día elegido**: mostrar ese horario y el siguiente disponible en una fecha/hora posterior.
   - **Cero horarios el día elegido**: mostrar los dos siguientes disponibles en fechas posteriores y explicar brevemente que no había horarios en el día elegido.
   - **Solo un horario dentro del horizonte**: mostrar solo ese horario, más «Elegir otra fecha»; no fabricar una segunda disponibilidad.
   - **Cero horarios dentro del horizonte**: explicar que no se encontraron opciones y permitir «Elegir otra fecha» o la navegación general, sin inventar horarios.
7. **«Elegir otra fecha»** vuelve a solicitar fecha sin conservar la fecha anterior como límite inferior. El cliente puede indicar un día **anterior o posterior a la fecha original**, siempre que el día sea válido y no esté en el pasado ni fuera del horizonte permitido.
8. Selección de horario y reserva: reutilizar confirmaciones, solicitud del nombre después de seleccionar horario, protección ante ofertas caducadas, revalidación de disponibilidad, idempotencia, operación incierta, snapshots y calendario existentes. Ninguna nueva regla permite doble reserva.

### Ejemplo ilustrativo

Cliente pide **viernes 20 de noviembre** para Manicura en gel.  
Si el viernes no hay horarios, responder:

«No encontré horarios disponibles para el viernes 20 de noviembre. Te muestro las siguientes opciones:»

- «Sábado 21 · 10:00» (ejemplo hipotético)
- «Lunes 23 · 11:30» (ejemplo hipotético)
- **«Elegir otra fecha»**

Si el viernes tiene un único horario a las 16:00, mostrar ese viernes 16:00 y el siguiente horario posterior en vez de limitarse a un solo resultado.

Todos los horarios anteriores son **ficticios**, no disponibilidad real.

## Restricciones y pruebas de aceptación

- **Por negocio:** opción OFF de forma predeterminada, ON solo con acción del propietario, guardada y aislada entre tenants.
- **No alterar flujo actual:** OFF mantiene la secuencia y los botones ya aceptados, incluida la posibilidad de buscar otra fecha. ON cambia únicamente el punto de entrada de la búsqueda y la composición de la respuesta de horarios.
- **Un solo servicio por cita**, con empleados elegibles y reglas de duración/buffer existentes.
- **Dos opciones + «Elegir otra fecha»** para ON cuando haya suficientes opciones; orden cronológico; la nueva fecha puede ser anterior a la primera solicitud.
- No ofrecer horarios anteriores a la fecha seleccionada **en la búsqueda automática**; la única vía de retroceder a fechas anteriores es que el cliente lo elija mediante «Elegir otra fecha».
- Reinicio y persistencia; cambiar el ajuste durante una conversación; carrera de edición de catálogo/horarios; respuestas antiguas, replays y caducidad de ofertas; ninguna afectación a reservas confirmadas o inciertas.
- Fechas ambiguas/inválidas, días cerrados, un solo horario o cero horarios dentro del horizonte; zona horaria local, límite de horizonte y calendario del empleado.
- En el futuro, la UI real de WhatsApp deberá respetar los límites y tipos de controles admitidos por Meta; no se prometen botones sin verificación de formato.
- No implementar, modificar PRs de SE-1, activar proveedores ni realizar migraciones por este documento.

## Puntos expresamente no aprobados

- Configuraciones por servicio o cliente.
- Cambio del flujo por defecto (OFF).
- Agregar pasos de confirmación o selección de empleado.
- Una cuarta opción «Ver más horarios» en el modo fecha primero; el propietario especificó dos horarios y tercera opción «Elegir otra fecha».

# ddocBot

[Português](README.md) | [English](README.en.md) | Español

Un pequeño asistente en pixel art. Un Web Component de JavaScript sin dependencias de ejecución, con un personaje de hasta **24 × 24 píxeles**, animaciones, globos de diálogo y audio opcional. Se puede importar de forma segura durante SSR y se registra explícitamente en el navegador.

## Ejecutar localmente

Usa Node.js 22.12+ o una versión LTS más reciente, y npm.

```sh
npm install
npm run dev
```

Abre la dirección local que muestra Vite. La demostración permite iniciar tareas, añadir llamadas simultáneas, finalizar cada tarea con éxito o error, enviar mensajes, cambiar el color y el recorrido y reproducir un archivo local. La vista previa a 8× solo sirve para inspección: el personaje del pie de página permanece en su tamaño real.

En la sección **Aprende haciendo**, inicia el entrenamiento de registro de clientes. Prueba el fallo simulado al guardar, los controles de pausa y el campo de exportación/restauración del progreso. El guion está en [`demo/training.json`](demo/training.json).

```sh
npm run dev --workspace=@ddocbot/example-vue
npm run dev --workspace=@ddocbot/example-angular
```

## Uso

En un proyecto local, instala el paquete con `npm install /ruta/a/ddocBot`. El paquete no se ha publicado en npm.

```html
<dot-bot style="color: #38634b"></dot-bot>
```

```js
import { defineDdocBot } from '@ddocbot/element';

defineDdocBot(); // en el cliente; se puede llamar más de una vez
const bot = document.querySelector('dot-bot');
const id = bot.beginTask();
try {
  await miSolicitud();
  bot.endTask(id, { outcome: 'success' });
} catch (error) {
  bot.endTask(id, { outcome: 'error' });
  bot.say('No se pudo completar la tarea. Inténtalo de nuevo.');
}
```

Sin un bundler, sirve la carpeta `src` con todos sus módulos y usa `<script type="module">` para importar `./src/index.js`. En SSR, impórtalo libremente, pero llama a `defineDdocBot()` únicamente en el cliente antes de usar los métodos del elemento. Ninguna clase exportada depende de `HTMLElement` en el servidor. El tipo `DdocBotElement` está disponible para TypeScript.

## API

| Método/propiedad | Comportamiento |
| --- | --- |
| `beginTask(): string` | Extiende los miembros del personaje y devuelve un identificador exclusivo de la instancia. |
| `endTask(id, { outcome = 'success' })` | Acepta `success`, `error` o `cancelled`. Los identificadores desconocidos o ya finalizados se ignoran. |
| `say(text, { duration = 6000 })` | Sustituye el mensaje; la duración se expresa en ms y `0` lo mantiene visible hasta cerrarlo. Solo texto, sin HTML. |
| `dismissBubble()` | Cierra el globo de diálogo y cancela su temporizador. |
| `enableSound(): Promise<boolean>` | Activa el audio a partir de un clic o una pulsación de tecla del usuario. Espera el resultado antes de reproducir audio. |
| `playSound(name = 'beep'): Promise<boolean>` | Reproduce el pitido `beep`, `success` o `error`. |
| `playAudio(url): Promise<boolean>` | Reproduce una URL de audio o una Blob URL compatible con el navegador. |
| `stopAudio()` | Detiene archivos y pitidos sin desactivar la preferencia de sonido. |
| `muted: boolean` | El valor predeterminado es `true`. Silenciar detiene los sonidos. Establecerlo en `false` no evita la política de audio del navegador. |
| `volume: number` | El valor predeterminado es `0.35`; se limita a `0…1` y se rechazan los valores no finitos. |
| `movementWidth: number` | El valor predeterminado es `160`, con un mínimo de `24`; el ancho efectivo se limita a la ventana gráfica. |
| `state` (solo lectura) | `idle`, `opening`, `processing`, `success`, `error` o `closing`. |
| `flyTo(target, { duration = 700 }): Promise` | Vuela hasta un elemento, un selector CSS o una coordenada del documento `{ x, y }`. Devuelve `arrived`, `cancelled` o `target-unavailable`. |
| `pointAt(target): boolean` | Apunta el láser hacia un objetivo disponible e indica si se aceptó el comando. |
| `stopPointing()` | Apaga el láser y permanece cerca del objetivo actual. |
| `returnHome({ duration = 700 }): Promise` | Regresa a la posición original del pie de página, con los mismos resultados de navegación. |
| `navigationState` (solo lectura) | `home`, `flying`, `hovering`, `pointing` o `returning`. |
| `training` (solo lectura) | Controlador estable para cargar guiones y seguir entrenamientos secuenciales. Consulta la sección de entrenamiento más abajo. |

Atributos disponibles: `movement-width`, `volume` y `muted`. El audio comienza silenciado incluso sin el atributo `muted`. Eliminar ese atributo después de configurarlo borra la preferencia, pero todavía es necesario llamar a `enableSound()` para crear y desbloquear los recursos de audio.

```js
soundButton.addEventListener('click', async () => {
  if (await bot.enableSound()) await bot.playSound('beep');
});
```

Un sonido nuevo detiene el anterior, incluidos los pitidos. Las llamadas realizadas mientras está silenciado devuelven `false`; los fallos al iniciar la reproducción también devuelven `false` y emiten un evento. Los fallos posteriores al inicio emiten el evento sin cambiar una promesa ya resuelta. Las animaciones no activan sonidos automáticamente: la aplicación decide cuándo reproducirlos.

Las tareas simultáneas pertenecen a un mismo lote. El personaje permanece activo hasta que termina la última. Cualquier error tiene prioridad; si no hay errores, cualquier éxito produce una celebración; si todas se cancelan, el personaje solo retrae sus miembros. Una tarea que termina durante la animación de apertura aún puede mostrar la reacción completa. Las tareas nuevas iniciadas durante una reacción reanudan el procesamiento.

### Guía visual

El vuelo y el láser son comandos independientes. Espera la llegada antes de apuntar para que la secuencia sea explícita:

```js
const result = await bot.flyTo('#campo-invalido');
if (result === 'arrived') {
  bot.pointAt('#campo-invalido');
  bot.say('Revisa este campo.', { duration: 0 });
}

// Cuando termine la orientación:
bot.stopPointing();
await bot.returnHome();
```

El objetivo puede ser un `Element`, un selector CSS o `{ x, y }` en coordenadas del documento. Un nuevo `flyTo()` o `returnHome()` cancela la promesa de navegación anterior. Los objetivos fuera de pantalla se desplazan al centro antes del vuelo; con `prefers-reduced-motion`, el desplazamiento y el movimiento son instantáneos. Si el objetivo se elimina, se oculta o continúa inaccesible, la promesa devuelve `target-unavailable`, se emite el evento `ddocbot-targetlost` y el personaje regresa al pie de página. Los selectores se resuelven una sola vez y nunca comienzan silenciosamente a apuntar a un elemento de reemplazo.

## Ondas de alerta

Mientras el láser está visible, tres ondas finas se expanden y desaparecen alrededor de ddocBot. No amplían el dibujo de 24×24 píxeles ni interceptan clics. Con la reducción de movimiento activada, los anillos permanecen estáticos.

```js
bot.alertSound = 'beep'; // null (predeterminado), 'beep', 'success' o 'error'
bot.alertInterval = 2000; // ciclo de ondas y sonido en ms; mínimo 600

// Activa el audio a partir de un clic o una pulsación de tecla del usuario.
await bot.enableSound();
bot.pointAt('#campo-importante');
```

`alertSound` y `alertInterval` son propiedades de JavaScript y también están disponibles en los tipos. El sonido usa el volumen y la preferencia `muted` existentes, comienza con el primer pulso y se repite en cada ciclo. Si se está reproduciendo otro pitido o archivo, se omite el pulso sonoro; no se pone en cola ni interrumpe la narración. Para desactivar únicamente los sonidos de alerta, establece `bot.alertSound = null`.

Las ondas y su sonido se detienen al apagar el láser, iniciar otro vuelo, volver al pie de página, perder el objetivo u ocultar la pestaña. Si el objetivo simplemente sale del área visible, se pausan hasta que reaparece. Eliminar el componente libera sus recursos. `stopAudio()` detiene el audio actual; para evitar alertas posteriores, establece `alertSound = null` o `muted = true`.

El color de las ondas sigue al láser y puede cambiarse por separado:

```css
dot-bot { --ddocbot-alert-color: #e64040; }
```

La demostración incluye los controles **Sonido de alerta** e **Intervalo (ms)** junto a los comandos del láser. Seleccionar un sonido solicita su activación en el navegador; **Sin sonido** mantiene únicamente las ondas.

## Eventos

Todos los eventos atraviesan el límite del Shadow DOM (`bubbles` y `composed`).

```js
bot.addEventListener('ddocbot-activate', () => bot.say('¿Cómo puedo ayudarte?'));
bot.addEventListener('ddocbot-statechange', ({ detail }) => {
  console.log(detail.state, detail.pendingTasks);
});
bot.addEventListener('ddocbot-audioerror', ({ detail }) => {
  console.log(detail.kind, detail.message); // enable | sound | file
});
bot.addEventListener('ddocbot-navigationchange', ({ detail }) => {
  console.log(detail.state);
});
bot.addEventListener('ddocbot-targetlost', ({ detail }) => {
  console.log(detail.reason); // target-unavailable
});
```

`ddocbot-statechange` se emite cuando cambia el estado, no cada vez que cambia el número de tareas. `ddocbot-activate` responde a un clic, Enter o Espacio en el botón del personaje.

## Apariencia y accesibilidad

```css
dot-bot {
  color: #38634b;
  right: 16px;
  bottom: 16px;
  --ddocbot-bubble-background: #fff;
  --ddocbot-bubble-color: #202a25;
}
```

El dibujo usa coordenadas enteras y un solo color, con ojos transparentes. La franja de desplazamiento tiene una altura de 24px; el área interactiva mide 44×44px y se extiende 10px más allá de la franja a cada lado. Reserva ese margen al cambiar su posición. Los globos de diálogo eligen el espacio disponible encima o debajo del personaje, con ancho y alto limitados a la ventana gráfica, ajuste de palabras y desplazamiento para textos largos.

Durante `flying`, `hovering`, `pointing` y `returning`, la superficie visual se mueve temporalmente a una capa en `document.body`, por encima del contenido. El elemento `<dot-bot>` sigue siendo la referencia de la API; cuando finaliza `returnHome()`, la misma superficie vuelve al Shadow DOM y a su posición original.

El temporizador del globo se pausa mientras recibe el foco, al pasar el puntero por encima o mientras la pestaña está oculta. Un globo visible evita los paseos aleatorios, pero acompaña los vuelos ordenados por la aplicación. El botón tiene un nombre accesible y un foco visible; los mensajes usan anuncios `polite`. Con `prefers-reduced-motion`, el personaje mantiene una pose estática durante el procesamiento. La animación se suspende en pestañas ocultas y no mantiene un bucle durante el reposo. Eliminar el elemento borra tareas, temporizadores, observadores y recursos de audio; al conectarlo de nuevo, comienza en reposo y silenciado.

## Vue y Angular

Los ejemplos de `examples/` son proyectos ejecutables. Vue usa `compilerOptions.isCustomElement` para `dot-bot`; Angular usa `CUSTOM_ELEMENTS_SCHEMA` y `ElementRef<DdocBotElement>`. Ambos registran el componente antes de montar la aplicación y mantienen el sonido apagado hasta que se activa explícitamente.

Cada ejemplo incluye **Iniciar entrenamiento**, una lista y un formulario en rutas reales, un fallo simulado al guardar y una opción explícita de navegación automática. ddocBot permanece en el shell de la aplicación durante los cambios de pantalla. Los ejemplos usan rutas con hash, lo que permite servir los builds como archivos estáticos.

En Vue, [`createTrainingBridge`](examples/vue/src/training/bridge.js) combina los hooks del router con `nextTick()` y un registro de referencias de campos. En Angular, [`TrainingBridge`](examples/angular/src/training/training-bridge.service.ts) conecta eventos del router, referencias de componentes y la confirmación después del renderizado. Estos adaptadores pertenecen a los ejemplos; el paquete de ddocBot no depende de sus routers.

## Validación

```sh
npm test
npm run test:types
npm run build
npm run build:examples
npx playwright install chromium firefox webkit
npm run test:browser
```

Las pruebas de navegador inician servidores locales en los puertos 4173 (demostración), 4174 (ejemplo de Vue compilado) y 4175 (ejemplo de Angular compilado). Compila primero los ejemplos. Las pruebas cubren estados, concurrencia, fotogramas, audio, SSR, globos de diálogo, teclado, reducción de movimiento, pantallas estrechas, remontaje y comportamiento real de las integraciones.

## Entrenamientos secuenciales

`bot.training` carga un guion y presenta un paso cada vez. Los pasos informativos tienen un botón **Siguiente**; los pasos prácticos esperan un clic, un cambio de campo o una confirmación de la aplicación. El globo mantiene visibles la instrucción y el progreso, con controles para volver, pausar, reanudar y detener.

Este guion mínimo puede ejecutarse en cuanto el elemento esté conectado:

```js
bot.training.load({ id: 'bienvenida', version: 1, steps: [
  { id: 'saludo', text: 'Te damos la bienvenida a la aplicación.', advance: { type: 'manual' } }
] });
bot.training.start();
```

Para esperar una operación de la aplicación, carga un guion con una condición `signal`:

```js
bot.training.load({
  id: 'primer-cliente',
  version: 1,
  steps: [
    { id: 'inicio', text: 'Vamos a registrar tu primer cliente.',
      advance: { type: 'manual' } },
    { id: 'guardar', target: '[data-tour="guardar"]',
      text: 'Introduce los datos y guarda el cliente.', laser: true,
      advance: { type: 'signal', name: 'cliente-guardado' } }
  ]
});
bot.training.start();
```

El objeto puede proceder de un archivo JSON cargado por la aplicación. El componente no obtiene guiones ni ejecuta funciones o HTML definidos en ellos. La validación rechaza las configuraciones no válidas antes de sustituir el guion anterior.

### Condiciones y presentación de cada paso

| Campo | Uso |
| --- | --- |
| `id`, `text`, `advance` | Obligatorios. Los identificadores deben ser únicos en el guion; el texto es texto plano. |
| `target` | Selector CSS estable, `{ ref: 'clave' }` o `{ x, y }` en coordenadas del documento. Sin un objetivo, la instrucción aparece en el pie de página. |
| `route` | Nombre lógico de pantalla que confirma la aplicación. |
| `navigation` | El valor predeterminado es `'user'`; `'automatic'` solicita a la aplicación que navegue y requiere `route`. |
| `laser` | El valor predeterminado es `false`; cuando se activa, requiere un objetivo y usa la configuración existente de ondas de alerta. |
| `audio` | Opcional: `{ sound: 'beep' }` (también admite `success` y `error`) o `{ url: '/audio/instruccion.mp3' }`. |
| `timeout` | Preparación de ruta/objetivo: el valor predeterminado es 15000 ms; debe ser un número finito positivo. No limita el tiempo que tiene el usuario para completar el paso. |

Condiciones de `advance`:

```js
{ type: 'manual' }                       // Siguiente o Finalizar
{ type: 'click' }                        // clic en el objetivo o un descendiente
{ type: 'change' }                       // cambio en el propio campo
{ type: 'change', condition: { kind: 'nonempty' } }
{ type: 'change', condition: { kind: 'equals', value: 'empresa' } }
{ type: 'change', condition: { kind: 'checked', value: true } }
{ type: 'signal', name: 'cliente-guardado' } // confirmación de la aplicación
```

`click` y `change` requieren un elemento, no una coordenada. Un campo que ya estaba rellenado no completa el paso: la interacción debe realizarse después de presentar la instrucción. ddocBot no impide el evento original, no hace clic en nombre del usuario ni mueve el foco al objetivo.

### Confirmación de acciones asíncronas

Captura el token **al iniciar la operación** para evitar que una respuesta retrasada complete un nuevo intento del paso. No sustituyas ese token por el valor actual después del `await`.

```js
async function guardarCliente() {
  const token = bot.training.token;
  try {
    await miAPI.guardarCliente();
    bot.training.signal('cliente-guardado', { token });
  } catch {
    bot.training.message('No se pudo guardar. Revisa los datos e inténtalo de nuevo.', { token });
  }
}
```

La señal solo se aplica a la condición y el intento activos. Las señales retrasadas o duplicadas, y las enviadas durante una pausa o un vuelo, devuelven `false`. Una confirmación válida recibida mientras la pestaña está oculta se registra una sola vez; el cambio de paso espera hasta que la pestaña vuelva a estar visible. Pausar, volver o detener descarta esa confirmación pendiente.

Cuando no hay ningún intento, `token` es `null`. Este valor también se puede pasar a `signal`, `routeReady` y `message`: devuelven `false`, lo que permite usar el mismo manejador de negocio fuera de un entrenamiento.

`training.message()` muestra información complementaria sin sustituir la instrucción. Su duración predeterminada es de seis segundos y se pausa al pasar el puntero, recibir el foco o mientras la pestaña está oculta; `duration: 0` la mantiene visible hasta que se sustituye o termina el paso.

### Integración con rutas y referencias

Mantén ddocBot fuera del outlet de rutas. El componente solicita una pantalla mediante un evento; la aplicación controla su router y confirma el renderizado mediante el token de la solicitud:

```js
bot.addEventListener('ddocbot-trainingroute', async ({ detail }) => {
  const { route, navigation, token } = detail;
  if (navigation === 'automatic') await navegarA(route);
  await esperarPantalla(route);
  bot.training.routeReady(route, { token });
});

// Cuando comienza la navegación del router:
bot.training.routeChanged(nombreLogicoDeLaPantallaSiguiente);
```

`navegarA` y `esperarPantalla` son adaptadores de la aplicación. La confirmación debe esperar a los componentes y datos necesarios, no solo a la URL. Con navegación del usuario, el adaptador espera la ruta indicada. Si la ruta ya está preparada, puede confirmar inmediatamente. El evento se emite en cada nuevo intento de un paso con ruta.

Un cambio de ruta inesperado pausa el paso. Un paso de clic que abre la ruta siguiente se consume durante la captura del evento, antes de la navegación normal del enlace. Al navegar mediante otro mecanismo, confirma que la acción haya terminado antes de llamar a `routeChanged`.

Las referencias permiten que ddocBot apunte a componentes dentro del Shadow DOM o a elementos a los que se accede mediante Vue o Angular:

```js
bot.training.load(guion, {
  resolveTarget(ref, { stepId }) {
    return ref === 'guardar' ? referenciaActualDelBoton() : null;
  }
});
// En el guion: target: { ref: 'guardar' }
```

El adaptador devuelve un `Element` del mismo documento o `null` mientras no esté disponible. Una vez capturado, el objetivo nunca se cambia silenciosamente por otro elemento. Eliminarlo u ocultarlo pausa el paso; Reanudar vuelve a resolverlo. El simple hecho de salir de la ventana gráfica suspende el láser y las ondas sin forzar otro desplazamiento.

### Control y progreso

| API de `bot.training` | Resultado |
| --- | --- |
| `load(script, options?)` | Valida y carga el guion. Finaliza la sesión anterior antes de sustituirla. |
| `start()` | Comienza en el primer paso; devuelve si se aceptó el comando. |
| `next()` | Avanza únicamente el paso manual activo; no evita una condición práctica. |
| `previous()` | Retrocede un paso sin deshacer operaciones de la aplicación. |
| `pause()`, `resume()`, `stop()` | Pausa, prepara de nuevo o detiene; cada método devuelve si se aceptó el comando. |
| `signal(name, { token })` | Confirma una condición de negocio; devuelve si se aceptó. |
| `routeReady(route, { token })` | Confirma la pantalla solicitada; devuelve si se aceptó. |
| `routeChanged(route)` | Notifica el inicio de un cambio de ruta. |
| `message(text, { token, duration = 6000 })` | Información complementaria durante un paso activo o pausado; devuelve si se aceptó. |
| `getProgress()` | Snapshot serializable o `null` antes de iniciar o restaurar. |
| `restoreProgress(snapshot)` | Restaura un progreso compatible en pausa o en el estado terminal guardado. |
| `state`, `currentStep`, `token` | Solo lectura. El paso incluye un índice basado en cero y el total. |

Estados: `idle`, `ready`, `waiting-route`, `waiting-target`, `presenting`, `active`, `paused`, `completed` y `cancelled`. Son independientes de `bot.state` y `bot.navigationState`.

```js
// La aplicación decide dónde almacenarlo:
const progreso = bot.training.getProgress();

// En un montaje nuevo, carga el mismo guion y versión:
bot.training.load(guion);
bot.training.restoreProgress(progreso);
// El usuario puede elegir Reanudar, o la aplicación puede llamar a:
bot.training.resume();
```

Los snapshots incluyen la versión del esquema, el identificador/versión del guion, el paso y el estado del progreso. No incluyen valores de campos, tokens ni referencias de elementos. Las versiones incompatibles se rechazan; no existe almacenamiento automático ni migración silenciosa.

Eventos en el elemento original: `ddocbot-trainingstatechange`, `ddocbot-trainingstepchange`, `ddocbot-trainingroute`, `ddocbot-trainingpause`, `ddocbot-trainingcomplete`, `ddocbot-trainingcancel` y `ddocbot-trainingerror`. Todos atraviesan el límite del Shadow DOM. Los detalles identifican el guion, la versión, la sesión y el intento cuando están disponibles; los eventos de pausa y error incluyen el motivo.

### Interrupciones y compatibilidad

Durante un entrenamiento, las tareas creadas con `beginTask()` y `endTask()` continúan contabilizándose mientras el guion controla la presentación. Cuando termina el entrenamiento, ddocBot regresa al pie de página y reanuda el procesamiento si quedan tareas pendientes.

Los comandos externos de presentación (`say`, `dismissBubble`, vuelo, láser y regreso) pausan el entrenamiento antes de ejecutarse. Usa `training.message` para mostrar información que deba coexistir con la instrucción. Al reanudar se restaura el paso. Eliminar el componente libera listeners, temporizadores, observadores, medios y comandos pendientes; al conectarlo de nuevo, comienza sin un entrenamiento cargado.

El audio permanece apagado de forma predeterminada y debe desbloquearse mediante la interacción del usuario. La narración opcional no impide avanzar cuando está bloqueada, no interrumpe el audio externo que ya se está reproduciendo y no vuelve a reproducirse cuando reaparece la pestaña. Pausar o detener interrumpe únicamente el audio que pertenece al entrenamiento.

## Límites de esta versión

Los entrenamientos son secuenciales, sin ramificaciones ni editor visual. Los objetivos pertenecen al mismo documento; los iframes y el contenido de diálogos modales nativos no son compatibles. El progreso no incluye valores de formulario y retroceder un paso no deshace acciones de la aplicación.

Sin LLM, voz sintetizada, recopilación de datos ni servicios externos. El componente solo ejecuta comandos de la aplicación. No es necesario publicar ni alojar. Las herramientas y los frameworks pertenecen al entorno de desarrollo y a los ejemplos; el paquete distribuido contiene únicamente los módulos JavaScript, los tipos y esta documentación.

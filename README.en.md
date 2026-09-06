# ddocBot

[Português](README.md) | English | [Español](README.es.md)

A tiny pixel-art assistant. A dependency-free JavaScript Web Component with a character up to **24 × 24 pixels**, animations, speech bubbles, and optional audio. Safe to import during SSR, with explicit browser registration.

## Run locally

Use Node.js 22.12+ or a newer LTS version, and npm.

```sh
npm install
npm run dev
```

Open the local address shown by Vite. The demo lets you start tasks, add concurrent calls, complete each task with success or error, send messages, change the color and movement path, and play a local file. The 8× preview is only for inspection: the character in the footer remains at its actual size.

In the **Learn by doing** section, start the client-registration training. Try the simulated save failure, the pause controls, and the progress export/restore field. The script is in [`demo/training.json`](demo/training.json).

```sh
npm run dev --workspace=@ddocbot/example-vue
npm run dev --workspace=@ddocbot/example-angular
```

## Usage

In a local project, install it with `npm install /path/to/ddocBot`. The package has not been published to npm.

```html
<dot-bot style="color: #38634b"></dot-bot>
```

```js
import { defineDdocBot } from '@ddocbot/element';

defineDdocBot(); // on the client; it may be called more than once
const bot = document.querySelector('dot-bot');
const id = bot.beginTask();
try {
  await myRequest();
  bot.endTask(id, { outcome: 'success' });
} catch (error) {
  bot.endTask(id, { outcome: 'error' });
  bot.say('Unable to complete the task. Please try again.');
}
```

Without a bundler, serve the `src` directory with all its modules and use `<script type="module">` to import `./src/index.js`. In SSR, import it freely, but call `defineDdocBot()` only on the client before using the element's methods. No exported class depends on `HTMLElement` on the server. The `DdocBotElement` type is available for TypeScript.

## API

| Method/property | Behavior |
| --- | --- |
| `beginTask(): string` | Extends the character's limbs and returns an identifier unique to the instance. |
| `endTask(id, { outcome = 'success' })` | Accepts `success`, `error`, or `cancelled`. Unknown or already completed identifiers are ignored. |
| `say(text, { duration = 6000 })` | Replaces the message; duration is in ms, and `0` keeps it visible until dismissed. Text only, no HTML. |
| `dismissBubble()` | Dismisses the speech bubble and cancels its timer. |
| `enableSound(): Promise<boolean>` | Enables audio from a user click or keypress. Await the result before playing audio. |
| `playSound(name = 'beep'): Promise<boolean>` | Plays the `beep`, `success`, or `error` beep. |
| `playAudio(url): Promise<boolean>` | Plays an audio URL or Blob URL supported by the browser. |
| `stopAudio()` | Stops files and beeps without disabling the sound preference. |
| `muted: boolean` | Defaults to `true`. Muting stops sounds. Setting it to `false` does not bypass the browser audio policy. |
| `volume: number` | Defaults to `0.35`; clamped to `0…1`, with non-finite values rejected. |
| `movementWidth: number` | Defaults to `160`, with a minimum of `24`; the effective width is limited to the viewport. |
| `state` (read-only) | `idle`, `opening`, `processing`, `success`, `error`, or `closing`. |
| `flyTo(target, { duration = 700 }): Promise` | Flies to an element, CSS selector, or document coordinate `{ x, y }`. Returns `arrived`, `cancelled`, or `target-unavailable`. |
| `pointAt(target): boolean` | Points the laser at an available target and reports whether the command was accepted. |
| `stopPointing()` | Turns off the laser and remains near the current target. |
| `returnHome({ duration = 700 }): Promise` | Returns to the original footer position, with the same navigation results. |
| `navigationState` (read-only) | `home`, `flying`, `hovering`, `pointing`, or `returning`. |
| `training` (read-only) | Stable controller for loading scripts and tracking sequential training. See the training section below. |

Available attributes: `movement-width`, `volume`, and `muted`. Audio starts muted even without the `muted` attribute. Removing that attribute after setting it clears the preference, but `enableSound()` is still required to create and unlock audio resources.

```js
soundButton.addEventListener('click', async () => {
  if (await bot.enableSound()) await bot.playSound('beep');
});
```

A new sound stops the previous one, including beeps. Calls made while muted return `false`; failures to start media also return `false` and emit an event. Failures after playback begins emit the event without changing an already resolved promise. Animations do not trigger sounds automatically: the application decides when to play them.

Concurrent tasks belong to one batch. The character remains active until the last task finishes. Any error takes precedence; without errors, any success triggers a celebration; if all tasks are cancelled, the character only retracts its limbs. A task that ends during the opening animation may still show the full reaction. New tasks started during a reaction resume processing.

### Visual guidance

Flight and laser controls are independent. Await arrival before pointing to make the sequence explicit:

```js
const result = await bot.flyTo('#invalid-field');
if (result === 'arrived') {
  bot.pointAt('#invalid-field');
  bot.say('Check this field.', { duration: 0 });
}

// When guidance is complete:
bot.stopPointing();
await bot.returnHome();
```

The target may be an `Element`, a CSS selector, or `{ x, y }` in document coordinates. A new `flyTo()` or `returnHome()` cancels the previous navigation promise. Offscreen targets are scrolled to the center before the flight; with `prefers-reduced-motion`, scrolling and movement are instantaneous. If the target is removed, hidden, or remains inaccessible, the promise returns `target-unavailable`, the `ddocbot-targetlost` event is emitted, and the character returns to the footer. Selectors are resolved once and never silently start pointing at a replacement element.

## Alert waves

While the laser is visible, three thin waves expand and fade around ddocBot. They do not enlarge the 24×24-pixel artwork or intercept clicks. With reduced motion enabled, the rings remain static.

```js
bot.alertSound = 'beep'; // null (default), 'beep', 'success', or 'error'
bot.alertInterval = 2000; // wave and sound cycle in ms; minimum 600

// Enable audio from a user click or keypress.
await bot.enableSound();
bot.pointAt('#important-field');
```

`alertSound` and `alertInterval` are JavaScript properties and are also available in the types. The sound uses the existing volume and `muted` preference, starts on the first pulse, and repeats on each cycle. If another beep or file is playing, the audible pulse is skipped; it is not queued and does not interrupt narration. To disable alert sounds only, set `bot.alertSound = null`.

The waves and their sound stop when the laser is turned off, another flight begins, the character returns to the footer, the target is lost, or the tab is hidden. If the target merely leaves the visible area, they pause until it reappears. Removing the component releases its resources. `stopAudio()` stops the current audio; to prevent later alerts, set `alertSound = null` or `muted = true`.

The wave color follows the laser and can be changed independently:

```css
dot-bot { --ddocbot-alert-color: #e64040; }
```

The demo includes **Alert sound** and **Interval (ms)** controls next to the laser commands. Selecting a sound asks the browser to enable it; **No sound** keeps only the waves.

## Events

All events cross the Shadow DOM boundary (`bubbles` and `composed`).

```js
bot.addEventListener('ddocbot-activate', () => bot.say('How can I help?'));
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

`ddocbot-statechange` is emitted when the state changes, not whenever the task count changes. `ddocbot-activate` responds to a click, Enter, or Space on the character button.

## Appearance and accessibility

```css
dot-bot {
  color: #38634b;
  right: 16px;
  bottom: 16px;
  --ddocbot-bubble-background: #fff;
  --ddocbot-bubble-color: #202a25;
}
```

The artwork uses integer coordinates and one color, with transparent eyes. The movement strip is 24px tall; the interactive area is 44×44px and extends 10px beyond the strip on each side. Leave that clearance when repositioning it. Speech bubbles choose the available space above or below the character, with width and height constrained to the viewport, word wrapping, and scrolling for long text.

During `flying`, `hovering`, `pointing`, and `returning`, the visual surface is temporarily moved to a layer in `document.body`, above the page content. The `<dot-bot>` element remains the API reference; when `returnHome()` completes, the same surface returns to the Shadow DOM and its original position.

The speech-bubble timer pauses during focus, hover, or while the tab is hidden. A visible bubble prevents random walking but follows flights commanded by the application. The button has an accessible name and visible focus; messages use `polite` announcements. With `prefers-reduced-motion`, the character keeps a static pose while processing. Animation is suspended in hidden tabs and does not keep a loop running while idle. Removing the element clears tasks, timers, observers, and audio resources; reconnecting starts it idle and muted.

## Vue and Angular

The examples in `examples/` are runnable projects. Vue uses `compilerOptions.isCustomElement` for `dot-bot`; Angular uses `CUSTOM_ELEMENTS_SCHEMA` and `ElementRef<DdocBotElement>`. Both register the component before mounting the application and keep sound off until it is explicitly enabled.

Each example includes **Start training**, a list and form on real routes, a simulated save failure, and an explicit automatic-navigation option. ddocBot remains in the application shell as routes change. The examples use hash-based routing, so their builds can be served as static files.

In Vue, [`createTrainingBridge`](examples/vue/src/training/bridge.js) combines router hooks with `nextTick()` and a field-reference registry. In Angular, [`TrainingBridge`](examples/angular/src/training/training-bridge.service.ts) connects router events, component references, and confirmation after rendering. These adapters belong to the examples; the ddocBot package does not depend on their routers.

## Validation

```sh
npm test
npm run test:types
npm run build
npm run build:examples
npx playwright install chromium firefox webkit
npm run test:browser
```

Browser tests start local servers on ports 4173 (demo), 4174 (built Vue example), and 4175 (built Angular example). Build the examples first. Tests cover states, concurrency, frames, audio, SSR, speech bubbles, keyboard interaction, reduced motion, narrow screens, remounting, and real integration behavior.

## Sequential training

`bot.training` loads a script and presents one step at a time. Informational steps have a **Next** button; practical steps wait for a click, a field change, or application confirmation. The speech bubble keeps the instruction and progress visible, with controls to go back, pause, resume, and stop.

This minimal script can run as soon as the element is connected:

```js
bot.training.load({ id: 'welcome', version: 1, steps: [
  { id: 'hello', text: 'Welcome to the application.', advance: { type: 'manual' } }
] });
bot.training.start();
```

To wait for an application operation, load a script with a `signal` condition:

```js
bot.training.load({
  id: 'first-client',
  version: 1,
  steps: [
    { id: 'start', text: 'Let\'s register your first client.',
      advance: { type: 'manual' } },
    { id: 'save', target: '[data-tour="save"]',
      text: 'Enter the details and save the client.', laser: true,
      advance: { type: 'signal', name: 'client-saved' } }
  ]
});
bot.training.start();
```

The object may come from a JSON file loaded by the application. The component does not fetch scripts or execute functions or HTML defined in them. Validation rejects invalid configurations before replacing the previous script.

### Conditions and presentation for each step

| Field | Usage |
| --- | --- |
| `id`, `text`, `advance` | Required. IDs must be unique within the script; text is plain text. |
| `target` | Stable CSS selector, `{ ref: 'key' }`, or `{ x, y }` in document coordinates. Without a target, the instruction appears in the footer. |
| `route` | Logical screen name confirmed by the application. |
| `navigation` | Defaults to `'user'`; `'automatic'` requests navigation from the application and requires `route`. |
| `laser` | Defaults to `false`; when enabled, it requires a target and uses the existing alert-wave settings. |
| `audio` | Optional: `{ sound: 'beep' }` (`success` and `error` are also supported) or `{ url: '/audio/instruction.mp3' }`. |
| `timeout` | Route/target preparation: defaults to 15000 ms; must be a positive finite number. It does not limit the time the user has to complete the step. |

`advance` conditions:

```js
{ type: 'manual' }                       // Next or Finish
{ type: 'click' }                        // click on the target or a descendant
{ type: 'change' }                       // change on the field itself
{ type: 'change', condition: { kind: 'nonempty' } }
{ type: 'change', condition: { kind: 'equals', value: 'company' } }
{ type: 'change', condition: { kind: 'checked', value: true } }
{ type: 'signal', name: 'client-saved' } // application confirmation
```

`click` and `change` require an element, not a coordinate. A field that was already filled in does not complete the step: the interaction must take place after the instruction is presented. ddocBot does not prevent the original event, click on the user's behalf, or move focus to the target.

### Confirming asynchronous actions

Capture the token **when starting the operation** so a delayed response cannot complete a new attempt at the step. Do not replace that token with the current value after the `await`.

```js
async function saveClient() {
  const token = bot.training.token;
  try {
    await myAPI.saveClient();
    bot.training.signal('client-saved', { token });
  } catch {
    bot.training.message('Unable to save. Check the details and try again.', { token });
  }
}
```

The signal applies only to the currently active condition and attempt. Delayed or duplicate signals, and signals sent during a pause or flight, return `false`. A valid confirmation received while the tab is hidden is recorded once; the step transition waits for the tab to become visible again. Pausing, going back, or stopping discards that pending confirmation.

When there is no attempt, `token` is `null`. This value may also be passed to `signal`, `routeReady`, and `message`: they return `false`, allowing the same business handler to be used outside training.

`training.message()` shows supplemental feedback without replacing the instruction. Its default duration is six seconds, paused during hover, focus, or while the tab is hidden; `duration: 0` keeps it visible until it is replaced or the step ends.

### Integration with routes and references

Keep ddocBot outside the route outlet. The component requests a screen through an event; the application controls its router and confirms rendering using the request token:

```js
bot.addEventListener('ddocbot-trainingroute', async ({ detail }) => {
  const { route, navigation, token } = detail;
  if (navigation === 'automatic') await navigateTo(route);
  await waitForScreen(route);
  bot.training.routeReady(route, { token });
});

// When router navigation starts:
bot.training.routeChanged(nextLogicalScreenName);
```

`navigateTo` and `waitForScreen` are application adapters. Confirmation must wait for the required components and data, not only the URL. With user navigation, the adapter waits for the specified route. If the route is already ready, it may confirm immediately. The event is emitted for each new attempt at a step with a route.

An unexpected route change pauses the step. A click step that opens the next route is consumed during event capture, before the link's normal navigation. When navigating through another mechanism, confirm that the action has completed before calling `routeChanged`.

References allow ddocBot to point to components inside Shadow DOM or elements accessed through Vue or Angular:

```js
bot.training.load(script, {
  resolveTarget(ref, { stepId }) {
    return ref === 'save' ? currentButtonReference() : null;
  }
});
// In the script: target: { ref: 'save' }
```

The adapter returns an `Element` from the same document, or `null` while it is unavailable. Once captured, the target is never silently exchanged for another element. Removal or hiding pauses the step; Resume resolves it again. Merely leaving the viewport suspends the laser and waves without forcing another scroll.

### Control and progress

| `bot.training` API | Result |
| --- | --- |
| `load(script, options?)` | Validates and loads the script. Ends the previous session before replacing it. |
| `start()` | Starts at the first step; returns whether the command was accepted. |
| `next()` | Advances only the active manual step; does not bypass a practical condition. |
| `previous()` | Goes back one step without undoing application operations. |
| `pause()`, `resume()`, `stop()` | Pauses, prepares again, or stops; each reports whether the command was accepted. |
| `signal(name, { token })` | Confirms a business condition; reports whether it was accepted. |
| `routeReady(route, { token })` | Confirms the requested screen; reports whether it was accepted. |
| `routeChanged(route)` | Reports the beginning of a route change. |
| `message(text, { token, duration = 6000 })` | Supplemental feedback during an active or paused step; reports whether it was accepted. |
| `getProgress()` | Serializable snapshot, or `null` before starting or restoring. |
| `restoreProgress(snapshot)` | Restores compatible progress in a paused state or the saved terminal state. |
| `state`, `currentStep`, `token` | Read-only. The step includes a zero-based index and total count. |

States: `idle`, `ready`, `waiting-route`, `waiting-target`, `presenting`, `active`, `paused`, `completed`, and `cancelled`. They are independent of `bot.state` and `bot.navigationState`.

```js
// The application decides where to store this:
const progress = bot.training.getProgress();

// In a new mount, load the same script and version:
bot.training.load(script);
bot.training.restoreProgress(progress);
// The user may choose Resume, or the application may call:
bot.training.resume();
```

Snapshots include the schema version, script ID/version, step, and progress state. They do not include field values, tokens, or element references. Incompatible versions are rejected; there is no automatic storage or silent migration.

Events on the original element: `ddocbot-trainingstatechange`, `ddocbot-trainingstepchange`, `ddocbot-trainingroute`, `ddocbot-trainingpause`, `ddocbot-trainingcomplete`, `ddocbot-trainingcancel`, and `ddocbot-trainingerror`. They all cross the Shadow DOM boundary. Details identify the script, version, session, and attempt when available; pause and error events include the reason.

### Interruptions and compatibility

During training, tasks created with `beginTask()` and `endTask()` continue to be tracked while the script controls presentation. When training ends, ddocBot returns to the footer and resumes processing if tasks remain pending.

External presentation commands (`say`, `dismissBubble`, flight, laser, and return) pause training before they run. Use `training.message` for feedback that should coexist with the instruction. Resuming restores the step. Removing the component releases listeners, timers, observers, media, and pending commands; reconnecting starts without a loaded training session.

Audio remains off by default and must be unlocked through user interaction. Optional narration does not prevent progress when blocked, does not interrupt external audio already playing, and is not replayed when the tab becomes visible again. Pausing or stopping interrupts only audio owned by the training session.

## Limits of this version

Training is sequential, without branches or a visual editor. Targets belong to the same document; iframes and content inside native modal dialogs are not supported. Progress does not include form values, and going back one step does not undo application actions.

No LLM, synthesized voice, data collection, or external services. The component only executes application commands. Publishing or hosting is not required. Tools and frameworks belong to the development environment and examples; the distributed package contains only the JavaScript modules, types, and this documentation.

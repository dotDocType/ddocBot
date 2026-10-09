export const LOCALES = ['pt-BR', 'en', 'es'];
export const DEFAULT_LOCALE = 'pt-BR';
export const LOCALE_STORAGE_KEY = 'ddocbot-locale';

const localeNames = {
  'pt-BR': 'Português do Brasil',
  en: 'English',
  es: 'Español'
};

const flags = { 'pt-BR': '🇧🇷', en: '🇺🇸', es: '🇪🇸' };

const messages = {
  'pt-BR': {
    page: { title: 'ddocBot — um ponto de companhia' },
    brand: { home: 'ddocBot início' },
    github: { aria: 'Abrir repositório ddocBot no GitHub' },
    header: {
      note: '24 pixels. Um pouco de personalidade.',
      integration: 'Como integrar',
      links: 'Links do projeto',
      switchLanguage: ({ locale }) => `Trocar para ${localeNames[locale]}`
    },
    intro: {
      eyebrow: 'SEU PEQUENO ASSISTENTE WEB',
      titleFirst: 'Pequeno ponto.',
      titleSecond: 'Grande companhia.',
      copy: 'Enquanto a aplicação pensa, ele dá vida à espera.',
      copySecond: 'Conheça o ddocBot: um robô de bolso, feito de pixels.'
    },
    stage: {
      label: '01 / OBSERVATÓRIO',
      aria: 'Prévia do personagem',
      state: { idle: 'Em repouso', opening: 'Despertando', processing: 'Processando', success: 'Tudo certo!', error: 'Ops, um erro', closing: 'Até já' },
      preview: 'Prévia ampliada do ddocBot',
      zoom: 'AMPLIADO 8×',
      captionFirst: 'Um quadrado quando descansa.',
      captionSecond: 'Um companheiro quando você precisa.'
    },
    controls: {
      label: '02 / EXPERIMENTE',
      aria: 'Controles da demonstração',
      meta: 'INTERATIVO',
      title: 'Dê um trabalho a ele.',
      copy: 'Dispare uma tarefa e veja o ponto ganhar vida.',
      start: 'Iniciar processamento',
      success: 'Concluir com sucesso',
      error: 'Simular erro',
      concurrent: '+ 2 tarefas',
      messageLabel: 'UMA MENSAGEM PARA O USUÁRIO',
      message: 'Ei! Estou por aqui se precisar.',
      say: 'Mostrar balão',
      color: 'COR DO DDOCBOT',
      width: 'PERCURSO',
      soundOn: 'Ativar som',
      soundOff: 'Som ativado',
      beep: 'Ouvir bipe',
      audioFile: 'Reproduzir arquivo de áudio',
      audioMuted: 'Ative o som e selecione o arquivo novamente.',
      audioError: 'Não foi possível reproduzir. Ative o som ou tente outro arquivo.'
    },
    bot: { greeting: 'Olá! Sou o ddocBot. Pode contar comigo.' },
    task: {
      none: 'Nenhuma tarefa em andamento',
      count: ({ count }) => `${count} tarefa${count > 1 ? 's' : ''} em andamento`
    },
    details: {
      label: 'PEQUENO POR DESIGN',
      titleFirst: 'Cabe no seu rodapé.',
      titleSecond: 'E no seu projeto.',
      copy: 'JavaScript puro, sem dependências de execução.',
      copySecond: 'Um mesmo componente em Vue, Angular ou HTML.',
      tags: ['WEB COMPONENT', 'VUE', 'ANGULAR'],
      snippet: "import { defineDdocBot } from '@ddocbot/element';\n\ndefineDdocBot();\nconst bot = document.querySelector('dot-bot');\nconst task = bot.beginTask();\n\n// Quando sua chamada terminar:\nbot.endTask(task, { outcome: 'success' });",
      copyButton: 'Copiar',
      copied: 'Copiado ✓',
      copyFallback: 'Selecione o código'
    },
    guidance: {
      label: '03 / GUIA VISUAL',
      title: 'Leve o ddocBot até onde a atenção precisa estar.',
      copy: 'Escolha um elemento ou informe uma coordenada do documento. O voo e o laser são comandos separados, para você decidir quando chamar a atenção.',
      action: 'Ação importante',
      cell: 'Célula em destaque',
      field: 'Campo de exemplo',
      fieldValue: 'Revise este conteúdo',
      destination: 'DESTINO',
      chooseTarget: 'ESCOLHER ALVO',
      coordinates: 'Coordenadas do documento',
      fly: 'Voar até alvo',
      point: 'Apontar laser',
      stop: 'Desligar laser',
      home: 'Voltar ao rodapé',
      alertSound: 'SOM DO ALERTA',
      noSound: 'Sem som',
      beep: 'Bipe',
      success: 'Sucesso',
      error: 'Erro',
      interval: 'INTERVALO (MS)',
      ready: 'Pronto para decolar.',
      flying: 'Voando até o alvo…',
      arrived: 'Cheguei ao alvo.',
      cancelled: 'Voo cancelado.',
      unavailable: 'Alvo indisponível.',
      pointed: 'Laser apontado para o alvo.',
      pointFailed: 'Não foi possível apontar para o alvo.',
      stopped: 'Laser desligado.',
      returning: 'Voltando ao rodapé…',
      returned: 'De volta ao rodapé.',
      soundHint: 'Ative o som para ouvir os alertas.',
      alertHint: 'O alerta tocará enquanto o laser estiver visível.',
      visualHint: 'Alerta visual, sem som.',
      lost: ({ reason }) => `Alvo perdido: ${reason}.`
    },
    training: {
      label: '04 / APRENDA FAZENDO',
      title: 'Um guia que acompanha suas ações.',
      copy: 'O ddocBot apresenta cada etapa, muda de tela com você e só conclui quando o sistema confirma que deu certo.',
      start: 'Iniciar treinamento',
      resume: 'Retomar treinamento',
      automatic: 'Solicitar navegação automática entre as etapas',
      fail: 'Simular falha ao salvar',
      initialFeedback: 'Quatro passos. Sem pressa. Experimente pausar e retomar pelo balão.',
      details: 'Salvar e restaurar o progresso',
      detailsCopy: 'O progresso fica neste campo; nenhum dado é armazenado automaticamente.',
      export: 'Exportar progresso',
      restore: 'Restaurar progresso',
      progressLabel: 'Progresso em JSON',
      progressPlaceholder: 'Exporte o progresso de um treinamento iniciado.',
      nav: 'Telas da demonstração',
      routes: { list: 'Lista de clientes', new: 'Tela de cadastro' },
      routeLabel: { list: 'CLIENTES / LISTA', new: 'CLIENTES / NOVO CADASTRO' },
      screen: {
        listTitle: 'Seus clientes',
        listCopy: 'Seu próximo cadastro começa aqui.',
        empty: 'Ainda não há clientes nesta demonstração.',
        new: 'Novo cliente',
        formTitle: 'Novo cadastro',
        name: 'Nome do cliente',
        save: 'Salvar cliente',
        saving: 'Salvando…',
        saved: 'Cliente salvo com sucesso.',
        saveFailed: 'Não foi possível salvar o cliente.'
      },
      state: {
        idle: 'Nenhum roteiro carregado.',
        ready: 'Roteiro pronto.',
        waitingRoute: 'Abra a tela indicada para continuar.',
        waitingTarget: 'Aguardando o componente…',
        presenting: 'Preparando a orientação…',
        active: 'Siga a instrução no balão do ddocBot.',
        paused: 'Treinamento pausado. Você pode retomar quando quiser.',
        completed: 'Treinamento concluído!',
        cancelled: 'Treinamento encerrado.',
        exported: 'Progresso exportado. A aplicação decide onde armazená-lo.',
        restoredPaused: 'Progresso restaurado. Escolha Retomar para continuar.',
        restoredFinished: 'Progresso restaurado. Este treinamento já foi encerrado.',
        restoreError: ({ message }) => `Não foi possível restaurar: ${message}`,
        saveRetry: 'Não foi possível salvar. Desmarque a falha simulada e tente novamente.'
      },
      steps: {
        welcome: 'Vamos cadastrar um cliente juntos. Você realiza as ações e eu acompanho cada etapa.',
        openForm: 'Clique em Novo cliente para abrir o formulário.',
        name: 'Digite o nome do cliente. Depois, saia do campo para confirmar.',
        save: 'Salve o cadastro. Vou aguardar a confirmação do sistema antes de concluir.'
      }
    },
    footer: { copy: 'Feito de pixels. Pronto para ajudar.', meta: 'DEMO LOCAL · SEM CHAMADAS EXTERNAS', hint: 'tamanho real' }
  },
  en: {
    page: { title: 'ddocBot — a little point of company' },
    brand: { home: 'ddocBot home' },
    github: { aria: 'Open the ddocBot repository on GitHub' },
    header: { note: '24 pixels. A little personality.', integration: 'How to integrate', links: 'Project links', switchLanguage: ({ locale }) => `Switch to ${localeNames[locale]}` },
    intro: { eyebrow: 'YOUR LITTLE WEB ASSISTANT', titleFirst: 'Little point.', titleSecond: 'Great company.', copy: 'While the app thinks, it brings life to the wait.', copySecond: 'Meet ddocBot: a pocket robot made of pixels.' },
    stage: { label: '01 / OBSERVATORY', aria: 'Character preview', state: { idle: 'Resting', opening: 'Waking up', processing: 'Processing', success: 'All good!', error: 'Oops, an error', closing: 'See you soon' }, preview: 'Enlarged ddocBot preview', zoom: 'ZOOMED 8×', captionFirst: 'A square when resting.', captionSecond: 'A companion when you need it.' },
    controls: { label: '02 / TRY IT', aria: 'Demo controls', meta: 'INTERACTIVE', title: 'Give it a job.', copy: 'Start a task and watch the point come alive.', start: 'Start processing', success: 'Complete successfully', error: 'Simulate error', concurrent: '+ 2 tasks', messageLabel: 'A MESSAGE FOR THE USER', message: 'Hey! I am here if you need me.', say: 'Show message bubble', color: 'DDOCBOT COLOR', width: 'RANGE', soundOn: 'Enable sound', soundOff: 'Sound enabled', beep: 'Play beep', audioFile: 'Play an audio file', audioMuted: 'Enable sound and select the file again.', audioError: 'Could not play it. Enable sound or try another file.' },
    bot: { greeting: 'Hi! I am ddocBot. You can count on me.' },
    task: { none: 'No task in progress', count: ({ count }) => `${count} task${count > 1 ? 's' : ''} in progress` },
    details: { label: 'SMALL BY DESIGN', titleFirst: 'Fits in your footer.', titleSecond: 'And in your project.', copy: 'Plain JavaScript, with no runtime dependencies.', copySecond: 'One component for Vue, Angular or HTML.', tags: ['WEB COMPONENT', 'VUE', 'ANGULAR'], snippet: "import { defineDdocBot } from '@ddocbot/element';\n\ndefineDdocBot();\nconst bot = document.querySelector('dot-bot');\nconst task = bot.beginTask();\n\n// When your call finishes:\nbot.endTask(task, { outcome: 'success' });", copyButton: 'Copy', copied: 'Copied ✓', copyFallback: 'Select the code' },
    guidance: { label: '03 / VISUAL GUIDE', title: 'Take ddocBot wherever attention belongs.', copy: 'Choose an element or enter document coordinates. Flight and laser are separate commands, so you decide when to call attention.', action: 'Important action', cell: 'Highlighted cell', field: 'Example field', fieldValue: 'Review this content', destination: 'DESTINATION', chooseTarget: 'CHOOSE TARGET', coordinates: 'Document coordinates', fly: 'Fly to target', point: 'Point laser', stop: 'Turn laser off', home: 'Return to footer', alertSound: 'ALERT SOUND', noSound: 'No sound', beep: 'Beep', success: 'Success', error: 'Error', interval: 'INTERVAL (MS)', ready: 'Ready for takeoff.', flying: 'Flying to target…', arrived: 'I reached the target.', cancelled: 'Flight cancelled.', unavailable: 'Target unavailable.', pointed: 'Laser pointed at the target.', pointFailed: 'Could not point at the target.', stopped: 'Laser turned off.', returning: 'Returning to the footer…', returned: 'Back at the footer.', soundHint: 'Enable sound to hear alerts.', alertHint: 'The alert will play while the laser is visible.', visualHint: 'Visual alert, no sound.', lost: ({ reason }) => `Target lost: ${reason}.` },
    training: { label: '04 / LEARN BY DOING', title: 'A guide that follows your actions.', copy: 'ddocBot presents each step, changes screens with you and only finishes when the system confirms success.', start: 'Start training', resume: 'Resume training', automatic: 'Request automatic navigation between steps', fail: 'Simulate save failure', initialFeedback: 'Four steps. No rush. Try pausing and resuming from the bubble.', details: 'Save and restore progress', detailsCopy: 'Progress stays in this field; nothing is stored automatically.', export: 'Export progress', restore: 'Restore progress', progressLabel: 'Progress as JSON', progressPlaceholder: 'Export progress from a started training.', nav: 'Demo screens', routes: { list: 'Client list', new: 'Registration screen' }, routeLabel: { list: 'CLIENTS / LIST', new: 'CLIENTS / NEW REGISTRATION' }, screen: { listTitle: 'Your clients', listCopy: 'Your next registration starts here.', empty: 'There are no clients in this demo yet.', new: 'New client', formTitle: 'New registration', name: 'Client name', save: 'Save client', saving: 'Saving…', saved: 'Client saved successfully.', saveFailed: 'Could not save the client.' }, state: { idle: 'No script loaded.', ready: 'Script ready.', waitingRoute: 'Open the indicated screen to continue.', waitingTarget: 'Waiting for the component…', presenting: 'Preparing the guidance…', active: 'Follow the instruction in the ddocBot bubble.', paused: 'Training paused. Resume whenever you are ready.', completed: 'Training complete!', cancelled: 'Training ended.', exported: 'Progress exported. The application decides where to store it.', restoredPaused: 'Progress restored. Choose Resume to continue.', restoredFinished: 'This training has already ended.', restoreError: ({ message }) => `Could not restore: ${message}`, saveRetry: 'Could not save. Uncheck the simulated failure and try again.' }, steps: { welcome: 'Let’s register a client together. You take the actions and I will follow each step.', openForm: 'Click New client to open the form.', name: 'Type the client name. Then leave the field to confirm.', save: 'Save the registration. I will wait for the system confirmation before finishing.' } },
    footer: { copy: 'Made of pixels. Ready to help.', meta: 'LOCAL DEMO · NO EXTERNAL CALLS', hint: 'actual size' }
  },
  es: {
    page: { title: 'ddocBot — un pequeño punto de compañía' },
    brand: { home: 'inicio de ddocBot' },
    github: { aria: 'Abrir el repositorio de ddocBot en GitHub' },
    header: { note: '24 píxeles. Un poco de personalidad.', integration: 'Cómo integrar', links: 'Enlaces del proyecto', switchLanguage: ({ locale }) => `Cambiar a ${localeNames[locale]}` },
    intro: { eyebrow: 'TU PEQUEÑO ASISTENTE WEB', titleFirst: 'Pequeño punto.', titleSecond: 'Gran compañía.', copy: 'Mientras la aplicación piensa, da vida a la espera.', copySecond: 'Conoce ddocBot: un robot de bolsillo hecho de píxeles.' },
    stage: { label: '01 / OBSERVATORIO', aria: 'Vista previa del personaje', state: { idle: 'En reposo', opening: 'Despertando', processing: 'Procesando', success: '¡Todo bien!', error: 'Vaya, un error', closing: 'Hasta pronto' }, preview: 'Vista ampliada de ddocBot', zoom: 'AMPLIADO 8×', captionFirst: 'Un cuadrado cuando descansa.', captionSecond: 'Un compañero cuando lo necesitas.' },
    controls: { label: '02 / EXPERIMENTA', aria: 'Controles de la demostración', meta: 'INTERACTIVO', title: 'Dale un trabajo.', copy: 'Inicia una tarea y mira cómo el punto cobra vida.', start: 'Iniciar procesamiento', success: 'Completar con éxito', error: 'Simular error', concurrent: '+ 2 tareas', messageLabel: 'UN MENSAJE PARA EL USUARIO', message: '¡Hola! Estoy aquí si me necesitas.', say: 'Mostrar burbuja', color: 'COLOR DEL DDOCBOT', width: 'RECORRIDO', soundOn: 'Activar sonido', soundOff: 'Sonido activado', beep: 'Escuchar pitido', audioFile: 'Reproducir archivo de audio', audioMuted: 'Activa el sonido y selecciona el archivo de nuevo.', audioError: 'No se pudo reproducir. Activa el sonido o prueba otro archivo.' },
    bot: { greeting: '¡Hola! Soy ddocBot. Puedes contar conmigo.' },
    task: { none: 'Ninguna tarea en curso', count: ({ count }) => `${count} tarea${count > 1 ? 's' : ''} en curso` },
    details: { label: 'PEQUEÑO POR DISEÑO', titleFirst: 'Cabe en tu pie de página.', titleSecond: 'Y en tu proyecto.', copy: 'JavaScript puro, sin dependencias de ejecución.', copySecond: 'Un componente para Vue, Angular o HTML.', tags: ['WEB COMPONENT', 'VUE', 'ANGULAR'], snippet: "import { defineDdocBot } from '@ddocbot/element';\n\ndefineDdocBot();\nconst bot = document.querySelector('dot-bot');\nconst task = bot.beginTask();\n\n// Cuando termine tu llamada:\nbot.endTask(task, { outcome: 'success' });", copyButton: 'Copiar', copied: 'Copiado ✓', copyFallback: 'Selecciona el código' },
    guidance: { label: '03 / GUÍA VISUAL', title: 'Lleva ddocBot donde la atención necesita estar.', copy: 'Elige un elemento o indica coordenadas del documento. El vuelo y el láser son comandos separados para decidir cuándo llamar la atención.', action: 'Acción importante', cell: 'Celda destacada', field: 'Campo de ejemplo', fieldValue: 'Revisa este contenido', destination: 'DESTINO', chooseTarget: 'ELEGIR OBJETIVO', coordinates: 'Coordenadas del documento', fly: 'Volar al objetivo', point: 'Apuntar láser', stop: 'Apagar láser', home: 'Volver al pie de página', alertSound: 'SONIDO DE ALERTA', noSound: 'Sin sonido', beep: 'Pitido', success: 'Éxito', error: 'Error', interval: 'INTERVALO (MS)', ready: 'Listo para despegar.', flying: 'Volando al objetivo…', arrived: 'He llegado al objetivo.', cancelled: 'Vuelo cancelado.', unavailable: 'Objetivo no disponible.', pointed: 'Láser apuntado al objetivo.', pointFailed: 'No se pudo apuntar al objetivo.', stopped: 'Láser apagado.', returning: 'Volviendo al pie de página…', returned: 'De vuelta en el pie de página.', soundHint: 'Activa el sonido para escuchar las alertas.', alertHint: 'La alerta sonará mientras el láser esté visible.', visualHint: 'Alerta visual, sin sonido.', lost: ({ reason }) => `Objetivo perdido: ${reason}.` },
    training: { label: '04 / APRENDE HACIENDO', title: 'Una guía que acompaña tus acciones.', copy: 'ddocBot presenta cada paso, cambia de pantalla contigo y solo termina cuando el sistema confirma que todo salió bien.', start: 'Iniciar entrenamiento', resume: 'Reanudar entrenamiento', automatic: 'Solicitar navegación automática entre pasos', fail: 'Simular fallo al guardar', initialFeedback: 'Cuatro pasos. Sin prisa. Prueba pausar y reanudar desde la burbuja.', details: 'Guardar y restaurar el progreso', detailsCopy: 'El progreso queda en este campo; ningún dato se almacena automáticamente.', export: 'Exportar progreso', restore: 'Restaurar progreso', progressLabel: 'Progreso en JSON', progressPlaceholder: 'Exporta el progreso de un entrenamiento iniciado.', nav: 'Pantallas de la demostración', routes: { list: 'Lista de clientes', new: 'Pantalla de registro' }, routeLabel: { list: 'CLIENTES / LISTA', new: 'CLIENTES / NUEVO REGISTRO' }, screen: { listTitle: 'Tus clientes', listCopy: 'Tu próximo registro empieza aquí.', empty: 'Todavía no hay clientes en esta demostración.', new: 'Nuevo cliente', formTitle: 'Nuevo registro', name: 'Nombre del cliente', save: 'Guardar cliente', saving: 'Guardando…', saved: 'Cliente guardado correctamente.', saveFailed: 'No se pudo guardar el cliente.' }, state: { idle: 'No hay guion cargado.', ready: 'Guion listo.', waitingRoute: 'Abre la pantalla indicada para continuar.', waitingTarget: 'Esperando al componente…', presenting: 'Preparando la orientación…', active: 'Sigue la instrucción en la burbuja de ddocBot.', paused: 'Entrenamiento pausado. Puedes reanudarlo cuando quieras.', completed: '¡Entrenamiento completado!', cancelled: 'Entrenamiento terminado.', exported: 'Progreso exportado. La aplicación decide dónde guardarlo.', restoredPaused: 'Progreso restaurado. Elige Reanudar para continuar.', restoredFinished: 'Este entrenamiento ya terminó.', restoreError: ({ message }) => `No se pudo restaurar: ${message}`, saveRetry: 'No se pudo guardar. Desmarca el fallo simulado e inténtalo de nuevo.' }, steps: { welcome: 'Vamos a registrar un cliente juntos. Tú realizas las acciones y yo acompaño cada paso.', openForm: 'Haz clic en Nuevo cliente para abrir el formulario.', name: 'Escribe el nombre del cliente. Después, sal del campo para confirmar.', save: 'Guarda el registro. Esperaré la confirmación del sistema antes de terminar.' } },
    footer: { copy: 'Hecho de píxeles. Listo para ayudar.', meta: 'DEMO LOCAL · SIN LLAMADAS EXTERNAS', hint: 'tamaño real' }
  }
};

function flatten(value, parts) {
  return parts.reduce((current, part) => current?.[part], value);
}

export function normalizeLocale(value) {
  const language = String(value || '').toLowerCase();
  if (language === 'pt' || language.startsWith('pt-')) return 'pt-BR';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  if (language === 'es' || language.startsWith('es-')) return 'es';
  return null;
}

export function detectLocale({ storedLocale, languages } = {}) {
  const stored = normalizeLocale(storedLocale);
  if (stored) return stored;
  const candidates = Array.isArray(languages) && languages.length ? languages : [languages];
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function nextLocale(locale) {
  const current = normalizeLocale(locale) || DEFAULT_LOCALE;
  return LOCALES[(LOCALES.indexOf(current) + 1) % LOCALES.length];
}

export function localeFlag(locale) { return flags[normalizeLocale(locale) || DEFAULT_LOCALE]; }
export function localeName(locale) { return localeNames[normalizeLocale(locale) || DEFAULT_LOCALE]; }

export function translate(locale, key, variables = {}) {
  const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
  const value = flatten(messages[normalized], key.split('.')) ?? flatten(messages[DEFAULT_LOCALE], key.split('.'));
  if (typeof value === 'function') return value(variables);
  return value ?? key;
}

export function applyTranslations(root, locale) {
  root.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = translate(locale, node.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = translate(locale, node.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-value]').forEach(node => { node.value = translate(locale, node.dataset.i18nValue); });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(node => { node.setAttribute('aria-label', translate(locale, node.dataset.i18nAriaLabel)); });
  root.querySelectorAll('[data-i18n-title]').forEach(node => { node.title = translate(locale, node.dataset.i18nTitle); });
}

export function createLocaleManager({ storage, languages } = {}) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const browserLanguages = globalThis.navigator?.languages?.length ? globalThis.navigator.languages : [globalThis.navigator?.language];
  let locale = detectLocale({ storedLocale: store?.getItem(LOCALE_STORAGE_KEY), languages: languages ?? browserLanguages });
  const listeners = new Set();
  const notify = () => listeners.forEach(listener => listener(locale));
  return {
    get locale() { return locale; },
    setLocale(next) {
      const normalized = normalizeLocale(next) || DEFAULT_LOCALE;
      if (normalized === locale) return locale;
      locale = normalized;
      try { store?.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* storage can be unavailable */ }
      notify();
      return locale;
    },
    next() { return this.setLocale(nextLocale(locale)); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}

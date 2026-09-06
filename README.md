# ddocBot

Português | [English](README.en.md) | [Español](README.es.md)

Um pequeno assistente em pixel art. É um Web Component em JavaScript, sem dependências em tempo de execução, com um personagem de até **24 × 24 pixels**, animações, balões e áudio opcional. Pode ser importado com segurança durante a SSR e possui registro explícito no navegador.

## Rodar localmente

Use Node.js 22.12+ (ou uma versão LTS mais recente) e npm.

```sh
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite. A demonstração permite iniciar tarefas, adicionar chamadas simultâneas, concluir cada tarefa com sucesso ou erro, enviar mensagens, mudar a cor e o percurso e reproduzir um arquivo local. A prévia 8× é apenas para inspeção: o personagem no rodapé permanece em tamanho real.

Na seção **Aprenda fazendo**, inicie o treinamento de cadastro. Experimente a falha ao salvar, os controles de pausa e o campo de exportação/restauração do progresso. O roteiro está em [`demo/training.json`](demo/training.json).

```sh
npm run dev --workspace=@ddocbot/example-vue
npm run dev --workspace=@ddocbot/example-angular
```

## Uso

Em um projeto local, instale com `npm install /caminho/para/ddocBot`. O pacote não foi publicado no npm.

```html
<dot-bot style="color: #38634b"></dot-bot>
```

```js
import { defineDdocBot } from '@ddocbot/element';

defineDdocBot(); // no cliente; pode ser chamado mais de uma vez
const bot = document.querySelector('dot-bot');
const id = bot.beginTask();
try {
  await minhaChamada();
  bot.endTask(id, { outcome: 'success' });
} catch (error) {
  bot.endTask(id, { outcome: 'error' });
  bot.say('Não foi possível concluir. Tente novamente.');
}
```

Sem bundler, sirva a pasta `src` com todos os módulos e use `<script type="module">` para importar `./src/index.js`. Em SSR, importe livremente, mas chame `defineDdocBot()` apenas no cliente antes de utilizar métodos do elemento. Não há exportação de classe que dependa de `HTMLElement` no servidor. O tipo `DdocBotElement` está disponível para TypeScript.

## API

| Método/propriedade | Comportamento |
| --- | --- |
| `beginTask(): string` | Abre os membros e retorna um identificador exclusivo da instância. |
| `endTask(id, { outcome = 'success' })` | Aceita `success`, `error`, `cancelled`. Identificadores desconhecidos ou já encerrados são ignorados. |
| `say(text, { duration = 6000 })` | Substitui a mensagem; duração em ms, `0` mantém até fechar. Somente texto, sem HTML. |
| `dismissBubble()` | Fecha o balão e cancela seu temporizador. |
| `enableSound(): Promise<boolean>` | Ativa o áudio a partir de um clique ou de uma tecla pressionada pelo usuário. Aguarde o resultado antes de reproduzir. |
| `playSound(name = 'beep'): Promise<boolean>` | Bipes `beep`, `success` ou `error`. |
| `playAudio(url): Promise<boolean>` | Reproduz URL/Blob URL de áudio suportado pelo navegador. |
| `stopAudio()` | Interrompe arquivo e bipes, sem desligar a preferência de som. |
| `muted: boolean` | Padrão `true`. Silenciar interrompe os sons. Definir como `false` não contorna a política de áudio do navegador. |
| `volume: number` | Padrão `0.35`; limitado ao intervalo `0…1`, com rejeição de valores não finitos. |
| `movementWidth: number` | Padrão `160`, mínimo `24`; a largura efetiva é limitada à tela. |
| `state` (somente leitura) | `idle`, `opening`, `processing`, `success`, `error`, `closing`. |
| `flyTo(target, { duration = 700 }): Promise` | Voa até um elemento, seletor CSS ou coordenada `{ x, y }` do documento. Retorna `arrived`, `cancelled` ou `target-unavailable`. |
| `pointAt(target): boolean` | Aponta o laser para um alvo disponível e retorna se o comando foi aceito. |
| `stopPointing()` | Desliga o laser e permanece perto do alvo atual. |
| `returnHome({ duration = 700 }): Promise` | Volta ao lugar original no rodapé, com os mesmos resultados de navegação. |
| `navigationState` (somente leitura) | `home`, `flying`, `hovering`, `pointing`, `returning`. |
| `training` (somente leitura) | Controlador estável para carregar roteiros e acompanhar treinamentos sequenciais. Veja a seção de treinamentos abaixo. |

Atributos disponíveis: `movement-width`, `volume` e `muted`. O áudio começa mudo mesmo sem o atributo `muted`. Remover esse atributo depois de configurá-lo desmarca a preferência, mas ainda exige `enableSound()` para criar e desbloquear os recursos de áudio.

```js
soundButton.addEventListener('click', async () => {
  if (await bot.enableSound()) await bot.playSound('beep');
});
```

Um novo som interrompe o anterior (inclusive bipes). Chamadas quando mudo retornam `false`; falhas ao iniciar a mídia também retornam `false` e emitem um evento. Falhas após o início emitem o evento, sem alterar a promessa já resolvida. Não há som automático atrelado às animações: a aplicação escolhe quando reproduzir.

As tarefas simultâneas pertencem a um lote. O personagem permanece ativo até a última terminar. Qualquer erro prevalece; sem erro, qualquer sucesso produz comemoração; se todas forem canceladas, apenas recolhe os membros. Uma tarefa que termina durante a abertura ainda pode exibir a reação completa. Novas tarefas durante uma reação retomam o processamento.

### Guia visual

Voo e laser são comandos independentes. Aguarde a chegada antes de apontar para deixar a sequência explícita:

```js
const result = await bot.flyTo('#campo-com-erro');
if (result === 'arrived') {
  bot.pointAt('#campo-com-erro');
  bot.say('Confira este campo.', { duration: 0 });
}

// Quando a orientação terminar:
bot.stopPointing();
await bot.returnHome();
```

O alvo pode ser um `Element`, um seletor CSS ou `{ x, y }` em coordenadas do documento. Um novo `flyTo()` ou `returnHome()` cancela a promessa de navegação anterior. Alvos fora da tela são rolados para o centro antes do voo; com `prefers-reduced-motion`, rolagem e deslocamento são instantâneos. Se o alvo for removido, ocultado ou continuar inacessível, a promessa retorna `target-unavailable`, o evento `ddocbot-targetlost` é emitido e o personagem volta ao rodapé. Seletores são resolvidos uma única vez e não passam silenciosamente a apontar para um elemento substituto.

## Ondas de alerta

Enquanto o laser estiver visível, três ondas finas se expandem e desaparecem ao redor do ddocBot. Elas não ampliam o desenho de 24×24 pixels nem interceptam cliques. Com redução de movimento, os anéis ficam estáticos.

```js
bot.alertSound = 'beep'; // null (padrão), 'beep', 'success' ou 'error'
bot.alertInterval = 2000; // ciclo das ondas e do som em ms; mínimo 600

// Execute a ativação de áudio a partir de um clique/tecla do usuário.
await bot.enableSound();
bot.pointAt('#campo-importante');
```

`alertSound` e `alertInterval` são propriedades JavaScript, disponíveis também nos tipos. O som usa o volume e a preferência `muted` existentes, inicia no primeiro pulso e repete a cada ciclo. Se outro bipe ou arquivo estiver tocando, o pulso sonoro é ignorado; não há fila nem interrupção da narração. Para desligar somente o som dos alertas, use `bot.alertSound = null`.

As ondas e seu som param ao desligar o laser, iniciar outro voo, voltar ao rodapé, perder o alvo ou ocultar a aba. Se o alvo apenas sair da área visível, pausam até reaparecer. Remover o componente libera seus recursos. `stopAudio()` interrompe o áudio atual; para impedir os próximos alertas, configure `alertSound = null` ou `muted = true`.

A cor das ondas acompanha a do laser e pode ser alterada separadamente:

```css
dot-bot { --ddocbot-alert-color: #e64040; }
```

A demonstração inclui os controles **Som do alerta** e **Intervalo (ms)** junto aos comandos do laser. Escolher um som solicita sua ativação no navegador; **Sem som** mantém somente as ondas.

## Eventos

Todos atravessam o Shadow DOM (`bubbles` e `composed`).

```js
bot.addEventListener('ddocbot-activate', () => bot.say('Como posso ajudar?'));
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

`ddocbot-statechange` é emitido quando o estado muda, não a cada alteração da contagem. `ddocbot-activate` responde a clique, Enter e Espaço no botão do personagem.

## Aparência e acessibilidade

```css
dot-bot {
  color: #38634b;
  right: 16px;
  bottom: 16px;
  --ddocbot-bubble-background: #fff;
  --ddocbot-bubble-color: #202a25;
}
```

O desenho usa coordenadas inteiras e uma cor, com olhos transparentes. A faixa de deslocamento tem 24px de altura; a área interativa é de 44×44px e ultrapassa a faixa em 10px de cada lado. Reserve essa folga ao reposicionar. Os balões escolhem espaço acima ou abaixo do personagem, com largura e altura limitadas à tela, quebra de palavras e rolagem para textos longos.

Durante `flying`, `hovering`, `pointing` e `returning`, a superfície visual é movida temporariamente para uma camada em `document.body`, acima do conteúdo. O elemento `<dot-bot>` continua sendo a referência da API; ao concluir `returnHome()`, a mesma superfície volta ao Shadow DOM e à posição original.

O balão pausa a contagem durante foco, hover ou aba oculta; impede as caminhadas aleatórias enquanto visível, mas acompanha os voos comandados pela aplicação. O botão tem nome acessível e foco visível; mensagens usam anúncio `polite`. `prefers-reduced-motion` mantém pose estática durante processamento. A animação é suspensa em abas ocultas e não mantém loop em repouso. Remover o elemento limpa tarefas, timers, observadores e recursos de áudio; reconectar começa em repouso e mudo.

## Vue e Angular

Os exemplos em `examples/` são projetos executáveis. Vue usa `compilerOptions.isCustomElement` para `dot-bot`; Angular usa `CUSTOM_ELEMENTS_SCHEMA` e `ElementRef<DdocBotElement>`. Ambos registram o componente antes de montar a aplicação e deixam o som desligado até ativação explícita.

Cada exemplo inclui **Iniciar treinamento**, uma lista e um formulário em rotas reais, uma falha simulada ao salvar e a opção explícita de navegação automática. O ddocBot permanece no shell da aplicação durante as trocas de tela. As rotas usam hash, permitindo servir os builds como arquivos estáticos.

No Vue, [`createTrainingBridge`](examples/vue/src/training/bridge.js) combina os hooks do roteador com `nextTick()` e um registro de referências dos campos. No Angular, [`TrainingBridge`](examples/angular/src/training/training-bridge.service.ts) conecta eventos do roteador, referências dos componentes e confirmação após renderização. Esses adaptadores pertencem aos exemplos; o pacote do ddocBot não depende dos roteadores.

## Validação

```sh
npm test
npm run test:types
npm run build
npm run build:examples
npx playwright install chromium firefox webkit
npm run test:browser
```

Os testes de navegador iniciam servidores locais nas portas 4173 (demo), 4174 (Vue compilado) e 4175 (Angular compilado). Compile os exemplos primeiro. Os testes cobrem estados, concorrência, quadros, áudio, SSR, balões, teclado, redução de movimento, telas estreitas, remontagem e execução real das integrações.

## Treinamentos sequenciais

`bot.training` carrega um roteiro e apresenta um passo por vez. Passos explicativos têm **Próximo**; passos práticos aguardam um clique, uma mudança de campo ou uma confirmação da aplicação. O balão mantém a instrução e o progresso, com controles para voltar, pausar, retomar e encerrar.

Este roteiro mínimo já pode ser executado com o elemento conectado:

```js
bot.training.load({ id: 'welcome', version: 1, steps: [
  { id: 'hello', text: 'Bem-vindo ao sistema.', advance: { type: 'manual' } }
] });
bot.training.start();
```

Para aguardar uma operação do sistema, carregue um roteiro com condição `signal`:

```js
bot.training.load({
  id: 'primeiro-cadastro',
  version: 1,
  steps: [
    { id: 'inicio', text: 'Vamos cadastrar seu primeiro cliente.',
      advance: { type: 'manual' } },
    { id: 'salvar', target: '[data-tour="salvar"]',
      text: 'Preencha os dados e salve o cadastro.', laser: true,
      advance: { type: 'signal', name: 'cliente-salvo' } }
  ]
});
bot.training.start();
```

O objeto pode vir de um arquivo JSON carregado pela aplicação. O componente não busca roteiros nem executa funções ou HTML definidos neles. A validação rejeita configurações inválidas antes de substituir o roteiro anterior.

### Condições e apresentação de cada passo

| Campo | Uso |
| --- | --- |
| `id`, `text`, `advance` | Obrigatórios. IDs únicos no roteiro; texto simples. |
| `target` | Seletor CSS estável, `{ ref: 'chave' }` ou `{ x, y }` em coordenadas do documento. Sem alvo, a instrução aparece no rodapé. |
| `route` | Nome lógico de tela que a aplicação confirma. |
| `navigation` | `'user'` por padrão; `'automatic'` solicita navegação à aplicação e exige `route`. |
| `laser` | Padrão `false`; quando habilitado, exige alvo e usa as ondas/configurações de alerta existentes. |
| `audio` | Opcional: `{ sound: 'beep' }` (`success`/`error` também) ou `{ url: '/audio/instrucao.mp3' }`. |
| `timeout` | Preparação de rota/alvo: padrão 15000 ms; número finito positivo. Não limita o tempo para o usuário cumprir a etapa. |

Condições de `advance`:

```js
{ type: 'manual' }                       // Próximo ou Concluir
{ type: 'click' }                        // clique no alvo/descendente
{ type: 'change' }                       // mudança do próprio campo
{ type: 'change', condition: { kind: 'nonempty' } }
{ type: 'change', condition: { kind: 'equals', value: 'empresa' } }
{ type: 'change', condition: { kind: 'checked', value: true } }
{ type: 'signal', name: 'cliente-salvo' }  // confirmação da aplicação
```

`click` e `change` exigem um elemento, não uma coordenada. Um campo já preenchido não conclui a etapa: é preciso realizar a interação depois que a instrução for apresentada. O ddocBot não impede o evento original, não clica pelo usuário e não move o foco para o alvo.

### Confirmação de ações assíncronas

Capturar o token **ao iniciar a operação** evita que uma resposta atrasada conclua uma nova tentativa da etapa. Não substitua esse token pelo valor atual depois do `await`.

```js
async function salvarCliente() {
  const token = bot.training.token;
  try {
    await minhaAPI.salvarCliente();
    bot.training.signal('cliente-salvo', { token });
  } catch {
    bot.training.message('Não foi possível salvar. Confira os dados e tente novamente.', { token });
  }
}
```

O sinal só vale para a condição e a tentativa atualmente ativas. Sinais atrasados, duplicados ou enviados durante pausa/voo retornam `false`. Uma confirmação válida recebida em aba oculta é registrada uma vez; a troca de passo aguarda a aba reaparecer. Pausar, voltar ou encerrar descarta essa confirmação pendente.

Sem tentativa, `token` é `null`. Esse valor também pode ser passado a `signal`, `routeReady` e `message`: eles retornam `false`, permitindo usar o mesmo handler de negócio fora de um treinamento.

`training.message()` mostra feedback auxiliar, sem substituir a instrução. Duração padrão de seis segundos, pausada com hover/foco/aba oculta; `duration: 0` mantém até substituição ou saída do passo.

### Integração com rotas e referências

Mantenha o ddocBot fora do outlet de rotas. O componente solicita a tela por evento; a aplicação controla seu roteador e confirma a renderização usando o token da solicitação:

```js
bot.addEventListener('ddocbot-trainingroute', async ({ detail }) => {
  const { route, navigation, token } = detail;
  if (navigation === 'automatic') await navegarPara(route);
  await aguardarTelaPronta(route);
  bot.training.routeReady(route, { token });
});

// No início da navegação do roteador:
bot.training.routeChanged(nomeLogicoDaProximaTela);
```

`navegarPara` e `aguardarTelaPronta` são adaptadores da aplicação. A confirmação deve esperar os componentes/dados necessários, não apenas a URL. Em navegação pelo usuário, o adaptador aguarda a rota indicada. Se ela já está pronta, pode confirmar imediatamente. O evento é emitido em cada nova tentativa de um passo com rota.

Uma mudança inesperada de rota pausa a etapa. Um passo de clique que abre a rota seguinte é consumido em captura, antes da navegação normal do link. Ao navegar por outros mecanismos, confirmar a conclusão da ação antes de chamar `routeChanged`.

Referências permitem apontar para componentes dentro de Shadow DOM ou acessados por Vue/Angular:

```js
bot.training.load(roteiro, {
  resolveTarget(ref, { stepId }) {
    return ref === 'salvar' ? referenciaAtualDoBotao() : null;
  }
});
// No roteiro: target: { ref: 'salvar' }
```

O adaptador retorna um `Element` do mesmo documento ou `null` enquanto estiver indisponível. Uma vez capturado, o alvo não é trocado silenciosamente por outro elemento. A remoção ou ocultação pausa a etapa; **Retomar** resolve o alvo novamente. Apenas sair da viewport suspende o laser e as ondas, sem forçar uma nova rolagem.

### Controle e progresso

| API de `bot.training` | Resultado |
| --- | --- |
| `load(script, options?)` | Valida e carrega. Encerrar a sessão anterior antes de substituir. |
| `start()` | Inicia do primeiro passo; retorna aceitação booleana. |
| `next()` | Avança somente passo manual ativo; não contorna condição prática. |
| `previous()` | Volta uma etapa, sem desfazer operações do sistema. |
| `pause()`, `resume()`, `stop()` | Pausa, prepara novamente ou encerra; retornam aceitação booleana. |
| `signal(name, { token })` | Confirma condição de negócio; retorna se aceita. |
| `routeReady(route, { token })` | Confirma a tela solicitada; retorna se aceita. |
| `routeChanged(route)` | Notifica início de mudança de rota. |
| `message(text, { token, duration = 6000 })` | Feedback auxiliar em etapa ativa/pausada; retorna se aceito. |
| `getProgress()` | Snapshot serializável ou `null` antes de iniciar/restaurar. |
| `restoreProgress(snapshot)` | Restaura progresso compatível, em pausa ou no estado terminal salvo. |
| `state`, `currentStep`, `token` | Somente leitura. O passo inclui índice baseado em zero e total. |

Estados: `idle`, `ready`, `waiting-route`, `waiting-target`, `presenting`, `active`, `paused`, `completed`, `cancelled`. Eles são independentes de `bot.state` e `bot.navigationState`.

```js
// A aplicação decide onde salvar:
const progresso = bot.training.getProgress();

// Em uma nova montagem, carregar o mesmo roteiro e versão:
bot.training.load(roteiro);
bot.training.restoreProgress(progresso);
// O usuário pode escolher Retomar; ou a aplicação chama:
bot.training.resume();
```

Snapshots incluem versão do esquema, ID/versão do roteiro, passo e estado do progresso. Não incluem valores de campos, tokens ou referências de elementos. Versões incompatíveis são rejeitadas; não há gravação automática nem migração silenciosa.

Eventos no elemento original: `ddocbot-trainingstatechange`, `ddocbot-trainingstepchange`, `ddocbot-trainingroute`, `ddocbot-trainingpause`, `ddocbot-trainingcomplete`, `ddocbot-trainingcancel`, `ddocbot-trainingerror`. Todos atravessam Shadow DOM. Detalhes identificam roteiro, versão, sessão e tentativa quando existentes; pausa/erro informam o motivo.

### Interrupções e compatibilidade

Durante um treinamento, tarefas de `beginTask()`/`endTask()` continuam sendo contabilizadas, enquanto o roteiro controla a apresentação. Ao terminar, o ddocBot retorna ao rodapé e retoma processamento se houver tarefas pendentes.

Comandos externos de apresentação (`say`, `dismissBubble`, voo, laser e retorno) pausam o treinamento antes de executar. Use `training.message` para feedback que deve coexistir com a instrução. Retomar restaura a etapa. Remover o componente libera escutas, timers, observadores, mídia e comandos pendentes; reconectar começa sem treinamento carregado.

Áudio continua desligado por padrão e exige desbloqueio por interação. Narração opcional não impede avanço quando bloqueada, não interrompe áudio externo já em reprodução e não é repetida ao reaparecer a aba. Pausar/encerrar interrompe apenas o áudio pertencente ao treinamento.

## Limites desta versão

Os treinamentos são sequenciais, sem ramificações ou editor visual. Os alvos pertencem ao mesmo documento; iframes e conteúdo de diálogos modais nativos ficam fora do suporte. O progresso não inclui valores de formulário, e voltar uma etapa não desfaz ações do sistema.

Não há LLM, voz sintetizada, coleta de dados nem serviços externos. O componente executa somente comandos da aplicação. Nenhuma publicação ou hospedagem é necessária. As ferramentas e os frameworks pertencem ao ambiente de desenvolvimento e aos exemplos; o pacote distribuído contém apenas os módulos JavaScript, os tipos e esta documentação.

## Licença e marcas

Copyright (c) 2026 DDOC LTDA.

O código-fonte é distribuído sob a [licença MIT](LICENSE). Os nomes
ddocBot e dotDocType, seus logotipos e suas representações visuais estão
sujeitos à [Política de Marcas](TRADEMARKS.md).

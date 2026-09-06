import {
  afterNextRender,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  ViewChild,
  signal
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { DdocBotElement, TrainingState, TrainingStateChangeDetail } from '@ddocbot/element';
import { ClientFormComponent } from './training/client-form.component';
import { TrainingBridge } from './training/training-bridge.service';

type DdocBotStateEvent = CustomEvent<{ state: string; pendingTasks: number }>;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styles: [`
    .training-example {
      display: grid;
      gap: 16px;
      margin-top: 30px;
      padding-top: 26px;
      border-top: 1px solid #f0dce3;
    }
    .training-example h2 { margin: 4px 0 0; font-size: 1.35rem; }
    .training-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: stretch; }
    .training-check {
      min-height: 48px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 14px;
      color: #a31f50;
      background: #ffe0ea;
      font-weight: 700;
      cursor: pointer;
    }
    .training-check input { inline-size: 20px; block-size: 20px; accent-color: #a31f50; }
    .training-check-wide { grid-column: 1 / -1; }
    .training-feedback { min-height: 24px; margin: 0; color: #77616a; }
    .training-routes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .training-routes a {
      min-height: 44px;
      display: grid;
      place-items: center;
      padding: 10px 14px;
      border: 2px solid transparent;
      border-radius: 14px;
      color: #a31f50;
      background: #fff0f5;
      font-weight: 750;
      text-decoration: none;
    }
    .training-routes a:focus-visible,
    .training-check:has(input:focus-visible) { outline: 3px solid #c0265e; outline-offset: 2px; }
    .training-routes a.active { border-color: #c0265e; }
    @media (max-width: 520px) {
      .training-actions,
      .training-routes { grid-template-columns: 1fr; }
    }
  `]
})
export class AppComponent implements OnDestroy {
  @ViewChild('bot', { static: true }) botRef!: ElementRef<DdocBotElement>;

  readonly busy = signal(false);
  readonly soundEnabled = signal(false);
  readonly status = signal('Pronto para começar');
  readonly simulateFailure = signal(false);
  readonly automaticNavigation = signal(false);
  readonly trainingState = signal<TrainingState>('idle');
  readonly startingTraining = signal(false);
  readonly trainingFeedback = signal('O roteiro será carregado quando o exemplo estiver pronto.');
  readonly runningTraining = computed(() => [
    'waiting-route', 'waiting-target', 'presenting', 'active', 'paused'
  ].includes(this.trainingState()));
  readonly trainingStartUnavailable = computed(() => this.startingTraining() || this.runningTraining());

  readonly trainingBridge = inject(TrainingBridge);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private timer?: ReturnType<typeof setTimeout>;
  private readonly saveTimers = new Set<ReturnType<typeof setTimeout>>();

  ngAfterViewInit(): void {
    const bot = this.botRef.nativeElement;
    bot.volume = 0.35;
    bot.movementWidth = 180;
    afterNextRender({
      mixedReadWrite: () => this.trainingBridge.attach(bot)
    }, { injector: this.injector });
  }

  async enableSound(): Promise<void> {
    const enabled = await this.botRef.nativeElement.enableSound();
    this.soundEnabled.set(enabled);
    this.status.set(enabled ? 'Som ativado' : 'Não foi possível ativar o som');
  }

  runTask(): void {
    if (this.busy()) return;

    const bot = this.botRef.nativeElement;
    this.busy.set(true);
    bot.say('Só um instante, já volto ✨', { duration: 1600 });
    if (this.soundEnabled()) bot.playSound('beep');
    const taskId = bot.beginTask();

    this.timer = setTimeout(() => {
      bot.endTask(taskId, { outcome: 'success' });
      bot.say('Feito com carinho!', { duration: 2200 });
      if (this.soundEnabled()) bot.playSound('success');
      this.busy.set(false);
    }, 1400);
  }

  async guideToHighlight(): Promise<void> {
    const bot = this.botRef.nativeElement;
    this.status.set('Voando até o destaque');
    const result = await bot.flyTo('#guide-target');
    if (result !== 'arrived') {
      this.status.set(result === 'cancelled' ? 'Voo cancelado' : 'Destaque indisponível');
      return;
    }
    bot.pointAt('#guide-target');
    bot.say('Cheguei ao destaque!', { duration: 0 });
    this.status.set('Apontando para o destaque');
  }

  async returnHome(): Promise<void> {
    const bot = this.botRef.nativeElement;
    bot.stopPointing();
    await bot.returnHome();
    bot.dismissBubble();
    this.status.set('Pronto para começar');
  }

  onStateChange(event: Event): void {
    const { state, pendingTasks } = (event as DdocBotStateEvent).detail;
    this.status.set(pendingTasks
      ? `${state} · ${pendingTasks} tarefa(s)`
      : state === 'success' ? 'Concluído com sucesso' : 'Pronto para começar');
  }

  async startTraining(): Promise<void> {
    if (this.trainingStartUnavailable()) return;

    const bot = this.botRef.nativeElement;
    const controller = bot.training;
    this.startingTraining.set(true);
    try {
      await this.router.navigateByUrl('/training/clients');
      if (this.trainingBridge.controller !== controller || this.runningTraining()) return;

      this.trainingBridge.attach(
        bot,
        this.automaticNavigation() ? 'automatic' : 'user'
      );
      this.trainingBridge.controller?.start();
    } finally {
      this.startingTraining.set(false);
    }
  }

  onFailureChange(event: Event): void {
    this.simulateFailure.set((event.target as HTMLInputElement).checked);
  }

  onAutomaticNavigationChange(event: Event): void {
    this.automaticNavigation.set((event.target as HTMLInputElement).checked);
  }

  onTrainingStateChange(event: Event): void {
    const { state } = (event as CustomEvent<TrainingStateChangeDetail>).detail;
    this.trainingState.set(state);
    const labels: Record<TrainingState, string> = {
      idle: 'Nenhum roteiro carregado.',
      ready: 'Roteiro pronto.',
      'waiting-route': 'Abra a tela indicada para continuar.',
      'waiting-target': 'Aguardando o componente…',
      presenting: 'Preparando a orientação…',
      active: 'Siga a instrução no balão do ddocBot.',
      paused: 'Treinamento pausado. Você pode retomar quando quiser.',
      completed: 'Treinamento concluído!',
      cancelled: 'Treinamento encerrado.'
    };
    this.trainingFeedback.set(labels[state]);
  }

  onTrainingPageActivated(component: unknown): void {
    if (component instanceof ClientFormComponent) {
      component.saveClient = () => this.saveClient();
    }
  }

  private saveClient(): Promise<string> {
    const controller = this.trainingBridge.controller;
    if (!controller) return Promise.resolve('Não foi possível salvar o cliente.');

    const token = controller.token;
    const shouldFail = this.simulateFailure();
    return new Promise(resolve => {
      const saveTimer = setTimeout(() => {
        this.saveTimers.delete(saveTimer);
        if (shouldFail) {
          controller.message(
            'Não foi possível salvar. Desmarque a falha simulada e tente novamente.',
            { token, duration: 6000 }
          );
          resolve('Não foi possível salvar o cliente.');
          return;
        }

        controller.signal('client-saved', { token });
        resolve('Cliente salvo com sucesso.');
      }, 350);
      this.saveTimers.add(saveTimer);
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    for (const saveTimer of this.saveTimers) clearTimeout(saveTimer);
    this.saveTimers.clear();
    this.trainingBridge.dispose();
    this.botRef.nativeElement.stopAudio();
  }
}

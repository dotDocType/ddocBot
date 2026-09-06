import { afterNextRender, inject, Injectable, Injector } from '@angular/core';
import type { AfterRenderRef } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import type {
  DdocBotElement,
  TrainingController,
  TrainingRouteDetail,
  TrainingScript,
  TrainingStep
} from '@ddocbot/element';
import type { Subscription } from 'rxjs';
import { trainingScript } from './script';

type NavigationMode = 'user' | 'automatic';

interface RouteRequest {
  route: string;
  navigation: NavigationMode;
  token: string;
}

const trainingRoutePaths = {
  'clients-list': '/training/clients',
  'client-new': '/training/clients/new'
} as const;

type TrainingRouteName = keyof typeof trainingRoutePaths;

function trainingRouteFromUrl(url: string): TrainingRouteName | null {
  const path = url.split(/[?#]/, 1)[0];
  if (path === trainingRoutePaths['clients-list']) return 'clients-list';
  if (path === trainingRoutePaths['client-new']) return 'client-new';
  return null;
}

@Injectable({ providedIn: 'root' })
export class TrainingBridge {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly targets = new Map<string, Element>();
  private readonly renderRefs = new Set<AfterRenderRef>();
  private readonly scheduledRequests = new Set<RouteRequest>();
  private bot: DdocBotElement | null = null;
  private attachedController: TrainingController | null = null;
  private routeRequest: RouteRequest | null = null;
  private routerSubscription: Subscription | null = null;
  private disposed = true;

  get controller(): TrainingController | null {
    return this.attachedController;
  }

  attach(bot: DdocBotElement, navigation: NavigationMode = 'user'): void {
    this.dispose();
    this.disposed = false;
    this.bot = bot;
    this.attachedController = bot.training;
    this.routerSubscription = this.router.events.subscribe(event => {
      const controller = this.attachedController;
      if (!controller) return;

      if (event instanceof NavigationStart) {
        controller.routeChanged(trainingRouteFromUrl(event.url) ?? event.url);
      } else if (event instanceof NavigationEnd) {
        this.confirmRendered(this.routeRequest);
      }
    });
    bot.addEventListener('ddocbot-trainingroute', this.onTrainingRoute);

    const clonedScript = structuredClone(trainingScript);
    const script: TrainingScript = navigation === 'automatic'
      ? {
          ...clonedScript,
          steps: clonedScript.steps.map<TrainingStep>(step => step.route
            ? { ...step, route: step.route, navigation: 'automatic' } as TrainingStep
            : step)
        }
      : clonedScript;
    this.attachedController.load(script, {
      resolveTarget: key => this.targets.get(key) ?? null
    });
  }

  registerTarget(key: string, element: Element | null): void {
    if (this.disposed) return;
    if (element) this.targets.set(key, element);
    else this.targets.delete(key);
  }

  dispose(): void {
    if (this.bot) this.bot.removeEventListener('ddocbot-trainingroute', this.onTrainingRoute);
    this.routerSubscription?.unsubscribe();
    for (const renderRef of this.renderRefs) renderRef.destroy();
    this.renderRefs.clear();
    this.scheduledRequests.clear();
    this.targets.clear();
    this.routeRequest = null;
    this.routerSubscription = null;
    this.attachedController = null;
    this.bot = null;
    this.disposed = true;
  }

  private readonly onTrainingRoute = (event: Event): void => {
    const detail = (event as CustomEvent<TrainingRouteDetail>).detail;
    const request: RouteRequest = {
      route: detail.route,
      navigation: detail.navigation,
      token: detail.token
    };
    this.routeRequest = request;

    if (request.navigation === 'automatic' && trainingRouteFromUrl(this.router.url) !== request.route) {
      const path = trainingRoutePaths[request.route as keyof typeof trainingRoutePaths];
      if (path) void this.router.navigateByUrl(path);
      return;
    }

    if (trainingRouteFromUrl(this.router.url) === request.route) {
      this.confirmRendered(request);
    }
  };

  private confirmRendered(request: RouteRequest | null): void {
    if (!request || this.scheduledRequests.has(request)) return;
    this.scheduledRequests.add(request);

    let renderRef: AfterRenderRef;
    renderRef = afterNextRender({
      mixedReadWrite: () => {
        this.renderRefs.delete(renderRef);
        this.scheduledRequests.delete(request);
        const controller = this.attachedController;
        if (
          this.disposed
          || this.routeRequest !== request
          || !controller
          || controller.token !== request.token
          || trainingRouteFromUrl(this.router.url) !== request.route
        ) return;

        if (controller.routeReady(request.route, { token: request.token })) {
          this.routeRequest = null;
        }
      }
    }, { injector: this.injector });
    this.renderRefs.add(renderRef);
  }
}

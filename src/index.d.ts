import type {
  TrainingController, TrainingStateChangeDetail, TrainingSessionDetail,
  TrainingRouteDetail, TrainingPauseDetail, TrainingCancelDetail, TrainingErrorDetail
} from './training/index.js';
export type * from './training/index.js';
export type DdocBotState = 'idle' | 'opening' | 'processing' | 'success' | 'error' | 'closing';
export type NavigationState = 'home' | 'flying' | 'hovering' | 'pointing' | 'returning';
export type NavigationResult = 'arrived' | 'cancelled' | 'target-unavailable';
export type DdocBotTarget = Element | string | { x: number; y: number };
export type TaskOutcome = 'success' | 'error' | 'cancelled';
export type SoundName = 'beep' | 'success' | 'error';
export interface DdocBotElement extends HTMLElement {
  readonly training: TrainingController;
  readonly state: DdocBotState;
  readonly navigationState: NavigationState;
  flyTo(target: DdocBotTarget, options?: { duration?: number }): Promise<NavigationResult>;
  pointAt(target: DdocBotTarget): boolean;
  stopPointing(): void;
  returnHome(options?: { duration?: number }): Promise<NavigationResult>;
  /** Optional repeating laser alert sound; null (default) is silent. */
  alertSound: SoundName | null;
  /** Wave/beep cycle in milliseconds; default 2000, minimum 600. */
  alertInterval: number;
  muted: boolean;
  volume: number;
  movementWidth: number;
  beginTask(): string;
  endTask(id: string, options?: { outcome?: TaskOutcome }): void;
  say(text: string, options?: { duration?: number }): void;
  dismissBubble(): void;
  enableSound(): Promise<boolean>;
  playSound(name?: SoundName): Promise<boolean>;
  playAudio(url: string): Promise<boolean>;
  stopAudio(): void;
}
export interface DdocBotElementConstructor { new(): DdocBotElement; }
export function defineDdocBot(): DdocBotElementConstructor;
declare global {
  interface HTMLElementTagNameMap { 'dot-bot': DdocBotElement; }
  interface HTMLElementEventMap {
    'ddocbot-trainingstatechange': CustomEvent<TrainingStateChangeDetail>;
    'ddocbot-trainingstepchange': CustomEvent<TrainingSessionDetail>;
    'ddocbot-trainingroute': CustomEvent<TrainingRouteDetail>;
    'ddocbot-trainingpause': CustomEvent<TrainingPauseDetail>;
    'ddocbot-trainingcomplete': CustomEvent<TrainingSessionDetail>;
    'ddocbot-trainingcancel': CustomEvent<TrainingCancelDetail>;
    'ddocbot-trainingerror': CustomEvent<TrainingErrorDetail>;
    'ddocbot-navigationchange': CustomEvent<{state: NavigationState}>;
    'ddocbot-targetlost': CustomEvent<{reason: 'target-unavailable'}>;
    'ddocbot-activate': CustomEvent<Record<string, never>>;
    'ddocbot-statechange': CustomEvent<{state: DdocBotState; pendingTasks: number}>;
    'ddocbot-audioerror': CustomEvent<{kind: 'enable' | 'sound' | 'file'; message: string}>;
  }
}

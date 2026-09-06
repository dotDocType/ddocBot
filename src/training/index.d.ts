import type { SoundName } from '../index.js';

export type TrainingState = 'idle' | 'ready' | 'waiting-route' | 'waiting-target'
  | 'presenting' | 'active' | 'paused' | 'completed' | 'cancelled';
export type TrainingPauseReason = 'user' | 'timeout' | 'target-lost'
  | 'ambiguous-target' | 'target-resolution-failed' | 'route-changed' | 'external-command';
export type TrainingErrorCode = 'timeout' | 'target-lost' | 'ambiguous-target' | 'target-resolution-failed';
export type TrainingElementTarget = string | { ref: string; x?: never; y?: never };
export type TrainingTarget = TrainingElementTarget | { x: number; y: number; ref?: never };
export type TrainingAudio = { sound: SoundName; url?: never } | { url: string; sound?: never };
export type TrainingCondition = { kind: 'nonempty' }
  | { kind: 'equals'; value: string } | { kind: 'checked'; value: boolean };

interface TrainingStepFields {
  id: string;
  text: string;
  audio?: TrainingAudio;
  /** Preparation budget in milliseconds; default 15000. */
  timeout?: number;
}
type TrainingRoute = { route?: string; navigation?: 'user' }
  | { route: string; navigation: 'automatic' };
type TrainingLaser = { laser: true; target: TrainingTarget }
  | { laser?: false; target?: TrainingTarget };
export type TrainingStep = TrainingStepFields & TrainingRoute & TrainingLaser & (
  { target?: TrainingTarget; advance: { type: 'manual' } | { type: 'signal'; name: string } }
  | { target: TrainingElementTarget; advance: { type: 'click' } | { type: 'change'; condition?: TrainingCondition } }
);
export interface TrainingScript {
  id: string;
  version: number;
  title?: string;
  steps: readonly TrainingStep[];
}
interface TrainingProgressFields {
  schemaVersion: 1;
  trainingId: string;
  version: number;
  stepId: string;
}
export type TrainingProgress = TrainingProgressFields & (
  { status: 'in-progress' } | { status: 'completed' } | { status: 'cancelled' }
);
export interface TrainingLoadOptions {
  resolveTarget?: (ref: string, context: { stepId: string }) => Element | null;
}
export type TrainingCurrentStep = Readonly<TrainingStep & { index: number; total: number }>;
export interface TrainingTokenOptions { token: string | null; }
export interface TrainingController {
  readonly state: TrainingState;
  readonly currentStep: TrainingCurrentStep | null;
  readonly token: string | null;
  load(script: TrainingScript, options?: TrainingLoadOptions): void;
  start(): boolean;
  next(): boolean;
  previous(): boolean;
  pause(): boolean;
  resume(): boolean;
  stop(): boolean;
  signal(name: string, options: TrainingTokenOptions): boolean;
  routeReady(route: string, options: TrainingTokenOptions): boolean;
  routeChanged(route: string): void;
  message(text: string, options: TrainingTokenOptions & { duration?: number }): boolean;
  getProgress(): TrainingProgress | null;
  restoreProgress(snapshot: TrainingProgress): void;
}

/** Fields are absent before a script/session/step exists. */
export interface TrainingEventDetail {
  trainingId?: string;
  version?: number;
  total?: number;
  sessionId?: string;
  stepId?: string;
  index?: number;
  token?: string | null;
}
export interface TrainingSessionDetail extends TrainingEventDetail {
  trainingId: string;
  version: number;
  total: number;
  sessionId: string;
  stepId: string;
  index: number;
  token: string | null;
}
export interface TrainingStateChangeDetail extends TrainingEventDetail {
  state: TrainingState;
  previousState: TrainingState;
  reason?: TrainingPauseReason | 'completed' | 'disconnected' | 'restored';
}
export interface TrainingRouteDetail extends TrainingSessionDetail {
  token: string;
  route: string;
  navigation: 'user' | 'automatic';
}
export interface TrainingPauseDetail extends TrainingSessionDetail { reason: TrainingPauseReason; }
export interface TrainingCancelDetail extends TrainingSessionDetail { reason: 'user' | 'disconnected'; }
export interface TrainingErrorDetail extends TrainingSessionDetail { code: TrainingErrorCode; message: string; }

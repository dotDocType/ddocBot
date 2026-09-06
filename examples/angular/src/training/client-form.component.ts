import { Component, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { TrainingBridge } from './training-bridge.service';

@Component({
  selector: 'app-client-form',
  standalone: true,
  template: `
    <section class="training-screen" aria-labelledby="client-form-title">
      <span class="label">Clientes / Novo cadastro</span>
      <h2 id="client-form-title">Novo cadastro</h2>
      <form (submit)="submit($event)">
        <label for="training-client-name">Nome do cliente</label>
        <input
          #clientName
          id="training-client-name"
          name="name"
          autocomplete="off"
          required
          [value]="name()"
          (input)="onNameInput($event)"
        >
        <button id="training-save-client" type="submit" [disabled]="saving()">Salvar cliente</button>
        <p aria-live="polite">{{ result() }}</p>
      </form>
    </section>
  `,
  styles: [`
    .training-screen {
      display: grid;
      gap: 14px;
      padding: 20px;
      border: 1px solid #f2b9cd;
      border-radius: 18px;
      background: #fff7fa;
    }
    h2 { margin: 4px 0 0; font-size: 1.35rem; }
    p { margin: 0; color: #77616a; }
    form { display: grid; gap: 10px; }
    label { font-weight: 700; }
    input {
      min-height: 48px;
      width: 100%;
      border: 2px solid #f2b9cd;
      border-radius: 12px;
      padding: 10px 12px;
      color: #2d1821;
      background: #fff;
      font: inherit;
    }
    input:focus-visible { outline: 3px solid #c0265e; outline-offset: 2px; }
  `]
})
export class ClientFormComponent implements OnDestroy {
  @ViewChild('clientName', { static: true }) clientNameRef!: ElementRef<HTMLInputElement>;

  readonly name = signal('');
  readonly saving = signal(false);
  readonly result = signal('');
  saveClient: (() => Promise<string>) | null = null;

  private readonly trainingBridge = inject(TrainingBridge);

  ngAfterViewInit(): void {
    this.trainingBridge.registerTarget('client-name', this.clientNameRef.nativeElement);
  }

  onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.saving() || !this.saveClient) return;

    this.saving.set(true);
    this.result.set('Salvando…');
    this.result.set(await this.saveClient());
    this.saving.set(false);
  }

  ngOnDestroy(): void {
    this.trainingBridge.registerTarget('client-name', null);
  }
}

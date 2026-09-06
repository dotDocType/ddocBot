import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

const trainingScreenStyles = `
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
`;

@Component({
  selector: 'app-client-list',
  standalone: true,
  template: `
    <section class="training-screen" aria-labelledby="client-list-title">
      <span class="label">Clientes / Lista</span>
      <h2 id="client-list-title">Seus clientes</h2>
      <p>Seu próximo cadastro começa aqui.</p>
      <p>Ainda não há clientes nesta demonstração.</p>
      <button id="training-new-client" type="button" (click)="openForm()">Novo cliente</button>
    </section>
  `,
  styles: [trainingScreenStyles]
})
export class ClientListComponent {
  private readonly router = inject(Router);

  openForm(): void {
    void this.router.navigateByUrl('/training/clients/new');
  }
}

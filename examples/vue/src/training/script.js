export const trainingScript = {
  id: 'cadastro-cliente-vue',
  version: 1,
  title: 'Seu primeiro cadastro com Vue',
  steps: [
    {
      id: 'welcome',
      text: 'Vamos cadastrar um cliente juntos. Você realiza as ações e eu acompanho cada etapa.',
      advance: { type: 'manual' }
    },
    {
      id: 'open-form',
      route: 'clients-list',
      target: '#training-new-client',
      text: 'Clique em Novo cliente para abrir o formulário.',
      laser: true,
      advance: { type: 'click' }
    },
    {
      id: 'name',
      route: 'client-new',
      target: { ref: 'client-name' },
      text: 'Digite o nome do cliente. Depois, saia do campo para confirmar.',
      laser: true,
      advance: { type: 'change', condition: { kind: 'nonempty' } }
    },
    {
      id: 'save',
      route: 'client-new',
      target: '#training-save-client',
      text: 'Salve o cadastro. Vou aguardar a confirmação do sistema antes de concluir.',
      laser: true,
      advance: { type: 'signal', name: 'client-saved' }
    }
  ]
};

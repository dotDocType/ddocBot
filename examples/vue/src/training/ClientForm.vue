<script setup>
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';

const trainingShell = inject('trainingShell');
const clientName = ref(null);
const saving = ref(false);
const result = ref('');

onMounted(() => trainingShell.registerTarget('client-name', clientName.value));
onBeforeUnmount(() => trainingShell.registerTarget('client-name', null));

async function submit() {
  if (saving.value) return;
  saving.value = true;
  result.value = 'Salvando…';
  result.value = await trainingShell.saveClient();
  saving.value = false;
}
</script>

<template>
  <section class="training-screen" aria-labelledby="client-form-title">
    <span class="label">Clientes / Novo cadastro</span>
    <h2 id="client-form-title">Novo cadastro</h2>
    <form @submit.prevent="submit">
      <label for="training-client-name">Nome do cliente</label>
      <input
        id="training-client-name"
        ref="clientName"
        name="name"
        autocomplete="off"
        required
      >
      <button id="training-save-client" type="submit" :disabled="saving">Salvar cliente</button>
      <p aria-live="polite">{{ result }}</p>
    </form>
  </section>
</template>

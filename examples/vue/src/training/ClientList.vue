<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <section class="training-screen" aria-labelledby="client-list-title">
    <span class="label">Clientes / Lista</span>
    <h2 id="client-list-title">Seus clientes</h2>
    <p>Seu próximo cadastro começa aqui.</p>
    <p class="training-empty">Ainda não há clientes nesta demonstração.</p>
    <button id="training-new-client" type="button" @click="router.push({ name: 'client-new' })">
      Novo cliente
    </button>
  </section>
</template>

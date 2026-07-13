<script setup lang="ts">
import ToastContainer from '@/components/ToastContainer.vue'
</script>

<template>
  <div class="app">
    <RouterView />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
</style>

<template>
  <div class="toast-wrap">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="{ error: toast.isError }"
    >{{ toast.message }}</div>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast.js'
const { toasts } = useToast()
</script>

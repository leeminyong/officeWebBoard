<template>
  <div class="pagination" v-if="pagination.totalPages > 1">
    <button class="page-btn" :disabled="pagination.page === 1" @click="emit('go', 1)">«</button>
    <button class="page-btn" :disabled="pagination.page === 1" @click="emit('go', pagination.page - 1)">‹</button>
    <button
      v-for="p in pageRange"
      :key="p"
      class="page-btn"
      :class="{ active: p === pagination.page }"
      @click="emit('go', p)"
    >{{ p }}</button>
    <button class="page-btn" :disabled="pagination.page === pagination.totalPages" @click="emit('go', pagination.page + 1)">›</button>
    <button class="page-btn" :disabled="pagination.page === pagination.totalPages" @click="emit('go', pagination.totalPages)">»</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ pagination: Object })
const emit = defineEmits(['go'])

const pageRange = computed(() => {
  const { page, totalPages } = props.pagination
  const groupSize = 5
  const start = Math.floor((page - 1) / groupSize) * groupSize + 1
  const end = Math.min(start + groupSize - 1, totalPages)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})
</script>

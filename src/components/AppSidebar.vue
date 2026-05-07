<template>
  <aside class="side-menu" aria-label="주요 메뉴">
    <RouterLink
      v-for="[key, label] in boards"
      :key="key"
      class="side-menu-item"
      :class="{ active: currentBoard === key }"
      :to="key === 'project' ? '/' : `/?board=${key}`"
    >{{ label }}</RouterLink>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { boardMeta } from '../board.js'

const route = useRoute()
const boards = Object.entries(boardMeta)
const currentBoard = computed(() => boardMeta[route.query.board] ? route.query.board : 'project')
</script>

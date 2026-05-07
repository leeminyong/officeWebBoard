<template>
  <div
    class="file-drop-zone"
    :class="{ 'drag-over': isDragging }"
    @click="fileInput.click()"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
  >
    📎 파일을 여기에 드래그하거나 클릭해서 선택하세요
    <input ref="fileInput" type="file" multiple @change="onChange" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['filesAdded'])
const fileInput = ref(null)
const isDragging = ref(false)

function onChange(e) {
  emit('filesAdded', [...e.target.files])
  e.target.value = ''
}

function onDrop(e) {
  isDragging.value = false
  emit('filesAdded', [...e.dataTransfer.files])
}
</script>

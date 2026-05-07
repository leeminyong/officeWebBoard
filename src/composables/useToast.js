import { ref } from 'vue'

const toasts = ref([])

export function useToast() {
  function showToast(message, isError = false) {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, isError })
    setTimeout(() => {
      const i = toasts.value.findIndex(t => t.id === id)
      if (i !== -1) toasts.value.splice(i, 1)
    }, 3000)
  }
  return { toasts, showToast }
}

<template>
  <header class="site-header">
    <h1 @click="router.push('/')">📋 게시판</h1>
  </header>
  <AppSidebar />
  <RouterView />
  <ToastContainer />
</template>

<script setup>
import { useRouter } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastContainer from './components/ToastContainer.vue'

const router = useRouter()
</script>

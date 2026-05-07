import { createApp } from 'vue'
import { router } from './router.js'
import App from './App.vue'
import '../public/style.css'

createApp(App).use(router).mount('#app')

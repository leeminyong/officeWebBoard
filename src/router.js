import { createRouter, createWebHistory } from 'vue-router'
import PostListView from './views/PostListView.vue'
import PostDetailView from './views/PostDetailView.vue'
import WriteFormView from './views/WriteFormView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PostListView },
    { path: '/posts/:id', component: PostDetailView },
    { path: '/write', component: WriteFormView },
    { path: '/posts/:id/edit', component: WriteFormView },
  ],
})

import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchPostList } from '../api.js'
import { useToast } from './useToast.js'
import { boardMeta } from '../board.js'

export function usePostList() {
  const route = useRoute()
  const router = useRouter()
  const { showToast } = useToast()

  const posts = ref([])
  const pagination = ref({ total: 0, page: 1, totalPages: 1 })
  const currentBoard = computed(() => boardMeta[route.query.board] ? route.query.board : 'project')

  async function loadPosts(page = 1) {
    try {
      const data = await fetchPostList(page, currentBoard.value)
      posts.value = [...data.posts].sort((a, b) => {
        const d = String(b.created_at).localeCompare(String(a.created_at))
        return d || b.id - a.id
      })
      pagination.value = data.pagination
    } catch {
      showToast('게시글을 불러오지 못했습니다.', true)
    }
  }

  function goToWrite() {
    const q = currentBoard.value !== 'project' ? { board: currentBoard.value } : {}
    router.push({ path: '/write', query: q })
  }

  function goToPost(id) {
    router.push({ path: `/posts/${id}`, query: { board: currentBoard.value } })
  }

  return { posts, pagination, currentBoard, loadPosts, goToWrite, goToPost }
}

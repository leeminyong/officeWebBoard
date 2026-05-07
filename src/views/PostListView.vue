<template>
  <div class="container">
    <div class="card">
      <div class="toolbar">
        <h2>{{ boardMeta[currentBoard] }} 전체 {{ pagination.total }}건</h2>
        <button class="btn btn-primary" @click="goToWrite">✏️ 글쓰기</button>
      </div>

      <table class="post-table">
        <thead>
          <tr>
            <th class="center" style="width:60px">번호</th>
            <th>제목</th>
            <th class="center" style="width:130px">작성일</th>
            <th class="center" style="width:60px">파일</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="posts.length === 0">
            <td colspan="4">
              <div class="empty-state">등록된 게시글이 없습니다.</div>
            </td>
          </tr>
          <tr v-for="(post, index) in posts" :key="post.id">
            <td class="center text-muted">{{ (pagination.page - 1) * 10 + index + 1 }}</td>
            <td>
              <a class="post-title-link" href="#" @click.prevent="goToPost(post.id)">
                {{ post.title }}
              </a>
              <span v-if="post.comment_count > 0" class="badge-comment">{{ post.comment_count }}</span>
              <span v-if="post.file_count > 0" class="badge-file">📎{{ post.file_count }}</span>
              <template v-if="post.comments && post.comments.length">
                <a
                  v-for="comment in post.comments"
                  :key="comment.id"
                  class="inline-comment"
                  href="#"
                  @click.prevent="goToPost(post.id)"
                >
                  <span class="inline-comment-text">{{ comment.content }}</span>
                  <span class="inline-comment-date">{{ comment.created_at.slice(0, 10) }}</span>
                </a>
              </template>
            </td>
            <td class="center text-muted">{{ post.created_at.slice(0, 10) }}</td>
            <td class="center text-muted">{{ post.file_count > 0 ? '📎' : '' }}</td>
          </tr>
        </tbody>
      </table>

      <Pagination :pagination="pagination" @go="loadPosts" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import Pagination from '../components/Pagination.vue'
import { usePostList } from '../composables/usePostList.js'
import { boardMeta } from '../board.js'

const route = useRoute()
const { posts, pagination, currentBoard, loadPosts, goToWrite, goToPost } = usePostList()

onMounted(() => loadPosts(1))
watch(() => route.query.board, () => loadPosts(1))
</script>

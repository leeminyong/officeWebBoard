<template>
  <div class="container">
    <div class="card">
      <div class="toolbar">
        <!-- pageInfo.total : 전체 게시글 수를 표시합니다. -->
        <h2>{{ boardMeta[currentBoard] }} 전체 {{ pageInfo.total }}건</h2>
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
          <!-- postList.length === 0 : 게시글이 하나도 없을 때 안내 문구를 보여줍니다. -->
          <tr v-if="postList.length === 0">
            <td colspan="4">
              <div class="empty-state">등록된 게시글이 없습니다.</div>
            </td>
          </tr>
          <!-- v-for : postList 배열을 순서대로 반복해서 행(tr)을 만듭니다. -->
          <!-- :key="post.id" : Vue가 각 행을 구분할 수 있도록 고유한 id를 지정합니다. -->
          <tr v-for="(post, index) in postList" :key="post.id">
            <!-- 번호 계산: (현재 페이지 - 1) * 10 + 순서 + 1 -->
            <!-- 예) 2페이지 첫 번째 글이면 (2-1)*10 + 0 + 1 = 11번 -->
            <td class="center text-muted">{{ (pageInfo.page - 1) * 10 + index + 1 }}</td>
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

      <!-- Pagination 컴포넌트에 pageInfo를 전달하고, 페이지 이동 이벤트를 받아 loadPosts를 호출합니다. -->
      <Pagination :pagination="pageInfo" @go="loadPosts" />
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
// usePostList()에서 필요한 상태와 함수를 가져옵니다.
// { } 안에 쓴 이름은 usePostList.js의 return 에서 반환한 이름과 일치해야 합니다.
const { postList, pageInfo, currentBoard, loadPosts, goToWrite, goToPost } = usePostList()

// onMounted : 화면이 처음 그려질 때 1페이지 게시글을 불러옵니다. (Android의 onCreate()와 비슷)
onMounted(() => loadPosts(1))
// watch : route.query.board 값이 바뀔 때(게시판 전환 시) 1페이지부터 다시 불러옵니다.
watch(() => route.query.board, () => loadPosts(1))
</script>

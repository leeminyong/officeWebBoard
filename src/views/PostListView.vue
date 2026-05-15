<template>
  <div class="container">
    <div class="card">
      <div class="toolbar">
        <!-- pageInfo.total : 전체 게시글 수를 표시합니다. -->
        <!-- boardMap[currentBoard] : 현재 게시판의 이름을 동적으로 가져옵니다. 사용자가 추가한 게시판도 표시됩니다. -->
        <h2>{{ boardMap[currentBoard] }} 전체 {{ pageInfo.total }}건</h2>
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
                  <!-- stripUrls()로 URL을 제거한 텍스트만 표시합니다. -->
                  <!-- 게시글 목록에서는 긴 URL이 지저분하게 보일 수 있어서, 텍스트 부분만 노출합니다. -->
                  <span class="inline-comment-text">{{ stripUrls(comment.content) }}</span>
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

      <!-- ── 검색 영역 ──────────────────────────────────────── -->
      <!-- 게시판 하단에 키워드 검색창을 보여줍니다. -->
      <!-- div.search-bar : 검색창과 버튼을 가로로 나란히 배치하는 컨테이너입니다. -->
      <div class="search-bar">
        <!-- v-model="searchKeyword" : 입력창의 값과 searchKeyword 변수를 양방향으로 연결합니다.
             안드로이드의 EditText에 TextWatcher를 달아 LiveData를 업데이트하는 것과 같습니다. -->
        <!-- @keyup.enter : 엔터 키를 눌렀을 때 doSearch()를 실행합니다.
             안드로이드의 setOnEditorActionListener()와 비슷합니다. -->
        <input
          v-model="searchKeyword"
          class="search-input"
          type="text"
          placeholder="검색어를 입력하세요"
          @keyup.enter="doSearch"
        />
        <!-- 검색 버튼: 클릭하면 doSearch()를 호출해서 1페이지부터 검색 결과를 불러옵니다. -->
        <button class="btn btn-primary search-btn" @click="doSearch">🔍 찾기</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import Pagination from '../components/Pagination.vue'
import { usePostList } from '../composables/usePostList.js'
// useBoards : 사용자가 추가한 게시판을 포함한 전체 목록을 제공합니다.
import { useBoards } from '../composables/useBoards.js'

const route = useRoute()
// boardMap : 게시판 key → 이름 변환 객체입니다. 예) { project: '프로젝트', board_123: '공지사항' }
const { boardMap } = useBoards()

/**
 * stripUrls(text) : 댓글 내용에서 URL(http/https로 시작하는 링크)을 제거하는 함수입니다.
 *
 * - 정규표현식(regex)이란? 문자열에서 특정 패턴을 찾는 규칙입니다.
 *   예) /https?:\/\/\S+/g 는 "http://" 또는 "https://"로 시작하는 단어를 찾습니다.
 *     - https? → "http" 다음 's'가 있어도 되고 없어도 됨 (? = 0 또는 1개)
 *     - \/\/ → "//" 를 의미 (슬래시는 특수문자라서 \로 표시)
 *     - \S+ → 공백이 아닌 문자가 1개 이상 연속됨 (URL 끝까지)
 *     - g → 문자열 전체에서 모두 찾음 (global 플래그)
 * - replace(pattern, '') : 찾은 패턴을 빈 문자열('')로 교체 → 삭제 효과
 * - trim() : 앞뒤 공백을 제거합니다.
 *
 * 안드로이드로 비유하면: String.replaceAll()과 비슷한 역할입니다.
 */
function stripUrls(text) {
  if (!text) return ''
  return text.replace(/https?:\/\/\S+/g, '').trim()
}
// usePostList()에서 필요한 상태와 함수를 가져옵니다.
// { } 안에 쓴 이름은 usePostList.js의 return 에서 반환한 이름과 일치해야 합니다.
// searchKeyword : 검색 입력창에 바인딩되는 검색어 변수입니다.
// doSearch      : 검색 버튼 클릭 시 1페이지부터 검색 결과를 불러오는 함수입니다.
// clearSearch   : 검색어를 비우고 전체 목록으로 돌아오는 함수입니다.
const { postList, pageInfo, currentBoard, loadPosts, goToWrite, goToPost, searchKeyword, doSearch, clearSearch } = usePostList()

// onMounted : 화면이 처음 그려질 때 1페이지 게시글을 불러옵니다. (Android의 onCreate()와 비슷)
onMounted(() => loadPosts(1))
// watch : route.query.board 값이 바뀔 때(게시판 전환 시) 검색어를 초기화하고 1페이지부터 다시 불러옵니다.
// 다른 게시판으로 이동했을 때 이전 게시판의 검색어가 남아 있으면 어색하기 때문에 초기화합니다.
watch(() => route.query.board, () => clearSearch())
</script>

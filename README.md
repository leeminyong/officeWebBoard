# Office Web Board

## 프로젝트 구조

현재 구조는 **타입(type) 단위**로 분리되어 있습니다 (기능 단위가 아님).

```
src/
├── components/        ← UI 컴포넌트 타입별 모음
│   ├── AppSidebar.vue
│   ├── ContentEditor.vue
│   ├── FileDropZone.vue
│   ├── Pagination.vue
│   └── ToastContainer.vue
├── composables/       ← 로직 타입별 모음
│   ├── usePostDetail.js
│   ├── usePostList.js
│   ├── useToast.js
│   └── useWriteForm.js
├── views/             ← 페이지 타입별 모음
│   ├── PostDetailView.vue
│   ├── PostListView.vue
│   └── WriteFormView.vue
├── api.js
├── router.js
└── utils.js
```

타입 기준 구조는 파일의 **역할**(`components`, `views`, `composables`)로 묶는 방식입니다.

### 기능 단위로 바꾸면 이런 모습

```
src/
├── features/
│   ├── post-list/
│   │   ├── PostListView.vue
│   │   ├── Pagination.vue
│   │   └── usePostList.js
│   ├── post-detail/
│   │   ├── PostDetailView.vue
│   │   └── usePostDetail.js
│   └── write-form/
│       ├── WriteFormView.vue
│       ├── ContentEditor.vue
│       ├── FileDropZone.vue
│       └── useWriteForm.js
├── shared/            ← 공통으로 쓰이는 것만
│   ├── AppSidebar.vue
│   ├── ToastContainer.vue
│   └── useToast.js
```

> 현재 앱 규모(3개 페이지)에서는 타입 기준 구조로도 충분합니다. 기능 단위는 페이지나 기능이 많아질 때 유리합니다.

---

## 아키텍처 패턴 — MVVM

Android MVVM과 동일한 패턴입니다. Vue에서도 **MVVM**이라고 부릅니다.

### Android MVVM vs 이 프로젝트 비교

| Android MVVM | 이 프로젝트 | 역할 |
|---|---|---|
| XML Layout / Activity / Fragment | `views/*.vue` | **View** — UI 렌더링 |
| ViewModel | `composables/use*.js` | **ViewModel** — 상태 & 로직 |
| Repository / DataSource | `api.js` | **Model** — 데이터 |

### 구체적으로 대응하면

```
Android                          Vue
─────────────────────────────────────────────────
PostListViewModel.kt         →   usePostList.js
LiveData / StateFlow         →   ref(), reactive()
viewModelScope.launch()      →   onMounted() 안에서 fetch
observe() / collectAsState() →   {{ }} 템플릿 바인딩
```

`usePostList.js` 같은 **composable**이 Android의 **ViewModel**과 정확히 같은 역할을 합니다.  
상태를 들고 있고, 비즈니스 로직을 처리하고, View에 노출시키는 구조가 동일합니다.

> 차이점: Android ViewModel은 **클래스**, Vue composable은 **함수**입니다.

---

## Backend

This project uses **JavaScript** for the backend, running on **Node.js**.

- Runtime: Node.js
- Web framework: Express
- Database: SQLite (`board.db`)
- Server entry point: `server.js`
- Database setup: `database.js`

---

## 자동 실행 설정 위치

시작 프로그램 폴더라는 곳에 등록되어 있습니다.
이 폴더에 파일을 넣어두면, 로그인할 때마다 자동으로 실행됩니다.

폴더 위치를 여는 방법:

1. **Win + R** 키를 누릅니다
2. 아래 주소를 붙여넣고 **엔터**

```
shell:startup
```

그러면 이런 파일들이 보일 겁니다:

```
📁 Startup
├── OfficeWebBoardAutoStart.lnk   ← 이 사이트 자동 실행
└── OneNote(으)로 보내기.lnk
```

---

## 다른 사이트도 추가하려면?

같은 방식으로 하면 됩니다.

1. 새 사이트의 서버 실행 파일 (`node server.js` 같은 것) 만들기
2. 그 파일의 **바로가기**를 이 폴더에 넣기

그러면 자동으로 같이 실행됩니다.

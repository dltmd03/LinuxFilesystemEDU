// community.jsx (API 연동 버전, UMD + Babel + React 18)
// index.html에 React/ReactDOM/Babel CDN이 이미 포함되어 있어야 함.

// ===== API BASE =====
// 로컬 개발: 'http://localhost:4000'
// 배포 후: 배포한 API 서버 주소로 바꿔주세요 (예: 'https://fs-edu-api.onrender.com')
const API_BASE = 'http://localhost:4000';

const { useEffect, useMemo, useRef, useState } = React;

function TagBadge({ tag }) {
  const map = {
    'Q&A': 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/40',
    'TIP': 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40',
    'BUG': 'bg-rose-600/20 text-rose-300 border border-rose-600/40',
    'SHOW': 'bg-amber-600/20 text-amber-300 border border-amber-600/40',
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[tag]||'bg-gray-600/20 text-gray-300 border border-gray-600/40'}`}>{tag}</span>;
}

/* ===================== API Helpers ===================== */
async function apiGet(path, params) {
  const url = new URL(API_BASE + path);
  if (params) Object.entries(params).forEach(([k,v])=> url.searchParams.set(k, v));
  const r = await fetch(url, { headers: { 'Accept':'application/json' } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiJson(method, path, body) {
  const r = await fetch(API_BASE + path, {
    method,
    headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ===================== UI Components ===================== */
function Toolbar({ filter, setFilter, onNewTemplate }) {
  const [q, setQ] = useState(filter.q || '');
  const [tag, setTag] = useState(filter.tag || 'ALL');
  const [sort, setSort] = useState(filter.sort || 'latest');

  useEffect(()=>{ setFilter({ q, tag, sort }); }, [q, tag, sort]);

  return (
    <div className="flex flex-col md:flex-row gap-3 mb-4">
      <input
        className="flex-1 bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
        placeholder="검색: 제목/내용/작성자"
        value={q} onChange={e=>setQ(e.target.value)}
      />
      <select className="bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" value={tag} onChange={(e)=>setTag(e.target.value)}>
        <option value="ALL">전체</option>
        <option value="Q&A">Q&A</option>
        <option value="TIP">TIP</option>
        <option value="BUG">BUG</option>
        <option value="SHOW">SHOW</option>
      </select>
      <select className="bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" value={sort} onChange={(e)=>setSort(e.target.value)}>
        <option value="latest">최신순</option>
        <option value="votes">추천순</option>
      </select>
      <button className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm" onClick={onNewTemplate}>질문 템플릿</button>
    </div>
  );
}

function PostForm({ onSubmit, draft, setDraft }) {
  const titleRef = useRef(null);
  useEffect(()=>{ titleRef.current?.focus(); }, []);

  const setTemplate = () => {
    setDraft(d => ({
      ...d,
      tag: 'Q&A',
      title: d.title || '[질문] 명령이 기대대로 동작하지 않아요',
      body:
`[환경] OS/브라우저: 
[시도한 명령]
$ (예) cd ~
$ mkdir -p projects/algo/src
$ ls -l

[기대한 결과]
(예) ~/projects 아래에 algo/src 디렉터리 생성

[실제 결과/에러]
(터미널 출력 복붙)

[추가 정보]
(tree 출력이나 stat 출력 첨부)`,
    }));
  };

  return (
    <div className="bg-[#0e1118] border border-gray-800 rounded-2xl p-4 mb-6">
      <div className="font-semibold mb-2">새 글 작성</div>
      <div className="grid md:grid-cols-2 gap-3">
        <input ref={titleRef} className="bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" placeholder="제목" 
               value={draft.title} onChange={e=>setDraft(d=>({...d, title:e.target.value}))}/>
        <div className="flex gap-2">
          <select className="flex-1 bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" 
                  value={draft.tag} onChange={e=>setDraft(d=>({...d, tag:e.target.value}))}>
            <option value="Q&A">Q&A</option>
            <option value="TIP">TIP</option>
            <option value="BUG">BUG</option>
            <option value="SHOW">SHOW</option>
          </select>
          <input className="w-40 bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" placeholder="닉네임" 
                 value={draft.author} onChange={e=>setDraft(d=>({...d, author:e.target.value}))}/>
        </div>
      </div>
      <textarea className="mt-3 w-full h-40 bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                placeholder="내용 (터미널 출력/에러 복붙 환영)"
                value={draft.body} onChange={e=>setDraft(d=>({...d, body:e.target.value}))}/>
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm" onClick={()=>onSubmit(draft)}>등록</button>
        <button className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm" onClick={setTemplate}>질문 템플릿 채우기</button>
        <button className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm" onClick={()=>setDraft({ title:'', body:'', author:draft.author, tag:'Q&A' })}>초기화</button>
      </div>
    </div>
  );
}

function CommentList({ post, onAdd, onDelete, nickname }) {
  const [text, setText] = useState('');
  const add = async () => {
    if (!text.trim()) return;
    await onAdd(post.id, { author: nickname || '익명', body: text.trim() });
    setText('');
  };
  return (
    <div className="mt-3">
      {post.comments?.length ? (
        <div className="space-y-2">
          {post.comments.map(c=>(
            <div key={c.id} className="text-sm bg-black/20 border border-gray-800 rounded-xl p-2">
              <div className="text-gray-300"><b>{c.author}</b> · <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</span></div>
              <div className="whitespace-pre-wrap text-gray-200">{c.body}</div>
              {nickname && nickname===c.author && (
                <button className="text-xs text-rose-300 mt-1" onClick={()=>onDelete(c.id)}>삭제</button>
              )}
            </div>
          ))}
        </div>
      ) : <div className="text-sm text-gray-400">아직 댓글이 없어요.</div>}
      <div className="flex gap-2 mt-2">
        <input className="flex-1 bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" placeholder="댓글 입력"
               value={text} onChange={e=>setText(e.target.value)}/>
        <button className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm" onClick={add}>등록</button>
      </div>
    </div>
  );
}

function PostItem({ post, onVote, onDelete, onUpdate, onAddComment, onDeleteComment, nickname }) {
  const mine = nickname && nickname === post.author;
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ title: post.title, body: post.body, tag: post.tag });

  const saveEdit = async () => {
    await onUpdate({ ...post, ...draft });
    setEdit(false);
  };

  return (
    <div className="bg-[#0e1118] border border-gray-800 rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TagBadge tag={post.tag} />
            <div className="font-semibold">{post.title}</div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{post.author || '익명'} · {new Date(post.created_at).toLocaleString()}</div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button className="px-2 py-1 rounded bg-black/30 border border-gray-700" onClick={()=>onVote(post.id,+1)}>▲ {post.votes||0}</button>
          <button className="px-2 py-1 rounded bg-black/30 border border-gray-700" onClick={()=>onVote(post.id,-1)}>▼</button>
          {mine && !edit && <button className="px-2 py-1 rounded bg-black/30 border border-gray-700" onClick={()=>setEdit(true)}>수정</button>}
          {mine && <button className="px-2 py-1 rounded bg-rose-700/40 border border-rose-700/50" onClick={()=>onDelete(post.id)}>삭제</button>}
        </div>
      </div>

      {!edit ? (
        <div className="mt-3 whitespace-pre-wrap text-gray-200">{post.body}</div>
      ) : (
        <div className="mt-3 space-y-2">
          <input className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" value={draft.title} onChange={e=>setDraft(d=>({...d, title:e.target.value}))}/>
          <select className="bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" value={draft.tag} onChange={e=>setDraft(d=>({...d, tag:e.target.value}))}>
            <option value="Q&A">Q&A</option><option value="TIP">TIP</option><option value="BUG">BUG</option><option value="SHOW">SHOW</option>
          </select>
          <textarea className="w-full h-32 bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm" value={draft.body} onChange={e=>setDraft(d=>({...d, body:e.target.value}))}/>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm" onClick={saveEdit}>저장</button>
            <button className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm" onClick={()=>setEdit(false)}>취소</button>
          </div>
        </div>
      )}

      <CommentList
        post={post}
        onAdd={(postId, c)=> onAddComment(postId, c)}
        onDelete={(cid)=> onDeleteComment(cid)}
        nickname={nickname}
      />
    </div>
  );
}

function PostList({ items, ...handlers }) {
  if (!items.length) return <div className="text-sm text-gray-400">게시물이 없습니다. 첫 글을 작성해보세요!</div>;
  return (
    <div className="space-y-4">
      {items.map(p=>(
        <PostItem key={p.id} post={p} {...handlers} />
      ))}
    </div>
  );
}

function CommunityApp() {
  const [posts, setPosts] = useState([]);
  const [nickname, setNickname] = useState(localStorage.getItem('fs_comm_nick') || '');
  const [filter, setFilter] = useState({ q:'', tag:'ALL', sort:'latest' });
  const [draft, setDraft] = useState({ title:'', body:'', author:nickname, tag:'Q&A' });
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ localStorage.setItem('fs_comm_nick', nickname||''); setDraft(d=>({...d, author:nickname})); }, [nickname]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/posts', {
        include: 'comments',
        tag: filter.tag || 'ALL',
        sort: filter.sort || 'latest',
        q: filter.q || ''
      });
      setPosts(data.items || []);
    } catch (e) {
      console.error(e);
      // alert('포스트 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); }, [filter.tag, filter.sort, filter.q]);

  // CRUD (API)
  const submitPost = async (d) => {
    if (!d.title?.trim() || !d.body?.trim()) return alert('제목과 내용을 입력하세요.');
    await apiJson('POST', '/api/posts', { title: d.title.trim(), body: d.body.trim(), tag: d.tag, author: d.author?.trim() || '익명' });
    setDraft({ title:'', body:'', author:nickname, tag:'Q&A' });
    await load();
  };

  const vote = async (id, delta) => {
    await apiJson('POST', `/api/posts/${id}/vote`, { delta });
    await load();
  };

  const del  = async (id) => { await apiJson('DELETE', `/api/posts/${id}`); await load(); };

  const upd  = async (changed) => {
    await apiJson('PATCH', `/api/posts/${changed.id}`, { title: changed.title, body: changed.body, tag: changed.tag });
    await load();
  };

  const addComment = async (postId, c) => {
    await apiJson('POST', `/api/posts/${postId}/comments`, { author: c.author, body: c.body });
    await load();
  };
  const delComment = async (cid) => { await apiJson('DELETE', `/api/comments/${cid}`); await load(); };

  return (
    <div className="bg-[#10131a] border border-gray-800 rounded-2xl p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="font-semibold text-lg flex-1">Linux Filesystem 커뮤니티</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">닉네임</span>
          <input className="w-40 bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-sm"
                 placeholder="닉네임"
                 value={nickname} onChange={e=>setNickname(e.target.value)} />
          <button className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs" onClick={load}>
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
        </div>
      </div>

      <PostForm onSubmit={submitPost} draft={draft} setDraft={setDraft} />

      <Toolbar filter={filter} setFilter={setFilter} onNewTemplate={()=>{
        alert('질문 템플릿을 본문에 채웠습니다. 환경/명령/결과를 채워주세요!');
      }}/>

      <PostList
        items={posts}
        onVote={vote}
        onDelete={del}
        onUpdate={upd}
        onAddComment={addComment}
        onDeleteComment={delComment}
        nickname={nickname}
      />
    </div>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById('community-root')).render(<CommunityApp />);

// terminal.jsx (Live Server + Babel + UMD React용)
// 캐시버스팅 권장: <script type="text/babel" data-presets="env,react" src="terminal.jsx?v=jump2"></script>

const { useRef, useState, useEffect, useMemo } = React;

/* ===================== Data Structures ===================== */
class DLLNode { constructor(value){ this.value=value; this.prev=null; this.next=null; } }
class DoublyLinkedList {
  constructor(cmp){ this.head=null; this.tail=null; this.cmp=cmp||((a,b)=>(a<b?-1:a>b?1:0)); this._size=0; }
  size(){ return this._size; }
  insertSortedByName(value){
    const node=new DLLNode(value);
    if(!this.head){ this.head=this.tail=node; this._size++; return node; }
    let cur=this.head;
    while(cur && this.cmp(cur.value.name, value.name) < 0) cur=cur.next;
    if(!cur){ node.prev=this.tail; this.tail.next=node; this.tail=node; }
    else { node.next=cur; node.prev=cur.prev; if(cur.prev) cur.prev.next=node; else this.head=node; cur.prev=node; }
    this._size++; return node;
  }
  findByName(name){ let cur=this.head; while(cur){ if(cur.value.name===name) return cur; cur=cur.next; } return null; }
  remove(node){ if(!node) return; if(node.prev) node.prev.next=node.next; else this.head=node.next; if(node.next) node.next.prev=node.prev; else this.tail=node.prev; node.prev=node.next=null; this._size--; }
  toArray(){ const arr=[]; let cur=this.head; while(cur){ arr.push(cur.value); cur=cur.next; } return arr; }
}

class FileNode {
  constructor(type,name){
    this.type=type; this.name=name; this.size=0; this.parent=null;
    this.children = type==='DIR' ? new DoublyLinkedList((a,b)=>(a<b?-1:a>b?1:0)) : null;
    this.createdByMkdir=false; // mkdir로 생성된 디렉터리 강조용
  }
}

/* ===================== FS Helpers ===================== */
const isValidName=(s)=> !!s && s!=="." && s!==".." && !s.includes('/');

const splitPathParentBase=(path)=>{
  const i=path.lastIndexOf('/');
  if(i<0) return {parent:'', base:path};
  if(i===0) return {parent:'/', base:path.slice(1)};
  return {parent:path.slice(0,i), base:path.slice(i+1)};
};

const expandTilde=(p)=>{
  if(!p) return p;
  if(p[0]==='~'){
    if(p.length===1) return '/home/user';
    if(p[1]==='/') return `/home/user/${p.slice(2)}`;
  }
  return p;
};

function resolve(root,cwd,raw){
  if(!raw||!raw.length) return null;
  const path=expandTilde(raw);
  let cur=path.startsWith('/')?root:cwd;
  const parts=path.split('/').filter(Boolean);
  for(const tok of parts){
    if(tok==='.') continue;
    if(tok==='..'){ if(cur.parent) cur=cur.parent; continue; }
    if(cur.type!=='DIR') return null;
    const hit=cur.children.findByName(tok); if(!hit) return null; cur=hit.value;
  }
  return cur;
}

function resolveParent(root,cwd,raw){
  if(!raw||!raw.length) return null;
  const path=expandTilde(raw);
  const {parent,base}=splitPathParentBase(path);
  const parentNode = parent==='' ? cwd : resolve(root,cwd,parent===''?'.':parent);
  if(!parentNode || parentNode.type!=='DIR') return null;
  return { parent: parentNode, base };
}

// 반복형(스택) 후위순회 삭제
function removeSubtree(node){
  const s1=[node], s2=[];
  while(s1.length){
    const x=s1.pop(); s2.push(x);
    if(x.type==='DIR'){ let c=x.children.head; while(c){ s1.push(c.value); c=c.next; } }
  }
  while(s2.length){
    const x=s2.pop();
    if(x.parent){ const n=x.parent.children.findByName(x.name); if(n) x.parent.children.remove(n); x.parent=null; }
  }
}

/* ===================== Commands ===================== */
function initFS(){
  const root=new FileNode('DIR','');
  const home=new FileNode('DIR','home'); home.parent=root; root.children.insertSortedByName(home);
  const user=new FileNode('DIR','user'); user.parent=home; home.children.insertSortedByName(user);
  return { root, cwd: root }; // 시작 위치: 루트(/)
}

function pathOf(n){
  const seg=[]; let cur=n;
  while(cur && cur.name!==''){ seg.push(cur.name); cur=cur.parent; }
  return '/'+seg.reverse().join('/');
}

const cmd_pwd=(root,cwd)=> pathOf(cwd);

function cmd_cd(root,cwd,arg){
  let t;
  if(!arg||arg==='~') t=resolve(root,cwd,'/home/user')||root;
  else t=resolve(root,cwd,arg);
  if(!t||t.type!=='DIR') throw new Error('cd: 그런 디렉터리가 없음');
  return t;
}

// 터미널 출력용 간단 마크업([[blue]]...[[/]]) → React 요소
function renderMarkup(str){
  const out=[]; let i=0;
  while(i<str.length){
    const start=str.indexOf('[[blue]]', i);
    if(start===-1){ out.push(<span>{str.slice(i)}</span>); break; }
    if(start>i) out.push(<span>{str.slice(i,start)}</span>);
    const end=str.indexOf('[[/]]', start+8);
    if(end===-1){ out.push(<span>{str.slice(start)}</span>); break; }
    const content=str.slice(start+8, end);
    out.push(<span style={{color:'#60a5fa'}}>{content}</span>);
    i=end+5;
  }
  return out;
}

function cmd_ls(root,cwd,arg,flags){
  const { a:flagA, l:flagL } = flags||{};
  const t = arg ? resolve(root,cwd,arg) : cwd;
  if(!t) throw new Error('ls: 대상 없음');
  const lines=[];
  const colorize=(name,isBlue)=> isBlue ? `[[blue]]${name}[[/]]` : name;

  const printLine=(n)=>{
    if(!flagL){
      if(n.type==='DIR'){ lines.push(colorize(`${n.name}/`, n.createdByMkdir)); }
      else { lines.push(n.name); }
      return;
    }
    if(n.type==='DIR'){
      let cnt=0; let c=n.children.head; while(c){ cnt++; c=c.next; }
      const nm=colorize(`${n.name}/`, n.createdByMkdir);
      lines.push(`d ${String(cnt).padStart(5,' ')}  ${nm}`);
    }else{
      lines.push(`- ${String(n.size).padStart(5,' ')}  ${n.name}`);
    }
  };

  if(t.type==='FILE'){ printLine(t); return flagL ? lines.join('\n') : lines.join('  '); }

  if(flagA){
    if(flagL){
      let cnt=0; let c=t.children.head; while(c){ cnt++; c=c.next; }
      lines.push(`d ${String(cnt).padStart(5,' ')}  .`);
      const p=t.parent;
      if(p){ let pc=0, cc=p.children.head; while(cc){ pc++; cc=cc.next; } lines.push(`d ${String(pc).padStart(5,' ')}  ..`); }
      else lines.push(`d ${String(0).padStart(5,' ')}  ..`);
    }else{
      lines.push('.'); lines.push('..');
    }
  }

  let cur=t.children.head; while(cur){ printLine(cur.value); cur=cur.next; }
  // 기본: 가로 한 줄(공백 구분). -l일 때만 세로
  return flagL ? lines.join('\n') : lines.join('  ');
}

function cmd_mkdir(root,cwd,arg,pFlag){
  if(!arg) throw new Error('mkdir: 인자 필요 (help 참고)');
  const path=expandTilde(arg);
  if(pFlag){
    const parts=path.split('/'); let cur=path.startsWith('/')?root:cwd;
    for(const tok of parts){
      if(!tok||tok==='.') continue;
      if(tok==='..'){ if(cur.parent) cur=cur.parent; continue; }
      if(!isValidName(tok)) throw new Error('mkdir: 잘못된 경로(또는 파일과 충돌)');
      const hit=cur.children.findByName(tok);
      if(hit){
        if(hit.value.type!=='DIR') throw new Error('mkdir: 잘못된 경로(또는 파일과 충돌)');
        cur=hit.value;
      } else {
        const d=new FileNode('DIR',tok); d.parent=cur; d.createdByMkdir=true;
        cur.children.insertSortedByName(d); cur=d;
      }
    }
    return;
  }
  const rp=resolveParent(root,cwd,path); const {parent,base}=rp||{};
  if(!parent) throw new Error('mkdir: 잘못된 부모 경로');
  if(!isValidName(base)) throw new Error('mkdir: 잘못된 이름');
  if(parent.children.findByName(base)) throw new Error('mkdir: 이미 존재함');
  const d=new FileNode('DIR',base); d.parent=parent; d.createdByMkdir=true; parent.children.insertSortedByName(d);
}

function cmd_touch(root,cwd,arg,size){
  if(!arg) throw new Error('touch: 인자 필요 (help 참고)');
  const rp=resolveParent(root,cwd,arg); const {parent,base}=rp||{};
  if(!parent) throw new Error('touch: 잘못된 부모 경로');
  if(!isValidName(base)) throw new Error('touch: 잘못된 이름');
  const hit=parent.children.findByName(base);
  if(hit){ if(hit.value.type!=='FILE') throw new Error('touch: 파일이 아님'); hit.value.size=Number(size||0)||0; }
  else { const f=new FileNode('FILE',base); f.size=Number(size||0)||0; f.parent=parent; parent.children.insertSortedByName(f); }
}

function cmd_rm(root,cwd,arg,{r=false,f=false}={}){
  if(!arg){ if(f) return; throw new Error('rm: 인자 필요 (help 참고)'); }
  const t=resolve(root,cwd,arg);
  if(!t || t.name===''){ if(f) return; throw new Error('rm: 대상 없음 또는 금지됨'); }
  if(t.type==='DIR' && !r){ if(f) return; throw new Error('rm: 디렉터리입니다. -r 필요'); }
  const p=t.parent; if(!p){ if(f) return; throw new Error('rm: 대상 없음 또는 금지됨'); }
  const node=p.children.findByName(t.name); if(node) p.children.remove(node);
  if(t.type==='DIR') removeSubtree(t);
}

function cmd_rmdir(root,cwd,arg){
  if(!arg) throw new Error('rmdir: 인자 필요 (help 참고)');
  const t=resolve(root,cwd,arg);
  if(!t) throw new Error('rmdir: 대상 없음');
  if(t.type!=='DIR') throw new Error('rmdir: 디렉터리가 아님');
  if(t.children.size()!==0) throw new Error('rmdir: 디렉터리가 비어있지 않음');
  const p=t.parent; const node=p.children.findByName(t.name); if(node) p.children.remove(node);
}

function cmd_mv(root,cwd,src,dst){
  if(!src||!dst) throw new Error('mv: 인자 필요 (help 참고)');
  const s=resolve(root,cwd,src); if(!s||s.name==='') throw new Error('mv: 소스 없음');
  const d=resolve(root,cwd,dst);
  if(d){
    if(d.type==='DIR'){
      const exist=d.children.findByName(s.name);
      if(exist && exist.value.type==='DIR') throw new Error('mv: 대상 디렉터리에 같은 이름의 디렉터리 존재');
      if(exist) d.children.remove(exist);
      const sp=s.parent; const sn=sp.children.findByName(s.name); if(sn) sp.children.remove(sn);
      s.parent=d; d.children.insertSortedByName(s); return;
    }else{
      const dparent=d.parent; const dn=dparent.children.findByName(d.name); if(dn) dparent.children.remove(dn);
      const sp=s.parent; const sn=sp.children.findByName(s.name); if(sn) sp.children.remove(sn);
      s.name=d.name; s.parent=dparent; dparent.children.insertSortedByName(s); return;
    }
  }
  const rp=resolveParent(root,cwd,dst); if(!rp) throw new Error('mv: 대상 부모 없음');
  const {parent,base}=rp; if(!isValidName(base)) throw new Error('mv: 잘못된 이름');
  const ex=parent.children.findByName(base); if(ex){ if(ex.value.type==='DIR') throw new Error('mv: 대상 경로에 디렉터리 존재'); parent.children.remove(ex); }
  const sp=s.parent; const sn=sp.children.findByName(s.name); if(sn) sp.children.remove(sn);
  s.name=base; s.parent=parent; parent.children.insertSortedByName(s);
}

function cmd_cp(root,cwd,src,dst){
  if(!src||!dst) throw new Error('cp: 인자 필요 (help 참고)');
  const s=resolve(root,cwd,src); if(!s||s.type!=='FILE') throw new Error('cp: 소스가 파일이 아님');
  const d=resolve(root,cwd,dst);
  if(d){
    if(d.type==='DIR'){
      const ex=d.children.findByName(s.name);
      if(ex && ex.value.type!=='FILE') throw new Error('cp: 대상에 같은 이름의 디렉터리 존재');
      if(ex) ex.value.size=s.size;
      else { const f=new FileNode('FILE',s.name); f.size=s.size; f.parent=d; d.children.insertSortedByName(f); }
      return;
    } else { d.size=s.size; return; }
  }
  const rp=resolveParent(root,cwd,dst); if(!rp) throw new Error('cp: 대상 부모 없음');
  const {parent,base}=rp; if(!isValidName(base)) throw new Error('cp: 잘못된 이름');
  const ex=parent.children.findByName(base);
  if(ex && ex.value.type!=='FILE') throw new Error('cp: 대상 이름에 디렉터리 존재');
  if(ex) ex.value.size=s.size;
  else { const f=new FileNode('FILE',base); f.size=s.size; f.parent=parent; parent.children.insertSortedByName(f); }
}

function cmd_tree(root,cwd,arg){
  const t=arg?resolve(root,cwd,arg):cwd; if(!t) throw new Error('tree: 대상 없음');
  const lines=[]; const rec=(n,depth)=>{
    if(n===root) lines.push('/');
    let cur=n.children ? n.children.head : null;
    while(cur){ const c=cur.value; const ind='  '.repeat(depth);
      lines.push(c.type==='DIR' ? `${ind}└─ ${c.name}/` : `${ind}└─ ${c.name} (${c.size})`);
      if(c.type==='DIR') rec(c,depth+1); cur=cur.next;
    }
  };
  if(t===root) rec(t,0); else { lines.push(t.type==='DIR'?`${t.name}/`:`${t.name} (${t.size})`); if(t.type==='DIR') rec(t,0); }
  return lines.join('\n');
}

function cmd_stat(root,cwd,arg){
  const t=arg?resolve(root,cwd,arg):cwd; if(!t) throw new Error('stat: 대상 없음');
  const out=[]; out.push(`name: ${t===root?'/':t.name}`); out.push(`type: ${t.type==='DIR'?'DIR':'FILE'}`);
  if(t.type==='FILE') out.push(`size: ${t.size}`); else { let cnt=0; let c=t.children.head; while(c){ cnt++; c=c.next; } out.push(`children: ${cnt}`); }
  out.push(`path: ${pathOf(t)}`); return out.join('\n');
}

function cmd_help(){
  return [
    'Commands (Ubuntu-like):',
    '  clear',
    '  pwd',
    '  cd [PATH|~]',
    '  ls [-l] [-a] [PATH]   (기본: 가로 한 줄 출력)',
    '  mkdir [-p] PATH       (새 디렉터리는 파란색 강조)',
    '  rmdir PATH',
    '  touch PATH [size]',
    '  rm [-r] [-f] PATH',
    '  mv SRC DST',
    '  cp SRC DST (files only)',
    '  tree [PATH]',
    '  stat [PATH]',
    '  help',
    '  exit (page reload)'
  ].join('\n');
}

/* ===================== App ===================== */
function App(){
  // ✅ 단일 initFS 인스턴스
  const initial = useMemo(()=>initFS(), []);
  const [{ root }, setFS] = useState(initial);
  const [cwd, setCwd] = useState(initial.cwd);

  // 탭
  const [tab, setTab] = useState('terminal');

  // 현재 '해보기'로 선택된 튜토리얼/챌린지
  const [activeTask, setActiveTask] = useState(null);

  // 터미널 상태
  const [lines, setLines] = useState(["FS edu shell. Type 'help' for commands."]);

  // 🔝 바로 실습으로 이 페이지에 처음 진입했을 때, 무조건 페이지 맨 위에서 시작
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
    } catch {}

    // 페이지가 처음 열릴 때 항상 맨 위에서 시작
    window.scrollTo(0, 0);
  }, []);

  // 입력 포커스 관리
  const inputRef = useRef(null);
  const focusInput = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      // preventScroll 을 지원하지 않는 브라우저에서만 스크롤이 살짝 내려갈 수 있으므로,
      // 초기 렌더에서는 아래 useEffect 의 firstFocusRef 로 막아준다.
      el.focus();
    }
  };
  const firstFocusRef = useRef(true);

  // 터미널 탭이 활성화되고 lines 가 바뀔 때마다 포커스는 유지하되,
  // 첫 렌더링 시에는 포커스를 주지 않아 "바로 실습" 진입 시 스크롤이 내려가지 않도록 한다.
  useEffect(() => {
    if (firstFocusRef.current) {
      firstFocusRef.current = false;
      return; // 최초 진입 시에는 포커스 X
    }
    if (tab === 'terminal') {
      focusInput();
    }
  }, [tab, lines.length]);

  // 👉 터미널로 점프(요청사항)
  const focusTerminal = () => {
    setTab('terminal');
    setTimeout(() => {
      // 해보기/데모 버튼을 눌렀을 때, 터미널 박스가 화면 거의 맨 위에서 시작하도록 스크롤
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const anchor = document.getElementById('terminal-anchor');
        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          const absoluteY = rect.top + window.scrollY;
          const offset = 40; // 헤더/여백 고려해서 살짝 더 위로 올리기
          window.scrollTo({
            top: absoluteY - offset,
            behavior: 'smooth',
          });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
      // 스크롤 이동 후 터미널 입력에 포커스
      focusInput();
    }, 0);
  };

  const append=(text)=> setLines((prev)=>[...prev, ...(text===''?[]:text.split('\n'))]);
  const prompt=()=> `${pathOf(cwd)} $`;

  // 토크나이저 & 플래그 파서
  const tokenize=(line)=>{
    const out=[]; let i=0,n=line.length;
    while(i<n){
      while(i<n && /\s/.test(line[i])) i++;
      if(i>=n) break;
      if(line[i]==='"'){ i++; let b=''; while(i<n && line[i]!=='"'){ b+=line[i++]; } out.push(b); if(i<n && line[i]==='"') i++; }
      else { let s=i; while(i<n && !/\s/.test(line[i])) i++; out.push(line.slice(s,i)); }
    }
    return out;
  };
  const parseFlags=(tokens,allowed)=>{
    const flags={...allowed},rest=[];
    for(const t of tokens){
      if(t.startsWith('-')&&t.length>1){ for(let i=1;i<t.length;i++){ const k=t[i]; if(k in flags) flags[k]=true; } }
      else rest.push(t);
    }
    return {flags,rest};
  };

  const run=(line)=>{
    const raw=line.trim(); if(!raw) return;
    if(raw==='exit'){ window.location.reload(); return; }
    try{
      
      const tokens=tokenize(raw); const cmd=tokens.shift()||''; let out='';
      switch(cmd){
        case 'pwd': out=cmd_pwd(root,cwd); break;
        case 'cd': { const arg=tokens[0]; const next=cmd_cd(root,cwd,arg); setCwd(next); out=''; break; }
        case 'ls': { const {flags,rest}=parseFlags(tokens,{l:false,a:false}); out=cmd_ls(root,cwd,rest[0],flags); break; }
        case 'mkdir': { const {flags,rest}=parseFlags(tokens,{p:false}); if(!rest[0]) throw new Error('mkdir: 인자 필요 (help 참고)'); cmd_mkdir(root,cwd,rest[0],flags.p); break; }
        case 'rmdir': { if(!tokens[0]) throw new Error('rmdir: 인자 필요 (help 참고)'); cmd_rmdir(root,cwd,tokens[0]); break; }
        case 'touch': { const p=tokens[0], sz=tokens[1]; cmd_touch(root,cwd,p,sz); break; }
        case 'rm': { const {flags,rest}=parseFlags(tokens,{r:false,f:false}); if(!rest[0] && !flags.f) throw new Error('rm: 인자 필요 (help 참고)'); cmd_rm(root,cwd,rest[0],flags); break; }
        case 'mv': { const s=tokens[0], d=tokens[1]; if(!s||!d) throw new Error('mv: 인자 필요 (help 참고)'); cmd_mv(root,cwd,s,d); break; }
        case 'cp': { const s=tokens[0], d=tokens[1]; if(!s||!d) throw new Error('cp: 인자 필요 (help 참고)'); cmd_cp(root,cwd,s,d); break; }
        case 'tree': { out=cmd_tree(root,cwd,tokens[0]); break; }
        case 'stat': { out=cmd_stat(root,cwd,tokens[0]); break; }
        case 'help': out=cmd_help(); break;
        case 'clear': setLines([]); return;

        // 별칭
        case 'll': { out = cmd_ls(root, cwd, undefined, { l:true, a:false }); break; }
        case 'la': { out = cmd_ls(root, cwd, undefined, { l:false, a:true }); break; }
        case 'lsa': { out = cmd_ls(root, cwd, undefined, { l:true, a:true }); break; }

        default: out='알 수 없는 명령입니다 (help 참고)';
      }
      if(out) append(out);
    }catch(e){ append(e.message||String(e)); }
  };

  const onSubmit=(e)=>{
    e.preventDefault();
    const val=inputRef.current.value;
    setLines(prev=>[...prev, `${prompt()} ${val}`]);
    run(val);
    inputRef.current.value='';
    focusInput();
  };

  // 여러 명령을 연속으로 실행(튜토리얼/데모용)
  const runSeq = (seq) => {
    seq.forEach(cmd => {
      setLines(prev=>[...prev, `${prompt()} ${cmd}`]);
      run(cmd);
    });
  };

  const resetFS=()=>{
    const next=initFS();
    setFS(next);        // root 갱신
    setCwd(next.cwd);   // cwd도 같은 인스턴스 기준으로 갱신
    setLines(["FS edu shell. Type 'help' for commands."]);
  };

  /* ===== Left Tree ===== */
  const Tree=({node,depth=0})=>{
    const children = node.type==='DIR' ? node.children.toArray() : [];
    return (
      <div>
        {node===root ? <div className="font-semibold">/</div> : null}
        {children.map((c)=>(
          <div key={pathOf(c)}>
            <div className="flex items-center gap-2 ml-[calc(1rem*var(--depth))]" style={{['--depth']: depth+1}}>
              <span className="text-sm text-gray-300">{' '.repeat(depth*2)}</span>
              <span className={c.createdByMkdir ? 'text-blue-400' : 'text-gray-100'}>
                {c.type==='DIR'?'📁':'📄'} {c.name}{c.type==='DIR'?'/':''}
              </span>
            </div>
            {c.type==='DIR' && <div className="ml-4"><Tree node={c} depth={depth+1}/></div>}
          </div>
        ))}
      </div>
    );
  };

  /* ===== Terminal ===== */
  const Terminal = () => {
    const viewportRef = useRef(null);

    useEffect(() => {
      const el = viewportRef.current;
      if (!el) return;
      // 새 출력이 생길 때마다 항상 맨 아래로 스크롤
      el.scrollTop = el.scrollHeight;
    }, [lines.length]);

    return (
      <div className="flex flex-col h-[60vh]">
        <div className="text-lg font-bold mb-2">Terminal</div>
        <div
          ref={viewportRef}
          className="flex-1 overflow-auto font-mono text-sm whitespace-pre-wrap leading-6 bg-black/40 rounded-xl p-3 border border-gray-800"
        >
          {lines.map((ln, i) => (
            <div key={i}>{renderMarkup(ln)}</div>
          ))}
        </div>
        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <div className="px-3 py-2 rounded-xl bg-black/50 border border-gray-800 flex-1 flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400 select-none">{`${pathOf(cwd)} $`}</span>
            <input
              ref={inputRef}
              className="flex-1 bg-transparent outline-none font-mono text-sm"
              placeholder="명령을 입력하세요 (help)"
            />
          </div>
          <button className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500" type="submit">
            Run
          </button>
        </form>
        <div className="text-xs text-gray-500 mt-2">
          예: cd ~ · mkdir -p school/2025 · touch a 10 · ls · ls -l · rm -rf school
        </div>
      </div>
    );
  };

  /* ===== Lesson / Challenge Cards ===== */
  const LessonCard = ({title, desc, cmds, tier}) => {
    const [opened, setOpened] = useState(false);

    const tierClasses =
      tier === 'bronze'
        ? 'border-orange-500/40 bg-orange-500/5'
        : tier === 'silver'
        ? 'border-slate-400/50 bg-slate-500/10'
        : tier === 'gold'
        ? 'border-amber-400/60 bg-amber-500/10'
        : tier === 'platinum'
        ? 'border-cyan-400/60 bg-cyan-500/10'
        : 'bordergray-800 bg-[#0e1118]';

    const handleTry = () => {
      setOpened(true);
      setActiveTask({
        kind: 'lesson',
        title,
        body: desc,
        cmds,
      });
      focusTerminal();
    };

    return (
      <div className={`rounded-2xl p-4 ${tierClasses}`}>
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-sm text-gray-300 mb-3 whitespace-pre-wrap">{desc}</div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm"
            onClick={handleTry}
          >
            해보기
          </button>
          {opened && cmds && (
            <>
              <button
                className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm"
                onClick={() => {
                  runSeq(cmds);
                  focusTerminal();
                }}
              >
                예제 실행
              </button>
              <button
                className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm"
                onClick={() => {
                  append('--- 예상 출력은 tree/ls로 직접 확인하세요 ---');
                  focusTerminal();
                }}
              >
                힌트 보기
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const ChallengeCard = ({no, goal, check, tier}) => {
    const [opened, setOpened] = useState(false);

    const tierClasses =
      tier === 'bronze'
        ? 'border-orange-500/40 bg-orange-500/5'
        : tier === 'silver'  
        ? 'border-slate-400/50 bg-slate-500/10'
        : tier === 'gold'
        ? 'border-amber-400/60 bg-amber-500/10'
        : tier === 'platinum'
        ? 'border-cyan-400/60 bg-cyan-500/10'
        : 'border-gray-800 bg-[#0e1118]';

    const tierLabel =
      tier === 'bronze'
        ? 'BRONZE'
        : tier === 'silver'
        ? 'SILVER'
        : tier === 'gold'
        ? 'GOLD'
        : tier === 'platinum'
        ? 'PLATINUM'
        : null;

    const handleTry = () => {
      setOpened(true);
      setActiveTask({
        kind: 'challenge',
        title: `챌린지 ${no}`,
        body: goal,
        check,
      });
      focusTerminal();
    };

    return (
      <div className={`rounded-2xl p-4 ${tierClasses}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold">{`챌린지 ${no}`}</div>
          {tierLabel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/30 border border-white/10">
              {tierLabel}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-300 mb-3 whitespace-pre-wrap">{goal}</div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm"
            onClick={handleTry}
          >
            해보기
          </button>
          {opened && (
            <>
              <button
                className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm"
                onClick={() => {
                  const ok = check() ;
                  append(ok ? '✅ 통과!' : '❌ 아직 목표 상태가 아닙니다. tree ~ / ls로 구조를 확인하세요.');
                  focusTerminal();
                }}
              >
                검사하기
              </button>
              <button
                className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm"
                onClick={() => {
                  resetFS();
                }}
              >
                FS 초기화
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // 검사용 헬퍼들
  const expectDir = (absPath)=>{ const n=resolve(root, root, absPath); return !!(n && n.type==='DIR'); };
  const expectFile = (absPath, size)=>{ const n=resolve(root, root, absPath); if(!n || n.type!=='FILE') return false; if(typeof size==='number') return n.size===size; return true; };
  const expectNoNode = (absPath)=>{ const n=resolve(root, root, absPath); return !n; };

  const challenge1_check = ()=> expectDir('/home/user/dltmdwls') && expectDir('/home/user/school') && expectDir('/home/user/teamlog');
  const challenge2_check = ()=> expectDir('/home/user/projects') && expectDir('/home/user/projects/algo/src') && expectDir('/home/user/projects/system/docs');
  const challenge3_check = ()=> expectDir('/home/user/work') && expectFile('/home/user/work/readme.txt', 120);
  const challenge4_check = ()=> expectDir('/home/user/clean') && expectNoNode('/home/user/trash');

  return (
    <div className="min-h-screen bg-[#0b0d12] text-gray-100 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Tree + Info */}
        <div className="lg:col-span-1 bg-[#10131a] border border-gray-800 rounded-2xl p-4 shadow flex flex-col self-start">
          <div className="mb-2 font-bold">
            <span className="text-xl">Filesystem project</span>
            <span className="mx-1 text-sm text-gray-400">- 10114 이승진 -</span>
          </div>
          <div className="text-xs text-gray-400 mb-3">자료구조: 트리(Tree), 이중연결리스트(DLL), 스택(반복형 삭제)</div>

          <div className= "max-h-[55vh] overflow-auto pr-2"><Tree node={root} /></div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs"
              onClick={()=> { runSeq(['cd ~','mkdir -p school/2025/report','touch ~/school/2025/report/readme.txt 120','ls','tree ~']); focusTerminal(); }}
            >Demo: school</button>
            <button
              className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs"
              onClick={()=> { runSeq(['cd ~','mkdir work','cd work','touch a.txt 10','cp a.txt b.txt','ls','mv b.txt renamed.txt','ls -l']); focusTerminal(); }}
            >Demo: files</button>
            <button
              className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs"
              onClick={()=> { resetFS(); focusTerminal(); }}
            >FS 초기화</button>
          </div>

        </div>

        {/* RIGHT: Tabs */}
        <div
          id="terminal-anchor"
          className="lg:col-span-2 bg-[#10131a] border border-gray-800 rounded-2xl p-4 shadow flex flex-col"
        >
          <div className="flex gap-2 mb-4">
            {['terminal','cheats'].map(key=>(
              <button
                key={key}
                onClick={()=>setTab(key)}
                className={`px-4 py-2 rounded-xl border ${tab===key? 'bg-indigo-600 border-indigo-500' : 'bg-black/30 border-gray-800 hover:bg-black/40'}`}
              >
                {key==='terminal' ? '터미널' : '치트시트'}
              </button>
            ))}
          </div>

          {activeTask && (
            <div className="mb-4 rounded-2xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-3 text-sm">
              <div className="mb-2 flex items-start justify-between">
                <div className="text-[11px] font-semibold text-indigo-300 tracking-wide">
                  현재 해보는 문제
                </div>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded-full border border-indigo-400/70 text-[10px] text-indigo-200 hover:bg-indigo-500/30"
                  onClick={() => setActiveTask(null)}
                  aria-label="현재 문제 닫기"
                >
                  ×
                </button>
              </div>
              <div className="font-semibold mb-1">
                {activeTask.title}
              </div>
              <div className="text-xs text-gray-200 whitespace-pre-wrap max-h-32 overflow-auto">
                {activeTask.body}
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {activeTask.kind === 'lesson' && activeTask.cmds && (
                  <>
                    <button
                      className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs"
                      onClick={() => {
                        runSeq(activeTask.cmds);
                        focusTerminal();
                      }}
                    >
                      예제 실행
                    </button>
                    <button
                      className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs"
                      onClick={() => {
                        append('--- 예상 출력은 tree/ls로 직접 확인하세요 ---');
                        focusTerminal();
                      }}
                    >
                      힌트 보기
                    </button>
                  </>
                )}
                {activeTask.kind === 'challenge' && activeTask.check && (
                  <>
                    <button
                      className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs"
                      onClick={() => {
                        const ok = activeTask.check();
                        append(ok ? '✅ 통과!' : '❌ 아직 목표 상태가 아닙니다. tree ~ / ls로 구조를 확인하세요.');
                        focusTerminal();
                      }}
                    >
                      검사하기
                    </button>
                    <button
                      className="px-3 py-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs"
                      onClick={() => {
                        resetFS();
                      }}
                    >
                      FS 초기화
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Panels */}
          {tab==='terminal' && (
            <div>
              <Terminal/>
            </div>
          )}

          {tab==='cheats' && (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#0e1118] border border-gray-800 rounded-2xl p-4">
                <div className="font-semibold mb-2">기본 명령</div>
                <pre className="whitespace-pre-wrap">
{`pwd
cd [PATH|~]
ls [-l] [-a] [PATH]
mkdir [-p] PATH
rmdir PATH
touch PATH [size]
rm [-r] [-f] PATH
mv SRC DST
cp SRC DST
tree [PATH]
stat [PATH]
help | clear | exit`}
                </pre>
              </div>
              <div className="bg-[#0e1118] border border-gray-800 rounded-2xl p-4">
                <div className="font-semibold mb-2">팁</div>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>기본 ls는 가로 한 줄 출력, -l은 세로 상세</li>
                  <li>새로 만든 폴더는 파란색으로 강조</li>
                  <li>별칭: ll=ls -l, la=ls -a, lsa=ls -la</li>
                  <li>~ 는 /home/user 로 확장됩니다</li>
                  <li>트리 뷰는 실시간으로 상태를 반영합니다</li>
                </ul>
              </div>
            </div>
          )}
        </div>
        {/* 튜토리얼/챌린지 바닥 카드 - Dreamhack 스타일 목록 */}
        {tab === 'terminal' && (
          <>
            {/* 튜토리얼 카드 (항상 펼쳐진 목록) */}
            <div className="lg:col-span-2 bg-[#0e1118] border border-gray-800 rounded-2xl p-7 shadow flex flex-col gap-4 mt-8">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="font-semibold text-base">튜토리얼 목록</div>
                  <div className="text-xs text-gray-400 mt-1">
                    리눅스 기본 감각을 익히는 4단계 연습 (BRONZE ~ PLATINUM)
                  </div>
                </div>
                <div className="text-[11px] text-gray-400">
                  총 4개 · 연습용 난이도 코스
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LessonCard
                  title="BRONZE · 리눅스 첫 걸음"
                  tier="bronze"
                  desc={
                    '리눅스를 처음 보는 단계에서 꼭 해 보면 좋은 기본 동작들입니다.\n' +
                    '지금 내가 어디 있는지 확인하고( pwd ), 홈/부모 디렉터리를 오가며 방향 감각을 익혀봅니다.'
                  }
                  cmds={['pwd','ls','ls -a','cd ~','cd ..','pwd']}
                />
                <LessonCard
                  title="SILVER · 작은 폴더 나무 만들기"
                  tier="silver"
                  desc={
                    'mkdir 와 mkdir -p 로 폴더 구조를 직접 만들어 보고, tree 로 전체 구조를 눈으로 확인해 보는 단계입니다.\n' +
                    '“폴더가 트리처럼 생겼다”는 감각을 잡는 것이 목표입니다.'
                  }
                  cmds={['cd ~','mkdir study','mkdir -p study/linux/day1','tree study']}
                />
                <LessonCard
                  title="GOLD · 파일 채워 넣고 정리하기"
                  tier="gold"
                  desc={
                    'touch 로 여러 파일을 만든 뒤, mv 와 cp 로 이름과 위치를 바꾸어 보면서 파일 정리 감각을 익힙니다.\n' +
                    'stat 으로 파일 크기와 정보를 확인해 보는 것도 함께 연습합니다.'
                  }
                  cmds={['cd ~','mkdir -p practice/files','cd practice/files','touch memo.txt','touch todo.txt','ls','mv memo.txt memo-old.txt','cp todo.txt todo-backup.txt','stat memo-old.txt']}
                />
                <LessonCard
                  title="PLATINUM · 정리 & 삭제 루틴 연습"
                  tier="platinum"
                  desc={
                    '일부러 지저분한 구조를 만든 뒤, rm -r 과 tree 를 이용해서 깔끔하게 비우는 연습입니다.\n' +
                    '실수해도 괜찮은 연습용 환경에서 “정리 루틴”을 몸에 익히는 것이 목표입니다.'
                  }
                  cmds={['cd ~','mkdir -p trash-test/a/b','touch trash-test/a/tmp1 5','touch trash-test/a/b/tmp2 3','tree trash-test','rm -r trash-test','tree ~']}
                />
              </div>
            </div>

            {/* 실습 챌린지 카드 (항상 펼쳐진 목록) */}
            <div className="lg:col-span-2 bg-[#0e1118] border border-gray-800 rounded-2xl p-7 shadow flex flex-col gap-4">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="font-semibold text-base">실습 챌린지 목록</div>
                  <div className="text-xs text-gray-400 mt-1">
                    실제 시험처럼 조건을 만족하도록 디렉터리/파일을 구성해 보세요.
                  </div>
                </div>
                <div className="text-[11px] text-gray-400">
                  총 4개 · BRONZE ~ PLATINUM
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChallengeCard
                  no={1}
                  tier="bronze"
                  goal={
                    '[BRONZE] 홈 주변 디렉터리를 만들어 보는 기본 챌린지입니다.\n\n' +
                    '홈(~)에 dltmdwls, school, teamlog 디렉터리를 모두 생성하세요.\n' +
                    '힌트: cd ~ → mkdir dltmdwls → mkdir school → mkdir teamlog'
                  }
                  check={challenge1_check}
                />
                <ChallengeCard
                  no={2}
                  tier="silver"
                  goal={
                    '[SILVER] 중첩된 폴더 트리를 만드는 챌린지입니다.\n\n' +
                    '다음 구조를 만들어 보세요:\n~/projects/algo/src 와 ~/projects/system/docs'
                  }
                  check={challenge2_check}
                />
                <ChallengeCard
                  no={3}
                  tier="gold"
                  goal={
                    '[GOLD] 파일 생성과 크기 설정을 확인하는 챌린지입니다.\n\n' +
                    '~/work 폴더를 만들고, 그 안에 readme.txt(크기 120)를 생성하세요.'
                  }
                  check={challenge3_check}
                />
                <ChallengeCard
                  no={4}
                  tier="platinum"
                  goal={
                    '[PLATINUM] 디렉터리 정리 루틴을 연습하는 챌린지입니다.\n\n' +
                    ') 홈(~) 아래에 clean 과 trash 디렉터리를 만드세요.\n' +
                    '2) trash 안에는 어떤 파일/폴더를 넣어도 괜찮습니다.\n' +
                    '3) 정리가 끝났다면 trash 디렉터리를 통째로 지우고, clean 만 남겨두세요.\n\n' +
                    '검사하기 버튼을 눌렀을 때, ~/clean 은 남아 있고 ~/trash 는 존재하지 않아야 합니다.'
                  }
                  check={challenge4_check} 
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============= Mount ============= */
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
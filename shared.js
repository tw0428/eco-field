/* 現場紀錄與棲地評估共用的程式：啟動、更新機制、浮動選單、案件挑選器。改這裡兩頁一起變。 */
const ECO_VER="1fc82c7969"; // 版本章：deploy.ps1 依內容自動更新，不要手改（↻ 靠它判斷有沒有新版）
const ECO_PAGES_CACHE="eco-pages-v5"; // 與 sw.js 的 CACHE 同名
// 程式出錯時直接顯示在右上角狀態（避免只看到「連線中…」）
window.addEventListener("error",e=>{const c=document.getElementById("conn");if(c)c.textContent="程式錯誤："+(e.message||"未知")+(e.lineno?"（第"+e.lineno+"行）":"")});

// LINE內建瀏覽器跟Safari分開存金鑰與定位權限 → 自動改用外部瀏覽器開（LINE支援 openExternalBrowser=1）
if(/\bLine\//i.test(navigator.userAgent)&&!/openExternalBrowser=1/.test(location.search)){const u=new URL(location.href);u.searchParams.set("openExternalBrowser","1");location.replace(u.href)}
// 同事分享連結 #k=金鑰：存進這支手機後從網址拿掉（#後面的內容不會送到任何伺服器）
else{const m=location.hash.match(/[#&]k=([^&]+)/);if(m){try{localStorage.setItem("gh-token",decodeURIComponent(m[1]))}catch(e){}history.replaceState(null,"",location.pathname+location.search)}}
// 網頁存手機（sw.js）：有新版時顯示提示條，點了才換新版（避免表單填一半被重新整理）；頁面可設 window.ecoBeforeReload 在重整前先存檔
if("serviceWorker" in navigator&&location.protocol==="https:"){
  navigator.serviceWorker.onmessage=e=>{if(!e.data||e.data.type!=="update"||document.getElementById("updBar"))return;
    // 剛打開（8 秒內）、還沒動手輸入：直接換新版，不用再按一次（30 秒內只自動換一次，避免連續重整）
    try{const t=+sessionStorage.getItem("eco-autoupd")||0,ae=document.activeElement,typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)&&ae.value;
      if(performance.now()<8000&&!typing&&Date.now()-t>30000){sessionStorage.setItem("eco-autoupd",String(Date.now()));location.reload();return}}catch(_){}
    const b=document.createElement("button");b.id="updBar";b.type="button";b.textContent="有新版本，點這裡更新";
    b.style.cssText="position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:99;padding:14px;border-radius:10px;border:0;background:#657359;color:#fff;font:inherit;font-size:16px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.3)";
    b.onclick=()=>{Promise.resolve(window.ecoBeforeReload?window.ecoBeforeReload():0).catch(()=>0).finally(()=>location.reload())};document.body.appendChild(b)};
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
// ↻ 時順便檢查工具本身：頁面內嵌的程式與樣式、共用的 shared.js / shared.css 只要有一個和現在跑的不同，就換進手機副本並重新載入
const appSig=d=>[...d.querySelectorAll("script:not([src]),style")].map(e=>e.textContent).join("\n");
let appSigNow=null;document.addEventListener("DOMContentLoaded",()=>{appSigNow=appSig(document)});
const ecoCssVer=()=>getComputedStyle(document.documentElement).getPropertyValue("--eco-ver").replace(/["' ]/g,"");
async function appUpd(){
  try{const p=location.pathname.split("/").pop()||"index.html",bust="?swbypass="+Date.now(),o={cache:"no-store"};
    const [r,rj,rc]=await Promise.all([fetch(p+bust,o),fetch("shared.js"+bust,o),fetch("shared.css"+bust,o)]);
    if(!r.ok||!rj.ok||!rc.ok||appSigNow==null)return false;
    const [t,tj,tc]=await Promise.all([r.text(),rj.text(),rc.text()]);
    const nj=(/ECO_VER="([^"]*)"/.exec(tj)||[])[1],nc=(/--eco-ver:"([^"]*)"/.exec(tc)||[])[1];
    if(appSig(new DOMParser().parseFromString(t,"text/html"))===appSigNow&&nj===ECO_VER&&nc===ecoCssVer())return false;
    const c=await caches.open(ECO_PAGES_CACHE);
    await Promise.all([[p,t,"text/html; charset=utf-8"],["shared.js",tj,"text/javascript; charset=utf-8"],["shared.css",tc,"text/css; charset=utf-8"]].map(([k,b,ct])=>c.put(k,new Response(b,{headers:{"Content-Type":ct}}))));
    return true
  }catch(e){return false}
}


// 線條圖示（樣式在 CSS 的 .ic-*）；setBt(按鈕, 圖示名, 文字) 重設按鈕內容
const ic=n=>{const i=document.createElement("i");i.className="ic ic-"+n;i.setAttribute("aria-hidden","true");return i};
const setBt=(e,n,t)=>{e.textContent="";e.append(ic(n),t==null?"":t);return e};

// 浮動選單（固定定位，不被捲動容器裁掉；選項文字會換行）。rows：{grp:"標題"} 或 {text,on,fn}
function popList(anchor,rows){
  if(anchor._pop&&anchor._pop.isConnected){anchor._pop.remove();anchor._pop=null;return}
  document.querySelectorAll(".wsel-pop").forEach(x=>x.remove());
  const pop=document.createElement("div");pop.className="wsel-pop";anchor._pop=pop;
  const close=()=>{pop.remove();document.removeEventListener("pointerdown",away,true);document.removeEventListener("scroll",onScroll,true);removeEventListener("resize",close)};
  const away=e=>{if(!pop.contains(e.target)&&!anchor.contains(e.target))close()},onScroll=e=>{if(!pop.contains(e.target))close()};
  rows.forEach(r=>{const d=document.createElement("div");if(r.grp){d.className="wsel-grp";d.textContent=r.grp}else{d.className="wsel-it"+(r.on?" on":"");d.textContent=r.text;d.onclick=()=>{close();r.fn()}}pop.appendChild(d)});
  document.body.appendChild(pop);
  const a=anchor.getBoundingClientRect(),vh=innerHeight,w=Math.min(Math.max(a.width,280),innerWidth-16),below=vh-a.bottom-12,above=a.top-12,down=below>=240||below>=above;
  pop.style.width=w+"px";pop.style.left=Math.max(8,Math.min(a.left,innerWidth-w-8))+"px";pop.style.maxHeight=Math.max(160,Math.min(440,down?below:above))+"px";
  if(down)pop.style.top=a.bottom+4+"px";else pop.style.bottom=vh-a.top+4+"px";
  const on=pop.querySelector(".on");if(on)pop.scrollTop=Math.max(0,on.offsetTop-40);
  setTimeout(()=>{document.addEventListener("pointerdown",away,true);document.addEventListener("scroll",onScroll,true);addEventListener("resize",close)},0);
}
// 把 <select> 換成按鈕＋浮動選單（原 select 留著當資料來源，value／change事件照舊）；回傳要插進畫面的元素
function wrapSelect(sel,mirror){
  const w=document.createElement("div"),b=document.createElement("button");w.className="wsel";
  b.type="button";b.className="wsel-btn";w.appendChild(b);if(!mirror)sel.hidden=true;
  const sync=()=>{const o=sel.options[sel.selectedIndex];b.textContent=(o&&o.textContent)||"（選擇）";b.classList.toggle("ph",!sel.value);if(mirror){b.classList.toggle("on",sel.classList.contains("on"));b.classList.toggle("unf",sel.classList.contains("unf"));w.hidden=sel.hidden}};
  if(mirror){sel.classList.add("wsrc");new MutationObserver(sync).observe(sel,{attributes:true,attributeFilter:["hidden","class"]})} // mirror：原select仍由程式控制顯示與樣式，畫面只顯示這個按鈕
  // 選單開著時頁面若剛好重畫（例如資料存回雲端後），原 select 已被換掉：改找畫面上同一格的新 select 套用，否則點了沒反應
  const live=()=>{if(sel.isConnected)return sel;
    const q=Object.entries(sel.dataset).map(([k,v])=>`[data-${k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())}="${String(v).replace(/["\\]/g,"\\$&")}"]`).join("");
    return (q&&document.querySelector("select"+q))||sel};
  const pick=o=>{const s=live();s.value=o.value;s.dispatchEvent(new Event("change",{bubbles:true}));sync()};
  b.onclick=()=>{const rows=[];[...sel.children].forEach(ch=>{if(ch.tagName==="OPTGROUP"){rows.push({grp:ch.label});[...ch.children].forEach(o=>rows.push({text:o.textContent,on:o.value===sel.value,fn:()=>pick(o)}))}
      else rows.push({text:ch.textContent,on:ch.value===sel.value,fn:()=>pick(ch)})});popList(b,rows)};
  new MutationObserver(sync).observe(sel,{childList:true,subtree:true,characterData:true});sync();return w;
}

/* 案件挑選器：全螢幕清單＋搜尋（底層仍是原本的select；兩頁同一份程式）
   最上面「📌 釘選」（eco-pins，存在這支手機、兩頁共用，用id或案名對應）；其餘依「最近使用／地區／階段」分組（eco-pickmode，兩頁共用）
   地區、階段只用案件上明確設定的值（現場紀錄案件資訊區、本次階段），沒設定的歸「未設定」，不從案名推測
   長案名：保留開頭與最後10字、中間省略，工區編號才看得到 */
function nameEl(el,t){el.textContent="";
  // 選項文字＝案名＋（紀錄數）：紀錄數不顯示；案名結尾的括號（工區一）固定顯示，前面太長才省略
  const m=/^(.*?)(（\d+）)?$/.exec(t),nm=m[1],cnt=m[2]||"",tl=/（[^（）]+）$/.exec(nm);
  const h=document.createElement("span");h.className="nh";h.textContent=tl?nm.slice(0,tl.index):nm;el.appendChild(h);
  if(tl){const s=document.createElement("span");s.className="nt";s.textContent=tl[0];el.appendChild(s)}}
// 頂端按鈕：案名完整顯示（最多兩行），不放紀錄數
const btnName=(btn,t)=>{btn.textContent=t.replace(/（\d+）$/,"")};
// 複數工區：同一案的工區在清單合併成一列，選進去後案名下方切換工區；資料仍各工區一份
// 同案判斷：案件有 group（匯入時標）就用它，否則看案名結尾「（工區X）」
const ZRE=/^(.*?)\s*[（(]\s*(工區[^）)]*)\s*[）)]\s*$/,ZNUM="一二三四五六七八九十";
function zoneInfo(c){if(!c)return null;if(c.group)return {base:c.group,zone:c.zone||c.name};const m=ZRE.exec(c.name||"");return m?{base:m[1].trim(),zone:m[2]}:null}
const zoneNo=z=>{const m=/工區\s*([一二三四五六七八九十]|\d+)/.exec(z||"");return m?(/\d/.test(m[1])?+m[1]:ZNUM.indexOf(m[1])+1):99};
function zoneMates(id){const c=cases.find(x=>x.id===id),z=zoneInfo(c);if(!z)return c&&!c.trashedAt?[c]:[];
  return cases.filter(x=>!x.trashedAt&&(zoneInfo(x)||{}).base===z.base).sort((a,b)=>zoneNo(zoneInfo(a).zone)-zoneNo(zoneInfo(b).zone)||(a.name||"").localeCompare(b.name||"","zh-Hant"))}
// ops：add(name)建立並切到新案件、trash(id)移到垃圾桶、restore(id)復原、trashed()垃圾桶清單[{id,name}]
// 手機全螢幕、電腦置中面板；第一列「＋新增案件」，每列右邊📌釘選＋紅色垃圾桶（按兩次才移除），垃圾桶在最下面可復原
const TRASH_SVG='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>';
function makePicker(sel,recentKey,metaOf,ops){
  ops=ops||{};
  const btn=document.createElement("button");btn.type="button";btn.className="pickbtn grow act";sel.before(btn);sel.hidden=true;
  const zbar=document.createElement("div");zbar.className="zonebar";zbar.hidden=true;btn.parentElement.after(zbar);
  const pick=v=>{if(sel.value!==v){sel.value=v;sel.dispatchEvent(new Event("change",{bubbles:true}))}};
  const sync=()=>{const o=sel.options[sel.selectedIndex],m=o&&o.value?metaOf(o.value):{};
    btnName(btn,o&&o.value?(m.group||o.textContent):"（尚無案件，點這裡新增）");
    const zs=o&&o.value&&m.group?zoneMates(o.value):[];zbar.hidden=zs.length<2;
    // 同一組工區只改按下狀態、不重建按鈕（頁面每次重畫都會觸發這裡，重建會讓捲動位置歸零而跳動）
    const ids=zs.length>1?zs.map(c=>c.id+"|"+zoneInfo(c).zone).join(","):"",fresh=ids!==zIds;zIds=ids;
    if(fresh){zbar.innerHTML="";if(zs.length>1)zs.forEach(c=>{const b=document.createElement("button");b.type="button";b.textContent=zoneInfo(c).zone;b.dataset.id=c.id;b.onclick=()=>pick(c.id);zbar.appendChild(b)})}
    zbar.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.id===sel.value)));
    // 單行橫向捲動：目前工區滑到中間。換案件／第一次顯示直接定位；同組切換才用動畫，且只在選到的工區變了才動（使用者自己滑開時不拉回）
    const on=zbar.querySelector('[aria-pressed="true"]'),moved=sel.value!==zSel;zSel=sel.value;
    if(on&&(fresh||moved))zGlide(on.getBoundingClientRect().left-zbar.getBoundingClientRect().left+zbar.scrollLeft-(zbar.clientWidth-on.offsetWidth)/2,fresh)};
  let zIds="",zSel="",zAnim=0;
  // 自己算的緩動（ease-out quart，距離越遠時間略長，上限0.52秒）：各瀏覽器手感一致；手指一碰就停，不跟使用者搶
  const zGlide=(to,instant)=>{cancelAnimationFrame(zAnim);to=Math.max(0,Math.min(zbar.scrollWidth-zbar.clientWidth,to));const from=zbar.scrollLeft,d=to-from;
    if(instant||Math.abs(d)<2||matchMedia("(prefers-reduced-motion: reduce)").matches){zbar.scrollLeft=to;return}
    const t0=performance.now(),T=Math.min(520,300+Math.abs(d)*.5),ease=x=>1-Math.pow(1-x,4);
    const f=now=>{const x=Math.min(1,(now-t0)/T);zbar.scrollLeft=from+d*ease(x);if(x<1)zAnim=requestAnimationFrame(f)};zAnim=requestAnimationFrame(f)};
  zbar.addEventListener("touchstart",()=>cancelAnimationFrame(zAnim),{passive:true});
  // 電腦滑鼠滾輪（只會上下滾）→ 轉成左右捲；已經捲到盡頭就放行，讓頁面照常上下捲
  zbar.addEventListener("wheel",e=>{cancelAnimationFrame(zAnim);
    if(Math.abs(e.deltaX)>=Math.abs(e.deltaY)||e.ctrlKey)return; // 觸控板橫向滑動本來就能捲
    const max=zbar.scrollWidth-zbar.clientWidth,d=e.deltaMode===1?e.deltaY*32:e.deltaY;
    if(max<=0||(d<0&&zbar.scrollLeft<=0)||(d>0&&zbar.scrollLeft>=max-1))return;
    e.preventDefault();zbar.scrollLeft+=d},{passive:false});
  new MutationObserver(sync).observe(sel,{childList:true,subtree:true,characterData:true});
  const recent=()=>{try{return JSON.parse(lsGet(recentKey)||"[]")}catch(e){return []}};
  const touch=v=>{if(!v)return;lsSet(recentKey,JSON.stringify([v,...recent().filter(x=>x!==v)].slice(0,30)))};
  const pins=()=>{try{return JSON.parse(lsGet("eco-pins")||"[]")}catch(e){return []}};
  const pinHit=v=>{const nm=metaOf(v).name;return x=>x.id===v||(nm&&x.name===nm)};
  const isPin=e=>e.ids.some(v=>pins().some(pinHit(v)));
  const togglePin=e=>{let l=pins();if(isPin(e))e.ids.forEach(v=>{l=l.filter(x=>!pinHit(v)(x))});else l=[...l,{id:e.rep.value,name:metaOf(e.rep.value).name}];lsSet("eco-pins",JSON.stringify(l))};
  sel.addEventListener("change",()=>{touch(sel.value);sync()});
  setInterval(()=>{if(btn.dataset.v!==sel.value){btn.dataset.v=sel.value;sync()}},500); // 程式改value不會觸發事件
  btn.onclick=()=>{
    const rec=recent(),rank=v=>{const i=rec.indexOf(v);return i<0?1e9:i};
    const ov=document.createElement("div");ov.className="picker";
    ov.innerHTML='<div class="pkh"><input type="text" placeholder="搜尋案件名稱" aria-label="搜尋案件"><button type="button" class="act">取消</button></div><div class="pkmode"><span>分組</span><div class="seg"></div></div><ul></ul>';
    const q=ov.querySelector("input"),ul=ov.querySelector("ul"),seg=ov.querySelector(".seg");
    let addOpen=false,addVal="",addPlan="",addStage="",trOpen=false,armed=null,armT=null;
    const onKey=e=>{if(e.key==="Escape")close()};
    const close=()=>{clearTimeout(armT);ov.remove();document.body.style.overflow="";document.removeEventListener("keydown",onKey)};
    ov.querySelector(".pkh button").onclick=close;document.addEventListener("keydown",onKey);
    const draw=()=>{
      // 同案的工區併成一列（rep＝最近用過的那個工區，點了切到它）
      const ents=[],byG={};
      [...sel.options].filter(o=>o.value).forEach(o=>{const g=metaOf(o.value).group;
        if(g&&byG[g]){byG[g].opts.push(o);return}const e={key:g||o.value,label:g||o.textContent,opts:[o]};if(g)byG[g]=e;ents.push(e)});
      ents.forEach(e=>{e.ids=e.opts.map(o=>o.value);e.rep=e.opts.find(o=>o.value===sel.value)||[...e.opts].sort((a,b)=>rank(a.value)-rank(b.value))[0];e.value=e.rep.value;
        e.text=e.opts.map(o=>o.textContent).join(" ").toLowerCase()});
      let mode=lsGet("eco-pickmode")||"recent";if(mode==="stage")mode="recent"; /* 階段分組拿掉：依上次開啟判斷不準 */
      seg.innerHTML="";[["recent","最近使用"],["area","地區"],["plan","計畫編號"]].forEach(([m,t])=>{const b=document.createElement("button");b.type="button";b.textContent=t;
        b.className=m===mode?"on":"";b.setAttribute("aria-pressed",String(m===mode));b.onclick=()=>{lsSet("eco-pickmode",m);draw()};seg.appendChild(b)});
      const k=q.value.trim().toLowerCase();ul.innerHTML="";
      const er=e=>Math.min(...e.ids.map(rank));
      const hit=ents.filter(e=>!k||e.text.includes(k)),byRank=(a,b)=>er(a)-er(b)||a.label.localeCompare(b.label,"zh-Hant");
      const head=t=>{const h=document.createElement("li");h.className="grp";h.textContent=t;ul.appendChild(h)};
      // 第一列：新增案件（點了變成輸入框）
      if(ops.add&&!k){const li=document.createElement("li");li.className="pkadd";
        if(!addOpen){li.textContent="＋ 新增案件";li.onclick=()=>{addOpen=true;draw()}}
        else{const inp=document.createElement("input");inp.type="text";inp.placeholder="輸入案件名稱";inp.value=addVal;inp.oninput=()=>{addVal=inp.value};
          // 計畫編號（可空白，格式同總表分頁：115-B (25116)）；有 ops.stages 時再多一排階段（不選＝依清單內容判斷）
          const pin=document.createElement("input");pin.type="text";pin.placeholder="計畫編號（可空白，例：25116）";pin.value=addPlan;pin.oninput=()=>{addPlan=pin.value};
          li.style.flexWrap="wrap";inp.style.flex="1 1 100%";pin.style.flex="1 1 100%";li.append(inp,pin);
          if(ops.stages){const row=document.createElement("div");row.className="chips";row.style.flex="1 1 100%";
            ops.stages.forEach(s=>{const b=document.createElement("button");b.type="button";b.className="chip";b.textContent=s;b.setAttribute("aria-pressed",String(addStage===s));
              b.onclick=e=>{e.stopPropagation();addStage=addStage===s?"":s;[...row.children].forEach(x=>x.setAttribute("aria-pressed",String(x.textContent===addStage)))};row.appendChild(b)});li.appendChild(row)}
          const ok=document.createElement("button");ok.type="button";ok.className="primary";ok.textContent="建立";
          const cc=document.createElement("button");cc.type="button";cc.textContent="取消";cc.onclick=()=>{addOpen=false;addVal="";addPlan="";addStage="";draw()};
          const go=async()=>{const n=inp.value.trim();if(!n){inp.focus();return}ok.disabled=true;ok.textContent="建立中…";
            // 計畫編號只存數字（25116）；貼了「115-B (25116)」這種總表分頁名也會取出數字
            const extra={},pm=/\d{4,6}/.exec(addPlan);if(pm)extra.plan=pm[0];else if(addPlan.trim())extra.plan=addPlan.trim();
            if(addStage)extra.stage=addStage;
            try{await ops.add(n,extra);addVal=addPlan="";addStage="";close()}catch(e){ok.disabled=false;ok.textContent="失敗，再按一次"}};
          ok.onclick=go;inp.onkeydown=pin.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go()}};li.append(ok,cc);setTimeout(()=>inp.focus(),0)}
        ul.appendChild(li)}
      const item=e=>{const li=document.createElement("li");if(e.ids.includes(sel.value))li.className="on";
        const nm=document.createElement("span");nm.className="pkname";nameEl(nm,e.label);
        if(e.opts.length>1){const z=document.createElement("span");z.className="nc";z.textContent=`${e.opts.length}個工區`;nm.appendChild(z)}
        const pb=document.createElement("button");pb.type="button";pb.className="pin";const on=isPin(e);pb.append(ic(on?"starf":"star"));pb.setAttribute("aria-label",on?"取消釘選":"釘選");
        pb.onclick=ev=>{ev.stopPropagation();togglePin(e);draw()};
        li.append(nm,pb);
        if(ops.trash){const tb=document.createElement("button");tb.type="button";tb.className="pin trash";const arm=armed===e.key;
          if(arm){tb.classList.add("armed");tb.textContent=e.opts.length>1?`${e.opts.length}個工區都移到垃圾桶？`:"移到垃圾桶？";li.classList.add("arming")}else tb.innerHTML=TRASH_SVG;
          tb.setAttribute("aria-label","移到垃圾桶");
          tb.onclick=async ev=>{ev.stopPropagation();clearTimeout(armT);
            if(!arm){armed=e.key;armT=setTimeout(()=>{armed=null;draw()},4000);draw();return}
            armed=null;tb.disabled=true;tb.textContent="移除中…";
            try{for(const v of e.ids)await ops.trash(v);draw()}catch(_){tb.textContent="失敗";setTimeout(draw,1500)}};
          li.appendChild(tb)}
        li.onclick=()=>{close();pick(e.value)};ul.appendChild(li)};
      const P=hit.filter(isPin).sort(byRank),R=hit.filter(e=>!isPin(e));
      if(P.length){head("釘選");P.forEach(item)}
      if(k){R.sort(byRank).forEach(item)}
      else if(mode==="recent"){const r=R.filter(e=>er(e)<1e9).sort(byRank),rest=R.filter(e=>er(e)>=1e9).sort(byRank);
        if(r.length){head("最近使用");r.forEach(item)}if(rest.length){head("其他案件");rest.forEach(item)}}
      else{const key=e=>metaOf(e.value)[mode]||"",keys=[...new Set(R.map(key))];
        keys.sort((a,b)=>!a?1:!b?-1:mode==="plan"?b.localeCompare(a):a.localeCompare(b,"zh-Hant"));
        keys.forEach(g=>{head(g||(mode==="area"?"未設定地區":"未設定計畫編號"));R.filter(e=>key(e)===g).sort(byRank).forEach(item)})}
      if(!hit.length&&k)head("找不到符合的案件");
      // 垃圾桶：移除的案件資料都還在，點「復原」放回清單
      const T=ops.trashed?ops.trashed().filter(c=>!k||(c.name||"").toLowerCase().includes(k)):[];
      if(T.length){const h=document.createElement("li");h.className="grp trashgrp";h.textContent=`${trOpen?"▾":"▸"} 垃圾桶（${T.length}）・可復原`;h.onclick=()=>{trOpen=!trOpen;draw()};ul.appendChild(h);
        if(trOpen)T.forEach(c=>{const li=document.createElement("li");li.className="trashed";const nm=document.createElement("span");nm.className="pkname";nameEl(nm,c.name||"");
          const rb=document.createElement("button");rb.type="button";rb.className="restore";rb.textContent="復原";
          rb.onclick=async ev=>{ev.stopPropagation();rb.disabled=true;rb.textContent="復原中…";try{await ops.restore(c.id);draw()}catch(_){rb.disabled=false;rb.textContent="失敗，再按一次"}};
          li.append(nm,rb);ul.appendChild(li)})}
    };
    q.oninput=draw;draw();document.body.appendChild(ov);document.body.style.overflow="hidden";
  };
  sync();
}

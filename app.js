(() => {
  "use strict";

  // ---------- 저장 ----------
  const KEY = "mlife-exam-v1";
  const blank = () => ({ level: 0, pos: {}, done: {}, wrong: {}, grad: 0, cards: {}, essays: {}, best: {}, memoBest: {}, memoStage: {} });
  let S = blank();
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* 저장소 없음 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } };

  // ---------- 데이터 정리 ----------
  const LESSON = Object.fromEntries(LESSONS.map(l => [l.id, l]));
  const BANK = [];
  LESSONS.forEach(l => l.steps.forEach((s, i) => {
    if (s.t === "quiz") BANK.push(Object.assign({ id: `${l.id}-s${i}`, l: l.id }, s));
  }));
  EXTRA_QUIZ.forEach((q, i) => BANK.push(Object.assign({ id: `x${i}` }, q)));
  const QBY = Object.fromEntries(BANK.map(q => [q.id, q]));
  CARDS.forEach((c, i) => { c.id = `c${i}`; });

  const lv = () => S.level || 1;
  const steps = l => l.steps.filter(s => s.lv <= lv());
  const qs = () => BANK.filter(q => q.lv <= lv());
  const cards = () => CARDS.filter(c => c.lv <= lv());

  // ---------- 도우미 ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $("#app");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const lvBadge = n => `<span class="lvb" data-lv="${n}">${LEVELS[n].name}</span>`;
  const praise = ["딩동댕! 🎉", "천재다 🤓", "맞았어! 👏", "오~ 정답 ✨", "완벽해 💯"];
  const oops = ["앗, 아깝다 😅", "괜찮아, 이제 알았잖아 💪", "땡! 근데 오답노트에 넣어둘게 📒"];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wrongCount = () => Object.keys(S.wrong).filter(id => QBY[id]).length;

  function markWrong(id) {
    const w = S.wrong[id] || { n: 0, streak: 0 };
    w.n += 1; w.streak = 0; S.wrong[id] = w; save();
  }
  function markRight(id) {
    const w = S.wrong[id];
    if (!w) return false;
    w.streak += 1;
    if (w.streak >= 2) { delete S.wrong[id]; S.grad += 1; save(); return true; }
    save(); return false;
  }

  // 객관식 한 문제 그리기. done(correct) 콜백.
  function renderQuestion(box, q, done, opts = {}) {
    const order = shuffle(q.opts.map((_, i) => i));
    box.innerHTML = `
      <div class="quiz-q">${opts.prefix || ""}${esc(q.q)}</div>
      <div class="opts">${order.map(i => `<button class="opt" type="button" data-i="${i}">${esc(q.opts[i])}</button>`).join("")}</div>
      <div class="fb"></div>`;
    box.querySelectorAll(".opt").forEach(btn => btn.addEventListener("click", () => {
      const i = Number(btn.dataset.i);
      const ok = i === q.a;
      box.querySelectorAll(".opt").forEach(b => {
        b.disabled = true;
        if (Number(b.dataset.i) === q.a) b.classList.add("right");
      });
      if (!ok) btn.classList.add("wrong");
      let grad = false;
      if (ok) grad = markRight(q.id); else markWrong(q.id);
      $(".fb", box).innerHTML = `<div class="feedback ${ok ? "ok" : "bad"}"><strong>${ok ? pick(praise) : pick(oops)}</strong>${esc(q.why)}${grad ? "<br><b>🎓 오답노트 졸업!</b>" : ""}${!ok ? "<br><span class='small'>📒 오답노트에 저장됨</span>" : ""}</div>`;
      updateTabs();
      done(ok);
    }));
  }

  // 배우기·연습 화면 위에 붙는 난이도 스위치
  function levelSeg() {
    return `<div class="seg lvseg" role="group" aria-label="난이도">
      ${[1, 2, 3].map(n => `<button type="button" class="${lv() === n ? "on" : ""}" data-setlv="${n}" data-lv="${n}">${LEVELS[n].name}</button>`).join("")}
      <a href="#/level" class="seg-help" aria-label="난이도 설명">?</a>
    </div>`;
  }

  // 퀴즈 / 카드 전환
  function practiceSeg(cur) {
    return `<div class="seg wide" role="tablist">
      <a href="#/quiz" class="${cur === "quiz" ? "on" : ""}">✏️ 퀴즈</a>
      <a href="#/cards" class="${cur === "cards" ? "on" : ""}">🃏 암기 카드</a>
    </div>`;
  }

  // 논술 문제 진행 상태
  const memoPct = m => S.memoBest[m.n] || 0;
  const memoDone = m => memoPct(m) >= 90;
  const memoNext = () => MEMO.find(m => !memoDone(m)) || MEMO[0];
  function memoTile(m) {
    const p = memoPct(m), stg = S.memoStage[m.n];
    return `<a class="qtile ${memoDone(m) ? "done" : ""}" href="#/essay/${m.n}${stg ? "?s=" + stg : ""}">
      <span class="qnum">${memoDone(m) ? "✓" : m.n}</span>
      <span class="qbody"><b>${esc(m.title)}</b><span class="muted small">${esc(m.keys)}</span>
        <span class="bar thin"><i style="width:${p}%"></i></span></span>
      <span class="qpct">${S.memoBest[m.n] != null ? p + "%" : (stg ? STAGES[stg - 1].name.slice(2) : "시작")}</span>
    </a>`;
  }

  // ---------- 화면들 ----------
  function viewLevel() {
    app.innerHTML = `
      <a href="#/learn" class="small muted">← 배우기</a>
      <h1>난이도 고르기</h1>
      <p class="muted">배우기·퀴즈·카드에만 적용돼. 논술 암기는 난이도와 상관없이 똑같아.</p>
      <div class="lv-pick">
        ${[1, 2, 3].map(n => `
          <button class="lv-opt ${lv() === n ? "sel" : ""}" data-lv="${n}" type="button">
            <span class="big">${LEVELS[n].name}</span>
            <span><b>${LEVELS[n].label}</b><br><span class="muted">${LEVELS[n].desc}</span><br>
            <span class="small muted">레슨 카드 ${LESSONS.reduce((a, l) => a + l.steps.filter(s => s.lv <= n).length, 0)}장 · 퀴즈 ${BANK.filter(q => q.lv <= n).length}문제 · 암기카드 ${CARDS.filter(c => c.lv <= n).length}장</span></span>
          </button>`).join("")}
      </div>
      <p class="muted mt">💡 처음이면 <b>하</b>로 한 바퀴 → 익숙해지면 <b>중</b> → 시간 남으면 <b>상</b>. 난이도를 올려도 진행 기록은 그대로야.</p>`;
    app.querySelectorAll(".lv-opt").forEach(b => b.addEventListener("click", () => {
      S.level = Number(b.dataset.lv); save();
      location.hash = "#/learn";
    }));
  }

  function lessonProgress(l) {
    const st = steps(l);
    const p = Math.min(S.pos[l.id + ":" + lv()] || 0, st.length);
    return S.done[l.id + ":" + lv()] ? 100 : Math.round(p / st.length * 100);
  }

  function viewHome() {
    const total = LESSONS.length;
    const doneN = LESSONS.filter(l => S.done[l.id + ":" + lv()]).length;
    const nextL = LESSONS.find(l => !S.done[l.id + ":" + lv()]);
    const wc = wrongCount();
    const memN = MEMO.filter(memoDone).length;
    const nm = memoNext();
    const stg = S.memoStage[nm.n] || 1;
    app.innerHTML = `
      <section class="hero2">
        <p class="eyebrow">강남대 · 문학과 인생 · 중간고사</p>
        <h1>논술 7문제,<br>답안 통째로 외우기</h1>
        <div class="dots" aria-label="외운 문제 ${memN}/7">${MEMO.map(m => `<a href="#/essay/${m.n}" class="dot7 ${memoDone(m) ? "on" : memoPct(m) ? "half" : ""}">${m.n}</a>`).join("")}</div>
        <p class="small">외운 문제 <b>${memN}/7</b> · 통째로 쓰기 90% 넘으면 ✓</p>
        <a class="btn block cta" href="#/essay/${nm.n}?s=${stg}">
          <span>${memN === 7 ? "🏆 다 외웠어! 한 번 더 복습" : `이어하기: ${nm.n}번 ${esc(nm.title)}`}<small>${STAGES[stg - 1].name}</small></span><span aria-hidden="true">→</span>
        </a>
      </section>

      <h2 class="sec">📝 7문제</h2>
      <div class="qlist">${MEMO.map(memoTile).join("")}</div>

      <h2 class="sec">🧰 보충</h2>
      <div class="tools">
        <a class="tool" href="#/learn"><span>📖</span><b>배우기</b><small>${nextL ? `레슨 ${doneN}/${total}` : "다 봤어 ✓"}</small></a>
        <a class="tool" href="#/quiz"><span>✏️</span><b>퀴즈·카드</b><small>개념 확인</small></a>
        <a class="tool" href="#/wrong"><span>❌</span><b>오답노트</b><small>${wc ? `${wc}개 남음` : "비었어 ✨"}</small></a>
        <a class="tool" href="#/tips"><span>💡</span><b>공부법</b><small>시험장 전략</small></a>
      </div>

      <div class="card">
        <h2>🧱 답안 공식</h2>
        <p class="tip">${esc(MEMO_SHEET.formula)}</p>
        <p class="muted small mt">한 문제 외우는 순서: ① 읽기 → ② 뼈대 → ③ 빈칸 → ④ 첫 글자 → ⑤ 통째로 쓰기</p>
      </div>`;
  }

  function viewLearn() {
    app.innerHTML = `
      <div class="pagehead"><h1>배우기 📖</h1>${levelSeg()}</div>
      <p class="muted small">이해가 안 되는 문제만 골라서 봐. 카드 넘기다 보면 중간중간 문제가 나오고, 틀리면 오답노트로 가.</p>
      <div class="grid">
        ${LESSONS.map(l => {
          const p = lessonProgress(l);
          return `<a class="lesson-tile" href="#/lesson/${l.id}">
            ${p === 100 ? `<span class="done">✅</span>` : ""}
            <div class="em">${l.emoji}</div>
            <div class="wk">${l.week} · 시험 예시 ${l.num}</div>
            <h3>${esc(l.title)}</h3>
            <div class="muted small">${esc(l.short)}</div>
            <div class="bar"><i style="width:${p}%"></i></div>
          </a>`;
        }).join("")}
      </div>`;
  }

  function viewLesson(id) {
    const l = LESSON[id];
    if (!l) return viewLearn();
    const st = steps(l);
    const pk = id + ":" + lv(); // 난이도마다 카드 목록이 달라서 위치도 따로 저장
    let i = Math.min(S.pos[pk] || 0, st.length);
    if (S.done[pk] && i >= st.length) i = 0;

    const draw = () => {
      S.pos[pk] = i; save();
      if (i >= st.length) {
        S.done[id + ":" + lv()] = true; save();
        const nextL = LESSONS[LESSONS.indexOf(l) + 1];
        app.innerHTML = `
          <div class="card center">
            <div class="big-emoji">🏆</div>
            <h1>${l.num}. ${esc(l.title)} 끝!</h1>
            <p>${esc(l.short)}</p>
            <p class="muted">오답노트: ${wrongCount()}개</p>
          </div>
          <div class="row">
            <a class="btn ghost" href="#/quiz?l=${l.id}">이 레슨만 퀴즈</a>
            ${nextL ? `<a class="btn" href="#/lesson/${nextL.id}">다음: ${nextL.emoji} ${esc(nextL.title)} →</a>` : `<a class="btn" href="#/essay">서술형 연습 →</a>`}
          </div>
          <button class="btn ghost block mt" id="again" type="button">처음부터 다시 보기</button>`;
        $("#again").addEventListener("click", () => { i = 0; draw(); });
        return;
      }
      const s = st[i];
      app.innerHTML = `
        <div class="step-head">
          <a href="#/learn" class="small muted">← 레슨 목록</a>
          <span class="step-count">${l.emoji} ${l.num}. ${esc(l.title)} · ${i + 1}/${st.length}</span>
        </div>
        <div class="bar"><i style="width:${(i) / st.length * 100}%"></i></div>
        ${i === 0 ? `<div class="card"><div class="kid"><b>👶 5살 설명</b><br>${esc(l.kid)}</div></div>` : ""}
        <div class="card" id="stepCard"></div>
        <div class="row">
          <button class="btn ghost" id="prev" type="button" ${i === 0 ? "disabled" : ""}>← 이전</button>
          <button class="btn" id="next" type="button">다음 →</button>
        </div>`;
      const card = $("#stepCard");
      const nextBtn = $("#next");
      const memo = MEMO.find(m => m.lid === id);
      if (s.t === "say" && s.h.indexOf("✍️") === 0 && memo) {
        // 시험 답안은 핵심정리 PDF 답안 하나로 통일
        card.innerHTML = `<h2>✍️ 시험 답안 (핵심정리 PDF) ${lvBadge(s.lv)}</h2><div class="answer">${memoAnswerHtml(memo)}</div>
          <a class="btn block mt" href="#/essay/${memo.n}">📝 이 답안 외우러 가기</a>`;
      } else if (s.t === "say") {
        card.innerHTML = `<h2>${s.h} ${lvBadge(s.lv)}</h2><div class="tblwrap">${s.body}</div>`;
      } else {
        nextBtn.disabled = true;
        nextBtn.textContent = "문제 풀어야 넘어가 🙂";
        renderQuestion(card, QBY[`${id}-s${l.steps.indexOf(s)}`], () => {
          nextBtn.disabled = false; nextBtn.textContent = "다음 →";
        }, { prefix: `<span class="small muted">✋ 잠깐 문제 ${lvBadge(s.lv)}</span><br>` });
      }
      $("#prev").addEventListener("click", () => { i = Math.max(0, i - 1); draw(); });
      nextBtn.addEventListener("click", () => { i += 1; draw(); window.scrollTo(0, 0); });
    };
    draw();
  }

  // 퀴즈 실행 (퀴즈 모드와 오답노트 공용)
  function runQuiz(list, title, onEnd) {
    let k = 0, score = 0;
    const wrongIds = [];
    const draw = () => {
      if (k >= list.length) return onEnd(score, list.length, wrongIds);
      const q = list[k];
      app.innerHTML = `
        <div class="step-head"><b>${title}</b><span class="step-count">${k + 1}/${list.length} · 맞힘 ${score}</span></div>
        <div class="bar"><i style="width:${k / list.length * 100}%"></i></div>
        <div class="card" id="qc"></div>
        <button class="btn block" id="next" type="button" disabled>다음 →</button>`;
      const nb = $("#next");
      renderQuestion($("#qc"), q, ok => {
        if (ok) score++; else wrongIds.push(q.id);
        nb.disabled = false;
        if (k === list.length - 1) nb.textContent = "결과 보기 🏁";
      }, { prefix: `<span class="small muted">${LESSON[q.l].emoji} ${esc(LESSON[q.l].title)} ${lvBadge(q.lv)}</span><br>` });
      nb.addEventListener("click", () => { k++; draw(); window.scrollTo(0, 0); });
    };
    draw();
  }

  function viewQuiz(params) {
    const sel = params.get("l") || "all";
    const pool = qs().filter(q => sel === "all" || q.l === sel);
    app.innerHTML = `
      ${practiceSeg("quiz")}
      <div class="pagehead"><h1>퀴즈 ✏️</h1>${levelSeg()}</div>
      <p class="muted small"><b>전체 섞기</b>가 제일 효과 좋아 (시인끼리 헷갈리는 걸 잡아 줌).</p>
      <div class="chip-row">
        <a class="chip ${sel === "all" ? "sel" : ""}" href="#/quiz">🔀 전체 섞기</a>
        ${LESSONS.map(l => `<a class="chip ${sel === l.id ? "sel" : ""}" href="#/quiz?l=${l.id}">${l.emoji} ${l.num}</a>`).join("")}
      </div>
      <div class="card">
        <h2>${sel === "all" ? "전체 섞기" : `${LESSON[sel].emoji} ${esc(LESSON[sel].title)}`}</h2>
        <p>문제 ${pool.length}개 중에서 골라 풀어.${S.best[sel] != null ? ` 최고 기록: <b>${S.best[sel]}%</b>` : ""}</p>
        <div class="row">
          <button class="btn" data-n="10" type="button">10문제</button>
          <button class="btn ghost" data-n="${pool.length}" type="button">전부 (${pool.length})</button>
        </div>
      </div>`;
    app.querySelectorAll("[data-n]").forEach(b => b.addEventListener("click", () => {
      const list = shuffle(pool).slice(0, Number(b.dataset.n));
      if (!list.length) return;
      runQuiz(list, "퀴즈", (score, n, wrongIds) => {
        const pct = Math.round(score / n * 100);
        S.best[sel] = Math.max(S.best[sel] || 0, pct); save();
        app.innerHTML = `
          <div class="card center">
            <div class="big-emoji">${pct >= 90 ? "🏆" : pct >= 70 ? "😎" : pct >= 50 ? "🙂" : "💪"}</div>
            <div class="score">${score} / ${n}</div>
            <p>${pct >= 90 ? "시험 준비 끝난 듯?!" : pct >= 70 ? "좋아! 오답만 잡으면 돼." : "괜찮아. 틀린 건 다 오답노트에 들어갔어."}</p>
          </div>
          ${wrongIds.length ? `<div class="card"><h2>이번에 틀린 것</h2><ul>${wrongIds.map(id => `<li>${esc(QBY[id].q)}<br><span class="muted small">정답: ${esc(QBY[id].opts[QBY[id].a])}</span></li>`).join("")}</ul></div>` : ""}
          <div class="row">
            ${wrongIds.length ? `<a class="btn bad" href="#/wrong">오답노트 가기</a>` : ""}
            <a class="btn ghost" href="#/quiz${sel === "all" ? "" : "?l=" + sel}">한 번 더</a>
          </div>`;
      });
    }));
  }

  function viewWrong() {
    const ids = Object.keys(S.wrong).filter(id => QBY[id]);
    const by = {};
    ids.forEach(id => { (by[QBY[id].l] = by[QBY[id].l] || []).push(id); });
    app.innerHTML = `
      <h1>오답노트 ❌</h1>
      <p class="muted">틀린 문제가 자동으로 모여. 여기서 <b>2번 연속</b> 맞히면 졸업 🎓 (지금까지 졸업 ${S.grad}개)</p>
      ${ids.length ? `
        <button class="btn bad block" id="redo" type="button">🔁 오답 ${ids.length}개 다시 풀기</button>
        ${LESSONS.filter(l => by[l.id]).map(l => `
          <div class="card">
            <h2>${l.emoji} ${l.num}. ${esc(l.title)} <span class="muted small">(${by[l.id].length})</span></h2>
            ${by[l.id].map(id => {
              const q = QBY[id], w = S.wrong[id];
              return `<details class="mt"><summary><b>${esc(q.q)}</b> <span class="small muted">· 틀린 횟수 ${w.n} · 연속 정답 ${w.streak}/2</span></summary>
                <p>✅ <b>${esc(q.opts[q.a])}</b></p><p class="muted">${esc(q.why)}</p></details>`;
            }).join("")}
          </div>`).join("")}
        <button class="btn ghost block mt" id="clear" type="button">오답노트 전부 지우기</button>`
      : `<div class="card empty"><div class="big-emoji">✨</div><p>오답노트가 비었어!<br>퀴즈를 풀면 틀린 문제가 여기 쌓여.</p><a class="btn" href="#/quiz">퀴즈 풀러 가기</a></div>`}`;
    const redo = $("#redo");
    if (redo) redo.addEventListener("click", () => {
      runQuiz(shuffle(ids.map(id => QBY[id])), "오답 다시 풀기", (score, n) => {
        app.innerHTML = `
          <div class="card center"><div class="big-emoji">📒</div><div class="score">${score} / ${n}</div>
          <p>남은 오답 ${wrongCount()}개 · 졸업 ${S.grad}개</p></div>
          <a class="btn block" href="#/wrong">오답노트로</a>`;
      });
    });
    const clr = $("#clear");
    if (clr) clr.addEventListener("click", () => {
      if (confirm("오답노트를 전부 지울까?")) { S.wrong = {}; save(); updateTabs(); viewWrong(); }
    });
  }

  function viewCards(params) {
    const sel = params.get("l") || "all";
    const pool = cards().filter(c => sel === "all" || c.l === sel);
    const box = c => S.cards[c.id] || 0; // 0 = 처음, 1 = 모름, 2 = 헷갈림, 3 = 앎
    const count = n => pool.filter(c => box(c) === n).length;
    // 모름 → 처음 → 헷갈림 → 앎 순으로 보여줌
    const rank = { 1: 0, 0: 1, 2: 2, 3: 3 };
    let queue = shuffle(pool).sort((a, b) => rank[box(a)] - rank[box(b)]);
    let flipped = false;
    const draw = () => {
      const c = queue[0];
      app.innerHTML = `
        ${practiceSeg("cards")}
        <div class="pagehead"><h1>암기 카드 🃏</h1>${levelSeg()}</div>
        <div class="chip-row">
          <a class="chip ${sel === "all" ? "sel" : ""}" href="#/cards">전체</a>
          ${LESSONS.map(l => `<a class="chip ${sel === l.id ? "sel" : ""}" href="#/cards?l=${l.id}">${l.emoji} ${l.num}</a>`).join("")}
        </div>
        <div class="boxes">
          <div class="b">😵 모름<b>${count(1)}</b></div><div class="b">🆕 처음<b>${count(0)}</b></div>
          <div class="b">🤔 헷갈림<b>${count(2)}</b></div><div class="b">😎 앎<b>${count(3)}</b></div>
        </div>
        ${c ? `
          <div class="card flash" id="flash" role="button" tabindex="0" aria-label="카드 뒤집기">
            <div>
              <div class="small muted">${LESSON[c.l].emoji} ${esc(LESSON[c.l].title)} ${lvBadge(c.lv)}</div>
              <div class="face ${flipped ? "back" : "front"}">${esc(flipped ? c.b : c.f)}</div>
              <div class="small muted mt">${flipped ? "" : "👆 먼저 머릿속으로 떠올려 보고 탭해서 뒤집기"}</div>
            </div>
          </div>
          ${flipped ? `<div class="row">
            <button class="btn bad" data-b="1" type="button">😵 모름</button>
            <button class="btn ghost" data-b="2" type="button">🤔 헷갈림</button>
            <button class="btn ok" data-b="3" type="button">😎 앎</button>
          </div>` : `<button class="btn block" id="flip" type="button">뒤집기</button>`}
          <p class="muted small center mt">‘모름’은 곧 다시 나오고, ‘앎’은 맨 뒤로 가. 남은 카드 ${queue.length}장</p>`
        : `<div class="card empty"><div class="big-emoji">🎉</div><p>이번 바퀴 끝! 😎 앎 ${count(3)} / ${pool.length}</p><a class="btn" href="#/cards${sel === "all" ? "" : "?l=" + sel}">한 바퀴 더</a></div>`}`;
      const flip = () => { flipped = true; draw(); };
      const f = $("#flash"); if (f) { f.addEventListener("click", flip); f.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") flip(); }); }
      const fb = $("#flip"); if (fb) fb.addEventListener("click", flip);
      app.querySelectorAll("[data-b]").forEach(b => b.addEventListener("click", () => {
        const n = Number(b.dataset.b);
        S.cards[c.id] = n; save();
        queue.shift();
        if (n === 1) queue.splice(Math.min(3, queue.length), 0, c); // 모름: 3장 뒤에 다시
        flipped = false; draw();
      }));
    };
    draw();
  }

  // ---------- 논술 암기 (핵심정리 PDF 기준) ----------
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const chosung = s => [...s].map(ch => {
    const c = ch.charCodeAt(0) - 0xAC00;
    return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : (/\s/.test(ch) ? " " : ch);
  }).join("");
  const plain = t => t.replace(/\[\[|\]\]/g, "");
  const marked = t => esc(t).replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>");
  const keysOf = t => [...t.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
  const norm = s => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
  const memoAnswerHtml = m => m.sents.map(s => marked(s.t)).join(" ");

  const STAGES = [
    { s: 1, name: "① 읽기", tip: "노란 칸만 눈에 담으면서 소리 내서 3번 읽어." },
    { s: 2, name: "② 뼈대", tip: "뼈대 한 마디만 보고 그 문장을 입으로 말해 봐. 말한 다음에 눌러서 확인!" },
    { s: 3, name: "③ 빈칸", tip: "빈칸에 들어갈 말을 먼저 말하고 눌러서 확인. 초성이 힌트야." },
    { s: 4, name: "④ 첫 글자", tip: "문장 첫머리만 보고 나머지를 이어서 말해 봐." },
    { s: 5, name: "⑤ 통째로 쓰기", tip: "아무것도 안 보고 답안을 써. 시험이랑 똑같이!" }
  ];

  function viewEssayList() {
    app.innerHTML = `
      <h1>논술 암기 📝</h1>
      <p class="muted">교수님 <b>중간시험 예시 문항 7개</b> + 「7문제 핵심정리」 PDF의 예시 답안. 한 문제씩 <b>읽기 → 뼈대 → 빈칸 → 첫 글자 → 통째로 쓰기</b> 순서로 외워.</p>
      <div class="qlist">${MEMO.map(memoTile).join("")}</div>
      <div class="card mt"><h2>🧱 서술형 답안 공식</h2><p class="tip">${esc(MEMO_SHEET.formula)}</p></div>
      <div class="card"><h2>📋 시험 직전 1장 암기표</h2>
        <table class="tbl">${MEMO.map(m => `<tr><th>${m.n}. ${esc(m.title.replace(/의 시 세계|와 시 이해/, ""))}</th><td>${esc(m.keys)}</td></tr>`).join("")}</table>
      </div>
      <div class="card"><h2>📅 7일 복습</h2>
        <div class="plan">${MEMO_SHEET.week.map(([d, t]) => `<div><span class="d">${d}</span> ${esc(t)}</div>`).join("")}</div>
        <p class="muted small mt">${esc(MEMO_SHEET.note)}</p>
      </div>`;
  }

  function viewEssay(n, params) {
    const m = MEMO.find(x => x.n === n);
    if (!m) return viewEssayList();
    const stage = Math.min(5, Math.max(1, Number(params.get("s")) || 1));
    const st = STAGES[stage - 1];
    let body = "";
    if (stage === 1) {
      body = `
        <div class="card"><h2>한 문장으로 이해</h2><p class="tip">${esc(m.core)}</p>
          ${m.works.length ? `<table class="tbl mt">${m.works.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
        </div>
        <div class="card"><h2>📗 시험 답안</h2>
          <ol class="sents">${m.sents.map(s => `<li>${marked(s.t)}</li>`).join("")}</ol>
        </div>
        ${m.plus.length ? `<div class="card"><h2>➕ 작품 분석 한 줄 더 (여유 있으면)</h2><ul>${m.plus.map(p => `<li>${marked(p)}</li>`).join("")}</ul>
          <p class="muted small">답안 중간에 시구 하나를 따옴표로 넣으면 ‘작품 분석’이 더 확실해져.</p></div>` : ""}`;
    } else if (stage === 2) {
      body = `<div class="card"><h2>🦴 뼈대만 보고 말하기</h2>
        ${m.sents.map((s, k) => `<details class="bone"><summary><b>${k + 1}.</b> ${esc(s.cue)}</summary><p>${marked(s.t)}</p></details>`).join("")}
        <button class="btn ghost block mt" id="openAll" type="button">전부 펼치기</button></div>`;
    } else if (stage === 3) {
      body = `<div class="card"><h2>🕳️ 빈칸 채우기</h2>
        <ol class="sents">${m.sents.map(s => `<li>${esc(s.t).replace(/\[\[(.+?)\]\]/g, (_, w) => `<button class="blank" type="button" data-w="${w}">${esc(chosung(w))}</button>`)}</li>`).join("")}</ol>
        <div class="row mt"><button class="btn ghost" id="showAll" type="button">전부 보기</button><button class="btn ghost" id="hideAll" type="button">다시 가리기</button></div></div>`;
    } else if (stage === 4) {
      body = `<div class="card"><h2>✏️ 첫 글자만 보고 이어 말하기</h2>
        <ol class="sents">${m.sents.map(s => {
          const p = plain(s.t), head = p.split(" ").slice(0, 2).join(" ");
          return `<li><button class="first" type="button" data-full="${esc(p)}">${esc(head)} …</button></li>`;
        }).join("")}</ol></div>`;
    } else {
      body = `
        <textarea id="ta" placeholder="안 보고 답안을 써 봐. 자동 저장돼.">${esc(S.essays["m" + n] || "")}</textarea>
        <p class="small muted" id="len"></p>
        <div class="row"><button class="btn" id="grade" type="button">🔍 채점하기</button><button class="btn ghost" id="wipe" type="button">지우고 다시</button></div>
        <div id="result"></div>`;
    }
    S.memoStage[n] = stage; save();
    const prevQ = MEMO.find(x => x.n === n - 1), nextQ = MEMO.find(x => x.n === n + 1);
    const nextHref = stage < 5 ? `#/essay/${n}?s=${stage + 1}` : (nextQ ? `#/essay/${nextQ.n}?s=${S.memoStage[nextQ.n] || 1}` : "#/essay");
    const nextLabel = stage < 5 ? `다음: ${STAGES[stage].name}` : (nextQ ? `${nextQ.n}번 문제로` : "7문제 목록");
    app.innerHTML = `
      <div class="qnav">
        <a href="#/essay" class="small">← 목록</a>
        <span class="qnav-arrows">
          ${prevQ ? `<a href="#/essay/${prevQ.n}" aria-label="이전 문제">‹</a>` : `<span>‹</span>`}
          <b>${n} / 7</b>
          ${nextQ ? `<a href="#/essay/${nextQ.n}" aria-label="다음 문제">›</a>` : `<span>›</span>`}
        </span>
      </div>
      <div class="card qcard">
        <div class="qhead"><span class="qnum">${m.n}</span><b>${esc(m.title)}</b>${S.memoBest[m.n] != null ? `<span class="best">최고 ${S.memoBest[m.n]}%</span>` : ""}</div>
        <p class="qtext">${esc(m.q)}</p>
        <p class="hook"><b>🔑 암기 주문</b><br>${esc(m.hook)}</p>
      </div>
      <nav class="stepper" aria-label="암기 단계">${STAGES.map(x => `<a class="${x.s === stage ? "on" : x.s < stage ? "past" : ""}" href="#/essay/${n}?s=${x.s}"><i>${x.s}</i><span>${x.name.slice(2)}</span></a>`).join("")}</nav>
      <p class="steptip">${st.tip}</p>
      ${body}
      <div class="actionbar">
        ${stage > 1 ? `<a class="btn ghost" href="#/essay/${n}?s=${stage - 1}" aria-label="이전 단계">←</a>` : ""}
        <a class="btn grow" href="${nextHref}">${nextLabel} →</a>
      </div>`;

    if (stage === 2) $("#openAll").addEventListener("click", () => app.querySelectorAll(".bone").forEach(d => { d.open = true; }));
    if (stage === 3) {
      const blanks = [...app.querySelectorAll(".blank")];
      const show = (b, on) => { b.textContent = on ? b.dataset.w : chosung(b.dataset.w); b.classList.toggle("open", on); };
      blanks.forEach(b => b.addEventListener("click", () => show(b, !b.classList.contains("open"))));
      $("#showAll").addEventListener("click", () => blanks.forEach(b => show(b, true)));
      $("#hideAll").addEventListener("click", () => blanks.forEach(b => show(b, false)));
    }
    if (stage === 4) app.querySelectorAll(".first").forEach(b => b.addEventListener("click", () => {
      b.textContent = b.dataset.full; b.classList.add("open");
    }));
    if (stage === 5) {
      const ta = $("#ta");
      const len = () => { $("#len").textContent = `${ta.value.replace(/\s/g, "").length}자 (공백 제외)`; };
      len();
      ta.addEventListener("input", () => { S.essays["m" + n] = ta.value; save(); len(); });
      $("#wipe").addEventListener("click", () => { if (!ta.value || confirm("쓴 거 지울까?")) { ta.value = ""; S.essays["m" + n] = ""; save(); len(); $("#result").innerHTML = ""; } });
      $("#grade").addEventListener("click", () => {
        const t = norm(ta.value);
        const rows = m.sents.map(s => {
          const ks = keysOf(s.t);
          const hit = ks.map(k => t.includes(norm(k)));
          return { s, ks, hit, n: hit.filter(Boolean).length };
        });
        const total = rows.reduce((a, r) => a + r.ks.length, 0);
        const got = rows.reduce((a, r) => a + r.n, 0);
        const pct = Math.round(got / total * 100);
        S.memoBest[n] = Math.max(S.memoBest[n] || 0, pct); save();
        const missed = rows.filter(r => r.n < r.ks.length);
        $("#result").innerHTML = `
          <div class="card center">
            <div class="big-emoji">${pct >= 90 ? "🏆" : pct >= 70 ? "😎" : pct >= 40 ? "🙂" : "💪"}</div>
            <div class="score">${pct}%</div>
            <p>핵심어 ${got} / ${total}개 · ${pct >= 90 ? "외웠다! 내일 한 번 더 써 보면 끝." : pct >= 70 ? "거의 다 왔어. 빠진 것만 다시." : "괜찮아. 빠진 문장만 ③ 빈칸으로 다시 보고 와."}</p>
          </div>
          ${missed.length ? `<div class="card"><h2>❗ 빠진 핵심어</h2>
            ${missed.map(r => `<p><b>${esc(r.s.cue)}</b><br>${r.ks.map((k, i) => `<span class="kw ${r.hit[i] ? "hit" : ""}">${r.hit[i] ? "✅" : "⬜"} ${esc(k)}</span>`).join("")}</p>`).join("")}
          </div>` : ""}
          <div class="card"><h2>📗 원래 답안</h2><ol class="sents">${m.sents.map(s => `<li>${marked(s.t)}</li>`).join("")}</ol></div>
          <p class="muted small">⚠️ 핵심어가 들어갔는지만 보는 연습용 채점이야. 문장이 조금 달라도 뜻이 맞으면 괜찮아.</p>`;
        $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function viewTips() {
    const T = STUDY_TIPS;
    app.innerHTML = `
      <h1>공부법 💡</h1>
      <p class="muted">‘어떻게 공부해야 오래 남는지’ 연구 결과 + ‘시험장에서 어떻게 푸는지’를 찾아서 정리했어.</p>
      <div class="card"><h2>📚 시험 전: 이렇게 외워</h2>
        ${T.before.map(x => `<p><b>${x.e} ${esc(x.h)}</b><br>${esc(x.b)}</p>`).join("")}
      </div>
      <div class="card"><h2>📅 3일 계획</h2>
        <div class="plan">${T.plan.map(p => `<div><span class="d">${p.d}</span> ${esc(p.t)}</div>`).join("")}</div>
      </div>
      <div class="card"><h2>📝 시험장: 이렇게 풀어</h2>
        ${T.during.map(x => `<p><b>${x.e} ${esc(x.h)}</b><br>${esc(x.b)}</p>`).join("")}
      </div>
      <div class="card"><h2>🧠 브레인 덤프 치트시트 (시험지 여백에 2분)</h2>
        <table class="tbl">
          <tr><th>1</th><td>모·유·표·흡 / 플라톤 추방 vs 아리스토 반영 / 당의정 = 교훈</td></tr>
          <tr><th>2</th><td>역사주의 = 시대+작가, 실증 / 장점 또렷 / 단점 미적 가치 소홀 / 쉽게 씌어진 시 1942 도쿄</td></tr>
          <tr><th>3</th><td>윤동주 = 부끄러움→성찰→실천 / 서시·참회록(거울)·쉽게 씌어진 시(육첩방·등불·악수)</td></tr>
          <tr><th>4</th><td>김수영 = 모더니즘→4·19→참여시 / 폭포(곧은 정신)·고궁(자기반성)·풀(민중)·푸른 하늘을(자유의 피)</td></tr>
          <tr><th>5</th><td>기형도 = 상처+억압, 전망 거부 / 안개(무감각)·검은 잎(침묵)·엄마 걱정(찬밥)</td></tr>
          <tr><th>6</th><td>노래→가사 분리 / 미디어 바뀌면 장르 바뀜 / 밥 딜런 2016 노벨 / 이날치 수궁가 / 외연 확장</td></tr>
          <tr><th>7</th><td>시 = 감정 직접 경험 / 은유 = 감춰진 의미 / 인기→은유→멀미→사랑→참여</td></tr>
        </table>
      </div>
      <div class="card src"><h2>🔗 출처</h2>
        <ul>${T.sources.map(s => `<li><a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join("")}</ul>
        <p class="muted small">수업 내용은 1~7주차 수업 자료 PDF 기준. 시 해석은 대표적인 해석을 쉽게 풀어 쓴 것이고, 실제 출제·채점 기준은 공개된 게 아니야.</p>
      </div>`;
  }

  // ---------- 라우터 ----------
  function updateTabs(tab) {
    document.querySelectorAll(".tabs a").forEach(a => {
      if (tab) a.classList.toggle("on", a.dataset.tab === tab);
      if (a.dataset.tab === "wrong") {
        const n = wrongCount();
        a.innerHTML = `<span>❌</span>오답${n ? `<i class="dot">${n}</i>` : ""}`;
      }
    });
  }
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs_] = h.split("?");
    const parts = path.split("/");
    const params = new URLSearchParams(qs_ || "");
    const tab = { "": "home", learn: "learn", lesson: "learn", level: "learn", quiz: "practice", cards: "practice", wrong: "wrong", essay: "essay", tips: "home" }[parts[0]] || "home";
    updateTabs(tab);
    switch (parts[0]) {
      case "learn": viewLearn(); break;
      case "lesson": viewLesson(parts[1]); break;
      case "quiz": viewQuiz(params); break;
      case "cards": viewCards(params); break;
      case "wrong": viewWrong(); break;
      case "essay": parts[1] != null ? viewEssay(Number(parts[1]), params) : viewEssayList(); break;
      case "tips": viewTips(); break;
      case "level": viewLevel(); break;
      default: viewHome();
    }
    window.scrollTo(0, 0);
  }
  // 난이도 스위치(하/중/상)는 어느 화면에서 눌러도 바로 적용
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-setlv]");
    if (b) { S.level = Number(b.dataset.setlv); save(); route(); }
  });
  // 퀴즈·오답 결과 화면은 주소가 그대로라서, 같은 주소 링크를 눌러도 다시 그리게 한다
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href^='#']");
    if (a && a.getAttribute("href") === location.hash) { e.preventDefault(); route(); }
  });
  window.addEventListener("hashchange", route);
  route();
})();

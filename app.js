(() => {
  "use strict";

  // ---------- 저장 ----------
  const KEY = "mlife-exam-v1";
  const blank = () => ({ level: 0, pos: {}, done: {}, wrong: {}, grad: 0, cards: {}, essays: {}, best: {} });
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

  const lv = () => S.level || 2;
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

  // ---------- 화면들 ----------
  function viewLevel(first) {
    app.innerHTML = `
      ${first ? `<div class="card hero"><h1>안녕! 👋</h1><p>강남대 「문학과 인생」 중간고사, 진짜 쉽게 끝내 보자. 먼저 <b>난이도</b>를 골라 줘. 나중에 위쪽 동그란 버튼으로 언제든 바꿀 수 있어.</p></div>` : `<h1>난이도 고르기</h1>`}
      <div class="lv-pick">
        ${[1, 2, 3].map(n => `
          <button class="lv-opt ${S.level === n ? "sel" : ""}" data-lv="${n}" type="button">
            <span class="big">${LEVELS[n].name}</span>
            <span><b>${LEVELS[n].label}</b><br><span class="muted">${LEVELS[n].desc}</span><br>
            <span class="small muted">레슨 카드 ${LESSONS.reduce((a, l) => a + l.steps.filter(s => s.lv <= n).length, 0)}장 · 퀴즈 ${BANK.filter(q => q.lv <= n).length}문제 · 암기카드 ${CARDS.filter(c => c.lv <= n).length}장</span></span>
          </button>`).join("")}
      </div>
      <p class="muted mt">💡 처음이면 <b>하</b>로 한 바퀴 → 익숙해지면 <b>중</b> → 시간 남으면 <b>상</b>. 난이도를 올려도 진행 기록은 그대로야.</p>`;
    app.querySelectorAll(".lv-opt").forEach(b => b.addEventListener("click", () => {
      S.level = Number(b.dataset.lv); save(); updateTop();
      location.hash = first ? "#/learn" : "#/";
    }));
  }

  function lessonProgress(l) {
    const st = steps(l);
    const p = Math.min(S.pos[l.id + ":" + lv()] || 0, st.length);
    return S.done[l.id + ":" + lv()] ? 100 : Math.round(p / st.length * 100);
  }

  function viewHome() {
    if (!S.level) return viewLevel(true);
    const total = LESSONS.length;
    const doneN = LESSONS.filter(l => S.done[l.id + ":" + lv()]).length;
    const next = LESSONS.find(l => !S.done[l.id + ":" + lv()]);
    const wc = wrongCount();
    app.innerHTML = `
      <div class="card hero">
        <h1>시험 범위는 딱 7개 🎯</h1>
        <p>교수님 시험 예시 7문항 = 1~7주차 각각 1개씩. 이것만 하면 돼.</p>
        <div class="bar"><i style="width:${doneN / total * 100}%"></i></div>
        <p class="small">${LEVELS[lv()].label} · 레슨 ${doneN}/${total} 완료 · 오답노트 ${wc}개 · 졸업 ${S.grad}개</p>
      </div>
      ${next ? `<a class="btn block" href="#/lesson/${next.id}">${next.emoji} ${next.num}. ${esc(next.title)} ${S.pos[next.id + ":" + lv()] ? "이어서" : "시작"} →</a>` : `<a class="btn block ok" href="#/essay">🎉 레슨 다 끝! 이제 서술형 연습 →</a>`}
      <div class="card">
        <h2>오늘 할 일 순서</h2>
        <ol>
          <li><b>배우기</b>: 레슨 읽고 중간중간 문제 풀기</li>
          <li><b>퀴즈</b> ‘전체 섞기’로 10문제</li>
          <li><b>카드</b>로 ‘모름’ 칸 비우기</li>
          <li><b>오답노트</b>: 2번 연속 맞히면 졸업 🎓</li>
          <li><b>서술형</b>: 직접 써 보고 키워드 채점</li>
        </ol>
      </div>
      <div class="card">
        <h2>7개 10초 암기</h2>
        <table class="tbl">
          ${LESSONS.map(l => `<tr><th>${l.num}</th><td><a href="#/lesson/${l.id}">${l.emoji} ${esc(l.title)}</a><br><span class="muted">${esc(l.short)}</span></td></tr>`).join("")}
        </table>
      </div>
      <div class="row">
        <a class="btn ghost" href="#/level">난이도 바꾸기</a>
        <a class="btn ghost" href="#/tips">공부법 보기</a>
      </div>`;
  }

  function viewLearn() {
    if (!S.level) return viewLevel(true);
    app.innerHTML = `
      <h1>배우기 📖</h1>
      <p class="muted">지금 난이도: ${lvBadge(lv())} — 카드 넘기다 보면 중간중간 문제가 나와. 틀리면 오답노트로!</p>
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
    if (!S.level) return viewLevel(true);
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
      if (s.t === "say") {
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
    if (!S.level) return viewLevel(true);
    const sel = params.get("l") || "all";
    const pool = qs().filter(q => sel === "all" || q.l === sel);
    app.innerHTML = `
      <h1>퀴즈 ✏️</h1>
      <p class="muted">난이도 ${lvBadge(lv())} 이하 문제만 나와. <b>전체 섞기</b>가 제일 효과 좋아 (시인끼리 헷갈리는 걸 잡아 줌).</p>
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
    if (!S.level) return viewLevel(true);
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
        <h1>암기 카드 🃏</h1>
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

  function modelAnswer(lid) {
    const s = LESSON[lid].steps.find(x => x.h && x.h.indexOf("✍️") === 0);
    return s ? s.body : "";
  }

  function viewEssayList() {
    app.innerHTML = `
      <h1>서술형 연습 📝</h1>
      <p class="muted">교수님 시험 예시 7문항(1~7주차) + 보너스. <b>먼저 직접 쓰고</b> → 키워드 채점 → 모범 답안 비교. 쓰는 게 제일 오래 남아.</p>
      ${ESSAYS.map((e, i) => {
        const t = (S.essays[i] || "").trim();
        return `<a class="lesson-tile mt" href="#/essay/${i}">
          ${t.length > 80 ? `<span class="done">✍️</span>` : ""}
          <div class="wk">${e.bonus ? "보너스" : `시험 예시 ${LESSON[e.l].num}`} · ${LESSON[e.l].emoji} ${esc(LESSON[e.l].title)}</div>
          <div>${esc(e.q)}</div>
        </a>`;
      }).join("")}
      <div class="card mt"><h2>🧱 4문장 공식</h2>
        <ol><li>“○○의 특징은 □□이다.” (정의)</li><li>“대표작 △△에서 ○○가 나타난다.” (작품)</li><li>“특히 ‘시구/장면’은 ◇◇를 뜻한다.” (인용 + 해석)</li><li>“따라서 ○○의 의미는 □□이다.” (결론)</li></ol>
      </div>`;
  }

  function viewEssay(i) {
    const e = ESSAYS[i];
    if (!e) return viewEssayList();
    const model = modelAnswer(e.l);
    app.innerHTML = `
      <a href="#/essay" class="small muted">← 서술형 목록</a>
      <div class="card">
        <div class="small muted">${e.bonus ? "보너스" : `시험 예시 ${LESSON[e.l].num}`} · ${LESSON[e.l].emoji} ${esc(LESSON[e.l].title)}</div>
        <h2>${esc(e.q)}</h2>
        <details><summary>💡 힌트 (막히면 열기)</summary><p>${esc(e.hint)}</p></details>
      </div>
      <textarea id="ta" placeholder="여기에 직접 써 봐. 자동 저장돼.">${esc(S.essays[i] || "")}</textarea>
      <p class="small muted" id="len"></p>
      <button class="btn block" id="grade" type="button">🔍 키워드 채점하기</button>
      <div id="result"></div>`;
    const ta = $("#ta");
    const len = () => { $("#len").textContent = `${ta.value.replace(/\s/g, "").length}자 (공백 제외)`; };
    len();
    ta.addEventListener("input", () => { S.essays[i] = ta.value; save(); len(); });
    $("#grade").addEventListener("click", () => {
      const t = ta.value.replace(/\s+/g, " ");
      const hits = e.keys.map(g => g.some(k => t.includes(k)));
      const n = hits.filter(Boolean).length;
      const sent = t.split(/[.!?。]\s*/).filter(x => x.trim().length > 4).length;
      const quote = /[“"‘'「].{2,}[”"’'」]/.test(t);
      $("#result").innerHTML = `
        <div class="card">
          <h2>채점 결과: 키워드 ${n} / ${e.keys.length}</h2>
          <div>${e.keys.map((g, k) => `<span class="kw ${hits[k] ? "hit" : ""}">${hits[k] ? "✅" : "⬜"} ${esc(g[0])}</span>`).join("")}</div>
          <ul class="check mt">
            <li class="${sent >= 4 ? "hit" : ""}">4문장 이상 썼다 (지금 ${sent}문장)</li>
            <li class="${quote ? "hit" : ""}">시구나 장면을 따옴표로 인용했다</li>
            <li class="${/따라서|그러므로|즉|결국/.test(t) ? "hit" : ""}">‘따라서/즉’으로 결론을 냈다</li>
          </ul>
          <p class="muted small">⚠️ 키워드 채점은 연습용이야. 진짜 점수는 ‘작품을 근거로 설명했는지’가 중요해.</p>
        </div>
        ${model ? `<div class="card"><h2>📗 모범 답안</h2>${model}</div>` : ""}`;
      $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
  function updateTop() {
    const b = $("#lvBtn");
    if (S.level) { b.hidden = false; b.dataset.lv = S.level; b.textContent = `난이도 ${LEVELS[S.level].name}`; }
    else b.hidden = true;
  }
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
    const tab = { "": "home", learn: "learn", lesson: "learn", quiz: "quiz", cards: "cards", wrong: "wrong", essay: "essay", tips: "tips", level: "home" }[parts[0]] || "home";
    updateTop(); updateTabs(tab);
    switch (parts[0]) {
      case "learn": viewLearn(); break;
      case "lesson": viewLesson(parts[1]); break;
      case "quiz": viewQuiz(params); break;
      case "cards": viewCards(params); break;
      case "wrong": viewWrong(); break;
      case "essay": parts[1] != null ? viewEssay(Number(parts[1])) : viewEssayList(); break;
      case "tips": viewTips(); break;
      case "level": viewLevel(false); break;
      default: viewHome();
    }
    window.scrollTo(0, 0);
  }
  $("#lvBtn").addEventListener("click", () => { location.hash = "#/level"; });
  // 퀴즈·오답 결과 화면은 주소가 그대로라서, 같은 주소 링크를 눌러도 다시 그리게 한다
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href^='#']");
    if (a && a.getAttribute("href") === location.hash) { e.preventDefault(); route(); }
  });
  window.addEventListener("hashchange", route);
  route();
})();

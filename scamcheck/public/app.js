(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let lang = localStorage.getItem("sc_lang") || "en"; // only stores language choice, nothing about messages
  let mode = "image", imageData = "", lastResult = null, lastText = "", fs = 19;
  const t = (k) => window.I18N[lang][k];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- language ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    $("#langBtn").textContent = lang === "ar" ? "English" : "العربية";
    $$("[data-i18n]").forEach((e) => { if (t(e.dataset.i18n)) e.textContent = t(e.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((e) => (e.placeholder = t(e.dataset.i18nPh)));
    renderLearn();
    if (lastResult) renderResult(lastResult);
  }
  $("#langBtn").onclick = () => { lang = lang === "en" ? "ar" : "en"; localStorage.setItem("sc_lang", lang); stopSpeak(); applyLang(); };
  $("#textSize").onclick = () => { fs = fs >= 25 ? 19 : fs + 2; document.documentElement.style.setProperty("--fs", fs + "px"); };

  // ---------- navigation ----------
  $$(".tab").forEach((b) => (b.onclick = () => showView(b.dataset.view)));
  function showView(v) {
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    $("#view-check").hidden = v !== "check";
    $("#view-learn").hidden = v !== "learn";
    window.scrollTo(0, 0);
  }

  // ---------- input modes ----------
  $$(".mode").forEach((b) => (b.onclick = () => {
    mode = b.dataset.mode;
    $$(".mode").forEach((x) => x.classList.toggle("active", x === b));
    $$(".panel").forEach((p) => (p.hidden = p.dataset.panel !== mode));
  }));

  // ---------- image: resize in browser (also strips photo metadata like GPS) ----------
  function loadImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      imageData = c.toDataURL("image/jpeg", 0.85);
      $("#previewImg").src = imageData;
      $("#preview").hidden = false; $("#drop").hidden = true;
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  $("#file").onchange = (e) => loadImage(e.target.files[0]);
  $("#removeImg").onclick = () => { imageData = ""; $("#file").value = ""; $("#preview").hidden = true; $("#drop").hidden = false; };
  const drop = $("#drop");
  ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => loadImage(e.dataTransfer.files[0]));

  // ---------- analyse ----------
  function showError(msg) { const e = $("#error"); e.textContent = msg; e.hidden = !msg; }
  $("#checkBtn").onclick = async () => {
    const text = mode === "text" ? $("#textIn").value.trim() : "";
    const link = mode === "link" ? $("#linkIn").value.trim() : "";
    const image = mode === "image" ? imageData : "";
    showError(""); $("#result").hidden = true;
    if (!text && !link && !image) return showError(t("needInput"));
    $("#checkBtn").disabled = true; $("#loading").hidden = false;
    try {
      const r = await fetch(window.SCAMCHECK_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, link, image, lang })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "x");
      lastText = text || data.extracted_text || link || "";
      lastResult = data;
      renderResult(data);
    } catch (e) {
      showError(t("netError"));
    } finally {
      $("#checkBtn").disabled = false; $("#loading").hidden = true;
    }
  };

  // ---------- highlight quotes inside the message safely ----------
  function highlight(text, quotes) {
    const lower = text.toLowerCase(), ranges = [];
    quotes.filter(Boolean).forEach((q) => {
      const i = lower.indexOf(q.toLowerCase().trim());
      if (i >= 0) ranges.push([i, i + q.trim().length]);
    });
    ranges.sort((a, b) => a[0] - b[0]);
    let out = "", pos = 0;
    for (const [s, e] of ranges) {
      if (s < pos) continue;
      out += esc(text.slice(pos, s)) + "<mark>" + esc(text.slice(s, e)) + "</mark>";
      pos = e;
    }
    return out + esc(text.slice(pos));
  }

  // ---------- results ----------
  function renderResult(d) {
    const level = ["low", "suspicious", "high"].includes(d.risk_level) ? d.risk_level : "suspicious";
    const signs = Array.isArray(d.warning_signs) ? d.warning_signs : [];
    const steps = Array.isArray(d.next_steps) ? d.next_steps : [];
    const good = Array.isArray(d.reassuring_signs) ? d.reassuring_signs : [];
    const icon = { low: "🟢", suspicious: "🟠", high: "🔴" }[level];
    const box = $("#result");
    box.innerHTML = `
      <div class="card risk-${level}">
        <span class="badge">${icon} ${esc(t("risk_" + level))}</span>
        <p>${esc(d.summary || "")}</p>
        <div class="row">
          <button class="btn fill" id="whyBtn" aria-expanded="false">${esc(t("whyBtn"))}</button>
          <button class="btn" id="speakBtn">${esc(t("readAloud"))}</button>
        </div>
      </div>
      <div class="card" id="why" hidden>
        <h2 style="margin-top:0">${esc(t("signsTitle"))}</h2>
        ${signs.length ? signs.map((s) => `
          <div class="sign"><h3>${esc(s.title)}</h3>
          ${s.quote ? `<q>${esc(s.quote)}</q>` : ""}<p style="margin:6px 0 0">${esc(s.explanation)}</p></div>`).join("") : `<p>${esc(t("noSigns"))}</p>`}
        ${good.length ? `<h3>${esc(t("goodTitle"))}</h3><ul class="steps">${good.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
        ${lastText ? `<h3 style="margin-top:18px">${esc(t("yourMsg"))}</h3><div class="msgbox">${highlight(lastText, signs.map((s) => s.quote))}</div>` : ""}
      </div>
      <div class="card">
        <h2 style="margin-top:0">${esc(t("stepsTitle"))}</h2>
        <ul class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        <p class="hint">${esc(t("verifyNote"))}</p>
        <div class="row">
          <button class="btn fill" id="againBtn">${esc(t("again"))}</button>
          <button class="btn" id="learnBtn">${esc(t("learnMore"))}</button>
        </div>
      </div>`;
    box.hidden = false;
    $("#whyBtn").onclick = (e) => {
      const w = $("#why"); w.hidden = !w.hidden;
      e.target.textContent = w.hidden ? t("whyBtn") : t("hideWhy");
      e.target.setAttribute("aria-expanded", String(!w.hidden));
    };
    $("#speakBtn").onclick = () => toggleSpeak(d, level);
    $("#againBtn").onclick = () => { stopSpeak(); lastResult = null; box.hidden = true; $("#textIn").value = ""; $("#linkIn").value = ""; $("#removeImg").click(); window.scrollTo(0, 0); };
    $("#learnBtn").onclick = () => showView("learn");
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- voice (browser text-to-speech; runs on the device) ----------
  function stopSpeak() { if ("speechSynthesis" in window) speechSynthesis.cancel(); const b = $("#speakBtn"); if (b) b.textContent = t("readAloud"); }
  function toggleSpeak(d, level) {
    if (!("speechSynthesis" in window)) return;
    if (speechSynthesis.speaking) return stopSpeak();
    const parts = [t("risk_" + level) + ".", d.summary || ""];
    (d.warning_signs || []).forEach((s) => parts.push(s.title + ". " + s.explanation));
    parts.push(t("stepsTitle") + ".", ...(d.next_steps || []));
    const u = new SpeechSynthesisUtterance(parts.join(" "));
    u.lang = lang === "ar" ? "ar-SA" : "en-GB"; u.rate = 0.9;
    u.onend = () => { const b = $("#speakBtn"); if (b) b.textContent = t("readAloud"); };
    speechSynthesis.speak(u);
    $("#speakBtn").textContent = t("stopRead");
  }

  // ---------- learn + quiz ----------
  function renderLearn() {
    $("#lessons").innerHTML = t("lessons").map((l) => `
      <details class="lesson"><summary>${esc(l.t)}</summary><div><p>${esc(l.b)}</p>${l.e ? `<div class="example">${esc(l.e)}</div>` : ""}</div></details>`).join("");
    const qs = t("quiz");
    let score = 0, done = 0;
    $("#quiz").innerHTML = qs.map((q, i) => `
      <div class="q" data-i="${i}"><strong>${i + 1}/${qs.length}</strong><div class="msg">${esc(q.m)}</div>
      <div class="opts"><button class="btn" data-a="ok">${esc(t("trust"))}</button><button class="btn" data-a="sus">${esc(t("suspicious"))}</button></div>
      <div class="fb" hidden></div></div>`).join("") + `<p id="score" class="lead"></p>`;
    $$("#quiz .q").forEach((el) => {
      const q = qs[+el.dataset.i];
      $$("button", el).forEach((b) => (b.onclick = () => {
        const right = (b.dataset.a === "sus") === q.s;
        const fb = $(".fb", el);
        fb.className = "fb " + (right ? "ok" : "no");
        fb.textContent = (right ? t("correct") : t("notQuite")) + q.w; fb.hidden = false;
        $$("button", el).forEach((x) => (x.disabled = true));
        done++; if (right) score++;
        if (done === qs.length) $("#score").textContent = `${t("score")}: ${score}/${qs.length}`;
      }));
    });
  }

  applyLang();
})();

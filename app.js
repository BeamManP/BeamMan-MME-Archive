// エフェクト置き場の一覧・検索・詳細。データは data.json（tools/build_site.py が作る）
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let DATA = { effects: [], files: [] };

// ---- 言葉（日本語・英語）。日本語は index.html と、下の ja の物。英語は画面の文・利用規約と、data.json の *_en がある物だけ ----
// 決め方: URL の ?lang=en|ja → 前に選んだ物（localStorage）→ ブラウザの言語（ja でなければ英語）
const EN = {
  title: "BeamMan's Effect Archive",
  h1: "BeamMan's<br>Effect Archive",
  lede: "MikuMikuEffect (MME) effects made by me, BeamMan, are available here.",
  moved: "Moved here from atwiki as uploader.jp closes (Nov 25, 2026). Every file from the old uploaders, including old versions, can be downloaded here.",
  pick: "New", tools: "Filter", search: "Search effects",
  q: "Search by name or description (e.g. Glass, water, explosion)",
  soft: "Software", mme: "MME effects", others: "Other files",
  others_p: "Old versions, prototypes and materials that were not listed on the wiki. The search above also applies here.",
  th_file: "File", th_comment: "Comment", th_date: "Date", th_size: "Size",
  rules: "Terms of use for the effects (updated 2023/11/12)",
  rules1: "Unless the bundled txt says otherwise, you may freely redistribute and modify all the effects distributed here.",
  rules2: "Also unless the bundled txt says otherwise, personal and circle activities may use them commercially or non-commercially without a license or credit (I'd be happy if you credit me and let me know).",
  rules3: "However, please contact me by DM on X (formerly Twitter) below before any political use, religious activity or commercial use by a company. Send other questions by DM too.",
  x: "X (formerly Twitter) @BeamManP", nico: "Niconico user page", close: "Close",
  foot: "Files are hosted on GitHub Releases. ", repo: "Repository",
};
const T = {
  ja: { count: (n) => `${n} 件のエフェクト`, others: (n) => `一覧を開く（${n} 件）`, open: (t) => `${t} の詳細を開く`,
        video: "配布動画", dl: "ダウンロード", nico: "配布動画をニコニコで開く", olds: "同じエフェクトの別の版",
        fail: "一覧を読み込めませんでした。ページを再読み込みしてください。" },
  en: { count: (n) => `${n} effects`, others: (n) => `Show the list (${n})`, open: (t) => `Open details of ${t}`,
        video: "Video", dl: "Download", nico: "Open the video on Niconico", olds: "Other versions of this effect",
        fail: "Could not load the list. Please reload the page." },
};
let LANG = "ja";
const t = (k, ...a) => (typeof T[LANG][k] === "function" ? T[LANG][k](...a) : T[LANG][k]);
// 項目の欄の、今の言葉の物（title_en などが無ければ日本語）
const L = (o, k) => (LANG === "en" && o[`${k}_en`]) || o[k] || "";
// 動く環境の表記（MMD_ は落とす。SP対応 は英語で）
const envText = (e) => L(e, "env").replace(/MMD_/g, "").replace(/SP対応/g, LANG === "en" ? "SP-ready" : "SP対応");

function chooseLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "ja" || q === "en") return q;
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "ja" || saved === "en") return saved;
  } catch (_) { /* 保存が使えない環境 */ }
  return (navigator.language || "ja").toLowerCase().startsWith("ja") ? "ja" : "en";
}

function applyLang(lang) {
  LANG = lang;
  document.documentElement.lang = lang;
  // name: data-* の名前（dataset の書き方）。日本語（HTML の元）は最初に覚えておき、日本語に戻す時に使う
  const swap = (name, read, write) => document.querySelectorAll(`[data-${name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}]`)
    .forEach((el) => {
      if (el.dataset.ja === undefined) el.dataset.ja = read(el);
      write(el, lang === "en" ? EN[el.dataset[name]] : el.dataset.ja);
    });
  swap("i18n", (el) => el.textContent, (el, v) => { el.textContent = v; });
  swap("i18nHtml", (el) => el.innerHTML, (el, v) => { el.innerHTML = v; });
  swap("i18nPlaceholder", (el) => el.placeholder, (el, v) => { el.placeholder = v; });
  swap("i18nAria", (el) => el.getAttribute("aria-label"), (el, v) => { el.setAttribute("aria-label", v); });
  document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  render();
}

// 版違いを束ねるための名前の芯（拡張子・版番号・32/64 表記を落とす）
const stem = (name) => name.toLowerCase()
  .replace(/\.[a-z0-9]+$/, "")
  .replace(/[_\s-]*(32_64|64bit|32bit|_64|mmm)\b/g, "")
  .replace(/[_\s-]*v(er)?[_.]?[\d._]+[a-z]?$/g, "")
  .replace(/[_\s-]+$/, "");

// サムネは wiki の画像 → 配布動画のサムネ → no image の順
function thumbImg(e) {
  if (e.img) return `<img class="thumb" loading="lazy" alt="" src="${esc(e.img)}">`;
  if (!e.thumb) return `<div class="thumb none">no image</div>`;
  // 新しい動画は .M（大きいサムネ）がある。無ければ元の小さいサムネへ
  return `<img class="thumb" loading="lazy" alt="" src="${esc(e.thumb)}.M" onerror="this.onerror=null;this.src='${esc(e.thumb)}'">`;
}

function matches(q, ...fields) {
  if (!q) return true;
  const hay = fields.join(" ").toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function render() {
  const q = $("#q").value.trim().toLowerCase();
  const hit = DATA.effects
    .filter((e) => matches(q, e.title, e.notes, e.title_en, e.notes_en, e.file, e.video_title))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.order - b.order);
  const list = hit.filter((e) => e.kind === "effect");
  const soft = hit.filter((e) => e.kind === "soft");

  // 新着（pin が付いた物）は検索に関係なく一番上に出す
  const pick = DATA.effects.filter((e) => e.pin);
  $("#pick-grid").innerHTML = cards(pick);
  $("#pick").hidden = pick.length === 0;
  $("#grid").innerHTML = cards(list);
  $("#soft-grid").innerHTML = cards(soft);
  $("#soft").hidden = soft.length === 0;
  $("#count").textContent = t("count", list.length);
  renderOthers(q);
}

function cards(list) {
  return list.map((e) => `
    <li><article class="card" tabindex="0" data-i="${DATA.effects.indexOf(e)}" aria-label="${esc(t("open", L(e, "title")))}">
      ${thumbImg(e)}
      <div class="body">
        <h3>${esc(L(e, "title"))}</h3>
        ${L(e, "notes") ? `<p class="desc">${esc(L(e, "notes").split(" / ")[0])}</p>` : ""}
        <p class="meta">${esc(e.date)}</p>
        <div class="row">
          ${e.new ? '<span class="tag new">NEW</span>' : ""}
          ${e.env ? `<span class="tag">${esc(envText(e))}</span>` : ""}
        </div>
      </div>
    </article></li>`).join("");
}

function renderOthers(q) {
  const listed = new Set(DATA.effects.filter((e) => e.ref).map((e) => e.ref.join("/")));
  const others = DATA.files
    .filter((f) => !listed.has(`${f.uploader}/${f.id}`) && matches(q, f.file, f.comment))
    .sort((a, b) => b.date.localeCompare(a.date));
  $("#others-sum").textContent = t("others", others.length);
  $("#others-body").innerHTML = others.map((f) => `
    <tr><td><a href="${esc(f.url)}">${esc(f.file)}</a></td><td>${esc(f.comment)}</td>
    <td class="num">${esc(f.date)}</td><td class="num">${esc(f.size)}</td></tr>`).join("");
  if (q && others.length && !$("#others-box").open && $("#grid").children.length === 0) $("#others-box").open = true;
}

function openDetail(e) {
  const s = e.file ? stem(e.file) : null;
  const olds = s ? DATA.files.filter((f) => stem(f.file) === s && !(e.ref && f.uploader === e.ref[0] && f.id === e.ref[1]))
    .sort((a, b) => b.date.localeCompare(a.date)) : [];
  $("#d-body").innerHTML = `
    <h2 id="d-title">${esc(L(e, "title"))}</h2>
    ${L(e, "notes") ? `<p>${esc(L(e, "notes")).replace(/ \/ /g, "<br>")}</p>` : ""}
    ${e.sm ? `<iframe class="video" src="https://embed.nicovideo.jp/watch/${esc(e.sm)}" allowfullscreen loading="lazy" title="${esc(t("video"))} ${esc(e.video_title)}"></iframe>` : ""}
    <div class="acts">
      <a class="dl" href="${esc(e.url)}">${esc(t("dl"))}</a>
      ${e.sm ? `<a href="https://www.nicovideo.jp/watch/${esc(e.sm)}">${esc(t("nico"))}</a>` : ""}
      ${(e.extras || []).map((x) => `<a href="${esc(L(x, "url"))}">${esc(L(x, "label"))}</a>`).join("")}
    </div>
    <p class="meta">${[e.file, e.size, e.date, envText(e)].filter(Boolean).map(esc).join("　")}</p>
    ${olds.length ? `<h3>${esc(t("olds"))}</h3><ul>${olds.map((f) =>
      `<li><a href="${esc(f.url)}">${esc(f.file)}</a>（${esc(f.date)}・${esc(f.size)}）${f.comment ? ` ${esc(f.comment)}` : ""}</li>`).join("")}</ul>` : ""}`;
  $("#detail").showModal();
}

document.addEventListener("click", (ev) => {
  const c = ev.target.closest(".card");
  if (c) openDetail(DATA.effects[c.dataset.i]);
});
document.addEventListener("keydown", (ev) => {
  const c = ev.target.closest?.(".card");
  if (c && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); openDetail(DATA.effects[c.dataset.i]); }
});
$("#detail").addEventListener("close", () => { $("#d-body").innerHTML = ""; }); // 動画を止める
$("#q").addEventListener("input", render);
document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
  try { localStorage.setItem("lang", b.dataset.lang); } catch (_) { /* 保存が使えない環境 */ }
  applyLang(b.dataset.lang);
}));
applyLang(chooseLang());
fetch("data.json", { cache: "no-cache" }).then((r) => r.json()).then((d) => { DATA = d; render(); })
  .catch(() => { $("#count").textContent = t("fail"); });

// エフェクト置き場の一覧・検索・詳細。データは data.json（tools/build_site.py が作る）
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let DATA = { effects: [], files: [] };

// 版違いを束ねるための名前の芯（拡張子・版番号・32/64 表記を落とす）
const stem = (name) => name.toLowerCase()
  .replace(/\.[a-z0-9]+$/, "")
  .replace(/[_\s-]*(32_64|64bit|32bit|_64|mmm)\b/g, "")
  .replace(/[_\s-]*v(er)?[_.]?[\d._]+[a-z]?$/g, "")
  .replace(/[_\s-]+$/, "");

function thumbImg(e) {
  if (!e.thumb) return `<div class="thumb none">${e.kind === "soft" ? "ソフトウェア" : "動画なし"}</div>`;
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
    .filter((e) => matches(q, e.title, e.notes, e.file, e.video_title))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.order - b.order);
  const list = hit.filter((e) => e.kind === "effect");
  const soft = hit.filter((e) => e.kind === "soft");

  $("#grid").innerHTML = cards(list);
  $("#soft-grid").innerHTML = cards(soft);
  $("#soft").hidden = soft.length === 0;
  $("#count").textContent = `${list.length} 件のエフェクト`;
  renderOthers(q);
}

function cards(list) {
  return list.map((e) => `
    <li><article class="card" tabindex="0" data-i="${DATA.effects.indexOf(e)}" aria-label="${esc(e.title)} の詳細を開く">
      ${thumbImg(e)}
      <div class="body">
        <h3>${esc(e.title)}</h3>
        <p class="meta">${esc(e.date)}</p>
        <div class="row">
          ${e.new ? '<span class="tag new">NEW</span>' : ""}
          ${e.env ? `<span class="tag">${esc(e.env.replace(/MMD_/g, ""))}</span>` : ""}
        </div>
      </div>
    </article></li>`).join("");
}

function renderOthers(q) {
  const listed = new Set(DATA.effects.filter((e) => e.ref).map((e) => e.ref.join("/")));
  const others = DATA.files
    .filter((f) => !listed.has(`${f.uploader}/${f.id}`) && matches(q, f.file, f.comment))
    .sort((a, b) => b.date.localeCompare(a.date));
  $("#others-sum").textContent = `一覧を開く（${others.length} 件）`;
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
    <h2 id="d-title">${esc(e.title)}</h2>
    ${e.notes ? `<p>${esc(e.notes).replace(/ \/ /g, "<br>")}</p>` : ""}
    ${e.sm ? `<iframe class="video" src="https://embed.nicovideo.jp/watch/${esc(e.sm)}" allowfullscreen loading="lazy" title="配布動画 ${esc(e.video_title)}"></iframe>` : ""}
    <div class="acts">
      <a class="dl" href="${esc(e.url)}">ダウンロード</a>
      ${e.sm ? `<a href="https://www.nicovideo.jp/watch/${esc(e.sm)}">配布動画をニコニコで開く</a>` : ""}
      ${(e.extras || []).map((x) => `<a href="${esc(x.url)}">${esc(x.label)}</a>`).join("")}
    </div>
    <p class="meta">${[e.file, e.size, e.date, e.env.replace(/MMD_/g, "")].filter(Boolean).map(esc).join("　")}</p>
    ${olds.length ? `<h3>同じエフェクトの別の版</h3><ul>${olds.map((f) =>
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
fetch("data.json", { cache: "no-cache" }).then((r) => r.json()).then((d) => { DATA = d; render(); })
  .catch(() => { $("#count").textContent = "一覧を読み込めませんでした。ページを再読み込みしてください。"; });

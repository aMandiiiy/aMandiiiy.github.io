// 中英切换：放在 <head> 里最先运行，避免页面先闪一下另一种语言
// 规则：用户点过按钮就记住；没点过就按浏览器语言（中文浏览器显示中文，其余显示英文）
(function () {
  const KEY = "site-lang";
  const root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(l) {
    try { localStorage.setItem(KEY, l); } catch (e) {}
  }

  function apply(l) {
    root.dataset.lang = l;
    root.lang = l === "zh" ? "zh-CN" : "en";
    const t = root.dataset["title" + (l === "zh" ? "Zh" : "En")];
    if (t) document.title = t;
    const btn = document.querySelector(".lang-toggle");
    if (btn) {
      btn.textContent = l === "zh" ? "EN" : "中文";
      btn.lang = l === "zh" ? "en" : "zh-CN";
      btn.setAttribute("aria-label", l === "zh" ? "Switch to English" : "切换到中文");
    }
    document.dispatchEvent(new CustomEvent("langchange", { detail: l }));
  }

  const nav = (navigator.language || "en").toLowerCase();
  const initial = saved() || (nav.startsWith("zh") ? "zh" : "en");
  root.dataset.lang = initial;
  root.lang = initial === "zh" ? "zh-CN" : "en";

  document.addEventListener("DOMContentLoaded", () => {
    apply(root.dataset.lang);
    const btn = document.querySelector(".lang-toggle");
    if (btn) btn.addEventListener("click", () => {
      const next = root.dataset.lang === "zh" ? "en" : "zh";
      save(next);
      apply(next);
    });
  });

  window.siteLang = () => root.dataset.lang;
})();

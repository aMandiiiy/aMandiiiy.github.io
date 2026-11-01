// 中英切换：放在 <head> 里最先运行，避免页面先闪一下另一种语言
// 规则：用户点过按钮就记住；没点过就按浏览器语言（中文浏览器显示中文，其余显示英文）
(function () {
  // 中文版开关：false = 只显示英文，并隐藏右上角的切换按钮；想重新打开中文版，改成 true 就行
  const ZH_ENABLED = false;

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
  const initial = !ZH_ENABLED ? "en" : saved() || (nav.startsWith("zh") ? "zh" : "en");
  root.dataset.lang = initial;
  root.lang = initial === "zh" ? "zh-CN" : "en";
  if (!ZH_ENABLED) {
    // 页面一出来就藏住按钮，不会闪一下
    const st = document.createElement("style");
    st.textContent = ".lang-toggle{display:none!important}";
    document.head.appendChild(st);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!ZH_ENABLED) {
      const b = document.querySelector(".lang-toggle");
      if (b) b.remove();
    }
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

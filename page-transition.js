(function () {
  if (window.__adnnPageTransitionReady) return;
  window.__adnnPageTransitionReady = true;

  const style = document.createElement("style");
  style.textContent = `
    html.adnn-page-leave body {
      pointer-events: none;
      animation: adnnPageLeave .16s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes adnnPageLeave {
      from { opacity: 1; transform: translate3d(0, 0, 0); filter: blur(0); }
      to { opacity: .72; transform: translate3d(0, -3px, 0); filter: blur(3px); }
    }
    @media (prefers-reduced-motion: reduce) {
      html.adnn-page-leave body {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.addEventListener("pageshow", () => {
    document.documentElement.classList.remove("adnn-page-leave");
  });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || reduceMotion || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    const url = new URL(link.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;

    event.preventDefault();
    document.documentElement.classList.add("adnn-page-leave");
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 120);
  }, true);
})();

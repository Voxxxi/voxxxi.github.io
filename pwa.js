/* No service worker or response caching; auth and private data stay on their existing paths. */
(() => {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!standalone || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Skip OAuth returns, deep links and repeated page visits in the same app session.
  if (location.search || location.hash) return;
  try {
    if (sessionStorage.getItem("voxi_pwa_launched")) return;
    sessionStorage.setItem("voxi_pwa_launched", "1");
  } catch (_) { return; }
  const launch = document.createElement("div");
  launch.className = "voxi-launch";
  launch.setAttribute("aria-hidden", "true");
  const logo = document.createElement("img");
  logo.src = "/icons/voxi-512.png";
  logo.alt = "";
  logo.width = 512;
  logo.height = 512;
  launch.append(logo);
  document.body.append(launch);
  const remove = () => launch.remove();
  launch.addEventListener("animationend", remove, {once:true});
  window.setTimeout(remove, 1200);
})();

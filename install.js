/* Browser-owned installation: never download APKs or bypass Android confirmation. */
(() => {
  const trigger = document.getElementById("voxiInstallButton");
  if (!trigger) return;
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone()) return;
  let deferred = null;
  let busy = false;
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const kk = () => {
    const node = document.getElementById("kk");
    return !!node && (node.classList.contains("active") || node.classList.contains("on"));
  };
  const say = (ru, kz) => kk() ? kz : ru;
  const dialog = document.createElement("dialog");
  dialog.className = "voxi-install-dialog";
  dialog.setAttribute("aria-labelledby", "voxiInstallTitle");
  const title = document.createElement("h2");
  title.id = "voxiInstallTitle";
  const text = document.createElement("p");
  text.className = "voxi-install-copy";
  const status = document.createElement("p");
  status.className = "voxi-install-status";
  status.setAttribute("role", "status");
  const install = document.createElement("button");
  install.type = "button";
  install.className = "voxi-install-confirm";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "voxi-install-close";
  const chromeLink = document.createElement("a");
  chromeLink.className = "voxi-open-chrome";
  chromeLink.href = "intent://voxxxi.github.io/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.android.chrome;end";
  chromeLink.setAttribute("style", "box-sizing:border-box;display:block;width:100%;margin:0 0 12px;padding:12px 15px;border:1px solid #e8bd79;border-radius:100px;background:linear-gradient(120deg,#f0d198,#bd8a42);color:#21160b;font:600 12px/1.4 Manrope,Montserrat,Arial,sans-serif;text-align:center;text-decoration:none");
  dialog.append(title, text, status, install, chromeLink, close);
  document.body.append(dialog);
  const refresh = () => {
    trigger.querySelector("span").textContent = say("Скачать приложение", "Қолданбаны жүктеу");
    title.textContent = say("VOXi на вашем телефоне", "VOXi телефоныңызда");
    close.textContent = say("Закрыть", "Жабу");
    install.textContent = say("Установить VOXi", "VOXi орнату");
    install.hidden = isSamsung || !deferred || busy;
    chromeLink.hidden = !isSamsung;
    chromeLink.textContent = say("Открыть VOXi в Google Chrome", "VOXi қолданбасын Google Chrome арқылы ашу");
    if (deferred && !isSamsung) {
      text.textContent = say("Нажмите «Установить VOXi» и подтвердите установку в окне браузера.", "«VOXi орнату» түймесін басып, браузер терезесінде орнатуды растаңыз.");
    } else if (isIos) {
      text.textContent = say("В Safari нажмите «Поделиться» → «На экран Домой» → «Добавить». Если есть переключатель «Открывать как веб-приложение», оставьте его включённым.", "Safari-де «Бөлісу» → «Басты экранға қосу» → «Қосу» тармақтарын таңдаңыз. Веб-қолданба ретінде ашу параметрі болса, оны қосулы қалдырыңыз.");
    } else if (isSamsung) {
      text.textContent = say("В Samsung Internet возможна ошибка установки приложения. Нажмите кнопку ниже: откроется Google Chrome. Уже в Chrome нажмите «Скачать приложение» и подтвердите установку.", "Samsung Internet арқылы орнату кезінде қате болуы мүмкін. Төмендегі түйме арқылы Google Chrome ашып, «Қолданбаны жүктеу» түймесін басыңыз.");
    } else {
      text.textContent = say(isAndroid
        ? "В Chrome нажмите ⋮ → «Установить и создать ярлык» → «Установить». В некоторых версиях пункт называется «Добавить на главный экран». Если окно установки ещё не готово, немного подождите и попробуйте снова."
        : "Откройте меню браузера и выберите установку VOXi как приложения. На телефоне откройте этот сайт в Chrome (Android) или Safari (iPhone).",
        "Браузер мәзірінен қолданбаны орнату немесе басты экранға қосу тармағын таңдаңыз. Телефонда сайтты Chrome (Android) не Safari (iPhone) арқылы ашыңыз.");
    }
  };
  const showHelp = (message = "") => {
    refresh();
    status.textContent = message;
    if (!dialog.open) dialog.showModal();
  };
  const requestInstall = async () => {
    if (busy) return;
    if (isSamsung) { showHelp(); return; }
    if (!deferred) { showHelp(); return; }
    busy = true;
    trigger.disabled = true;
    const event = deferred;
    deferred = null;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (!standalone()) showHelp(choice.outcome === "accepted"
        ? say("Запрос передан браузеру. Дождитесь завершения установки, затем найдите VOXi в списке приложений. Если браузер сообщил об ошибке, установка не завершена.", "Сұрау браузерге жіберілді. Орнату аяқталған соң VOXi қолданбасын тізімнен табыңыз. Қате шықса, орнату аяқталмады.")
        : say("Установка отменена. Можно попробовать ещё раз через меню браузера.", "Орнату тоқтатылды. Браузер мәзірі арқылы қайта көруге болады."));
    } catch (_) {
      showHelp(say("Не удалось открыть установку. Попробуйте через меню браузера. Если Android показывает предупреждение, не отключайте защиту.", "Орнату терезесі ашылмады. Браузер мәзірі арқылы көріңіз. Android ескерту шығарса, қорғанысты өшірмеңіз."));
    } finally {
      busy = false;
      trigger.disabled = false;
      refresh();
    }
  };
  trigger.addEventListener("click", () => { void requestInstall(); });
  install.addEventListener("click", () => { void requestInstall(); });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferred = event;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    // On Android this event may precede completion of WebAPK installation.
    deferred = null;
    refresh();
  });
  const mode = window.matchMedia("(display-mode: standalone)");
  mode.addEventListener("change", () => {
    trigger.hidden = standalone();
    if (standalone() && dialog.open) dialog.close();
  });
  for (const id of ["ru", "kk"]) {
    document.getElementById(id)?.addEventListener("click", () => window.setTimeout(refresh, 0));
  }
  refresh();
  trigger.hidden = false;
})();

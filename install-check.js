(() => {
  const samsung = /SamsungBrowser/i.test(navigator.userAgent);
  const chromeHelp = document.getElementById("chromeHelp");
  if (chromeHelp) chromeHelp.hidden = !samsung;
  const out = document.getElementById("results");
  const report = document.getElementById("report");
  const summary = document.getElementById("summary");
  const nativeButton = document.getElementById("nativeInstall");
  if (samsung) nativeButton.hidden = true;
  const copyButton = document.getElementById("copyReport");
  const copyStatus = document.getElementById("copyStatus");
  const runButton = document.getElementById("runChecks");
  const rows = [];
  let promptEvent = null;
  let running = false;
  let checksDone = false;
  let failures = 0;
  let installState = "Ожидание ответа браузера. Нажмите на страницу и подождите до 30 секунд.";
  const cleanError = error => String(error && error.message || error).slice(0, 220);
  const makeReport = () => {
    report.value = [
      "VOXi — проверка установки, версия 2",
      "Время: " + new Date().toISOString(),
      "Браузер: " + navigator.userAgent,
      "HTTPS: " + window.isSecureContext,
      "Режим приложения: " + (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true),
      ...rows.map(row => (row.ok ? "OK: " : "ОШИБКА: ") + row.label + " — " + row.detail),
      "Установка: " + installState,
      "Этот отчёт не содержит аккаунт, cookies или данные кабинета."
    ].join("\n");
    document.getElementById("installState").textContent = installState;
  };
  const addRow = (label, ok, detail) => {
    const item = document.createElement("li");
    item.className = ok ? "ok" : "fail";
    item.textContent = (ok ? "✓ " : "× ") + label + ": " + detail;
    out.append(item);
    rows.push({label, ok, detail});
    if (!ok) failures++;
    makeReport();
  };
  const getPublic = async url => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {cache:"no-store", credentials:"omit", signal:controller.signal});
      if (!response.ok) throw Error("HTTP " + response.status);
      // Read the body before clearing the timeout.
      const blob = await response.blob();
      return {blob, type:response.headers.get("content-type") || "", url:response.url};
    } finally { clearTimeout(timer); }
  };
  const imageSize = blob => new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(Error("Не удалось прочитать PNG за 10 секунд")); }, 10000);
    const finish = () => {clearTimeout(timer);URL.revokeObjectURL(url);};
    image.onload = () => {finish();resolve({width:image.naturalWidth,height:image.naturalHeight});};
    image.onerror = () => {finish();reject(Error("Телефон не смог прочитать PNG"));};
    image.src = url;
  });
  const checkIcon = async (url, size, label) => {
    try {
      const result = await getPublic(url);
      if (!/^image\/png(?:;|$)/i.test(result.type)) throw Error("Неверный тип: " + result.type);
      const actual = await imageSize(result.blob);
      if (actual.width !== size || actual.height !== size) throw Error("Размер " + actual.width + "×" + actual.height + ", нужен " + size + "×" + size);
      addRow(label, true, "PNG " + size + "×" + size + " загружен и прочитан");
    } catch (error) { addRow(label, false, cleanError(error)); }
  };
  const run = async () => {
    if (running) return;
    running = true;
    checksDone = false;
    failures = 0;
    rows.length = 0;
    out.replaceChildren();
    runButton.disabled = true;
    summary.textContent = "Проверяем файлы с вашего телефона…";
    addRow("Защищённое соединение", window.isSecureContext, window.isSecureContext ? "HTTPS работает" : "Нужен HTTPS");
    try {
      const url = new URL("/manifest.webmanifest", location.origin);
      const fetched = await getPublic(url);
      if (!/^(application\/manifest\+json|application\/json)(?:;|$)/i.test(fetched.type)) throw Error("Неверный тип манифеста: " + fetched.type);
      const manifest = JSON.parse(await fetched.blob.text());
      const start = new URL(manifest.start_url, url);
      const scope = new URL(manifest.scope, url);
      if (!(manifest.name || manifest.short_name)) throw Error("Не указано название");
      if (!["standalone","minimal-ui","fullscreen","window-controls-overlay"].includes(manifest.display)) throw Error("Неверный режим запуска");
      if (manifest.prefer_related_applications === true) throw Error("Включён переход в магазин вместо PWA");
      if (start.origin !== location.origin || scope.origin !== location.origin || !start.pathname.startsWith(scope.pathname)) throw Error("Неверная область приложения");
      addRow("Настройки приложения", true, "Манифест прочитан, название и режим запуска указаны");
      try {
        const home = await getPublic(start);
        if (!/text\/html/i.test(home.type)) throw Error("Вместо страницы получен " + home.type);
        addRow("Стартовая страница", true, "Доступна по HTTPS");
      } catch (error) {addRow("Стартовая страница", false, cleanError(error));}
      for (const size of [192,512]) {
        const icon = (manifest.icons || []).find(item => item.sizes && item.sizes.split(/\s+/).includes(size+"x"+size) && (!item.purpose || item.purpose.split(/\s+/).includes("any")));
        if (!icon) addRow("Иконка " + size, false, "Нет подходящей записи в манифесте");
        else {
          const iconUrl = new URL(icon.src, url);
          if (iconUrl.origin !== location.origin) addRow("Иконка " + size, false, "Иконка не на домене VOXi");
          else await checkIcon(iconUrl, size, "Иконка " + size);
        }
      }
    } catch (error) {addRow("Настройки приложения", false, cleanError(error));}
    await checkIcon(new URL("/icons/apple-touch-icon.png", location.origin), 180, "Иконка iPhone");
    checksDone = true;
    running = false;
    runButton.disabled = false;
    summary.textContent = failures
      ? "Найдена проблема с загрузкой или настройками. Скопируйте результат и отправьте в чат."
      : "Проверенные файлы доступны с этого телефона. Это ещё не подтверждает завершение установки Android. Скопируйте результат и отправьте в чат.";
    makeReport();
  };
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    promptEvent = event;
    nativeButton.disabled = samsung;
    installState = samsung ? "Samsung Internet предоставил окно, но предыдущая установка завершилась ошибкой. Нажмите «Открыть проверку в Google Chrome» выше." : "Браузер предоставил системное окно установки.";
    makeReport();
  });
  window.addEventListener("appinstalled", () => {
    installState = "Браузер принял установку. На Android это событие может произойти до завершения установки пакета.";
    promptEvent = null;
    nativeButton.disabled = true;
    makeReport();
  });
  nativeButton.addEventListener("click", async () => {
    if (!promptEvent) return;
    const event = promptEvent;
    promptEvent = null;
    nativeButton.disabled = true;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      installState = choice.outcome === "accepted"
        ? "Подтверждение получено. Если Android затем сообщил об ошибке, установка НЕ завершена. Приложите скриншот ошибки к отчёту."
        : "Пользователь отменил установку.";
    } catch (error) {installState = "Ошибка открытия установки: " + cleanError(error);}
    makeReport();
  });
  copyButton.addEventListener("click", async () => {
    makeReport();
    try {await navigator.clipboard.writeText(report.value);copyStatus.textContent = "Скопировано. Вставьте результат в чат.";}
    catch (_) {report.focus();report.select();copyStatus.textContent = "Выделен отчёт. Зажмите текст и выберите «Копировать».";}
  });
  runButton.addEventListener("click", () => {void run();});
  setTimeout(() => {
    if (!promptEvent && !window.matchMedia("(display-mode: standalone)").matches && !/принял|Подтверждение|отменил|Ошибка открытия/.test(installState)) {
      installState = "За 35 секунд браузер не предоставил окно установки. Это не объясняет причину: возможны ограничения браузера, уже установленная PWA или условия показа.";
      makeReport();
    }
  },35000);
  makeReport();
  void run();
})();

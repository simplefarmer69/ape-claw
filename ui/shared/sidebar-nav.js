/* Minimal stonk-style sidebar for static pages (no framework). */
(function () {
  function el(id) { return document.getElementById(id); }
  function q(sel) { return document.querySelector(sel); }

  var mount = el("sbNavMount");
  if (!mount) return;

  var links = [
    { href: "/ui", label: "Dashboard", icon: "grid" },
    { href: "/pod", label: "THE POD", icon: "rocket" },
    { href: "/skills", label: "Skills", icon: "stack" },
    { href: "/docs", label: "Docs", icon: "book" },
    { href: "https://github.com/simplefarmer69/ape-claw", label: "GitHub", icon: "ext", external: true },
    { href: "https://openclaw.ai", label: "OpenClaw", icon: "ext", external: true },
  ];

  function iconSvg(kind) {
    // Tiny inline SVGs to avoid dependencies.
    if (kind === "grid") return '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>';
    if (kind === "rocket") return '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>';
    if (kind === "stack") return '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>';
    if (kind === "book") return '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
    return '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0 0-7.07 5 5 0 0 0-7.07 0L10 5"/><path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 0 7.07 5 5 0 0 0 7.07 0L14 19"/></svg>';
  }

  function normalizePath(p) {
    var s = String(p || "");
    if (!s) return "/";
    // treat /docs?doc=... as /docs for nav active purposes
    return s.split("?")[0].replace(/\/+$/, "") || "/";
  }

  function isActive(href, curPath) {
    var h = normalizePath(href);
    var c = normalizePath(curPath);
    if (h === "/") return c === "/";
    return c === h || (c.startsWith(h + "/"));
  }

  var cur = normalizePath(window.location.pathname || "/");
  var navHtml = "";
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    var active = !l.external && isActive(l.href, cur);
    var attrs = active ? ' aria-current="page"' : "";
    if (l.external) attrs += ' target="_blank" rel="noopener"';
    navHtml +=
      '<a class="sb-link" href="' + String(l.href) + '"' + attrs + ">" +
      iconSvg(l.icon) +
      '<span class="sb-text">' + String(l.label) + "</span>" +
      (l.external ? '<span class="sb-sub">EXT</span>' : '<span class="sb-sub"></span>') +
      "</a>";
  }

  mount.innerHTML =
    '<button class="sb-menu-btn" id="sbMenuBtn" type="button" aria-label="Toggle menu" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">' +
        '<line x1="3" y1="6" x2="21" y2="6"></line>' +
        '<line x1="3" y1="12" x2="21" y2="12"></line>' +
        '<line x1="3" y1="18" x2="21" y2="18"></line>' +
      "</svg>" +
    "</button>" +
    '<div class="sb-backdrop" id="sbBackdrop" aria-hidden="true"></div>' +
    '<aside class="sb-sidebar" id="sbSidebar" data-open="0" aria-label="Menu">' +
      '<div class="sb-inner">' +
        '<div class="sb-brand">' +
          '<div class="sb-mark" aria-hidden="true"></div>' +
          '<div>' +
            "<strong>APECLAW</strong>" +
            '<span>terminal library • pod swarm</span>' +
          "</div>" +
        "</div>" +
        '<nav class="sb-nav" aria-label="Primary navigation">' + navHtml + "</nav>" +
        '<div class="sb-footer">Tip: press <code>Esc</code> to close. If you are local, you can change backend with <code>?api=</code>.</div>' +
      "</div>" +
    "</aside>";

  var btn = el("sbMenuBtn");
  var bd = el("sbBackdrop");
  var side = el("sbSidebar");
  if (!btn || !bd || !side) return;

  function setOpen(v) {
    var open = !!v;
    side.setAttribute("data-open", open ? "1" : "0");
    bd.setAttribute("data-open", open ? "1" : "0");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    // Swap icon to close when open (cheap innerHTML replace).
    btn.innerHTML = open
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
  }

  btn.addEventListener("click", function () {
    var open = side.getAttribute("data-open") === "1";
    setOpen(!open);
  });
  bd.addEventListener("click", function () { setOpen(false); });
  window.addEventListener("keydown", function (e) {
    if (e && e.key === "Escape") setOpen(false);
  });

  // Layout hint for desktop rail.
  try {
    document.body.setAttribute("data-has-sidebar", "1");
  } catch {}
})();


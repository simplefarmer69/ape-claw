/* Minimal stonk-style sidebar for static pages (no framework). */
(function () {
  function el(id) { return document.getElementById(id); }
  function q(sel) { return document.querySelector(sel); }

  var mount = el("sbNavMount");
  if (!mount) return;

  var links = [
    { href: "/",    label: "Home",      icon: "home" },
    { href: "/ui",  label: "Dashboard", icon: "grid" },
    { href: "/pod", label: "THE POD",   icon: "pod" },
    { href: "/skills", label: "Skills", icon: "skills" },
    { href: "/docs",   label: "Docs",   icon: "docs" },
    { href: "https://x.com/ClutchMarkets", label: "ClutchMarkets", icon: "x", external: true },
    { href: "https://github.com/simplefarmer69/ape-claw", label: "GitHub", icon: "github", external: true },
    { href: "https://openclaw.ai", label: "OpenClaw", icon: "claw", external: true },
  ];

  function iconSvg(kind) {
    var s = '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
    if (kind === "home")   return s + '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
    if (kind === "grid")   return s + '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>';
    if (kind === "pod")    return s + '<circle cx="12" cy="12" r="3"/><path d="M12 1v4"/><path d="M12 19v4"/><path d="M4.22 4.22l2.83 2.83"/><path d="M16.95 16.95l2.83 2.83"/><path d="M1 12h4"/><path d="M19 12h4"/><path d="M4.22 19.78l2.83-2.83"/><path d="M16.95 7.05l2.83-2.83"/></svg>';
    if (kind === "skills") return s + '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>';
    if (kind === "docs")   return s + '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
    if (kind === "x")      return '<svg class="sb-ico" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
    if (kind === "github") return '<svg class="sb-ico" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>';
    if (kind === "claw")   return s + '<path d="M7.5 4.27l-.89 2.22a2 2 0 0 1-1.17 1.17L3.22 8.55a.5.5 0 0 0 0 .9l2.22.89a2 2 0 0 1 1.17 1.17l.89 2.22a.5.5 0 0 0 .9 0l.89-2.22a2 2 0 0 1 1.17-1.17l2.22-.89a.5.5 0 0 0 0-.9l-2.22-.89a2 2 0 0 1-1.17-1.17L8.4 4.27a.5.5 0 0 0-.9 0z"/><path d="M15.5 12.27l-.89 2.22a2 2 0 0 1-1.17 1.17l-2.22.89a.5.5 0 0 0 0 .9l2.22.89a2 2 0 0 1 1.17 1.17l.89 2.22a.5.5 0 0 0 .9 0l.89-2.22a2 2 0 0 1 1.17-1.17l2.22-.89a.5.5 0 0 0 0-.9l-2.22-.89a2 2 0 0 1-1.17-1.17l-.89-2.22a.5.5 0 0 0-.9 0z"/></svg>';
    return s + '<path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0 0-7.07 5 5 0 0 0-7.07 0L10 5"/><path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 0 7.07 5 5 0 0 0 7.07 0L14 19"/></svg>';
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
      '<a class="sb-link" href="' + String(l.href) + '" data-tip="' + String(l.label) + '"' + attrs + ">" +
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
          '<div class="sb-mark" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M6.5 3C4.5 5 4 7 4 9c0 2.5 1.5 4 3 5"/>' +
              '<path d="M17.5 3c2 2 2.5 4 2.5 6 0 2.5-1.5 4-3 5"/>' +
              '<path d="M7 14c-1 1-2 3-2 5 0 1 .5 2 2 2s2.5-1 3-2"/>' +
              '<path d="M17 14c1 1 2 3 2 5 0 1-.5 2-2 2s-2.5-1-3-2"/>' +
              '<circle cx="12" cy="12" r="3"/>' +
            '</svg>' +
          '</div>' +
          '<div class="sb-brand-text">' +
            "<strong>APECLAW</strong>" +
            '<span>terminal library • pod swarm</span>' +
          "</div>" +
        "</div>" +
        '<nav class="sb-nav" aria-label="Primary navigation">' + navHtml + "</nav>" +
        '<div class="sb-footer">' +
          '<div class="sb-powered">' +
            '<span class="sb-powered-label">Powered by</span>' +
            '<a href="https://x.com/ClutchMarkets" target="_blank" rel="noopener" class="sb-powered-link">' +
              '<svg class="sb-powered-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>' +
              'Clutch Labs' +
            '</a>' +
          '</div>' +
          '<div class="sb-footer-links">' +
            '<a href="https://x.com/ClutchMarkets" target="_blank" rel="noopener">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
              ' ClutchMarkets' +
            '</a>' +
          '</div>' +
        '</div>' +
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


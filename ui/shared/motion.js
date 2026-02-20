(function () {
  "use strict";
  if (typeof IntersectionObserver === "undefined") return;

  /* ── Scroll reveal ────────────────────────────
     Any element with class "ac-observe" is hidden by CSS (opacity 0,
     translateY 40px). When it enters the viewport, we add "ac-visible"
     which triggers the CSS transition. Each element fires once.          */
  var THRESHOLD = 0.12;
  var revealObs = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) continue;
      entries[i].target.classList.add("ac-visible");
      revealObs.unobserve(entries[i].target);
    }
  }, { threshold: THRESHOLD });

  function observeAll() {
    var els = document.querySelectorAll(".ac-observe:not(.ac-visible)");
    for (var i = 0; i < els.length; i++) revealObs.observe(els[i]);
    var dividers = document.querySelectorAll(".ac-divider:not(.ac-visible)");
    for (var d = 0; d < dividers.length; d++) revealObs.observe(dividers[d]);
  }
  observeAll();
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(observeAll).observe(document.body, { childList: true, subtree: true });
  }

  /* ── Stagger index ────────────────────────────
     Inside a .ac-stagger container, each child .ac-observe gets a
     CSS custom property --ac-i so the delay cascades.                    */
  function assignStaggerIndex() {
    var containers = document.querySelectorAll(".ac-stagger");
    for (var c = 0; c < containers.length; c++) {
      var kids = containers[c].querySelectorAll(":scope > .ac-observe, :scope > * > .ac-observe");
      for (var k = 0; k < kids.length; k++) {
        kids[k].style.setProperty("--ac-i", String(k));
      }
    }
  }
  assignStaggerIndex();

  /* ── Animated count-up ────────────────────────
     Elements with [data-countup] will count from 0 to the target number
     using an ease-out cubic curve when they enter the viewport.
     Usage: <span data-countup="1234" data-countup-suffix="+" data-countup-duration="1400">0</span>
     The element's textContent is replaced as the count progresses.       */
  var COUNTUP_DEFAULT_DURATION = 1400;

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function formatNumber(n) {
    if (typeof Intl !== "undefined" && Intl.NumberFormat) {
      return new Intl.NumberFormat().format(n);
    }
    return String(n);
  }

  function startCountUp(el) {
    if (el.getAttribute("data-countup-started")) return;
    el.setAttribute("data-countup-started", "1");

    var target = parseFloat(String(el.getAttribute("data-countup") || "0").replace(/,/g, ""));
    if (!isFinite(target) || target <= 0) return;
    var duration = parseInt(el.getAttribute("data-countup-duration") || String(COUNTUP_DEFAULT_DURATION), 10);
    var suffix = el.getAttribute("data-countup-suffix") || "";
    var prefix = el.getAttribute("data-countup-prefix") || "";
    var isFloat = String(el.getAttribute("data-countup") || "").indexOf(".") !== -1;
    var decimals = isFloat ? (String(el.getAttribute("data-countup")).split(".")[1] || "").length : 0;

    el.classList.add("ac-counter-pop");

    var shimmer = el.parentElement ? el.parentElement.querySelector(".ac-stat-shimmer") : null;
    if (shimmer) shimmer.classList.add("ac-active");

    var t0 = performance.now();
    function tick(now) {
      var p = Math.min((now - t0) / duration, 1);
      var eased = easeOutCubic(p);
      var current = isFloat
        ? (target * eased).toFixed(decimals)
        : formatNumber(Math.round(target * eased));
      el.textContent = prefix + current + suffix;
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        if (shimmer) shimmer.classList.remove("ac-active");
      }
    }
    requestAnimationFrame(tick);
  }

  var countObs = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) continue;
      startCountUp(entries[i].target);
      countObs.unobserve(entries[i].target);
    }
  }, { threshold: 0.3 });

  var countEls = document.querySelectorAll("[data-countup]");
  for (var i = 0; i < countEls.length; i++) countObs.observe(countEls[i]);

  /* Re-scan for countup elements added dynamically (e.g. after API data loads) */
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(function () {
      var els = document.querySelectorAll("[data-countup]:not([data-countup-started])");
      for (var j = 0; j < els.length; j++) countObs.observe(els[j]);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-countup"] });
  }

  /* Expose a manual trigger for pages that populate stats asynchronously */
  window.acTriggerCountUp = function (el) {
    if (!el || el.getAttribute("data-countup-started")) return;
    countObs.observe(el);
  };
  window.acRescanCountUp = function () {
    var els = document.querySelectorAll("[data-countup]:not([data-countup-started])");
    for (var j = 0; j < els.length; j++) countObs.observe(els[j]);
  };

  /* ── Ripple click effect ──────────────────────
     Any element with class "ac-ripple" gets a ripple on click. */
  document.addEventListener("click", function (e) {
    var target = e.target.closest(".ac-ripple");
    if (!target) return;
    var rect = target.getBoundingClientRect();
    var circle = document.createElement("span");
    circle.className = "ac-ripple-circle";
    circle.style.left = (e.clientX - rect.left - 10) + "px";
    circle.style.top = (e.clientY - rect.top - 10) + "px";
    target.appendChild(circle);
    setTimeout(function () { circle.remove(); }, 700);
  });

  /* ── Magnetic tilt on hover ────────────────────
     Elements with .ac-tilt get subtle 3D rotation tracking the cursor. */
  document.addEventListener("mousemove", function (e) {
    var tilts = document.querySelectorAll(".ac-tilt:hover");
    for (var t = 0; t < tilts.length; t++) {
      var el = tilts[t];
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = (e.clientX - cx) / (rect.width / 2);
      var dy = (e.clientY - cy) / (rect.height / 2);
      el.style.setProperty("--ac-rx", (dx * 3).toFixed(1) + "deg");
      el.style.setProperty("--ac-ry", (dy * -3).toFixed(1) + "deg");
    }
  });
  document.addEventListener("mouseleave", function () {
    var tilts = document.querySelectorAll(".ac-tilt");
    for (var t = 0; t < tilts.length; t++) {
      tilts[t].style.removeProperty("--ac-rx");
      tilts[t].style.removeProperty("--ac-ry");
    }
  }, true);

  /* ── Stagger fast variant ──────────────────── */
  function assignFastStagger() {
    var containers = document.querySelectorAll(".ac-stagger-fast");
    for (var c = 0; c < containers.length; c++) {
      var kids = containers[c].querySelectorAll(":scope > .ac-observe, :scope > * > .ac-observe");
      for (var k = 0; k < kids.length; k++) {
        kids[k].style.setProperty("--ac-i", String(k));
      }
    }
  }
  assignFastStagger();
})();

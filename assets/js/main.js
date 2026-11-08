/* Okejo – interakcie stránky (bez knižníc) */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Rok v pätičke ---------- */
  $all("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Hlavička ---------- */
  var header = $(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobilné menu ---------- */
  var toggle = $(".nav-toggle");
  var nav = $("#menu");
  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Zavrieť menu" : "Otvoriť menu");
    var use = toggle.querySelector("use");
    if (use) use.setAttribute("href", open ? "#i-close" : "#i-menu");
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    $all("a", nav).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
      var inside = nav.contains(document.activeElement);
      setMenu(false);
      if (inside) toggle.focus();
    });
  }

  /* ---------- Formulár ---------- */
  var form = $("#order-form");
  if (!form) return;
  form.noValidate = true; // bez JavaScriptu je formulár skrytý, s ním platí vlastná kontrola

  // Tlačidlá s data-sluzba predvyplnia, o čo má návštevník záujem.
  var select = form.elements.sluzba;
  $all("[data-sluzba]").forEach(function (a) {
    a.addEventListener("click", function () {
      var v = a.getAttribute("data-sluzba");
      if (select && select.querySelector('option[value="' + v + '"]')) select.value = v;
    });
  });

  function digits(v) { return (v || "").replace(/\D+/g, ""); }

  var rules = {
    meno: function (v) { return v.trim().length >= 3; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    web: function (v) { return /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(v.trim().replace(/^https?:\/\//i, "")); },
    telefon: function (v) { return v.trim() === "" || digits(v).length >= 9; }
  };
  var fields = ["meno", "email", "web", "telefon"];
  var names = { meno: "meno", email: "e-mail", web: "adresa e-shopu", telefon: "telefón" };

  function wrapOf(el) { return el.closest(".field"); }

  function validateField(el) {
    var ok = rules[el.name] ? rules[el.name](el.value) : true;
    var w = wrapOf(el);
    if (w) w.classList.toggle("is-invalid", !ok);
    el.setAttribute("aria-invalid", ok ? "false" : "true");
    var er = w ? w.querySelector(".error") : null;
    if (!ok && er) el.setAttribute("aria-describedby", er.id);
    else el.removeAttribute("aria-describedby");
    return ok;
  }

  fields.forEach(function (name) {
    var el = form.elements[name];
    if (!el) return;
    var er = wrapOf(el) && wrapOf(el).querySelector(".error");
    if (er) er.id = name + "-chyba";
    el.addEventListener("input", function () {
      if (wrapOf(el) && wrapOf(el).classList.contains("is-invalid")) validateField(el);
    });
    el.addEventListener("blur", function () {
      if (el.value.trim() !== "") validateField(el);
    });
  });

  // Odkiaľ návštevník prišiel (?zdroj=mail v odkaze alebo doména webu, z ktorého klikol). Nič sa neukladá.
  var zdroj = (function () {
    var z = "";
    try {
      var q = new URLSearchParams(window.location.search);
      z = q.get("zdroj") || q.get("utm_source") || "";
      if (!z && document.referrer) {
        var h = new URL(document.referrer).hostname;
        if (h !== window.location.hostname) z = h;
      }
    } catch (err) { z = ""; }
    return z.slice(0, 60) || "priamo";
  })();

  function collect() {
    var f = form.elements;
    var sluzba = f.sluzba.options[f.sluzba.selectedIndex];
    return {
      "Meno": f.meno.value.trim(),
      "E-mail": f.email.value.trim(),
      "Telefón": f.telefon.value.trim() || "–",
      "E-shop": f.web.value.trim(),
      "Záujem": sluzba ? sluzba.text : "",
      "Poznámka": f.poznamka.value.trim() || "–",
      "Zdroj": zdroj
    };
  }

  function mailBody(data) {
    return Object.keys(data).map(function (k) { return k + ": " + data[k]; }).join("\r\n");
  }

  function buildMailto(data) {
    var head = "mailto:" + form.getAttribute("data-email") +
      "?subject=" + encodeURIComponent("Dopyt Okejo – " + data["E-shop"]) + "&body=";
    var url = head + encodeURIComponent(mailBody(data));
    if (url.length > 1800) { // dlhšie odkazy niektoré e-mailové programy neotvoria
      var short = {};
      Object.keys(data).forEach(function (k) { short[k] = data[k]; });
      short["Poznámka"] = "(dopíšte ju sem)";
      url = head + encodeURIComponent(mailBody(short));
    }
    return url;
  }

  var statusEl = $("#form-status");
  var success = $("#form-success");

  function showSuccess(data, mailto) {
    form.hidden = true;
    success.hidden = false;
    $("#fallback-link").setAttribute("href", mailto);
    $("#order-text").value = mailBody(data);
    $("#copy-order").textContent = "Kopírovať text";
    success.focus({ preventScroll: true });
    // bez "behavior": riadi sa CSS, ktoré pri obmedzení pohybu plynulé posúvanie vypína
    success.scrollIntoView({ block: "center" });
  }

  var copyBtn = $("#copy-order");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var ta = $("#order-text");
    var done = function () { copyBtn.textContent = "Skopírované"; };
    var fallback = function () {
      ta.focus();
      ta.select();
      try { if (document.execCommand("copy")) done(); } catch (err) { /* text ostane označený */ }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback);
    else fallback();
  });

  var editBtn = $("#edit-order");
  if (editBtn) editBtn.addEventListener("click", function () {
    success.hidden = true;
    form.hidden = false;
    form.elements.meno.focus();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.textContent = "";
    var bad = fields.filter(function (n) {
      var el = form.elements[n];
      return el && !validateField(el);
    });
    if (bad.length) {
      form.elements[bad[0]].focus();
      var slovo = bad.length === 1 ? "pole" : (bad.length < 5 ? "polia" : "polí");
      statusEl.textContent = "Dopyt sme neodoslali. Opravte " + bad.length + " " + slovo + ": " +
        bad.map(function (n) { return names[n]; }).join(", ") + ".";
      return;
    }
    var data = collect();
    if (form.elements.botcheck && form.elements.botcheck.checked) return; // robot
    var mailto = buildMailto(data);
    window.location.href = mailto;
    showSuccess(data, mailto);
  });
})();

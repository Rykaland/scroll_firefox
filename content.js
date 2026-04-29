(function () {
  if (window.__sb) { window.__sb.toggle(); return; }

  var speed        = 1.0;
  var active       = true;
  var raf;
  var settingsOpen = false;
  var dropdownOpen = false;
  var aboutOpen    = false;
  var capturingFor = null;
  var dragging     = false;
  var dragOffX = 0, dragOffY = 0, dragStartX = 0, dragStartY = 0;
  var savedLeft = null, savedTop = null;

  var shortcuts = { pause: null, up: 'ArrowUp', down: 'ArrowDown' };
  var lang = 'fr';

  var EDITABLE_TAGS  = { INPUT: 1, TEXTAREA: 1, SELECT: 1 };
  var MODIFIER_KEYS  = { Shift: 1, Control: 1, Alt: 1, Meta: 1 };

  var i18n = {
    fr: {
      title_down:    'Ralentir',      title_up:      'Accélérer',
      menu_settings: '⚙ Paramètres', menu_about:    'ℹ À propos',
      menu_close:    '✕ Fermer',      section_keys:  'Raccourcis clavier',
      label_pause:   'Pause/Reprise', label_up:      'Vitesse +',
      label_down:    'Vitesse −',     label_lang:    'Langue',
      reset:         'Réinitialiser', capturing:     'Appuie sur une touche…',
      click_default: 'Clic souris',   about_title:   'À propos',
      about_author:  'Auteur',        about_donate:  'Faire un don',
    },
    en: {
      title_down:    'Slow down',     title_up:      'Speed up',
      menu_settings: '⚙ Settings',   menu_about:    'ℹ About',
      menu_close:    '✕ Close',       section_keys:  'Keyboard shortcuts',
      label_pause:   'Pause/Resume',  label_up:      'Speed +',
      label_down:    'Speed −',       label_lang:    'Language',
      reset:         'Reset',         capturing:     'Press any key…',
      click_default: 'Mouse click',   about_title:   'About',
      about_author:  'Author',        about_donate:  'Make a donation',
    },
  };

  function t(k) { return (i18n[lang] || i18n.fr)[k] || k; }

  var KEY_LABELS = {
    Space: { fr: 'Espace', en: 'Space' }, ArrowUp: { fr: '↑', en: '↑' },
    ArrowDown: { fr: '↓', en: '↓' },     ArrowLeft: { fr: '←', en: '←' },
    ArrowRight: { fr: '→', en: '→' },    Enter: { fr: 'Entrée', en: 'Enter' },
    Escape: { fr: 'Échap', en: 'Escape' }, Tab: { fr: 'Tab', en: 'Tab' },
  };

  function keyLabel(code) {
    var e = KEY_LABELS[code];
    if (e) return e[lang] || e.fr;
    if (/^Key([A-Z])$/.test(code))  return code.slice(3);
    if (/^Digit(\d)$/.test(code))   return code.slice(5);
    if (/^Numpad(.+)$/.test(code))  return 'Num' + code.slice(6);
    return code;
  }

  var BTN = 'background:rgba(255,255,255,.18);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:14px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0';
  var KBTN = 'background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:6px;padding:2px 10px;cursor:pointer;font:12px/1.8 monospace;min-width:100px;text-align:center';
  var ITEM = 'display:block;width:100%;text-align:left;background:none;border:none;color:#ddd;padding:8px 14px;cursor:pointer;font:13px system-ui,sans-serif;white-space:nowrap';
  var XBTN = 'background:none;border:none;color:#f77;cursor:pointer;font-size:13px;padding:0;line-height:1';

  function mk(tag, css, id) {
    var el = document.createElement(tag);
    if (css) el.style.cssText = css;
    if (id)  el.id = id;
    return el;
  }
  function ap(parent) {
    for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]);
    return parent;
  }

  var panel = mk('div', 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:rgba(20,20,20,.9);color:#fff;padding:6px 10px;border-radius:20px;font:13px/1 system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.5);backdrop-filter:blur(6px);user-select:none;width:fit-content', '__sb');

  // Ligne principale
  var si = mk('span', 'font-size:15px;cursor:pointer', '__si');  si.textContent = '▶';
  var sd = mk('button', BTN, '__sd');                            sd.textContent = '−';
  var ss = mk('span', 'min-width:26px;text-align:center', '__ss');
  var su = mk('button', BTN, '__su');                            su.textContent = '+';

  var sg  = mk('button', ITEM, '__sg');
  var sa  = mk('button', ITEM, '__sa');
  var sc  = mk('button', ITEM + ';color:#f77', '__sc');
  var sdd = mk('div', 'display:none;position:absolute;bottom:calc(100% + 8px);right:0;background:rgba(20,20,20,.97);border:1px solid rgba(255,255,255,.12);border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.6);min-width:140px', '__sdd');
  ap(sdd, sg, sa, mk('div', 'height:1px;background:rgba(255,255,255,.08);margin:0 10px'), sc);

  var sm = mk('button', BTN, '__sm');  sm.title = 'Menu';  sm.textContent = '⋮';
  var sbmRow = mk('div', 'display:flex;align-items:center;gap:6px');
  var smWrap = mk('div', 'position:relative;flex-shrink:0');
  ap(smWrap, sm, sdd);
  ap(sbmRow, si, sd, ss, su, smWrap);

  // Panneau paramètres
  var sbt  = mk('div', 'font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px', '__sbt');
  var sp_x = mk('button', XBTN, '__sp_x');  sp_x.textContent = '✕';
  var lp   = mk('span', null, '__lp');
  var kp   = mk('button', KBTN, '__kp');
  var lu   = mk('span', null, '__lu');
  var ku   = mk('button', KBTN, '__ku');
  var ld   = mk('span', null, '__ld');
  var kd   = mk('button', KBTN, '__kd');
  var ll   = mk('span', null, '__ll');
  var lf   = mk('button', KBTN + ';min-width:0;flex:1', '__lf');  lf.textContent = '🇫🇷 FR';
  var le   = mk('button', KBTN + ';min-width:0;flex:1', '__le');  le.textContent = '🇬🇧 EN';
  var kr   = mk('button', 'margin-top:10px;width:100%;background:rgba(255,255,255,.08);border:none;color:#aaa;border-radius:8px;padding:4px 0;cursor:pointer;font-size:11px', '__kr');
  var grid = mk('div', 'display:grid;grid-template-columns:auto 1fr;gap:6px 12px;align-items:center;font-size:12px;color:#ccc');
  ap(grid, lp, kp, lu, ku, ld, kd, ll, ap(mk('div', 'display:flex;gap:6px'), lf, le));
  var sbp = mk('div', 'display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)', '__sbp');
  ap(sbp, ap(mk('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px'), sbt, sp_x), grid, kr);

  // Panneau à propos
  var abt   = mk('div', 'font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px', '__abt');
  var ab_x  = mk('button', XBTN, '__ab_x');   ab_x.textContent = '✕';
  var ab_al = mk('span', 'color:#888', '__ab_al');
  var ab_dl = mk('span', 'color:#888', '__ab_dl');
  var ryka  = mk('span');  ryka.textContent = 'Rykaland';
  var ab_da = mk('a', 'color:#7c6af7;text-decoration:none', '__ab_da');
  ab_da.href = 'https://buymeacoffee.com/rykaland';
  ab_da.target = '_blank';
  ab_da.rel = 'noopener noreferrer';
  ab_da.textContent = 'buymeacoffee';
  var abGrid = mk('div', 'display:grid;grid-template-columns:auto 1fr;gap:2px 12px');
  ap(abGrid, ab_al, ryka, ab_dl, ab_da);
  var sbab = mk('div', 'display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12);font-size:12px;color:#ccc;line-height:2', '__sbab');
  ap(sbab, ap(mk('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px'), abt, ab_x), abGrid);

  ap(panel, sbmRow, sbp, sbab);
  document.body.appendChild(panel);

  var $ = {
    __si: si,   __sd: sd,   __ss: ss,   __su: su,   __sm: sm,   __sdd: sdd,
    __sg: sg,   __sa: sa,   __sc: sc,   __sbp: sbp, __sbt: sbt, __sp_x: sp_x,
    __lp: lp,   __lu: lu,   __ld: ld,   __ll: ll,   __kp: kp,   __ku: ku,
    __kd: kd,   __lf: lf,   __le: le,   __kr: kr,   __sbab: sbab,
    __abt: abt, __ab_x: ab_x, __ab_al: ab_al, __ab_dl: ab_dl,
  };

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    $.__sdd.style.display = dropdownOpen ? 'block' : 'none';
    $.__sm.style.background = dropdownOpen ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.18)';
  }

  function closeDropdown() {
    if (!dropdownOpen) return;
    dropdownOpen = false;
    $.__sdd.style.display = 'none';
    $.__sm.style.background = 'rgba(255,255,255,.18)';
  }

  function updateUI() {
    $.__si.textContent = active ? '▶' : '⏸';
    $.__ss.textContent = speed.toFixed(1);
    $.__sd.title       = t('title_down');
    $.__su.title       = t('title_up');
    $.__sg.textContent = t('menu_settings');
    $.__sa.textContent = t('menu_about');
    $.__sc.textContent = t('menu_close');
    $.__ab_al.textContent = t('about_author');
    $.__ab_dl.textContent = t('about_donate');
    $.__abt.textContent   = t('about_title');
  }

  function renderSettings() {
    $.__sbt.textContent = t('section_keys');
    $.__lp.textContent  = t('label_pause');
    $.__lu.textContent  = t('label_up');
    $.__ld.textContent  = t('label_down');
    $.__ll.textContent  = t('label_lang');
    $.__kr.textContent  = t('reset');
    renderShortcutLabels();
    $.__lf.style.borderColor = lang === 'fr' ? '#7c6af7' : 'rgba(255,255,255,.25)';
    $.__le.style.borderColor = lang === 'en' ? '#7c6af7' : 'rgba(255,255,255,.25)';
  }

  function renderShortcutLabels() {
    for (var f in KB_IDS) {
      var btn = $[KB_IDS[f]];
      if (!btn || capturingFor === f) continue;
      btn.textContent   = shortcuts[f] ? keyLabel(shortcuts[f]) : t('click_default');
      btn.style.opacity = shortcuts[f] ? '1' : '.55';
    }
  }

  function toggle() { active = !active; updateUI(); }

  function destroy() {
    cancelAnimationFrame(raf);
    panel.remove();
    document.removeEventListener('click',   onDocClick);
    document.removeEventListener('keydown', onKey);
    delete window.__sb;
  }

  function toggleSettings() {
    if (aboutOpen) toggleAbout();
    settingsOpen = !settingsOpen;
    $.__sbp.style.display = settingsOpen ? 'block' : 'none';
    if (settingsOpen) renderSettings();
  }

  function toggleAbout() {
    if (settingsOpen) toggleSettings();
    aboutOpen = !aboutOpen;
    $.__sbab.style.display = aboutOpen ? 'block' : 'none';
  }

  var KB_IDS = { pause: '__kp', up: '__ku', down: '__kd' };

  function startCapture(field) {
    if (capturingFor) finishCapture(null);
    capturingFor = field;
    var btn = $[KB_IDS[field]];
    if (btn) {
      btn.textContent       = t('capturing');
      btn.style.borderColor = '#7c6af7';
      btn.style.color       = '#7c6af7';
    }
  }

  function finishCapture(code) {
    if (!capturingFor) return;
    var field = capturingFor;
    capturingFor = null;
    if (code !== null) { shortcuts[field] = code || null; save(); }
    var btn = $[KB_IDS[field]];
    if (btn) { btn.style.borderColor = ''; btn.style.color = ''; }
    renderShortcutLabels();
  }

  function resetShortcuts() {
    shortcuts = { pause: null, up: 'ArrowUp', down: 'ArrowDown' };
    save();
    renderSettings();
  }

  function setLang(l) {
    lang = l;
    save();
    updateUI();
    if (settingsOpen) renderSettings();
  }

  var STORE_KEY = 'wbs';

  function save() {
    var data = {};
    data[STORE_KEY] = {
      shortcuts: shortcuts,
      lang: lang,
      speed: speed,
      pos: savedLeft !== null ? { left: savedLeft, top: savedTop } : null,
    };
    try { browser.storage.local.set(data); } catch (e) {}
  }

  function load(cb) {
    try {
      browser.storage.local.get(STORE_KEY).then(function (r) {
        var s = r[STORE_KEY];
        if (s) {
          if (s.shortcuts && typeof s.shortcuts === 'object') {
            ['pause', 'up', 'down'].forEach(function (k) {
              if (k in s.shortcuts) shortcuts[k] = s.shortcuts[k];
            });
          }
          if (s.lang === 'fr' || s.lang === 'en') lang = s.lang;
          if (typeof s.speed === 'number') speed = Math.min(8, Math.max(0.1, s.speed));
          if (s.pos && typeof s.pos.left === 'number' && typeof s.pos.top === 'number')
            applyPos(s.pos.left, s.pos.top);
        }
        cb();
      }).catch(cb);
    } catch (e) { cb(); }
  }

  function applyPos(left, top) {
    left = Math.max(0, Math.min(window.innerWidth  - panel.offsetWidth,  left));
    top  = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, top));
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left   = left + 'px';
    panel.style.top    = top  + 'px';
    savedLeft = left;
    savedTop  = top;
  }

  function onDragMove(e) {
    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;
    if (!dragging && Math.abs(dx) + Math.abs(dy) > 4) {
      dragging = true;
      panel.style.cursor = 'grabbing';
    }
    if (dragging) applyPos(e.clientX - dragOffX, e.clientY - dragOffY);
  }

  function onDragEnd() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup',   onDragEnd);
    panel.style.cursor = 'grab';
    if (dragging) { dragging = false; save(); }
  }

  panel.style.cursor = 'grab';
  panel.addEventListener('mousedown', function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
    var rect = panel.getBoundingClientRect();
    dragOffX   = e.clientX - rect.left;
    dragOffY   = e.clientY - rect.top;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left   = rect.left + 'px';
    panel.style.top    = rect.top  + 'px';
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup',   onDragEnd);
  });

  function onDocClick(e) {
    if (e.target.closest('#__sb')) return;
    if (dropdownOpen) { closeDropdown(); return; }
    if (capturingFor) { finishCapture(null); return; }
    toggle();
  }

  function onKey(e) {
    if (EDITABLE_TAGS[e.target.tagName]) return;
    if (capturingFor) {
      if (MODIFIER_KEYS[e.key]) return;
      e.preventDefault();
      e.stopPropagation();
      finishCapture(e.code === 'Escape' ? null : e.code);
      return;
    }
    var code = e.code;
    if      (shortcuts.pause && code === shortcuts.pause) { e.preventDefault(); toggle(); }
    else if (shortcuts.up    && code === shortcuts.up)    { e.preventDefault(); speed = Math.min(8.0, +(speed + 0.1).toFixed(1)); updateUI(); save(); }
    else if (shortcuts.down  && code === shortcuts.down)  { e.preventDefault(); speed = Math.max(0.1, +(speed - 0.1).toFixed(1)); updateUI(); save(); }
  }

  $.__si.addEventListener('click',    function (e) { e.stopPropagation(); toggle(); });
  $.__sd.addEventListener('click',    function (e) { e.stopPropagation(); speed = Math.max(0.1, +(speed - 0.1).toFixed(1)); updateUI(); save(); });
  $.__su.addEventListener('click',    function (e) { e.stopPropagation(); speed = Math.min(8.0, +(speed + 0.1).toFixed(1)); updateUI(); save(); });
  $.__sm.addEventListener('click',    function (e) { e.stopPropagation(); toggleDropdown(); });
  $.__sg.addEventListener('click',    function (e) { e.stopPropagation(); closeDropdown(); toggleSettings(); });
  $.__sa.addEventListener('click',    function (e) { e.stopPropagation(); closeDropdown(); toggleAbout(); });
  $.__sc.addEventListener('click',    function (e) { e.stopPropagation(); destroy(); });
  $.__sp_x.addEventListener('click',  function (e) { e.stopPropagation(); toggleSettings(); });
  $.__ab_x.addEventListener('click',  function (e) { e.stopPropagation(); toggleAbout(); });
  $.__kp.addEventListener('click',    function (e) { e.stopPropagation(); startCapture('pause'); });
  $.__ku.addEventListener('click',    function (e) { e.stopPropagation(); startCapture('up'); });
  $.__kd.addEventListener('click',    function (e) { e.stopPropagation(); startCapture('down'); });
  $.__lf.addEventListener('click',    function (e) { e.stopPropagation(); setLang('fr'); });
  $.__le.addEventListener('click',    function (e) { e.stopPropagation(); setLang('en'); });
  $.__kr.addEventListener('click',    function (e) { e.stopPropagation(); resetShortcuts(); });

  ['__sg', '__sa', '__sc'].forEach(function (id) {
    $[id].addEventListener('mouseenter', function () { $[id].style.background = 'rgba(255,255,255,.08)'; });
    $[id].addEventListener('mouseleave', function () { $[id].style.background = 'none'; });
  });

  document.addEventListener('click',   onDocClick);
  document.addEventListener('keydown', onKey);

  function tick() {
    if (active) window.scrollBy(0, speed);
    raf = requestAnimationFrame(tick);
  }

  load(function () {
    updateUI();
    tick();
    window.__sb = { toggle: toggle };
  });
})();
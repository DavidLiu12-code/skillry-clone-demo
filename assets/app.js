/* Skillry clone — interaction layer.
   The captured DOM is the original server-rendered markup; this file only adds the
   behaviour the original app hydrated on top of it (menus, dialogs, filters,
   favourites, countdowns) so nothing visible has to be rebuilt. */
(function () {
  'use strict';

  var APP = document.querySelector('skillry-app');
  if (!APP) return;
  var BASE = APP.getAttribute('data-base') || '';
  var LS = window.localStorage;
  var SS = window.sessionStorage;

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function url(p) { return /^https?:/.test(p || '') ? p : BASE + p; }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts || false); }
  function safeGet(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function safeSet(store, key, val) { try { store.setItem(key, val); } catch (e) {} }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function compact(n) {
    if (n == null) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10000) return Math.round(n / 1000) + 'K';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var OUTPUT_LABEL = { video: 'Video', presentation: 'Slides', html: 'Web', image: 'Image' };

  /* ------------------------------------------------------------------ theme */
  var THEME_KEY = 'theme';
  function currentTheme() { return safeGet(LS, THEME_KEY) || 'system'; }
  function resolved(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(mode) {
    var r = resolved(mode);
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(r);
    root.style.colorScheme = r;
    safeSet(LS, THEME_KEY, mode);
    qa('[data-skillry-theme-option]').forEach(function (b) {
      b.setAttribute('data-active', String(b.getAttribute('data-value') === mode));
    });
    syncThemeIcon(r);
  }
  function syncThemeIcon(r) {
    var btn = q('[aria-label="Toggle theme"]');
    if (!btn) return;
    qa('svg', btn).forEach(function (svg, i) {
      svg.style.display = i === 0 ? (r === 'dark' ? 'none' : '') : '';
      if (i > 0) svg.style.display = r === 'dark' ? '' : 'none';
    });
  }
  function initTheme() {
    var host = q('[aria-label="Toggle theme"]');
    if (!host) return;
    var svgs = qa('svg', host);
    if (svgs.length === 1) {
      var moon = svgs[0].cloneNode(true);
      moon.classList.remove('tabler-icon-sun');
      moon.classList.add('tabler-icon-moon');
      moon.innerHTML = '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"></path>';
      host.appendChild(moon);
    }
    syncThemeIcon(resolved(currentTheme()));
    on(host, 'click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openMenu(host, [
        { label: 'Light', value: 'light', theme: true },
        { label: 'Dark', value: 'dark', theme: true },
        { label: 'System', value: 'system', theme: true }
      ], currentTheme());
    });
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () { if (currentTheme() === 'system') applyTheme('system'); });
  }

  /* ---------------------------------------------------------------- popovers */
  var openPopover = null;
  function closePopover() {
    if (!openPopover) return;
    openPopover.remove();
    openPopover = null;
  }
  document.addEventListener('click', function (e) {
    if (openPopover && !openPopover.contains(e.target)) closePopover();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopover(); });

  function openMenu(trigger, items, activeValue) {
    var wasOpen = openPopover && openPopover.getAttribute('data-for') === trigger.id;
    closePopover();
    if (wasOpen) return null;
    if (!trigger.id) trigger.id = 'menu-' + Math.random().toString(36).slice(2, 8);
    var panel = el('div',
      'absolute z-50 min-w-[190px] rounded-2xl border border-black/10 bg-[#fffdf8] p-1.5 shadow-[0_24px_60px_rgba(18,19,19,0.18)] dark:border-white/12 dark:bg-[#1b1b18] dark:shadow-[0_24px_60px_rgba(0,0,0,0.5)]');
    panel.setAttribute('data-for', trigger.id);
    items.forEach(function (item) {
      var node = el(item.href ? 'a' : 'button', 'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-black/70 transition-colors hover:bg-black/[0.055] dark:text-white/72 dark:hover:bg-white/[0.07]');
      if (item.href) node.setAttribute('href', item.href);
      else node.setAttribute('type', 'button');
      node.innerHTML = item.label;
      if (item.theme) {
        node.setAttribute('data-skillry-theme-option', '');
        node.setAttribute('data-value', item.value);
        if (item.value === activeValue) node.setAttribute('data-active', 'true');
        on(node, 'click', function () { applyTheme(item.value); closePopover(); });
      }
      panel.appendChild(node);
    });
    document.body.appendChild(panel);
    var r = trigger.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.top = Math.round(r.bottom + 8) + 'px';
    panel.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - panel.offsetWidth - 12))) + 'px';
    openPopover = panel;
    return panel;
  }

  /* ------------------------------------------------------------ promo banner */
  function initPromo() {
    var banner = q('[data-testid="pro-plan-banner"]');
    if (!banner) return;
    var dismiss = q('[data-testid="pro-plan-banner-dismiss"]', banner);
    on(dismiss, 'click', function () {
      document.documentElement.setAttribute('data-hide-promo-banner', '');
      safeSet(SS, 'skillry:banner:pro-plan:session', 'hidden');
      safeSet(LS, 'skillry:banner:pro-plan:day', dayKey());
    });
  }

  /* --------------------------------------------------------------- countdown */
  function midnight() {
    var d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }
  function pad(n) { return ('0' + n).slice(-2); }
  function initCountdowns() {
    var nodes = qa('[data-testid="pro-plan-banner-countdown"], [data-testid="black-friday-pricing-countdown"]');
    if (!nodes.length) return;
    function tick() {
      var left = Math.max(0, midnight() - Date.now());
      var h = Math.floor(left / 3600000);
      var m = Math.floor((left % 3600000) / 60000);
      var s = Math.floor((left % 60000) / 1000);
      nodes.forEach(function (n) {
        var spans = qa('span', n).filter(function (sp) { return /^\d{1,2}$/.test(sp.textContent.trim()); });
        if (spans.length >= 3) {
          spans[0].textContent = pad(h);
          spans[1].textContent = pad(m);
          spans[2].textContent = pad(s);
        } else {
          n.textContent = pad(h) + ' : ' + pad(m) + ' : ' + pad(s);
        }
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* --------------------------------------------------------- header controls */
  var NAV_ITEMS = {
    'desktop-categories-trigger': function () { return [
      { label: 'All Skills', href: url('/skills/') },
      { label: 'Web', href: url('/skills/?output=html') },
      { label: 'Slides', href: url('/skills/?output=presentation') },
      { label: 'Video', href: url('/skills/?output=video') },
      { label: 'Image', href: url('/skills/?output=image') },
      { label: 'Free Skills', href: url('/skills/?free=true') },
      { label: 'Featured', href: url('/skills/?featured=true') }
    ]; },
    'desktop-ai-videos-trigger': function () { return [
      { label: 'All AI videos', href: url('/skills/?output=video') },
      { label: 'Launch films', href: url('/skills/task/build-landing-page/') },
      { label: 'Explainers', href: url('/skills/?task=create-explainer-video') },
      { label: 'Social clips', href: url('/skills/?task=create-social-brand-video') },
      { label: 'Trending videos', href: url('/skills/?output=video&sort=trending') }
    ]; },
    'desktop-resources-trigger': function () { return [
      { label: 'Learn', href: url('/learn/') },
      { label: 'Skillry MCP', href: url('/mcp/') },
      { label: 'MCP reference', href: url('/learn/reference/skillry-mcp/') },
      { label: 'Affiliate program', href: url('/affiliate/') },
      { label: 'Pricing', href: url('/pricing/') }
    ]; }
  };

  function initNavMenus() {
    Object.keys(NAV_ITEMS).forEach(function (testid) {
      var trigger = q('[data-testid="' + testid + '"]');
      if (!trigger) return;
      on(trigger, 'click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!open));
        if (open) { closePopover(); return; }
        openMenu(trigger, NAV_ITEMS[testid]());
      });
    });

    var lang = q('[aria-label="language"]');
    on(lang, 'click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openMenu(lang, [
        { label: 'English', href: url('/') },
        { label: '简体中文', href: url('/zh/') },
        { label: '日本語', href: url('/ja/') },
        { label: '한국어', href: url('/ko/') },
        { label: 'Español', href: url('/es/') },
        { label: 'Português (BR)', href: url('/pt-br/') },
        { label: 'Deutsch', href: url('/de/') },
        { label: 'Français', href: url('/fr/') }
      ]);
    });
  }

  /* ----------------------------------------------------------------- dialogs */
  var dialog = null;
  function closeDialog() {
    if (!dialog) return;
    dialog.remove();
    dialog = null;
    document.body.style.overflow = '';
  }
  function openDialog(node) {
    closeDialog();
    dialog = el('div', 'fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[10vh] backdrop-blur-[2px]');
    dialog.setAttribute('data-skillry-dialog', '');
    dialog.appendChild(node);
    document.body.appendChild(dialog);
    document.body.style.overflow = 'hidden';
    on(dialog, 'click', function (e) { if (e.target === dialog) closeDialog(); });
    on(document, 'keydown', function (e) { if (e.key === 'Escape') closeDialog(); });
    return dialog;
  }
  function panel(extra) {
    return el('div', 'w-full max-w-[640px] overflow-hidden rounded-[24px] border border-black/10 bg-[#fffdf8] shadow-[0_40px_120px_rgba(18,19,19,0.35)] dark:border-white/12 dark:bg-[#1b1b18] ' + (extra || ''));
  }

  var indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(url('/data/skills.json'), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    }
    return indexPromise;
  }
  var metaPromise = null;
  function loadMeta() {
    if (!metaPromise) {
      metaPromise = fetch(url('/data/meta.json'), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { agentIcons: {}, toolIcons: {}, badges: {} }; })
        .catch(function () { return { agentIcons: {}, toolIcons: {}, badges: {} }; });
    }
    return metaPromise;
  }

  /* ------------------------------------------------------------ search dialog */
  function initSearch() {
    var triggers = qa('[data-testid="storefront-home-search"], [data-testid="skills-directory-search-header"]');
    if (!triggers.length) return;
    triggers.forEach(function (t) { on(t, 'click', function (e) { e.preventDefault(); e.stopPropagation(); showSearch(); }); });
    on(document, 'keydown', function (e) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); showSearch(); }
    });
  }
  function showSearch() {
    var box = panel();
    box.innerHTML =
      '<div class="flex items-center gap-3 border-b border-black/8 px-5 py-4 dark:border-white/10">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-search size-4 shrink-0 text-black/40 dark:text-white/45"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path><path d="M21 21l-6 -6"></path></svg>' +
      '<input type="search" autocomplete="off" spellcheck="false" placeholder="What do you want to create?" class="w-full bg-transparent text-[15px] outline-none placeholder:text-black/35 dark:placeholder:text-white/40">' +
      '<kbd class="hidden shrink-0 rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] text-black/40 sm:block dark:border-white/15 dark:text-white/40">Esc</kbd>' +
      '</div><div data-skillry-search-results class="max-h-[52vh] overflow-y-auto p-2"></div>' +
      '<div class="border-t border-black/8 px-5 py-3 text-[11px] text-black/40 dark:border-white/10 dark:text-white/40">Search every Skill in the catalogue by name or by what it makes</div>';
    openDialog(box);
    var input = q('input', box);
    var results = q('[data-skillry-search-results]', box);
    var active = 0;
    var rows = [];
    function paint(list) {
      rows = list;
      active = 0;
      if (!list.length) {
        results.innerHTML = '<p class="px-3 py-6 text-center text-sm text-black/45 dark:text-white/45">No Skills matched that search.</p>';
        return;
      }
      results.innerHTML = list.map(function (s, i) {
        return '<a data-skillry-result="' + i + '" href="' + url('/skills/' + s.s + '/') + '" class="flex items-center gap-3 rounded-xl px-3 py-2.5 ' + (i === 0 ? 'bg-black/[0.055] dark:bg-white/[0.07]' : '') + '">' +
          '<span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-black/10 bg-[#f7f7f5] dark:border-white/12"><img src="' + url(s.p) + '" alt="" class="size-full object-cover" loading="lazy"></span>' +
          '<span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-medium">' + esc(s.n) + '</span>' +
          '<span class="block truncate text-[11px] text-black/45 dark:text-white/45">' + esc(OUTPUT_LABEL[s.o] || s.o) + ' · ' + compact(s.d) + ' installs</span></span>' +
          '<span class="shrink-0 text-[10px] uppercase tracking-wide text-black/35 dark:text-white/35">' + (s.pr === 0 ? 'Free' : '$' + (s.pr / 100).toFixed(2)) + '</span></a>';
      }).join('');
    }
    function search(term) {
      loadIndex().then(function (all) {
        var t = term.trim().toLowerCase();
        var list = !t ? all.slice(0, 8) : all.filter(function (s) {
          return s.n.toLowerCase().indexOf(t) >= 0 || (s.ds || '').toLowerCase().indexOf(t) >= 0;
        }).slice(0, 24);
        paint(list);
      });
    }
    search('');
    on(input, 'input', function () { search(input.value); });
    on(input, 'keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!rows.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
        qa('[data-skillry-result]', results).forEach(function (a, i) {
          a.classList.toggle('bg-black/[0.055]', i === active);
          a.classList.toggle('dark:bg-white/[0.07]', i === active);
        });
      } else if (e.key === 'Enter' && rows[active]) {
        window.location.href = url('/skills/' + rows[active].s + '/');
      }
    });
    setTimeout(function () { input.focus(); }, 30);
  }

  /* ------------------------------------------------------------ mobile sheet */
  function initMobileMenu() {
    var trigger = q('[data-testid="mobile-categories-trigger"]');
    if (!trigger) return;
    on(trigger, 'click', function (e) {
      e.preventDefault();
      var sheet = el('div', 'fixed inset-0 z-[100] flex items-end bg-black/45');
      var body = el('div', 'max-h-[85dvh] w-full overflow-y-auto rounded-t-[24px] border-t border-black/10 bg-[#f7f4ec] px-4 pb-6 pt-3 dark:border-white/12 dark:bg-[#1b1b18]');
      body.innerHTML =
        '<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20"></div>' +
        navGroup('Skills', [['All Skills', '/skills/'], ['Web', '/skills/?output=html'], ['Slides', '/skills/?output=presentation'], ['Video', '/skills/?output=video'], ['Image', '/skills/?output=image']]) +
        navGroup('Explore', [['Pricing', '/pricing/'], ['Learn', '/learn/'], ['Skillry MCP', '/mcp/'], ['Affiliate', '/affiliate/']]) +
        '<a href="' + url('/skills/') + '" class="mt-4 flex h-11 items-center justify-center rounded-full bg-[#121313] text-sm font-semibold text-white dark:bg-[#f4ff71] dark:text-[#121313]">Browse Skills</a>';
      sheet.appendChild(body);
      document.body.appendChild(sheet);
      document.body.style.overflow = 'hidden';
      on(sheet, 'click', function (ev) {
        if (ev.target === sheet || ev.target.closest('a')) {
          sheet.remove();
          document.body.style.overflow = '';
        }
      });
    });
  }
  function navGroup(title, items) {
    return '<p class="px-2 pb-1.5 pt-3 text-[11px] font-semibold text-black/40 dark:text-white/42">' + title + '</p><div class="flex flex-col">' +
      items.map(function (it) {
        return '<a href="' + url(it[1]) + '" class="rounded-lg px-2 py-2 text-[14px] text-black/70 hover:bg-black/[0.055] dark:text-white/72 dark:hover:bg-white/[0.07]">' + it[0] + '</a>';
      }).join('') + '</div>';
  }

  /* ----------------------------------------------------------- collect state */
  var FAV_KEY = 'skillry:favorites';
  var SAVE_KEY = 'skillry:bookmarks';
  function readSet(key) {
    try { return new Set(JSON.parse(safeGet(LS, key) || '[]')); } catch (e) { return new Set(); }
  }
  function writeSet(key, set) { safeSet(LS, key, JSON.stringify(Array.from(set))); }

  function skillSlugFor(node) {
    var card = node.closest('[data-testid="directory-skill-card"], article[data-testid="skill-card"]');
    var link = card && card.querySelector('a[href*="/skills/"]');
    if (link) {
      var m = link.getAttribute('href').match(/\/skills\/([^/?#]+)/);
      if (m) return m[1];
    }
    var crumb = q('[data-testid="skill-detail-breadcrumb"] a:last-of-type');
    if (crumb && crumb.getAttribute('href')) {
      var mm = crumb.getAttribute('href').match(/\/skills\/([^/?#]+)/);
      if (mm) return mm[1];
    }
    return '';
  }

  function pulse(node) {
    node.style.transition = 'transform 140ms ease';
    node.style.transform = 'scale(1.16)';
    setTimeout(function () { node.style.transform = ''; }, 150);
  }

  function initCollect() {
    var favs = readSet(FAV_KEY);
    var saves = readSet(SAVE_KEY);
    function wire(testid, set, key) {
      qa('[data-testid="' + testid + '"]').forEach(function (btn) {
        if (btn.getAttribute('data-skillry-wired')) return;
        btn.setAttribute('data-skillry-wired', '1');
        var slug = skillSlugFor(btn);
        if (slug && set.has(slug)) {
          btn.setAttribute('data-active', 'true');
          btn.setAttribute('aria-pressed', 'true');
        }
        on(btn, 'click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var s = skillSlugFor(btn);
          if (!s) return;
          if (set.has(s)) set.delete(s); else set.add(s);
          writeSet(key, set);
          var active = set.has(s);
          btn.setAttribute('data-active', String(active));
          btn.setAttribute('aria-pressed', String(active));
          pulse(btn);
        });
      });
    }
    wire('skill-like-button', favs, FAV_KEY);
    wire('skill-bookmark-button', saves, SAVE_KEY);
  }

  /* --------------------------------------------------------------- sign-in UI */
  function initAccount() {
    qa('button').forEach(function (btn) {
      if (btn.textContent.trim() !== 'Sign In') return;
      on(btn, 'click', function (e) {
        e.preventDefault();
        var box = panel('max-w-[440px]');
        box.innerHTML = '<div class="px-6 pb-6 pt-5">' +
          '<h2 class="text-[20px] font-semibold tracking-[-0.01em]">Sign in</h2>' +
          '<p class="mt-2 text-sm leading-6 text-black/60 dark:text-white/62">This copy of skillry.dev is a static archive: accounts, checkout and installs stay on the original site. The catalogue, filters, previews and every page here work offline.</p>' +
          '<a href="https://skillry.dev/" class="mt-5 flex h-10 items-center justify-center rounded-full bg-[#121313] text-sm font-semibold text-white dark:bg-[#f4ff71] dark:text-[#121313]">Open skillry.dev</a>' +
          '<button type="button" data-skillry-close class="mt-2 flex h-10 w-full items-center justify-center rounded-full border border-black/12 text-sm font-semibold dark:border-white/15">Stay here</button>' +
          '</div>';
        openDialog(box);
        on(q('[data-skillry-close]', box), 'click', closeDialog);
      });
    });
  }

  /* ------------------------------------------------------------- skill detail */
  function initDetail() {
    var page = q('[data-testid="skill-detail-page"]');
    if (!page) return;
    qa('[data-testid="skill-detail-buy"], [data-testid="skill-detail-subscribe"]').forEach(function (btn) {
      on(btn, 'click', function (e) {
        e.preventDefault();
        window.location.href = url('/pricing/');
      });
    });
    qa('[data-testid="skill-demo-fullscreen"]').forEach(function (btn) {
      on(btn, 'click', function (e) {
        e.preventDefault();
        var fig = btn.closest('figure');
        var media = fig && fig.querySelector('img, video');
        if (!media) return;
        var src = media.currentSrc || media.src;
        var box = el('div', 'w-full max-w-[1200px]');
        box.innerHTML = '<img src="' + src + '" alt="" class="w-full rounded-2xl">';
        openDialog(box);
      });
    });
    qa('[data-copy]').forEach(function (btn) {
      on(btn, 'click', function () {
        var text = btn.getAttribute('data-copy') || '';
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
        var old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = old; }, 1200);
      });
    });
  }

  /* ------------------------------------------------------------------ listing */
  var ICON_HEART = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-heart"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"></path></svg>';
  var ICON_BOOKMARK = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-bookmark"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4"></path></svg>';
  var ICON_BOOKMARK_SM = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-bookmark size-3" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4"></path></svg>';
  var ICON_DOWNLOAD = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-download size-3" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"></path><path d="M7 11l5 5l5 -5"></path><path d="M12 4l0 12"></path></svg>';

  var LISTING_META = null;

  function collectButton(label, testid, icon) {
    return '<button type="button" data-slot="button" aria-label="' + label + '" aria-pressed="false" title="' + label + '" data-testid="' + testid + '" data-active="false" class="group/button shrink-0 items-center justify-center bg-clip-padding text-sm font-semibold whitespace-nowrap outline-none select-none hover:text-foreground border-black/10 hover:bg-[#f4ff71] dark:border-white/12 dark:hover:bg-[#f4ff71] dark:hover:text-[#121313] bg-white/50 shadow-[0_3px_10px_rgba(17,18,18,.10)] backdrop-blur-md dark:bg-black/45 dark:shadow-[0_3px_10px_rgba(0,0,0,.30)] hidden size-7 rounded-full border-0 text-[#121313] dark:text-white transition-transform duration-150 hover:scale-110 group-hover:inline-flex group-focus-within:inline-flex [@media(hover:none)]:inline-flex [&_svg]:size-[15px]">' + icon + '</button>';
  }

  function cardHtml(s, i) {
    var meta = LISTING_META || { agentIcons: {}, toolIcons: {}, badges: {} };
    var poster = s.p ? url(s.p) : '';
    var label = OUTPUT_LABEL[s.o] || s.o;
    var badge = (meta.badges && (meta.badges[label] || meta.badges[s.o])) || null;
    var badgeSvg = badge && badge.svg
      ? badge.svg.replace(/^<svg/, '<svg class="tabler-icon size-3.5"')
      : '<svg class="tabler-icon size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"></svg>';
    var agents = (s.al || []).slice(0, 3).map(function (slug, idx) {
      var src = meta.agentIcons && meta.agentIcons[slug];
      if (!src) return '';
      var name = (s.a || [])[idx] || '';
      return '<span title="' + esc(name) + '" data-testid="skill-card-tool-logo" class="-ml-1 grid size-4 shrink-0 place-items-center rounded-full border border-black/15 bg-[#f4f1e9] first:ml-0 dark:border-white/15 dark:bg-[#242420]">' +
        '<img src="' + url(src) + '" alt="' + esc(name) + '" width="10" height="10" loading="lazy" class="size-2.5"></span>';
    }).join('');
    var rest = (s.al || []).length - 3;
    var more = rest > 0
      ? '<span class="-ml-1 grid size-4 shrink-0 place-items-center rounded-full border border-black/15 bg-[#f4f1e9] first:ml-0 dark:border-white/15 dark:bg-[#242420] text-[8px] font-semibold tabular-nums text-black/45 dark:text-white/50">+' + rest + '</span>'
      : '';
    var marks = (s.tl || []).map(function (tool) {
      var src = meta.toolIcons && meta.toolIcons[tool];
      if (!src) return '';
      return '<span title="' + esc(tool) + '" data-testid="skill-card-skill-mark" class="-ml-1 grid size-4 shrink-0 place-items-center rounded-full border border-black/15 bg-[#f4f1e9] first:ml-0 dark:border-white/15 dark:bg-[#242420]">' +
        '<img src="' + src + '" alt="' + esc(tool) + '" width="10" height="10" loading="lazy" class="size-2.5"></span>';
    }).join('');
    var captions = (agents || more || marks)
      ? '<span class="ml-auto flex shrink-0 items-center"><span class="flex shrink-0 items-center gap-1" data-testid="skill-card-tool-logos"><span class="flex items-center">' + agents + more + '</span>' +
        (marks ? '<span aria-hidden="true" class="text-[10px] text-black/30 dark:text-white/35">+</span><span class="flex items-center">' + marks + '</span>' : '') +
        '</span></span>'
      : '';

    return '<div class="min-w-0 [contain-intrinsic-size:auto_240px] [content-visibility:auto]" data-testid="directory-skill-card" data-skill-free="' + (s.pr === 0) + '">' +
      '<div class="group h-full"><article data-testid="skill-card" class="relative flex h-full flex-col transition-transform duration-300 group-hover:-translate-y-1 group-focus-within:-translate-y-1">' +
      '<a rel="noopener" href="' + url('/skills/' + s.s + '/') + '" class="flex flex-1 flex-col rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 dark:focus-visible:ring-white">' +
      '<div class="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/12">' +
      '<div class="skill-preview-carousel group/media relative isolate overflow-hidden bg-[#f7f7f5] skill-preview-loading-surface aspect-video" data-image-count="1" data-active-index="0" data-media-ready="true">' +
      '<img src="' + poster + '" alt="' + esc(s.pa || s.n) + '" class="absolute inset-0 size-full object-cover skill-preview-carousel-image pointer-events-none transition-opacity duration-[350ms] ease-in-out z-10 opacity-100" style="object-position:' + (s.f || '50% 50%') + '" width="1280" height="720" loading="' + (i < 8 ? 'eager' : 'lazy') + '" decoding="async">' +
      '<div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5 transition-opacity duration-300 opacity-0" data-preview-scrim="true"></div></div>' +
      (s.pr === 0 ? '<span data-testid="skill-card-free" class="absolute left-2.5 top-2.5 z-20 inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold uppercase leading-none tracking-[0.015em] shadow-[0_3px_10px_rgba(17,18,18,.12)] border-black/15 bg-[#f4ff71] text-[#121313]">Free</span>' : '') +
      '<span data-testid="skill-card-output" title="' + esc(label) + '" class="bg-white/50 shadow-[0_3px_10px_rgba(17,18,18,.10)] backdrop-blur-md dark:bg-black/45 dark:shadow-[0_3px_10px_rgba(0,0,0,.30)] absolute right-2.5 top-2.5 z-10 grid size-6 place-items-center rounded-full text-black/60 dark:text-white/80 transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:opacity-0">' + badgeSvg + '<span class="sr-only">' + esc(label) + '</span></span>' +
      '<span aria-hidden="true" class="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-16 bg-[linear-gradient(to_top,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.6)_32%,rgba(0,0,0,0)_100%)] "></span>' +
      '<span data-testid="skill-card-stats" class="absolute bottom-2.5 right-3 z-20 inline-flex items-center gap-2.5 text-[10px] font-semibold tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] ">' +
      '<span class="inline-flex items-center gap-1" data-testid="skill-card-installs">' + ICON_DOWNLOAD + compact(s.d) + '<span class="sr-only">' + s.d + ' installs</span></span>' +
      '<span class="inline-flex items-center gap-1" data-testid="skill-card-bookmarks">' + ICON_BOOKMARK_SM + compact(s.b) + '</span></span></div>' +
      '<div data-testid="skill-card-caption" class="mt-1.5 flex h-6 items-center gap-2 ">' +
      '<h3 class="min-w-0 truncate text-[13px] font-medium leading-tight tracking-[-0.01em] text-black/65 dark:text-white/68" title="' + esc(s.n) + '">' + esc(s.n) + '</h3>' + captions + '</div></a>' +
      '<div class="pointer-events-none absolute inset-x-0 top-0 z-30 aspect-video"><div class="flex items-center pointer-events-auto absolute right-2.5 top-2.5 gap-1" data-testid="skill-collect-actions">' +
      collectButton('Like', 'skill-like-button', ICON_HEART) +
      collectButton('Save', 'skill-bookmark-button', ICON_BOOKMARK) +
      '</div></div></article></div></div>';
  }

  function initListing() {
    var grid = q('[data-testid="skill-grid"]');
    if (!grid) return;

    var state = { sort: 'recommended', filters: [], shown: 0 };
    var params = new URLSearchParams(window.location.search);
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('output')) state.filters.push('output:' + params.get('output'));
    if (params.get('free') === 'true') state.filters.push('free');
    if (params.get('featured') === 'true') state.filters.push('featured');
    if (params.get('task')) state.filters.push('task:' + params.get('task'));
    if (params.get('role')) state.filters.push('role:' + params.get('role'));
    var fromUrl = state.filters.length > 0 || params.get('sort');

    var PAGE = 24;
    var all = [];
    var filtered = [];
    var existing = new Set();
    var recommendedOrder = [];

    var ROLE_ALIASES = {
      'content creator': ['social-media-creator', 'course-creator', 'blogger', 'editor'],
      'founder': ['solo-founder', 'indie-hacker', 'product-manager', 'small-business-owner'],
      'ecommerce seller': ['small-business-owner', 'ecommerce-retail'],
      'designer': ['brand-designer', 'ui-designer', 'graphic-designer'],
      'consultant': ['business-analyst', 'product-marketing-manager'],
      'teacher': ['education'],
      'marketer': ['content-marketer', 'product-marketing-manager'],
      'researcher': ['academic-researcher', 'science-communicator', 'technical-writer']
    };

    function slugOf(card) {
      var a = card.querySelector('a[href*="/skills/"]');
      var m = a && a.getAttribute('href').match(/\/skills\/([^/?#]+)/);
      return m ? m[1] : '';
    }

    function matches(s) {
      for (var i = 0; i < state.filters.length; i++) {
        var parts = state.filters[i].split(':');
        var kind = parts[0];
        var value = parts[1];
        if (kind === 'free' && s.pr !== 0) return false;
        if (kind === 'featured' && !s.ft) return false;
        if (kind === 'output' && s.o !== value) return false;
        if (kind === 'task' && s.tg.indexOf('scenario:' + value) < 0) return false;
        if (kind === 'role') {
          var aliases = ROLE_ALIASES[value] || [value];
          var hit = aliases.some(function (a) {
            return s.tg.indexOf('target_user:' + a) >= 0 || s.tg.indexOf('domain:' + a) >= 0;
          });
          if (!hit) return false;
        }
      }
      return true;
    }

    function sorted(list) {
      var copy = list.slice();
      if (state.sort === 'newest') copy.sort(function (a, b) { return (b.u || '').localeCompare(a.u || ''); });
      else if (state.sort === 'trending') copy.sort(function (a, b) { return (b.i || 0) - (a.i || 0); });
      else if (state.sort === 'top-rated') copy.sort(function (a, b) { return (b.r || 0) - (a.r || 0) || (b.d || 0) - (a.d || 0); });
      else {
        // "Recommended" is curated server-side; the captured first page is the only
        // ground truth for that order, so it leads and the rest keeps catalogue order.
        var rank = new Map(recommendedOrder.map(function (slug, i) { return [slug, i]; }));
        copy.sort(function (a, b) {
          var ra = rank.has(a.s) ? rank.get(a.s) : 1e6 + all.indexOf(a);
          var rb = rank.has(b.s) ? rank.get(b.s) : 1e6 + all.indexOf(b);
          return ra - rb;
        });
      }
      return copy;
    }

    function syncUrl() {
      var p = new URLSearchParams();
      if (state.sort !== 'recommended') p.set('sort', state.sort);
      state.filters.forEach(function (f) {
        var parts = f.split(':');
        if (parts[0] === 'output') p.set('output', parts[1]);
        else if (parts[0] === 'task') p.set('task', parts[1]);
        else if (parts[0] === 'role') p.set('role', parts[1]);
        else p.set(parts[0], 'true');
      });
      var qs = p.toString();
      try { history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
    }

    function counts() {
      var count = q('[data-testid="skills-directory-result-count"]');
      if (count) count.textContent = filtered.length + ' Skills';
      var apply = q('[data-testid="skills-directory-filters-apply"]');
      if (apply) apply.textContent = 'Show ' + filtered.length + ' Skills';
    }

    function paint(reset) {
      filtered = sorted(all.filter(matches));
      if (reset) {
        grid.innerHTML = '';
        existing = new Set();
        state.shown = 0;
      }
      var batch = filtered.slice(state.shown, state.shown + PAGE).filter(function (s) { return !existing.has(s.s); });
      if (batch.length) {
        grid.insertAdjacentHTML('beforeend', batch.map(function (s, i) { return cardHtml(s, state.shown + i); }).join(''));
        batch.forEach(function (s) { existing.add(s.s); });
      }
      state.shown += PAGE;
      counts();
      initCollect();
      syncUrl();
    }

    function paintSortTabs() {
      qa('[data-testid^="skills-directory-sort-"]').forEach(function (tab) {
        var key = tab.getAttribute('data-testid').replace('skills-directory-sort-', '');
        var active = key === state.sort;
        tab.setAttribute('aria-selected', String(active));
        tab.setAttribute('data-active', String(active));
        tab.classList.toggle('bg-[#121313]', active);
        tab.classList.toggle('text-white', active);
        tab.classList.toggle('dark:bg-[#f4ff71]', active);
        tab.classList.toggle('dark:text-[#121313]', active);
      });
    }

    function sectionOf(cb) {
      var host = cb.closest('[data-testid^="directory-filter-"]');
      return host ? host.getAttribute('data-testid').replace('directory-filter-', '') : '';
    }
    function textOf(cb) {
      var host = cb.parentElement;
      var span = host && host.querySelector('.min-w-0.flex-1');
      return span ? span.textContent.trim() : '';
    }
    function valueOf(cb) {
      var text = textOf(cb).toLowerCase();
      var section = sectionOf(cb);
      if (section === 'highlights') return text === 'free' ? 'free' : 'featured';
      if (section === 'outputs') return 'output:' + ({ web: 'html', slides: 'presentation', video: 'video', image: 'image' }[text] || text);
      if (section === 'roles') return 'role:' + text;
      return 'task:' + text.replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    }

    function readFilters() {
      state.filters = [];
      qa('[data-testid^="directory-filter-"] input[type="checkbox"]').forEach(function (cb) {
        if (cb.checked) state.filters.push(valueOf(cb));
      });
    }

    loadMeta().then(function (m) {
      LISTING_META = m;
      return loadIndex();
    }).then(function (list) {
      all = list || [];

      // URL parameters -> checked boxes
      qa('[data-testid^="directory-filter-"] input[type="checkbox"]').forEach(function (cb) {
        if (state.filters.indexOf(valueOf(cb)) >= 0) cb.checked = true;
      });

      qa('[data-testid^="skills-directory-sort-"]').forEach(function (tab) {
        var key = tab.getAttribute('data-testid').replace('skills-directory-sort-', '');
        on(tab, 'click', function (e) {
          e.preventDefault();
          state.sort = key;
          paintSortTabs();
          paint(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
      paintSortTabs();

      qa('[data-testid^="directory-filter-"] input[type="checkbox"]').forEach(function (cb) {
        on(cb, 'change', function () { readFilters(); paint(true); });
      });
      var trigger = q('[data-testid="skills-directory-filter-trigger"]');
      var aside = q('[data-testid="skills-directory-filters"]');
      var apply = q('[data-testid="skills-directory-filters-apply"]');
      on(trigger, 'click', function (e) { e.preventDefault(); aside.classList.remove('max-lg:hidden'); });
      on(apply, 'click', function (e) { e.preventDefault(); aside.classList.add('max-lg:hidden'); });

      // capture the server order of the first page before anything repaints
      qa('[data-testid="directory-skill-card"]', grid).forEach(function (card) {
        var slug = slugOf(card);
        if (slug) recommendedOrder.push(slug);
      });
      all.forEach(function (s) { if (recommendedOrder.indexOf(s.s) < 0) recommendedOrder.push(s.s); });

      filtered = sorted(all.filter(matches));
      if (fromUrl) {
        paint(true);
      } else {
        // keep the captured first page untouched, then continue the same list
        qa('[data-testid="directory-skill-card"]', grid).forEach(function (card) {
          var slug = slugOf(card);
          if (slug) existing.add(slug);
        });
        state.shown = Math.max(0, existing.size);
        counts();
      }

      var sentinel = q('[data-testid="skills-infinite-scroll-sentinel"]');
      if (sentinel && 'IntersectionObserver' in window) {
        var busy = false;
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting || busy) return;
          if (window.scrollY < 200) return;
          if (state.shown >= filtered.length) return;
          busy = true;
          paint(false);
          setTimeout(function () { busy = false; }, 150);
        }, { rootMargin: '600px 0px' });
        io.observe(sentinel);
      }
    });
  }

  /* ------------------------------------------------ learn page skill spotlight */
  function initSpotlight() {
    var boxes = qa('[data-testid="learn-skill-spotlight"]');
    if (!boxes.length) return;
    loadIndex().then(function (all) {
      if (!all || !all.length) return;
      var featured = all.filter(function (s) { return s.ft; });
      var pick = (featured.length ? featured : all)[Math.floor(Math.random() * (featured.length || all.length))];
      boxes.forEach(function (box) {
        var holder = box.querySelector('div.flex.flex-col.gap-3');
        if (!holder) return;
        var href = url('/skills/' + pick.s + '/');
        holder.innerHTML =
          '<a href="' + href + '" class="group flex flex-col gap-3">' +
          '<span class="relative block aspect-video w-full overflow-hidden rounded-[18px] bg-black/[0.06] dark:bg-white/[0.06]">' +
          '<img src="' + esc(pick.p) + '" alt="' + esc(pick.pa || pick.n) + '" loading="lazy" class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]">' +
          '</span>' +
          '<span class="truncate text-[15px] font-semibold leading-snug tracking-[-0.01em]">' + esc(pick.n) + '</span>' +
          '<span class="flex h-11 w-full items-center justify-center rounded-full bg-[#121313] text-[14px] font-semibold text-white transition-colors group-hover:bg-black dark:bg-[#f4ff71] dark:text-[#121313]">' + (pick.pr ? 'View Skill' : 'Install') + '</span>' +
          '</a>';
      });
    });
  }

  /* --------------------------------------------------------------------- init */
  initTheme();
  initPromo();
  initCountdowns();
  initNavMenus();
  initSearch();
  initMobileMenu();
  initCollect();
  initAccount();
  initDetail();
  initListing();
  initSpotlight();
})();

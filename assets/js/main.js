/* Intrecci – interazioni del sito (nessuna libreria esterna, nessuna chiave API) */
(function () {
  'use strict';

  var EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
  var EASE_IN_OUT = 'cubic-bezier(.65, 0, .35, 1)';
  var canAnimate = typeof Element.prototype.animate === 'function';

  /* ---------- Blocco dello scroll (senza far "saltare" la pagina) ---------- */
  function lockScroll(on) {
    var body = document.body;
    if (on && !body.classList.contains('no-scroll')) {
      var bar = window.innerWidth - document.documentElement.clientWidth;
      body.style.paddingRight = bar > 0 ? bar + 'px' : '';
    }
    if (!on) body.style.paddingRight = '';
    body.classList.toggle('no-scroll', on);
  }

  /* ---------- Header: bordo allo scroll ---------- */
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menu mobile (le animazioni sono in CSS) ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('menu');

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    nav.classList.toggle('is-open', open);
    lockScroll(open);
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 861px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });

  /* ---------- Voce di menu attiva ---------- */
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) spy.observe(target);
    });
  }

  /* ---------- Comparsa allo scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Dialog: apertura e chiusura con transizione ---------- */
  var lightbox = document.getElementById('lightbox');

  function openDialog(dlg) {
    if (!dlg || dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    lockScroll(true);
    void dlg.offsetWidth; // fissa lo stato iniziale, così la classe successiva avvia la transizione
    dlg.classList.add('is-visible');
  }
  function closeDialog(dlg) {
    if (!dlg.open || dlg.dataset.closing) return;
    dlg.dataset.closing = '1';
    dlg.classList.remove('is-visible');
    setTimeout(function () { finishClose(dlg); }, 420);
  }
  // chiude davvero e ripristina lo stato (chiamata anche dall'evento "close", quindi idempotente)
  function finishClose(dlg) {
    if (dlg.open) dlg.close();
    delete dlg.dataset.closing;
    dlg.classList.remove('is-visible');
    if (dlg === lightbox && lbImg.getAnimations) lbImg.getAnimations().forEach(function (a) { a.cancel(); });
    if (!document.querySelector('dialog[open]')) lockScroll(false);
  }
  function requestClose(dlg) { if (dlg === lightbox) closeLightbox(); else closeDialog(dlg); }

  document.querySelectorAll('dialog').forEach(function (dlg) {
    dlg.addEventListener('close', function () { finishClose(dlg); });
    // Esc: chiusura animata invece di quella istantanea del browser
    dlg.addEventListener('cancel', function (e) {
      if (!e.cancelable) return;
      e.preventDefault();
      requestClose(dlg);
    });
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) requestClose(dlg);
      else if (e.target === dlg && dlg.classList.contains('legal')) closeDialog(dlg); // clic fuori dal riquadro
    });
  });
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-dialog]');
    if (!trigger) return;
    e.preventDefault();
    var open = document.querySelector('dialog.legal[open]');
    if (open) closeDialog(open);
    openDialog(document.getElementById(trigger.getAttribute('data-dialog')));
  });

  /* ---------- Lightbox collezione: la foto si allarga dalla miniatura ---------- */
  var lbImg = lightbox.querySelector('.lb-img');
  var lbCaption = lightbox.querySelector('figcaption');
  var lbTitle = lightbox.querySelector('.lb-title');
  var lbCount = lightbox.querySelector('.lb-count');
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.product-media'));
  var items = thumbs.map(function (btn) {
    var img = btn.querySelector('img');
    return {
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      title: btn.parentNode.querySelector('.product-title').textContent.replace(/\s+/g, ' ').trim()
    };
  });
  var current = 0;
  var busy = false;

  function setItem(i) {
    current = (i + items.length) % items.length;
    var it = items[current];
    lbImg.src = it.src;
    lbImg.alt = it.alt;
    lbTitle.textContent = it.title;
    lbCount.textContent = (current + 1) + ' / ' + items.length;
  }
  function ready(img) {
    // la miniatura ha già caricato la foto: niente attesa, l'animazione parte subito
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return (img.decode ? img.decode() : Promise.resolve()).catch(function () {});
  }
  // Fine di un'animazione: il timer evita ritardi quando il browser aggiorna la pagina di rado
  function done(anim) {
    return new Promise(function (resolve, reject) {
      var t = anim.effect.getTiming();
      var settled = false;
      setTimeout(function () { if (!settled) { settled = true; resolve(); } }, (t.delay || 0) + t.duration + 20);
      anim.finished.then(function () {
        if (!settled) { settled = true; resolve(); }
      }, function (err) {
        if (!settled) { settled = true; reject(err); }
      });
    });
  }
  function inView(r) { return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }

  // Fotogrammi che portano la foto grande esattamente sopra la miniatura, ritaglio compreso
  function zoomFrames(thumbRect) {
    var to = lbImg.getBoundingClientRect();
    var nw = lbImg.naturalWidth || to.width, nh = lbImg.naturalHeight || to.height;
    var cover = Math.max(thumbRect.width / nw, thumbRect.height / nh);
    var k = (nw * cover) / to.width;
    var dx = thumbRect.left + thumbRect.width / 2 - (to.left + to.width / 2);
    var dy = thumbRect.top + thumbRect.height / 2 - (to.top + to.height / 2);
    var ix = Math.max(0, (to.width - thumbRect.width / k) / 2);
    var iy = Math.max(0, (to.height - thumbRect.height / k) / 2);
    return [
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')', clipPath: 'inset(' + iy + 'px ' + ix + 'px)' },
      { transform: 'translate(0px, 0px) scale(1)', clipPath: 'inset(0px 0px)' }
    ];
  }

  function openLightbox(i) {
    if (lightbox.open) return;
    setItem(i);
    if (!canAnimate) { openDialog(lightbox); return; }
    lbImg.style.opacity = '0';
    openDialog(lightbox);
    ready(lbImg).then(function () {
      lbImg.style.opacity = '';
      lbImg.animate(zoomFrames(thumbs[i].getBoundingClientRect()), { duration: 750, easing: EASE_OUT });
    });
  }

  function closeLightbox() {
    if (!lightbox.open || lightbox.dataset.closing) return;
    if (!canAnimate) { lightbox.close(); return; }
    lightbox.dataset.closing = '1';
    lbImg.getAnimations().forEach(function (a) { a.finish(); });
    lightbox.classList.remove('is-visible');
    var r = thumbs[current].getBoundingClientRect();
    var anim = inView(r)
      ? lbImg.animate(zoomFrames(r).reverse(), { duration: 560, easing: EASE_IN_OUT, fill: 'forwards' })
      : lbImg.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.96)' }],
                      { duration: 320, easing: 'ease', fill: 'forwards' });
    done(anim).then(function () { finishClose(lightbox); }, function () { finishClose(lightbox); });
  }

  // Foto precedente/successiva: esce da un lato, entra dall'altro
  function step(dir) {
    if (!lightbox.open || lightbox.dataset.closing) return;
    if (!canAnimate) { setItem(current + dir); return; }
    if (busy) return;
    busy = true;
    var dist = 40 * dir;
    var out = lbImg.animate(
      [{ opacity: 1, transform: 'translateX(0px)' }, { opacity: 0, transform: 'translateX(' + (-dist) + 'px)' }],
      { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    done(out).then(function () {
      setItem(current + dir);
      return ready(lbImg);
    }).then(function () {
      out.cancel();
      lbCaption.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease' });
      return done(lbImg.animate(
        [{ opacity: 0, transform: 'translateX(' + dist + 'px)' }, { opacity: 1, transform: 'translateX(0px)' }],
        { duration: 480, easing: EASE_OUT }));
    }).then(function () { busy = false; }, function () { busy = false; });
  }

  thumbs.forEach(function (btn, i) {
    btn.addEventListener('click', function () { openLightbox(i); });
  });
  lightbox.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
  lightbox.querySelector('.lb-next').addEventListener('click', function () { step(1); });
  lightbox.addEventListener('click', function (e) {
    var t = e.target;
    if (t === lightbox || t.classList.contains('lb-bg') || t.classList.contains('lb-figure')) closeLightbox();
  });
  lightbox.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  var touchX = null;
  lightbox.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });

  /* ---------- Video "Come nasce": parte quando è visibile ---------- */
  var video = document.getElementById('video-come-nasce');
  var vToggle = document.querySelector('.video-toggle');
  // video breve, muto e senza flash: parte sempre, con pulsante pausa sempre disponibile
  var userPaused = false;

  video.removeAttribute('controls');
  vToggle.hidden = false;

  function syncToggle() {
    var paused = video.paused;
    vToggle.classList.toggle('is-paused', paused);
    vToggle.setAttribute('aria-label', paused ? 'Riproduci il video' : 'Metti in pausa il video');
  }
  video.addEventListener('play', syncToggle);
  video.addEventListener('pause', syncToggle);
  syncToggle();

  vToggle.addEventListener('click', function () {
    if (video.paused) { userPaused = false; video.play(); }
    else { userPaused = true; video.pause(); }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (video.preload !== 'auto') video.preload = 'auto';
          if (!userPaused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { threshold: 0.25 }).observe(video);
  }

  /* ---------- Banner cookie ---------- */
  var banner = document.getElementById('cookie-banner');
  var KEY = 'intrecci-cookie';

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember() { try { localStorage.setItem(KEY, 'tecnici-' + new Date().toISOString().slice(0, 10)); } catch (e) {} }

  function showBanner(now) {
    banner.classList.remove('is-leaving');
    banner.style.animationDelay = now ? '0s' : '';
    banner.hidden = false;
  }
  function hideBanner() {
    banner.classList.add('is-leaving');
    setTimeout(function () { banner.hidden = true; }, 420);
  }

  if (!stored()) showBanner(false);
  banner.querySelector('[data-cookie-ok]').addEventListener('click', function () { remember(); hideBanner(); });
  document.querySelector('[data-cookie-open]').addEventListener('click', function () { showBanner(true); });
})();

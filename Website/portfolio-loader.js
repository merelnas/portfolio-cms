/**
 * portfolio-loader.js — complete rewrite
 * Fixes: series slug routing, CV nav, nav hardcoding, site.json cvData strip,
 *        contact on non-GitHub-Pages hosts, data/ path consistency.
 * New: texts edit/reorder (via admin), series order, unsaved-changes indicator,
 *      series autocomplete (admin-side), series slug↔name mapping.
 */
(function () {

  // ── Helpers ───────────────────────────────────────────────────
  function slug(str) {
    return String(str).toLowerCase()
      .replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function unslug(str, seriesNames) {
    // Find the series name that matches this slug
    return seriesNames.find(n => slug(n) === str) || str;
  }
  function detectYear() {
    const m = window.location.pathname.match(/\b(20\d{2})\b/);
    return m ? parseInt(m[1]) : null;
  }
  function isIndex() {
    const p = window.location.pathname;
    return p === '/' || p === '/index.html' || p === '';
  }
  function currentPageType() {
    const p = window.location.pathname;
    if (isIndex())                return 'home';
    if (/\/20\d{2}/.test(p))     return 'works-year';
    if (p.startsWith('/series'))  return 'works-series';
    if (p.startsWith('/info'))    return 'info';
    if (p.startsWith('/texts'))   return 'texts';
    if (p.startsWith('/contact')) return 'contact';
    if (p.startsWith('/cv'))      return 'cv';
    return null;
  }
  function defaultPages() {
    return [
      { type:'home',         label:'Home',   enabled:true  },
      { type:'works-year',   label:'Works',  enabled:true  },
      { type:'works-series', label:'Series', enabled:false },
      { type:'cv',           label:'CV',     enabled:false },
      { type:'info',         label:'Info',   enabled:true  },
      { type:'texts',        label:'Texts',  enabled:false },
      { type:'contact',      label:'Contact',enabled:false },
    ];
  }

  // ── Apply site settings to every page ─────────────────────────
  function applySiteSettings(s) {
    if (!s) return;
    if (s.name) {
      document.querySelectorAll('h1 a').forEach(el => el.textContent = s.name);
      document.title = s.name;
    }
    if (s.instagram) {
      document.querySelectorAll('a[href*="instagram.com"]').forEach(el => {
        el.href = 'https://instagram.com/' + s.instagram.replace('@','');
      });
    }
    buildNav(s, s.pages && s.pages.length ? s.pages : defaultPages());
  }

  // ── Build nav entirely from pages config ──────────────────────
  // FIX 5: HTML pages now have bare <ul id="sidebar-nav-years">
  // with NO hardcoded Home link — loader builds everything.
  function buildNav(s, pages) {
    const navYears    = (s.navYears && s.navYears.length) ? s.navYears : (s.years || []);
    const sortedYears = [...navYears].sort((a,b) => b-a);
    const curType     = currentPageType();
    const curYear     = detectYear();

    ['sidebar-nav-years','mobile-nav-years'].forEach(id => {
      const ul = document.getElementById(id);
      if (!ul) return;
      ul.innerHTML = ''; // FIX 5: clear everything, build from scratch

      pages.filter(p => p.enabled).forEach(page => {

        if (page.type === 'works-year') {
          sortedYears.forEach(y => {
            const li = document.createElement('li');
            const a  = document.createElement('a');
            a.href = '/' + y; a.textContent = y;
            if (curYear === y) a.className = 'active';
            li.appendChild(a); ul.appendChild(li);
          });

        } else if (page.type === 'cv') {
          // FIX 2: CV = direct PDF download, not a page navigation
          if (!s.cvFile) return;
          const li = document.createElement('li');
          const a  = document.createElement('a');
          a.href = '/' + s.cvFile;
          a.textContent = page.label;
          a.setAttribute('download', '');
          li.appendChild(a); ul.appendChild(li);

        } else if (page.type === 'contact') {
          // FIX 3: Contact opens a modal rather than navigating to a page.
          // On the contact.html page itself it auto-opens.
          // On all other pages, clicking the link navigates to /contact.
          const li = document.createElement('li');
          const a  = document.createElement('a');
          const isContactPage = window.location.pathname.startsWith('/contact');
          if (isContactPage) {
            a.href = '#'; a.className = 'active';
            a.onclick = e => { e.preventDefault(); openContactModal(s); };
          } else {
            a.href = '/contact';
          }
          a.textContent = page.label;
          li.appendChild(a); ul.appendChild(li);

        } else {
          const hrefs = { home:'/', 'works-series':'/series', info:'/info', texts:'/texts' };
          const href  = hrefs[page.type]; if (!href) return;
          const li = document.createElement('li');
          const a  = document.createElement('a');
          a.href = href; a.textContent = page.label;
          if (curType === page.type) a.className = 'active';
          li.appendChild(a); ul.appendChild(li);
        }
      });
    });
  }

  // ── Contact modal (works on any page) ─────────────────────────
  // FIX 3: Instead of a separate HTML page, the modal is injected
  // into the DOM and works on every page including the contact page itself.
  function openContactModal(s) {
    let modal = document.getElementById('_contact_modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = '_contact_modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';
      modal.innerHTML = `
        <div style="background:#fff;border-radius:12px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.18);overflow:hidden">
          <div style="padding:16px 20px;border-bottom:1px solid #e4e4e0;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:15px;font-weight:500">${esc(s._contactLabel || 'Contact')}</span>
            <button id="_contact_close" style="background:none;border:none;cursor:pointer;font-size:22px;color:#8a8a84;line-height:1;padding:0 4px">×</button>
          </div>
          <div style="padding:20px">${buildContactBody(s)}</div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('_contact_close').onclick = () => modal.remove();
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    } else {
      modal.style.display = 'flex';
    }
  }

  function buildContactBody(s) {
    const row = (label, html) => `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;opacity:.4;margin-bottom:3px">${label}</div>
        <div style="font-size:.95rem">${html}</div>
      </div>`;
    let out = '';
    if (s.email)          out += row('Email',`<a href="mailto:${esc(s.email)}" style="border-bottom:1px solid #191919;padding-bottom:1px">${esc(s.email)}</a>`);
    if (s.phone)          out += row('Phone', esc(s.phone));
    if (s.instagram)      out += row('Instagram',`<a href="https://instagram.com/${esc(s.instagram)}" target="_blank" rel="noopener noreferrer" style="border-bottom:1px solid #191919;padding-bottom:1px">@${esc(s.instagram)}</a>`);
    if (s.representation) out += row('Representation', s.representationUrl ? `<a href="${esc(s.representationUrl)}" target="_blank" rel="noopener noreferrer" style="border-bottom:1px solid #191919;padding-bottom:1px">${esc(s.representation)}</a>` : esc(s.representation));
    if (s.location)       out += row('Based in', esc(s.location));
    if (s.contactText)    out += `<p style="font-size:.85rem;opacity:.6;line-height:1.65;margin-top:8px">${esc(s.contactText)}</p>`;
    return out || '<p style="opacity:.4;font-size:.9rem">No contact info yet.</p>';
  }

  // ── Info page ─────────────────────────────────────────────────
  function buildInfoPage(s) {
    const bio         = s.bio || '';
    const exhibitions = (s.exhibitions || []).slice().sort((a,b)=>(b.year||0)-(a.year||0));
    const education   = (s.education   || []).slice().sort((a,b)=>(b.year||0)-(a.year||0));
    // writing unified array — fall back to legacy press/texts for backwards compat
    const writing     = (s.writing     || [
      ...(s.press || []).map(p=>({...p, source:p.publication, type:'press'})),
      ...(s.texts || []).map(t=>({...t, source:t.author, type:'essay'}))
    ]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const bioHtml = bio
      ? bio.split('\n').filter(l=>l.trim()).map(l=>`<p>${esc(l)}</p>`).join('')
      : '<p style="opacity:.4">Bio coming soon.</p>';
    const listHtml = (items, empty) => !items.length
      ? `<p style="opacity:.4;font-size:.9rem">${empty}</p>`
      : `<ul class="info-list">${items.map(e=>`<li><span class="info-year">${esc(String(e.year||''))}</span><span>${esc(e.title)}${(e.venue||e.institution)?`<br><span style="opacity:.5">${esc(e.venue||e.institution)}</span>`:''}</span></li>`).join('')}</ul>`;
    return `<div class="info-page">
      <div class="info-main">
        <div class="info-bio">${bioHtml}</div>
        <div class="info-section"><h3>Exhibitions</h3>${listHtml(exhibitions,'No exhibitions listed yet.')}</div>
        <div class="info-section"><h3>Education</h3>${listHtml(education,'No education listed yet.')}</div>
        ${writing.length?`<div class="info-section"><h3>Writing</h3><ul class="info-list">${writing.map(w=>`<li><span class="info-year">${esc(w.date||'')}</span><span>${w.url?`<a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">${esc(w.title)}</a>`:esc(w.title)}${w.source?`<br><span style="opacity:.5">${esc(w.source)}</span>`:''}</span></li>`).join('')}</ul></div>`:''}
      </div>
      <aside class="info-contact">
        ${s.email?`<div class="info-contact-item"><div class="info-contact-label">Email</div><div class="info-contact-value"><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div></div>`:''}
        ${s.phone?`<div class="info-contact-item"><div class="info-contact-label">Phone</div><div class="info-contact-value">${esc(s.phone)}</div></div>`:''}
        ${s.instagram?`<div class="info-contact-item"><div class="info-contact-label">Instagram</div><div class="info-contact-value"><a href="https://instagram.com/${esc(s.instagram)}" target="_blank" rel="noopener noreferrer">@${esc(s.instagram)}</a></div></div>`:''}
        ${s.representation?`<div class="info-contact-item"><div class="info-contact-label">Representation</div><div class="info-contact-value">${s.representationUrl?`<a href="${esc(s.representationUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.representation)}</a>`:esc(s.representation)}</div></div>`:''}
        ${s.location?`<div class="info-contact-item"><div class="info-contact-label">Based in</div><div class="info-contact-value">${esc(s.location)}</div></div>`:''}
        ${s.contactText?`<div class="info-contact-item"><div class="info-contact-value" style="opacity:.6;font-size:.85rem;line-height:1.6">${esc(s.contactText)}</div></div>`:''}
      </aside>
    </div>`;
  }

  // ── Texts page ────────────────────────────────────────────────
  function buildTextsPage(s) {
    // Use unified writing array, fall back to legacy texts for backwards compat
    const writing = s.writing && s.writing.length ? s.writing
      : [...(s.texts||[]).map(t=>({...t,source:t.author,type:'essay'})),
         ...(s.press||[]).map(p=>({...p,source:p.publication,type:'press'}))];
    if (!writing.length) return '<div class="texts-page"><p style="opacity:.4;font-size:.9rem">No writing published yet.</p></div>';
    const typeLabel = t => ({press:'Press',essay:'Essay',statement:'Artist statement',interview:'Interview',catalogue:'Catalogue text'}[t]||'');
    return `<div class="texts-page">${writing.map(w=>`
      <div class="text-item">
        <div class="text-item-header">
          <div class="text-item-title">${w.url?`<a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">${esc(w.title)}</a>`:esc(w.title)}${w.type&&w.type!=='essay'?` <span style="font-size:11px;opacity:.45;font-weight:400">${typeLabel(w.type)}</span>`:''}</div>
          ${w.date?`<div class="text-item-meta">${esc(w.date)}</div>`:''}
        </div>
        ${w.source?`<div class="text-item-author">${esc(w.source)}</div>`:''}
        ${w.body&&!w.url?`<div class="text-item-body">${esc(w.body).replace(/\n/g,'<br>')}</div>`:''}
      </div>`).join('')}</div>`;
  }

  // ── Gallery ───────────────────────────────────────────────────
  function buildGallery(allItems, key) {
    const published = allItems.filter(i => !i.draft);
    if (!published.length) return '';
    const thumbs = published.map((item,i) => `
      <div class="masonry-item"><a href="#pf-img-${key}-${i}">
        <img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy">
      </a></div>`).join('');
    const lightboxes = published.map((item,i) => {
      const prev = i === 0 ? published.length-1 : i-1;
      const next = i === published.length-1 ? 0 : i+1;
      return `<div id="pf-img-${key}-${i}" class="lightbox">
        <a href="#!" class="lightbox-close"></a>
        <div class="lightbox-content">
          <a href="#pf-img-${key}-${prev}" class="lightbox-prev"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></a>
          <div class="lightbox-image-container">
            <img src="${esc(item.image)}" alt="${esc(item.title)}">
            <div class="lightbox-info">
              <h3>${esc(item.title)}</h3>
              ${item.description?`<p>${esc(item.description)}</p>`:''}
              ${item.material||item.dimensions?`<p style="opacity:.6;font-size:13px">${[item.material,item.dimensions].filter(Boolean).join(', ')}</p>`:''}
              ${item.series?`<p style="opacity:.45;font-size:12px">${esc(item.series)}</p>`:''}
              <span class="year">${key}</span>
            </div>
          </div>
          <a href="#pf-img-${key}-${next}" class="lightbox-next"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></a>
        </div>
      </div>`;
    }).join('');
    return `<div class="masonry">${thumbs}</div>${lightboxes}`;
  }

  // FIX 4: fetch data/ path — consistent regardless of host
  function fetchYear(year) {
    // Try data/ subfolder first (production), fall back to same dir (local testing)
    return fetch(`data/portfolio-${year}.json?v=${Date.now()}`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => fetch(`portfolio-${year}.json?v=${Date.now()}`).then(r=>r.ok?r.json():[]).catch(()=>[]));
  }

  // ── Series pages ──────────────────────────────────────────────
  // FIX 1: use slugs in URLs, resolve back to names for display
  function buildSeriesListPage(allItems, s) {
    const meta = s.seriesMeta || {};
    // FIX 7: respect seriesOrder if set, otherwise alphabetical
    const seriesOrder = s.seriesOrder || [];
    const map = {};
    allItems.filter(i=>i.series&&!i.draft).forEach(item=>{
      if (!map[item.series]) map[item.series]=[];
      map[item.series].push(item);
    });
    let names = Object.keys(map);
    if (seriesOrder.length) {
      names.sort((a,b)=>{
        const ai = seriesOrder.indexOf(a), bi = seriesOrder.indexOf(b);
        if (ai<0&&bi<0) return a.localeCompare(b);
        if (ai<0) return 1; if (bi<0) return -1;
        return ai-bi;
      });
    } else {
      names.sort((a,b)=>a.localeCompare(b));
    }
    if (!names.length) return '<div style="padding:3rem;opacity:.4;font-size:.9rem;text-align:center">No series yet.</div>';
    return `<div class="series-page">${names.map(name=>{
      const works = map[name];
      const m = meta[name]||{};
      const cover = m.cover||(works[0]&&works[0].image)||'';
      return `<a class="series-item" href="/series/${encodeURIComponent(slug(name))}">
        <div class="series-thumb">${cover?`<img src="${esc(cover)}" alt="${esc(name)}" loading="lazy">`:''}</div>
        <div class="series-info">
          <div class="series-name">${esc(name)}</div>
          <div class="series-count">${works.length} work${works.length!==1?'s':''}</div>
          ${m.desc?`<div class="series-desc">${esc(m.desc)}</div>`:''}
        </div>
      </a>`;
    }).join('')}</div>`;
  }

  function buildSeriesDetailPage(seriesSlug, allItems, s) {
    // FIX 1: resolve slug → name
    const allSeriesNames = [...new Set(allItems.filter(i=>i.series).map(i=>i.series))];
    const seriesName = unslug(seriesSlug, allSeriesNames) || seriesSlug;
    const meta  = (s.seriesMeta||{})[seriesName]||{};
    const works = allItems.filter(i=>i.series===seriesName&&!i.draft);
    if (!works.length) return '<p style="padding:3rem;opacity:.4;text-align:center">No works in this series.</p>';
    return `
      <div class="series-detail-header">
        <h2>${esc(seriesName)}</h2>
        ${meta.desc?`<p class="series-detail-desc">${esc(meta.desc)}</p>`:''}
      </div>
      <div class="gallery-container">${buildGallery(works, slug(seriesName))}</div>`;
  }

  // ── Main ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {

    // FIX 8: always strip cvData from site.json fetch — it should never be there
    // but defensively clean it up
    const sitePromise = fetch('site.json?v='+Date.now())
      .then(r=>r.ok?r.json():{}).catch(()=>({}))
      .then(s=>{ delete s.cvData; return s; });

    sitePromise.then(s => applySiteSettings(s));

    // Info page
    const infoGrid = document.getElementById('info-grid');
    if (infoGrid) { sitePromise.then(s=>{ infoGrid.innerHTML=buildInfoPage(s); }); return; }

    // Texts page
    const textsGrid = document.getElementById('texts-grid');
    if (textsGrid) { sitePromise.then(s=>{ textsGrid.innerHTML=buildTextsPage(s); }); return; }

    // FIX 3: Contact page — opens modal immediately
    const contactGrid = document.getElementById('contact-grid');
    if (contactGrid) {
      sitePromise.then(s => {
        const pages = s.pages && s.pages.length ? s.pages : defaultPages();
        const cp = pages.find(p=>p.type==='contact');
        s._contactLabel = cp ? cp.label : 'Contact';
        // Small delay so nav builds first
        setTimeout(()=>openContactModal(s), 100);
      });
      return;
    }

    // Series pages
    const seriesGrid = document.getElementById('series-grid');
    if (seriesGrid) {
      sitePromise.then(async s => {
        // FIX 1: get slug from URL path like /series/growing-pains
        const pathParts = window.location.pathname.replace(/^\/series\/?/,'').replace(/\/$/,'');
        const navYears = (s.navYears&&s.navYears.length)?s.navYears:(s.years||[]);
        const allItems = (await Promise.all(
          navYears.map(y=>fetchYear(y))
        )).flat();
        if (pathParts) {
          seriesGrid.innerHTML = buildSeriesDetailPage(pathParts, allItems, s);
        } else {
          seriesGrid.innerHTML = buildSeriesListPage(allItems, s);
        }
      });
      return;
    }

    // Gallery pages (index + year)
    const container = document.getElementById('portfolio-grid');
    if (!container) return;

    const yearsPromise = isIndex()
      ? sitePromise.then(s=>{
          const ny=(s.navYears&&s.navYears.length)?s.navYears:(s.years||[]);
          return [...ny].sort((a,b)=>b-a);
        })
      : Promise.resolve([detectYear()].filter(Boolean));

    container.innerHTML='<div class="gallery-container"><p style="text-align:center;padding:3rem;opacity:.4;font-size:14px">Loading…</p></div>';

    yearsPromise.then(years=>{
      if (!years.length) {
        container.innerHTML='<div class="gallery-container"><p style="text-align:center;padding:3rem;opacity:.4;font-size:14px">Could not detect year.</p></div>';
        return;
      }
      Promise.all(years.map(y=>fetchYear(y).then(items=>({year:y,items}))))
        .then(results=>{
          const filled=results.filter(r=>r.items&&r.items.filter(i=>!i.draft).length);
          if (!filled.length) {
            container.innerHTML='<div class="gallery-container"><p style="text-align:center;padding:3rem;opacity:.4;font-size:14px">No works added yet.</p></div>';
            return;
          }
          if (isIndex()) {
            container.innerHTML=filled.map(({year,items})=>
              `<div class="gallery-container" id="year-section-${year}">${buildGallery(items,year)}</div>`
            ).join('');
          } else {
            const {year,items}=filled[0];
            container.innerHTML=`<div class="gallery-container">${buildGallery(items,year)}</div>`;
          }
        });
    });
  });

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();

/* Redaktion + leads – Commercial Insights
 * Frontend. Data ligger i Google Sheets och hämtas via Apps Script (se apps-script/Code.gs).
 */
(function () {
  'use strict';

  var C = window.CONFIG;
  var LS_KOD = 'redaktion.kod', LS_NAMN = 'redaktion.namn', LS_FILTER = 'redaktion.filter', LS_MEJL = 'redaktion.mejl';

  var state = {
    kod: lasLokalt(LS_KOD),
    namn: lasLokalt(LS_NAMN),
    data: { artiklar: [], leads: [], varma: [] },
    flik: 'plan',
    filter: { pub: 'alla', doljKlara: false, ejMeddelade: false, mina: false, status: 'alla', sortering: 'status' },
    laddar: false
  };
  try { Object.assign(state.filter, JSON.parse(lasLokalt(LS_FILTER) || '{}')); } catch (e) {}

  /* ---------------- Hjälpfunktioner ---------------- */

  function lasLokalt(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function sparaLokalt(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function $(sel, rot) { return (rot || document).querySelector(sel); }
  function $$(sel, rot) { return Array.prototype.slice.call((rot || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function saker_url(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }

  function toast(text, fel) {
    var t = $('#toast');
    t.textContent = text;
    t.className = 'toast' + (fel ? ' fel' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast dold'; }, fel ? 6000 : 2600);
  }

  function pubBadge(p) {
    var info = C.PUBLIKATIONER[p];
    if (!info) return '<span class="underrad">–</span>';
    return '<span class="pub" style="background:' + info.farg + '" title="' + esc(info.namn) + '">' + esc(p) + '</span>';
  }

  function isoVecka(datum) {
    if (!datum) return '';
    var d = new Date(datum + 'T12:00:00');
    if (isNaN(d)) return '';
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dag = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dag);
    var ar = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - ar) / 86400000) + 1) / 7);
  }

  var VECKODAGAR = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
  var MANADER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function kortDatum(datum) {
    if (!datum) return '';
    var d = new Date(datum + 'T12:00:00');
    if (isNaN(d)) return esc(datum);
    return VECKODAGAR[d.getDay()] + ' ' + d.getDate() + ' ' + MANADER[d.getMonth()];
  }
  function idag() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function kronor(n) {
    n = Number(n) || 0;
    return n.toLocaleString('sv-SE') + ' kr';
  }
  function kontakterAv(a) {
    if (Array.isArray(a.kontakter)) return a.kontakter;
    try { var k = JSON.parse(a.kontakter || '[]'); return Array.isArray(k) ? k : []; } catch (e) { return []; }
  }
  /* Gissar avsändande bolag ur rubriken. Kända bolag (som redan finns i systemet) prioriteras. */
  var STARTORD = ('nästan fler färre kraftigt kraftig ny nya nytt så här därför hon han de det den vi allt alla mer mindre stor stora stort ' +
    'ökat ökad ökade ökar minskat minskad minskar rekord rekordmånga över under efter inför när varför hur vad svenska svensk svenskt ' +
    'sverige sveriges kina kinas eu eu:s regeringen forskare forskning ett en var varannan varje många få nu i på med för till från om ' +
    'bara hela första andra tredje unik unika ledare chefer medarbetare anställda jobb kvinnor män unga äldre studenter företag företagen ' +
    'hållbar grön gröna digital digitala dags se läs krönika debatt intervju podd nyhet tre snabba').split(' ');
  var BESKRIVNING = /(jätten|bolaget|företaget|koncernen|kedjan|tillverkaren|gruppen|startupen|konsulten|byrån|aktören|leverantören|operatören)$/i;
  var SUFFIX = /(forskare|forskarna|anställda|medarbetare|chefen)$/;

  function kandaBolag() {
    var namn = {};
    state.data.artiklar.forEach(function (a) { String(a.bolag || '').split(',').forEach(function (b) { b = b.trim(); if (b.length > 1) namn[b] = 1; }); });
    state.data.leads.forEach(function (l) { if (l.foretag && String(l.foretag).length > 1) namn[String(l.foretag).trim()] = 1; });
    state.data.varma.forEach(function (v) { if (v.foretag && String(v.foretag).length > 1) namn[String(v.foretag).trim()] = 1; });
    return Object.keys(namn);
  }

  function gissaBolag(rubrik) {
    rubrik = String(rubrik || '').trim();
    if (!rubrik) return '';
    // 1. Kända bolag i rubriken (längsta träffen vinner)
    var kanda = kandaBolag().filter(function (b) {
      var re = new RegExp('(^|[^\\wåäöÅÄÖ])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?([^\\wåäöÅÄÖ]|$)');
      return re.test(rubrik);
    }).sort(function (a, b) { return b.length - a.length; });
    if (kanda.length) return kanda[0];

    // 2. Inledande namn i rubriken
    var ord = rubrik.split(/\s+/).map(function (o) { return o.replace(/^[«"“'(]+|[»"”'),:;!?]+$/g, ''); });
    var i = 0;
    if (ord[0] && BESKRIVNING.test(ord[0]) && ord[1] && /^[A-ZÅÄÖ0-9]/.test(ord[1])) i = 1;
    var forsta = ord[i] || '';
    if (!forsta || /^\d/.test(forsta) || STARTORD.indexOf(forsta.toLowerCase()) >= 0) return '';
    var run = [];
    for (var j = i; j < ord.length && run.length < 4; j++) {
      var o = ord[j];
      if (!o || o === '–' || o === '-' || o === '—') break;
      var stor = /^[A-ZÅÄÖ0-9]/.test(o) || /[a-zåäö][A-ZÅÄÖ]/.test(o);
      if (run.length && !(stor || o === '&')) break;
      if (!run.length && !stor) return '';
      run.push(o);
      if (run.length === 1 && SUFFIX.test(o)) { run[0] = o.replace(SUFFIX, ''); break; }
    }
    if (run[run.length - 1] === '&') run.pop();
    var namn = run.join(' ').replace(/s$/, function (m) { return run.length === 1 && /[^s]s$/.test(run[0]) && run[0].length > 4 && /^[A-ZÅÄÖ][a-zåäö]+s$/.test(run[0]) ? '' : m; });
    if (namn.length < 2 || STARTORD.indexOf(namn.toLowerCase()) >= 0) return '';
    return namn;
  }

  function toastAngra(text, angra) {
    var t = $('#toast');
    t.innerHTML = esc(text) + ' <button type="button" style="margin-left:10px;background:none;border:1px solid rgba(255,255,255,.6);color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">Ångra</button>';
    t.className = 'toast';
    t.querySelector('button').onclick = function () { t.className = 'toast dold'; angra(); };
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast dold'; }, 7000);
  }

  // Tar bort direkt och erbjuder Ångra (lägger tillbaka samma rad)
  function taBortMedAngra(tabell, id, text) {
    var rad = hitta(tabell, id);
    if (!rad) return;
    var kopia = Object.assign({}, rad);
    state.data[tabell] = state.data[tabell].filter(function (r) { return String(r.id) !== String(id); });
    rita();
    api('delete', { tabell: tabell, id: id }).then(function () {
      toastAngra(text, function () {
        api('add', { tabell: tabell, rad: kopia }).then(function () { state.data[tabell].push(kopia); rita(); toast('Återställd'); })
          .catch(function (e) { toast('Kunde inte återställa: ' + e.message, true); });
      });
    }).catch(function (e) { state.data[tabell].push(kopia); rita(); toast('Kunde inte ta bort: ' + e.message, true); });
  }

  function kontaktText(k) {
    if (!k) return '';
    return [k.namn, k.roll].filter(Boolean).join(', ');
  }

  function options(lista, valt) {
    return lista.map(function (v) { return '<option' + (v === valt ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }

  /* ---------------- API ---------------- */

  function api(action, payload) {
    var body = Object.assign({ action: action, kod: state.kod }, payload || {});
    return fetch(C.WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (r) { return r.json(); }).then(function (svar) {
      if (!svar.ok) {
        if (svar.fel === 'fel_kod') { loggaUt('Teamkoden stämmer inte.'); }
        throw new Error(svar.fel || 'Något gick fel');
      }
      return svar;
    });
  }

  function synk(status, text) {
    $('#synk-prick').className = 'prick' + (status === 'ok' ? '' : ' ' + status);
    $('#synk-text').textContent = text;
  }

  function hamtaAllt(tyst) {
    if (state.laddar) return Promise.resolve();
    state.laddar = true;
    if (!tyst) synk('laddar', 'Hämtar…');
    return api('list').then(function (svar) {
      state.data = svar.data;
      synk('ok', 'Synkat ' + new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
      rita();
    }).catch(function (e) {
      synk('fel', 'Kunde inte hämta');
      if (!tyst) toast(e.message, true);
    }).then(function () { state.laddar = false; });
  }

  function andra(tabell, id, andringar) {
    var rad = state.data[tabell].filter(function (r) { return String(r.id) === String(id); })[0];
    var gammal = rad ? Object.assign({}, rad) : null;
    if (rad) Object.assign(rad, andringar);
    rita();
    return api('update', { tabell: tabell, id: id, andringar: andringar }).catch(function (e) {
      if (rad && gammal) Object.assign(rad, gammal);
      rita();
      toast('Kunde inte spara: ' + e.message, true);
      throw e;
    });
  }

  /* ---------------- Inloggning ---------------- */

  function visaInlogg(fel) {
    $('#app').classList.add('dold');
    $('#inlogg').classList.remove('dold');
    $('#inlogg-namn').innerHTML = options(C.TEAM, state.namn || C.TEAM[0]);
    $('#inlogg-fel').textContent = fel || '';
    $('#inlogg-kod').value = '';
    $('#inlogg-kod').focus();
  }

  function loggaUt(fel) {
    state.kod = '';
    sparaLokalt(LS_KOD, '');
    visaInlogg(fel);
  }

  $('#inlogg-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var namn = $('#inlogg-namn').value;
    var kod = $('#inlogg-kod').value.trim();
    var knapp = e.target.querySelector('button[type=submit]');
    knapp.disabled = true;
    $('#inlogg-fel').textContent = '';
    state.kod = kod;
    api('ping').then(function () {
      state.namn = namn;
      sparaLokalt(LS_KOD, kod);
      sparaLokalt(LS_NAMN, namn);
      starta();
    }).catch(function (err) {
      $('#inlogg-fel').textContent = err.message === 'fel_kod' ? 'Fel teamkod.' : 'Kunde inte nå servern: ' + err.message;
    }).then(function () { knapp.disabled = false; });
  });

  $('#logga-ut').addEventListener('click', function () { loggaUt(''); });
  $('#mejlval').value = lasLokalt(LS_MEJL) || 'gmail';
  $('#mejlval').addEventListener('change', function () { sparaLokalt(LS_MEJL, this.value); toast('Mejlutkast öppnas nu i ' + this.options[this.selectedIndex].text); });

  function starta() {
    $('#inlogg').classList.add('dold');
    $('#app').classList.remove('dold');
    $('#vem').textContent = state.namn;
    lasFlikFranHash();
    rita();
    hamtaAllt();
  }

  /* ---------------- Flikar & filter ---------------- */

  function lasFlikFranHash() {
    var h = (location.hash || '#plan').slice(1);
    state.flik = ['plan', 'leads', 'varma'].indexOf(h) >= 0 ? h : 'plan';
  }
  window.addEventListener('hashchange', function () { lasFlikFranHash(); rita(); });

  function sparaFilter() { sparaLokalt(LS_FILTER, JSON.stringify(state.filter)); }

  function ritaFilter() {
    var f = state.filter;
    var html = '<button type="button" class="chip" data-pub="alla" aria-pressed="' + (f.pub === 'alla') + '">Alla</button>';
    Object.keys(C.PUBLIKATIONER).forEach(function (p) {
      html += '<button type="button" class="chip" data-pub="' + p + '" aria-pressed="' + (f.pub === p) + '"><span class="ruta" style="background:' + C.PUBLIKATIONER[p].farg + '"></span>' + p + '</button>';
    });
    html += '<span class="skiljare" aria-hidden="true"></span>';
    if (state.flik === 'plan') {
      html += '<label class="dold" for="f-status">Status</label><select id="f-status" class="chip" data-valj="status" aria-label="Visa status">' +
        '<option value="alla"' + (f.status === 'alla' ? ' selected' : '') + '>Alla statusar</option>' +
        '<option value="ejpub"' + (f.status === 'ejpub' ? ' selected' : '') + '>Ej publicerade</option>' +
        C.STATUS.map(function (s) { return '<option' + (f.status === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
        '</select>' +
        '<select class="chip" data-valj="sortering" aria-label="Sortera">' +
        '<option value="status"' + (f.sortering === 'status' ? ' selected' : '') + '>Sortera: status</option>' +
        '<option value="datum"' + (f.sortering === 'datum' ? ' selected' : '') + '>Sortera: datum</option>' +
        '</select>';
    }
    if (state.flik === 'leads') html += '<button type="button" class="chip" data-vaxla="ejMeddelade" aria-pressed="' + f.ejMeddelade + '">Ej meddelade</button>';
    html += '<button type="button" class="chip" data-vaxla="mina" aria-pressed="' + f.mina + '">Mina</button>';
    $('#filter').innerHTML = html;

    var h = '';
    if (state.flik === 'plan') {
      h = '<button type="button" class="knapp" id="knapp-import">Klistra in flera</button>' +
          '<button type="button" class="knapp primar" id="knapp-ny">+ Ny artikel</button>';
    } else if (state.flik === 'leads') {
      h = '<button type="button" class="knapp" id="knapp-uppdatera">Uppdatera</button>';
    } else {
      h = '<button type="button" class="knapp" id="knapp-uppdatera">Uppdatera</button>';
    }
    $('#handlingar').innerHTML = h;
  }

  $('#filter').addEventListener('change', function (e) {
    var s = e.target.closest('select[data-valj]');
    if (!s) return;
    state.filter[s.dataset.valj] = s.value;
    sparaFilter();
    rita();
  });

  $('#filter').addEventListener('click', function (e) {
    if (e.target.closest('select')) return;
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pub) state.filter.pub = b.dataset.pub;
    if (b.dataset.vaxla) state.filter[b.dataset.vaxla] = !state.filter[b.dataset.vaxla];
    sparaFilter();
    rita();
  });

  $('#handlingar').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'knapp-ny') oppnaArtikel(null);
    if (b.id === 'knapp-import') oppnaImport();
    if (b.id === 'knapp-uppdatera') hamtaAllt();
  });

  function filtrera(lista, ansvarigFalt) {
    var f = state.filter;
    return lista.filter(function (r) {
      if (f.pub !== 'alla' && r.publikation !== f.pub) return false;
      if (f.mina && r[ansvarigFalt || 'ansvarig'] !== state.namn) return false;
      return true;
    });
  }

  /* ---------------- Rita ---------------- */

  function rita() {
    $$('.flikar a').forEach(function (a) {
      if (a.dataset.flik === state.flik) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#antal-plan').textContent = state.data.artiklar.length ? '· ' + state.data.artiklar.filter(function (a) { return !a.klar; }).length : '';
    $('#antal-leads').textContent = state.data.leads.length ? '· ' + state.data.leads.length : '';
    $('#antal-varma').textContent = state.data.varma.length ? '· ' + state.data.varma.length : '';
    ritaFilter();
    if (state.flik === 'plan') ritaPlan();
    else if (state.flik === 'leads') ritaLeads();
    else ritaVarma();
  }

  /* ----- Redaktionsplan ----- */

  function ritaPlan() {
    var f = state.filter;
    var arPub = function (a) { return a.klar || a.status === 'Publicerad'; };
    var lista = filtrera(state.data.artiklar);
    if (f.status === 'ejpub') lista = lista.filter(function (a) { return !arPub(a); });
    else if (f.status !== 'alla') lista = lista.filter(function (a) { return (a.status || 'Idé') === f.status; });

    var datumAv = function (a) { return a.planeratDatum || a.publiceradDatum || ''; };
    var statusIndex = function (a) { var i = C.STATUS.indexOf(a.status || 'Idé'); return i < 0 ? 0 : i; };
    lista.sort(function (a, b) {
      // Ej publicerade alltid överst
      if (arPub(a) !== arPub(b)) return arPub(a) ? 1 : -1;
      if (arPub(a)) {
        // Publicerade: senaste först
        return String(b.publiceradDatum || datumAv(b)).localeCompare(String(a.publiceradDatum || datumAv(a)));
      }
      if (f.sortering === 'status' && statusIndex(a) !== statusIndex(b)) return statusIndex(b) - statusIndex(a);
      // Närmast datum först, utan datum sist
      return String(datumAv(a) || '9999').localeCompare(String(datumAv(b) || '9999'));
    });

    var forstaPub = lista.findIndex(arPub);
    var rader = lista.map(function (a, i) {
      var skiljerad = (i === forstaPub && i > 0)
        ? '<tr><td colspan="11" style="background:var(--yta2);font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--dampad);padding:10px 12px">Publicerade</td></tr>'
        : '';
      var datum = a.planeratDatum || a.publiceradDatum;
      var vecka = isoVecka(datum);
      var rubrik = saker_url(a.url)
        ? '<button type="button" class="radlank" data-redigera="' + esc(a.id) + '">' + esc(a.rubrik || '(utan rubrik)') + '</button> <a href="' + esc(a.url) + '" target="_blank" rel="noopener" aria-label="Öppna artikeln" title="Öppna artikeln">↗</a>'
        : '<button type="button" class="radlank" data-redigera="' + esc(a.id) + '">' + esc(a.rubrik || '(utan rubrik)') + '</button>';
      var kontakter = kontakterAv(a);
      var vidare;
      if (a.typ === 'Betald') vidare = '<span class="underrad">Betald</span>';
      else if (a.tillLeads) vidare = '<span class="klart-markering">I Leads ✓</span>';
      else vidare = '<button type="button" class="knapp liten" data-tillleads="' + esc(a.id) + '">→ Leads</button>';
      return skiljerad + '<tr class="' + (a.klar ? 'klar' : '') + '">' +
        '<td class="c"><input type="checkbox" data-klar="' + esc(a.id) + '" aria-label="Markera som klar"' + (a.klar ? ' checked' : '') + '></td>' +
        '<td style="white-space:nowrap"><div class="mono underrad">' + (vecka ? 'v.' + vecka : '') + '</div><div style="font-weight:500">' + kortDatum(datum) + '</div></td>' +
        '<td>' + pubBadge(a.publikation) + '</td>' +
        '<td>' + (a.typ === 'Betald' ? '<span class="typ-betald">Betald</span>' : '<span class="typ-red">Redaktionell</span>') + '</td>' +
        '<td class="rubrik">' + rubrik + '</td>' +
        '<td>' + bolagCell(a) + '</td>' +
        '<td style="min-width:170px">' + (kontakter.length
          ? '<div style="font-weight:500">' + esc(kontakter[0].namn || '–') + '</div><div class="underrad">' + esc(kontakter[0].roll || '') + (kontakter.length > 1 ? ' · +' + (kontakter.length - 1) : '') + '</div>'
          : '<button type="button" class="radlank underrad" data-redigera="' + esc(a.id) + '" style="font-weight:400">Lägg till</button>') + '</td>' +
        '<td>' + esc(a.format || '') + '</td>' +
        '<td>' + esc(a.ansvarig || '') + '</td>' +
        '<td><select class="inline-select" data-status="' + esc(a.id) + '" aria-label="Status">' + options(C.STATUS, a.status || 'Idé') + '</select></td>' +
        '<td style="white-space:nowrap">' + vidare + '</td>' +
        '</tr>';
    }).join('');

    var html = '<div class="tabellram"><table style="min-width:1200px"><thead><tr>' +
      '<th class="c">Klar</th><th>Vecka / datum</th><th>Pub.</th><th>Typ</th><th>Rubrik</th><th>Bolag</th><th>PR / marknad</th><th>Format</th><th>Ansvarig</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>' + (rader || '<tr><td colspan="11" class="tom">Inga artiklar här än. Lägg till med <strong>+ Ny artikel</strong> eller <strong>Klistra in flera</strong>.</td></tr>') + '</tbody></table></div>';
    $('#innehall').innerHTML = html;
  }

  // Bolag: sparat värde, annars en gissning ur rubriken (grå, med frågetecken)
  function bolagCell(a) {
    if (a.bolag || a.kundAmne) return esc(a.bolag || a.kundAmne);
    var g = gissaBolag(a.rubrik);
    return g ? '<span class="underrad" title="Gissat ur rubriken – spara genom att redigera artikeln">' + esc(g) + '?</span>' : '';
  }

  $('#innehall').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.klar) {
      var andr = { klar: t.checked };
      if (t.checked) {
        var a = hitta('artiklar', t.dataset.klar);
        if (a && a.status !== 'Publicerad') andr.status = 'Publicerad';
        if (a && !a.publiceradDatum) andr.publiceradDatum = idag();
      }
      andra('artiklar', t.dataset.klar, andr);
    }
    if (t.dataset.status) {
      var s = { status: t.value };
      if (t.value === 'Publicerad') { s.klar = true; var a2 = hitta('artiklar', t.dataset.status); if (a2 && !a2.publiceradDatum) s.publiceradDatum = idag(); }
      andra('artiklar', t.dataset.status, s);
    }
    if (t.dataset.leadbock) {
      var o = {}; o[t.dataset.falt] = t.checked;
      andra('leads', t.dataset.leadbock, o);
    }
    if (t.dataset.steg) {
      andra('varma', t.dataset.steg, { steg: t.value });
    }
  });

  $('#innehall').addEventListener('click', function (e) {
    var b = e.target.closest('[data-redigera],[data-tillleads],[data-leadred],[data-tillvarm],[data-varmred],[data-mejl],[data-logga],[data-taborta],[data-tabortl]');
    if (!b) return;
    if (b.dataset.redigera) oppnaArtikel(hitta('artiklar', b.dataset.redigera));
    if (b.dataset.logga) oppnaArtikel(hitta('artiklar', b.dataset.logga));
    if (b.dataset.tillleads) tillLeads(b.dataset.tillleads, b);
    if (b.dataset.leadred) oppnaLead(hitta('leads', b.dataset.leadred));
    if (b.dataset.tillvarm) tillVarm(b.dataset.tillvarm, b);
    if (b.dataset.varmred) oppnaVarm(hitta('varma', b.dataset.varmred));
    if (b.dataset.mejl) mejla(hitta('leads', b.dataset.mejl));
    if (b.dataset.taborta) { var ta = hitta('artiklar', b.dataset.taborta); taBortMedAngra('artiklar', b.dataset.taborta, 'Artikeln "' + ((ta && ta.rubrik) || '').slice(0, 40) + '" är borttagen'); }
    if (b.dataset.tabortl) { var tl = hitta('leads', b.dataset.tabortl); taBortMedAngra('leads', b.dataset.tabortl, 'Leaden ' + ((tl && tl.foretag) || '') + ' är borttagen'); }
  });

  function hitta(tabell, id) {
    return state.data[tabell].filter(function (r) { return String(r.id) === String(id); })[0];
  }

  function tillLeads(id, knapp) {
    var a = hitta('artiklar', id);
    if (!a) return;
    if (!kontakterAv(a).length && !confirm('Artikeln har ingen kontaktperson än. Skicka vidare ändå? Då skapas en tom rad att fylla i på Leads-fliken.')) return;
    knapp.disabled = true;
    var gissat = !a.bolag && !a.kundAmne ? gissaBolag(a.rubrik) : '';
    var forst = gissat ? api('update', { tabell: 'artiklar', id: id, andringar: { bolag: gissat } }).then(function () { a.bolag = gissat; }) : Promise.resolve();
    forst.then(function () { return api('tillLeads', { id: id }); }).then(function (svar) {
      a.tillLeads = true;
      state.data.leads = state.data.leads.concat(svar.rader);
      rita();
      toast(svar.rader.length === 1 ? '1 lead skapad' : svar.rader.length + ' leads skapade');
    }).catch(function (err) { knapp.disabled = false; toast(err.message, true); });
  }

  /* ----- Leads ----- */

  function ritaLeads() {
    var lista = filtrera(state.data.leads);
    if (state.filter.ejMeddelade) lista = lista.filter(function (l) { return !l.meddelad; });
    lista.sort(function (a, b) {
      if (!!a.meddelad !== !!b.meddelad) return a.meddelad ? 1 : -1;
      return String(b.publiceradDatum || b.skapad).localeCompare(String(a.publiceradDatum || a.skapad));
    });

    var alla = filtrera(state.data.leads);
    var rakna = function (f) { return alla.filter(function (l) { return l[f]; }).length; };

    // Redaktionella, publicerade artiklar som inte skickats vidare
    var vantar = filtrera(state.data.artiklar).filter(function (a) {
      return a.klar && a.typ !== 'Betald' && !a.tillLeads;
    });

    var html = '<div class="siffror">' +
      siffra('Leads', alla.length) + siffra('Meddelade', rakna('meddelad')) + siffra('LinkedIn gjort', rakna('linkedin')) +
      siffra('Ringt', rakna('ringt')) + siffra('Mejlat', rakna('mejlat')) + '</div>';

    if (vantar.length) {
      html += '<section class="vantar" aria-labelledby="vantar-h" style="margin-top:16px"><h2 id="vantar-h">Publicerade – inte skickade till Leads (' + vantar.length + ')</h2>' +
        vantar.map(function (a) {
          var k = kontakterAv(a);
          return '<div class="vantar-rad"><div>' + pubBadge(a.publikation) + ' <strong>' + esc(a.rubrik) + '</strong>' +
            '<div class="underrad" style="font-size:13px;margin-top:3px"><strong style="color:var(--text2)">' + bolagCell(a) + '</strong>' +
            (bolagCell(a) ? ' · ' : '') + (k.length ? esc(k.map(kontaktText).join(' / ')) : 'Ingen kontaktperson än') + ' · ' + esc(a.ansvarig || '') + '</div></div>' +
            '<div class="knapprad"><button type="button" class="knapp liten fara" data-taborta="' + esc(a.id) + '" title="Ta bort artikeln">Ta bort</button>' +
            '<button type="button" class="knapp liten" data-logga="' + esc(a.id) + '">' + (k.length ? 'Redigera' : 'Lägg till kontakt') + '</button>' +
            '<button type="button" class="knapp liten primar" data-tillleads="' + esc(a.id) + '">→ Leads</button></div></div>';
        }).join('') + '</section>';
    }

    var rader = lista.map(function (l) {
      var bock = function (falt, namn) {
        return '<td class="c"' + (falt === 'meddelad' ? ' style="background:#F7F5FB"' : '') + '><input type="checkbox" data-leadbock="' + esc(l.id) + '" data-falt="' + falt + '" aria-label="' + namn + '"' + (l[falt] ? ' checked' : '') + '></td>';
      };
      var artikel = saker_url(l.url)
        ? '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" style="font-weight:600">' + esc(l.artikelRubrik || l.url) + '</a>'
        : '<span style="font-weight:600">' + esc(l.artikelRubrik || '') + '</span>';
      var varm = l.varm ? '<span class="klart-markering">Varm ✓</span>' : '<button type="button" class="knapp liten" data-tillvarm="' + esc(l.id) + '">→ Varm</button>';
      return '<tr class="' + (l.meddelad ? '' : 'markerad') + '">' +
        '<td class="mono underrad" style="white-space:nowrap">' + esc(l.publiceradDatum || '') + '</td>' +
        '<td>' + pubBadge(l.publikation) + '</td>' +
        '<td style="min-width:200px;max-width:280px">' + artikel + '</td>' +
        '<td><button type="button" class="radlank" data-leadred="' + esc(l.id) + '">' + esc(l.foretag || '(företag)') + '</button></td>' +
        '<td><div>' + esc(l.kontaktNamn || '–') + '</div><div class="underrad">' + esc(l.kontaktRoll || '') + (l.mejl ? ' · ' + esc(l.mejl) : '') + (l.telefon ? ' · ' + esc(l.telefon) : '') + '</div></td>' +
        bock('meddelad', 'Meddelad') + bock('linkedin', 'LinkedIn gjort') + bock('ringt', 'Ringt') + bock('mejlat', 'Mejlat') +
        '<td>' + esc(l.ansvarig || '') + '</td>' +
        '<td style="white-space:nowrap"><div class="knapprad" style="gap:6px"><button type="button" class="knapp liten" data-mejl="' + esc(l.id) + '"' + (l.mejl ? '' : ' title="Mejladress saknas"') + '>Mailutkast</button>' + varm + '<button type="button" class="knapp liten fara" data-tabortl="' + esc(l.id) + '" aria-label="Ta bort lead" title="Ta bort lead">×</button></div></td>' +
        '</tr>';
    }).join('');

    html += '<div class="tabellram" style="margin-top:16px"><table style="min-width:1220px"><thead><tr>' +
      '<th>Publicerad</th><th>Pub.</th><th>Artikel</th><th>Företag</th><th>Kontakt</th>' +
      '<th class="c">Meddelad</th><th class="c">LinkedIn</th><th class="c">Ringt</th><th class="c">Mejlat</th><th>Ansvarig</th><th><span class="dold">Åtgärder</span></th>' +
      '</tr></thead><tbody>' + (rader || '<tr><td colspan="11" class="tom">Inga leads här än. Skicka artiklar hit med <strong>→ Leads</strong> i Redaktionsplanen.</td></tr>') + '</tbody></table></div>';
    $('#innehall').innerHTML = html;
  }

  function siffra(etikett, tal, under) {
    return '<div class="siffra"><div class="etikett">' + esc(etikett) + '</div><div class="tal">' + esc(tal) + '</div>' + (under ? '<div class="under">' + esc(under) + '</div>' : '') + '</div>';
  }

  function narText(datum) {
    if (!datum) return 'nyligen';
    var dagar = Math.round((new Date(idag() + 'T12:00:00') - new Date(datum + 'T12:00:00')) / 86400000);
    return dagar === 0 ? 'idag' : dagar === 1 ? 'igår' : 'nyligen';
  }

  function mejla(l) {
    if (!l) return;
    var mall = C.MALLAR[l.publikation] || C.MALLAR.HO;
    var namn = String(l.kontaktNamn || '').trim();
    var ers = {
      fornamn: namn.split(/\s+/)[0] || '', namn: namn, foretag: l.foretag || '',
      rubrik: l.artikelRubrik || '', url: l.url || '', avsandare: state.namn,
      kollega: state.namn === 'Mikael' ? 'Kalle' : 'Mikael',
      publikation: (C.PUBLIKATIONER[l.publikation] || {}).namn || '',
      nar: narText(l.publiceradDatum)
    };
    var fyll = function (s) { return s.replace(/\{(\w+)\}/g, function (_, k) { return ers[k] != null ? ers[k] : ''; }); };
    var till = encodeURIComponent(l.mejl || ''), amne = encodeURIComponent(fyll(mall.amne)), text = encodeURIComponent(fyll(mall.text));
    var val = lasLokalt(LS_MEJL) || 'gmail';
    if (val === 'gmail') window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + till + '&su=' + amne + '&body=' + text, '_blank', 'noopener');
    else if (val === 'outlook') window.open('https://outlook.office.com/mail/deeplink/compose?to=' + till + '&subject=' + amne + '&body=' + text, '_blank', 'noopener');
    else window.location.href = 'mailto:' + till + '?subject=' + amne + '&body=' + text;
    if (!l.mejlat) {
      setTimeout(function () {
        if (confirm('Bocka i Mejlat och Meddelad för ' + (l.foretag || 'leaden') + '?')) andra('leads', l.id, { mejlat: true, meddelad: true });
      }, 800);
    }
  }

  function tillVarm(id, knapp) {
    knapp.disabled = true;
    api('tillVarm', { id: id, steg: C.STEG[0] }).then(function (svar) {
      var l = hitta('leads', id); if (l) l.varm = true;
      state.data.varma.push(svar.rad);
      rita();
      toast('Tillagd på Varma leads');
    }).catch(function (err) { knapp.disabled = false; toast(err.message, true); });
  }

  /* ----- Varma leads ----- */

  function ritaVarma() {
    var lista = filtrera(state.data.varma);
    var html = '<div class="siffror">';
    C.STEG.forEach(function (s) {
      var i = lista.filter(function (v) { return v.steg === s; });
      var summa = i.reduce(function (acc, v) { return acc + (Number(v.belopp) || 0); }, 0);
      html += siffra(s, i.length, summa ? kronor(summa) : '');
    });
    html += '</div><div class="tavla" style="margin-top:16px">';
    C.STEG.forEach(function (s) {
      var kort = lista.filter(function (v) { return (v.steg || C.STEG[0]) === s; });
      kort.sort(function (a, b) { return String(a.nastaDatum || '9999').localeCompare(String(b.nastaDatum || '9999')); });
      html += '<section class="kolumn" aria-label="' + esc(s) + '"><h2><span>' + esc(s) + '</span><span class="mono underrad">' + kort.length + '</span></h2>' +
        kort.map(ritaKort).join('') + '</section>';
    });
    html += '</div>';
    $('#innehall').innerHTML = html;
  }

  function ritaKort(v) {
    var sen = v.nastaDatum && v.nastaDatum < idag();
    return '<article class="kort">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div>' +
      '<button type="button" class="radlank foretag" data-varmred="' + esc(v.id) + '">' + esc(v.foretag || '(företag)') + '</button>' +
      '<div class="rad">' + esc(v.kontaktNamn || '') + (v.kontaktRoll ? ' · ' + esc(v.kontaktRoll) : '') + '</div></div>' + pubBadge(v.publikation) + '</div>' +
      (v.artikelRubrik ? '<div class="underrad">Via: ' + esc(v.artikelRubrik) + '</div>' : '') +
      (Number(v.belopp) ? '<div style="font-size:14px"><span class="underrad">Belopp</span> <strong>' + kronor(v.belopp) + '</strong></div>' : '') +
      '<div class="nasta"><span class="etikett">Nästa steg</span><span>' + esc(v.nastaSteg || '–') + '</span>' +
      '<div class="fot"><span class="mono' + (sen ? ' forsenad' : '') + '">' + (v.nastaDatum ? kortDatum(v.nastaDatum) : '') + '</span><span>' + esc(v.ansvarig || '') + '</span></div></div>' +
      '<select class="inline-select" data-steg="' + esc(v.id) + '" aria-label="Flytta till">' + options(C.STEG, v.steg || C.STEG[0]) + '</select>' +
      '</article>';
  }

  /* ---------------- Dialoger ---------------- */

  $$('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-stang]')) d.close();
    });
  });

  /* ----- Artikel ----- */

  var artikelRed = null;
  var artikelPub = 'HO';
  var artikelTyp = 'Redaktionell';

  function ritaPubVal() {
    $('#a-pub').innerHTML = Object.keys(C.PUBLIKATIONER).map(function (p) {
      var info = C.PUBLIKATIONER[p];
      return '<button type="button" data-p="' + p + '" aria-pressed="' + (artikelPub === p) + '"><span class="ruta" style="width:10px;height:10px;border-radius:3px;display:inline-block;background:' + info.farg + '"></span>' + esc(info.namn) + '</button>';
    }).join('');
  }
  function ritaTyp() {
    $$('#dlg-artikel .segment button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.typ === artikelTyp)); });
    $('#a-typ-text').textContent = artikelTyp === 'Betald' ? 'Betald – går inte vidare till Leads.' : 'Kan skickas vidare till Leads när den är publicerad.';
  }
  $('#a-pub').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    artikelPub = b.dataset.p; ritaPubVal();
  });
  $$('#dlg-artikel .segment button').forEach(function (b) {
    b.addEventListener('click', function () { artikelTyp = b.dataset.typ; ritaTyp(); });
  });

  function kontaktHtml(k) {
    k = k || {};
    return '<div class="kontakt">' +
      klistraHtml() +
      '<button type="button" class="knapp liten ta-bort" aria-label="Ta bort kontakt" title="Ta bort kontakt">×</button>' +
      '<details class="kontakt-detaljer">' + sammanfattningHtml(k) +
        '<div class="rutnat2">' +
          '<div class="falt"><span>Namn</span><input type="text" data-k="namn" value="' + esc(k.namn) + '"></div>' +
          '<div class="falt"><span>Roll</span><input type="text" data-k="roll" value="' + esc(k.roll) + '" placeholder="T.ex. kommunikationschef"></div>' +
          '<div class="falt"><span>Mejl</span><input type="email" data-k="mejl" value="' + esc(k.mejl) + '"></div>' +
          '<div class="falt"><span>Telefon</span><input type="text" data-k="telefon" value="' + esc(k.telefon) + '"></div>' +
          '<div class="falt" style="grid-column:1 / -1"><span>Företag <span style="font-weight:400;color:var(--dampad)">– om annat än artikelns bolag</span></span><input type="text" data-k="foretag" value="' + esc(k.foretag) + '"></div>' +
        '</div>' +
      '</details>' +
      '</div>';
  }

  // Kort rad som visar det som är ifyllt; klick fäller ut fälten
  function sammanfattningHtml(k) {
    return '<summary><span class="sammanfattning">' + esc(sammanfattningText(k)) + '</span><span class="andra-lank">Ändra</span></summary>';
  }
  function sammanfattningText(k) {
    var delar = [k.namn, k.roll, k.mejl, k.telefon, k.foretag].filter(function (v) { return v && String(v).trim(); });
    return delar.length ? delar.join(' · ') : 'Ingen kontaktperson ifylld – klistra in ovan eller fyll i för hand';
  }
  function uppdateraSammanfattning(rot) {
    var d = rot && $('.kontakt-detaljer', rot);
    if (!d) return;
    var v = function (sel) { var el = $(sel, d); return el ? el.value : ''; };
    var k = {
      namn: v('[data-k=namn],[data-f=kNamn]'), roll: v('[data-k=roll],[data-f=kRoll]'),
      mejl: v('[data-k=mejl],[data-f=kMejl]'), telefon: v('[data-k=telefon],[data-f=kTel]'), foretag: v('[data-k=foretag]')
    };
    $('.sammanfattning', d).textContent = sammanfattningText(k);
  }

  /* ----- Klistra in kontaktuppgifter i ett fält ----- */

  function klistraHtml() {
    return '<div class="falt klistra-falt"><span>Klistra in kontaktuppgifter <span style="font-weight:400;color:var(--dampad)">– signatur eller rad ur pressmeddelande, fälten fylls i själva</span></span>' +
      '<textarea class="klistra" data-klistra rows="2" placeholder="T.ex. Anna Andersson, kommunikationschef, 070-123 45 67, anna@foretag.se"></textarea>' +
      '<span class="hjalp klistra-info" aria-live="polite"></span></div>';
  }

  // Fyller fälten i "rot" utifrån den inklistrade texten. falt = { namn: selector, roll: ..., mejl: ..., telefon: ..., foretag: ... }
  function fyllKontakt(textarea, rot, falt, efter) {
    var tolkat = window.tolkaKontakt(textarea.value);
    var ifyllda = [];
    Object.keys(falt).forEach(function (k) {
      var el = $(falt[k], rot);
      if (el && tolkat[k]) {
        el.value = tolkat[k];
        ifyllda.push({ namn: 'namn', roll: 'roll', mejl: 'mejl', telefon: 'telefon', foretag: 'företag' }[k]);
        if (efter) efter(el, tolkat[k]);
      }
    });
    uppdateraSammanfattning(rot.closest('.kontakt, .kontakt-ruta') || rot);
    var info = $('.klistra-info', textarea.parentNode);
    if (info) info.textContent = textarea.value.trim()
      ? (ifyllda.length ? 'Ifyllt: ' + ifyllda.join(', ') + '. Kontrollera gärna.' : 'Hittade inget att fylla i – skriv in uppgifterna själv.')
      : '';
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.closest && t.closest('.kontakt-detaljer')) { uppdateraSammanfattning(t.closest('.kontakt, .kontakt-ruta')); return; }
    if (!t.matches || !t.matches('[data-klistra]')) return;
    clearTimeout(t._tid);
    t._tid = setTimeout(function () {
      var kontakt = t.closest('.kontakt');
      var imp = t.closest('[data-i]');
      if (kontakt) {
        fyllKontakt(t, kontakt, { namn: '[data-k=namn]', roll: '[data-k=roll]', mejl: '[data-k=mejl]', telefon: '[data-k=telefon]', foretag: '[data-k=foretag]' });
      } else if (imp) {
        var rad = importRader[Number(imp.dataset.i)];
        fyllKontakt(t, $('.kontakt-ruta', imp) || imp, { namn: '[data-f=kNamn]', roll: '[data-f=kRoll]', mejl: '[data-f=kMejl]', telefon: '[data-f=kTel]' }, function (el, v) { rad[el.dataset.f] = v; });
      } else if (t.closest('#dlg-lead')) {
        fyllKontakt(t, $('#dlg-lead'), { namn: '#l-namn', roll: '#l-roll', mejl: '#l-mejl', telefon: '#l-tel', foretag: '#l-foretag' });
      }
    }, 250);
  });

  $('#a-ny-kontakt').addEventListener('click', function () {
    $('#a-kontakter').insertAdjacentHTML('beforeend', kontaktHtml({}));
  });
  $('#a-kontakter').addEventListener('click', function (e) {
    if (e.target.closest('.ta-bort')) e.target.closest('.kontakt').remove();
  });

  function oppnaArtikel(a) {
    artikelRed = a || null;
    a = a || {};
    $('#dlg-artikel-h').textContent = artikelRed ? 'Redigera artikel' : 'Ny artikel';
    $('#a-spara').textContent = artikelRed ? 'Spara' : 'Lägg till';
    $('#a-ta-bort').classList.toggle('dold', !artikelRed);
    artikelPub = a.publikation || (state.filter.pub !== 'alla' ? state.filter.pub : 'HO');
    artikelTyp = a.typ || 'Redaktionell';
    $('#a-url').value = a.url || '';
    $('#a-rubrik').value = a.rubrik || '';
    $('#a-format').innerHTML = options(C.FORMAT, a.format || C.FORMAT[0]);
    $('#a-datum').value = a.planeratDatum || '';
    var ansv = a.ansvarig || (C.ANSVARIGA.indexOf(state.namn) >= 0 ? state.namn : C.ANSVARIGA[0]);
    $('#a-ansvarig').innerHTML = options(C.ANSVARIGA, ansv);
    $('#a-status').innerHTML = options(C.STATUS, a.status || 'Idé');
    $('#a-pubdatum').value = a.publiceradDatum || '';
    $('#a-bolag').value = a.bolag || '';
    var k = kontakterAv(a);
    $('#a-kontakter').innerHTML = (k.length ? k : [{}]).map(kontaktHtml).join('');
    $('#a-hamta-info').textContent = 'Är artikeln redan publicerad? Klistra in länken så fylls publikation, rubrik och datum i automatiskt.';
    ritaPubVal(); ritaTyp();
    $('#dlg-artikel').showModal();
  }

  $('#a-hamta').addEventListener('click', function () {
    var url = $('#a-url').value.trim();
    if (!saker_url(url)) { toast('Klistra in en hel länk som börjar med https://', true); return; }
    var knapp = this; knapp.disabled = true;
    $('#a-hamta-info').textContent = 'Hämtar…';
    api('hamta', { urls: [url] }).then(function (svar) {
      var r = svar.artiklar[0] || {};
      if (r.fel) { $('#a-hamta-info').textContent = r.fel + '. Fyll i uppgifterna själv.'; return; }
      if (r.publikation) { artikelPub = r.publikation; ritaPubVal(); }
      if (r.rubrik) $('#a-rubrik').value = r.rubrik;
      if (r.rubrik && !$('#a-bolag').value.trim()) $('#a-bolag').value = gissaBolag(r.rubrik);
      if (r.publiceradDatum) { $('#a-pubdatum').value = r.publiceradDatum; if (!$('#a-datum').value) $('#a-datum').value = r.publiceradDatum; $('#a-status').value = 'Publicerad'; }
      $('#a-hamta-info').textContent = r.finnsRedan && !artikelRed ? 'Obs! Den här länken finns redan i planen.' : 'Hämtat. Kontrollera uppgifterna.';
    }).catch(function (e) { $('#a-hamta-info').textContent = 'Kunde inte hämta: ' + e.message; })
      .then(function () { knapp.disabled = false; });
  });

  $('#form-artikel').addEventListener('submit', function (e) {
    e.preventDefault();
    var kontakter = $$('#a-kontakter .kontakt').map(function (div) {
      var o = {};
      $$('[data-k]', div).forEach(function (i) { if (i.value.trim()) o[i.dataset.k] = i.value.trim(); });
      return o;
    }).filter(function (o) { return Object.keys(o).length; });
    var status = $('#a-status').value;
    var rad = {
      publikation: artikelPub,
      rubrik: $('#a-rubrik').value.trim(),
      format: $('#a-format').value,
      planeratDatum: $('#a-datum').value,
      ansvarig: $('#a-ansvarig').value,
      typ: artikelTyp,
      status: status,
      url: $('#a-url').value.trim(),
      publiceradDatum: $('#a-pubdatum').value,
      bolag: $('#a-bolag').value.trim(),
      kontakter: JSON.stringify(kontakter)
    };
    if (!rad.rubrik) { toast('Skriv en rubrik', true); return; }
    if (status === 'Publicerad') rad.klar = true;
    var knapp = $('#a-spara'); knapp.disabled = true;
    var p = artikelRed
      ? andra('artiklar', artikelRed.id, rad)
      : api('add', { tabell: 'artiklar', rad: rad }).then(function (svar) { state.data.artiklar.push(svar.rad); rita(); });
    p.then(function () { $('#dlg-artikel').close(); toast(artikelRed ? 'Sparat' : 'Artikeln är tillagd'); })
      .catch(function (err) { toast(err.message, true); })
      .then(function () { knapp.disabled = false; });
  });

  $('#a-ta-bort').addEventListener('click', function () {
    if (!artikelRed || !confirm('Ta bort "' + (artikelRed.rubrik || 'artikeln') + '"? Leads som redan skapats ligger kvar.')) return;
    var id = artikelRed.id;
    api('delete', { tabell: 'artiklar', id: id }).then(function () {
      state.data.artiklar = state.data.artiklar.filter(function (a) { return String(a.id) !== String(id); });
      $('#dlg-artikel').close(); rita(); toast('Borttagen');
    }).catch(function (err) { toast(err.message, true); });
  });

  /* ----- Klistra in flera ----- */

  var importRader = [];

  function oppnaImport() {
    importRader = [];
    $('#i-lankar').value = '';
    $('#i-resultat').innerHTML = '';
    $('#i-spara').disabled = true;
    $('#i-spara').textContent = 'Lägg till i planen';
    $('#dlg-import').showModal();
    $('#i-lankar').focus();
  }

  $('#i-hamta').addEventListener('click', function () {
    var urls = ($('#i-lankar').value.match(/https?:\/\/[^\s<>"',;]+/gi) || []);
    if (!urls.length) { toast('Hittade inga länkar', true); return; }
    var knapp = this; knapp.disabled = true;
    $('#i-resultat').innerHTML = '<div class="hjalp">Hämtar ' + urls.length + ' artiklar…</div>';
    api('hamta', { urls: urls }).then(function (svar) {
      importRader = svar.artiklar.map(function (r) {
        return Object.assign({ typ: 'Redaktionell', ansvarig: C.ANSVARIGA.indexOf(state.namn) >= 0 ? state.namn : C.ANSVARIGA[0], bolag: gissaBolag(r.rubrik) }, r);
      });
      ritaImport();
    }).catch(function (e) { $('#i-resultat').innerHTML = '<div class="felmeddelande">Kunde inte hämta: ' + esc(e.message) + '</div>'; })
      .then(function () { knapp.disabled = false; });
  });

  function ritaImport() {
    var nya = importRader.filter(function (r) { return !r.finnsRedan; });
    var html = '<h3 style="margin:4px 0 0;font-size:16px">' + nya.length + ' nya artiklar' +
      (importRader.length - nya.length ? ' <span style="font-weight:400;color:var(--dampad)">· ' + (importRader.length - nya.length) + ' finns redan</span>' : '') + '</h3>';
    html += importRader.map(function (r, i) {
      if (r.finnsRedan) {
        return '<div class="imp-kort finns"><div><strong>Finns redan:</strong> ' + esc(r.rubrik || r.url) + ' – hoppas över.</div></div>';
      }
      var pubOpts = Object.keys(C.PUBLIKATIONER).map(function (p) { return '<option value="' + p + '"' + (r.publikation === p ? ' selected' : '') + '>' + p + ' – ' + esc(C.PUBLIKATIONER[p].namn) + '</option>'; }).join('');
      return '<div class="imp-kort' + (r.fel ? ' fel' : '') + '" data-i="' + i + '">' +
        (r.fel ? '<div class="felmeddelande">' + esc(r.fel) + ' – fyll i rubriken själv.</div>' : '') +
        '<div class="imp-topp"><div class="falt"><span>Rubrik</span><input type="text" data-f="rubrik" value="' + esc(r.rubrik) + '"></div></div>' +
        '<div class="underrad mono" style="word-break:break-all">' + esc(r.url) + '</div>' +
        '<div class="rutnat4">' +
          '<div class="falt"><span>Publikation</span><select data-f="publikation"><option value="">–</option>' + pubOpts + '</select></div>' +
          '<div class="falt"><span>Publicerad</span><input type="date" data-f="publiceradDatum" value="' + esc(r.publiceradDatum) + '"></div>' +
          '<div class="falt"><span>Ansvarig hos oss</span><select data-f="ansvarig">' + options(C.ANSVARIGA, r.ansvarig) + '</select></div>' +
          '<div class="falt"><span>Typ</span><select data-f="typ">' + options(['Redaktionell', 'Betald'], r.typ) + '</select></div>' +
        '</div>' +
        '<div class="falt"><span>Bolag som nämns <span style="font-weight:400;color:var(--dampad)">– separera med komma</span></span><input type="text" data-f="bolag" value="' + esc(r.bolag) + '"></div>' +
        '<div class="kontakt-ruta">' + klistraHtml() +
          '<details class="kontakt-detaljer">' + sammanfattningHtml({ namn: r.kNamn, roll: r.kRoll, mejl: r.kMejl, telefon: r.kTel }) +
            '<div class="rutnat4">' +
              '<div class="falt"><span>Kontaktperson</span><input type="text" data-f="kNamn" value="' + esc(r.kNamn) + '"></div>' +
              '<div class="falt"><span>Roll</span><input type="text" data-f="kRoll" value="' + esc(r.kRoll) + '" placeholder="Marknad / kommunikation"></div>' +
              '<div class="falt"><span>Mejl</span><input type="email" data-f="kMejl" value="' + esc(r.kMejl) + '"></div>' +
              '<div class="falt"><span>Telefon</span><input type="text" data-f="kTel" value="' + esc(r.kTel) + '"></div>' +
            '</div>' +
          '</details>' +
        '</div>' +
      '</div>';
    }).join('');
    $('#i-resultat').innerHTML = html;
    $('#i-spara').disabled = !nya.length;
    $('#i-spara').textContent = nya.length ? 'Lägg till ' + nya.length + ' i planen' : 'Lägg till i planen';
  }

  $('#i-resultat').addEventListener('input', function (e) {
    var kort = e.target.closest('[data-i]'); if (!kort || !e.target.dataset.f) return;
    importRader[Number(kort.dataset.i)][e.target.dataset.f] = e.target.value;
  });
  $('#i-resultat').addEventListener('change', function (e) {
    var kort = e.target.closest('[data-i]'); if (!kort || !e.target.dataset.f) return;
    importRader[Number(kort.dataset.i)][e.target.dataset.f] = e.target.value;
  });

  $('#i-spara').addEventListener('click', function () {
    var rader = importRader.filter(function (r) { return !r.finnsRedan; }).map(function (r) {
      var kontakter = [];
      if (r.kNamn || r.kMejl) kontakter.push({ namn: r.kNamn || '', roll: r.kRoll || '', mejl: r.kMejl || '', telefon: r.kTel || '' });
      return {
        publikation: r.publikation || '', rubrik: (r.rubrik || '').trim() || r.url, url: r.url,
        publiceradDatum: r.publiceradDatum || '', planeratDatum: r.publiceradDatum || '',
        ansvarig: r.ansvarig, typ: r.typ, status: 'Publicerad', klar: true,
        bolag: r.bolag || '', format: 'Nyhet', kontakter: JSON.stringify(kontakter)
      };
    });
    if (!rader.length) return;
    var knapp = this; knapp.disabled = true;
    api('addMany', { tabell: 'artiklar', rader: rader }).then(function (svar) {
      state.data.artiklar = state.data.artiklar.concat(svar.rader);
      $('#dlg-import').close();
      rita();
      toast(svar.rader.length + ' artiklar tillagda');
    }).catch(function (err) { knapp.disabled = false; toast(err.message, true); });
  });

  /* ----- Lead ----- */

  var leadRed = null;
  function oppnaLead(l) {
    if (!l) return;
    leadRed = l;
    $('#l-artikel').innerHTML = (l.artikelRubrik ? 'Från: <strong>' + esc(l.artikelRubrik) + '</strong>' : '');
    $('#l-klistra').innerHTML = klistraHtml();
    $('#l-foretag').value = l.foretag || '';
    $('#l-namn').value = l.kontaktNamn || '';
    $('#l-roll').value = l.kontaktRoll || '';
    $('#l-mejl').value = l.mejl || '';
    $('#l-tel').value = l.telefon || '';
    $('#l-anteckning').value = l.anteckning || '';
    $('#l-ansvarig').innerHTML = options(C.ANSVARIGA, l.ansvarig || C.ANSVARIGA[0]);
    $('#dlg-lead').showModal();
  }
  $('#form-lead').addEventListener('submit', function (e) {
    e.preventDefault();
    andra('leads', leadRed.id, {
      foretag: $('#l-foretag').value.trim(), kontaktNamn: $('#l-namn').value.trim(), kontaktRoll: $('#l-roll').value.trim(),
      mejl: $('#l-mejl').value.trim(), telefon: $('#l-tel').value.trim(), anteckning: $('#l-anteckning').value, ansvarig: $('#l-ansvarig').value
    }).then(function () { toast('Sparat'); }).catch(function () {});
    $('#dlg-lead').close();
  });
  $('#l-ta-bort').addEventListener('click', function () {
    if (!leadRed || !confirm('Ta bort leaden ' + (leadRed.foretag || '') + '?')) return;
    var id = leadRed.id;
    api('delete', { tabell: 'leads', id: id }).then(function () {
      state.data.leads = state.data.leads.filter(function (l) { return String(l.id) !== String(id); });
      $('#dlg-lead').close(); rita(); toast('Borttagen');
    }).catch(function (err) { toast(err.message, true); });
  });

  /* ----- Varm ----- */

  var varmRed = null;
  function oppnaVarm(v) {
    if (!v) return;
    varmRed = v;
    $('#v-artikel').innerHTML = v.artikelRubrik ? 'Via: <strong>' + esc(v.artikelRubrik) + '</strong>' : '';
    $('#v-foretag').value = v.foretag || '';
    $('#v-steg').innerHTML = options(C.STEG, v.steg || C.STEG[0]);
    $('#v-namn').value = v.kontaktNamn || '';
    $('#v-belopp').value = v.belopp || '';
    $('#v-nasta').value = v.nastaSteg || '';
    $('#v-datum').value = v.nastaDatum || '';
    $('#v-ansvarig').innerHTML = options(C.ANSVARIGA, v.ansvarig || C.ANSVARIGA[0]);
    $('#v-anteckning').value = v.anteckning || '';
    $('#dlg-varm').showModal();
  }
  $('#form-varm').addEventListener('submit', function (e) {
    e.preventDefault();
    andra('varma', varmRed.id, {
      foretag: $('#v-foretag').value.trim(), steg: $('#v-steg').value, kontaktNamn: $('#v-namn').value.trim(),
      belopp: $('#v-belopp').value ? Number($('#v-belopp').value) : '', nastaSteg: $('#v-nasta').value.trim(),
      nastaDatum: $('#v-datum').value, ansvarig: $('#v-ansvarig').value, anteckning: $('#v-anteckning').value
    }).then(function () { toast('Sparat'); }).catch(function () {});
    $('#dlg-varm').close();
  });
  $('#v-ta-bort').addEventListener('click', function () {
    if (!varmRed || !confirm('Ta bort ' + (varmRed.foretag || 'kortet') + ' från Varma leads?')) return;
    var id = varmRed.id;
    api('delete', { tabell: 'varma', id: id }).then(function () {
      state.data.varma = state.data.varma.filter(function (v) { return String(v.id) !== String(id); });
      $('#dlg-varm').close(); rita(); toast('Borttagen');
    }).catch(function (err) { toast(err.message, true); });
  });

  /* ---------------- Start ---------------- */

  // Hämta nytt när fliken blir aktiv igen och varje minut, så alla ser varandras ändringar
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state.kod && !document.querySelector('dialog[open]')) hamtaAllt(true);
  });
  setInterval(function () {
    if (!document.hidden && state.kod && !document.querySelector('dialog[open]')) hamtaAllt(true);
  }, 60000);

  if (state.kod && state.namn) starta(); else visaInlogg('');
})();

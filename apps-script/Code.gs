/**
 * Redaktion + leads – backend för Commercial Insights
 * ----------------------------------------------------
 * Ligger i Google Sheet "Redaktion + leads – CI" (Tillägg → Apps Script).
 * Sidan på GitHub Pages pratar med den här koden via webbappens URL.
 *
 * FÖRSTA GÅNGEN:
 *   1. Kör funktionen  setup  (välj den i listan ovanför koden, tryck Kör).
 *      Den skapar flikarna och ber dig välja en teamkod.
 *   2. Distribuera → Ny distribution → Webbapp
 *        Kör som: Jag   ·   Åtkomst: Alla
 *   3. Kopiera webbappens URL och lägg in den i config.js i repot.
 *
 * VID UPPDATERING AV KODEN:
 *   Distribuera → Hantera distributioner → redigera (pennan) → Version: Ny version.
 *   Då behåller webbappen samma URL.
 */

var TABELLER = {
  artiklar: {
    flik: 'Redaktionsplan',
    kolumner: ['id', 'skapad', 'publikation', 'rubrik', 'kundAmne', 'format', 'planeratDatum',
      'ansvarig', 'typ', 'status', 'klar', 'url', 'publiceradDatum', 'bolag', 'kontakter',
      'tillLeads', 'uppdaterad']
  },
  leads: {
    flik: 'Leads',
    kolumner: ['id', 'skapad', 'artikelId', 'publikation', 'artikelRubrik', 'url', 'publiceradDatum',
      'foretag', 'kontaktNamn', 'kontaktRoll', 'mejl', 'telefon', 'meddelad', 'linkedin', 'ringt',
      'mejlat', 'ansvarig', 'anteckning', 'varm', 'uppdaterad']
  },
  varma: {
    flik: 'Varma leads',
    kolumner: ['id', 'skapad', 'leadId', 'foretag', 'kontaktNamn', 'kontaktRoll', 'publikation',
      'artikelRubrik', 'steg', 'belopp', 'nastaSteg', 'nastaDatum', 'ansvarig', 'anteckning', 'uppdaterad']
  }
};

// Kolumner som lagras som sant/falskt
var BOOL = ['klar', 'tillLeads', 'meddelad', 'linkedin', 'ringt', 'mejlat', 'varm'];

var DOMANER = {
  'hallbaromstallning.se': 'HO',
  'dagensmedarbetare.se': 'DM',
  'dagensrapport.se': 'DR'
};

/* ============================== SETUP ============================== */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABELLER).forEach(function (namn) {
    var t = TABELLER[namn];
    var sh = ss.getSheetByName(t.flik) || ss.insertSheet(t.flik);
    sh.getRange(1, 1, 1, t.kolumner.length).setValues([t.kolumner]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  // Ta bort standardfliken om den är tom
  var std = ss.getSheetByName('Blad1') || ss.getSheetByName('Sheet1');
  if (std && std.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(std);

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TEAMKOD')) {
    var ui = SpreadsheetApp.getUi();
    var svar = ui.prompt('Teamkod', 'Välj en kod som du, Kalle, Johan och Andreas anger första gången de öppnar verktyget:', ui.ButtonSet.OK);
    var kod = (svar.getResponseText() || '').trim();
    if (kod) props.setProperty('TEAMKOD', kod);
  }
  SpreadsheetApp.getActive().toast('Klart! Flikarna är skapade.');
}

/**
 * Spara inloggningen till WordPress (applikationslösenord) för publiceringsverktyget.
 * Kör den här funktionen. Lösenorden sparas i Script Properties och syns aldrig på GitHub
 * eller i webbläsaren. Tryck Avbryt för en sajt du inte vill ändra.
 */
function sparaWordPress() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var sparade = [];
  Object.keys(WP_SAJTER).forEach(function (s) {
    var namn = WP_SAJTER[s].namn;
    var u = ui.prompt(namn + ' – användarnamn', 'Användarnamnet på WordPress-kontot (t.ex. Redaktor). Avbryt = hoppa över ' + namn + '.', ui.ButtonSet.OK_CANCEL);
    if (u.getSelectedButton() !== ui.Button.OK || !u.getResponseText().trim()) return;
    var l = ui.prompt(namn + ' – applikationslösenord', 'Klistra in applikationslösenordet för ' + u.getResponseText().trim() + '.', ui.ButtonSet.OK_CANCEL);
    if (l.getSelectedButton() !== ui.Button.OK || !l.getResponseText().trim()) return;
    props.setProperty('WP_' + s.toUpperCase() + '_USER', u.getResponseText().trim());
    props.setProperty('WP_' + s.toUpperCase() + '_PASS', l.getResponseText().trim());
    sparade.push(namn);
  });
  ui.alert(sparade.length ? 'Sparat för: ' + sparade.join(', ') + '.' : 'Inget ändrades.');
}

/** Testar inloggningen mot alla sajter. Kör den efter sparaWordPress. */
function testaWordPress() {
  var rader = Object.keys(WP_SAJTER).map(function (s) {
    var a = wpAuth_(s);
    if (!a) return WP_SAJTER[s].namn + ': ingen inloggning sparad';
    var r = UrlFetchApp.fetch(WP_SAJTER[s].api + '/users/me?context=edit', { headers: { Authorization: a }, muteHttpExceptions: true });
    var k = r.getResponseCode();
    if (k !== 200) return WP_SAJTER[s].namn + ': FEL (' + k + ')';
    var u = JSON.parse(r.getContentText());
    return WP_SAJTER[s].namn + ': OK – ' + u.name + ' (' + (u.roles || []).join(', ') + ')';
  });
  SpreadsheetApp.getUi().alert(rader.join('\n'));
}

/** Byt teamkod i efterhand: kör den här funktionen. */
function bytTeamkod() {
  var ui = SpreadsheetApp.getUi();
  var svar = ui.prompt('Ny teamkod', 'Ange ny kod:', ui.ButtonSet.OK_CANCEL);
  if (svar.getSelectedButton() === ui.Button.OK && svar.getResponseText().trim()) {
    PropertiesService.getScriptProperties().setProperty('TEAMKOD', svar.getResponseText().trim());
    ui.alert('Teamkoden är bytt.');
  }
}

/* ============================== WEBBAPP ============================== */

function doGet(e) {
  return hantera_(e.parameter || {});
}

function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { return svara_({ ok: false, fel: 'Ogiltig förfrågan' }); }
  return hantera_(data);
}

function hantera_(req) {
  try {
    var kod = PropertiesService.getScriptProperties().getProperty('TEAMKOD');
    if (!kod || req.kod !== kod) return svara_({ ok: false, fel: 'fel_kod' });

    switch (req.action) {
      case 'ping': return svara_({ ok: true });
      case 'list': return svara_({ ok: true, data: listaAllt_() });
      case 'add': return svara_({ ok: true, rad: medLas_(function () { return laggTill_(req.tabell, req.rad); }) });
      case 'addMany': return svara_({ ok: true, rader: medLas_(function () {
        return (req.rader || []).map(function (r) { return laggTill_(req.tabell, r); });
      }) });
      case 'update': return svara_({ ok: true, rad: medLas_(function () { return uppdatera_(req.tabell, req.id, req.andringar); }) });
      case 'delete': medLas_(function () { taBort_(req.tabell, req.id); }); return svara_({ ok: true });
      case 'tillLeads': return svara_({ ok: true, rader: medLas_(function () { return tillLeads_(req.id); }) });
      case 'tillVarm': return svara_({ ok: true, rad: medLas_(function () { return tillVarm_(req.id, req.steg); }) });
      case 'hamta': return svara_({ ok: true, artiklar: hamtaMeta_(req.urls || []) });
      case 'publicera': return svara_(publicera_(req));
      default: return svara_({ ok: false, fel: 'Okänd åtgärd' });
    }
  } catch (err) {
    return svara_({ ok: false, fel: String(err && err.message || err) });
  }
}

function svara_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function medLas_(fn) {
  var las = LockService.getScriptLock();
  las.waitLock(20000);
  try { return fn(); } finally { las.releaseLock(); }
}

/* ============================== DATA ============================== */

function flik_(tabell) {
  var t = TABELLER[tabell];
  if (!t) throw new Error('Okänd tabell: ' + tabell);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t.flik);
  if (!sh) throw new Error('Fliken "' + t.flik + '" saknas – kör setup.');
  return { sh: sh, kol: t.kolumner };
}

function lasRader_(tabell) {
  var f = flik_(tabell);
  var n = f.sh.getLastRow() - 1;
  if (n < 1) return [];
  var varden = f.sh.getRange(2, 1, n, f.kol.length).getValues();
  return varden.map(function (rad) {
    var o = {};
    f.kol.forEach(function (k, i) {
      var v = rad[i];
      if (v instanceof Date) v = Utilities.formatDate(v, 'Europe/Stockholm', 'yyyy-MM-dd');
      if (BOOL.indexOf(k) >= 0) v = v === true || v === 'TRUE' || v === 'true';
      o[k] = v;
    });
    return o;
  }).filter(function (o) { return o.id; });
}

function listaAllt_() {
  return { artiklar: lasRader_('artiklar'), leads: lasRader_('leads'), varma: lasRader_('varma') };
}

function tillCell_(k, v) {
  if (BOOL.indexOf(k) >= 0) return v === true || v === 'true';
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  // Hindra att Sheets tolkar text som formel
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function laggTill_(tabell, rad) {
  var f = flik_(tabell);
  rad = rad || {};
  rad.id = rad.id || Utilities.getUuid().slice(0, 8);
  rad.skapad = rad.skapad || nu_();
  rad.uppdaterad = nu_();
  f.sh.appendRow(f.kol.map(function (k) { return tillCell_(k, rad[k]); }));
  return rad;
}

function hittaRad_(f, id) {
  var n = f.sh.getLastRow() - 1;
  if (n < 1) return -1;
  var ids = f.sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function uppdatera_(tabell, id, andringar) {
  var f = flik_(tabell);
  var r = hittaRad_(f, id);
  if (r < 0) throw new Error('Raden finns inte längre');
  andringar = andringar || {};
  andringar.uppdaterad = nu_();
  Object.keys(andringar).forEach(function (k) {
    var c = f.kol.indexOf(k);
    if (c > 0) f.sh.getRange(r, c + 1).setValue(tillCell_(k, andringar[k]));
  });
  var rad = f.sh.getRange(r, 1, 1, f.kol.length).getValues()[0];
  var o = {};
  f.kol.forEach(function (k, i) { o[k] = rad[i] instanceof Date ? Utilities.formatDate(rad[i], 'Europe/Stockholm', 'yyyy-MM-dd') : rad[i]; });
  return o;
}

function taBort_(tabell, id) {
  var f = flik_(tabell);
  var r = hittaRad_(f, id);
  if (r > 0) f.sh.deleteRow(r);
}

function nu_() {
  return Utilities.formatDate(new Date(), 'Europe/Stockholm', "yyyy-MM-dd'T'HH:mm:ss");
}

/* ============================== FLÖDET ============================== */

/** "→ Leads": gör artikelns kontaktpersoner till rader på Leads-fliken. */
function tillLeads_(artikelId) {
  var artikel = lasRader_('artiklar').filter(function (a) { return String(a.id) === String(artikelId); })[0];
  if (!artikel) throw new Error('Artikeln finns inte');
  if (artikel.typ === 'Betald') throw new Error('Betalda artiklar går inte vidare till Leads');

  var kontakter = [];
  try { kontakter = JSON.parse(artikel.kontakter || '[]'); } catch (e) { kontakter = []; }
  if (!kontakter.length) kontakter = [{}]; // en tom rad att fylla i på Leads-fliken

  var bolag = String(artikel.bolag || '').split(',').map(function (s) { return s.trim(); }).filter(String);
  var nya = kontakter.map(function (k) {
    return laggTill_('leads', {
      artikelId: artikel.id,
      publikation: artikel.publikation,
      artikelRubrik: artikel.rubrik,
      url: artikel.url,
      publiceradDatum: artikel.publiceradDatum,
      foretag: k.foretag || bolag[0] || artikel.kundAmne || '',
      kontaktNamn: k.namn || '',
      kontaktRoll: k.roll || '',
      mejl: k.mejl || '',
      telefon: k.telefon || '',
      ansvarig: artikel.ansvarig
    });
  });
  uppdatera_('artiklar', artikel.id, { tillLeads: true });
  return nya;
}

/** "→ Varm": gör en lead till ett kort på Varma leads. */
function tillVarm_(leadId, steg) {
  var lead = lasRader_('leads').filter(function (l) { return String(l.id) === String(leadId); })[0];
  if (!lead) throw new Error('Leaden finns inte');
  var rad = laggTill_('varma', {
    leadId: lead.id,
    foretag: lead.foretag,
    kontaktNamn: lead.kontaktNamn,
    kontaktRoll: lead.kontaktRoll,
    publikation: lead.publikation,
    artikelRubrik: lead.artikelRubrik,
    steg: steg || 'Möte bokat',
    ansvarig: lead.ansvarig
  });
  uppdatera_('leads', lead.id, { varm: true });
  return rad;
}

/* ============================== HÄMTA FRÅN LÄNK ============================== */

/** Hämtar rubrik, datum och publikation för en eller flera länkar. */
function hamtaMeta_(urls) {
  var befintliga = {};
  lasRader_('artiklar').forEach(function (a) { if (a.url) befintliga[normUrl_(a.url)] = a.rubrik || true; });

  var unika = [];
  urls.forEach(function (u) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u) && unika.indexOf(u) < 0) unika.push(u);
  });

  var svar = UrlFetchApp.fetchAll(unika.map(function (u) {
    return { url: u, muteHttpExceptions: true, followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (CI Redaktion)' } };
  }));

  return unika.map(function (u, i) {
    var res = { url: u, publikation: publikationFranUrl_(u), finnsRedan: !!befintliga[normUrl_(u)] };
    try {
      var kod = svar[i].getResponseCode();
      if (kod >= 400) { res.fel = 'Sidan svarade ' + kod; return res; }
      var html = svar[i].getContentText();
      res.rubrik = rensa_(meta_(html, 'og:title') || tagg_(html, 'title'))
        .replace(/\s*[|–-]\s*(Hållbar Omställning|Dagens Medarbetare|Dagens Rapport).*$/i, '');
      var datum = meta_(html, 'article:published_time') || jsonLdDatum_(html);
      if (datum) res.publiceradDatum = String(datum).slice(0, 10);
    } catch (e) {
      res.fel = 'Kunde inte läsa sidan';
    }
    return res;
  });
}

function publikationFranUrl_(u) {
  var m = String(u).match(/^https?:\/\/(?:www\.)?([^\/:]+)/i);
  return m ? (DOMANER[m[1].toLowerCase()] || '') : '';
}

function normUrl_(u) {
  return String(u).trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

function meta_(html, prop) {
  var re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
  var re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + prop + '["\']', 'i');
  var m = html.match(re1) || html.match(re2);
  return m ? m[1] : '';
}

function tagg_(html, namn) {
  var m = html.match(new RegExp('<' + namn + '[^>]*>([\\s\\S]*?)</' + namn + '>', 'i'));
  return m ? m[1] : '';
}

function jsonLdDatum_(html) {
  var m = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  return m ? m[1] : '';
}

function rensa_(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–').replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(n); })
    .replace(/\s+/g, ' ').trim();
}


/* ============================== PUBLICERA TILL WORDPRESS ============================== */
/* Publiceringsverktyget (rapportering/publicera.html) skickar artiklar hit. Lösenorden till
 * WordPress ligger i Script Properties (kör sparaWordPress) och lämnar aldrig Google. */

var WP_SAJTER = {
  ho: { namn: 'Hållbar Omställning', api: 'https://hallbaromstallning.se/wp-json/wp/v2', pub: 'HO' },
  dm: { namn: 'Dagens Medarbetare', api: 'https://dagensmedarbetare.se/wp-json/wp/v2', pub: 'DM' },
  dr: { namn: 'Dagens Rapport', api: 'https://dagensrapport.se/wp-json/wp/v2', pub: 'DR' }
};
var WP_ENDPOINTS = ['posts', 'featured-article', 'quick-three', 'chronicle', 'report', 'tre-snabba'];

function wpAuth_(sajt) {
  var p = PropertiesService.getScriptProperties();
  var u = p.getProperty('WP_' + sajt.toUpperCase() + '_USER');
  var l = p.getProperty('WP_' + sajt.toUpperCase() + '_PASS');
  return (u && l) ? 'Basic ' + Utilities.base64Encode(u + ':' + l, Utilities.Charset.UTF_8) : '';
}

function wpFetch_(sajt, sokvag, opt) {
  opt = opt || {};
  var params = {
    method: opt.method || 'get',
    headers: Object.assign({ Authorization: wpAuth_(sajt) }, opt.headers || {}),
    muteHttpExceptions: true
  };
  if (opt.json !== undefined) { params.contentType = 'application/json'; params.payload = JSON.stringify(opt.json); }
  if (opt.blob) { params.payload = opt.blob; params.contentType = opt.blob.getContentType(); }
  var r = UrlFetchApp.fetch(WP_SAJTER[sajt].api + sokvag, params);
  var kod = r.getResponseCode(), text = r.getContentText(), data = null;
  try { data = JSON.parse(text); } catch (e) {}
  if (kod >= 300) {
    var msg = (data && data.message) ? data.message : text.slice(0, 200);
    throw new Error(WP_SAJTER[sajt].namn + ' svarade ' + kod + ': ' + msg);
  }
  return data;
}

/**
 * req: { sajt: 'ho'|'dm'|'dr', endpoint, post: {...WordPress-fält},
 *        bild: { namn, typ, data (base64), titel, alt, bildtext },
 *        bolag: 'Namn' (bara DR: hämtas eller skapas),
 *        redaktion: { ...rad till Redaktionsplan } }
 */
function publicera_(req) {
  var sajt = req.sajt;
  if (!WP_SAJTER[sajt]) return { ok: false, fel: 'Okänd sajt' };
  if (WP_ENDPOINTS.indexOf(req.endpoint) < 0) return { ok: false, fel: 'Okänt format' };
  if (!wpAuth_(sajt)) return { ok: false, fel: 'Inloggningen till ' + WP_SAJTER[sajt].namn + ' saknas. Mikael: kör sparaWordPress i Apps Script.' };

  var post = req.post || {};
  var varningar = [];

  // 1. Bild
  if (req.bild && req.bild.data) {
    try {
      var blob = Utilities.newBlob(Utilities.base64Decode(req.bild.data), req.bild.typ || 'image/jpeg', req.bild.namn || 'bild.jpg');
      var media = wpFetch_(sajt, '/media', {
        method: 'post', blob: blob,
        headers: { 'Content-Disposition': 'attachment; filename="' + String(req.bild.namn || 'bild.jpg').replace(/"/g, '') + '"' }
      });
      var upd = {};
      if (req.bild.titel) { upd.title = req.bild.titel; upd.alt_text = req.bild.alt || req.bild.titel; }
      if (req.bild.bildtext) upd.caption = req.bild.bildtext;
      if (Object.keys(upd).length) { try { wpFetch_(sajt, '/media/' + media.id, { method: 'post', json: upd }); } catch (e) {} }
      post.featured_media = media.id;
    } catch (e) {
      varningar.push('Bilden kunde inte laddas upp: ' + e.message);
    }
  }

  // 2. Bolag (Dagens Rapport)
  if (sajt === 'dr' && req.bolag) {
    try {
      var hitt = wpFetch_(sajt, '/bolag?per_page=20&search=' + encodeURIComponent(req.bolag)) || [];
      var term = hitt.filter(function (t) { return String(t.name).toLowerCase() === String(req.bolag).toLowerCase(); })[0];
      if (!term) term = wpFetch_(sajt, '/bolag', { method: 'post', json: { name: req.bolag } });
      post.bolag = [term.id];
    } catch (e) {
      varningar.push('Bolaget kunde inte kopplas: ' + e.message);
    }
  }

  // 3. Inlägget (alltid utkast)
  post.status = 'draft';
  var skapat = wpFetch_(sajt, '/' + req.endpoint, { method: 'post', json: post });

  // 4. Redaktion + leads
  var redaktion = false;
  if (req.redaktion) {
    try {
      var rad = req.redaktion;
      rad.publikation = WP_SAJTER[sajt].pub;
      rad.url = skapat.link || '';
      rad.wpId = skapat.id;
      medLas_(function () { laggTill_('artiklar', rad); });
      redaktion = true;
    } catch (e) {
      varningar.push('Kunde inte läggas in i Redaktion + leads: ' + e.message);
    }
  }

  return {
    ok: true,
    post: { id: skapat.id, link: skapat.link },
    redigera: WP_SAJTER[sajt].api.replace('/wp-json/wp/v2', '') + '/wp-admin/post.php?action=edit&post=' + skapat.id,
    redaktion: redaktion,
    varningar: varningar
  };
}

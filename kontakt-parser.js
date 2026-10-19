/* Tolkar inklistrade kontaktuppgifter (mejlsignatur, rad ur pressmeddelande, vCard-liknande text)
 * och delar upp dem i namn, roll, mejl, telefon och företag.
 * Ingen AI – bara mönster. Det som inte går att tolka lämnas tomt.
 */
(function (global) {
  'use strict';

  var ROLLORD = /\b(chef|ansvarig|ansvarar|direktör|director|manager|head|lead|vd|ceo|cmo|cco|cfo|coo|cto|kommunikat\w*|marknad\w*|press\w*|pr\b|information\w*|officer|specialist|strateg\w*|koordinator|samordnare|handläggare|rådgivare|konsult|partner|grundare|founder|owner|ägare|president|vice|vp|svp|evp|country|nordic\w*|sales|sälj\w*|brand|varumärke\w*|redaktör|editor|producent|projektledare|talesperson|spokesperson|ir\b|investor|hr\b|people|employer)\b/i;
  var BOLAGSORD = /\b(AB|AB \(publ\)|Group|Sverige|Sweden|Nordic|Nordics|Inc|Ltd|GmbH|AS|A\/S|Oy|ASA|Holding|Koncernen|Kommun|Region)\b/;
  var ETIKETT = /^\s*(namn|name|kontakt(person)?|kontakt|roll|titel|title|befattning|position|e-?post|e-?mail|mail|mejl|tel(efon)?|phone|mobil(e)?|mob|direkt|växel|vxl|företag|bolag|company|organisation|org)\s*[:.\-–]\s*/i;
  var INLEDNING = /^(för mer information|för ytterligare information|mer information|ytterligare information|for more information|frågor|kontakt|kontakta|vänligen kontakta|please contact|media contact|press contact|presskontakt|mediekontakt|med vänlig hälsning|vänliga hälsningar|mvh|hälsningar|best regards|kind regards|regards|hälsar)[^:]*:?\s*/i;

  function rensa(s) {
    return String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  }

  function hittaMejl(text) {
    var m = text.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    return m ? m[0].replace(/[.,;]+$/, '') : '';
  }

  function hittaTelefon(text) {
    // +46 70 123 45 67, 070-123 45 67, 08-123 456 78, (0)8 123 45 67
    var re = /(\+?\d{1,3}[\s\-]?)?(\(0\)\s?)?\d{1,4}[\s\-\/]?\d{2,4}(?:[\s\-]?\d{2,4}){1,4}/g;
    var m, basta = '';
    while ((m = re.exec(text))) {
      var kandidat = m[0].trim();
      var siffror = kandidat.replace(/\D/g, '');
      if (siffror.length >= 8 && siffror.length <= 15 && !/^\d{4}-\d{2}-\d{2}$/.test(kandidat)) {
        basta = kandidat; break;
      }
    }
    return basta;
  }

  function serUtSomNamn(s) {
    if (!s || /[@\d]/.test(s) || s.length > 40) return false;
    if (ROLLORD.test(s) || BOLAGSORD.test(s)) return false;
    var ord = s.split(' ').filter(Boolean);
    if (ord.length < 2 || ord.length > 4) return false;
    return ord.every(function (o) { return /^[A-ZÅÄÖÉÜ][a-zåäöéèüøæ'’\-]+$/.test(o) || /^(af|av|von|van|de|da|del|la|le)$/.test(o); });
  }

  function namnFranMejl(mejl) {
    var lokal = (mejl.split('@')[0] || '');
    var delar = lokal.split(/[._\-]/).filter(function (d) { return /^[a-zåäö]{2,}$/i.test(d); });
    if (delar.length < 2) return '';
    return delar.slice(0, 3).map(function (d) { return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase(); }).join(' ');
  }

  function tolka(text) {
    var res = { namn: '', roll: '', mejl: '', telefon: '', foretag: '' };
    text = String(text || '');
    if (!rensa(text)) return res;

    res.mejl = hittaMejl(text);
    res.telefon = hittaTelefon(text.replace(res.mejl, ' '));

    // Dela upp i bitar: rader, komma, semikolon, |, •, tabb, " – "
    var bitar = text
      .split(/\r?\n|[;|•\t]|,(?!\d)|\s[–—-]\s/)
      .map(function (b) {
        b = rensa(b).replace(INLEDNING, '');
        b = b.replace(ETIKETT, '');
        if (res.mejl) b = b.replace(res.mejl, '');
        if (res.telefon) b = b.replace(res.telefon, '');
        return rensa(b.replace(/^[\s:,.\-–]+|[\s:,.\-–]+$/g, ''));
      })
      .filter(function (b) { return b && !/^(tel|telefon|mobil|mob|e-?post|mail|mejl|phone|www\.|https?:)/i.test(b) && !/^(www\.|https?:\/\/)/i.test(b); });

    // Namn: första biten som ser ut som ett namn
    var namnIndex = -1;
    for (var i = 0; i < bitar.length; i++) {
      if (serUtSomNamn(bitar[i])) { res.namn = bitar[i]; namnIndex = i; break; }
    }
    // "Anna Andersson kommunikationschef" i samma bit
    if (!res.namn) {
      for (var j = 0; j < bitar.length; j++) {
        var m = bitar[j].match(/^([A-ZÅÄÖÉ][a-zåäöé\-]+(?:\s[A-ZÅÄÖÉ][a-zåäöé\-]+){1,2})[\s,]+(.+)$/);
        if (m && ROLLORD.test(m[2]) && serUtSomNamn(m[1])) {
          res.namn = m[1]; res.roll = m[2]; namnIndex = j; break;
        }
      }
    }
    if (!res.namn && res.mejl) res.namn = namnFranMejl(res.mejl);

    // Roll: bit med rollord, helst nära namnet
    if (!res.roll) {
      var ordning = bitar.map(function (b, k) { return k; });
      if (namnIndex >= 0) ordning.sort(function (a, b) { return Math.abs(a - namnIndex) - Math.abs(b - namnIndex); });
      for (var r = 0; r < ordning.length; r++) {
        var b = bitar[ordning[r]];
        if (ordning[r] !== namnIndex && ROLLORD.test(b) && b.length <= 80) {
          // "Kommunikationschef på Vattenfall" → roll + företag
          var pa = b.match(/^(.+?)\s+(?:på|at|vid|hos|@)\s+(.+)$/i);
          if (pa) { res.roll = pa[1]; if (!res.foretag) res.foretag = pa[2]; }
          else res.roll = b;
          break;
        }
      }
    }

    // Företag: bit med bolagsord som inte redan använts
    if (!res.foretag) {
      for (var f = 0; f < bitar.length; f++) {
        if (f !== namnIndex && bitar[f] !== res.roll && BOLAGSORD.test(bitar[f]) && bitar[f].length <= 60) {
          res.foretag = bitar[f]; break;
        }
      }
    }

    res.roll = res.roll ? res.roll.charAt(0).toUpperCase() + res.roll.slice(1) : '';
    return res;
  }

  global.tolkaKontakt = tolka;
  if (typeof module !== 'undefined') module.exports = tolka;
})(typeof window !== 'undefined' ? window : globalThis);

// Inställningar för Redaktion + leads.
// Här kan du ändra namn, format och mejlmallar utan att röra resten av koden.

var MALLTEXT =
  'Hej {fornamn}!\n\n' +
  'Vill bara berätta att vi gjorde en kort summering på nyheten ni släppte {nar}: {url}\n' +
  'Säg till om något ser konstigt ut.\n\n' +
  'Om det är intressant tar jag och min kollega {kollega} gärna ett kort möte för att berätta vad vi erbjuder och kan hjälpa till med. ' +
  'Vi söker bland annat bolag som vill bidra med krönikor på alla våra plattformar.\n\n' +
  'Vänliga hälsningar\n{avsandare}';

window.CONFIG = {
  // Webbappens URL från Apps Script (Implementera → Hantera implementeringar)
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbwWrUI3n6-lybzHv_d5rStkyjcplXP1bP1NZ0F2un5Zpdp5nFnnYaVRRXiMDrRGpkXHKw/exec',

  // Alla som använder verktyget
  TEAM: ['Mikael', 'Kalle', 'Johan', 'Andreas'],

  // Vilka som kan stå som ansvariga för artiklar och leads
  ANSVARIGA: ['Mikael', 'Kalle', 'Johan'],

  PUBLIKATIONER: {
    HO: { namn: 'Hållbar Omställning', farg: '#1F6F5C' },
    DM: { namn: 'Dagens Medarbetare', farg: '#6B4A9E' },
    DR: { namn: 'Dagens Rapport', farg: '#B4581A' }
  },

  FORMAT: ['Tre snabba', 'Medarbetarporträtt', 'Reportage', 'Nyhet', 'Medlemsnyhet', 'Podd + artikel', 'Annat'],

  STATUS: ['Idé', 'Intervju bokad', 'Skrivs', 'Granskas', 'Publicerad'],

  STEG: ['Möte bokat', 'Offert skickad', 'Affär', 'Annat / vilande'],

  // Mejlmallar per publikation. Platshållare:
  // {fornamn} {namn} {foretag} {rubrik} {url} {avsandare} {kollega} {nar} {publikation}
  //   {nar}     = "igår", "idag" eller "nyligen" beroende på publiceringsdatum
  //   {kollega} = Kalle om Mikael skickar, annars Mikael
  MALLAR: {
    HO: {
      amne: 'Vi skrev om er nyhet: {rubrik}',
      text: MALLTEXT
    },
    DM: {
      amne: 'Vi skrev om er nyhet: {rubrik}',
      text: MALLTEXT
    },
    DR: {
      amne: 'Vi skrev om er nyhet: {rubrik}',
      text: MALLTEXT
    }
  }
};

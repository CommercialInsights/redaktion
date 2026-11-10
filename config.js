// Inställningar för Redaktion + leads.
// Här kan du ändra namn, format och mejlmallar utan att röra resten av koden.

var MALLTEXT =
  'Hej {fornamn}!\n\n' +
  'Vill bara berätta att vi gjorde en kort summering på nyheten ni släppte {nar}: {url}\n' +
  'Säg till om något ser konstigt ut.\n\n' +
  'Om det är intressant tar jag och min kollega {kollega} gärna ett kort möte för att berätta vad vi erbjuder och kan hjälpa till med. ' +
  'Vi söker bland annat bolag som vill bidra med krönikor på alla våra plattformar.\n\n' +
  'Vänliga hälsningar\n{avsandare}';

// Säljmejl när du kontaktar potentiella kunder (knappen "Säljmejl" i Leads).
// {halsning} blir "Hej Anna," eller bara "Hej," om förnamn saknas.
var SALJTEXT =
  '{halsning}\n\n' +
  'Jag heter {avsandareFullt} och driver Commercial Insights tillsammans med min kollega {kollegaFullt}. ' +
  'Vi hjälper företag att synas genom både förtjänt och köpt media:\n\n' +
  'Förtjänt: via vår PR-modell Publicerat (publicerat.se) tar vi fram nyhetsvinklar och pitchar dem till över 130 redaktioner. ' +
  'Efter en fast uppstartsavgift betalar ni bara för artiklar som faktiskt publiceras.\n\n' +
  'Köpt: vi erbjuder annonser, native-artiklar eller partnerskap på de fyra nyhetsplattformar vi driver:\n\n' +
  '• Hallbaromstallning.se – näringslivets gröna omställning, från idé till genomförande\n' +
  '• DagensMedarbetare.se – arbetsliv, kompetensförsörjning och HR\n' +
  '• Lokalpolitiker.se – branschtidningen för kommun- och regionpolitiker i hela Sverige\n' +
  '• DagensRapport.se – samlar rapporterna som produceras i Sverige och gör om dem till snabba och lättbegripliga insikter\n\n' +
  'Vi är erfarna och utan onödig overhead, vilket gör oss mycket prisvärda.\n\n' +
  'Låter något av det intressant? Vi presenterar oss gärna under ett kort möte.\n\n' +
  'Vänliga hälsningar\n' +
  '{avsandareFullt}\n' +
  'Commercial Insights Sweden AB\n' +
  '{telefon}';

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

  FORMAT: ['Nyhet', 'Tre snabba', 'Medarbetarporträtt', 'Reportage', 'Medlemsnyhet', 'Podd + artikel', 'Annat'],

  STATUS: ['Idé', 'Intervju bokad', 'Skrivs', 'Granskas', 'Publicerad'],

  STEG: ['Möte bokat', 'Offert skickad', 'Affär', 'Annat / vilande'],

  // Mejlmallar per publikation. Platshållare:
  // {fornamn} {namn} {foretag} {rubrik} {url} {avsandare} {kollega} {nar} {publikation}
  //   {nar}     = "igår", "idag" eller "nyligen" beroende på publiceringsdatum
  //   {kollega} = Kalle om Mikael skickar, annars Mikael
  // Fullständigt namn och telefon i säljmejlets signatur
  PERSONER: {
    Mikael: { namn: 'Mikael Stange', telefon: '0709540850' },
    Kalle: { namn: 'Kalle Dixelius', telefon: '' }
  },

  SALJMEJL: {
    amne: 'Synas i media – förtjänt och köpt | Commercial Insights',
    text: SALJTEXT
  },

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

// Inställningar för Redaktion + leads.
// Här kan du ändra namn, format och mejlmallar utan att röra resten av koden.

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
  // {fornamn} {namn} {foretag} {rubrik} {url} {avsandare}
  MALLAR: {
    HO: {
      amne: 'Ni nämns i Hållbar Omställning: {rubrik}',
      text: 'Hej {fornamn},\n\nVi har publicerat en artikel i Hållbar Omställning där {foretag} nämns:\n\n{rubrik}\n{url}\n\nDela den gärna i era kanaler, till exempel på LinkedIn eller internt.\n\nVänliga hälsningar\n{avsandare}\nHållbar Omställning'
    },
    DM: {
      amne: 'Ni nämns i Dagens Medarbetare: {rubrik}',
      text: 'Hej {fornamn},\n\nVi har publicerat en artikel i Dagens Medarbetare där {foretag} nämns:\n\n{rubrik}\n{url}\n\nDela den gärna i era kanaler, till exempel på LinkedIn eller internt.\n\nVänliga hälsningar\n{avsandare}\nDagens Medarbetare'
    },
    DR: {
      amne: 'Ni nämns i Dagens Rapport: {rubrik}',
      text: 'Hej {fornamn},\n\nVi har publicerat en artikel i Dagens Rapport där {foretag} nämns:\n\n{rubrik}\n{url}\n\nDela den gärna i era kanaler, till exempel på LinkedIn eller internt.\n\nVänliga hälsningar\n{avsandare}\nDagens Rapport'
    }
  }
};

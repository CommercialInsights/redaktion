# Redaktion + leads – Commercial Insights

Internt verktyg för redaktionsplan, artikellogg/leads och varma leads för
Hållbar Omställning (HO), Dagens Medarbetare (DM) och Dagens Rapport (DR).

**Sidan:** https://commercialinsights.github.io/redaktion/

## Så hänger det ihop

| Del | Var | Vad den gör |
|---|---|---|
| Sidan | `index.html`, `app.js`, `style.css` (GitHub Pages) | Det ni ser och klickar i |
| Inställningar | `config.js` | Teamet, ansvariga, format, status och mejlmallar |
| Backend | `apps-script/Code.gs` (Google Apps Script) | Sparar i Google Sheet, hämtar rubrik/datum från länkar |
| Data | Google Sheet "Redaktion + leads – CI" | Flikarna Redaktionsplan, Leads och Varma leads |

Ingen data och inga nycklar ligger i det här repot. Teamkoden sparas i Apps Script
(Script Properties) och anges en gång per webbläsare.

## Flödet

1. **Redaktionsplan** – artiklar läggs in med *+ Ny artikel* eller *Klistra in flera*
   (flera länkar på en gång). Varje artikel är *Redaktionell* (standard) eller *Betald*.
2. **→ Leads** – du eller Kalle skickar en publicerad, redaktionell artikel vidare.
   Artikelns kontaktpersoner blir rader på Leads-fliken. Betalda går inte vidare.
3. **Leads** – bockar för Meddelad, LinkedIn, Ringt, Mejlat. *Mailutkast* öppnar ett
   mejl med mall per publikation (ändras i `config.js`).
4. **→ Varm** – en lead som gett något blir ett kort på tavlan *Varma leads*:
   Möte bokat → Offert skickad → Affär / Annat.

## Uppdatera backend

1. Kopiera `apps-script/Code.gs` och klistra in i sheetets Apps Script (Tillägg → Apps Script).
2. Spara.
3. **Implementera → Hantera implementeringar →** pennan → *Version: Ny version* → Implementera.
   Då behåller webbappen samma URL.

Byta teamkod: kör funktionen `bytTeamkod` i Apps Script.

## Senare

- AI-förslag på bolag och kontaktpersoner (kräver en API-nyckel som sparas i Apps Script, aldrig här).
- Mejlutkast direkt i Gmail i stället för mailto ("Skapa utkast" per lead och för alla ej meddelade). Öppen fråga: vilken avsändaradress, och hur Kalles utkast ska hanteras.

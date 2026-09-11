/**
 * Welke klanten toont dit dashboard: de echte of de voorbeeldklant?
 *
 * Tot nu toe was dat geen vraag. `SAMPLE_CLIENTS` was de enige bron, en het
 * hele datamodel -- tijdreeksen, kanalen, conversieconfiguraties, inzichten --
 * hangt aan die klant-ID's. Deze module zet daar één seam in, zodat de echte
 * klanten uit Supabase op dezelfde plek binnenkomen zonder dat de rest van de
 * repository weet dat er iets veranderd is.
 *
 * **Bewust synchroon na het laden.** De repository leest de klantenlijst op
 * tientallen plekken en verwacht een array, geen belofte. Daarom haalt
 * `laadEchteClients()` de lijst één keer op bij het opstarten en zet hem hier
 * neer; `huidigeClients()` blijft daarna gewoon synchroon. Het alternatief --
 * overal async -- zou een refactor van het halve dashboard zijn voor een lijst
 * die per sessie één keer verandert.
 *
 * **Wat er níét mee opgelost is.** De echte klanten hebben geen tijdreeksen,
 * conversieprofielen of inzichten in de sample-data. Alles wat daarop leunt
 * blijft leeg tot het per pagina op een echte bron wordt gezet. Dat is de
 * volgende stap en bewust niet deze: de klantenlijst echt maken is één
 * ingreep, elk scherm omzetten zijn er vijftien.
 */

import { SAMPLE_CLIENTS } from './sample-data/shared.js';
import { isSampleMode, safeFetchJson, DataStatus } from './data-provider.js';

/** Wat de rest van de app op dit moment als klantenlijst ziet. */
let actief = SAMPLE_CLIENTS;

/** Waar die lijst vandaan komt, zodat de interface het kan tonen. */
let herkomst = 'sample';

/** Alle klanten die nu gelden. Synchroon, want de repository verwacht dat. */
export function huidigeClients() {
  return actief;
}

/** 'sample' of 'live'. Geen gok: dit zegt wat er daadwerkelijk geladen is. */
export function clientHerkomst() {
  return herkomst;
}

/**
 * Haalt de echte klanten op en zet ze als actieve lijst.
 *
 * In demomodus gebeurt er niets -- dan is de voorbeeldklant het antwoord.
 * Mislukt het ophalen in live modus, dan blijft de voorbeeldklant staan en
 * geeft deze functie de reden terug. Stilletjes terugvallen zou erger zijn:
 * dan kijk je naar verzonnen cijfers zonder dat iets dat zegt.
 *
 * @returns {Promise<{herkomst: string, aantal: number, melding?: string}>}
 */
export async function laadEchteClients() {
  if (isSampleMode()) {
    actief = SAMPLE_CLIENTS;
    herkomst = 'sample';
    return { herkomst, aantal: actief.length };
  }

  const uitkomst = await safeFetchJson('/api/clients/live');
  if (uitkomst.status !== DataStatus.LIVE || !Array.isArray(uitkomst.data) || uitkomst.data.length === 0) {
    herkomst = 'sample';
    actief = SAMPLE_CLIENTS;
    return {
      herkomst,
      aantal: actief.length,
      melding: uitkomst.message || 'Geen echte klanten ontvangen; de voorbeeldklant blijft staan.',
    };
  }

  actief = uitkomst.data;
  herkomst = 'live';
  return { herkomst, aantal: actief.length };
}

/** Alleen voor tests: zet de lijst terug op de uitgangspositie. */
export function herstelClients() {
  actief = SAMPLE_CLIENTS;
  herkomst = 'sample';
}

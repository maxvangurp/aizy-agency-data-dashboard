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
 *
 * **De controleklant.** Juist door dat laatste is een lijst met alleen echte
 * klanten lastig te lezen: staat een scherm leeg omdat het stuk is, of omdat
 * die bron voor deze klant nog niet is omgezet? Daarom blijft er in live modus
 * precies één voorbeeldklant staan, met volledige sample-data. Rendert een
 * scherm daar wél en bij de echte klanten niet, dan zit het verschil in de
 * data en niet in het scherm. Hij is overal als demo gemarkeerd, want een
 * verzonnen klant tussen echte klanten hoort nooit voor een echte door te gaan.
 */

import { SAMPLE_CLIENTS } from './sample-data/shared.js';
import { isSampleMode, safeFetchJson, DataStatus } from './data-provider.js';

/**
 * Welke voorbeeldklant als controle meereist.
 *
 * Vitaalpunt Fysiotherapie, omdat die de meeste schermen raakt: leadgeneratie
 * met een gekoppelde CRM, dus de hele keten van lead via gekwalificeerd en
 * afspraak tot klant, tien doelen, een maandbudget met pacing, en een meting
 * op "controle aanbevolen" zodat ook de datakwaliteitspaden iets te tonen
 * hebben. Wat hij niet dekt is de e-commercekant -- omzet, ROAS, orderwaarde;
 * daarvoor is 'tafelwerk' of 'kaapnoord' de tegenhanger. Eén regel hieronder
 * wisselt dat om.
 */
export const CONTROLE_CLIENT_ID = 'vitaalpunt';

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

/** De controleklant, gemarkeerd zodat de interface hem als demo kan tonen. */
function controleClient() {
  const basis = SAMPLE_CLIENTS.find((c) => c.id === CONTROLE_CLIENT_ID);
  return basis ? { ...basis, demo: true } : null;
}

/** True voor de voorbeeldklant die in live modus meereist. */
export function isDemoClient(client) {
  return client?.demo === true;
}

/**
 * Haalt de echte klanten op en zet ze als actieve lijst.
 *
 * In demomodus gebeurt er niets -- dan zijn de voorbeeldklanten het antwoord,
 * alle zeven, want dat is de demo. Mislukt het ophalen in live modus, dan
 * blijven ze ook staan en geeft deze functie de reden terug. Stilletjes
 * terugvallen zou erger zijn: dan kijk je naar verzonnen cijfers zonder dat
 * iets dat zegt.
 *
 * Lukt het wél, dan is de lijst de echte klanten plus de ene controleklant.
 * Hij staat vooraan, zodat hij niet tussen de echte namen verdwijnt.
 *
 * @returns {Promise<{herkomst: string, aantal: number, echt?: number, demo?: number, melding?: string}>}
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
      melding: uitkomst.message || 'Geen echte klanten ontvangen; de voorbeeldklanten blijven staan.',
    };
  }

  // De echte klanten komen op slug binnen. Draagt er onverhoopt één dezelfde
  // slug als de controleklant, dan wint de echte: een echte klant verbergen
  // achter verzonnen cijfers is het ergste wat hier kan gebeuren.
  const echt = uitkomst.data;
  const controle = echt.some((c) => c.id === CONTROLE_CLIENT_ID) ? null : controleClient();

  actief = controle ? [controle, ...echt] : echt;
  herkomst = 'live';
  return { herkomst, aantal: actief.length, echt: echt.length, demo: controle ? 1 : 0 };
}

/** Alleen voor tests: zet de lijst terug op de uitgangspositie. */
export function herstelClients() {
  actief = SAMPLE_CLIENTS;
  herkomst = 'sample';
}

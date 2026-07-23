/**
 * Actiemodel.
 *
 * Eén actie, drie weergaven. De lijst, het bord en de agenda lezen allemaal uit
 * deze module en schrijven er allemaal naar terug. Er bestaat geen tweede
 * kopie van een actie ergens in een view, want dan zou een sleepbeweging op het
 * bord de agenda ongemoeid laten en zou de gebruiker terecht denken dat het
 * dashboard liegt.
 *
 * WAT EEN ACTIE IS
 *   titel               waar het over gaat, in één regel
 *   omschrijving        wat er precies moet gebeuren
 *   klantId             voor welke klant
 *   kanaal              welk advertentiekanaal of welke meetbron
 *   verantwoordelijkeId wie het doet
 *   status              waar het in de werkstroom staat
 *   prioriteit          hoe hard het is
 *   startdatum          wanneer eraan begonnen wordt
 *   deadline            wanneer het af moet
 *   signaalId           het signaal waar deze actie uit voortkwam
 *   inzichtId           het inzicht waar deze actie uit voortkwam
 *   opmerkingen         de geschiedenis van het gesprek
 *   zichtbaarVoorKlant  of deze actie in de klantomgeving verschijnt
 *
 * ZICHTBAARHEID VOOR DE KLANT
 * Interne acties blijven intern. Een klant ziet alleen wat bewust met hem
 * gedeeld is; dat is een eigenschap van de actie en geen filter in een view,
 * zodat een nieuwe klantpagina hem niet per ongeluk kan omzeilen.
 */

import { lees, schrijf, nieuwId, nu } from './store.js';
import { DEMO_TODAY, plusDagen } from '../filters/period.js';

const SLEUTEL = 'acties';
const VERSIE = 3;

/* ---------------------------------------------------------------
   Vaste waarden
   --------------------------------------------------------------- */

export const ActieStatus = {
  NIEUW: 'nieuw',
  GEPLAND: 'gepland',
  BEZIG: 'bezig',
  WACHT_OP_KLANT: 'wacht-op-klant',
  AFGEROND: 'afgerond',
};

/**
 * De kolommen van het bord, in werkvolgorde.
 * Deze volgorde is ook de volgorde waarin de lijst standaard sorteert, zodat
 * bord en lijst dezelfde indruk van voortgang geven.
 */
export const ACTIE_STATUSSEN = [
  {
    key: ActieStatus.NIEUW,
    kort: 'Nieuw',
    omschrijving: 'Aangemaakt maar nog niet ingepland.',
    variant: 'muted',
  },
  {
    key: ActieStatus.GEPLAND,
    kort: 'Gepland',
    omschrijving: 'Er staat een datum voor, het werk is nog niet begonnen.',
    variant: 'info',
  },
  {
    key: ActieStatus.BEZIG,
    kort: 'Bezig',
    omschrijving: 'Er wordt op dit moment aan gewerkt.',
    variant: 'middel',
  },
  {
    key: ActieStatus.WACHT_OP_KLANT,
    kort: 'Wacht op klant',
    omschrijving: 'Aizy kan pas verder na input of goedkeuring van de klant.',
    variant: 'hoog',
  },
  {
    key: ActieStatus.AFGEROND,
    kort: 'Afgerond',
    omschrijving: 'Het werk is klaar en gecontroleerd.',
    variant: 'ok',
  },
];

export const STATUS_TERM = new Map(ACTIE_STATUSSEN.map((s) => [s.key, s]));

export function actiestatusTerm(key) {
  return STATUS_TERM.get(key) ?? { key, kort: 'Onbekend', omschrijving: '', variant: 'muted' };
}

export const ActiePrioriteit = {
  HOOG: 'hoog',
  MIDDEL: 'middel',
  LAAG: 'laag',
};

export const ACTIE_PRIORITEITEN = [
  { key: ActiePrioriteit.HOOG, kort: 'Hoog', variant: 'hoog', punten: 3, omschrijving: 'Deze week oppakken.' },
  { key: ActiePrioriteit.MIDDEL, kort: 'Gemiddeld', variant: 'middel', punten: 2, omschrijving: 'Binnen twee weken oppakken.' },
  { key: ActiePrioriteit.LAAG, kort: 'Laag', variant: 'muted', punten: 1, omschrijving: 'Kan wachten tot er ruimte is.' },
];

const PRIORITEIT_TERM = new Map(ACTIE_PRIORITEITEN.map((p) => [p.key, p]));

export function actieprioriteitTerm(key) {
  return PRIORITEIT_TERM.get(key) ?? { key, kort: 'Onbekend', variant: 'muted', punten: 0, omschrijving: '' };
}

/**
 * Soorten werk.
 *
 * Het soort bepaalt hoe een actie in de planning wordt getoond en of hij als
 * afspraak of als werkblok telt.
 */
export const ActieSoort = {
  OPTIMALISATIE: 'optimalisatie',
  MEETING: 'meeting',
  RAPPORTAGE: 'rapportage',
  CAMPAGNECONTROLE: 'campagnecontrole',
  TRACKINGCONTROLE: 'trackingcontrole',
  BUDGET: 'budget',
  INPUT: 'input',
};

export const ACTIE_SOORTEN = [
  { key: ActieSoort.OPTIMALISATIE, kort: 'Optimalisatiewerk' },
  { key: ActieSoort.MEETING, kort: 'Klantmeeting' },
  { key: ActieSoort.RAPPORTAGE, kort: 'Rapportage' },
  { key: ActieSoort.CAMPAGNECONTROLE, kort: 'Campagnecontrole' },
  { key: ActieSoort.TRACKINGCONTROLE, kort: 'Trackingcontrole' },
  { key: ActieSoort.BUDGET, kort: 'Budgetbewaking' },
  { key: ActieSoort.INPUT, kort: 'Input van de klant' },
];

const SOORT_TERM = new Map(ACTIE_SOORTEN.map((s) => [s.key, s]));

export function actiesoortTerm(key) {
  return SOORT_TERM.get(key) ?? { key, kort: 'Werk' };
}

/* ---------------------------------------------------------------
   Vorm
   --------------------------------------------------------------- */

/**
 * Vult een actie aan tot de volledige vorm.
 * Een actie die uit opslag komt kan velden missen doordat hij door een oudere
 * versie is geschreven; die worden hier stilzwijgend aangevuld in plaats van
 * later als `undefined` in de interface te belanden.
 */
function maakActie(ruw) {
  return {
    id: ruw.id ?? nieuwId('act'),
    titel: ruw.titel ?? 'Naamloze actie',
    omschrijving: ruw.omschrijving ?? '',
    klantId: ruw.klantId ?? null,
    kanaal: ruw.kanaal ?? null,
    verantwoordelijkeId: ruw.verantwoordelijkeId ?? null,
    status: STATUS_TERM.has(ruw.status) ? ruw.status : ActieStatus.NIEUW,
    prioriteit: PRIORITEIT_TERM.has(ruw.prioriteit) ? ruw.prioriteit : ActiePrioriteit.MIDDEL,
    soort: SOORT_TERM.has(ruw.soort) ? ruw.soort : ActieSoort.OPTIMALISATIE,
    startdatum: ruw.startdatum ?? null,
    deadline: ruw.deadline ?? null,
    signaalId: ruw.signaalId ?? null,
    inzichtId: ruw.inzichtId ?? null,
    opmerkingen: Array.isArray(ruw.opmerkingen) ? ruw.opmerkingen : [],
    zichtbaarVoorKlant: ruw.zichtbaarVoorKlant === true,
    goedkeuringGevraagd: ruw.goedkeuringGevraagd === true,
    goedgekeurdOp: ruw.goedgekeurdOp ?? null,
    aangemaaktOp: ruw.aangemaaktOp ?? nu(),
    gewijzigdOp: ruw.gewijzigdOp ?? ruw.aangemaaktOp ?? nu(),
  };
}

/* ---------------------------------------------------------------
   Uitgangssituatie
   --------------------------------------------------------------- */

const D = (n) => plusDagen(DEMO_TODAY, n);

/**
 * De acties waarmee de demo begint.
 *
 * Ze zijn zo gekozen dat elke kolom van het bord gevuld is, dat er acties in
 * het verleden en in de toekomst staan en dat iedere medewerker met klanten er
 * werk heeft. Zonder die spreiding zou het bord leeg ogen en de agenda niets
 * laten zien.
 */
const SEED = [
  {
    id: 'act-seed-1',
    titel: 'Dagbudget LinkedIn Ads terugbrengen naar 580 euro',
    omschrijving: 'Het dagbudget is op 8 juli verhoogd zonder einddatum. Terugzetten of een einddatum instellen zodat de maand binnen budget blijft.',
    klantId: 'noordlicht',
    kanaal: 'linkedin_ads',
    verantwoordelijkeId: 'u-benito',
    status: ActieStatus.BEZIG,
    prioriteit: ActiePrioriteit.HOOG,
    soort: ActieSoort.BUDGET,
    startdatum: D(-2),
    deadline: D(1),
    signaalId: 'alert-1',
    aangemaaktOp: `${D(-3)}T09:10:00.000Z`,
  },
  {
    id: 'act-seed-2',
    titel: 'Advertentiesets Meta vernieuwen en doelgroep verbreden',
    omschrijving: 'De frequentie liep op naar 4,2 binnen de retargetingdoelgroep en de kosten per lead stegen mee.',
    klantId: 'vitaalpunt',
    kanaal: 'meta_ads',
    verantwoordelijkeId: 'u-berry',
    status: ActieStatus.GEPLAND,
    prioriteit: ActiePrioriteit.HOOG,
    soort: ActieSoort.OPTIMALISATIE,
    startdatum: D(1),
    deadline: D(3),
    signaalId: 'alert-2',
    aangemaaktOp: `${D(-4)}T11:00:00.000Z`,
  },
  {
    id: 'act-seed-3',
    titel: 'Feedprijzen synchroniseren en producten opnieuw indienen',
    omschrijving: '273 producten zijn afgekeurd doordat de prijs in de feed afwijkt van de prijs op de landingspagina.',
    klantId: 'draadloos',
    kanaal: 'google_ads',
    verantwoordelijkeId: 'u-jens',
    status: ActieStatus.BEZIG,
    prioriteit: ActiePrioriteit.HOOG,
    soort: ActieSoort.OPTIMALISATIE,
    startdatum: D(-1),
    deadline: D(2),
    signaalId: 'alert-4',
    aangemaaktOp: `${D(-5)}T08:30:00.000Z`,
  },
  {
    id: 'act-seed-4',
    titel: 'Brede zoekwoorden pauzeren en budget naar exact verplaatsen',
    omschrijving: 'Brede zoekwoorden nemen 46 procent van het budget en leveren weinig op. De ROAS daalt al zes maanden.',
    klantId: 'draadloos',
    kanaal: 'google_ads',
    verantwoordelijkeId: 'u-jens',
    status: ActieStatus.NIEUW,
    prioriteit: ActiePrioriteit.HOOG,
    soort: ActieSoort.OPTIMALISATIE,
    startdatum: null,
    deadline: D(5),
    signaalId: 'alert-5',
    aangemaaktOp: `${D(-6)}T15:45:00.000Z`,
  },
  {
    id: 'act-seed-5',
    titel: 'CRM-koppeling inrichten of maandelijkse export afspreken',
    omschrijving: 'Zonder CRM stopt de funnel bij de lead. Gekwalificeerde leads en klanten zijn daardoor niet meetbaar.',
    klantId: 'havenkwartier',
    kanaal: 'crm',
    verantwoordelijkeId: 'u-berry',
    status: ActieStatus.WACHT_OP_KLANT,
    prioriteit: ActiePrioriteit.HOOG,
    soort: ActieSoort.INPUT,
    startdatum: D(-14),
    deadline: D(4),
    signaalId: 'alert-7',
    zichtbaarVoorKlant: true,
    goedkeuringGevraagd: true,
    aangemaaktOp: `${D(-20)}T10:00:00.000Z`,
    opmerkingen: [
      {
        id: 'opm-seed-1',
        auteurId: 'u-berry',
        tekst: 'Export van juni ontvangen, koppeling zelf staat nog open bij de klant.',
        op: `${D(-6)}T13:20:00.000Z`,
      },
    ],
  },
  {
    id: 'act-seed-6',
    titel: 'Budget Performance Max EU met 15 procent verhogen',
    omschrijving: 'De ROAS blijft boven het doel en het budget is niet volledig benut. Er is schaalruimte.',
    klantId: 'kaapnoord',
    kanaal: 'google_ads',
    verantwoordelijkeId: 'u-jip',
    status: ActieStatus.GEPLAND,
    prioriteit: ActiePrioriteit.MIDDEL,
    soort: ActieSoort.BUDGET,
    startdatum: D(2),
    deadline: D(6),
    signaalId: 'alert-6',
    aangemaaktOp: `${D(-2)}T09:00:00.000Z`,
  },
  {
    id: 'act-seed-7',
    titel: 'Tagconfiguratie in Google Tag Manager controleren',
    omschrijving: 'GA4 ontvangt sinds 19 juli geen conversies. De gebeurtenis contact_verzonden ontbreekt na een websitewijziging.',
    klantId: 'noordlicht',
    kanaal: 'ga4',
    verantwoordelijkeId: 'u-benito',
    status: ActieStatus.NIEUW,
    prioriteit: ActiePrioriteit.HOOG,
    soort: ActieSoort.TRACKINGCONTROLE,
    startdatum: null,
    deadline: D(0),
    signaalId: 'alert-3',
    aangemaaktOp: `${D(-1)}T16:05:00.000Z`,
  },
  {
    id: 'act-seed-8',
    titel: 'Breed zoekwoord adviesbureau pauzeren',
    omschrijving: 'Brede matchtype trekt zoekopdrachten buiten de doelgroep aan en levert nauwelijks gekwalificeerde leads.',
    klantId: 'meridiaan',
    kanaal: 'google_ads',
    verantwoordelijkeId: 'u-jip',
    status: ActieStatus.AFGEROND,
    prioriteit: ActiePrioriteit.MIDDEL,
    soort: ActieSoort.OPTIMALISATIE,
    startdatum: D(-8),
    deadline: D(-3),
    signaalId: 'alert-8',
    aangemaaktOp: `${D(-9)}T09:30:00.000Z`,
  },
  {
    id: 'act-seed-9',
    titel: 'Maandrapportage juli opstellen',
    omschrijving: 'Rapportage met resultaten, uitgevoerde optimalisaties en vervolgstappen.',
    klantId: 'tafelwerk',
    kanaal: null,
    verantwoordelijkeId: 'u-erik',
    status: ActieStatus.GEPLAND,
    prioriteit: ActiePrioriteit.MIDDEL,
    soort: ActieSoort.RAPPORTAGE,
    startdatum: D(3),
    deadline: D(7),
    zichtbaarVoorKlant: true,
    aangemaaktOp: `${D(-1)}T08:00:00.000Z`,
  },
  {
    id: 'act-seed-10',
    titel: 'Kwartaaloverleg Vitaalpunt voorbereiden',
    omschrijving: 'Doelstellingen voor het volgende kwartaal doornemen en het budget herijken.',
    klantId: 'vitaalpunt',
    kanaal: null,
    verantwoordelijkeId: 'u-berry',
    status: ActieStatus.GEPLAND,
    prioriteit: ActiePrioriteit.MIDDEL,
    soort: ActieSoort.MEETING,
    startdatum: D(2),
    deadline: D(2),
    zichtbaarVoorKlant: true,
    aangemaaktOp: `${D(-3)}T14:00:00.000Z`,
  },
  {
    id: 'act-seed-11',
    titel: 'Zoektermenrapport doorlopen op uitsluitingen',
    omschrijving: 'Wekelijkse controle op zoektermen die budget kosten zonder aanvragen op te leveren.',
    klantId: 'havenkwartier',
    kanaal: 'google_ads',
    verantwoordelijkeId: 'u-berry',
    status: ActieStatus.BEZIG,
    prioriteit: ActiePrioriteit.LAAG,
    soort: ActieSoort.CAMPAGNECONTROLE,
    startdatum: D(0),
    deadline: D(1),
    aangemaaktOp: `${D(-2)}T10:30:00.000Z`,
  },
  {
    id: 'act-seed-12',
    titel: 'Creatives Meta vernieuwen voor het najaarsassortiment',
    omschrijving: 'De huidige creatives draaien sinds mei en de frequentie loopt op.',
    klantId: 'kaapnoord',
    kanaal: 'meta_ads',
    verantwoordelijkeId: 'u-jip',
    status: ActieStatus.NIEUW,
    prioriteit: ActiePrioriteit.LAAG,
    soort: ActieSoort.OPTIMALISATIE,
    startdatum: null,
    deadline: D(12),
    aangemaaktOp: `${D(-1)}T11:45:00.000Z`,
  },
  {
    id: 'act-seed-13',
    titel: 'Merkfoto’s en productbeschrijvingen aanleveren',
    omschrijving: 'Voor de nieuwe advertentieset is beeldmateriaal nodig dat de klant aanlevert.',
    klantId: 'tafelwerk',
    kanaal: 'meta_ads',
    verantwoordelijkeId: 'u-erik',
    status: ActieStatus.WACHT_OP_KLANT,
    prioriteit: ActiePrioriteit.MIDDEL,
    soort: ActieSoort.INPUT,
    startdatum: D(-5),
    deadline: D(2),
    zichtbaarVoorKlant: true,
    goedkeuringGevraagd: true,
    aangemaaktOp: `${D(-7)}T09:15:00.000Z`,
  },
  {
    id: 'act-seed-14',
    titel: 'Conversiewaarden Microsoft Ads controleren',
    omschrijving: 'De conversiewaarden wijken af van Google Ads. Nagaan of de import goed staat.',
    klantId: 'meridiaan',
    kanaal: 'microsoft_ads',
    verantwoordelijkeId: 'u-jip',
    status: ActieStatus.NIEUW,
    prioriteit: ActiePrioriteit.MIDDEL,
    soort: ActieSoort.TRACKINGCONTROLE,
    startdatum: null,
    deadline: D(9),
    aangemaaktOp: `${D(0)}T07:50:00.000Z`,
  },
];

/* ---------------------------------------------------------------
   Lezen en schrijven
   --------------------------------------------------------------- */

function laad() {
  const ruw = lees(SLEUTEL, VERSIE, null);
  const lijst = Array.isArray(ruw) ? ruw : SEED;
  return lijst.map(maakActie);
}

function bewaar(lijst) {
  return schrijf(SLEUTEL, VERSIE, lijst);
}

/** Alle acties, ongefilterd. Alleen voor de repository. */
export function alleActies() {
  return laad();
}

export function getActie(id) {
  return laad().find((a) => a.id === id) ?? null;
}

/**
 * Maakt een actie aan.
 * De aanmaakdatum en het wijzigingsmoment worden hier gezet en niet door de
 * aanroeper, zodat de geschiedenis van een actie altijd klopt.
 */
export function maakAanActie(gegevens) {
  const actie = maakActie({ ...gegevens, aangemaaktOp: nu(), gewijzigdOp: nu() });
  bewaar([actie, ...laad()]);
  return actie;
}

/**
 * Past een actie aan.
 * Geeft de bijgewerkte actie terug, of null wanneer de actie niet bestaat.
 */
export function wijzigActie(id, patch) {
  const lijst = laad();
  const index = lijst.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const bijgewerkt = maakActie({
    ...lijst[index],
    ...patch,
    id: lijst[index].id,
    aangemaaktOp: lijst[index].aangemaaktOp,
    gewijzigdOp: nu(),
  });
  lijst[index] = bijgewerkt;
  bewaar(lijst);
  return bijgewerkt;
}

/** Voegt een opmerking toe aan een actie. */
export function voegOpmerkingToe(id, { auteurId, tekst }) {
  const actie = getActie(id);
  if (!actie || !String(tekst ?? '').trim()) return null;

  const opmerking = { id: nieuwId('opm'), auteurId, tekst: String(tekst).trim(), op: nu() };
  return wijzigActie(id, { opmerkingen: [...actie.opmerkingen, opmerking] });
}

export function verwijderActie(id) {
  const lijst = laad();
  const over = lijst.filter((a) => a.id !== id);
  if (over.length === lijst.length) return false;
  bewaar(over);
  return true;
}

/**
 * Verplaatst een actie naar een andere statuskolom.
 *
 * Een actie die naar Gepland of Bezig gaat zonder startdatum krijgt er een,
 * anders zou hij op het bord staan maar in de agenda ontbreken. Een actie die
 * wordt afgerond behoudt zijn datums; die zijn geschiedenis.
 */
export function zetStatus(id, status, { vandaag = DEMO_TODAY } = {}) {
  if (!STATUS_TERM.has(status)) return null;
  const actie = getActie(id);
  if (!actie) return null;

  const patch = { status };
  const heeftDatumNodig = status === ActieStatus.GEPLAND || status === ActieStatus.BEZIG;
  if (heeftDatumNodig && !actie.startdatum) patch.startdatum = vandaag;

  return wijzigActie(id, patch);
}

/**
 * Verplaatst een actie naar een andere datum.
 *
 * De deadline schuift mee wanneer die eerder zou komen te liggen dan de nieuwe
 * startdatum: een actie die morgen begint en gisteren af moest zijn, is geen
 * planning maar een fout.
 */
export function zetDatum(id, datum) {
  const actie = getActie(id);
  if (!actie || !datum) return null;

  const patch = { startdatum: datum };
  if (actie.deadline && actie.deadline < datum) patch.deadline = datum;
  if (actie.status === ActieStatus.NIEUW) patch.status = ActieStatus.GEPLAND;

  return wijzigActie(id, patch);
}

/** Zet de volledige lijst terug naar de uitgangssituatie. */
export function herstelActies() {
  bewaar(SEED.map(maakActie));
}

export { SEED as ACTIE_SEED };

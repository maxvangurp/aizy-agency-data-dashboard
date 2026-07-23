/**
 * Planning.
 *
 * De planning toont drie soorten items naast elkaar, die bewust van elkaar te
 * onderscheiden blijven:
 *
 *   dashboardactie      een actie uit het actiecentrum met een startdatum.
 *                       Dit item bestaat niet los: het ís de actie. Verplaatsen
 *                       verandert de startdatum van de actie zelf, zodat lijst,
 *                       bord en agenda niet uit elkaar kunnen lopen.
 *   meeting             een afspraak met de klant die in dit product wordt
 *                       gepland.
 *   externe afspraak    een afspraak die uit een externe agenda komt. Die zijn
 *                       er nu nog niet; de vorm is wel voorbereid.
 *
 * VOORBEREIDING OP GOOGLE AGENDA EN OUTLOOK
 * Ieder planningsitem draagt een `externeBron`-veld met provider, agenda-id en
 * externe id. Zolang er geen koppeling is, staat daar overal null. Er wordt
 * bewust geen nepkoppeling getoond: een agenda die zegt dat hij met Google
 * synchroniseert terwijl dat niet zo is, is erger dan geen agenda.
 *
 * Wat er nu al klopt: een extern item is herkenbaar aan zijn herkomst, kan niet
 * in dit product worden verplaatst, en de synchronisatierichting staat per item
 * vast. Zodra de koppeling er is, hoeft alleen de vulling te veranderen.
 */

import { lees, schrijf, nieuwId, nu } from './store.js';
import { DEMO_TODAY, plusDagen, naarDatum, naarISO } from '../filters/period.js';
import { alleActies, zetDatum, actiesoortTerm, ActieSoort } from './actions.js';

const SLEUTEL = 'planning';
const VERSIE = 2;

export const ItemBron = {
  DASHBOARDACTIE: 'dashboardactie',
  MEETING: 'meeting',
  EXTERN: 'extern',
};

export const ITEM_BRONNEN = [
  {
    key: ItemBron.DASHBOARDACTIE,
    kort: 'Dashboardactie',
    omschrijving: 'Werk uit het actiecentrum. Verplaatsen wijzigt de actie zelf.',
    variant: 'info',
  },
  {
    key: ItemBron.MEETING,
    kort: 'Meeting',
    omschrijving: 'Een afspraak die in dit product is ingepland.',
    variant: 'ok',
  },
  {
    key: ItemBron.EXTERN,
    kort: 'Externe agenda-afspraak',
    omschrijving: 'Komt uit een gekoppelde agenda en wordt hier niet gewijzigd.',
    variant: 'muted',
  },
];

const BRON_TERM = new Map(ITEM_BRONNEN.map((b) => [b.key, b]));

export function itembronTerm(key) {
  return BRON_TERM.get(key) ?? { key, kort: 'Onbekend', omschrijving: '', variant: 'muted' };
}

/* ---------------------------------------------------------------
   Eigen planningsitems
   --------------------------------------------------------------- */

const D = (n) => plusDagen(DEMO_TODAY, n);

/**
 * Meetings en vaste werkblokken waarmee de demo begint.
 * Ze staan verspreid over twee weken zodat dag-, week- en maandweergave alle
 * drie iets te tonen hebben.
 */
const SEED = [
  {
    id: 'plan-seed-1',
    titel: 'Maandevaluatie Vitaalpunt',
    bron: ItemBron.MEETING,
    soort: ActieSoort.MEETING,
    klantId: 'vitaalpunt',
    medewerkerId: 'u-berry',
    datum: D(1),
    starttijd: '10:00',
    duurMinuten: 60,
  },
  {
    id: 'plan-seed-2',
    titel: 'Wekelijkse campagnecontrole e-commerce',
    bron: ItemBron.MEETING,
    soort: ActieSoort.CAMPAGNECONTROLE,
    klantId: 'tafelwerk',
    medewerkerId: 'u-erik',
    datum: D(0),
    starttijd: '09:00',
    duurMinuten: 45,
  },
  {
    id: 'plan-seed-3',
    titel: 'Kennismaking nieuwe marketeer Kaap Noord',
    bron: ItemBron.MEETING,
    soort: ActieSoort.MEETING,
    klantId: 'kaapnoord',
    medewerkerId: 'u-jip',
    datum: D(3),
    starttijd: '14:00',
    duurMinuten: 45,
  },
  {
    id: 'plan-seed-4',
    titel: 'Trackingcontrole Noordlicht na websitewijziging',
    bron: ItemBron.MEETING,
    soort: ActieSoort.TRACKINGCONTROLE,
    klantId: 'noordlicht',
    medewerkerId: 'u-benito',
    datum: D(2),
    starttijd: '11:00',
    duurMinuten: 90,
  },
  {
    id: 'plan-seed-5',
    titel: 'Rapportageblok Havenkwartier',
    bron: ItemBron.MEETING,
    soort: ActieSoort.RAPPORTAGE,
    klantId: 'havenkwartier',
    medewerkerId: 'u-berry',
    datum: D(5),
    starttijd: '13:00',
    duurMinuten: 120,
  },
  {
    id: 'plan-seed-6',
    titel: 'Budgetoverleg Draadloos Mode',
    bron: ItemBron.MEETING,
    soort: ActieSoort.BUDGET,
    klantId: 'draadloos',
    medewerkerId: 'u-jens',
    datum: D(-1),
    starttijd: '15:30',
    duurMinuten: 30,
  },
  {
    id: 'plan-seed-7',
    titel: 'Kwartaalrapportage Meridiaan doornemen',
    bron: ItemBron.MEETING,
    soort: ActieSoort.RAPPORTAGE,
    klantId: 'meridiaan',
    medewerkerId: 'u-jip',
    datum: D(7),
    starttijd: '10:30',
    duurMinuten: 60,
  },
  {
    id: 'plan-seed-8',
    titel: 'Optimalisatieblok Google Ads Tafelwerk',
    bron: ItemBron.MEETING,
    soort: ActieSoort.OPTIMALISATIE,
    klantId: 'tafelwerk',
    medewerkerId: 'u-erik',
    datum: D(4),
    starttijd: '09:30',
    duurMinuten: 120,
  },
];

function maakItem(ruw) {
  return {
    id: ruw.id ?? nieuwId('plan'),
    titel: ruw.titel ?? 'Naamloos item',
    bron: BRON_TERM.has(ruw.bron) ? ruw.bron : ItemBron.MEETING,
    soort: ruw.soort ?? ActieSoort.MEETING,
    klantId: ruw.klantId ?? null,
    medewerkerId: ruw.medewerkerId ?? null,
    datum: ruw.datum ?? DEMO_TODAY,
    starttijd: ruw.starttijd ?? '09:00',
    duurMinuten: Number(ruw.duurMinuten) || 60,
    actieId: ruw.actieId ?? null,
    // Voorbereid op een latere koppeling. Zolang die er niet is, blijft dit
    // overal leeg en wordt er nergens een gesynchroniseerde agenda gesuggereerd.
    externeBron: ruw.externeBron ?? { provider: null, agendaId: null, externeId: null, richting: null },
    aangemaaktOp: ruw.aangemaaktOp ?? nu(),
    gewijzigdOp: ruw.gewijzigdOp ?? nu(),
  };
}

function laadEigen() {
  const ruw = lees(SLEUTEL, VERSIE, null);
  const lijst = Array.isArray(ruw) ? ruw : SEED;
  return lijst.map(maakItem);
}

function bewaarEigen(lijst) {
  return schrijf(SLEUTEL, VERSIE, lijst);
}

/* ---------------------------------------------------------------
   Samengestelde planning
   --------------------------------------------------------------- */

/**
 * Zet een actie om in een planningsitem.
 * Het item draagt de id van de actie, zodat een sleepbeweging weet welke actie
 * hij moet aanpassen.
 */
function actieAlsItem(actie) {
  return {
    id: `actie:${actie.id}`,
    titel: actie.titel,
    bron: ItemBron.DASHBOARDACTIE,
    soort: actie.soort,
    klantId: actie.klantId,
    medewerkerId: actie.verantwoordelijkeId,
    datum: actie.startdatum,
    starttijd: null,
    duurMinuten: null,
    actieId: actie.id,
    status: actie.status,
    prioriteit: actie.prioriteit,
    deadline: actie.deadline,
    externeBron: { provider: null, agendaId: null, externeId: null, richting: null },
    aangemaaktOp: actie.aangemaaktOp,
    gewijzigdOp: actie.gewijzigdOp,
  };
}

/**
 * Alle planbare items: eigen items én acties met een startdatum.
 * Acties zonder datum staan bewust niet in de agenda; die horen thuis in de
 * kolom Nieuw op het bord.
 */
export function allePlanningsitems() {
  const acties = alleActies()
    .filter((a) => a.startdatum)
    .map(actieAlsItem);

  return [...laadEigen(), ...acties].sort(
    (a, b) => (a.datum ?? '').localeCompare(b.datum ?? '')
      || (a.starttijd ?? '99:99').localeCompare(b.starttijd ?? '99:99')
  );
}

export function getPlanningsitem(id) {
  return allePlanningsitems().find((i) => i.id === id) ?? null;
}

/**
 * Verplaatst een planbaar item naar een andere datum.
 *
 * Een dashboardactie wordt via het actiemodel verplaatst, zodat lijst, bord en
 * agenda dezelfde bron blijven delen. Een extern item wordt geweigerd: dat is
 * niet van dit product.
 *
 * @returns {{ok: boolean, reden?: string}}
 */
export function verplaatsItem(id, datum) {
  if (!datum) return { ok: false, reden: 'Er is geen datum opgegeven.' };

  if (String(id).startsWith('actie:')) {
    const actieId = String(id).slice('actie:'.length);
    const bijgewerkt = zetDatum(actieId, datum);
    return bijgewerkt
      ? { ok: true, item: actieAlsItem(bijgewerkt) }
      : { ok: false, reden: 'Deze actie bestaat niet meer.' };
  }

  const lijst = laadEigen();
  const index = lijst.findIndex((i) => i.id === id);
  if (index === -1) return { ok: false, reden: 'Dit item bestaat niet meer.' };

  if (lijst[index].bron === ItemBron.EXTERN) {
    return { ok: false, reden: 'Een afspraak uit een externe agenda wordt daar gewijzigd, niet hier.' };
  }

  lijst[index] = { ...lijst[index], datum, gewijzigdOp: nu() };
  bewaarEigen(lijst);
  return { ok: true, item: lijst[index] };
}

export function maakAanPlanningsitem(gegevens) {
  const item = maakItem(gegevens);
  bewaarEigen([...laadEigen(), item]);
  return item;
}

export function verwijderPlanningsitem(id) {
  const lijst = laadEigen();
  const over = lijst.filter((i) => i.id !== id);
  if (over.length === lijst.length) return false;
  bewaarEigen(over);
  return true;
}

/* ---------------------------------------------------------------
   Kalenderhulp
   --------------------------------------------------------------- */

/** Maandag van de week waarin deze datum valt. Nederland begint op maandag. */
export function beginVanWeek(iso) {
  const d = naarDatum(iso);
  const dag = (d.getUTCDay() + 6) % 7;
  return naarISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dag)));
}

export function eindVanWeek(iso) {
  return plusDagen(beginVanWeek(iso), 6);
}

/**
 * Het rooster van een maandweergave: hele weken, van maandag tot en met zondag.
 * De dagen buiten de maand blijven zichtbaar maar worden gemarkeerd, zodat een
 * item op de eerste van de maand niet halverwege een lege rij verschijnt.
 */
export function maandRooster(iso) {
  const d = naarDatum(iso);
  const eerste = naarISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const laatste = naarISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  const start = beginVanWeek(eerste);
  const eind = eindVanWeek(laatste);

  const dagen = [];
  let cursor = start;
  while (cursor <= eind) {
    dagen.push({ datum: cursor, binnenMaand: cursor >= eerste && cursor <= laatste });
    cursor = plusDagen(cursor, 1);
  }
  return { eerste, laatste, dagen };
}

export function herstelPlanning() {
  bewaarEigen(SEED.map(maakItem));
}

export { actiesoortTerm };

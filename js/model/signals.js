/**
 * Signaalmodel.
 *
 * Een signaal is geen kaartje maar een stuk werk dat een uitkomst hoort te
 * krijgen. Daarom heeft het een status, een verantwoordelijke en een verwijzing
 * naar de actie die eruit is voortgekomen.
 *
 * WAT WAAR STAAT
 *   De inhoud van een signaal — probleem, oorzaak, aanbeveling, kanaal,
 *   startdatum — komt uit sample-data en verandert niet door een gebruiker.
 *   De opvolging — status, toewijzing, gekoppelde actie, reden van negeren —
 *   is wél van de gebruiker en staat in de demo-opslag.
 *
 * Die scheiding voorkomt dat een demo-reset de signalen zelf weggooit, en
 * voorkomt dat de opvolging verdwijnt zodra de signaalinhoud uit een echte API
 * gaat komen.
 *
 * GEEN DUBBELE ACTIES
 * Een signaal draagt de id van de actie die eruit voortkwam. `maakActieVan`
 * weigert een tweede actie voor hetzelfde signaal en geeft de bestaande terug.
 * Zonder die controle levert twee keer klikken twee acties op, en dat is een
 * fout die zich pas op het bord laat zien.
 */

import { lees, schrijf, nu } from './store.js';
import { maakAanActie, getActie, ActieStatus, ActiePrioriteit, ActieSoort } from './actions.js';
import { SAMPLE_ALERTS } from '../sample-data/shared.js';

const SLEUTEL = 'signalen';
const VERSIE = 2;

export const SignaalStatus = {
  NIEUW: 'nieuw',
  BEKEKEN: 'bekeken',
  ACTIE_AANGEMAAKT: 'actie-aangemaakt',
  GENEGEERD: 'genegeerd',
  OPGELOST: 'opgelost',
};

export const SIGNAAL_STATUSSEN = [
  {
    key: SignaalStatus.NIEUW,
    kort: 'Nieuw',
    omschrijving: 'Nog niet bekeken door iemand van het team.',
    variant: 'hoog',
  },
  {
    key: SignaalStatus.BEKEKEN,
    kort: 'Bekeken',
    omschrijving: 'Gezien, maar er is nog geen besluit genomen.',
    variant: 'middel',
  },
  {
    key: SignaalStatus.ACTIE_AANGEMAAKT,
    kort: 'Actie aangemaakt',
    omschrijving: 'Er staat werk klaar dat dit signaal opvolgt.',
    variant: 'info',
  },
  {
    key: SignaalStatus.GENEGEERD,
    kort: 'Genegeerd',
    omschrijving: 'Bewust niet opgevolgd, met een reden erbij.',
    variant: 'muted',
  },
  {
    key: SignaalStatus.OPGELOST,
    kort: 'Opgelost',
    omschrijving: 'Het onderliggende probleem is verholpen.',
    variant: 'ok',
  },
];

const STATUS_TERM = new Map(SIGNAAL_STATUSSEN.map((s) => [s.key, s]));

export function signaalstatusTerm(key) {
  return STATUS_TERM.get(key) ?? { key, kort: 'Onbekend', omschrijving: '', variant: 'muted' };
}

/** Statussen waarbij het signaal nog werk vertegenwoordigt. */
export const OPEN_STATUSSEN = new Set([
  SignaalStatus.NIEUW,
  SignaalStatus.BEKEKEN,
  SignaalStatus.ACTIE_AANGEMAAKT,
]);

/* ---------------------------------------------------------------
   Opvolging
   --------------------------------------------------------------- */

function laadOpvolging() {
  const ruw = lees(SLEUTEL, VERSIE, null);
  return ruw && typeof ruw === 'object' && !Array.isArray(ruw) ? ruw : {};
}

function bewaarOpvolging(opvolging) {
  return schrijf(SLEUTEL, VERSIE, opvolging);
}

/**
 * De standaardopvolging van een signaal dat nog nooit is aangeraakt.
 * Een signaal dat de gebruiker nooit heeft gezien is per definitie nieuw; dat
 * hoeft niet in de opslag te staan.
 */
function standaardOpvolging() {
  return {
    status: SignaalStatus.NIEUW,
    verantwoordelijkeId: null,
    actieId: null,
    reden: null,
    bekekenOp: null,
    gewijzigdOp: null,
  };
}

/**
 * Alle signalen met hun opvolging erbij.
 *
 * Een gekoppelde actie die niet meer bestaat wordt losgekoppeld: een verwijzing
 * naar een verwijderde actie zou een knop opleveren die nergens heen gaat.
 */
export function alleSignalen() {
  const opvolging = laadOpvolging();

  return SAMPLE_ALERTS.map((signaal) => {
    const eigen = { ...standaardOpvolging(), ...(opvolging[signaal.id] ?? {}) };
    const actie = eigen.actieId ? getActie(eigen.actieId) : null;

    if (eigen.actieId && !actie) {
      eigen.actieId = null;
      if (eigen.status === SignaalStatus.ACTIE_AANGEMAAKT) eigen.status = SignaalStatus.BEKEKEN;
    }

    return {
      ...signaal,
      status: STATUS_TERM.has(eigen.status) ? eigen.status : SignaalStatus.NIEUW,
      verantwoordelijkeId: eigen.verantwoordelijkeId,
      actieId: eigen.actieId,
      actie,
      reden: eigen.reden,
      bekekenOp: eigen.bekekenOp,
      gewijzigdOp: eigen.gewijzigdOp,
      open: OPEN_STATUSSEN.has(eigen.status),
    };
  });
}

export function getSignaal(id) {
  return alleSignalen().find((s) => s.id === id) ?? null;
}

function schrijfOpvolging(id, patch) {
  const opvolging = laadOpvolging();
  const huidig = { ...standaardOpvolging(), ...(opvolging[id] ?? {}) };
  opvolging[id] = { ...huidig, ...patch, gewijzigdOp: nu() };
  bewaarOpvolging(opvolging);
  return getSignaal(id);
}

/* ---------------------------------------------------------------
   Handelingen
   --------------------------------------------------------------- */

export function markeerBekeken(id) {
  const signaal = getSignaal(id);
  if (!signaal) return null;
  // Een signaal dat al verder in de werkstroom staat, valt niet terug naar
  // Bekeken. Terugvallen zou werk dat al gedaan is onzichtbaar maken.
  if (signaal.status !== SignaalStatus.NIEUW) return signaal;
  return schrijfOpvolging(id, { status: SignaalStatus.BEKEKEN, bekekenOp: nu() });
}

export function wijsSignaalToe(id, verantwoordelijkeId) {
  const signaal = getSignaal(id);
  if (!signaal) return null;
  const status = signaal.status === SignaalStatus.NIEUW ? SignaalStatus.BEKEKEN : signaal.status;
  return schrijfOpvolging(id, { verantwoordelijkeId: verantwoordelijkeId || null, status });
}

export function negeerSignaal(id, reden) {
  const tekst = String(reden ?? '').trim();
  if (!tekst) return null;
  return schrijfOpvolging(id, { status: SignaalStatus.GENEGEERD, reden: tekst });
}

export function losSignaalOp(id) {
  return schrijfOpvolging(id, { status: SignaalStatus.OPGELOST });
}

export function heropenSignaal(id) {
  return schrijfOpvolging(id, { status: SignaalStatus.BEKEKEN, reden: null });
}

/**
 * Zet een signaal om in een actie.
 *
 * De aanbeveling wordt de titel en het probleem met de oorzaak vormen de
 * omschrijving: dan staat in de actie waarom hij bestaat, ook wanneer iemand
 * hem later opent zonder het signaal erbij.
 *
 * Bestaat er al een actie voor dit signaal, dan wordt die teruggegeven en niet
 * een tweede gemaakt.
 *
 * @returns {{actie: object, nieuw: boolean}|null}
 */
export function maakActieVanSignaal(id, { verantwoordelijkeId = null, soort = null } = {}) {
  const signaal = getSignaal(id);
  if (!signaal) return null;

  if (signaal.actie) {
    return { actie: signaal.actie, nieuw: false, signaal };
  }

  const actie = maakAanActie({
    titel: signaal.aanbeveling,
    omschrijving: `${signaal.probleem}. ${signaal.oorzaak}.`,
    klantId: signaal.klantId,
    kanaal: signaal.kanaal,
    verantwoordelijkeId: verantwoordelijkeId ?? signaal.verantwoordelijkeId ?? null,
    status: ActieStatus.NIEUW,
    prioriteit: signaal.ernst === 'hoog' ? ActiePrioriteit.HOOG : ActiePrioriteit.MIDDEL,
    soort: soort ?? soortVoorKanaal(signaal.kanaal),
    signaalId: signaal.id,
  });

  const bijgewerkt = schrijfOpvolging(id, {
    status: SignaalStatus.ACTIE_AANGEMAAKT,
    actieId: actie.id,
    verantwoordelijkeId: actie.verantwoordelijkeId,
  });

  return { actie, nieuw: true, signaal: bijgewerkt };
}

/** Een redelijk werksoort op basis van de bron waar het signaal vandaan komt. */
function soortVoorKanaal(kanaal) {
  if (kanaal === 'ga4' || kanaal === 'crm') return ActieSoort.TRACKINGCONTROLE;
  return ActieSoort.OPTIMALISATIE;
}

/** Zet alle opvolging terug naar de uitgangssituatie. */
export function herstelSignalen() {
  bewaarOpvolging({});
}

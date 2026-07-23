/**
 * Repository voor werk: acties, signalen en planning.
 *
 * Dezelfde harde regel als in js/data/repository.js geldt hier: de tenantgrens
 * ligt vóór de view. Een view krijgt nooit een actie van een klant waar de
 * gebruiker geen toegang toe heeft, ook niet als hij daar zelf op zou filteren.
 *
 * Deze module staat naast repository.js in plaats van erin, omdat het om een
 * ander soort gegevens gaat: repository.js rekent cijfers door binnen een
 * periode, deze module beheert werk dat een status en een eigenaar heeft.
 */

import { SAMPLE_CLIENTS } from '../sample-data/shared.js';
import { toegankelijkeKlantIds, magKlantZien, can, Permission } from '../auth/permissions.js';
import { vindGebruikerOpId, isAgencyGebruiker, primaireOrganisatieId, Rol, primaireRol } from '../auth/domain.js';
import { metOverrides } from '../auth/demo-auth-provider.js';
import { kanaalLabel, ADVERTENTIEKANAAL_KEYS } from '../filters/channels.js';
import { isVoor, isNa, DEMO_TODAY } from '../filters/period.js';
import {
  alleActies, getActie, ActieStatus, actiestatusTerm, actieprioriteitTerm, actiesoortTerm,
} from '../model/actions.js';
import { alleSignalen, signaalstatusTerm, signaalTijdlijn, SignaalStatus } from '../model/signals.js';
import { allePlanningsitems, itembronTerm, ItemBron } from '../model/planning.js';

const ALLE_CLIENT_IDS = SAMPLE_CLIENTS.map((c) => c.id);

function klantOpId(id) {
  return SAMPLE_CLIENTS.find((c) => c.id === id) ?? null;
}

function gebruikerOpId(id) {
  const basis = vindGebruikerOpId(id);
  return basis ? metOverrides(basis) : null;
}

/* ---------------------------------------------------------------
   Acties
   --------------------------------------------------------------- */

/**
 * Verrijkt een actie met de gegevens die iedere weergave nodig heeft.
 * Zo staat de klantnaam op één plek in de code en niet in drie views.
 */
function verrijkActie(actie) {
  const klant = klantOpId(actie.klantId);
  const verantwoordelijke = gebruikerOpId(actie.verantwoordelijkeId);

  return {
    ...actie,
    klant,
    klantNaam: klant?.name ?? 'Geen klant',
    verantwoordelijke,
    verantwoordelijkeNaam: verantwoordelijke?.displayName ?? 'Niet toegewezen',
    kanaalNaam: actie.kanaal ? kanaalLabel(actie.kanaal) : 'Geen kanaal',
    statusTerm: actiestatusTerm(actie.status),
    prioriteitTerm: actieprioriteitTerm(actie.prioriteit),
    soortTerm: actiesoortTerm(actie.soort),
    verlopen: actie.deadline != null
      && actie.status !== ActieStatus.AFGEROND
      && isVoor(actie.deadline, DEMO_TODAY),
    dagenTotDeadline: actie.deadline ? dagenTussen(DEMO_TODAY, actie.deadline) : null,
  };
}

function dagenTussen(vanIso, totIso) {
  const van = Date.parse(`${vanIso}T00:00:00Z`);
  const tot = Date.parse(`${totIso}T00:00:00Z`);
  if (Number.isNaN(van) || Number.isNaN(tot)) return null;
  return Math.round((tot - van) / 86400000);
}

/**
 * Alle acties die deze gebruiker mag zien.
 *
 * Een klantgebruiker ziet uitsluitend acties van de eigen organisatie die
 * bewust met de klant gedeeld zijn. Interne acties komen niet in de klantlaag
 * terecht: dat is een eigenschap van de actie, geen filter in een view.
 *
 * @param {object} user
 * @param {{alleenEigen?: boolean, klantId?: string|null}} opties
 */
export function getToegankelijkeActies(user, { alleenEigen = false, klantId = null } = {}) {
  if (!user) return [];

  const toegestaan = new Set(toegankelijkeKlantIds(user, ALLE_CLIENT_IDS));
  const isKlantgebruiker = !isAgencyGebruiker(user);

  return alleActies()
    .filter((a) => !a.klantId || toegestaan.has(a.klantId))
    .filter((a) => !klantId || a.klantId === klantId)
    .filter((a) => !isKlantgebruiker || a.zichtbaarVoorKlant)
    .filter((a) => !alleenEigen || a.verantwoordelijkeId === user.id)
    .map(verrijkActie)
    .sort(opWerkvolgorde);
}

/**
 * De vaste volgorde van een actielijst.
 *
 * Eerst wat verlopen is, dan wat het hardst is, dan wat het eerst af moet. Een
 * lijst op alfabet zou netjes zijn en nutteloos: de volgorde hoort te vertellen
 * waar je begint.
 */
function opWerkvolgorde(a, b) {
  if (a.verlopen !== b.verlopen) return a.verlopen ? -1 : 1;
  const prio = b.prioriteitTerm.punten - a.prioriteitTerm.punten;
  if (prio !== 0) return prio;
  const deadlineA = a.deadline ?? '9999-12-31';
  const deadlineB = b.deadline ?? '9999-12-31';
  if (deadlineA !== deadlineB) return deadlineA.localeCompare(deadlineB);
  return a.titel.localeCompare(b.titel, 'nl');
}

export function getActieDetail(user, id) {
  const actie = getActie(id);
  if (!actie) return null;
  if (actie.klantId && !magKlantZien(user, actie.klantId)) return null;
  if (!isAgencyGebruiker(user) && !actie.zichtbaarVoorKlant) return null;

  const verrijkt = verrijkActie(actie);
  return {
    ...verrijkt,
    opmerkingen: actie.opmerkingen.map((o) => ({
      ...o,
      auteur: gebruikerOpId(o.auteurId),
      auteurNaam: gebruikerOpId(o.auteurId)?.displayName ?? 'Onbekend',
    })),
    signaal: actie.signaalId ? alleSignalen().find((s) => s.id === actie.signaalId) ?? null : null,
  };
}

/**
 * Of deze gebruiker deze actie mag wijzigen.
 *
 * Een beheerder mag alles binnen het bureau. Een medewerker mag zijn eigen werk
 * en het werk van de klanten die aan hem zijn toegewezen; dat laatste is nodig
 * omdat collega's elkaars klanten waarnemen. Een klantbeheerder mag reageren en
 * goedkeuren, maar niets herplannen. Een alleen-lezen klantgebruiker mag niets.
 */
export function magActieBewerken(user, actie) {
  if (!user || !actie) return false;
  if (!can(user, Permission.MANAGE_ACTIONS)) return false;
  if (!isAgencyGebruiker(user)) return false;
  if (can(user, Permission.ASSIGN_ACTIONS)) return true;
  if (actie.verantwoordelijkeId === user.id) return true;
  return actie.klantId ? magKlantZien(user, actie.klantId) : false;
}

/** Wie er als verantwoordelijke kan worden gekozen. */
export function getToewijsbareMedewerkers(user) {
  if (!can(user, Permission.ASSIGN_ACTIONS)) {
    return user && isAgencyGebruiker(user) ? [metOverrides(user)] : [];
  }
  return ALLE_CLIENT_IDS.length
    ? [...new Set(SAMPLE_CLIENTS.flatMap((c) => [c.primaryOwnerId, ...(c.supportingOwnerIds ?? [])]))]
      .map(gebruikerOpId)
      .filter(Boolean)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'nl'))
    : [];
}

/**
 * Een samenvatting van de actielijst voor tellers en widgets.
 * Wordt uit dezelfde lijst berekend als het bord, zodat een teller nooit iets
 * anders zegt dan de kolom eronder.
 */
export function actieSamenvatting(acties, { vandaag = DEMO_TODAY } = {}) {
  return {
    totaal: acties.length,
    perStatus: Object.fromEntries(
      Object.values(ActieStatus).map((s) => [s, acties.filter((a) => a.status === s).length])
    ),
    vandaag: acties.filter((a) => a.startdatum === vandaag || a.deadline === vandaag),
    verlopen: acties.filter((a) => a.verlopen),
    wachtOpKlant: acties.filter((a) => a.status === ActieStatus.WACHT_OP_KLANT),
    open: acties.filter((a) => a.status !== ActieStatus.AFGEROND),
  };
}

/* ---------------------------------------------------------------
   Signalen
   --------------------------------------------------------------- */

/**
 * Signalen die deze gebruiker mag zien, met hun opvolging.
 *
 * Klantgebruikers krijgen hier niets: signalen zijn een intern werkinstrument
 * en bevatten formuleringen die niet voor de klant bedoeld zijn.
 *
 * Het periode- en kanaalfilter werkt hetzelfde als bij de cijfers: een signaal
 * over een advertentiekanaal verdwijnt wanneer dat kanaal niet is geselecteerd,
 * een signaal over een meetbron blijft staan.
 */
export function getWerkSignalen(user, filters = null, { klantId = null } = {}) {
  if (!can(user, Permission.VIEW_AGENCY_SIGNALS)) return [];
  const toegestaan = new Set(toegankelijkeKlantIds(user, ALLE_CLIENT_IDS));

  return alleSignalen()
    .filter((s) => toegestaan.has(s.klantId))
    .filter((s) => !klantId || s.klantId === klantId)
    .filter((s) => {
      if (!filters) return true;
      const binnenPeriode = !isVoor(s.startdatum, filters.periode.startDate)
        && !isNa(s.startdatum, filters.periode.endDate);
      if (!binnenPeriode) return false;
      const isAdvertentiekanaal = ADVERTENTIEKANAAL_KEYS.includes(s.kanaal);
      if (isAdvertentiekanaal && !(filters.channels ?? []).includes(s.kanaal)) return false;
      return true;
    })
    .map((s) => {
      const klant = klantOpId(s.klantId);
      const verantwoordelijke = gebruikerOpId(s.verantwoordelijkeId);
      // De tijdlijn krijgt namen: de gebruiker leest "Berry plaatste …", niet een id.
      const tijdlijn = signaalTijdlijn(s).map((e) => ({
        ...e,
        actorNaam: e.auteurId
          ? gebruikerOpId(e.auteurId)?.displayName ?? null
          : e.medewerkerId
            ? gebruikerOpId(e.medewerkerId)?.displayName ?? null
            : null,
      }));
      return {
        ...s,
        klant,
        klantNaam: klant?.name ?? 'Onbekende klant',
        kanaalLabel: kanaalLabel(s.kanaal),
        verantwoordelijke,
        verantwoordelijkeNaam: verantwoordelijke?.displayName ?? 'Niet toegewezen',
        statusTerm: signaalstatusTerm(s.status),
        ouderdomDagen: dagenTussen(s.startdatum, DEMO_TODAY),
        actiesVerrijkt: (s.acties ?? []).map(verrijkActie),
        tijdlijn,
      };
    })
    .sort((a, b) => {
      // Nieuw en hoog eerst, daarna op ouderdom. Een signaal dat al drie weken
      // open staat, moet je niet onderaan hoeven zoeken.
      const nieuwA = a.status === SignaalStatus.NIEUW ? 0 : 1;
      const nieuwB = b.status === SignaalStatus.NIEUW ? 0 : 1;
      if (nieuwA !== nieuwB) return nieuwA - nieuwB;
      const ernstA = a.ernst === 'hoog' ? 0 : 1;
      const ernstB = b.ernst === 'hoog' ? 0 : 1;
      if (ernstA !== ernstB) return ernstA - ernstB;
      return (b.ouderdomDagen ?? 0) - (a.ouderdomDagen ?? 0);
    });
}

/** Signalen die nog door niemand zijn bekeken. */
export function nieuweSignalen(signalen) {
  return signalen.filter((s) => s.status === SignaalStatus.NIEUW);
}

/* ---------------------------------------------------------------
   Planning
   --------------------------------------------------------------- */

/**
 * Planbare items binnen een datumbereik, gefilterd op wat de gebruiker mag zien.
 *
 * Een medewerker zonder recht op de volledige planning ziet alleen zijn eigen
 * agenda. Dat is geen beperking van het scherm maar van de gegevens: de rest
 * komt niet uit deze functie.
 */
export function getPlanning(user, { van, tot, medewerkerId = null, klantId = null, soort = null } = {}) {
  if (!can(user, Permission.VIEW_AGENCY_PLANNING) && !can(user, Permission.VIEW_CLIENT_COLLABORATION)) {
    return [];
  }

  const toegestaan = new Set(toegankelijkeKlantIds(user, ALLE_CLIENT_IDS));
  const isKlantgebruiker = !isAgencyGebruiker(user);
  const alleenEigen = isAgencyGebruiker(user) && !can(user, Permission.VIEW_ALL_PLANNING);

  // Eén keer opzoeken, zodat een item met een signaalkoppeling zijn signaal kan
  // tonen zonder per item de hele lijst opnieuw te lezen.
  const signaalById = new Map(alleSignalen().map((s) => [s.id, s]));

  return allePlanningsitems()
    .filter((i) => !i.klantId || toegestaan.has(i.klantId))
    .filter((i) => !van || i.datum >= van)
    .filter((i) => !tot || i.datum <= tot)
    .filter((i) => !klantId || i.klantId === klantId)
    .filter((i) => !soort || i.soort === soort)
    .filter((i) => !medewerkerId || i.medewerkerId === medewerkerId)
    // Een medewerker ziet standaard de planning van zijn eigen klanten; dat is
    // hoe waarneming werkt binnen een klein team.
    .filter((i) => !alleenEigen || !medewerkerId || i.medewerkerId === medewerkerId)
    // Een klant ziet uitsluitend afspraken die met hem gaan, niet het interne
    // werkblok waarin iemand zijn campagnes optimaliseert.
    .filter((i) => !isKlantgebruiker || i.bron === ItemBron.MEETING)
    .map((i) => {
      const klant = klantOpId(i.klantId);
      const medewerker = gebruikerOpId(i.medewerkerId);
      // Een signaalkoppeling is intern: een klantgebruiker krijgt hem niet, ook
      // niet als een resultaatcontrole toevallig een klantafspraak is.
      const signaal = i.signaalId && !isKlantgebruiker ? signaalById.get(i.signaalId) ?? null : null;
      return {
        ...i,
        klant,
        klantNaam: klant?.name ?? 'Zonder klant',
        medewerker,
        medewerkerNaam: medewerker?.displayName ?? 'Niet toegewezen',
        bronTerm: itembronTerm(i.bron),
        soortTerm: actiesoortTerm(i.soort),
        verplaatsbaar: i.bron !== ItemBron.EXTERN,
        signaal,
        signaalProbleem: signaal?.probleem ?? null,
      };
    });
}

/* ---------------------------------------------------------------
   Klantcontext
   --------------------------------------------------------------- */

/** De klant waar een klantgebruiker bij hoort, of de gekozen klantcontext. */
export function eigenKlantId(user) {
  if (!user) return null;
  return isAgencyGebruiker(user) ? null : primaireOrganisatieId(user);
}

/** Of deze gebruiker een agencybeheerder is. Gebruikt voor navigatiekeuzes. */
export function isBeheerder(user) {
  return primaireRol(user) === Rol.AGENCY_ADMIN;
}

export { verrijkActie };

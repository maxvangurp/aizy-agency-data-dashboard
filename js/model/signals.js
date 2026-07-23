/**
 * Signaalmodel — de kern van één gesloten werkproces.
 *
 * Een signaal is geen kaartje maar een stuk werk dat een uitkomst hoort te
 * krijgen. Het doorloopt een vaste werkstroom en die werkstroom is overal
 * afleesbaar:
 *
 *   Ontdekt → Beoordelen → Actie aanmaken → Inplannen → Uitvoeren →
 *   Resultaat controleren → Oplossen of vervolgactie
 *
 * WAT WAAR STAAT
 *   De inhoud van een signaal — probleem, oorzaak, aanbeveling, kanaal,
 *   startdatum — komt uit sample-data en verandert niet door een gebruiker.
 *   De opvolging — status, toewijzing, gekoppelde acties, geplande controle,
 *   uitkomst en de tijdlijn — is wél van de gebruiker en staat in de demo-opslag.
 *
 * EXPLICIETE RELATIES
 *   Een signaal draagt de id's van de acties die eruit voortkwamen
 *   (`linkedActionIds`, met één `primaryActionId`). Een actie draagt omgekeerd
 *   `signaalId`. De planning van een actie is de startdatum van diezelfde actie;
 *   een geplande resultaatcontrole is een planningsitem dat het signaal-id
 *   draagt. Zo is elke relatie signaal ↔ actie ↔ planning terug te lopen.
 *
 * GEEN DUBBELE ACTIES, GEEN AUTOMATISCHE AFSLUITING
 *   `maakActieVanSignaal` weigert een tweede primaire actie voor hetzelfde
 *   signaal. En een afgeronde actie sluit het signaal nooit vanzelf: dan verschijnt
 *   de stap "resultaat controleren", die een mens bewust afrondt met
 *   `beoordeelResultaat`. Statussen die wél automatisch meebewegen (in uitvoering,
 *   wacht op controle) zijn afgeleid van de actiestatus en dus uitlegbaar.
 *
 * MIGRATIE
 *   Oudere opvolging kende alleen `actieId`. Die wordt bij het lezen omgezet naar
 *   `linkedActionIds`/`primaryActionId`; ontbrekende velden krijgen hun standaard.
 *   Zo overleeft bestaande demo-opvolging de uitbreiding zonder verlies.
 */

import { lees, schrijf, nu } from './store.js';
import {
  maakAanActie, getActie, zetDatum,
  ActieStatus, ActiePrioriteit, ActieSoort,
} from './actions.js';
import { maakAanPlanningsitem, ItemBron } from './planning.js';
import { SAMPLE_ALERTS } from '../sample-data/shared.js';

const SLEUTEL = 'signalen';
const VERSIE = 2;

export const SignaalStatus = {
  NIEUW: 'nieuw',
  BEKEKEN: 'bekeken',
  ACTIE_AANGEMAAKT: 'actie-aangemaakt',
  IN_UITVOERING: 'in-uitvoering',
  WACHT_OP_CONTROLE: 'wacht-op-controle',
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
    key: SignaalStatus.IN_UITVOERING,
    kort: 'In uitvoering',
    omschrijving: 'De gekoppelde actie wordt op dit moment uitgevoerd.',
    variant: 'info',
  },
  {
    key: SignaalStatus.WACHT_OP_CONTROLE,
    kort: 'Wacht op controle',
    omschrijving: 'De actie is uitgevoerd; het resultaat moet nog worden gecontroleerd voordat het signaal sluit.',
    variant: 'middel',
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
    omschrijving: 'Het onderliggende probleem is verholpen en gecontroleerd.',
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
  SignaalStatus.IN_UITVOERING,
  SignaalStatus.WACHT_OP_CONTROLE,
]);

/** De uitkomst van een resultaatcontrole. */
export const Resultaat = {
  OPGELOST: 'opgelost',
  VERVOLG: 'vervolgactie',
  HEROPENEN: 'heropenen',
};

/* ---------------------------------------------------------------
   Opvolging: lezen, migreren, schrijven
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
    linkedActionIds: [],
    primaryActionId: null,
    reden: null,
    bekekenOp: null,
    reviewedAt: null,
    plannedAt: null,
    nextReviewAt: null,
    resolvedAt: null,
    ignoredAt: null,
    resolutionType: null,
    resolutionNote: null,
    timeline: [],
    gewijzigdOp: null,
  };
}

/**
 * Normaliseert een opgeslagen opvolging naar de huidige vorm.
 * Oudere opvolging (alleen `actieId`) wordt omgezet naar de lijst met acties,
 * zodat bestaande demodata de uitbreiding overleeft.
 */
function normaliseer(ruw) {
  const eigen = { ...standaardOpvolging(), ...(ruw ?? {}) };
  if (!Array.isArray(eigen.timeline)) eigen.timeline = [];

  if ((!Array.isArray(eigen.linkedActionIds) || !eigen.linkedActionIds.length) && ruw?.actieId) {
    eigen.linkedActionIds = [ruw.actieId];
    eigen.primaryActionId = ruw.actieId;
  }
  if (!Array.isArray(eigen.linkedActionIds)) eigen.linkedActionIds = [];
  if (!eigen.primaryActionId && eigen.linkedActionIds.length) {
    [eigen.primaryActionId] = eigen.linkedActionIds;
  }
  return eigen;
}

/**
 * Leidt de zichtbare status af uit de opgeslagen status én de stand van de
 * primaire actie. De afleiding is uitlegbaar en sluit het signaal nooit vanzelf:
 *   - actie in uitvoering  → In uitvoering
 *   - actie afgerond       → Wacht op controle (niet: opgelost)
 * Een door de gebruiker gezette eindstatus (opgelost/genegeerd) blijft staan.
 */
function afgeleideStatus(raw, primaireActie) {
  if (raw === SignaalStatus.OPGELOST || raw === SignaalStatus.GENEGEERD) return raw;
  if (!primaireActie) return raw;
  if (primaireActie.status === ActieStatus.AFGEROND) return SignaalStatus.WACHT_OP_CONTROLE;
  if (primaireActie.status === ActieStatus.BEZIG || primaireActie.status === ActieStatus.WACHT_OP_KLANT) {
    return SignaalStatus.IN_UITVOERING;
  }
  return SignaalStatus.ACTIE_AANGEMAAKT;
}

/**
 * Alle signalen met hun opvolging, gekoppelde acties, afgeleide status en de
 * berekende workflow. Verwijzingen naar verwijderde acties worden opgeschoond.
 */
export function alleSignalen() {
  const opvolging = laadOpvolging();

  return SAMPLE_ALERTS.map((signaal) => {
    const eigen = normaliseer(opvolging[signaal.id]);

    // De gekoppelde acties komen uit de opvolging: dat is de werkstroom die de
    // gebruiker zelf opbouwt. Verwijderde acties worden opgeschoond, zodat een
    // knop nooit naar een niet-bestaande actie wijst.
    const gekoppeld = eigen.linkedActionIds.map(getActie).filter(Boolean);
    const geldigeIds = gekoppeld.map((a) => a.id);
    eigen.linkedActionIds = geldigeIds;
    if (eigen.primaryActionId && !geldigeIds.includes(eigen.primaryActionId)) {
      eigen.primaryActionId = geldigeIds[0] ?? null;
    }

    const primaireActie = eigen.primaryActionId
      ? gekoppeld.find((a) => a.id === eigen.primaryActionId) ?? null
      : null;
    const rawStatus = STATUS_TERM.has(eigen.status) ? eigen.status : SignaalStatus.NIEUW;
    const status = afgeleideStatus(rawStatus, primaireActie);

    const verrijkt = {
      ...signaal,
      rawStatus,
      status,
      verantwoordelijkeId: eigen.verantwoordelijkeId,
      linkedActionIds: geldigeIds,
      primaryActionId: eigen.primaryActionId,
      acties: gekoppeld,
      // Compat: veel views verwachten nog één gekoppelde (primaire) actie.
      actie: primaireActie,
      actieId: eigen.primaryActionId,
      reden: eigen.reden,
      bekekenOp: eigen.bekekenOp,
      reviewedAt: eigen.reviewedAt,
      plannedAt: primaireActie?.startdatum ?? eigen.plannedAt ?? null,
      nextReviewAt: eigen.nextReviewAt,
      resolvedAt: eigen.resolvedAt,
      ignoredAt: eigen.ignoredAt,
      resolutionType: eigen.resolutionType,
      resolutionNote: eigen.resolutionNote,
      timeline: eigen.timeline,
      gewijzigdOp: eigen.gewijzigdOp,
      open: OPEN_STATUSSEN.has(status),
    };
    verrijkt.workflow = bepaalWorkflow(verrijkt);
    return verrijkt;
  });
}

export function getSignaal(id) {
  return alleSignalen().find((s) => s.id === id) ?? null;
}

/**
 * Schrijft een patch én een optionele tijdlijngebeurtenis weg.
 * De tijdlijn is bewust append-only: de geschiedenis van een signaal hoort niet
 * te veranderen door een latere handeling.
 */
function schrijfOpvolging(id, patch, gebeurtenis = null) {
  const opvolging = laadOpvolging();
  const huidig = normaliseer(opvolging[id]);
  const timeline = gebeurtenis
    ? [...huidig.timeline, { op: nu(), ...gebeurtenis }]
    : huidig.timeline;
  opvolging[id] = { ...huidig, ...patch, timeline, gewijzigdOp: nu() };
  bewaarOpvolging(opvolging);
  return getSignaal(id);
}

/* ---------------------------------------------------------------
   Workflow: waar staat dit signaal in het proces?
   --------------------------------------------------------------- */

export const WORKFLOW_STAPPEN = [
  { key: 'ontdekt', label: 'Ontdekt' },
  { key: 'beoordeeld', label: 'Beoordeeld' },
  { key: 'actie', label: 'Actie aangemaakt' },
  { key: 'ingepland', label: 'Ingepland' },
  { key: 'uitvoeren', label: 'In uitvoering' },
  { key: 'controle', label: 'Resultaat gecontroleerd' },
  { key: 'opgelost', label: 'Opgelost' },
];

/**
 * Berekent per stap of hij is afgerond, welke stap nu aan de beurt is en wat de
 * eerstvolgende concrete handeling is. Zo heeft elk signaal altijd een duidelijke
 * volgende stap.
 */
export function bepaalWorkflow(signaal) {
  const primair = signaal.actie;
  const werk = primair && [ActieStatus.BEZIG, ActieStatus.WACHT_OP_KLANT, ActieStatus.AFGEROND].includes(primair.status);
  const uitgevoerd = primair && primair.status === ActieStatus.AFGEROND;

  const gedaan = {
    ontdekt: true,
    beoordeeld: signaal.rawStatus !== SignaalStatus.NIEUW || Boolean(signaal.reviewedAt),
    actie: Boolean(signaal.primaryActionId),
    ingepland: Boolean(signaal.plannedAt),
    uitvoeren: Boolean(werk),
    controle: Boolean(signaal.resolvedAt),
    opgelost: signaal.rawStatus === SignaalStatus.OPGELOST,
  };

  // Maak de stappenbalk monotoon: is een latere stap bereikt, dan gelden de
  // eerdere stappen als gedaan. Zo kleurt de balk nooit groen ná de huidige stap
  // (bijvoorbeeld een actie die al in uitvoering is maar nog geen datum had).
  let laterGedaan = false;
  for (let i = WORKFLOW_STAPPEN.length - 1; i >= 0; i -= 1) {
    const key = WORKFLOW_STAPPEN[i].key;
    if (laterGedaan) gedaan[key] = true;
    else if (gedaan[key]) laterGedaan = true;
  }

  const genegeerd = signaal.rawStatus === SignaalStatus.GENEGEERD;
  const huidige = WORKFLOW_STAPPEN.find((s) => !gedaan[s.key]) ?? null;

  const stappen = WORKFLOW_STAPPEN.map((s) => ({
    key: s.key,
    label: s.label,
    status: genegeerd
      ? (gedaan[s.key] ? 'gedaan' : 'vervallen')
      : gedaan[s.key] ? 'gedaan' : (s.key === huidige?.key ? 'huidig' : 'open'),
  }));

  return {
    stappen,
    genegeerd,
    huidigeStap: genegeerd ? 'genegeerd' : huidige?.key ?? 'opgelost',
    volgendeStap: volgendeStapTekst(signaal, { huidige, genegeerd, uitgevoerd }),
  };
}

/** Een concrete, menselijke omschrijving van de eerstvolgende stap. */
function volgendeStapTekst(signaal, { huidige, genegeerd, uitgevoerd }) {
  if (genegeerd) {
    return { tekst: 'Genegeerd. Heropen het signaal om het alsnog op te pakken.', actie: 'heropenen' };
  }
  switch (huidige?.key) {
    case 'beoordeeld':
      return { tekst: 'Beoordeel dit signaal en bepaal of er werk voor nodig is.', actie: 'beoordelen' };
    case 'actie':
      return { tekst: 'Maak een actie aan die dit signaal opvolgt.', actie: 'actie-maken' };
    case 'ingepland':
      return { tekst: 'Plan de gekoppelde actie in.', actie: 'plannen' };
    case 'uitvoeren':
      return { tekst: 'Voer de gekoppelde actie uit op het actiebord.', actie: 'uitvoeren' };
    case 'controle':
      return uitgevoerd
        ? {
          tekst: signaal.nextReviewAt
            ? 'Controleer op de geplande datum of het probleem is verholpen.'
            : 'De actie is uitgevoerd. Plan een resultaatcontrole of beoordeel het resultaat.',
          actie: 'controleren',
        }
        : { tekst: 'Wacht tot de gekoppelde actie is uitgevoerd.', actie: 'wachten' };
    case 'opgelost':
      return { tekst: 'Beoordeel het resultaat en sluit het signaal of maak een vervolgactie.', actie: 'beoordelen-resultaat' };
    default:
      return { tekst: 'Dit signaal is opgelost.', actie: 'geen' };
  }
}

/* ---------------------------------------------------------------
   Gedeelde tijdlijn (signaal ↔ actie ↔ planning)
   --------------------------------------------------------------- */

/**
 * De activiteitentijdlijn van een signaal: eigen procesgebeurtenissen samengevoegd
 * met de gebeurtenissen van de gekoppelde acties (aangemaakt, opmerkingen,
 * afgerond). Eén doorlopend verhaal over alle drie de werkgebieden.
 */
export function signaalTijdlijn(signaal) {
  const sig = signaal && signaal.timeline ? signaal : getSignaal(signaal?.id ?? signaal);
  if (!sig) return [];

  const events = [
    { op: `${sig.startdatum}T00:00:00.000Z`, type: 'ontstaan', tekst: 'Signaal ontstaan uit de data.' },
    ...(sig.timeline ?? []).map((e) => ({ ...e })),
  ];

  for (const actie of sig.acties ?? []) {
    events.push({
      op: actie.aangemaaktOp,
      type: 'actie',
      tekst: `Actie aangemaakt: ${actie.titel}`,
      actieId: actie.id,
    });
    for (const opm of actie.opmerkingen ?? []) {
      events.push({ op: opm.op, type: 'opmerking', tekst: opm.tekst, actieId: actie.id, auteurId: opm.auteurId });
    }
    if (actie.status === ActieStatus.AFGEROND) {
      events.push({ op: actie.gewijzigdOp, type: 'uitgevoerd', tekst: `Actie afgerond: ${actie.titel}`, actieId: actie.id });
    }
  }

  return events
    .filter((e) => e.op)
    .sort((a, b) => String(a.op).localeCompare(String(b.op)));
}

/* ---------------------------------------------------------------
   Handelingen
   --------------------------------------------------------------- */

export function markeerBekeken(id) {
  const signaal = getSignaal(id);
  if (!signaal) return null;
  // Een signaal dat al verder in de werkstroom staat, valt niet terug naar
  // Bekeken. Terugvallen zou werk dat al gedaan is onzichtbaar maken.
  if (signaal.rawStatus !== SignaalStatus.NIEUW) return signaal;
  return schrijfOpvolging(
    id,
    { status: SignaalStatus.BEKEKEN, bekekenOp: nu(), reviewedAt: nu() },
    { type: 'beoordeeld', tekst: 'Signaal beoordeeld.' }
  );
}

export function wijsSignaalToe(id, verantwoordelijkeId) {
  const signaal = getSignaal(id);
  if (!signaal) return null;
  const status = signaal.rawStatus === SignaalStatus.NIEUW ? SignaalStatus.BEKEKEN : signaal.rawStatus;
  return schrijfOpvolging(
    id,
    { verantwoordelijkeId: verantwoordelijkeId || null, status },
    {
      type: 'toegewezen',
      tekst: verantwoordelijkeId ? 'Verantwoordelijke toegewezen.' : 'Toewijzing verwijderd.',
      medewerkerId: verantwoordelijkeId || null,
    }
  );
}

export function negeerSignaal(id, reden) {
  const tekst = String(reden ?? '').trim();
  if (!tekst) return null;
  return schrijfOpvolging(
    id,
    { status: SignaalStatus.GENEGEERD, reden: tekst, ignoredAt: nu() },
    { type: 'genegeerd', tekst: `Signaal genegeerd: ${tekst}` }
  );
}

export function losSignaalOp(id) {
  return schrijfOpvolging(
    id,
    { status: SignaalStatus.OPGELOST, resolvedAt: nu(), resolutionType: Resultaat.OPGELOST },
    { type: 'opgelost', tekst: 'Signaal gemarkeerd als opgelost.' }
  );
}

export function heropenSignaal(id) {
  return schrijfOpvolging(
    id,
    {
      status: SignaalStatus.BEKEKEN,
      reden: null,
      resolvedAt: null,
      ignoredAt: null,
      resolutionType: null,
      resolutionNote: null,
    },
    { type: 'heropend', tekst: 'Signaal heropend.' }
  );
}

/**
 * Zet een signaal om in een actie.
 *
 * De aanbeveling wordt de titel en het probleem met de oorzaak vormen de
 * omschrijving: dan staat in de actie waarom hij bestaat, ook wanneer iemand hem
 * later opent zonder het signaal erbij. Bestaat er al een primaire actie voor dit
 * signaal, dan wordt die teruggegeven en niet een tweede gemaakt.
 *
 * @returns {{actie: object, nieuw: boolean, signaal: object}|null}
 */
export function maakActieVanSignaal(id, { verantwoordelijkeId = null, soort = null, vervolg = false } = {}) {
  const signaal = getSignaal(id);
  if (!signaal) return null;

  if (signaal.actie && !vervolg) {
    return { actie: signaal.actie, nieuw: false, signaal };
  }

  const actie = maakAanActie({
    titel: vervolg ? `Vervolg: ${signaal.aanbeveling}` : signaal.aanbeveling,
    omschrijving: `${signaal.probleem}. ${signaal.oorzaak}.`,
    klantId: signaal.klantId,
    kanaal: signaal.kanaal,
    verantwoordelijkeId: verantwoordelijkeId ?? signaal.verantwoordelijkeId ?? null,
    status: ActieStatus.NIEUW,
    prioriteit: signaal.ernst === 'hoog' ? ActiePrioriteit.HOOG : ActiePrioriteit.MIDDEL,
    soort: soort ?? soortVoorKanaal(signaal.kanaal),
    signaalId: signaal.id,
  });

  const linked = [...new Set([...signaal.linkedActionIds, actie.id])];
  // Een (vervolg)actie wordt de nieuwe primaire actie: het signaal volgt nu die
  // actie. Bij een vervolgactie loopt het signaal weer als "actie aangemaakt".
  const patch = {
    linkedActionIds: linked,
    primaryActionId: actie.id,
    verantwoordelijkeId: actie.verantwoordelijkeId ?? signaal.verantwoordelijkeId,
    status: SignaalStatus.ACTIE_AANGEMAAKT,
  };
  if (vervolg) {
    patch.resolvedAt = null;
    patch.resolutionType = null;
  }

  const bijgewerkt = schrijfOpvolging(id, patch, {
    type: vervolg ? 'vervolgactie' : 'actie-aangemaakt',
    tekst: vervolg ? `Vervolgactie aangemaakt: ${actie.titel}` : `Actie aangemaakt vanuit dit signaal: ${actie.titel}`,
    actieId: actie.id,
  });

  return { actie, nieuw: true, signaal: bijgewerkt };
}

/**
 * Plant de opvolging van een signaal in: geeft de primaire actie een startdatum,
 * zodat hij in de planning verschijnt. Zonder actie kan er niets worden gepland;
 * dan is "actie aanmaken" de juiste eerstvolgende stap.
 *
 * @returns {{ok: boolean, reden?: string, signaal?: object, actie?: object}}
 */
export function planSignaalOpvolging(id, datum) {
  const signaal = getSignaal(id);
  if (!signaal) return { ok: false, reden: 'Dit signaal bestaat niet meer.' };
  if (!datum) return { ok: false, reden: 'Er is geen datum opgegeven.' };
  if (!signaal.primaryActionId) {
    return { ok: false, reden: 'Maak eerst een actie aan; die kan daarna worden ingepland.' };
  }
  const actie = zetDatum(signaal.primaryActionId, datum);
  if (!actie) return { ok: false, reden: 'De gekoppelde actie bestaat niet meer.' };

  const bijgewerkt = schrijfOpvolging(id, { plannedAt: datum }, {
    type: 'ingepland',
    tekst: `Opvolging ingepland op ${datum}.`,
    actieId: actie.id,
  });
  return { ok: true, signaal: bijgewerkt, actie };
}

/**
 * Plant een resultaatcontrole ná uitvoering: een planningsitem dat het signaal-id
 * draagt, zodat de controle vanuit signaal én planning terug te vinden is. Dit
 * lost het signaal niet op; het zet alleen het controlemoment vast.
 *
 * @returns {{ok: boolean, reden?: string, item?: object, signaal?: object}}
 */
export function planResultaatcontrole(id, { datum, medewerkerId = null } = {}) {
  const signaal = getSignaal(id);
  if (!signaal) return { ok: false, reden: 'Dit signaal bestaat niet meer.' };
  if (!datum) return { ok: false, reden: 'Er is geen datum opgegeven.' };

  const item = maakAanPlanningsitem({
    titel: `Resultaatcontrole: ${signaal.aanbeveling ?? signaal.probleem}`,
    bron: ItemBron.MEETING,
    soort: signaal.kanaal === 'ga4' || signaal.kanaal === 'crm' ? ActieSoort.TRACKINGCONTROLE : ActieSoort.CAMPAGNECONTROLE,
    klantId: signaal.klantId,
    medewerkerId: medewerkerId ?? signaal.verantwoordelijkeId ?? null,
    datum,
    starttijd: '09:00',
    duurMinuten: 30,
    signaalId: signaal.id,
  });

  const bijgewerkt = schrijfOpvolging(id, { nextReviewAt: datum }, {
    type: 'controle-gepland',
    tekst: `Resultaatcontrole ingepland op ${datum}.`,
    planningId: item.id,
  });
  return { ok: true, item, signaal: bijgewerkt };
}

/**
 * Beoordeelt het resultaat na uitvoering. Dit is de bewuste, menselijke afsluiting
 * die een afgeronde actie nooit vanzelf doet:
 *   - opgelost      → het signaal sluit;
 *   - vervolgactie  → er wordt een nieuwe actie gemaakt en het signaal loopt door;
 *   - heropenen     → het signaal gaat terug naar bekeken.
 *
 * @returns {{ok: boolean, reden?: string, signaal?: object, actie?: object}}
 */
export function beoordeelResultaat(id, { uitkomst, notitie = null, verantwoordelijkeId = null } = {}) {
  const signaal = getSignaal(id);
  if (!signaal) return { ok: false, reden: 'Dit signaal bestaat niet meer.' };
  const note = notitie ? String(notitie).trim() : null;

  if (uitkomst === Resultaat.OPGELOST) {
    const bijgewerkt = schrijfOpvolging(id, {
      status: SignaalStatus.OPGELOST,
      resolvedAt: nu(),
      resolutionType: Resultaat.OPGELOST,
      resolutionNote: note,
    }, { type: 'opgelost', tekst: note ? `Resultaat gecontroleerd en opgelost: ${note}` : 'Resultaat gecontroleerd en opgelost.' });
    return { ok: true, signaal: bijgewerkt };
  }

  if (uitkomst === Resultaat.VERVOLG) {
    const gemaakt = maakActieVanSignaal(id, { verantwoordelijkeId, vervolg: true });
    if (!gemaakt) return { ok: false, reden: 'Er kon geen vervolgactie worden gemaakt.' };
    const bijgewerkt = note
      ? schrijfOpvolging(id, { resolutionNote: note }, { type: 'notitie', tekst: note })
      : gemaakt.signaal;
    return { ok: true, signaal: bijgewerkt, actie: gemaakt.actie };
  }

  if (uitkomst === Resultaat.HEROPENEN) {
    const bijgewerkt = schrijfOpvolging(id, {
      status: SignaalStatus.BEKEKEN,
      resolvedAt: null,
      resolutionType: null,
      resolutionNote: note,
    }, { type: 'heropend', tekst: note ? `Resultaat onvoldoende, heropend: ${note}` : 'Resultaat onvoldoende, signaal heropend.' });
    return { ok: true, signaal: bijgewerkt };
  }

  return { ok: false, reden: 'Onbekende uitkomst.' };
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

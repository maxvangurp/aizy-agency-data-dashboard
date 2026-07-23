/**
 * Widgetindeling van Mijn werk.
 *
 * De persoonlijke startpagina hoort van de gebruiker te zijn. Wie 's ochtends
 * eerst naar zijn meetings kijkt, moet die bovenaan kunnen zetten zonder dat er
 * een ontwikkelaar aan te pas komt.
 *
 * WAT ER WORDT BEWAARD
 *   volgorde   de volgorde van de widgets, als lijst van widget-ids
 *   verborgen  welke widgets niet worden getoond
 *   groottes   de breedte per widget: klein, middel of groot
 *
 * De catalogus staat in code: welke widgets bestaan, wat ze tonen en welke rol
 * ze mag zien. De indeling staat in opslag. Een widget die uit de catalogus
 * verdwijnt, verdwijnt daardoor vanzelf uit ieders indeling.
 */

import { lees, schrijf, wis } from './store.js';

const VERSIE = 2;

export const Grootte = {
  KLEIN: 'klein',
  MIDDEL: 'middel',
  GROOT: 'groot',
};

export const GROOTTES = [
  { key: Grootte.KLEIN, kort: 'Smal', kolommen: 1 },
  { key: Grootte.MIDDEL, kort: 'Normaal', kolommen: 2 },
  { key: Grootte.GROOT, kort: 'Breed', kolommen: 3 },
];

/**
 * De beschikbare widgets.
 *
 * `standaard` bepaalt of een widget in een verse indeling staat. Widgets die
 * niet standaard aan staan zijn niet minder waard: ze zijn alleen niet voor
 * iedereen dagelijks relevant.
 */
export const WIDGET_CATALOGUS = [
  {
    id: 'acties-vandaag',
    titel: 'Mijn acties vandaag',
    omschrijving: 'Acties waaraan vandaag gewerkt wordt of die vandaag aflopen.',
    grootte: Grootte.MIDDEL,
    standaard: true,
  },
  {
    id: 'meetings',
    titel: 'Komende meetings',
    omschrijving: 'Afspraken in de komende zeven dagen.',
    grootte: Grootte.KLEIN,
    standaard: true,
  },
  {
    id: 'klanten-aandacht',
    titel: 'Klanten met aandacht',
    omschrijving: 'Klanten met een afwijking die vandaag om een besluit vraagt.',
    grootte: Grootte.MIDDEL,
    standaard: true,
  },
  {
    id: 'nieuwe-signalen',
    titel: 'Nieuwe signalen',
    omschrijving: 'Signalen die nog door niemand zijn bekeken.',
    grootte: Grootte.KLEIN,
    standaard: true,
  },
  {
    id: 'wacht-op-klant',
    titel: 'Wacht op klant',
    omschrijving: 'Werk dat stilligt tot de klant iets aanlevert of goedkeurt.',
    grootte: Grootte.KLEIN,
    standaard: true,
  },
  {
    id: 'budget',
    titel: 'Budgetafwijkingen',
    omschrijving: 'Klanten die boven of onder het budget voor deze periode liggen.',
    grootte: Grootte.KLEIN,
    standaard: true,
  },
  {
    id: 'meetproblemen',
    titel: 'Meetproblemen',
    omschrijving: 'Klanten waarvan de meting onvolledig is.',
    grootte: Grootte.KLEIN,
    standaard: true,
  },
  {
    id: 'recente-klanten',
    titel: 'Recent bekeken klanten',
    omschrijving: 'De klanten die je als laatste hebt geopend.',
    grootte: Grootte.KLEIN,
    standaard: false,
  },
  {
    id: 'recente-wijzigingen',
    titel: 'Recente wijzigingen',
    omschrijving: 'De grootste bewegingen in het primaire resultaat.',
    grootte: Grootte.MIDDEL,
    standaard: false,
  },
];

export const WIDGET_OP_ID = new Map(WIDGET_CATALOGUS.map((w) => [w.id, w]));

function sleutelVoor(userId) {
  return `widgets.${userId ?? 'anoniem'}`;
}

/** De indeling waarmee een gebruiker begint. */
export function standaardIndeling() {
  return {
    volgorde: WIDGET_CATALOGUS.map((w) => w.id),
    verborgen: WIDGET_CATALOGUS.filter((w) => !w.standaard).map((w) => w.id),
    groottes: Object.fromEntries(WIDGET_CATALOGUS.map((w) => [w.id, w.grootte])),
  };
}

/**
 * De indeling van een gebruiker, aangevuld tot een geldige indeling.
 * Nieuwe widgets uit de catalogus komen achteraan te staan en beginnen
 * verborgen wanneer ze niet standaard aan staan.
 */
export function leesIndeling(userId) {
  const standaard = standaardIndeling();
  const bewaard = lees(sleutelVoor(userId), VERSIE, null);
  if (!bewaard || typeof bewaard !== 'object') return standaard;

  const bekend = new Set(WIDGET_CATALOGUS.map((w) => w.id));
  const volgorde = (Array.isArray(bewaard.volgorde) ? bewaard.volgorde : []).filter((id) => bekend.has(id));
  for (const w of WIDGET_CATALOGUS) {
    if (!volgorde.includes(w.id)) volgorde.push(w.id);
  }

  const bewaardeVerborgen = new Set(
    (Array.isArray(bewaard.verborgen) ? bewaard.verborgen : []).filter((id) => bekend.has(id))
  );
  // Een widget die na het bewaren aan de catalogus is toegevoegd, volgt zijn
  // eigen standaard in plaats van zomaar zichtbaar te worden.
  for (const w of WIDGET_CATALOGUS) {
    const stondErAl = (bewaard.volgorde ?? []).includes(w.id);
    if (!stondErAl && !w.standaard) bewaardeVerborgen.add(w.id);
  }

  const groottes = { ...standaard.groottes };
  if (bewaard.groottes && typeof bewaard.groottes === 'object') {
    for (const [id, grootte] of Object.entries(bewaard.groottes)) {
      if (bekend.has(id) && GROOTTES.some((g) => g.key === grootte)) groottes[id] = grootte;
    }
  }

  return { volgorde, verborgen: [...bewaardeVerborgen], groottes };
}

export function schrijfIndeling(userId, indeling) {
  return schrijf(sleutelVoor(userId), VERSIE, indeling);
}

export function herstelIndeling(userId) {
  wis(sleutelVoor(userId));
  return standaardIndeling();
}

/* ---------------------------------------------------------------
   Handelingen
   --------------------------------------------------------------- */

/** Verplaatst een widget naar de plek van een andere widget. */
export function verplaatsWidget(userId, widgetId, doelId) {
  const indeling = leesIndeling(userId);
  const van = indeling.volgorde.indexOf(widgetId);
  const naar = indeling.volgorde.indexOf(doelId);
  if (van === -1 || naar === -1 || van === naar) return indeling;

  const volgorde = [...indeling.volgorde];
  volgorde.splice(van, 1);
  volgorde.splice(naar, 0, widgetId);

  const nieuw = { ...indeling, volgorde };
  schrijfIndeling(userId, nieuw);
  return nieuw;
}

/** Schuift een widget één plek op. Het toetsenbordalternatief voor slepen. */
export function schuifWidget(userId, widgetId, richting) {
  const indeling = leesIndeling(userId);
  const zichtbaar = indeling.volgorde.filter((id) => !indeling.verborgen.includes(id));
  const index = zichtbaar.indexOf(widgetId);
  const doelIndex = index + (richting === 'omhoog' ? -1 : 1);
  if (index === -1 || doelIndex < 0 || doelIndex >= zichtbaar.length) return indeling;
  return verplaatsWidget(userId, widgetId, zichtbaar[doelIndex]);
}

export function zetZichtbaarheid(userId, widgetId, zichtbaar) {
  const indeling = leesIndeling(userId);
  const verborgen = new Set(indeling.verborgen);
  if (zichtbaar) verborgen.delete(widgetId);
  else verborgen.add(widgetId);

  const nieuw = { ...indeling, verborgen: [...verborgen] };
  schrijfIndeling(userId, nieuw);
  return nieuw;
}

export function zetGrootte(userId, widgetId, grootte) {
  if (!GROOTTES.some((g) => g.key === grootte)) return leesIndeling(userId);
  const indeling = leesIndeling(userId);
  const nieuw = { ...indeling, groottes: { ...indeling.groottes, [widgetId]: grootte } };
  schrijfIndeling(userId, nieuw);
  return nieuw;
}

/** Eén stap groter of kleiner, voor de knoppen op de widgetkop. */
export function schaalWidget(userId, widgetId, richting) {
  const indeling = leesIndeling(userId);
  const huidig = indeling.groottes[widgetId] ?? Grootte.MIDDEL;
  const index = GROOTTES.findIndex((g) => g.key === huidig);
  const doel = GROOTTES[index + (richting === 'groter' ? 1 : -1)];
  if (!doel) return indeling;
  return zetGrootte(userId, widgetId, doel.key);
}

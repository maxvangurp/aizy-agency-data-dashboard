/**
 * Contextuele vervolgacties van de assistent.
 *
 * De assistent bouwt geen tweede kopie van functionaliteit. Iedere vervolgactie
 * verwijst naar een bestaande route, drawer of filter en wordt door de gebruiker
 * zelf bevestigd. Muterende stappen (een actie aanmaken) openen alleen het
 * bestaande formulier; de assistent wijzigt nooit zelf data.
 *
 * Elke actie is een functie van de context en geeft `null` terug wanneer hij
 * niet van toepassing is of de gebruiker er geen recht toe heeft. Zo ontstaat er
 * nooit een knop die nergens heen gaat of die een recht omzeilt.
 */

const N = (label, hash) => ({ label, type: 'nav', hash });

const DEFINITIES = {
  'open-signalen': (c) => (c.permissions.zietSignalen ? N('Open signalen', '#/agency/signals') : null),
  'toon-nieuw': (c) => (c.permissions.zietSignalen ? N('Toon nieuwe signalen', '#/agency/signals?tab=nieuw') : null),
  'open-acties': (c) => (c.permissions.isAgency ? N('Open acties', '#/agency/actions') : null),
  'open-planning': (c) => (c.permissions.zietPlanning ? N('Open planning', '#/agency/planning') : null),
  'open-budgetten': (c) => (c.permissions.isAgency ? N('Open budgetten', '#/agency/budgets') : null),
  'open-campagnes': (c) => (c.permissions.isAgency ? N('Open campagnes', '#/agency/campaigns') : null),
  'open-conversies': (c) => (c.permissions.isAgency ? N('Open conversies', '#/agency/conversions') : null),
  'open-kanalen': (c) => (c.permissions.isAgency ? N('Open kanalen', '#/agency/channels') : null),
  'open-datakwaliteit': (c) => (c.permissions.isAgency ? N('Open datakwaliteit', '#/agency/dataquality') : null),
  'open-inzichten': (c) => (c.permissions.isAgency ? N('Open inzichten', '#/agency/insights') : null),
  'open-integraties': (c) => (c.permissions.isAgency ? N('Open integraties', '#/agency/integrations') : null),
  'open-assistent-instellingen': (c) => (c.permissions.isAgency
    ? N('Assistent-instellingen', '#/agency/settings?sectie=assistent')
    : N('Assistent-instellingen', '#/client/report')),

  // Klantdetail (agency)
  'open-klant-signalen': (c) => (c.permissions.zietSignalen && c.clientId
    ? N('Signalen van deze klant', `#/agency/signals?klant=${c.clientId}`) : null),
  'open-klantomgeving': (c) => (c.permissions.isAgency && c.clientId
    ? { label: 'Open klantomgeving', type: 'klantomgeving', clientId: c.clientId } : null),
  'maak-actie': (c) => (c.permissions.beheertActies ? N('Naar het actiecentrum', '#/agency/actions') : null),

  // Klantomgeving
  'open-analyse': (c) => (c.environment === 'client' ? N('Open analyse', '#/client/analysis') : null),
  'open-samenwerking': (c) => (c.environment === 'client' ? N('Open samenwerking', '#/client/collaboration') : null),
  'open-rapportage': (c) => (c.environment === 'client' ? N('Open rapportage', '#/client/report') : null),
};

/**
 * Zet een lijst actiesleutels om in concrete, toegestane vervolgacties.
 * Onbekende of niet-toepasbare sleutels vallen weg.
 */
export function resolveActies(sleutels, context) {
  if (!Array.isArray(sleutels)) return [];
  const uit = [];
  const gezien = new Set();
  for (const sleutel of sleutels) {
    const maker = DEFINITIES[sleutel];
    if (!maker) continue;
    const actie = maker(context);
    if (actie && !gezien.has(actie.label)) {
      gezien.add(actie.label);
      uit.push({ ...actie, sleutel });
    }
  }
  return uit;
}

export const ACTIE_SLEUTELS = Object.keys(DEFINITIES);

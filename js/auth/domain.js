/**
 * Domeinmodel voor organisaties, gebruikers en rollen.
 *
 * Dit bestand beschrijft wie er bestaat en wat hun relatie is. Het bevat
 * geen logica over wat iemand mag; die staat in permissions.js.
 *
 * BELANGRIJK
 * De gebruikers en wachtwoorden hieronder zijn fictief en uitsluitend voor
 * de demo. Ze horen niet thuis in een productieomgeving. In productie komen
 * gebruikers uit een identiteitsprovider en worden wachtwoorden nooit door
 * de frontend gezien. Zie js/auth/auth-provider.js voor die grens.
 */

/* ---------------------------------------------------------------
   Organisaties
   --------------------------------------------------------------- */

export const OrganisatieType = {
  AGENCY: 'agency',
  CLIENT: 'client',
};

/**
 * Alle organisaties. Het bureau zelf is er één van; iedere klant is er ook één.
 * Een klantorganisatie-id komt overeen met de klant-id in sample-data, zodat
 * de repository de koppeling zonder vertaaltabel kan leggen.
 */
export const ORGANISATIES = [
  { id: 'aizy', type: OrganisatieType.AGENCY, name: 'Aizy' },

  { id: 'vitaalpunt', type: OrganisatieType.CLIENT, name: 'Vitaalpunt Fysiotherapie' },
  { id: 'meridiaan', type: OrganisatieType.CLIENT, name: 'Meridiaan Bedrijfsadvies' },
  { id: 'havenkwartier', type: OrganisatieType.CLIENT, name: 'Havenkwartier Makelaars' },
  { id: 'tafelwerk', type: OrganisatieType.CLIENT, name: 'Tafelwerk Studio' },
  { id: 'draadloos', type: OrganisatieType.CLIENT, name: 'Draadloos Mode' },
  { id: 'kaapnoord', type: OrganisatieType.CLIENT, name: 'Kaap Noord Outdoor' },
  { id: 'noordlicht', type: OrganisatieType.CLIENT, name: 'Noordlicht Software' },
];

export function getOrganisatie(id) {
  return ORGANISATIES.find((o) => o.id === id) ?? null;
}

export function isAgencyOrganisatie(id) {
  return getOrganisatie(id)?.type === OrganisatieType.AGENCY;
}

/* ---------------------------------------------------------------
   Rollen
   --------------------------------------------------------------- */

export const Rol = {
  AGENCY_ADMIN: 'agency_admin',
  AGENCY_EMPLOYEE: 'agency_employee',
  CLIENT_ADMIN: 'client_admin',
  CLIENT_VIEWER: 'client_viewer',
};

export const ROL_LABELS = {
  [Rol.AGENCY_ADMIN]: 'Beheerder',
  [Rol.AGENCY_EMPLOYEE]: 'Medewerker',
  [Rol.CLIENT_ADMIN]: 'Klantbeheerder',
  [Rol.CLIENT_VIEWER]: 'Meekijker',
};

/** Rollen die bij het bureau horen. Bepaalt of iemand agencyroutes mag zien. */
export const AGENCY_ROLLEN = new Set([Rol.AGENCY_ADMIN, Rol.AGENCY_EMPLOYEE]);
export const CLIENT_ROLLEN = new Set([Rol.CLIENT_ADMIN, Rol.CLIENT_VIEWER]);

export const AccountStatus = {
  ACTIEF: 'actief',
  UITGENODIGD: 'uitgenodigd',
  GEDEACTIVEERD: 'gedeactiveerd',
};

export const ACCOUNT_STATUS_LABELS = {
  [AccountStatus.ACTIEF]: 'Actief',
  [AccountStatus.UITGENODIGD]: 'Uitgenodigd',
  [AccountStatus.GEDEACTIVEERD]: 'Gedeactiveerd',
};

/* ---------------------------------------------------------------
   Gebruikers
   --------------------------------------------------------------- */

/**
 * Bouwt een gebruiker met een consistente vorm.
 *
 * memberships       lidmaatschappen van organisaties, met de rol per organisatie
 * clientAssignments klant-ids die een agencymedewerker mag zien. Leeg voor een
 *                   beheerder, want die ziet alles; leeg voor klantgebruikers,
 *                   want die zien uitsluitend hun eigen organisatie.
 */
function maakGebruiker({
  id, firstName, lastName, email, memberships,
  clientAssignments = [], status = AccountStatus.ACTIEF,
  laatsteLogin = null, preferences = {},
}) {
  const displayName = `${firstName} ${lastName}`.trim();
  return {
    id,
    firstName,
    lastName,
    displayName,
    email,
    avatarInitials: (firstName[0] ?? '') + (lastName[0] ?? ''),
    status,
    memberships,
    clientAssignments,
    laatsteLogin,
    preferences: { theme: null, ...preferences },
  };
}

/**
 * Demo-gebruikers.
 *
 * Het wachtwoord staat hier bewust naast de gebruiker en is voor iedereen
 * hetzelfde. Dit is een demo-inlog, geen wachtwoordbeheer. Er wordt niets
 * gehasht en niets versleuteld, omdat dat in een statische frontend geen
 * beveiliging zou toevoegen maar wel zou suggereren dat het veilig is.
 */
export const DEMO_WACHTWOORD = 'demo123';

export const DEMO_GEBRUIKERS = [
  maakGebruiker({
    id: 'u-max',
    firstName: 'Max',
    lastName: 'van Gurp',
    email: 'max@aizy.demo',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_ADMIN }],
    laatsteLogin: '2026-07-21T08:40:00Z',
  }),
  maakGebruiker({
    id: 'u-sanne',
    firstName: 'Sanne',
    lastName: 'de Boer',
    email: 'sanne@aizy.demo',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: ['vitaalpunt', 'havenkwartier'],
    laatsteLogin: '2026-07-21T07:55:00Z',
  }),
  maakGebruiker({
    id: 'u-daan',
    firstName: 'Daan',
    lastName: 'Verhoeven',
    email: 'daan@aizy.demo',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: ['meridiaan', 'tafelwerk', 'draadloos'],
    laatsteLogin: '2026-07-20T16:20:00Z',
  }),
  maakGebruiker({
    id: 'u-noor',
    firstName: 'Noor',
    lastName: 'El Amrani',
    email: 'noor@aizy.demo',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: [],
    laatsteLogin: null,
    status: AccountStatus.UITGENODIGD,
  }),
  maakGebruiker({
    id: 'u-vitaalpunt-directie',
    firstName: 'Ilse',
    lastName: 'Grootveld',
    email: 'directie@vitaalpunt.demo',
    memberships: [{ organisatieId: 'vitaalpunt', rol: Rol.CLIENT_ADMIN }],
    laatsteLogin: '2026-07-19T11:05:00Z',
  }),
  maakGebruiker({
    id: 'u-vitaalpunt-praktijk',
    firstName: 'Joris',
    lastName: 'Beckers',
    email: 'praktijk@vitaalpunt.demo',
    memberships: [{ organisatieId: 'vitaalpunt', rol: Rol.CLIENT_VIEWER }],
    laatsteLogin: '2026-07-18T09:30:00Z',
  }),
  maakGebruiker({
    id: 'u-meridiaan-marketing',
    firstName: 'Ruben',
    lastName: 'Aalders',
    email: 'marketing@meridiaan.demo',
    memberships: [{ organisatieId: 'meridiaan', rol: Rol.CLIENT_VIEWER }],
    laatsteLogin: '2026-07-20T13:15:00Z',
  }),
];

/* ---------------------------------------------------------------
   Afgeleide gegevens
   --------------------------------------------------------------- */

/** De primaire rol van een gebruiker binnen zijn eerste lidmaatschap. */
export function primaireRol(user) {
  return user?.memberships?.[0]?.rol ?? null;
}

/** De organisatie waar de gebruiker toe behoort. */
export function primaireOrganisatieId(user) {
  return user?.memberships?.[0]?.organisatieId ?? null;
}

export function isAgencyGebruiker(user) {
  const rol = primaireRol(user);
  return rol != null && AGENCY_ROLLEN.has(rol);
}

export function isClientGebruiker(user) {
  const rol = primaireRol(user);
  return rol != null && CLIENT_ROLLEN.has(rol);
}

/** Zoekt een gebruiker op e-mailadres, hoofdletterongevoelig. */
export function vindGebruikerOpEmail(email) {
  const genormaliseerd = String(email ?? '').trim().toLowerCase();
  return DEMO_GEBRUIKERS.find((u) => u.email.toLowerCase() === genormaliseerd) ?? null;
}

export function vindGebruikerOpId(id) {
  return DEMO_GEBRUIKERS.find((u) => u.id === id) ?? null;
}

/** Accounts die op het inlogscherm worden getoond om rollen te kunnen testen. */
export const DEMO_ACCOUNT_SUGGESTIES = [
  { email: 'max@aizy.demo', omschrijving: 'Beheerder, alle klanten' },
  { email: 'sanne@aizy.demo', omschrijving: 'Medewerker, 2 klanten' },
  { email: 'daan@aizy.demo', omschrijving: 'Medewerker, 3 klanten' },
  { email: 'directie@vitaalpunt.demo', omschrijving: 'Klantbeheerder, Vitaalpunt' },
  { email: 'marketing@meridiaan.demo', omschrijving: 'Meekijker, Meridiaan' },
];

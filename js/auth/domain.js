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

/**
 * De zichtbare naam van een rol staat in js/terminology.js.
 * Dit domeinmodel kent alleen de interne waarden; wat een gebruiker leest,
 * hoort niet in het model te staan.
 */
export { toegangsniveauTerm } from '../terminology.js';

/** Rollen die bij het bureau horen. Bepaalt of iemand agencyroutes mag zien. */
export const AGENCY_ROLLEN = new Set([Rol.AGENCY_ADMIN, Rol.AGENCY_EMPLOYEE]);
export const CLIENT_ROLLEN = new Set([Rol.CLIENT_ADMIN, Rol.CLIENT_VIEWER]);

export const AccountStatus = {
  ACTIEF: 'actief',
  UITGENODIGD: 'uitgenodigd',
  GEDEACTIVEERD: 'gedeactiveerd',
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
 * jobTitle          de functie binnen de eigen organisatie. Dit is nadrukkelijk
 *                   iets anders dan de rol in deze applicatie: wat iemand doet
 *                   staat los van wat het account mag. De interface toont ze
 *                   daarom altijd als twee afzonderlijke gegevens.
 * avatarInitials    alleen een visuele afkorting. Twee medewerkers kunnen
 *                   dezelfde initialen hebben, dus de interface leunt er nooit
 *                   alleen op om iemand te herkennen.
 */
function maakGebruiker({
  id, firstName, lastName, email, memberships, jobTitle = null,
  clientAssignments = [], status = AccountStatus.ACTIEF,
  laatsteLogin = null, preferences = {}, initials = null,
}) {
  const displayName = `${firstName} ${lastName}`.trim();
  return {
    id,
    firstName,
    lastName,
    displayName,
    email,
    jobTitle,
    avatarInitials: initials ?? (firstName[0] ?? '') + (lastName[0] ?? ''),
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

/**
 * DEMO-OMGEVING MET ECHTE NAMEN
 *
 * De namen van het Aizy Performance Team zijn gebruikt om de demo herkenbaar te
 * maken. Alle overige gegevens zijn verzonnen: e-mailadressen, wachtwoorden,
 * applicatierollen, klanttoewijzingen, inlogmomenten en accountstatussen
 * vertegenwoordigen niet de werkelijke organisatie, rechten of
 * verantwoordelijkheden binnen Aizy.
 *
 * De verdeling van applicatierollen dient uitsluitend om de rechten in deze
 * applicatie te kunnen demonstreren. Er wordt geen uitspraak gedaan over
 * senioriteit, specialisatie, werkdruk of prestaties, en er bestaat nergens in
 * dit product een ranglijst van medewerkers.
 */
export const DEMO_GEBRUIKERS = [
  maakGebruiker({
    id: 'u-enrico',
    firstName: 'Enrico',
    lastName: 'van de Lindeloof',
    email: 'enrico@aizy.demo',
    jobTitle: 'Performance Lead',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_ADMIN }],
    laatsteLogin: '2026-07-22T08:40:00Z',
    initials: 'EL',
  }),
  maakGebruiker({
    id: 'u-jim',
    firstName: 'Jim',
    lastName: 'Egging',
    email: 'jim@aizy.demo',
    jobTitle: 'Operational Manager',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_ADMIN }],
    laatsteLogin: '2026-07-21T17:10:00Z',
    initials: 'JE',
  }),
  maakGebruiker({
    id: 'u-berry',
    firstName: 'Berry',
    lastName: 'Vermeulen',
    email: 'berry@aizy.demo',
    jobTitle: 'Performance Marketeer',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: ['vitaalpunt', 'havenkwartier'],
    laatsteLogin: '2026-07-22T07:55:00Z',
    initials: 'BV',
  }),
  maakGebruiker({
    id: 'u-erik',
    firstName: 'Erik',
    lastName: 'Nieuwenhuijs',
    email: 'erik@aizy.demo',
    jobTitle: 'Performance Marketeer',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: ['tafelwerk', 'draadloos', 'kaapnoord'],
    laatsteLogin: '2026-07-21T16:20:00Z',
    initials: 'EN',
  }),
  maakGebruiker({
    id: 'u-benito',
    firstName: 'Benito',
    lastName: 'Perez',
    email: 'benito@aizy.demo',
    jobTitle: 'Performance Marketeer',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: ['vitaalpunt', 'tafelwerk', 'noordlicht'],
    laatsteLogin: '2026-07-22T09:05:00Z',
    initials: 'BP',
  }),
  maakGebruiker({
    id: 'u-jens',
    firstName: 'Jens',
    lastName: 'Kwekkeboom',
    email: 'jens@aizy.demo',
    jobTitle: 'Performance Marketeer',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: ['draadloos'],
    laatsteLogin: '2026-07-20T11:30:00Z',
    initials: 'JK',
  }),
  maakGebruiker({
    id: 'u-jip',
    firstName: 'Jip',
    lastName: 'van Leest',
    email: 'jip@aizy.demo',
    jobTitle: 'Performance Marketeer',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: ['meridiaan', 'kaapnoord'],
    laatsteLogin: '2026-07-21T14:45:00Z',
    initials: 'JL',
  }),
  maakGebruiker({
    id: 'u-tim',
    firstName: 'Tim',
    lastName: 'Suijkerbuijk',
    email: 'tim@aizy.demo',
    jobTitle: 'Performance Marketeer',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: [],
    laatsteLogin: '2026-07-19T10:15:00Z',
    // Tim en Thyra hebben allebei de initialen TS. De interface toont daarom
    // nooit alleen initialen om een medewerker te herkennen.
    initials: 'TS',
  }),
  maakGebruiker({
    id: 'u-thyra',
    firstName: 'Thyra',
    lastName: 'van der Schoor',
    email: 'thyra@aizy.demo',
    jobTitle: 'Performance Marketeer',
    memberships: [{ organisatieId: 'aizy', rol: Rol.AGENCY_EMPLOYEE }],
    clientAssignments: [],
    laatsteLogin: null,
    status: AccountStatus.UITGENODIGD,
    initials: 'TS',
  }),
  maakGebruiker({
    id: 'u-vitaalpunt-directie',
    firstName: 'Ilse',
    lastName: 'Grootveld',
    email: 'directie@vitaalpunt.demo',
    jobTitle: 'Praktijkdirectie',
    memberships: [{ organisatieId: 'vitaalpunt', rol: Rol.CLIENT_ADMIN }],
    laatsteLogin: '2026-07-19T11:05:00Z',
  }),
  maakGebruiker({
    id: 'u-vitaalpunt-praktijk',
    firstName: 'Joris',
    lastName: 'Beckers',
    email: 'praktijk@vitaalpunt.demo',
    jobTitle: 'Praktijkmanager',
    memberships: [{ organisatieId: 'vitaalpunt', rol: Rol.CLIENT_VIEWER }],
    laatsteLogin: '2026-07-18T09:30:00Z',
  }),
  maakGebruiker({
    id: 'u-meridiaan-marketing',
    firstName: 'Ruben',
    lastName: 'Aalders',
    email: 'marketing@meridiaan.demo',
    jobTitle: 'Marketingverantwoordelijke',
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

/**
 * Accounts die op het inlogscherm worden getoond om de toegangsniveaus te
 * kunnen bekijken. Naam, toegangsniveau en omvang staan als drie afzonderlijke
 * gegevens naast elkaar en niet als één samengevoegd label.
 */
export const DEMO_ACCOUNT_SUGGESTIES = [
  { email: 'enrico@aizy.demo', naam: 'Enrico van de Lindeloof', rol: Rol.AGENCY_ADMIN, omvang: 'Alle 7 klanten' },
  { email: 'berry@aizy.demo', naam: 'Berry Vermeulen', rol: Rol.AGENCY_EMPLOYEE, omvang: '2 leadgeneratieklanten' },
  { email: 'erik@aizy.demo', naam: 'Erik Nieuwenhuijs', rol: Rol.AGENCY_EMPLOYEE, omvang: '3 e-commerceklanten' },
  { email: 'tim@aizy.demo', naam: 'Tim Suijkerbuijk', rol: Rol.AGENCY_EMPLOYEE, omvang: 'Nog geen klanten toegewezen' },
  { email: 'directie@vitaalpunt.demo', naam: 'Ilse Grootveld', rol: Rol.CLIENT_ADMIN, omvang: 'Vitaalpunt Fysiotherapie' },
  { email: 'marketing@meridiaan.demo', naam: 'Ruben Aalders', rol: Rol.CLIENT_VIEWER, omvang: 'Meridiaan Bedrijfsadvies' },
];

/** De medewerkers van het bureau, in vaste volgorde op achternaam. */
export function agencyMedewerkers() {
  return DEMO_GEBRUIKERS.filter(isAgencyGebruiker)
    .slice()
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'nl'));
}

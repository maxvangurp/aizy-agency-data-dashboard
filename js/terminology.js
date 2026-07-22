/**
 * Terminologieregister.
 *
 * Eén bron voor alles wat een gebruiker leest en wat een begrip benoemt. Views
 * schrijven nergens zelf een rolnaam, statuslabel of afkorting uit.
 *
 * WAAROM CENTRAAL
 * Zolang benamingen in de views staan, ontstaan er varianten. Dezelfde rol
 * heette in dit product eerder "Meekijker" in het accountmenu, "client_viewer"
 * in de code en "Meekijker · Meridiaan" in de gebruikerslijst. Die laatste
 * voegde bovendien een rol en een organisatie samen tot een label dat geen van
 * beide meer duidelijk maakte. Met één register kan dat niet meer.
 *
 * VORM VAN EEN TERM
 *   key          stabiele sleutel, wordt nooit getoond
 *   kort         label voor krappe ruimte, zoals een badge of tabelcel
 *   volledig     label voor detailweergaven en toegankelijke namen
 *   omschrijving één zin die uitlegt wat het begrip betekent en wat het mag
 *   publiek      voor wie het begrip bedoeld is: bureau, klant of beide
 *
 * NAAMGEVINGSREGELS
 *   1. Een label is zonder aanvullende uitleg te begrijpen.
 *   2. Twee begrippen worden nooit tot één label samengevoegd. Een organisatie
 *      en een toegangsniveau zijn twee dingen en krijgen twee regels.
 *   3. Een functietitel is geen toegangsniveau. Wat iemand bij Aizy doet staat
 *      los van wat het account in deze applicatie mag.
 *   4. Interne waarden zoals `agency_admin` komen nooit op het scherm.
 *   5. Een afkorting staat nooit alleen. CPQL krijgt altijd "Kosten per
 *      gekwalificeerde lead" mee, in het label of in de uitleg.
 */

export const Publiek = {
  BUREAU: 'agency',
  KLANT: 'client',
};

const BEIDE = [Publiek.BUREAU, Publiek.KLANT];

/** Zoekt een term op in een register en valt terug op de sleutel zelf. */
function zoek(register, key) {
  return register[key] ?? { key, kort: String(key ?? ''), volledig: String(key ?? ''), omschrijving: '', publiek: BEIDE };
}

/* ---------------------------------------------------------------
   Omgevingen
   --------------------------------------------------------------- */

export const OMGEVINGEN = {
  agency: {
    key: 'agency',
    kort: 'Agency',
    volledig: 'Agencyomgeving',
    omschrijving: 'De interne werkomgeving van Aizy, met alle klanten waartoe je toegang hebt.',
    publiek: [Publiek.BUREAU],
  },
  client: {
    key: 'client',
    kort: 'Klantweergave',
    volledig: 'Klantomgeving',
    omschrijving: 'De weergave die een klant van de eigen resultaten ziet.',
    publiek: BEIDE,
  },
};

export const omgevingTerm = (key) => zoek(OMGEVINGEN, key);

/* ---------------------------------------------------------------
   Toegangsniveaus
   --------------------------------------------------------------- */

/**
 * Zichtbare namen voor de applicatierollen.
 *
 * Iedere naam maakt duidelijk bij welke omgeving de rol hoort en wat het
 * account mag. "Meekijker" verdween omdat het geen van beide deed.
 */
export const TOEGANGSNIVEAUS = {
  agency_admin: {
    key: 'agency_admin',
    kort: 'Agencybeheerder',
    volledig: 'Agencybeheerder',
    omschrijving: 'Ziet alle klanten van Aizy en beheert het team, de klanttoewijzingen en de instellingen.',
    publiek: [Publiek.BUREAU],
  },
  agency_employee: {
    key: 'agency_employee',
    kort: 'Aizy-medewerker',
    volledig: 'Aizy-medewerker',
    omschrijving: 'Ziet uitsluitend de klanten die aan dit account zijn toegewezen en beheert het team niet.',
    publiek: [Publiek.BUREAU],
  },
  client_admin: {
    key: 'client_admin',
    kort: 'Klantbeheerder',
    volledig: 'Klantbeheerder',
    omschrijving: 'Ziet de dashboards van de eigen organisatie en beheert de gebruikers daarvan.',
    publiek: BEIDE,
  },
  client_viewer: {
    key: 'client_viewer',
    kort: 'Alleen bekijken',
    volledig: 'Alleen-lezen klantgebruiker',
    omschrijving: 'Bekijkt dashboards en rapportages van de eigen organisatie en wijzigt geen instellingen.',
    publiek: BEIDE,
  },
};

export const toegangsniveauTerm = (rol) => zoek(TOEGANGSNIVEAUS, rol);

/* ---------------------------------------------------------------
   Accountstatussen
   --------------------------------------------------------------- */

export const ACCOUNTSTATUSSEN = {
  actief: {
    key: 'actief',
    kort: 'Actief',
    volledig: 'Actief account',
    omschrijving: 'Dit account kan inloggen.',
    publiek: BEIDE,
    variant: 'ok',
  },
  uitgenodigd: {
    key: 'uitgenodigd',
    kort: 'Uitgenodigd',
    volledig: 'Uitnodiging nog niet geaccepteerd',
    omschrijving: 'De uitnodiging is verstuurd maar nog niet geaccepteerd, dus dit account kan nog niet inloggen.',
    publiek: BEIDE,
    variant: 'middel',
  },
  gedeactiveerd: {
    key: 'gedeactiveerd',
    kort: 'Gedeactiveerd',
    volledig: 'Gedeactiveerd account',
    omschrijving: 'Dit account is uitgezet en kan niet meer inloggen.',
    publiek: BEIDE,
    variant: 'hoog',
  },
};

export const accountstatusTerm = (status) => zoek(ACCOUNTSTATUSSEN, status);

/* ---------------------------------------------------------------
   Klantverantwoordelijkheid
   --------------------------------------------------------------- */

/**
 * Vier begrippen die in dashboards vaak op één hoop gaan.
 * Verantwoordelijk zijn voor een klant is iets anders dan toegewezen zijn aan
 * een actie, en beide zijn iets anders dan ondersteunend betrokken zijn.
 */
export const VERANTWOORDELIJKHEID = {
  primair: {
    key: 'primair',
    kort: 'Verantwoordelijk',
    volledig: 'Verantwoordelijke medewerker',
    omschrijving: 'Aanspreekpunt voor deze klant en eigenaar van het resultaat.',
    publiek: BEIDE,
  },
  ondersteunend: {
    key: 'ondersteunend',
    kort: 'Ondersteunend',
    volledig: 'Ondersteunende medewerker',
    omschrijving: 'Werkt mee aan deze klant maar is niet het aanspreekpunt.',
    publiek: BEIDE,
  },
  actie: {
    key: 'actie',
    kort: 'Toegewezen',
    volledig: 'Toegewezen aan deze actie',
    omschrijving: 'Verantwoordelijk voor het uitvoeren van deze ene actie.',
    publiek: [Publiek.BUREAU],
  },
  gewijzigd: {
    key: 'gewijzigd',
    kort: 'Laatst gewijzigd door',
    volledig: 'Laatst gewijzigd door',
    omschrijving: 'De medewerker die deze gegevens het laatst heeft aangepast.',
    publiek: [Publiek.BUREAU],
  },
};

export const verantwoordelijkheidTerm = (key) => zoek(VERANTWOORDELIJKHEID, key);

/* ---------------------------------------------------------------
   Dashboardtypes
   --------------------------------------------------------------- */

export const DASHBOARDTYPES = {
  leadgen: {
    key: 'leadgen',
    kort: 'Leadgeneratie',
    volledig: 'Leadgeneratiedashboard',
    omschrijving: 'Beoordeelt aanvragen op volume, kosten en kwaliteit, van vertoning tot klant.',
    publiek: BEIDE,
  },
  ecommerce: {
    key: 'ecommerce',
    kort: 'E-commerce',
    volledig: 'E-commercedashboard',
    omschrijving: 'Beoordeelt omzet en rendement, van sessie tot aankoop.',
    publiek: BEIDE,
  },
  awareness: {
    key: 'awareness',
    kort: 'Awareness',
    volledig: 'Awarenessdashboard',
    omschrijving: 'Beoordeelt bereik, herhaling en aandacht. Wordt niet op kosten per lead beoordeeld.',
    publiek: BEIDE,
  },
  hybrid: {
    key: 'hybrid', kort: 'Hybride', volledig: 'Hybride dashboard',
    omschrijving: 'Combineert meerdere doelstellingen.', publiek: BEIDE,
  },
  custom: {
    key: 'custom', kort: 'Custom', volledig: 'Custom dashboard',
    omschrijving: 'Een op maat ingerichte weergave.', publiek: BEIDE,
  },
};

export const dashboardtypeTerm = (key) => zoek(DASHBOARDTYPES, key);

/* ---------------------------------------------------------------
   Datakwaliteit
   --------------------------------------------------------------- */

/**
 * De vijf situaties die achter een leeg vakje schuilgaan.
 * Een streepje voor alle vijf laat de lezer raden welke het is.
 */
export const ONTBREKENDE_WAARDEN = {
  nul: {
    key: 'nul', kort: '0', volledig: 'Gemeten nul',
    omschrijving: 'Er is gemeten en het resultaat was nul.', publiek: BEIDE,
  },
  niet_gemeten: {
    key: 'niet_gemeten', kort: 'Niet gemeten', volledig: 'Niet gemeten',
    omschrijving: 'Deze waarde wordt voor deze klant niet vastgelegd.', publiek: BEIDE,
  },
  niet_gekoppeld: {
    key: 'niet_gekoppeld', kort: 'Niet gekoppeld', volledig: 'Bron niet gekoppeld',
    omschrijving: 'De bron die deze waarde levert is nog niet aangesloten.', publiek: BEIDE,
  },
  onvoldoende_data: {
    key: 'onvoldoende_data', kort: 'Onvoldoende data', volledig: 'Onvoldoende data',
    omschrijving: 'Er is te weinig gemeten om deze waarde te tonen.', publiek: BEIDE,
  },
  niet_van_toepassing: {
    key: 'niet_van_toepassing', kort: 'Niet van toepassing', volledig: 'Niet van toepassing',
    omschrijving: 'Deze waarde bestaat niet voor dit type klant of kanaal.', publiek: BEIDE,
  },
  gedeeltelijk: {
    key: 'gedeeltelijk', kort: 'Gedeeltelijk gemeten', volledig: 'Gedeeltelijk gemeten',
    omschrijving: 'Voor een deel van de periode ontbreekt data.', publiek: BEIDE,
  },
};

export const ontbrekendTerm = (key) => zoek(ONTBREKENDE_WAARDEN, key);

/* ---------------------------------------------------------------
   Betrouwbaarheid van inzichten
   --------------------------------------------------------------- */

export const Betrouwbaarheid = {
  HOOG: 'hoog',
  REDELIJK: 'redelijk',
  BEPERKT: 'beperkt',
  ONVOLDOENDE: 'onvoldoende',
};

export const BETROUWBAARHEID = {
  hoog: {
    key: 'hoog', kort: 'Hoge betrouwbaarheid', volledig: 'Hoge betrouwbaarheid',
    omschrijving: 'Voldoende volume, een volledige periode en een bruikbare vergelijking.',
    publiek: BEIDE, variant: 'ok',
  },
  redelijk: {
    key: 'redelijk', kort: 'Redelijke betrouwbaarheid', volledig: 'Redelijke betrouwbaarheid',
    omschrijving: 'De richting is duidelijk, maar het volume of de periode beperkt de zekerheid.',
    publiek: BEIDE, variant: 'muted',
  },
  beperkt: {
    key: 'beperkt', kort: 'Beperkte betrouwbaarheid', volledig: 'Beperkte betrouwbaarheid',
    omschrijving: 'Weinig volume of ontbrekende data. Een kleine verandering geeft hier een groot percentage.',
    publiek: BEIDE, variant: 'middel',
  },
  onvoldoende: {
    key: 'onvoldoende', kort: 'Onvoldoende data', volledig: 'Onvoldoende data voor een conclusie',
    omschrijving: 'Er is te weinig gemeten om hier iets over te zeggen.',
    publiek: BEIDE, variant: 'muted',
  },
};

export const betrouwbaarheidTerm = (key) => zoek(BETROUWBAARHEID, key);

/* ---------------------------------------------------------------
   Klantstatus, doelen en budget
   --------------------------------------------------------------- */

export const KLANTSTATUSSEN = {
  'op-koers': {
    key: 'op-koers', kort: 'Op koers', volledig: 'Op koers',
    omschrijving: 'Alle meetbare doelen liggen op of boven het doel.', publiek: BEIDE, variant: 'ok',
  },
  aandacht: {
    key: 'aandacht', kort: 'Aandacht nodig', volledig: 'Aandacht nodig',
    omschrijving: 'Een of meer doelen liggen onder het doel.', publiek: BEIDE, variant: 'middel',
  },
  tracking: {
    key: 'tracking', kort: 'Meetprobleem', volledig: 'Probleem met de meting',
    omschrijving: 'De meting is onvolledig, waardoor de cijfers onbetrouwbaar zijn.', publiek: BEIDE, variant: 'hoog',
  },
  'onvoldoende-data': {
    key: 'onvoldoende-data', kort: 'Onvoldoende data', volledig: 'Onvoldoende data',
    omschrijving: 'Er is te weinig gemeten om een status te bepalen.', publiek: BEIDE, variant: 'muted',
  },
  'geen-doel': {
    key: 'geen-doel', kort: 'Doel ontbreekt', volledig: 'Geen doel ingesteld',
    omschrijving: 'Zonder doel valt niet te bepalen of het resultaat volstaat.', publiek: BEIDE, variant: 'muted',
  },
  onbekend: {
    key: 'onbekend', kort: 'Onbekend', volledig: 'Status onbekend',
    omschrijving: '', publiek: BEIDE, variant: 'muted',
  },
};

export const klantstatusTerm = (key) => zoek(KLANTSTATUSSEN, key);

export const BUDGETSTATUSSEN = {
  'op-schema': {
    key: 'op-schema', kort: 'Op schema', volledig: 'Budget op schema',
    omschrijving: 'De besteding loopt in de pas met het budget voor deze periode.', publiek: BEIDE, variant: 'ok',
  },
  'boven-budget': {
    key: 'boven-budget', kort: 'Boven budget', volledig: 'Boven het budget',
    omschrijving: 'De besteding ligt meer dan 5 procent boven het budget voor deze periode.', publiek: BEIDE, variant: 'hoog',
  },
  'onder-budget': {
    key: 'onder-budget', kort: 'Onder budget', volledig: 'Onder het budget',
    omschrijving: 'De besteding blijft meer dan 20 procent onder het budget voor deze periode.', publiek: BEIDE, variant: 'middel',
  },
  'geen-prognose': {
    key: 'geen-prognose', kort: 'Geen prognose', volledig: 'Geen prognose beschikbaar',
    omschrijving: 'Er zijn te weinig verstreken dagen of te weinig gegevens voor een prognose.', publiek: BEIDE, variant: 'muted',
  },
  'geen-budget': {
    key: 'geen-budget', kort: 'Geen budget', volledig: 'Geen budget vastgelegd',
    omschrijving: 'Voor deze klant is geen budget ingesteld.', publiek: BEIDE, variant: 'muted',
  },
};

export const budgetstatusTerm = (key) => zoek(BUDGETSTATUSSEN, key);

/* ---------------------------------------------------------------
   Signalen en acties
   --------------------------------------------------------------- */

export const SIGNAAL_ERNST = {
  hoog: {
    key: 'hoog', kort: 'Hoge urgentie', volledig: 'Hoge urgentie',
    omschrijving: 'Vraagt deze week om een besluit of ingreep.', publiek: [Publiek.BUREAU], variant: 'hoog',
  },
  middel: {
    key: 'middel', kort: 'Gemiddelde urgentie', volledig: 'Gemiddelde urgentie',
    omschrijving: 'Kan wachten, maar niet onbeperkt.', publiek: [Publiek.BUREAU], variant: 'middel',
  },
};

export const signaalErnstTerm = (key) => zoek(SIGNAAL_ERNST, key);

/* ---------------------------------------------------------------
   Inzichtcategorieën
   --------------------------------------------------------------- */

export const InzichtCategorie = {
  ONTWIKKELING: 'ontwikkeling',
  AANDACHTSPUNT: 'aandachtspunt',
  KANS: 'kans',
  MEETBEPERKING: 'meetbeperking',
};

export const INZICHT_CATEGORIEEN = {
  ontwikkeling: {
    key: 'ontwikkeling', kort: 'Hoofdontwikkeling', volledig: 'Belangrijkste ontwikkeling',
    omschrijving: 'De grootste verandering ten opzichte van de vergelijkingsperiode.', publiek: BEIDE, variant: 'ok',
  },
  aandachtspunt: {
    key: 'aandachtspunt', kort: 'Aandachtspunt', volledig: 'Belangrijkste aandachtspunt',
    omschrijving: 'De ontwikkeling die het resultaat het meest onder druk zet.', publiek: BEIDE, variant: 'middel',
  },
  kans: {
    key: 'kans', kort: 'Kans', volledig: 'Kans of aanbevolen actie',
    omschrijving: 'Een ontwikkeling waar op korte termijn winst te halen valt.', publiek: BEIDE, variant: 'ok',
  },
  meetbeperking: {
    key: 'meetbeperking', kort: 'Meetbeperking', volledig: 'Beperking in de meting',
    omschrijving: 'Iets wat niet gemeten wordt en de conclusie beperkt.', publiek: BEIDE, variant: 'muted',
  },
};

export const inzichtCategorieTerm = (key) => zoek(INZICHT_CATEGORIEEN, key);

/* ---------------------------------------------------------------
   Vaste labels
   --------------------------------------------------------------- */

/**
 * Terugkerende koppen en labels. Ze staan hier zodat dezelfde kolom in twee
 * tabellen niet twee namen krijgt.
 */
export const LABELS = {
  organisatie: 'Organisatie',
  toegangsniveau: 'Toegangsniveau',
  functietitel: 'Functietitel',
  accountstatus: 'Accountstatus',
  medewerker: 'Medewerker',
  volledigeNaam: 'Volledige naam',
  klant: 'Klant',
  klanttype: 'Type klant',
  dashboardtype: 'Dashboardtype',
  verantwoordelijke: 'Verantwoordelijke medewerker',
  ondersteunend: 'Ondersteunende medewerker',
  toegewezenKlanten: 'Toegewezen klanten',
  aantalKlanten: 'Aantal klanten',
  laatsteLogin: 'Laatste demo-login',
  laatsteGegevens: 'Laatste volledige dag',
  verschilMetDoel: 'Verschil met doel',
  vergelijking: 'Vergelijking',
  periode: 'Periode',
  kanalen: 'Kanalen',
  conversietype: 'Conversietype',
  datakwaliteit: 'Datakwaliteit',
  bewijs: 'Bewijs',
  actie: 'Actie',
  context: 'Context',
  kanttekening: 'Kanttekening',
  betrouwbaarheid: 'Betrouwbaarheid',
  openActies: 'Open acties',
  prioriteit: 'Prioriteit',
  waaromAandacht: 'Waarom deze klant aandacht nodig heeft',
};

/**
 * Alle interne waarden die nooit zichtbaar mogen zijn.
 * Wordt door de tests gebruikt om te controleren dat er geen codewaarde lekt.
 */
export const INTERNE_WAARDEN = [
  'agency_admin', 'agency_employee', 'client_admin', 'client_viewer',
  'leadgen', 'ecommerce', 'awareness',
];

/**
 * Contract voor een authenticatieprovider.
 *
 * De applicatie praat uitsluitend via dit contract met de buitenwereld. Wie
 * de gebruiker daadwerkelijk vaststelt, is voor de dashboards niet zichtbaar.
 * Daardoor kan de demo-implementatie later worden vervangen door een
 * Azure-implementatie zonder dat er een view hoeft te veranderen.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Nu (demo)                                                       │
 * │   Frontend → DemoAuthProvider → gebruikers uit domain.js         │
 * │                                                                  │
 * │ Later (productie)                                                │
 * │   Frontend → AzureAuthProvider                                   │
 * │            → Microsoft Entra External ID                         │
 * │              of Azure Static Web Apps Authentication             │
 * │            → Azure API Management of Azure Functions             │
 * │            → server-side autorisatie en tenantfiltering          │
 * │            → Google Ads, GA4, Meta, CRM                          │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Wat een Azure-implementatie moet doen wordt beschreven bij elke methode.
 * Er wordt hier bewust niets aangenomen over een bestaande tenant,
 * appregistratie of API; die gegevens moeten bij de implementatie komen.
 */

/**
 * @typedef {object} AuthResultaat
 * @property {boolean} ok
 * @property {object|null} user      genormaliseerde gebruiker, zie domain.js
 * @property {string|null} foutcode  machineleesbare reden bij ok === false
 * @property {string|null} melding   tekst voor de gebruiker
 */

/** Foutcodes die de interface kan teruggeven. */
export const AuthFout = {
  ONBEKENDE_COMBINATIE: 'onbekende_combinatie',
  ACCOUNT_GEDEACTIVEERD: 'account_gedeactiveerd',
  ACCOUNT_UITGENODIGD: 'account_uitgenodigd',
  ONGELDIGE_INVOER: 'ongeldige_invoer',
  SESSIE_VERLOPEN: 'sessie_verlopen',
};

/**
 * Basisklasse die het contract vastlegt.
 * Een implementatie overschrijft alle methoden.
 */
export class AuthProvider {
  /**
   * Meldt een gebruiker aan.
   *
   * Azure: deze methode voert geen eigen wachtwoordcontrole uit. Zij start de
   * redirect of popup naar Entra External ID en wisselt de autorisatiecode in
   * voor tokens. Wachtwoorden komen nooit in de frontend.
   *
   * @param {{email: string, wachtwoord: string, blijfIngelogd?: boolean}} credentials
   * @returns {Promise<AuthResultaat>}
   */
  async login() {
    throw new Error('login is niet geïmplementeerd');
  }

  /**
   * Beëindigt de sessie.
   *
   * Azure: roept naast het lokaal opruimen ook het end-session endpoint van
   * de identiteitsprovider aan, zodat de gebruiker ook daar wordt uitgelogd.
   *
   * @returns {Promise<void>}
   */
  async logout() {
    throw new Error('logout is niet geïmplementeerd');
  }

  /**
   * Geeft de op dit moment aangemelde gebruiker terug, of null.
   * @returns {object|null}
   */
  getCurrentUser() {
    throw new Error('getCurrentUser is niet geïmplementeerd');
  }

  /**
   * Herstelt een bestaande sessie bij het opstarten van de applicatie.
   *
   * Azure: controleert de geldigheid van het access token, vernieuwt het zo
   * nodig met het refresh token, en leidt de gebruiker af uit de claims.
   * Benodigde claims zijn minimaal:
   *   oid of sub          stabiele gebruikers-id
   *   emails of preferred_username
   *   name of given_name en family_name
   *   extension_organisationId   organisatie waar de gebruiker toe behoort
   *   roles of extension_role     rol binnen die organisatie
   *   extension_clientAssignments klanttoewijzingen voor medewerkers
   * De vertaling van die claims naar het domeinmodel hoort in de
   * Azure-provider te gebeuren, niet in de views.
   *
   * @returns {Promise<AuthResultaat>}
   */
  async restoreSession() {
    throw new Error('restoreSession is niet geïmplementeerd');
  }

  /**
   * Accepteert een uitnodiging en activeert het account.
   *
   * Azure: dit verloopt via de uitnodigingsstroom van Entra External ID. De
   * frontend valideert hier niets zelf.
   *
   * @param {{token: string, wachtwoord: string, naamBevestigd: boolean}} gegevens
   * @returns {Promise<AuthResultaat>}
   */
  async acceptInvite() {
    throw new Error('acceptInvite is niet geïmplementeerd');
  }

  /**
   * Start een wachtwoordherstel.
   *
   * De methode geeft altijd hetzelfde resultaat terug, ongeacht of het
   * e-mailadres bestaat. Anders zou het antwoord verklappen welke adressen
   * een account hebben.
   *
   * @param {{email: string}} gegevens
   * @returns {Promise<{ok: boolean, melding: string}>}
   */
  async requestPasswordReset() {
    throw new Error('requestPasswordReset is niet geïmplementeerd');
  }
}

/**
 * Plek voor de latere Azure-implementatie.
 *
 * Deze klasse is bewust niet geïmplementeerd. Een half werkende koppeling zou
 * de indruk wekken dat er beveiliging is waar die er niet is. Wie hem invult,
 * moet ook de serverkant inrichten: de frontend mag dan nog steeds bepalen
 * wat er wordt getoond, maar de API moet zelfstandig controleren of de
 * aanvrager de opgevraagde organisatie of klant mag zien.
 *
 * Verplichte controles aan de serverkant:
 *   1. is het token geldig, niet verlopen en uitgegeven voor deze applicatie;
 *   2. hoort de organisatie-id uit het token bij de opgevraagde resource;
 *   3. staat de gevraagde klant-id in de toewijzingen van deze gebruiker;
 *   4. is de rol toereikend voor de gevraagde handeling;
 *   5. wordt het antwoord gefilterd op tenant vóór verzending.
 *
 * Zonder stap 5 is stap 1 tot en met 4 niet genoeg: een gefilterde weergave
 * op een ongefilterd antwoord is geen isolatie.
 */
export class AzureAuthProvider extends AuthProvider {
  constructor() {
    super();
    throw new Error(
      'AzureAuthProvider is nog niet geïmplementeerd. Zie README voor de benodigde Azure-onderdelen.'
    );
  }
}

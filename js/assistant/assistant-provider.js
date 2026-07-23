/**
 * Providerinterface van de Aizy-assistent.
 *
 * De UI en de controller praten uitsluitend met deze interface, nooit met een
 * concrete implementatie. Vandaag draait de `DemoAssistantProvider`; morgen kan
 * daar zonder herbouw een `AzureOpenAIAssistantProvider` of
 * `OpenAIAssistantProvider` naast staan. De providerlaag krijgt het compacte
 * requestmodel uit assistant-context.js — nooit de volledige store.
 */

export const ProviderStatus = {
  DEMO_ACTIEF: 'demo-actief',
  VOORBEREID: 'voorbereid',
  NIET_BESCHIKBAAR: 'niet-beschikbaar',
};

/**
 * Basiscontract. Concrete providers overschrijven deze methoden.
 */
export class AssistantProvider {
  /**
   * @param {{message: string, context: object, history: object[]}} _req
   * @returns {Promise<{tekst: string, punten?: string[], cijfers?: object[], beperking?: string, acties?: string[], demo?: boolean}>}
   */
  async sendMessage(_req) {
    throw new Error('sendMessage is niet geïmplementeerd voor deze provider.');
  }

  /** @returns {Promise<{begroeting: string, insight: string, vragen: string[]}>} */
  async getSuggestions(_req) {
    throw new Error('getSuggestions is niet geïmplementeerd voor deze provider.');
  }

  /** @returns {{status: string, label: string, extern: boolean}} */
  getStatus() {
    return { status: ProviderStatus.NIET_BESCHIKBAAR, label: 'Onbekend', extern: false };
  }
}

/**
 * Voorbereide externe providers. Ze bestaan zodat de koppeling later alleen nog
 * hoeft te worden ingevuld; ze doen in deze fase bewust niets en melden dat
 * eerlijk in plaats van een echte API te suggereren.
 */
export class ExternalAssistantProvider extends AssistantProvider {
  constructor(naam) {
    super();
    this.naam = naam;
  }

  getStatus() {
    return { status: ProviderStatus.VOORBEREID, label: `${this.naam} (voorbereid)`, extern: true };
  }

  async sendMessage() {
    return {
      tekst: `De koppeling met ${this.naam} is voorbereid maar nog niet geactiveerd. De standaard paginahulp blijft bruikbaar.`,
      beperking: 'Externe provider nog niet gekoppeld.',
      demo: true,
    };
  }

  async getSuggestions() {
    return { begroeting: 'Waar kan ik je op deze pagina mee helpen?', insight: '', vragen: [] };
  }
}

export class AzureOpenAIAssistantProvider extends ExternalAssistantProvider {
  constructor() { super('Azure OpenAI'); }
}

export class OpenAIAssistantProvider extends ExternalAssistantProvider {
  constructor() { super('OpenAI'); }
}

/**
 * De Aizy AI-integratiekaart en de assistent-instellingen.
 *
 * Beide zijn eerlijk over de status: de assistent draait op demo-antwoorden en
 * er is nog geen externe provider gekoppeld. Geen enkele knop suggereert een
 * verbinding die er niet is.
 */

import { esc, badge } from './components.js';

/** De integratiekaart op de Integratiespagina. */
export function renderAssistentIntegratiekaart({ status }) {
  return `
    <section class="card assistent-integratie">
      <div class="kaart-kop">
        <h2>Aizy AI-assistent</h2>
        ${badge(status?.label ?? 'Demo actief', 'ok')}
      </div>
      <p class="muted">Categorie: AI en automatisering</p>
      <p>Contextbewuste hulp, uitleg en analyses binnen het dashboard. De huidige
        versie gebruikt vooraf ingestelde demo-antwoorden.</p>

      <div class="samenwerk-kolommen">
        <div>
          <h3>Beschikbare gegevens</h3>
          <ul class="samenwerk-lijst">
            <li>huidige pagina</li>
            <li>actieve klant</li>
            <li>geselecteerde periode</li>
            <li>actieve filters</li>
            <li>zichtbare KPI's</li>
            <li>acties, signalen en planning binnen je rechten</li>
          </ul>
        </div>
        <div>
          <h3>Nog niet gekoppeld</h3>
          <ul class="samenwerk-lijst">
            <li>externe taalmodelprovider</li>
            <li>live gegenereerde analyses</li>
            <li>zoekopdrachten over alle klanten heen</li>
            <li>externe kennisbronnen</li>
          </ul>
        </div>
      </div>

      <div class="form-acties">
        <button type="button" class="btn primary" data-assistent="open">Bekijk demo</button>
        <a class="btn klein" href="#/agency/settings?sectie=assistent">Instellingen</a>
        <button type="button" class="btn klein" data-assistent-instelling="modus-extern" title="Externe provider voorbereiden">Provider voorbereiden</button>
      </div>
      <p class="muted klein">Er is nog geen externe AI-provider verbonden. De demo werkt volledig lokaal.</p>
    </section>`;
}

/** De instellingenweergave van de assistent (op de Instellingenpagina). */
export function renderAssistentInstellingen({ voorkeuren, status }) {
  const v = voorkeuren;
  const knop = (actief, sleutel, label) =>
    `<button type="button" class="btn klein${actief ? ' primary' : ''}" data-assistent-instelling="${esc(sleutel)}"
      aria-pressed="${actief ? 'true' : 'false'}">${esc(label)}</button>`;

  return `
    <section class="card" id="assistentInstellingen">
      <div class="kaart-kop">
        <h2>Aizy AI-assistent</h2>
        ${badge(status?.label ?? 'Demo actief', 'ok')}
      </div>
      <p class="muted">Bepaal hoe de assistent zich gedraagt. De huidige antwoorden zijn demo-antwoorden en werken volledig lokaal.</p>

      <div class="instelling-rij">
        <div><strong>Assistent tonen</strong><p class="muted klein">De launcher verschijnt op elke pagina.</p></div>
        <div class="actie-groep">
          ${knop(v.zichtbaar !== false, 'zichtbaar-aan', 'Aan')}
          ${knop(v.zichtbaar === false, 'zichtbaar-uit', 'Uit')}
        </div>
      </div>

      <div class="instelling-rij">
        <div><strong>Standaardpositie</strong><p class="muted klein">Zwevend paneel of vastgezet rechts.</p></div>
        <div class="actie-groep">
          ${knop((v.positie ?? 'zwevend') === 'zwevend', 'positie-zwevend', 'Zwevend')}
          ${knop(v.positie === 'vastgezet', 'positie-vastgezet', 'Vastgezet rechts')}
        </div>
      </div>

      <div class="instelling-rij">
        <div><strong>Modus</strong><p class="muted klein">De externe provider is voorbereid, maar nog niet beschikbaar.</p></div>
        <div class="actie-groep">
          ${knop((v.modus ?? 'demo') === 'demo', 'modus-demo', 'Demo')}
          ${knop(v.modus === 'extern', 'modus-extern', 'Externe provider (voorbereid)')}
        </div>
      </div>

      <div class="instelling-rij">
        <div><strong>Context die de assistent gebruikt</strong></div>
        <ul class="samenwerk-lijst">
          <li>huidige pagina</li>
          <li>geselecteerde klant</li>
          <li>actieve periode</li>
          <li>zichtbare dashboarddata</li>
          <li>acties en signalen binnen je rechten</li>
        </ul>
      </div>

      <div class="instelling-rij">
        <div><strong>Gesprekshistorie</strong><p class="muted klein">Lokaal bewaard per gebruiker. Een demo-reset zet dit terug.</p></div>
        <button type="button" class="btn klein gevaar" data-assistent-instelling="wis">Geschiedenis wissen</button>
      </div>

      <p class="muted klein">Privacy: de demo werkt lokaal in je browser. Er worden nog geen gegevens naar een externe
        AI-provider gestuurd. Bij een toekomstige koppeling zijn aanvullende configuratie en toestemming nodig.</p>
    </section>`;
}

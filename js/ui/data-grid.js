/**
 * Configureerbaar datagrid.
 *
 * Eén component voor iedere tabel in de applicatie. Dat is geen luxe: zolang
 * elke pagina zijn eigen tabel tekende, had de ene sortering en de andere niet,
 * en was "kolommen kiezen" een functie die je per pagina opnieuw moest bouwen.
 *
 * WAT HET GRID KAN
 *   kolommen kiezen, verbergen, verslepen en in breedte aanpassen
 *   sorteren, zoeken, filteren en groeperen
 *   kolommen links vastzetten bij horizontaal scrollen
 *   pagineren, compact of ruim, rijen selecteren en bulkacties uitvoeren
 *   de huidige weergave exporteren en de standaardweergave herstellen
 *
 * WAT HET GRID NIET DOET
 * Het rekent niets uit en het haalt niets op. Het krijgt rijen en een definitie
 * en tekent wat daaruit volgt. De tenantgrens ligt daardoor nog steeds vóór de
 * view: een grid kan nooit een rij tonen die de repository niet heeft geleverd.
 *
 * DE DEFINITIE
 *   {
 *     id, pagina,                 waar de voorkeuren onder worden bewaard
 *     kolommen: [{
 *       key, label, uitleg,
 *       waarde(rij),              de ruwe waarde, voor sorteren en exporteren
 *       cel(rij),                 de opgemaakte cel als HTML
 *       sorteerbaar, groepeerbaar, verplicht, standaard, vast, uitlijning, breedte
 *     }],
 *     filters: [{ key, label, opties, test(rij, waarde) }],
 *     weergaven: [{ id, naam, staat }],
 *     zoektekst(rij),             waar de zoekterm in wordt gezocht
 *     rijId(rij), rijHash(rij),   identiteit en de link achter een rij
 *     bulkacties: [{ id, label, bevestiging }]
 *   }
 */

import { esc } from '../views/components.js';
import { emptyState } from './states.js';
import { Dichtheid } from '../model/table-prefs.js';

/* ---------------------------------------------------------------
   Verwerken
   --------------------------------------------------------------- */

/**
 * Past zoeken, filters, sortering en groepering toe.
 * Geeft alles terug wat de weergave nodig heeft, zodat de renderfunctie niets
 * meer hoeft te berekenen en de tellingen in de interface per definitie kloppen.
 */
export function verwerkRijen(definitie, rijen, staat) {
  const kolomOpKey = new Map(definitie.kolommen.map((k) => [k.key, k]));

  const zoek = String(staat.zoek ?? '').trim().toLowerCase();
  let uit = rijen;

  if (zoek) {
    uit = uit.filter((rij) => String(definitie.zoektekst?.(rij) ?? '').toLowerCase().includes(zoek));
  }

  for (const filter of definitie.filters ?? []) {
    const waarde = staat.filters?.[filter.key];
    if (waarde == null || waarde === '') continue;
    uit = uit.filter((rij) => filter.test(rij, waarde));
  }

  const totaalNaFilter = uit.length;

  if (staat.sortering) {
    const kolom = kolomOpKey.get(staat.sortering.key);
    if (kolom) {
      const richting = staat.sortering.richting === 'op' ? 1 : -1;
      uit = [...uit].sort((a, b) => vergelijk(kolom.waarde(a), kolom.waarde(b)) * richting);
    }
  }

  const groepen = staat.groepering
    ? groepeer(uit, kolomOpKey.get(staat.groepering))
    : null;

  // Bij groeperen wordt niet gepagineerd: een groep die halverwege een pagina
  // wordt afgekapt, leest als een onvolledige groep en dat is misleidend.
  const perPagina = staat.perPagina;
  const paginas = groepen ? 1 : Math.max(1, Math.ceil(totaalNaFilter / perPagina));
  const pagina = Math.min(Math.max(1, staat.pagina), paginas);
  const zichtbaar = groepen ? uit : uit.slice((pagina - 1) * perPagina, pagina * perPagina);

  return { alle: uit, zichtbaar, groepen, totaal: rijen.length, totaalNaFilter, pagina, paginas };
}

/**
 * Vergelijkt twee waarden.
 * Ontbrekende waarden gaan altijd naar achteren, ongeacht de sorteerrichting:
 * "niet gemeten" is geen kleinste waarde maar een afwezige waarde, en die hoort
 * niet bovenaan een ranglijst te belanden.
 */
function vergelijk(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'nl', { numeric: true });
}

function groepeer(rijen, kolom) {
  if (!kolom) return null;
  const kaart = new Map();
  for (const rij of rijen) {
    const sleutel = kolom.groepWaarde ? kolom.groepWaarde(rij) : String(kolom.waarde(rij) ?? 'Niet ingevuld');
    if (!kaart.has(sleutel)) kaart.set(sleutel, []);
    kaart.get(sleutel).push(rij);
  }
  return [...kaart.entries()]
    .map(([naam, items]) => ({ naam, items }))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

/* ---------------------------------------------------------------
   Weergave
   --------------------------------------------------------------- */

/**
 * @param {object} opties
 * @param {object} opties.definitie
 * @param {object[]} opties.rijen
 * @param {object} opties.staat
 * @param {object} opties.verwerkt   uit verwerkRijen()
 * @param {string[]} opties.selectie rij-ids
 * @param {object[]} opties.weergaven
 * @param {boolean} opties.magBewerken
 */
export function renderDataGrid({
  definitie, staat, verwerkt, selectie = [], weergaven = [], magBewerken = true,
  leegTitel = 'Geen rijen binnen deze selectie',
  leegUitleg = 'Pas de zoekterm, de filters of de periode aan om meer te zien.',
}) {
  const grid = definitie.id;
  const kolommen = staat.kolommen
    .map((key) => definitie.kolommen.find((k) => k.key === key))
    .filter(Boolean);

  return `<section class="datagrid" data-grid="${esc(grid)}" data-pagina="${esc(definitie.pagina)}">
    ${renderWerkbalk(definitie, staat, verwerkt, weergaven, selectie, magBewerken)}
    ${renderKolomkiezer(definitie, staat)}
    ${renderWeergavenPaneel(definitie, weergaven)}
    ${selectie.length ? renderBulkbalk(definitie, selectie, magBewerken) : ''}
    ${verwerkt.totaalNaFilter === 0
      ? emptyState({ titel: leegTitel, uitleg: leegUitleg, id: `${grid}Leeg` })
      : renderTabel(definitie, staat, verwerkt, kolommen, selectie)}
    ${renderPaginering(definitie, staat, verwerkt)}
  </section>`;
}

function renderWerkbalk(definitie, staat, verwerkt, weergaven, selectie, magBewerken) {
  const grid = definitie.id;
  const actieveWeergave = weergaven.find((w) => w.id === staat.weergaveId);

  return `<div class="grid-werkbalk">
    <div class="grid-zoek">
      <label class="visueel-verborgen" for="grid-zoek-${esc(grid)}">Zoeken in deze tabel</label>
      <input type="search" id="grid-zoek-${esc(grid)}" class="grid-zoekveld"
        data-grid-zoek="${esc(grid)}" value="${esc(staat.zoek)}" placeholder="Zoeken">
    </div>

    ${(definitie.filters ?? []).map((f) => `
      <div class="grid-filter">
        <label class="visueel-verborgen" for="grid-filter-${esc(grid)}-${esc(f.key)}">${esc(f.label)}</label>
        <select id="grid-filter-${esc(grid)}-${esc(f.key)}" data-grid-filter="${esc(grid)}" data-filter="${esc(f.key)}">
          <option value="">${esc(f.label)}: alle</option>
          ${f.opties.map((o) => `<option value="${esc(o.waarde)}"${staat.filters?.[f.key] === o.waarde ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>
      </div>`).join('')}

    ${definitie.kolommen.some((k) => k.groepeerbaar) ? `
      <div class="grid-filter">
        <label class="visueel-verborgen" for="grid-groep-${esc(grid)}">Groeperen op</label>
        <select id="grid-groep-${esc(grid)}" data-grid-groep="${esc(grid)}">
          <option value="">Niet groeperen</option>
          ${definitie.kolommen.filter((k) => k.groepeerbaar).map((k) => `<option value="${esc(k.key)}"${staat.groepering === k.key ? ' selected' : ''}>Groepeer op ${esc(k.label.toLowerCase())}</option>`).join('')}
        </select>
      </div>` : ''}

    <span class="grid-telling" aria-live="polite">
      ${verwerkt.totaalNaFilter} van ${verwerkt.totaal} ${verwerkt.totaal === 1 ? 'rij' : 'rijen'}${selectie.length ? ` · ${selectie.length} geselecteerd` : ''}
    </span>

    <div class="grid-werkbalk-acties">
      <button type="button" class="btn klein" data-grid-weergaven="${esc(grid)}"
        aria-expanded="false" aria-controls="grid-weergaven-${esc(grid)}">
        Weergave${actieveWeergave ? `: ${esc(actieveWeergave.naam)}` : ''}
      </button>
      <button type="button" class="btn klein" data-grid-kolommen="${esc(grid)}"
        aria-expanded="false" aria-controls="grid-kolommen-${esc(grid)}">Kolommen</button>
      <button type="button" class="btn klein" data-grid-dichtheid="${esc(grid)}"
        aria-pressed="${staat.dichtheid === Dichtheid.RUIM ? 'true' : 'false'}">
        ${staat.dichtheid === Dichtheid.RUIM ? 'Compacte rijen' : 'Ruime rijen'}
      </button>
      <button type="button" class="btn klein" data-grid-export="${esc(grid)}">Exporteren</button>
      <button type="button" class="btn klein" data-grid-herstel="${esc(grid)}">Standaardweergave</button>
    </div>
  </div>`;
}

/**
 * De kolomkiezer.
 *
 * Aan- en uitzetten gebeurt met een checkbox; de volgorde met slepen én met
 * twee knoppen. Die knoppen zijn geen bijzaak: zonder toetsenbordalternatief is
 * kolomvolgorde alleen bereikbaar voor wie een muis kan gebruiken.
 */
function renderKolomkiezer(definitie, staat) {
  const grid = definitie.id;
  const zichtbaar = new Set(staat.kolommen);
  const geordend = [
    ...staat.kolommen.map((key) => definitie.kolommen.find((k) => k.key === key)).filter(Boolean),
    ...definitie.kolommen.filter((k) => !zichtbaar.has(k.key)),
  ];

  return `<div class="grid-paneel" id="grid-kolommen-${esc(grid)}" hidden>
    <h3>Kolommen kiezen</h3>
    <p class="muted klein">Sleep om de volgorde te wijzigen, of gebruik de pijlknoppen.</p>
    <ul class="kolomlijst" data-kolomlijst="${esc(grid)}">
      ${geordend.map((k, i) => `<li class="kolomrij" draggable="true"
        data-kolom="${esc(k.key)}" data-grid="${esc(grid)}">
        <span class="sleepgreep" aria-hidden="true">⠿</span>
        <label class="kolomrij-label">
          <input type="checkbox" data-grid-kolomkeuze="${esc(grid)}" value="${esc(k.key)}"
            ${zichtbaar.has(k.key) ? ' checked' : ''}${k.verplicht ? ' disabled' : ''}>
          <span>${esc(k.label)}</span>
          ${k.verplicht ? '<span class="muted klein">verplicht</span>' : ''}
        </label>
        <span class="kolomrij-knoppen">
          <button type="button" class="icoonknop klein" data-grid-kolomop="${esc(grid)}" data-kolom="${esc(k.key)}"
            aria-label="${esc(k.label)} naar voren verplaatsen"${i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" class="icoonknop klein" data-grid-kolomneer="${esc(grid)}" data-kolom="${esc(k.key)}"
            aria-label="${esc(k.label)} naar achteren verplaatsen"${i === geordend.length - 1 ? ' disabled' : ''}>↓</button>
          <button type="button" class="icoonknop klein" data-grid-kolomvast="${esc(grid)}" data-kolom="${esc(k.key)}"
            aria-pressed="${staat.vastgezet.includes(k.key) ? 'true' : 'false'}"
            aria-label="${esc(k.label)} links vastzetten" title="Links vastzetten">📌</button>
        </span>
      </li>`).join('')}
    </ul>
  </div>`;
}

function renderWeergavenPaneel(definitie, weergaven) {
  const grid = definitie.id;

  return `<div class="grid-paneel" id="grid-weergaven-${esc(grid)}" hidden>
    <h3>Opgeslagen weergaven</h3>
    <ul class="weergavelijst">
      ${weergaven.map((w) => `<li>
        <button type="button" class="link" data-grid-weergave="${esc(grid)}" data-weergave="${esc(w.id)}">${esc(w.naam)}</button>
        ${w.ingebouwd
          ? '<span class="muted klein">standaard</span>'
          : `<button type="button" class="icoonknop klein" data-grid-weergaveweg="${esc(grid)}" data-weergave="${esc(w.id)}"
              aria-label="Weergave ${esc(w.naam)} verwijderen">×</button>`}
      </li>`).join('')}
    </ul>
    <div class="weergave-opslaan">
      <label for="grid-weergavenaam-${esc(grid)}">Huidige weergave opslaan als</label>
      <div class="veld-met-knop">
        <input type="text" id="grid-weergavenaam-${esc(grid)}" data-grid-weergavenaam="${esc(grid)}"
          placeholder="Bijvoorbeeld: deze week controleren">
        <button type="button" class="btn klein primary" data-grid-weergaveopslaan="${esc(grid)}">Opslaan</button>
      </div>
    </div>
  </div>`;
}

function renderBulkbalk(definitie, selectie, magBewerken) {
  const acties = magBewerken ? definitie.bulkacties ?? [] : [];

  return `<div class="grid-bulkbalk" role="region" aria-label="Acties op de selectie">
    <span><strong>${selectie.length}</strong> ${selectie.length === 1 ? 'rij' : 'rijen'} geselecteerd</span>
    ${acties.map((a) => `<button type="button" class="btn klein" data-grid-bulk="${esc(definitie.id)}" data-bulk="${esc(a.id)}">${esc(a.label)}</button>`).join('')}
    <button type="button" class="btn klein" data-grid-selectieleeg="${esc(definitie.id)}">Selectie opheffen</button>
  </div>`;
}

function renderTabel(definitie, staat, verwerkt, kolommen, selectie) {
  const grid = definitie.id;
  const geselecteerd = new Set(selectie);
  const alleZichtbaarGeselecteerd = verwerkt.zichtbaar.length > 0
    && verwerkt.zichtbaar.every((r) => geselecteerd.has(definitie.rijId(r)));

  const kop = `<thead><tr>
    ${definitie.selecteerbaar !== false ? `<th scope="col" class="cel-selectie">
      <label class="visueel-verborgen" for="grid-alles-${esc(grid)}">Alle zichtbare rijen selecteren</label>
      <input type="checkbox" id="grid-alles-${esc(grid)}" data-grid-alles="${esc(grid)}"${alleZichtbaarGeselecteerd ? ' checked' : ''}>
    </th>` : ''}
    ${kolommen.map((k) => renderKop(k, staat, grid)).join('')}
  </tr></thead>`;

  const body = verwerkt.groepen
    ? verwerkt.groepen.map((g) => `
        <tbody class="grid-groep">
          <tr class="grid-groepkop">
            <th colspan="${kolommen.length + (definitie.selecteerbaar !== false ? 1 : 0)}" scope="colgroup">
              ${esc(g.naam)} <span class="muted klein">${g.items.length} ${g.items.length === 1 ? 'rij' : 'rijen'}</span>
            </th>
          </tr>
          ${g.items.map((rij) => renderRij(definitie, kolommen, rij, geselecteerd)).join('')}
        </tbody>`).join('')
    : `<tbody>${verwerkt.zichtbaar.map((rij) => renderRij(definitie, kolommen, rij, geselecteerd)).join('')}</tbody>`;

  return `<div class="grid-scroll">
    <table class="grid-tabel dichtheid-${esc(staat.dichtheid)}">
      <caption class="visueel-verborgen">${esc(definitie.omschrijving ?? definitie.titel ?? 'Tabel')}</caption>
      ${kop}
      ${body}
    </table>
  </div>`;
}

function renderKop(kolom, staat, grid) {
  const sortering = staat.sortering?.key === kolom.key ? staat.sortering.richting : null;
  const ariaSort = sortering === 'op' ? 'ascending' : sortering === 'af' ? 'descending' : 'none';
  const breedte = staat.breedtes[kolom.key];
  const vast = staat.vastgezet.includes(kolom.key);

  const inhoud = kolom.sorteerbaar === false
    ? `<span${kolom.uitleg ? ` title="${esc(kolom.uitleg)}"` : ''}>${esc(kolom.label)}</span>`
    : `<button type="button" class="grid-sorteer" data-grid-sorteer="${esc(grid)}" data-kolom="${esc(kolom.key)}"
        ${kolom.uitleg ? `title="${esc(kolom.uitleg)}"` : ''}>
        <span>${esc(kolom.label)}</span>
        <span class="sorteer-pijl" aria-hidden="true">${sortering === 'op' ? '↑' : sortering === 'af' ? '↓' : '↕'}</span>
      </button>`;

  return `<th scope="col" aria-sort="${ariaSort}"
    class="uitlijn-${esc(kolom.uitlijning ?? 'links')}${vast ? ' is-vast' : ''}"
    data-kolom="${esc(kolom.key)}"
    ${breedte ? `style="width:${Number(breedte)}px"` : ''}>
    ${inhoud}
    <span class="kolom-greep" role="separator" aria-orientation="vertical"
      data-grid-breedte="${esc(grid)}" data-kolom="${esc(kolom.key)}"
      aria-label="Breedte van kolom ${esc(kolom.label)} aanpassen" tabindex="0"></span>
  </th>`;
}

function renderRij(definitie, kolommen, rij, geselecteerd) {
  const id = definitie.rijId(rij);
  const isGeselecteerd = geselecteerd.has(id);

  return `<tr data-rij="${esc(id)}" data-grid="${esc(definitie.id)}"${isGeselecteerd ? ' class="is-geselecteerd"' : ''}>
    ${definitie.selecteerbaar !== false ? `<td class="cel-selectie">
      <label class="visueel-verborgen" for="grid-rij-${esc(definitie.id)}-${esc(id)}">Rij selecteren</label>
      <input type="checkbox" id="grid-rij-${esc(definitie.id)}-${esc(id)}"
        data-grid-rijkeuze="${esc(definitie.id)}" value="${esc(id)}"${isGeselecteerd ? ' checked' : ''}>
    </td>` : ''}
    ${kolommen.map((k) => `<td class="uitlijn-${esc(k.uitlijning ?? 'links')}">${k.cel(rij)}</td>`).join('')}
  </tr>`;
}

function renderPaginering(definitie, staat, verwerkt) {
  if (verwerkt.groepen) {
    return `<div class="grid-paginering">
      <span class="muted klein">Bij groeperen worden alle rijen getoond.</span>
    </div>`;
  }
  if (verwerkt.totaalNaFilter === 0) return '';

  const grid = definitie.id;
  const van = (verwerkt.pagina - 1) * staat.perPagina + 1;
  const tot = Math.min(verwerkt.pagina * staat.perPagina, verwerkt.totaalNaFilter);

  return `<div class="grid-paginering">
    <label class="visueel-verborgen" for="grid-perpagina-${esc(grid)}">Rijen per pagina</label>
    <select id="grid-perpagina-${esc(grid)}" data-grid-perpagina="${esc(grid)}">
      ${[10, 25, 50, 100].map((n) => `<option value="${n}"${staat.perPagina === n ? ' selected' : ''}>${n} per pagina</option>`).join('')}
    </select>
    <span class="muted klein">${van} tot en met ${tot} van ${verwerkt.totaalNaFilter}</span>
    <button type="button" class="btn klein" data-grid-pagina="${esc(grid)}" data-richting="vorige"
      ${verwerkt.pagina <= 1 ? 'disabled' : ''}>Vorige</button>
    <span class="muted klein">Pagina ${verwerkt.pagina} van ${verwerkt.paginas}</span>
    <button type="button" class="btn klein" data-grid-pagina="${esc(grid)}" data-richting="volgende"
      ${verwerkt.pagina >= verwerkt.paginas ? 'disabled' : ''}>Volgende</button>
  </div>`;
}

/* ---------------------------------------------------------------
   Exporteren
   --------------------------------------------------------------- */

/**
 * Zet de huidige weergave om in CSV.
 *
 * Bewust de huidige weergave en niet de volledige dataset: wie exporteert na
 * filteren, verwacht wat hij op het scherm ziet. De kolomvolgorde en de
 * sortering worden dan ook precies overgenomen.
 */
export function naarCsv(definitie, staat, rijen) {
  const kolommen = staat.kolommen
    .map((key) => definitie.kolommen.find((k) => k.key === key))
    .filter(Boolean);

  const veld = (waarde) => {
    const tekst = waarde == null ? '' : String(waarde);
    return /[";\n]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
  };

  const regels = [kolommen.map((k) => veld(k.label)).join(';')];
  for (const rij of rijen) {
    regels.push(kolommen.map((k) => veld((k.exportWaarde ?? k.waarde)(rij))).join(';'));
  }
  // Een BOM zodat Excel de accenten in Nederlandse klantnamen goed leest.
  return `﻿${regels.join('\r\n')}`;
}

/** Biedt een tekstbestand aan als download. */
export function downloadTekst(bestandsnaam, inhoud, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([inhoud], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = bestandsnaam;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Direct vrijgeven zou de download in sommige browsers afbreken.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

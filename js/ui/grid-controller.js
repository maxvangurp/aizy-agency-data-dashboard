/**
 * Bediening van de datagrids.
 *
 * Het grid tekent; deze module onthoudt en verandert. De scheiding is er omdat
 * een tabel die zowel zijn eigen HTML maakt als zijn eigen state bijhoudt, na
 * de derde functie onleesbaar wordt.
 *
 * HOE HET WERKT
 * Bij iedere render meldt een pagina zijn grids aan met `registreerGrid`. De
 * gedelegeerde handlers zoeken het grid op zijn id op, passen de staat aan,
 * schrijven die weg en vragen om een nieuwe render. Er is dus nooit een
 * halfbijgewerkt grid: de staat is leidend en de weergave volgt.
 *
 * WAT WAAR WORDT BEWAARD
 *   staat        per gebruiker, pagina, tabel en klantcontext, in localStorage
 *   selectie     alleen in het geheugen, want een selectie is een handeling en
 *                geen voorkeur; hem na een herlading terugkrijgen zou eerder
 *                verrassen dan helpen
 */

import {
  leesStaat, schrijfStaat, herstelStaat, normaliseerStaat,
  leesWeergaven, bewaarWeergave, verwijderWeergave, pasWeergaveToe, Dichtheid,
} from '../model/table-prefs.js';
import { verwerkRijen, naarCsv, downloadTekst } from './data-grid.js';
import { toast, toastFout } from './toast.js';

/** De grids die op dit moment op het scherm staan. */
const actieveGrids = new Map();

/** Selecties per grid, alleen binnen deze sessie. */
const selecties = new Map();

let opWijziging = () => {};

/** Wordt één keer aangeroepen bij het opstarten. */
export function initGrids(herteken) {
  opWijziging = herteken;
}

/**
 * Meldt een grid aan voor deze render en levert alles wat de weergave nodig heeft.
 *
 * @param {object} definitie
 * @param {object[]} rijen
 * @param {{userId: string, context: string|null}} context
 */
export function registreerGrid(definitie, rijen, { userId, context = null }) {
  const sleutel = { userId, pagina: definitie.pagina, tabel: definitie.id, context };
  const staat = leesStaat(sleutel, definitie);
  const weergaven = leesWeergaven(sleutel, definitie);
  const verwerkt = verwerkRijen(definitie, rijen, staat);
  const selectie = [...(selecties.get(definitie.id) ?? new Set())];

  actieveGrids.set(definitie.id, { definitie, rijen, staat, sleutel, verwerkt });

  return { definitie, staat, verwerkt, weergaven, selectie };
}

/** Vergeet de grids van de vorige render. */
export function wisGrids() {
  actieveGrids.clear();
}

function grid(id) {
  return actieveGrids.get(id) ?? null;
}

function pas(id, patch, { herteken = true } = {}) {
  const g = grid(id);
  if (!g) return null;
  const nieuw = schrijfStaat(g.sleutel, g.definitie, { ...g.staat, ...patch });
  g.staat = nieuw;
  if (herteken) opWijziging();
  return nieuw;
}

/** De rijen die op dit moment na filteren overblijven, in de zichtbare volgorde. */
function gefilterdeRijen(g) {
  return g.verwerkt.groepen ? g.verwerkt.groepen.flatMap((x) => x.items) : g.verwerkt.alle;
}

/* ---------------------------------------------------------------
   Handelingen
   --------------------------------------------------------------- */

export function zoek(id, waarde) {
  return pas(id, { zoek: waarde, pagina: 1 });
}

export function zetFilter(id, filterKey, waarde) {
  const g = grid(id);
  if (!g) return null;
  return pas(id, { filters: { ...g.staat.filters, [filterKey]: waarde }, pagina: 1 });
}

export function zetGroepering(id, kolom) {
  return pas(id, { groepering: kolom || null, pagina: 1 });
}

export function sorteer(id, kolom) {
  const g = grid(id);
  if (!g) return null;
  const huidig = g.staat.sortering;
  const richting = huidig?.key === kolom && huidig.richting === 'op' ? 'af' : 'op';
  return pas(id, { sortering: { key: kolom, richting } });
}

export function wisselDichtheid(id) {
  const g = grid(id);
  if (!g) return null;
  return pas(id, { dichtheid: g.staat.dichtheid === Dichtheid.RUIM ? Dichtheid.COMPACT : Dichtheid.RUIM });
}

export function zetPerPagina(id, aantal) {
  return pas(id, { perPagina: Number(aantal), pagina: 1 });
}

export function blader(id, richting) {
  const g = grid(id);
  if (!g) return null;
  const doel = g.verwerkt.pagina + (richting === 'volgende' ? 1 : -1);
  return pas(id, { pagina: Math.min(Math.max(1, doel), g.verwerkt.paginas) });
}

export function zetKolomZichtbaar(id, kolom, zichtbaar) {
  const g = grid(id);
  if (!g) return null;

  const definitie = g.definitie.kolommen.find((k) => k.key === kolom);
  if (definitie?.verplicht && !zichtbaar) {
    toastFout('Deze kolom is verplicht en kan niet worden verborgen.');
    return null;
  }

  const kolommen = zichtbaar
    ? [...g.staat.kolommen, kolom]
    : g.staat.kolommen.filter((k) => k !== kolom);

  if (!kolommen.length) {
    toastFout('Er moet minstens één kolom zichtbaar blijven.');
    return null;
  }
  return pas(id, { kolommen });
}

/**
 * Verplaatst een kolom naar de plek van een andere kolom.
 * Werkt ook wanneer de doelkolom verborgen is: die wordt dan tegelijk zichtbaar,
 * want anders zou de kolom naar een plek verhuizen die niemand ziet.
 */
export function verplaatsKolom(id, kolom, doelKolom) {
  const g = grid(id);
  if (!g) return null;

  const zichtbaar = new Set(g.staat.kolommen);
  const kolommen = [...g.staat.kolommen];
  if (!zichtbaar.has(kolom)) kolommen.push(kolom);
  if (!zichtbaar.has(doelKolom)) kolommen.push(doelKolom);

  const van = kolommen.indexOf(kolom);
  const naar = kolommen.indexOf(doelKolom);
  if (van === -1 || naar === -1 || van === naar) return null;

  kolommen.splice(van, 1);
  kolommen.splice(naar, 0, kolom);
  return pas(id, { kolommen });
}

/** Eén plek opschuiven: het toetsenbordalternatief voor slepen. */
export function schuifKolom(id, kolom, richting) {
  const g = grid(id);
  if (!g) return null;
  const kolommen = [...g.staat.kolommen];
  const index = kolommen.indexOf(kolom);
  const doel = index + (richting === 'op' ? -1 : 1);
  if (index === -1 || doel < 0 || doel >= kolommen.length) return null;
  return verplaatsKolom(id, kolom, kolommen[doel]);
}

export function wisselVastzetten(id, kolom) {
  const g = grid(id);
  if (!g) return null;
  const vastgezet = g.staat.vastgezet.includes(kolom)
    ? g.staat.vastgezet.filter((k) => k !== kolom)
    : [...g.staat.vastgezet, kolom];
  return pas(id, { vastgezet });
}

export function zetBreedte(id, kolom, breedte) {
  const g = grid(id);
  if (!g) return null;
  return pas(id, { breedtes: { ...g.staat.breedtes, [kolom]: breedte } });
}

export function herstel(id) {
  const g = grid(id);
  if (!g) return null;
  herstelStaat(g.sleutel);
  selecties.delete(id);
  toast('De standaardweergave van deze tabel is hersteld.');
  opWijziging();
  return null;
}

/* ---------------------------------------------------------------
   Opgeslagen weergaven
   --------------------------------------------------------------- */

export function pasWeergaveToeOpGrid(id, weergaveId) {
  const g = grid(id);
  if (!g) return null;
  const weergave = leesWeergaven(g.sleutel, g.definitie).find((w) => w.id === weergaveId);
  if (!weergave) return null;

  const nieuw = pasWeergaveToe(g.staat, weergave, g.definitie);
  schrijfStaat(g.sleutel, g.definitie, { ...nieuw, weergaveId });
  toast(`Weergave "${weergave.naam}" toegepast.`);
  opWijziging();
  return nieuw;
}

export function slaWeergaveOp(id, naam) {
  const g = grid(id);
  if (!g) return null;
  if (!String(naam ?? '').trim()) {
    toastFout('Geef de weergave een naam voordat je hem opslaat.');
    return null;
  }

  const weergave = bewaarWeergave(g.sleutel, naam, {
    kolommen: g.staat.kolommen,
    sortering: g.staat.sortering,
    groepering: g.staat.groepering,
    filters: g.staat.filters,
    zoek: g.staat.zoek,
    dichtheid: g.staat.dichtheid,
    perPagina: g.staat.perPagina,
  });
  toast(`Weergave "${weergave.naam}" opgeslagen.`);
  opWijziging();
  return weergave;
}

export function verwijderOpgeslagenWeergave(id, weergaveId) {
  const g = grid(id);
  if (!g) return null;
  if (verwijderOpgeslagen(g, weergaveId)) {
    toast('De weergave is verwijderd.');
    opWijziging();
  }
  return null;
}

function verwijderOpgeslagen(g, weergaveId) {
  return verwijderWeergave(g.sleutel, weergaveId);
}

/* ---------------------------------------------------------------
   Selectie en bulkacties
   --------------------------------------------------------------- */

export function zetRijSelectie(id, rijId, geselecteerd) {
  const huidig = selecties.get(id) ?? new Set();
  if (geselecteerd) huidig.add(rijId);
  else huidig.delete(rijId);
  selecties.set(id, huidig);
  opWijziging();
}

export function zetAllesSelectie(id, geselecteerd) {
  const g = grid(id);
  if (!g) return;
  const huidig = geselecteerd ? new Set(g.verwerkt.zichtbaar.map((r) => g.definitie.rijId(r))) : new Set();
  selecties.set(id, huidig);
  opWijziging();
}

export function wisSelectie(id) {
  selecties.delete(id);
  opWijziging();
}

export function getSelectie(id) {
  return [...(selecties.get(id) ?? new Set())];
}

/** De rijobjecten die bij de huidige selectie horen. */
export function geselecteerdeRijen(id) {
  const g = grid(id);
  if (!g) return [];
  const gekozen = selecties.get(id) ?? new Set();
  return g.rijen.filter((r) => gekozen.has(g.definitie.rijId(r)));
}

/* ---------------------------------------------------------------
   Exporteren
   --------------------------------------------------------------- */

export function exporteer(id) {
  const g = grid(id);
  if (!g) return;

  const rijen = gefilterdeRijen(g);
  if (!rijen.length) {
    toastFout('Er is niets te exporteren binnen deze selectie.');
    return;
  }

  const csv = naarCsv(g.definitie, g.staat, rijen);
  downloadTekst(`aizy-${g.definitie.id}.csv`, csv);
  toast(`${rijen.length} ${rijen.length === 1 ? 'rij' : 'rijen'} geëxporteerd naar CSV.`);
}

export { normaliseerStaat };

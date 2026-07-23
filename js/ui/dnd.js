/**
 * Slepen en neerzetten.
 *
 * Eén gedelegeerde implementatie voor alle sleepbare onderdelen: actiekaarten
 * tussen statuskolommen, agenda-items tussen datums, widgets op Mijn werk en
 * kolommen in een tabel.
 *
 * DRIE DINGEN DIE VAAK MISGAAN
 *
 * 1. Tekstselectie die per ongeluk een sleepactie start.
 *    Opgelost door `draggable` pas aan te zetten wanneer de aanwijzer op een
 *    sleepgreep staat. Wie tekst in een kaart selecteert, sleept dus niets.
 *
 * 2. Geen toetsenbordalternatief.
 *    Slepen is met een muis prettig en zonder muis onmogelijk. Iedere
 *    sleepbare lijst krijgt daarom knoppen of een keuzelijst die hetzelfde
 *    doet. Die knoppen staan in de views zelf, want alleen daar is bekend wat
 *    "een plek verder" betekent.
 *
 * 3. Onduidelijke doelen.
 *    Een dropzone die pas oplicht als je er al overheen bent, laat je zoeken.
 *    Zodra er iets wordt gesleept, krijgt de pagina `data-sleept` met het
 *    soort, zodat alle geldige doelen tegelijk zichtbaar worden.
 *
 * REGISTRATIE
 *   registreerSleepdoel('actie', (id, waarde, gebeurtenis) => {...})
 * Het soort koppelt sleepbare items aan hun doelen. Een actiekaart kan
 * daardoor nooit in een widgetkolom belanden.
 */

const handlers = new Map();

/**
 * Registreert wat er moet gebeuren wanneer een item van dit soort wordt
 * neergezet. Geeft een functie terug om de registratie op te heffen.
 */
export function registreerSleepdoel(soort, opDrop) {
  handlers.set(soort, opDrop);
  return () => handlers.delete(soort);
}

let bezig = null;

/** Attribuutnamen, op één plek zodat views en deze module hetzelfde gebruiken. */
export const Sleep = {
  ITEM: 'data-sleep',
  SOORT: 'data-sleep-soort',
  GREEP: 'data-sleepgreep',
  ZONE: 'data-dropzone',
  ZONE_SOORT: 'data-dropzone-soort',
};

/**
 * De attributen voor een sleepbaar item.
 * Views roepen dit aan zodat ze de namen niet hoeven te kennen.
 */
export function sleepbaar(soort, id, { label = 'Item' } = {}) {
  return `data-sleep="${id}" data-sleep-soort="${soort}" draggable="false" aria-grabbed="false" aria-label="${label}"`;
}

export function dropzone(soort, waarde, { label = '' } = {}) {
  return `data-dropzone="${waarde}" data-dropzone-soort="${soort}"${label ? ` aria-label="${label}"` : ''}`;
}

/**
 * Koppelt de sleepafhandeling aan het document.
 * Wordt één keer aangeroepen bij het opstarten; een volledige hertekening van
 * het scherm heeft daardoor geen invloed op het slepen.
 */
export function bindSlepen() {
  // Slepen begint alleen bij een greep. Zonder deze stap zou het selecteren van
  // tekst in een kaart een sleepactie starten.
  document.addEventListener('pointerdown', (e) => {
    const greep = e.target.closest(`[${Sleep.GREEP}]`);
    const item = greep?.closest(`[${Sleep.ITEM}]`);
    if (item) item.setAttribute('draggable', 'true');
  });

  document.addEventListener('pointerup', () => {
    document.querySelectorAll(`[${Sleep.ITEM}][draggable="true"]`)
      .forEach((el) => el.setAttribute('draggable', 'false'));
  });

  document.addEventListener('dragstart', (e) => {
    const item = e.target.closest?.(`[${Sleep.ITEM}]`);
    if (!item || item.getAttribute('draggable') !== 'true') {
      // Een element dat niet via zijn greep is opgepakt, sleept niet mee.
      if (item) e.preventDefault();
      return;
    }

    bezig = {
      id: item.getAttribute(Sleep.ITEM),
      soort: item.getAttribute(Sleep.SOORT),
    };
    item.classList.add('wordt-gesleept');
    item.setAttribute('aria-grabbed', 'true');
    document.body.dataset.sleept = bezig.soort;

    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', bezig.id);
    } catch {
      // Sommige browsers weigeren setData buiten een echte sleepactie.
    }
  });

  document.addEventListener('dragend', () => {
    document.querySelectorAll('.wordt-gesleept').forEach((el) => {
      el.classList.remove('wordt-gesleept');
      el.setAttribute('aria-grabbed', 'false');
      el.setAttribute('draggable', 'false');
    });
    document.querySelectorAll('.is-dropdoel').forEach((el) => el.classList.remove('is-dropdoel'));
    delete document.body.dataset.sleept;
    bezig = null;
  });

  document.addEventListener('dragover', (e) => {
    if (!bezig) return;
    const zone = e.target.closest?.(`[${Sleep.ZONE}]`);
    if (!zone || zone.getAttribute(Sleep.ZONE_SOORT) !== bezig.soort) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!zone.classList.contains('is-dropdoel')) zone.classList.add('is-dropdoel');
  });

  document.addEventListener('dragleave', (e) => {
    const zone = e.target.closest?.(`[${Sleep.ZONE}]`);
    // Alleen weghalen wanneer de aanwijzer de zone echt verlaat en niet naar een
    // kind erbinnen beweegt.
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('is-dropdoel');
  });

  document.addEventListener('drop', (e) => {
    if (!bezig) return;
    const zone = e.target.closest?.(`[${Sleep.ZONE}]`);
    if (!zone || zone.getAttribute(Sleep.ZONE_SOORT) !== bezig.soort) return;

    e.preventDefault();
    const handler = handlers.get(bezig.soort);
    const waarde = zone.getAttribute(Sleep.ZONE);
    const id = bezig.id;
    zone.classList.remove('is-dropdoel');

    if (handler) handler(id, waarde, e);
  });
}

/* ---------------------------------------------------------------
   Kolombreedte
   --------------------------------------------------------------- */

/**
 * Laat een kolom in breedte aanpassen met de muis of met de pijltoetsen.
 *
 * @param {(kolom: string, breedte: number, grid: string) => void} opWijziging
 */
export function bindKolombreedte(opWijziging) {
  let sleep = null;

  document.addEventListener('pointerdown', (e) => {
    const greep = e.target.closest('[data-grid-breedte]');
    if (!greep) return;
    const cel = greep.closest('th');
    if (!cel) return;

    e.preventDefault();
    sleep = {
      grid: greep.getAttribute('data-grid-breedte'),
      kolom: greep.getAttribute('data-kolom'),
      startX: e.clientX,
      startBreedte: cel.getBoundingClientRect().width,
      cel,
    };
    greep.setPointerCapture?.(e.pointerId);
    document.body.classList.add('bezig-met-breedte');
  });

  document.addEventListener('pointermove', (e) => {
    if (!sleep) return;
    const breedte = Math.max(72, Math.round(sleep.startBreedte + (e.clientX - sleep.startX)));
    sleep.cel.style.width = `${breedte}px`;
    sleep.laatste = breedte;
  });

  document.addEventListener('pointerup', () => {
    if (!sleep) return;
    document.body.classList.remove('bezig-met-breedte');
    if (sleep.laatste) opWijziging(sleep.kolom, sleep.laatste, sleep.grid);
    sleep = null;
  });

  // Het toetsenbordalternatief: de greep heeft focus en de pijltoetsen wijzigen
  // de breedte in stappen van zestien pixels.
  document.addEventListener('keydown', (e) => {
    const greep = e.target.closest?.('[data-grid-breedte]');
    if (!greep) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    e.preventDefault();
    const cel = greep.closest('th');
    const huidig = cel.getBoundingClientRect().width;
    const breedte = Math.max(72, Math.round(huidig + (e.key === 'ArrowRight' ? 16 : -16)));
    opWijziging(greep.getAttribute('data-kolom'), breedte, greep.getAttribute('data-grid-breedte'));
  });
}

/* ---------------------------------------------------------------
   Kolomvolgorde
   --------------------------------------------------------------- */

/**
 * Slepen binnen de kolomkiezer.
 * Aparte afhandeling omdat een lijstitem tussen twee andere wordt ingevoegd in
 * plaats van in een zone te belanden.
 *
 * @param {(grid: string, kolom: string, doelKolom: string) => void} opWijziging
 */
export function bindKolomvolgorde(opWijziging) {
  let bron = null;

  document.addEventListener('dragstart', (e) => {
    const rij = e.target.closest?.('.kolomrij');
    if (!rij) return;
    bron = { grid: rij.getAttribute('data-grid'), kolom: rij.getAttribute('data-kolom') };
    rij.classList.add('wordt-gesleept');
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', bron.kolom);
    } catch {
      // Zie bindSlepen.
    }
  });

  document.addEventListener('dragover', (e) => {
    if (!bron) return;
    const rij = e.target.closest?.('.kolomrij');
    if (!rij || rij.getAttribute('data-grid') !== bron.grid) return;
    e.preventDefault();
    rij.classList.add('is-dropdoel');
  });

  document.addEventListener('dragleave', (e) => {
    const rij = e.target.closest?.('.kolomrij');
    if (rij && !rij.contains(e.relatedTarget)) rij.classList.remove('is-dropdoel');
  });

  document.addEventListener('drop', (e) => {
    if (!bron) return;
    const rij = e.target.closest?.('.kolomrij');
    if (!rij || rij.getAttribute('data-grid') !== bron.grid) return;
    e.preventDefault();
    rij.classList.remove('is-dropdoel');
    const doel = rij.getAttribute('data-kolom');
    if (doel !== bron.kolom) opWijziging(bron.grid, bron.kolom, doel);
    bron = null;
  });

  document.addEventListener('dragend', () => {
    document.querySelectorAll('.kolomrij.wordt-gesleept').forEach((el) => el.classList.remove('wordt-gesleept'));
    document.querySelectorAll('.kolomrij.is-dropdoel').forEach((el) => el.classList.remove('is-dropdoel'));
    bron = null;
  });
}

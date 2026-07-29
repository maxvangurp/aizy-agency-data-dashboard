/**
 * Kleine CSV-export voor de simpele modus.
 *
 * Bewust minimaal: bouwt een CSV-string uit kolomkoppen + rijen en start een
 * download in de browser. Geen afhankelijkheid van het zware full-system grid.
 * Getallen worden als ruwe waarde geëxporteerd (niet opgemaakt), zodat het
 * bestand direct in een spreadsheet te analyseren is.
 */

/** Zet één veld veilig om naar een CSV-cel (quotet waar nodig, Excel-vriendelijk). */
function cel(waarde) {
  const s = waarde == null ? '' : String(waarde);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Bouwt een CSV-string.
 * @param {string[]} kolommen  kolomkoppen
 * @param {(string|number|null)[][]} rijen  ruwe waarden per rij
 */
export function naarCsv(kolommen, rijen) {
  return csvVanRijen([kolommen, ...rijen]);
}

/**
 * Bouwt een CSV uit een lijst rijen (elk een array cellen). Handig voor een
 * export met meerdere secties (een sectiekop is dan één-cel-rij, een lege rij is
 * `['']`).
 */
export function csvVanRijen(rijen) {
  // BOM zodat Excel de UTF-8-tekens (€, ë) goed leest.
  return `﻿${rijen.map((rij) => rij.map(cel).join(';')).join('\r\n')}`;
}

/** Start een download van een CSV-string onder de gegeven bestandsnaam. */
export function downloadCsv(bestandsnaam, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam.endsWith('.csv') ? bestandsnaam : `${bestandsnaam}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

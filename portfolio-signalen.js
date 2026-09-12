/**
 * Wat er bij een klant aan de hand is, afgeleid uit `blended_kpis()` en het
 * conversieoordeel.
 *
 * Losgetrokken uit `server.js` om dezelfde reden als `ads-query.js`: dit is
 * beslislogica -- welk signaal wel en niet, en hoe zwaar -- en die hoort
 * toetsbaar te zijn zonder dat er een Supabase en een browser bij moeten. Het
 * endpoint eromheen doet alleen nog I/O en sorteren.
 *
 * Geen score. Een getal van 0 tot 100 verbergt waaróm een klant bovenaan staat,
 * en dan gaat iemand het getal vertrouwen in plaats van de reden.
 */

/**
 * Wat er aan de hand is bij deze klant, met het bewijs erbij.
 *
 * De volgorde is niet willekeurig. Bovenaan staat wat het sturen onmogelijk
 * maakt (je kunt niet optimaliseren op een maat die niets meet), daarna wat
 * geld kost, daarna wat verandert. Een klant zonder signalen krijgt er geen:
 * een lege lijst is een antwoord.
 */
function signalenVoor(nu, vorig, oordelen) {
  const signalen = [];
  const spend = Number(nu.spend ?? 0);
  const results = Number(nu.conversions_primary ?? 0);

  // 0. Telt dit cijfer dezelfde aankoop twee keer?
  //
  // Google en Meta claimen allebei dezelfde conversie zodra iemand een
  // Instagram-advertentie ziet, later op de merknaam zoekt en dan pas koopt.
  // Elk platform meet zijn eigen bijdrage en doet dat terecht; ze optellen is
  // de fout. Gevolg: de conversieteller is een bovengrens, dus CPA een
  // ondergrens en ROAS een bovengrens -- het ziet er rendabeler uit dan het is.
  //
  // Niet wegrekenen. Elke correctiefactor die je hier kiest is verzonnen, en
  // een verzonnen correctie is erger dan een zichtbare fout: die laatste
  // corrigeert iemand nog. Zodra GA4 als neutrale noemer meedoet, kan het wel.
  //
  // `conversions_double_claimed` komt uit migratie 018. Draait die nog niet,
  // dan is het veld `undefined` en staat er niets -- geen melding is hier het
  // juiste gedrag, want dan is er niets vastgesteld.
  if (nu.conversions_double_claimed === true) {
    const platforms = (nu.claiming_platforms ?? []).join(' en ') || 'meer dan één platform';
    signalen.push({
      code: 'conversies_dubbel_geclaimd',
      ernst: 'midden',
      tekst: 'Conversies opgeteld over platforms',
      detail: `${platforms} claimen allebei conversies in deze periode. Die zijn hier `
        + 'opgeteld, terwijl ze dezelfde aankoop kunnen zijn. Lees het aantal als een '
        + 'bovengrens: de werkelijke CPA ligt hoger en de ROAS lager.',
    });
  }

  // 1. Kun je hier überhaupt op sturen?
  const kapot = new Set(oordelen.flatMap((o) => o.unreliable_kpis ?? []));
  const stuurmaat = ['cpl', 'cpa'].filter((k) => kapot.has(k));
  if (stuurmaat.length) {
    const reden = oordelen
      .flatMap((o) => o.findings ?? [])
      .filter((b) => b.ernst === 'hoog')[0]?.tekst ?? null;
    signalen.push({
      code: 'niet_stuurbaar',
      ernst: 'hoog',
      // Kort genoeg om in een tabelcel te scannen; de uitleg zit in `detail`.
      tekst: 'Conversiemeting stuurt nergens op',
      detail: reden ?? 'De kolom Conversions meet niet waarop geboden wordt.',
    });
  } else if (spend > 0 && results === 0) {
    // 2. Wel meetbaar, en toch niets. Dat is iets anders dan niet kunnen meten.
    signalen.push({
      code: 'geen_resultaat',
      ernst: 'hoog',
      tekst: 'Geld uit, niets gemeten',
      detail: 'Uitgaven zonder één gemeten conversie in deze periode.',
    });
  }

  // 3. Duurder geworden. Alleen zeggen waar de maat iets betekent, anders
  //    vergelijk je twee getallen die allebei niets zeggen.
  const cpaNu = Number(nu.cpa ?? 0);
  const cpaVorig = Number(vorig?.cpa ?? 0);
  if (!stuurmaat.length && cpaNu > 0 && cpaVorig > 0) {
    const verschil = ((cpaNu - cpaVorig) / cpaVorig) * 100;
    if (Math.abs(verschil) >= 25) {
      signalen.push({
        code: verschil > 0 ? 'duurder' : 'goedkoper',
        ernst: verschil > 0 ? 'midden' : 'laag',
        tekst: `Kosten per conversie ${verschil > 0 ? '+' : '−'}${Math.abs(verschil).toFixed(0)}%`,
        detail: `Van ${euro(cpaVorig)} naar ${euro(cpaNu)}.`,
      });
    }
  }

  // 4. Het budget is grotendeels weggevallen. Dat is zelden bedoeld, en het
  //    valt nergens anders op: een klant die niets uitgeeft maakt geen lawaai.
  const spendVorig = Number(vorig?.spend ?? 0);
  if (spendVorig > 0) {
    const verschil = ((spend - spendVorig) / spendVorig) * 100;
    if (verschil <= -50) {
      signalen.push({
        code: 'budget_weggevallen',
        ernst: 'midden',
        tekst: `Budget −${Math.abs(verschil).toFixed(0)}%`,
        detail: `Van ${euro(spendVorig)} naar ${euro(spend)}.`,
      });
    } else if (verschil >= 50) {
      signalen.push({
        code: 'budget_gestegen',
        ernst: 'laag',
        tekst: `Budget +${verschil.toFixed(0)}%`,
        detail: `Van ${euro(spendVorig)} naar ${euro(spend)}.`,
      });
    }
  }

  // 5. Gaten in de data. Geen bevinding over de klant maar over onszelf: een
  //    oordeel over dertig dagen waarvan er tien ontbreken is geen oordeel.
  const gedekt = Number(nu.covered_days ?? 0);
  const gevraagd = Number(nu.requested_days ?? 0);
  if (gevraagd > 0 && gedekt < gevraagd * 0.9) {
    signalen.push({
      code: 'gaten_in_data',
      ernst: 'midden',
      tekst: `${gedekt} van ${gevraagd} dagen`,
      detail: 'De vergelijking en de gemiddelden hieronder zijn daarmee onvolledig.',
    });
  }

  return signalen;
}

const euroFormat = new Intl.NumberFormat('nl-NL', {style: 'currency', currency: 'EUR', maximumFractionDigits: 2});
const euro = (v) => euroFormat.format(Number(v) || 0);

/** Zwaarte als getal, zodat er op gesorteerd kan worden. */
const ERNST_VOLGORDE = {hoog: 3, midden: 2, laag: 1};

/** De zwaarte van het zwaarste signaal, of 0 bij geen enkel signaal. */
function zwaarste(signalen) {
  return Math.max(0, ...(signalen ?? []).map((s) => ERNST_VOLGORDE[s.ernst] ?? 0));
}

module.exports = {signalenVoor, ERNST_VOLGORDE, zwaarste};

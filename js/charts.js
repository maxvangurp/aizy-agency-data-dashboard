/**
 * Visualisatielaag.
 *
 * De categorische reekskleuren zijn gevalideerd op kleurenblindheid
 * (protanopie en deuteranopie, Machado 2009) tegen beide themaoppervlakken.
 * Licht en donker zijn afzonderlijk gekozen, geen automatische omkering.
 *
 * Lichte modus:  alle zes controles geslaagd, contrastwaarschuwing op drie
 *                slots. Die waarschuwing wordt opgeheven doordat elke grafiek
 *                een tabelweergave heeft en directe labels toont.
 * Donkere modus: alle zes controles geslaagd zonder waarschuwing.
 */

/* Categorische reeksen. Vaste volgorde, nooit doorgerouleerd. */
const SERIES_LIGHT = ['#6935CC', '#eb6834', '#1baf7a', '#eda100', '#FF47D8', '#008300', '#2a78d6', '#e34948'];
const SERIES_DARK = ['#8b6ae0', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#3987e5', '#cc4444'];

/* Ordinale ramp voor de funnel. Stappen hebben een volgorde, dus een hue
   met oplopende donkerte in plaats van acht losse kleuren. */
const FUNNEL_LIGHT = ['#d9c9f5', '#b99ceb', '#9a6fe0', '#7c47d1', '#5623b3'];
const FUNNEL_DARK = ['#4a2f80', '#5f3d9e', '#7550bd', '#8b6ae0', '#a68af0'];

/* Statuskleuren. Gereserveerd, nooit hergebruikt als reeks. */
const STATUS = {
  light: { goed: '#1f7a00', waarschuwing: '#96590a', ernstig: '#c2410c', kritiek: '#a30000' },
  dark: { goed: '#6cd94a', waarschuwing: '#ffc978', ernstig: '#f0925a', kritiek: '#ff8b8b' },
};

const registry = new Map();

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function palette() {
  const dark = isDark();
  return {
    series: dark ? SERIES_DARK : SERIES_LIGHT,
    funnel: dark ? FUNNEL_DARK : FUNNEL_LIGHT,
    status: dark ? STATUS.dark : STATUS.light,
    ink: dark ? '#f4f2fa' : '#160d27',
    inkMuted: dark ? '#b3accb' : '#5b5570',
    grid: dark ? 'rgba(255,255,255,0.10)' : 'rgba(22,13,39,0.08)',
    surface: dark ? '#1a1030' : '#ffffff',
  };
}

/** Vernietigt een bestaande grafiek voordat er een nieuwe op hetzelfde canvas komt. */
export function destroyChart(id) {
  const existing = registry.get(id);
  if (existing) {
    existing.destroy();
    registry.delete(id);
  }
}

export function destroyAllCharts() {
  for (const chart of registry.values()) chart.destroy();
  registry.clear();
}

function baseOptions(p, { stacked = false, horizontal = false, valueFormatter } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'start',
        labels: {
          color: p.inkMuted,
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: p.surface,
        titleColor: p.ink,
        bodyColor: p.inkMuted,
        borderColor: p.grid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
        bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
        callbacks: valueFormatter
          ? { label: (ctx) => ` ${ctx.dataset.label}: ${valueFormatter(ctx.parsed[horizontal ? 'x' : 'y'])}` }
          : undefined,
      },
    },
    scales: buildScales(p, { stacked, horizontal, valueFormatter }),
  };
}

/**
 * Bij een horizontale staaf is x de waarde-as en y de categorie-as.
 * De waardeopmaak hoort alleen op de waarde-as, anders worden categorienamen
 * als bedragen weergegeven.
 */
function buildScales(p, { stacked, horizontal, valueFormatter }) {
  const tickFont = { family: "'Plus Jakarta Sans', sans-serif", size: 11 };

  const categorieAs = {
    stacked,
    grid: { display: false, drawBorder: false },
    ticks: { color: p.inkMuted, font: tickFont, autoSkip: false },
  };

  const waardeAs = {
    stacked,
    beginAtZero: true,
    grid: { color: p.grid, drawBorder: false },
    ticks: {
      color: p.inkMuted,
      font: tickFont,
      callback: valueFormatter
        ? function (value) {
            // Op een categorie-as geeft Chart.js een index door. Alleen echte
            // getallen op de waarde-as worden opgemaakt.
            return typeof value === 'number' ? valueFormatter(value) : value;
          }
        : undefined,
    },
  };

  return horizontal
    ? { x: waardeAs, y: categorieAs }
    : { x: categorieAs, y: waardeAs };
}

function create(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof window.Chart === 'undefined') return null;
  destroyChart(canvasId);
  const chart = new window.Chart(canvas, config);
  registry.set(canvasId, chart);
  return chart;
}

/* ---------------------------------------------------------------
   Grafiektypen
   --------------------------------------------------------------- */

/** Lijn: ontwikkeling van een of meer reeksen over tijd. */
export function lineChart(canvasId, { labels, series, valueFormatter }) {
  const p = palette();
  return create(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.data,
        borderColor: p.series[i],
        backgroundColor: p.series[i],
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: p.series[i],
        pointBorderColor: p.surface,
        pointBorderWidth: 2,
        tension: 0.3,
        fill: false,
      })),
    },
    options: baseOptions(p, { valueFormatter }),
  });
}

/** Staaf: vergelijking van categorieën. Eén reeks krijgt slot 1, geen legenda. */
export function barChart(canvasId, { labels, series, horizontal = false, stacked = false, valueFormatter }) {
  const p = palette();
  const options = baseOptions(p, { horizontal, stacked, valueFormatter });
  if (series.length === 1) options.plugins.legend.display = false;

  return create(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.data,
        backgroundColor: s.colors ?? p.series[i],
        borderRadius: 4,
        borderSkipped: false,
        // 2px tussenruimte tussen aangrenzende vlakken
        borderColor: p.surface,
        borderWidth: stacked ? 2 : 0,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      })),
    },
    options,
  });
}

/** Funnel: ordinale stappen, één hue met oplopende donkerte. */
export function funnelChart(canvasId, { stappen, valueFormatter }) {
  const p = palette();
  const options = baseOptions(p, { horizontal: true, valueFormatter });
  options.plugins.legend.display = false;
  options.plugins.tooltip.callbacks = {
    label: (ctx) => {
      const stap = stappen[ctx.dataIndex];
      return [
        ` Volume: ${valueFormatter ? valueFormatter(stap.volume) : stap.volume}`,
        ` Doorstroom: ${stap.doorstroom.toFixed(1)} procent`,
        ` Uitval: ${valueFormatter ? valueFormatter(stap.uitval) : stap.uitval}`,
      ];
    },
  };

  return create(canvasId, {
    type: 'bar',
    data: {
      labels: stappen.map((s) => s.label),
      datasets: [{
        label: 'Volume',
        data: stappen.map((s) => s.volume),
        backgroundColor: stappen.map((_, i) => p.funnel[i % p.funnel.length]),
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.8,
      }],
    },
    options,
  });
}

/** Donut: verdeling van een geheel over enkele categorieën. */
export function donutChart(canvasId, { labels, data, colors, valueFormatter }) {
  const p = palette();
  return create(canvasId, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors ?? p.series.slice(0, labels.length),
        borderColor: p.surface,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: p.inkMuted,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: p.surface,
          titleColor: p.ink,
          bodyColor: p.inkMuted,
          borderColor: p.grid,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: valueFormatter
            ? { label: (ctx) => ` ${ctx.label}: ${valueFormatter(ctx.parsed)}` }
            : undefined,
        },
      },
    },
  });
}

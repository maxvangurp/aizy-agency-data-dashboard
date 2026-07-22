/**
 * Centrale datalaag voor het Aizy Agency Data Dashboard.
 *
 * Doel:
 * 1. Nooit een rauwe response.json() aanroepen op een antwoord dat geen JSON is.
 *    Op GitHub Pages bestaat er geen backend en levert /api/... de index.html op.
 *    Zonder controle breekt dat met "Unexpected token '<'".
 * 2. Demodata en live data strikt gescheiden houden.
 * 3. Iedere aanroep geeft een voorspelbaar resultaat met een expliciete status.
 */

export const DataMode = {
  SAMPLE: 'sample',
  LIVE: 'live',
};

export const DataStatus = {
  SAMPLE: 'sample',
  LIVE: 'live',
  EMPTY: 'empty',
  ERROR: 'error',
  LOADING: 'loading',
  PARTIAL: 'partial',
};

const MODE_STORAGE_KEY = 'aizy.dataMode';

/**
 * Bepaalt of er een backend beschikbaar is.
 * GitHub Pages serveert statische bestanden en heeft geen Node-server.
 */
export function hasBackend() {
  const { protocol, hostname } = window.location;
  if (protocol === 'file:') return false;
  if (hostname.endsWith('github.io')) return false;
  return true;
}

export function getDataMode() {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === DataMode.LIVE || stored === DataMode.SAMPLE) return stored;
  // Zonder backend is live data per definitie onmogelijk.
  return hasBackend() ? DataMode.SAMPLE : DataMode.SAMPLE;
}

export function setDataMode(mode) {
  if (mode !== DataMode.LIVE && mode !== DataMode.SAMPLE) {
    throw new Error(`Onbekende datamodus: ${mode}`);
  }
  localStorage.setItem(MODE_STORAGE_KEY, mode);
}

export function isSampleMode() {
  return getDataMode() === DataMode.SAMPLE;
}

/**
 * Resultaatobject dat door de hele applicatie wordt gebruikt.
 */
function result(status, { data = null, message = '', source = null, httpStatus = null } = {}) {
  return { status, data, message, source, httpStatus };
}

/**
 * Veilige JSON-fetch.
 *
 * Geeft altijd een result-object terug en werpt nooit een exception,
 * zodat er geen unhandled promise rejection kan ontstaan.
 */
export async function safeFetchJson(url, options = {}) {
  const { timeoutMs = 15000, ...fetchOptions } = options;

  if (!hasBackend()) {
    return result(DataStatus.ERROR, {
      message: 'Deze versie draait zonder backend. Schakel over naar demodata.',
      source: url,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    if (error && error.name === 'AbortError') {
      return result(DataStatus.ERROR, {
        message: `De server reageerde niet binnen ${Math.round(timeoutMs / 1000)} seconden.`,
        source: url,
      });
    }
    return result(DataStatus.ERROR, {
      message: 'Geen verbinding met de server. Draait de lokale server nog?',
      source: url,
    });
  }
  clearTimeout(timer);

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const looksLikeJson = contentType.includes('application/json');

  // Antwoord is HTML. Dit gebeurt wanneer een statische host de index.html
  // teruggeeft voor een API-pad. Nooit proberen te parsen.
  if (!looksLikeJson) {
    const preview = await response.text().catch(() => '');
    const isHtml = preview.trim().startsWith('<');
    return result(DataStatus.ERROR, {
      httpStatus: response.status,
      source: url,
      message: isHtml
        ? 'De server gaf een webpagina terug in plaats van data. Er is hier geen actieve API beschikbaar.'
        : `Onverwacht antwoordtype van de server: ${contentType || 'onbekend'}.`,
    });
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    return result(DataStatus.ERROR, {
      httpStatus: response.status,
      source: url,
      message: 'De server gaf ongeldige data terug.',
    });
  }

  if (!response.ok) {
    return result(DataStatus.ERROR, {
      httpStatus: response.status,
      source: url,
      message: payload?.message || payload?.error || `De server gaf status ${response.status}.`,
    });
  }

  const isEmpty =
    payload === null ||
    (Array.isArray(payload) && payload.length === 0) ||
    (typeof payload === 'object' && Object.keys(payload).length === 0);

  if (isEmpty) {
    return result(DataStatus.EMPTY, {
      data: payload,
      source: url,
      message: 'Geen data beschikbaar voor deze selectie.',
    });
  }

  return result(DataStatus.LIVE, { data: payload, source: url, httpStatus: response.status });
}

/**
 * Haalt data op volgens de actieve modus.
 *
 * In demomodus wordt er geen enkel netwerkverzoek gedaan.
 * In live modus wordt er nooit stilzwijgend teruggevallen op demodata.
 */
export async function fetchResource(url, sampleLoader) {
  if (isSampleMode()) {
    const data = typeof sampleLoader === 'function' ? await sampleLoader() : sampleLoader;
    if (data == null) {
      return result(DataStatus.EMPTY, { message: 'Geen demodata beschikbaar voor dit onderdeel.' });
    }
    return result(DataStatus.SAMPLE, {
      data,
      source: 'demodata',
      message: 'Je bekijkt demodata. Schakel over naar live data voor werkelijke cijfers.',
    });
  }
  return safeFetchJson(url);
}

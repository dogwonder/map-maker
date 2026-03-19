/**
 * MapMaker — lightweight utility for generating styled static maps
 *
 * Dependencies (load before this script):
 *   - Leaflet 1.8+
 *   - MapLibre GL JS 2.x+
 *   - maplibre-gl-leaflet connector
 *
 * Usage:
 *   const map = mapmaker.create('#map', {
 *     lat: 51.5072,
 *     lng: -0.1276,
 *     zoom: 15,
 *     style: '/path/to/toner.json',       // or 'full' for toner-full.json
 *     aspectRatio: '16 / 9',
 *     interactive: false,
 *     colors: { background: '#f0e6d3', water: '#a8b8c8' },
 *     marker: { show: true, svg: '…', size: [50, 50] },
 *     onClick: (latlng) => { … }
 *   });
 */

const mapmaker = (() => {
  // ── Default colour palette ──────────────────────────────────────────
  // Keys map to layer IDs in toner.json.  Values are plain CSS colour
  // strings (hex, hsl, rgb — anything MapLibre accepts).
  const DEFAULT_COLORS = {
    background:  'hsl(100, 20%, 86%)',
    urban:       'hsl(30, 20%, 85%)',        // warm grey — residential, commercial, industrial
    countryside: 'hsl(100, 20%, 86%)',       // light green — farmland, scrub, wetland
    parks:       'hsl(116, 32%, 78%)',       // mid green  — grass, parks, nature reserves
    woodland:    'hsl(116, 28%, 72%)',       // dark green — woods, forest
    building:    'hsl(30, 10%, 82%)',        // light warm grey — buildings
    water:       'hsl(208, 18%, 73%)',
    road:        'hsl(0, 0%, 100%)',
    railway:     'hsl(180, 1%, 77%)',
  };

  // Default font stacks — MapTiler serves Noto Sans via their glyphs endpoint
  const DEFAULT_FONTS = {
    regular: ['Noto Sans Regular'],
    bold:    ['Noto Sans Bold', 'Noto Sans Regular'],
    italic:  ['Noto Sans Italic', 'Noto Sans Regular'],
  };

  // Which label layers use which font weight
  const FONT_LAYER_MAP = {
    regular: ['Place labels', 'Village labels', 'State labels'],
    bold:    ['Road labels', 'Town labels', 'City labels', 'Country labels', 'Continent labels'],
    italic:  ['River labels', 'Lakeline labels', 'Sea labels', 'Lake labels', 'Ocean labels', 'Park labels'],
  };

  // Which style‑layer IDs each palette key affects
  const COLOR_LAYER_MAP = {
    background: [
      { layer: 'Background', prop: 'background-color' },
    ],
    urban: [
      { layer: 'Urban', prop: 'fill-color', zoom: true },
    ],
    countryside: [
      { layer: 'Countryside', prop: 'fill-color', zoom: true },
      { layer: 'Scrub',       prop: 'fill-color', zoom: true },
      { layer: 'Wetland',     prop: 'fill-color', zoom: true },
    ],
    parks: [
      { layer: 'Grass',  prop: 'fill-color', zoom: true },
      { layer: 'Park',   prop: 'fill-color', zoom: true },
    ],
    woodland: [
      { layer: 'Wood',   prop: 'fill-color', zoom: true },
      { layer: 'Forest', prop: 'fill-color', zoom: true },
    ],
    building: [
      { layer: 'Building', prop: 'fill-color' },
    ],
    water: [
      { layer: 'Water',  prop: 'fill-color' },
      { layer: 'River',  prop: 'line-color' },
    ],
    road: [
      { layer: 'Road network', prop: 'line-color', zoom: true },
    ],
    railway: [
      { layer: 'Railway', prop: 'line-color' },
    ],
  };

  // Grouped layers for UI toggles.
  // `on` = default visibility when the map loads.
  const LAYER_GROUPS = {
    'Terrain':     { layers: ['Hillshade'],                                         on: true },
    'Urban':       { layers: ['Urban'],                                            on: true },
    'Countryside': { layers: ['Countryside', 'Scrub', 'Wetland'],                 on: true },
    'Parks':       { layers: ['Grass', 'Park'],                                  on: true },
    'Woodland':    { layers: ['Wood', 'Forest'],                                 on: true },
    'Cemetery':   { layers: ['Cemetery', 'Cemetery pattern'],                  on: false },
    'Water':      { layers: ['Water', 'River'],                                on: true },
    'Bridges':    { layers: ['Bridge', 'Pier'],                                on: true },
    'Paths':      { layers: ['Path', 'Path minor'],                            on: true },
    'Roads':      { layers: ['Road network'],                                  on: true },
    'Railway':    { layers: ['Railway', 'Railway hatching'],                   on: true },
    'Buildings':  { layers: ['Building', 'Building pattern'],                  on: false },
    'Borders':    { layers: ['Country border', 'Disputed border', 'Other border'], on: false },
    'Labels':     { layers: ['Place labels', 'Village labels', 'Town labels', 'City labels', 'State labels', 'Country labels', 'Continent labels'], on: true },
    'Road labels':  { layers: ['Road labels'],                                 on: false },
    'Park labels':  { layers: ['Park labels'],                                 on: false },
    'Water labels': { layers: ['River labels', 'Lakeline labels', 'Sea labels', 'Lake labels', 'Ocean labels'], on: false },
  };

  // Default marker SVG (pin icon)
  const DEFAULT_MARKER_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M352 348.4C416.1 333.9 464 276.5 464 208C464 128.5 399.5 64 320 64C240.5 64 176 128.5 176 208C176 276.5 223.9 333.9 288 348.4L288 544C288 561.7 302.3 576 320 576C337.7 576 352 561.7 352 544L352 348.4zM328 160C297.1 160 272 185.1 272 216C272 229.3 261.3 240 248 240C234.7 240 224 229.3 224 216C224 158.6 270.6 112 328 112C341.3 112 352 122.7 352 136C352 149.3 341.3 160 328 160z"/></svg>`;

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Deep-clone a style JSON and apply colour and font overrides.
   */
  function applyStyle(style, colors, fonts) {
    const patched      = JSON.parse(JSON.stringify(style));
    const mergedColors = { ...DEFAULT_COLORS, ...colors };
    const mergedFonts  = { ...DEFAULT_FONTS, ...fonts };

    // Apply colours
    for (const [key, value] of Object.entries(mergedColors)) {
      const targets = COLOR_LAYER_MAP[key];
      if (!targets) continue;

      for (const { layer: layerId, prop, zoom } of targets) {
        const layer = patched.layers.find((l) => l.id === layerId);
        if (!layer) continue;

        if (zoom) {
          const current = layer.paint[prop];
          if (Array.isArray(current) && current[0] === 'interpolate') {
            for (let i = 4; i < current.length; i += 2) {
              current[i] = value;
            }
          } else {
            layer.paint[prop] = value;
          }
        } else {
          layer.paint[prop] = value;
        }
      }
    }

    // Apply fonts
    for (const [weight, fontStack] of Object.entries(mergedFonts)) {
      const layerIds = FONT_LAYER_MAP[weight];
      if (!layerIds) continue;
      for (const layerId of layerIds) {
        const layer = patched.layers.find((l) => l.id === layerId);
        if (layer && layer.layout) {
          layer.layout['text-font'] = fontStack;
        }
      }
    }

    return patched;
  }

  /**
   * Resolve a container argument to an element.
   */
  function resolveContainer(el) {
    if (typeof el === 'string') return document.querySelector(el);
    return el;
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Create a map instance.
   *
   * @param {string|HTMLElement} container  CSS selector or DOM element
   * @param {Object}            opts
   * @param {number}             opts.lat          Latitude  (default 51.5072)
   * @param {number}             opts.lng          Longitude (default -0.1276)
   * @param {number}             opts.zoom         Zoom level (default 15)
   * @param {string|Object}      opts.style        URL to style JSON, or inline style object
   * @param {string}             opts.aspectRatio  CSS aspect-ratio value (default '16 / 9')
   * @param {boolean}            opts.interactive  Allow scroll-zoom / drag (default false)
   * @param {Object}             opts.colors       Colour overrides — see DEFAULT_COLORS
   * @param {Object|false}       opts.marker       Marker config, or false to hide
   * @param {string}              opts.marker.svg   Custom SVG string
   * @param {number[]}            opts.marker.size  [width, height] in px
   * @param {string}              opts.marker.className  CSS class on the marker wrapper
   * @param {Function}           opts.onClick      Called with { lat, lng } on marker click
   * @returns {Promise<Object>}  { leaflet, maplibre, marker, setColors, destroy }
   */
  async function create(container, opts = {}) {
    const el = resolveContainer(container);
    if (!el) throw new Error(`mapmaker: container "${container}" not found`);

    const {
      lat          = 51.5072,
      lng          = -0.1276,
      zoom         = 15,
      style        = null,
      aspectRatio  = '4 / 3',
      interactive  = false,
      colors       = {},
      fonts        = {},
      marker       = false,
      onClick      = null,
    } = opts;

    // Apply container styles
    el.style.aspectRatio = aspectRatio;
    if (!el.style.width) el.style.width = '100%';

    // Load & patch style
    let styleObj;
    if (typeof style === 'object' && style !== null) {
      styleObj = style;
    } else if (typeof style === 'string') {
      const res = await fetch(style);
      styleObj  = await res.json();
    } else {
      throw new Error('mapmaker: provide a style URL or object via opts.style');
    }

    // Track current visibility state per group
    const visibilityState = {};
    for (const [name, group] of Object.entries(LAYER_GROUPS)) {
      visibilityState[name] = group.on;
    }

    function applyVisibility(style) {
      for (const [name, visible] of Object.entries(visibilityState)) {
        const group = LAYER_GROUPS[name];
        if (!group) continue;
        for (const layerId of group.layers) {
          const layer = style.layers.find((l) => l.id === layerId);
          if (layer) {
            if (!layer.layout) layer.layout = {};
            layer.layout.visibility = visible ? 'visible' : 'none';
          }
        }
      }
      return style;
    }

    const patchedStyle = applyVisibility(applyStyle(styleObj, colors, fonts));

    // Create Leaflet map
    const leafletMap = L.map(el, {
      center:             [lat, lng],
      zoom:               zoom,
      scrollWheelZoom:    interactive,
      dragging:           interactive,
      touchZoom:          interactive,
      doubleClickZoom:    interactive,
      boxZoom:            interactive,
      keyboard:           interactive,
      zoomControl:        interactive,
      attributionControl: false,
    });

    // Add MapLibre GL layer
    const glLayer = L.maplibreGL({
      style: patchedStyle,
      preserveDrawingBuffer: true,
    }).addTo(leafletMap);

    // Marker
    let leafletMarker = null;
    if (marker !== false) {
      const svg       = marker.svg  || DEFAULT_MARKER_SVG;
      const size      = marker.size || [50, 50];
      const className = marker.className || 'mapmaker-pin';

      const icon = L.divIcon({
        className,
        html:       svg,
        iconSize:   size,
        iconAnchor: [size[0] / 2, size[1] / 2],
      });

      leafletMarker = L.marker([lat, lng], { icon }).addTo(leafletMap);

      if (typeof onClick === 'function') {
        leafletMarker.on('click', () => onClick({ lat, lng }));
      }
    }

    // ── Instance methods ────────────────────────────────────────────

    /**
     * Live-update colours after creation.
     */
    let currentColors = { ...colors };
    let currentFonts  = { ...fonts };

    function setColors(newColors) {
      Object.assign(currentColors, newColors);
      const updated = applyVisibility(applyStyle(styleObj, currentColors, currentFonts));
      glLayer.getMaplibreMap().setStyle(updated);
    }

    function setFonts(newFonts) {
      Object.assign(currentFonts, newFonts);
      const updated = applyVisibility(applyStyle(styleObj, currentColors, currentFonts));
      glLayer.getMaplibreMap().setStyle(updated);
    }

    /**
     * Recenter the map.
     */
    function setView(newLat, newLng, newZoom) {
      leafletMap.setView([newLat, newLng], newZoom ?? leafletMap.getZoom());
      if (leafletMarker) leafletMarker.setLatLng([newLat, newLng]);
    }

    /**
     * Toggle a layer group or individual layer.
     * Accepts a LAYER_GROUPS key (e.g. 'Labels') or a raw layer ID.
     *
     * @param {string}  name      Group name or layer ID
     * @param {boolean} visible   true = visible, false = hidden
     */
    function toggleLayer(name, visible) {
      visibilityState[name] = visible;
      const mlMap = glLayer.getMaplibreMap();
      const group = LAYER_GROUPS[name];
      const ids   = group ? group.layers : [name];
      const vis   = visible ? 'visible' : 'none';
      for (const id of ids) {
        try { mlMap.setLayoutProperty(id, 'visibility', vis); } catch (e) { /* layer not in current style */ }
      }
    }

    /**
     * Get layer groups available in the current style.
     * Returns [{ name, on }] where `on` is the default visibility.
     */
    function getLayers() {
      const styleLayerIds = new Set(styleObj.layers.map((l) => l.id));
      return Object.entries(LAYER_GROUPS)
        .filter(([, g]) => g.layers.some((id) => styleLayerIds.has(id)))
        .map(([name, g]) => ({ name, on: g.on }));
    }

    /**
     * Export the current map view as a PNG.
     * Returns a Promise that resolves to a Blob, or triggers a download
     * if a filename is provided.
     *
     * @param {Object}  opts
     * @param {string}  opts.filename  If set, triggers a download with this name
     * @param {number}  opts.scale     Device pixel ratio for export (default 1)
     * @returns {Promise<Blob>}
     */
    function exportPNG({ filename, scale = 1 } = {}) {
      return new Promise((resolve) => {
        const mlMap    = glLayer.getMaplibreMap();
        const glCanvas = mlMap.getCanvas();

        // Create an output canvas at the container's layout size × scale
        const w = el.offsetWidth  * scale;
        const h = el.offsetHeight * scale;
        const out = document.createElement('canvas');
        out.width  = w;
        out.height = h;
        const ctx = out.getContext('2d');

        // Draw the MapLibre canvas (the base map)
        ctx.drawImage(glCanvas, 0, 0, w, h);

        // Draw the marker if present
        if (leafletMarker) {
          const markerEl = leafletMarker.getElement();
          const svgEl    = markerEl.querySelector('svg');
          if (svgEl) {
            const svgData = new XMLSerializer().serializeToString(svgEl);
            const img     = new Image();
            const blob    = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url     = URL.createObjectURL(blob);

            img.onload = () => {
              // Get marker position relative to the map container
              const markerRect = markerEl.getBoundingClientRect();
              const mapRect    = el.getBoundingClientRect();
              const mx = (markerRect.left - mapRect.left) * scale;
              const my = (markerRect.top  - mapRect.top)  * scale;
              const mw = markerRect.width  * scale;
              const mh = markerRect.height * scale;

              ctx.drawImage(img, mx, my, mw, mh);
              URL.revokeObjectURL(url);

              out.toBlob((pngBlob) => {
                if (filename) downloadBlob(pngBlob, filename);
                resolve(pngBlob);
              }, 'image/png');
            };
            img.src = url;
            return;
          }
        }

        // No marker — just export the canvas
        out.toBlob((pngBlob) => {
          if (filename) downloadBlob(pngBlob, filename);
          resolve(pngBlob);
        }, 'image/png');
      });
    }

    /**
     * Clean up.
     */
    function destroy() {
      leafletMap.remove();
    }

    return {
      leaflet:  leafletMap,
      maplibre: glLayer.getMaplibreMap(),
      marker:   leafletMarker,
      setColors,
      setFonts,
      setView,
      toggleLayer,
      getLayers,
      exportPNG,
      destroy,
    };
  }

  /**
   * Trigger a file download from a Blob.
   */
  function downloadBlob(blob, filename) {
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  // ── Expose ──────────────────────────────────────────────────────────

  return { create, DEFAULT_COLORS, DEFAULT_FONTS, COLOR_LAYER_MAP, FONT_LAYER_MAP, LAYER_GROUPS };
})();

// Support both module and script-tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = mapmaker;
}

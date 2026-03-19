# MapMaker

Lightweight JavaScript utility for generating styled static maps with customisable colours, fonts, and layer toggles. Built on Leaflet + MapLibre GL JS with MapTiler vector tiles.

## Features

- Customisable colour palette (background, urban, countryside, parks, woodland, water, roads, railway)
- Font overrides per label weight (regular, bold, italic)
- Toggleable layer groups (terrain, buildings, borders, labels, etc.)
- Optional pin marker with click handler
- PNG export at configurable resolution
- Works as a script tag or CommonJS module

## Dependencies

- [Leaflet](https://leafletjs.com/) 1.8+
- [MapLibre GL JS](https://maplibre.org/) 2.x+
- [maplibre-gl-leaflet](https://github.com/maplibre/maplibre-gl-leaflet) connector

## Usage

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.8.0/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.8.0/dist/leaflet.js"></script>
<link href="https://unpkg.com/maplibre-gl@2.2.1/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@2.2.1/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.20/leaflet-maplibre-gl.js"></script>
<script src="mapmaker.js"></script>
```

```js
const map = await mapmaker.create('#map', {
  lat: 51.5072,
  lng: -0.1276,
  zoom: 15,
  style: 'mapmaker.json',
  aspectRatio: '16 / 9',
  interactive: false,
  colors: { background: '#f0e6d3', water: '#a8b8c8' },
  marker: { size: [50, 50] },
  onClick: ({ lat, lng }) => console.log(lat, lng),
});
```

## API

`mapmaker.create(container, options)` returns a Promise resolving to:

| Method | Description |
|--------|-------------|
| `setColors({ key: value })` | Live-update palette colours |
| `setFonts({ weight: [stack] })` | Live-update font stacks |
| `setView(lat, lng, zoom?)` | Recenter the map |
| `toggleLayer(name, visible)` | Show/hide a layer group |
| `getLayers()` | Get available layer groups with default visibility |
| `exportPNG({ filename, scale })` | Export current view as PNG |
| `destroy()` | Clean up the map instance |

Properties: `leaflet`, `maplibre`, `marker`

## Running locally

No build step required. Serve the files over HTTP so `fetch` can load `mapmaker.json`:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/demo.html`.

## Demo

Open `demo.html` to see an interactive playground with live colour pickers, layer toggles, and PNG export.

## Style

`mapmaker.json` is a MapLibre style spec using MapTiler vector tiles with layers for terrain, land use, water, roads, railways, buildings, borders, and labels.

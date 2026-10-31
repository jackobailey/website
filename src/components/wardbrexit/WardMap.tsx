import { useEffect, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Map as LeafletMap, GeoJSON, Path, Polygon, PolylineOptions } from 'leaflet';
import { percentage, type Preference, type Selection, type Ward } from './data';
import { MAP_GRADIENT, LEGEND_STOPS, colourPosition, voteShareColour } from './colours';
import WardSearch from './WardSearch';
import 'leaflet/dist/leaflet.css';

export type WardTopology = Topology<{ wards: GeometryCollection<{ ward: string }> }>;
const GB_BOUNDS: [[number, number], [number, number]] = [[49.86, -8.66], [60.87, 1.77]];
const SELECTED_STYLE = { color: '#172d3b', weight: 2.5, opacity: 1, fillOpacity: 1 };
const voteShare = (ward: Ward, preference: Preference) => ward.votes.find(vote => vote[0] === preference)?.[1] ?? 0;
function fitCountry(map: LeafletMap, animate = false) {
  const narrow = map.getSize().x < 600;
  const legendBelowMap = window.matchMedia('(max-width: 800px)').matches;
  map.fitBounds(GB_BOUNDS, { paddingTopLeft: narrow ? [18, 82] : [100, 26], paddingBottomRight: narrow && !legendBelowMap ? [18, 240] : [22, 38], animate });
}

export default function WardMap({ wards, topology, selection, onSelect }: {
  wards: Ward[]; topology: WardTopology; selection: Selection;
  onSelect: (id: string, focus: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const polygons = useRef(new Map<string, Polygon>());
  const selectedLayer = useRef<Polygon | null>(null);
  const allWards = useRef<GeoJSON | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let resize: ResizeObserver | undefined;
    const byCode = new Map(wards.map(ward => [ward.id, ward]));
    void import('leaflet').then(L => {
      if (cancelled || !container.current) return;
      const instance = L.map(container.current, {
        preferCanvas: true, zoomControl: false, attributionControl: false,
        minZoom: 3, maxZoom: 15, zoomSnap: 0.1, zoomDelta: 1,
        // Repaint the vector map at its final scale rather than stretching a
        // clipped canvas during zoom. This also handles repeated wheel zooms.
        zoomAnimation: false, fadeAnimation: false,
        maxBounds: [[46, -17], [64, 10]], maxBoundsViscosity: 0.8,
      });
      map.current = instance;
      fitCountry(instance);
      const collection = feature(topology, topology.objects.wards);
      const layer = L.geoJSON(collection, {
        style: (item): PolylineOptions => {
          const ward = byCode.get(item?.properties?.ward);
          // TopoJSON already simplifies shared boundaries together. Leaflet's
          // per-polygon simplification and clipping can pull those edges apart.
          return { smoothFactor: 0, noClip: true,
            color: '#ffffff', weight: instance.getZoom() < 7 ? 0.2 : 0.65, opacity: 0.8,
            fillColor: ward ? voteShareColour(voteShare(ward, 'out')) : '#d1d7db',
            fillOpacity: 1 };
        },
        onEachFeature: (item, polygon) => {
          const ward = byCode.get(item.properties.ward);
          if (!ward) return;
          polygons.current.set(ward.id, polygon as Polygon);
          // DOM textContent keeps source ward names out of an HTML parser.
          const tooltip = document.createElement('div');
          const title = document.createElement('strong'); title.textContent = ward.name;
          const detail = document.createElement('span');
          detail.textContent = ward.pcon;
          const shares = document.createElement('span');
          shares.textContent = `Rejoin ${percentage(voteShare(ward, 'rejoin'))} · Stay out ${percentage(voteShare(ward, 'out'))}`;
          tooltip.append(title, detail, shares);
          polygon.bindTooltip(tooltip, { sticky: true, className: 'ward-tooltip', direction: 'top' });
          polygon.on('click', () => onSelect(ward.id, false));
          polygon.on('mouseover', () => { if (polygon !== selectedLayer.current) (polygon as Path).setStyle({ weight: 1.5, color: '#53636e' }); });
          polygon.on('mouseout', () => { if (polygon !== selectedLayer.current) layer.resetStyle(polygon as Path); });
        },
      }).addTo(instance);
      allWards.current = layer;
      instance.on('zoomend', () => {
        layer.setStyle({ weight: instance.getZoom() < 7 ? 0.2 : 0.65 });
        selectedLayer.current?.setStyle({ weight: 2.5 });
      });
      resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
      resize.observe(container.current);
      setReady(true);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true; resize?.disconnect(); map.current?.remove(); map.current = null;
      polygons.current.clear(); allWards.current = null; selectedLayer.current = null;
    };
  }, [wards, topology, onSelect]);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (selectedLayer.current) allWards.current?.resetStyle(selectedLayer.current);
    const polygon = polygons.current.get(selection.id);
    if (!polygon) return;
    selectedLayer.current = polygon;
    polygon.setStyle(SELECTED_STYLE).bringToFront();
    if (selection.focus) map.current.fitBounds(polygon.getBounds().pad(0.8), {
      maxZoom: 12, padding: [50, 85], animate: false,
    });
  }, [ready, selection]);

  return <section className="map-panel" aria-label="Interactive ward map">
    <div className="ward-map" ref={container} aria-label="Map of Great Britain. Drag to pan, use plus and minus to zoom. Use ward search to select with the keyboard." />
    <WardSearch wards={wards} onSelect={onSelect} />
    <div className="map-controls">
      <div className="zoom-controls">
        <button type="button" aria-label="Zoom in" disabled={!ready} onClick={() => map.current?.zoomIn()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg></button>
        <button type="button" aria-label="Zoom out" disabled={!ready} onClick={() => map.current?.zoomOut()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
      </div>
      <button type="button" className="reset-view" disabled={!ready} onClick={() => { if (map.current) fitCountry(map.current); }}>Reset view</button>
    </div>
    {!ready && <div className="map-status" role="status">{error ? <>The map could not load. You can still explore every ward using search. <button onClick={() => window.location.reload()}>Reload map</button></> : 'Drawing 7,993 ward boundaries…'}</div>}
    <div className="map-legend" aria-label="Map colouring">
      <div className="legend-heading">
        <h2>Estimated Voting Intention</h2>
      </div>
      <div className="brexit-share-scale" role="img" aria-label="Voting-intention colour scale: dark purple is 100% Rejoin, warm off-white is a 50/50 split, and coral is 100% Stay out. A gentle logistic scale emphasises differences near 50/50. Tick labels show actual shares: 100% Rejoin, 60% Rejoin, 50/50, 60% Stay out, 100% Stay out.">
        <div className="brexit-scale-directions" aria-hidden="true"><span>Rejoin the EU</span><span>Stay out of the EU</span></div>
        <div className="vote-share-gradient" style={{ background: MAP_GRADIENT }}>
          {LEGEND_STOPS.slice(1, -1).map(({ share }) => <span key={share} className={`brexit-scale-tick${share === 0.5 ? ' is-midpoint' : ''}`} style={{ left: `${colourPosition(share) * 100}%` }} />)}
        </div>
        <div className="brexit-share-labels" aria-hidden="true">{LEGEND_STOPS.map(({ share, label }) => <span key={share} style={{ left: `${colourPosition(share) * 100}%` }}>{label}</span>)}</div>
      </div>
      <p className="legend-hint">Shades emphasise differences near 50/50.</p>
    </div>
    <p className="map-attribution">2022 census ward boundaries · <a href="https://www.ons.gov.uk/methodology/geography/licences" target="_blank" rel="noreferrer">ONS / OS</a></p>
  </section>;
}

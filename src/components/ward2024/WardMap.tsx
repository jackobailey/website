import { useEffect, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Map as LeafletMap, GeoJSON, Path, Polygon, PolylineOptions } from 'leaflet';
import { PARTIES, percentage, type Party, type Selection, type Ward } from './data';
import WardSearch from './WardSearch';
import 'leaflet/dist/leaflet.css';

export type WardTopology = Topology<{ wards: GeometryCollection<{ ward: string }> }>;
const GB_BOUNDS: [[number, number], [number, number]] = [[49.86, -8.66], [60.87, 1.77]];
const SELECTED_STYLE = { color: '#172d3b', weight: 2.5, opacity: 1, fillOpacity: 1 };
// The published data omits zero-share rows. Keep the same absolute scale for
// every party: white at 0%, the party colour at 100%. A square-root transform
// gives more colour resolution to the lower shares common in multiparty races.
const voteShare = (ward: Ward, party: Party) => ward.votes.find(vote => vote[0] === party)?.[1] ?? 0;
const shareIntensity = (share: number) => Math.sqrt(share);
function voteShareColor(party: Party, share: number) {
  const channels = [1, 3, 5].map(start => parseInt(PARTIES[party].color.slice(start, start + 2), 16));
  return `rgb(${channels.map(channel => Math.round(255 + (channel - 255) * shareIntensity(share))).join(', ')})`;
}
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
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  // Leaflet callbacks outlive a render. Read the current mode without rebuilding
  // thousands of polygons or losing the user's zoom and selected ward.
  const mapParty = useRef<Party | null>(null);

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
          const party = mapParty.current;
          // TopoJSON already simplifies shared boundaries together. Leaflet's
          // per-polygon simplification and clipping can pull those edges apart.
          return { smoothFactor: 0, noClip: true,
            color: '#ffffff', weight: instance.getZoom() < 7 ? 0.2 : 0.65, opacity: 0.8,
            fillColor: ward && party ? voteShareColor(party, voteShare(ward, party))
              : ward?.leader && ward.leader !== 'tie' ? PARTIES[ward.leader].color : '#d1d7db',
            fillOpacity: party ? 1 : 0.9 };
        },
        onEachFeature: (item, polygon) => {
          const ward = byCode.get(item.properties.ward);
          if (!ward) return;
          polygons.current.set(ward.id, polygon as Polygon);
          // DOM textContent keeps source ward names out of an HTML parser.
          const tooltip = document.createElement('div');
          const title = document.createElement('strong'); title.textContent = ward.name;
          const detail = document.createElement('span');
          const updateTooltip = () => {
            const party = mapParty.current ?? ward.votes[0][0];
            detail.textContent = `${ward.pcon} · ${PARTIES[party].name} ${percentage(voteShare(ward, party))}`;
          };
          updateTooltip();
          tooltip.append(title, detail);
          polygon.bindTooltip(tooltip, { sticky: true, className: 'ward-tooltip', direction: 'top' });
          polygon.on('tooltipopen', updateTooltip);
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
    mapParty.current = selectedParty;
    if (!ready) return;
    allWards.current?.resetStyle();
    selectedLayer.current?.setStyle(SELECTED_STYLE).bringToFront();
  }, [ready, selectedParty]);

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
        <h2 aria-live="polite">{selectedParty ? `${PARTIES[selectedParty].name} Vote Share` : 'Largest Estimated Vote Share'}</h2>
        {selectedParty && <button type="button" className="text-button legend-reset" onClick={() => setSelectedParty(null)}>Show leading party</button>}
      </div>
      <ul>{Object.entries(PARTIES).map(([code, party]) => <li key={code}>
        <button type="button" className="legend-party" aria-pressed={selectedParty === code} disabled={!ready}
          onClick={() => setSelectedParty(current => current === code ? null : code as Party)}>
          <span className="legend-swatch" style={{ backgroundColor: party.color }} aria-hidden="true" />{party.name}
        </button>
      </li>)}{!selectedParty && wards.some(ward => ward.leader === 'tie') && <li className="legend-tie"><span className="legend-swatch" style={{ backgroundColor: '#d1d7db' }} />Tie</li>}</ul>
      {selectedParty ? <div className="vote-share-scale" aria-label="Estimated vote share on a square-root scale: white is 0%, full party colour is 100%">
        <div className="vote-share-gradient" style={{ background: `linear-gradient(to right, #ffffff, ${PARTIES[selectedParty].color})` }} />
        <div className="vote-share-ticks">{[0, 10, 25, 50, 100].map(value => <span key={value} style={{ left: `${shareIntensity(value / 100) * 100}%` }}>{value}%</span>)}</div>
      </div> : <p className="legend-hint">Select a party to map its vote share.</p>}
    </div>
    <p className="map-attribution">2022 census ward boundaries · <a href="https://www.ons.gov.uk/methodology/geography/licences" target="_blank" rel="noreferrer">ONS / OS</a></p>
  </section>;
}

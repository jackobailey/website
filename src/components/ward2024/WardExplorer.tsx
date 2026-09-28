import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_WARD, wardHeading, type Estimates, type Selection } from './data';
import WardMap, { type WardTopology } from './WardMap';
import VoteChart from './VoteChart';
import './ward2024.css';

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

export default function WardExplorer() {
  const [data, setData] = useState<{ estimates: Estimates; topology: WardTopology } | null>(null);
  const [selection, setSelection] = useState<Selection>({ id: DEFAULT_WARD, focus: false, sequence: 0 });
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    Promise.all([
      readJson<Estimates>('/data/ward2024/estimates.json', controller.signal),
      readJson<WardTopology>('/data/ward2024/wards.topo.json', controller.signal),
    ]).then(([estimates, topology]) => {
      if (!Array.isArray(estimates.wards) || !topology.objects?.wards) throw new Error('Invalid ward data');
      setData({ estimates, topology });
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.estimates.wards.map(ward => ward.id));
    const applyHash = () => {
      const id = window.location.hash.slice(1);
      if (id && !ids.has(id)) setNotice('That ward code was not found. Showing Astley Bridge; search for another ward below.');
      else setNotice('');
      setSelection(current => ({ id: ids.has(id) ? id : DEFAULT_WARD, focus: ids.has(id), sequence: current.sequence + 1 }));
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [data]);

  const selectWard = useCallback((id: string, focus: boolean) => {
    setSelection(current => ({ id, focus, sequence: current.sequence + 1 }));
    setNotice('');
    // A selected ward has a shareable URL without adding a history entry per click.
    window.history.replaceState(null, '', `#${id}`);
  }, []);
  const ward = data?.estimates.wards.find(item => item.id === selection.id);
  const openMethod = () => dialog.current?.showModal();

  return <div className="ward-explorer">
    <a className="skip-link" href="#ward-details" onClick={event => { event.preventDefault(); document.getElementById('ward-details')?.focus(); }}>Skip to ward estimates</a>
    <header className="explorer-header">
      <div><h1>UK General Election 2024: Ward by Ward</h1><p>Explore MRP estimates of the general election in 7,993 wards across Great Britain</p></div>
      <button className="text-button about-button" onClick={openMethod}>About the estimates</button>
    </header>
    {notice && <p className="ward-notice" role="status">{notice}</p>}
    {data && ward ? <main className="explorer-main">
      <WardMap wards={data.estimates.wards} topology={data.topology} selection={selection} onSelect={selectWard} />
      <aside id="ward-details" className="ward-details" aria-labelledby="selected-ward" tabIndex={-1}>
        <div className="ward-heading"><p className="ward-region">{ward.region}</p>
          <h2 id="selected-ward" title={ward.name} aria-label={ward.name}>{wardHeading(ward.name)}</h2>
          <p className="ward-constituency"><span className="ward-constituency-name" title={`${ward.pcon} — main constituency by census adult population; wards can cross constituency boundaries`}>{ward.pcon}</span></p>
        </div>
        <p className="sr-only" role="status" aria-live="polite">Showing estimates for {ward.name}, {ward.pcon}.</p>
        <VoteChart ward={ward} />
        <footer className="details-footer"><div><button className="text-button" onClick={openMethod}>Method &amp; data</button><a href={data.estimates.download} target="_blank" rel="noreferrer">Download CSV</a></div><span>Estimates by <a href="https://bsky.app/profile/jack-bailey.co.uk" target="_blank" rel="noreferrer">Jack Bailey</a></span></footer>
      </aside>
    </main> : <main className="loading-state" role="status"><h2>{error ? 'The estimates could not load' : 'Loading the ward estimates…'}</h2><p>{error ? 'Check your connection and try again.' : 'Preparing the map of Great Britain.'}</p>{error && <button className="retry-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>}</main>}
    <dialog className="method-dialog" ref={dialog} aria-labelledby="method-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="method-content">
        <button className="dialog-close" aria-label="Close about the estimates" onClick={() => dialog.current?.close()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        <h2 id="method-title">About the estimates</h2>
        <p>These are Jack Bailey’s estimates of party vote shares in the 2024 general election for 7,993 census ward areas in England, Scotland and Wales.</p>
        <h3>How they were made</h3>
        <p>Multilevel regression and poststratification (MRP) combines Wave 29 of the British Election Study Internet Panel with census data from England and Wales (2021) and Scotland (2022). Predictions are weighted to each ward’s demographic profile and calibrated to the known 2024 constituency results, accounting for wards that cross constituency boundaries.</p>
        <h3>Reading the map and chart</h3>
        <p>Map colours initially show the party or category with the largest estimated vote share. Select a party in the legend to shade every ward by its estimated share of valid votes, from white at 0% to the full party colour at 100%. A square-root colour scale emphasises differences at lower shares: 25% receives half the colour intensity. Legend labels and hover values show actual vote percentages. Select the party again or choose “Show leading party” to return to the original view. These colours do not show the probability of winning.</p>
        <p>Bars show the estimated share of valid votes; whiskers show the supplied 95% uncertainty interval. The chart and party map scales stay at 0–100% when you change wards or parties.</p>
        <p>“Other” combines other parties and independents. Only parties with positive estimated shares appear, following the CSV. Small shares can round to 0.0% on the chart. Matching constituency results does not establish accuracy within each ward.</p>
        <h3>Which boundaries?</h3>
        <p>The map uses <strong>2022 census ward areas</strong>, which can differ from the wards in use at the 2024 election. Northern Ireland is excluded. The City of London and Isles of Scilly each form a single census area; Hunmanby &amp; Sherburn has separate Ryedale and Scarborough parts. Boundaries are simplified for display.</p>
        <p>The constituency shown beneath a ward’s name is the one containing its largest share of census adult population. It is a label: a ward may cross constituency boundaries.</p>
        <p>Drag or pinch the map to explore; select any ward to update the chart. For keyboard access, search a ward name, constituency or ward code, use the arrow keys, then press Enter. The address updates so you can copy a link to the selected ward.</p>
        <div className="method-links"><a href="https://github.com/jackobailey/ward_mrp" target="_blank" rel="noreferrer">Read the full method on GitHub</a><a href="/data/ward2024/sources.json" target="_blank" rel="noreferrer">Data &amp; boundary provenance</a></div>
        <p className="boundary-credit">Boundaries: <a href="https://www.arcgis.com/home/item.html?id=a2c204fedefe4120ac93f062c647bdcb" target="_blank" rel="noreferrer">Office for National Statistics</a>. Contains OS data © Crown copyright and database right 2022. Contains National Statistics data © Crown copyright and database right 2022. <a href="https://www.ons.gov.uk/methodology/geography/licences" target="_blank" rel="noreferrer">Geography licences</a>.</p>
      </div>
    </dialog>
  </div>;
}

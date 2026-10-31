import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_WARD, wardHeading, type Estimates, type Selection } from './data';
import WardMap, { type WardTopology } from './WardMap';
import VoteChart from './VoteChart';
import './wardbrexit.css';

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

export default function WardExplorer({ stickerSrc }: { stickerSrc: string }) {
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
      readJson<Estimates>('/data/wardbrexit/estimates.json', controller.signal),
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

  return <div className="ward-explorer brexit-explorer">
    <a className="skip-link" href="#ward-details" onClick={event => { event.preventDefault(); document.getElementById('ward-details')?.focus(); }}>Skip to ward estimates</a>
    <header className="explorer-header">
      <div><h1>Brexit 2.0: Ward by Ward</h1><p>Explore Brexit voting intentions in 7,993 wards across Great Britain</p></div>
      <button type="button" className="ward-project-link" onClick={openMethod} aria-label="About Brexit Ward MRP">
        <img src={stickerSrc} width="264" height="264" alt="Brexit Ward MRP hex sticker" />
      </button>
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
    </main> : <main className="loading-state" role="status"><h2>{error ? 'The Estimates Could Not Load' : 'Loading the Ward Estimates…'}</h2><p>{error ? 'Check your connection and try again.' : 'Preparing the map of Great Britain.'}</p>{error && <button className="retry-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>}</main>}
    <dialog className="method-dialog" ref={dialog} aria-labelledby="method-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="method-content">
        <button className="dialog-close" aria-label="Close about the estimates" onClick={() => dialog.current?.close()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        <h2 id="method-title">About the Estimates</h2>
        <p>These are Jack Bailey’s MRP estimates of Rejoin the EU versus Stay out of the EU voting intention for 7,993 census ward areas in England, Scotland and Wales. They describe preferences in Wave 31 of the British Election Study Internet Panel, not how people voted in the 2016 referendum.</p>
        <h3>How They Were Made</h3>
        <p>Multilevel regression and poststratification (MRP) combines Wave 31 of the British Election Study Internet Panel with census data from England and Wales (2021) and Scotland (2022). The model predicts Rejoin, Stay out, and a combined don’t know / would not vote category using demographic characteristics and ward, constituency and region information. Predictions are weighted to each ward’s demographic profile, combining expected counts for wards that cross constituency boundaries within each posterior draw.</p>
        <p>The 2024 constituency election results and estimated 2016 Leave shares are contextual predictors. These voting-intention estimates are not calibrated to election results.</p>
        <h3>Reading the Map and Chart</h3>
        <p>Shares are calculated among those choosing Rejoin or Stay out, excluding don’t knows and non-voters. They sum to 100% within each ward. These are modelled estimates, not observed ward results.</p>
        <p>Map colours show the estimated balance between the two preferences. Dark purple represents 100% Rejoin, coral represents 100% Stay out, and warm off-white marks a 50/50 split. Pale wards have evenly balanced estimates; they are not missing data. The purple and coral use the magma palette’s 0.2 and 0.7 colours. A gentle logistic colour scale increases contrast near an even split and compresses differences near 0% and 100%. Legend labels show actual vote shares at their transformed positions, and the chart bars use the palette’s endpoint colours. Hover over a ward to see both shares. Colours show voting intention, not the probability that a preference leads.</p>
        <p>Bars show estimated shares and whiskers show the supplied 95% uncertainty intervals. A point estimate is the mean expected count for that response divided by the mean total expected count for Rejoin and Stay out. Interval bounds are the 2.5th and 97.5th percentiles of the posterior draw-level shares. The chart stays on a linear 0–100% scale; the colour transformation does not change bar lengths, percentages or uncertainty intervals.</p>
        <p>The expected counts in the CSV use census adult populations; they are not observed votes or counts of registered electors. This page displays the supplied estimates and does not independently validate the model’s accuracy within each ward.</p>
        <h3>Which Boundaries?</h3>
        <p>The map uses <strong>2022 census ward areas</strong>, which can differ from present-day local-government wards and those used for the 2016 referendum. Northern Ireland is excluded. The City of London and Isles of Scilly each form a single census area; Hunmanby &amp; Sherburn has separate Ryedale and Scarborough parts. Boundaries are simplified for display.</p>
        <p>The constituency shown beneath a ward’s name is the one containing its largest share of census adult population. It is a label: a ward may cross constituency boundaries.</p>
        <p>Drag or pinch the map to explore; select any ward to update the chart. For keyboard access, search a ward name, constituency or ward code, use the arrow keys, then press Enter. The address updates so you can copy a link to the selected ward.</p>
        <div className="method-links"><a href="/data/wardbrexit/method.md" target="_blank" rel="noreferrer">Read the source project’s method</a><a href="/data/wardbrexit/sources.json" target="_blank" rel="noreferrer">Data &amp; boundary provenance</a></div>
        <p className="boundary-credit">Boundaries: <a href="https://www.arcgis.com/home/item.html?id=a2c204fedefe4120ac93f062c647bdcb" target="_blank" rel="noreferrer">Office for National Statistics</a>. Contains OS data © Crown copyright and database right 2022. Contains National Statistics data © Crown copyright and database right 2022. <a href="https://www.ons.gov.uk/methodology/geography/licences" target="_blank" rel="noreferrer">Geography licences</a>.</p>
      </div>
    </dialog>
  </div>;
}

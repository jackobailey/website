import { useMemo, useRef, useState } from 'react';
import { normalise, type Ward } from './data';

export default function WardSearch({ wards, onSelect }: { wards: Ward[]; onSelect: (id: string, focus: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const index = useMemo(() => wards.map(ward => ({ ward, name: normalise(ward.name), text: normalise(`${ward.name} ${ward.pcon} ${ward.region} ${ward.id}`) })), [wards]);
  const results = useMemo(() => {
    const term = normalise(query.trim());
    if (term.length < 2) return [];
    const words = term.split(/\s+/);
    return index.filter(item => words.every(word => item.text.includes(word)))
      .sort((a, b) => Number(b.name.startsWith(term)) - Number(a.name.startsWith(term)) || a.ward.name.localeCompare(b.ward.name));
  }, [index, query]);
  const visible = results.slice(0, 20);
  const expanded = open && query.trim().length >= 2;
  const choose = (ward: Ward) => {
    onSelect(ward.id, true);
    setQuery('');
    setOpen(false);
    input.current?.focus();
  };

  return <div className="ward-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="search-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <input ref={input} type="search" role="combobox" aria-label="Search wards or constituencies"
        aria-expanded={expanded} aria-controls="ward-search-results" aria-autocomplete="list"
        aria-activedescendant={expanded && visible[active] ? `ward-option-${visible[active].ward.id}` : undefined}
        placeholder="Search wards or constituencies" value={query} autoComplete="off" spellCheck={false}
        onFocus={() => setOpen(true)}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); return; }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            const next = Math.max(0, Math.min(visible.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
            setActive(next);
            document.getElementById(`ward-option-${visible[next]?.ward.id}`)?.scrollIntoView({ block: 'nearest' });
          }
          if (event.key === 'Enter' && expanded && visible[active]) { event.preventDefault(); choose(visible[active].ward); }
        }} />
    </div>
    <div className="search-results" hidden={!expanded}>
      <p className="search-count" role="status">{results.length ? `${results.length.toLocaleString('en-GB')} matching wards${results.length > 20 ? ' · showing the first 20' : ''}` : 'No wards found. Try a ward name, constituency or ward code.'}</p>
      <ul id="ward-search-results" role="listbox" aria-label="Matching wards">
        {visible.map(({ ward }, i) => <li key={ward.id} id={`ward-option-${ward.id}`} role="option" aria-selected={i === active}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(ward)}>
          <strong>{ward.name}</strong><span>{ward.pcon} · {ward.region}</span>
        </li>)}
      </ul>
    </div>
  </div>;
}

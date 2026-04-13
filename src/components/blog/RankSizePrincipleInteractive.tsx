import { useState } from "react";

const DEFAULT_PARTIES = [
  { id: "A", label: "Red", shortLabel: "R", color: "#FF4136", votes: 50, seats: 1 },
  { id: "B", label: "Blue", shortLabel: "B", color: "#0074D9", votes: 30, seats: 0 },
  { id: "C", label: "Green", shortLabel: "G", color: "#2ECC40", votes: 20, seats: 0 }
] as const;

const PARTY_PAIRS = [
  [0, 1],
  [0, 2],
  [1, 2]
] as const;
const COLUMN_TEMPLATE = "40% 20% 40%";
const SEATS_CONTROL_WIDTH_CLASS = "w-[6rem] sm:w-[6.25rem]";

type Party = (typeof DEFAULT_PARTIES)[number];
type PartyWithSeats = Party & { currentSeats: number };
type ComparisonSymbol = "+" | "0" | "-";

function getComparisonResult(left: PartyWithSeats, right: PartyWithSeats): ComparisonSymbol {
  const voteDifference = left.votes - right.votes;
  const seatDifference = left.currentSeats - right.currentSeats;
  const product = voteDifference * seatDifference;

  if (product > 0) {
    return "+";
  }

  if (product < 0) {
    return "-";
  }

  return "0";
}

function getOrderGroups(parties: PartyWithSeats[], key: "votes" | "currentSeats") {
  const sortedParties = [...parties].sort((left, right) => {
    const valueDifference = right[key] - left[key];

    if (valueDifference !== 0) {
      return valueDifference;
    }

    return left.id.localeCompare(right.id);
  });

  const groups: PartyWithSeats[][] = [];
  let currentGroupValue: number | null = null;

  for (const party of sortedParties) {
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || currentGroupValue !== party[key]) {
      groups.push([party]);
      currentGroupValue = party[key];
      continue;
    }

    lastGroup.push(party);
  }

  return groups;
}

function renderOrder(groups: PartyWithSeats[][]) {
  return groups.map((group, groupIndex) => (
    <span key={group.map((party) => party.id).join("-")}>
      {group.map((party, partyIndex) => (
        <span key={party.id}>
          {partyIndex > 0 && <span className="px-1 text-[#111111]">=</span>}
          <span style={{ color: party.color }}>{party.shortLabel}</span>
        </span>
      ))}
      {groupIndex < groups.length - 1 && <span className="px-1 text-[#111111]">&gt;</span>}
    </span>
  ));
}

export default function RankSizePrincipleInteractive() {
  const [seatCounts, setSeatCounts] = useState<number[]>(() =>
    DEFAULT_PARTIES.map((party) => party.seats)
  );

  const parties = DEFAULT_PARTIES.map((party, index) => ({
    ...party,
    currentSeats: seatCounts[index]
  }));

  const voteOrder = getOrderGroups(parties, "votes");
  const seatOrder = getOrderGroups(parties, "currentSeats");
  const violatingPairs = PARTY_PAIRS.reduce((count, [leftIndex, rightIndex]) => {
    const left = parties[leftIndex];
    const right = parties[rightIndex];

    return count + (getComparisonResult(left, right) === "-" ? 1 : 0);
  }, 0);

  function updateSeatCount(index: number, delta: number) {
    setSeatCounts((currentSeatCounts) =>
      currentSeatCounts.map((seatCount, seatIndex) => {
        if (seatIndex !== index) {
          return seatCount;
        }

        return Math.max(0, seatCount + delta);
      })
    );
  }

  return (
    <div className="not-prose my-10">
      <section className="interactive-panel overflow-hidden">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <p className="eyebrow">The Rank-Size Principle in Action</p>
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="overflow-x-auto px-4">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "40%" }} />
              </colgroup>
              <thead className="border-b border-black/8">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-black/50 sm:text-[0.82rem]">
                  <th className="px-0 py-3 pl-4 pr-6 sm:pr-8">Party</th>
                  <th className="px-0 py-3 text-center">Votes</th>
                  <th className="px-0 py-3 pr-4">
                    <div className={`ml-auto ${SEATS_CONTROL_WIDTH_CLASS} text-center`}>Seats</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parties.map((party, index) => (
                  <tr key={party.id}>
                    <td className="px-0 py-3 pl-4 text-sm font-semibold text-[#111111] sm:pr-8 sm:text-[0.98rem]">
                      <span style={{ color: party.color }}>{party.label}</span>
                    </td>
                    <td className="px-0 py-3 text-center text-sm font-semibold tabular-nums text-[#111111] sm:text-[0.98rem]">
                      {party.votes}%
                    </td>
                    <td className="px-0 py-3 pr-4">
                      <div
                        className={`ml-auto flex ${SEATS_CONTROL_WIDTH_CLASS} items-center justify-between`}
                      >
                        <button
                          type="button"
                          onClick={() => updateSeatCount(index, -1)}
                          disabled={party.currentSeats === 0}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F76F5C] text-sm font-semibold text-white transition hover:bg-[#E56553] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-white/70 disabled:hover:bg-black/10"
                          aria-label={`Decrease seats for ${party.label}`}
                        >
                          -
                        </button>

                        <span
                          className="min-w-6 text-center text-sm font-semibold tabular-nums text-[#111111] sm:min-w-7 sm:text-[0.98rem]"
                          aria-live="polite"
                        >
                          {party.currentSeats}
                        </span>

                        <button
                          type="button"
                          onClick={() => updateSeatCount(index, 1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F76F5C] text-sm font-semibold text-white transition hover:bg-[#E56553]"
                          aria-label={`Increase seats for ${party.label}`}
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-black/8 px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-y-4 gap-x-0 px-4" style={{ gridTemplateColumns: COLUMN_TEMPLATE }}>
            <div className="pl-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-black/45">
                Vote order
              </p>
              <p className="mt-2 text-sm font-semibold text-[#111111] sm:text-[0.98rem]">
                {renderOrder(voteOrder)}
              </p>
            </div>

            <div className="text-center">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-black/45">
                Seat order
              </p>
              <p className="mt-2 text-sm font-semibold text-[#111111] sm:text-[0.98rem]">
                {renderOrder(seatOrder)}
              </p>
            </div>

            <div className="pr-4">
              <div className={`ml-auto flex ${SEATS_CONTROL_WIDTH_CLASS} justify-center`}>
                <p className="w-max whitespace-nowrap text-center text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-black/45">
                  Violating pairs
                </p>
              </div>
              <div className={`ml-auto mt-2 ${SEATS_CONTROL_WIDTH_CLASS} text-center`}>
                <p className="text-sm font-semibold tabular-nums text-[#111111] sm:text-[0.98rem]">
                  {violatingPairs}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

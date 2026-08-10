import { useMemo, useState } from "react";
import scenarioJson from "@/data/blog/mmp-scenario.json";

type PartyId = string;

type Party = {
  id: PartyId;
  label: string;
  shortLabel: string;
  color: string;
  hasListVotes: boolean;
};

type RegionScenario = {
  name: string;
  population: number;
  totalSeats: number;
  actualDistrictSeats2024: number;
  districtSeats2024: Record<PartyId, number>;
  listVotes: Record<PartyId, number>;
};

type Scenario = {
  metadata: {
    totalSeats: number;
    defaultDistrictSeats: number;
  };
  parties: Party[];
  regions: RegionScenario[];
};

const scenario = scenarioJson as unknown as Scenario;
const PARTY_ORDER = scenario.parties.map((party) => party.id);
const LIST_PARTIES = scenario.parties.filter((party) => party.hasListVotes).map((party) => party.id);
const TOTAL_POPULATION = scenario.regions.reduce((sum, region) => sum + region.population, 0);
const SEAT_FORMATTER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

function formatSeatCount(value: number) {
  return SEAT_FORMATTER.format(value);
}

function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function getPartyOrderIndex(partyId: PartyId) {
  const index = PARTY_ORDER.indexOf(partyId);
  return index === -1 ? PARTY_ORDER.length : index;
}

function createEmptyPartyCounts() {
  return Object.fromEntries(PARTY_ORDER.map((partyId) => [partyId, 0])) as Record<PartyId, number>;
}

function apportionLargestRemainder(
  weights: Record<string, number>,
  seats: number,
  order: string[]
) {
  const result = Object.fromEntries(order.map((key) => [key, 0])) as Record<string, number>;

  if (seats <= 0) {
    return result;
  }

  const totalWeight = order.reduce((sum, key) => sum + (weights[key] ?? 0), 0);

  if (totalWeight <= 0) {
    return result;
  }

  const quotas = new Map<string, number>();
  let allocatedSeats = 0;

  for (const key of order) {
    const quota = ((weights[key] ?? 0) / totalWeight) * seats;
    const floor = Math.floor(quota);
    quotas.set(key, quota);
    result[key] = floor;
    allocatedSeats += floor;
  }

  const remainingSeats = seats - allocatedSeats;
  const remainderOrder = [...order].sort((left, right) => {
    const leftRemainder = (quotas.get(left) ?? 0) - result[left];
    const rightRemainder = (quotas.get(right) ?? 0) - result[right];

    if (rightRemainder !== leftRemainder) {
      return rightRemainder - leftRemainder;
    }

    const weightDifference = (weights[right] ?? 0) - (weights[left] ?? 0);

    if (weightDifference !== 0) {
      return weightDifference;
    }

    return order.indexOf(left) - order.indexOf(right);
  });

  for (let index = 0; index < remainingSeats; index += 1) {
    result[remainderOrder[index]] += 1;
  }

  return result;
}

function allocateRegionalListSeats(region: RegionScenario, districtByParty: Record<PartyId, number>) {
  const listSeats = region.totalSeats - Object.values(districtByParty).reduce((sum, seats) => sum + seats, 0);
  const listByParty = createEmptyPartyCounts();
  const currentSeats = createEmptyPartyCounts();

  for (const partyId of LIST_PARTIES) {
    currentSeats[partyId] = districtByParty[partyId] ?? 0;
  }

  for (let seat = 0; seat < listSeats; seat += 1) {
    let winningParty = LIST_PARTIES[0];
    let winningScore = Number.NEGATIVE_INFINITY;

    for (const partyId of LIST_PARTIES) {
      const voteShare = region.listVotes[partyId] ?? 0;

      if (voteShare <= 0) {
        continue;
      }

      const score = voteShare / (2 * currentSeats[partyId] + 1);

      if (
        score > winningScore ||
        (score === winningScore && getPartyOrderIndex(partyId) < getPartyOrderIndex(winningParty))
      ) {
        winningScore = score;
        winningParty = partyId;
      }
    }

    listByParty[winningParty] += 1;
    currentSeats[winningParty] += 1;
  }

  return listByParty;
}

function calculateResults(districtSeats: number) {
  const regionSeatWeights = Object.fromEntries(
    scenario.regions.map((region) => [region.name, region.totalSeats])
  );
  const regionOrder = scenario.regions.map((region) => region.name);
  const regionalDistrictSeats = apportionLargestRemainder(
    regionSeatWeights,
    districtSeats,
    regionOrder
  );
  const nationalDistrictSeats = createEmptyPartyCounts();
  const nationalListSeats = createEmptyPartyCounts();
  const nationalVotes = createEmptyPartyCounts();

  for (const region of scenario.regions) {
    const regionDistrictSeatCount = regionalDistrictSeats[region.name];
    const districtByParty = apportionLargestRemainder(
      region.districtSeats2024,
      regionDistrictSeatCount,
      PARTY_ORDER
    );
    const listByParty = allocateRegionalListSeats(region, districtByParty);

    for (const partyId of PARTY_ORDER) {
      nationalDistrictSeats[partyId] += districtByParty[partyId] ?? 0;
      nationalListSeats[partyId] += listByParty[partyId] ?? 0;
      nationalVotes[partyId] += (region.listVotes[partyId] ?? 0) * region.population;
    }
  }

  const partyResults = scenario.parties
    .map((party) => {
      const partyDistrictSeats = nationalDistrictSeats[party.id] ?? 0;
      const partyListSeats = nationalListSeats[party.id] ?? 0;
      const totalSeats = partyDistrictSeats + partyListSeats;
      const voteShare = (nationalVotes[party.id] ?? 0) / TOTAL_POPULATION;
      const seatShare = totalSeats / scenario.metadata.totalSeats;

      return {
        ...party,
        districtSeats: partyDistrictSeats,
        listSeats: partyListSeats,
        totalSeats,
        voteShare,
        seatShare
      };
    })
    .filter((party) => party.id === "Independent" || party.totalSeats > 0 || party.voteShare > 0)
    .sort((left, right) => {
      if (right.totalSeats !== left.totalSeats) {
        return right.totalSeats - left.totalSeats;
      }

      return getPartyOrderIndex(left.id) - getPartyOrderIndex(right.id);
    });

  const effectiveVoteWinningParties =
    1 /
    partyResults.reduce((sum, party) => {
      return sum + party.voteShare * party.voteShare;
    }, 0);
  const squaredSeatVoteDifference = partyResults.reduce((sum, party) => {
    const difference = party.seatShare - party.voteShare;

    return sum + difference * difference;
  }, 0);
  const normalisedGallagher =
    Math.sqrt(
      (effectiveVoteWinningParties / (effectiveVoteWinningParties + 1)) *
        squaredSeatVoteDifference
    ) * 100;

  return {
    partyResults,
    normalisedGallagher,
    districtSeats,
    listSeats: scenario.metadata.totalSeats - districtSeats
  };
}

export default function MmpSeatSimulator() {
  const [districtSeats, setDistrictSeats] = useState(scenario.metadata.defaultDistrictSeats);
  const result = useMemo(() => calculateResults(districtSeats), [districtSeats]);
  const maxSeats = Math.max(...result.partyResults.map((party) => party.totalSeats));
  const updateSeatBalance = (event: { currentTarget: HTMLInputElement }) => {
    const listSeatCount = Number(event.currentTarget.value);
    setDistrictSeats(scenario.metadata.totalSeats - listSeatCount);
  };

  return (
    <div className="not-prose my-10">
      <section className="interactive-panel overflow-hidden">
        <div className="grid border-b border-black/8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="border-b border-black/8 p-5 sm:p-6 md:border-b-0 md:border-r">
            <p className="eyebrow">MMP Simulator</p>
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
                    District
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111111]">
                    {formatSeatCount(result.districtSeats)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
                    List
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111111]">
                    {formatSeatCount(result.listSeats)}
                  </p>
                </div>
              </div>
              <input
                id="mmp-seat-balance"
                type="range"
                min="0"
                max={scenario.metadata.totalSeats}
                step="1"
                value={result.listSeats}
                onInput={updateSeatBalance}
                onChange={updateSeatBalance}
                className="w-full accent-[#F76F5C]"
                aria-label="Adjust district and list seat allocation"
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-5 text-center sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
              Disproportionality
            </p>
            <p className="mt-3 text-4xl font-semibold tabular-nums text-[#111111]">
              {result.normalisedGallagher.toFixed(1)}
              <span className="text-xl font-semibold text-black/45">/100</span>
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div>
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[28%]" />
              </colgroup>
              <thead className="border-b border-black/8">
                <tr className="text-left text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-black/45 sm:text-xs sm:tracking-[0.14em]">
                  <th className="py-3 pr-2">Party</th>
                  <th className="px-1 py-3 text-right sm:px-2">List vote</th>
                  <th className="px-1 py-3 text-right sm:px-2">District</th>
                  <th className="px-1 py-3 text-right sm:px-2">List</th>
                  <th className="px-1 py-3 text-right sm:px-2">Total</th>
                  <th className="py-3 pl-2 text-left sm:pl-3">Seats</th>
                </tr>
              </thead>
              <tbody>
                {result.partyResults.map((party) => (
                  <tr key={party.id} className="border-b border-black/6 last:border-b-0">
                    <td className="py-3 pr-2">
                      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full sm:h-3 sm:w-3"
                          style={{ backgroundColor: party.color }}
                        />
                        <span className="min-w-0 text-xs font-semibold leading-4 text-[#111111] sm:text-sm">
                          {party.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-3 text-right text-xs tabular-nums text-[#111111] sm:px-2 sm:text-sm">
                      {formatPercent(party.voteShare)}
                    </td>
                    <td className="px-1 py-3 text-right text-xs tabular-nums text-[#111111] sm:px-2 sm:text-sm">
                      {party.districtSeats}
                    </td>
                    <td className="px-1 py-3 text-right text-xs tabular-nums text-[#111111] sm:px-2 sm:text-sm">
                      {party.listSeats}
                    </td>
                    <td className="px-1 py-3 text-right text-xs font-semibold tabular-nums text-[#111111] sm:px-2 sm:text-sm">
                      {party.totalSeats}
                    </td>
                    <td className="py-3 pl-2 sm:pl-3">
                      <div className="h-2 w-full rounded-full bg-black/8">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${(party.totalSeats / maxSeats) * 100}%`,
                            backgroundColor: party.color
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-5 text-black/45">
            Note: District results may not replicate the 2024 election exactly, as this simulation
            is based on regional top-ups and reallocates seats within regions using the largest
            remainder method.
          </p>
        </div>
      </section>
    </div>
  );
}

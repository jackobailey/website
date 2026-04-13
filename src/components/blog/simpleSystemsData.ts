export const SIMPLE_SYSTEMS_DISTRICT = "Aleipata Itupa-I-Lalo";
export const SIMPLE_SYSTEMS_DISTRICT_MAGNITUDE = 1;

export type CandidateResult = {
  candidate: string;
  party: string;
  votes: number;
  seats: number;
};

export type PartyAggregate = {
  party: string;
  votes: number;
  seats: number;
  candidateCount: number;
  candidates: string[];
};

export const simpleSystemsCandidateResults: CandidateResult[] = [
  {
    candidate: "Paepae Kapeli Sua",
    party: "SDUP",
    votes: 731,
    seats: 1
  },
  {
    candidate: "Tautoloitua Farani Posala",
    party: "HRPP",
    votes: 627,
    seats: 0
  },
  {
    candidate: "Utuga Faamanatu Faaaliga",
    party: "HRPP",
    votes: 258,
    seats: 0
  },
  {
    candidate: "Tauiliili Joe Kolose Fruean",
    party: "SP",
    votes: 62,
    seats: 0
  },
  {
    candidate: "Letiu Elisapeta Tali Lee",
    party: "Independent",
    votes: 23,
    seats: 0
  }
];

export const simpleSystemsPartyResults: PartyAggregate[] = Object.values(
  simpleSystemsCandidateResults.reduce<Record<string, PartyAggregate>>((parties, result) => {
    const current = parties[result.party];

    if (current) {
      current.votes += result.votes;
      current.seats += result.seats;
      current.candidateCount += 1;
      current.candidates.push(result.candidate);
      return parties;
    }

    parties[result.party] = {
      party: result.party,
      votes: result.votes,
      seats: result.seats,
      candidateCount: 1,
      candidates: [result.candidate]
    };

    return parties;
  }, {})
).sort((left, right) => right.votes - left.votes);

export const simpleSystemsTotalVotes = simpleSystemsCandidateResults.reduce(
  (total, result) => total + result.votes,
  0
);

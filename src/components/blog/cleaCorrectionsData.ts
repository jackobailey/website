// Transcribed from CLEA release 18 (20251015) and Clean CLEA's clean_clea.rds.
// Only pv1 (party votes) and seat are displayed. No stored vote-share fields
// are used: the broad cleaned archive does not recompute every derived field.
// Election/constituency keys: Portugal 1670/12; Coventry 651/161.
// The two correction scripts were checked against the public repository on
// 5–6 November 2026. Short labels below expand the source's party names.
// Script 651.R's comment says South West, but cst 161 and the returns identify
// Coventry South East. The duplicate is pty 6027 with cv1 == -990; both rows
// contain pv1 == 10551. The table sums pv1 and seat within party in each version.

type ResultRow = {
  party: string;
  detail?: string;
  original: [votes: number, seats: number];
  corrected: [votes: number, seats: number];
};

type CorrectionExample = {
  title: string;
  context: string;
  rows: ResultRow[];
  originalNote: string;
  correctedNote: string;
  tableNote: string;
  script: string;
  source: string;
  sourceLabel: string;
};

export const cleaCorrections: Record<"portugal" | "coventry", CorrectionExample> = {
  portugal: {
    title: "Leiria, Portugal · 2015",
    context: "Ten seats · One extra zero",
    rows: [
      { party: "Portugal à Frente", original: [114829, 6], corrected: [114829, 6] },
      { party: "Socialist Party", original: [58878, 3], corrected: [58878, 3] },
      { party: "Left Bloc", original: [22946, 1], corrected: [22946, 1] },
      { party: "CDU", detail: "Democratic Unity Coalition", original: [120700, 0], corrected: [12070, 0] },
      // Sum of the other 11 party rows (pty 12,15,17,24,25,26,27,28,29,30,5007).
      { party: "Other parties", detail: "11 smaller parties combined", original: [16904, 0], corrected: [16904, 0] }
    ],
    originalNote: "CDU appears to have the most votes, yet wins no seats.",
    correctedNote: "CDU's 12,070 votes put it fourth. The seat counts stay the same.",
    tableNote: "All 15 party lists are included; 11 are grouped. Blank ballots are excluded. Rows keep the same order for comparison.",
    script: "https://github.com/jackobailey/clean_clea/blob/main/_scripts/100_error_scripts/1670.R",
    source: "https://www.cne.pt/sites/default/files/dl/ar2015_mapa_oficial_resultados.pdf",
    sourceLabel: "Official Portuguese returns"
  },
  coventry: {
    title: "Coventry South East, UK · 1992",
    context: "One seat · The same votes counted twice",
    rows: [
      { party: "Labour", original: [11902, 1], corrected: [11902, 1] },
      { party: "Conservative", original: [10591, 0], corrected: [10591, 0] },
      { party: "Independent Labour", detail: "Dave Nellist", original: [21102, 0], corrected: [10551, 0] },
      { party: "Liberal Democrats", original: [3318, 0], corrected: [3318, 0] },
      { party: "National Front", original: [173, 0], corrected: [173, 0] }
    ],
    originalNote: "Nellist appears to come first. Party votes total 47,086, exceeding the 36,535 valid votes cast.",
    correctedNote: "Nellist comes third. Removing the duplicate restores the total to 36,535 votes.",
    tableNote: "All five parties shown. Votes and seats are summed by party: the original contains two Independent Labour rows, each with 10,551 party votes and no seat. Clean CLEA removes one of them.",
    script: "https://github.com/jackobailey/clean_clea/blob/main/_scripts/100_error_scripts/651.R",
    source: "https://members.parliament.uk/constituency/767/overview",
    sourceLabel: "UK Parliament: constituency history"
  }
};

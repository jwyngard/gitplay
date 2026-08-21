// Buckets ESPN's raw position abbreviations (which span both college and
// NFL naming, e.g. "PK" vs "K", "ILB"/"OLB" vs "LB") into fantasy-relevant
// groups for the "My Roster" position-grouped view. Order here is display
// order -- skill positions first, matching how a fantasy manager scans a
// roster, with line/other positions last since they're rarely fantasy-relevant.
const GROUPS = [
  { key: "QB", label: "QB", positions: ["QB"] },
  { key: "RB", label: "RB", positions: ["RB", "FB", "HB"] },
  { key: "WR", label: "WR", positions: ["WR"] },
  { key: "TE", label: "TE", positions: ["TE"] },
  { key: "K", label: "K", positions: ["K", "PK"] },
  {
    key: "DEF",
    label: "Defense / Special Teams",
    positions: [
      "DE", "DT", "NT", "DL", "EDGE",
      "LB", "ILB", "OLB", "MLB",
      "CB", "S", "SS", "FS", "DB",
      "P", "LS",
    ],
  },
  { key: "OL", label: "O-Line", positions: ["OT", "OG", "OL", "G", "C", "T"] },
];

const POSITION_TO_GROUP = new Map(
  GROUPS.flatMap((g) => g.positions.map((pos) => [pos, g.key]))
);

const GROUP_LABELS = new Map(GROUPS.map((g) => [g.key, g.label]));
const OTHER_KEY = "OTHER";
GROUP_LABELS.set(OTHER_KEY, "Other");

const GROUP_ORDER = [...GROUPS.map((g) => g.key), OTHER_KEY];

export function groupByFantasyPosition(players) {
  const buckets = new Map();
  for (const player of players) {
    const key = POSITION_TO_GROUP.get(player.position) ?? OTHER_KEY;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(player);
  }
  return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: GROUP_LABELS.get(key),
    players: buckets.get(key),
  }));
}

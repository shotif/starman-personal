/**
 * The codex: what the hero has learnt, opened by lines as they are said and kept on the device
 * across games. Real astronomy is accurate; the story's part follows it without a label (D-52).
 */
export interface CodexEntry {
  id: string;
  title: string;
  /** What is known of it in the real world, if anything. */
  facts: string | null;
  /** What the story adds. */
  story: string;
}

export const CODEX: CodexEntry[] = [
  {
    id: 'ross128',
    title: 'Ross 128',
    facts:
      'A red dwarf in Virgo, about 11 light-years from the Sun: spectral type M4 V, about a sixth of the ' +
      "Sun's mass and a fifth of its width, at about 3,200 K. A quiet star, as red dwarfs go, with few " +
      'flares. It is moving towards us, and in about 71,000 years it will be our nearest neighbour.',
    story:
      'It burned steady for billions of years. Then, in a single month, its light fell by six per cent, ' +
      'and it fell in steps.',
  },
  {
    id: 'ross128b',
    title: 'Ross 128 b',
    facts:
      'A planet found in 2017 with the HARPS spectrograph at La Silla, from the wobble it gives its star: ' +
      "at least 1.35 times Earth's mass, a year of 9.9 days, and about 1.4 times the sunlight Earth gets. " +
      'Whether it has air or water is not known. From its surface the star would look about 2° across.',
    story:
      "By the 2180s it has a small settlement, and the Authority's Calder Station keeping a beacon lit " +
      'for the lane that runs past it.',
  },
  {
    id: 'calder',
    title: 'Calder Station',
    facts: null,
    story:
      'A Sol Transit Authority outpost on Ross 128 b: a lane beacon, a comms mast, a hangar, and quarters ' +
      'for a night shift that mostly watches the star. Supplied every forty days by the hauler Merrow; ' +
      'twenty-two people on a quiet night.',
  },
  {
    id: 'authority',
    title: 'The Sol Transit Authority',
    facts: null,
    story:
      'The service that keeps the lanes between the stars lit and policed, from its orbital city at Earth, ' +
      'the Halcyon Ring. Lane officers like Ren Okafor carry its badge out to the stations at the edge.',
  },
  {
    id: 'antares',
    title: 'Antares',
    facts:
      'A red supergiant in Scorpius, about 550 light-years from the Sun and hundreds of times wider. It ' +
      'was expected to end, one day, as a supernova.',
    story:
      'It did not. Thirty years ago a halo of light was seen round it, and within a year it was dark. The ' +
      'Authority said it was natural, closed the run and sealed the files.',
  },
  {
    id: 'swarm',
    title: 'The swarm',
    facts: null,
    story:
      'Machines round Ross 128, thousands of them, and the ones that came down to the station. Motes are ' +
      'small and quick: cover stops their bolts. A lattice glows before it fires its beam: break its line ' +
      'of sight. A tender makes more motes while it lives: kill it first. A Field power leaves a machine ' +
      'primed; a blast or an overload sets it off.',
  },
  {
    id: 'merrow',
    title: 'The Merrow',
    facts: null,
    story:
      "A Kettering Line supply hauler with a crew of nine, on Calder's forty-day run, carrying the " +
      "settlement's stores and, if anyone read the supply board, a tin of cardamom.",
  },
  {
    id: 'surveyor',
    title: 'The surveyor',
    facts: null,
    story:
      'A Halden Orbital Works long-haul surveyor, built to map and armed after the fact with one turret. ' +
      'Sound, fuelled, and without a captain or a name, until the night at Ross 128.',
  },
  {
    id: 'lightkeeper',
    title: 'Lightkeepers',
    facts: null,
    story:
      "The Authority's highest rank: the officers who answer for keeping the lanes lit. A sealed file " +
      'from Antares carries one of their names: A. Varro.',
  },
];

export const CODEX_KEY = 'lightkeeper.codex';

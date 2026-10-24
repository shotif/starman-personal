/**
 * Who the hero is beyond their looks: class (D-10, D-33), where they are from (D-11, D-34) and the
 * moment that made them (D-35), as docs/design/CLASSES_AND_ORIGINS.md sets them out. The powers
 * are named here; they are built with combat.
 */
export type Discipline = 'Arms' | 'Systems' | 'Field';

export interface HeroClass {
  id: string;
  name: string;
  disciplines: Discipline[];
  playsAs: string;
  powers: string[];
  specialisations: [string, string];
}

export const CLASSES: readonly HeroClass[] = [
  {
    id: 'breacher',
    name: 'Breacher',
    disciplines: ['Arms'],
    playsAs: 'The front of the boarding party: heavy armour, every weapon, a melee blade.',
    powers: ['Stim Burst', 'Breach Charge', 'Brace'],
    specialisations: ['Juggernaut', 'Marksman'],
  },
  {
    id: 'rigger',
    name: 'Rigger',
    disciplines: ['Systems'],
    playsAs: 'Controls the fight from behind cover with machines.',
    powers: ['Seeker Drone', 'Overload', 'Spoof'],
    specialisations: ['Swarmer', 'Ghostwire'],
  },
  {
    id: 'fieldwright',
    name: 'Fieldwright',
    disciplines: ['Field'],
    playsAs: 'Throws the battlefield about with implanted field emitters.',
    powers: ['Lift', 'Pull', 'Slam'],
    specialisations: ['Gravist', 'Shaper'],
  },
  {
    id: 'shade',
    name: 'Shade',
    disciplines: ['Arms', 'Systems'],
    playsAs: 'The unseen: a light-bending cloak, a long rifle, sensors that find everyone.',
    powers: ['Veil', 'Mark', 'Decoy Flare'],
    specialisations: ['Hunter', 'Saboteur'],
  },
  {
    id: 'striker',
    name: 'Striker',
    disciplines: ['Arms', 'Field'],
    playsAs: 'Closes the distance with a warp hop and hits hard.',
    powers: ['Hop', 'Shove', 'Stim Burst'],
    specialisations: ['Duellist', 'Breaker'],
  },
  {
    id: 'warden',
    name: 'Warden',
    disciplines: ['Systems', 'Field'],
    playsAs: 'Holds the line and keeps others alive.',
    powers: ['Barrier', 'Repair Drone', 'Pull'],
    specialisations: ['Bastion', 'Medic'],
  },
];

export interface Origin {
  id: string;
  name: string;
  where: string;
  talent: string;
}

export const ORIGINS: readonly Origin[] = [
  {
    id: 'ringborn',
    name: 'Ringborn',
    where: "The Authority's orbital city at Earth, the Halcyon Ring: ports, permits, plenty.",
    talent: 'Paperwork: officials open doors.',
  },
  {
    id: 'steader',
    name: 'Steader',
    where: "A Cooperative farm world: Stonecrop Gardens at Procyon, or Tau Ceti's fields.",
    talent: 'Make do: repairs cost less.',
  },
  {
    id: 'den-raised',
    name: 'Den-raised',
    where: 'Among the Hollow Wake at Maw Roost, Wolf 1061.',
    talent: 'Street sense: black markets and dens open to you.',
  },
  {
    id: 'laneborn',
    name: 'Laneborn',
    where: 'Aboard a Kettering Line hauler, never long on a planet.',
    talent: 'Spacer: better in zero gravity and on ships.',
  },
  {
    id: 'beltborn',
    name: 'Beltborn',
    where: "Sol's belt crews, out in the Kuiper dark.",
    talent: 'Hard vacuum: suits and tools last longer.',
  },
  {
    id: 'borderer',
    name: 'Borderer',
    where: 'A frontier colony beyond 27 light-years, beside the Duskfolk.',
    talent: 'First words: you speak some Duskfolk.',
  },
];

export interface Moment {
  id: string;
  name: string;
  what: string;
  talent: string;
}

export const MOMENTS: readonly Moment[] = [
  {
    id: 'survivor',
    name: 'The survivor',
    what: 'The only one who walked out when a station, a ship or a colony died.',
    talent: 'Hard to kill.',
  },
  {
    id: 'hero-of-the-line',
    name: 'The hero of the line',
    what: 'You held a station on a border-war front when it should have fallen.',
    talent: 'Inspire: companions are steadier.',
  },
  {
    id: 'hard-call',
    name: 'The hard call',
    what: 'You made a choice that saved many and cost some.',
    talent: 'Resolve: hard choices open in dialogue.',
  },
  {
    id: 'lost-someone',
    name: 'The one who lost someone',
    what: 'Someone you could not save, and never found.',
    talent: 'Seeker: sensors and searches go further.',
  },
];

export const classOf = (id: string) => CLASSES.find((c) => c.id === id) ?? CLASSES[0];

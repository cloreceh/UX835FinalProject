/* Sample data. Distances in meters, measured or estimated.
   Replace with real surveyed data as you collect it. */

const STRIDE_PRESETS = [
  { id: "slow", label: "Slower pace or using a cane", meters: 0.54 },
  { id: "short", label: "Shorter stride", meters: 0.62 },
  { id: "average", label: "Average stride", meters: 0.71 },
  { id: "long", label: "Longer stride", meters: 0.79 }
];

/* Ordered small to large so profile filtering can compare by rank. */
const SIZE_ORDER = ["intimate", "theatre", "arena", "stadium"];

const SIZE_LABELS = {
  intimate: "Intimate venue",
  theatre: "Theatre-sized",
  arena: "Arena-sized",
  stadium: "Stadium-sized"
};

/* Baseline exertion contribution from a venue's climate, before route and crowd are factored in. */
const CLIMATE_EXERTION = {
  "air-conditioned": "low",
  "outdoor-shaded": "medium",
  "outdoor-mixed": "medium",
  "outdoor-full-sun": "high"
};

const CROWD_LEVELS = [
  { id: "light", label: "Light — doors just opened", factor: 0 },
  { id: "typical", label: "Typical for this venue", factor: 1 },
  { id: "packed", label: "Sold out / packed concourse", factor: 2 }
];

const VENUES = [
  {
    id: "riverfront",
    name: "Riverfront Arena",
    city: "Detroit, MI",
    kind: "Arena · 20,300 seats",
    trust: "verified",
    surveyed: "June 14, 2026",
    note: "Upper bowl has no step-free route. Lower bowl is reachable by elevator from every entrance.",
    environment: "indoor",
    sizeCategory: "arena",
    climate: {
      type: "air-conditioned",
      description: "Air conditioned throughout. Concourse runs warm on sold-out nights when doors and crowd flow raise the ambient temperature.",
      exertionBaseline: "low"
    },
    elevators: [
      { location: "Gate A lobby", servesLevels: "Concourse to lower bowl", public: true },
      { location: "Gate C, beside the skywalk stairs", servesLevels: "Skywalk to Gate C concourse", public: true },
      { location: "Center Street Garage, level 3", servesLevels: "All garage levels to skywalk", public: true },
      { location: "Backstage / loading dock", servesLevels: "All levels", public: false }
    ],
    restrooms: [
      { location: "Gate A concourse", accessibleStalls: 2, sharedQueue: true, notes: "" },
      { location: "Upper concourse, near Portal 218", accessibleStalls: 2, sharedQueue: true, notes: "Line can back up between periods/acts." }
    ],
    facts: [
      ["Accessible drop-off", "Gate A, curbside, 40 m from doors"]
    ],
    origins: [
      {
        id: "dropoff",
        name: "Gate A drop-off",
        kind: "Curbside",
        segments: [
          { name: "Curb to Gate A doors", meters: 40, stairs: 0, incline: 0, surface: "Level concrete", rests: 1, note: "Two benches inside the vestibule." }
        ]
      },
      {
        id: "lotb",
        name: "Lot B (accessible spaces)",
        kind: "Surface lot",
        segments: [
          { name: "Lot B to plaza", meters: 120, stairs: 0, incline: 3, surface: "Asphalt, gentle rise", rests: 0, note: "No shade. Full sun until about 8pm in summer." },
          { name: "Plaza to Gate A doors", meters: 85, stairs: 0, incline: 0, surface: "Level pavers", rests: 2, note: "" }
        ]
      },
      {
        id: "garage",
        name: "Center Street Garage",
        kind: "Structured parking",
        segments: [
          { name: "Garage level 3 to skywalk", meters: 95, stairs: 0, incline: 0, surface: "Level concrete", rests: 0, note: "Elevator from all levels to 3." },
          { name: "Skywalk crossing", meters: 210, stairs: 0, incline: 0, surface: "Enclosed, level", rests: 1, note: "Glass-walled. Gets hot in afternoon sun." },
          { name: "Skywalk to Gate C doors", meters: 60, stairs: 12, incline: 0, surface: "Stairs down, elevator adjacent", rests: 0, note: "Step-free alternative: elevator to the right of the stairs." }
        ]
      }
    ],
    sections: [
      {
        id: "102",
        name: "Section 102, Row F (aisle)",
        level: "Lower bowl",
        accessibleSeating: "integrated",
        sightline: "clear",
        companionSeating: true,
        relativeToStage: "General bowl seating, house right, roughly 45 m from the floor stage.",
        segments: [
          { name: "Gate to concourse", meters: 130, stairs: 0, incline: 0, surface: "Level, carpeted", rests: 3, note: "Crowded 30 minutes before doors." },
          { name: "Concourse to Portal 102", meters: 90, stairs: 0, incline: 0, surface: "Level", rests: 1, note: "" },
          { name: "Portal to Row F", meters: 22, stairs: 6, incline: 8, surface: "Stepped aisle, handrail on right", rests: 0, note: "Six steps down. Handrail runs the full length." }
        ]
      },
      {
        id: "218",
        name: "Section 218, Row C",
        level: "Upper bowl",
        accessibleSeating: "integrated",
        sightline: "clear",
        companionSeating: true,
        relativeToStage: "Upper bowl, house left, roughly 90 m from the floor stage.",
        segments: [
          { name: "Gate to concourse", meters: 130, stairs: 0, incline: 0, surface: "Level, carpeted", rests: 3, note: "" },
          { name: "Concourse to ramp base", meters: 75, stairs: 0, incline: 0, surface: "Level", rests: 1, note: "" },
          { name: "Spiral ramp to upper concourse", meters: 240, stairs: 0, incline: 7, surface: "Continuous ramp, no landings", rests: 0, note: "Long sustained climb with nowhere to sit." },
          { name: "Upper concourse to Portal 218", meters: 110, stairs: 0, incline: 0, surface: "Level", rests: 2, note: "" },
          { name: "Portal to Row C", meters: 18, stairs: 21, incline: 12, surface: "Steep stepped aisle", rests: 0, note: "No step-free alternative to this row." }
        ]
      },
      {
        id: "wc12",
        name: "Section 112, accessible platform",
        level: "Lower bowl",
        accessibleSeating: "segregated-platform",
        sightline: "obstructed",
        companionSeating: true,
        relativeToStage: "Raised platform at the rear of the lower bowl, house right, roughly 50 m from the floor stage.",
        segments: [
          { name: "Gate to concourse", meters: 130, stairs: 0, incline: 0, surface: "Level, carpeted", rests: 3, note: "" },
          { name: "Concourse to Portal 112", meters: 55, stairs: 0, incline: 0, surface: "Level", rests: 2, note: "" },
          { name: "Portal to platform", meters: 14, stairs: 0, incline: 2, surface: "Level entry", rests: 0, note: "Sightlines are blocked when the rows in front stand." }
        ]
      }
    ],
    detours: [
      { id: "restroom", name: "Nearest restroom", meters: 65, stairs: 0, incline: 0, note: "Two accessible stalls, shared queue." },
      { id: "guest", name: "Guest services", meters: 140, stairs: 0, incline: 0, note: "Staffed from doors until intermission." },
      { id: "concessions", name: "Nearest concessions", meters: 45, stairs: 0, incline: 0, note: "" }
    ],
    reports: [
      { date: "2026-07-28", tag: "elevator", who: "Community", text: "Gate C elevator was out on Saturday. Staff routed us the long way through Gate A. Add about ten minutes." },
      { date: "2026-07-11", tag: "correction", who: "Community", text: "Portal 102 aisle is 6 steps, not 8. Handrail is solid." },
      { date: "2026-06-30", tag: "heat", who: "Community", text: "Skywalk was brutally warm around 6pm. Went in through Gate A instead." }
    ]
  },

  {
    id: "capitol",
    name: "Capitol Theatre",
    city: "Ann Arbor, MI",
    kind: "Theatre · 1,400 seats",
    trust: "community",
    surveyed: "May 2, 2026",
    note: "Small and mostly step-free on the orchestra level. Balcony is stairs only.",
    environment: "indoor",
    sizeCategory: "theatre",
    climate: {
      type: "air-conditioned",
      description: "Air conditioned. Lobby stays cool; house warms up slightly during a full balcony show.",
      exertionBaseline: "low"
    },
    elevators: [
      { location: "Box office lobby", servesLevels: "Lobby to balcony, on request", public: true }
    ],
    restrooms: [
      { location: "Lobby, ground floor", accessibleStalls: 1, sharedQueue: false, notes: "" },
      { location: "Balcony landing", accessibleStalls: 1, sharedQueue: false, notes: "" }
    ],
    facts: [
      ["Accessible drop-off", "Main Street, directly at the doors"]
    ],
    origins: [
      {
        id: "street",
        name: "Main Street drop-off",
        kind: "Curbside",
        segments: [
          { name: "Curb to lobby", meters: 15, stairs: 0, incline: 0, surface: "Level, doors held by staff", rests: 1, note: "" }
        ]
      },
      {
        id: "lot",
        name: "Liberty Square lot",
        kind: "Structured parking",
        segments: [
          { name: "Lot to sidewalk", meters: 70, stairs: 0, incline: 2, surface: "Level, curb cut at exit", rests: 0, note: "" },
          { name: "Sidewalk to lobby", meters: 160, stairs: 0, incline: 0, surface: "City sidewalk", rests: 2, note: "Two benches along the block." }
        ]
      }
    ],
    sections: [
      {
        id: "orch",
        name: "Orchestra, Row L (aisle)",
        level: "Orchestra",
        accessibleSeating: "integrated",
        sightline: "clear",
        companionSeating: true,
        relativeToStage: "Orchestra level, center aisle, roughly 15 m from the stage apron.",
        segments: [
          { name: "Lobby to house doors", meters: 30, stairs: 0, incline: 0, surface: "Level, carpeted", rests: 2, note: "" },
          { name: "House door to Row L", meters: 18, stairs: 3, incline: 4, surface: "Gently raked aisle", rests: 0, note: "Three shallow steps." }
        ]
      },
      {
        id: "balc",
        name: "Balcony, Row B",
        level: "Balcony",
        accessibleSeating: "integrated",
        sightline: "clear",
        companionSeating: true,
        relativeToStage: "Balcony front row, roughly 20 m from and above the stage.",
        segments: [
          { name: "Lobby to stairwell", meters: 25, stairs: 0, incline: 0, surface: "Level", rests: 1, note: "" },
          { name: "Stairwell to balcony", meters: 30, stairs: 34, incline: 0, surface: "Two flights, landing between", rests: 1, note: "Elevator available on request at the box office." },
          { name: "Balcony door to Row B", meters: 12, stairs: 4, incline: 6, surface: "Stepped aisle", rests: 0, note: "" }
        ]
      }
    ],
    detours: [
      { id: "restroom", name: "Nearest restroom", meters: 40, stairs: 0, incline: 0, note: "One accessible stall." },
      { id: "guest", name: "Box office", meters: 35, stairs: 0, incline: 0, note: "" }
    ],
    reports: [
      { date: "2026-06-19", tag: "good", who: "Community", text: "Asked at the box office and they walked us in through the side door. Skipped the lobby crowd entirely." }
    ]
  },

  {
    id: "meadow",
    name: "Meadowbrook Pavilion",
    city: "Rochester, MI",
    kind: "Outdoor amphitheatre · 7,700 seats",
    trust: "unverified",
    surveyed: "Not yet surveyed",
    note: "Outdoor. Route data submitted by one contributor and not yet confirmed.",
    environment: "outdoor",
    sizeCategory: "arena",
    climate: {
      type: "outdoor-full-sun",
      description: "Open air. No shade over the lawn or the walk in from the north lot; the covered pavilion seating itself is shaded.",
      exertionBaseline: "high"
    },
    elevators: [],
    restrooms: [
      { location: "Near the north gate", accessibleStalls: 0, sharedQueue: true, notes: "Portable units. No confirmed accessible stall — unverified." }
    ],
    facts: [
      ["Accessible drop-off", "Reported near the north gate, unconfirmed"]
    ],
    origins: [
      {
        id: "northlot",
        name: "North lot",
        kind: "Grass lot",
        segments: [
          { name: "Lot to north gate", meters: 300, stairs: 0, incline: 5, surface: "Packed gravel and grass, uneven", rests: 0, note: "No seating along this stretch." }
        ]
      }
    ],
    sections: [
      {
        id: "pav",
        name: "Pavilion, Row 12",
        level: "Covered seating",
        accessibleSeating: "integrated",
        sightline: "clear",
        companionSeating: true,
        relativeToStage: "Covered pavilion, center block, roughly 40 m from the stage.",
        segments: [
          { name: "Gate to pavilion entry", meters: 180, stairs: 0, incline: 4, surface: "Paved path, downhill", rests: 1, note: "" },
          { name: "Entry to Row 12", meters: 25, stairs: 14, incline: 9, surface: "Stepped aisle", rests: 0, note: "" }
        ]
      }
    ],
    detours: [
      { id: "restroom", name: "Nearest restroom", meters: 120, stairs: 0, incline: 0, note: "Portable units, no confirmed accessible stall." }
    ],
    reports: []
  }
];

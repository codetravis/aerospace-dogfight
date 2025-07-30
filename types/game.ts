export type UnitType = "fighter" | "bomber" | "interceptor" | "scout" | "heavy_fighter"

export interface PilotSkills {
  composure: number // Affects starting morale and morale recovery
  control: number // Affects evasion chance
  gunnery: number // Affects accuracy
  guts: number // Affects max strain (future use)
}

export interface Pilot {
  id: string // Unique ID for the pilot
  name: string // Pilot's name
  skills: PilotSkills
  morale: number
  maxMorale: number
  strain: number // Add strain to pilot
  experience: number // New: Pilot experience points
  level: number // New: Pilot level
}

export interface Unit {
  id: string
  x: number
  y: number
  angle: number // in radians
  health: number
  maxHealth: number
  shield: number
  maxShield: number
  agility: number // Renamed from maneuverability
  acceleration: number
  maxSpeed: number
  speed: number // 0-6 scale, represents ship lengths traveled over 30 ticks
  team: "player" | "enemy"
  unitType: UnitType
  weaponRange: number
  burst: number // New: Number of attacks per fire action
  pilot: Pilot // Add pilot to unit
  maxStrain: number // Derived from pilot's Guts skill
  size: number

  // Planning phase inputs
  plannedManeuver:
    | "straight"
    | "bank-left"
    | "bank-right"
    | "turn-left"
    | "turn-right"
    | "one-eight-oh"
    | "skid-left"
    | "skid-right" // Add new maneuvers
  plannedSpeedChange: "accelerate" | "accelerate-2" | "decelerate" | "decelerate-2" | "maintain"
  targetMode: "fire-at-will" | "target-specific"
  specificTarget?: string

  // Maneuver tracking
  maneuverProgress: number // 0 to 1, tracks completion of current maneuver
  initialAngle: number // Starting angle for the current maneuver
  finalOrientationChange: number // Total angle change for the final orientation of the ship (from initialAngle)
  maneuverPathAngleChange: number // Total angle change for the path curvature during the maneuver (from initialAngle)

  // Weapon system
  weaponCharge: number // 0 to 15, weapon fires when it reaches 15
  maxWeaponCharge: number // Maximum charge needed to fire (15 ticks)

  // Weapon fire tracking
  firingLine: {
    fromX: number
    fromY: number
    toX: number
    toY: number
    ticksRemaining: number
    hasTarget: boolean // true if firing at valid target, false if firing at will with no target
  } | null

  // State
  isDestroyed: boolean
  isEscaped: boolean // New: True if unit has successfully escaped the mission
}

export type MissionType = "dogfight" | "escort" | "intercept" | "lone-wolf" | "recon"
export type MissionStatus = "pending" | "active" | "completed" | "failed"

// New: Mission Objective Types
export type ObjectiveType = "destroy-units" | "reach-zone-and-return" | "visit-multiple-zones-and-return" // Extend with new type

export interface DestroyUnitsObjective {
  type: "destroy-units"
  targetUnitIds?: string[] // Optional: specific unit IDs to destroy (e.g., "Enemy-Bomber-Alpha")
  targetUnitTypes?: UnitType[] // Optional: specific unit types to destroy (e.g., ["bomber"])
  count: number // Number of units/types to destroy
  isCompleted: boolean // Track completion status
  description: string // User-friendly description
}

export interface VisitMultipleZonesAndReturnObjective {
  type: "visit-multiple-zones-and-return"
  targetUnitIds: string[] // IDs of units that need to visit zones and return (e.g., the Scout)
  targetZones: Array<{ id: string; x: number; y: number; radius: number }> // Multiple target zones
  escapeZone: { x: number; y: number; width: number; height: number } // Escape zone
  hasVisitedZone: { [zoneId: string]: boolean } // Track if each target zone has been visited
  hasEscapedZone: { [unitId: string]: boolean } // Track if the unit has reached the escape zone
  isCompleted: boolean // Overall completion for this objective
  description: string
}

export interface ReachZoneAndReturnObjective {
  type: "reach-zone-and-return"
  targetUnitIds: string[] // IDs of units that need to reach the zone and return
  targetZone: { x: number; y: number; radius: number }
  escapeZone: { x: number; y: number; width: number; height: number } // New: Escape zone
  hasReachedZone: { [unitId: string]: boolean } // Track if each unit has reached the target zone
  hasEscapedZone: { [unitId: string]: boolean } // New: Track if each unit has reached the escape zone
  isCompleted: boolean // Overall completion for this objective
  description: string
}

// Union type for all possible objectives
export type MissionObjective = DestroyUnitsObjective | ReachZoneAndReturnObjective | VisitMultipleZonesAndReturnObjective

export interface Mission {
  id: string
  type: MissionType
  name: string
  description: string
  enemyUnits: Unit[] // Pre-defined enemy units for this mission
  assignedUnitIds: string[] // IDs of player units assigned from barracks
  assignedPilotIds: string[] // IDs of player pilots assigned from barracks
  status: MissionStatus
  objectives: MissionObjective[] // New: Objectives for this mission
  playerUnitLimit: number // New: Max player units assignable to this mission
  playerPilotLimit: number // New: Max player pilots assignable to this mission
  escortTargetUnitIds?: string[] // New: IDs of player units that, if destroyed, cause mission failure
  isPlayed: boolean // New: Track if mission has been attempted/passed in the current round
  victoryPointsAward?: {
    player?: number // Default VP for player victory
    enemy?: number // Default VP for enemy victory
    perEscapedBomber?: number // VP per bomber that escapes (for escort missions)
    perDestroyedBomber?: number // VP per bomber that is destroyed (for escort missions)
  } // New: How many victory points this mission is worth
}

export interface CampaignState {
  playerUnitsInBarracks: Unit[] // Units available for missions and leveling
  playerPilotsInBarracks: Pilot[] // Pilots available for missions and leveling
  availableMissions: Mission[]
  roundMissions: Mission[] // New: Missions for the current round
  currentMissionId: string | null // The mission currently being played/resolved
  victoryPoints: { player: number; enemy: number } // New: Track victory points
}

export type GamePhase =
  | "main-menu"
  | "skirmish-setup"
  | "campaign-menu"
  | "barracks"
  | "mission-planning" // New phase
  | "planning"
  | "resolution"
  | "game-over"

export interface Asteroid {
  id: string
  x: number
  y: number
  points: Vector2[] // Array of points defining the polygon shape
  radius: number // Max radius for simplified collision detection
  collidedUnitsThisPhase: string[] // Track units that have collided with this asteroid in the current resolution phase
}

export interface GameState {
  phase: GamePhase
  currentTurn: number
  units: Unit[]
  selectedUnit: string | null
  resolutionTick: number
  maxResolutionTicks: number
  winner: "player" | "enemy" | null
  campaignState?: CampaignState // Optional campaign state
  asteroids: Asteroid[] // New: Asteroids on the battlefield
}

export interface Vector2 {
  x: number
  y: number
}

export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

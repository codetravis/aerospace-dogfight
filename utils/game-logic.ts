import type {
  Point,
  Rectangle,
  Pilot,
  Unit,
  UnitType,
  Vector2,
  PilotSkills,
  Mission,
  MissionType,
  MissionObjective,
  Asteroid,
  ReachZoneAndReturnObjective,
  VisitMultipleZonesAndReturnObjective, // Import new objective type
} from "../types/game"

const SHIP_LENGTH = 30 // pixels - visual length of a ship
const UNIT_COLLISION_RADIUS = 20 // Approximate half-width/height of unit for collision

export function getUnitTypeStats(unitType: UnitType) {
  switch (unitType) {
    case "fighter":
      return {
        maxSpeed: 5,
        health: 80,
        shield: 30,
        weaponRange: 120,
        canAccelerate2: true,
        canDecelerate2: false,
        agility: 4, // Fighter agility
        maxWeaponCharge: 15, // Fighter weapon charge
        damage: 25, // Fighter damage
        burst: 2, // Fighter burst value
        size: 20,
      }
    case "bomber":
      return {
        maxSpeed: 3,
        health: 150,
        shield: 80,
        weaponRange: 180,
        canAccelerate2: false,
        canDecelerate2: false,
        agility: 2, // Bomber agility
        maxWeaponCharge: 40, // Bomber weapon charge
        damage: 50, // Bomber damage
        burst: 1, // Bomber burst value
        size: 30,
      }
    case "interceptor":
      return {
        maxSpeed: 6,
        health: 60,
        shield: 20,
        weaponRange: 100,
        canAccelerate2: true,
        canDecelerate2: true,
        agility: 5, // Interceptor agility
        maxWeaponCharge: 8, // Interceptor weapon charge
        damage: 7, // Interceptor damage
        burst: 3, // Interceptor burst value
        size: 20,
      }
    case "scout":
      return {
        maxSpeed: 5,
        health: 40,
        shield: 30,
        weaponRange: 100,
        canAccelrate2: true,
        canDecelerate2: false,
        agility: 5,
        maxWeaponCharge: 30,
        damage: 10,
        burst: 1,
        size: 15,
      }
    case "heavy_fighter":
      return {
        maxSpeed: 4,
        health: 100,
        shield: 40,
        weaponRange: 120,
        canAccelerate2: false,
        canDecelerate2: false,
        agility: 3,
        maxWeaponCharge: 15,
        damage: 25,
        burst: 3,
        size: 25,
      }
  }
}

export function getManeuverRequirements(
  maneuver: Unit["plannedManeuver"],
  currentSpeed: number,
): { agility: number; difficulty: number } {
  switch (maneuver) {
    case "straight":
      return { agility: 0, difficulty: 0 }
    case "bank-left":
    case "bank-right":
      return { agility: 1, difficulty: 1 }
    case "turn-left":
    case "turn-right":
      let agility = 2
      if (currentSpeed === 1 || currentSpeed > 3) {
        agility += 1
      }
      return { agility: agility, difficulty: 2 }
    case "one-eight-oh":
      return { agility: 5, difficulty: 7 }
    case "skid-left":
    case "skid-right":
      return { agility: 3, difficulty: 4 }
    default:
      // For unknown maneuvers, set high requirements to make them impossible
      return { agility: 999, difficulty: 999 }
  }
}

export function createUnit(
  id: string,
  x: number,
  y: number,
  angle: number,
  team: "player" | "enemy",
  unitType: UnitType,
  customSkills?: { composure: number; control: number; gunnery: number; guts: number },
  pilotName?: string, // New optional parameter for pilot name
  pilotId?: string, // New optional parameter for pilot ID
): Unit {
  const stats = getUnitTypeStats(unitType)

  // Default pilot skills (can be customized later)
  const defaultSkills = {
    composure: 1,
    control: 1,
    gunnery: 1,
    guts: 1,
  }

  const pilotSkills = customSkills || defaultSkills

  // Calculate pilot-derived stats
  const baseStartingMorale = 40
  const startingMorale = baseStartingMorale + pilotSkills.composure * 5
  const maxMorale = 120 // Fixed max morale
  const maxStrain = Math.floor(pilotSkills.guts / 2) + 1 // +1 to ensure at least 1 max strain

  return {
    id,
    x,
    y,
    angle,
    health: stats.health,
    maxHealth: stats.health,
    shield: stats.shield,
    maxShield: stats.shield,
    agility: stats.agility, // Use the agility from stats
    acceleration: 2, // This value is currently unused, but kept for consistency
    maxSpeed: stats.maxSpeed,
    speed: 1, // Default speed of 1 ship length
    size: stats.size,
    team,
    unitType,
    weaponRange: stats.weaponRange,
    burst: stats.burst, // Initialize burst from stats
    pilot: {
      id: pilotId || `${id}-pilot`, // Unique ID for the pilot
      name: pilotName || `${unitType.charAt(0).toUpperCase() + unitType.slice(1)} Pilot ${id.split("-").pop()}`, // Default name
      skills: pilotSkills,
      morale: startingMorale,
      maxMorale: maxMorale,
      strain: 0, // Initialize strain to 0
      experience: 0, // New: Initialize experience
      level: 1, // New: Initialize level
    },
    maxStrain: maxStrain,
    plannedManeuver: "straight", // Default maneuver is straight
    plannedSpeedChange: "maintain",
    targetMode: "fire-at-will",
    specificTarget: undefined, // Initialize specific target
    maneuverProgress: 0,
    initialAngle: angle,
    finalOrientationChange: 0, // Initialize new property
    maneuverPathAngleChange: 0, // Initialize new property
    weaponCharge: 0, // Start with no charge
    maxWeaponCharge: stats.maxWeaponCharge, // Use unit type specific max weapon charge
    firingLine: null,
    isDestroyed: false,
    isEscaped: false, // Initialize new property
  }
}

// New utility function to calculate effective speed based on planned speed change
export function calculateEffectiveSpeed(
  currentSpeed: number,
  plannedSpeedChange: Unit["plannedSpeedChange"],
  maxSpeed: number,
): number {
  let effectiveSpeed = currentSpeed
  switch (plannedSpeedChange) {
    case "accelerate":
      effectiveSpeed = Math.min(currentSpeed + 1, maxSpeed)
      break
    case "accelerate-2":
      effectiveSpeed = Math.min(currentSpeed + 2, maxSpeed)
      break
    case "decelerate":
      effectiveSpeed = Math.max(currentSpeed - 1, 1)
      break
    case "decelerate-2":
      effectiveSpeed = Math.max(currentSpeed - 2, 1)
      break
    case "maintain":
      // Speed stays the same
      break
  }
  return effectiveSpeed
}

export function initializeManeuver(unit: Unit, maxTicks: number): Unit {
  const newUnit = { ...unit }
  newUnit.maneuverProgress = 0
  newUnit.initialAngle = unit.angle

  // Calculate effective speed for the maneuver based on planned speed change
  const effectiveSpeed = calculateEffectiveSpeed(unit.speed, unit.plannedSpeedChange, unit.maxSpeed)
  newUnit.speed = effectiveSpeed // Apply the speed change to the newUnit

  const maneuverRequirements = getManeuverRequirements(unit.plannedManeuver, newUnit.speed) // Pass newUnit.speed
  const pilotControl = unit.pilot.skills.control

  let actualManeuver = unit.plannedManeuver
  let newStrain = unit.pilot.strain
  let newFinalOrientationChange = 0 // Total angle change for the final orientation
  let newManeuverPathAngleChange = 0 // Total angle change for the path curvature

  // --- Maneuver Validity Checks (Order matters!) ---

  // 1. Check speed requirement for "one-eight-oh"
  if (unit.plannedManeuver === "one-eight-oh" && newUnit.speed < 3) {
    actualManeuver = "straight"
    console.log(
      `${unit.id} cannot perform ${unit.plannedManeuver} (Requires Speed 3+, Has ${newUnit.speed}). Reverting to Straight.`,
    )
  }
  // 2. Check if the ship has enough agility for the maneuver
  else if (maneuverRequirements.agility > newUnit.agility) {
    actualManeuver = "straight" // Ship cannot perform this maneuver
    console.log(
      `${unit.id} cannot perform ${unit.plannedManeuver} (Requires Agility ${maneuverRequirements.agility}, Has ${newUnit.agility}). Reverting to Straight.`,
    )
  }
  // 3. New: Check if maneuver difficulty is more than 1 greater than pilot's control
  else if (maneuverRequirements.difficulty > pilotControl + 1) {
    actualManeuver = "straight" // Maneuver is too difficult for the pilot's skill limit
    console.log(
      `${unit.id} (Pilot ${unit.pilot.morale} morale, ${unit.pilot.strain}/${unit.maxStrain} strain) cannot perform ${unit.plannedManeuver} (Difficulty ${maneuverRequirements.difficulty}, Pilot Control ${pilotControl}). Reverting to Straight.`,
    )
  }
  // 4. Check pilot control and strain (only if difficulty is exactly 1 greater than control)
  else if (maneuverRequirements.difficulty > pilotControl) {
    // Maneuver is difficult for the pilot's control skill (exactly 1 greater)
    if (unit.pilot.strain >= unit.maxStrain) {
      // Pilot is already at max strain and cannot perform this difficult maneuver
      actualManeuver = "straight" // Revert to straight
      console.log(
        `${unit.id} (Pilot ${unit.pilot.morale} morale, ${unit.pilot.strain}/${unit.maxStrain} strain) cannot perform ${unit.plannedManeuver} (Requires Control ${maneuverRequirements.difficulty}, Has ${pilotControl}) due to max strain. Reverting to Straight.`,
      )
    } else {
      // Pilot gains strain
      newStrain = Math.min(unit.pilot.strain + 1, unit.maxStrain) // Cap strain at maxStrain
      console.log(
        `${unit.id} (Pilot ${unit.pilot.morale} morale, ${unit.pilot.strain}/${unit.maxStrain} strain) performs ${unit.plannedManeuver} (Requires Control ${maneuverRequirements.difficulty}, Has ${pilotControl}), gains 1 strain. New strain: ${newStrain}`,
      )
    }
  } else {
    // Maneuver is easy enough for pilot control, remove strain
    newStrain = Math.max(unit.pilot.strain - 1, 0)
    if (unit.pilot.strain > 0) {
      console.log(
        `${unit.id} (Pilot ${unit.pilot.morale} morale, ${unit.pilot.strain}/${unit.maxStrain} strain) performs ${unit.plannedManeuver} (Requires Control ${maneuverRequirements.difficulty}, Has ${pilotControl}), removes 1 strain. New strain: ${newStrain}`,
      )
    }
  }

  newUnit.pilot = { ...newUnit.pilot, strain: newStrain }
  newUnit.plannedManeuver = actualManeuver // Update the planned maneuver if it was reverted

  // Set final orientation change and maneuver path angle change
  switch (newUnit.plannedManeuver) {
    case "bank-left":
      newFinalOrientationChange = -Math.PI / 4 // -45 degrees
      newManeuverPathAngleChange = -Math.PI / 4
      break
    case "bank-right":
      newFinalOrientationChange = Math.PI / 4 // 45 degrees
      newManeuverPathAngleChange = Math.PI / 4
      break
    case "turn-left":
      newFinalOrientationChange = -Math.PI / 2 // -90 degrees
      newManeuverPathAngleChange = -Math.PI / 2
      break
    case "turn-right":
      newFinalOrientationChange = Math.PI / 2 // 90 degrees
      newManeuverPathAngleChange = Math.PI / 2
      break
    case "one-eight-oh":
      newFinalOrientationChange = Math.PI // 180 degrees
      newManeuverPathAngleChange = 0 // Straight path
      break
    case "skid-left": // Skid Left: 90 degrees left final rotation, but bank-like path
      newFinalOrientationChange = -Math.PI / 4 - Math.PI / 2 // Path is -45 deg, final is -90 deg from path end
      newManeuverPathAngleChange = -Math.PI / 4 // Path is a 45-degree bank left
      break
    case "skid-right": // Skid Right: 90 degrees right final rotation, but bank-like path
      newFinalOrientationChange = Math.PI / 4 + Math.PI / 2 // Path is +45 deg, final is +90 deg from path end
      newManeuverPathAngleChange = Math.PI / 4 // Path is a 45-degree bank right
      break
    case "straight":
    default:
      newFinalOrientationChange = 0
      newManeuverPathAngleChange = 0
      break
  }
  newUnit.finalOrientationChange = newFinalOrientationChange
  newUnit.maneuverPathAngleChange = newManeuverPathAngleChange

  return newUnit
}

export function updateUnitPosition(unit: Unit, deltaTime: number, maxTicks: number): Unit {
  const newUnit = { ...unit }

  // Speed is now constant throughout the phase - no mid-phase speed changes

  // Update maneuver progress (0 to 1 over the entire resolution phase)
  const progressIncrement = 1 / maxTicks
  newUnit.maneuverProgress = Math.min(unit.maneuverProgress + progressIncrement, 1)

  // Calculate movement distance per tick (same for all maneuvers)
  const totalDistanceInPixels = unit.speed * SHIP_LENGTH // Use the speed set at phase start
  const moveDistancePerTick = totalDistanceInPixels / maxTicks

  // Calculate the angle for movement based on the current maneuverPathAngleChange and progress
  let currentMovementAngle = unit.initialAngle
  if (newUnit.maneuverPathAngleChange !== 0) {
    currentMovementAngle = unit.initialAngle + newUnit.maneuverPathAngleChange * newUnit.maneuverProgress
  }

  // Update position based on the current movement angle
  newUnit.x += Math.cos(currentMovementAngle) * moveDistancePerTick
  newUnit.y += Math.sin(currentMovementAngle) * moveDistancePerTick

  // Update the unit's displayed angle during the maneuver.
  // For One-Eight-Oh and Skid, the final orientation change is applied at the very end of the phase
  // in handleEndResolution. During the phase, the ship visually follows its path.
  newUnit.angle = currentMovementAngle

  // Update weapon charge (charges every tick)
  if (newUnit.weaponCharge < newUnit.maxWeaponCharge) {
    newUnit.weaponCharge++
  }

  // Update firing line countdown
  if (newUnit.firingLine && newUnit.firingLine.ticksRemaining > 0) {
    newUnit.firingLine.ticksRemaining--
    if (newUnit.firingLine.ticksRemaining <= 0) {
      newUnit.firingLine = null
    }
  }

  return newUnit
}

export function isInAttackRange(attacker: Unit, target: Unit): boolean {
  // Calculate relative position
  const dx = target.x - attacker.x
  const dy = target.y - attacker.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // First check: Must be within weapon range
  if (distance > attacker.weaponRange) {
    return false
  }

  // Second check: Must be in front of the attacker using dot product
  // Calculate the forward direction vector of the attacker
  const forwardX = Math.cos(attacker.angle)
  const forwardY = Math.sin(attacker.angle)

  // Calculate the direction vector from attacker to target
  const toTargetX = dx / distance // Normalized
  const toTargetY = dy / distance // Normalized

  // Calculate dot product to see if target is in front
  const dotProduct = forwardX * toTargetX + forwardY * toTargetY

  // Target must be in front (dot product > cos(30°) ≈ 0.866 for 60° total cone)
  const minDotProduct = Math.cos(Math.PI / 6) // 30 degrees
  if (dotProduct < minDotProduct) {
    return false
  }

  // Third check: Must be within the targeting rectangle width
  // Calculate the perpendicular distance from the target to the attacker's forward line
  // Using cross product to find perpendicular distance
  const crossProduct = Math.abs(forwardX * dy - forwardY * dx)
  const rectangleHalfWidth = 20

  if (crossProduct > rectangleHalfWidth) {
    return false
  }

  return true
}

export function rollAttack(
  attackerGunnery: number,
  attackerMorale: number,
  targetControl: number,
  targetSpeed: number,
): boolean {
  const baseAccuracy = 0.5 // Base accuracy is now 50%
  const gunneryBonus = attackerGunnery * 0.04 // +4% accuracy per Gunnery level
  let effectiveAccuracy = baseAccuracy + gunneryBonus

  // Morale accuracy bonuses/penalties
  if (attackerMorale >= 75) {
    effectiveAccuracy += 0.05 // +5% accuracy
  }
  if (attackerMorale >= 100) {
    effectiveAccuracy += 0.05 // Additional +5% accuracy
  }
  if (attackerMorale <= 25) {
    effectiveAccuracy -= 0.05 // -5% accuracy
  }

  // Clamp effectiveAccuracy between 0 and 1
  effectiveAccuracy = Math.max(0, Math.min(1, effectiveAccuracy))

  const baseEvasionChance = targetControl * 0.02 // +2% evasion per Control level
  const speedEvasionBonus = targetSpeed * 0.02 // +2% evasion per Speed level
  const totalEvasionChance = baseEvasionChance + speedEvasionBonus

  // Roll for evasion first
  const evaded = Math.random() < totalEvasionChance
  if (evaded) {
    return false // Attack misses due to evasion
  }

  // If not evaded, roll for hit based on effective accuracy
  return Math.random() < effectiveAccuracy
}

export function dealDamage(target: Unit, damage: number): Unit {
  const newTarget = { ...target }

  if (newTarget.shield > 0) {
    const shieldDamage = Math.min(damage, newTarget.shield)
    newTarget.shield -= shieldDamage
    damage -= shieldDamage
  }

  if (damage > 0) {
    newTarget.health -= damage
    if (newTarget.health <= 0) {
      newTarget.health = 0
      newTarget.isDestroyed = true
    }
  }

  return newTarget
}

export function findBestTarget(unit: Unit, enemies: Unit[]): Unit | null {
  // Filter enemies that are in attack range
  const validTargets = enemies.filter((enemy) => !enemy.isDestroyed && isInAttackRange(unit, enemy))

  if (validTargets.length === 0) return null

  // Find closest target within the valid targeting area
  return validTargets.reduce((closest, current) => {
    const distToCurrent = Math.sqrt(Math.pow(current.x - unit.x, 2) + Math.pow(current.y - unit.y, 2))
    const distToClosest = Math.sqrt(Math.pow(closest.x - unit.x, 2) + Math.pow(closest.y - unit.y, 2))
    return distToCurrent < distToClosest ? current : closest
  })
}

export function createFiringLine(fromUnit: Unit, target: Unit, hit: boolean): Unit {
  const newUnit = { ...fromUnit }

  // Create firing line showing hit or miss
  newUnit.firingLine = {
    fromX: fromUnit.x,
    fromY: fromUnit.y,
    toX: target.x,
    toY: target.y,
    ticksRemaining: 3,
    hasTarget: hit, // true for hits (solid line), false for misses (dotted line)
  }

  // Reset weapon charge after firing
  newUnit.weaponCharge = 0

  return newUnit
}

export function canFireWeapon(unit: Unit): boolean {
  return unit.weaponCharge >= unit.maxWeaponCharge
}

// Moved from PlanningPanel
export function getSpeedLabel(speed: number | Unit["unitType"]) {
  if (typeof speed === "string") {
    switch (speed) {
      case "fighter":
        return "Fighter"
      case "bomber":
        return "Bomber"
      case "interceptor":
        return "Interceptor"
      case "scout":
        return "Scout"
      case "heavy_fighter":
        return "Heavy Fighter"
    }
  }
  switch (speed) {
    case 0:
      return "0 - Stationary"
    case 1:
      return "1 - Slow"
    case 2:
      return "2 - Cruise"
    case 3:
      return "3 - Fast"
    case 4:
      return "4 - Very Fast"
    case 5:
      return "5 - Maximum"
    case 6:
      return "6 - Afterburner"
    default:
      return `${speed}`
  }
}

// New utility function to get possible target speeds for the UI
export function getPossibleTargetSpeeds(
  currentSpeed: number,
  maxSpeed: number,
  unitType: UnitType,
): Array<{ value: number; label: string; plannedChange: Unit["plannedSpeedChange"] }> {
  const options: Array<{ value: number; label: string; plannedChange: Unit["plannedSpeedChange"] }> = []
  const stats = getUnitTypeStats(unitType)

  // Maintain current speed
  options.push({ value: currentSpeed, label: getSpeedLabel(currentSpeed) + " (Maintain)", plannedChange: "maintain" })

  // Accelerate +1
  if (currentSpeed < maxSpeed) {
    const targetSpeed = Math.min(currentSpeed + 1, maxSpeed)
    options.push({
      value: targetSpeed,
      label: getSpeedLabel(targetSpeed) + " (Accelerate +1)",
      plannedChange: "accelerate",
    })
  }

  // Accelerate +2
  if (stats.canAccelerate2 && currentSpeed < maxSpeed - 1) {
    const targetSpeed = Math.min(currentSpeed + 2, maxSpeed)
    options.push({
      value: targetSpeed,
      label: getSpeedLabel(targetSpeed) + " (Accelerate +2)",
      plannedChange: "accelerate-2",
    })
  } else if (stats.canAccelerate2 && currentSpeed === maxSpeed - 1) {
    // If accelerate-2 would hit max speed, still offer it but mark as accelerate-2
    const targetSpeed = maxSpeed
    options.push({
      value: targetSpeed,
      label: getSpeedLabel(targetSpeed) + " (Accelerate +2)",
      plannedChange: "accelerate-2",
    })
  }

  // Decelerate -1
  if (currentSpeed > 1) {
    const targetSpeed = Math.max(currentSpeed - 1, 1)
    options.push({
      value: targetSpeed,
      label: getSpeedLabel(targetSpeed) + " (Decelerate -1)",
      plannedChange: "decelerate",
    })
  }

  // Decelerate -2
  if (stats.canDecelerate2 && currentSpeed > 2) {
    const targetSpeed = Math.max(currentSpeed - 2, 1)
    options.push({
      value: targetSpeed,
      label: getSpeedLabel(targetSpeed) + " (Decelerate -2)",
      plannedChange: "decelerate-2",
    })
  } else if (stats.canDecelerate2 && currentSpeed <= 2 && currentSpeed > 1) {
    // If decelerate-2 would hit min speed (1), still offer it but mark as decelerate-2
    const targetSpeed = 1
    options.push({
      value: targetSpeed,
      label: getSpeedLabel(targetSpeed) + " (Decelerate -2)",
      plannedChange: "decelerate-2",
    })
  }

  // Sort by speed value
  options.sort((a, b) => a.value - b.value)

  // Filter out duplicates, keeping the option that represents the "most direct" way to that speed
  // Priority: maintain > accelerate > accelerate-2 > decelerate > decelerate-2
  const uniqueOptionsMap = new Map<
    number,
    { value: number; label: string; plannedChange: Unit["plannedSpeedChange"] }
  >()
  const order = { maintain: 0, accelerate: 1, "accelerate-2": 2, decelerate: 3, "decelerate-2": 4 }

  options.forEach((opt) => {
    if (
      !uniqueOptionsMap.has(opt.value) ||
      order[opt.plannedChange] < order[uniqueOptionsMap.get(opt.value)!.plannedChange]
    ) {
      uniqueOptionsMap.set(opt.value, opt)
    }
  })

  return Array.from(uniqueOptionsMap.values())
}

export function calculatePlannedPath(unit: Unit, maxTicks: number): Vector2[] {
  const path: Vector2[] = []
  let simulatedUnit = { ...unit } // Start with a clone of the current unit state

  // Apply initial maneuver setup (speed change, initial angle, final orientation, path angle change)
  // Note: Strain logic is applied here, potentially changing plannedManeuver
  simulatedUnit = initializeManeuver(simulatedUnit, maxTicks)

  path.push({ x: simulatedUnit.x, y: simulatedUnit.y })

  // Simulate movement for each tick of the resolution phase
  for (let i = 0; i < maxTicks; i++) {
    const progress = (i + 1) / maxTicks // Progress at the end of this tick

    // Calculate the angle for movement based on simulatedUnit.maneuverPathAngleChange
    let currentMovementAngle = simulatedUnit.initialAngle
    if (simulatedUnit.maneuverPathAngleChange !== 0) {
      currentMovementAngle = simulatedUnit.initialAngle + simulatedUnit.maneuverPathAngleChange * progress
    }

    const totalDistanceInPixels = simulatedUnit.speed * SHIP_LENGTH
    const moveDistancePerTick = totalDistanceInPixels / maxTicks

    simulatedUnit.x += Math.cos(currentMovementAngle) * moveDistancePerTick
    simulatedUnit.y += Math.sin(currentMovementAngle) * moveDistancePerTick

    path.push({ x: simulatedUnit.x, y: simulatedUnit.y })
  }

  // After the path is fully simulated, apply the final orientation change to the *last point's angle*
  // This is crucial for the path visualization to show the final orientation correctly.
  simulatedUnit.angle = simulatedUnit.initialAngle + simulatedUnit.finalOrientationChange

  return path
}

export function getDistance(unit1: { x: number; y: number }, unit2: { x: number; y: number }): number {
  const dx = unit1.x - unit2.x
  const dy = unit1.y - unit2.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function simulateManeuverOutcome(
  unit: Unit,
  plannedManeuver: Unit["plannedManeuver"],
  plannedSpeedChange: Unit["plannedSpeedChange"],
  maxTicks: number,
  asteroids: Asteroid[], // New parameter for asteroids
): { simulatedUnit: Unit; collidedWithAsteroid: boolean } {
  // Create a temporary unit with the planned maneuver and speed change
  let tempUnit: Unit = {
    ...unit,
    plannedManeuver,
    plannedSpeedChange,
    maneuverProgress: 0, // Reset for simulation
    weaponCharge: 0, // Reset weapon charge for simulation, as it's not relevant to movement outcome
    firingLine: null, // Reset firing line for simulation
  }

  // Initialize the maneuver (this applies speed change, checks validity, and sets initialAngle, finalOrientationChange, maneuverPathAngleChange)
  tempUnit = initializeManeuver(tempUnit, maxTicks)

  let collidedWithAsteroid = false

  // Simulate movement over maxTicks and check for collisions along the path
  for (let i = 0; i < maxTicks; i++) {
    tempUnit = updateUnitPosition(tempUnit, 1, maxTicks) // deltaTime is 1 tick

    // Check for asteroid collisions at each step of the simulation
    for (const asteroid of asteroids) {
      collidedWithAsteroid = CollisionDetector.polygonRectangleCollision(asteroid.points, getUnitPolygon(tempUnit))
      if (collidedWithAsteroid) {
        break // Collision detected, no need to check other asteroids for this tick
      }
    }
    if (collidedWithAsteroid) {
      break // Collision detected, no need to simulate further ticks
    }
  }

  // Apply the final orientation change at the end of the simulation
  tempUnit.angle = tempUnit.initialAngle + tempUnit.finalOrientationChange

  return { simulatedUnit: tempUnit, collidedWithAsteroid }
}

// --- Campaign Specific Functions ---

export function generateUnitsForSetup(setupType: string): Unit[] {
  switch (setupType) {
    case "dogfight":
      return [
        createUnit("Player-Fighter-1", 100, 250, 0, "player", "fighter"),
        createUnit("Player-Fighter-2", 100, 350, 0, "player", "fighter"),
        createUnit("Enemy-Fighter-1", 700, 250, Math.PI, "enemy", "fighter"),
        createUnit("Enemy-Fighter-2", 700, 350, Math.PI, "enemy", "fighter"),
      ]
    case "escort":
      return [
        createUnit("Player-Bomber-1", 100, 200, 0, "player", "bomber"),
        createUnit("Player-Bomber-2", 100, 400, 0, "player", "bomber"),
        createUnit("Player-Fighter-1", 150, 250, 0, "player", "fighter"),
        createUnit("Player-Fighter-2", 150, 350, 0, "player", "fighter"),
        createUnit("Enemy-Interceptor-1", 700, 150, Math.PI, "enemy", "interceptor"),
        createUnit("Enemy-Interceptor-2", 700, 300, Math.PI, "enemy", "interceptor"),
        createUnit("Enemy-Interceptor-3", 700, 450, Math.PI, "enemy", "interceptor"),
      ]
    case "intercept":
      return [
        createUnit("Player-Interceptor-1", 100, 150, 0, "player", "interceptor"),
        createUnit("Player-Interceptor-2", 100, 300, 0, "player", "interceptor"),
        createUnit("Player-Interceptor-3", 100, 450, 0, "player", "interceptor"),
        createUnit("Enemy-Fighter-1", 700, 250, Math.PI, "enemy", "fighter"),
        createUnit("Enemy-Fighter-2", 700, 350, Math.PI, "enemy", "fighter"),
        createUnit("Enemy-Bomber-Target", 650, 300, Math.PI, "enemy", "bomber"), // Specific target bomber
        createUnit("Enemy-Bomber-2", 650, 400, Math.PI, "enemy", "bomber"),
      ]
    case "lone-wolf":
      return [
        createUnit("Player-Fighter-1", 100, 300, 0, "player", "fighter", {
          composure: 10,
          control: 10,
          gunnery: 10,
          guts: 10,
        }),
        createUnit("Enemy-Bomber-1", 700, 100, Math.PI, "enemy", "bomber"),
        createUnit("Enemy-Bomber-2", 700, 250, Math.PI, "enemy", "bomber"),
        createUnit("Enemy-Bomber-3", 700, 400, Math.PI, "enemy", "bomber"),
        createUnit("Enemy-Bomber-4", 700, 550, Math.PI, "enemy", "bomber"),
      ]
    case "test-flight":
      return [
        createUnit("Player-Bomber-1", 100, 200, 0, "player", "bomber"),
        createUnit("Enemy-Bomber-1", 700, 400, Math.PI, "enemy", "bomber"),
        createUnit("Player-Fighter-1", 100, 250, 0, "player", "fighter"),
        createUnit("Enemy-Fighter-1", 700, 350, Math.PI, "enemy", "fighter"),
        createUnit("Enemy-Interceptor-1", 700, 150, Math.PI, "enemy", "interceptor"),
        createUnit("Player-Interceptor-1", 100, 150, 0, "player", "interceptor"),
        createUnit("Enemy-Scout-1", 700, 450, Math.PI, "enemy", "scout"),
        createUnit("Player-Scout-1", 100, 450, 0, "player", "scout"),
        createUnit("Enemy-Heavy-Fighter-1", 700, 550, Math.PI, "enemy", "heavy_fighter"),
        createUnit("Player-Heavy-Fighter-1", 100, 550, 0, "player", "heavy_fighter"),
      ]
    default:
      // Default to Dogfight if an unknown setup is requested
      console.warn(`Unknown setup type: ${setupType}. Defaulting to Dogfight.`)
      return generateUnitsForSetup("dogfight")
  }
}

export function generateInitialCampaignRoster(): { units: Unit[]; pilots: Pilot[] } {
  const units: Unit[] = [
    // Initial ships (no pilots assigned yet)
    { ...createUnit("Barracks-Fighter-1", 0, 0, 0, "player", "fighter"), pilot: undefined! }, // Placeholder pilot
    { ...createUnit("Barracks-Interceptor-1", 0, 0, 0, "player", "interceptor"), pilot: undefined! },
    { ...createUnit("Barracks-Heavy-Fighter-1", 0, 0, 0, "player", "heavy_fighter"), pilot: undefined! },
    { ...createUnit("Barracks-Fighter-2", 0, 0, 0, "player", "fighter"), pilot: undefined! },
  ]

  const pilotNames = ["Ace", "Viper", "Hammer", "Maverick", "Phoenix"]
  const pilots: Pilot[] = []

  pilotNames.forEach((name, index) => {
    const skillValues = [3, 2, 2, 1] // One at 3, two at 2, one at 1
    const skillNames: (keyof PilotSkills)[] = ["composure", "control", "gunnery", "guts"]

    // Shuffle skill names
    for (let i = skillNames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[skillNames[i], skillNames[j]] = [skillNames[j], skillNames[i]] // Swap elements
    }

    const randomizedSkills: PilotSkills = {
      composure: 0, // Will be overwritten
      control: 0, // Will be overwritten
      gunnery: 0, // Will be overwritten
      guts: 0, // Will be overwritten
    }

    // Assign randomized values
    skillNames.forEach((skillName, i) => {
      randomizedSkills[skillName] = skillValues[i]
    })

    pilots.push({
      ...createUnit(`Pilot-${name}`, 0, 0, 0, "player", "fighter", randomizedSkills, name).pilot,
      id: `pilot-${name.toLowerCase()}`,
    })
  })

  return { units, pilots }
}

function generateRandomZone(
  zoneId: string,
  mapWidth: number,
  mapHeight: number,
  existingUnits: Unit[],
  existingAsteroids: Asteroid[],
  minRadius: number,
  maxRadius: number,
  minDistanceFromEdge: number,
  minDistanceFromOtherObjects: number,
  attempts = 0,
  maxAttempts = 100,
): { id: string; x: number; y: number; radius: number } | null {
  if (attempts >= maxAttempts) return null

  const radius = minRadius + Math.random() * (maxRadius - minRadius)
  const x = minDistanceFromEdge + Math.random() * (mapWidth - 2 * minDistanceFromEdge)
  const y = minDistanceFromEdge + Math.random() * (mapHeight - 2 * minDistanceFromEdge)

  let isValidPosition = true

  // Check distance from existing units
  for (const unit of existingUnits) {
    const dist = getDistance({ x, y }, unit)
    if (dist < radius + UNIT_COLLISION_RADIUS + minDistanceFromOtherObjects) {
      isValidPosition = false
      break
    }
  }

  // Check distance from existing asteroids
  if (isValidPosition) {
    for (const asteroid of existingAsteroids) {
      const dist = getDistance({ x, y }, asteroid)
      if (dist < radius + asteroid.radius + minDistanceFromOtherObjects) {
        isValidPosition = false
        break
      }
    }
  }

  if (isValidPosition) {
    return { id: zoneId, x, y, radius }
  } else {
    return generateRandomZone(
      zoneId,
      mapWidth,
      mapHeight,
      existingUnits,
      existingAsteroids,
      minRadius,
      maxRadius,
      minDistanceFromEdge,
      minDistanceFromOtherObjects,
      attempts + 1,
      maxAttempts,
    )
  }
}


export function generateMissions(canvasWidth: number, canvasHeight: number): Mission[] {
  const missionTypes: MissionType[] = ["dogfight", "escort", "intercept", "lone-wolf", "recon"]
  const numMissionsInRound = Math.floor(Math.random() * 3) + 2 // Randomly 2, 3, or 4 missions per round
  const missions: Mission[] = []

  for (let i = 0; i < numMissionsInRound; i++) {
    const type = missionTypes[Math.floor(Math.random() * missionTypes.length)]
    const id = `mission-${Date.now()}-${i}` // Ensure unique ID for each mission
    let name = ""
    let description = ""
    let enemyUnits: Unit[] = []
    let objectives: MissionObjective[] = []
    let playerUnitLimit = 4 // Default
    let playerPilotLimit = 4 // Default
    let escortTargetUnitIds: string[] | undefined = undefined
    let victoryPointsAward: Mission["victoryPointsAward"] = { player: 1, enemy: 1 } // Default to 1 VP for winner
    const escapeZoneWidth = 2 * SHIP_LENGTH
    const escapeZoneX = SHIP_LENGTH // Center X of the escape zone: 1 ship length from left edge
    const escapeZoneHeight = canvasHeight
    switch (type) {
      case "dogfight":
        name = `Dogfight over Sector ${i + 1}`
        description = "Engage enemy fighters in a classic dogfight."
        enemyUnits = [
          createUnit(`Enemy-Fighter-${id}-1`, 700, 250, Math.PI, "enemy", "fighter"),
          createUnit(`Enemy-Fighter-${id}-2`, 700, 350, Math.PI, "enemy", "fighter"),
        ]
        objectives = [
          {
            type: "destroy-units",
            targetUnitTypes: ["fighter"],
            count: 2,
            isCompleted: false,
            description: "Destroy 2 enemy fighters.",
          },
        ]
        break
      case "escort":
        name = `Escort Convoy ${i + 1}`
        description = "Protect friendly bombers from enemy interceptors and guide them to safety."
        playerUnitLimit = 2
        playerPilotLimit = 2
        victoryPointsAward = { perEscapedBomber: 1, perDestroyedBomber: 1 } // 1 VP per bomber escaped/destroyed

        // Auto-generated escort bombers (player team)
        const escortBomberA = createUnit(
          `Escort-Bomber-A-${id}`,
          100,
          200,
          0,
          "player",
          "bomber",
          { composure: 3, control: 3, gunnery: 3, guts: 3 },
          "Escort Pilot A",
          `escort-pilot-A-${id}`,
        )
        const escortBomberB = createUnit(
          `Escort-Bomber-B-${id}`,
          100,
          400,
          0,
          "player",
          "bomber",
          { composure: 3, control: 3, gunnery: 3, guts: 3 },
          "Escort Pilot B",
          `escort-pilot-B-${id}`,
        )

        enemyUnits = [
          createUnit(`Enemy-Interceptor-${id}-1`, 700, 150, Math.PI, "enemy", "interceptor"),
          createUnit(`Enemy-Interceptor-${id}-2`, 700, 300, Math.PI, "enemy", "interceptor"),
          createUnit(`Enemy-Interceptor-${id}-3`, 700, 450, Math.PI, "enemy", "interceptor"),
          // Add the escort bombers to the units that will be part of the battle
          // getUnitsForMission will separate them by team
          escortBomberA,
          escortBomberB,
        ]
        escortTargetUnitIds = [escortBomberA.id, escortBomberB.id]

        // Determine target zone Y position (randomly placed within 2 fighter lengths of the top or bottom)
        const targetZoneY =
          Math.random() < 0.5
            ? 2 * SHIP_LENGTH + Math.random() * (canvasHeight / 2 - 4 * SHIP_LENGTH) // Top half
            : canvasHeight - (2 * SHIP_LENGTH + Math.random() * (canvasHeight / 2 - 4 * SHIP_LENGTH)) // Bottom half

        // Escape zone on player's edge, 1 ship length from the board edge
        

        objectives = [
          {
            type: "destroy-units",
            targetUnitTypes: ["interceptor"],
            count: 3,
            isCompleted: false,
            description: "Destroy 3 enemy interceptors.",
          },
          {
            type: "reach-zone-and-return",
            targetUnitIds: [escortBomberA.id, escortBomberB.id],
            targetZone: {
              x: canvasWidth - 100, // Near enemy side
              y: targetZoneY,
              radius: 50, // Size of the target zone
            },
            escapeZone: {
              x: escapeZoneX,
              y: canvasHeight / 2, // Center vertically for drawing
              width: escapeZoneWidth,
              height: escapeZoneHeight,
            },
            hasReachedZone: {
              [escortBomberA.id]: false,
              [escortBomberB.id]: false,
            },
            hasEscapedZone: {
              [escortBomberA.id]: false,
              [escortBomberB.id]: false,
            },
            isCompleted: false,
            description: "Guide both bombers to the target zone and back to player's edge.",
          },
        ]
        break
      case "recon":
        name = `Recon Sector ${i + 1}`
        description = "Escort a Scout craft as it Recons the sector."
        playerUnitLimit = 3
        playerPilotLimit = 3
        victoryPointsAward = { player: 1, enemy: 1 } // 1 VP for the Scout escaped/destroyed

        // Auto-generated escort bombers (player team)
        const reconScoutA = createUnit(
          `Recon-Scout-A-${id}`,
          100,
          200,
          0,
          "player",
          "scout",
          { composure: 3, control: 5, gunnery: 1, guts: 2 },
          "Recon Pilot A",
          `Recon-pilot-A-${id}`,
        )

        enemyUnits = [
          createUnit(`Enemy-Interceptor-${id}-1`, 700, 150, Math.PI, "enemy", "interceptor"),
          createUnit(`Enemy-Interceptor-${id}-2`, 700, 300, Math.PI, "enemy", "interceptor"),
          // Add the escort bombers to the units that will be part of the battle
          // getUnitsForMission will separate them by team
          reconScoutA,
        ]
        escortTargetUnitIds = [reconScoutA.id]

        const targetZones = []
        const zoneRadius = 30
        const minZoneDistance = 3 * SHIP_LENGTH // Minimum distance between zones and other objects
        const edgeBuffer = 2 * SHIP_LENGTH // Minimum distance from map edges

        // Generate 3 target zones
        for (let j = 0; j < 3; j++) {
          const newZone = generateRandomZone(
            `Target-Zone-${id}-${j + 1}`,
            canvasWidth,
            canvasHeight,
            [...enemyUnits, reconScoutA], // Pass all units (including the scout)
            [], // No asteroids yet, they are generated later
            zoneRadius,
            zoneRadius,
            edgeBuffer,
            minZoneDistance,
          )
          if (newZone) {
            targetZones.push(newZone)
          } else {
            console.warn(`Could not generate target zone ${j + 1} for scout mission.`)
            // Fallback or handle error if zones can't be placed
            // For now, just break and potentially have fewer zones
            break
          }
        }

        const hasVisitedZone: { [zoneId: string]: boolean } = {}
        targetZones.forEach((zone) => (hasVisitedZone[zone.id] = false))

        objectives = [
          {
            type: "visit-multiple-zones-and-return",
            targetUnitIds: [reconScoutA.id],
            targetZones: targetZones,
            escapeZone: {
              x: escapeZoneX,
              y: canvasHeight / 2,
              width: escapeZoneWidth,
              height: escapeZoneHeight,
            },
            hasVisitedZone: hasVisitedZone,
            hasEscapedZone: { [reconScoutA.id]: false },
            isCompleted: false,
            description: "Visit all target zones and return to player's edge.",
          },
        ]
        break
      case "intercept":
        name = `Intercept Raid ${i + 1}`
        description = "Stop enemy bombers and their escorts before they reach their target."
        const targetBomber1Id = `Enemy-Bomber-Target-${id}-1`
        const targetBomber2Id = `Enemy-Bomber-Target-${id}-2` // Ensure unique ID for the second bomber
        enemyUnits = [
          createUnit(`Enemy-Fighter-${id}-1`, 700, 250, Math.PI, "enemy", "fighter"),
          createUnit(`Enemy-Fighter-${id}-2`, 700, 350, Math.PI, "enemy", "fighter"),
          createUnit(targetBomber1Id, 650, 300, Math.PI, "enemy", "bomber"), // Specific target bomber 1
          createUnit(targetBomber2Id, 650, 400, Math.PI, "enemy", "bomber"), // Specific target bomber 2
        ]
        objectives = [
          {
            type: "destroy-units",
            targetUnitIds: [targetBomber1Id, targetBomber2Id], // Target both bombers
            count: 2, // Both must be destroyed
            isCompleted: false,
            description: `Destroy both enemy target bombers (${targetBomber1Id}, ${targetBomber2Id}).`,
          },
        ]
        break
      case "lone-wolf":
        name = `Lone Wolf: Deep Strike ${i + 1}`
        description = "A single fighter against overwhelming odds. High risk, high reward."
        playerUnitLimit = 1
        playerPilotLimit = 1
        enemyUnits = [
          createUnit(`Enemy-Bomber-${id}-1`, 700, 100, Math.PI, "enemy", "bomber"),
          createUnit(`Enemy-Bomber-${id}-2`, 700, 250, Math.PI, "enemy", "bomber"),
          createUnit(`Enemy-Bomber-${id}-3`, 700, 400, Math.PI, "enemy", "bomber"),
          createUnit(`Enemy-Bomber-${id}-4`, 700, 550, Math.PI, "enemy", "bomber"),
        ]
        objectives = [
          {
            type: "destroy-units",
            targetUnitTypes: ["bomber"],
            count: 4,
            isCompleted: false,
            description: "Destroy all 4 enemy bombers.",
          },
        ]
        break
    }

    missions.push({
      id,
      type,
      name,
      description,
      enemyUnits, // Store enemy units here
      assignedUnitIds: [],
      assignedPilotIds: [],
      status: "pending",
      objectives, // Add objectives
      playerUnitLimit, // Set player unit limit
      playerPilotLimit, // Set player pilot limit
      escortTargetUnitIds, // Set escort target IDs if applicable
      isPlayed: false, // Initialize as not played
      victoryPointsAward, // Set victory points award
    })
  }
  return missions
}

export function isPointInRectangle(
  point: Vector2,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const rectLeft = rect.x - rect.width / 2
  const rectRight = rect.x + rect.width / 2
  const rectTop = rect.y - rect.height / 2
  const rectBottom = rect.y + rect.height / 2
  return point.x >= rectLeft && point.x <= rectRight && point.y >= rectTop && point.y <= rectBottom
}

export function getUnitsForMission(mission: Mission, allBarracksUnits: Unit[], allBarracksPilots: Pilot[]): Unit[] {
  const playerUnits: Unit[] = mission.assignedUnitIds.map((unitId) => {
    const barracksUnit = allBarracksUnits.find((u) => u.id === unitId)
    if (!barracksUnit) {
      console.error(`Unit ${unitId} not found in barracks for mission ${mission.id}`)
      // Return a dummy unit or throw an error, depending on desired error handling
      return createUnit("Dummy-Unit", 0, 0, 0, "player", "fighter", undefined, "Dummy Pilot", "dummy-pilot")
    }

    const assignedPilotId = mission.assignedPilotIds[mission.assignedUnitIds.indexOf(unitId)]
    const pilot = allBarracksPilots.find((p) => p.id === assignedPilotId)

    if (!pilot) {
      console.error(`Pilot ${assignedPilotId} not found for unit ${unitId} in mission ${mission.id}`)
      // Assign a default pilot if not found
      return { ...barracksUnit, pilot: createUnit("Default-Pilot", 0, 0, 0, "player", "fighter").pilot }
    }

    // Create a new unit instance for the mission, linking the actual pilot object
    return {
      ...barracksUnit,
      x: 100 + Math.random() * 50, // Randomize starting position slightly
      y: 100 + Math.random() * 400,
      angle: 0,
      isDestroyed: false, // Ensure unit starts not destroyed
      isEscaped: false, // Ensure unit starts not escaped
      health: barracksUnit.maxHealth, // Reset health
      shield: barracksUnit.maxShield, // Reset shield
      weaponCharge: 0, // Reset weapon charge
      firingLine: null, // Reset firing line
      pilot: { ...pilot, strain: 0, morale: pilot.maxMorale }, // Reset pilot strain and morale for mission start
    }
  })

  // Separate actual enemy units from auto-assigned player escort units
  const actualEnemyUnits: Unit[] = []
  const autoAssignedPlayerEscortUnits: Unit[] = []

  mission.enemyUnits.forEach((unit) => {
    if (mission.escortTargetUnitIds?.includes(unit.id)) {
      // This is an auto-assigned player escort unit
      autoAssignedPlayerEscortUnits.push({
        ...unit,
        x: 100 + Math.random() * 50, // Randomize starting position slightly
        y: 100 + Math.random() * 400,
        angle: 0,
        isDestroyed: false,
        isEscaped: false,
        health: unit.maxHealth,
        shield: unit.maxShield,
        weaponCharge: 0,
        firingLine: null,
        pilot: { ...unit.pilot, strain: 0, morale: unit.pilot.maxMorale },
      })
    } else {
      // This is a regular enemy unit
      actualEnemyUnits.push({
        ...unit,
        x: 700 - Math.random() * 50, // Randomize starting position slightly
        y: 100 + Math.random() * 400,
        isDestroyed: false,
        isEscaped: false,
        health: unit.maxHealth,
        shield: unit.maxShield,
        weaponCharge: 0,
        firingLine: null,
        pilot: { ...unit.pilot, strain: 0, morale: unit.pilot.maxMorale },
      })
    }
  })

  return [...playerUnits, ...autoAssignedPlayerEscortUnits, ...actualEnemyUnits]
}

export function gainExperience(pilot: Pilot, xpAmount: number): Pilot {
  const newPilot = { ...pilot }
  newPilot.experience += xpAmount

  // Level up logic: 10 XP per skill point
  // This loop allows multiple level-ups if a large amount of XP is gained
  while (newPilot.experience >= newPilot.level * 10) {
    newPilot.level++
    // No automatic skill point allocation here, player does it in barracks
  }
  return newPilot
}

export function levelUpPilotSkill(pilot: Pilot, skill: keyof PilotSkills): Pilot {
  const newPilot = { ...pilot }
  const cost = 10 // XP cost per skill point

  if (newPilot.experience >= cost && newPilot.skills[skill] < 10) {
    // Max skill level 10 for now
    newPilot.experience -= cost
    newPilot.skills = {
      ...newPilot.skills,
      [skill]: newPilot.skills[skill] + 1,
    }
    console.log(`${newPilot.name} leveled up ${skill}! New value: ${newPilot.skills[skill]}`)
  } else {
    console.warn(`Cannot level up ${skill} for ${newPilot.name}. Not enough XP or skill is maxed.`)
  }
  return newPilot
}

/**
 * Checks if the mission's victory conditions have been met.
 * Updates the isCompleted status of objectives within the mission object.
 * @param mission The current mission object.
 * @param units The current state of all units in the battle.
 * @returns An object containing the updated mission, updated units, and overall mission completion status.
 */
export function checkMissionVictoryConditions(
  mission: Mission,
  units: Unit[],
): { updatedMission: Mission; updatedUnits: Unit[]; isMissionComplete: boolean } {
  let allObjectivesCompleted = true
  const updatedUnits = units.map((u) => ({ ...u })) // Create a mutable copy of units to modify
  const updatedObjectives: MissionObjective[] = []

  mission.objectives.forEach((objective) => {
    if (objective.isCompleted) {
      updatedObjectives.push(objective) // Already completed, keep as is
      return
    }

    if (objective.type === "destroy-units") {
      let destroyedCount = 0
      if (objective.targetUnitIds) {
        destroyedCount = units.filter((unit) => unit.isDestroyed && objective.targetUnitIds!.includes(unit.id)).length
      } else if (objective.targetUnitTypes) {
        destroyedCount = units.filter(
          (unit) => unit.isDestroyed && unit.team === "enemy" && objective.targetUnitTypes!.includes(unit.unitType),
        ).length
      }

      if (destroyedCount >= objective.count) {
        console.log(`Objective completed: ${objective.description}`)
        updatedObjectives.push({ ...objective, isCompleted: true })
      } else {
        allObjectivesCompleted = false
        updatedObjectives.push(objective)
      }
    } else if (objective.type === "reach-zone-and-return") {
      const reachZoneObjective = { ...objective } as ReachZoneAndReturnObjective // Mutable copy

      let allRequiredUnitsEscaped = true

      reachZoneObjective.targetUnitIds.forEach((unitId) => {
        const unit = updatedUnits.find((u) => u.id === unitId)
        // If unit is not found, or is destroyed AND NOT escaped, or has not escaped, then objective is not complete for this unit
        if (!unit || (unit.isDestroyed && !unit.isEscaped) || !reachZoneObjective.hasEscapedZone[unitId]) {
          allRequiredUnitsEscaped = false
        }
      })

      if (allRequiredUnitsEscaped) {
        console.log(`Objective completed: ${reachZoneObjective.description}`)
        updatedObjectives.push({ ...reachZoneObjective, isCompleted: true })
      } else {
        allObjectivesCompleted = false
        updatedObjectives.push(reachZoneObjective)
      }
    } else if (objective.type === "visit-multiple-zones-and-return") {
      const visitObj = { ...objective } as VisitMultipleZonesAndReturnObjective // Mutable copy

      const scoutUnit = updatedUnits.find((u) => u.id === visitObj.targetUnitIds[0]) // Assuming one scout unit
      if (!scoutUnit || scoutUnit.isDestroyed) {
        allObjectivesCompleted = false // Scout destroyed, objective cannot be completed
        updatedObjectives.push(visitObj)
        return // Skip further checks for this objective if scout is destroyed
      }

      // Check if all target zones have been visited
      const allTargetsVisited = visitObj.targetZones.every((zone) => visitObj.hasVisitedZone[zone.id])

      // Check if the scout has escaped after visiting all targets
      const hasEscaped = visitObj.hasEscapedZone[scoutUnit.id]

      if (allTargetsVisited && hasEscaped) {
        console.log(`Objective completed: ${visitObj.description}`)
        updatedObjectives.push({ ...visitObj, isCompleted: true })
      } else {
        allObjectivesCompleted = false
        updatedObjectives.push(visitObj)
      }
    }
  })

  return {
    updatedMission: { ...mission, objectives: updatedObjectives },
    updatedUnits,
    isMissionComplete: allObjectivesCompleted,
  }
}

export function getAvailableSpeedChanges(
  unit: Unit,
): { value: Unit["plannedSpeedChange"]; label: string; disabled: boolean }[] {
  const speedChanges: { value: Unit["plannedSpeedChange"]; label: string; disabled: boolean }[] = []

  const stats = getUnitTypeStats(unit.unitType)

  // Maintain
  speedChanges.push({ value: "maintain", label: "Maintain Speed", disabled: false })

  // Accelerate
  const canAccelerate = unit.speed < unit.maxSpeed
  speedChanges.push({ value: "accelerate", label: "Accelerate (+1)", disabled: !canAccelerate })

  // Accelerate 2
  const canAccelerate2 = stats.canAccelerate2 && unit.speed < stats.maxSpeed - 1
  speedChanges.push({ value: "accelerate-2", label: "Accelerate (+2)", disabled: !canAccelerate2 })

  // Decelerate
  const canDecelerate = unit.speed > 1
  speedChanges.push({ value: "decelerate", label: "Decelerate (-1)", disabled: !canDecelerate })

  // Decelerate 2
  const canDecelerate2 = stats.canDecelerate2 && unit.speed > 2
  speedChanges.push({ value: "decelerate-2", label: "Decelerate (-2)", disabled: !canDecelerate2 })

  return speedChanges
}

// Function to generate a random asteroid shape (polygon)
function generateAsteroidPoints(centerX: number, centerY: number, minRadius: number, maxRadius: number): Vector2[] {
  const numPoints = Math.floor(Math.random() * 4) + 5 // 5 to 8 points
  const points: Vector2[] = []
  const angleStep = (Math.PI * 2) / numPoints

  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep + (Math.random() - 0.5) * (angleStep / 2) // Add some wobble
    const r = minRadius + Math.random() * (maxRadius - minRadius)
    points.push({
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    })
  }
  return points
}

export function generateAsteroids(
  numAsteroids: number,
  mapWidth: number,
  mapHeight: number,
  existingUnits: Unit[], // To avoid placing on top of starting units
): Asteroid[] {
  const asteroids: Asteroid[] = []
  const minAsteroidRadius = 20 // Minimum visual radius
  const maxAsteroidRadius = 40 // Maximum visual radius
  const minDistanceBetweenAsteroids = 2 * SHIP_LENGTH // 2 fighter ship lengths
  const edgeBuffer = 2 * SHIP_LENGTH // 2 fighter ship lengths from edge

  let attempts = 0
  const maxAttempts = 100 // Prevent infinite loops

  while (asteroids.length < numAsteroids && attempts < maxAttempts) {
    const radius = minAsteroidRadius + Math.random() * (maxAsteroidRadius - minAsteroidRadius)
    const x = edgeBuffer + Math.random() * (mapWidth - 2 * edgeBuffer)
    const y = edgeBuffer + Math.random() * (mapHeight - 2 * edgeBuffer)

    // Generate points for the asteroid
    const points = generateAsteroidPoints(x, y, radius * 0.7, radius * 1.3) // Vary points around the radius

    let isValidPosition = true

    // Check distance from other asteroids
    for (const existingAsteroid of asteroids) {
      const dist = getDistance({ x, y }, existingAsteroid)
      if (dist < minDistanceBetweenAsteroids + radius + existingAsteroid.radius) {
        isValidPosition = false
        break
      }
    }

    // Check distance from existing units (player and enemy starting positions)
    // Assuming unit has a rough collision radius of UNIT_COLLISION_RADIUS
    const minDistanceToUnit = 2 * SHIP_LENGTH // 2 fighter ship lengths from unit
    for (const unit of existingUnits) {
      const dist = getDistance({ x, y }, unit)
      if (dist < radius + UNIT_COLLISION_RADIUS + minDistanceToUnit) {
        isValidPosition = false
        break
      }
    }
    let thin_radius = radius - 5
    if (isValidPosition) {
      asteroids.push({
        id: `asteroid-${asteroids.length + 1}`,
        x,
        y,
        points,
        radius: thin_radius, // Store the calculated radius for collision checks
        collidedUnitsThisPhase: [], // Initialize for collision tracking
      })
    }
    attempts++
  }
  return asteroids
}

export function getPointFromDistanceAndAngle(
  startPoint: Point, 
  distance: number, 
  angleInRadians: number
): Point {
  
  // Calculate the new coordinates
  const newX = startPoint.x + distance * Math.cos(angleInRadians);
  const newY = startPoint.y + distance * Math.sin(angleInRadians);
  
  return {
    x: newX,
    y: newY
  };
}

export function getUnitPolygon( unit: Unit): Point[] {
  let unitPolygon: Point[] = []
  let unitPoint: Point = { x: unit.x, y: unit.y }
  let midFront = getPointFromDistanceAndAngle( unitPoint, unit.size/2, unit.angle)
  let frontRight = getPointFromDistanceAndAngle( midFront, unit.size / 2, unit.angle + ((90 * Math.PI) / 180) )
  let backRight = getPointFromDistanceAndAngle( frontRight, unit.size, unit.angle + Math.PI)
  let backLeft = getPointFromDistanceAndAngle( backRight, unit.size, unit.angle + ((270 * Math.PI) / 180) )
  let frontLeft = getPointFromDistanceAndAngle( backLeft, unit.size, unit.angle)
  unitPolygon = [frontLeft, frontRight, backRight, backLeft]
  return unitPolygon
}

export class CollisionDetector {
  /**
   * Check if an irregular polygon collides with a rectangle
   * Uses Separating Axis Theorem (SAT) for accurate collision detection
   */
  static polygonRectangleCollision(polygon: Point[], rectangle: Point[]): boolean {

    // Get all axes to test (normals to edges)
    const axes = [
      ...this.getAxes(polygon),
      ...this.getAxes(rectangle)
    ];

    // Test projection on each axis
    for (const axis of axes) {
      const projection1 = this.projectPolygon(polygon, axis);
      const projection2 = this.projectPolygon(rectangle, axis);

      // Check for separation on this axis
      if (!this.overlaps(projection1, projection2)) {
        return false; // Separating axis found, no collision
      }
    }

    return true; // No separating axis found, collision detected
  }

  /**
   * Get perpendicular axes (normals) for each edge of the polygon
   */
  private static getAxes(polygon: Point[]): Point[] {
    const axes: Point[] = [];
    
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      
      // Get edge vector
      const edge = { x: next.x - current.x, y: next.y - current.y };
      
      // Get perpendicular (normal) - rotate 90 degrees
      const normal = { x: -edge.y, y: edge.x };
      
      // Normalize
      const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
      if (length > 0) {
        axes.push({ x: normal.x / length, y: normal.y / length });
      }
    }
    
    return axes;
  }

  /**
   * Project polygon onto an axis and return min/max values
   */
  private static projectPolygon(polygon: Point[], axis: Point): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;

    for (const vertex of polygon) {
      const dot = vertex.x * axis.x + vertex.y * axis.y;
      min = Math.min(min, dot);
      max = Math.max(max, dot);
    }

    return { min, max };
  }

  /**
   * Check if two projections overlap
   */
  private static overlaps(proj1: { min: number; max: number }, proj2: { min: number; max: number }): boolean {
    return proj1.max >= proj2.min && proj2.max >= proj1.min;
  }

}
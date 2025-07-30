"use client"

import { useState, useEffect, useCallback } from "react"
import type { GameState, Unit, PilotSkills, GamePhase, 
  MissionStatus, ReachZoneAndReturnObjective, 
  VisitMultipleZonesAndReturnObjective, Point, Rectangle, } from "./types/game"
import {
  updateUnitPosition,
  isInAttackRange,
  dealDamage,
  findBestTarget,
  initializeManeuver,
  createFiringLine,
  canFireWeapon,
  rollAttack,
  getDistance,
  simulateManeuverOutcome,
  getManeuverRequirements,
  getAvailableSpeedChanges,
  getUnitTypeStats,
  generateUnitsForSetup,
  generateInitialCampaignRoster,
  generateMissions,
  gainExperience,
  levelUpPilotSkill,
  getUnitsForMission,
  checkMissionVictoryConditions,
  generateAsteroids,
  calculatePlannedPath,
  isPointInRectangle,
  CollisionDetector,
  getUnitPolygon,
} from "./utils/game-logic"
import { GameCanvas } from "./components/game-canvas"
import { PlanningPanel } from "./components/planning-panel"
import { ResolutionPanel } from "./components/resolution-panel"
import { MainMenu } from "./components/main-menu"
import { SkirmishSetup } from "./components/skirmish-setup"
import { CampaignMenu } from "./components/campaign-menu"
import { BarracksPanel } from "./components/barracks-panel"
import { CampaignMissionPlanning } from "./components/campaign-mission-planning"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const MAX_RESOLUTION_TICKS = 30
const VICTORY_POINTS_TO_WIN = 10
const UNIT_COLLISION_RADIUS = 20

export default function SpaceDogfight() {
  // New memoized callback for processing mission end
  const processMissionEnd = useCallback(
    (
      outcome: "player-victory" | "enemy-victory",
      missionId: string,
      unitsInBattle: Unit[], // Units as they were at the end of the battle/pass
      prevGameState: GameState, // Pass prevGameState to ensure correct state updates
    ) => {
      const newUnits = [...unitsInBattle]
      const updatedCampaignState = prevGameState.campaignState ? { ...prevGameState.campaignState } : undefined
      let nextPhase: GamePhase = "mission-planning"

      if (!updatedCampaignState || !missionId) {
        console.error("processMissionEnd called without valid campaignState or missionId")
        return prevGameState
      }

      // Find the mission in the roundMissions array to update its status
      const currentMissionInRound = updatedCampaignState.roundMissions.find((m) => m.id === missionId)
      if (!currentMissionInRound) {
        console.error(`Mission ${missionId} not found in roundMissions for processing end.`)
        return prevGameState
      }

      let finalWinner: "player" | "enemy" | null = null // Overall game winner

      // Determine victory points based on mission type
      if (currentMissionInRound.type === "escort" && currentMissionInRound.victoryPointsAward) {
        const escortObjective = currentMissionInRound.objectives.find((obj) => obj.type === "reach-zone-and-return") as
          | ReachZoneAndReturnObjective
          | undefined

        if (escortObjective && currentMissionInRound.escortTargetUnitIds) {
          currentMissionInRound.escortTargetUnitIds.forEach((bomberId) => {
            const bomber = newUnits.find((u) => u.id === bomberId)
            if (bomber) {
              if (bomber.isEscaped && escortObjective.hasReachedZone[bomberId]) {
                updatedCampaignState.victoryPoints.player +=
                  currentMissionInRound.victoryPointsAward?.perEscapedBomber || 0
                console.log(
                  `Player gained ${currentMissionInRound.victoryPointsAward?.perEscapedBomber || 0} VP for ${bomber.id} escaping. Total: ${updatedCampaignState.victoryPoints.player}`,
                )
              } else if (bomber.isDestroyed) {
                updatedCampaignState.victoryPoints.enemy +=
                  currentMissionInRound.victoryPointsAward?.perDestroyedBomber || 0
                console.log(
                  `Enemy gained ${currentMissionInRound.victoryPointsAward?.perDestroyedBomber || 0} VP for ${bomber.id} destroyed. Total: ${updatedCampaignState.victoryPoints.enemy}`,
                )
              }
            }
          })
        }
        // For escort, mission status is determined by overall objective completion, not just one outcome
        currentMissionInRound.status = escortObjective?.isCompleted ? "completed" : "failed"
      } else if (currentMissionInRound.type === "recon" && currentMissionInRound.victoryPointsAward) {
        const scoutObjective = currentMissionInRound.objectives.find(
          (obj) => obj.type === "visit-multiple-zones-and-return",
        ) as VisitMultipleZonesAndReturnObjective | undefined

        if (scoutObjective && scoutObjective.targetUnitIds.length > 0) {
          const scoutUnit = newUnits.find((u) => u.id === scoutObjective.targetUnitIds[0]) // Assuming one scout unit
          if (scoutUnit) {
            if (scoutUnit.isEscaped && scoutObjective.isCompleted) {
              updatedCampaignState.victoryPoints.player += currentMissionInRound.victoryPointsAward?.player || 0
              console.log(
                `Player gained ${currentMissionInRound.victoryPointsAward?.player || 0} VP for Scout mission success. Total: ${updatedCampaignState.victoryPoints.player}`,
              )
              currentMissionInRound.status = "completed"
            } else if (scoutUnit.isDestroyed) {
              updatedCampaignState.victoryPoints.enemy += currentMissionInRound.victoryPointsAward?.enemy || 0
              console.log(
                `Enemy gained ${currentMissionInRound.victoryPointsAward?.enemy || 0} VP for Scout mission failure. Total: ${updatedCampaignState.victoryPoints.enemy}`,
              )
              currentMissionInRound.status = "failed"
            } else {
              // If scout is neither escaped nor destroyed, but mission ended (e.g., all enemy destroyed, or max turns)
              // and objectives not met, it's a failure.
              updatedCampaignState.victoryPoints.enemy += currentMissionInRound.victoryPointsAward?.enemy || 0
              console.log(
                `Enemy gained ${currentMissionInRound.victoryPointsAward?.enemy || 0} VP for Scout mission failure (objectives not met). Total: ${updatedCampaignState.victoryPoints.enemy}`,
              )
              currentMissionInRound.status = "failed"
            }
          }
        }
      } else {
        // Default VP for other mission types
        if (outcome === "player-victory") {
          currentMissionInRound.status = "completed"
          updatedCampaignState.victoryPoints.player += currentMissionInRound.victoryPointsAward?.player || 1
          console.log(`Player gained 1 Victory Point. Total: ${updatedCampaignState.victoryPoints.player}`)
        } else {
          // outcome === "enemy-victory"
          currentMissionInRound.status = "failed"
          updatedCampaignState.victoryPoints.enemy += currentMissionInRound.victoryPointsAward?.enemy || 1
          console.log(`Enemy gained 1 Victory Point. Total: ${updatedCampaignState.victoryPoints.enemy}`)
        }
      }

      currentMissionInRound.isPlayed = true // Mark as played

      // Award XP to participating pilots and return units/pilots to barracks
      const xpAward = outcome === "player-victory" ? 20 : 5

      updatedCampaignState.playerPilotsInBarracks = updatedCampaignState.playerPilotsInBarracks.map((barracksPilot) => {
        const unitInBattleWithThisPilot = newUnits.find((u) => u.pilot.id === barracksPilot.id)
        if (unitInBattleWithThisPilot) {
          const updatedPilotFromBattle = unitInBattleWithThisPilot.pilot
          return gainExperience(updatedPilotFromBattle, xpAward)
        }
        return barracksPilot
      })

      updatedCampaignState.playerUnitsInBarracks = updatedCampaignState.playerUnitsInBarracks
        .map((barracksUnit) => {
          const unitInBattle = newUnits.find((u) => u.id === barracksUnit.id)
          if (unitInBattle) {
            // If the unit was destroyed, it's removed. If it escaped, it returns to barracks.
            return {
              ...unitInBattle,
              x: 0,
              y: 0,
              angle: 0,
              isDestroyed: unitInBattle.isDestroyed, // Keep its final destroyed status
              isEscaped: unitInBattle.isEscaped, // Keep its final escaped status
              pilot: undefined!, // Clear pilot reference for barracks unit
            }
          }
          return barracksUnit
        })
        .filter((unit) => !unit.isDestroyed) // Only remove truly destroyed units from barracks

      updatedCampaignState.currentMissionId = null // Clear current mission ID

      // Check for round completion
      const allMissionsInRoundPlayed = updatedCampaignState.roundMissions.every((m) => m.isPlayed)

      if (allMissionsInRoundPlayed) {
        console.log("Round complete! Generating new missions.")
        const newMissionsForRound = generateMissions(CANVAS_WIDTH, CANVAS_HEIGHT) // Pass canvas dimensions
        updatedCampaignState.availableMissions = newMissionsForRound // Update available missions
        updatedCampaignState.roundMissions = newMissionsForRound // Set new round missions
      }

      // Check for overall game over by victory points
      if (updatedCampaignState.victoryPoints.player >= VICTORY_POINTS_TO_WIN) {
        nextPhase = "game-over"
        finalWinner = "player"
        console.log(`Player reached ${VICTORY_POINTS_TO_WIN} Victory Points! Campaign Victory!`)
      } else if (updatedCampaignState.victoryPoints.enemy >= VICTORY_POINTS_TO_WIN) {
        nextPhase = "game-over"
        finalWinner = "enemy"
        console.log(`Enemy reached ${VICTORY_POINTS_TO_WIN} Victory Points! Campaign Defeat!`)
      }

      return {
        ...prevGameState,
        phase: nextPhase,
        currentTurn: prevGameState.currentTurn + 1, // Increment turn for next planning phase/round
        selectedUnit: null,
        winner: finalWinner,
        units: [], // Clear units from battle
        asteroids: [], // Clear asteroids
        campaignState: updatedCampaignState,
      }
    },
    [gainExperience, levelUpPilotSkill, generateMissions],
  )

  const initialRoster = generateInitialCampaignRoster()
  const initialMissions = generateMissions(CANVAS_WIDTH, CANVAS_HEIGHT) // Pass canvas dimensions

  const [gameState, setGameState] = useState<GameState>(() => ({
    phase: "main-menu", // Start at the main menu
    currentTurn: 1,
    units: [], // Units will be initialized based on setup
    asteroids: [], // Initialize asteroids array
    selectedUnit: null,
    resolutionTick: 0,
    maxResolutionTicks: MAX_RESOLUTION_TICKS,
    winner: null,
    campaignState: {
      playerUnitsInBarracks: initialRoster.units,
      playerPilotsInBarracks: initialRoster.pilots,
      availableMissions: initialMissions, // Set initial missions
      roundMissions: initialMissions, // Set initial round missions
      currentMissionId: null,
      victoryPoints: { player: 0, enemy: 0 }, // Initialize victory points
    },
  }))

  const selectedUnitData = gameState.units.find((u) => u.id === gameState.selectedUnit)

  const handleUnitSelect = useCallback(
    (unitId: string | null) => {
      // Allow null for deselection
      if (gameState.phase === "planning") {
        setGameState((prev) => ({ ...prev, selectedUnit: unitId }))
      }
    },
    [gameState.phase],
  )

  const handleUpdateUnit = useCallback((unitId: string, updates: Partial<Unit>) => {
    setGameState((prev) => ({
      ...prev,
      units: prev.units.map((unit) => (unit.id === unitId ? { ...unit, ...updates } : unit)),
    }))
  }, [])

  const handleSelectMainMenuOption = useCallback((option: "skirmish" | "campaign") => {
    if (option === "skirmish") {
      setGameState((prev) => ({ ...prev, phase: "skirmish-setup" }))
    } else if (option === "campaign") {
      setGameState((prev) => ({ ...prev, phase: "campaign-menu" }))
    }
  }, [])

  const handleStartSkirmish = useCallback((setupType: string) => {
    const initialUnits = generateUnitsForSetup(setupType)
    const generatedAsteroids = generateAsteroids(
      Math.floor(Math.random() * 4) + 3, // 3 to 6 asteroids
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      initialUnits, // Pass initial units to avoid placing asteroids on them
    )
    setGameState((prev) => ({
      ...prev,
      phase: "planning",
      currentTurn: 1,
      units: initialUnits,
      asteroids: generatedAsteroids, // Set asteroids
      selectedUnit: null,
      resolutionTick: 0,
      winner: null,
    }))
  }, [])

  const handleBackToMainMenu = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      phase: "main-menu",
      currentTurn: 1,
      units: [], // Clear units when going back to menu
      asteroids: [], // Clear asteroids
      selectedUnit: null,
      resolutionTick: 0,
      winner: null,
      campaignState: prev.campaignState // Keep campaign state intact
        ? { ...prev.campaignState, currentMissionId: null }
        : undefined,
    }))
  }, [])

  const handleOpenBarracks = useCallback(() => {
    setGameState((prev) => ({ ...prev, phase: "barracks" }))
  }, [])

  const handleBackToCampaignMenu = useCallback(() => {
    setGameState((prev) => ({ ...prev, phase: "campaign-menu" }))
  }, [])

  const handleOpenMissionPlanning = useCallback(() => {
    setGameState((prev) => ({ ...prev, phase: "mission-planning" }))
  }, [])

  const handleLevelUpPilotSkill = useCallback((pilotId: string, skill: keyof PilotSkills) => {
    setGameState((prev) => {
      if (!prev.campaignState) return prev

      const updatedPilotsInBarracks = prev.campaignState.playerPilotsInBarracks.map((pilot) => {
        if (pilot.id === pilotId) {
          return levelUpPilotSkill(pilot, skill)
        }
        return pilot
      })

      return {
        ...prev,
        campaignState: {
          ...prev.campaignState,
          playerPilotsInBarracks: updatedPilotsInBarracks,
        },
      }
    })
  }, [])

  const handleAssignUnitToMission = useCallback((missionId: string, unitId: string) => {
    setGameState((prev) => {
      if (!prev.campaignState) return prev
      const updatedMissions = prev.campaignState.availableMissions.map((mission) => {
        if (
          mission.id === missionId &&
          mission.assignedUnitIds.length < mission.playerUnitLimit && // Use mission limit
          !mission.assignedUnitIds.includes(unitId)
        ) {
          return { ...mission, assignedUnitIds: [...mission.assignedUnitIds, unitId] }
        }
        return mission
      })
      // Also update roundMissions to reflect the assignment
      const updatedRoundMissions = prev.campaignState.roundMissions.map((mission) => {
        if (
          mission.id === missionId &&
          mission.assignedUnitIds.length < mission.playerUnitLimit &&
          !mission.assignedUnitIds.includes(unitId)
        ) {
          return { ...mission, assignedUnitIds: [...mission.assignedUnitIds, unitId] }
        }
        return mission
      })
      return {
        ...prev,
        campaignState: {
          ...prev.campaignState,
          availableMissions: updatedMissions,
          roundMissions: updatedRoundMissions,
        },
      }
    })
  }, [])

  const handleAssignPilotToMission = useCallback((missionId: string, pilotId: string) => {
    setGameState((prev) => {
      if (!prev.campaignState) return prev
      const updatedMissions = prev.campaignState.availableMissions.map((mission) => {
        if (
          mission.id === missionId &&
          mission.assignedPilotIds.length < mission.playerPilotLimit && // Use mission limit
          !mission.assignedPilotIds.includes(pilotId)
        ) {
          return { ...mission, assignedPilotIds: [...mission.assignedPilotIds, pilotId] }
        }
        return mission
      })
      // Also update roundMissions to reflect the assignment
      const updatedRoundMissions = prev.campaignState.roundMissions.map((mission) => {
        if (
          mission.id === missionId &&
          mission.assignedPilotIds.length < mission.playerPilotLimit &&
          !mission.assignedPilotIds.includes(pilotId)
        ) {
          return { ...mission, assignedPilotIds: [...mission.assignedPilotIds, pilotId] }
        }
        return mission
      })
      return {
        ...prev,
        campaignState: {
          ...prev.campaignState,
          availableMissions: updatedMissions,
          roundMissions: updatedRoundMissions,
        },
      }
    })
  }, [])

  const handleUnassignUnitFromMission = useCallback((missionId: string, unitId: string) => {
    setGameState((prev) => {
      if (!prev.campaignState) return prev
      const updatedMissions = prev.campaignState.availableMissions.map((mission) => {
        if (mission.id === missionId) {
          const newAssignedUnits = mission.assignedUnitIds.filter((id) => id !== unitId)
          // Also unassign pilot if this was the last unit for that pilot
          const newAssignedPilots = mission.assignedPilotIds.slice(0, newAssignedUnits.length) // Simple way to ensure pilot count matches unit count
          return { ...mission, assignedUnitIds: newAssignedUnits, assignedPilotIds: newAssignedPilots }
        }
        return mission
      })
      // Also update roundMissions
      const updatedRoundMissions = prev.campaignState.roundMissions.map((mission) => {
        if (mission.id === missionId) {
          const newAssignedUnits = mission.assignedUnitIds.filter((id) => id !== unitId)
          const newAssignedPilots = mission.assignedPilotIds.slice(0, newAssignedUnits.length)
          return { ...mission, assignedUnitIds: newAssignedUnits, assignedPilotIds: newAssignedPilots }
        }
        return mission
      })
      return {
        ...prev,
        campaignState: {
          ...prev.campaignState,
          availableMissions: updatedMissions,
          roundMissions: updatedRoundMissions,
        },
      }
    })
  }, [])

  const handleUnassignPilotFromMission = useCallback((missionId: string, pilotId: string) => {
    setGameState((prev) => {
      if (!prev.campaignState) return prev
      const updatedMissions = prev.campaignState.availableMissions.map((mission) => {
        if (mission.id === missionId) {
          const newAssignedPilots = mission.assignedPilotIds.filter((id) => id !== pilotId)
          return { ...mission, assignedPilotIds: newAssignedPilots }
        }
        return mission
      })
      // Also update roundMissions
      const updatedRoundMissions = prev.campaignState.roundMissions.map((mission) => {
        if (mission.id === missionId) {
          const newAssignedPilots = mission.assignedPilotIds.filter((id) => id !== pilotId)
          return { ...mission, assignedPilotIds: newAssignedPilots }
        }
        return mission
      })
      return {
        ...prev,
        campaignState: {
          ...prev.campaignState,
          availableMissions: updatedMissions,
          roundMissions: updatedRoundMissions,
        },
      }
    })
  }, [])

  const handleStartSelectedMission = useCallback(
    (missionId: string, isPassing = false) => {
      setGameState((prev) => {
        if (!prev.campaignState) return prev

        const missionToStart = prev.campaignState.availableMissions.find((m) => m.id === missionId)
        if (!missionToStart) {
          console.error(`Mission ${missionId} not found.`)
          return prev
        }

        if (isPassing) {
          console.log(`Passing mission: ${missionToStart.name}`)
          // Directly process mission end as an enemy victory (for VP)
          return processMissionEnd("enemy-victory", missionId, [], prev) // Empty units array for passed mission
        }

        // Updated logic for starting a mission (units assigned)
        const isReady =
          missionToStart.assignedUnitIds.length > 0 && // At least one unit assigned
          missionToStart.assignedPilotIds.length > 0 && // At least one pilot assigned
          missionToStart.assignedUnitIds.length === missionToStart.assignedPilotIds.length // Unit and pilot counts match

        if (!isReady) {
          console.warn(`Mission ${missionId} is not ready to start. Assign ships and pilots.`)
          return prev
        }

        // Get units for the mission, linking barracks units to barracks pilots
        const unitsForMission = getUnitsForMission(
          missionToStart,
          prev.campaignState.playerUnitsInBarracks,
          prev.campaignState.playerPilotsInBarracks,
        )

        // Generate asteroids after units are determined, passing units to avoid overlap
        const generatedAsteroids = generateAsteroids(
          Math.floor(Math.random() * 4) + 3, // 3 to 6 asteroids
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
          unitsForMission, // Pass units to avoid placing asteroids on them
        )

        // Update mission status to active in both availableMissions and roundMissions
        const updatedAvailableMissions = prev.campaignState.availableMissions.map((m) =>
          m.id === missionToStart.id ? { ...m, status: "active" as MissionStatus } : m,
        )
        const updatedRoundMissions = prev.campaignState.roundMissions.map((m) =>
          m.id === missionToStart.id ? { ...m, status: "active" as MissionStatus } : m,
        )

        return {
          ...prev,
          phase: "planning",
          currentTurn: prev.currentTurn, // Keep currentTurn as it's a turn within a round
          units: unitsForMission,
          asteroids: generatedAsteroids, // Set asteroids
          selectedUnit: null,
          resolutionTick: 0,
          winner: null,
          campaignState: {
            ...prev.campaignState,
            availableMissions: updatedAvailableMissions,
            roundMissions: updatedRoundMissions,
            currentMissionId: missionId,
          },
        }
      })
    },
    [processMissionEnd, getUnitsForMission, generateAsteroids],
  )

  const handleStartResolution = useCallback(() => {
    setGameState((prev) => {
      let newUnits = [...prev.units]

      // AI Control for Enemy Units
      newUnits = newUnits.map((unit) => {
        if (unit.team === "player" || unit.isDestroyed || unit.isEscaped) {
          return unit // Player units, destroyed, and escaped units don't need AI planning
        }

        const playerUnits = newUnits.filter((u) => u.team === "player" && !u.isDestroyed && !u.isEscaped)
        if (playerUnits.length === 0) {
          return unit // No targets, maintain current plan
        }

        let bestManeuver: Unit["plannedManeuver"] = "straight"
        let bestSpeedChange: Unit["plannedSpeedChange"] = "maintain"
        let bestScore = Number.POSITIVE_INFINITY // Lower score (distance) is better

        const maneuverOptions = [
          "straight",
          "bank-left",
          "bank-right",
          "turn-left",
          "turn-right",
          "one-eight-oh",
          "skid-left",
          "skid-right",
        ] as const
        const speedChangeOptions = getAvailableSpeedChanges(unit)

        let targetForAttack: Unit | null = null
        let minDistanceForAttackCheck = Number.POSITIVE_INFINITY

        // Phase 1: Check for an "attack goal" target (in front, within 2x weapon range)
        playerUnits.forEach((playerUnit) => {
          // Create a temporary unit for the isInAttackRange check, using its current angle
          const tempUnitForAttackCheck = { ...unit, angle: unit.angle }
          if (
            getDistance(tempUnitForAttackCheck, playerUnit) <= unit.weaponRange * 2 &&
            isInAttackRange(tempUnitForAttackCheck, playerUnit)
          ) {
            const dist = getDistance(unit, playerUnit)
            if (dist < minDistanceForAttackCheck) {
              minDistanceForAttackCheck = dist
              targetForAttack = playerUnit
            }
          }
        })

        if (targetForAttack) {
          targetForAttack = targetForAttack as Unit
          // AI Goal: Get as close as possible to targetForAttack while keeping it in attack range
          console.log(`${unit.id} (AI): Prioritizing attack on ${targetForAttack.id}`)
          for (const maneuver of maneuverOptions) {
            // Check if maneuver is valid for the unit's agility and pilot control/strain
            const requirements = getManeuverRequirements(maneuver, unit.speed) // Pass unit.speed
            const isTooDifficultForShipAgility = requirements.agility > unit.agility
            const isTooDifficultForPilotSkillLimit = requirements.difficulty > unit.pilot.skills.control + 1 // New check
            const isTooDifficultForPilotControl = requirements.difficulty > unit.pilot.skills.control
            const isBlockedByStrain = unit.pilot.strain >= unit.maxStrain && isTooDifficultForPilotControl
            const isTooSlowForOneEightOh = maneuver === "one-eight-oh" && unit.speed < 3

            if (
              isTooDifficultForShipAgility ||
              isTooDifficultForPilotSkillLimit ||
              isBlockedByStrain ||
              isTooSlowForOneEightOh
            ) {
              continue // Skip invalid maneuvers
            }

            for (const speedOpt of speedChangeOptions) {
              if (speedOpt.disabled) continue // Skip disabled speed changes

              const { simulatedUnit: simulatedOutcome, collidedWithAsteroid } = simulateManeuverOutcome(
                unit,
                maneuver,
                speedOpt.value,
                MAX_RESOLUTION_TICKS,
                prev.asteroids, // Pass asteroids for collision check
              )

              // Check if the target is still in attack range from the simulated end position
              if (isInAttackRange(simulatedOutcome, targetForAttack)) {
                let score = getDistance(simulatedOutcome, targetForAttack)
                if (collidedWithAsteroid) {
                  score += 10000 // Large penalty for asteroid collision
                }
                if (score < bestScore) {
                  bestScore = score
                  bestManeuver = maneuver
                  bestSpeedChange = speedOpt.value
                }
              }
            }
          }
          // If no maneuver keeps the target in range, fall back to general approach
          if (bestScore === Number.POSITIVE_INFINITY) {
            console.log(`${unit.id} (AI): Could not maintain attack range, falling back to approach.`)
            targetForAttack = null // Reset to trigger approach logic
          }
        }

        if (!targetForAttack) {
          // AI Goal: Get as close as possible to the nearest player unit
          console.log(`${unit.id} (AI): Prioritizing approach to nearest player unit.`)
          const nearestPlayerUnit = playerUnits.reduce((closest, current) => {
            const distCurrent = getDistance(unit, current)
            const distClosest = getDistance(unit, closest)
            return distCurrent < distClosest ? current : closest
          })

          for (const maneuver of maneuverOptions) {
            // Check if maneuver is valid for the unit's agility and pilot control/strain
            const requirements = getManeuverRequirements(maneuver, unit.speed) // Pass unit.speed
            const isTooDifficultForShipAgility = requirements.agility > unit.agility
            const isTooDifficultForPilotSkillLimit = requirements.difficulty > unit.pilot.skills.control + 1 // New check
            const isTooDifficultForPilotControl = requirements.difficulty > unit.pilot.skills.control
            const isBlockedByStrain = unit.pilot.strain >= unit.maxStrain && isTooDifficultForPilotControl
            const isTooSlowForOneEightOh = maneuver === "one-eight-oh" && unit.speed < 3

            if (
              isTooDifficultForShipAgility ||
              isTooDifficultForPilotSkillLimit ||
              isBlockedByStrain ||
              isTooSlowForOneEightOh
            ) {
              continue // Skip invalid maneuvers
            }

            for (const speedOpt of speedChangeOptions) {
              if (speedOpt.disabled) continue // Skip disabled speed changes

              const { simulatedUnit: simulatedOutcome, collidedWithAsteroid } = simulateManeuverOutcome(
                unit,
                maneuver,
                speedOpt.value,
                MAX_RESOLUTION_TICKS,
                prev.asteroids, // Pass asteroids for collision check
              )
              let score = getDistance(simulatedOutcome, nearestPlayerUnit)
              if (collidedWithAsteroid) {
                score += 10000 // Large penalty for asteroid collision
              }
              if (score < bestScore) {
                bestScore = score
                bestManeuver = maneuver
                bestSpeedChange = speedOpt.value
              }
            }
          }
        }

        // Apply the chosen plan to the unit
        return {
          ...unit,
          plannedManeuver: bestManeuver,
          plannedSpeedChange: bestSpeedChange,
          targetMode: targetForAttack ? "target-specific" : "fire-at-will", // If attacking, target specific, else fire at will
          specificTarget: targetForAttack ? targetForAttack.id : undefined,
        }
      })

      return {
        ...prev,
        phase: "resolution",
        resolutionTick: 0,
        selectedUnit: null, // Deselect any unit when starting resolution
        // Initialize all units for their maneuvers (this is where strain is applied/removed)
        units: newUnits.map((unit) => initializeManeuver(unit, MAX_RESOLUTION_TICKS)),
        // Reset asteroid collision tracking for the new resolution phase
        asteroids: prev.asteroids.map((asteroid) => ({ ...asteroid, collidedUnitsThisPhase: [] })),
      }
    })
  }, [])

  const handleEndResolution = useCallback(() => {
    setGameState((prev) => {
      let newUnits = [...prev.units]

      // Morale recovery at the end of the resolution phase
      newUnits = newUnits.map((unit) => {
        if (unit.isDestroyed || unit.isEscaped) return unit // Don't update morale for destroyed/escaped units
        const newMorale = Math.min(unit.pilot.morale + unit.pilot.skills.composure, unit.pilot.maxMorale)
        let updatedUnit = {
          ...unit,
          pilot: { ...unit.pilot, morale: newMorale },
          angle: unit.initialAngle + unit.finalOrientationChange,
        }
        // Set speed to 1 after One-Eight-Oh maneuver
        if (updatedUnit.plannedManeuver === "one-eight-oh") {
          updatedUnit = {
            ...updatedUnit,
            speed: 1,
          }
        }
        return updatedUnit
      })

      const playerUnitsInBattle = newUnits.filter((u) => u.team === "player" && !u.isDestroyed && !u.isEscaped).length
      const enemyUnitsInBattle = newUnits.filter((u) => u.team === "enemy" && !u.isDestroyed && !u.isEscaped).length

      // Handle Skirmish end (if not in campaign)
      if (!prev.campaignState || !prev.campaignState.currentMissionId) {
        let skirmishWinner: "player" | "enemy" | null = null
        if (playerUnitsInBattle === 0) {
          skirmishWinner = "enemy" // Player defeat
        } else if (enemyUnitsInBattle === 0) {
          skirmishWinner = "player" // Skirmish victory (all enemies destroyed)
        }

        if (skirmishWinner) {
          // Award XP for skirmish
          newUnits.forEach((unit) => {
            if (unit.team === "player" && !unit.isDestroyed && !unit.isEscaped) {
              const xpAward = skirmishWinner === "player" ? 10 : 2
              unit.pilot = gainExperience(unit.pilot, xpAward)
            }
          })
          return {
            ...prev,
            phase: "game-over",
            currentTurn: prev.currentTurn + 1,
            selectedUnit: null,
            winner: skirmishWinner,
            units: newUnits,
            asteroids: prev.asteroids,
          }
        } else {
          // Skirmish ongoing, return to planning
          return {
            ...prev,
            phase: "planning",
            currentTurn: prev.currentTurn + 1,
            selectedUnit: null,
            units: newUnits,
            asteroids: prev.asteroids,
          }
        }
      }

      // Campaign mission logic
      const currentMission = prev.campaignState.availableMissions.find(
        (m) => m.id === prev.campaignState!.currentMissionId,
      )

      if (!currentMission) {
        console.error("Current mission not found in handleEndResolution for campaign.")
        return prev
      }

      // Check mission victory conditions and get updated mission/units
      const { updatedMission, updatedUnits, isMissionComplete } = checkMissionVictoryConditions(
        currentMission,
        newUnits,
      )

      let battleOutcome: "player-victory" | "enemy-victory" | null = null // Initialize as null

      // Re-evaluate player and enemy units alive after objective checks (especially for escaped units)
      const finalPlayerUnitsInBattle = updatedUnits.filter(
        (u) => u.team === "player" && !u.isDestroyed && !u.isEscaped,
      ).length
      const finalEnemyUnitsInBattle = updatedUnits.filter(
        (u) => u.team === "enemy" && !u.isDestroyed && !u.isEscaped,
      ).length

      // Check for escort mission failure condition first (if escort targets are destroyed AND NOT escaped)
      if (updatedMission.type === "escort" && updatedMission.escortTargetUnitIds) {
        const allEscortTargetsDestroyedAndNotEscaped = updatedMission.escortTargetUnitIds.every((targetId) => {
          const targetUnit = updatedUnits.find((u) => u.id === targetId)
          // A target unit causes failure if it's destroyed AND it did not escape
          return targetUnit?.isDestroyed && !targetUnit?.isEscaped
        })

        if (allEscortTargetsDestroyedAndNotEscaped) {
          battleOutcome = "enemy-victory" // Player defeat
          console.log(`Escort mission failed: All escort targets destroyed before escaping.`)
        }
      }

      // If mission objectives are met, it's a player victory
      if (battleOutcome === null && isMissionComplete) {
        battleOutcome = "player-victory"
      }

      // If player units are all destroyed (and not escaped), it's a defeat (overrides other outcomes if both happen)
      if (finalPlayerUnitsInBattle === 0) {
        battleOutcome = "enemy-victory"
      }

      // If a definitive battle outcome is determined, process mission end
      if (battleOutcome !== null) {
        // Update the mission in availableMissions and roundMissions before processing end
        const updatedAvailableMissions = prev.campaignState.availableMissions.map((m) =>
          m.id === updatedMission.id ? updatedMission : m,
        )
        const updatedRoundMissions = prev.campaignState.roundMissions.map((m) =>
          m.id === updatedMission.id ? updatedMission : m,
        )

        return processMissionEnd(
          battleOutcome,
          updatedMission.id,
          updatedUnits, // Pass the units with updated destroyed/escaped status
          {
            ...prev,
            campaignState: {
              ...prev.campaignState,
              availableMissions: updatedAvailableMissions,
              roundMissions: updatedRoundMissions,
            },
            units: updatedUnits, // Ensure units are updated in prev state for processMissionEnd
          },
        )
      } else {
        // If no explicit victory/defeat condition met, and resolution ticks are done, the mission continues.
        console.log("Resolution ended, mission ongoing. Returning to planning phase for next turn.")
        // Update the mission in availableMissions and roundMissions with the latest objective status
        const updatedAvailableMissions = prev.campaignState.availableMissions.map((m) =>
          m.id === updatedMission.id ? updatedMission : m,
        )
        const updatedRoundMissions = prev.campaignState.roundMissions.map((m) =>
          m.id === updatedMission.id ? updatedMission : m,
        )

        const currentMissionIndex = prev.campaignState.availableMissions.findIndex(
            (m) => m.id === prev.campaignState!.currentMissionId,
          )
          if (currentMissionIndex !== -1) {
            const currentMission = { ...prev.campaignState.availableMissions[currentMissionIndex] }
            const updatedObjectives = currentMission.objectives.map((obj) => {
              if (obj.type === "visit-multiple-zones-and-return") {
                const visitObj = { ...obj } as VisitMultipleZonesAndReturnObjective // Create mutable copy
                console.log(visitObj)
              }
            })
          }

        return {
          ...prev,
          phase: "planning",
          currentTurn: prev.currentTurn + 1, // Increment turn for next planning phase
          selectedUnit: null,
          units: updatedUnits, // Keep units as they are for the next turn (with any new destroyed/escaped status)
          asteroids: prev.asteroids, // Keep asteroids
          campaignState: {
            ...prev.campaignState,
            availableMissions: updatedAvailableMissions,
            roundMissions: updatedRoundMissions,
          },
        }
      }
    })
  }, [processMissionEnd])

  // Effect for running resolution ticks
  useEffect(() => {
    if (gameState.phase !== "resolution") return

    const interval = setInterval(() => {
      setGameState((prev) => {
        // If already at max ticks or a winner is determined, just return prev state
        // The handleEndResolution will be triggered by the separate useEffect
        if (prev.resolutionTick >= prev.maxResolutionTicks || prev.winner !== null) {
          return prev
        }

        const currentWinner: "player" | "enemy" | null = null // Moved declaration to top
        const deltaTime = 0.1
        let newUnits = [...prev.units]
        const newAsteroids = [...prev.asteroids] // Create a mutable copy of asteroids

        const prevDestroyedStatus = new Map(prev.units.map((u) => [u.id, u.isDestroyed]))
        const prevEscapedStatus = new Map(prev.units.map((u) => [u.id, u.isEscaped]))

        // Update positions, weapon charges, and firing line countdowns
        newUnits = newUnits.map((unit) =>
          unit.isDestroyed || unit.isEscaped ? unit : updateUnitPosition(unit, deltaTime, prev.maxResolutionTicks),
        )

        // --- Asteroid Collision Detection and Damage ---
        // TODO: change this to be per unit / unit box
        const unitCollisionRadius = 20 // Approximate half-width/height of unit for collision
        newUnits.forEach((unit, unitIndex) => {
          if (unit.isDestroyed || unit.isEscaped) return

          newAsteroids.forEach((asteroid, asteroidIndex) => {
            // Check if unit has already collided with this asteroid in this phase
            if (asteroid.collidedUnitsThisPhase.includes(unit.id)) {
              return // Already collided, skip
            }

            // Simple circle-to-circle collision detection
            let collision_detected = CollisionDetector.polygonRectangleCollision(asteroid.points, getUnitPolygon(unit))
            if (collision_detected) {
              // Collision detected!
              const damage = 10 * unit.speed
              console.log(`${unit.id} collided with ${asteroid.id} at speed ${unit.speed}, taking ${damage} damage.`)

              // Apply damage to the unit
              newUnits[unitIndex] = dealDamage(newUnits[unitIndex], damage)

              // Mark unit as collided with this asteroid for this phase
              newAsteroids[asteroidIndex] = {
                ...newAsteroids[asteroidIndex],
                collidedUnitsThisPhase: [...newAsteroids[asteroidIndex].collidedUnitsThisPhase, unit.id],
              }

              // Morale penalty for colliding with asteroid
              newUnits[unitIndex] = {
                ...newUnits[unitIndex],
                pilot: {
                  ...newUnits[unitIndex].pilot,
                  morale: Math.max(newUnits[unitIndex].pilot.morale - 15, 0), // Significant morale hit
                },
              }
              console.log(`${unit.id} morale reduced to ${newUnits[unitIndex].pilot.morale} due to asteroid collision.`)
            }
          })
        })
        // --- End Asteroid Collision ---

        // Handle combat - process each unit independently
        newUnits.forEach((unit, index) => {
          if (unit.isDestroyed || unit.isEscaped) return

          // Only fire if weapon is fully charged
          if (!canFireWeapon(unit)) return

          // Get all enemies for this unit
          const enemies = newUnits.filter((u) => u.team !== unit.team && !u.isDestroyed && !u.isEscaped)
          let target: Unit | null = null

          // Determine target based on this unit's targeting mode
          if (unit.targetMode === "target-specific" && unit.specificTarget) {
            // Try to find the specific target
            const specificTarget = enemies.find((e) => e.id === unit.specificTarget)
            if (specificTarget && isInAttackRange(unit, specificTarget)) {
              target = specificTarget
            }
            // If specific target not found or not in range, don't fire
          } else if (unit.targetMode === "fire-at-will") {
            // Find best target in range
            target = findBestTarget(unit, enemies)
          }

          // Fire only if we have a valid target
          if (target) {
            let anyHitInBurst = false
            let totalDamageDealt = 0

            for (let i = 0; i < unit.burst; i++) {
              // Roll for attack accuracy and evasion for each burst shot
              const hit = rollAttack(
                unit.pilot.skills.gunnery,
                unit.pilot.morale,
                target.pilot.skills.control,
                target.speed,
              )

              if (hit) {
                anyHitInBurst = true
                const attackerStats = getUnitTypeStats(unit.unitType) // Get attacker's damage
                const damageDealtThisShot = attackerStats.damage
                totalDamageDealt += damageDealtThisShot
                console.log(
                  `Tick ${prev.resolutionTick}: ${unit.id} shot ${i + 1} HIT ${target.id} for ${damageDealtThisShot} damage.`,
                )
              } else {
                console.log(`Tick ${prev.resolutionTick}: ${unit.id} shot ${i + 1} MISSED ${target.id}`)
              }
            }

            // Apply accumulated damage after all burst shots
            if (totalDamageDealt > 0) {
              const targetIndex = newUnits.findIndex((u) => u.id === target!.id)
              if (targetIndex !== -1) {
                newUnits[targetIndex] = dealDamage(newUnits[targetIndex], totalDamageDealt)
                // Target loses morale when hit (once per burst, if damage was dealt)
                newUnits[targetIndex] = {
                  ...newUnits[targetIndex],
                  pilot: {
                    ...newUnits[targetIndex].pilot,
                    morale: Math.max(newUnits[targetIndex].pilot.morale - 5, 0),
                  },
                }
              }
              // Attacker gains morale on successful hit (if any hit occurred)
              newUnits[index] = {
                ...newUnits[index],
                pilot: {
                  ...newUnits[index].pilot,
                  morale: Math.min(newUnits[index].pilot.morale + 5, newUnits[index].pilot.maxMorale),
                },
              }
              console.log(
                `Tick ${prev.resolutionTick}: ${unit.id} burst dealt total ${totalDamageDealt} damage to ${target.id}. ${unit.id} morale +5, ${target.id} morale -5.`,
              )
            } else {
              console.log(`Tick ${prev.resolutionTick}: ${unit.id} burst missed all shots against ${target.id}.`)
            }

            // Create firing line (solid if any hit, dotted if all missed)
            newUnits[index] = createFiringLine(newUnits[index], target, anyHitInBurst)
          }
        })

        // --- Apply team-wide morale changes based on newly destroyed units ---
        const newlyDestroyedUnits = newUnits.filter((u) => u.isDestroyed && !prevDestroyedStatus.get(u.id))

        if (newlyDestroyedUnits.length > 0) {
          newlyDestroyedUnits.forEach((destroyedUnit) => {
            newUnits = newUnits.map((unit) => {
              if (unit.isDestroyed || unit.isEscaped) return unit // Don't apply morale changes to destroyed/escaped units

              if (unit.team === destroyedUnit.team) {
                // Friendly ship destroyed: lose morale
                console.log(
                  `Tick ${prev.resolutionTick}: Friendly ship ${destroyedUnit.id} destroyed. ${unit.id} loses 10 morale.`,
                )
                return {
                  ...unit,
                  pilot: {
                    ...unit.pilot,
                    morale: Math.max(unit.pilot.morale - 10, 0),
                  },
                }
              } else {
                // Enemy ship destroyed: gain morale
                console.log(
                  `Tick ${prev.resolutionTick}: Enemy ship ${destroyedUnit.id} destroyed. ${unit.id} gains 10 morale.`,
                )
                return {
                  ...unit,
                  pilot: {
                    ...unit.pilot,
                    morale: Math.min(unit.pilot.morale + 10, unit.pilot.maxMorale),
                  },
                }
              }
            })
          })
        }
        // --- End team-wide morale changes ---

        const finalUnitsAfterCombat = newUnits.map((unit) => {
          const originalUnit = prev.units.find((u) => u.id === unit.id)
          if (originalUnit && originalUnit.isDestroyed && !unit.isDestroyed) {
            // If a unit was destroyed in this tick, ensure its state is reflected
            return { ...unit, isDestroyed: true }
          }
          return unit
        })

        // Update mission objectives based on current unit positions
        if (prev.campaignState && prev.campaignState.currentMissionId) {
          const currentMissionIndex = prev.campaignState.availableMissions.findIndex(
            (m) => m.id === prev.campaignState!.currentMissionId,
          )
          if (currentMissionIndex !== -1) {
            const currentMission = { ...prev.campaignState.availableMissions[currentMissionIndex] }
            const updatedObjectives = currentMission.objectives.map((obj) => {
              if (obj.type === "reach-zone-and-return" && !obj.isCompleted) {
                const reachZoneObjective = { ...obj } as ReachZoneAndReturnObjective
                let objectiveChanged = false

                reachZoneObjective.targetUnitIds.forEach((unitId) => {
                  const unit = newUnits.find((u) => u.id === unitId)
                  if (!unit || unit.isDestroyed || unit.isEscaped) return // Skip destroyed or already escaped units

                  // Check if unit has reached the target zone (any point on its path)
                  if (!reachZoneObjective.hasReachedZone[unitId]) {
                    const plannedPath = calculatePlannedPath(unit, prev.maxResolutionTicks)
                    const targetZone = reachZoneObjective.targetZone
                    const enteredTargetZone = plannedPath.some((point) => {
                      const distanceToTargetZone = getDistance(point, targetZone)
                      return distanceToTargetZone <= targetZone.radius + UNIT_COLLISION_RADIUS
                    })

                    if (enteredTargetZone) {
                      reachZoneObjective.hasReachedZone = { ...reachZoneObjective.hasReachedZone, [unitId]: true }
                      console.log(`${unit.id} entered target zone!`)
                      objectiveChanged = true
                    }
                  }

                  // Check if unit has reached the escape zone AND previously reached the target zone
                  if (reachZoneObjective.hasReachedZone[unitId] && !reachZoneObjective.hasEscapedZone[unitId]) {
                    const escapeZoneRect = {
                      x: reachZoneObjective.escapeZone.x - reachZoneObjective.escapeZone.width / 2,
                      y: reachZoneObjective.escapeZone.y - reachZoneObjective.escapeZone.height / 2,
                      width: reachZoneObjective.escapeZone.width,
                      height: reachZoneObjective.escapeZone.height,
                    }

                    // AABB collision check for the escape zone (rectangle)
                    const unitHalfWidth = UNIT_COLLISION_RADIUS
                    const unitHalfHeight = UNIT_COLLISION_RADIUS

                    const unitLeft = unit.x - unitHalfWidth
                    const unitRight = unit.x + unitHalfWidth
                    const unitTop = unit.y - unitHalfHeight
                    const unitBottom = unit.y + unitHalfHeight

                    const zoneLeft = escapeZoneRect.x
                    const zoneRight = escapeZoneRect.x + escapeZoneRect.width
                    const zoneTop = escapeZoneRect.y
                    const zoneBottom = escapeZoneRect.y + escapeZoneRect.height

                    const isCollidingWithEscapeZone =
                      unitRight > zoneLeft && unitLeft < zoneRight && unitBottom > zoneTop && unitTop < zoneBottom

                    if (isCollidingWithEscapeZone) {
                      reachZoneObjective.hasEscapedZone = { ...reachZoneObjective.hasEscapedZone, [unitId]: true }
                      // Mark unit as escaped, NOT destroyed
                      const escapedUnitIndex = newUnits.findIndex((u) => u.id === unitId)
                      if (escapedUnitIndex !== -1) {
                        newUnits[escapedUnitIndex] = { ...newUnits[escapedUnitIndex], isEscaped: true }
                      }
                      console.log(`${unit.id} escaped the mission!`)
                      objectiveChanged = true
                    }
                  }
                })
                return objectiveChanged ? reachZoneObjective : obj
              } else if (obj.type === "visit-multiple-zones-and-return") {
                const visitObj = { ...obj } as VisitMultipleZonesAndReturnObjective // Create mutable copy
                const scoutUnit = finalUnitsAfterCombat.find((u) => u.id === visitObj.targetUnitIds[0]) // Assuming one scout unit
                if (scoutUnit && !scoutUnit.isDestroyed) {
                  // Check if scout enters any unvisited target zone
                  visitObj.targetZones.forEach((zone) => {
                    if (!visitObj.hasVisitedZone[zone.id]) {
                      // Check if the unit's current position is within the target zone
                      const enteredZone = getDistance(scoutUnit, zone) < zone.radius + 10 // UNIT_COLLISION_RADIUS is 10
                      if (enteredZone) {
                        visitObj.hasVisitedZone[zone.id] = true
                        console.log(`${scoutUnit.id} entered target zone ${zone.id}`)
                      }
                    }
                  })

                  // Check if scout enters escape zone AFTER visiting all target zones
                  const allTargetsVisited = visitObj.targetZones.every((zone) => visitObj.hasVisitedZone[zone.id])
                  if (allTargetsVisited && !visitObj.hasEscapedZone[scoutUnit.id]) {
                    const escapeZoneRect = {
                      x: visitObj.escapeZone.x - visitObj.escapeZone.width / 2,
                      y: visitObj.escapeZone.y - visitObj.escapeZone.height / 2,
                      width: visitObj.escapeZone.width,
                      height: visitObj.escapeZone.height,
                    }
                    // Check if the unit's current position is within the escape zone
                    const enteredEscapeZone = (scoutUnit.x < escapeZoneRect.x + escapeZoneRect.width && scoutUnit.y > escapeZoneRect.y && scoutUnit.y < escapeZoneRect.y + escapeZoneRect.height) ? true : false 
                    if (enteredEscapeZone) {
                      visitObj.hasEscapedZone = { ...visitObj.hasEscapedZone, [scoutUnit.id]: true }
                      // Mark unit as escaped, NOT destroyed
                      const escapedUnitIndex = newUnits.findIndex((u) => u.id === scoutUnit.id)
                      if (escapedUnitIndex !== -1) {
                        newUnits[escapedUnitIndex] = { ...newUnits[escapedUnitIndex], isEscaped: true }
                      }
                      console.log(`${scoutUnit.id} escaped mission.`)
                    }
                  }
                }
                return visitObj
              }
              return obj
            })

            // Update the mission in both availableMissions and roundMissions
            const updatedAvailableMissions = prev.campaignState.availableMissions.map((m, idx) =>
              idx === currentMissionIndex ? { ...currentMission, objectives: updatedObjectives } : m,
            )
            const updatedRoundMissions = prev.campaignState.roundMissions.map((m, idx) =>
              idx === currentMissionIndex ? { ...currentMission, objectives: updatedObjectives } : m,
            )

            const newTick = prev.resolutionTick + 1

            return {
              ...prev,
              campaignState: {
                ...prev.campaignState,
                availableMissions: updatedAvailableMissions,
                roundMissions: updatedRoundMissions,
              },
              units: newUnits, // Ensure units are updated with isEscaped status
              asteroids: newAsteroids,
              resolutionTick: newTick,
              winner: currentWinner,
            }
          }
        }

        // Keep units in bounds
        newUnits = newUnits.map((unit) => ({
          ...unit,
          x: Math.max(20, Math.min(CANVAS_WIDTH - 20, unit.x)),
          y: Math.max(20, Math.min(CANVAS_HEIGHT - 20, unit.y)),
        }))

        const newTick = prev.resolutionTick + 1

        // Check for winner AFTER all combat and morale updates for this tick
        // This check is primarily for skirmish or general defeat. Campaign victory is handled by objectives.
        const playerUnitsAlive = newUnits.filter((u) => u.team === "player" && !u.isDestroyed && !u.isEscaped).length
        const enemyUnitsAlive = newUnits.filter((u) => u.team === "enemy" && !u.isDestroyed && !u.isEscaped).length

        let winner: "player" | "enemy" | null = null
        if (playerUnitsAlive === 0) {
          winner = "enemy" // Player defeat
        } else if (prev.campaignState && prev.campaignState.currentMissionId) {
          // For campaign missions, check objectives for victory
          const currentMission = prev.campaignState.availableMissions.find(
            (m) => m.id === prev.campaignState!.currentMissionId,
          )
          if (currentMission) {
            // Check mission victory conditions and get updated mission/units
            const {
              updatedMission,
              updatedUnits: unitsAfterObjectiveCheck,
              isMissionComplete,
            } = checkMissionVictoryConditions(currentMission, newUnits) // No longer passing MAX_RESOLUTION_TICKS here
            newUnits = unitsAfterObjectiveCheck // Use the units updated by objective checks

            // Check for escort mission failure condition first (if escort targets are destroyed AND NOT escaped)
            if (updatedMission.type === "escort" && updatedMission.escortTargetUnitIds) {
              const allEscortTargetsDestroyedAndNotEscaped = updatedMission.escortTargetUnitIds.every((targetId) => {
                const targetUnit = newUnits.find((u) => u.id === targetId)
                return targetUnit?.isDestroyed && !targetUnit?.isEscaped
              })

              if (allEscortTargetsDestroyedAndNotEscaped) {
                winner = "enemy" // Player defeat
              }
            }

            // If no defeat by escort targets, check for player victory objectives
            if (winner === null && isMissionComplete) {
              winner = "player" // Campaign victory by objectives
            }
          }
        } else if (enemyUnitsAlive === 0) {
          winner = "player" // Skirmish victory (all enemies destroyed)
        }

        return {
          ...prev,
          units: newUnits,
          asteroids: newAsteroids, // Update asteroids state
          resolutionTick: newTick,
          winner: winner, // Update winner immediately if found
        }
      })
    }, 50)

    return () => clearInterval(interval)
  }, [gameState.phase]) // Only re-run when phase changes

  // Effect to trigger end of resolution phase or mission
  useEffect(() => {
    if (gameState.phase === "resolution") {
      // Check if resolution phase is naturally complete (all ticks done)
      // or if a winner was determined during the ticks
      if (gameState.resolutionTick >= gameState.maxResolutionTicks || gameState.winner !== null) {
        // Add a small delay to allow final canvas render
        const timeout = setTimeout(() => {
          handleEndResolution()
        }, 1000) // 1 second delay before transitioning
        return () => clearTimeout(timeout)
      }
    }
  }, [gameState.phase, gameState.resolutionTick, gameState.winner, handleEndResolution])

  const handleNewGame = () => {
    // When starting a new game from game-over, go back to main menu
    const initialRoster = generateInitialCampaignRoster()
    const newInitialMissions = generateMissions(CANVAS_WIDTH, CANVAS_HEIGHT) // Pass canvas dimensions
    setGameState({
      phase: "main-menu",
      currentTurn: 1,
      units: [],
      asteroids: [], // Clear asteroids on new game
      selectedUnit: null,
      resolutionTick: 0,
      maxResolutionTicks: MAX_RESOLUTION_TICKS,
      winner: null,
      campaignState: {
        playerUnitsInBarracks: initialRoster.units,
        playerPilotsInBarracks: initialRoster.pilots,
        availableMissions: newInitialMissions,
        roundMissions: newInitialMissions, // Set round missions
        currentMissionId: null,
        victoryPoints: { player: 0, enemy: 0 }, // Reset victory points
      },
    })
  }

  const renderContent = () => {
    const currentMission = gameState.campaignState?.currentMissionId
      ? gameState.campaignState.availableMissions.find((m) => m.id === gameState.campaignState?.currentMissionId)
      : undefined

    return (
      <>
        {(() => {
          switch (gameState.phase) {
            case "main-menu":
              return <MainMenu onSelectOption={handleSelectMainMenuOption} />
            case "skirmish-setup":
              return <SkirmishSetup onStartSkirmish={handleStartSkirmish} onBackToMenu={handleBackToMainMenu} />
            case "campaign-menu":
              return (
                <CampaignMenu
                  onOpenMissionPlanning={handleOpenMissionPlanning}
                  onOpenBarracks={handleOpenBarracks}
                  onBackToMainMenu={handleBackToMainMenu}
                />
              )
            case "barracks":
              return (
                <BarracksPanel
                  playerPilotsInBarracks={gameState.campaignState?.playerPilotsInBarracks || []}
                  onLevelUpPilotSkill={handleLevelUpPilotSkill}
                  onBackToCampaignMenu={handleBackToCampaignMenu}
                />
              )
            case "mission-planning":
              return (
                <CampaignMissionPlanning
                  availableMissions={gameState.campaignState?.roundMissions || []} // Use roundMissions here
                  playerUnitsInBarracks={gameState.campaignState?.playerUnitsInBarracks || []}
                  playerPilotsInBarracks={gameState.campaignState?.playerPilotsInBarracks || []}
                  onAssignUnitToMission={handleAssignUnitToMission}
                  onAssignPilotToMission={handleAssignPilotToMission}
                  onUnassignUnitFromMission={handleUnassignUnitFromMission}
                  onUnassignPilotFromMission={handleUnassignPilotFromMission}
                  onStartSelectedMission={handleStartSelectedMission}
                  onBackToCampaignMenu={handleBackToCampaignMenu}
                  playerVictoryPoints={gameState.campaignState?.victoryPoints.player || 0} // Pass VP
                  enemyVictoryPoints={gameState.campaignState?.victoryPoints.enemy || 0} // Pass VP
                />
              )
            case "planning":
            case "resolution":
              return (
                <div className="flex gap-4 justify-center">
                  <GameCanvas
                    units={gameState.units}
                    selectedUnit={gameState.selectedUnit}
                    onUnitSelect={handleUnitSelect}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    maxResolutionTicks={MAX_RESOLUTION_TICKS}
                    isPlanningPhase={gameState.phase === "planning"}
                    asteroids={gameState.asteroids} // Pass asteroids here
                    currentMission={currentMission} // Pass current mission objectives
                  />

                  {gameState.phase === "planning" ? (
                    <PlanningPanel
                      selectedUnit={selectedUnitData || null}
                      units={gameState.units}
                      onUpdateUnit={handleUpdateUnit}
                      onStartResolution={handleStartResolution}
                    />
                  ) : (
                    <ResolutionPanel
                      currentTick={gameState.resolutionTick}
                      maxTicks={gameState.maxResolutionTicks}
                      onEndResolution={handleEndResolution}
                    />
                  )}
                </div>
              )
            case "game-over":
              return (
                <Card className="w-96">
                  <CardHeader>
                    <CardTitle className="text-center">Game Over</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    <p className="text-2xl font-bold">
                      {gameState.winner === "player" ? "🎉 Campaign Victory!" : "💥 Campaign Defeat!"}
                    </p>
                    <p className="text-muted-foreground">
                      {gameState.winner === "player"
                        ? `You reached ${gameState.campaignState?.victoryPoints.player} Victory Points!`
                        : `The Enemy reached ${gameState.campaignState?.victoryPoints.enemy} Victory Points!`}
                    </p>
                    <Button onClick={handleNewGame} className="w-full">
                      New Game
                    </Button>
                  </CardContent>
                </Card>
              )
            default:
              return null
          }
        })()}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 flex flex-col items-center justify-center">
      {gameState.phase !== "main-menu" &&
        gameState.phase !== "skirmish-setup" &&
        gameState.phase !== "campaign-menu" &&
        gameState.phase !== "barracks" &&
        gameState.phase !== "mission-planning" && // Exclude mission planning from showing turn info
        gameState.phase !== "game-over" && (
          <div className="mb-4 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Space Dogfight</h1>
            <p className="text-gray-300">
              Turn {gameState.currentTurn} - {gameState.phase === "planning" ? "Planning Phase" : "Resolution Phase"}
            </p>
          </div>
        )}

      {gameState.phase === "mission-planning" && gameState.campaignState && (
        <div className="mb-4 text-center text-white">
          <h1 className="text-3xl font-bold mb-2">Campaign</h1>
          <p className="text-lg">
            Victory Points: Player {gameState.campaignState.victoryPoints.player} - Enemy{" "}
            {gameState.campaignState.victoryPoints.enemy}
          </p>
          <p className="text-gray-300">Turn {gameState.currentTurn} - Mission Planning</p>
        </div>
      )}

      {renderContent()}

      {gameState.phase !== "main-menu" &&
        gameState.phase !== "skirmish-setup" &&
        gameState.phase !== "campaign-menu" &&
        gameState.phase !== "barracks" &&
        gameState.phase !== "mission-planning" && // Exclude mission planning from showing New Game button
        gameState.phase !== "game-over" && (
          <div className="mt-4 text-center">
            <Button onClick={handleNewGame} variant="outline">
              New Game
            </Button>
          </div>
        )}
    </div>
  )
}

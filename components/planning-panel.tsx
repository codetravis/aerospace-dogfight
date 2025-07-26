"use client"

import type { Unit } from "../types/game"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  getManeuverRequirements,
  getPossibleTargetSpeeds,
  getSpeedLabel,
  calculateEffectiveSpeed,
} from "../utils/game-logic"
import { useEffect, useState } from "react"

interface PlanningPanelProps {
  selectedUnit: Unit | null
  units: Unit[]
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => void
  onStartResolution: () => void
}

export function PlanningPanel({ selectedUnit, units, onUpdateUnit, onStartResolution }: PlanningPanelProps) {
  const playerUnits = units.filter((u) => u.team === "player" && !u.isDestroyed)
  const enemyUnits = units.filter((u) => u.team === "enemy" && !u.isDestroyed)

  // State for the planned speed, initialized to the effective speed for the next turn
  const [plannedSpeed, setPlannedSpeed] = useState<number>(
    selectedUnit
      ? calculateEffectiveSpeed(selectedUnit.speed, selectedUnit.plannedSpeedChange, selectedUnit.maxSpeed)
      : 1,
  )

  // Update plannedSpeed when selectedUnit or its plannedSpeedChange changes
  useEffect(() => {
    if (selectedUnit) {
      const effectiveNextSpeed = calculateEffectiveSpeed(
        selectedUnit.speed,
        selectedUnit.plannedSpeedChange,
        selectedUnit.maxSpeed,
      )
      setPlannedSpeed(effectiveNextSpeed)
    }
  }, [selectedUnit]) // selectedUnit is a new object reference when its properties change, so this dependency is sufficient.

  if (!selectedUnit) {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Planning Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Select a unit to plan its maneuvers</p>
          <Button onClick={onStartResolution} className="w-full">
            Start Resolution Phase
          </Button>
        </CardContent>
      </Card>
    )
  }

  const maneuverOptions: Array<{ value: Unit["plannedManeuver"]; label: string }> = [
    { value: "straight", label: "Straight" },
    { value: "bank-left", label: "Bank Left (1/8 circle)" },
    { value: "bank-right", label: "Bank Right (1/8 circle)" },
    { value: "turn-left", label: "Turn Left (1/4 circle)" },
    { value: "turn-right", label: "Turn Right (1/4 circle)" },
    { value: "one-eight-oh", label: "One-Eight-Oh (180° Flip)" },
    { value: "skid-left", label: "Skid Left (90° Rotation)" },
    { value: "skid-right", label: "Skid Right (90° Rotation)" },
  ]

  const weaponChargePercent = (selectedUnit.weaponCharge / selectedUnit.maxWeaponCharge) * 100
  const possibleTargetSpeeds = getPossibleTargetSpeeds(selectedUnit.speed, selectedUnit.maxSpeed, selectedUnit.unitType)

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>
          {selectedUnit.id} ({getSpeedLabel(selectedUnit.unitType)})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Planned Speed</label>
          <select
            value={plannedSpeed}
            onChange={(e) => {
              const newTargetSpeed = Number.parseInt(e.target.value)
              setPlannedSpeed(newTargetSpeed)

              // Find the corresponding plannedSpeedChange to reach this target speed
              const selectedOption = possibleTargetSpeeds.find((opt) => opt.value === newTargetSpeed)

              if (selectedOption) {
                onUpdateUnit(selectedUnit.id, {
                  plannedSpeedChange: selectedOption.plannedChange,
                })
              }
            }}
            className="w-full mt-1 p-2 border rounded"
          >
            {possibleTargetSpeeds.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Maneuver</label>
          <select
            value={selectedUnit.plannedManeuver}
            onChange={(e) =>
              onUpdateUnit(selectedUnit.id, {
                plannedManeuver: e.target.value as Unit["plannedManeuver"],
              })
            }
            className="w-full mt-1 p-2 border rounded"
          >
            {maneuverOptions.map((option) => {
              const requirements = getManeuverRequirements(option.value, plannedSpeed) // Pass plannedSpeed
              const isTooDifficultForShipAgility = requirements.agility > selectedUnit.agility
              const isTooDifficultForPilotControl = requirements.difficulty > selectedUnit.pilot.skills.control
              const isBeyondPilotSkillLimit = requirements.difficulty > selectedUnit.pilot.skills.control + 1 // New check
              const isBlockedByStrain =
                selectedUnit.pilot.strain >= selectedUnit.maxStrain && isTooDifficultForPilotControl
              // Use the *plannedSpeed* for the one-eight-oh check
              const isTooSlowForOneEightOh = option.value === "one-eight-oh" && plannedSpeed < 3

              const isDisabled =
                isTooDifficultForShipAgility || isBeyondPilotSkillLimit || isBlockedByStrain || isTooSlowForOneEightOh

              let disabledReason = ""
              if (isTooDifficultForShipAgility) {
                disabledReason = `(Requires Agility ${requirements.agility}, Has ${selectedUnit.agility})`
              } else if (isBeyondPilotSkillLimit) {
                disabledReason = `(Requires Control ${requirements.difficulty}, Max Allowed ${selectedUnit.pilot.skills.control + 1})`
              } else if (isBlockedByStrain) {
                disabledReason = `(Max Strain Reached, Requires Control ${requirements.difficulty}, Has ${selectedUnit.pilot.skills.control})`
              } else if (isTooSlowForOneEightOh) {
                disabledReason = `(Requires Speed 3+, Planned ${plannedSpeed})` // Use plannedSpeed here
              } else if (isTooDifficultForPilotControl) {
                // This case is for when it's too difficult for control but not blocked by strain yet
                disabledReason = `(Requires Control ${requirements.difficulty}, Has ${selectedUnit.pilot.skills.control})`
              }

              return (
                <option key={option.value} value={option.value} disabled={isDisabled}>
                  {option.label} (Agility: {requirements.agility}, Difficulty: {requirements.difficulty}){" "}
                  {isDisabled && disabledReason}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Target Mode</label>
          <select
            value={selectedUnit.targetMode}
            onChange={(e) =>
              onUpdateUnit(selectedUnit.id, {
                targetMode: e.target.value as Unit["targetMode"],
              })
            }
            className="w-full mt-1 p-2 border rounded"
          >
            <option value="fire-at-will">Fire at Will</option>
            <option value="target-specific">Specific Target</option>
          </select>
        </div>

        {selectedUnit.targetMode === "target-specific" && (
          <div>
            <label className="text-sm font-medium">Target</label>
            <select
              value={selectedUnit.specificTarget || ""}
              onChange={(e) =>
                onUpdateUnit(selectedUnit.id, {
                  specificTarget: e.target.value || undefined,
                })
              }
              className="w-full mt-1 p-2 border rounded"
            >
              <option value="">Select Target</option>
              {enemyUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.id} ({getSpeedLabel(unit.unitType)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-4 space-y-2">
          <div className="text-sm">
            <span className="font-medium">Type:</span> {getSpeedLabel(selectedUnit.unitType)}
          </div>
          <div className="text-sm">
            <span className="font-medium">Health:</span> {selectedUnit.health}/{selectedUnit.maxHealth}
          </div>
          <div className="text-sm">
            <span className="font-medium">Shield:</span> {selectedUnit.shield}/{selectedUnit.maxShield}
          </div>
          <div className="text-sm">
            <span className="font-medium">Current Speed:</span> {getSpeedLabel(selectedUnit.speed)}
          </div>
          <div className="text-sm">
            <span className="font-medium">Max Speed:</span> {selectedUnit.maxSpeed}
          </div>
          <div className="text-sm">
            <span className="font-medium">Agility:</span> {selectedUnit.agility}
          </div>
          <div className="text-sm">
            <span className="font-medium">Weapon Range:</span> {selectedUnit.weaponRange}
          </div>
          <div className="text-sm">
            <span className="font-medium">Weapon Charge:</span> {selectedUnit.weaponCharge}/
            {selectedUnit.maxWeaponCharge}
          </div>
          <Progress value={weaponChargePercent} className="w-full" />
          {selectedUnit.weaponCharge >= selectedUnit.maxWeaponCharge && (
            <div className="text-xs text-green-600 font-medium">WEAPON READY</div>
          )}

          <div className="pt-2 border-t border-gray-700">
            <h3 className="text-md font-semibold mb-1">Pilot Skills</h3>
            <div className="text-sm">
              <span className="font-medium">Composure:</span> {selectedUnit.pilot.skills.composure}
            </div>
            <div className="text-sm">
              <span className="font-medium">Control:</span> {selectedUnit.pilot.skills.control}
            </div>
            <div className="text-sm">
              <span className="font-medium">Gunnery:</span> {selectedUnit.pilot.skills.gunnery}
            </div>
            <div className="text-sm">
              <span className="font-medium">Guts:</span> {selectedUnit.pilot.skills.guts}
            </div>
            <div className="text-sm mt-2">
              <span className="font-medium">Morale:</span> {selectedUnit.pilot.morale}/{selectedUnit.pilot.maxMorale}
            </div>
            <div className="text-sm">
              <span className="font-medium">Strain:</span> {selectedUnit.pilot.strain}/{selectedUnit.maxStrain}
            </div>
          </div>
        </div>

        <Button onClick={onStartResolution} className="w-full">
          Start Resolution Phase
        </Button>
      </CardContent>
    </Card>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Mission, Unit, Pilot, PilotSkills } from "../types/game"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface CampaignMissionPlanningProps {
  availableMissions: Mission[]
  playerUnitsInBarracks: Unit[]
  playerPilotsInBarracks: Pilot[]
  onAssignUnitToMission: (missionId: string, unitId: string) => void
  onAssignPilotToMission: (missionId: string, pilotId: string) => void
  onUnassignUnitFromMission: (missionId: string, unitId: string) => void
  onUnassignPilotFromMission: (missionId: string, pilotId: string) => void
  onStartSelectedMission: (missionId: string, isPassing?: boolean) => void // Modified signature
  onBackToCampaignMenu: () => void
  playerVictoryPoints: number // New prop
  enemyVictoryPoints: number // New prop
}

export function CampaignMissionPlanning({
  availableMissions,
  playerUnitsInBarracks,
  playerPilotsInBarracks,
  onAssignUnitToMission,
  onAssignPilotToMission,
  onUnassignUnitFromMission,
  onUnassignPilotFromMission,
  onStartSelectedMission,
  onBackToCampaignMenu,
  playerVictoryPoints, // Use new prop
  enemyVictoryPoints, // Use new prop
}: CampaignMissionPlanningProps) {
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [selectedPilotId, setSelectedPilotId] = useState<string | null>(null)

  const selectedMission = availableMissions.find((m) => m.id === selectedMissionId)

  const getUnitTypeLabel = (unitType: Unit["unitType"]) => {
    switch (unitType) {
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

  const getPilotSkillLabel = (skill: keyof PilotSkills) => {
    switch (skill) {
      case "composure":
        return "Composure"
      case "control":
        return "Control"
      case "gunnery":
        return "Gunnery"
      case "guts":
        return "Guts"
    }
  }

  const isUnitAssigned = (unitId: string) => availableMissions.some((m) => m.assignedUnitIds.includes(unitId))
  const isPilotAssigned = (pilotId: string) => availableMissions.some((m) => m.assignedPilotIds.includes(pilotId))

  const canAssignUnit =
    selectedMission &&
    selectedUnitId &&
    !isUnitAssigned(selectedUnitId) &&
    selectedMission.assignedUnitIds.length < selectedMission.playerUnitLimit // Use mission limit
  const canAssignPilot =
    selectedMission &&
    selectedPilotId &&
    !isPilotAssigned(selectedPilotId) &&
    selectedMission.assignedPilotIds.length < selectedMission.playerPilotLimit // Use mission limit

  const handleAssignUnit = () => {
    if (selectedMissionId && selectedUnitId) {
      onAssignUnitToMission(selectedMissionId, selectedUnitId)
      setSelectedUnitId(null) // Deselect after assignment
    }
  }

  const handleAssignPilot = () => {
    if (selectedMissionId && selectedPilotId) {
      onAssignPilotToMission(selectedMissionId, selectedPilotId)
      setSelectedPilotId(null) // Deselect after assignment
    }
  }

  const handleUnassignUnit = (unitId: string) => {
    if (selectedMissionId) {
      onUnassignUnitFromMission(selectedMissionId, unitId)
    }
  }

  const handleUnassignPilot = (pilotId: string) => {
    if (selectedMissionId) {
      onUnassignPilotFromMission(selectedMissionId, pilotId)
    }
  }

  // Updated isMissionReady: checks if at least one unit/pilot is assigned and counts match
  const isMissionReady = (mission: Mission) => {
    return mission.assignedUnitIds.length > 0 && mission.assignedUnitIds.length === mission.assignedPilotIds.length
  }

  const canPassMission = (mission: Mission) => {
    // Can pass if no units/pilots assigned and mission is pending and not yet played
    return (
      mission.status === "pending" &&
      !mission.isPlayed &&
      mission.assignedUnitIds.length === 0 &&
      mission.assignedPilotIds.length === 0
    )
  }

  // Get auto-assigned escort units for display
  const autoAssignedEscortUnits = selectedMission?.escortTargetUnitIds
    ? selectedMission.enemyUnits.filter((unit) => selectedMission.escortTargetUnitIds?.includes(unit.id))
    : []

  return (
    <Card className="w-[900px]">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Mission Planning</CardTitle>
        <div className="text-center text-sm text-muted-foreground">
          Victory Points: Player {playerVictoryPoints} - Enemy {enemyVictoryPoints}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {/* Missions List */}
          <div className="col-span-1 space-y-2">
            <h3 className="text-lg font-semibold">Available Missions</h3>
            {availableMissions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No missions available.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {availableMissions.map((mission) => (
                  <Card
                    key={mission.id}
                    className={cn(
                      "p-3 cursor-pointer transition-colors",
                      selectedMissionId === mission.id ? "border-blue-500 ring-2 ring-blue-500" : "hover:bg-gray-800",
                      (mission.status !== "pending" || mission.isPlayed) && "opacity-50 cursor-not-allowed", // Disable if not pending or already played
                    )}
                    onClick={() =>
                      mission.status === "pending" && !mission.isPlayed && setSelectedMissionId(mission.id)
                    }
                  >
                    <h4 className="font-semibold">{mission.name}</h4>
                    <p className="text-sm text-muted-foreground">{mission.description}</p>
                    <div className="text-xs mt-1">
                      <p>Status: {mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}</p>
                      <p>Played: {mission.isPlayed ? "Yes" : "No"}</p> {/* Show played status */}
                      <p>
                        Ships: {mission.assignedUnitIds.length} / {mission.playerUnitLimit}
                      </p>
                      <p>
                        Pilots: {mission.assignedPilotIds.length} / {mission.playerPilotLimit}
                      </p>
                    </div>
                    {selectedMissionId === mission.id && mission.status === "pending" && !mission.isPlayed && (
                      <div className="mt-2 flex gap-2">
                        {isMissionReady(mission) && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              onStartSelectedMission(mission.id)
                            }}
                          >
                            Start Mission
                          </Button>
                        )}
                        {canPassMission(mission) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation()
                              onStartSelectedMission(mission.id, true) // Pass true for isPassing
                            }}
                          >
                            Pass Mission
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Selected Mission Details & Assignment */}
          <div className="col-span-2 space-y-4">
            {selectedMission ? (
              <Card className="p-4">
                <h3 className="text-xl font-bold mb-2">{selectedMission.name}</h3>
                <p className="text-muted-foreground mb-4">{selectedMission.description}</p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Assigned Units */}
                  <div>
                    <h4 className="font-semibold mb-2">
                      Assigned Ships ({selectedMission.assignedUnitIds.length}/{selectedMission.playerUnitLimit})
                    </h4>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                      {selectedMission.assignedUnitIds.length === 0 && autoAssignedEscortUnits.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No ships assigned.</p>
                      ) : (
                        <>
                          {autoAssignedEscortUnits.map((unit) => (
                            <div key={unit.id} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                              <span className="text-sm">
                                {unit.id} ({getUnitTypeLabel(unit.unitType)}) - Auto-assigned
                              </span>
                            </div>
                          ))}
                          {selectedMission.assignedUnitIds.map((unitId) => {
                            const unit = playerUnitsInBarracks.find((u) => u.id === unitId)
                            return unit ? (
                              <div key={unit.id} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                                <span className="text-sm">
                                  {unit.id} ({getUnitTypeLabel(unit.unitType)})
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => handleUnassignUnit(unit.id)}>
                                  Unassign
                                </Button>
                              </div>
                            ) : null
                          })}
                        </>
                      )}
                    </div>
                    <div className="mt-4">
                      <Button onClick={handleAssignUnit} disabled={!canAssignUnit} className="w-full">
                        Assign Selected Ship
                      </Button>
                    </div>
                  </div>

                  {/* Assigned Pilots */}
                  <div>
                    <h4 className="font-semibold mb-2">
                      Assigned Pilots ({selectedMission.assignedPilotIds.length}/{selectedMission.playerPilotLimit})
                    </h4>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                      {selectedMission.assignedPilotIds.length === 0 && autoAssignedEscortUnits.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No pilots assigned.</p>
                      ) : (
                        <>
                          {autoAssignedEscortUnits.map((unit) => (
                            <div
                              key={unit.pilot.id}
                              className="flex items-center justify-between bg-gray-700 p-2 rounded"
                            >
                              <span className="text-sm">
                                {unit.pilot.name} (Lvl {unit.pilot.level}) - Auto-assigned
                              </span>
                            </div>
                          ))}
                          {selectedMission.assignedPilotIds.map((pilotId) => {
                            const pilot = playerPilotsInBarracks.find((p) => p.id === pilotId)
                            return pilot ? (
                              <div key={pilot.id} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                                <span className="text-sm">
                                  {pilot.name} (Lvl {pilot.level})
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => handleUnassignPilot(pilot.id)}>
                                  Unassign
                                </Button>
                              </div>
                            ) : null
                          })}
                        </>
                      )}
                    </div>
                    <div className="mt-4">
                      <Button onClick={handleAssignPilot} disabled={!canAssignPilot} className="w-full">
                        Assign Selected Pilot
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <p className="text-center text-muted-foreground">
                Select a mission to view details and assign units/pilots.
              </p>
            )}

            {/* Available Roster */}
            <div className="grid grid-cols-2 gap-4">
              {/* Available Units */}
              <div>
                <h4 className="font-semibold mb-2">Available Ships</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {playerUnitsInBarracks.filter((u) => !isUnitAssigned(u.id)).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No ships available.</p>
                  ) : (
                    playerUnitsInBarracks
                      .filter((u) => !isUnitAssigned(u.id))
                      .map((unit) => (
                        <div
                          key={unit.id}
                          className={cn(
                            "flex items-center justify-between bg-gray-800 p-2 rounded cursor-pointer transition-colors",
                            selectedUnitId === unit.id ? "border-blue-500 ring-2 ring-blue-500" : "hover:bg-gray-700",
                          )}
                          onClick={() => setSelectedUnitId(unit.id)}
                        >
                          <span className="text-sm">
                            {unit.id} ({getUnitTypeLabel(unit.unitType)})
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Available Pilots */}
              <div>
                <h4 className="font-semibold mb-2">Available Pilots</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {playerPilotsInBarracks.filter((p) => !isPilotAssigned(p.id)).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pilots available.</p>
                  ) : (
                    playerPilotsInBarracks
                      .filter((p) => !isPilotAssigned(p.id))
                      .map((pilot) => (
                        <div
                          key={pilot.id}
                          className={cn(
                            "flex items-center justify-between bg-gray-800 p-2 rounded cursor-pointer transition-colors",
                            selectedPilotId === pilot.id ? "border-blue-500 ring-2 ring-blue-500" : "hover:bg-gray-700",
                          )}
                          onClick={() => setSelectedPilotId(pilot.id)}
                        >
                          <span className="text-sm">
                            {pilot.name} (Lvl {pilot.level})
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={onBackToCampaignMenu} variant="outline" className="w-full bg-transparent mt-4">
          Back to Campaign Menu
        </Button>
      </CardContent>
    </Card>
  )
}

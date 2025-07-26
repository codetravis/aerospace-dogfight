"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { PilotSkills, Pilot } from "../types/game"

interface BarracksPanelProps {
  playerPilotsInBarracks: Pilot[] // Now directly pass pilots
  onLevelUpPilotSkill: (pilotId: string, skill: keyof PilotSkills) => void
  onBackToCampaignMenu: () => void
}

export function BarracksPanel({
  playerPilotsInBarracks,
  onLevelUpPilotSkill,
  onBackToCampaignMenu,
}: BarracksPanelProps) {
  return (
    <Card className="w-[600px]">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Barracks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {playerPilotsInBarracks.length === 0 ? (
          <p className="text-center text-muted-foreground">No pilots in barracks. Start a campaign to get pilots!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playerPilotsInBarracks.map((pilot) => (
              <Card key={pilot.id} className="p-4">
                <h3 className="text-lg font-semibold mb-2">
                  {pilot.name} (Level {pilot.level})
                </h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">XP:</span> {pilot.experience}
                  </p>
                  <Progress value={(pilot.experience % 10) * 10} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground">Next skill point at 10 XP</p>
                </div>
                <div className="mt-3 space-y-2">
                  {Object.entries(pilot.skills).map(([skillName, skillValue]) => (
                    <div key={skillName} className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">
                        {skillName}: {skillValue}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onLevelUpPilotSkill(pilot.id, skillName as keyof PilotSkills)}
                        disabled={pilot.experience < 10 || skillValue >= 10} // Max skill level 10 for now
                      >
                        Level Up (+1)
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
        <Button onClick={onBackToCampaignMenu} variant="outline" className="w-full bg-transparent mt-4">
          Back to Campaign Menu
        </Button>
      </CardContent>
    </Card>
  )
}

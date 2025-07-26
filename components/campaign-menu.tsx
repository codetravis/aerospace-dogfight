"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CampaignMenuProps {
  onOpenMissionPlanning: () => void // Changed from onStartMission
  onOpenBarracks: () => void
  onBackToMainMenu: () => void
}

export function CampaignMenu({ onOpenMissionPlanning, onOpenBarracks, onBackToMainMenu }: CampaignMenuProps) {
  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Campaign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onOpenMissionPlanning} className="w-full">
          Mission Planning
        </Button>
        <Button onClick={onOpenBarracks} className="w-full">
          Barracks
        </Button>
        <Button onClick={onBackToMainMenu} variant="outline" className="w-full bg-transparent">
          Back to Main Menu
        </Button>
      </CardContent>
    </Card>
  )
}

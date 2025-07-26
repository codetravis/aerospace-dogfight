"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MainMenuProps {
  onSelectOption: (option: "skirmish" | "campaign") => void
}

export function MainMenu({ onSelectOption }: MainMenuProps) {
  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle className="text-center text-3xl">Space Dogfight</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => onSelectOption("skirmish")} className="w-full">
          Skirmish
        </Button>
        <Button onClick={() => onSelectOption("campaign")} className="w-full">
          Campaign
        </Button>
      </CardContent>
    </Card>
  )
}

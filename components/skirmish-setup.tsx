"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SkirmishSetupProps {
  onStartSkirmish: (setupType: string) => void
  onBackToMenu: () => void
}

export function SkirmishSetup({ onStartSkirmish, onBackToMenu }: SkirmishSetupProps) {
  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Choose Battle Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => onStartSkirmish("dogfight")} className="w-full">
          Dogfight (2 Fighters vs 2 Fighters)
        </Button>
        <Button onClick={() => onStartSkirmish("escort")} className="w-full">
          Escort (2 Bombers, 2 Fighters vs 3 Interceptors)
        </Button>
        <Button onClick={() => onStartSkirmish("intercept")} className="w-full">
          Intercept (3 Interceptors vs 2 Fighters, 2 Bombers)
        </Button>
        <Button onClick={() => onStartSkirmish("lone-wolf")} className="w-full">
          Lone Wolf (1 Fighter vs 4 Bombers)
        </Button>
        <Button onClick={() => onStartSkirmish("test-flight")} className="w-full">
          Test Flight (1 of Each Ship Type)
        </Button>
        <Button onClick={onBackToMenu} variant="outline" className="w-full bg-transparent">
          Back to Main Menu
        </Button>
      </CardContent>
    </Card>
  )
}

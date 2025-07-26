"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface ResolutionPanelProps {
  currentTick: number
  maxTicks: number
  onEndResolution: () => void
}

export function ResolutionPanel({ currentTick, maxTicks, onEndResolution }: ResolutionPanelProps) {
  const progress = (currentTick / maxTicks) * 100

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Resolution Phase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Tick: {currentTick}</span>
            <span>Max: {maxTicks}</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        <p className="text-sm text-muted-foreground">
          Units are executing their planned maneuvers and engaging targets.
        </p>

        <Button onClick={onEndResolution} variant="outline" className="w-full bg-transparent">
          End Resolution Early
        </Button>
      </CardContent>
    </Card>
  )
}

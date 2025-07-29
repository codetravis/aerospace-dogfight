"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import type { Unit, Asteroid, Mission, DestroyUnitsObjective, ReachZoneAndReturnObjective, VisitMultipleZonesAndReturnObjective } from "../types/game"
import { calculatePlannedPath } from "../utils/game-logic"

interface GameCanvasProps {
  units: Unit[]
  selectedUnit: string | null
  onUnitSelect: (unitId: string | null) => void // Allow null for deselection
  width: number
  height: number
  maxResolutionTicks: number
  isPlanningPhase: boolean // New prop to indicate planning phase
  asteroids: Asteroid[] // New prop for asteroids
  currentMission?: Mission // Pass the entire current mission
}

export function GameCanvas({
  units,
  selectedUnit,
  onUnitSelect,
  width,
  height,
  maxResolutionTicks,
  isPlanningPhase, // Use this prop
  asteroids, // Use this prop
  currentMission, // Use this prop
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Effect for drawing all canvas elements
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Get device pixel ratio for high-DPI screens
    const dpr = window.devicePixelRatio || 1

    // Set canvas drawing buffer size based on DPR
    canvas.width = width * dpr
    canvas.height = height * dpr

    // Scale the context to ensure all drawing operations
    // are done in "CSS pixels" (logical pixels)
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = "#000011"
    ctx.fillRect(0, 0, width, height) // Use logical width/height here

    // Draw stars background
    ctx.fillStyle = "#ffffff"
    for (let i = 0; i < 100; i++) {
      const x = (i * 37) % width
      const y = (i * 73) % height
      ctx.fillRect(x, y, 1, 1)
    }

    // --- Draw Asteroids ---
    asteroids.forEach((asteroid) => {
      ctx.save()
      ctx.fillStyle = "#888888" // Gray color for asteroids
      ctx.strokeStyle = "#aaaaaa" // Lighter border
      ctx.lineWidth = 1

      ctx.beginPath()
      // Draw polygon based on points
      if (asteroid.points.length > 0) {
        ctx.moveTo(asteroid.points[0].x, asteroid.points[0].y)
        for (let i = 1; i < asteroid.points.length; i++) {
          ctx.lineTo(asteroid.points[i].x, asteroid.points[i].y)
        }
        ctx.closePath()
      } else {
        // Fallback to circle if no points (shouldn't happen with current generation)
        ctx.arc(asteroid.x, asteroid.y, asteroid.radius, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    })
    // --- End Draw Asteroids ---

    // --- Draw Mission Objectives (e.g., Target Zones) ---
    currentMission?.objectives.forEach((objective) => {
      if (objective.type === "reach-zone-and-return") {
        const reachZoneObjective = objective as ReachZoneAndReturnObjective
        const { x: targetX, y: targetY, radius: targetRadius } = reachZoneObjective.targetZone
        const { x: escapeX, y: escapeY, width: escapeWidth, height: escapeHeight } = reachZoneObjective.escapeZone

        // Draw Target Zone
        ctx.save()
        ctx.beginPath()
        ctx.arc(targetX, targetY, targetRadius, 0, Math.PI * 2)
        ctx.strokeStyle = "#00ffcc" // Cyan color for target zone
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5]) // Dashed circle
        ctx.stroke()

        // Fill with a transparent color if not completed, or solid if completed
        if (reachZoneObjective.isCompleted) {
          ctx.fillStyle = "#00ffcc40" // Light cyan transparent
          ctx.fill()
        } else {
          ctx.fillStyle = "#00ffcc20" // More transparent cyan
          ctx.fill()
        }

        ctx.font = "12px Arial"
        ctx.fillStyle = "#00ffcc"
        ctx.textAlign = "center"
        ctx.fillText("Target Zone", targetX, targetY - targetRadius - 10)
        ctx.restore()

        // Draw Escape Zone
        ctx.save()
        ctx.beginPath()
        // Rectangles are drawn from top-left corner, so adjust x,y for center
        ctx.rect(escapeX - escapeWidth / 2, escapeY - escapeHeight / 2, escapeWidth, escapeHeight)
        ctx.strokeStyle = "#ffcc00" // Orange color for escape zone
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5]) // Dashed rectangle
        ctx.stroke()

        // Fill with a transparent color
        ctx.fillStyle = "#ffcc0020" // Transparent orange
        ctx.fill()

        ctx.font = "12px Arial"
        ctx.fillStyle = "#ffcc00"
        ctx.textAlign = "center"
        ctx.fillText("Escape Zone", escapeX, escapeY - escapeHeight / 2 - 10)
        ctx.restore()
      } else if (objective.type === "visit-multiple-zones-and-return") {
        const visitObj = objective as VisitMultipleZonesAndReturnObjective
        const { x: escapeX, y: escapeY, width: escapeWidth, height: escapeHeight } = visitObj.escapeZone

        // Draw multiple target zones
        visitObj.targetZones.forEach((zone) => {
          ctx.save()
          ctx.beginPath()
          ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2)
          ctx.strokeStyle = visitObj.hasVisitedZone[zone.id] ? "#00ff00" : "#ff0000" // Green if visited, red if not
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.stroke()

          ctx.fillStyle = visitObj.hasVisitedZone[zone.id] ? "#00ff0040" : "#ff000020"
          ctx.fill()

          ctx.font = "12px Arial"
          ctx.fillStyle = visitObj.hasVisitedZone[zone.id] ? "#00ff00" : "#ff0000"
          ctx.textAlign = "center"
          ctx.fillText(`Target ${zone.id.split("-").pop()}`, zone.x, zone.y - zone.radius - 10)
          ctx.restore()
        })

        // Draw Escape (rectangular) zone – dashed yellow rectangle
        ctx.save()
        ctx.strokeStyle = "rgba(255,255,0,0.8)"
        ctx.setLineDash([6, 4])
        ctx.lineWidth = 2
        ctx.strokeRect(escapeX - escapeWidth / 2, escapeY - escapeHeight / 2, escapeWidth, escapeHeight)
        ctx.restore()
      }
    })
    // --- End Draw Mission Objectives ---

    // Draw weapon range for selected unit FIRST (behind everything)
    const selectedUnitData = units.find((u) => u.id === selectedUnit)
    if (selectedUnitData && !selectedUnitData.isDestroyed && !selectedUnitData.isEscaped) {
      ctx.save()
      ctx.translate(selectedUnitData.x, selectedUnitData.y)
      ctx.rotate(selectedUnitData.angle)
      ctx.strokeStyle = "#ffff0044"
      ctx.lineWidth = 1
      ctx.setLineDash([])
      // Draw the targeting rectangle: 40 pixels wide, extending forward by weapon range
      ctx.strokeRect(0, -20, selectedUnitData.weaponRange, 40)
      ctx.restore()
    }

    // Draw firing lines (behind ships but above weapon range)
    units.forEach((unit) => {
      if (unit.firingLine && unit.firingLine.ticksRemaining > 0) {
        ctx.save()

        if (unit.firingLine.hasTarget) {
          // Solid line for hits
          ctx.strokeStyle = unit.team === "player" ? "#00ff00" : "#ff0000"
          ctx.lineWidth = 2
          ctx.setLineDash([])
        } else {
          // Dotted line for misses
          ctx.strokeStyle = unit.team === "player" ? "#00ff0080" : "#ff000080"
          ctx.lineWidth = 1
          ctx.setLineDash([5, 5])
        }

        ctx.beginPath()
        ctx.moveTo(unit.firingLine.fromX, unit.firingLine.fromY)
        ctx.lineTo(unit.firingLine.toX, unit.firingLine.toY)
        ctx.stroke()

        ctx.restore()
      }
    })

    // Draw selection boxes for ALL units BEFORE drawing the ships
    units.forEach((unit) => {
      if (unit.isDestroyed || unit.isEscaped) return // Don't draw selection box for destroyed or escaped units

      ctx.save()

      // Selection box - always visible
      if (unit.id === selectedUnit) {
        // Light blue for selected unit
        ctx.fillStyle = "#00bfff20" // Light blue with transparency
        ctx.strokeStyle = "#00bfff"
        ctx.lineWidth = 2
      } else {
        // Transparent yellow for unselected units
        ctx.fillStyle = "#ffff0015" // Very transparent yellow
        ctx.strokeStyle = "#ffff0060" // Semi-transparent yellow
        ctx.lineWidth = 1
      }

      ctx.setLineDash([])

      // Draw filled rectangle
      ctx.fillRect(unit.x - 25, unit.y - 20, 50, 40)
      // Draw border
      ctx.strokeRect(unit.x - 25, unit.y - 20, 50, 40)

      ctx.restore()
    })

    // Draw planned path for selected unit ONLY IF IN PLANNING PHASE
    if (isPlanningPhase && selectedUnitData && !selectedUnitData.isDestroyed && !selectedUnitData.isEscaped) {
      const path = calculatePlannedPath(selectedUnitData, maxResolutionTicks)
      if (path.length > 1) {
        ctx.save()
        ctx.strokeStyle = "#ffffff" // White dashed line
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5]) // Dashed line

        ctx.beginPath()
        ctx.moveTo(path[0].x, path[0].y)
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y)
        }
        ctx.stroke()
        ctx.restore()
      }
    }

    // Draw units on top of selection boxes
    units.forEach((unit) => {
      if (unit.isDestroyed || unit.isEscaped) return // Don't draw destroyed or escaped units

      ctx.save()
      ctx.translate(unit.x, unit.y)
      ctx.rotate(unit.angle)

      // Draw unit body with different shapes for different types
      ctx.fillStyle = unit.team === "player" ? "#00ff00" : "#ff0000"

      // Different ship shapes based on unit type
      ctx.beginPath()
      switch (unit.unitType) {
        case "fighter":
          // Sleek fighter shape
          ctx.moveTo(15, 0)
          ctx.lineTo(-8, -6)
          ctx.lineTo(-5, 0)
          ctx.lineTo(-8, 6)
          ctx.closePath()
          break
        case "bomber":
          // Bulky bomber shape
          ctx.moveTo(10, 4)
          ctx.lineTo(10, -4)
          ctx.lineTo(-6, -15)
          ctx.lineTo(-15, -15)
          ctx.lineTo(-15, -4)
          ctx.lineTo(-10, -2)
          ctx.lineTo(-10, 2)
          ctx.lineTo(-15, 4)
          ctx.lineTo(-15, 15)
          ctx.lineTo(-6, 15)
          ctx.closePath()
          break
        case "interceptor":
          // Fast interceptor shape
          ctx.moveTo(10, 1)
          ctx.lineTo(10, -1)
          ctx.lineTo(15, -4)
          ctx.lineTo(6, -4)
          ctx.lineTo(-2, -4)
          ctx.lineTo(-8, -6)
          ctx.lineTo(-10, -6)
          ctx.lineTo(-10, 6)
          ctx.lineTo(-8, 6)
          ctx.lineTo(-2, 4)
          ctx.lineTo(6, 4)
          ctx.lineTo(15, 4)
          ctx.closePath()
          break
        case "scout":
          // Sleek fighter shape
          ctx.moveTo(5, 3)
          ctx.lineTo(5, -3)
          ctx.lineTo(-8, -6)
          ctx.lineTo(-5, 0)
          ctx.lineTo(-8, 6)
          ctx.closePath()
          break
        case "heavy_fighter":
          // Sleek fighter shape
          ctx.moveTo(15, 0)
          ctx.lineTo(-1, -6)
          ctx.lineTo(-8, -6)
          ctx.lineTo(-5, 0)
          ctx.lineTo(-8, 6)
          ctx.lineTo(-1, 6)
          ctx.closePath()
          break
      }
      ctx.fill()

      ctx.restore()

      // Health bar (drawn in world coordinates, not rotated)
      const healthPercent = unit.health / unit.maxHealth
      const shieldPercent = unit.shield / unit.maxShield

      ctx.fillStyle = "#ff0000"
      ctx.fillRect(unit.x - 15, unit.y - 20, 30, 4)
      ctx.fillStyle = "#00ff00"
      ctx.fillRect(unit.x - 15, unit.y - 20, 30 * healthPercent, 4)

      if (unit.shield > 0) {
        ctx.fillStyle = "#0088ff"
        ctx.fillRect(unit.x - 15, unit.y - 25, 30 * shieldPercent, 3)
      }

      // Draw unit type indicator
      ctx.fillStyle = "#ffffff"
      ctx.font = "10px Arial"
      ctx.textAlign = "center"
      const typeLabel = unit.unitType.charAt(0).toUpperCase() // F, B, I, S, or H
      ctx.fillText(typeLabel, unit.x, unit.y + 35)

      // Draw "Reached Zone" indicator for bombers
      if ((unit.unitType === "bomber" || unit.unitType === "scout") && unit.team === "player" && currentMission) {
        const reachZoneObjective = currentMission.objectives.find((obj) => obj.type === "reach-zone-and-return") as
          | ReachZoneAndReturnObjective
          | undefined

        if (reachZoneObjective) {
          if (reachZoneObjective.hasReachedZone[unit.id]) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(unit.x + 20, unit.y - 20, 5, 0, Math.PI * 2) // Small green circle
            ctx.fillStyle = "#00ff00"
            ctx.fill()
            ctx.restore()
          }
          if (reachZoneObjective.hasEscapedZone[unit.id]) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(unit.x + 20, unit.y - 10, 5, 0, Math.PI * 2) // Small blue circle for escaped
            ctx.fillStyle = "#00bfff"
            ctx.fill()
            ctx.restore()
          }
        }
      }

      // Draw Reached all Zone inidcator for Recon scout
      if ((unit.unitType === "scout") && unit.team === "player" && currentMission) {
        const visitMultipleObjective = currentMission.objectives.find((obj) => obj.type === "visit-multiple-zones-and-return") as 
         | VisitMultipleZonesAndReturnObjective
         | undefined

        if (visitMultipleObjective) {
          if (visitMultipleObjective.targetZones.every((zone) => visitMultipleObjective.hasVisitedZone[zone.id])) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(unit.x + 20, unit.y - 20, 5, 0, Math.PI * 2) // Small green circle
            ctx.fillStyle = "#00ff00"
            ctx.fill()
            ctx.restore()
          }
          if (visitMultipleObjective.hasEscapedZone[unit.id]) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(unit.x + 20, unit.y - 10, 5, 0, Math.PI * 2) // Small blue circle for escaped
            ctx.fillStyle = "#00bfff"
            ctx.fill()
            ctx.restore()
          }
        }
      }

    })
  }, [units, selectedUnit, width, height, maxResolutionTicks, isPlanningPhase, asteroids, currentMission])

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // Calculate scaling factors if canvas is rendered at a different size than its intrinsic resolution
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    // Calculate click coordinates relative to the canvas, accounting for CSS scaling
    const clickX = (event.clientX - rect.left) * scaleX
    const clickY = (event.clientY - rect.top) * scaleY

    // Adjust clickX and clickY back to logical CSS pixels for drawing and unit detection
    // since ctx.scale(dpr, dpr) was applied in the useEffect
    const dpr = window.devicePixelRatio || 1
    const logicalClickX = clickX / dpr
    const logicalClickY = clickY / dpr

    // Find the unit that was clicked (simple rectangular bounds check)
    let foundUnit = false
    for (let i = 0; i < units.length; i++) {
      const unit = units[i]
      if (unit.isDestroyed || unit.isEscaped) continue // Don't select destroyed or escaped units

      // Check if click is within the selection box bounds using logical coordinates
      const withinX = logicalClickX >= unit.x - 25 && logicalClickX <= unit.x + 25
      const withinY = logicalClickY >= unit.y - 20 && logicalClickY <= unit.y + 20

      if (withinX && withinY) {
        onUnitSelect(unit.id)
        foundUnit = true
        break // Exit after selecting the first unit found
      }
    }

    if (!foundUnit && selectedUnit) {
      // If no unit was clicked and a unit was previously selected, deselect it
      onUnitSelect(null)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      className="border border-gray-600 cursor-pointer"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  )
}

'use client'

import { useMemo } from 'react'
import { format, subDays, startOfDay, eachDayOfInterval, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ActivityData {
  date: string // YYYY-MM-DD
  count: number
}

interface ActivityHeatmapProps {
  data: ActivityData[]
  months?: number // numero de meses para mostrar (default: 12)
  colorScheme?: 'green' | 'blue' | 'purple'
  showMonthLabels?: boolean
  showWeekdayLabels?: boolean
  tooltip?: (date: string, count: number) => string
}

const colorSchemes = {
  green: {
    empty: 'bg-zinc-800/50',
    level1: 'bg-emerald-900/60',
    level2: 'bg-emerald-700/70',
    level3: 'bg-emerald-500/80',
    level4: 'bg-emerald-400',
  },
  blue: {
    empty: 'bg-zinc-800/50',
    level1: 'bg-blue-900/60',
    level2: 'bg-blue-700/70',
    level3: 'bg-blue-500/80',
    level4: 'bg-blue-400',
  },
  purple: {
    empty: 'bg-zinc-800/50',
    level1: 'bg-purple-900/60',
    level2: 'bg-purple-700/70',
    level3: 'bg-purple-500/80',
    level4: 'bg-purple-400',
  },
}

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function ActivityHeatmap({
  data,
  months = 12,
  colorScheme = 'green',
  showMonthLabels = true,
  showWeekdayLabels = true,
  tooltip,
}: ActivityHeatmapProps) {
  const colors = colorSchemes[colorScheme]

  // Criar mapa de data -> count
  const dataMap = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(item => {
      map.set(item.date, item.count)
    })
    return map
  }, [data])

  // Gerar array de dias
  const days = useMemo(() => {
    const endDate = startOfDay(new Date())
    const startDate = subDays(endDate, months * 30) // aproximadamente X meses

    // Ajustar para comecar no domingo
    const adjustedStart = subDays(startDate, getDay(startDate))

    return eachDayOfInterval({ start: adjustedStart, end: endDate })
  }, [months])

  // Agrupar por semana
  const weeks = useMemo(() => {
    const result: Date[][] = []
    let currentWeek: Date[] = []

    days.forEach((day) => {
      currentWeek.push(day)
      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
      }
    })

    if (currentWeek.length > 0) {
      result.push(currentWeek)
    }

    return result
  }, [days])

  // Calcular posicoes dos labels de mes
  const monthPositions = useMemo(() => {
    const positions: { month: number; weekIndex: number }[] = []
    let lastMonth = -1

    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0]
      const month = firstDayOfWeek.getMonth()

      if (month !== lastMonth) {
        positions.push({ month, weekIndex })
        lastMonth = month
      }
    })

    return positions
  }, [weeks])

  // Determinar nivel de cor baseado na contagem
  const getColorLevel = (count: number) => {
    if (count === 0) return colors.empty
    if (count <= 2) return colors.level1
    if (count <= 5) return colors.level2
    if (count <= 10) return colors.level3
    return colors.level4
  }

  // Calcular total
  const total = useMemo(() => {
    let sum = 0
    data.forEach(item => {
      sum += item.count
    })
    return sum
  }, [data])

  const defaultTooltip = (date: string, count: number) => {
    const formattedDate = format(new Date(date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    return `${count} ${count === 1 ? 'sticker' : 'stickers'} em ${formattedDate}`
  }

  return (
    <div className="space-y-2">
      {/* Month labels */}
      {showMonthLabels && (
        <div className="flex text-xs text-muted-foreground ml-8">
          <div className="flex" style={{ gap: '3px' }}>
            {monthPositions.map(({ month, weekIndex }, index) => {
              const nextPos = monthPositions[index + 1]?.weekIndex || weeks.length
              const width = (nextPos - weekIndex) * 13 // 10px cell + 3px gap

              return (
                <div
                  key={`${month}-${weekIndex}`}
                  style={{ width: `${width}px` }}
                  className="text-left"
                >
                  {monthLabels[month]}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-1">
        {/* Weekday labels */}
        {showWeekdayLabels && (
          <div className="flex flex-col text-xs text-muted-foreground pr-1" style={{ gap: '3px' }}>
            {weekdayLabels.map((label, index) => (
              <div
                key={label}
                className="h-[10px] flex items-center justify-end"
                style={{ visibility: index % 2 === 1 ? 'visible' : 'hidden' }}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Heatmap grid */}
        <div className="flex overflow-x-auto" style={{ gap: '3px' }}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col" style={{ gap: '3px' }}>
              {week.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const count = dataMap.get(dateStr) || 0
                const tooltipText = tooltip ? tooltip(dateStr, count) : defaultTooltip(dateStr, count)

                return (
                  <div
                    key={dateStr}
                    className={`w-[10px] h-[10px] rounded-sm ${getColorLevel(count)} cursor-pointer transition-all hover:ring-1 hover:ring-white/50`}
                    title={tooltipText}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} stickers no periodo</span>
        <div className="flex items-center gap-1">
          <span>Menos</span>
          <div className={`w-[10px] h-[10px] rounded-sm ${colors.empty}`} />
          <div className={`w-[10px] h-[10px] rounded-sm ${colors.level1}`} />
          <div className={`w-[10px] h-[10px] rounded-sm ${colors.level2}`} />
          <div className={`w-[10px] h-[10px] rounded-sm ${colors.level3}`} />
          <div className={`w-[10px] h-[10px] rounded-sm ${colors.level4}`} />
          <span>Mais</span>
        </div>
      </div>
    </div>
  )
}

'use client'

import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface DataPoint {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface PieChartProps {
  data: DataPoint[]
  height?: number
  innerRadius?: number
  showLegend?: boolean
  formatValue?: (value: number) => string
}

export function PieChart({
  data,
  height = 300,
  innerRadius = 60,
  showLegend = true,
  formatValue = (v) => v.toLocaleString(),
}: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={innerRadius + 40}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const item = payload[0].payload
              const percentage = ((item.value / total) * 100).toFixed(1)
              return (
                <div className="rounded-lg border border-border bg-background p-2 shadow-sm">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatValue(item.value)} ({percentage}%)
                  </p>
                </div>
              )
            }
            return null
          }}
        />
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={36}
            content={({ payload }) => (
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {payload?.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}

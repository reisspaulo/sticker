'use client'

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DataPoint {
  date: string
  value: number
  label?: string
}

interface AreaChartProps {
  data: DataPoint[]
  color?: string
  height?: number
  showGrid?: boolean
  formatValue?: (value: number) => string
}

export function AreaChart({
  data,
  color = 'hsl(var(--primary))',
  height = 300,
  showGrid = true,
  formatValue = (v) => v.toLocaleString(),
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
        )}
        <XAxis
          dataKey="label"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatValue}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border border-border bg-background p-2 shadow-sm">
                  <p className="text-sm font-medium">{payload[0].payload.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatValue(payload[0].value as number)}
                  </p>
                </div>
              )
            }
            return null
          }}
        />
        <defs>
          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill="url(#colorGradient)"
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}

'use client'

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DataPoint {
  name: string
  value: number
  color?: string
}

interface BarChartProps {
  data: DataPoint[]
  color?: string
  height?: number
  horizontal?: boolean
  formatValue?: (value: number) => string
}

export function BarChart({
  data,
  color = 'hsl(var(--primary))',
  height = 300,
  horizontal = false,
  formatValue = (v) => v.toLocaleString(),
}: BarChartProps) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={80}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border border-border bg-background p-2 shadow-sm">
                    <p className="text-sm font-medium">{payload[0].payload.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatValue(payload[0].value as number)}
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[0, 4, 4, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatValue}
          tick={{ fill: 'var(--muted-foreground)' }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border border-border bg-background p-2 shadow-sm">
                  <p className="text-sm font-medium">{payload[0].payload.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatValue(payload[0].value as number)}
                  </p>
                </div>
              )
            }
            return null
          }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

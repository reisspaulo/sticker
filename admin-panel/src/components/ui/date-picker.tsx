"use client"

import * as React from "react"
import { format, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
  presets?: { label: string; days: number }[]
}

const defaultPresets = [
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 14 dias", days: 14 },
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 60 dias", days: 60 },
  { label: "Últimos 90 dias", days: 90 },
]

export function DatePickerWithRange({
  dateRange,
  onDateRangeChange,
  className,
  presets = defaultPresets,
}: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false)

  const handlePresetClick = (days: number) => {
    const to = new Date()
    const from = subDays(to, days)
    onDateRangeChange({ from, to })
    setOpen(false)
  }

  const formatDateRange = () => {
    if (!dateRange?.from) {
      return "Selecione um período"
    }

    if (dateRange.to) {
      return `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(
        dateRange.to,
        "dd/MM/yyyy",
        { locale: ptBR }
      )}`
    }

    return format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant="outline"
          className={cn(
            "w-[260px] justify-start text-left font-normal",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="border-r p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              Períodos
            </p>
            {presets.map((preset) => (
              <Button
                key={preset.days}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => handlePresetClick(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                onDateRangeChange(range)
                if (range?.from && range?.to) {
                  setOpen(false)
                }
              }}
              numberOfMonths={2}
              locale={ptBR}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  className?: string
  placeholder?: string
}

export function DatePicker({
  date,
  onDateChange,
  className,
  placeholder = "Selecione uma data",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[200px] justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            onDateChange(newDate)
            setOpen(false)
          }}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  )
}

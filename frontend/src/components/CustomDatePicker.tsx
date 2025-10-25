import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface CustomDatePickerProps {
  value: string
  onChange: (value: string) => void
  min?: string
  className?: string
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  min,
  className = ""
}) => {
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const formatDisplayValue = (dateString: string): string => {
    // Direct string manipulation to avoid timezone issues
    const [year, month, day] = dateString.split('-')
    return `${month}/${day}/${year}`
  }

  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? parseLocalDate(value) : null
  )
  const [inputValue, setInputValue] = useState(value ? formatDisplayValue(value) : '')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const minDate = min ? parseLocalDate(min) : new Date()

  useEffect(() => {
    if (value) {
      const date = parseLocalDate(value)
      setSelectedDate(date)
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth()))
      // Convert YYYY-MM-DD to MM/DD/YYYY for display using string manipulation
      setInputValue(formatDisplayValue(value))
    } else {
      setInputValue('')
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const isValidDateString = (dateString: string): boolean => {
    // Check if it's in MM/DD/YYYY format
    const mmddyyyyPattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/
    if (!mmddyyyyPattern.test(dateString)) return false
    
    // Parse the date and check if it's valid
    const [month, day, year] = dateString.split('/').map(Number)
    const date = new Date(year, month - 1, day)
    return !isNaN(date.getTime()) && 
           date.getMonth() === month - 1 && 
           date.getDate() === day && 
           date.getFullYear() === year
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // If the input is a valid date, update the selected date and call onChange
    if (newValue && isValidDateString(newValue)) {
      const date = new Date(newValue)
      if (!isDateDisabled(date)) {
        setSelectedDate(date)
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth()))
        // Convert MM/DD/YYYY to YYYY-MM-DD for the onChange callback
        onChange(formatValueForInput(date))
      }
    } else if (newValue === '') {
      // If input is cleared, clear the selected date
      setSelectedDate(null)
      onChange('')
    }
  }

  const handleInputBlur = () => {
    // On blur, validate the input and reset to last valid value if invalid
    if (inputValue && !isValidDateString(inputValue)) {
      // Convert the stored YYYY-MM-DD value back to MM/DD/YYYY for display using string manipulation
      if (value) {
        setInputValue(formatDisplayValue(value))
      } else {
        setInputValue('')
      }
    }
  }

  const formatValueForInput = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const isDateDisabled = (date: Date): boolean => {
    return date < minDate
  }

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    if (!isDateDisabled(newDate)) {
      const dateString = formatValueForInput(newDate)
      setSelectedDate(newDate)
      setInputValue(formatDisplayValue(dateString)) // Use string-based formatting
      onChange(dateString)
      setIsOpen(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1)
      } else {
        newMonth.setMonth(prev.getMonth() + 1)
      }
      return newMonth
    })
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8"></div>)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const isDisabled = isDateDisabled(date)
      const isSelected = selectedDate && 
        selectedDate.getDate() === day && 
        selectedDate.getMonth() === currentMonth.getMonth() && 
        selectedDate.getFullYear() === currentMonth.getFullYear()

      days.push(
        <button
          key={day}
          onClick={() => handleDateSelect(day)}
          disabled={isDisabled}
          className={`
            h-8 w-8 text-sm rounded-md transition-colors
            ${isDisabled 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
            }
            ${isSelected 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : ''
            }
          `}
        >
          {day}
        </button>
      )
    }

    return days
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          placeholder="MM/DD/YYYY"
          className={`
            w-full px-2 py-1 pr-8 text-sm border border-gray-300 rounded 
            focus:outline-none focus:ring-feline-500 focus:border-feline-500
            ${className}
          `}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
        >
          <Calendar className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-medium text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-xs text-gray-500 text-center py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>

          {/* Today button */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                const today = new Date()
                if (!isDateDisabled(today)) {
                  const dateString = formatValueForInput(today)
                  setSelectedDate(today)
                  setInputValue(formatDisplayValue(dateString)) // Use string-based formatting
                  onChange(dateString)
                  setIsOpen(false)
                }
              }}
              disabled={isDateDisabled(new Date())}
              className="w-full text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomDatePicker

import React, { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Navigate } from 'react-router-dom'
import { 
  Clock,
  Plus,
  Trash2,
  XCircle,
  CheckCircle
} from 'lucide-react'
import { getFunctions, httpsCallable } from 'firebase/functions'

interface OperatingHoursEntry {
  id: string
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  startTime: string // "08:00"
  endTime: string   // "12:00"
}

const WorkSchedule: React.FC = () => {
  const { user } = useAuth()
  const [operatingHours, setOperatingHours] = useState<OperatingHoursEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Load work schedule data from user's team document
  useEffect(() => {
    const loadWorkSchedule = async () => {
      if (!user) return

      try {
        const functions = getFunctions()
        const getWorkScheduleFunc = httpsCallable(functions, 'getWorkSchedule')
        const response = await getWorkScheduleFunc({})
        
        const result = response.data as { 
          success: boolean; 
          operatingHours: OperatingHoursEntry[]; 
          userName: string;
          workScheduleUpdatedAt?: any;
        }
        
        if (result.success) {
          setOperatingHours(result.operatingHours || [])
          setUserName(result.userName || '')
        }
      } catch (error) {
        console.error('Error loading work schedule:', error)
        setError('Failed to load work schedule data')
      } finally {
        // Loading state removed
      }
    }

    loadWorkSchedule()
  }, [user])

  // Allow access if user is logged in
  if (!user) {
    return <Navigate to="/access-denied?error=AUTHENTICATION_REQUIRED" replace />
  }

  const saveWorkSchedule = async () => {
    if (!user) return
    
    try {
      setSavedStatus('saving')
      setError(null)
      
      const functions = getFunctions()
      const saveWorkScheduleFunc = httpsCallable(functions, 'saveWorkSchedule')
      
      await saveWorkScheduleFunc({ 
        operatingHours: operatingHours,
        userName: userName
      })
      
      setSavedStatus('saved')
      console.log('Work schedule saved successfully')
      
      // Reset saved status after 3 seconds
      setTimeout(() => {
        setSavedStatus('idle')
      }, 3000)
      
    } catch (error: any) {
      console.error('Error saving work schedule:', error)
      setError(error.message || 'Failed to save work schedule')
      setSavedStatus('error')
      
      // Reset error status after 5 seconds
      setTimeout(() => {
        setSavedStatus('idle')
      }, 5000)
    }
  }

  // Helper functions for operating hours (copied from OnBoarding.tsx)
  const sortOperatingHours = (entries: OperatingHoursEntry[]): OperatingHoursEntry[] => {
    return [...entries].sort((a, b) => {
      const dayOrder = {
        monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
        friday: 5, saturday: 6, sunday: 7
      }
      
      const dayComparison = dayOrder[a.day] - dayOrder[b.day]
      if (dayComparison !== 0) {
        return dayComparison
      }
      
      return a.startTime.localeCompare(b.startTime)
    })
  }

  const validateTimeSlot = (entry: OperatingHoursEntry, allEntries: OperatingHoursEntry[]): string | null => {
    if (entry.startTime >= entry.endTime) {
      return 'Start time must be before end time'
    }
    
    const sameDayEntries = allEntries.filter(e => 
      e.day === entry.day && e.id !== entry.id
    )
    
    const hasOverlap = sameDayEntries.some(existingEntry => {
      return (
        entry.startTime < existingEntry.endTime && 
        entry.endTime > existingEntry.startTime
      )
    })
    
    if (hasOverlap) {
      const overlappingEntry = sameDayEntries.find(existingEntry => 
        entry.startTime < existingEntry.endTime && 
        entry.endTime > existingEntry.startTime
      )
      if (overlappingEntry) {
        return `Overlaps with existing time slot: ${formatTime(overlappingEntry.startTime)} - ${formatTime(overlappingEntry.endTime)}`
      }
    }
    
    return null
  }

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const calculateDuration = (startTime: string, endTime: string): string => {
    const start = new Date(`2000-01-01T${startTime}:00`)
    const end = new Date(`2000-01-01T${endTime}:00`)
    
    if (end < start) {
      end.setDate(end.getDate() + 1)
    }
    
    const diffMs = end.getTime() - start.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${diffHours}h ${diffMinutes}m`
  }

  const getNextAvailableDay = (): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' => {
    const dayOrder: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> = 
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    
    for (const day of dayOrder) {
      if (!operatingHours.some(entry => entry.day === day)) {
        return day
      }
    }
    
    return 'monday'
  }

  const addTimeSlot = (suggestedDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday') => {
    const newEntry: OperatingHoursEntry = {
      id: Date.now().toString(),
      day: suggestedDay || getNextAvailableDay(),
      startTime: '09:00',
      endTime: '17:00'
    }
    
    const updatedEntries = sortOperatingHours([...operatingHours, newEntry])
    setOperatingHours(updatedEntries)
  }

  const removeTimeSlot = (id: string) => {
    const updatedEntries = operatingHours.filter(entry => entry.id !== id)
    setOperatingHours(updatedEntries)
  }

  const updateTimeSlot = (id: string, field: keyof OperatingHoursEntry, value: string) => {
    const updatedEntries = operatingHours.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    )
    
    const sortedEntries = sortOperatingHours(updatedEntries)
    setOperatingHours(sortedEntries)
  }

  return (
    <div className="py-8 max-w-7xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Work Time</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set your personal work schedule for availability tracking.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4">
          <div className="mb-4">
            <h4 className="text-md font-medium text-gray-900 mb-4">Set Your Work Time</h4>
            
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Quick Add by Day:</h5>
              <div className="flex flex-wrap gap-2">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
                  <button
                    key={day}
                    onClick={() => addTimeSlot(day)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    + {day.charAt(0).toUpperCase() + day.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-gray-700">Time Slots</h5>
                <button
                  onClick={() => addTimeSlot()}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Time Slot
                </button>
              </div>
              
              {operatingHours.length > 0 ? (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {operatingHours.map((entry) => {
                        const validationError = validateTimeSlot(entry, operatingHours)
                        return (
                          <tr key={entry.id} className={validationError ? 'bg-red-50' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={entry.day}
                                onChange={(e) => updateTimeSlot(entry.id, 'day', e.target.value)}
                                className={`border rounded-md px-3 py-1 text-sm ${
                                  validationError ? 'border-red-300' : 'border-gray-300'
                                }`}
                              >
                                <option value="monday">Monday</option>
                                <option value="tuesday">Tuesday</option>
                                <option value="wednesday">Wednesday</option>
                                <option value="thursday">Thursday</option>
                                <option value="friday">Friday</option>
                                <option value="saturday">Saturday</option>
                                <option value="sunday">Sunday</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="time"
                                value={entry.startTime}
                                onChange={(e) => updateTimeSlot(entry.id, 'startTime', e.target.value)}
                                className={`border rounded-md px-3 py-1 text-sm ${
                                  validationError ? 'border-red-300' : 'border-gray-300'
                                }`}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="time"
                                value={entry.endTime}
                                onChange={(e) => updateTimeSlot(entry.id, 'endTime', e.target.value)}
                                className={`border rounded-md px-3 py-1 text-sm ${
                                  validationError ? 'border-red-300' : 'border-gray-300'
                                }`}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {calculateDuration(entry.startTime, entry.endTime)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => removeTimeSlot(entry.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No work schedule set</p>
                  <p className="text-sm">Click "Add Time Slot" to get started</p>
                </div>
              )}
              
              {/* Validation Errors */}
              {operatingHours.some(entry => 
                validateTimeSlot(entry, operatingHours) !== null
              ) && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <XCircle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Time Slot Issues Detected
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <ul className="list-disc list-inside space-y-1">
                          {operatingHours.map(entry => {
                            const error = validateTimeSlot(entry, operatingHours)
                            return error ? (
                              <li key={entry.id}>
                                <strong>{entry.day.charAt(0).toUpperCase() + entry.day.slice(1)}</strong>: {error}
                              </li>
                            ) : null
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          {/* Saved status indicator */}
          <div className="flex items-center">
            {savedStatus === 'saved' && (
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Work schedule saved successfully!</span>
              </div>
            )}
            {savedStatus === 'error' && (
              <div className="flex items-center text-red-600">
                <XCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Failed to save work schedule</span>
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={saveWorkSchedule}
            disabled={savedStatus === 'saving'}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              savedStatus === 'saved' 
                ? 'bg-green-600 hover:bg-green-700' 
                : savedStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-feline-600 hover:bg-feline-700'
            }`}
          >
            {savedStatus === 'saving' ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : savedStatus === 'saved' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : savedStatus === 'error' ? (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Retry Save
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Work Time
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WorkSchedule

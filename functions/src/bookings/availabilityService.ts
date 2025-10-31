import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

interface WorkScheduleEntry {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  startTime: string // "09:00"
  endTime: string   // "17:00"
}

interface ScheduleException {
  date: string // 'YYYY-MM-DD'
  type: 'unavailable' | 'available' | 'modified'
  startTime?: string
  endTime?: string
}

interface Pet {
  catId: number // RescueGroups animalId
  assignedVolunteers?: string[] // Array of teamMemberIds who can show this pet
  exceptions?: Array<{
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    startTime: string // "09:00"
    endTime: string // "17:00"
    reason: string
  }>
  createdAt?: admin.firestore.Timestamp
  updatedAt?: admin.firestore.Timestamp
}

interface AvailableTimeSlot {
  start: Date
  end: Date
  durationMinutes: number
}

/**
 * Convert time string (HH:MM) to minutes of day (0-1439)
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes of day to time string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Get day of week name from Date
 */
function getDayOfWeek(date: Date): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()] as any
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get minute of day from timestamp (in target timezone)
 */
function getMinuteOfDay(timestamp: admin.firestore.Timestamp, timezone: string = 'America/New_York'): number {
  const date = timestamp.toDate()
  // For now, assuming local timezone - can be enhanced with proper timezone handling
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return hours * 60 + minutes
}

/**
 * Check if a minute is within any of the volunteer's work schedule ranges for the given day
 */
function isWithinWorkSchedule(
  minute: number,
  workSchedule: WorkScheduleEntry[],
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
): boolean {
  const daySchedules = workSchedule.filter(s => s.day === dayOfWeek)
  
  for (const schedule of daySchedules) {
    const startMinute = timeToMinutes(schedule.startTime)
    const endMinute = timeToMinutes(schedule.endTime)
    
    if (minute >= startMinute && minute < endMinute) {
      return true
    }
  }
  
  return false
}

/**
 * Find exception for a specific date
 */
function findException(exceptions: ScheduleException[] | undefined, dateStr: string): ScheduleException | undefined {
  if (!exceptions) return undefined
  return exceptions.find(e => e.date === dateStr)
}

/**
 * Check if minute is blocked by schedule exception
 */
function isBlockedByException(minute: number, exception: ScheduleException | undefined): boolean {
  if (!exception) return false
  
  if (exception.type === 'unavailable') {
    return true // Entire day blocked
  }
  
  if (exception.type === 'modified' && exception.startTime && exception.endTime) {
    const startMinute = timeToMinutes(exception.startTime)
    const endMinute = timeToMinutes(exception.endTime)
    // Block outside modified hours
    return minute < startMinute || minute >= endMinute
  }
  
  return false
}

/**
 * Check if a minute is blocked by pet exception for the given day
 */
function isBlockedByPetException(
  minute: number,
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  petExceptions: Pet['exceptions'] | undefined
): boolean {
  if (!petExceptions || petExceptions.length === 0) return false
  
  // Find exceptions that match the day of week
  const dayExceptions = petExceptions.filter(e => e.day === dayOfWeek)
  
  for (const exception of dayExceptions) {
    const startMinute = timeToMinutes(exception.startTime)
    const endMinute = timeToMinutes(exception.endTime)
    
    if (minute >= startMinute && minute < endMinute) {
      return true // Blocked by exception
    }
  }
  
  return false
}

/**
 * Group consecutive free minutes into time slots
 */
function groupIntoTimeSlots(freeMinutes: number[], durationMinutes: number): AvailableTimeSlot[] {
  if (freeMinutes.length === 0) return []
  
  const slots: AvailableTimeSlot[] = []
  let currentStart = freeMinutes[0]
  let currentEnd = currentStart + 1
  
  for (let i = 1; i < freeMinutes.length; i++) {
    if (freeMinutes[i] === currentEnd) {
      currentEnd = freeMinutes[i] + 1
    } else {
      // Gap found - check if current range is long enough
      if (currentEnd - currentStart >= durationMinutes) {
        slots.push({
          start: new Date(2000, 0, 1, Math.floor(currentStart / 60), currentStart % 60),
          end: new Date(2000, 0, 1, Math.floor(currentEnd / 60), currentEnd % 60),
          durationMinutes: currentEnd - currentStart
        })
      }
      currentStart = freeMinutes[i]
      currentEnd = currentStart + 1
    }
  }
  
  // Add final slot
  if (currentEnd - currentStart >= durationMinutes) {
    slots.push({
      start: new Date(2000, 0, 1, Math.floor(currentStart / 60), currentStart % 60),
      end: new Date(2000, 0, 1, Math.floor(currentEnd / 60), currentEnd % 60),
      durationMinutes: currentEnd - currentStart
    })
  }
  
  return slots
}

/**
 * Get available time slots for volunteers and cat on a specific date
 */
export const getAvailableTimeSlots = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const { volunteerIds, catId, targetDate, durationMinutes, timezone } = data

    if (!volunteerIds || !Array.isArray(volunteerIds) || volunteerIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'volunteerIds is required and must be a non-empty array')
    }

    if (!targetDate) {
      throw new functions.https.HttpsError('invalid-argument', 'targetDate is required')
    }

    const date = typeof targetDate === 'string' ? new Date(targetDate) : targetDate.toDate()
    const dateStr = formatDate(date)
    const dayOfWeek = getDayOfWeek(date)
    const duration = durationMinutes || 60
    const targetTimezone = timezone || 'America/New_York'

    // Get user's organization ID
    const userId = context.auth.uid
    const userDoc = await admin.firestore().collection('team').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }
    const userData = userDoc.data()
    const orgId = userData?.orgId
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not associated with an organization')
    }

    // Fetch pet data if catId provided
    let petData: Pet | undefined
    let suitableVolunteerIds = volunteerIds
    if (catId) {
      const petDoc = await admin.firestore().collection('pets').doc(catId.toString()).get()
      if (petDoc.exists) {
        petData = petDoc.data() as Pet
        
        // Filter volunteers based on assignedVolunteers
        if (petData.assignedVolunteers && petData.assignedVolunteers.length > 0) {
          suitableVolunteerIds = volunteerIds.filter(id => petData!.assignedVolunteers!.includes(id))
          if (suitableVolunteerIds.length === 0) {
            return {
              success: true,
              availableSlots: [],
              date: dateStr,
              message: 'No suitable volunteers available for this pet'
            }
          }
        }
        // If no assignedVolunteers, all volunteers are suitable (use volunteerIds as-is)
      }
      // If pet document doesn't exist, treat as no restrictions (all volunteers suitable)
    }

    // Initialize minute availability array (1440 minutes in a day)
    const minuteAvailability = new Array(1440).fill(0)
    const totalVolunteers = suitableVolunteerIds.length

    // Calculate start and end of day timestamps for booking queries (used in multiple places)
    const startOfDay = admin.firestore.Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0))
    const endOfDay = admin.firestore.Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59))

    // Get volunteers and their work schedules (using filtered list)
    const volunteers = []
    for (const volunteerId of suitableVolunteerIds) {
      const volunteerDoc = await admin.firestore().collection('team').doc(volunteerId).get()
      if (!volunteerDoc.exists) {
        console.warn(`Volunteer ${volunteerId} not found`)
        continue
      }

      const volunteerData = volunteerDoc.data()
      const workSchedule: WorkScheduleEntry[] = volunteerData?.workSchedule || []
      const scheduleExceptions: ScheduleException[] = volunteerData?.scheduleExceptions || []

      volunteers.push({
        id: volunteerId,
        workSchedule,
        scheduleExceptions
      })
    }

    // Process each volunteer
    for (const volunteer of volunteers) {
      // Check if volunteer has work schedule for this day
      const daySchedules = volunteer.workSchedule.filter(s => s.day === dayOfWeek)
      const hasSchedule = daySchedules.length > 0

      // Check for exceptions
      const exception = findException(volunteer.scheduleExceptions, dateStr)

      // If exception says unavailable or no schedule, mark entire day as busy
      if (exception?.type === 'unavailable' || (!hasSchedule && !exception)) {
        for (let m = 0; m < 1440; m++) {
          minuteAvailability[m]++
        }
        continue
      }

      // If exception is modified, use modified hours
      if (exception?.type === 'modified' && exception.startTime && exception.endTime) {
        const startMinute = timeToMinutes(exception.startTime)
        const endMinute = timeToMinutes(exception.endTime)
        
        // Mark outside modified hours as busy
        for (let m = 0; m < startMinute; m++) {
          minuteAvailability[m]++
        }
        for (let m = endMinute; m < 1440; m++) {
          minuteAvailability[m]++
        }
      } else if (hasSchedule) {
        // Mark time outside work schedule as busy
        const allBusyMinutes = new Set<number>()
        for (let m = 0; m < 1440; m++) {
          if (!isWithinWorkSchedule(m, volunteer.workSchedule, dayOfWeek)) {
            allBusyMinutes.add(m)
          }
        }
        
        for (const m of allBusyMinutes) {
          minuteAvailability[m]++
        }
      }

      // Add bookings as conflicts (with orgId filtering for security)
      const bookingsSnapshot = await admin.firestore()
        .collection('bookings')
        .where('orgId', '==', orgId)
        .where('teamMemberId', '==', volunteer.id)
        .where('startTs', '>=', startOfDay)
        .where('startTs', '<=', endOfDay)
        .where('status', 'in', ['confirmed', 'volunteer-assigned', 'in-progress', 'pending-confirmation'])
        .get()

      for (const bookingDoc of bookingsSnapshot.docs) {
        const booking = bookingDoc.data()
        if (booking.startTs && booking.endTs) {
          const startMinute = getMinuteOfDay(booking.startTs, targetTimezone)
          const endMinute = getMinuteOfDay(booking.endTs, targetTimezone)

          // Clamp to valid range
          const validStart = Math.max(0, Math.min(1439, startMinute))
          const validEnd = Math.max(0, Math.min(1440, endMinute))

          for (let m = validStart; m < validEnd; m++) {
            minuteAvailability[m]++
          }
        }
      }

      // Check exceptions for blocking
      if (exception) {
        for (let m = 0; m < 1440; m++) {
          if (isBlockedByException(m, exception)) {
            minuteAvailability[m]++
          }
        }
      }
    }

    // Apply pet exceptions (block time ranges for this day)
    if (petData?.exceptions && petData.exceptions.length > 0) {
      const dayExceptions = petData.exceptions.filter(e => e.day === dayOfWeek)
      for (const exception of dayExceptions) {
        const startMinute = timeToMinutes(exception.startTime)
        const endMinute = timeToMinutes(exception.endTime)
        
        // Block the exception time range for all volunteers
        for (let m = startMinute; m < endMinute; m++) {
          if (m >= 0 && m < 1440) {
            minuteAvailability[m] += totalVolunteers // Block for all volunteers
          }
        }
      }
    }

    // Check cat-specific bookings (bookings for this cat regardless of volunteer)
    if (catId) {
      const catBookingsSnapshot = await admin.firestore()
        .collection('bookings')
        .where('orgId', '==', orgId)
        .where('catId', '==', catId)
        .where('startTs', '>=', startOfDay)
        .where('startTs', '<=', endOfDay)
        .where('status', 'in', ['confirmed', 'volunteer-assigned', 'in-progress', 'pending-confirmation'])
        .get()

      for (const bookingDoc of catBookingsSnapshot.docs) {
        const booking = bookingDoc.data()
        if (booking.startTs && booking.endTs) {
          const startMinute = getMinuteOfDay(booking.startTs, targetTimezone)
          const endMinute = getMinuteOfDay(booking.endTs, targetTimezone)

          // Clamp to valid range
          const validStart = Math.max(0, Math.min(1439, startMinute))
          const validEnd = Math.max(0, Math.min(1440, endMinute))

          // Block these minutes for all volunteers (cat is busy)
          for (let m = validStart; m < validEnd; m++) {
            minuteAvailability[m] += totalVolunteers
          }
        }
      }
    }

    // Find free minutes (where count < totalVolunteers)
    const freeMinutes: number[] = []
    for (let minute = 0; minute < 1440; minute++) {
      // Check if at least one volunteer is available
      if (minuteAvailability[minute] < totalVolunteers) {
        // Ensure at least one volunteer has schedule for this minute
        const hasAvailableVolunteer = volunteers.some(v => {
          if (!isWithinWorkSchedule(minute, v.workSchedule, dayOfWeek)) {
            return false
          }
          const exc = findException(v.scheduleExceptions, dateStr)
          return !isBlockedByException(minute, exc)
        })

        if (hasAvailableVolunteer) {
          freeMinutes.push(minute)
        }
      }
    }

    // Group consecutive minutes into time slots
    const slots = groupIntoTimeSlots(freeMinutes, duration)

    return {
      success: true,
      availableSlots: slots.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        durationMinutes: slot.durationMinutes
      })),
      date: dateStr,
      totalVolunteers,
      processedVolunteers: volunteers.length
    }
  } catch (error: any) {
    console.error('Error calculating available time slots:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to calculate available time slots')
  }
})


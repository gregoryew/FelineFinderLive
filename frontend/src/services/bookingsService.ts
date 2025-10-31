import { getFunctions, httpsCallable } from 'firebase/functions'
import { Timestamp } from 'firebase/firestore'

export interface Booking {
  id?: string
  calendarId: number
  adopter: string
  adopterId: string // UUID referencing adopters collection
  cat: string
  catId: number
  startTs: Date | Timestamp
  startTimeZone: string
  endTs: Date | Timestamp
  endTimeZone: string
  teamMemberId?: string // ID to look up team member (name, email) in team collection
  groupId: number
  shelterId: number
  status: 'pending-shelter-setup' | 'pending-confirmation' | 'confirmed' | 'volunteer-assigned' | 'in-progress' | 'completed' | 'adopted' | 'cancelled'
  notes?: string
  reminders?: Array<{
    method: string
    minutes: number
  }>
  attachments?: Array<{
    fileUrl: string
    title: string
    mimetype: string
    iconLink: string
  }>
  conferenceData?: {
    createRequest: {
      requestId: string
      conferenceSolutionKey: {
        type: string
      }
    }
  }
  summary: string
  description: string
  auditTrail?: Array<{
    fieldName: string
    from: string
    to: string
    createdAt: Date | Timestamp
    changedBy: string
  }>
  createdAt?: Date | Timestamp
  updatedAt?: Date | Timestamp
  createdBy?: string
  orgId?: string
}

/**
 * Convert Firestore Timestamp to Date
 */
const convertTimestampToDate = (timestamp: any): Date => {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return timestamp.toDate()
  }
  if (timestamp instanceof Date) {
    return timestamp
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp)
  }
  return new Date()
}

/**
 * Convert booking timestamps to Date objects
 */
const convertBookingDates = (booking: any): Booking => {
  return {
    ...booking,
    startTs: convertTimestampToDate(booking.startTs),
    endTs: convertTimestampToDate(booking.endTs),
    createdAt: booking.createdAt ? convertTimestampToDate(booking.createdAt) : undefined,
    updatedAt: booking.updatedAt ? convertTimestampToDate(booking.updatedAt) : undefined,
    auditTrail: booking.auditTrail?.map((entry: any) => ({
      ...entry,
      createdAt: convertTimestampToDate(entry.createdAt)
    }))
  }
}

/**
 * Get all bookings for the current user's organization
 */
export const getBookings = async (): Promise<Booking[]> => {
  try {
    const functions = getFunctions()
    const getBookingsFunction = httpsCallable(functions, 'getBookings')
    const result = await getBookingsFunction()
    const data = result.data as any

    if (data.success && data.bookings) {
      return data.bookings.map((booking: any) => convertBookingDates(booking))
    }

    return []
  } catch (error: any) {
    console.error('Error getting bookings:', error)
    throw new Error(error.message || 'Failed to get bookings')
  }
}

/**
 * Create a new booking
 */
export const createBooking = async (booking: Omit<Booking, 'id'>): Promise<{ success: boolean; bookingId: string; booking: Booking }> => {
  try {
    const functions = getFunctions()
    const createBookingFunction = httpsCallable(functions, 'createBooking')
    
    // Convert Date objects to ISO strings for transmission
    const bookingData = {
      ...booking,
      startTs: booking.startTs instanceof Date ? booking.startTs.toISOString() : booking.startTs,
      endTs: booking.endTs instanceof Date ? booking.endTs.toISOString() : booking.endTs
    }

    const result = await createBookingFunction({ booking: bookingData })
    const data = result.data as any

    if (data.success) {
      return {
        success: true,
        bookingId: data.bookingId,
        booking: convertBookingDates(data.booking)
      }
    }

    throw new Error('Failed to create booking')
  } catch (error: any) {
    console.error('Error creating booking:', error)
    throw new Error(error.message || 'Failed to create booking')
  }
}

/**
 * Update an existing booking
 */
export const updateBooking = async (bookingId: string, updates: Partial<Booking>): Promise<{ success: boolean; bookingId: string }> => {
  try {
    const functions = getFunctions()
    const updateBookingFunction = httpsCallable(functions, 'updateBooking')
    
    // Convert Date objects to ISO strings for transmission
    const updatesData = { ...updates }
    if (updatesData.startTs instanceof Date) {
      updatesData.startTs = updatesData.startTs.toISOString() as any
    }
    if (updatesData.endTs instanceof Date) {
      updatesData.endTs = updatesData.endTs.toISOString() as any
    }

    const result = await updateBookingFunction({ bookingId, updates: updatesData })
    const data = result.data as any

    if (data.success) {
      return {
        success: true,
        bookingId: data.bookingId
      }
    }

    throw new Error('Failed to update booking')
  } catch (error: any) {
    console.error('Error updating booking:', error)
    throw new Error(error.message || 'Failed to update booking')
  }
}

/**
 * Update booking notes
 */
export const updateBookingNotes = async (bookingId: string, notes: string): Promise<{ success: boolean; bookingId: string }> => {
  try {
    const functions = getFunctions()
    const updateBookingNotesFunction = httpsCallable(functions, 'updateBookingNotes')
    
    const result = await updateBookingNotesFunction({ bookingId, notes })
    const data = result.data as any

    if (data.success) {
      return {
        success: true,
        bookingId: data.bookingId
      }
    }

    throw new Error('Failed to update notes')
  } catch (error: any) {
    console.error('Error updating notes:', error)
    throw new Error(error.message || 'Failed to update notes')
  }
}

/**
 * Delete a booking
 */
export const deleteBooking = async (bookingId: string): Promise<{ success: boolean; bookingId: string }> => {
  try {
    const functions = getFunctions()
    const deleteBookingFunction = httpsCallable(functions, 'deleteBooking')
    
    const result = await deleteBookingFunction({ bookingId })
    const data = result.data as any

    if (data.success) {
      return {
        success: true,
        bookingId: data.bookingId
      }
    }

    throw new Error('Failed to delete booking')
  } catch (error: any) {
    console.error('Error deleting booking:', error)
    throw new Error(error.message || 'Failed to delete booking')
  }
}


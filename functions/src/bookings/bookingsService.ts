import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// Booking interface matching frontend
export interface Booking {
  id?: string
  calendarId: number
  adopter: string
  adopterId: number
  adopterEmail: string
  cat: string
  catId: number
  startTs: admin.firestore.Timestamp
  startTimeZone: string
  endTs: admin.firestore.Timestamp
  endTimeZone: string
  volunteer: string
  volunteerId?: string
  groupId: number
  shelterId: string
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
    createdAt: admin.firestore.Timestamp
    changedBy: string
  }>
  createdAt?: admin.firestore.Timestamp
  updatedAt?: admin.firestore.Timestamp
  createdBy?: string
  orgId: string
}

/**
 * Get all bookings for an organization
 */
export const getBookings = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid

    // Get user's organization
    const userDoc = await admin.firestore()
      .collection('shelter_people')
      .doc(userId)
      .get()

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId

    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not associated with an organization')
    }

    // Get all bookings for this organization
    const bookingsSnapshot = await admin.firestore()
      .collection('bookings')
      .where('orgId', '==', orgId)
      .orderBy('startTs', 'desc')
      .get()

    const bookings = bookingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    console.log(`Retrieved ${bookings.length} bookings for org ${orgId}`)

    return {
      success: true,
      bookings
    }
  } catch (error: any) {
    console.error('Error getting bookings:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to get bookings')
  }
})

/**
 * Create a new booking
 */
export const createBooking = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const bookingData = data.booking as Booking

    // Validate required fields
    if (!bookingData.adopter || !bookingData.cat || !bookingData.startTs || !bookingData.endTs) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required booking fields')
    }

    // Get user's organization
    const userDoc = await admin.firestore()
      .collection('shelter_people')
      .doc(userId)
      .get()

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId

    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not associated with an organization')
    }

    // Convert date strings to Timestamps if needed
    const startTs = typeof bookingData.startTs === 'string' 
      ? admin.firestore.Timestamp.fromDate(new Date(bookingData.startTs))
      : bookingData.startTs

    const endTs = typeof bookingData.endTs === 'string'
      ? admin.firestore.Timestamp.fromDate(new Date(bookingData.endTs))
      : bookingData.endTs

    // Create booking
    const newBooking: Partial<Booking> = {
      ...bookingData,
      startTs,
      endTs,
      orgId,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
      auditTrail: [{
        fieldName: 'created',
        from: '',
        to: bookingData.status || 'pending-shelter-setup',
        createdAt: FieldValue.serverTimestamp() as any,
        changedBy: userId
      }]
    }

    const bookingRef = await admin.firestore()
      .collection('bookings')
      .add(newBooking)

    console.log(`Created booking ${bookingRef.id} for org ${orgId}`)

    return {
      success: true,
      bookingId: bookingRef.id,
      booking: {
        id: bookingRef.id,
        ...newBooking
      }
    }
  } catch (error: any) {
    console.error('Error creating booking:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to create booking')
  }
})

/**
 * Update an existing booking
 */
export const updateBooking = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const { bookingId, updates } = data

    if (!bookingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Booking ID is required')
    }

    // Get the existing booking
    const bookingRef = admin.firestore().collection('bookings').doc(bookingId)
    const bookingDoc = await bookingRef.get()

    if (!bookingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found')
    }

    const existingBooking = bookingDoc.data() as Booking

    // Verify user has access to this booking's organization
    const userDoc = await admin.firestore()
      .collection('shelter_people')
      .where('uid', '==', userId)
      .limit(1)
      .get()

    if (userDoc.empty) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.docs[0].data()
    
    if (existingBooking.orgId !== userData.orgId) {
      throw new functions.https.HttpsError('permission-denied', 'User does not have access to this booking')
    }

    // Track changes in audit trail
    const auditTrail = existingBooking.auditTrail || []
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== existingBooking[key as keyof Booking]) {
        auditTrail.push({
          fieldName: key,
          from: String(existingBooking[key as keyof Booking] || ''),
          to: String(updates[key] || ''),
          createdAt: FieldValue.serverTimestamp() as any,
          changedBy: userId
        })
      }
    })

    // Convert date strings to Timestamps if needed
    if (updates.startTs && typeof updates.startTs === 'string') {
      updates.startTs = admin.firestore.Timestamp.fromDate(new Date(updates.startTs))
    }
    if (updates.endTs && typeof updates.endTs === 'string') {
      updates.endTs = admin.firestore.Timestamp.fromDate(new Date(updates.endTs))
    }

    // Update booking
    await bookingRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
      auditTrail
    })

    console.log(`Updated booking ${bookingId}`)

    return {
      success: true,
      bookingId
    }
  } catch (error: any) {
    console.error('Error updating booking:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to update booking')
  }
})

/**
 * Update booking notes
 */
export const updateBookingNotes = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const { bookingId, notes } = data

    if (!bookingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Booking ID is required')
    }

    // Get the existing booking
    const bookingRef = admin.firestore().collection('bookings').doc(bookingId)
    const bookingDoc = await bookingRef.get()

    if (!bookingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found')
    }

    const existingBooking = bookingDoc.data() as Booking

    // Verify user has access to this booking's organization
    const userDoc = await admin.firestore()
      .collection('shelter_people')
      .where('uid', '==', userId)
      .limit(1)
      .get()

    if (userDoc.empty) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.docs[0].data()
    
    if (existingBooking.orgId !== userData.orgId) {
      throw new functions.https.HttpsError('permission-denied', 'User does not have access to this booking')
    }

    // Update notes with audit trail
    const auditTrail = existingBooking.auditTrail || []
    auditTrail.push({
      fieldName: 'notes',
      from: existingBooking.notes || '',
      to: notes || '',
      createdAt: FieldValue.serverTimestamp() as any,
      changedBy: userId
    })

    await bookingRef.update({
      notes,
      updatedAt: FieldValue.serverTimestamp(),
      auditTrail
    })

    console.log(`Updated notes for booking ${bookingId}`)

    return {
      success: true,
      bookingId
    }
  } catch (error: any) {
    console.error('Error updating booking notes:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to update notes')
  }
})

/**
 * Delete a booking
 */
export const deleteBooking = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const { bookingId } = data

    if (!bookingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Booking ID is required')
    }

    // Get the existing booking
    const bookingRef = admin.firestore().collection('bookings').doc(bookingId)
    const bookingDoc = await bookingRef.get()

    if (!bookingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found')
    }

    const existingBooking = bookingDoc.data() as Booking

    // Verify user has access to this booking's organization
    const userDoc = await admin.firestore()
      .collection('shelter_people')
      .where('uid', '==', userId)
      .limit(1)
      .get()

    if (userDoc.empty) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.docs[0].data()
    
    if (existingBooking.orgId !== userData.orgId) {
      throw new functions.https.HttpsError('permission-denied', 'User does not have access to this booking')
    }

    // Delete booking
    await bookingRef.delete()

    console.log(`Deleted booking ${bookingId}`)

    return {
      success: true,
      bookingId
    }
  } catch (error: any) {
    console.error('Error deleting booking:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to delete booking')
  }
})


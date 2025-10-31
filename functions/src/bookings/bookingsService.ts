import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// Booking interface matching frontend
export interface Booking {
  id?: string
  calendarId: number
  adopter: string
  adopterId: string // UUID referencing adopters collection
  cat: string
  catId: number
  startTs: admin.firestore.Timestamp
  startTimeZone: string
  endTs: admin.firestore.Timestamp
  endTimeZone: string
  teamMemberId?: string // ID to look up team member (name, email) in team collection
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
      .collection('team')
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
    // Note: Sorting in memory to avoid requiring composite index
    const bookingsSnapshot = await admin.firestore()
      .collection('bookings')
      .where('orgId', '==', orgId)
      .get()

    const bookings = bookingsSnapshot.docs.map(doc => {
      const data = doc.data() as Booking
      return {
        id: doc.id,
        ...data
      } as Booking
    }).sort((a, b) => {
      // Sort by startTs descending (most recent first)
      const aTs = a.startTs?.toMillis?.() || (a.startTs as any)?._seconds || 0
      const bTs = b.startTs?.toMillis?.() || (b.startTs as any)?._seconds || 0
      return bTs - aTs
    })

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
    if (!bookingData.adopter || !bookingData.adopterId || !bookingData.cat || !bookingData.startTs || !bookingData.endTs) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required booking fields (adopter, adopterId, cat, startTs, endTs)')
    }
    
    // Check if email is provided in booking data
    const bookingWithEmail = bookingData as any
    const adopterEmail = bookingWithEmail.adopterEmail || bookingWithEmail.email

    // Get user's organization
    const userDoc = await admin.firestore()
      .collection('team')
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

    // Ensure adopter exists in adopters collection using adopterId as document ID
    const adopterRef = admin.firestore().collection('adopters').doc(bookingData.adopterId)
    const adopterData: any = {
      id: bookingData.adopterId,
      name: bookingData.adopter,
      lastBookingAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }
    
    // Add email if provided
    if (adopterEmail) {
      adopterData.email = adopterEmail
    }
    
    // Only set createdAt if the document doesn't exist yet
    const existingDoc = await adopterRef.get()
    if (!existingDoc.exists) {
      adopterData.createdAt = FieldValue.serverTimestamp()
      await adopterRef.set(adopterData)
    } else {
      await adopterRef.set(adopterData, { merge: true })
    }

    // Ensure pet exists in pets collection using catId (RescueGroups animalId) as document ID
    if (bookingData.catId) {
      const petRef = admin.firestore().collection('pets').doc(bookingData.catId.toString())
      const petDoc = await petRef.get()
      
      if (!petDoc.exists) {
        // Create new pet document
        await petRef.set({
          catId: bookingData.catId, // RescueGroups animalId (number)
          assignedVolunteers: [], // Empty initially, can be populated later
          exceptions: [], // Empty initially, can be populated later
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        })
        console.log(`Created pet document for catId ${bookingData.catId}`)
      } else {
        // Update timestamp if exists
        await petRef.update({
          updatedAt: FieldValue.serverTimestamp()
        })
      }
    }

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
      .collection('team')
      .doc(userId)
      .get()

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    
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

    // Update adopter in adopters collection if adopter name, ID, or email changed
    if (updates.adopterId || updates.adopter) {
      const adopterId = updates.adopterId || existingBooking.adopterId
      if (adopterId) {
        const adopterRef = admin.firestore().collection('adopters').doc(adopterId)
        const updateData: any = {
          updatedAt: FieldValue.serverTimestamp()
        }
        
        if (updates.adopter) {
          updateData.name = updates.adopter
          updateData.lastBookingAt = FieldValue.serverTimestamp()
        }
        
        // Check if email is being updated
        const updatesWithEmail = updates as any
        if (updatesWithEmail.email || updatesWithEmail.adopterEmail) {
          updateData.email = updatesWithEmail.email || updatesWithEmail.adopterEmail
        }
        
        await adopterRef.set(updateData, { merge: true })
      }
    }

    // Ensure pet document exists if catId is being updated or exists
    const updatedCatId = updates.catId || existingBooking.catId
    if (updatedCatId) {
      const petRef = admin.firestore().collection('pets').doc(updatedCatId.toString())
      const petDoc = await petRef.get()
      
      if (!petDoc.exists) {
        // Create new pet document if it doesn't exist
        await petRef.set({
          catId: updatedCatId,
          assignedVolunteers: [],
          exceptions: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        })
        console.log(`Created pet document for catId ${updatedCatId} during booking update`)
      } else {
        // Update timestamp if exists
        await petRef.update({
          updatedAt: FieldValue.serverTimestamp()
        })
      }
    }

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
      .collection('team')
      .doc(userId)
      .get()

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    
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
      .collection('team')
      .doc(userId)
      .get()

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    
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


import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// Pet interface matching the structure in availabilityService.ts
export interface Pet {
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

/**
 * Get all pets for an organization
 */
export const getPets = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid

    // Get user's organization ID
    const userDoc = await admin.firestore().collection('team').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found in team collection')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not associated with an organization')
    }

    // Get all pets for this organization
    // Since pets don't have orgId stored directly, we need to verify which pets belong to this org
    // by checking if the catId exists in the organization's cats from RescueGroups
    // For now, we'll get all pets and the frontend will match them with RescueGroups cats
    
    // Actually, a simpler approach: get all pets and return them all
    // The frontend already filters by matching with RescueGroups cats which are org-specific
    // This ensures pet rules created directly (without bookings) are still returned
    
    const petsSnapshot = await admin.firestore().collection('pets').get()

    // Return all pets - the frontend will match them with org-specific cats from RescueGroups
    const pets: Array<Pet & { id: string }> = []
    petsSnapshot.docs.forEach(doc => {
      const petData = doc.data() as Pet
      // Only include if it has a valid catId
      if (petData.catId) {
        pets.push({
          ...petData,
          id: doc.id
        })
      }
    })

    return {
      success: true,
      pets: pets
    }
  } catch (error: any) {
    console.error('Error getting pets:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to get pets')
  }
})

/**
 * Get a single pet by catId
 */
export const getPet = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const { catId } = data

    if (!catId) {
      throw new functions.https.HttpsError('invalid-argument', 'catId is required')
    }

    const userId = context.auth.uid

    // Get user's organization ID
    const userDoc = await admin.firestore().collection('team').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found in team collection')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not associated with an organization')
    }

    // Get pet document
    const petDoc = await admin.firestore().collection('pets').doc(catId.toString()).get()

    if (!petDoc.exists) {
      // Return empty pet structure
      return {
        success: true,
        pet: {
          catId: typeof catId === 'string' ? parseInt(catId) : catId,
          assignedVolunteers: [],
          exceptions: []
        }
      }
    }

    const petData = petDoc.data() as Pet

    return {
      success: true,
      pet: {
        ...petData,
        id: petDoc.id
      }
    }
  } catch (error: any) {
    console.error('Error getting pet:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to get pet')
  }
})

/**
 * Create or update a pet
 */
export const savePet = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const { pet } = data

    if (!pet || !pet.catId) {
      throw new functions.https.HttpsError('invalid-argument', 'Pet with catId is required')
    }

    const userId = context.auth.uid

    // Get user's organization ID
    const userDoc = await admin.firestore().collection('team').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found in team collection')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not associated with an organization')
    }

    // Validate exceptions structure
    if (pet.exceptions && Array.isArray(pet.exceptions)) {
      for (const exception of pet.exceptions) {
        if (!exception.day || !exception.startTime || !exception.endTime) {
          throw new functions.https.HttpsError('invalid-argument', 'Each exception must have day, startTime, and endTime')
        }
        if (exception.startTime >= exception.endTime) {
          throw new functions.https.HttpsError('invalid-argument', `Start time must be before end time for ${exception.day}`)
        }
      }
    }

    // Validate assigned volunteers
    if (pet.assignedVolunteers && Array.isArray(pet.assignedVolunteers)) {
      // Verify all assigned volunteers exist in team collection
      for (const volunteerId of pet.assignedVolunteers) {
        const volunteerDoc = await admin.firestore().collection('team').doc(volunteerId).get()
        if (!volunteerDoc.exists) {
          throw new functions.https.HttpsError('invalid-argument', `Volunteer ${volunteerId} not found`)
        }
        const volunteerData = volunteerDoc.data()
        if (volunteerData?.orgId !== orgId) {
          throw new functions.https.HttpsError('permission-denied', `Volunteer ${volunteerId} is not in your organization`)
        }
      }
    }

    const petRef = admin.firestore().collection('pets').doc(pet.catId.toString())
    const petDoc = await petRef.get()

    const updateData: any = {
      catId: pet.catId,
      assignedVolunteers: pet.assignedVolunteers || [],
      exceptions: pet.exceptions || [],
      updatedAt: FieldValue.serverTimestamp()
    }

    if (!petDoc.exists) {
      updateData.createdAt = FieldValue.serverTimestamp()
    }

    await petRef.set(updateData, { merge: true })

    return {
      success: true,
      message: 'Pet saved successfully',
      pet: {
        ...updateData,
        id: petRef.id
      }
    }
  } catch (error: any) {
    console.error('Error saving pet:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to save pet')
  }
})

/**
 * Delete a pet
 */
export const deletePet = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const { catId } = data

    if (!catId) {
      throw new functions.https.HttpsError('invalid-argument', 'catId is required')
    }

    const userId = context.auth.uid

    // Get user's organization ID
    const userDoc = await admin.firestore().collection('team').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found in team collection')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not associated with an organization')
    }

    // Check if there are any bookings for this pet
    const bookingsSnapshot = await admin.firestore()
      .collection('bookings')
      .where('orgId', '==', orgId)
      .where('catId', '==', typeof catId === 'string' ? parseInt(catId) : catId)
      .limit(1)
      .get()

    if (!bookingsSnapshot.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot delete pet with existing bookings')
    }

    await admin.firestore().collection('pets').doc(catId.toString()).delete()

    return {
      success: true,
      message: 'Pet deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting pet:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to delete pet')
  }
})


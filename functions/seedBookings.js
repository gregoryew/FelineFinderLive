/**
 * Script to seed test booking data into Firestore
 * Run with: node seedBookings.js
 */

const admin = require('firebase-admin')
const path = require('path')

// Load service account
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')
const serviceAccount = require(serviceAccountPath)

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
})

const db = admin.firestore()

// Sample booking data
const sampleBookings = [
  {
    calendarId: 1001,
    adopter: 'John Smith',
    adopterId: 1,
    cat: 'Whiskers',
    catId: 3001,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Sarah Johnson',
    volunteerId: 'volunteer1',
    groupId: 501,
    shelterId: 201,
    adopterEmail: 'john.smith@email.com',
    status: 'confirmed',
    notes: 'Very excited about adopting Whiskers. Has experience with cats.',
    summary: 'Adoption Meeting - Whiskers',
    description: 'Meet and greet session for potential adoption of Whiskers',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    calendarId: 1002,
    adopter: 'Emily Davis',
    adopterId: 2,
    cat: 'Luna',
    catId: 3002,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Mike Wilson',
    volunteerId: 'volunteer2',
    groupId: 502,
    shelterId: 201,
    adopterEmail: 'emily.davis@email.com',
    status: 'pending-confirmation',
    notes: 'First-time cat owner, needs guidance.',
    summary: 'Adoption Meeting - Luna',
    description: 'Initial meet and greet with Luna',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    calendarId: 1003,
    adopter: 'Michael Chen',
    adopterId: 3,
    cat: 'Shadow',
    catId: 3003,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Tom Anderson',
    volunteerId: 'volunteer3',
    groupId: 503,
    shelterId: 201,
    adopterEmail: 'michael.chen@email.com',
    status: 'volunteer-assigned',
    summary: 'Adoption Meeting - Shadow',
    description: 'Meet and greet with Shadow',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    calendarId: 1004,
    adopter: 'Sarah Williams',
    adopterId: 4,
    cat: 'Mittens',
    catId: 3004,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Sarah Johnson',
    volunteerId: 'volunteer1',
    groupId: 504,
    shelterId: 201,
    adopterEmail: 'sarah.williams@email.com',
    status: 'in-progress',
    notes: 'Visit is currently happening.',
    summary: 'Adoption Meeting - Mittens',
    description: 'Visit in progress with Mittens',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    calendarId: 1005,
    adopter: 'David Lee',
    adopterId: 5,
    cat: 'Oliver',
    catId: 3005,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Mike Wilson',
    volunteerId: 'volunteer2',
    groupId: 505,
    shelterId: 201,
    adopterEmail: 'david.lee@email.com',
    status: 'completed',
    notes: 'Visit went well. Considering adoption.',
    summary: 'Adoption Meeting - Oliver',
    description: 'Completed visit with Oliver',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    calendarId: 1006,
    adopter: 'Jennifer Martinez',
    adopterId: 6,
    cat: 'Max',
    catId: 3006,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Tom Anderson',
    volunteerId: 'volunteer3',
    groupId: 506,
    shelterId: 201,
    adopterEmail: 'jennifer.martinez@email.com',
    status: 'adopted',
    notes: 'Max found his forever home! 🎉',
    summary: 'Adoption Meeting - Max',
    description: 'Successful adoption of Max',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    calendarId: 1007,
    adopter: 'Amanda Thompson',
    adopterId: 7,
    cat: 'Bella',
    catId: 3007,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Sarah Johnson',
    volunteerId: 'volunteer1',
    groupId: 507,
    shelterId: 201,
    adopterEmail: 'amanda.thompson@email.com',
    status: 'pending-shelter-setup',
    summary: 'Adoption Meeting - Bella',
    description: 'Initial setup for Bella adoption meeting',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    calendarId: 1008,
    adopter: 'Christopher Brown',
    adopterId: 8,
    cat: 'Simba',
    catId: 3008,
    startTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)),
    endTimeZone: 'America/New_York',
    volunteer: 'Mike Wilson',
    volunteerId: 'volunteer2',
    groupId: 508,
    shelterId: 201,
    adopterEmail: 'christopher.brown@email.com',
    status: 'cancelled',
    notes: 'Adopter had to cancel due to schedule conflict.',
    summary: 'Adoption Meeting - Simba',
    description: 'Cancelled meeting with Simba',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
]

async function seedBookings(orgId) {
  try {
    console.log('Starting to seed bookings...')
    
    const batch = db.batch()
    
    for (const booking of sampleBookings) {
      const docRef = db.collection('bookings').doc()
      batch.set(docRef, {
        ...booking,
        orgId: orgId
      })
    }
    
    await batch.commit()
    
    console.log(`✅ Successfully seeded ${sampleBookings.length} bookings for organization ${orgId}`)
  } catch (error) {
    console.error('❌ Error seeding bookings:', error)
  } finally {
    process.exit()
  }
}

// Get orgId from command line argument
const orgId = process.argv[2]

if (!orgId) {
  console.error('❌ Please provide an organization ID as an argument')
  console.log('Usage: node seedBookings.js <orgId>')
  process.exit(1)
}

seedBookings(orgId)


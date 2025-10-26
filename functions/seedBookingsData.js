const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

// Configure Firestore to use emulator BEFORE initializing
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

const db = admin.firestore();

const orgId = '266'; // Organization ID as a string to match shelter_people and organizations collections

// Mock data for bookings
const bookings = [
  // pending-shelter-setup status
  {
    adopter: 'John Doe',
    adopterId: 101,
    cat: 'Fluffy',
    catId: 201,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T10:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T11:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'john.doe@example.com',
    status: 'pending-shelter-setup',
    notes: 'New adopter interested in meeting Fluffy',
    summary: 'Adoption meeting with John Doe',
    description: 'Initial meet and greet with adopter for Fluffy'
  },
  {
    adopter: 'Jane Smith',
    adopterId: 102,
    cat: 'Whiskers',
    catId: 202,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-28T14:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-28T15:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'jane.smith@example.com',
    status: 'pending-shelter-setup',
    notes: 'Follow-up meeting',
    summary: 'Meeting with Jane Smith',
    description: 'Second meeting with potential adopter'
  },
  {
    adopter: 'Bob Johnson',
    adopterId: 103,
    cat: 'Luna',
    catId: 203,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-29T16:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-29T17:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'bob.johnson@example.com',
    status: 'pending-shelter-setup',
    notes: 'First time visitor',
    summary: 'Initial consultation',
    description: 'New adopter consultation for Luna'
  },
  
  // pending-confirmation status
  {
    adopter: 'Sarah Williams',
    adopterId: 104,
    cat: 'Mittens',
    catId: 204,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T13:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T14:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'sarah.williams@example.com',
    status: 'pending-confirmation',
    notes: 'Awaiting adopter confirmation',
    summary: 'Meeting with Sarah Williams',
    description: 'Adoption meeting pending confirmation'
  },
  {
    adopter: 'Mike Brown',
    adopterId: 105,
    cat: 'Shadow',
    catId: 205,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-28T10:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-28T11:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'mike.brown@example.com',
    status: 'pending-confirmation',
    notes: 'Follow-up needed',
    summary: 'Shadow adoption meeting',
    description: 'Second meeting with Mike for Shadow'
  },
  
  // confirmed status
  {
    adopter: 'Emily Davis',
    adopterId: 106,
    cat: 'Max',
    catId: 206,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T15:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T16:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'emily.davis@example.com',
    status: 'confirmed',
    notes: 'Adopter confirmed',
    summary: 'Confirmed meeting',
    description: 'Confirmed adoption meeting for Max'
  },
  {
    adopter: 'David Wilson',
    adopterId: 107,
    cat: 'Chloe',
    catId: 207,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-28T11:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-28T12:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'david.wilson@example.com',
    status: 'confirmed',
    notes: 'Ready to proceed',
    summary: 'Chloe adoption confirmed',
    description: 'Confirmed meeting for Chloe'
  },
  
  // volunteer-assigned status
  {
    adopter: 'Lisa Anderson',
    adopterId: 108,
    cat: 'Buddy',
    catId: 208,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T11:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-27T12:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'lisa.anderson@example.com',
    status: 'volunteer-assigned',
    notes: 'Volunteer assigned',
    summary: 'Volunteer assigned to meeting',
    description: 'Meeting with volunteer assigned'
  },
  {
    adopter: 'Tom Taylor',
    adopterId: 109,
    cat: 'Bella',
    catId: 209,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-29T10:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-29T11:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'tom.taylor@example.com',
    status: 'volunteer-assigned',
    notes: 'Meeting scheduled',
    summary: 'Volunteer meeting for Bella',
    description: 'Volunteer will conduct meeting for Bella'
  },
  
  // in-progress status
  {
    adopter: 'Nancy Martinez',
    adopterId: 110,
    cat: 'Simba',
    catId: 210,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-26T09:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-26T10:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'nancy.martinez@example.com',
    status: 'in-progress',
    notes: 'Meeting is currently in progress',
    summary: 'Ongoing meeting',
    description: 'Adoption meeting in progress'
  },
  
  // completed status
  {
    adopter: 'Robert Lee',
    adopterId: 111,
    cat: 'Tiger',
    catId: 211,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-25T14:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-25T15:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'robert.lee@example.com',
    status: 'completed',
    notes: 'Meeting completed successfully',
    summary: 'Completed meeting',
    description: 'Adoption meeting completed'
  },
  {
    adopter: 'Patricia Garcia',
    adopterId: 112,
    cat: 'Oreo',
    catId: 213,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-24T16:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-24T17:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'patricia.garcia@example.com',
    status: 'completed',
    notes: 'Met adopter requirements',
    summary: 'Meeting completed',
    description: 'Adoption meeting finished'
  },
  
  // adopted status
  {
    adopter: 'James Moore',
    adopterId: 113,
    cat: 'Tux',
    catId: 214,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-23T13:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-23T14:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'james.moore@example.com',
    status: 'adopted',
    notes: 'Cat successfully adopted',
    summary: 'Successfully adopted',
    description: 'Tux was adopted by James'
  },
  
  // cancelled status
  {
    adopter: 'Jennifer White',
    adopterId: 114,
    cat: 'Lucky',
    catId: 215,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-22T10:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-22T11:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'jennifer.white@example.com',
    status: 'cancelled',
    notes: 'Adopter cancelled appointment',
    summary: 'Cancelled appointment',
    description: 'Meeting was cancelled by adopter'
  },
  {
    adopter: 'Mark Harris',
    adopterId: 115,
    cat: 'Princess',
    catId: 216,
    startTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-21T15:00:00Z')),
    startTimeZone: 'America/New_York',
    endTs: admin.firestore.Timestamp.fromDate(new Date('2025-10-21T16:00:00Z')),
    endTimeZone: 'America/New_York',
    volunteer: 'Greg',
    volunteerId: 'MqehHfOpZOLDX3ZfstcoCBVeyRve',
    groupId: 1,
    shelterId: '266',
    adopterEmail: 'mark.harris@example.com',
    status: 'cancelled',
    notes: 'No longer interested',
    summary: 'Cancelled meeting',
    description: 'Adopter cancelled the appointment'
  }
];

async function seedBookings() {
  try {
    console.log(`Seeding bookings for organization ${orgId}...`);
    
    // Add each booking to Firestore with sequential calendarId
    let calendarIdCounter = 1;
    for (const booking of bookings) {
      // Add orgId field and sequential calendarId to each booking
      const bookingData = {
        ...booking,
        calendarId: calendarIdCounter,
        orgId: orgId
      };
      
      await db.collection('bookings').add(bookingData);
      console.log(`✓ Added booking for ${booking.adopter} - ${booking.cat} (${booking.status}) - calendarId: ${calendarIdCounter}`);
      calendarIdCounter++;
    }
    
    console.log(`\n✅ Successfully added ${bookings.length} bookings to the database!`);
    console.log(`\nStatus breakdown:`);
    console.log(`  - pending-shelter-setup: ${bookings.filter(b => b.status === 'pending-shelter-setup').length}`);
    console.log(`  - pending-confirmation: ${bookings.filter(b => b.status === 'pending-confirmation').length}`);
    console.log(`  - confirmed: ${bookings.filter(b => b.status === 'confirmed').length}`);
    console.log(`  - volunteer-assigned: ${bookings.filter(b => b.status === 'volunteer-assigned').length}`);
    console.log(`  - in-progress: ${bookings.filter(b => b.status === 'in-progress').length}`);
    console.log(`  - completed: ${bookings.filter(b => b.status === 'completed').length}`);
    console.log(`  - adopted: ${bookings.filter(b => b.status === 'adopted').length}`);
    console.log(`  - cancelled: ${bookings.filter(b => b.status === 'cancelled').length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding bookings:', error);
    process.exit(1);
  }
}

seedBookings();


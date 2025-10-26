const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Configure to use local emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

const db = admin.firestore();

async function checkBookings() {
  try {
    console.log('Checking bookings in local Firestore emulator...\n');
    
    // Get all bookings for org 2430
    const bookingsSnapshot = await db.collection('bookings')
      .where('orgId', '==', '2430')
      .get();
    
    console.log(`Found ${bookingsSnapshot.size} bookings for org 2430\n`);
    
    if (bookingsSnapshot.size > 0) {
      bookingsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${data.adopter} - ${data.cat} (${data.status})`);
      });
    } else {
      console.log('No bookings found. Listing all collections...\n');
      const collections = await db.listCollections();
      for (const collection of collections) {
        console.log(`Collection: ${collection.id}`);
        const snapshot = await collection.get();
        console.log(`  Documents: ${snapshot.size}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking bookings:', error);
    process.exit(1);
  }
}

checkBookings();


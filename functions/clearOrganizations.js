const admin = require('firebase-admin');
const path = require('path');

// Load service account
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

const db = admin.firestore();

async function clearOrganizations() {
  try {
    // Clear organizations
    console.log('🔍 Fetching all organizations...');
    const orgsSnapshot = await db.collection('organizations').get();
    
    if (!orgsSnapshot.empty) {
      console.log(`📊 Found ${orgsSnapshot.size} organization(s) to delete.`);
      
      const orgBatch = db.batch();
      let orgCount = 0;
      
      orgsSnapshot.forEach((doc) => {
        console.log(`  - Deleting organization: ${doc.id}`);
        orgBatch.delete(doc.ref);
        orgCount++;
      });
      
      await orgBatch.commit();
      console.log(`✅ Successfully deleted ${orgCount} organization(s).`);
    } else {
      console.log('✅ No organizations found to delete.');
    }

    // Clear shelter_people
    console.log('🔍 Fetching all shelter_people...');
    const peopleSnapshot = await db.collection('shelter_people').get();
    
    if (!peopleSnapshot.empty) {
      console.log(`📊 Found ${peopleSnapshot.size} shelter_people document(s) to delete.`);
      
      const peopleBatch = db.batch();
      let peopleCount = 0;
      
      peopleSnapshot.forEach((doc) => {
        console.log(`  - Deleting shelter_people: ${doc.id}`);
        peopleBatch.delete(doc.ref);
        peopleCount++;
      });
      
      await peopleBatch.commit();
      console.log(`✅ Successfully deleted ${peopleCount} shelter_people document(s).`);
    } else {
      console.log('✅ No shelter_people found to delete.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing collections:', error);
    process.exit(1);
  }
}

clearOrganizations();


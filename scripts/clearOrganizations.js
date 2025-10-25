const admin = require('firebase-admin');
const path = require('path');

// Load service account
const serviceAccount = require(path.join(__dirname, '../functions/serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

const db = admin.firestore();

async function clearOrganizations() {
  try {
    console.log('🔍 Fetching all organizations...');
    const orgsSnapshot = await db.collection('organizations').get();
    
    if (orgsSnapshot.empty) {
      console.log('✅ No organizations found to delete.');
      process.exit(0);
    }

    console.log(`📊 Found ${orgsSnapshot.size} organization(s) to delete.`);
    
    // Delete in batches
    const batch = db.batch();
    let count = 0;
    
    orgsSnapshot.forEach((doc) => {
      console.log(`  - Deleting organization: ${doc.id}`);
      batch.delete(doc.ref);
      count++;
    });
    
    await batch.commit();
    console.log(`✅ Successfully deleted ${count} organization(s).`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing organizations:', error);
    process.exit(1);
  }
}

clearOrganizations();


const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// Initialize Firebase Admin
const serviceAccount = require('./functions/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

const db = admin.firestore();

async function createTestOrganization() {
  try {
    const orgId = '2372';
    const verificationUuid = 'test-uuid-2372';
    
    // Create organization document
    const orgDocument = {
      orgId: orgId,
      verificationUuid: verificationUuid,
      verified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      rescueGroupsData: {
        attributes: {
          name: 'Test Organization 2372',
          email: 'test@example.com',
          city: 'Test City',
          state: 'TS'
        }
      },
      rescueGroupsName: 'Test Organization 2372',
      rescueGroupsEmail: 'test@example.com',
      rescueGroupsCity: 'Test City',
      rescueGroupsState: 'TS',
      pendingSetup: true
    };

    await db.collection('organizations').doc(orgId).set(orgDocument);
    console.log('✅ Organization document created successfully');

    // Create JWT token
    const jwtSecret = 'your-secret-key'; // This should match your actual secret
    const token = jwt.sign({
      uuid: verificationUuid,
      orgId: orgId,
      type: 'organization_verification',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }, jwtSecret);

    console.log('✅ JWT token created successfully');
    console.log('🔗 Verification URL: http://localhost:3000/jwt-verification?jwt=' + token);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestOrganization();

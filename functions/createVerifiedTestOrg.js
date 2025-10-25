#!/usr/bin/env node

/**
 * Script to create a fully verified organization and admin user
 * bypassing email verification - FOR LOCAL TESTING ONLY
 * 
 * Usage:
 *   node createVerifiedTestOrg.js
 */

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin SDK for emulator
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

// For production Firestore (not emulator)
const db = admin.firestore();

async function createVerifiedTestOrg() {
  try {
    console.log('\n🔧 Creating Verified Test Organization (Bypassing Email)\n');
    
    const email = 'test@admin.com';
    const orgId = '293'; // Using a real RescueGroups ID
    const userName = 'Test Admin';
    const orgName = 'Anjellicle Cats Rescue';
    
    console.log('📝 Creating organization and admin with:');
    console.log(`   Organization ID: ${orgId}`);
    console.log(`   Organization Name: ${orgName}`);
    console.log(`   Admin Email: ${email}`);
    console.log(`   Admin Name: ${userName}`);
    console.log(`   Status: ✅ Pre-verified (no email needed)\n`);
    
    // Create organization with verified status
    const orgRef = db.collection('organizations').doc(orgId);
    
    console.log('📦 Creating organization...');
    await orgRef.set({
      rescueGroupsName: orgName,
      name: orgName,
      email: email,
      organizationType: 'shelter',
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      onboardingCompleted: false, // Will complete during first login
      calendarConnected: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verificationToken: uuidv4(), // In case needed for reference
      // Add some test data
      operatingHours: {
        monday: { start: '09:00', end: '17:00', closed: false },
        tuesday: { start: '09:00', end: '17:00', closed: false },
        wednesday: { start: '09:00', end: '17:00', closed: false },
        thursday: { start: '09:00', end: '17:00', closed: false },
        friday: { start: '09:00', end: '17:00', closed: false },
        saturday: { start: '10:00', end: '16:00', closed: false },
        sunday: { start: '00:00', end: '00:00', closed: true }
      }
    });
    console.log('✅ Organization created and verified');
    
    // Create admin user document (Auth will be created on first sign-in)
    const userId = 'test-admin-user-id'; // Placeholder - will be replaced by Firebase Auth UID
    const userRef = db.collection('shelter_people').doc(userId);
    
    console.log('👤 Creating admin user document...');
    await userRef.set({
      email: email,
      name: userName,
      orgId: orgId,
      role: 'admin',
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      onboardingCompleted: false, // Will be set to true after onboarding
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Admin user document created');
    console.log('\n' + '='.repeat(70));
    console.log('🎉 Test Organization Created Successfully (Email Bypassed!)');
    console.log('='.repeat(70));
    console.log('\n📋 Next Steps:');
    console.log('   1. Go to http://127.0.0.1:5002');
    console.log('   2. Click "Sign in with Google" in the header');
    console.log(`   3. Sign in with: ${email}`);
    console.log('   4. System will detect verified organization');
    console.log('   5. Complete onboarding steps\n');
    console.log('💡 Note: Firebase Auth emulator allows ANY email - no password!\n');
    console.log('🔗 View in Firestore: http://127.0.0.1:4000/firestore\n');
    console.log('⚠️  IMPORTANT: This user document has a placeholder ID.');
    console.log('   On first sign-in, a new document will be created with the real');
    console.log('   Firebase Auth UID. The system handles this automatically.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test organization:', error);
    process.exit(1);
  }
}

createVerifiedTestOrg();


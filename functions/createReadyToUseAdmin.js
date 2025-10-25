#!/usr/bin/env node

/**
 * Script to create a FULLY COMPLETE organization and admin user
 * Ready to use immediately - FOR LOCAL TESTING ONLY
 * 
 * Usage:
 *   node createReadyToUseAdmin.js [email]
 * 
 * Example:
 *   node createReadyToUseAdmin.js myemail@test.com
 */

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

const db = admin.firestore();

async function createReadyToUseAdmin() {
  try {
    const email = process.argv[2] || 'admin@test.com';
    const orgId = '293'; // Anjellicle Cats Rescue
    const userName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const orgName = 'Anjellicle Cats Rescue';
    
    console.log('\n🚀 Creating FULLY COMPLETE Admin User (No Setup Needed!)\n');
    console.log('📝 Configuration:');
    console.log(`   Organization: ${orgName} (ID: ${orgId})`);
    console.log(`   Admin Email: ${email}`);
    console.log(`   Admin Name: ${userName}`);
    console.log(`   Status: ✅ Fully verified and onboarded\n`);
    
    // Create fully complete organization
    const orgRef = db.collection('organizations').doc(orgId);
    
    console.log('📦 Creating complete organization...');
    await orgRef.set({
      rescueGroupsName: orgName,
      name: orgName,
      email: email,
      organizationType: 'shelter',
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      onboardingCompleted: true,
      onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      calendarConnected: true,
      selectedCalendarId: 'primary',
      calendarAccessToken: 'test-token',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      operatingHours: {
        monday: { start: '09:00', end: '17:00', closed: false },
        tuesday: { start: '09:00', end: '17:00', closed: false },
        wednesday: { start: '09:00', end: '17:00', closed: false },
        thursday: { start: '09:00', end: '17:00', closed: false },
        friday: { start: '09:00', end: '17:00', closed: false },
        saturday: { start: '10:00', end: '16:00', closed: false },
        sunday: { start: '00:00', end: '00:00', closed: true }
      },
      users: []
    });
    console.log('✅ Organization created (fully complete)');
    
    // Since we don't know the Firebase Auth UID yet, we'll create a document
    // that will be matched by email when the user signs in
    // The system will create/update the document with the correct UID on first sign-in
    
    console.log('👤 Setting up admin user reference...');
    console.log('   (User document will be auto-created on first sign-in with correct UID)');
    
    // Store in a temporary collection that the backend can check
    const tempUserRef = db.collection('pending_verified_users').doc(email.replace(/[@.]/g, '_'));
    await tempUserRef.set({
      email: email,
      name: userName,
      orgId: orgId,
      role: 'admin',
      verified: true,
      onboardingCompleted: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ User configuration stored');
    console.log('\n' + '='.repeat(70));
    console.log('🎉 Ready-to-Use Admin Created Successfully!');
    console.log('='.repeat(70));
    console.log('\n📋 Usage Instructions:');
    console.log('   1. Go to: http://127.0.0.1:5002');
    console.log('   2. Click "Sign in with Google" in the header');
    console.log(`   3. Sign in with: ${email}`);
    console.log('   4. You\'ll see "Welcome, ' + userName + '!" immediately');
    console.log('   5. Access all features - no onboarding needed!\n');
    console.log('✨ Benefits:');
    console.log('   ✅ Organization fully verified');
    console.log('   ✅ Admin role assigned');
    console.log('   ✅ Onboarding marked complete');
    console.log('   ✅ Calendar connected');
    console.log('   ✅ Operating hours set');
    console.log('   ✅ Ready to use immediately!\n');
    console.log('🔗 View in Firestore: http://127.0.0.1:4000/firestore');
    console.log('   - organizations/293');
    console.log('   - pending_verified_users/' + email.replace(/[@.]/g, '_') + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createReadyToUseAdmin();


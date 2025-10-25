#!/usr/bin/env node

/**
 * Script to create a test admin user in the local Firebase emulator
 * 
 * Usage:
 *   node createTestAdmin.js [email] [orgId]
 * 
 * Example:
 *   node createTestAdmin.js test@admin.com 123
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin SDK for emulator
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

// Connect to Firestore emulator
const db = admin.firestore();
db.settings({
  host: 'localhost:8080',
  ssl: false
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createTestAdmin() {
  try {
    console.log('\n🔧 Creating Test Admin User\n');
    
    // Get input from command line args or prompt
    let email = process.argv[2];
    let orgId = process.argv[3];
    
    if (!email) {
      email = await prompt('Enter admin email (default: test@admin.com): ');
      email = email.trim() || 'test@admin.com';
    }
    
    if (!orgId) {
      orgId = await prompt('Enter organization ID (default: test-org-123): ');
      orgId = orgId.trim() || 'test-org-123';
    }
    
    const userName = await prompt('Enter admin name (default: Test Admin): ');
    const finalUserName = userName.trim() || 'Test Admin';
    
    console.log('\n📝 Creating user with:');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${finalUserName}`);
    console.log(`   Org ID: ${orgId}`);
    console.log(`   Role: admin\n`);
    
    // Create organization if it doesn't exist
    const orgRef = db.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();
    
    if (!orgDoc.exists) {
      console.log('📦 Creating organization...');
      await orgRef.set({
        rescueGroupsName: 'Test Organization',
        name: 'Test Organization',
        email: email,
        organizationType: 'shelter',
        verified: true,
        onboardingCompleted: true,
        calendarConnected: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Organization created');
    } else {
      console.log('✅ Organization already exists');
    }
    
    // Create user in shelter_people collection
    // Note: We'll use email as the document ID for now since we can't create Auth users in emulator via script
    const userId = email.replace(/[@.]/g, '_'); // Convert email to safe document ID
    const userRef = db.collection('shelter_people').doc(userId);
    
    console.log('👤 Creating user document...');
    await userRef.set({
      email: email,
      name: finalUserName,
      orgId: orgId,
      role: 'admin',
      verified: true,
      onboardingCompleted: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ User document created');
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Test Admin User Created Successfully!');
    console.log('='.repeat(60));
    console.log('\n📋 Next Steps:');
    console.log('   1. Go to http://127.0.0.1:5002');
    console.log('   2. Click "Sign in with Google" in the header');
    console.log(`   3. Sign in with: ${email}`);
    console.log('   4. You will be automatically verified and redirected\n');
    console.log('💡 Note: The Firebase Auth emulator will let you sign in with');
    console.log('   any email - no password needed!\n');
    console.log('🔗 View in Emulator UI: http://127.0.0.1:4000/firestore\n');
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test admin:', error);
    rl.close();
    process.exit(1);
  }
}

createTestAdmin();


#!/usr/bin/env node

/**
 * Make an existing user an admin of a verified organization
 * Run this AFTER signing in at least once
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
});

const db = admin.firestore();

async function makeUserAdmin() {
  const email = process.argv[2] || 'gregoryew@gmail.com';
  const orgId = '293';
  
  console.log(`\n🔧 Making ${email} an admin of organization ${orgId}...\n`);
  
  try {
    // Find user by email
    const usersSnapshot = await db.collection('shelter_people')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ User not found. Please sign in first at http://127.0.0.1:5002');
      console.log('   Then run this script again.');
      process.exit(1);
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    
    console.log(`✅ Found user: ${userId}`);
    console.log('📝 Updating user to admin...');
    
    await userDoc.ref.update({
      orgId: orgId,
      role: 'admin',
      verified: true,
      onboardingCompleted: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ User updated successfully!');
    console.log('\n' + '='.repeat(60));
    console.log('🎉 You are now an admin!');
    console.log('='.repeat(60));
    console.log('\n📋 Next steps:');
    console.log('   1. Refresh the page: http://127.0.0.1:5002');
    console.log('   2. You should see "Welcome, [Your Name]!"');
    console.log('   3. Access all admin features\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

makeUserAdmin();


const admin = require('firebase-admin')
const path = require('path')

// Load service account
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'catapp-44885'
})

const db = admin.firestore()

async function checkData() {
  try {
    console.log('🔍 Checking Firestore data...\n')
    
    // Check shelter_people
    console.log('📋 SHELTER_PEOPLE:')
    const peopleSnapshot = await db.collection('shelter_people').get()
    if (peopleSnapshot.empty) {
      console.log('  ⚠️  No documents found')
    } else {
      peopleSnapshot.forEach(doc => {
        const data = doc.data()
        console.log(`  - ${doc.id}:`)
        console.log(`    orgId: ${data.orgId}`)
        console.log(`    email: ${data.email}`)
        console.log(`    displayName: ${data.displayName}`)
      })
    }
    
    console.log('\n📋 ORGANIZATIONS:')
    const orgsSnapshot = await db.collection('organizations').get()
    if (orgsSnapshot.empty) {
      console.log('  ⚠️  No documents found')
    } else {
      orgsSnapshot.forEach(doc => {
        const data = doc.data()
        console.log(`  - ${doc.id}:`)
        console.log(`    rescueGroupsName: ${data.rescueGroupsName}`)
        console.log(`    verified: ${data.verified}`)
        console.log(`    calendarConnected: ${data.calendarConnected}`)
        console.log(`    has calendarAccessToken: ${!!data.calendarAccessToken}`)
        console.log(`    has calendarRefreshToken: ${!!data.calendarRefreshToken}`)
        console.log(`    selectedCalendarId: ${data.selectedCalendarId}`)
      })
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkData()

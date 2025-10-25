# Bookings Backend Integration

This document describes the backend integration for the Bookings page in the Feline Finder organization portal.

## Overview

The bookings system allows shelter administrators and volunteers to manage adoption appointments, including:
- Creating and viewing bookings
- Updating booking details and status
- Managing notes for each booking
- Tracking the full lifecycle of an adoption appointment

## Architecture

### Backend Functions

Located in: `/functions/src/bookings/bookingsService.ts`

#### 1. `getBookings`
- **Type**: Callable function
- **Authentication**: Required
- **Description**: Retrieves all bookings for the user's organization
- **Returns**: Array of booking objects

#### 2. `createBooking`
- **Type**: Callable function
- **Authentication**: Required
- **Parameters**:
  - `booking`: Booking object (without id)
- **Description**: Creates a new booking for the organization
- **Returns**: Success status, booking ID, and created booking

#### 3. `updateBooking`
- **Type**: Callable function
- **Authentication**: Required
- **Parameters**:
  - `bookingId`: String
  - `updates`: Partial booking object
- **Description**: Updates an existing booking with audit trail
- **Returns**: Success status and booking ID

#### 4. `updateBookingNotes`
- **Type**: Callable function
- **Authentication**: Required
- **Parameters**:
  - `bookingId`: String
  - `notes`: String
- **Description**: Updates notes for a specific booking
- **Returns**: Success status and booking ID

#### 5. `deleteBooking`
- **Type**: Callable function
- **Authentication**: Required
- **Parameters**:
  - `bookingId`: String
- **Description**: Deletes a booking
- **Returns**: Success status and booking ID

### Frontend Service

Located in: `/frontend/src/services/bookingsService.ts`

Provides TypeScript-safe wrappers around the backend functions with:
- Automatic timestamp conversion
- Error handling
- Type safety

### Firestore Structure

**Collection**: `bookings`

**Document Structure**:
```typescript
{
  id: string (auto-generated)
  calendarId: number
  adopter: string
  adopterId: number
  cat: string
  catId: number
  startTs: Timestamp
  startTimeZone: string
  endTs: Timestamp
  endTimeZone: string
  volunteer: string
  volunteerId?: string
  groupId: number
  shelterId: number
  adopterEmail: string
  status: 'pending-shelter-setup' | 'pending-confirmation' | 'confirmed' | 
          'volunteer-assigned' | 'in-progress' | 'completed' | 'adopted' | 'cancelled'
  notes?: string
  reminders?: Array<{method: string, minutes: number}>
  attachments?: Array<{fileUrl: string, title: string, mimetype: string, iconLink: string}>
  summary: string
  description: string
  orgId: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  auditTrail?: Array<{
    fieldName: string
    from: string
    to: string
    createdAt: Timestamp
    changedBy: string
  }>
}
```

## Security

- All functions require authentication via Firebase Auth
- Users can only access bookings for their own organization
- Organization ID is automatically determined from the user's `shelter_people` record
- All changes are tracked in an audit trail with user ID and timestamp

## Usage

### Loading Bookings

```typescript
import * as bookingsService from '../services/bookingsService'

const bookings = await bookingsService.getBookings()
```

### Creating a Booking

```typescript
const newBooking = {
  calendarId: 1001,
  adopter: 'John Doe',
  adopterId: 123,
  cat: 'Whiskers',
  catId: 456,
  startTs: new Date('2024-03-15T10:00:00'),
  startTimeZone: 'America/New_York',
  endTs: new Date('2024-03-15T11:00:00'),
  endTimeZone: 'America/New_York',
  volunteer: 'Jane Smith',
  groupId: 789,
  shelterId: 101,
  adopterEmail: 'john@example.com',
  status: 'pending-confirmation',
  summary: 'Adoption Meeting - Whiskers',
  description: 'Initial meet and greet'
}

const result = await bookingsService.createBooking(newBooking)
```

### Updating a Booking

```typescript
await bookingsService.updateBooking(bookingId, {
  status: 'confirmed',
  volunteer: 'New Volunteer Name'
})
```

### Updating Notes

```typescript
await bookingsService.updateBookingNotes(bookingId, 'Meeting went well. Adopter is very interested.')
```

## Testing

### Seed Test Data

1. Find your organization ID from Firestore (`organizations` collection)

2. Run the seed script:
```bash
cd functions
node seedBookings.js <your-org-id>
```

This will create 8 sample bookings with various statuses.

### Local Development

1. Ensure emulators are running:
```bash
cd /Users/gregoryew/flutter_apps/FelineFinder/orgWebsite
./restart-emulators.sh
```

2. The frontend automatically connects to the Functions emulator at `http://127.0.0.1:5001`

3. View logs:
```bash
./view-logs.sh
```

## Status Workflow

The booking system follows this workflow:

1. **pending-shelter-setup**: Initial booking created
2. **pending-confirmation**: Setup complete, awaiting adopter confirmation
3. **volunteer-assigned**: Volunteer has been assigned
4. **confirmed**: Appointment confirmed by adopter
5. **in-progress**: Visit is currently happening
6. **completed**: Visit completed
7. **adopted**: Cat was successfully adopted
8. **cancelled**: Appointment was cancelled

Each status change is tracked in the audit trail.

## Future Enhancements

- Email notifications for status changes
- Calendar sync with Google Calendar
- Volunteer assignment automation
- Reminder scheduling
- File attachments for adoption paperwork
- Video conference integration

## Troubleshooting

### "User not found" error
- Ensure the user exists in the `shelter_people` collection
- Verify the user has an `orgId` field

### "Permission denied" error
- Check that the user's `orgId` matches the booking's `orgId`
- Verify Firebase Auth is working correctly

### Timestamps not converting properly
- The frontend service automatically converts Firestore Timestamps to JavaScript Date objects
- When sending data to backend, dates are converted to ISO strings

## Related Files

- Backend service: `/functions/src/bookings/bookingsService.ts`
- Frontend service: `/frontend/src/services/bookingsService.ts`
- UI component: `/frontend/src/pages/Bookings.tsx`
- Function exports: `/functions/src/index.ts`
- Seed script: `/functions/seedBookings.js`


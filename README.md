# Feline Finder Organization Portal

A comprehensive web application for animal rescue organizations to manage adoptions, bookings, volunteers, and community outreach.

## Features

- **Authentication**: Google OAuth integration
- **Dashboard**: Overview of organization activities
- **Booking Management**: Schedule meet & greets, vet visits, and adoption appointments
- **Admin Panel**: User management and system configuration
- **Google Calendar Integration**: Sync appointments with Google Calendar
- **Email Notifications**: Automated email communications
- **Firestore Database**: Real-time data synchronization

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Firebase SDK for authentication and database

### Backend
- Firebase Cloud Functions (Node.js 18)
- Firestore for database
- Google Calendar API integration
- Nodemailer for email functionality

## Project Structure

```
orgWebsite/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # Firebase and API services
│   │   └── types/          # TypeScript type definitions
│   ├── public/             # Static assets
│   └── package.json
├── functions/               # Firebase Cloud Functions
│   ├── src/
│   │   ├── auth/           # Authentication functions
│   │   ├── calendar/       # Google Calendar integration
│   │   ├── email/          # Email functionality
│   │   ├── admin/          # Admin functions
│   │   └── bookings/      # Booking management
│   └── package.json
├── firebase.json           # Firebase configuration
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Database indexes
└── setup.sh               # Automated setup script
```

## Quick Start

1. **Run the setup script**:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Manual setup** (if you prefer):
   ```bash
   # Install dependencies
   cd frontend && npm install
   cd ../functions && npm install
   
   # Build applications
   cd ../frontend && npm run build
   cd ../functions && npm run build
   
   # Deploy to Firebase
   firebase deploy
   ```

## Configuration

### Environment Variables

The setup script will automatically create a `.env` file in the frontend directory with your Firebase configuration.

### Firebase Secrets

The following secrets need to be configured in Firebase Functions:

- `ADMIN_EMAILS`: Comma-separated list of admin email addresses
- `GCAL_CLIENT_ID`: Google OAuth client ID
- `GCAL_CLIENT_SECRET`: Google OAuth client secret
- `GCAL_REDIRECT_URI`: OAuth redirect URI
- `SMTP_HOST`: SMTP server host (optional)
- `SMTP_PORT`: SMTP server port (optional)
- `SMTP_USER`: SMTP username (optional)
- `SMTP_PASS`: SMTP password (optional)
- `MAIL_FROM`: From email address (optional)

## Development

### Frontend Development
```bash
cd frontend
npm run dev
```

### Functions Development
```bash
cd functions
npm run serve
```

### Firebase Emulators
```bash
firebase emulators:start
```

## Deployment

```bash
firebase deploy
```

## Security Rules

The application uses Firestore security rules to ensure:
- Users can only access their own data
- Organization members can read organization data
- Only admins can modify organization settings
- Booking access is restricted to organization members

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

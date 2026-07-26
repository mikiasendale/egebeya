# Egebeya (እገበያ) Bookings

A multi-tenant SaaS platform for service-based businesses in Ethiopia to manage online bookings, build websites visually with Puck, and handle payments.

## Features
- **Multi-tenant Architecture:** One platform, unlimited businesses with subdomains or custom domains.
- **Visual Website Builder:** Uses Measured Puck for drag-and-drop landing pages.
- **Booking Management:** Real-time slot availability, staff assignment, SMS/Email reminders.
- **Ethiopian Calendar Support:** Native support for the Ethiopian calendar format.
- **Payments:** TellBirr integration for upfront deposits and payments.

## Getting Started

### Prerequisites
- Node.js 18+
- SQLite (Local dev) / MySQL (Production/Plesk)

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Setup environment variables: `cp .env.example .env`
4. Run migrations: `npx drizzle-kit push:sqlite` (for local dev)
5. Start dev server: `npm run dev`

The platform will run on `http://localhost:3000`.

### Environment Variables
Check `.env.example` for the required keys.
- `JWT_SECRET`: Secret for user auth tokens.
- `REFRESH_SECRET`: Secret for refresh tokens.
- `DATABASE_URL`: Connection string for your DB.
- `SMTP_*`: Settings for email delivery.
- `SMS_API_KEY`: Key for Ethiopian SMS gateway.

## Testing
Run basic unit/integration tests with:
```
npm run test
```

## Plesk Deployment Instructions

1. **Document Root**: Point your Plesk domain document root to the `dist` directory or proxy to a Node.js process.
2. **Node.js App Setup**:
   - Enable Node.js in Plesk for the domain.
   - Run `npm install` and `npm run build`.
   - Set the Application Startup File to `dist/server.cjs`.
3. **Wildcard Subdomains**:
   - Add a wildcard DNS record `*.yourdomain.com` pointing to the Plesk IP.
   - In Plesk, add a Subdomain with the name `*` pointing to the main document root.
4. **Cron Job for Reminders**:
   - In Plesk Scheduled Tasks, add a task to run every 15 minutes:
     ```
     cd /var/www/vhosts/yourdomain.com/httpdocs && npm run send-reminders
     ```
5. **Database (MySQL/MariaDB)**:
   - Change Drizzle config to use `drizzle-orm/mysql2`.
   - Update your `schema.ts` to use MySQL data types instead of SQLite.
6. **Backups**:
   - Use Plesk Backup Manager to schedule daily backups of files and the MySQL database.

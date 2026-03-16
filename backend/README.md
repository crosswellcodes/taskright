# TaskRight Backend

Node.js + Express API for TaskRight service management platform.

## Quick Start
```bash
# Install dependencies
npm install

# Run migrations
npm run migrate:latest

# Start development server
npm run dev
```

Server runs on `http://localhost:3000`

## Project Structure
```
src/
├── routes/          # Express route handlers
├── services/        # Business logic & database queries
├── utils/           # Helper functions (JWT, validation)
├── middleware/      # Express middleware
└── jobs/            # Scheduled tasks

migrations/          # Database schema migrations
server.js            # Express app entry point
knexfile.js          # Knex configuration
```

## Available Scripts
```bash
npm run dev              # Start with auto-reload (nodemon)
npm start               # Start production server
npm run migrate:latest  # Run pending migrations
npm run migrate:rollback # Undo last migration
npm run migrate:status  # Check migration status
```

## API Endpoints

See `../SPEC.md` for complete API documentation.

### Implemented

- POST /api/auth/businesses/signup
- POST /api/auth/businesses/login
- POST /api/auth/customers/signup
- POST /api/auth/customers/login

### To Build

See `../HANDOFF.md` for remaining endpoints.

## Database

PostgreSQL 18 with Knex.js migrations.
```bash
# Create database
createdb task_app_db

# Clear data (keep schema)
psql task_app_db -c "DELETE FROM service_completions; DELETE FROM selections; DELETE FROM selection_cycles; DELETE FROM task_assignments; DELETE FROM tasks; DELETE FROM customer_cycle_assignments; DELETE FROM service_cycles; DELETE FROM customers; DELETE FROM businesses;"

# Full reset
dropdb task_app_db
createdb task_app_db
npm run migrate:latest
```

## Environment Variables

Create `.env` file:
```
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=your-number
```

## Testing
```bash
# Test business signup
curl -X POST http://localhost:3000/api/auth/businesses/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Co","phoneNumber":"+1234567890"}'

# Test business login
curl -X POST http://localhost:3000/api/auth/businesses/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890"}'
```

## Reference Implementation

Study `src/routes/auth.js` for endpoint pattern.

All endpoints should follow:
1. Validate input
2. Call service layer
3. Handle errors
4. Return JSON response
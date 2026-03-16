# Task App - Handoff to Claude Code

## Complete Project Structure
```
TaskRight_Project/
├── SPEC.md                          ← COMPLETE SPECIFICATION (READ FIRST)
├── HANDOFF.md                       ← This file
├── README.md                        ← Project overview
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── auth.js             ← REFERENCE IMPLEMENTATION (study this)
│   │   ├── services/
│   │   │   ├── businessService.js
│   │   │   └── customerService.js
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   └── validators.js
│   │   ├── middleware/             ← Create auth middleware here
│   │   ├── jobs/                   ← Create cron jobs here
│   │   └── db.js
│   ├── migrations/
│   │   └── 001_initial_schema.js   ← DATABASE SCHEMA
│   ├── server.js
│   ├── knexfile.js
│   ├── package.json
│   └── .gitignore
├── ios/                            ← React Native iOS app
└── ... (other project files)
```

## Handoff Checklist

### Before Starting Implementation in Claude Code

- [ ] Read `SPEC.md` completely
- [ ] Study `backend/src/routes/auth.js` as reference pattern
- [ ] Understand the database schema in `backend/migrations/001_initial_schema.js`
- [ ] Review `backend/src/services/businessService.js` for service layer pattern
- [ ] Check `backend/src/utils/validators.js` for validation pattern
- [ ] Check `backend/src/utils/jwt.js` for authentication pattern

### What's Already Built & Tested

✅ Database: PostgreSQL 18 with 9 core tables  
✅ Local dev environment: Node.js + Express running on localhost:3000  
✅ Authentication endpoints: /api/auth/businesses/signup, /api/auth/businesses/login, /api/auth/customers/signup, /api/auth/customers/login  
✅ Error handling: Consistent error codes and validation  
✅ JWT token generation: 24-hour tokens with business/customer context  

### Test Commands (for verification)
```bash
# Start backend server
cd backend
npm run dev

# Test signup
curl -X POST http://localhost:3000/api/auth/businesses/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Business","phoneNumber":"+1234567890"}'

# Test login
curl -X POST http://localhost:3000/api/auth/businesses/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890"}'
```

### Remaining Work for Claude Code

#### Phase 1: Complete Backend Endpoints

**Business Owner Routes** (`backend/src/routes/businesses.js`):
- POST /api/businesses/:businessId/tasks
- GET /api/businesses/:businessId/tasks
- PUT /api/businesses/:businessId/tasks/:taskId
- DELETE /api/businesses/:businessId/tasks/:taskId
- POST /api/businesses/:businessId/service-cycles
- GET /api/businesses/:businessId/service-cycles
- PUT /api/businesses/:businessId/service-cycles/:cycleId
- POST /api/businesses/:businessId/customers
- GET /api/businesses/:businessId/customers
- GET /api/businesses/:businessId/customers/:customerId
- POST /api/businesses/:businessId/customers/:customerId/assign-cycle
- GET /api/businesses/:businessId/customers/:customerId/selections/upcoming
- GET /api/businesses/:businessId/selections (forecast)
- POST /api/businesses/:businessId/customers/:customerId/mark-service-complete

**Customer Routes** (`backend/src/routes/customers.js`):
- GET /api/customers/:customerId/selection-cycle/current
- POST /api/customers/:customerId/selection-cycle/:selectionCycleId/submit
- GET /api/customers/:customerId/selection-history

**Implementation Pattern**: Follow `backend/src/routes/auth.js` pattern:
1. Validate input using validators.js
2. Call service layer
3. Handle errors with specific codes
4. Return formatted JSON response

#### Phase 2: Authentication Middleware

Create `backend/src/middleware/auth.js`:
- Verify JWT tokens from Authorization header
- Attach user context to requests
- Return 401 for invalid tokens
- Return 403 for insufficient permissions

#### Phase 3: Cron Jobs

Create `backend/src/jobs/`:
- `selection-reminders.js`: Send SMS 3 days before service
- `auto-repeat.js`: Auto-repeat selections 1 day before service

Use node-schedule or similar library.

#### Phase 4: Twilio Integration

Update `backend/src/services/notificationService.js`:
- Initialize Twilio client (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
- Send SMS notifications
- Handle Twilio errors

#### Phase 5: React Native Frontend (ios/)

- Build customer selection screens
- Build business owner dashboard
- Implement API integration
- Handle JWT tokens in requests
- Add SMS notification listeners

### Environment Variables

Create `backend/.env`:
```
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-here
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone
```

### Database Setup Reminders
```bash
# Start PostgreSQL
brew services start postgresql@18

# Create database (if needed)
createdb task_app_db

# Run migrations
cd backend
npm run migrate:latest

# Reset database (clear data)
psql task_app_db -c "DELETE FROM service_completions; DELETE FROM selections; DELETE FROM selection_cycles; DELETE FROM task_assignments; DELETE FROM tasks; DELETE FROM customer_cycle_assignments; DELETE FROM service_cycles; DELETE FROM customers; DELETE FROM businesses;"
```

### Key Design Decisions

1. **Business sets total hours** - Customers cannot change service scope (prevents scope creep)
2. **Fixed service cycles per customer** - Customers assigned to specific cycle (weekly/monthly/yearly)
3. **Task time validation** - Selected tasks cannot exceed total hours (enforced client-side and server-side)
4. **Auto-repeat functionality** - System repeats previous selections if customer doesn't submit
5. **SMS as primary notification** - Push notifications deferred to Phase 2
6. **JWT authentication** - 24-hour tokens, can be refreshed in Phase 2
7. **Knex.js for migrations** - Maintains database version control

### Testing Strategy

1. **Unit tests** - Test service functions (businessService, customerService)
2. **Integration tests** - Test full API endpoint flows
3. **Database tests** - Test migrations and data integrity
4. **Error scenarios** - Test validation, duplicate detection, 404s, 409s

### Performance Considerations

- Add indexes on frequently queried columns (phone_number, business_id, customer_id)
- Implement caching for read-heavy endpoints (Phase 2)
- Use pagination for list endpoints (Phase 2)
- Consider connection pooling for PostgreSQL (Phase 2)

### Security Reminders

- JWT_SECRET must be strong and random in production
- Twilio credentials must be environment variables (never hardcoded)
- Phone numbers are PII - ensure compliance with data privacy
- Implement rate limiting on auth endpoints (Phase 2)
- Use HTTPS in production (Heroku handles this)

### Documentation

- API endpoints documented in SPEC.md
- Database schema documented in SPEC.md
- Error codes documented in SPEC.md
- User flows documented in SPEC.md

### Support

For questions about:
- **Architecture**: See SPEC.md "System Architecture" section
- **API design**: See SPEC.md "API Specification" section
- **Database**: See SPEC.md "Database Schema" section
- **User flows**: See SPEC.md "User Flows" section
- **Error handling**: See SPEC.md "Error Handling" section

---

**Status**: Ready for Claude Code implementation  
**Date prepared**: March 10, 2026  
**Next step**: Share SPEC.md and this HANDOFF.md with Claude Code
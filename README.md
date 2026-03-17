# TaskRight — Multi-Platform Service Management

A two-sided marketplace connecting service providers with customers. Streamline task management, staff scheduling, and customer communication.

**Status**: MVP complete on mobile + backend. Website (Phase 1) in progress.

---

## 🏗️ Projects in This Monorepo

### [`backend/`](./backend) — Node.js/Express API
- **Language**: JavaScript (Node.js 18+)
- **Database**: PostgreSQL 18, Knex.js migrations
- **Status**: MVP complete ✅
- **Features**:
  - Business & customer auth (JWT)
  - 14 business routes (tasks, cycles, staff, assignments, feedback)
  - 3 customer routes (selections, submissions, feedback)
  - Cron jobs (SMS reminders, auto-repeat selections)
  - Twilio SMS integration
- **Quick Start**: `cd backend && npm run dev` (port 3000)

### [`TaskRight/`](./TaskRight) — React Native iOS Mobile App
- **Language**: JavaScript (React Native)
- **Status**: MVP complete ✅
- **Features**:
  - Customer: View services, select tasks, submit, leave feedback
  - Business: Create cycles, assign staff, manage teams, view feedback
  - Real-time staff transparency, task selection workflow
  - Success/confirmation screens
  - Selection history
- **Quick Start**: `cd TaskRight && npm install && npm start`

### [`TaskRight-Website/`](./TaskRight-Website) — React/Next.js Web App
- **Language**: JavaScript (React/Next.js)
- **Status**: Phase 1 setup in progress 🚀
- **Phase 1 Goals**:
  - Landing page with product demo
  - Signup flows (business + customer)
  - Drive traffic to mobile app
- **Design**: Mirror mobile design system (same colors, typography, components)
- **Backend**: Uses same API as mobile app
- **Quick Start**: `cd TaskRight-Website && npm install && npm run dev` (port 3000)

---

## 📚 Shared Documentation

These documents are referenced by all projects for consistent design, features, and API usage:

- **[`shared/PRODUCT_OVERVIEW.md`](./shared/PRODUCT_OVERVIEW.md)** — Product mission, user personas, business metrics, current phase
- **[`shared/DESIGN_SYSTEM.md`](./shared/DESIGN_SYSTEM.md)** — Colors (#2563eb, #10b981), typography, component styles (buttons, cards, pills, modals), spacing
- **[`shared/API_REFERENCE.md`](./shared/API_REFERENCE.md)** — Complete backend API documentation (auth, customers, businesses, teams)
- **[`shared/FEATURE_MAPPING.md`](./shared/FEATURE_MAPPING.md)** — Which features on mobile vs. website, phase roadmap, go-live checklist

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 18
- npm or yarn
- (Optional) Twilio account for SMS features

### Environment Setup

1. **PostgreSQL** — Start the database service:
   ```bash
   brew services start postgresql@18
   ```

2. **Backend** — Set up and run:
   ```bash
   cd backend
   npm install
   npm run migrate:latest        # Run database migrations
   npm run dev                   # Start server on localhost:3000
   ```

3. **Mobile App** — Set up and run:
   ```bash
   cd TaskRight
   npm install
   npm start                     # Starts Expo dev server
   # Scan QR code with your iOS device or simulator
   ```

4. **Website** — Set up and run:
   ```bash
   cd TaskRight-Website
   npm install
   npm run dev                   # Start Next.js on localhost:3000
   ```

### Running Tests

```bash
cd backend
npm test          # Run all 70 tests against task_app_test DB
```

---

## 📋 Project Structure

```
TaskRight_Project/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── routes/             # API endpoints (auth, businesses, customers)
│   │   ├── services/           # Business logic (businessService, customerService)
│   │   ├── middleware/         # JWT auth, error handling
│   │   ├── jobs/               # Cron jobs (SMS reminders, auto-repeat)
│   │   └── utils/              # JWT, validators, helpers
│   ├── migrations/             # Database schema (9 tables)
│   ├── __tests__/              # Test suite (70 tests)
│   ├── server.js               # Entry point
│   └── package.json
├── TaskRight/                  # React Native iOS app
│   ├── src/
│   │   ├── screens/            # App screens (customer, business, auth)
│   │   ├── navigation/         # React Navigation stack
│   │   ├── context/            # Auth context
│   │   ├── api/                # API client functions
│   │   └── utils/              # Helpers (phone format, etc.)
│   ├── ios/                    # iOS-specific config
│   ├── App.tsx                 # Root component
│   └── package.json
├── TaskRight-Website/          # React/Next.js web app (NEW)
│   ├── src/
│   │   ├── pages/              # Route pages
│   │   ├── components/         # React components
│   │   ├── styles/             # Global styles, Tailwind config
│   │   └── api/                # API client functions
│   ├── public/                 # Static assets
│   ├── next.config.js
│   └── package.json
├── shared/                     # Shared documentation & design system
│   ├── PRODUCT_OVERVIEW.md     # Product info
│   ├── DESIGN_SYSTEM.md        # Visual design tokens
│   ├── API_REFERENCE.md        # Backend API docs
│   └── FEATURE_MAPPING.md      # Feature roadmap
├── .claude/                    # Claude Code settings
│   ├── memory/
│   │   └── MEMORY.md           # Persistent project context
│   └── plans/
│       └── [implementation plans]
├── SPEC.md                     # Technical specification (75KB)
├── HANDOFF.md                  # Handoff checklist
└── README.md                   # This file
```

---

## 🎨 Design System

All projects follow the same visual design language (see [`shared/DESIGN_SYSTEM.md`](./shared/DESIGN_SYSTEM.md)):

- **Colors**: Primary blue `#2563eb`, success green `#10b981`, text `#1a1a1a`
- **Typography**: Native fonts, 11-28px sizing, weights 400-700
- **Components**: Buttons, blue cards, pills/badges, modals, task rows
- **Spacing**: 4-32px padding scale
- **Icons**: Checkmark, person, avoid problematic emoji like 📅

---

## 🔐 Authentication

All projects use **JWT (JSON Web Tokens)** with the same backend:

- **Token payload**: `{ sub, type: 'business'|'customer', businessId, customerId }`
- **Endpoints**: `POST /auth/businesses/signup`, `POST /auth/customers/signup`, etc.
- **Mobile app**: Uses `AuthContext` to store token in device storage
- **Website**: Uses localStorage for token management

See [`shared/API_REFERENCE.md`](./shared/API_REFERENCE.md) for all auth endpoints.

---

## 📊 Database Schema

9-table PostgreSQL 18 database:

1. **businesses** — Service provider accounts
2. **customers** — End users requesting services
3. **tasks** — Individual tasks available per business
4. **service_cycles** — Scheduled service dates with included tasks
5. **customer_cycle_assignments** — Which customers are assigned to each cycle
6. **task_assignments** — Which tasks are included in each cycle
7. **selections** — Customer's submitted task selections
8. **service_completions** — Marking cycles as done
9. **feedback** — Customer ratings & comments post-service

Plus junction tables for team members and team groups.

See `backend/migrations/001_initial_schema.js` for full schema.

---

## 🧪 Testing

Backend includes comprehensive test suite:

```bash
cd backend
npm test                  # Run all 70 tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

Tests cover:
- Authentication (signup, login, errors)
- Tasks (CRUD operations)
- Service cycles (creation, assignment)
- Customer selections (submission, history)
- Feedback
- Forecasting

---

## 📱 Mobile App Build

To build and deploy the iOS app:

```bash
cd TaskRight
npm run build             # Prepare bundle
# Follow Xcode instructions to build and archive
# Or use Expo for OTA updates
```

---

## 🌐 Website Deployment

The website can be deployed to Vercel, Netlify, or any Node.js host:

```bash
cd TaskRight-Website
npm run build             # Create production bundle
npm start                 # Start server (production mode)
```

Or deploy directly:
```bash
vercel deploy             # If using Vercel
netlify deploy            # If using Netlify
```

---

## 📞 API Integration

The website and mobile app both call the same backend API:

- **Base URL (dev)**: `http://localhost:3000/api`
- **Base URL (prod)**: `https://api.taskright.com/api`
- **Auth Header**: `Authorization: Bearer <jwt_token>`

See [`shared/API_REFERENCE.md`](./shared/API_REFERENCE.md) for all available endpoints.

---

## 🛣️ Roadmap

### ✅ Phase 1: MVP (Complete)
- Mobile app (customer + business owner)
- Backend API
- Authentication
- Task selection workflow
- Feedback system

### 🚀 Phase 2: Website (In Progress)
- Landing page with product demo
- Signup flows (business + customer)
- Drive traffic to mobile app

### 📅 Phase 3: Web Dashboard (Future)
- Business owner admin dashboard
- Task management (CRUD)
- Team member roster
- Service cycle creation
- Assignment management
- Feedback aggregation

### 📊 Phase 4: Analytics (Future)
- Usage dashboards
- Retention metrics
- Feature adoption tracking
- A/B testing framework

---

## 🐛 Common Issues

### Database Connection Errors
```bash
brew services restart postgresql@18
# Verify DB is running: psql -c "SELECT 1"
```

### Port Already in Use (3000)
```bash
# Backend
PORT=3001 npm run dev

# Website
npm run dev -- -p 3001
```

### Mobile App Not Connecting to Backend
- Verify backend is running on localhost:3000
- Check `TaskRight/src/api/client.js` for correct API URL
- On iOS simulator, use `10.0.2.2` instead of `localhost` (Android only)

---

## 📝 Documentation

- **`SPEC.md`** — Full technical specification (75KB)
- **`HANDOFF.md`** — Handoff checklist and migration notes
- **`shared/PRODUCT_OVERVIEW.md`** — Product strategy & metrics
- **`shared/DESIGN_SYSTEM.md`** — Visual design reference
- **`shared/API_REFERENCE.md`** — Backend API docs
- **`shared/FEATURE_MAPPING.md`** — Feature roadmap

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and test: `npm test` (backend) / `npm start` (frontend)
3. Commit with clear messages: `git commit -m "feat: add feature description"`
4. Push and create a pull request

---

## 📄 License

[Add your license here]

---

## 👥 Team

- **Product**: [Your name]
- **Engineering**: [Your name]
- **Design**: [Your name]

---

## 📧 Contact & Support

For questions, issues, or feature requests:
- **Email**: support@taskright.com
- **GitHub Issues**: [Link to issues]
- **Slack**: [Link to Slack workspace]

---

**Built with ❤️ for service providers and their customers.**

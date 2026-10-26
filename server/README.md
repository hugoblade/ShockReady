# ShockReady Server

Node.js and Express server scaffold using ES modules.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set the Supabase URL, publishable key,
   secret key, and PostgreSQL connection string.
3. Apply pending database migrations with `npm run db:migrate`, then generate
   the Prisma client with `npm run db:generate`.
4. Start the development server with `npm run dev`, or use `npm start`.
5. Check `http://localhost:3000/api/health`.

The API provides Supabase-backed authentication, organization registration and
approval, staff management, incident review and response assignments, responder
tasks, and resource dispatch tracking. Incident submissions can be made
without an account; reports submitted while signed in are associated with that
account. Run both database commands after each schema migration.

## Project structure

```text
src/
  app.js                 Express app and middleware setup
  server.js              Server startup
  config/                Environment and app configuration
  controllers/           HTTP request handlers
  middleware/            Shared Express middleware
  models/                Data models
  routes/                API route definitions
  services/              Business logic
  utils/                 Shared utilities
```

# ShockReady client

The Vite frontend sends authentication and incident requests to the Express API
at `/api`. During development, Vite proxies these requests to `localhost:3000`.

## Run locally

1. Create `server/.env` from `server/.env.example` and provide the Supabase
   project URL, publishable key, secret key, and PostgreSQL connection string.
   Keep the secret key on the server; never add it to a `VITE_` variable or
   commit it.
2. Run `npm --prefix server run db:migrate` and
   `npm --prefix server run db:generate` to prepare the Prisma database.
3. In one terminal, run `npm --prefix server install` and
   `npm --prefix server run dev`.
4. In another terminal, run `npm --prefix client install` and
   `npm --prefix client run dev`.

Open the Vite URL shown in the terminal. For deployment as a Render web
service, set the root directory to `client`, the build command to
`npm install && npm run build`, and the start command to `npm start`. The start
script serves the built frontend on Render's `PORT`.

For Vercel, import the repository with the repository root as the project root.
The root `vercel.json` installs the locked frontend dependencies from `client`,
builds the Vite app, publishes `client/dist`, and routes page requests to the
single-page app entry point. Set `VITE_API_URL` in the Vercel project to the
deployed API base URL ending in `/api`; the default `/api` is suitable only when
the API is served from the same origin.

Deploy the Express API separately from the `server` directory with
`npm start`. The API does not serve the frontend build.
If the frontend and API are hosted on different origins, set the frontend build
variable `VITE_API_URL` to the API base ending in `/api`, and configure
`CORS_ORIGINS` on the server with the exact frontend origin.

The API-backed flows include account sign-up/sign-in, organization registration
and approval, staff management, incident review and response assignments,
responder tasks, resource dispatches, personal incident history, and verified
public map alerts. The volunteer registry remains demo-only because there is no
volunteer model or API in the server.

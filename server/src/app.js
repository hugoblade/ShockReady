import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';

const app = express();

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: "1mb" }));

// Keep the existing API routes.
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
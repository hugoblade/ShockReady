import 'dotenv/config';
import app from './app.js';
import config from './config/index.js';

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port} (${config.nodeEnv})`);
});

const shutdown = (signal) => {
  console.log(`${signal} received; closing server`);
  server.close((error) => {
    if (error) {
      console.error('Error while closing server:', error);
      process.exitCode = 1;
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

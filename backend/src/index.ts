import type {} from './express.d.ts';
import 'dotenv/config';
import express from 'express';
import path from 'path';

import { connectDB } from './utils/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import router from './routes';
import logger from './utils/logger.util';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.use('/api', router);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('*', notFoundHandler);
app.use(errorHandler);

connectDB().catch((error: unknown) => {
  console.error('Failed to connect to database:', error);
  throw error;
});
app.listen(PORT, () => {
  // PORT is from environment variable, not user input
  logger.info(`🚀 Server running on port ${PORT}`);
});

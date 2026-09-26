import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './prisma/client.js';

const startServer = async () => {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database via Prisma');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 StockSense server running on http://localhost:${env.PORT}`);
      console.log(`📊 Environment: ${env.NODE_ENV}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Database disconnected. Process terminated.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();

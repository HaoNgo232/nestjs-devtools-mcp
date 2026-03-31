import { INestApplicationContext } from '@nestjs/common';
import { CustomLoggerService } from './custom-logger.service';

/**
 * Utility helper to activate DevTools Logger in the NestJS application.
 * Reduces user friction from 3 lines of manual wiring down to a single line.
 * 
 * @param app instance of INestApplication or INestApplicationContext that has been initialized.
 */
export function applyDevtoolsLogger(app: INestApplicationContext): void {
  try {
    const logger = app.get(CustomLoggerService);
    app.useLogger(logger);
  } catch (error) {
    // Do not throw error to ensure the NestJS app continues running if DevtoolsMcpModule is not imported
    console.error('[DevtoolsMcp] Unable to activate Logger automatically. Ensure DevtoolsMcpModule is registered in your AppModule.', error);
  }
}

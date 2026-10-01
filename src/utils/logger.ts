import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      '*.password', '*.token', '*.secret', '*.authorization', '*.cookie', '*.apiToken',
      'password', 'token', 'secret', 'authorization', 'cookie', 'BOT_TOKEN', 'XUI_PASSWORD', 'XUI_API_TOKEN',
      'req.headers.authorization', 'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

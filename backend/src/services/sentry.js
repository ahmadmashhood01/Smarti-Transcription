const Sentry = require('@sentry/node');

/**
 * Initialize Sentry for error tracking
 */
function initializeSentry(app) {
  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn) {
    console.log('ℹ️  Sentry DSN not configured, skipping error tracking');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1, // 10% of requests for performance monitoring
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
      ],
    });

    // Sentry request handler must be the first middleware
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());

    console.log('✅ Sentry error tracking initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Sentry:', error.message);
  }
}

/**
 * Capture exception with Sentry
 */
function captureException(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
  console.error('Exception:', error, context);
}

module.exports = {
  initializeSentry,
  captureException,
  Sentry,
};


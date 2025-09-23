const promClient = require('prom-client');

function createMetrics(serviceName) {
  // Create a Registry
  const register = new promClient.Registry();

  // Enable default metrics collection
  promClient.collectDefaultMetrics({
    register,
    prefix: 'nodejs_'
  });

  // HTTP request duration histogram
  const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code', 'service'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5]
  });

  // HTTP request counter
  const httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'service']
  });

  // HTTP request duration gauge (current response time)
  const httpRequestDurationGauge = new promClient.Gauge({
    name: 'http_request_duration_current_seconds',
    help: 'Current HTTP request duration in seconds',
    labelNames: ['method', 'route', 'service']
  });

  // Service-specific metrics
  const serviceOperationsTotal = new promClient.Counter({
    name: `${serviceName}_operations_total`,
    help: `Total number of ${serviceName} operations`,
    labelNames: ['operation', 'status']
  });

  const serviceOperationDuration = new promClient.Histogram({
    name: `${serviceName}_operation_duration_seconds`,
    help: `Duration of ${serviceName} operations`,
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5]
  });

  // Register metrics
  register.registerMetric(httpRequestDuration);
  register.registerMetric(httpRequestsTotal);
  register.registerMetric(httpRequestDurationGauge);
  register.registerMetric(serviceOperationsTotal);
  register.registerMetric(serviceOperationDuration);

  // Middleware function
  const metricsMiddleware = (req, res, next) => {
    const start = Date.now();

    // Override res.end to capture metrics when response is sent
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      const route = req.route ? req.route.path : req.path;
      const method = req.method;
      const statusCode = res.statusCode.toString();

      // Record metrics
      httpRequestDuration.observe(
        { method, route, status_code: statusCode, service: serviceName },
        duration
      );

      httpRequestsTotal.inc({
        method,
        route,
        status_code: statusCode,
        service: serviceName
      });

      httpRequestDurationGauge.set(
        { method, route, service: serviceName },
        duration
      );

      // Call original end method
      originalEnd.apply(this, args);
    };

    next();
  };

  // Helper functions for business metrics
  const recordOperation = (operation, success, duration = null) => {
    serviceOperationsTotal.inc({
      operation,
      status: success ? 'success' : 'failure'
    });

    if (duration !== null) {
      serviceOperationDuration.observe({ operation }, duration);
    }
  };

  return {
    register,
    metricsMiddleware,
    recordOperation
  };
}

module.exports = { createMetrics };
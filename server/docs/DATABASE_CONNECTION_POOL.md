# Database Connection Pool Configuration Guide

## Overview

This document provides guidance on configuring database connection pools for the Medical Bible application. Proper connection pool configuration is critical for preventing connection exhaustion under load and ensuring optimal database performance.

## Configuration Options

### Environment Variables

| Variable | Description | Default | Recommended Range |
|----------|-------------|---------|-------------------|
| `DB_POOL_MAX` | Maximum number of connections in the pool | 20 | 10-100 |
| `DB_POOL_MIN` | Minimum number of connections to maintain | 5 | 2-10 |
| `DB_POOL_ACQUIRE_TIMEOUT` | Maximum time to wait for a connection (ms) | 30000 | 10000-60000 |
| `DB_POOL_IDLE_TIMEOUT` | Idle connection timeout before closing (ms) | 300000 | 180000-600000 |
| `DB_POOL_MAX_LIFETIME` | Maximum connection lifetime before closing (ms) | 1800000 | 900000-3600000 |
| `DB_CONNECTION_TIMEOUT` | Connection establishment timeout (ms) | 60000 | 30000-120000 |
| `DB_QUERY_TIMEOUT` | Query execution timeout (ms) | 60000 | 30000-120000 |

## Pool Sizing Guidelines

### Basic Formula

A common starting point for connection pool size is:

```
pool_size = (CPU_cores × 2) + effective_spindle_count
```

For modern applications with solid-state drives:

```
pool_size = CPU_cores × 2
```

### Application-Specific Considerations

#### Small Applications (< 100 concurrent users)
- **DB_POOL_MAX**: 10-20
- **DB_POOL_MIN**: 2-5
- **Use case**: Development environments, small production deployments

#### Medium Applications (100-1000 concurrent users)
- **DB_POOL_MAX**: 20-50
- **DB_POOL_MIN**: 5-10
- **Use case**: Growing production applications

#### Large Applications (> 1000 concurrent users)
- **DB_POOL_MAX**: 50-100
- **DB_POOL_MIN**: 10-20
- **Use case**: High-traffic production systems

## Load Testing Recommendations

### Test Scenarios

1. **Baseline Test**
   - Start with default settings
   - Measure response times at various concurrency levels
   - Identify the point of degradation

2. **Pool Size Test**
   - Test with `DB_POOL_MAX` values: 10, 20, 40, 60, 80
   - Monitor: connection wait times, query throughput, error rates
   - Find the optimal point where increasing pool size no longer improves performance

3. **Stress Test**
   - Gradually increase load beyond expected peak
   - Verify connection pool doesn't exhaust
   - Check for connection leaks

### Key Metrics to Monitor

1. **Pool Utilization**
   - Target: 70-80% during peak load
   - Alert if: >90% sustained for more than 1 minute

2. **Connection Wait Time**
   - Target: <100ms
   - Alert if: >500ms consistently

3. **Query Response Time**
   - Target: P95 <200ms for typical queries
   - Alert if: P95 >1000ms

4. **Error Rate**
   - Target: <0.1%
   - Alert if: Connection timeout errors increase

## Common Pitfalls

### 1. Oversizing the Pool

**Problem**: Setting `DB_POOL_MAX` too high can cause:
- Increased memory usage on both application and database servers
- Context switching overhead
- Database contention

**Solution**: Start with conservative values and increase only when metrics show benefit.

### 2. Undersizing the Pool

**Problem**: Setting `DB_POOL_MAX` too low can cause:
- Connection wait times during load spikes
- Request timeouts
- Poor user experience

**Solution**: Monitor pool utilization and increase before it becomes a bottleneck.

### 3. Not Setting Timeout Values

**Problem**: Without proper timeouts:
- Failed connections can hang indefinitely
- Application resources can be exhausted
- Cascading failures can occur

**Solution**: Always configure `DB_POOL_ACQUIRE_TIMEOUT`, `DB_CONNECTION_TIMEOUT`, and `DB_QUERY_TIMEOUT`.

## MySQL-Specific Considerations

### MySQL Connection Limits

MySQL has a `max_connections` setting (default: 151). Ensure:

```
sum_of_all_application_pools < MySQL_max_connections × 0.8
```

Leave 20% buffer for administrative connections and other clients.

### Connection Persistence

MySQL connections are relatively expensive to establish. The pool settings:
- `enableKeepAlive: true` - Maintains connection health
- `keepAliveInitialDelay: 0` - Starts keepalive immediately
- These help avoid connection drops during idle periods

## Example Configurations

### Development Environment

```bash
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_POOL_ACQUIRE_TIMEOUT=10000
DB_POOL_IDLE_TIMEOUT=300000
DB_POOL_MAX_LIFETIME=1800000
DB_CONNECTION_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
```

### Production Environment (Medium Traffic)

```bash
DB_POOL_MAX=30
DB_POOL_MIN=5
DB_POOL_ACQUIRE_TIMEOUT=30000
DB_POOL_IDLE_TIMEOUT=300000
DB_POOL_MAX_LIFETIME=1800000
DB_CONNECTION_TIMEOUT=60000
DB_QUERY_TIMEOUT=60000
```

### Production Environment (High Traffic)

```bash
DB_POOL_MAX=60
DB_POOL_MIN=10
DB_POOL_ACQUIRE_TIMEOUT=30000
DB_POOL_IDLE_TIMEOUT=300000
DB_POOL_MAX_LIFETIME=1800000
DB_CONNECTION_TIMEOUT=60000
DB_QUERY_TIMEOUT=60000
```

## Monitoring

### Available Endpoints

The application provides monitoring endpoints at:

- `GET /admin/database/pool/status` - Current pool status
- `GET /admin/database/pool/config` - Pool configuration
- `GET /admin/database/pool/health-check` - Manual health check
- `GET /admin/database/pool/alerts` - Alert history

### Alert Thresholds

- **WARNING**: Pool utilization >70%
- **CRITICAL**: Pool utilization >90%

Alerts are logged automatically every minute via scheduled health checks.

## Troubleshooting

### Symptom: High pool utilization but slow queries

**Cause**: Queries may be holding connections too long

**Solutions**:
1. Optimize slow queries (check `/admin/database/slow-query/status`)
2. Add database indexes where needed
3. Consider increasing query timeout
4. Add more database resources

### Symptom: Connection timeout errors

**Cause**: Pool exhausted or database unresponsive

**Solutions**:
1. Check database server health
2. Increase `DB_POOL_MAX` if under load
3. Increase `DB_POOL_ACQUIRE_TIMEOUT`
4. Check for connection leaks in application code

### Symptom: Intermittent connection errors

**Cause**: Network issues or connection drops

**Solutions**:
1. Verify network connectivity
2. Check firewall settings
3. Review MySQL `wait_timeout` and `interactive_timeout` settings
4. Ensure keepalive is enabled

## References

- [TypeORM Connection Options](https://typeorm.io/data-source-options)
- [MySQL Connection Handling](https://dev.mysql.com/doc/refman/8.0/en/connection-handling.html)
- [HikariCP Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)

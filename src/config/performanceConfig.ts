/**
 * Performance Configuration
 * 
 * Feature flags for performance optimizations.
 * These can be toggled to enable/disable optimizations or rollback if needed.
 */

export const PerformanceConfig = {
  /**
   * USE_OPTIMIZED_DASHBOARD_LOADING
   * 
   * When enabled: Dashboard loads only recent completions instead of all data
   * Benefits: 60-70% faster initial load time
   * Rollback: Set to false to use original loading method
   * 
   * Default: true
   */
  USE_OPTIMIZED_DASHBOARD_LOADING: true,

  /**
   * DASHBOARD_DATA_RANGE_DAYS
   * 
   * Number of days of historical data to load for dashboard
   * Lower = faster queries, but less data for streak calculation
   * Higher = more complete data, but slower queries
   * 
   * Recommendations:
   * - 30 days: Fast, good for most users (streaks up to 30 days)
   * - 60 days: Balanced (default, streaks up to 60 days)
   * - 90 days: Slower, for users with long streaks
   * 
   * Default: 30
   */
  DASHBOARD_DATA_RANGE_DAYS: 30,

  /**
   * ENABLE_QUERY_CACHE
   * 
   * When enabled: Caches dashboard data for a short time to prevent redundant queries
   * Benefits: Eliminates duplicate queries during React re-renders
   * 
   * Default: true
   */
  ENABLE_QUERY_CACHE: true,

  /**
   * QUERY_CACHE_TTL_MS
   * 
   * How long to cache dashboard data (in milliseconds)
   * Lower = more frequent queries, always fresh data
   * Higher = fewer queries, but data may be stale
   * 
   * Default: 5000 (5 seconds)
   */
  QUERY_CACHE_TTL_MS: 5000,
};

/**
 * Health Check Service
 * Comprehensive system health monitoring
 */

import { supabase } from '../config/supabase';
import { redis } from '../config/redis';
import logger from '../config/logger';
import axios from 'axios';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
    vxtwitter: ServiceHealth;
  };
  system: SystemHealth;
  alerts: string[];
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  details?: any;
  error?: string;
}

interface SystemHealth {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
    nearLimit: boolean;
  };
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now();
  const alerts: string[] = [];

  // Check all services in parallel
  const [dbHealth, redisHealth, storageHealth, vxTwitterHealth, systemHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
    checkVxTwitterAPI(),
    checkSystem(),
  ]);

  // Determine overall status
  const services = {
    database: dbHealth,
    redis: redisHealth,
    storage: storageHealth,
    vxtwitter: vxTwitterHealth,
  };

  // Check for degraded or down services
  Object.entries(services).forEach(([name, health]) => {
    if (health.status === 'down') {
      alerts.push(`${name.toUpperCase()} is DOWN`);
    } else if (health.status === 'degraded') {
      alerts.push(`${name.toUpperCase()} is DEGRADED`);
    }
  });

  // Check storage limits
  if (systemHealth.storage.nearLimit) {
    alerts.push(`Storage is near limit (${systemHealth.storage.percentage.toFixed(1)}%)`);
  }

  // Check memory usage
  if (systemHealth.memory.percentage > 90) {
    alerts.push(`Memory usage is high (${systemHealth.memory.percentage.toFixed(1)}%)`);
  }

  // Determine overall status
  const hasDown = Object.values(services).some((s) => s.status === 'down');
  const hasDegraded = Object.values(services).some((s) => s.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasDown) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded || alerts.length > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
    system: systemHealth,
    alerts,
  };

  const duration = Date.now() - startTime;
  logger.info({ duration, status: overallStatus, alerts }, 'Health check completed');

  return healthStatus;
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const { error } = await supabase.from('users').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      return {
        status: 'down',
        error: error.message,
      };
    }

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime > 1000 ? 'degraded' : 'up',
      responseTime,
      details: {
        message: 'Database connection successful',
      },
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    await redis.ping();
    const responseTime = Date.now() - startTime;

    return {
      status: responseTime > 500 ? 'degraded' : 'up',
      responseTime,
      details: {
        message: 'Redis connection successful',
      },
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Supabase Storage space and accessibility
 */
async function checkStorage(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // Try to list files in storage bucket
    const { error } = await supabase.storage.from('twitter-videos').list('', { limit: 1 });

    if (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }

    const responseTime = Date.now() - startTime;

    // Get storage usage
    const storageInfo = await getStorageUsage();

    return {
      status: responseTime > 2000 ? 'degraded' : 'up',
      responseTime,
      details: {
        message: 'Storage accessible',
        usage: storageInfo,
      },
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check VxTwitter API accessibility
 */
async function checkVxTwitterAPI(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // Test with a known tweet
    const response = await axios.get('https://api.vxtwitter.com/Twitter/status/20', {
      timeout: 5000,
      validateStatus: (status) => status < 500, // Accept 4xx as API is up
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 429) {
      return {
        status: 'degraded',
        responseTime,
        details: {
          message: 'VxTwitter API rate limited',
          statusCode: 429,
        },
      };
    }

    return {
      status: responseTime > 3000 ? 'degraded' : 'up',
      responseTime,
      details: {
        message: 'VxTwitter API accessible',
        statusCode: response.status,
      },
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          status: 'degraded',
          error: 'API timeout',
        };
      }
    }

    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check system resources
 */
async function checkSystem(): Promise<SystemHealth> {
  const used = process.memoryUsage();
  const totalMemory = used.heapTotal;
  const usedMemory = used.heapUsed;

  // Get storage info
  const storage = await getStorageUsage();

  return {
    uptime: process.uptime(),
    memory: {
      used: usedMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100,
    },
    storage: {
      used: storage.used,
      limit: storage.limit,
      percentage: storage.percentage,
      nearLimit: storage.percentage > 80,
    },
  };
}

/**
 * Get storage usage from Supabase
 */
async function getStorageUsage(): Promise<{
  used: number;
  limit: number;
  percentage: number;
}> {
  try {
    // Count total files and estimate size
    const { data, error } = await supabase
      .from('twitter_downloads')
      .select('video_size_bytes')
      .not('video_size_bytes', 'is', null);

    if (error) {
      logger.warn({ error }, 'Failed to get storage usage');
      return { used: 0, limit: 1073741824, percentage: 0 }; // 1GB default
    }

    const totalSize = (data || []).reduce((sum, item) => sum + (item.video_size_bytes || 0), 0);

    // Supabase free tier: 1GB
    // Supabase pro tier: 100GB
    const storageLimit = 1073741824; // 1GB in bytes (adjust based on your plan)

    return {
      used: totalSize,
      limit: storageLimit,
      percentage: (totalSize / storageLimit) * 100,
    };
  } catch (error) {
    logger.error({ error }, 'Error calculating storage usage');
    return { used: 0, limit: 1073741824, percentage: 0 };
  }
}

/**
 * Quick ping health check
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    await Promise.all([redis.ping(), supabase.from('users').select('id').limit(1)]);
    return true;
  } catch (error) {
    logger.error({ error }, 'Quick health check failed');
    return false;
  }
}

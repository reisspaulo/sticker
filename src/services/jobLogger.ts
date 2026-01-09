import { supabase } from '../config/supabase';
import logger from '../config/logger';

export type JobName = 'reset-daily-counters' | 'send-pending-stickers';
export type JobStatus = 'started' | 'completed' | 'failed';

interface JobLogEntry {
  id: string;
  job_name: string;
  status: JobStatus;
  result: Record<string, unknown>;
  error_message: string | null;
  error_stack: string | null;
  duration_ms: number | null;
  worker_id: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Get worker ID from environment
 */
function getWorkerId(): string {
  return process.env.HOSTNAME || process.env.CONTAINER_ID || 'unknown';
}

/**
 * Log job start to database
 * Returns the log entry ID for updating later
 */
export async function logJobStart(jobName: JobName): Promise<string | null> {
  const workerId = getWorkerId();

  try {
    const { data, error } = await supabase
      .from('job_logs')
      .insert({
        job_name: jobName,
        status: 'started',
        worker_id: workerId,
        result: {},
      })
      .select('id')
      .single();

    if (error) {
      logger.error({
        msg: '[JOB-LOGGER] Failed to log job start',
        jobName,
        error: error.message,
      });
      return null;
    }

    logger.info({
      msg: '[JOB-LOGGER] Job started',
      jobName,
      logId: data.id,
      workerId,
    });

    return data.id;
  } catch (err) {
    logger.error({
      msg: '[JOB-LOGGER] Exception logging job start',
      jobName,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Log job completion to database
 */
export async function logJobComplete(
  logId: string | null,
  jobName: JobName,
  result: Record<string, unknown>,
  durationMs: number
): Promise<void> {
  if (!logId) {
    logger.warn({
      msg: '[JOB-LOGGER] No log ID to update for job completion',
      jobName,
      result,
      durationMs,
    });
    return;
  }

  try {
    const { error } = await supabase
      .from('job_logs')
      .update({
        status: 'completed',
        result,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (error) {
      logger.error({
        msg: '[JOB-LOGGER] Failed to log job completion',
        jobName,
        logId,
        error: error.message,
      });
      return;
    }

    logger.info({
      msg: '[JOB-LOGGER] Job completed',
      jobName,
      logId,
      result,
      durationMs,
    });
  } catch (err) {
    logger.error({
      msg: '[JOB-LOGGER] Exception logging job completion',
      jobName,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Log job failure to database
 */
export async function logJobFailed(
  logId: string | null,
  jobName: JobName,
  error: Error | unknown,
  durationMs: number
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  if (!logId) {
    // If we don't have a log ID, create a new entry for the failure
    try {
      await supabase.from('job_logs').insert({
        job_name: jobName,
        status: 'failed',
        error_message: errorMessage,
        error_stack: errorStack,
        duration_ms: durationMs,
        worker_id: getWorkerId(),
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({
        msg: '[JOB-LOGGER] Failed to create failure log entry',
        jobName,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    return;
  }

  try {
    const { error: updateError } = await supabase
      .from('job_logs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        error_stack: errorStack,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (updateError) {
      logger.error({
        msg: '[JOB-LOGGER] Failed to log job failure',
        jobName,
        logId,
        error: updateError.message,
      });
      return;
    }

    logger.info({
      msg: '[JOB-LOGGER] Job failure logged',
      jobName,
      logId,
      errorMessage,
      durationMs,
    });
  } catch (err) {
    logger.error({
      msg: '[JOB-LOGGER] Exception logging job failure',
      jobName,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Get recent job logs for a specific job
 */
export async function getRecentJobLogs(
  jobName: JobName,
  limit: number = 10
): Promise<JobLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('job_logs')
      .select('*')
      .eq('job_name', jobName)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error({
        msg: '[JOB-LOGGER] Failed to get recent job logs',
        jobName,
        error: error.message,
      });
      return [];
    }

    return data || [];
  } catch (err) {
    logger.error({
      msg: '[JOB-LOGGER] Exception getting recent job logs',
      jobName,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Get last successful run of a job
 */
export async function getLastSuccessfulRun(
  jobName: JobName
): Promise<JobLogEntry | null> {
  try {
    const { data, error } = await supabase
      .from('job_logs')
      .select('*')
      .eq('job_name', jobName)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      logger.error({
        msg: '[JOB-LOGGER] Failed to get last successful run',
        jobName,
        error: error.message,
      });
      return null;
    }

    return data;
  } catch (err) {
    logger.error({
      msg: '[JOB-LOGGER] Exception getting last successful run',
      jobName,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return null;
  }
}

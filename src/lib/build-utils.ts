/**
 * Utility functions to optimize the build process
 */

/**
 * Splits an array into chunks of specified size for better memory management
 * and parallel processing.
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) throw new Error('Chunk size must be positive');

  const result: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

/**
 * Processes an array of items in batches with progress reporting
 * Good for optimizing large static site generation
 */
export async function processBatches<T, U>(
  items: T[],
  processor: (item: T) => Promise<U>,
  {
    batchSize = 5,
    label = 'items',
    reportInterval = 10,
  }: {
    batchSize?: number;
    label?: string;
    reportInterval?: number;
  } = {}
): Promise<U[]> {
  const startTime = Date.now();
  const results: U[] = [];
  let completed = 0;
  const total = items.length;

  // Process in batches
  const batches = chunkArray(items, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    // Process batch items in parallel
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await processor(item);
          completed++;

          // Report progress at intervals
          if (completed % reportInterval === 0 || completed === total) {
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const itemsPerSecond = completed / elapsedSeconds;
            const estimatedTotalSeconds = total / itemsPerSecond;
            const remainingSeconds = estimatedTotalSeconds - elapsedSeconds;

            console.log(
              `Progress: ${completed}/${total} ${label} processed ` +
                `(${((completed / total) * 100).toFixed(1)}%, ` +
                `${itemsPerSecond.toFixed(1)} items/sec, ` +
                `est. ${formatTime(remainingSeconds)} remaining)`
            );
          }

          return result;
        } catch (error) {
          console.error(`Error processing item:`, error);
          throw error;
        }
      })
    );

    results.push(...batchResults);

    // Log batch completion
    console.log(
      `Completed batch ${i + 1}/${batches.length}, processed ${
        results.length
      } items`
    );

    // Force garbage collection if exposed
    try {
      // @ts-ignore: Access to global gc function when available
      if (typeof global.gc === 'function') {
        console.log('Running manual garbage collection...');
        // @ts-ignore: Call gc when available
        global.gc();
      }
    } catch (e) {
      // Ignore if gc is not available
    }
  }

  return results;
}

/**
 * Format seconds as "Xh Ym Zs"
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Monitor system resources during build
 * Call this function at the start of static path generation
 */
export function monitorBuildProcess(intervalMs = 30000): () => void {
  console.log('Starting build process monitor...');

  // Get initial timestamp
  const startTime = Date.now();
  let lastReportTime = startTime;
  let pagesGenerated = 0;

  // Create monitor interval
  const intervalId = setInterval(() => {
    // Calculate memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryRss = Math.round(memoryUsage.rss / 1024 / 1024);

    // Calculate elapsed time
    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = (elapsedMs / 60000).toFixed(1);

    // Get rate of page generation
    const timeSinceLastReport = Date.now() - lastReportTime;
    const pagesPerMinute = (pagesGenerated / (elapsedMs / 60000)).toFixed(1);

    console.log(`=== BUILD MONITOR REPORT ===`);
    console.log(`⏱️ Elapsed time: ${elapsedMinutes} minutes`);
    console.log(
      `🧠 Memory usage: ${memoryUsedMB}MB / ${memoryTotalMB}MB (Heap), ${memoryRss}MB (RSS)`
    );
    console.log(`📊 Generation rate: ${pagesPerMinute} pages/minute`);
    console.log(`===========================`);

    // Try to trigger garbage collection
    try {
      if (typeof global.gc === 'function') {
        global.gc();

        // Report memory after GC
        const afterGC = process.memoryUsage();
        const afterGCUsedMB = Math.round(afterGC.heapUsed / 1024 / 1024);
        console.log(
          `🧹 After GC: ${afterGCUsedMB}MB heap used (${
            memoryUsedMB - afterGCUsedMB
          }MB freed)`
        );
      }
    } catch (e) {
      // Ignore if GC is not available
    }

    // Reset for next interval
    lastReportTime = Date.now();
  }, intervalMs);

  // Return a function to track pages and stop monitoring
  return function stopMonitoring() {
    clearInterval(intervalId);

    // Final report
    const totalElapsedMs = Date.now() - startTime;
    const totalElapsedMinutes = (totalElapsedMs / 60000).toFixed(1);

    console.log(`=== BUILD MONITOR FINAL REPORT ===`);
    console.log(`⏱️ Total build time: ${totalElapsedMinutes} minutes`);
    console.log(`===========================`);
  };
}

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

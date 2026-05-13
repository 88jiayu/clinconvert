/**
 * Worker Pool ── 並行控制多個 Web Worker。
 *
 * 用途：「上傳幾百個檔」場景下，4-8 個 worker 並行處理，主執行緒順暢、整體速度 ×N。
 *
 * 使用方式：
 *   const pool = createWorkerPool(4);
 *   pool.onProgress((msg) => updateUI(msg));
 *   pool.onJobComplete((msg) => handleResult(msg));
 *   pool.onAllDone(() => showFinished());
 *   pool.submit(jobs);
 *   pool.cancel(); // 中途取消
 */
import type {
  ConvertJob,
  WorkerMessage,
  ConvertProgress,
  ConvertSuccess,
  ConvertError,
} from '../workers/converter.worker';
import type { MappingTemplate } from './mapping/templates';

export interface PoolJob {
  jobId: string;
  fileName: string;
  buffer: ArrayBuffer;
  isJson: boolean;
  customTemplates?: MappingTemplate[];
}

export interface WorkerPool {
  submit(jobs: PoolJob[]): void;
  cancel(): void;
  onProgress(cb: (msg: ConvertProgress) => void): void;
  onJobComplete(cb: (msg: ConvertSuccess | ConvertError) => void): void;
  onAllDone(cb: () => void): void;
  terminate(): void;
  readonly stats: { queued: number; active: number; done: number; failed: number };
}

interface WorkerSlot {
  worker: Worker;
  currentJobId: string | null;
}

export function createWorkerPool(size: number = 4): WorkerPool {
  const slots: WorkerSlot[] = [];
  const queue: PoolJob[] = [];
  let cancelled = false;

  const stats = { queued: 0, active: 0, done: 0, failed: 0 };

  const progressCbs: ((msg: ConvertProgress) => void)[] = [];
  const completeCbs: ((msg: ConvertSuccess | ConvertError) => void)[] = [];
  const allDoneCbs: (() => void)[] = [];

  function makeWorker(slotIndex: number): WorkerSlot {
    const worker = new Worker(new URL('../workers/converter.worker.ts', import.meta.url), {
      type: 'module',
    });
    const slot: WorkerSlot = { worker, currentJobId: null };

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        progressCbs.forEach((cb) => cb(msg));
      } else if (msg.type === 'success' || msg.type === 'error') {
        if (msg.type === 'success') stats.done += 1;
        else stats.failed += 1;
        stats.active -= 1;
        slot.currentJobId = null;
        completeCbs.forEach((cb) => cb(msg));
        pickNext(slot);
      }
    };

    worker.onerror = (err) => {
      console.error('Worker error', err);
      if (slot.currentJobId) {
        stats.failed += 1;
        stats.active -= 1;
        completeCbs.forEach((cb) =>
          cb({
            type: 'error',
            jobId: slot.currentJobId!,
            fileName: '<worker crash>',
            message: err.message ?? 'Worker crashed',
          } as ConvertError)
        );
        slot.currentJobId = null;
        pickNext(slot);
      }
    };

    return slot;
  }

  function pickNext(slot: WorkerSlot) {
    if (cancelled) return checkAllDone();
    const job = queue.shift();
    if (!job) return checkAllDone();
    stats.queued -= 1;
    stats.active += 1;
    slot.currentJobId = job.jobId;
    const message: ConvertJob = {
      type: 'convert',
      jobId: job.jobId,
      fileName: job.fileName,
      buffer: job.buffer,
      isJson: job.isJson,
      customTemplates: job.customTemplates,
    };
    // Transfer buffer ownership to worker for zero-copy
    slot.worker.postMessage(message, [job.buffer]);
  }

  function checkAllDone() {
    if (stats.queued === 0 && stats.active === 0) {
      allDoneCbs.forEach((cb) => cb());
    }
  }

  // 預先建 worker，加速第一批
  for (let i = 0; i < size; i++) {
    slots.push(makeWorker(i));
  }

  return {
    submit(jobs: PoolJob[]) {
      cancelled = false;
      queue.push(...jobs);
      stats.queued += jobs.length;
      // Wake up all idle slots
      for (const slot of slots) {
        if (slot.currentJobId === null) {
          pickNext(slot);
        }
      }
    },
    cancel() {
      cancelled = true;
      stats.queued = 0;
      queue.length = 0;
      // 正在跑的 worker terminate + 重建
      slots.forEach((slot, i) => {
        if (slot.currentJobId !== null) {
          slot.worker.terminate();
          slots[i] = makeWorker(i);
        }
      });
      stats.active = 0;
      checkAllDone();
    },
    onProgress(cb) {
      progressCbs.push(cb);
    },
    onJobComplete(cb) {
      completeCbs.push(cb);
    },
    onAllDone(cb) {
      allDoneCbs.push(cb);
    },
    terminate() {
      slots.forEach((s) => s.worker.terminate());
      slots.length = 0;
    },
    get stats() {
      return { ...stats };
    },
  };
}

/**
 * 偵測最佳並行度（CPU 核心數）
 */
export function recommendedPoolSize(): number {
  const cores = navigator.hardwareConcurrency || 4;
  // 避免吃光所有 CPU；diminishing returns 通常在 4-8
  return Math.max(2, Math.min(8, Math.floor(cores * 0.75)));
}

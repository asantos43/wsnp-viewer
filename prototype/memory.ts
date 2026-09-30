import { app } from 'electron'

/** Memory of every process of the app (main, renderers, GPU), in MB. */
export const appMemoryMb = (): number => app.getAppMetrics().reduce((sum, p) => sum + p.memory.workingSetSize, 0) / 1024

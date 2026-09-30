import type { Experiment } from '../harness.ts'
import { capture } from './capture.ts'
import { convert } from './convert.ts'
import { iframe } from './iframe.ts'
import { isolation } from './isolation.ts'
import { large } from './large.ts'
import { metrics } from './metrics.ts'
import { pdf } from './pdf.ts'

/** The phase 0 experiments, by name, in the order they run. */
export const EXPERIMENTS: Record<string, Experiment> = { isolation, large, capture, pdf, convert, metrics, iframe }

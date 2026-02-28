// src/components/session/index.ts
import type { SessionPhase } from '../../types/session'
import { RespondingPhase } from './RespondingPhase'
import { ThinkingPhase } from './ThinkingPhase'
import { FeedbackPhase } from './FeedbackPhase'
import { MarkingPhase } from './MarkingPhase'
import { ExplainingPhase } from './ExplainingPhase'
import { DrillingPhase } from './DrillingPhase'
import { QualityPhase } from './QualityPhase'
import { ClosedPhase } from './ClosedPhase'

export const PHASE_COMPONENTS: Partial<Record<SessionPhase, React.ComponentType<any>>> = {
  responding: RespondingPhase,
  thinking: ThinkingPhase,
  feedback: FeedbackPhase,
  marking: MarkingPhase,
  explaining: ExplainingPhase,
  drilling: DrillingPhase,
  quality: QualityPhase,
  closed: ClosedPhase,
}

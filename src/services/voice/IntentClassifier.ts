import { IntentType, IntentClassification } from './types';

/**
 * Minimal rules-based intent classifier.
 * Extensible to AI/hybrid later.
 */
export class IntentClassifier {
  private patterns: Record<IntentType, string[]> = {
    CREATE_TASK: ['remind me to', 'remind me', 'add task', 'todo', 'create task', 'note to'],
    CREATE_EVENT: ['schedule', 'meeting', 'appointment', 'event at', 'book'],
    CREATE_ITEM: ['add to list', 'add item', 'put', 'add item to'],
    CREATE_JOURNAL: ['journal', 'write in my journal', "i'm feeling", 'note to self'],
    CREATE_ROUTINE: ['every day', 'daily', 'every week', 'every monday', 'routine'],
    CREATE_PINNED_EVENT: ['pin', 'pinned event', 'pin event'],
    CREATE_MILESTONE: ['milestone', 'milestones'],
    CREATE_RESOLUTION: ['resolution', 'i will', 'my goal'],
    UPDATE: ['update', 'change', 'edit'],
    DELETE: ['delete', 'remove', 'cancel'],
    QUERY: ['what', 'when', 'show', 'list'],
    UNKNOWN: []
  };

  async classify(transcript: string): Promise<IntentClassification> {
    const text = transcript.toLowerCase();

    // Check each intent for matching triggers
    const scores: Array<{ intent: IntentType; score: number }> = [];
    for (const intent of Object.keys(this.patterns) as IntentType[]) {
      const triggers = this.patterns[intent] || [];
      let score = 0;
      for (const t of triggers) {
        if (text.includes(t)) score += 1;
      }
      scores.push({ intent, score });
    }

    // Choose best scoring intent
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    if (!best || best.score === 0) {
      return { type: 'UNKNOWN', confidence: 0.3, method: 'RULES' };
    }

    // Confidence: normalize by number of triggers for that intent
    const triggerCount = this.patterns[best.intent].length || 1;
    const confidence = Math.min(0.9, best.score / triggerCount + 0.2);

    return { type: best.intent, confidence, method: 'RULES' };
  }
}

export default IntentClassifier;

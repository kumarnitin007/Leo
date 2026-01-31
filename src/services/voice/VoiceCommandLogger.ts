import { getSupabaseClient, getCurrentUser } from '../../lib/supabase';
import { ParsedCommand } from './types';

export class VoiceCommandLogger {
  private client = getSupabaseClient();

  async logCommand(cmd: ParsedCommand, outcome: string = 'PENDING') {
    if (!this.client) return;
    try {
      // Auto-fetch current user ID from Supabase auth
      const user = await getCurrentUser();
      const userId = user?.id || null;

      // Extract entities into proper fields
      const dateEntity = cmd.entities.find(e => e.type === 'DATE');
      const timeEntity = cmd.entities.find(e => e.type === 'TIME');
      const titleEntity = cmd.entities.find(e => e.type === 'TITLE');
      const priorityEntity = cmd.entities.find(e => e.type === 'PRIORITY');
      const tagEntities = cmd.entities.filter(e => e.type === 'TAG');

      await this.client.from('myday_voice_command_logs').insert([{
        user_id: userId,
        session_id: `session_${Date.now()}`,
        raw_text: cmd.transcript,
        detected_category: cmd.intent.type,
        extracted_title: titleEntity?.normalizedValue || titleEntity?.value || null,
        extracted_priority: priorityEntity?.normalizedValue || priorityEntity?.value || null,
        extracted_tags: tagEntities.length > 0 ? tagEntities.map(t => t.normalizedValue || t.value) : null,
        memo_date: dateEntity?.normalizedValue || dateEntity?.value || null,
        memo_time: timeEntity?.normalizedValue || timeEntity?.value || null,
        overall_confidence: cmd.overallConfidence,
        entities: cmd.entities,
        outcome,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('[VoiceLogger] failed to write voice_command_logs', err);
    }
  }

  async audit(actionType: string, metadata: any = {}) {
    if (!this.client) return;
    try {
      await this.client.from('myday_voice_audit_logs').insert([{
        action_type: actionType,
        metadata,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('[VoiceLogger] failed to write myday_voice_audit_logs', err);
    }
  }
}

export default VoiceCommandLogger;

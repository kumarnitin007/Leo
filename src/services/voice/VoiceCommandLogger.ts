import { getSupabaseClient, getCurrentUser } from '../../lib/supabase';
import { ParsedCommand } from './types';

export class VoiceCommandLogger {
  private client = getSupabaseClient();

  async logCommand(cmd: ParsedCommand, status: string = 'parsed') {
    if (!this.client) return;
    try {
      // Auto-fetch current user ID from Supabase auth
      const user = await getCurrentUser();
      const userId = user?.id || null;

      await this.client.from('myday_voice_command_logs').insert([{
        user_id: userId,
        raw_text: cmd.transcript,
        detected_category: cmd.intent.type,
        parsed_entities: cmd.entities,
        confidence_score: cmd.overallConfidence,
        status,
        created_entity_id: null,
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

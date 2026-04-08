import { DatabaseManager } from '@/infra/database/database.manager.js';

export interface LearningSessionRecord {
  id: string;
  user_id: string;
  goal_title: string;
  source_topic: string;
  source_text: string | null;
  status: 'initializing' | 'ready' | 'completed' | 'failed';
  current_concept_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SessionService {
  private db = DatabaseManager.getInstance();

  async createLearningSession(input: {
    userId: string;
    goalTitle: string;
    sourceTopic: string;
    sourceText: string | null;
  }): Promise<LearningSessionRecord> {
    const result = await this.db.getPool().query<LearningSessionRecord>(
      `INSERT INTO public.learning_sessions (user_id, goal_title, source_topic, source_text, status)
       VALUES ($1, $2, $3, $4, 'initializing')
       RETURNING *`,
      [input.userId, input.goalTitle, input.sourceTopic, input.sourceText]
    );

    return result.rows[0];
  }
}

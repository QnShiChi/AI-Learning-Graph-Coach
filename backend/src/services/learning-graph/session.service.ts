import { DatabaseManager } from '@/infra/database/database.manager.js';
import crypto from 'node:crypto';

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

export interface SessionConceptRecord {
  id: string;
  session_id: string;
  canonical_name: string;
  display_name: string;
  description: string;
  difficulty: number;
  created_at: string;
  updated_at: string;
}

interface SessionDto {
  id: string;
  userId: string;
  goalTitle: string;
  sourceTopic: string;
  sourceText: string | null;
  status: 'initializing' | 'ready' | 'completed' | 'failed';
  currentConceptId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionConceptDto {
  id: string;
  sessionId: string;
  canonicalName: string;
  displayName: string;
  description: string;
  difficulty: number;
  createdAt: string;
  updatedAt: string;
}

interface SessionLibraryItemDto {
  session: SessionDto;
  progress: {
    completedCount: number;
    totalCount: number;
  };
  currentConcept: SessionConceptDto | null;
}

export class SessionService {
  private db = DatabaseManager.getInstance();

  private mapSession(record: LearningSessionRecord | null): SessionDto | null {
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      userId: record.user_id,
      goalTitle: record.goal_title,
      sourceTopic: record.source_topic,
      sourceText: record.source_text,
      status: record.status,
      currentConceptId: record.current_concept_id,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private mapConcept(record: SessionConceptRecord | null): SessionConceptDto | null {
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      sessionId: record.session_id,
      canonicalName: record.canonical_name,
      displayName: record.display_name,
      description: record.description,
      difficulty: record.difficulty,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

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

  async persistValidatedGraph(input: {
    sessionId: string;
    concepts: Array<{
      tempId: string;
      canonicalName: string;
      displayName: string;
      description: string;
      difficulty: number;
    }>;
    edges: Array<{
      fromTempId: string;
      toTempId: string;
      type: 'prerequisite';
      weight: number;
    }>;
  }) {
    const pool = this.db.getPool();
    const conceptIdByTempId = new Map<string, string>();

    for (const concept of input.concepts) {
      const conceptId = crypto.randomUUID();
      conceptIdByTempId.set(concept.tempId, conceptId);

      await pool.query(
        `INSERT INTO public.session_concepts
          (id, session_id, canonical_name, display_name, description, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          conceptId,
          input.sessionId,
          concept.canonicalName,
          concept.displayName,
          concept.description,
          concept.difficulty,
        ]
      );
    }

    for (const edge of input.edges) {
      const fromConceptId = conceptIdByTempId.get(edge.fromTempId);
      const toConceptId = conceptIdByTempId.get(edge.toTempId);

      if (!fromConceptId || !toConceptId) {
        continue;
      }

      await pool.query(
        `INSERT INTO public.session_edges
          (id, session_id, from_concept_id, to_concept_id, edge_type, weight, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'validation')`,
        [
          crypto.randomUUID(),
          input.sessionId,
          fromConceptId,
          toConceptId,
          edge.type,
          edge.weight,
        ]
      );
    }

    return { conceptIdByTempId };
  }

  async persistPathSnapshot(input: {
    sessionId: string;
    pathVersion: number;
    items: Array<{
      conceptId: string;
      position: number;
      pathState: 'completed' | 'current' | 'next' | 'upcoming' | 'locked';
    }>;
  }) {
    const pool = this.db.getPool();

    for (const item of input.items) {
      await pool.query(
        `INSERT INTO public.session_path_items
          (id, session_id, concept_id, path_version, position, path_state, is_current)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
        [
          crypto.randomUUID(),
          input.sessionId,
          item.conceptId,
          input.pathVersion,
          item.position,
          item.pathState,
        ]
      );
    }
  }

  async markSessionReady(input: { sessionId: string; currentConceptId: string | null }) {
    await this.db.getPool().query(
      `UPDATE public.learning_sessions
       SET status = 'ready',
           current_concept_id = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [input.sessionId, input.currentConceptId]
    );
  }

  async findSessionById(sessionId: string): Promise<LearningSessionRecord | null> {
    const result = await this.db
      .getPool()
      .query<LearningSessionRecord>(`SELECT * FROM public.learning_sessions WHERE id = $1`, [
        sessionId,
      ]);

    return result.rows[0] ?? null;
  }

  async findSessionByIdForUser(userId: string, sessionId: string): Promise<LearningSessionRecord | null> {
    const result = await this.db.getPool().query<LearningSessionRecord>(
      `SELECT *
       FROM public.learning_sessions
       WHERE user_id = $1 AND id = $2`,
      [userId, sessionId]
    );

    return result.rows[0] ?? null;
  }

  async getCurrentPathSnapshot(sessionId: string) {
    const result = await this.db.getPool().query(
      `SELECT id, session_id AS "sessionId", concept_id AS "conceptId", path_version AS "pathVersion",
              position, path_state AS "pathState", is_current AS "isCurrent",
              superseded_at AS "supersededAt", created_at AS "createdAt"
       FROM public.session_path_items
       WHERE session_id = $1 AND is_current = TRUE
       ORDER BY position ASC`,
      [sessionId]
    );

    return result.rows;
  }

  async getProgressSummary(sessionId: string) {
    const result = await this.db.getPool().query(
      `SELECT
          COUNT(*) FILTER (WHERE path_state = 'completed')::int AS "completedCount",
          COUNT(*)::int AS "totalCount"
       FROM public.session_path_items
       WHERE session_id = $1 AND is_current = TRUE`,
      [sessionId]
    );

    return (
      result.rows[0] ?? {
        completedCount: 0,
        totalCount: 0,
      }
    );
  }

  async getCurrentConcept(sessionId: string): Promise<SessionConceptRecord | null> {
    const result = await this.db.getPool().query<SessionConceptRecord>(
      `SELECT c.*
       FROM public.learning_sessions s
       LEFT JOIN public.session_concepts c ON c.id = s.current_concept_id
       WHERE s.id = $1`,
      [sessionId]
    );

    return result.rows[0] ?? null;
  }

  async findConceptById(sessionId: string, conceptId: string): Promise<SessionConceptRecord | null> {
    const result = await this.db.getPool().query<SessionConceptRecord>(
      `SELECT *
       FROM public.session_concepts
       WHERE session_id = $1 AND id = $2`,
      [sessionId, conceptId]
    );

    return result.rows[0] ?? null;
  }

  async getConceptMastery(sessionId: string, conceptId: string) {
    const result = await this.db.getPool().query(
      `SELECT
          session_id AS "sessionId",
          concept_id AS "conceptId",
          mastery_score AS "masteryScore",
          last_quiz_score AS "lastQuizScore",
          attempt_count AS "attemptCount",
          updated_at AS "updatedAt"
       FROM public.session_concept_mastery
       WHERE session_id = $1 AND concept_id = $2`,
      [sessionId, conceptId]
    );

    return result.rows[0] ?? null;
  }

  async listPrerequisites(sessionId: string, conceptId: string): Promise<SessionConceptRecord[]> {
    const result = await this.db.getPool().query<SessionConceptRecord>(
      `SELECT c.*
       FROM public.session_edges e
       JOIN public.session_concepts c ON c.id = e.from_concept_id
       WHERE e.session_id = $1 AND e.to_concept_id = $2
       ORDER BY c.display_name ASC`,
      [sessionId, conceptId]
    );

    return result.rows;
  }

  async getGraph(sessionId: string) {
    const [concepts, edges] = await Promise.all([
      this.db.getPool().query(
        `SELECT
            id,
            session_id AS "sessionId",
            canonical_name AS "canonicalName",
            display_name AS "displayName",
            description,
            difficulty,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
         FROM public.session_concepts
         WHERE session_id = $1
         ORDER BY display_name ASC`,
        [sessionId]
      ),
      this.db.getPool().query(
        `SELECT
            id,
            session_id AS "sessionId",
            from_concept_id AS "fromConceptId",
            to_concept_id AS "toConceptId",
            edge_type AS "edgeType",
            weight,
            source,
            created_at AS "createdAt"
         FROM public.session_edges
         WHERE session_id = $1`,
        [sessionId]
      ),
    ]);

    return {
      concepts: concepts.rows,
      edges: edges.rows,
    };
  }

  async listSessionLibraryItemsForUser(userId: string): Promise<SessionLibraryItemDto[]> {
    const result = await this.db.getPool().query<LearningSessionRecord>(
      `SELECT *
       FROM public.learning_sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    const items = await Promise.all(
      result.rows.map(async (record) => ({
        session: this.mapSession(record)!,
        progress: await this.getProgressSummary(record.id),
        currentConcept: this.mapConcept(await this.getCurrentConcept(record.id)),
      }))
    );

    return items.sort(
      (left, right) => Date.parse(right.session.updatedAt) - Date.parse(left.session.updatedAt)
    );
  }

  async getSessionOverview(sessionId: string) {
    return {
      session: this.mapSession(await this.findSessionById(sessionId)),
      pathSnapshot: await this.getCurrentPathSnapshot(sessionId),
      progress: await this.getProgressSummary(sessionId),
      currentConcept: this.mapConcept(await this.getCurrentConcept(sessionId)),
    };
  }

  async getConceptLearningPayload(sessionId: string, conceptId: string) {
    const [concept, mastery, prerequisites] = await Promise.all([
      this.findConceptById(sessionId, conceptId),
      this.getConceptMastery(sessionId, conceptId),
      this.listPrerequisites(sessionId, conceptId),
    ]);

    return {
      concept: this.mapConcept(concept),
      mastery,
      prerequisites: prerequisites
        .map((item) => this.mapConcept(item))
        .filter((item): item is SessionConceptDto => item !== null),
    };
  }
}

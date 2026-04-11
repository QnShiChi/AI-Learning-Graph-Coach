import { DatabaseManager } from '@/infra/database/database.manager.js';
import { lessonPackageSchema, type LessonPackageSchema } from '@insforge/shared-schemas';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PersistedQuizArtifact } from './quiz.service.js';

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

interface SessionPathItemDto {
  id: string;
  sessionId: string;
  conceptId: string;
  pathVersion: number;
  position: number;
  pathState: 'completed' | 'current' | 'next' | 'upcoming' | 'locked';
  isCurrent: boolean;
  supersededAt: string | null;
  createdAt: string;
}

interface SessionConceptMasteryDto {
  sessionId: string;
  conceptId: string;
  masteryScore: number;
  lastQuizScore: number;
  attemptCount: number;
  updatedAt: string;
}

interface SessionQuizAttemptDto {
  score: number;
}

interface SessionConceptQuizRecord {
  id: string;
  sessionId: string;
  conceptId: string;
  status: 'active' | 'submitted' | 'expired';
  quizPayload: PersistedQuizArtifact | null;
  createdAt: string;
  submittedAt: string | null;
  expiredAt: string | null;
}

interface SessionConceptExplanationDto {
  explanationText: string;
}

type Queryable = Pool | PoolClient;

export class SessionService {
  private db = DatabaseManager.getInstance();

  private getExecutor(client?: Queryable): Queryable {
    return client ?? this.db.getPool();
  }

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

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async getNextPathVersion(sessionId: string, client?: Queryable): Promise<number> {
    const result = await this.getExecutor(client).query<{ nextPathVersion: number }>(
      `SELECT COALESCE(MAX(path_version), 0)::int + 1 AS "nextPathVersion"
       FROM public.session_path_items
       WHERE session_id = $1`,
      [sessionId]
    );

    return result.rows[0]?.nextPathVersion ?? 1;
  }

  async lockSession(sessionId: string, client: PoolClient) {
    await client.query(`SELECT id FROM public.learning_sessions WHERE id = $1 FOR UPDATE`, [sessionId]);
  }

  async getActiveQuiz(
    sessionId: string,
    conceptId: string,
    client?: Queryable
  ): Promise<SessionConceptQuizRecord | null> {
    const result = await this.getExecutor(client).query<SessionConceptQuizRecord>(
      `SELECT
          id,
          session_id AS "sessionId",
          concept_id AS "conceptId",
          status,
          quiz_payload AS "quizPayload",
          created_at AS "createdAt",
          submitted_at AS "submittedAt",
          expired_at AS "expiredAt"
       FROM public.session_concept_quizzes
       WHERE session_id = $1 AND concept_id = $2 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId, conceptId]
    );

    return result.rows[0] ?? null;
  }

  async findQuizById(
    sessionId: string,
    conceptId: string,
    quizId: string,
    client?: Queryable
  ): Promise<SessionConceptQuizRecord | null> {
    const result = await this.getExecutor(client).query<SessionConceptQuizRecord>(
      `SELECT
          id,
          session_id AS "sessionId",
          concept_id AS "conceptId",
          status,
          quiz_payload AS "quizPayload",
          created_at AS "createdAt",
          submitted_at AS "submittedAt",
          expired_at AS "expiredAt"
       FROM public.session_concept_quizzes
       WHERE session_id = $1 AND concept_id = $2 AND id = $3
       LIMIT 1`,
      [sessionId, conceptId, quizId]
    );

    return result.rows[0] ?? null;
  }

  async insertActiveQuiz(
    input: {
      quiz: PersistedQuizArtifact;
    },
    client?: Queryable
  ) {
    const result = await this.getExecutor(client).query(
      `INSERT INTO public.session_concept_quizzes
        (id, session_id, concept_id, quiz_payload, status)
       VALUES ($1, $2, $3, $4::jsonb, 'active')
       ON CONFLICT DO NOTHING`,
      [
        input.quiz.id,
        input.quiz.sessionId,
        input.quiz.conceptId,
        JSON.stringify(input.quiz),
      ]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async expireActiveQuiz(
    input: {
      sessionId: string;
      conceptId: string;
    },
    client?: Queryable
  ) {
    await this.getExecutor(client).query(
      `UPDATE public.session_concept_quizzes
       SET status = 'expired',
           expired_at = NOW()
       WHERE session_id = $1 AND concept_id = $2 AND status = 'active'`,
      [input.sessionId, input.conceptId]
    );
  }

  async markQuizSubmitted(
    input: {
      quizId: string;
    },
    client?: Queryable
  ) {
    const result = await this.getExecutor(client).query(
      `UPDATE public.session_concept_quizzes
       SET status = 'submitted',
           submitted_at = NOW()
       WHERE id = $1 AND status = 'active'`,
      [input.quizId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async insertQuizAttempt(
    input: {
      quizId: string;
      sessionId: string;
      conceptId: string;
      userAnswers: Array<{ questionId: string; selectedOptionId: string }>;
      score: number;
      resultSummary: {
        correctCount: number;
        totalQuestions: number;
        feedback: string;
      };
    },
    client?: Queryable
  ) {
    await this.getExecutor(client).query(
      `INSERT INTO public.quiz_attempts
        (id, quiz_id, session_id, concept_id, user_answers, score, result_summary)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)`,
      [
        crypto.randomUUID(),
        input.quizId,
        input.sessionId,
        input.conceptId,
        JSON.stringify(input.userAnswers),
        input.score,
        JSON.stringify(input.resultSummary),
      ]
    );
  }

  async listQuizAttemptScores(
    sessionId: string,
    conceptId: string,
    client?: Queryable
  ): Promise<number[]> {
    const result = await this.getExecutor(client).query<SessionQuizAttemptDto>(
      `SELECT score
       FROM public.quiz_attempts
       WHERE session_id = $1 AND concept_id = $2
       ORDER BY created_at ASC`,
      [sessionId, conceptId]
    );

    return result.rows.map((row) => row.score);
  }

  async upsertConceptMastery(
    input: {
      sessionId: string;
      conceptId: string;
      masteryScore: number;
      lastQuizScore: number;
      attemptCount: number;
    },
    client?: Queryable
  ): Promise<SessionConceptMasteryDto> {
    const result = await this.getExecutor(client).query<SessionConceptMasteryDto>(
      `INSERT INTO public.session_concept_mastery
        (session_id, concept_id, mastery_score, last_quiz_score, attempt_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (session_id, concept_id) DO UPDATE
       SET mastery_score = EXCLUDED.mastery_score,
           last_quiz_score = EXCLUDED.last_quiz_score,
           attempt_count = EXCLUDED.attempt_count,
           updated_at = NOW()
       RETURNING
         session_id AS "sessionId",
         concept_id AS "conceptId",
         mastery_score AS "masteryScore",
         last_quiz_score AS "lastQuizScore",
         attempt_count AS "attemptCount",
         updated_at AS "updatedAt"`,
      [
        input.sessionId,
        input.conceptId,
        input.masteryScore,
        input.lastQuizScore,
        input.attemptCount,
      ]
    );

    return result.rows[0];
  }

  async replaceCurrentPathSnapshot(
    input: {
      sessionId: string;
      pathVersion: number;
      currentConceptId: string | null;
      items: Array<{
        conceptId: string;
        position: number;
        pathState: 'completed' | 'current' | 'next' | 'upcoming' | 'locked';
      }>;
    },
    client?: Queryable
  ): Promise<SessionPathItemDto[]> {
    const executor = this.getExecutor(client);

    await executor.query(
      `UPDATE public.session_path_items
       SET is_current = FALSE,
           superseded_at = NOW()
       WHERE session_id = $1 AND is_current = TRUE`,
      [input.sessionId]
    );

    const persistedItems: SessionPathItemDto[] = [];

    for (const item of input.items) {
      const result = await executor.query<SessionPathItemDto>(
        `INSERT INTO public.session_path_items
          (id, session_id, concept_id, path_version, position, path_state, is_current)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING
           id,
           session_id AS "sessionId",
           concept_id AS "conceptId",
           path_version AS "pathVersion",
           position,
           path_state AS "pathState",
           is_current AS "isCurrent",
           superseded_at AS "supersededAt",
           created_at AS "createdAt"`,
        [
          crypto.randomUUID(),
          input.sessionId,
          item.conceptId,
          input.pathVersion,
          item.position,
          item.pathState,
        ]
      );

      persistedItems.push(result.rows[0]);
    }

    await executor.query(
      `UPDATE public.learning_sessions
       SET current_concept_id = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [input.sessionId, input.currentConceptId, input.currentConceptId ? 'ready' : 'completed']
    );

    return persistedItems;
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

  async listConceptMasteries(sessionId: string, client?: Queryable): Promise<SessionConceptMasteryDto[]> {
    const result = await this.getExecutor(client).query<SessionConceptMasteryDto>(
      `SELECT
          session_id AS "sessionId",
          concept_id AS "conceptId",
          mastery_score AS "masteryScore",
          last_quiz_score AS "lastQuizScore",
          attempt_count AS "attemptCount",
          updated_at AS "updatedAt"
       FROM public.session_concept_mastery
       WHERE session_id = $1`,
      [sessionId]
    );

    return result.rows;
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

  async getCurrentLessonPackage(sessionId: string, conceptId: string): Promise<LessonPackageSchema | null> {
    const result = await this.db.getPool().query<{ lessonPayload: unknown }>(
      `SELECT lesson_payload AS "lessonPayload"
       FROM public.session_concept_lessons
       WHERE session_id = $1 AND concept_id = $2 AND is_current = TRUE
       ORDER BY lesson_version DESC
       LIMIT 1`,
      [sessionId, conceptId]
    );

    const lessonPayload = result.rows[0]?.lessonPayload;

    if (!lessonPayload) {
      return null;
    }

    const parsedLessonPackage = lessonPackageSchema.safeParse(lessonPayload);
    return parsedLessonPackage.success ? parsedLessonPackage.data : null;
  }

  async getPersistedExplanation(sessionId: string, conceptId: string): Promise<string | null> {
    const result = await this.db.getPool().query<SessionConceptExplanationDto>(
      `SELECT explanation_text AS "explanationText"
       FROM public.session_concept_explanations
       WHERE session_id = $1 AND concept_id = $2
       LIMIT 1`,
      [sessionId, conceptId]
    );

    return result.rows[0]?.explanationText ?? null;
  }

  async upsertPersistedExplanation(input: {
    sessionId: string;
    conceptId: string;
    explanation: string;
  }): Promise<void> {
    await this.db.getPool().query(
      `INSERT INTO public.session_concept_explanations (id, session_id, concept_id, explanation_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, concept_id)
       DO UPDATE SET explanation_text = EXCLUDED.explanation_text, updated_at = NOW()`,
      [crypto.randomUUID(), input.sessionId, input.conceptId, input.explanation]
    );
  }

  async insertLessonPackage(input: {
    sessionId: string;
    conceptId: string;
    lessonPackage: LessonPackageSchema;
  }) {
    const result = await this.db.getPool().query(
      `INSERT INTO public.session_concept_lessons
        (id, session_id, concept_id, lesson_version, lesson_payload, regeneration_reason, is_current)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, TRUE)
       ON CONFLICT ON CONSTRAINT session_concept_lessons_version_unique DO NOTHING`,
      [
        crypto.randomUUID(),
        input.sessionId,
        input.conceptId,
        input.lessonPackage.version,
        JSON.stringify(input.lessonPackage),
        input.lessonPackage.regenerationReason,
      ]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async getLatestVoiceSummary(
    sessionId: string,
    conceptId: string,
    lessonVersion: number
  ): Promise<{ summary: string; summaryVersion: number } | null> {
    const result = await this.db
      .getPool()
      .query<{ summaryPayload: { summary?: string } | null; summaryVersion: number }>(
        `SELECT
            summary_payload AS "summaryPayload",
            summary_version AS "summaryVersion"
         FROM public.session_concept_voice_summaries
         WHERE session_id = $1 AND concept_id = $2 AND lesson_version = $3
         ORDER BY summary_version DESC
         LIMIT 1`,
        [sessionId, conceptId, lessonVersion]
      );

    const record = result.rows[0];

    if (!record?.summaryPayload?.summary) {
      return null;
    }

    return {
      summary: record.summaryPayload.summary,
      summaryVersion: record.summaryVersion,
    };
  }

  async insertVoiceSummary(input: {
    sessionId: string;
    conceptId: string;
    lessonVersion: number;
    summary: string;
  }): Promise<number> {
    return this.withTransaction(async (client) => {
      await this.lockSession(input.sessionId, client);

      const result = await client.query<{ summaryVersion: number }>(
        `WITH next_version AS (
           SELECT COALESCE(MAX(summary_version), 0)::int + 1 AS summary_version
           FROM public.session_concept_voice_summaries
           WHERE session_id = $1 AND concept_id = $2 AND lesson_version = $3
         )
         INSERT INTO public.session_concept_voice_summaries
           (id, session_id, concept_id, lesson_version, summary_version, summary_payload)
         SELECT
           $4,
           $1,
           $2,
           $3,
           next_version.summary_version,
           $5::jsonb
         FROM next_version
         RETURNING summary_version AS "summaryVersion"`,
        [
          input.sessionId,
          input.conceptId,
          input.lessonVersion,
          crypto.randomUUID(),
          JSON.stringify({ summary: input.summary }),
        ]
      );

      return result.rows[0]?.summaryVersion ?? 1;
    });
  }

  async insertVoiceTurn(input: {
    sessionId: string;
    conceptId: string;
    lessonVersion: number;
    learnerTranscript: string;
    assistantTranscript: string;
    summary: string;
  }): Promise<{ id: string; summaryVersion: number }> {
    return this.withTransaction(async (client) => {
      await this.lockSession(input.sessionId, client);
      const id = crypto.randomUUID();

      const result = await client.query<{ summaryVersion: number }>(
        `WITH next_version AS (
           SELECT COALESCE(MAX(summary_version), 0)::int + 1 AS summary_version
           FROM public.session_concept_voice_summaries
           WHERE session_id = $1 AND concept_id = $2 AND lesson_version = $3
         )
         INSERT INTO public.session_concept_voice_summaries
           (id, session_id, concept_id, lesson_version, summary_version, summary_payload)
         SELECT
           $4,
           $1,
           $2,
           $3,
           next_version.summary_version,
           $5::jsonb
         FROM next_version
         RETURNING summary_version AS "summaryVersion"`,
        [
          input.sessionId,
          input.conceptId,
          input.lessonVersion,
          id,
          JSON.stringify({
            summary: input.summary,
            learnerTranscript: input.learnerTranscript,
            assistantTranscript: input.assistantTranscript,
          }),
        ]
      );

      return {
        id,
        summaryVersion: result.rows[0]?.summaryVersion ?? 1,
      };
    });
  }

  async listVoiceTurns(sessionId: string, conceptId: string, lessonVersion: number): Promise<
    Array<{
      id: string;
      learnerTranscript: string;
      assistantTranscript: string;
      lessonVersion: number;
      createdAt: string;
    }>
  > {
    const result = await this.db.getPool().query<{
      id: string;
      summaryPayload: {
        learnerTranscript?: string;
        assistantTranscript?: string;
      } | null;
      lessonVersion: number;
      createdAt: string;
    }>(
      `SELECT
         id,
         summary_payload AS "summaryPayload",
         lesson_version AS "lessonVersion",
         created_at AS "createdAt"
       FROM public.session_concept_voice_summaries
       WHERE session_id = $1 AND concept_id = $2 AND lesson_version = $3
       ORDER BY summary_version ASC`,
      [sessionId, conceptId, lessonVersion]
    );

    return result.rows
      .filter(
        (record) =>
          Boolean(record.summaryPayload?.learnerTranscript) &&
          Boolean(record.summaryPayload?.assistantTranscript)
      )
      .map((record) => ({
        id: record.id,
        learnerTranscript: record.summaryPayload?.learnerTranscript ?? '',
        assistantTranscript: record.summaryPayload?.assistantTranscript ?? '',
        lessonVersion: record.lessonVersion,
        createdAt: record.createdAt,
      }));
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
    const [session, concept, mastery, prerequisites, explanation] = await Promise.all([
      this.findSessionById(sessionId),
      this.findConceptById(sessionId, conceptId),
      this.getConceptMastery(sessionId, conceptId),
      this.listPrerequisites(sessionId, conceptId),
      this.getPersistedExplanation(sessionId, conceptId),
    ]);

    return {
      session: this.mapSession(session),
      concept: this.mapConcept(concept),
      mastery,
      explanation,
      prerequisites: prerequisites
        .map((item) => this.mapConcept(item))
        .filter((item): item is SessionConceptDto => item !== null),
    };
  }
}

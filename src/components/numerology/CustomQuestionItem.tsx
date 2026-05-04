/**
 * CustomQuestionItem — single row inside the "Your questions" section.
 *
 * Responsibilities:
 *   - Render the question text with edit / delete affordances.
 *   - Lazily load today's AI answer (one call per question per day, fully
 *     cached in `myday_astro_cache`).
 *   - Inline-edit mode swaps the question text with a textarea + Save / Cancel.
 *
 * Performance:
 *   - perfStart('CustomQuestionItem', 'render') tracks render cost.
 *   - The answer fetch is debounced behind a `useEffect` keyed on the
 *     question id + question text, so editing invalidates and re-fetches.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  deleteQuestion,
  getAnswerForQuestion,
  updateQuestion,
  type NumerologyAnswer,
  type NumerologyQuestion,
} from '../../numerology/numerologyCustomQuestions';
import type { NumerologyProfile } from '../../numerology/numerologyEngine';
import { perfStart } from '../../utils/perfLogger';

interface Props {
  question: NumerologyQuestion;
  profile: NumerologyProfile;
  userId: string;
  theme: any;
  onChanged: (q: NumerologyQuestion) => void;
  onDeleted: (id: string) => void;
}

const CustomQuestionItem: React.FC<Props> = ({
  question,
  profile,
  userId,
  theme,
  onChanged,
  onDeleted,
}) => {
  const renderEnd = useRef(perfStart('CustomQuestionItem', 'render'));
  useEffect(() => { renderEnd.current(); }, []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question.question);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState<NumerologyAnswer | null>(null);
  const [loadingAnswer, setLoadingAnswer] = useState(false);

  // Fetch (or load from cache) today's answer whenever the question text changes.
  useEffect(() => {
    let alive = true;
    setLoadingAnswer(true);
    setAnswer(null);
    getAnswerForQuestion(question, profile)
      .then((res) => {
        if (alive) {
          setAnswer(res);
          setLoadingAnswer(false);
        }
      })
      .catch(() => {
        if (alive) setLoadingAnswer(false);
      });
    return () => { alive = false; };
  }, [question.id, question.question, profile.lifePath, profile.personalDay, profile.personalMonth, profile.personalYear]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const result = await updateQuestion(userId, question.id, draft);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onChanged(result);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this question?')) return;
    const result = await deleteQuestion(userId, question.id);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onDeleted(question.id);
  };

  const muted = theme.colors.textLight;
  const text = theme.colors.text;
  const cardBg = theme.colors.cardBg;
  const border = theme.colors.cardBorder;

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={240}
            rows={2}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 6,
              border: `1px solid ${border}`,
              background: theme.colors.background,
              color: text,
              fontSize: 12,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setDraft(question.question); setEditing(false); setError(null); }}
              style={ghostBtn(theme)}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || draft.trim().length < 3}
              style={primaryBtn(theme, saving || draft.trim().length < 3)}
            >
              {saving ? 'Saving…' : 'Save & re-answer'}
            </button>
          </div>
          {error && <div style={{ fontSize: 10, color: theme.colors.danger }}>{error}</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: text, lineHeight: 1.5 }}>
              ❓ {question.question}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => setEditing(true)} style={iconBtn(theme)} aria-label="Edit question">
                ✎
              </button>
              <button onClick={handleDelete} style={iconBtn(theme)} aria-label="Delete question">
                🗑
              </button>
            </div>
          </div>

          <div style={{
            background: theme.colors.background,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11,
            color: muted,
            lineHeight: 1.6,
            minHeight: 28,
          }}>
            {loadingAnswer && (
              <span style={{ fontStyle: 'italic' }}>Looking at your numbers…</span>
            )}
            {!loadingAnswer && answer && (
              <span style={{ color: text }}>{answer.text}</span>
            )}
            {!loadingAnswer && !answer && (
              <span style={{ fontStyle: 'italic', color: theme.colors.danger }}>
                Couldn't get an answer right now. Try again in a moment.
              </span>
            )}
          </div>

          {answer?.fromCache && (
            <div style={{ fontSize: 9, color: muted, alignSelf: 'flex-end' }}>
              Cached for today — refreshes tomorrow
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── tiny shared button styles ────────────────────────────────────────────────

function ghostBtn(theme: any): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${theme.colors.cardBorder}`,
    color: theme.colors.text,
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

function primaryBtn(theme: any, disabled: boolean): React.CSSProperties {
  return {
    background: theme.colors.primary,
    border: 'none',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
  };
}

function iconBtn(theme: any): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: theme.colors.textLight,
    fontSize: 13,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
  };
}

export default CustomQuestionItem;

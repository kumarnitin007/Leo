/**
 * CustomQuestionsCard — "Your questions" section on the Plain English
 * numerology card. Up to NUMEROLOGY_CUSTOM_Q_MAX questions per user, each
 * with a daily-cached AI answer. See `numerologyCustomQuestions.ts` for
 * persistence and `numerologyInsights.ts` for the configurable cap.
 *
 * Behaviour:
 *   - Loads the user's questions on mount via `listQuestions`.
 *   - Inline "+ Add a question" form appends a new row up to the cap.
 *   - Suggestion chips prefill the textarea on the empty state.
 *   - Each row is a self-contained `<CustomQuestionItem />` that loads its
 *     own answer (cached daily).
 *
 * Performance:
 *   - perfStart('CustomQuestionsCard', 'render') for render cost.
 *   - perfStart('CustomQuestionsCard', 'view') tracks dwell time.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createQuestion,
  listQuestions,
  type NumerologyQuestion,
} from '../../numerology/numerologyCustomQuestions';
import { NUMEROLOGY_CUSTOM_Q_MAX } from '../../numerology/numerologyInsights';
import type { NumerologyProfile } from '../../numerology/numerologyEngine';
import { perfStart } from '../../utils/perfLogger';
import CustomQuestionItem from './CustomQuestionItem';

interface Props {
  profile: NumerologyProfile;
  userId: string | null;
  theme: any;
}

const SUGGESTION_PROMPTS: string[] = [
  'Should I take the new job offer this year?',
  "When's my best month for travel?",
  'Should I start the side hustle this year?',
  'Is this a good year to buy a home?',
  'How can I get along better with my partner?',
];

const CustomQuestionsCard: React.FC<Props> = ({ profile, userId, theme }) => {
  const renderEnd = useRef(perfStart('CustomQuestionsCard', 'render'));
  const viewEnd = useRef(perfStart('CustomQuestionsCard', 'view'));
  useEffect(() => {
    renderEnd.current();
    return () => { viewEnd.current(); };
  }, []);

  const [questions, setQuestions] = useState<NumerologyQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let alive = true;
    listQuestions(userId)
      .then((qs) => { if (alive) { setQuestions(qs); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  const cap = NUMEROLOGY_CUSTOM_Q_MAX;
  const remaining = useMemo(() => Math.max(0, cap - questions.length), [questions.length, cap]);
  const atCap = remaining === 0;

  const handleAdd = async () => {
    if (!userId) return;
    setError(null);
    setSaving(true);
    const result = await createQuestion(userId, draft);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setQuestions((prev) => [...prev, result]);
    setDraft('');
    setAdding(false);
  };

  const handleChanged = (q: NumerologyQuestion) => {
    setQuestions((prev) => prev.map((x) => (x.id === q.id ? q : x)));
  };

  const handleDeleted = (id: string) => {
    setQuestions((prev) => prev.filter((x) => x.id !== id));
  };

  const muted = theme.colors.textLight;
  const text = theme.colors.text;
  const border = theme.colors.cardBorder;

  if (!userId) {
    return null; // Custom questions require sign-in (RLS).
  }

  return (
    <section
      style={{
        marginTop: 6,
        background: theme.colors.background,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: 14,
      }}
      aria-label="Your numerology questions"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: text }}>Your questions</div>
        <div style={{ fontSize: 10, color: muted }}>
          {questions.length} of {cap} used
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: muted, fontStyle: 'italic' }}>Loading your questions…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {questions.length === 0 && !adding && (
            <div
              style={{
                background: theme.colors.cardBg,
                border: `1px dashed ${border}`,
                borderRadius: 10,
                padding: 14,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 12, color: text, fontWeight: 600, marginBottom: 6 }}>
                Ask a question and we'll answer it through your numbers.
              </div>
              <div style={{ fontSize: 11, color: muted, marginBottom: 10 }}>
                Try one of these or write your own:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
                {SUGGESTION_PROMPTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setDraft(s); setAdding(true); }}
                    style={{
                      background: theme.colors.background,
                      border: `1px solid ${border}`,
                      color: text,
                      fontSize: 10,
                      padding: '4px 8px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    “{s}”
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAdding(true)}
                style={{
                  background: theme.colors.primary,
                  border: 'none',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + Add a question
              </button>
            </div>
          )}

          {questions.map((q) => (
            <CustomQuestionItem
              key={q.id}
              question={q}
              profile={profile}
              userId={userId}
              theme={theme}
              onChanged={handleChanged}
              onDeleted={handleDeleted}
            />
          ))}

          {adding && (
            <div
              style={{
                background: theme.colors.cardBg,
                border: `1px solid ${border}`,
                borderRadius: 10,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Should I take the new job offer this year?"
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
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 9, color: muted }}>{draft.length} / 240</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setAdding(false); setDraft(''); setError(null); }}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${border}`,
                      color: text,
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={saving || draft.trim().length < 3}
                    style={{
                      background: theme.colors.primary,
                      border: 'none',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 6,
                      cursor: (saving || draft.trim().length < 3) ? 'not-allowed' : 'pointer',
                      opacity: (saving || draft.trim().length < 3) ? 0.5 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save & answer'}
                  </button>
                </div>
              </div>
              {error && <div style={{ fontSize: 10, color: theme.colors.danger }}>{error}</div>}
            </div>
          )}

          {!adding && questions.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              disabled={atCap}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: `1px dashed ${border}`,
                color: atCap ? muted : theme.colors.primary,
                fontSize: 11,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 6,
                cursor: atCap ? 'not-allowed' : 'pointer',
                opacity: atCap ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
              title={atCap ? `You've reached the limit of ${cap} questions.` : ''}
            >
              + Add a question
              {atCap && '  (limit reached)'}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default CustomQuestionsCard;

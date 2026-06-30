import { useState, useEffect } from 'react';
import './App.css';

const HABITS = [
  { id: 'affirmations',  name: 'Affirmations',                   icon: '✨' },
  { id: 'no-phone',      name: 'No Phone First 30–60 Min',        icon: '📵' },
  { id: 'keybr',         name: 'Keybr Typing Practice',           icon: '⌨️' },
  { id: 'workout',       name: 'Workout / Movement',              icon: '💪' },
  { id: 'reselling',     name: 'Garage / Reselling Time',         icon: '🏷️' },
  { id: 'stop-tasks',    name: 'Stop Tasks 90 Min Before Leaving',icon: '⏰' },
];

// ─── Date utilities ───────────────────────────────────────────────────────────

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const thu = new Date(d);
  thu.setDate(d.getDate() - (d.getDay() + 6) % 7 + 3);
  const year = thu.getFullYear();
  const jan4 = new Date(year, 0, 4);
  jan4.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + 3);
  const wk = Math.round((thu - jan4) / 604800000) + 1;
  return `${year}-W${String(wk).padStart(2, '0')}`;
}

function getWeekDates(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function getStreak(habitId, completions) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmt(today);
  const todayDone = completions[todayStr]?.includes(habitId);

  let streak = 0;
  const check = new Date(today);
  if (!todayDone) check.setDate(check.getDate() - 1);

  while (streak <= 366) {
    const s = fmt(check);
    if (completions[s]?.includes(habitId)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ─── LocalStorage hook ────────────────────────────────────────────────────────

function usePersisted(key, defaultVal) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultVal;
    } catch {
      return defaultVal;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);

  return [val, setVal];
}

// ─── Motivational messages ────────────────────────────────────────────────────

function getMessage(done, total) {
  if (done === 0) return "Let's get today started! 🌅";
  if (done === total) return '🔥 Perfect day! You crushed it!';
  if (done >= total - 1) return `Almost there — ${total - done} to go! 💪`;
  if (done >= Math.ceil(total / 2)) return `Halfway there and building momentum! ⚡`;
  return `Great start! ${total - done} habit${total - done !== 1 ? 's' : ''} to go`;
}

// ─── Components ──────────────────────────────────────────────────────────────

function HabitCard({ habit, done, streak, onToggle }) {
  return (
    <div
      className={`habit-card${done ? ' done' : ''}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={done}
      tabIndex={0}
      onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onToggle()}
    >
      <div className="habit-left">
        <div className={`checkbox${done ? ' checked' : ''}`}>
          {done && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <span className="habit-icon">{habit.icon}</span>
        <span className={`habit-name${done ? ' done-text' : ''}`}>{habit.name}</span>
      </div>
      {streak > 0 && (
        <span className="streak-badge">🔥 {streak}</span>
      )}
    </div>
  );
}

function ProgressRing({ pct }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="58" height="58" viewBox="0 0 58 58">
      <circle cx="29" cy="29" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
      <circle
        cx="29" cy="29" r={r} fill="none"
        stroke="white" strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 29 29)"
        style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(.34,1.56,.64,1)' }}
      />
      <text x="29" y="34" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="Inter, sans-serif">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function WeekTab({ completions }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmt(today);
  const weekDates = getWeekDates(today);

  return (
    <div className="week-view">
      <div className="week-card">
        <div className="week-grid">
          {/* Day headers */}
          <div className="wg-spacer" />
          {weekDates.map((d, i) => (
            <div key={i} className={`wg-day-header${fmt(d) === todayStr ? ' today' : ''}`}>
              <span className="wg-day-name">{DAY_LABELS[i]}</span>
              <span className="wg-day-num">{d.getDate()}</span>
            </div>
          ))}

          {/* Habit rows */}
          {HABITS.map(habit => (
            <div key={habit.id} className="wg-row">
              <div className="wg-habit-icon" title={habit.name}>{habit.icon}</div>
              {weekDates.map((d, i) => {
                const ds = fmt(d);
                const done = completions[ds]?.includes(habit.id);
                const isFuture = d > today;
                return (
                  <div key={i} className="wg-dot-cell">
                    <div className={`wg-dot${done ? ' done' : ''}${isFuture ? ' future' : ''}`} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="week-summary-card">
        <h3 className="section-title">This Week</h3>
        {HABITS.map(habit => {
          const streak = getStreak(habit.id, completions);
          const weekTotal = weekDates.filter(d => completions[fmt(d)]?.includes(habit.id)).length;
          const pct = (weekTotal / 7) * 100;
          return (
            <div key={habit.id} className="summary-row">
              <div className="summary-left">
                <span>{habit.icon}</span>
                <span className="summary-name">{habit.name}</span>
              </div>
              <div className="summary-right">
                <div className="summary-bar-wrap">
                  <div className="summary-bar" style={{ width: `${pct}%` }} />
                </div>
                <span className="summary-count">{weekTotal}/7</span>
                {streak > 0 && <span className="streak-badge small">🔥 {streak}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsTab({ goals, setGoals, weekKey }) {
  const currentGoals = goals[weekKey] || ['', '', '', '', ''];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);

  const startEdit = () => {
    setDraft([...currentGoals]);
    setEditing(true);
  };

  const save = () => {
    setGoals(prev => ({ ...prev, [weekKey]: draft }));
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const hasGoals = currentGoals.some(g => g.trim());

  return (
    <div className="goals-card">
      <div className="goals-header">
        <div>
          <h2 className="goals-title">Weekly Goals</h2>
          <p className="goals-week-label">{weekKey.replace('-W', ' · Week ')}</p>
        </div>
        {!editing && (
          <button className="edit-btn" onClick={startEdit}>
            {hasGoals ? 'Edit' : 'Add'}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <div className="goal-inputs">
            {draft.map((g, i) => (
              <div key={i} className="goal-input-row">
                <div className="goal-num">{i + 1}</div>
                <input
                  className="goal-input"
                  type="text"
                  placeholder={`Goal ${i + 1}…`}
                  value={g}
                  onChange={e => {
                    const next = [...draft];
                    next[i] = e.target.value;
                    setDraft(next);
                  }}
                  onKeyDown={e => e.key === 'Enter' && i === draft.length - 1 && save()}
                />
              </div>
            ))}
          </div>
          <div className="goals-actions">
            <button className="btn btn-coral" onClick={save}>Save Goals</button>
            <button className="btn btn-ghost-dark" onClick={cancel}>Cancel</button>
          </div>
        </>
      ) : hasGoals ? (
        <div className="goals-list">
          {currentGoals.filter(g => g.trim()).map((g, i) => (
            <div key={i} className="goal-item">
              <span className="goal-star">★</span>
              <span className="goal-text">{g}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="goals-empty-state">
          <p>Set 3–5 goals to focus your week.</p>
          <button className="btn btn-teal" onClick={startEdit}>Set Goals</button>
        </div>
      )}
    </div>
  );
}

function ResetPrompt({ onSetGoals, onDismiss }) {
  return (
    <div className="reset-banner">
      <div className="reset-banner-inner">
        <div>
          <p className="reset-title">🌅 Weekly Reset</p>
          <p className="reset-sub">Sunday! Review last week and set new goals.</p>
        </div>
        <div className="reset-actions">
          <button className="btn btn-white" onClick={onSetGoals}>Set Goals</button>
          <button className="reset-dismiss" onClick={onDismiss}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [completions, setCompletions] = usePersisted('ht_completions', {});
  const [goals, setGoals] = usePersisted('ht_goals', {});
  const [dismissedWeek, setDismissedWeek] = usePersisted('ht_dismissed', '');
  const [tab, setTab] = useState('today');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmt(today);
  const weekKey = getWeekKey(today);
  const isSunday = today.getDay() === 0;

  const todayDone = completions[todayStr] || [];
  const doneCount = todayDone.length;
  const total = HABITS.length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;

  const showReset = isSunday && dismissedWeek !== weekKey;

  const toggleHabit = id => {
    setCompletions(prev => {
      const day = prev[todayStr] || [];
      const updated = day.includes(id) ? day.filter(h => h !== id) : [...day, id];
      return { ...prev, [todayStr]: updated };
    });
  };

  const dismissReset = () => setDismissedWeek(weekKey);

  const handleSetGoals = () => {
    dismissReset();
    setTab('goals');
  };

  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-row">
          <div className="header-text">
            <h1 className="app-title">Rise & Thrive</h1>
            <p className="app-date">{dateLabel}</p>
          </div>
          <ProgressRing pct={pct} />
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="progress-msg">{getMessage(doneCount, total)}</p>
      </header>

      {/* ── Sunday reset ── */}
      {showReset && (
        <ResetPrompt onSetGoals={handleSetGoals} onDismiss={dismissReset} />
      )}

      {/* ── Tabs ── */}
      <nav className="tab-nav">
        {['today', 'week', 'goals'].map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'today' ? 'Today' : t === 'week' ? 'Week' : 'Goals'}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="main">
        {tab === 'today' && (
          <div className="habits-list">
            {HABITS.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                done={todayDone.includes(habit.id)}
                streak={getStreak(habit.id, completions)}
                onToggle={() => toggleHabit(habit.id)}
              />
            ))}
          </div>
        )}

        {tab === 'week' && <WeekTab completions={completions} />}

        {tab === 'goals' && (
          <GoalsTab goals={goals} setGoals={setGoals} weekKey={weekKey} />
        )}
      </main>
    </div>
  );
}

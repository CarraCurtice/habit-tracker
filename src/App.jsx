import { useState, useEffect, useMemo } from 'react';
import './App.css';

// Starting habits (only used the first time; after that you edit them in the app).
// IDs match the original version so your existing history carries over.
const DEFAULT_HABITS = [
  { id: 'affirmations', name: 'Affirmations', icon: '✨' },
  { id: 'no-phone', name: 'No phone first 30 to 60 min', icon: '📵' },
  { id: 'keybr', name: 'Keybr typing practice', icon: '⌨️' },
  { id: 'workout', name: 'Workout / movement', icon: '💪' },
  { id: 'reselling', name: 'Garage / reselling time', icon: '🏷️' },
  { id: 'stop-tasks', name: 'Stop tasks 90 min before leaving', icon: '⏰' },
];

// Carra's current habits (set Oct 31, 2026). perWeek = weekly goal; no perWeek = every day.
const PRESET_V2 = [
  { id: 'bedtime', name: 'In bed by 9:30', icon: '🌙' },
  { id: 'no-screens-9', name: 'No screens after 9:00 PM', icon: '📴' },
  { id: 'wake-up', name: 'Up on time (no snooze)', icon: '⏰' },
  { id: 'no-phone', name: 'No phone first 30 to 60 min', icon: '📵' },
  { id: 'gym', name: 'Gym', icon: '🏋️', perWeek: 2 },
  { id: 'walk-biscuit', name: 'Walk Biscuit', icon: '🐕', perWeek: 5 },
  { id: 'learning', name: 'Focused learning (20 min, no multitasking)', icon: '🎧', perWeek: 3 },
];
function applyPresetV2(habits, today) {
  const keep = new Map(habits.map((h) => [h.id, h]));
  const next = PRESET_V2.map((p) => ({ ...(keep.get(p.id) || { since: today }), ...p, active: true }));
  const archived = habits.filter((h) => !PRESET_V2.some((p) => p.id === h.id)).map((h) => ({ ...h, active: false }));
  return [...next, ...archived];
}

// ─── Dates ───────────────────────────────────────────────────────────────────
const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function getWeekKey(date) {
  const d = startOfDay(date);
  const thu = addDays(d, -((d.getDay() + 6) % 7) + 3);
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const jan4thu = addDays(jan4, -((jan4.getDay() + 6) % 7) + 3);
  const wk = Math.round((thu - jan4thu) / 604800000) + 1;
  return `${thu.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}
function getWeekDates(date) {
  const d = startOfDay(date);
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
function getStreak(id, completions, today) {
  let streak = 0;
  let check = completions[fmt(today)]?.includes(id) ? today : addDays(today, -1);
  while (streak < 400 && completions[fmt(check)]?.includes(id)) { streak++; check = addDays(check, -1); }
  return streak;
}

// ─── Saved on this device ────────────────────────────────────────────────────
function usePersisted(key, init) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s !== null ? JSON.parse(s) : typeof init === 'function' ? init() : init;
    } catch { return typeof init === 'function' ? init() : init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ } }, [key, val]);
  return [val, setVal];
}

// First run of the new version: start each habit's history at its first check-in (or today)
function initialHabits() {
  let completions = {};
  try { completions = JSON.parse(localStorage.getItem('ht_completions') || '{}'); } catch { /* none */ }
  const days = Object.keys(completions).sort();
  const today = fmt(new Date());
  return DEFAULT_HABITS.map((h) => {
    const first = days.find((d) => completions[d]?.includes(h.id));
    return { ...h, active: true, since: first || today };
  });
}

// Weekly goals can change over time. goalHistory = [{ from: 'YYYY-MM-DD' (a Monday), perWeek }].
// Each week is scored against the goal that was in effect that week, not today's goal.
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
function goalFor(habit, monday) {
  const hist = habit.goalHistory;
  if (!hist || !hist.length) return habit.perWeek;
  const key = fmt(monday);
  let g = hist[0].perWeek;
  for (const e of [...hist].sort((a, b) => (a.from < b.from ? -1 : 1))) if (e.from <= key) g = e.perWeek;
  return g;
}

// Honest score for one habit in one calendar week (Mon to Sun).
// Daily habits: days done out of days so far. Weekly goals: done (capped at the goal) out of the goal.
function weekScore(habit, completions, monday, today) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  if (fmt(days[6]) < habit.since) return { done: 0, of: 0, extra: 0 };
  const doneDays = days.filter((d) => d <= today && completions[fmt(d)]?.includes(habit.id)).length;
  const goal = goalFor(habit, monday);
  if (goal) {
    return { done: Math.min(doneDays, goal), of: goal, extra: Math.max(0, doneDays - goal), raw: doneDays, goal };
  }
  const counted = days.filter((d) => d <= today && fmt(d) >= habit.since);
  return { done: doneDays, of: counted.length, extra: 0 };
}
const sum = (list) => list.reduce((a, x) => ({ done: a.done + x.done, of: a.of + x.of }), { done: 0, of: 0 });
const goalLabel = (h) => (h.perWeek ? `${h.perWeek}x a week` : 'every day');
function cellState(h, completions, d, today) {
  const ds = fmt(d);
  if (d > today || ds < h.since) return 'future';
  if (completions[ds]?.includes(h.id)) return 'done';
  if (ds === fmt(today)) return 'today';
  return goalFor(h, mondayOf(d)) ? 'off' : 'miss';
}
const pctOf = ({ done, of }) => (of ? Math.round((done / of) * 100) : null);

// ─── Little 90s decorations ──────────────────────────────────────────────────
const Bolt = ({ className }) => (
  <svg className={className} viewBox="0 0 40 64" aria-hidden="true">
    <path d="M24 0 4 36h14L12 64l24-40H22L30 0z" />
  </svg>
);
const Squiggle = () => (
  <svg className="squiggle" viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 8 Q12.5 0 25 8 T50 8 T75 8 T100 8 T125 8 T150 8 T175 8 T200 8" />
  </svg>
);
const Sparkle = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" />
  </svg>
);

// ─── Today ───────────────────────────────────────────────────────────────────
function HabitCard({ habit, done, streak, week, onToggle }) {
  return (
    <button className={`habit-card${done ? ' done' : ''}`} onClick={onToggle} aria-pressed={done}>
      <span className="habit-check">{done ? '✓' : ''}</span>
      <span className="habit-icon">{habit.icon}</span>
      <span className="habit-name">{habit.name}</span>
      {habit.perWeek ? (
        week && <span className={`goal-badge${week.raw >= habit.perWeek ? ' met' : ''}`}>{week.raw}/{habit.perWeek} wk{week.raw >= habit.perWeek ? ' ✓' : ''}</span>
      ) : streak > 1 && <span className="streak">🔥{streak}</span>}
    </button>
  );
}

function TodayTab({ habits, completions, toggle, today }) {
  const todayStr = fmt(today);
  const yesterday = addDays(today, -1);
  const yStr = fmt(yesterday);
  const [showYesterday, setShowYesterday] = useState(false);
  const yMissing = habits.filter((h) => !h.perWeek && h.since <= yStr && !completions[yStr]?.includes(h.id)).length;
  const monday = getWeekDates(today)[0];
  const daily = habits.filter((h) => !h.perWeek), weekly = habits.filter((h) => h.perWeek);
  const card = (h, day) => (
    <HabitCard key={h.id} habit={h} done={!!completions[day]?.includes(h.id)}
      streak={day === todayStr ? getStreak(h.id, completions, today) : 0}
      week={weekScore(h, completions, monday, today)} onToggle={() => toggle(day, h.id)} />
  );
  return (
    <div className="stack">
      {habits.length === 0 && <div className="card empty">No habits yet. Tap ⚙️ Habits to add some.</div>}
      {daily.length > 0 && <h2 className="group-title">Every day</h2>}
      {daily.map((h) => card(h, todayStr))}
      {weekly.length > 0 && <h2 className="group-title">This week's goals</h2>}
      {weekly.map((h) => card(h, todayStr))}
      {habits.length > 0 && (
        <div className="card soft">
          <button className="link-btn" onClick={() => setShowYesterday((s) => !s)}>
            {showYesterday ? 'Hide yesterday' : `Forgot to check in yesterday?${yMissing ? ` (${yMissing} unchecked)` : ''}`}
          </button>
          {showYesterday && (
            <div className="stack tight" style={{ marginTop: 10 }}>
              <p className="hint">Only check what you actually did. Honest data is the whole point.</p>
              {habits.filter((h) => h.since <= yStr).map((h) => card(h, yStr))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Week ────────────────────────────────────────────────────────────────────
const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
function WeekTab({ habits, completions, today, toggle }) {
  const week = getWeekDates(today);
  return (
    <div className="card">
      <h2 className="card-title">This week</h2>
      <div className="week-grid" style={{ '--cols': 7 }}>
        <span />
        {week.map((d, i) => (
          <span key={i} className={`wk-head${fmt(d) === fmt(today) ? ' now' : ''}`}>{DAY[i]}<b>{d.getDate()}</b></span>
        ))}
        {habits.map((h) => (
          <Row key={h.id} h={h} days={week} completions={completions} today={today} toggle={toggle} />
        ))}
      </div>
      <p className="legend"><i className="cell done" /> done <i className="cell miss" /> missed <i className="cell off" /> rest day (weekly goals) <i className="cell future" /> not yet</p>
      <p className="hint">Forgot a day? Tap any square up to today to mark it done, tap again to undo.</p>
    </div>
  );
}
function Row({ h, days, completions, today, toggle }) {
  const s = weekScore(h, completions, days[0], today);
  return (
    <>
      <span className="wk-habit" title={h.name}>{h.icon}<small>{s.goal ? `${s.raw}/${s.goal}` : `${s.done}/${s.of}`}</small></span>
      {days.map((d, i) => {
        const state = cellState(h, completions, d, today);
        if (state === 'future' || !toggle) return <span key={i} className={`cell ${state}`} aria-label={`${h.name} ${fmt(d)} ${state}`} />;
        return <button type="button" key={i} className={`cell tap ${state}`} aria-pressed={state === 'done'}
          aria-label={`${h.name} ${fmt(d)}: ${state === 'done' ? 'done, tap to undo' : 'tap to mark done'}`} onClick={() => toggle(fmt(d), h.id)} />;
      })}
    </>
  );
}

// ─── Reality check ───────────────────────────────────────────────────────────
function RealityTab({ habits, completions, today }) {
  const thisMon = getWeekDates(today)[0];
  const mondays = [3, 2, 1, 0].map((n) => addDays(thisMon, -7 * n)); // oldest to newest
  const d28 = Array.from({ length: 28 }, (_, i) => addDays(mondays[0], i));
  const rows = habits.map((h) => {
    const weeks = mondays.map((m) => weekScore(h, completions, m, today));
    return { h, weeks, total: sum(weeks), now: weeks[3] };
  });
  const tWeek = sum(rows.map((r) => r.now)), t4 = sum(rows.map((r) => r.total));
  const ranked = rows.filter((r) => r.total.of > 0).sort((a, b) => pctOf(a.total) - pctOf(b.total));
  const weakest = ranked[0], strongest = ranked[ranked.length - 1];
  return (
    <div className="stack">
      <div className="card score-card">
        <div className="big-score">
          <span className="label">This week so far</span>
          <span className="num">{pctOf(tWeek) ?? 0}%</span>
          <span className="sub">{tWeek.done} of {tWeek.of}</span>
        </div>
        <div className="big-score alt">
          <span className="label">Last 4 weeks</span>
          <span className="num">{pctOf(t4) ?? 0}%</span>
          <span className="sub">{t4.done} of {t4.of}</span>
        </div>
      </div>

      {weakest && weakest !== strongest && (
        <div className="card truth">
          <p><b>Needs the most help:</b> {weakest.h.icon} {weakest.h.name} ({pctOf(weakest.total)}%)</p>
          <p><b>Most consistent:</b> {strongest.h.icon} {strongest.h.name} ({pctOf(strongest.total)}%)</p>
          <p className="hint">This is information, not a grade. Pick one habit to make easier this week.</p>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Last 4 weeks, habit by habit</h2>
        {rows.map(({ h, weeks, total }) => (
          <div key={h.id} className="reality-row">
            <div className="reality-head">
              <span>{h.icon} {h.name} <small className="goal-tag">{goalLabel(h)}</small></span>
              <b>{pctOf(total) ?? 0}%</b>
            </div>
            <div className="strip">
              {d28.map((d, i) => <span key={i} className={`cell ${cellState(h, completions, d, today)}`} />)}
            </div>
            <div className="weeks">
              {weeks.map((w, i) => (
                <span key={i}>{i === 3 ? 'This wk' : `${3 - i} wk ago`}: <b>{w.of ? (w.goal ? `${w.raw}/${w.goal}${w.raw >= w.goal ? ' ✓' : ''}` : `${w.done}/${w.of}`) : 'n/a'}</b></span>
              ))}
            </div>
          </div>
        ))}
        <p className="legend"><i className="cell done" /> done <i className="cell miss" /> missed <i className="cell off" /> rest day <i className="cell future" /> before you added it</p>
      </div>
    </div>
  );
}

// ─── Goals ───────────────────────────────────────────────────────────────────
// Keep earlier weeks scored at the old goal: the new goal starts this Monday.
function withGoalChange(h, v) {
  const thisMon = fmt(mondayOf(startOfDay(new Date())));
  const base = h.goalHistory && h.goalHistory.length ? h.goalHistory : [{ from: '0000-01-01', perWeek: h.perWeek }];
  return [...base.filter((e) => e.from !== thisMon), { from: thisMon, perWeek: v }];
}

function GoalsTab({ goals, setGoals, weekKey }) {
  const current = goals[weekKey] || ['', '', '', '', ''];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const has = current.some((g) => g.trim());
  const save = () => { setGoals((p) => ({ ...p, [weekKey]: draft })); setEditing(false); };
  return (
    <div className="card">
      <div className="row-between">
        <h2 className="card-title">Weekly goals</h2>
        {!editing && <button className="chip-btn" onClick={() => { setDraft([...current]); setEditing(true); }}>{has ? 'Edit' : 'Add'}</button>}
      </div>
      {editing ? (
        <div className="stack tight">
          {draft.map((g, i) => (
            <input key={i} className="input" placeholder={`Goal ${i + 1}`} value={g}
              onChange={(e) => { const n = [...draft]; n[i] = e.target.value; setDraft(n); }} />
          ))}
          <div className="row"><button className="btn pink" onClick={save}>Save</button><button className="btn" onClick={() => setEditing(false)}>Cancel</button></div>
        </div>
      ) : has ? (
        <ul className="goals">{current.filter((g) => g.trim()).map((g, i) => <li key={i}>{g}</li>)}</ul>
      ) : (
        <p className="hint">Set 3 to 5 goals to focus your week.</p>
      )}
    </div>
  );
}

// ─── Edit habits ─────────────────────────────────────────────────────────────
function FreqSelect({ value, onChange }) {
  return (
    <select className="input freq" value={value || 0} aria-label="How often" onChange={(e) => onChange(Number(e.target.value) || undefined)}>
      <option value={0}>Every day</option>
      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}x a week</option>)}
    </select>
  );
}

function HabitsEditor({ habits, setHabits, onClose, today }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [freq, setFreq] = useState(undefined);
  const active = habits.filter((h) => h.active);
  const archived = habits.filter((h) => !h.active);
  const update = (id, patch) => setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const move = (id, dir) => setHabits((hs) => {
    const act = hs.filter((h) => h.active), rest = hs.filter((h) => !h.active);
    const i = act.findIndex((h) => h.id === id), j = i + dir;
    if (j < 0 || j >= act.length) return hs;
    [act[i], act[j]] = [act[j], act[i]];
    return [...act, ...rest];
  });
  const add = () => {
    if (!name.trim()) return;
    setHabits((hs) => [...hs.filter((h) => h.active), { id: `h${Date.now()}`, name: name.trim(), icon: icon || '⭐', active: true, since: fmt(today), ...(freq ? { perWeek: freq } : {}) }, ...hs.filter((h) => !h.active)]);
    setName(''); setIcon('⭐'); setFreq(undefined);
  };
  return (
    <div className="sheet" role="dialog" aria-label="Edit habits">
      <div className="sheet-inner">
        <div className="row-between">
          <h2 className="card-title">Your habits</h2>
          <button className="btn pink" onClick={onClose}>Done</button>
        </div>
        <p className="hint">Set each one to every day or a weekly goal. Archiving keeps the history.</p>
        <div className="stack tight">
          {active.map((h, i) => (
            <div key={h.id} className="edit-row">
              <input className="input emoji" value={h.icon} maxLength={4} aria-label="Icon" onChange={(e) => update(h.id, { icon: e.target.value })} />
              <div className="name-freq">
                <input className="input" value={h.name} aria-label="Habit name" onChange={(e) => update(h.id, { name: e.target.value })} />
                <FreqSelect value={h.perWeek} onChange={(v) => update(h.id, { perWeek: v, goalHistory: withGoalChange(h, v) })} />
              </div>
              <div className="mini">
                <button onClick={() => move(h.id, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button onClick={() => move(h.id, 1)} disabled={i === active.length - 1} aria-label="Move down">↓</button>
                <button onClick={() => update(h.id, { active: false })} aria-label="Archive">✕</button>
              </div>
            </div>
          ))}
        </div>
        <h3 className="sub-title">Add a habit</h3>
        <div className="edit-row">
          <input className="input emoji" value={icon} maxLength={4} aria-label="New icon" onChange={(e) => setIcon(e.target.value)} />
          <div className="name-freq">
            <input className="input" placeholder="e.g. Stretch 10 min" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <FreqSelect value={freq} onChange={setFreq} />
          </div>
          <button className="btn yellow" onClick={add}>Add</button>
        </div>
        {archived.length > 0 && (
          <>
            <h3 className="sub-title">Archived</h3>
            <div className="stack tight">
              {archived.map((h) => (
                <div key={h.id} className="edit-row archived">
                  <span>{h.icon} {h.name}</span>
                  <button className="chip-btn" onClick={() => setHabits((hs) => [...hs.filter((x) => x.active), { ...h, active: true }, ...hs.filter((x) => !x.active && x.id !== h.id)])}>Bring back</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [completions, setCompletions] = usePersisted('ht_completions', {});
  const [goals, setGoals] = usePersisted('ht_goals', {});
  const [dismissedWeek, setDismissedWeek] = usePersisted('ht_dismissed', '');
  const [allHabits, setHabits] = usePersisted('ht_habits', initialHabits);
  const [presetDone, setPresetDone] = usePersisted('ht_preset_v2', false);
  useEffect(() => {
    if (!presetDone) { setHabits((hs) => applyPresetV2(hs, fmt(new Date()))); setPresetDone(true); }
  }, [presetDone, setHabits, setPresetDone]);
  const [goalFixDone, setGoalFixDone] = usePersisted('ht_goalfix_gym3', false);
  useEffect(() => {
    if (goalFixDone) return;
    setHabits((hs) => hs.map((h) => (h.id === 'gym' && h.perWeek === 3 && !h.goalHistory
      ? { ...h, goalHistory: [{ from: '0000-01-01', perWeek: 2 }, { from: '2026-11-09', perWeek: 3 }] } : h)));
    setGoalFixDone(true);
  }, [goalFixDone, setHabits, setGoalFixDone]);
  const [tab, setTab] = useState('today');
  const [editing, setEditing] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayStr = fmt(today);
  const weekKey = getWeekKey(today);
  const habits = allHabits.filter((h) => h.active);
  const doneCount = habits.filter((h) => completions[todayStr]?.includes(h.id)).length;
  const showReset = today.getDay() === 0 && dismissedWeek !== weekKey;

  const toggle = (day, id) => setCompletions((p) => {
    const list = p[day] || [];
    return { ...p, [day]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
  });

  return (
    <div className="app">
      <header className="hero">
        <Bolt className="bolt b1" /><Sparkle className="spark s1" /><Sparkle className="spark s2" />
        <div className="hero-top">
          <span className="date-pill">{today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <button className="gear" onClick={() => setEditing(true)}>⚙️ Habits</button>
        </div>
        <h1 className="title"><span>Rise</span><span className="amp">&amp;</span><span>Thrive</span></h1>
        <div className="today-count">
          <b>{doneCount}</b><span>of {habits.length} today</span>
          <div className="meter"><i style={{ width: `${habits.length ? (doneCount / habits.length) * 100 : 0}%` }} /></div>
        </div>
      </header>
      <div className="checker" aria-hidden="true" />

      {showReset && (
        <div className="card reset">
          <p><b>Sunday reset!</b> Check your Reality tab, then set this week's goals.</p>
          <div className="row">
            <button className="btn yellow" onClick={() => { setDismissedWeek(weekKey); setTab('reality'); }}>Reality check</button>
            <button className="btn" onClick={() => setDismissedWeek(weekKey)}>Later</button>
          </div>
        </div>
      )}

      <nav className="tabs">
        {[['today', 'Today'], ['week', 'Week'], ['reality', 'Reality'], ['goals', 'Goals']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      <main className="main">
        {tab === 'today' && <TodayTab habits={habits} completions={completions} toggle={toggle} today={today} />}
        {tab === 'week' && <WeekTab habits={habits} completions={completions} today={today} toggle={toggle} />}
        {tab === 'reality' && <RealityTab habits={habits} completions={completions} today={today} />}
        {tab === 'goals' && <GoalsTab goals={goals} setGoals={setGoals} weekKey={weekKey} />}
        <Squiggle />
        <p className="foot">Saved on this phone. Tip: Share › Add to Home Screen.</p>
      </main>

      {editing && <HabitsEditor habits={allHabits} setHabits={setHabits} onClose={() => setEditing(false)} today={today} />}
    </div>
  );
}

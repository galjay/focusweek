import './style.css';

const STORAGE_KEYS = {
  exams: 'focusweek:exams',
  focus: 'focusweek:focus',
};
const AUDIO_BASE_PATH = import.meta.env.BASE_URL;

const app = document.querySelector('#app');

const icons = {
  logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.8h11a2 2 0 0 1 2 2v12.4a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h5M8 16h7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.7 3.7 3.7-.7L18.5 8a2.5 2.5 0 0 0-3.5-3.5L4 16.5Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7l1-3h4l1 3"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7V5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V4m0 4h4"/><path d="M6 8a7 7 0 1 1-1 7"/></svg>',
  volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a8.5 8.5 0 0 1 0 11"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/></svg>',
};

const pad = (value) => String(value).padStart(2, '0');
const dateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function createDemoExams() {
  const now = new Date();
  const makeDate = (days, hours) => {
    const date = new Date(now.getTime() + (days * 24 + hours) * 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return date.toISOString();
  };
  return [
    { id: uid(), name: '高等数学', startsAt: makeDate(1, 5), color: 'violet' },
    { id: uid(), name: '大学英语', startsAt: makeDate(2, 20), color: 'cyan' },
    { id: uid(), name: '环境工程导论', startsAt: makeDate(4, 2), color: 'orange' },
  ];
}

function loadExams() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.exams));
    if (Array.isArray(saved)) return saved;
  } catch (error) {
    console.warn('无法读取考试数据，将使用示例数据。', error);
  }
  const demo = createDemoExams();
  localStorage.setItem(STORAGE_KEYS.exams, JSON.stringify(demo));
  return demo;
}

function defaultFocusState() {
  return {
    focusMinutes: 25,
    breakMinutes: 5,
    mode: 'focus',
    remaining: 25 * 60,
    running: false,
    cycles: 0,
    focusMinutesToday: 0,
    trackedDate: dateKey(),
  };
}

function loadFocusState() {
  const fallback = defaultFocusState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.focus));
    if (!saved) return fallback;
    const state = { ...fallback, ...saved, running: false };
    if (state.trackedDate !== dateKey()) {
      state.cycles = 0;
      state.focusMinutesToday = 0;
      state.trackedDate = dateKey();
    }
    state.remaining = Number.isFinite(state.remaining) && state.remaining > 0
      ? state.remaining
      : state.focusMinutes * 60;
    return state;
  } catch (error) {
    console.warn('无法读取专注数据，将从零开始。', error);
    return fallback;
  }
}

let exams = loadExams();
let focus = loadFocusState();
let timerId = null;
let editingExamId = null;
let noiseEngine = null;
let toastId = null;

function saveExams() {
  localStorage.setItem(STORAGE_KEYS.exams, JSON.stringify(exams));
}

function saveFocus() {
  localStorage.setItem(STORAGE_KEYS.focus, JSON.stringify({ ...focus, running: false }));
}

function sortedExams() {
  return [...exams].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

function activeExams() {
  return sortedExams().filter((exam) => new Date(exam.startsAt).getTime() > Date.now());
}

function nextExam() {
  return activeExams()[0] || null;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date)}`;
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCountdown(target) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return { main: `${days}天`, sub: `${hours}小时`, tone: 'normal', label: `${days}天 ${hours}小时` };
  if (hours > 0) return { main: `${hours}小时`, sub: `${minutes}分钟`, tone: 'urgent', label: `${hours}小时 ${minutes}分钟` };
  if (minutes > 0) return { main: `${minutes}分钟`, sub: '准备进入冲刺', tone: 'critical', label: `${minutes}分钟` };
  return { main: '不足 1 分钟', sub: '最后检查', tone: 'critical', label: '不足 1 分钟' };
}

function examStatus(exam, index) {
  const diff = new Date(exam.startsAt).getTime() - Date.now();
  if (diff <= 0) return { label: '已完成', className: 'done' };
  const countdown = formatCountdown(exam.startsAt);
  if (index === 0) return { label: '下一场', className: countdown.tone };
  return { label: countdown.label, className: 'future' };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderShell() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#top" aria-label="FocusWeek 首页">
          <span class="brand-mark">${icons.logo}</span>
          <span>Focus<span>Week</span></span>
        </a>
        <div class="topbar-right">
          <span class="local-status"><i></i> 本地模式</span>
          <span class="today-label" id="todayLabel"></span>
          <button class="icon-button" id="addExamTop" aria-label="新增考试" title="新增考试">${icons.plus}</button>
        </div>
      </header>

      <main id="top">
        <section class="intro-row">
          <div>
            <p class="eyebrow">考试周工作台 <span>·</span> 只看下一步</p>
            <h1>把混乱的考试周，<em>变成清晰的现在。</em></h1>
            <p class="intro-copy">打开就知道下一场考试是什么、还剩多久，以及此刻该把时间交给哪一门。</p>
          </div>
          <div class="quick-note">
            <span class="note-kicker">TODAY'S FOCUS</span>
            <strong id="headlineFocus">0 分钟</strong>
            <span>专注不是多做一点，是知道先做什么。</span>
          </div>
        </section>

        <section class="hero-grid">
          <article class="next-exam-card" id="nextExamCard"></article>
          <article class="focus-card" id="focusCard"></article>
        </section>

        <section class="lower-grid">
          <article class="panel timeline-panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">YOUR SCHEDULE</p>
                <h2>考试时间轴</h2>
              </div>
              <button class="text-button" id="addExamButton">${icons.plus} 添加考试</button>
            </div>
            <div class="timeline" id="timeline"></div>
          </article>

          <div class="side-stack">
            <article class="panel stats-panel">
              <div class="panel-header compact">
                <div><p class="eyebrow">TODAY</p><h2>今日专注</h2></div>
                <span class="round-check">✓</span>
              </div>
              <div class="focus-stats" id="focusStats"></div>
              <div class="stats-progress"><span id="statsProgressBar"></span></div>
              <p class="muted-line">目标 4 个周期 · 每次完成都会自动记入</p>
            </article>

            <article class="panel noise-panel">
              <div class="panel-header compact">
                <div><p class="eyebrow">AMBIENCE</p><h2>环境音</h2></div>
                <button class="noise-toggle" id="noiseToggle" aria-pressed="false">OFF</button>
              </div>
              <div class="noise-options" id="noiseOptions">
                <button class="noise-option active" data-noise="rain"><span>⌁</span>雨声</button>
                <button class="noise-option" data-noise="cafe"><span>◌</span>咖啡馆</button>
                <button class="noise-option" data-noise="forest"><span>⌁</span>森林</button>
                <button class="noise-option" data-noise="waves"><span>≈</span>海浪</button>
              </div>
              <label class="volume-control"><span>${icons.volume}</span><input id="noiseVolume" type="range" min="0" max="100" value="38" aria-label="环境音音量" /><span class="volume-value" id="volumeValue">38%</span></label>
              <p class="muted-line">本地高质量音频 · 不上传任何数据</p>
            </article>
          </div>
        </section>
      </main>

      <footer class="footer"><span>FocusWeek / exam focus desk</span><span>数据仅保存在当前浏览器 localStorage</span></footer>
    </div>

    <div class="modal-backdrop" id="examModal" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-header"><div><p class="eyebrow">EXAM PLAN</p><h2 id="modalTitle">新增考试</h2></div><button class="close-button" id="closeModal" aria-label="关闭">×</button></div>
        <form id="examForm">
          <label class="form-field"><span>考试名称</span><input name="name" required maxlength="40" placeholder="例如：高等数学" /></label>
          <label class="form-field"><span>考试日期与时间</span><input name="startsAt" type="datetime-local" required /></label>
          <p class="form-hint">考试时间一到，系统会自动将它标记为已完成，并切换下一场倒计时。</p>
          <div class="modal-actions"><button type="button" class="secondary-button" id="cancelModal">取消</button><button type="submit" class="primary-button">保存考试</button></div>
        </form>
      </div>
    </div>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;
}

function renderToday() {
  const today = new Date();
  document.querySelector('#todayLabel').textContent = `${today.getMonth() + 1}月${today.getDate()}日 · ${new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(today)}`;
  document.querySelector('#headlineFocus').textContent = `${focus.focusMinutesToday} 分钟`;
}

function renderNextExam() {
  const card = document.querySelector('#nextExamCard');
  const exam = nextExam();
  if (!exam) {
    card.innerHTML = `<div class="empty-hero"><span class="empty-icon">${icons.calendar}</span><p class="eyebrow">ALL CLEAR</p><h2>暂时没有待考科目</h2><p>把下一场考试放进来，工作台会替你守住节奏。</p><button class="primary-button" id="addExamEmpty">${icons.plus} 添加第一场考试</button></div>`;
    document.querySelector('#addExamEmpty')?.addEventListener('click', () => openExamModal());
    return;
  }
  const countdown = formatCountdown(exam.startsAt);
  card.innerHTML = `
    <div class="card-glow"></div>
    <div class="hero-card-top"><span class="status-pill ${countdown.tone}"><i></i> 下一场考试</span><button class="more-button" id="editNextExam" aria-label="编辑下一场考试">${icons.edit}</button></div>
    <div class="hero-subject"><span class="subject-dot ${exam.color || 'violet'}"></span><span>${escapeHtml(exam.name)}</span></div>
    <div class="countdown-wrap"><span class="countdown-main">${countdown.main}</span><span class="countdown-sub">${countdown.sub}</span></div>
    <div class="hero-meta"><span>${icons.calendar} ${formatDate(exam.startsAt)}</span><b>${formatTime(exam.startsAt)}</b><span class="hero-separator">/</span><span>${activeExams().length} 场待考</span></div>
    <div class="hero-footer"><span>现在优先复习</span><strong>${escapeHtml(exam.name)}</strong><button class="arrow-button" id="focusNextExam" aria-label="开始专注">→</button></div>
  `;
  document.querySelector('#editNextExam')?.addEventListener('click', () => openExamModal(exam.id));
  document.querySelector('#focusNextExam')?.addEventListener('click', () => {
    document.querySelector('#focusCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`已把专注目标放在「${exam.name}」`);
  });
}

function renderTimeline() {
  const timeline = document.querySelector('#timeline');
  const ordered = sortedExams();
  if (!ordered.length) {
    timeline.innerHTML = '<div class="empty-state"><span>⌁</span><p>还没有考试安排，先添加一场。</p></div>';
    return;
  }
  const futureIndex = ordered.findIndex((exam) => new Date(exam.startsAt).getTime() > Date.now());
  timeline.innerHTML = ordered.map((exam, index) => {
    const done = new Date(exam.startsAt).getTime() <= Date.now();
    const status = examStatus(exam, futureIndex === -1 ? ordered.length : futureIndex === index ? 0 : 1);
    return `<div class="timeline-item ${done ? 'completed' : index === futureIndex ? 'is-next' : ''}">
      <div class="timeline-rail"><span class="timeline-dot ${done ? 'done' : exam.color || 'violet'}">${done ? '✓' : ''}</span>${index < ordered.length - 1 ? '<span class="timeline-line"></span>' : ''}</div>
      <div class="timeline-content"><div class="timeline-main"><div><strong>${escapeHtml(exam.name)}</strong><span>${formatDate(exam.startsAt)} · ${formatTime(exam.startsAt)}</span></div><span class="timeline-badge ${status.className}">${status.label}</span></div>
      <div class="timeline-actions"><span class="timeline-note">${done ? '这场考试已从主倒计时中移出' : index === futureIndex ? '当前最值得分配专注时间' : '按时间顺序排队中'}</span><button class="small-icon" data-edit="${exam.id}" aria-label="编辑 ${escapeHtml(exam.name)}">${icons.edit}</button><button class="small-icon danger" data-delete="${exam.id}" aria-label="删除 ${escapeHtml(exam.name)}">${icons.trash}</button></div></div>
    </div>`;
  }).join('');
  timeline.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openExamModal(button.dataset.edit)));
  timeline.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteExam(button.dataset.delete)));
}

function renderFocusCard() {
  const card = document.querySelector('#focusCard');
  const total = focus.mode === 'focus' ? focus.focusMinutes * 60 : focus.breakMinutes * 60;
  const percent = Math.max(0, Math.min(100, (1 - focus.remaining / total) * 100));
  const modeLabel = focus.mode === 'focus' ? '专注模式' : '休息模式';
  card.innerHTML = `
    <div class="focus-card-top"><div><p class="eyebrow">FOCUS TIMER</p><h2>专注一下，剩下的交给时间。</h2></div><span class="timer-mode ${focus.mode}"><i></i>${modeLabel}</span></div>
    <div class="timer-display"><span id="timerDisplay">${formatTimer(focus.remaining)}</span><span class="timer-caption">${focus.running ? '正在运行' : '准备开始'}</span></div>
    <div class="timer-progress"><span id="timerProgress" style="width:${percent}%"></span></div>
    <div class="timer-controls"><button class="timer-main-button ${focus.running ? 'is-running' : ''}" id="timerStart">${focus.running ? icons.pause : icons.play}<span>${focus.running ? '暂停' : '开始专注'}</span></button><button class="reset-button" id="timerReset">${icons.reset} 重置</button></div>
    <div class="timer-settings"><label><span>专注</span><input id="focusMinutesInput" type="number" min="1" max="180" value="${focus.focusMinutes}" /><b>分钟</b></label><span class="setting-divider">/</span><label><span>休息</span><input id="breakMinutesInput" type="number" min="1" max="60" value="${focus.breakMinutes}" /><b>分钟</b></label><span class="setting-hint">完成一轮后自动切换</span></div>
  `;
  document.querySelector('#timerStart').addEventListener('click', toggleTimer);
  document.querySelector('#timerReset').addEventListener('click', resetTimer);
  document.querySelector('#focusMinutesInput').addEventListener('input', updateTimerSettings);
  document.querySelector('#breakMinutesInput').addEventListener('input', updateTimerSettings);
}

function renderFocusStats() {
  const cycles = document.querySelector('#focusStats');
  cycles.innerHTML = `<div class="big-stat"><strong>${focus.cycles}</strong><span>完成周期</span></div><div class="stat-divider"></div><div class="big-stat"><strong>${focus.focusMinutesToday}</strong><span>专注分钟</span></div>`;
  const percentage = Math.min(100, (focus.cycles / 4) * 100);
  document.querySelector('#statsProgressBar').style.width = `${percentage}%`;
  document.querySelector('#headlineFocus').textContent = `${focus.focusMinutesToday} 分钟`;
}

function renderAll() {
  renderToday();
  renderNextExam();
  renderTimeline();
  renderFocusCard();
  renderFocusStats();
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(safeSeconds / 60))}:${pad(safeSeconds % 60)}`;
}

function updateTimerDisplay() {
  const total = focus.mode === 'focus' ? focus.focusMinutes * 60 : focus.breakMinutes * 60;
  const percent = Math.max(0, Math.min(100, (1 - focus.remaining / total) * 100));
  const display = document.querySelector('#timerDisplay');
  const progress = document.querySelector('#timerProgress');
  if (display) display.textContent = formatTimer(focus.remaining);
  if (progress) progress.style.width = `${percent}%`;
}

function toggleTimer() {
  if (focus.running) {
    pauseTimer();
    return;
  }
  focus.running = true;
  if (focus.mode === 'focus') unlockAudio();
  timerId = window.setInterval(tickTimer, 1000);
  renderFocusCard();
  showToast(focus.mode === 'focus' ? '专注计时已开始，先把下一步做完。' : '休息开始，离开屏幕一会儿。');
}

function pauseTimer() {
  focus.running = false;
  window.clearInterval(timerId);
  timerId = null;
  saveFocus();
  renderFocusCard();
  showToast('计时已暂停，准备好时继续。');
}

function resetTimer() {
  focus.running = false;
  window.clearInterval(timerId);
  timerId = null;
  focus.mode = 'focus';
  focus.remaining = focus.focusMinutes * 60;
  saveFocus();
  renderFocusCard();
  showToast('计时已重置。');
}

function tickTimer() {
  focus.remaining -= 1;
  if (focus.remaining <= 0) {
    completeTimerSegment();
  }
  updateTimerDisplay();
  if (focus.remaining % 5 === 0) saveFocus();
}

function completeTimerSegment() {
  playBeep();
  if (focus.mode === 'focus') {
    focus.cycles += 1;
    focus.focusMinutesToday += focus.focusMinutes;
    focus.mode = 'break';
    focus.remaining = focus.breakMinutes * 60;
    showToast(`第 ${focus.cycles} 个专注周期完成，休息 ${focus.breakMinutes} 分钟。`);
  } else {
    focus.mode = 'focus';
    focus.remaining = focus.focusMinutes * 60;
    showToast('休息结束，准备进入下一轮专注。');
  }
  saveFocus();
  renderFocusCard();
  renderFocusStats();
}

function updateTimerSettings() {
  const focusInput = document.querySelector('#focusMinutesInput');
  const breakInput = document.querySelector('#breakMinutesInput');
  if (!focusInput || !breakInput) return;
  const nextFocus = Math.max(1, Math.min(180, Number(focusInput.value) || focus.focusMinutes));
  const nextBreak = Math.max(1, Math.min(60, Number(breakInput.value) || focus.breakMinutes));
  focus.focusMinutes = nextFocus;
  focus.breakMinutes = nextBreak;
  if (!focus.running) {
    focus.mode = 'focus';
    focus.remaining = nextFocus * 60;
  }
  saveFocus();
  updateTimerDisplay();
}

function unlockAudio() {
  if (!noiseEngine) noiseEngine = new NoiseEngine();
}

function playBeep() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.48);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  } catch (error) {
    console.warn('提示音暂不可用。', error);
  }
}

class NoiseEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = 0.38;
  }

  play(type = 'rain') {
    const nextSource = `${AUDIO_BASE_PATH}audio/${type}.ogg`;
    if (this.audio.src !== new URL(nextSource, window.location.href).href) {
      this.audio.src = nextSource;
      this.audio.load();
    }
    this.audio.volume = Number(document.querySelector('#noiseVolume')?.value || 38) / 100;
    this.audio.play().catch((error) => {
      console.warn('本地环境音播放失败。', error);
      showToast('音频暂时无法播放，请再次点击环境音开关。');
    });
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setVolume(value) {
    this.audio.volume = Number(value) / 100;
  }
}

function toggleNoise() {
  const toggle = document.querySelector('#noiseToggle');
  const isOn = toggle.getAttribute('aria-pressed') === 'true';
  const next = !isOn;
  toggle.setAttribute('aria-pressed', String(next));
  toggle.textContent = next ? 'ON' : 'OFF';
  if (next) {
    unlockAudio();
    noiseEngine?.play(document.querySelector('.noise-option.active')?.dataset.noise || 'rain');
    showToast('环境音已开启。');
  } else {
    noiseEngine?.stop();
    showToast('环境音已关闭。');
  }
}

function selectNoise(button) {
  document.querySelectorAll('.noise-option').forEach((option) => option.classList.remove('active'));
  button.classList.add('active');
  const toggle = document.querySelector('#noiseToggle');
  if (toggle.getAttribute('aria-pressed') === 'true') noiseEngine?.play(button.dataset.noise);
}

function openExamModal(id = null) {
  editingExamId = id;
  const modal = document.querySelector('#examModal');
  const form = document.querySelector('#examForm');
  const title = document.querySelector('#modalTitle');
  const exam = exams.find((item) => item.id === id);
  title.textContent = exam ? '编辑考试' : '新增考试';
  form.elements.name.value = exam?.name || '';
  form.elements.startsAt.value = exam ? toLocalInputValue(exam.startsAt) : toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
  modal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => form.elements.name.focus(), 0);
}

function closeExamModal() {
  document.querySelector('#examModal').hidden = true;
  document.body.classList.remove('modal-open');
  editingExamId = null;
}

function toLocalInputValue(dateString) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function submitExam(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const startsAt = new Date(form.elements.startsAt.value);
  if (!name || Number.isNaN(startsAt.getTime())) return;
  if (editingExamId) {
    exams = exams.map((exam) => exam.id === editingExamId ? { ...exam, name, startsAt: startsAt.toISOString() } : exam);
    showToast(`「${name}」已更新。`);
  } else {
    const colors = ['violet', 'cyan', 'orange'];
    exams.push({ id: uid(), name, startsAt: startsAt.toISOString(), color: colors[exams.length % colors.length] });
    showToast(`「${name}」已加入考试时间轴。`);
  }
  saveExams();
  closeExamModal();
  renderAll();
}

function deleteExam(id) {
  const exam = exams.find((item) => item.id === id);
  if (!exam) return;
  if (!window.confirm(`删除「${exam.name}」？`)) return;
  exams = exams.filter((item) => item.id !== id);
  saveExams();
  renderAll();
  showToast(`「${exam.name}」已删除。`);
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  window.clearTimeout(toastId);
  toast.textContent = message;
  toast.classList.add('visible');
  toastId = window.setTimeout(() => toast.classList.remove('visible'), 2400);
}

function bindEvents() {
  document.querySelector('#addExamTop').addEventListener('click', () => openExamModal());
  document.querySelector('#addExamButton').addEventListener('click', () => openExamModal());
  document.querySelector('#closeModal').addEventListener('click', closeExamModal);
  document.querySelector('#cancelModal').addEventListener('click', closeExamModal);
  document.querySelector('#examModal').addEventListener('click', (event) => {
    if (event.target.id === 'examModal') closeExamModal();
  });
  document.querySelector('#examForm').addEventListener('submit', submitExam);
  document.querySelector('#noiseToggle').addEventListener('click', toggleNoise);
  document.querySelectorAll('.noise-option').forEach((button) => button.addEventListener('click', () => selectNoise(button)));
  document.querySelector('#noiseVolume').addEventListener('input', (event) => {
    document.querySelector('#volumeValue').textContent = `${event.target.value}%`;
    noiseEngine?.setVolume(event.target.value);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.querySelector('#examModal').hidden) closeExamModal();
  });
}

renderShell();
bindEvents();
renderAll();

window.setInterval(() => {
  renderNextExam();
  renderTimeline();
}, 1000);

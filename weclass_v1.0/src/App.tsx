import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, RefreshCw, Save, Heart, User, Users, ChevronLeft, ChevronRight, Plus, Trash2, X, Clock, Book, Palette, Flag, AlignLeft, Calendar, User as UserIcon, MapPin, Edit2, Download, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, TimetableData, ViewMode, SemesterConfig, PeriodTime, WeekType } from './types';
import { parseICS } from './utils/icsParser';

const PERIOD_HEIGHT = 64; // px

const DEFAULT_PERIODS: PeriodTime[] = [
  { num: 1, startTime: '08:00', endTime: '08:45', duration: 45 },
  { num: 2, startTime: '08:55', endTime: '09:40', duration: 45 },
  { num: 3, startTime: '10:00', endTime: '10:45', duration: 45 },
  { num: 4, startTime: '10:55', endTime: '11:40', duration: 45 },
  { num: 5, startTime: '14:30', endTime: '15:15', duration: 45 },
  { num: 6, startTime: '15:25', endTime: '16:10', duration: 45 },
  { num: 7, startTime: '16:30', endTime: '17:15', duration: 45 },
  { num: 8, startTime: '17:25', endTime: '18:10', duration: 45 },
  { num: 9, startTime: '19:00', endTime: '19:45', duration: 45 },
  { num: 10, startTime: '19:55', endTime: '20:40', duration: 45 },
  { num: 11, startTime: '20:50', endTime: '21:35', duration: 45 },
  { num: 12, startTime: '21:45', endTime: '22:30', duration: 45 },
];

const COLORS = ['#BDE0FE', '#FFC8DD', '#CDB4DB', '#A2D2FF', '#FFAFCC', '#FFFFB7', '#E2F0CB', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'];

const getRecentMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
};

const DEFAULT_DATA: TimetableData = {
  config: {
    startDate: getRecentMonday(),
    periods: DEFAULT_PERIODS,
    timeMode: 'manual',
    backgroundImage: '',
  },
  user1: [
    { id: '1', name: '马克思主义基本原理', dayOfWeek: 2, startPeriod: 1, endPeriod: 2, room: '教1-101', color: '#BDE0FE', startWeek: 1, endWeek: 16, weekType: 'all' },
    { id: '2', name: '单片机原理与应用', dayOfWeek: 1, startPeriod: 3, endPeriod: 4, room: '教2-201', color: '#BDE0FE', startWeek: 1, endWeek: 16, weekType: 'all' },
    { id: '3', name: '双创实务', dayOfWeek: 1, startPeriod: 9, endPeriod: 10, room: '创客空间', color: '#BDE0FE', startWeek: 1, endWeek: 8, weekType: 'all' },
    { id: '4', name: '数字电子技术', dayOfWeek: 2, startPeriod: 3, endPeriod: 4, room: '教3-301', color: '#BDE0FE', startWeek: 1, endWeek: 16, weekType: 'all' },
  ],
  user2: [
    { id: '5', name: '食品微生物学', dayOfWeek: 3, startPeriod: 1, endPeriod: 2, room: '实1-101', color: '#FFC8DD', startWeek: 1, endWeek: 16, weekType: 'all' },
    { id: '6', name: '食品质量与安全', dayOfWeek: 2, startPeriod: 3, endPeriod: 4, room: '实2-201', color: '#FFC8DD', startWeek: 1, endWeek: 16, weekType: 'all' },
    { id: '7', name: '食品化学', dayOfWeek: 4, startPeriod: 7, endPeriod: 8, room: '实3-301', color: '#FFC8DD', startWeek: 1, endWeek: 16, weekType: 'all' },
    { id: '8', name: '食品生物技术导论', dayOfWeek: 3, startPeriod: 7, endPeriod: 8, room: '实4-401', color: '#FFC8DD', startWeek: 1, endWeek: 16, weekType: 'all' },
  ]
};

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const getWeekNumber = (startDateStr: string, targetDate: Date = new Date()) => {
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 0; // Not started yet
  return Math.max(1, Math.floor(days / 7) + 1);
};

const getDatesForWeek = (startDateStr: string, weekNum: number) => {
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const isCourseActive = (course: Course, week: number) => {
  if (week < course.startWeek || week > course.endWeek) return false;
  if (course.weekType === 'odd' && week % 2 === 0) return false;
  if (course.weekType === 'even' && week % 2 !== 0) return false;
  return true;
};

const getDisplayCourse = (courses: Course[], week: number) => {
  if (courses.length === 0) return null;
  const active = courses.find(c => isCourseActive(c, week));
  if (active) return { course: active, isActive: true };
  return { course: courses[0], isActive: false };
};

const calculateEndTime = (startTime: string, durationMins: number) => {
  if (!startTime) return '';
  const [h, m] = startTime.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + durationMins);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

type ModalState = {
  isOpen: boolean;
  mode: 'add' | 'edit' | 'details';
  owner: 'user1' | 'user2';
  course: Partial<Course>;
};

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('couple');
  const [data, setData] = useState<TimetableData>(() => {
    const cached = localStorage.getItem('TIMETABLE_DATA');
    return cached ? JSON.parse(cached) : DEFAULT_DATA;
  });
  const [viewingWeek, setViewingWeek] = useState(1);
  const [swipeDir, setSwipeDir] = useState(0);
  
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'sync' | 'semester' | 'time' | 'appearance'>('sync');
  
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, mode: 'add', owner: 'user1', course: {} });

  const [githubToken, setGithubToken] = useState(localStorage.getItem('GITHUB_TOKEN') || '');
  const [gistId, setGistId] = useState(localStorage.getItem('GIST_ID') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [importData, setImportData] = useState<{ courses: Course[], newPeriods?: PeriodTime[] } | null>(null);
  const [importTarget, setImportTarget] = useState<'user1' | 'user2'>('user1');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    try {
      localStorage.setItem('TIMETABLE_DATA', JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
      showToast("保存到本地缓存失败，可能是图片太大。");
    }
  }, [data]);

  useEffect(() => {
    const currentWeek = getWeekNumber(data.config.startDate);
    setViewingWeek(currentWeek);
  }, [data.config.startDate]);

  useEffect(() => {
    if (githubToken && gistId) {
      fetchTimetable();
    }
  }, []);

  const migrateData = (parsed: any): TimetableData => {
    const migrateCourse = (c: any): Course => ({
      ...c,
      startWeek: c.startWeek || 1,
      endWeek: c.endWeek || 20,
      weekType: c.weekType || 'all',
    });
    return {
      config: parsed.config || { startDate: getRecentMonday(), periods: DEFAULT_PERIODS, timeMode: 'manual' },
      user1: (parsed.user1 || []).map(migrateCourse),
      user2: (parsed.user2 || []).map(migrateCourse),
    };
  };

  const fetchTimetable = async () => {
    if (!githubToken || !gistId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!response.ok) throw new Error('获取数据失败，请检查配置');
      const result = await response.json();
      const content = result.files['timetable.json']?.content;
      if (content) {
        setData(migrateData(JSON.parse(content)));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncTimetable = async () => {
    if (!githubToken || !gistId) {
      setError('请先配置 GitHub Token 和 Gist ID');
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'timetable.json': {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });
      if (!response.ok) throw new Error('同步失败，请检查配置和权限');
      showToast('同步成功！');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('GITHUB_TOKEN', githubToken);
    localStorage.setItem('GIST_ID', gistId);
    setShowSettings(false);
    syncTimetable();
  };

  const handlePrevWeek = () => {
    setSwipeDir(-1);
    setViewingWeek(w => Math.max(0, w - 1));
  };

  const handleNextWeek = () => {
    setSwipeDir(1);
    setViewingWeek(w => Math.min(25, w + 1));
  };

  const handleImportICS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }
    
    console.log("File selected:", file.name, file.size);
    const target = e.target;
    const reader = new FileReader();
    
    reader.onload = (event) => {
      console.log("FileReader loaded");
      try {
        const icsData = event.target?.result as string;
        console.log("ICS Data length:", icsData.length);
        
        const result = parseICS(icsData, data.config.periods, data.config.startDate);
        console.log("Parsed courses:", result.courses);
        
        if (result.courses.length > 0) {
          setImportData({ courses: result.courses as Course[], newPeriods: result.newPeriods });
        } else {
          showToast('未能从文件中解析出课程信息，请检查文件格式。');
        }
      } catch (err: any) {
        console.error("Parse error:", err);
        showToast('解析失败: ' + err.message);
      } finally {
        target.value = ''; // Reset input so same file can be selected again
      }
    };
    
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      showToast("读取文件失败");
      target.value = '';
    };
    
    reader.readAsText(file);
  };

  const weekDates = useMemo(() => getDatesForWeek(data.config.startDate, viewingWeek), [data.config.startDate, viewingWeek]);
  const currentMonth = weekDates[0].getMonth() + 1;

  const handleEmptyClick = (day: number, period: number) => {
    const owner = viewMode === 'theirs' ? 'user2' : 'user1';
    setModalState({
      isOpen: true,
      mode: 'add',
      owner,
      course: {
        id: Date.now().toString(),
        name: '',
        room: '',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        dayOfWeek: day,
        startPeriod: period,
        endPeriod: period,
        startWeek: 1,
        endWeek: 20,
        weekType: 'all'
      }
    });
  };

  const handleCourseClick = (course: Course, owner: 'user1' | 'user2') => {
    setModalState({
      isOpen: true,
      mode: 'details',
      owner,
      course: { ...course }
    });
  };

  const saveCourse = () => {
    const { owner, course, mode } = modalState;
    if (!course.name) return showToast('请输入课程名称');
    
    const newCourse = course as Course;
    const newData = { ...data };
    
    if (mode === 'add') {
      newData[owner].push(newCourse);
    } else {
      const index = newData[owner].findIndex(c => c.id === newCourse.id);
      if (index !== -1) newData[owner][index] = newCourse;
    }
    
    setData(newData);
    setModalState({ ...modalState, isOpen: false });
    // Auto sync after saving
    if (githubToken && gistId) {
      setTimeout(syncTimetable, 500);
    }
  };

  const deleteCourse = () => {
    setConfirmDialog({
      message: '确定要删除这门课吗？',
      onConfirm: () => {
        const { owner, course } = modalState;
        const newData = { ...data };
        newData[owner] = newData[owner].filter(c => c.id !== course.id);
        setData(newData);
        setModalState({ ...modalState, isOpen: false });
        if (githubToken && gistId) {
          setTimeout(syncTimetable, 500);
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleTabClick = (mode: ViewMode) => {
    if (viewMode === mode) {
      // Already on this tab, jump to current week
      const currentWeek = getWeekNumber(data.config.startDate);
      setViewingWeek(currentWeek);
      showToast('已回到本周');
    } else {
      setViewMode(mode);
    }
  };

  const renderCoursesForDay = (day: number) => {
    const columnDate = weekDates[day - 1];
    const dateStr = `${columnDate.getFullYear()}-${String(columnDate.getMonth() + 1).padStart(2, '0')}-${String(columnDate.getDate()).padStart(2, '0')}`;

    const myCourses = data.user1.filter(c => c.isTemporary ? c.date === dateStr : c.dayOfWeek === day).map(c => ({ ...c, owner: 'user1' as const }));
    const theirCourses = data.user2.filter(c => c.isTemporary ? c.date === dateStr : c.dayOfWeek === day).map(c => ({ ...c, owner: 'user2' as const }));

    let coursesToProcess: (Course & { owner: 'user1' | 'user2' })[] = [];
    if (viewMode === 'mine') coursesToProcess = myCourses;
    else if (viewMode === 'theirs') coursesToProcess = theirCourses;
    else coursesToProcess = [...myCourses, ...theirCourses];

    const coursesToRender = [];

    for (let i = 0; i < coursesToProcess.length; i++) {
      const c = coursesToProcess[i];
      const isActive = c.isTemporary ? c.date === dateStr : isCourseActive(c, viewingWeek);
      if (!isActive && viewMode === 'couple') continue; // Hide inactive courses in couple mode to reduce clutter
      if (!isActive && viewingWeek > c.endWeek) continue; // Hide finished courses

      // Find overlapping courses that are also going to be rendered
      const overlapping = coursesToProcess.filter(other => {
        if (other.id === c.id && other.owner === c.owner) return false;
        const otherActive = other.isTemporary ? other.date === dateStr : isCourseActive(other, viewingWeek);
        if (!otherActive && viewMode === 'couple') return false;
        if (!otherActive && viewingWeek > other.endWeek) return false;
        
        return !(c.endPeriod < other.startPeriod || c.startPeriod > other.endPeriod);
      });

      let shouldRender = true;
      let groupSize = 1;
      let indexInGroup = 0;
      let hasConflict = false;

      const getScore = (x: Course) => {
        const active = x.isTemporary ? x.date === dateStr : isCourseActive(x, viewingWeek);
        if (active) return 0;
        if (viewingWeek < x.startWeek) return x.startWeek - viewingWeek;
        return 1; // wrong even/odd week
      };

      if (viewMode === 'couple') {
        // In couple mode, we NEVER side-by-side same owner courses. We pick the best one.
        const sameOwnerOverlapping = overlapping.filter(o => o.owner === c.owner);
        if (sameOwnerOverlapping.length > 0) {
           const myScore = getScore(c);
           const betterCourse = sameOwnerOverlapping.find(o => {
             const oScore = getScore(o);
             if (oScore < myScore) return true;
             if (oScore === myScore) {
               const myDur = c.endPeriod - c.startPeriod;
               const oDur = o.endPeriod - o.startPeriod;
               if (oDur > myDur) return true;
               if (oDur === myDur && o.id < c.id) return true;
             }
             return false;
           });
           if (betterCourse) shouldRender = false;
        }

        if (shouldRender) {
          // Check overlapping from OTHER owner for side-by-side
          const otherOwnerOverlapping = overlapping.filter(o => o.owner !== c.owner);
          if (otherOwnerOverlapping.length > 0) {
            groupSize = 2;
            indexInGroup = c.owner === 'user1' ? 0 : 1;
          }
        }
      } else {
        // Single mode: NO side-by-side at all. Pick the best course among ALL overlapping courses.
        const myScore = getScore(c);
        const betterCourse = overlapping.find(o => {
          const oScore = getScore(o);
          if (oScore < myScore) return true;
          if (oScore === myScore) {
            const myDur = c.endPeriod - c.startPeriod;
            const oDur = o.endPeriod - o.startPeriod;
            if (oDur > myDur) return true;
            if (oDur === myDur && o.id < c.id) return true;
          }
          return false;
        });
        if (betterCourse) shouldRender = false;
        
        // Conflict detection only in single mode
        if (shouldRender && isActive) {
          const activeOverlapping = overlapping.filter(o => o.isTemporary ? o.date === dateStr : isCourseActive(o, viewingWeek));
          if (activeOverlapping.length > 0) {
            hasConflict = true;
          }
        }
      }

      if (!shouldRender) continue;

      const widthPercent = 100 / groupSize;
      const width = groupSize > 1 ? `calc(${widthPercent}% - 2px)` : 'calc(100% - 4px)';
      const left = groupSize > 1 ? `calc(${indexInGroup * widthPercent}% + 1px)` : '2px';

      const top = (c.startPeriod - 1) * PERIOD_HEIGHT;
      const height = (c.endPeriod - c.startPeriod + 1) * PERIOD_HEIGHT;

      const fontSize = data.config.courseFontSize ?? 10;
      const showTime = data.config.showCourseTime ?? true;
      const showName = data.config.showCourseName ?? true;
      const showRoom = data.config.showCourseRoom ?? true;
      const showTeacher = data.config.showCourseTeacher ?? true;

      const textColorClass = 'text-white';
      
      let bgColor = c.color;
      if (viewMode === 'couple') {
        bgColor = c.owner === 'user1' 
          ? (data.config.user1Color || '#60A5FA') // default blue-400
          : (data.config.user2Color || '#F472B6'); // default pink-400
      } else if (hasConflict) {
        bgColor = '#EF4444'; // red-500
      } else if (!isActive) {
        bgColor = undefined; // will use grayscale bg-gray-400 from classes
      }

      coursesToRender.push(
        <div 
          key={`${c.owner}-${c.id}`}
          onClick={(e) => { e.stopPropagation(); handleCourseClick(c, c.owner); }}
          className={`absolute rounded-md p-1 flex flex-col items-start justify-start text-left shadow-sm transition-all cursor-pointer hover:brightness-95 overflow-hidden ${isActive ? '' : 'opacity-50 grayscale bg-gray-400'} ${textColorClass} ${hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
          style={{ 
            top: `${top + 1}px`, 
            height: `${height - 2}px`, 
            width, 
            left,
            backgroundColor: bgColor,
            zIndex: isActive ? (hasConflict ? 20 : 10) : 5,
            fontSize: `${fontSize}px`,
            lineHeight: 1.2
          }}
        >
          {viewMode === 'couple' ? (
            <span className="font-medium w-full break-words" style={{ display: '-webkit-box', WebkitLineClamp: Math.floor((height - 4) / (fontSize * 1.2)), WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.name}</span>
          ) : (
            <div className="flex flex-col gap-[2px] w-full h-full overflow-hidden">
              {hasConflict && <span className="font-bold bg-white/30 px-1 rounded-sm w-fit mb-0.5 shrink-0 text-red-100">时间冲突</span>}
              {!isActive && <span className="font-bold bg-white/30 px-1 rounded-sm w-fit mb-0.5 shrink-0">[非本周]</span>}
              {showTime && <span className="font-bold tracking-wider bg-white/20 px-1 rounded-sm w-fit shrink-0">{data.config.periods.find(p => p.num === c.startPeriod)?.startTime}</span>}
              {showName && <span className="font-bold break-words shrink-0" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.name}</span>}
              {showRoom && c.room && <span className="break-words opacity-90 shrink-0" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>@{c.room}</span>}
              {showTeacher && c.teacher && <span className="break-words opacity-90 shrink-0" style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.teacher}</span>}
            </div>
          )}
          {c.owner === 'user2' && viewMode !== 'mine' && <Heart className={`absolute bottom-1 right-1 w-3 h-3 shrink-0 ${isActive ? 'text-white/70' : 'text-white/40'}`} fill="currentColor" />}
        </div>
      );
    }

    return coursesToRender;
  };

  return (
    <div 
      className="min-h-screen text-gray-800 font-sans flex flex-col overflow-hidden bg-cover bg-center bg-fixed"
      style={{ backgroundImage: data.config.backgroundImage ? `url(${data.config.backgroundImage})` : undefined, backgroundColor: '#F8F9FA' }}
    >
      {/* Header */}
      <header className={`px-4 pt-safe-top pb-2 z-30 shrink-0 border-b ${data.config.backgroundImage ? 'border-white/10' : 'bg-white border-gray-100 shadow-sm'} ${(data.config.enableGlassmorphism ?? true) ? 'backdrop-blur-sm' : ''}`}
        style={data.config.backgroundImage ? { backgroundColor: `rgba(255, 255, 255, ${(data.config.glassOpacity ?? 20) / 100})` } : {}}
      >
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 drop-shadow-sm">{new Date().getMonth()+1}月{new Date().getDate()}日</h1>
            <div className="text-sm text-gray-800 flex items-center gap-1 font-medium drop-shadow-sm bg-white/20 px-2 py-1 rounded-full">
              <button onClick={handlePrevWeek} className="p-0.5 rounded-full hover:bg-black/5"><ChevronLeft size={14} /></button>
              <span className="min-w-[4rem] text-center">{viewingWeek === 0 ? '未开学' : `第 ${viewingWeek} 周`}</span>
              <button onClick={handleNextWeek} className="p-0.5 rounded-full hover:bg-black/5"><ChevronRight size={14} /></button>
              {viewingWeek === getWeekNumber(data.config.startDate) && viewingWeek !== 0 && (
                <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-sm shadow-sm ml-1">本周</span>
              )}
            </div>
          </div>
          <div className="flex gap-3 text-gray-800">
            <button onClick={() => handleEmptyClick(1, 1)} className="p-2 rounded-full hover:bg-black/5 transition-colors drop-shadow-sm"><Plus size={22} /></button>
          </div>
        </div>
      </header>

      {/* Timetable Grid with Swipe Animation & Vertical Scroll */}
      <div className="flex-1 relative overflow-hidden w-full">
        <AnimatePresence initial={false} custom={swipeDir}>
          <motion.div
            key={viewingWeek}
            custom={swipeDir}
            initial={(dir) => ({ opacity: 0, x: dir > 0 ? 100 : -100 })}
            animate={{ opacity: 1, x: 0 }}
            exit={(dir) => ({ opacity: 0, x: dir > 0 ? -100 : 100 })}
            transition={{ duration: 0.2 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset }) => {
              if (offset.x < -50) handleNextWeek();
              if (offset.x > 50) handlePrevWeek();
            }}
            className={`absolute inset-0 overflow-y-auto border-t ${data.config.backgroundImage ? 'border-white/20' : 'bg-white border-gray-100'} ${(data.config.enableGlassmorphism ?? true) ? 'backdrop-blur-md' : ''}`}
            style={data.config.backgroundImage ? { backgroundColor: `rgba(255, 255, 255, ${(data.config.glassOpacity ?? 20) / 100})` } : {}}
          >
            {/* Days Header (Sticky) */}
            <div 
              className={`grid grid-cols-[45px_repeat(7,minmax(0,1fr))] border-b sticky top-0 z-20 ${data.config.backgroundImage ? 'border-white/20' : 'bg-gray-50/95 border-gray-100'} ${(data.config.enableGlassmorphism ?? true) ? 'backdrop-blur-md' : ''}`}
              style={data.config.backgroundImage ? { backgroundColor: `rgba(255, 255, 255, ${Math.min(1, ((data.config.glassOpacity ?? 20) + 10) / 100)})` } : {}}
            >
              <div className={`p-2 flex items-center justify-center text-xs text-gray-700 font-medium border-r drop-shadow-sm ${data.config.backgroundImage ? 'border-white/20' : 'border-gray-100'}`}>
                {currentMonth}月
              </div>
              {DAYS.map((day, i) => {
                const date = weekDates[i];
                const isToday = new Date().toDateString() === date.toDateString();
                return (
                  <div key={day} className={`p-2 flex flex-col items-center justify-center text-xs border-r last:border-r-0 ${data.config.backgroundImage ? 'border-white/20' : 'border-gray-100'}`}>
                    <span className="text-gray-700 mb-0.5 drop-shadow-sm">{day}</span>
                    <span className={`font-medium drop-shadow-sm ${isToday ? 'bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-sm' : 'text-gray-900'}`}>
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Grid Body */}
            <div className="flex relative pb-20">
              {/* Time Column */}
              <div 
                className={`w-[45px] flex-shrink-0 flex flex-col border-r ${data.config.backgroundImage ? 'border-white/20' : 'bg-gray-50/30 border-gray-100'}`}
                style={data.config.backgroundImage ? { backgroundColor: `rgba(255, 255, 255, ${((data.config.glassOpacity ?? 20) * 0.5) / 100})` } : {}}
              >
                {data.config.periods.map((period) => (
                  <div key={period.num} className={`border-b flex flex-col items-center justify-center ${data.config.backgroundImage ? 'border-white/20' : 'border-gray-100'}`} style={{ height: PERIOD_HEIGHT }}>
                    <span className="font-bold text-gray-800 text-sm drop-shadow-sm">{period.num}</span>
                    <span className="text-[9px] text-gray-600 whitespace-pre text-center leading-tight mt-0.5 drop-shadow-sm">
                      {period.startTime}{'\n'}{period.endTime}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Days Columns */}
              <div className="flex-1 flex">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div key={day} className={`flex-1 relative border-r last:border-r-0 ${data.config.backgroundImage ? 'border-white/20' : 'border-gray-100'}`}>
                    {/* Background Grid Cells */}
                    {data.config.periods.map((period) => (
                      <div 
                        key={period.num} 
                        className={`border-b w-full cursor-pointer transition-colors ${data.config.backgroundImage ? 'border-white/20 hover:bg-white/30' : 'border-gray-100 hover:bg-gray-50'}`} 
                        style={{ height: PERIOD_HEIGHT }}
                        onClick={() => handleEmptyClick(day, period.num)}
                      />
                    ))}
                    {/* Courses Overlay */}
                    {renderCoursesForDay(day)}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className={`fixed bottom-0 w-full border-t pb-safe z-40 ${data.config.backgroundImage ? 'border-white/20' : 'bg-white/90 border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]'} ${(data.config.enableGlassmorphism ?? true) ? 'backdrop-blur-xl' : ''}`}
        style={data.config.backgroundImage ? { backgroundColor: `rgba(255, 255, 255, ${Math.min(1, ((data.config.glassOpacity ?? 20) + 40) / 100)})` } : {}}
      >
        <div className="flex justify-around p-2 max-w-md mx-auto">
          <button
            onClick={() => handleTabClick('mine')}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${viewMode === 'mine' ? 'text-blue-600 drop-shadow-sm' : 'text-gray-600 hover:text-gray-800 drop-shadow-sm'}`}
          >
            <User size={20} className={viewMode === 'mine' ? 'fill-blue-100/50' : ''} />
            <span className="text-[10px] mt-1 font-medium">我的</span>
          </button>
          <button
            onClick={() => handleTabClick('couple')}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${viewMode === 'couple' ? 'text-purple-600 drop-shadow-sm' : 'text-gray-600 hover:text-gray-800 drop-shadow-sm'}`}
          >
            <Users size={20} className={viewMode === 'couple' ? 'fill-purple-100/50' : ''} />
            <span className="text-[10px] mt-1 font-medium">双人</span>
          </button>
          <button
            onClick={() => handleTabClick('theirs')}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${viewMode === 'theirs' ? 'text-pink-600 drop-shadow-sm' : 'text-gray-600 hover:text-gray-800 drop-shadow-sm'}`}
          >
            <Heart size={20} className={viewMode === 'theirs' ? 'fill-pink-100/50' : ''} />
            <span className="text-[10px] mt-1 font-medium">Ta的</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all text-gray-600 hover:text-gray-800 drop-shadow-sm`}
          >
            <Settings size={20} />
            <span className="text-[10px] mt-1 font-medium">设置</span>
          </button>
        </div>
      </div>

      {/* Course Modal */}
      <AnimatePresence>
        {modalState.isOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {modalState.mode === 'details' ? (
                // --- DETAILS VIEW ---
                <div className="flex flex-col">
                  <div className="px-6 py-5 flex justify-between items-start">
                    <h2 className="text-xl font-bold text-gray-800">{modalState.course.name}</h2>
                    <div className="flex gap-3 text-gray-500">
                      <button onClick={deleteCourse} className="hover:text-red-500"><Trash2 size={20} /></button>
                      <button onClick={() => setModalState({ ...modalState, mode: 'edit' })} className="hover:text-blue-500"><Edit2 size={20} /></button>
                      <button onClick={() => setModalState({ ...modalState, isOpen: false })}><X size={20} /></button>
                    </div>
                  </div>
                  
                  <div className="px-6 pb-8 space-y-5">
                    <div className="flex items-start gap-4 text-gray-600">
                      <Calendar size={20} className="mt-0.5 text-teal-500 shrink-0" />
                      <div>
                        <p>第 {modalState.course.startWeek} - {modalState.course.endWeek} 周 {modalState.course.weekType === 'odd' ? '单周' : modalState.course.weekType === 'even' ? '双周' : ''}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 text-gray-600">
                      <Clock size={20} className="mt-0.5 text-orange-400 shrink-0" />
                      <div>
                        <p>周{['一','二','三','四','五','六','日'][(modalState.course.dayOfWeek || 1) - 1]} 第 {modalState.course.startPeriod} - {modalState.course.endPeriod} 节</p>
                        <p className="text-sm text-gray-400">
                          {data.config.periods.find(p => p.num === modalState.course.startPeriod)?.startTime} - {data.config.periods.find(p => p.num === modalState.course.endPeriod)?.endTime}
                        </p>
                      </div>
                    </div>

                    {modalState.course.teacher && (
                      <div className="flex items-center gap-4 text-gray-600">
                        <UserIcon size={20} className="text-blue-500 shrink-0" />
                        <p>{modalState.course.teacher}</p>
                      </div>
                    )}

                    {modalState.course.room && (
                      <div className="flex items-center gap-4 text-gray-600">
                        <MapPin size={20} className="text-red-400 shrink-0" />
                        <p>{modalState.course.room}</p>
                      </div>
                    )}
                    
                    {modalState.course.credit && (
                      <div className="flex items-center gap-4 text-gray-600">
                        <Flag size={20} className="text-blue-400 shrink-0" />
                        <p>{modalState.course.credit} 学分</p>
                      </div>
                    )}

                    {modalState.course.note && (
                      <div className="flex items-start gap-4 text-gray-600">
                        <AlignLeft size={20} className="mt-0.5 text-yellow-500 shrink-0" />
                        <p>{modalState.course.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // --- ADD / EDIT VIEW ---
                <div className="flex flex-col h-full max-h-[90vh]">
                  <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                    <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="p-2 text-gray-600"><ChevronLeft size={24} /></button>
                    <h2 className="font-semibold text-lg">{modalState.mode === 'add' ? '添加课程' : '编辑课程'}</h2>
                    <button onClick={saveCourse} className="p-2 text-blue-600 font-medium">保存</button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Owner Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button 
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${modalState.owner === 'user1' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                        onClick={() => setModalState({ ...modalState, owner: 'user1' })}
                      >
                        我的课程
                      </button>
                      <button 
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${modalState.owner === 'user2' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'}`}
                        onClick={() => setModalState({ ...modalState, owner: 'user2' })}
                      >
                        Ta的课程
                      </button>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Book className="text-teal-500 shrink-0" size={20} />
                        <input
                          type="text"
                          value={modalState.course.name || ''}
                          onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, name: e.target.value } })}
                          className="flex-1 py-2 border-b border-gray-200 focus:border-blue-500 outline-none text-gray-800"
                          placeholder="课程名称"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <Palette className="text-orange-400 shrink-0" size={20} />
                        <div className="flex-1 flex gap-2 overflow-x-auto py-2 scrollbar-hide">
                          {COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => setModalState({ ...modalState, course: { ...modalState.course, color } })}
                              className={`shrink-0 w-6 h-6 rounded-full border-2 transition-all ${modalState.course.color === color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <Flag className="text-blue-400 shrink-0" size={20} />
                        <input
                          type="text"
                          value={modalState.course.credit || ''}
                          onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, credit: e.target.value } })}
                          className="flex-1 py-2 border-b border-gray-200 focus:border-blue-500 outline-none text-gray-800"
                          placeholder="学分 (可不填)"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <AlignLeft className="text-yellow-500 shrink-0" size={20} />
                        <input
                          type="text"
                          value={modalState.course.note || ''}
                          onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, note: e.target.value } })}
                          className="flex-1 py-2 border-b border-gray-200 focus:border-blue-500 outline-none text-gray-800"
                          placeholder="备注 (可不填)"
                        />
                      </div>
                    </div>

                    {/* Time Segment */}
                    <div className="bg-gray-50 rounded-xl p-4 pt-4 space-y-4 relative mt-4">
                      
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input 
                            type="checkbox" 
                            checked={modalState.course.isTemporary || false}
                            onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, isTemporary: e.target.checked } })}
                            className="rounded text-blue-500"
                          />
                          设为临时日程 (仅特定日期显示)
                        </label>
                      </div>

                      {modalState.course.isTemporary ? (
                        <div className="flex items-center gap-4">
                          <Calendar className="text-teal-500 shrink-0" size={20} />
                          <input
                            type="date"
                            value={modalState.course.date || new Date().toISOString().split('T')[0]}
                            onChange={(e) => {
                              const d = new Date(e.target.value);
                              setModalState({ 
                                ...modalState, 
                                course: { 
                                  ...modalState.course, 
                                  date: e.target.value,
                                  dayOfWeek: d.getDay() === 0 ? 7 : d.getDay()
                                } 
                              });
                            }}
                            className="flex-1 py-1 border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <Calendar className="text-teal-500 shrink-0" size={20} />
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="number" min="1" max="25"
                              value={modalState.course.startWeek || 1}
                              onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, startWeek: Number(e.target.value) } })}
                              className="w-12 py-1 text-center border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                              type="number" min="1" max="25"
                              value={modalState.course.endWeek || 20}
                              onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, endWeek: Number(e.target.value) } })}
                              className="w-12 py-1 text-center border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                            />
                            <span className="text-gray-500">周</span>
                            <div className="ml-auto flex items-center gap-2">
                              <span className="text-xs text-blue-500 font-medium">时间段</span>
                              <select
                                value={modalState.course.weekType || 'all'}
                                onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, weekType: e.target.value as WeekType } })}
                                className="py-1 border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent text-sm"
                              >
                                <option value="all">全部</option>
                                <option value="odd">单周</option>
                                <option value="even">双周</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <Clock className="text-orange-400 shrink-0" size={20} />
                        <div className="flex-1 flex items-center gap-2">
                          <select
                            value={modalState.course.dayOfWeek || 1}
                            onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, dayOfWeek: Number(e.target.value) } })}
                            className="py-1 border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent text-sm"
                          >
                            {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
                          </select>
                          <span className="text-gray-500 ml-2">第</span>
                          <select
                            value={modalState.course.startPeriod || 1}
                            onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, startPeriod: Number(e.target.value) } })}
                            className="py-1 border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent text-sm"
                          >
                            {data.config.periods.map(p => <option key={p.num} value={p.num}>{p.num}</option>)}
                          </select>
                          <span className="text-gray-500">-</span>
                          <select
                            value={modalState.course.endPeriod || 1}
                            onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, endPeriod: Number(e.target.value) } })}
                            className="py-1 border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent text-sm"
                          >
                            {data.config.periods.map(p => <option key={p.num} value={p.num}>{p.num}</option>)}
                          </select>
                          <span className="text-gray-500">节</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <UserIcon className="text-blue-500 shrink-0" size={20} />
                        <input
                          type="text"
                          value={modalState.course.teacher || ''}
                          onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, teacher: e.target.value } })}
                          className="flex-1 py-2 border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent text-gray-800"
                          placeholder="老师姓名"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <MapPin className="text-red-400 shrink-0" size={20} />
                        <input
                          type="text"
                          value={modalState.course.room || ''}
                          onChange={(e) => setModalState({ ...modalState, course: { ...modalState.course, room: e.target.value } })}
                          className="flex-1 py-2 border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent text-gray-800"
                          placeholder="教室地点"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
              <h2 className="font-semibold text-lg">设置</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="flex border-b border-gray-100 bg-white">
              <button className={`flex-1 py-3 text-sm font-medium ${settingsTab === 'sync' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`} onClick={() => setSettingsTab('sync')}>同步配置</button>
              <button className={`flex-1 py-3 text-sm font-medium ${settingsTab === 'semester' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`} onClick={() => setSettingsTab('semester')}>学期管理</button>
              <button className={`flex-1 py-3 text-sm font-medium ${settingsTab === 'time' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`} onClick={() => setSettingsTab('time')}>时间设置</button>
              <button className={`flex-1 py-3 text-sm font-medium ${settingsTab === 'appearance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`} onClick={() => setSettingsTab('appearance')}>外观</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-50 text-red-500 text-sm p-3 rounded-lg border border-red-100 mb-4">
                  {error}
                </div>
              )}

              {settingsTab === 'appearance' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">背景壁纸</label>
                    <div className="flex items-center gap-4">
                      {data.config.backgroundImage ? (
                        <div className="relative w-24 h-32 rounded-lg overflow-hidden border border-gray-200">
                          <img src={data.config.backgroundImage} alt="Background" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setData({ ...data, config: { ...data.config, backgroundImage: '' } })}
                            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                          <ImageIcon className="text-gray-400" size={24} />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors inline-block">
                          上传图片
                          <input 
                            type="file" 
                            hidden 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const img = new Image();
                                  img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    const MAX_WIDTH = 1080;
                                    const MAX_HEIGHT = 1920;
                                    let width = img.width;
                                    let height = img.height;

                                    if (width > height) {
                                      if (width > MAX_WIDTH) {
                                        height *= MAX_WIDTH / width;
                                        width = MAX_WIDTH;
                                      }
                                    } else {
                                      if (height > MAX_HEIGHT) {
                                        width *= MAX_HEIGHT / height;
                                        height = MAX_HEIGHT;
                                      }
                                    }
                                    canvas.width = width;
                                    canvas.height = height;
                                    const ctx = canvas.getContext('2d');
                                    ctx?.drawImage(img, 0, 0, width, height);
                                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                                    
                                    try {
                                      setData({ ...data, config: { ...data.config, backgroundImage: dataUrl } });
                                    } catch (err) {
                                      showToast('图片处理失败');
                                    }
                                  };
                                  img.src = event.target?.result as string;
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <p className="text-xs text-gray-400 mt-2">图片将保存在本地缓存中。开启背景后，课表将自动变为毛玻璃半透明效果。</p>
                      </div>
                    </div>
                  </div>
                  
                  {data.config.backgroundImage && (
                    <div className="pt-4 border-t border-gray-100">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={data.config.enableGlassmorphism ?? true}
                          onChange={(e) => setData({ ...data, config: { ...data.config, enableGlassmorphism: e.target.checked } })}
                          className="rounded text-blue-500 w-4 h-4"
                        />
                        开启毛玻璃效果
                      </label>
                      
                      {(data.config.enableGlassmorphism ?? true) && (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-2">毛玻璃不透明度: {data.config.glassOpacity ?? 20}%</label>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={data.config.glassOpacity ?? 20}
                            onChange={(e) => setData({ ...data, config: { ...data.config, glassOpacity: Number(e.target.value) } })}
                            className="w-full accent-blue-500"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>更透明</span>
                            <span>更白</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">课程块显示设置 (单人视图)</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">字体大小 (px)</span>
                        <input 
                          type="number"
                          min="8"
                          max="20"
                          value={data.config.courseFontSize ?? 10}
                          onChange={(e) => setData({ ...data, config: { ...data.config, courseFontSize: Number(e.target.value) } })}
                          className="text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 w-20 px-2 py-1 border"
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={data.config.showCourseTime ?? true}
                          onChange={(e) => setData({ ...data, config: { ...data.config, showCourseTime: e.target.checked } })}
                          className="rounded text-blue-500 w-4 h-4"
                        />
                        显示上课时间
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={data.config.showCourseName ?? true}
                          onChange={(e) => setData({ ...data, config: { ...data.config, showCourseName: e.target.checked } })}
                          className="rounded text-blue-500 w-4 h-4"
                        />
                        显示课程名称
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={data.config.showCourseRoom ?? true}
                          onChange={(e) => setData({ ...data, config: { ...data.config, showCourseRoom: e.target.checked } })}
                          className="rounded text-blue-500 w-4 h-4"
                        />
                        显示教室地点
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={data.config.showCourseTeacher ?? true}
                          onChange={(e) => setData({ ...data, config: { ...data.config, showCourseTeacher: e.target.checked } })}
                          className="rounded text-blue-500 w-4 h-4"
                        />
                        显示教师姓名
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">双人模式专属颜色</h4>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">我的课程颜色</label>
                        <input 
                          type="color" 
                          value={data.config.user1Color || '#60A5FA'}
                          onChange={(e) => setData({ ...data, config: { ...data.config, user1Color: e.target.value } })}
                          className="w-full h-8 rounded cursor-pointer border-0 p-0"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Ta的课程颜色</label>
                        <input 
                          type="color" 
                          value={data.config.user2Color || '#F472B6'}
                          onChange={(e) => setData({ ...data, config: { ...data.config, user2Color: e.target.value } })}
                          className="w-full h-8 rounded cursor-pointer border-0 p-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'sync' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Token</label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gist ID</label>
                    <input
                      type="text"
                      value={gistId}
                      onChange={(e) => setGistId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">导入课表 (.ics)</label>
                    <label className="cursor-pointer w-full bg-gray-50 border border-dashed border-gray-300 text-gray-600 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                      <Download size={18} />
                      选择 .ics 文件导入
                      <input type="file" hidden accept=".ics" onChange={handleImportICS} />
                    </label>
                  </div>
                  
                  <div className="pt-2">
                    <button onClick={syncTimetable} disabled={loading} className="w-full bg-blue-50 text-blue-600 py-3 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                      <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                      {loading ? '正在同步...' : '手动同步到云端'}
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'semester' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">第一周周一日期</label>
                    <input
                      type="date"
                      value={data.config.startDate}
                      onChange={(e) => setData({ ...data, config: { ...data.config, startDate: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-2">系统会自动根据此日期推算当前是第几周。</p>
                  </div>
                </div>
              )}

              {settingsTab === 'time' && (
                <div className="space-y-4">
                  <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                    <button 
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${data.config.timeMode === 'manual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                      onClick={() => setData({ ...data, config: { ...data.config, timeMode: 'manual' } })}
                    >
                      手动设置结束时间
                    </button>
                    <button 
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${data.config.timeMode === 'duration' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                      onClick={() => setData({ ...data, config: { ...data.config, timeMode: 'duration' } })}
                    >
                      设置时长自动计算
                    </button>
                  </div>

                  {data.config.periods.map((period, index) => (
                    <div key={period.num} className="flex items-center gap-2">
                      <span className="w-10 text-xs font-medium text-gray-600">第{period.num}节</span>
                      <input
                        type="time"
                        value={period.startTime}
                        onChange={(e) => {
                          const newPeriods = [...data.config.periods];
                          newPeriods[index].startTime = e.target.value;
                          if (data.config.timeMode === 'duration') {
                            newPeriods[index].endTime = calculateEndTime(e.target.value, newPeriods[index].duration || 45);
                          }
                          setData({ ...data, config: { ...data.config, periods: newPeriods } });
                        }}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-xs"
                      />
                      
                      {data.config.timeMode === 'manual' ? (
                        <>
                          <span className="text-gray-400">-</span>
                          <input
                            type="time"
                            value={period.endTime}
                            onChange={(e) => {
                              const newPeriods = [...data.config.periods];
                              newPeriods[index].endTime = e.target.value;
                              setData({ ...data, config: { ...data.config, periods: newPeriods } });
                            }}
                            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-xs"
                          />
                        </>
                      ) : (
                        <>
                          <span className="text-gray-400">+</span>
                          <div className="flex-1 relative">
                            <input
                              type="number"
                              value={period.duration || 45}
                              onChange={(e) => {
                                const newPeriods = [...data.config.periods];
                                const duration = Number(e.target.value);
                                newPeriods[index].duration = duration;
                                newPeriods[index].endTime = calculateEndTime(newPeriods[index].startTime, duration);
                                setData({ ...data, config: { ...data.config, periods: newPeriods } });
                              }}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">分</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => {
                        const newPeriods = [...data.config.periods];
                        const last = newPeriods[newPeriods.length - 1];
                        newPeriods.push({
                          num: (last?.num || 0) + 1,
                          startTime: last?.endTime || '08:00',
                          endTime: calculateEndTime(last?.endTime || '08:00', 45),
                          duration: 45
                        });
                        setData({ ...data, config: { ...data.config, periods: newPeriods } });
                      }}
                      className="flex-1 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                    >
                      <Plus size={16} /> 添加一节课
                    </button>
                    {data.config.periods.length > 1 && (
                      <button 
                        onClick={() => {
                          const newPeriods = [...data.config.periods];
                          newPeriods.pop();
                          setData({ ...data, config: { ...data.config, periods: newPeriods } });
                        }}
                        className="px-3 py-2 border border-dashed border-red-200 rounded-lg text-sm text-red-400 hover:bg-red-50 flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
              <button
                onClick={saveSettings}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                保存并同步
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-10 left-1/2 z-[100] bg-gray-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium whitespace-nowrap"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Dialog */}
      <AnimatePresence>
        {importData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">导入课表</h3>
              <p className="text-gray-600 mb-4">成功解析 {importData.courses.length} 门课程。请选择导入目标：</p>
              
              <div className="flex gap-2 mb-4">
                <button 
                  onClick={() => setImportTarget('user1')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${importTarget === 'user1' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  我的课表
                </button>
                <button 
                  onClick={() => setImportTarget('user2')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${importTarget === 'user2' ? 'bg-purple-50 border-purple-200 text-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Ta的课表
                </button>
              </div>

              <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg mb-6">
                ⚠️ 警告：导入将清空该用户原有的所有课程，并自动更新上课时间段配置以适应新课表。
              </div>

              <div className="flex gap-3">
                <button onClick={() => setImportData(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">取消</button>
                <button 
                  onClick={() => {
                    setData(prev => ({
                      ...prev,
                      [importTarget]: importData.courses,
                      config: {
                        ...prev.config,
                        periods: importData.newPeriods || prev.config.periods
                      }
                    }));
                    showToast('导入成功！请记得点击同步保存到云端。');
                    setImportData(null);
                  }} 
                  className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
                >
                  确认导入
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">提示</h3>
              <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">取消</button>
                <button onClick={confirmDialog.onConfirm} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors">确定</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

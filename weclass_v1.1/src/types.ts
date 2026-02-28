export type WeekType = 'all' | 'odd' | 'even';

export interface Course {
  id: string;
  name: string;
  dayOfWeek: number; // 1-7 (Mon-Sun)
  startPeriod: number; // 1-12+
  endPeriod: number; // 1-12+
  room: string;
  color: string;
  startWeek: number;
  endWeek: number;
  weekType: WeekType;
  teacher?: string;
  credit?: string;
  note?: string;
  date?: string; // YYYY-MM-DD for temporary events
  isTemporary?: boolean;
}

export interface PeriodTime {
  num: number;
  startTime: string;
  endTime: string;
  duration?: number; // in minutes
}

export interface SemesterConfig {
  startDate: string; // YYYY-MM-DD
  periods: PeriodTime[];
  timeMode?: 'manual' | 'duration';
  backgroundImage?: string;
  glassOpacity?: number;
  enableGlassmorphism?: boolean;
  courseFontSize?: number;
  showCourseTime?: boolean;
  showCourseName?: boolean;
  showCourseRoom?: boolean;
  showCourseTeacher?: boolean;
  user1Color?: string;
  user2Color?: string;
}

export interface TimetableData {
  user1: Course[];
  user2: Course[];
  config: SemesterConfig;
}

export type ViewMode = 'mine' | 'theirs' | 'couple';

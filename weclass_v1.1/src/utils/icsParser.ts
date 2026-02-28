import { Course, PeriodTime } from '../types';

const getWeekNumber = (startDateStr: string, targetDate: Date) => {
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 1;
  return Math.max(1, Math.floor(days / 7) + 1);
};

export const parseICS = (icsData: string, existingPeriods: PeriodTime[], semesterStartDateStr: string): { courses: Partial<Course>[], newPeriods?: PeriodTime[] } => {
  const unfolded = icsData.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const courses: any[] = [];
  let currentCourse: any = null;
  let maxPeriod = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('BEGIN:VEVENT')) {
      currentCourse = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentCourse && currentCourse.name) {
        if (currentCourse.startDate) {
           const startW = getWeekNumber(semesterStartDateStr, currentCourse.startDate);
           currentCourse.startWeek = startW;
           currentCourse.endWeek = startW;
        }
        if (currentCourse.untilDate) {
           const endW = getWeekNumber(semesterStartDateStr, currentCourse.untilDate);
           currentCourse.endWeek = endW;
        }
        courses.push(currentCourse);
      }
      currentCourse = null;
    } else if (currentCourse) {
      if (line.startsWith('SUMMARY:')) {
        currentCourse.name = line.substring(8).trim();
      } else if (line.startsWith('LOCATION:')) {
        const locParts = line.substring(9).trim().split(' ');
        currentCourse.room = locParts[0];
        if (locParts.length > 1) {
          currentCourse.teacher = locParts.slice(1).join(' ');
        }
      } else if (line.startsWith('DESCRIPTION:')) {
        const desc = line.substring(12).replace(/\\n/g, '\n');
        const parts = desc.split('\n');
        
        // Try to parse period numbers like "第1 - 2节" or "第3节"
        const periodMatch = desc.match(/第\s*(\d+)\s*(?:-\s*(\d+))?\s*节/);
        if (periodMatch) {
          currentCourse.startPeriod = parseInt(periodMatch[1]);
          currentCourse.endPeriod = periodMatch[2] ? parseInt(periodMatch[2]) : currentCourse.startPeriod;
          maxPeriod = Math.max(maxPeriod, currentCourse.endPeriod);
        }

        if (!currentCourse.teacher && parts.length >= 3) {
           currentCourse.teacher = parts[2].trim();
        }
        if (!currentCourse.room && parts.length >= 2) {
           currentCourse.room = parts[1].trim();
        }
      } else if (line.startsWith('DTSTART')) {
        const match = line.match(/T(\d{2})(\d{2})/);
        if (match) {
          currentCourse._startTime = `${match[1]}:${match[2]}`;
        }
        const dateMatch = line.match(/(\d{4})(\d{2})(\d{2})/);
        if (dateMatch) {
          const d = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
          currentCourse.dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
          currentCourse.startDate = d;
        }
      } else if (line.startsWith('DTEND')) {
         const match = line.match(/T(\d{2})(\d{2})/);
         if (match) {
            currentCourse._endTime = `${match[1]}:${match[2]}`;
         }
      } else if (line.startsWith('RRULE:')) {
        const untilMatch = line.match(/UNTIL=(\d{4})(\d{2})(\d{2})/);
        if (untilMatch) {
          currentCourse.untilDate = new Date(`${untilMatch[1]}-${untilMatch[2]}-${untilMatch[3]}`);
        }
      }
    }
  }

  let newPeriods: PeriodTime[] | undefined = undefined;

  if (maxPeriod > 0) {
    // We found explicit period numbers, let's build a new periods array
    newPeriods = Array.from({ length: Math.max(maxPeriod, existingPeriods.length) }, (_, i) => {
      return existingPeriods[i] ? { ...existingPeriods[i] } : { num: i + 1, startTime: '', endTime: '' };
    });

    for (const c of courses) {
      if (c.startPeriod && c._startTime) {
        newPeriods[c.startPeriod - 1].startTime = c._startTime;
      }
      if (c.endPeriod && c._endTime) {
        newPeriods[c.endPeriod - 1].endTime = c._endTime;
      }
    }

    // Fill gaps
    let lastEnd = "08:00";
    for (let i = 0; i < newPeriods.length; i++) {
      if (!newPeriods[i].startTime) newPeriods[i].startTime = lastEnd;
      if (!newPeriods[i].endTime) {
         const [h, m] = newPeriods[i].startTime.split(':').map(Number);
         const d = new Date(); d.setHours(h, m + 45);
         newPeriods[i].endTime = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      }
      lastEnd = newPeriods[i].endTime;
    }
  } else {
    // Fallback: match times to existing periods
    for (const c of courses) {
      if (c._startTime) {
        const [hour, min] = c._startTime.split(':').map(Number);
        let closestPeriod = existingPeriods[0];
        let minDiff = Infinity;
        for (const p of existingPeriods) {
          const [ph, pm] = p.startTime.split(':').map(Number);
          const diff = Math.abs((ph * 60 + pm) - (hour * 60 + min));
          if (diff < minDiff) {
            minDiff = diff;
            closestPeriod = p;
          }
        }
        c.startPeriod = closestPeriod.num;
      }
      if (c._endTime && c.startPeriod) {
        const [hour, min] = c._endTime.split(':').map(Number);
        let closestPeriod = existingPeriods[existingPeriods.length - 1];
        let minDiff = Infinity;
        for (const p of existingPeriods) {
          const [ph, pm] = p.endTime.split(':').map(Number);
          const diff = Math.abs((ph * 60 + pm) - (hour * 60 + min));
          if (diff < minDiff) {
            minDiff = diff;
            closestPeriod = p;
          }
        }
        c.endPeriod = Math.max(c.startPeriod, closestPeriod.num);
      }
    }
  }

  const uniqueCourses: Partial<Course>[] = [];
  const seen = new Set();
  
  for (const c of courses) {
    if (!c.startPeriod || !c.endPeriod) continue; // Skip invalid courses
    const key = `${c.name}-${c.dayOfWeek}-${c.startPeriod}-${c.endPeriod}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCourses.push({
        name: c.name,
        room: c.room,
        teacher: c.teacher,
        dayOfWeek: c.dayOfWeek,
        startPeriod: c.startPeriod,
        endPeriod: c.endPeriod,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        color: ['#BDE0FE', '#FFC8DD', '#CDB4DB', '#A2D2FF', '#FFAFCC', '#FFFFB7', '#E2F0CB', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'][Math.floor(Math.random() * 14)],
        startWeek: c.startWeek || 1,
        endWeek: c.endWeek || 20,
        weekType: 'all',
        isTemporary: false
      });
    } else {
      const existing = uniqueCourses.find(u => `${u.name}-${u.dayOfWeek}-${u.startPeriod}-${u.endPeriod}` === key);
      if (existing && c.startWeek) {
         existing.startWeek = Math.min(existing.startWeek!, c.startWeek);
         existing.endWeek = Math.max(existing.endWeek!, c.endWeek || c.startWeek);
      }
    }
  }

  return { courses: uniqueCourses, newPeriods };
};

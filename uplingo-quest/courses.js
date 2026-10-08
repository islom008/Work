// UpLingo Quest · coursebooks taught at RESULT English School.
// Each class covers two lessons (e.g. "1.1–1.2" in Navigate or "1A + 1B" in Solutions),
// so one homework = one class = the tasks from those two lessons.
//
// Unit titles come from the books' contents pages (via teacher's book copies online).
// Titles marked null weren't confirmed; the app shows "Unit n" and the teacher can type the
// title in when creating homework. Check them against your own copy of the book.
(function (root) {
  'use strict';

  // Solutions 3rd edition (Oxford): Introduction + 9 units, 8 lessons per unit (A–H).
  const SOLUTIONS_LESSONS = [
    { key: 'A', skill: 'Vocabulary', type: 'vocab' },
    { key: 'B', skill: 'Grammar', type: 'grammar' },
    { key: 'C', skill: 'Listening', type: 'listening' },
    { key: 'D', skill: 'Grammar', type: 'grammar' },
    { key: 'E', skill: 'Word Skills', type: 'vocab' },
    { key: 'F', skill: 'Reading', type: 'reading' },
    { key: 'G', skill: 'Speaking', type: 'speaking' },
    { key: 'H', skill: 'Writing', type: 'writing' },
  ];
  // Navigate (Oxford): 10 units; x.1–x.3 core lessons, x.4 Speaking and writing, x.5 Video.
  const NAVIGATE_LESSONS = [
    { key: '1', skill: 'Grammar & vocabulary', type: 'grammar', extra: 'vocab' },
    { key: '2', skill: 'Grammar & vocabulary', type: 'grammar', extra: 'vocab' },
    { key: '3', skill: 'Grammar & vocabulary', type: 'grammar', extra: 'vocab' },
    { key: '4', skill: 'Speaking and writing', type: 'speaking', extra: 'writing' },
    { key: '5', skill: 'Video', type: 'listening' },
  ];

  const COURSES = {
    'navigate-a1': {
      id: 'navigate-a1', book: 'Navigate', level: 'Beginner', cefr: 'A1', style: 'navigate',
      lessons: NAVIGATE_LESSONS,
      units: ['First meetings', 'Questions', null, null, null, null, null, null, null, null],
    },
    'solutions-elem': {
      id: 'solutions-elem', book: 'Solutions 3rd ed.', level: 'Elementary', cefr: 'A2', style: 'solutions',
      lessons: SOLUTIONS_LESSONS,
      units: ['Family and friends', 'School days', 'Style', 'Food', null, null, null, null, null],
    },
    'solutions-preint': {
      id: 'solutions-preint', book: 'Solutions 3rd ed.', level: 'Pre-Intermediate', cefr: 'A2–B1', style: 'solutions',
      lessons: SOLUTIONS_LESSONS,
      units: ['Feelings', 'Adventure', 'On screen', 'Our planet', 'Ambition', 'Tourism', 'Money', 'Crime', 'Science'],
    },
    'solutions-int': {
      id: 'solutions-int', book: 'Solutions 3rd ed.', level: 'Intermediate', cefr: 'B1–B2', style: 'solutions',
      lessons: SOLUTIONS_LESSONS,
      units: ['Generations', 'Leisure time', 'The human body', 'Home', 'Technology', 'High flyers', 'Artists', 'Messages', 'Journeys'],
    },
    'solutions-upper': {
      id: 'solutions-upper', book: 'Solutions 3rd ed.', level: 'Upper-Intermediate', cefr: 'B2', style: 'solutions',
      lessons: SOLUTIONS_LESSONS,
      units: ['Fame', 'Problems', 'Customs and culture', 'Holidays and tourism', 'Relationships', 'Health', 'Tall stories', 'Change the world', 'Consumerism'],
    },
  };

  const unitTitle = (course, n) => course.units[n - 1] || 'Unit ' + n;
  const lessonCode = (course, unit, l) => course.style === 'navigate' ? unit + '.' + l.key : unit + l.key;

  // How a class is usually split: two lessons per class.
  // Solutions: A+B, C+D, E+F, G+H. Navigate: x.1–x.2, x.3–x.4, then the x.5 video on its own.
  const sessionsOf = (course, unit) => {
    const L = course.lessons;
    const out = [];
    for (let i = 0; i < L.length; i += 2) out.push(L.slice(i, i + 2));
    return out.map((pair) => ({
      lessons: pair,
      codes: pair.map((l) => lessonCode(course, unit, l)),
      label: course.style === 'navigate'
        ? pair.map((l) => lessonCode(course, unit, l)).join('–')
        : pair.map((l) => lessonCode(course, unit, l)).join(' + '),
      title: [...new Set(pair.map((l) => l.skill))].join(' & '),
    }));
  };

  // Suggested homework tasks for a set of lessons. The teacher can edit any of them.
  const TASK_TEXT = {
    vocab: (c) => 'Workbook ' + c + ' · vocabulary',
    grammar: (c) => 'Workbook ' + c + ' · grammar exercises',
    listening: (c) => c + ' · listen again and answer',
    reading: (c) => c + ' · reading questions',
    speaking: (c) => c + ' · record your answers',
    writing: (c) => c + ' · writing task',
  };
  const defaultTasks = (course, unit, lessons) => {
    const tasks = [];
    lessons.forEach((l) => {
      const code = lessonCode(course, unit, l);
      if (course.style === 'navigate' && l.key === '4') {
        tasks.push({ label: code + ' · record yourself speaking', type: 'speaking' });
        tasks.push({ label: code + ' · short writing task', type: 'writing' });
      } else if (course.style === 'navigate' && l.extra === 'vocab') {
        tasks.push({ label: 'Workbook ' + code + ' · grammar & vocabulary', type: 'grammar' });
      } else if (l.key === 'E' && course.style === 'solutions') {
        tasks.push({ label: 'Workbook ' + code + ' · word skills', type: 'vocab' });
      } else {
        tasks.push({ label: TASK_TEXT[l.type](code), type: l.type });
      }
    });
    return tasks;
  };

  const Courses = { COURSES, unitTitle, lessonCode, sessionsOf, defaultTasks };
  if (typeof module !== 'undefined' && module.exports) module.exports = Courses;
  else root.Courses = Courses;
})(typeof window !== 'undefined' ? window : globalThis);

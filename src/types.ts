export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  phoneNumber?: string;
  dateOfBirth?: string;
  institution?: string;
  studentId?: string;
  department?: string;
  approved?: boolean;
  createdAt: string;
}

export interface QuizSettings {
  negativeMarking: number;
  randomize: boolean;
  oneAttempt: boolean;
  fullscreenRequired: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  quizCode: string;
  duration: number;
  startTime: string;
  endTime: string;
  settings: QuizSettings;
  sectionId?: string;
  department?: string;
  published: boolean;
  createdAt: string;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: 'mcq' | 'tf' | 'short';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  points: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface QuizAnalytics {
  averageScore: number;
  passRate: number;
  totalSubmissions: number;
  difficultQuestions: {
    questionId: string;
    text: string;
    failRate: number;
  }[];
}

export interface Violation {
  type: string;
  timestamp: string;
  details?: string;
}

export interface Submission {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string>;
  startTime: string;
  submitTime?: string;
  violations: Violation[];
  score?: number;
  graded: boolean;
  status: 'ongoing' | 'submitted' | 'disqualified';
}

export interface Section {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  teacherName: string;
  enrollmentPassword?: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  sectionId: string;
  studentId: string;
  studentName: string;
  enrolledAt: string;
}

export interface Announcement {
  id: string;
  sectionId: string;
  teacherId: string;
  title: string;
  content: string;
  type: 'exam' | 'general';
  createdAt: string;
}

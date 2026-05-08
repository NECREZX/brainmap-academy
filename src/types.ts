
export type LearningLevel = 'Anak-anak' | 'Pelajar' | 'Mahasiswa/Profesional' | 'Otodidak';

export type ExplanationMode = 'Santai' | 'Teknis';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'current' | 'completed';
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizSet {
  questions: QuizQuestion[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'roadmap' | 'quiz' | 'explanation' | 'summary';
  quizData?: QuizSet;
  xpAwarded?: number;
}

export interface HistorySession {
  topic: string;
  level: LearningLevel;
  milestonesCompleted: number;
  totalMilestones: number;
  xpEarned: number;
  badgesEarned: string[];
  dateCompleted: string;
}

export interface AppState {
  userName: string;
  level: LearningLevel | null;
  topic: string | null;
  milestones: Milestone[];
  currentMilestoneIndex: number;
  xp: number;
  badges: string[];
  streak: number;
  messages: Message[];
  explanationMode: ExplanationMode;
  isGenerating: boolean;
  view: 'chat' | 'history' | 'achievements';
  history: HistorySession[];
  isSidebarOpen: boolean;
  lastStreakUpdate: string;
  showCurriculumPanel: boolean;
  activeCurriculumTab: 'roadmap' | 'quiz';
  currentQuizIndex: number;
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Brain, 
  Trophy, 
  Flame, 
  ChevronRight, 
  Sparkles, 
  BookOpen, 
  User,
  Coffee,
  Microscope,
  CheckCircle2,
  Menu,
  X,
  Settings,
  MoreHorizontal,
  ChevronDown,
  Check
} from 'lucide-react';
import { 
  AppState, 
  LearningLevel, 
  Message, 
  Milestone, 
  QuizQuestion,
  QuizSet,
  ExplanationMode
} from './types';
import { 
  generateLearningPath, 
  getExplanation, 
  generateQuiz,
  generateSummary,
  askQuestion
} from './services/geminiService';

export default function App() {
  const [state, setState] = useState<AppState>({
    userName: '',
    level: null,
    topic: null,
    milestones: [],
    currentMilestoneIndex: -1,
    xp: 0,
    badges: [],
    streak: 1,
    messages: [],
    explanationMode: 'Santai',
    isGenerating: false,
    view: 'chat',
    history: [],
    showCurriculumPanel: false,
    activeCurriculumTab: 'roadmap',
    currentQuizIndex: 0,
  });

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // Load Persistence
  useEffect(() => {
    const savedProgress = localStorage.getItem('brainmap_progress');
    const savedHistory = localStorage.getItem('brainmap_history');

    if (savedProgress) {
      const { xp, badges, streak } = JSON.parse(savedProgress);
      setState(prev => ({ ...prev, xp: xp || 0, badges: badges || [], streak: streak || 1 }));
    }

    if (savedHistory) {
      setState(prev => ({ ...prev, history: JSON.parse(savedHistory) }));
    }

    // Check Streak
    const today = new Date().toDateString();
    const lastUpdate = localStorage.getItem('brainmap_last_streak');
    if (lastUpdate && lastUpdate !== today) {
      const lastDate = new Date(lastUpdate);
      const diffTime = Math.abs(new Date(today).getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        setState(prev => ({ ...prev, streak: prev.streak + 1 }));
      } else if (diffDays > 1) {
        setState(prev => ({ ...prev, streak: 1 }));
      }
      localStorage.setItem('brainmap_last_streak', today);
    } else if (!lastUpdate) {
      localStorage.setItem('brainmap_last_streak', today);
    }
  }, []);

  // Save Progress
  useEffect(() => {
    localStorage.setItem('brainmap_progress', JSON.stringify({
      xp: state.xp,
      badges: state.badges,
      streak: state.streak
    }));
  }, [state.xp, state.badges, state.streak]);

  // Save History
  useEffect(() => {
    localStorage.setItem('brainmap_history', JSON.stringify(state.history));
  }, [state.history]);

  const [isRoadmapExpanded, setIsRoadmapExpanded] = useState(false);

  // Initial Greeting
  useEffect(() => {
    const greeting: Message = {
      id: 'greeting',
      role: 'assistant',
      content: 'Halo! Aku BrainMap Academy, teman belajarmu yang asyik. 👋\n\nUntuk mulai, pilih level belajar yang paling cocok buat kamu!',
    };
    setState(prev => ({ ...prev, messages: [greeting] }));
  }, []);

  const addMessage = (msg: Omit<Message, 'id'>) => {
    const newMessage: Message = { ...msg, id: Date.now().toString() };
    setState(prev => ({ ...prev, messages: [...prev.messages, newMessage] }));
  };

  const handleLevelSelect = (level: LearningLevel) => {
    setState(prev => ({ ...prev, level }));
    addMessage({ role: 'user', content: `Saya level ${level}` });
    
    setTimeout(() => {
      addMessage({ 
        role: 'assistant', 
        content: `Mantap! Kita akan belajar sebagai **${level}**. Sekarang, beri tahu aku: topik apa yang ingin kamu pelajari hari ini? 🧠\n\n*(Bisa apa saja: sejarah, coding, astronomi, masak, dll!)*` 
      });
    }, 500);
  };

  const handleTopicInput = async (topic: string) => {
    setState(prev => ({ ...prev, topic, isGenerating: true }));
    addMessage({ role: 'user', content: topic });

    try {
      const pathData = await generateLearningPath(topic, state.level!);
      
      const roadmapText = `📍 [Roadmap: ${topic}]\n\nAku sudah buatkan jalur belajarmu! Kita punya ${pathData.milestones.length} langkah seru:`;
      
      const roadmapMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: roadmapText,
        type: 'roadmap'
      };

      setState(prev => ({ 
        ...prev, 
        milestones: (pathData?.milestones || []).map((m, i) => ({ ...m, status: i === 0 ? 'current' : 'pending' })),
        currentMilestoneIndex: 0,
        messages: [...prev.messages, roadmapMsg],
        isGenerating: false
      }));

      // Automatically start first milestone explanation
      const updatedMilestones: Milestone[] = (pathData?.milestones || []).map((m, i) => ({ 
        ...m, 
        status: (i === 0 ? 'current' : 'pending') as Milestone['status']
      }));
      setTimeout(() => handleStartMilestone(0, updatedMilestones, topic), 1000);
    } catch (error) {
      setState(prev => ({ ...prev, isGenerating: false }));
      addMessage({ role: 'assistant', content: 'Waduh, koneksi ke otak buatanku terganggu. Bisa coba tulis topiknya lagi?' });
    }
  };

  const handleStartMilestone = async (index: number, currentMilestones?: Milestone[], topicOverride?: string) => {
    const milestones = currentMilestones || state.milestones;
    const milestone = milestones[index];
    const topicToUse = topicOverride || state.topic;
    
    if (!topicToUse || !milestone) return;

    setState(prev => ({ ...prev, isGenerating: true }));

    try {
      const explanation = await getExplanation(
        topicToUse, 
        milestone.title, 
        state.level!, 
        state.explanationMode
      );

      setState(prev => ({ 
        ...prev, 
        isGenerating: false,
        messages: [...prev.messages, {
          id: Date.now().toString(),
          role: 'assistant',
          content: explanation,
          type: 'explanation'
        }]
      }));

      // Suggest Quiz
      setTimeout(() => {
        addMessage({ 
          role: 'assistant', 
          content: 'Materi milestone ini sudah selesai! Siap untuk tantangan kecil? Yuk coba kuis singkat buat lanjut ke milestone berikutnya! ✨',
        });
      }, 1000);
    } catch (error) {
      setState(prev => ({ ...prev, isGenerating: false }));
      addMessage({ role: 'assistant', content: 'Yah, aku blank sebentar. Bisa klik ulang milestonenya?' });
    }
  };

  const handleTriggerQuiz = async () => {
    setState(prev => ({ ...prev, isGenerating: true, showCurriculumPanel: true, activeCurriculumTab: 'quiz', currentQuizIndex: 0 }));
    const milestone = state.milestones[state.currentMilestoneIndex];
    // We send explanation content for context
    const lastExplanation = state.messages.filter(m => m.type === 'explanation').pop()?.content || milestone.title;
    const quizSet = await generateQuiz(state.topic!, lastExplanation, state.level!);

    if (quizSet && quizSet.questions && quizSet.questions.length > 0) {
      const quizMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Ayo mulai kuis untuk milestone: ${milestone.title}!`,
        type: 'quiz',
        quizData: quizSet
      };

      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        messages: [...prev.messages, quizMsg],
        currentQuizIndex: 0
      }));
    } else {
      setState(prev => ({ ...prev, isGenerating: false }));
      addMessage({ role: 'assistant', content: 'Eh, kuisnya nggak ketemu. Mau langsung lanjut aja?' });
    }
  };

  const handleQuizAnswer = (answer: string, quizSet: QuizSet) => {
    const currentQuestion = quizSet.questions[state.currentQuizIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;
    const xpGain = isCorrect ? 10 : 2;
    
    const feedback = isCorrect 
      ? `✅ Pertanyaan ${state.currentQuizIndex + 1}: BENAR! ${currentQuestion.explanation}`
      : `❌ Pertanyaan ${state.currentQuizIndex + 1}: KURANG TEPAT. Jawaban benar ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`;

    addMessage({ role: 'user', content: `Pertanyaan ${state.currentQuizIndex + 1}: Jawaban saya ${answer}` });

    setTimeout(() => {
      const isLastQuestion = state.currentQuizIndex === (quizSet?.questions?.length || 0) - 1;

      if (!isLastQuestion) {
        setState(prev => ({ 
          ...prev, 
          xp: prev.xp + xpGain,
          currentQuizIndex: prev.currentQuizIndex + 1,
          messages: [...prev.messages, {
            id: Date.now().toString(),
            role: 'assistant',
            content: feedback + "\n\nLanjut ke pertanyaan berikutnya! 🚀"
          }]
        }));
      } else {
        // All 3 questions answered
        setState(prev => {
          const nextMilestoneIndex = prev.currentMilestoneIndex + 1;
          const milestonesCount = prev.milestones.length;
          const completedCount = prev.milestones.filter(m => m.status === 'completed').length + 1;
          
          const updatedMilestones = prev.milestones.map((m, i) => {
            if (i <= prev.currentMilestoneIndex) {
              return { ...m, status: 'completed' as const };
            }
            if (i === nextMilestoneIndex) {
              return { ...m, status: 'current' as const };
            }
            return m;
          });

          const newBadges = [...prev.badges];
          let badgeAnnouncement = "";

          // Badge Award Logic (Specific Rules)
          if (completedCount === 1 && !newBadges.includes('🥉')) {
            newBadges.push('🥉');
            badgeAnnouncement = `Selamat! Kamu dapat lencana 🥉 Bronze! XP kamu sekarang: ${prev.xp + xpGain} XP 🔥`;
          } else if (completedCount === 3 && !newBadges.includes('🥈')) {
            newBadges.push('🥈');
            badgeAnnouncement = `Selamat! Kamu dapat lencana 🥈 Silver! XP kamu sekarang: ${prev.xp + xpGain} XP 🔥`;
          } else if (completedCount === 5 && !newBadges.includes('🥇')) {
            newBadges.push('🥇');
            badgeAnnouncement = `Selamat! Kamu dapat lencana 🥇 Gold! XP kamu sekarang: ${prev.xp + xpGain} XP 🔥`;
          } else if (completedCount === milestonesCount && !newBadges.includes('🏆')) {
            newBadges.push('🏆');
            badgeAnnouncement = `LUAR BIASA! Kamu dapat lencana 🏆 Trophy karena menyelesaikan seluruh roadmap! XP kamu sekarang: ${prev.xp + xpGain} XP 🔥`;
          }

          const newMessages = [...prev.messages, {
            id: Date.now().toString(),
            role: 'assistant',
            content: feedback + `\n\nKuis Selesai! 🎉\n🔥 XP Kamu: ${prev.xp + xpGain} XP | Lencana: ${newBadges.join(' ')}`,
          } as Message];

          if (badgeAnnouncement) {
            newMessages.push({
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: badgeAnnouncement
            } as Message);
          }

          return {
            ...prev,
            xp: prev.xp + xpGain,
            milestones: updatedMilestones,
            badges: newBadges,
            messages: newMessages,
            activeCurriculumTab: 'roadmap'
          };
        });

        // Move to next milestone
        if (state.currentMilestoneIndex + 1 < state.milestones.length) {
          const nextIndex = state.currentMilestoneIndex + 1;
          setState(prev => ({ ...prev, currentMilestoneIndex: nextIndex }));
          setTimeout(() => handleStartMilestone(nextIndex), 2000);
        } else {
          setTimeout(() => {
            showSummary();
          }, 0);
        }
      }
    }, 800);
  };

  const showSummary = async (forceState?: AppState) => {
    // Determine the state to use (forceState or the very latest from ref)
    const currentState = forceState || stateRef.current;
    
    const summaryMsg = await generateSummary(
      currentState.topic!, 
      currentState.level!, 
      currentState.milestones, 
      currentState.xp, 
      currentState.badges
    );
    
    addMessage({ 
      role: 'assistant', 
      content: summaryMsg, 
      type: 'summary' 
    });

    // Save to History
    const newHistoryItem = {
      topic: currentState.topic!,
      level: currentState.level!,
      milestonesCompleted: currentState.milestones.filter(m => m.status === 'completed').length,
      totalMilestones: currentState.milestones.length,
      xpEarned: currentState.xp,
      badgesEarned: currentState.badges,
      dateCompleted: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    };

    setState(prev => {
      const isAlreadySaved = prev.history.some(h => 
        h.topic === newHistoryItem.topic && 
        h.level === newHistoryItem.level &&
        h.dateCompleted === newHistoryItem.dateCompleted
      );
      if (isAlreadySaved) return prev;
      return {
        ...prev,
        history: [newHistoryItem, ...prev.history]
      };
    });
  };

  const resetTopic = () => {
    setState(prev => ({
      ...prev,
      topic: null,
      milestones: [],
      currentMilestoneIndex: -1,
      messages: [{
        id: Date.now().toString(),
        role: 'assistant',
        content: `MANTAP! Sesi sebelumnya sudah aku simpan di RIWAYAT. Sekarang, kasih tahu aku: topik apa lagi yang ingin kamu kuasai? 🚀`
      }]
    }));
  };

  const revisitMilestone = (index: number) => {
    handleStartMilestone(index);
  };

  const handleSend = () => {
    if (!inputValue.trim() || state.isGenerating) return;
    
    const input = inputValue.trim();
    setInputValue('');

    if (!state.level) {
      return;
    }

    if (!state.topic) {
      handleTopicInput(input);
      return;
    }

    addMessage({ role: 'user', content: input });
    
    if (input.toLowerCase().includes('lanjut')) {
      if (state.currentMilestoneIndex + 1 < state.milestones.length) {
        handleStartMilestone(state.currentMilestoneIndex + 1);
      } else if (state.milestones.every(m => m.status === 'completed')) {
        showSummary();
      }
    } else if (input.toLowerCase().includes('kuis')) {
      handleTriggerQuiz();
    } else {
      // Free form question handling
      setState(prev => ({ ...prev, isGenerating: true }));
      
      askQuestion(input, state.topic, state.level!)
        .then(answer => {
          setState(prev => ({ 
            ...prev, 
            isGenerating: false,
            messages: [...prev.messages, {
              id: Date.now().toString(),
              role: 'assistant',
              content: answer
            }]
          }));
        })
        .catch(() => {
          setState(prev => ({ ...prev, isGenerating: false }));
          addMessage({ 
            role: 'assistant', 
            content: "Maaf, aku terdistraksi sebentar. Bisa ulangi pertanyaannya? Atau kita LANJUT saja?" 
          });
        });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Top Header / Status Bar */}
      <header className="h-16 flex items-center justify-between px-4 bg-white border-b border-slate-200 shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setState(prev => ({ ...prev, isSidebarOpen: !prev.isSidebarOpen }))}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div 
          onClick={() => setState(prev => ({ ...prev, view: 'chat', isSidebarOpen: false }))}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 bg-teal-800 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
            B
          </div>
          <h1 className="text-lg font-bold text-teal-900 leading-none hidden sm:block">BrainMap Academy</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-base">🔥</span>
            <span className="font-bold text-slate-700 text-xs">{state.streak}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
            <span className="text-xs">⭐</span>
            <span className="font-bold text-amber-700 text-xs">{state.xp} XP</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {state.isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setState(prev => ({ ...prev, isSidebarOpen: false }))}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar: Navigation */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-10
          bg-white border-r border-slate-200 
          transform transition-all duration-300 ease-in-out
          ${state.isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:border-none'}
          flex flex-col overflow-hidden
        `}>
          <div className="flex flex-col h-full p-4 w-72 shrink-0">
            <div className="flex items-center justify-between mb-8 lg:hidden">
               <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-800 rounded-lg flex items-center justify-center text-white font-bold text-lg">B</div>
                <span className="font-bold text-teal-900">BrainMap Academy</span>
              </div>
              <button onClick={() => setState(prev => ({ ...prev, isSidebarOpen: false }))} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {[
                { id: 'chat', label: 'Lab Belajar', icon: <Brain className="w-4 h-4" /> },
                { id: 'history', label: 'Riwayat Belajar', icon: <BookOpen className="w-4 h-4" /> },
                { id: 'achievements', label: 'Pencapaian', icon: <Trophy className="w-4 h-4" /> },
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setState(prev => ({ ...prev, view: item.id as any, isSidebarOpen: window.innerWidth < 1024 ? false : prev.isSidebarOpen }))}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${state.view === item.id ? 'bg-teal-50 text-teal-900 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <div className={`p-1.5 rounded-lg ${state.view === item.id ? 'bg-teal-800 text-white' : 'bg-slate-100'}`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto space-y-4">
              <div className="p-5 bg-white rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pencapaian</p>
                    <h4 className="text-sm font-bold text-slate-800">Lencana Kamu</h4>
                  </div>
                  <div className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-1 rounded-full border border-teal-100">
                    {state.badges.length}/4
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-teal-50/50 p-2 rounded-2xl border border-teal-100/50 mb-4">
                  {['🥉', '🥈', '🥇', '🏆'].map((icon, idx) => {
                    const isUnlocked = state.badges.includes(icon);
                    return (
                      <div 
                        key={idx}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-500 ${
                          isUnlocked 
                            ? 'bg-white shadow-sm scale-110 opacity-100' 
                            : 'bg-transparent grayscale opacity-20 scale-90'
                        }`}
                      >
                        {icon}
                      </div>
                    );
                  })}
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-teal-600/60">
                    <span>Progres</span>
                    <span>{Math.round((state.badges.length / 4) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-teal-100/30 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(state.badges.length / 4) * 100}%` }}
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Learning Content Area */}
        <main className={`flex-1 flex flex-row relative overflow-hidden transition-all duration-300 ${state.showCurriculumPanel ? 'lg:pr-96' : 'lg:pr-0'}`}>
          <div className="flex-1 flex flex-col relative overflow-hidden">
             {/* New Floating Curriculum Toggle (Semi-circle on right edge) */}
             <AnimatePresence>
                {state.topic && !state.showCurriculumPanel && (
                  <motion.button
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 50, opacity: 0 }}
                    whileHover={{ x: -2, scale: 1.05 }}
                    onClick={() => setState(prev => ({ ...prev, showCurriculumPanel: true }))}
                    className="fixed right-0 top-[42%] -translate-y-1/2 z-[40] bg-teal-900 text-white pl-3 pr-1 py-4 rounded-l-[20px] shadow-2xl flex items-center justify-center border-y border-l border-teal-800 hover:bg-teal-800 transition-all group"
                  >
                    <div className="bg-teal-800 p-2 rounded-lg group-hover:bg-teal-700 transition-colors shadow-inner">
                       <BookOpen className="w-4 h-4 text-teal-200 group-hover:text-white" />
                    </div>
                  </motion.button>
                )}
             </AnimatePresence>

             {/* Chat View */}
          <div className={state.view === 'chat' ? 'flex-1 flex flex-col relative overflow-hidden' : 'hidden'}>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 pb-48 md:pb-52 lg:pb-56 scroll-smooth no-scrollbar">
                <AnimatePresence initial={false}>
                  {state.messages.map((msg, idx) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.type === 'explanation' ? (
                        <div className="explanation-card">
                          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                            <span className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center text-lg">💡</span>
                            <h3 className="text-lg font-bold text-teal-900">{state.milestones[state.currentMilestoneIndex]?.title}</h3>
                          </div>
                          
                          <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
                            {msg.content?.split('\n')?.map((line, lIdx) => {
                              if (line.includes('🌏')) {
                                return (
                                  <div key={lIdx} className="bg-teal-50 border-l-4 border-teal-600 p-4 my-4 rounded-r-xl">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm">🌏</span>
                                      <span className="text-[10px] font-black text-teal-800 uppercase tracking-widest">Analogi Dunia Nyata</span>
                                    </div>
                                    <p className="text-sm text-slate-700 italic">{line.replace('🌏', '').trim()}</p>
                                  </div>
                                );
                              }
                              if (line.includes('✨')) {
                                return (
                                  <div key={lIdx} className="flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 self-start px-3 py-2 rounded-lg border border-amber-100 my-2 shadow-sm">
                                    <span>✨</span>
                                    <span>{line.replace('✨', '').trim()}</span>
                                  </div>
                                );
                              }
                              return <p key={lIdx} className="mb-2">{line.replace('💡', '').trim()}</p>;
                            })}
                          </div>
                        </div>
                      ) : msg.type === 'summary' ? (
                        <div className="w-full max-w-xl bg-white rounded-3xl p-8 border-2 border-teal-800 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-2 bg-teal-800"></div>
                          <div className="whitespace-pre-line text-slate-800 font-medium leading-relaxed mb-8">
                            {msg.content}
                          </div>
                          
                          <div className="flex flex-col gap-3">
                            <button 
                              onClick={resetTopic}
                              className="w-full h-14 bg-teal-800 text-white rounded-2xl flex items-center justify-center gap-3 font-bold uppercase tracking-wider hover:bg-black transition-all shadow-lg active:scale-95"
                            >
                              🚀 Mulai Topik Baru
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                              {state.milestones?.map((m, i) => (
                                <button 
                                  key={m.id}
                                  onClick={() => revisitMilestone(i)}
                                  className="h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-all truncate px-2"
                                >
                                  Review {m.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </div>

                          {msg.role === 'assistant' && msg.content.includes("Siap untuk tantangan kecil?") && (
                            <div className="mt-4 flex flex-col gap-2">
                               <button 
                                onClick={handleTriggerQuiz}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                               >
                                <Sparkles className="w-4 h-4" />
                                Ambil Kuis Milestone Ini
                               </button>
                            </div>
                          )}
    
                          {msg.type === 'roadmap' && (
                            <div className="mt-6 space-y-3 lg:hidden">
                               {state.milestones?.map((m, i) => (
                                <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                                  m.status === 'current' ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/10' : 'bg-slate-50 border-slate-100'
                                }`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                                      m.status === 'completed' ? 'bg-teal-500 text-white' : 
                                      m.status === 'current' ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                      {m.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={`text-xs font-bold ${m.status === 'current' ? 'text-slate-900' : 'text-slate-600'}`}>{m.title}</span>
                                      {m.status === 'current' && <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-0.5">← Sedang Dipelajari</span>}
                                    </div>
                                </div>
                               ))}
                            </div>
                          )}
    
                          {idx === 0 && !state.level && (
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[
                                { id: 'Anak-anak', icon: <Coffee className="w-4 h-4" />, label: '🧒 Anak (SD)', color: 'bg-blue-50 text-blue-700 border-blue-100' },
                                { id: 'Pelajar', icon: <BookOpen className="w-4 h-4" />, label: '📚 Pelajar (SMP/SMA)', color: 'bg-teal-50 text-teal-700 border-teal-100' },
                                { id: 'Mahasiswa/Profesional', icon: <Microscope className="w-4 h-4" />, label: '🎓 Mahasiswa / Pro', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                                { id: 'Otodidak', icon: <Sparkles className="w-4 h-4" />, label: '🔍 Otodidak', color: 'bg-amber-50 text-amber-700 border-amber-100' }
                              ].map((lvl) => (
                                <button
                                  key={lvl.id}
                                  onClick={() => handleLevelSelect(lvl.id as LearningLevel)}
                                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 text-xs font-black uppercase tracking-wider shadow-sm ${lvl.color}`}
                                >
                                  <div className="p-2 bg-white rounded-lg shadow-sm">{lvl.icon}</div>
                                  {lvl.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
    
                {state.isGenerating && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="chat-bubble-assistant opacity-50 px-6 py-4">
                      <div className="flex gap-2">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-10" />
              </div>
    
              {/* Footer Input */}
              <footer className={`h-auto min-h-24 py-4 bg-white border-t border-slate-200 px-4 md:px-8 flex items-center shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-40 fixed bottom-0 transition-all duration-300
                ${state.isSidebarOpen ? 'lg:left-72' : 'lg:left-0'}
                ${state.showCurriculumPanel ? 'lg:right-96' : 'lg:right-0'}
                left-0 right-0
              `}>
                <div className="max-w-4xl mx-auto w-full flex items-end gap-2 md:gap-3">
                  <button 
                    onClick={() => setState(prev => ({ ...prev, explanationMode: prev.explanationMode === 'Santai' ? 'Teknis' : 'Santai' }))}
                    className={`flex items-center justify-center w-11 h-11 md:w-auto md:px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm shrink-0 mb-0.5 ${
                      state.explanationMode === 'Santai' 
                        ? 'bg-amber-50 border-amber-200 text-amber-700' 
                        : 'bg-teal-50 border-teal-200 text-teal-700'
                    }`}
                  >
                    {state.explanationMode === 'Santai' ? <Coffee className="w-4 h-4" /> : <Microscope className="w-4 h-4" />}
                    <span className="hidden md:inline ml-2">{state.explanationMode}</span>
                  </button>
    
                  <div className="flex-1 relative flex items-end bg-slate-100 rounded-2xl border-2 border-transparent focus-within:border-teal-600 focus-within:bg-white transition-all overflow-hidden min-h-[56px] max-h-40 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20">
                    <textarea 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={state.topic ? "Tanya atau ketik 'Lanjut'..." : "Ketik topik apa saja..."}
                      className="w-full bg-transparent border-none focus:ring-0 focus:outline-none outline-none text-sm font-bold px-4 py-4 resize-none min-h-[56px] custom-scrollbar text-slate-700"
                      rows={1}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
                      }}
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!inputValue.trim() || state.isGenerating}
                      className="m-1.5 w-9 h-9 bg-teal-800 text-white rounded-lg hover:bg-black disabled:bg-slate-300 transition-all flex items-center justify-center shadow-lg transform active:scale-90 shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </footer>
          </div>
          {state.view === 'history' && (
            <div className="flex-1 overflow-y-auto p-12 bg-white">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-12">
                  <div>
                    <h2 className="text-3xl font-black text-teal-950 mb-2">Riwayat Belajar</h2>
                    <p className="text-slate-500 font-medium">Semua pencapaian hebatmu ada di sini!</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Selesai</p>
                      <p className="text-2xl font-black text-teal-800">{state.history.length}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 pb-20">
                  {state.history.length > 0 ? (
                    state.history.map((session, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group bg-slate-50 rounded-3xl p-6 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                      >
                        <div className="flex items-start gap-5">
                          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                            {session.badgesEarned.includes('🏆') ? '🏆' : '📚'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold text-slate-900 capitalize">{session.topic}</h3>
                              <span className="px-2 py-0.5 bg-slate-200 text-[9px] font-black text-slate-600 rounded-md uppercase tracking-wider italic">
                                {session.level.split(' ')[0]}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">{session.dateCompleted}</p>
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100/50 rounded-lg">
                                <span className="text-xs">⭐</span>
                                <span className="font-bold text-amber-700 text-xs">{session.xpEarned} XP</span>
                              </div>
                              <div className="flex gap-1">
                                {session.badgesEarned.map((b, bi) => (
                                  <span key={bi} className="text-sm grayscale-[0.2]">{b}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</p>
                            <p className="text-sm font-bold text-teal-800 uppercase italic">
                              {session.milestonesCompleted} / {session.totalMilestones} Selesai
                            </p>
                          </div>
                          <button 
                            onClick={async () => {
                              setState(prev => ({ 
                                ...prev, 
                                view: 'chat', 
                                topic: session.topic,
                                level: session.level,
                                milestones: [],
                                isGenerating: true 
                              }));
                              const path = await generateLearningPath(session.topic, session.level);
                              setState(prev => ({
                                ...prev,
                                milestones: path.milestones.map((m, i) => ({ ...m, status: i === 0 ? 'current' : 'pending' })),
                                currentMilestoneIndex: 0,
                                isGenerating: false,
                                messages: [{
                                  id: Date.now().toString(),
                                  role: 'assistant',
                                  content: `Selamat datang kembali! Yuk kita pelajari lagi tentang ${session.topic}. Roadmap sudah aku siapkan!`
                                }]
                              }));
                            }}
                            className="bg-white border border-slate-200 h-12 px-6 rounded-xl hover:bg-teal-800 hover:text-white hover:border-teal-800 transition-all font-bold text-xs uppercase tracking-widest shadow-sm active:scale-95"
                          >
                            Pelajari Lagi
                          </button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner animate-pulse">
                        📭
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Belum ada topik yang selesai</h3>
                      <p className="text-slate-500 max-w-xs mx-auto mb-8">Yuk mulai petualangan belajarmu sekarang dan isi riwayat ini dengan pencapaian!</p>
                      <button 
                         onClick={() => setState(prev => ({ ...prev, view: 'chat' }))}
                         className="px-8 py-4 bg-teal-800 text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95"
                      >
                         Mulai Belajar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {state.view === 'achievements' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-white">
              <div className="max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <h2 className="text-4xl font-black text-teal-950 mb-3">Pencapaian Kamu</h2>
                    <p className="text-slate-500 font-medium text-lg">Koleksi lencana keren dari setiap perjalanan belajarmu.</p>
                  </div>
                  <div className="flex items-center gap-6 bg-amber-50 rounded-3xl p-6 border border-amber-100 shadow-sm">
                    <div className="text-center px-4 border-r border-amber-200">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">XP Total</p>
                      <p className="text-2xl font-black text-teal-900">{state.xp}</p>
                    </div>
                    <div className="text-center px-4">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Lencana</p>
                      <p className="text-2xl font-black text-teal-900">{state.badges.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { icon: '🥉', title: 'Perintis (Bronze)', desc: 'Milestone 1 selesai + kuis pertama dijawab', requirement: '1 Milestone' },
                    { icon: '🥈', title: 'Penjelajah (Silver)', desc: 'Selesaikan setidaknya 3 milestone belajar', requirement: '3 Milestone' },
                    { icon: '🥇', title: 'Master (Gold)', desc: 'Selesaikan setidaknya 5 milestone belajar', requirement: '5 Milestone' },
                    { icon: '🏆', title: 'Legenda (Trophy)', desc: 'Selesaikan seluruh roadmap + semua kuis dijawab', requirement: 'Semua Milestone' },
                  ].map((badge, idx) => {
                    const hasBadge = state.badges.includes(badge.icon) || 
                                     (idx === 0 && state.badges.includes('🥉')) || 
                                     (idx === 1 && state.badges.includes('🥈')) || 
                                     (idx === 2 && state.badges.includes('🥇')) || 
                                     (idx === 3 && state.badges.includes('🏆'));
                    
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className={`relative group rounded-[32px] p-8 border-2 transition-all overflow-hidden ${
                          hasBadge 
                            ? 'bg-gradient-to-br from-white to-amber-50/30 border-amber-200 shadow-xl shadow-amber-900/5' 
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        {/* Status Label */}
                        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${
                          hasBadge ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {hasBadge ? 'Unlocked' : 'Locked'}
                        </div>

                        <div className={`w-20 h-20 mx-auto mb-8 rounded-3xl flex items-center justify-center text-5xl shadow-inner transition-all transform group-hover:scale-110 ${
                          hasBadge ? 'bg-white' : 'bg-slate-200/50 grayscale opacity-40'
                        }`}>
                          {badge.icon}
                        </div>

                        <div className="text-center">
                          <h4 className={`text-lg font-black mb-2 transition-colors ${hasBadge ? 'text-teal-950' : 'text-slate-400'}`}>
                            {badge.title}
                          </h4>
                          <p className={`text-[11px] font-medium leading-relaxed transition-colors ${hasBadge ? 'text-slate-600' : 'text-slate-300'}`}>
                            {badge.desc}
                          </p>
                        </div>

                        {/* Progress Indicator */}
                        <div className="mt-8 pt-6 border-t border-slate-100/50">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target</span>
                            <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg">
                              {badge.requirement}
                            </span>
                          </div>
                        </div>

                        {/* Particle effects for unlocked badges */}
                        {hasBadge && (
                          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl group-hover:bg-amber-400/20 transition-all opacity-50" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {state.view !== 'chat' && state.view !== 'history' && state.view !== 'achievements' && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white">
              <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8 shadow-inner">
                <Brain className="w-12 h-12 text-teal-800 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-teal-950 mb-3">Siap Belajar?</h2>
              <p className="text-slate-500 font-medium text-center max-w-sm mb-10 leading-relaxed text-lg">
                Klik tombol di bawah untuk kembali ke ruang belajarmu dan kuasai hal baru hari ini!
              </p>
              <button 
                 onClick={() => setState(prev => ({ ...prev, view: 'chat' }))}
                 className="px-12 py-5 bg-teal-800 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-teal-900/40 hover:bg-black transition-all active:scale-95 text-sm"
               >
                  Masuk Lab Sekarang
               </button>
            </div>
          )}
        </div>
          {/* Curriculum Panel (Roadmap & Quiz) */}
          <AnimatePresence>
            {state.showCurriculumPanel && state.topic && (
              <>
                {/* Backdrop for mobile */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setState(prev => ({ ...prev, showCurriculumPanel: false }))}
                  className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[45] lg:hidden"
                />
                <motion.aside
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="w-full sm:w-[400px] lg:w-96 bg-white border-l border-slate-200 z-[50] fixed inset-y-0 right-0 flex flex-col shadow-2xl overflow-hidden"
                >
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                       <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-teal-800 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-teal-900/20">
                             <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Kurikulum</p>
                            <h3 className="text-sm font-black text-teal-900 leading-tight">Materi Belajar</h3>
                          </div>
                       </div>
                       <button 
                        onClick={() => setState(prev => ({ ...prev, showCurriculumPanel: false }))}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-all group"
                       >
                         <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                       </button>
                    </div>

                    {/* Custom Header with Tabs precisely like image */}
                    <div className="bg-slate-100 p-1 rounded-2xl flex mb-6 shadow-inner border border-slate-200/50">
                      <button 
                        onClick={() => setState(prev => ({ ...prev, activeCurriculumTab: 'roadmap' }))}
                        className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${state.activeCurriculumTab === 'roadmap' ? 'bg-white text-teal-900 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Daftar Modul
                      </button>
                      <button 
                        onClick={() => setState(prev => ({ ...prev, activeCurriculumTab: 'quiz' }))}
                        className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${state.activeCurriculumTab === 'quiz' ? 'bg-white text-teal-900 shadow-md ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Latihan Kuis
                      </button>
                    </div>

                    {state.activeCurriculumTab === 'roadmap' ? (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Overall Progress */}
                        <div className="mb-6 bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex justify-between items-end mb-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Progress Belajar</span>
                            <span className="text-sm font-black text-teal-600 leading-none">
                              {Math.round((state.milestones.filter(m => m.status === 'completed').length / state.milestones.length) * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(state.milestones.filter(m => m.status === 'completed').length / state.milestones.length) * 100}%` }}
                              className="h-full bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]"
                            />
                          </div>
                        </div>

                        {/* Milestone List exactly like image style */}
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                          <div className="space-y-3 pb-6">
                            {state.milestones.map((m, i) => (
                              <div key={m.id} className="group transition-all">
                                <div 
                                  onClick={() => handleStartMilestone(i)}
                                  className={`flex items-start gap-4 p-4 rounded-2xl transition-all border cursor-pointer ${
                                    m.status === 'current' 
                                      ? 'bg-teal-50/50 border-teal-200 shadow-lg shadow-teal-900/5 ring-4 ring-teal-500/5 scale-[1.02]' 
                                      : m.status === 'completed'
                                        ? 'bg-white border-slate-100 hover:border-teal-200 shadow-sm'
                                        : 'bg-slate-50/50 border-transparent opacity-60 grayscale-[0.5]'
                                  } hover:shadow-md active:scale-[0.98]`}
                                >
                                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${
                                    m.status === 'completed' ? 'bg-teal-500 border-teal-500 text-white shadow-lg shadow-teal-500/20' : 
                                    m.status === 'current' ? 'bg-white border-teal-500 text-teal-500 animate-[pulse_2s_infinite] shadow-lg shadow-teal-500/10' : 'bg-white border-slate-200 text-slate-300'
                                  }`}>
                                    {m.status === 'completed' ? <Check className="w-4 h-4" /> : <ChevronRight className={`w-4 h-4 transition-transform ${m.status === 'current' ? 'translate-x-0.5' : ''}`} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-black leading-tight mb-1 transition-colors ${m.status === 'pending' ? 'text-slate-400' : 'text-teal-950 group-hover:text-teal-800'}`}>
                                      {m.title}
                                    </h4>
                                    <p className={`text-[10px] font-bold leading-relaxed transition-colors ${m.status === 'pending' ? 'text-slate-300' : 'text-slate-500 italic'}`}>
                                      {m.description.slice(0, 100)}{m.description.length > 100 ? '...' : ''}
                                    </p>
                                  </div>
                                  {m.status === 'completed' && (
                                    <div className="mt-1 grayscale-0 shrink-0">
                                      <CheckCircle2 className="w-5 h-5 text-teal-500" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
                        <div className="p-5 bg-teal-50 rounded-[32px] border border-teal-100 mb-8 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-teal-100 shrink-0">🧠</div>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-1 leading-none">Tantangan Kuis</p>
                              <div className="flex items-center justify-between">
                                 <p className="text-xs font-black text-teal-900 leading-none">Pertanyaan {state.currentQuizIndex + 1}/3</p>
                                 <div className="flex gap-1.5 px-2 py-1 bg-white/50 rounded-full border border-teal-200/50">
                                    {[0, 1, 2].map(i => (
                                      <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i < state.currentQuizIndex ? 'bg-teal-500' : i === state.currentQuizIndex ? 'bg-teal-500 animate-pulse scale-110' : 'bg-slate-200'}`} />
                                    ))}
                                 </div>
                              </div>
                            </div>
                         </div>

                         {state.messages.filter(m => m.type === 'quiz').length > 0 ? (
                           <div className="flex-1 flex flex-col pt-2 pb-10">
                              {(() => {
                                const lastQuizMsg = state.messages.filter(m => m.type === 'quiz').pop();
                                if (!lastQuizMsg || !lastQuizMsg.quizData) return null;
                                
                                const currentQ = lastQuizMsg.quizData.questions[state.currentQuizIndex];
                                if (!currentQ) return null;

                                return (
                                  <motion.div 
                                    key={state.currentQuizIndex}
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    className="flex-1 flex flex-col"
                                  >
                                    <div className="bg-teal-800 rounded-[32px] p-8 text-white mb-8 shadow-xl relative overflow-hidden group border border-teal-700">
                                       <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-500">
                                          <Sparkles className="w-16 h-16" />
                                       </div>
                                       <p className="text-sm font-bold leading-relaxed relative z-10">{currentQ.question}</p>
                                    </div>

                                    <div className="space-y-3">
                                      {currentQ.options.map((opt, i) => {
                                        const letter = ['A', 'B', 'C'][i];
                                        return (
                                          <button
                                            key={i}
                                            onClick={() => handleQuizAnswer(letter, lastQuizMsg.quizData!)}
                                            className="flex items-center gap-4 w-full p-5 bg-white border-2 border-slate-100 rounded-3xl text-left hover:border-teal-500 hover:bg-teal-50/10 transition-all active:scale-[0.98] group shadow-sm hover:shadow-md"
                                          >
                                            <span className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:bg-teal-800 group-hover:text-white transition-all shadow-inner">
                                              {letter}
                                            </span>
                                            <span className="text-xs font-black text-slate-700 tracking-tight">{opt}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                );
                              })()}
                           </div>
                         ) : (
                           <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-200">
                              <Sparkles className="w-14 h-14 mb-6 text-slate-300" />
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed text-slate-400 max-w-[200px] mb-6">
                                 {state.topic ? "Materi tersedia! Siap menguji pemahamanmu?" : "Pilih topik dulu untuk membuka kuis!"}
                              </p>
                              
                              {state.topic && (
                                <button 
                                  onClick={handleTriggerQuiz}
                                  className="w-full py-4 bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all active:scale-95 flex items-center justify-center gap-2 mb-3"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  Mulai Kuis Sekarang
                                </button>
                              )}

                              <button 
                                onClick={() => setState(prev => ({ ...prev, activeCurriculumTab: 'roadmap' }))}
                                className="w-full py-3 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded-2xl hover:bg-slate-50 transition-all"
                              >
                                Lihat Daftar Modul
                              </button>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

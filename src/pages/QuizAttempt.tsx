import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Quiz, Question, Submission, Violation } from '../types';
import { useAntiCheat } from '../utils/antiCheat';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, AlertTriangle, ChevronRight, ChevronLeft, Send, Maximize } from 'lucide-react';

interface QuizAttemptProps {
  user: UserProfile;
}

export default function QuizAttempt({ user }: QuizAttemptProps) {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [violations, setViolations] = useState<Violation[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const onViolation = useCallback((type: string, details?: string) => {
    if (!started) return;
    const newViolation: Violation = { type, details, timestamp: new Date().toISOString() };
    setViolations(prev => [...prev, newViolation]);
    
    // Auto-submit after 3 violations
    if (violations.length >= 2) {
      handleSubmit('disqualified');
    }
  }, [started, violations.length]);

  const { enterFullscreen } = useAntiCheat({ onViolation });

  useEffect(() => {
    const fetchData = async () => {
      if (!quizId) return;
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (!quizDoc.exists()) {
        navigate('/student');
        return;
      }
      const quizData = { id: quizDoc.id, ...quizDoc.data() } as Quiz;
      setQuiz(quizData);

      const qSnapshot = await getDocs(collection(db, 'quizzes', quizId, 'questions'));
      const qList = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions(quizData.settings.randomize ? qList.sort(() => Math.random() - 0.5) : qList);
      
      setLoading(false);
    };

    fetchData();
  }, [quizId, navigate]);

  useEffect(() => {
    if (!started || timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit('submitted');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [started, timeLeft]);

  const startQuiz = async () => {
    if (!quiz) return;
    await enterFullscreen();
    
    const sub: Partial<Submission> = {
      quizId: quiz.id,
      studentId: user.uid,
      studentName: user.name,
      answers: {},
      startTime: new Date().toISOString(),
      violations: [],
      status: 'ongoing',
      graded: false
    };

    const docRef = await addDoc(collection(db, 'submissions'), sub);
    setSubmissionId(docRef.id);
    setStarted(true);
    setTimeLeft(quiz.duration * 60);
  };

  const handleSubmit = async (status: 'submitted' | 'disqualified' = 'submitted') => {
    if (!submissionId) return;
    
    let score = 0;
    questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (studentAnswer === q.correctAnswer) {
        score += q.points;
      } else if (studentAnswer && quiz?.settings.negativeMarking) {
        score -= quiz.settings.negativeMarking;
      }
    });

    await updateDoc(doc(db, 'submissions', submissionId), {
      answers,
      violations,
      submitTime: new Date().toISOString(),
      status,
      score,
      graded: true
    });

    navigate(`/quiz-result/${submissionId}`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (!started) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-white rounded-[32px] p-10 shadow-xl border border-[#5A5A40]/10"
        >
          <h2 className="text-3xl font-bold text-[#5A5A40] mb-4">{quiz?.title}</h2>
          <p className="text-[#5A5A40]/60 mb-8 italic">{quiz?.description}</p>
          
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="p-4 bg-[#5A5A40]/5 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">Duration</span>
              <p className="text-xl font-bold text-[#5A5A40]">{quiz?.duration} Minutes</p>
            </div>
            <div className="p-4 bg-[#5A5A40]/5 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">Questions</span>
              <p className="text-xl font-bold text-[#5A5A40]">{questions.length}</p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-10">
            <h4 className="flex items-center gap-2 text-yellow-800 font-bold mb-2">
              <AlertTriangle size={18} />
              Anti-Cheat Instructions
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc pl-5">
              <li>Fullscreen mode is mandatory.</li>
              <li>Do not switch tabs or minimize the browser.</li>
              <li>Right-click and keyboard shortcuts are disabled.</li>
              <li>3 violations will result in automatic disqualification.</li>
            </ul>
          </div>

          <button 
            onClick={startQuiz}
            className="w-full bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#5A5A40]/90 transition-colors flex items-center justify-center gap-2"
          >
            <Maximize size={20} />
            Enter Fullscreen & Start Quiz
          </button>
        </motion.div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-serif p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-[32px] border border-[#5A5A40]/10 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white font-bold">
              {currentIdx + 1}
            </div>
            <div>
              <h3 className="font-bold text-[#5A5A40]">{quiz?.title}</h3>
              <p className="text-xs text-[#5A5A40]/40 uppercase tracking-widest">Question {currentIdx + 1} of {questions.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[#5A5A40]">
              <Clock size={20} />
              <span className={`text-xl font-bold font-mono ${timeLeft && timeLeft < 60 ? 'text-red-500 animate-pulse' : ''}`}>
                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle size={18} />
              <span className="text-sm font-bold">{violations.length}/3 Violations</span>
            </div>
          </div>
        </header>

        <main className="bg-white rounded-[32px] p-10 border border-[#5A5A40]/10 shadow-sm min-h-[400px] flex flex-col">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-[#5A5A40] leading-relaxed">{currentQ.text}</h2>
          </div>

          <div className="space-y-4 flex-grow">
            {currentQ.type === 'mcq' || currentQ.type === 'tf' ? (
              currentQ.options?.map((opt, i) => (
                <button 
                  key={i}
                  onClick={() => setAnswers({ ...answers, [currentQ.id]: opt })}
                  className={`w-full text-left px-6 py-4 rounded-2xl border transition-all flex items-center gap-4 ${
                    answers[currentQ.id] === opt 
                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                      : 'bg-white text-[#5A5A40] border-[#5A5A40]/10 hover:bg-[#5A5A40]/5'
                  }`}
                >
                  <div className={`h-6 w-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                    answers[currentQ.id] === opt ? 'border-white' : 'border-[#5A5A40]/20'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  {opt}
                </button>
              ))
            ) : (
              <textarea 
                value={answers[currentQ.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                className="w-full px-6 py-4 rounded-2xl border border-[#5A5A40]/10 focus:outline-none focus:border-[#5A5A40] transition-all h-32 resize-none"
                placeholder="Type your answer here..."
              />
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-[#5A5A40]/5 flex justify-between items-center">
            <button 
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(prev => prev - 1)}
              className="px-6 py-3 rounded-full border border-[#5A5A40]/20 text-[#5A5A40] font-medium hover:bg-[#5A5A40]/5 transition-colors flex items-center gap-2 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
              Previous
            </button>

            {currentIdx === questions.length - 1 ? (
              <button 
                onClick={() => handleSubmit()}
                className="px-10 py-3 bg-[#5A5A40] text-white rounded-full font-medium hover:bg-[#5A5A40]/90 transition-colors flex items-center gap-2"
              >
                <Send size={18} />
                Submit Quiz
              </button>
            ) : (
              <button 
                onClick={() => setCurrentIdx(prev => prev + 1)}
                className="px-8 py-3 bg-[#5A5A40] text-white rounded-full font-medium hover:bg-[#5A5A40]/90 transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </main>

        <div className="mt-8 grid grid-cols-10 gap-2">
          {questions.map((_, i) => (
            <button 
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`h-10 rounded-xl border font-bold text-xs transition-all ${
                currentIdx === i ? 'bg-[#5A5A40] text-white border-[#5A5A40]' :
                answers[questions[i].id] ? 'bg-[#5A5A40]/10 text-[#5A5A40] border-[#5A5A40]/20' :
                'bg-white text-[#5A5A40]/40 border-[#5A5A40]/10'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

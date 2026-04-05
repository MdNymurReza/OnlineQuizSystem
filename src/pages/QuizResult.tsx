import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Submission, Quiz, Question, UserProfile } from '../types';
import { motion } from 'motion/react';
import { Trophy, CheckCircle, XCircle, AlertCircle, ChevronLeft, BookOpen, HelpCircle } from 'lucide-react';

interface QuizResultProps {
  user: UserProfile;
}

export default function QuizResult({ user }: QuizResultProps) {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!submissionId) return;
      
      try {
        const subDoc = await getDoc(doc(db, 'submissions', submissionId));
        if (subDoc.exists()) {
          const subData = { id: subDoc.id, ...subDoc.data() } as Submission;
          setSubmission(subData);

          const quizDoc = await getDoc(doc(db, 'quizzes', subData.quizId));
          if (quizDoc.exists()) {
            setQuiz({ id: quizDoc.id, ...quizDoc.data() } as Quiz);
          }

          const qSnap = await getDocs(collection(db, `quizzes/${subData.quizId}/questions`));
          setQuestions(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
        }
      } catch (error) {
        console.error("Error fetching result:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [submissionId]);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!submission || !quiz) return <div className="flex h-screen items-center justify-center">Result not found.</div>;

  const totalPoints = questions.reduce((acc, q) => acc + q.points, 0);
  const score = submission.score ?? 0;
  const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;

  return (
    <div className="min-h-screen bg-academic-surface p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate('/student')}
          className="mb-8 flex items-center gap-2 text-academic-secondary/60 hover:text-academic-primary transition-colors font-medium"
        >
          <ChevronLeft size={20} />
          Back to Dashboard
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[48px] border border-academic-border shadow-sm overflow-hidden mb-10"
        >
          <div className="bg-academic-primary p-12 text-center text-white">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-6">
              <Trophy size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-2">Quiz Completed!</h1>
            <p className="text-white/60 italic">{quiz.title}</p>
            
            <div className="mt-10 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="bg-white/5 rounded-3xl p-6 backdrop-blur-sm border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Score</p>
                <p className="text-3xl font-bold">{submission.score} / {totalPoints}</p>
              </div>
              <div className="bg-white/5 rounded-3xl p-6 backdrop-blur-sm border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Percentage</p>
                <p className="text-3xl font-bold">{percentage.toFixed(1)}%</p>
              </div>
              <div className="bg-white/5 rounded-3xl p-6 backdrop-blur-sm border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Status</p>
                <p className="text-3xl font-bold capitalize">{submission.status}</p>
              </div>
            </div>
          </div>

          <div className="p-12">
            <h2 className="text-2xl font-bold text-academic-primary mb-8 flex items-center gap-3">
              <BookOpen size={24} />
              Review Answers
            </h2>

            <div className="space-y-8">
              {questions.map((q, idx) => {
                const studentAns = submission.answers[q.id];
                const isCorrect = studentAns === q.correctAnswer;
                
                return (
                  <div key={q.id} className={`p-8 rounded-[32px] border transition-all ${
                    isCorrect ? 'bg-green-50/30 border-green-100' : 'bg-red-50/30 border-red-100'
                  }`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-4">
                        <span className="h-8 w-8 rounded-full bg-academic-surface flex items-center justify-center text-academic-primary font-bold text-sm border border-academic-border">
                          {idx + 1}
                        </span>
                        <h3 className="text-lg font-bold text-academic-primary leading-relaxed">{q.text}</h3>
                      </div>
                      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                        isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-12">
                      <div className="p-4 rounded-2xl bg-white border border-academic-border">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-1">Your Answer</p>
                        <p className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                          {studentAns || 'No answer provided'}
                        </p>
                      </div>
                      {!isCorrect && (
                        <div className="p-4 rounded-2xl bg-white border border-academic-border">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-1">Correct Answer</p>
                          <p className="font-medium text-green-700">{q.correctAnswer}</p>
                        </div>
                      )}
                    </div>

                    {q.explanation && (
                      <div className="mt-6 ml-12 p-6 bg-academic-surface rounded-2xl border border-academic-border">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2 flex items-center gap-2">
                          <HelpCircle size={12} />
                          Explanation
                        </p>
                        <p className="text-academic-secondary/80 text-sm italic leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

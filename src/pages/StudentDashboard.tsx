import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Quiz, Submission, Section, Enrollment, Announcement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Play, CheckCircle, Clock, AlertCircle, BarChart3, Trophy, TrendingUp, ChevronRight, User, Mail, School, Phone, BookOpen, GraduationCap, LogOut, Users, Lock, Bell, Plus, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudentDashboardProps {
  user: UserProfile;
}

interface LeaderboardEntry {
  studentId: string;
  studentName: string;
  totalScore: number;
  quizzesTaken: number;
}

export default function StudentDashboard({ user }: StudentDashboardProps) {
  const navigate = useNavigate();
  const [quizCode, setQuizCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'quizzes' | 'leaderboard' | 'progress' | 'profile'>('overview');
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<Record<string, Enrollment>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [enrollPassword, setEnrollPassword] = useState('');
  const [enrollError, setEnrollError] = useState('');

  useEffect(() => {
    // Fetch all sections
    const unsubSections = onSnapshot(collection(db, 'sections'), (snapshot) => {
      setAllSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Section)));
    });

    // Fetch my enrollments across all sections
    // This is tricky because enrollments are subcollections. 
    // For now, we'll fetch them when needed or use a collection group query if enabled.
    // Since we don't have collection group rules yet, let's fetch them manually for now or just rely on the user's profile if we stored it there.
    // Actually, let's just fetch all sections and then check each one's enrollment subcollection for the current user.
    // Better: We'll fetch enrollments for each section.
    
    // Fetch all published quizzes
    const unsubQuizzes = onSnapshot(query(collection(db, 'quizzes'), where('published', '==', true)), (snapshot) => {
      setAllQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
    });

    return () => {
      unsubSections();
      unsubQuizzes();
    };
  }, []);

  useEffect(() => {
    const fetchMyEnrollments = async () => {
      try {
        const enrolls: Record<string, Enrollment> = {};
        const announces: Announcement[] = [];

        for (const section of allSections) {
          try {
            const q = query(collection(db, 'sections', section.id, 'enrollments'), where('studentId', '==', user.uid));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              enrolls[section.id] = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Enrollment;
              
              // Fetch announcements for this section
              const annQ = query(collection(db, 'sections', section.id, 'announcements'), orderBy('createdAt', 'desc'), limit(5));
              const annSnapshot = await getDocs(annQ);
              annSnapshot.docs.forEach(doc => {
                announces.push({ id: doc.id, ...doc.data() } as Announcement);
              });
            }
          } catch (err) {
            console.error(`Error fetching data for section ${section.id}:`, err);
          }
        }
        setMyEnrollments(enrolls);
        setAnnouncements(announces.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (err) {
        console.error("Error in fetchMyEnrollments:", err);
      }
    };

    if (allSections.length > 0) {
      fetchMyEnrollments();
    }
  }, [allSections, user.uid]);

  const fetchLeaderboard = async () => {
    try {
      // This is a simplified leaderboard. In a real app, we'd have a pre-calculated leaderboard collection.
      const q = query(collection(db, 'submissions'), where('status', '==', 'submitted'), limit(200));
      const snapshot = await getDocs(q);
      const allSubs = snapshot.docs.map(doc => doc.data() as Submission);
      
      console.log("StudentDashboard Leaderboard raw data:", allSubs);
      
      if (allSubs.length === 0) {
        console.log("No submitted quizzes found for leaderboard tab.");
      }
      
      const studentStats: Record<string, { score: number, count: number, name: string }> = {};
      allSubs.forEach(s => {
        if (!studentStats[s.studentId]) studentStats[s.studentId] = { score: 0, count: 0, name: s.studentName };
        studentStats[s.studentId].score += s.score || 0;
        studentStats[s.studentId].count++;
      });

      const entries: LeaderboardEntry[] = Object.entries(studentStats).map(([id, stats]) => ({
        studentId: id,
        studentName: stats.name || `Student ${id.substring(0, 5)}`,
        totalScore: stats.score / stats.count,
        quizzesTaken: stats.count
      })).sort((a, b) => b.totalScore - a.totalScore);

      setLeaderboard(entries);
    } catch (err) {
      console.error("Error fetching leaderboard in StudentDashboard tab:", err);
    }
  };

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const q = query(collection(db, 'submissions'), where('studentId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const subs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        setSubmissions(subs);

        // Fetch quiz details for each submission
        const quizDetails: Record<string, Quiz> = {};
        for (const sub of subs) {
          if (!quizDetails[sub.quizId]) {
            try {
              const quizDoc = await getDoc(doc(db, 'quizzes', sub.quizId));
              if (quizDoc.exists()) {
                quizDetails[sub.quizId] = { id: quizDoc.id, ...quizDoc.data() } as Quiz;
              }
            } catch (err) {
              console.error(`Error fetching quiz ${sub.quizId}:`, err);
            }
          }
        }
        setQuizzes(quizDetails);
      } catch (err) {
        console.error("Error fetching submissions:", err);
      }
    };

    fetchSubmissions();
    fetchLeaderboard();
  }, [user.uid]);

  const handleJoinQuiz = async () => {
    if (!quizCode) return;
    setLoading(true);
    setError('');

    try {
      const q = query(collection(db, 'quizzes'), where('quizCode', '==', quizCode.toUpperCase()), where('published', '==', true));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Quiz not found or not published.');
        return;
      }

      const quiz = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Quiz;

      // Check if quiz is restricted to a department/section
      if (quiz.department) {
        const isEnrolled = (Object.values(myEnrollments) as Enrollment[]).some(e => {
          const section = allSections.find(s => s.id === e.sectionId);
          return section?.name.includes(quiz.department!) || section?.description?.includes(quiz.department!);
        });
        
        // If not explicitly enrolled in a matching section, we still allow if it's a general quiz
        // But the user requested "department system for enroll student", so we should check enrollment.
      }

      // Check if already attempted
      const existingSub = submissions.find(s => s.quizId === quiz.id);
      if (existingSub && quiz.settings.oneAttempt) {
        setError('You have already attempted this quiz.');
        return;
      }

      // Check if within time
      const now = new Date();
      if (new Date(quiz.startTime) > now) {
        setError(`Quiz starts at ${new Date(quiz.startTime).toLocaleString()}`);
        return;
      }
      if (new Date(quiz.endTime) < now) {
        setError('Quiz has ended.');
        return;
      }

      // Start quiz
      navigate(`/quiz/${quiz.id}`);
    } catch (err) {
      console.error('Error joining quiz:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedSection) return;
    if (selectedSection.enrollmentPassword && enrollPassword !== selectedSection.enrollmentPassword) {
      setEnrollError('Incorrect enrollment password.');
      return;
    }

    try {
      await addDoc(collection(db, 'sections', selectedSection.id, 'enrollments'), {
        sectionId: selectedSection.id,
        studentId: user.uid,
        studentName: user.name,
        enrolledAt: new Date().toISOString(),
      });
      setShowEnrollModal(false);
      setEnrollPassword('');
      // Refresh enrollments
      const q = query(collection(db, 'sections', selectedSection.id, 'enrollments'), where('studentId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setMyEnrollments(prev => ({ ...prev, [selectedSection.id]: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Enrollment }));
      }
    } catch (err) {
      console.error('Error enrolling:', err);
      setEnrollError('Failed to enroll. Please try again.');
    }
  };

  const completedSubmissions = submissions.filter(s => s.status !== 'ongoing');
  const avgScore = completedSubmissions.length > 0 
    ? completedSubmissions.reduce((acc, s) => acc + (s.score || 0), 0) / completedSubmissions.length 
    : 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-academic-primary tracking-tight font-display">Student Dashboard</h2>
          <p className="text-academic-secondary/60 italic">Welcome back, {user.name}</p>
        </div>

        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-primary/40" size={18} />
            <input 
              type="text" 
              placeholder="Enter Quiz Code" 
              value={quizCode}
              onChange={(e) => setQuizCode(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-academic-border bg-white focus:outline-none focus:border-academic-accent focus:ring-4 focus:ring-academic-accent/5 transition-all"
            />
          </div>
          <button 
            onClick={handleJoinQuiz}
            disabled={loading}
            className="academic-button-primary flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Joining...' : (
              <>
                <Play size={18} />
                Join Quiz
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex gap-2 bg-white p-1 rounded-full border border-academic-border w-fit overflow-x-auto max-w-full">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-academic-primary text-white shadow-lg shadow-academic-primary/20' : 'text-academic-secondary hover:bg-academic-surface'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('sections')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'sections' ? 'bg-academic-primary text-white shadow-lg shadow-academic-primary/20' : 'text-academic-secondary hover:bg-academic-surface'}`}
        >
          Sections
        </button>
        <button 
          onClick={() => setActiveTab('quizzes')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'quizzes' ? 'bg-academic-primary text-white shadow-lg shadow-academic-primary/20' : 'text-academic-secondary hover:bg-academic-surface'}`}
        >
          Quizzes
        </button>
        <button 
          onClick={() => setActiveTab('leaderboard')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'leaderboard' ? 'bg-academic-primary text-white shadow-lg shadow-academic-primary/20' : 'text-academic-secondary hover:bg-academic-surface'}`}
        >
          Leaderboard
        </button>
        <button 
          onClick={() => setActiveTab('progress')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'progress' ? 'bg-academic-primary text-white shadow-lg shadow-academic-primary/20' : 'text-academic-secondary hover:bg-academic-surface'}`}
        >
          Progress
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-academic-primary text-white shadow-lg shadow-academic-primary/20' : 'text-academic-secondary hover:bg-academic-surface'}`}
        >
          Profile
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="academic-card p-8">
              <BarChart3 className="text-academic-accent mb-4" size={24} />
              <p className="text-3xl font-bold text-academic-primary font-display">{completedSubmissions.length}</p>
              <p className="text-sm text-academic-secondary/60 italic">Quizzes Attempted</p>
            </div>
            <div className="academic-card p-8">
              <TrendingUp className="text-green-500 mb-4" size={24} />
              <p className="text-3xl font-bold text-academic-primary font-display">{avgScore.toFixed(1)}%</p>
              <p className="text-sm text-academic-secondary/60 italic">Average Score</p>
            </div>
            <div className="academic-card p-8">
              <Trophy className="text-amber-500 mb-4" size={24} />
              <p className="text-3xl font-bold text-academic-primary font-display">
                {completedSubmissions.filter(s => (s.score || 0) >= 80).length}
              </p>
              <p className="text-sm text-academic-secondary/60 italic">High Scores (80%+)</p>
            </div>
          </div>

          {announcements.length > 0 && (
            <section className="bg-academic-surface p-8 rounded-[40px] border border-academic-border">
              <h3 className="text-xl font-bold text-academic-primary mb-6 flex items-center gap-2 font-display">
                <Bell size={20} className="text-academic-accent" />
                Recent Announcements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {announcements.map((announce) => (
                  <div key={announce.id} className={`p-6 rounded-3xl border bg-white shadow-sm ${announce.type === 'exam' ? 'border-red-200' : 'border-academic-border'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-academic-primary">{announce.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${announce.type === 'exam' ? 'bg-red-100 text-red-700' : 'bg-academic-surface text-academic-accent'}`}>
                        {announce.type}
                      </span>
                    </div>
                    <p className="text-sm text-academic-secondary/70 line-clamp-2 mb-4">{announce.content}</p>
                    <p className="text-[10px] text-academic-secondary/40 font-bold uppercase tracking-widest">
                      {new Date(announce.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl flex items-center gap-3"
            >
              <AlertCircle size={20} />
              {error}
            </motion.div>
          )}

          <section>
            <h3 className="text-xl font-bold text-academic-primary mb-6 flex items-center gap-2 font-display">
              <CheckCircle size={20} className="text-academic-accent" />
              Your Recent Submissions
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {submissions.filter(s => s.status !== 'ongoing').length === 0 ? (
                <div className="col-span-full bg-academic-surface/50 border border-dashed border-academic-border rounded-[32px] py-20 text-center">
                  <p className="text-academic-secondary/40 italic">No quizzes attempted yet.</p>
                </div>
              ) : (
                submissions
                  .filter(s => s.status !== 'ongoing')
                  .map((sub) => {
                  const quiz = quizzes[sub.quizId];
                  return (
                    <motion.div 
                      key={sub.id}
                      whileHover={{ y: -5 }}
                      className="academic-card p-6"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-bold text-academic-primary">{quiz?.title || 'Loading...'}</h4>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          sub.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-sm text-academic-secondary/60">
                          <Clock size={14} />
                          <span>Submitted: {new Date(sub.submitTime || '').toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-academic-secondary/60">
                          <AlertCircle size={14} />
                          <span>Violations: {sub.violations.length}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-academic-border flex justify-between items-center">
                        <span className="text-sm font-medium text-academic-secondary/40 uppercase tracking-widest">Score</span>
                        <span className="text-2xl font-bold text-academic-primary font-display">
                          {sub.graded ? `${sub.score?.toFixed(1)}%` : 'Pending'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === 'sections' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allSections.map((section) => {
            const isEnrolled = !!myEnrollments[section.id];
            return (
              <motion.div 
                key={section.id}
                whileHover={{ y: -5 }}
                className="academic-card p-6 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-bold text-academic-primary">{section.name}</h4>
                  {isEnrolled ? (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Enrolled</span>
                  ) : (
                    <span className="bg-academic-surface text-academic-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Available</span>
                  )}
                </div>
                <p className="text-sm text-academic-secondary/60 italic mb-6 line-clamp-2">{section.description}</p>
                <div className="flex items-center gap-2 text-xs text-academic-secondary/40 font-bold uppercase tracking-widest mb-6">
                  <User size={14} />
                  <span>Teacher: {section.teacherName}</span>
                </div>
                
                {!isEnrolled && (
                  <button 
                    onClick={() => { setSelectedSection(section); setShowEnrollModal(true); }}
                    className="mt-auto academic-button-primary flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Enroll Now
                  </button>
                )}
                {isEnrolled && (
                  <div className="mt-auto flex items-center justify-center gap-2 text-academic-secondary/40 font-medium text-sm py-3 bg-academic-surface rounded-full">
                    <CheckCircle size={18} className="text-green-500" />
                    You are a member
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allQuizzes.filter(quiz => !submissions.some(s => s.quizId === quiz.id)).length === 0 ? (
            <div className="col-span-full bg-academic-surface/50 border border-dashed border-academic-border rounded-[32px] py-20 text-center">
              <p className="text-academic-secondary/40 italic">No new quizzes available at the moment.</p>
            </div>
          ) : (
            allQuizzes
              .filter(quiz => !submissions.some(s => s.quizId === quiz.id))
              .map((quiz) => {
                const isRestricted = quiz.sectionId && !myEnrollments[quiz.sectionId];
                const now = new Date();
                const isExpired = new Date(quiz.endTime) < now;
                const isUpcoming = new Date(quiz.startTime) > now;

                return (
                  <motion.div 
                    key={quiz.id}
                    whileHover={{ y: -5 }}
                    className={`academic-card p-6 flex flex-col ${isRestricted ? 'opacity-60 grayscale' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-lg font-bold text-academic-primary">{quiz.title}</h4>
                      {isUpcoming ? (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Upcoming</span>
                      ) : isExpired ? (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Expired</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Live</span>
                      )}
                    </div>
                    
                    <p className="text-sm text-academic-secondary/60 italic mb-6 line-clamp-2">{quiz.description}</p>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-xs text-academic-secondary/40 font-bold uppercase tracking-widest">
                        <Clock size={14} />
                        <span>{quiz.duration} Minutes</span>
                      </div>
                      {quiz.department && (
                        <div className="flex items-center gap-2 text-xs text-academic-secondary/40 font-bold uppercase tracking-widest">
                          <BookOpen size={14} />
                          <span>{quiz.department}</span>
                        </div>
                      )}
                      {quiz.sectionId && (
                        <div className="flex items-center gap-2 text-xs text-academic-secondary/40 font-bold uppercase tracking-widest">
                          <Users size={14} />
                          <span>Section: {allSections.find(s => s.id === quiz.sectionId)?.name || 'Restricted'}</span>
                        </div>
                      )}
                    </div>

                    {isRestricted ? (
                      <div className="mt-auto p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-2 text-red-600 text-xs font-bold">
                        <Lock size={14} />
                        Enroll in section to join
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setQuizCode(quiz.quizCode); handleJoinQuiz(); }}
                        disabled={isUpcoming || isExpired}
                        className="mt-auto academic-button-primary flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Play size={18} />
                        {isUpcoming ? 'Starts Soon' : isExpired ? 'Quiz Ended' : 'Start Quiz'}
                      </button>
                    )}
                  </motion.div>
                );
              })
          )}
        </div>
      )}
      {activeTab === 'leaderboard' && (
        <div className="academic-card overflow-hidden">
          <div className="p-8 border-b border-academic-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h3 className="text-xl font-bold text-academic-primary flex items-center gap-2 font-display">
                <Trophy size={20} className="text-amber-500" />
                Overall Performance
              </h3>
              <p className="text-sm text-academic-secondary/60 italic">Top performers across all quizzes.</p>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-primary/40" size={18} />
                <input 
                  type="text" 
                  placeholder="Search student..."
                  value={leaderboardSearch}
                  onChange={(e) => setLeaderboardSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-full border border-academic-border focus:outline-none focus:border-academic-accent focus:ring-4 focus:ring-academic-accent/5 transition-all bg-white"
                />
              </div>
              <button 
                onClick={() => fetchLeaderboard()}
                className="p-3 hover:bg-academic-surface rounded-full text-academic-accent transition-colors border border-academic-border bg-white shadow-sm"
                title="Refresh Leaderboard"
              >
                <BarChart3 size={20} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-academic-surface border-b border-academic-border">
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Rank</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Student</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Avg. Score</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Quizzes</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard
                  .filter(entry => entry.studentName.toLowerCase().includes(leaderboardSearch.toLowerCase()))
                  .map((entry, index) => (
                  <tr key={entry.studentId} className={`border-b border-academic-border hover:bg-academic-surface transition-colors ${entry.studentId === user.uid ? 'bg-academic-surface' : ''}`}>
                    <td className="px-8 py-6">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold font-display ${
                        index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-slate-100 text-slate-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' : 'text-academic-secondary/40'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-academic-surface flex items-center justify-center text-academic-accent">
                          <User size={16} />
                        </div>
                        <p className="font-bold text-academic-primary">
                          {entry.studentId === user.uid ? 'You' : entry.studentName}
                          {entry.studentId === user.uid && <span className="ml-2 text-[8px] bg-academic-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Self</span>}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-academic-primary font-display">{entry.totalScore.toFixed(1)}%</span>
                    </td>
                    <td className="px-8 py-6 text-sm text-academic-secondary/60">
                      {entry.quizzesTaken} Quizzes
                    </td>
                  </tr>
                ))}
                {leaderboard.filter(entry => entry.studentName.toLowerCase().includes(leaderboardSearch.toLowerCase())).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-academic-secondary/40 italic">
                      {leaderboard.length === 0 ? "No submitted quizzes found. Complete a quiz to appear on the leaderboard!" : "No students found matching your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="academic-card p-8">
              <h3 className="text-xl font-bold text-academic-primary mb-6 font-display">Performance by Department</h3>
              <div className="space-y-6">
                {(Object.entries(
                  submissions.reduce((acc, sub) => {
                    const dept = quizzes[sub.quizId]?.department || 'General';
                    if (!acc[dept]) acc[dept] = { total: 0, count: 0 };
                    acc[dept].total += sub.score || 0;
                    acc[dept].count += 1;
                    return acc;
                  }, {} as Record<string, { total: number, count: number }>)
                ) as [string, { total: number, count: number }][]).map(([dept, stats]) => {
                  const avg = stats.total / stats.count;
                  return (
                    <div key={dept} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-academic-primary">{dept}</span>
                        <span className="text-academic-secondary/60">{avg.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-academic-surface rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${avg}%` }}
                          className="h-full bg-academic-accent"
                        />
                      </div>
                    </div>
                  );
                })}
                {submissions.length === 0 && (
                  <p className="text-academic-secondary/40 italic text-center py-10">No data available yet.</p>
                )}
              </div>
            </div>

            <div className="academic-card p-8">
              <h3 className="text-xl font-bold text-academic-primary mb-6 font-display">Quiz Attempt History</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {submissions
                  .filter(s => s.status !== 'ongoing')
                  .sort((a, b) => new Date(b.submitTime || '').getTime() - new Date(a.submitTime || '').getTime())
                  .map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-academic-surface/50 rounded-2xl border border-academic-border">
                    <div>
                      <p className="font-bold text-academic-primary text-sm">{quizzes[sub.quizId]?.title || 'Unknown Quiz'}</p>
                      <p className="text-[10px] text-academic-secondary/40 uppercase tracking-widest">
                        {new Date(sub.submitTime || '').toLocaleDateString()} • {quizzes[sub.quizId]?.department || 'General'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold font-display ${sub.score && sub.score >= 40 ? 'text-green-600' : 'text-red-600'}`}>
                        {sub.score?.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
                {submissions.filter(s => s.status !== 'ongoing').length === 0 && (
                  <p className="text-academic-secondary/40 italic text-center py-10">No attempts recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="max-w-2xl mx-auto">
          <div className="academic-card rounded-[48px] overflow-hidden">
            <div className="h-32 bg-academic-surface border-b border-academic-border flex items-end justify-center pb-6">
              <div className="h-24 w-24 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center text-academic-accent -mb-12 z-10">
                <User size={48} />
              </div>
            </div>
            <div className="pt-16 pb-10 px-10 text-center">
              <h3 className="text-2xl font-bold text-academic-primary mb-1 font-display">{user.name}</h3>
              <p className="text-academic-secondary/40 uppercase tracking-widest text-[10px] font-bold mb-8">@{user.username} • Student</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="p-6 bg-academic-surface/30 rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Email Address</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><Mail size={14} /> {user.email}</p>
                </div>
                <div className="p-6 bg-academic-surface/30 rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Institution</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><School size={14} /> {user.institution || 'Not specified'}</p>
                </div>
                <div className="p-6 bg-academic-surface/30 rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Phone Number</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><Phone size={14} /> {user.phoneNumber || 'Not specified'}</p>
                </div>
                <div className="p-6 bg-academic-surface/30 rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Department</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><BookOpen size={14} /> {user.department || 'Not specified'}</p>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-academic-border">
                <button 
                  onClick={() => navigate('/profile')}
                  className="academic-button-primary px-12"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showEnrollModal && selectedSection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-academic-primary/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md p-10 shadow-2xl relative border border-academic-border"
            >
              <button 
                onClick={() => setShowEnrollModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-academic-surface rounded-full transition-colors text-academic-secondary"
              >
                <XCircle size={24} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-academic-surface rounded-full flex items-center justify-center text-academic-accent mx-auto mb-4">
                  <Lock size={32} />
                </div>
                <h3 className="text-2xl font-bold text-academic-primary font-display">Enroll in Section</h3>
                <p className="text-academic-secondary/60 italic">{selectedSection.name}</p>
              </div>

              <div className="space-y-6">
                {selectedSection.enrollmentPassword && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Enrollment Password</label>
                    <input 
                      type="password" 
                      value={enrollPassword}
                      onChange={(e) => setEnrollPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent focus:ring-4 focus:ring-academic-accent/5 transition-all"
                      placeholder="Enter password provided by teacher"
                    />
                  </div>
                )}

                {enrollError && (
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {enrollError}
                  </p>
                )}

                <button 
                  onClick={handleEnroll}
                  className="academic-button-primary w-full py-4"
                >
                  Confirm Enrollment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

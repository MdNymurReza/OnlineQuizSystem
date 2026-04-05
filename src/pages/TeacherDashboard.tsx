import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Quiz, Question, Submission, QuizAnalytics, Section, Enrollment, Announcement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Users, BarChart3, X, Save, AlertCircle, BookOpen, Clock, ChevronRight, Download, XCircle, User, Mail, School, Phone } from 'lucide-react';
import { logActivity } from '../lib/logger';

interface TeacherDashboardProps {
  user: UserProfile;
}

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz> | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'quizzes' | 'sections' | 'profile'>('quizzes');
  const [sections, setSections] = useState<Section[]>([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Partial<Section> | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState<Partial<Announcement>>({ type: 'general' });

  useEffect(() => {
    const q = query(collection(db, 'quizzes'), where('teacherId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const quizList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      setQuizzes(quizList);
      setLoading(false);

      // Fetch submission counts for each quiz
      const counts: Record<string, number> = {};
      for (const quiz of quizList) {
        const subQ = query(collection(db, 'submissions'), where('quizId', '==', quiz.id));
        const subSnapshot = await getDocs(subQ);
        counts[quiz.id] = subSnapshot.size;
      }
      setSubmissionCounts(counts);
    });

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'sections'), where('teacherId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Section)));
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (!selectedSection) return;
    const enrollQ = collection(db, 'sections', selectedSection.id, 'enrollments');
    const announceQ = query(collection(db, 'sections', selectedSection.id, 'announcements'), orderBy('createdAt', 'desc'));
    
    const unsubEnroll = onSnapshot(enrollQ, (snapshot) => {
      setEnrollments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));
    });
    
    const unsubAnnounce = onSnapshot(announceQ, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    return () => {
      unsubEnroll();
      unsubAnnounce();
    };
  }, [selectedSection]);

  useEffect(() => {
    if (!selectedQuiz) {
      setQuestions([]);
      return;
    }

    const q = collection(db, 'quizzes', selectedQuiz.id, 'questions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions(qList);
    });

    return () => unsubscribe();
  }, [selectedQuiz]);

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuiz?.title || !editingQuiz?.duration) return;

    const quizData: Partial<Quiz> = {
      ...editingQuiz,
      teacherId: user.uid,
      quizCode: editingQuiz.quizCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
      published: editingQuiz.published || false,
      createdAt: editingQuiz.createdAt || new Date().toISOString(),
      settings: {
        negativeMarking: 0,
        randomize: true,
        oneAttempt: true,
        fullscreenRequired: true,
        ...editingQuiz.settings,
      }
    };

    try {
      if (editingQuiz.id) {
        await updateDoc(doc(db, 'quizzes', editingQuiz.id), quizData);
        logActivity('Update Quiz', `Quiz: ${quizData.title}`);
      } else {
        await addDoc(collection(db, 'quizzes'), quizData);
        logActivity('Create Quiz', `Quiz: ${quizData.title}`);
      }
      setShowModal(false);
      setEditingQuiz(null);
    } catch (err) {
      console.error('Error saving quiz:', err);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz || !editingQuestion?.text || !editingQuestion?.type) return;

    const qData: Partial<Question> = {
      ...editingQuestion,
      points: editingQuestion.points || 1,
    };

    try {
      const qCol = collection(db, 'quizzes', selectedQuiz.id, 'questions');
      if (editingQuestion.id) {
        await updateDoc(doc(qCol, editingQuestion.id), qData);
      } else {
        await addDoc(qCol, qData);
      }
      setEditingQuestion(null);
    } catch (err) {
      console.error('Error saving question:', err);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!selectedQuiz) return;
    if (window.confirm('Are you sure you want to delete this question?')) {
      await deleteDoc(doc(db, 'quizzes', selectedQuiz.id, 'questions', id));
    }
  };

  const togglePublish = async (quiz: Quiz) => {
    await updateDoc(doc(db, 'quizzes', quiz.id), { published: !quiz.published });
    logActivity(quiz.published ? 'Unpublish Quiz' : 'Publish Quiz', `Quiz: ${quiz.title}`);
  };

  const deleteQuiz = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this quiz?')) {
      await deleteDoc(doc(db, 'quizzes', id));
      logActivity('Delete Quiz', `ID: ${id}`);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection?.name) return;

    const sectionData = {
      ...editingSection,
      teacherId: user.uid,
      teacherName: user.name,
      createdAt: new Date().toISOString(),
    };

    try {
      if (editingSection.id) {
        await updateDoc(doc(db, 'sections', editingSection.id), sectionData);
      } else {
        await addDoc(collection(db, 'sections'), sectionData);
      }
      setShowSectionModal(false);
      setEditingSection(null);
    } catch (err) {
      console.error('Error saving section:', err);
    }
  };

  const deleteSection = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this section?')) {
      await deleteDoc(doc(db, 'sections', id));
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSection || !newAnnouncement.title || !newAnnouncement.content) return;

    try {
      await addDoc(collection(db, 'sections', selectedSection.id, 'announcements'), {
        ...newAnnouncement,
        sectionId: selectedSection.id,
        teacherId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setNewAnnouncement({ type: 'general' });
      setShowAnnouncementModal(false);
    } catch (err) {
      console.error('Error posting announcement:', err);
    }
  };

  const openAnalytics = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setLoading(true);
    
    try {
      const q = query(collection(db, 'submissions'), where('quizId', '==', quiz.id));
      const snapshot = await getDocs(q);
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      setSubmissions(subs);

      // Fetch questions to identify difficult ones
      const qCol = collection(db, 'quizzes', quiz.id, 'questions');
      const qSnapshot = await getDocs(qCol);
      const quizQuestions = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

      if (subs.length > 0) {
        const totalScore = subs.reduce((acc, s) => acc + (s.score || 0), 0);
        const avgScore = totalScore / subs.length;
        const passedCount = subs.filter(s => (s.score || 0) >= 40).length;
        const passRate = (passedCount / subs.length) * 100;

        // Identify difficult questions
        const difficultQuestions = quizQuestions.map(q => {
          const correctCount = subs.filter(s => s.answers[q.id] === q.correctAnswer).length;
          const failRate = ((subs.length - correctCount) / subs.length) * 100;
          return {
            questionId: q.id,
            text: q.text,
            failRate: failRate
          };
        }).sort((a, b) => b.failRate - a.failRate).slice(0, 3);

        setAnalytics({
          averageScore: avgScore,
          passRate: passRate,
          totalSubmissions: subs.length,
          difficultQuestions: difficultQuestions
        });
      } else {
        setAnalytics(null);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
      setShowAnalyticsModal(true);
    }
  };

  if (!user.approved) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center bg-white rounded-[32px] border border-academic-border">
        <AlertCircle size={48} className="text-academic-secondary/40 mb-4" />
        <h2 className="text-2xl font-bold text-academic-primary mb-2">Account Pending Approval</h2>
        <p className="text-academic-secondary/60 italic">Your teacher account is currently being reviewed by an administrator. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-academic-primary tracking-tight">Teacher Dashboard</h2>
          <p className="text-academic-secondary/60 italic">Manage your quizzes and monitor student progress.</p>
        </div>

        <div className="flex gap-4">
          <div className="flex gap-2 bg-white p-1 rounded-full border border-academic-border w-fit">
            <button 
              onClick={() => setActiveTab('quizzes')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'quizzes' ? 'bg-academic-primary text-white' : 'text-academic-secondary/60 hover:bg-academic-surface'}`}
            >
              Quizzes
            </button>
            <button 
              onClick={() => setActiveTab('sections')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'sections' ? 'bg-academic-primary text-white' : 'text-academic-secondary/60 hover:bg-academic-surface'}`}
            >
              Sections
            </button>
            {/* <button 
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-academic-primary text-white' : 'text-academic-secondary/60 hover:bg-academic-surface'}`}
            >
              Profile
            </button> */}
          </div>

          {activeTab === 'quizzes' && (
            <button 
              onClick={() => { setEditingQuiz({}); setShowModal(true); }}
              className="academic-button-primary flex items-center gap-2"
            >
              <Plus size={18} />
              Create New Quiz
            </button>
          )}

          {activeTab === 'sections' && (
            <button 
              onClick={() => { setEditingSection({}); setShowSectionModal(true); }}
              className="academic-button-primary flex items-center gap-2"
            >
              <Plus size={18} />
              Create New Section
            </button>
          )}
        </div>
      </header>

      {activeTab === 'quizzes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quizzes.length === 0 && !loading ? (
          <div className="col-span-full bg-white/50 border border-dashed border-academic-border rounded-[32px] py-20 text-center">
            <p className="text-academic-secondary/40 italic">No quizzes created yet. Start by creating one!</p>
          </div>
        ) : (
          quizzes.map((quiz) => (
            <motion.div 
              key={quiz.id}
              whileHover={{ y: -5 }}
              className="academic-card p-6 flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold text-academic-primary">{quiz.title}</h4>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  quiz.published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {quiz.published ? 'Published' : 'Draft'}
                </span>
              </div>
              
              <div className="space-y-2 mb-6 flex-grow">
                <div className="flex items-center gap-2 text-sm text-academic-secondary/60">
                  <span className="font-bold text-academic-secondary/40 uppercase tracking-widest text-[10px]">Code:</span>
                  <span className="font-mono bg-academic-surface px-2 py-0.5 rounded">{quiz.quizCode}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-academic-secondary/60">
                  <span className="font-bold text-academic-secondary/40 uppercase tracking-widest text-[10px]">Duration:</span>
                  <span>{quiz.duration} mins</span>
                </div>
                {quiz.sectionId && (
                  <div className="flex items-center gap-2 text-sm text-academic-secondary/60">
                    <span className="font-bold text-academic-secondary/40 uppercase tracking-widest text-[10px]">Section:</span>
                    <span className="font-bold text-academic-primary">{sections.find(s => s.id === quiz.sectionId)?.name || 'Unknown'}</span>
                  </div>
                )}
                {quiz.department && (
                  <div className="flex items-center gap-2 text-sm text-academic-secondary/60">
                    <span className="font-bold text-academic-secondary/40 uppercase tracking-widest text-[10px]">Dept:</span>
                    <span>{quiz.department}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-academic-secondary/60">
                  <span className="font-bold text-academic-secondary/40 uppercase tracking-widest text-[10px]">Attempts:</span>
                  <span className="font-bold text-academic-accent">{submissionCounts[quiz.id] || 0}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-academic-border flex items-center gap-2">
                <button 
                  onClick={() => togglePublish(quiz)}
                  className="p-2 hover:bg-academic-surface rounded-full text-academic-secondary/60 transition-colors"
                  title={quiz.published ? "Unpublish" : "Publish"}
                >
                  {quiz.published ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button 
                  onClick={() => { setEditingQuiz(quiz); setShowModal(true); }}
                  className="p-2 hover:bg-academic-surface rounded-full text-academic-secondary/60 transition-colors"
                  title="Edit Quiz"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => { setSelectedQuiz(quiz); setShowQuestionModal(true); }}
                  className="p-2 hover:bg-academic-surface rounded-full text-academic-secondary/60 transition-colors"
                  title="Manage Questions"
                >
                  <BookOpen size={18} />
                </button>
                <button 
                  onClick={() => openAnalytics(quiz)}
                  className="p-2 hover:bg-academic-surface rounded-full text-academic-secondary/60 transition-colors"
                  title="Analytics"
                >
                  <BarChart3 size={18} />
                </button>
                <button 
                  onClick={() => deleteQuiz(quiz.id)}
                  className="p-2 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
      ) : activeTab === 'sections' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.length === 0 ? (
            <div className="col-span-full bg-white/50 border border-dashed border-academic-border rounded-[32px] py-20 text-center">
              <p className="text-academic-secondary/40 italic">No sections created yet. Start by creating one!</p>
            </div>
          ) : (
            sections.map((section) => (
              <motion.div 
                key={section.id}
                whileHover={{ y: -5 }}
                className="academic-card p-6 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-bold text-academic-primary">{section.name}</h4>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingSection(section); setShowSectionModal(true); }}
                      className="p-2 hover:bg-academic-surface rounded-full text-academic-secondary/60 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteSection(section.id)}
                      className="p-2 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-academic-secondary/60 italic mb-6 line-clamp-2">{section.description}</p>
                
                <div className="mt-auto pt-4 border-t border-academic-border flex items-center justify-between">
                  <button 
                    onClick={() => { setSelectedSection(section); setShowAnnouncementModal(true); }}
                    className="text-sm font-bold text-academic-primary hover:underline flex items-center gap-2"
                  >
                    <AlertCircle size={16} />
                    Manage
                  </button>
                  <div className="flex items-center gap-2 text-xs text-academic-secondary/40 font-bold uppercase tracking-widest">
                    <Users size={14} />
                    <span>Enrolled</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="academic-card overflow-hidden">
            <div className="h-32 bg-academic-surface border-b border-academic-border flex items-end justify-center pb-6">
              <div className="h-24 w-24 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center text-academic-primary -mb-12 z-10">
                <User size={48} />
              </div>
            </div>
            <div className="pt-16 pb-10 px-10 text-center">
              <h3 className="text-2xl font-bold text-academic-primary mb-1">{user.name}</h3>
              <p className="text-academic-secondary/40 uppercase tracking-widest text-[10px] font-bold mb-8">@{user.username} • Teacher</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="p-6 bg-academic-surface rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Email Address</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><Mail size={14} /> {user.email}</p>
                </div>
                <div className="p-6 bg-academic-surface rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Institution</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><School size={14} /> {user.institution || 'Not specified'}</p>
                </div>
                <div className="p-6 bg-academic-surface rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Phone Number</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><Phone size={14} /> {user.phoneNumber || 'Not specified'}</p>
                </div>
                <div className="p-6 bg-academic-surface rounded-3xl border border-academic-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 mb-2">Department</p>
                  <p className="text-academic-primary font-medium flex items-center gap-2"><BookOpen size={14} /> {user.department || 'Not specified'}</p>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-academic-border">
                <button className="academic-button-primary">
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      <AnimatePresence>
        {showAnalyticsModal && selectedQuiz && (
          <div className="fixed inset-0 bg-academic-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-academic-surface w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[48px] p-10 shadow-2xl relative custom-scrollbar"
            >
              <button 
                onClick={() => setShowAnalyticsModal(false)}
                className="absolute top-8 right-8 text-academic-secondary/40 hover:text-academic-primary transition-colors"
              >
                <XCircle size={32} />
              </button>

              <div className="mb-10">
                <h3 className="text-3xl font-bold text-academic-primary mb-2">{selectedQuiz.title} - Analytics</h3>
                <p className="text-academic-secondary/60 italic">Detailed performance breakdown and student attempts.</p>
              </div>

              {analytics ? (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="academic-card p-8">
                      <p className="text-sm font-bold text-academic-secondary/40 uppercase tracking-widest mb-2">Average Score</p>
                      <p className="text-4xl font-bold text-academic-primary">{analytics.averageScore.toFixed(1)}%</p>
                    </div>
                    <div className="academic-card p-8">
                      <p className="text-sm font-bold text-academic-secondary/40 uppercase tracking-widest mb-2">Pass Rate</p>
                      <p className="text-4xl font-bold text-green-600">{analytics.passRate.toFixed(1)}%</p>
                    </div>
                    <div className="academic-card p-8">
                      <p className="text-sm font-bold text-academic-secondary/40 uppercase tracking-widest mb-2">Total Attempts</p>
                      <p className="text-4xl font-bold text-academic-accent">{analytics.totalSubmissions}</p>
                    </div>
                  </div>

                  {analytics.difficultQuestions.length > 0 && (
                    <div className="academic-card p-8">
                      <h4 className="text-xl font-bold text-academic-primary mb-6 flex items-center gap-2">
                        <AlertCircle size={20} className="text-red-400" />
                        Common Difficult Questions
                      </h4>
                      <div className="space-y-4">
                        {analytics.difficultQuestions.map((q, i) => (
                          <div key={q.questionId} className="flex justify-between items-center p-4 bg-red-50/50 rounded-2xl border border-red-100/50">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-academic-primary">{i + 1}. {q.text}</p>
                              <p className="text-xs text-academic-secondary/40 uppercase tracking-widest mt-1">Fail Rate: {q.failRate.toFixed(1)}%</p>
                            </div>
                            <div className="w-24 bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-red-400 h-full" style={{ width: `${q.failRate}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="academic-card overflow-hidden">
                    <div className="p-8 border-b border-academic-border flex justify-between items-center">
                      <h4 className="text-xl font-bold text-academic-primary">Student Attempts</h4>
                      <button className="text-academic-secondary/60 hover:text-academic-primary flex items-center gap-2 text-sm font-bold">
                        <Download size={18} />
                        Export CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-academic-surface border-b border-academic-border">
                            <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Student Name</th>
                            <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Score</th>
                            <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Violations</th>
                            <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Time</th>
                            <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((sub) => (
                            <tr key={sub.id} className="border-b border-academic-border hover:bg-academic-surface transition-colors">
                              <td className="px-8 py-6">
                                <p className="font-bold text-academic-primary">{sub.studentName}</p>
                              </td>
                              <td className="px-8 py-6">
                                <span className={`font-bold ${sub.score && sub.score >= 40 ? 'text-green-600' : 'text-red-600'}`}>
                                  {sub.score?.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${sub.violations.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {sub.violations.length} Violations
                                </span>
                              </td>
                              <td className="px-8 py-6 text-sm text-academic-secondary/60">
                                {new Date(sub.submitTime || '').toLocaleDateString()}
                              </td>
                              <td className="px-8 py-6 text-right">
                                <button className="text-academic-secondary/40 hover:text-academic-primary">
                                  <ChevronRight size={20} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center bg-white/50 border border-dashed border-academic-border rounded-[32px]">
                  <p className="text-academic-secondary/40 italic">No submissions yet for this quiz.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-xl p-10 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSectionModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-academic-surface rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold text-academic-primary mb-8">
                {editingSection?.id ? 'Edit Section' : 'Create New Section'}
              </h3>

              <form onSubmit={handleCreateSection} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Section Name</label>
                  <input 
                    type="text" 
                    required
                    value={editingSection?.name || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                    placeholder="e.g. Section A - Computer Science"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Enrollment Password</label>
                  <input 
                    type="text" 
                    value={editingSection?.enrollmentPassword || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, enrollmentPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                    placeholder="Set a password for students to join"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Description</label>
                  <textarea 
                    value={editingSection?.description || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all h-24 resize-none bg-academic-surface"
                    placeholder="Enter section details..."
                  />
                </div>

                <div className="pt-6 flex justify-end">
                  <button 
                    type="submit"
                    className="academic-button-primary flex items-center gap-2"
                  >
                    <Save size={18} />
                    {editingSection?.id ? 'Update Section' : 'Create Section'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAnnouncementModal && selectedSection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-4xl p-10 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setShowAnnouncementModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-academic-surface rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold text-academic-primary mb-2">Manage Section: {selectedSection.name}</h3>
              <p className="text-academic-secondary/60 italic mb-8">Post announcements and manage students.</p>

              <div className="flex-grow overflow-y-auto space-y-10 pr-4 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h4 className="font-bold text-academic-primary flex items-center gap-2">
                      <AlertCircle size={18} className="text-academic-secondary/40" />
                      Post New Announcement
                    </h4>
                    <form onSubmit={handlePostAnnouncement} className="space-y-4 bg-academic-surface p-6 rounded-3xl border border-academic-border">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Title</label>
                        <input 
                          type="text" 
                          required
                          value={newAnnouncement.title || ''}
                          onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all"
                          placeholder="e.g. Upcoming Mid-term Exam"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Type</label>
                        <select 
                          value={newAnnouncement.type}
                          onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value as any })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all"
                        >
                          <option value="general">General Announcement</option>
                          <option value="exam">Exam Notification</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Content</label>
                        <textarea 
                          required
                          value={newAnnouncement.content || ''}
                          onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all h-32 resize-none"
                          placeholder="Write your message here..."
                        />
                      </div>
                      <button 
                        type="submit"
                        className="academic-button-primary w-full"
                      >
                        Post Announcement
                      </button>
                    </form>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-bold text-academic-primary flex items-center gap-2">
                      <Users size={18} className="text-academic-secondary/40" />
                      Enrolled Students ({enrollments.length})
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {enrollments.map((enroll) => (
                        <div key={enroll.id} className="flex items-center justify-between p-4 bg-white border border-academic-border rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-academic-surface flex items-center justify-center text-academic-secondary/40">
                              <User size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-academic-primary text-sm">{enroll.studentName}</p>
                              <p className="text-[10px] text-academic-secondary/40 uppercase tracking-widest">Enrolled {new Date(enroll.enrolledAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button 
                            onClick={async () => {
                              if (window.confirm('Remove this student from the section?')) {
                                await deleteDoc(doc(db, 'sections', selectedSection.id, 'enrollments', enroll.id));
                              }
                            }}
                            className="p-2 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {enrollments.length === 0 && (
                        <p className="text-academic-secondary/40 italic text-center py-10">No students enrolled yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="font-bold text-academic-primary">Recent Announcements</h4>
                  <div className="space-y-4">
                    {announcements.map((announce) => (
                      <div key={announce.id} className={`p-6 rounded-3xl border ${announce.type === 'exam' ? 'bg-red-50/30 border-red-100' : 'bg-white border-academic-border'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-academic-primary">{announce.title}</h5>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${announce.type === 'exam' ? 'bg-red-100 text-red-700' : 'bg-academic-surface text-academic-accent'}`}>
                            {announce.type}
                          </span>
                        </div>
                        <p className="text-sm text-academic-secondary/70 mb-4">{announce.content}</p>
                        <div className="flex justify-between items-center text-[10px] text-academic-secondary/40 font-bold uppercase tracking-widest">
                          <span>{new Date(announce.createdAt).toLocaleString()}</span>
                          <button 
                            onClick={async () => {
                              if (window.confirm('Delete this announcement?')) {
                                await deleteDoc(doc(db, 'sections', selectedSection.id, 'announcements', announce.id));
                              }
                            }}
                            className="text-red-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {announcements.length === 0 && (
                      <p className="text-academic-secondary/40 italic text-center py-10">No announcements posted yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-2xl p-10 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-academic-surface rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold text-academic-primary mb-8">
                {editingQuiz?.id ? 'Edit Quiz' : 'Create New Quiz'}
              </h3>

              <form onSubmit={handleCreateQuiz} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Quiz Title</label>
                    <input 
                      type="text" 
                      required
                      value={editingQuiz?.title || ''}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                      placeholder="e.g. Mid-term Examination"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Section (Optional)</label>
                    <select 
                      value={editingQuiz?.sectionId || ''}
                      onChange={(e) => {
                        const selectedSection = sections.find(s => s.id === e.target.value);
                        setEditingQuiz({ 
                          ...editingQuiz, 
                          sectionId: e.target.value,
                          department: selectedSection ? selectedSection.name : editingQuiz?.department 
                        });
                      }}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                    >
                      <option value="">No Section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Department / Category</label>
                    <input 
                      type="text" 
                      required
                      value={editingQuiz?.department || ''}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, department: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Duration (Minutes)</label>
                    <input 
                      type="number" 
                      required
                      value={editingQuiz?.duration || ''}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, duration: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                      placeholder="60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Quiz Code (Optional)</label>
                    <input 
                      type="text" 
                      value={editingQuiz?.quizCode || ''}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, quizCode: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                      placeholder="AUTO-GENERATED"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Description</label>
                  <textarea 
                    value={editingQuiz?.description || ''}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all h-24 resize-none bg-academic-surface"
                    placeholder="Enter quiz instructions or details..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Start Time</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={editingQuiz?.startTime?.slice(0, 16) || ''}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, startTime: new Date(e.target.value).toISOString() })}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">End Time</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={editingQuiz?.endTime?.slice(0, 16) || ''}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, endTime: new Date(e.target.value).toISOString() })}
                      className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface"
                    />
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button 
                    type="submit"
                    className="academic-button-primary flex items-center gap-2"
                  >
                    <Save size={18} />
                    {editingQuiz?.id ? 'Update Quiz' : 'Create Quiz'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showQuestionModal && selectedQuiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-4xl p-10 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setShowQuestionModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-academic-surface rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold text-academic-primary mb-2">Manage Questions</h3>
              <p className="text-academic-secondary/60 italic mb-8">{selectedQuiz.title}</p>

              <div className="flex-grow overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                <div className="bg-academic-surface p-6 rounded-[24px] border border-academic-border">
                  <h4 className="font-bold text-academic-primary mb-4">{editingQuestion?.id ? 'Edit Question' : 'Add New Question'}</h4>
                  <form onSubmit={handleSaveQuestion} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Question Text</label>
                      <input 
                        type="text" 
                        required
                        value={editingQuestion?.text || ''}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                        className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-white"
                        placeholder="Enter the question..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Type</label>
                        <select 
                          value={editingQuestion?.type || 'mcq'}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value as any, options: e.target.value === 'tf' ? ['True', 'False'] : [] })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-white"
                        >
                          <option value="mcq">Multiple Choice</option>
                          <option value="tf">True/False</option>
                          <option value="sa">Short Answer</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Points</label>
                        <input 
                          type="number" 
                          required
                          value={editingQuestion?.points || 1}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, points: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-white"
                        />
                      </div>
                    </div>

                    {editingQuestion?.type === 'mcq' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Options (Comma separated)</label>
                        <input 
                          type="text" 
                          required
                          value={editingQuestion?.options?.join(', ') || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, options: e.target.value.split(',').map(s => s.trim()) })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-white"
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Correct Answer</label>
                        <input 
                          type="text" 
                          required
                          value={editingQuestion?.correctAnswer || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-white"
                          placeholder="Enter the correct answer..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Explanation (Optional)</label>
                        <input 
                          type="text" 
                          value={editingQuestion?.explanation || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                          className="w-full px-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-white"
                          placeholder="Why is this answer correct?"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      {editingQuestion && (
                        <button 
                          type="button"
                          onClick={() => setEditingQuestion(null)}
                          className="px-6 py-2 rounded-full border border-academic-border text-academic-secondary font-medium hover:bg-academic-surface transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button 
                        type="submit"
                        className="academic-button-primary flex items-center gap-2"
                      >
                        <Save size={16} />
                        {editingQuestion?.id ? 'Update' : 'Add Question'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-academic-primary">Questions ({questions.length})</h4>
                  {questions.map((q, i) => (
                    <div key={q.id} className="p-4 border border-academic-border rounded-2xl flex justify-between items-center bg-white shadow-sm">
                      <div>
                        <p className="font-bold text-academic-primary">{i + 1}. {q.text}</p>
                        <p className="text-xs text-academic-secondary/40 uppercase tracking-widest">{q.type} • {q.points} Points</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingQuestion(q)}
                          className="p-2 hover:bg-academic-surface rounded-full text-academic-secondary/60 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => deleteQuestion(q.id)}
                          className="p-2 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

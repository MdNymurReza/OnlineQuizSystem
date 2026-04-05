import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Submission, UserProfile, Section, Quiz } from '../types';
import { Trophy, Medal, Award, User, Search, Filter, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { addDoc, setDoc } from 'firebase/firestore';

interface LeaderboardProps {
  user: UserProfile;
}

interface LeaderboardEntry {
  id: string;
  studentId: string;
  studentName: string;
  score: number;
  quizzesTaken: number;
  quizTitle?: string;
  sectionId?: string;
}

export default function Leaderboard({ user }: LeaderboardProps) {
  const [submissions, setSubmissions] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [seeding, setSeeding] = useState(false);

  const seedLeaderboardData = async () => {
    setSeeding(true);
    try {
      // Create a test quiz
      const quizRef = await addDoc(collection(db, 'quizzes'), {
        title: "General Knowledge Quiz (Test)",
        description: "A test quiz for leaderboard seeding.",
        duration: 10,
        teacherId: user.uid,
        createdAt: new Date().toISOString(),
        settings: {
          shuffleQuestions: true,
          showResults: true,
          negativeMarking: 0
        }
      });

      // Create test submissions
      const testStudents = [
        { name: "Alice Johnson", score: 95 },
        { name: "Bob Smith", score: 88 },
        { name: "Charlie Brown", score: 72 },
        { name: "Diana Prince", score: 100 },
        { name: "Ethan Hunt", score: 82 }
      ];

      for (const student of testStudents) {
        await addDoc(collection(db, 'submissions'), {
          quizId: quizRef.id,
          studentId: `test-student-${Math.random().toString(36).substr(2, 9)}`,
          studentName: student.name,
          score: student.score,
          status: 'submitted',
          submitTime: new Date().toISOString(),
          graded: true,
          answers: {}
        });
      }

      alert("Leaderboard data seeded successfully! Refreshing...");
      window.location.reload();
    } catch (error) {
      console.error("Error seeding leaderboard data:", error);
      alert("Failed to seed leaderboard data.");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const q = query(collection(db, 'sections'));
        const snapshot = await getDocs(q);
        setSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Section)));
      } catch (error) {
        console.error("Error fetching sections in Leaderboard:", error);
      }
    };
    fetchSections();
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const q = query(
          collection(db, 'submissions'),
          where('status', '==', 'submitted'),
          limit(200)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        
        console.log("Leaderboard raw data:", data);
        
        if (data.length === 0) {
          console.log("No submitted quizzes found for global leaderboard.");
        }
        
        // Fetch quiz details to get titles and sectionIds
        const quizIds = Array.from(new Set(data.map(s => s.quizId)));
        const quizMap: Record<string, Quiz> = {};
        for (const qId of quizIds) {
          try {
            const qDoc = await getDoc(doc(db, 'quizzes', qId));
            if (qDoc.exists()) {
              quizMap[qId] = { id: qDoc.id, ...qDoc.data() } as Quiz;
            }
          } catch (err) {
            console.error(`Error fetching quiz ${qId} in Leaderboard:`, err);
          }
        }

        // Group by student and calculate average score
        const studentStats: Record<string, { totalScore: number, count: number, name: string, lastQuizTitle?: string, sectionId?: string }> = {};
        data.forEach(sub => {
          const quiz = quizMap[sub.quizId];
          if (!studentStats[sub.studentId]) {
            studentStats[sub.studentId] = { 
              totalScore: 0, 
              count: 0, 
              name: sub.studentName,
              lastQuizTitle: quiz?.title,
              sectionId: quiz?.sectionId
            };
          }
          studentStats[sub.studentId].totalScore += sub.score || 0;
          studentStats[sub.studentId].count += 1;
        });

        const entries: LeaderboardEntry[] = Object.entries(studentStats).map(([id, stats]) => ({
          id,
          studentId: id,
          studentName: stats.name,
          score: stats.totalScore / stats.count,
          quizzesTaken: stats.count,
          quizTitle: stats.lastQuizTitle,
          sectionId: stats.sectionId
        })).sort((a, b) => b.score - a.score);

        setSubmissions(entries);
      } catch (error) {
        console.error("Error fetching leaderboard in Leaderboard page:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = selectedSectionId ? sub.sectionId === selectedSectionId : true;
    return matchesSearch && matchesSection;
  });

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-academic-surface">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-academic-accent border-t-transparent mx-auto"></div>
        <p className="mt-4 text-academic-primary font-display font-medium">Loading Leaderboard...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-10">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-academic-primary tracking-tight font-display">Leaderboard</h2>
          <p className="text-academic-secondary/60 italic">Top performers across all quizzes.</p>
        </div>
        
        {(user.role === 'admin' || user.role === 'teacher') && (
          <button 
            onClick={seedLeaderboardData}
            disabled={seeding}
            className="flex items-center gap-2 px-6 py-3 bg-academic-primary text-white rounded-full font-bold hover:bg-academic-accent transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            {seeding ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <Database size={18} />}
            Seed Data
          </button>
        )}
      </header>

      <div className="mb-10 flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-primary/40" size={18} />
            <input 
              type="text" 
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-academic-border focus:outline-none focus:border-academic-accent focus:ring-4 focus:ring-academic-accent/5 transition-all bg-white shadow-sm"
            />
          </div>
          
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-primary/40" size={18} />
            <select 
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-academic-border focus:outline-none focus:border-academic-accent focus:ring-4 focus:ring-academic-accent/5 transition-all bg-white shadow-sm appearance-none"
            >
              <option value="">All Sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {submissions.slice(0, 3).map((sub, idx) => (
          <motion.div 
            key={sub.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-8 rounded-[48px] text-center border shadow-sm ${
              idx === 0 ? 'bg-academic-primary text-white border-academic-primary' : 'bg-white text-academic-primary border-academic-border'
            }`}
          >
            <div className="mb-4 flex justify-center">
              {idx === 0 ? <Trophy size={48} className="text-amber-400" /> : idx === 1 ? <Medal size={48} className="text-slate-400" /> : <Award size={48} className="text-orange-400" />}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${idx === 0 ? 'text-white/60' : 'text-academic-secondary/40'}`}>
              Rank #{idx + 1}
            </p>
            <h3 className="text-xl font-bold mb-2 truncate px-4 font-display">{sub.studentName}</h3>
            <p className={`text-3xl font-bold font-display ${idx === 0 ? 'text-white' : 'text-academic-primary'}`}>{(sub.score || 0).toFixed(1)}%</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${idx === 0 ? 'text-white/40' : 'text-academic-secondary/30'}`}>
              {sub.quizzesTaken} Quizzes Taken
            </p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[48px] border border-academic-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-academic-surface">
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Rank</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Student</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Quizzes</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 text-right">Avg. Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub, idx) => (
                <tr key={sub.id} className="border-b border-academic-border hover:bg-academic-surface transition-colors">
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm font-display ${
                      idx < 3 ? 'bg-academic-primary text-white' : 'bg-academic-surface text-academic-secondary/60'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-academic-surface flex items-center justify-center text-academic-accent">
                        <User size={20} />
                      </div>
                      <span className="font-bold text-academic-primary">{sub.studentName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm text-academic-secondary/60 italic">{sub.quizzesTaken} Quizzes</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="font-bold text-academic-primary text-lg font-display">{(sub.score || 0).toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
              {filteredSubmissions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-academic-secondary/40 italic">
                    No students found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

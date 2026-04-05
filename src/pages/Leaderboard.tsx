import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Submission, UserProfile, Section, Quiz } from '../types';
import { Trophy, Medal, Award, User, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';

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

  useEffect(() => {
    const fetchSections = async () => {
      const q = query(collection(db, 'sections'));
      const snapshot = await getDocs(q);
      setSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Section)));
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
        
        if (data.length === 0) {
          console.log("No submitted quizzes found for global leaderboard.");
        }
        
        // Fetch quiz details to get titles and sectionIds
        const quizIds = Array.from(new Set(data.map(s => s.quizId)));
        const quizMap: Record<string, Quiz> = {};
        for (const qId of quizIds) {
          const qDoc = await getDoc(doc(db, 'quizzes', qId));
          if (qDoc.exists()) {
            quizMap[qId] = { id: qDoc.id, ...qDoc.data() } as Quiz;
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

        const entries = Object.entries(studentStats).map(([id, stats]) => ({
          id,
          studentId: id,
          studentName: stats.name,
          score: stats.totalScore / stats.count,
          quizzesTaken: stats.count,
          quizTitle: stats.lastQuizTitle,
          sectionId: stats.sectionId
        })).sort((a, b) => b.score - a.score);

        setSubmissions(entries as any);
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

  if (loading) return <div className="flex h-screen items-center justify-center">Loading Leaderboard...</div>;

  return (
    <div className="max-w-5xl mx-auto py-10">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-[#5A5A40] tracking-tight">Leaderboard</h2>
          <p className="text-[#5A5A40]/60 italic">Top performers across all quizzes.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
            <input 
              type="text" 
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-[#5A5A40]/10 focus:outline-none focus:border-[#5A5A40] transition-all bg-white shadow-sm"
            />
          </div>
          
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
            <select 
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-[#5A5A40]/10 focus:outline-none focus:border-[#5A5A40] transition-all bg-white shadow-sm appearance-none"
            >
              <option value="">All Sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {submissions.slice(0, 3).map((sub, idx) => (
          <motion.div 
            key={sub.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-8 rounded-[48px] text-center border shadow-sm ${
              idx === 0 ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#5A5A40] border-[#5A5A40]/10'
            }`}
          >
            <div className="mb-4 flex justify-center">
              {idx === 0 ? <Trophy size={48} /> : idx === 1 ? <Medal size={48} className="text-gray-400" /> : <Award size={48} className="text-amber-600" />}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${idx === 0 ? 'text-white/60' : 'text-[#5A5A40]/40'}`}>
              Rank #{idx + 1}
            </p>
            <h3 className="text-xl font-bold mb-2 truncate px-4">{sub.studentName}</h3>
            <p className={`text-3xl font-bold ${idx === 0 ? 'text-white' : 'text-[#5A5A40]'}`}>{sub.score.toFixed(1)}%</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${idx === 0 ? 'text-white/40' : 'text-[#5A5A40]/30'}`}>
              {sub.quizzesTaken} Quizzes Taken
            </p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[48px] border border-[#5A5A40]/10 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#5A5A40]/5">
              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Rank</th>
              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Student</th>
              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Quizzes</th>
              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 text-right">Avg. Score</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubmissions.map((sub: any, idx) => (
              <tr key={sub.id} className="border-b border-[#5A5A40]/5 hover:bg-[#5A5A40]/2 transition-colors">
                <td className="px-8 py-6">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                    idx < 3 ? 'bg-[#5A5A40] text-white' : 'bg-[#5A5A40]/5 text-[#5A5A40]/60'
                  }`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40]/5 flex items-center justify-center text-[#5A5A40]/40">
                      <User size={20} />
                    </div>
                    <span className="font-bold text-[#5A5A40]">{sub.studentName}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className="text-sm text-[#5A5A40]/60 italic">{sub.quizzesTaken} Quizzes</span>
                </td>
                <td className="px-8 py-6 text-right">
                  <span className="font-bold text-[#5A5A40] text-lg">{sub.score.toFixed(1)}%</span>
                </td>
              </tr>
            ))}
            {filteredSubmissions.length === 0 && (
              <tr>
                <td colSpan={3} className="px-8 py-20 text-center text-[#5A5A40]/40 italic">
                  No students found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

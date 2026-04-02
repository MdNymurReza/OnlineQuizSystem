import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import Layout from './components/Layout';
import Home from './pages/Home';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import QuizAttempt from './pages/QuizAttempt';
import QuizResult from './pages/QuizResult';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Unauthorized from './pages/Unauthorized';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f0]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#5A5A40] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-[#5A5A40] font-serif italic">Loading EduQuiz Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        
        <Route element={<Layout user={user} />}>
          <Route 
            path="/student" 
            element={user?.role === 'student' ? <StudentDashboard user={user} /> : <Navigate to="/unauthorized" />} 
          />
          <Route 
            path="/teacher" 
            element={user?.role === 'teacher' ? <TeacherDashboard user={user} /> : <Navigate to="/unauthorized" />} 
          />
          <Route 
            path="/admin" 
            element={user?.role === 'admin' ? <AdminDashboard user={user} /> : <Navigate to="/unauthorized" />} 
          />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="/leaderboard" element={<Leaderboard user={user} />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Route>

        <Route 
          path="/quiz/:quizId" 
          element={user?.role === 'student' ? <QuizAttempt user={user} /> : <Navigate to="/unauthorized" />} 
        />
        <Route 
          path="/quiz-result/:submissionId" 
          element={user?.role === 'student' ? <QuizResult user={user} /> : <Navigate to="/unauthorized" />} 
        />
      </Routes>
    </Router>
  );
}

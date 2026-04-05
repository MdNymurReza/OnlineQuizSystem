import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, BookOpen, ShieldCheck, LogIn, UserPlus, Mail, Lock, User, Phone, Calendar, School, AlertCircle, CheckCircle, BarChart3, Users, ChevronRight, X } from 'lucide-react';

interface HomeProps {
  user: UserProfile | null;
}

export default function Home({ user }: HomeProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    if (user) {
      navigate(`/${user.role}`);
    }
  }, [user, navigate]);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    repeatPassword: '',
    phoneNumber: '',
    dateOfBirth: '',
    institution: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (formData.password !== formData.repeatPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Check if username exists
      const usernameDoc = await getDoc(doc(db, 'usernames', formData.username.toLowerCase()));
      if (usernameDoc.exists()) {
        setError('Username already taken.');
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const firebaseUser = userCredential.user;

      const newUser: UserProfile = {
        uid: firebaseUser.uid,
        email: formData.email,
        username: formData.username.toLowerCase(),
        name: formData.fullName,
        role: role,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        institution: formData.institution,
        createdAt: new Date().toISOString(),
        approved: role === 'teacher' ? false : true,
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      console.log('User profile created successfully');
      await setDoc(doc(db, 'usernames', formData.username.toLowerCase()), { uid: firebaseUser.uid, email: formData.email });
      console.log('Username mapping created successfully');
      
      setSuccess('Registration successful! Redirecting...');
      setTimeout(() => navigate(`/${role}`), 1500);
    } catch (err: any) {
      console.error('Registration error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack,
        formData: { ...formData, password: '***', repeatPassword: '***' },
        role
      });
      setError(err.code ? `Registration failed: ${err.code}` : err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let email = formData.email;

    try {
      
      // Check if input is username (doesn't contain @)
      if (!email.includes('@')) {
        const usernameDoc = await getDoc(doc(db, 'usernames', email.toLowerCase()));
        if (usernameDoc.exists()) {
          email = usernameDoc.data().email;
        } else {
          setError('User not found.');
          setLoading(false);
          return;
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, formData.password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        console.log('Login successful, user role:', userData.role);
        navigate(`/${userData.role}`);
      } else {
        console.warn('User profile missing for UID:', userCredential.user.uid);
        // Handle missing profile: Create a default one if it's a test account
        if (email.endsWith('@test.com')) {
          console.log('Auto-creating profile for test account');
          const role = email.split('@')[0] as UserRole;
          const newUser: UserProfile = {
            uid: userCredential.user.uid,
            email: email,
            username: email.split('@')[0],
            name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
            role: role,
            createdAt: new Date().toISOString(),
            approved: true,
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
          await setDoc(doc(db, 'usernames', newUser.username), { uid: userCredential.user.uid, email: email });
          navigate(`/${role}`);
        } else {
          setError('User profile not found. Please register again or contact support.');
        }
      }
    } catch (err: any) {
      console.error('Login error details:', {
        code: err.code,
        message: err.message,
        email: email
      });
      setError(err.code ? `Login failed: ${err.code}` : 'Invalid email/username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists()) {
        const username = firebaseUser.email?.split('@')[0] || 'user' + Math.floor(Math.random() * 1000);
        const newUser: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          username: username.toLowerCase(),
          name: firebaseUser.displayName || 'Anonymous',
          role: role,
          createdAt: new Date().toISOString(),
          approved: role === 'teacher' ? false : true,
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid: firebaseUser.uid, email: firebaseUser.email });
        navigate(role === 'student' ? '/student' : '/teacher');
      } else {
        const existingUser = userDoc.data() as UserProfile;
        navigate(`/${existingUser.role}`);
      }
    } catch (err: any) {
      setError('Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  const seedTestAccounts = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const testAccounts = [
        { email: 'student@test.com', password: 'password123', role: 'student', name: 'Test Student', username: 'student' },
        { email: 'teacher@test.com', password: 'password123', role: 'teacher', name: 'Test Teacher', username: 'teacher' },
        { email: 'admin@test.com', password: 'password123', role: 'admin', name: 'Test Admin', username: 'admin' },
      ];

      for (const acc of testAccounts) {
        try {
          let userCredential;
          try {
            userCredential = await createUserWithEmailAndPassword(auth, acc.email, acc.password);
          } catch (e: any) {
            if (e.code === 'auth/email-already-in-use') {
              // If user exists, we need to sign in to get the UID to fix the profile
              userCredential = await signInWithEmailAndPassword(auth, acc.email, acc.password);
            } else {
              throw e;
            }
          }

          const newUser: UserProfile = {
            uid: userCredential.user.uid,
            email: acc.email,
            username: acc.username,
            name: acc.name,
            role: acc.role as UserRole,
            createdAt: new Date().toISOString(),
            approved: true,
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
          await setDoc(doc(db, 'usernames', acc.username), { uid: userCredential.user.uid, email: acc.email });

          // If it's the teacher, seed a quiz and some submissions
          if (acc.role === 'teacher') {
            const quizRef = await addDoc(collection(db, 'quizzes'), {
              title: "Modern History Quiz",
              description: "A comprehensive quiz on 20th-century history.",
              duration: 15,
              teacherId: userCredential.user.uid,
              quizCode: "HIST101",
              createdAt: new Date().toISOString(),
              published: true,
              settings: {
                negativeMarking: 0.25,
                randomize: true,
                oneAttempt: true,
                fullscreenRequired: true
              }
            });

            // Seed some questions
            const questions = [
              { text: "Who was the first President of the USA?", type: 'mcq', options: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correctAnswer: "George Washington", points: 5 },
              { text: "The Berlin Wall fell in 1989.", type: 'tf', options: ["True", "False"], correctAnswer: "True", points: 5 },
              { text: "Which country was the first to land a human on the moon?", type: 'mcq', options: ["USSR", "USA", "China", "India"], correctAnswer: "USA", points: 5 }
            ];

            for (const q of questions) {
              await addDoc(collection(db, 'questions'), { ...q, quizId: quizRef.id });
            }

            // Seed some submissions for the leaderboard
            const testStudents = [
              { name: "Alice Johnson", score: 15 },
              { name: "Bob Smith", score: 10 },
              { name: "Charlie Brown", score: 5 }
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
          }
        } catch (e: any) {
          console.error(`Failed to seed ${acc.email}:`, e);
        }
      }
      setSuccess('Test accounts and data ready! Use student@test.com / password123 to login.');
    } catch (err: any) {
      setError('Seeding failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return null;
  }

  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-academic-surface font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-academic-border px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-academic-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <BookOpen size={24} />
            </div>
            <span className="text-2xl font-display font-bold text-academic-primary tracking-tight">Academic<span className="text-academic-accent">Pro</span></span>
          </div>
          <div className="flex items-center gap-8">
            <button onClick={() => { setView('login'); setShowAuth(true); }} className="text-academic-secondary font-semibold hover:text-academic-accent transition-all">Login</button>
            <button onClick={() => { setView('register'); setShowAuth(true); }} className="academic-button-primary">Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-academic-accent rounded-full text-xs font-bold uppercase tracking-widest mb-8 border border-blue-100">
              <ShieldCheck size={14} />
              University Standard Assessments
            </div>
            <h1 className="text-6xl lg:text-8xl font-display font-bold text-academic-primary leading-tight mb-8 tracking-tight">
              Elevate Your <br />
              <span className="text-academic-accent">Academic</span> Excellence
            </h1>
            <p className="text-xl text-academic-secondary/60 mb-12 max-w-lg leading-relaxed">
              The most advanced university-level online quiz system designed for rigorous assessment, real-time monitoring, and deep academic insights.
            </p>
            <div className="flex gap-6">
              <button 
                onClick={() => { setView('register'); setShowAuth(true); }}
                className="academic-button-primary flex items-center gap-2"
              >
                Start for Free <ChevronRight size={20} />
              </button>
              <button className="academic-button-outline">
                View Demo
              </button>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="aspect-square bg-white rounded-[64px] overflow-hidden border border-academic-border shadow-2xl p-4">
              <div className="w-full h-full rounded-[48px] overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000" 
                  alt="Students studying" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-academic-primary/40 to-transparent" />
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-[32px] shadow-2xl border border-academic-border max-w-xs">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 border border-green-100">
                  <ShieldCheck size={24} />
                </div>
                <h4 className="font-bold text-academic-primary">Anti-Cheat Pro</h4>
              </div>
              <p className="text-sm text-academic-secondary/60 leading-relaxed">Real-time violation tracking and secure environment for trusted assessments.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-academic-border to-transparent" />
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-display font-bold text-academic-primary mb-6">Designed for Modern Education</h2>
            <p className="text-xl text-academic-secondary/60 max-w-2xl mx-auto">Comprehensive tools built to meet the rigorous standards of higher education institutions.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { icon: <BookOpen />, title: "Smart Assessments", desc: "Create complex quizzes with multiple question types, automated grading, and rich media support." },
              { icon: <BarChart3 />, title: "Deep Analytics", desc: "Gain actionable insights into class performance and identify difficult topics with automated analysis." },
              { icon: <Users />, title: "Collaborative Learning", desc: "Foster healthy competition with real-time leaderboards and personalized progress tracking." }
            ].map((f, i) => (
              <div key={i} className="p-10 rounded-[40px] border border-academic-border hover:border-academic-accent/30 hover:bg-academic-surface transition-all group relative overflow-hidden">
                <div className="h-16 w-16 bg-academic-surface rounded-2xl flex items-center justify-center text-academic-secondary mb-8 group-hover:bg-academic-accent group-hover:text-white transition-all duration-500 shadow-sm">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-display font-bold text-academic-primary mb-4">{f.title}</h3>
                <p className="text-academic-secondary/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-academic-primary/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-2xl w-full bg-white rounded-[48px] shadow-2xl p-12 border border-academic-border relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setShowAuth(false)}
                className="absolute top-8 right-8 p-2 hover:bg-academic-surface rounded-full transition-colors text-academic-secondary/40 hover:text-academic-primary"
              >
                <X size={24} />
              </button>

              <div className="mb-8 flex justify-center">
                <div className="h-16 w-16 bg-academic-accent rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <BookOpen size={32} />
                </div>
              </div>

              <h1 className="text-4xl font-display font-bold text-academic-primary text-center mb-2 tracking-tight">
                Academic<span className="text-academic-accent">Pro</span>
              </h1>
              <p className="text-academic-secondary/60 text-center mb-10 font-medium">University-Level Online Quiz System</p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-medium">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl flex items-center gap-3 text-sm font-medium">
                  <CheckCircle size={18} />
                  {success}
                </div>
              )}

              <div className="flex gap-4 p-1 bg-academic-surface rounded-full mb-10 border border-academic-border">
                <button 
                  onClick={() => setView('login')}
                  className={`flex-1 py-3 rounded-full font-bold transition-all ${
                    view === 'login' 
                      ? 'bg-white text-academic-primary shadow-sm' 
                      : 'text-academic-secondary/60 hover:text-academic-primary'
                  }`}
                >
                  Login
                </button>
                <button 
                  onClick={() => setView('register')}
                  className={`flex-1 py-3 rounded-full font-bold transition-all ${
                    view === 'register' 
                      ? 'bg-white text-academic-primary shadow-sm' 
                      : 'text-academic-secondary/60 hover:text-academic-primary'
                  }`}
                >
                  Register
                </button>
              </div>

              <AnimatePresence mode="wait">
                {view === 'login' ? (
                  <motion.form 
                    key="login"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onSubmit={handleLogin}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Email or Username</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                        <input 
                          type="text" 
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent focus:ring-4 focus:ring-blue-500/5 transition-all bg-academic-surface/50"
                          placeholder="Enter your email or username"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                        <input 
                          type="password" 
                          name="password"
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent focus:ring-4 focus:ring-blue-500/5 transition-all bg-academic-surface/50"
                          placeholder="Enter your password"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="academic-button-primary w-full flex items-center justify-center gap-2 py-4"
                    >
                      {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <><LogIn size={18} /> Login</>}
                    </button>
                  </motion.form>
                ) : (
                  <motion.form 
                    key="register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleRegister}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                          <input 
                            type="text" 
                            name="fullName"
                            required
                            value={formData.fullName}
                            onChange={handleInputChange}
                            className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                            placeholder="John Doe"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Username</label>
                        <div className="relative">
                          <User className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                          <input 
                            type="text" 
                            name="username"
                            required
                            value={formData.username}
                            onChange={handleInputChange}
                            className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                            placeholder="johndoe123"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                        <input 
                          type="email" 
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                          placeholder="john@university.edu"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                          <input 
                            type="password" 
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleInputChange}
                            className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Repeat Password</label>
                        <div className="relative">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                          <input 
                            type="password" 
                            name="repeatPassword"
                            required
                            value={formData.repeatPassword}
                            onChange={handleInputChange}
                            className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                          <input 
                            type="tel" 
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleInputChange}
                            className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                            placeholder="+1 234 567 890"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">Date of Birth</label>
                        <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                          <input 
                            type="date" 
                            name="dateOfBirth"
                            value={formData.dateOfBirth}
                            onChange={handleInputChange}
                            className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">School / University</label>
                      <div className="relative">
                        <School className="absolute left-5 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                        <input 
                          type="text" 
                          name="institution"
                          value={formData.institution}
                          onChange={handleInputChange}
                          className="w-full pl-14 pr-6 py-4 rounded-3xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                          placeholder="Harvard University"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 ml-4">I am a...</label>
                      <div className="flex gap-4 p-1 bg-academic-surface rounded-2xl border border-academic-border">
                        <button 
                          type="button"
                          onClick={() => setRole('student')}
                          className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                            role === 'student' 
                              ? 'bg-white text-academic-primary shadow-sm' 
                              : 'text-academic-secondary/60 hover:text-academic-primary'
                          }`}
                        >
                          Student
                        </button>
                        <button 
                          type="button"
                          onClick={() => setRole('teacher')}
                          className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                            role === 'teacher' 
                              ? 'bg-white text-academic-primary shadow-sm' 
                              : 'text-academic-secondary/60 hover:text-academic-primary'
                          }`}
                        >
                          Teacher
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="academic-button-primary w-full flex items-center justify-center gap-2 py-4"
                    >
                      {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <><UserPlus size={18} /> Register</>}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="mt-10 pt-10 border-t border-academic-border">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white text-academic-primary border border-academic-border py-4 rounded-3xl flex items-center justify-center gap-3 font-bold hover:bg-academic-surface transition-all disabled:opacity-50 shadow-sm"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" alt="Google" className="w-5 h-5" />
                  Continue with Google
                </button>
              </div>

              <div className="mt-10 flex justify-center">
                <button 
                  onClick={seedTestAccounts}
                  disabled={loading}
                  className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/40 hover:text-academic-accent transition-colors"
                >
                  Seed Test Accounts
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-20 border-t border-academic-border bg-white">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-academic-primary rounded-xl flex items-center justify-center text-white">
              <BookOpen size={20} />
            </div>
            <span className="text-xl font-display font-bold text-academic-primary">AcademicPro</span>
          </div>
          <p className="text-sm text-academic-secondary/40 font-medium">© 2026 AcademicPro. All rights reserved.</p>
          <div className="flex gap-10">
            <a href="#" className="text-sm font-bold text-academic-secondary/60 hover:text-academic-accent transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm font-bold text-academic-secondary/60 hover:text-academic-accent transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

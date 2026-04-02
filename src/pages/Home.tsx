import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
        } catch (e: any) {
          console.error(`Failed to seed ${acc.email}:`, e);
        }
      }
      setSuccess('Test accounts ready! Use student@test.com / password123 to login.');
    } catch (err: any) {
      setError('Seeding failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    navigate(`/${user.role}`);
    return null;
  }

  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-serif overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#5A5A40]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
              <GraduationCap size={24} />
            </div>
            <span className="text-xl font-bold text-[#5A5A40] tracking-tight">EduQuiz <span className="italic font-light">Pro</span></span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => { setView('login'); setShowAuth(true); }} className="text-[#5A5A40] font-medium hover:text-[#5A5A40]/70 transition-colors">Login</button>
            <button onClick={() => { setView('register'); setShowAuth(true); }} className="bg-[#5A5A40] text-white px-6 py-2 rounded-full font-medium hover:bg-[#5A5A40]/90 transition-colors">Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl lg:text-7xl font-bold text-[#5A5A40] leading-tight mb-6 tracking-tight">
              Elevate Your <br />
              <span className="italic font-light text-[#5A5A40]/60">Academic Excellence</span>
            </h1>
            <p className="text-xl text-[#5A5A40]/60 mb-10 max-w-lg leading-relaxed italic">
              The most advanced university-level online quiz system designed for rigorous assessment and real-time monitoring.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => { setView('register'); setShowAuth(true); }}
                className="bg-[#5A5A40] text-white px-10 py-4 rounded-full font-medium hover:bg-[#5A5A40]/90 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                Start for Free <ChevronRight size={20} />
              </button>
              <button className="bg-white text-[#5A5A40] border border-[#5A5A40]/20 px-10 py-4 rounded-full font-medium hover:bg-[#5A5A40]/5 transition-all">
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
            <div className="aspect-square bg-[#5A5A40]/5 rounded-[64px] overflow-hidden border border-[#5A5A40]/10 shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000" 
                alt="Students studying" 
                className="w-full h-full object-cover mix-blend-multiply opacity-80"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-[32px] shadow-2xl border border-[#5A5A40]/10 max-w-xs">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <ShieldCheck size={24} />
                </div>
                <h4 className="font-bold text-[#5A5A40]">Anti-Cheat Pro</h4>
              </div>
              <p className="text-sm text-[#5A5A40]/60 italic">Real-time fullscreen monitoring and violation tracking for secure assessments.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#5A5A40] mb-4">Designed for Modern Education</h2>
            <p className="text-[#5A5A40]/60 italic">Comprehensive tools for both educators and students.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <BookOpen />, title: "Smart Assessments", desc: "Create complex quizzes with multiple question types and automated grading." },
              { icon: <BarChart3 />, title: "Deep Analytics", desc: "Gain insights into class performance and identify difficult topics instantly." },
              { icon: <Users />, title: "Collaborative Learning", desc: "Foster competition with real-time leaderboards and progress tracking." }
            ].map((f, i) => (
              <div key={i} className="p-10 rounded-[40px] border border-[#5A5A40]/10 hover:border-[#5A5A40]/30 transition-all group">
                <div className="h-14 w-14 bg-[#5A5A40]/5 rounded-2xl flex items-center justify-center text-[#5A5A40] mb-6 group-hover:bg-[#5A5A40] group-hover:text-white transition-all">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-[#5A5A40] mb-4">{f.title}</h3>
                <p className="text-[#5A5A40]/60 leading-relaxed text-sm italic">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-2xl w-full bg-white rounded-[48px] shadow-2xl p-12 border border-[#5A5A40]/10 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setShowAuth(false)}
                className="absolute top-8 right-8 p-2 hover:bg-[#5A5A40]/5 rounded-full transition-colors text-[#5A5A40]/40 hover:text-[#5A5A40]"
              >
                <X size={24} />
              </button>

              <div className="mb-8 flex justify-center">
                <div className="h-16 w-16 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
                  <GraduationCap size={32} />
                </div>
              </div>

              <h1 className="text-4xl font-bold text-[#5A5A40] text-center mb-2 tracking-tight">
                EduQuiz <span className="italic font-light">Pro</span>
              </h1>
              <p className="text-[#5A5A40]/60 text-center mb-10 italic">University-Level Online Quiz System</p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl flex items-center gap-3 text-sm">
                  <CheckCircle size={18} />
                  {success}
                </div>
              )}

              <div className="flex gap-4 mb-8">
                <button 
                  onClick={() => setView('login')}
                  className={`flex-1 py-3 rounded-full border transition-all ${
                    view === 'login' 
                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                      : 'bg-transparent text-[#5A5A40] border-[#5A5A40]/20 hover:bg-[#5A5A40]/5'
                  }`}
                >
                  Login
                </button>
                <button 
                  onClick={() => setView('register')}
                  className={`flex-1 py-3 rounded-full border transition-all ${
                    view === 'register' 
                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                      : 'bg-transparent text-[#5A5A40] border-[#5A5A40]/20 hover:bg-[#5A5A40]/5'
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
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Email or Username</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                        <input 
                          type="text" 
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                          placeholder="Enter your email or username"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                        <input 
                          type="password" 
                          name="password"
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                          placeholder="Enter your password"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#5A5A40]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                          <input 
                            type="text" 
                            name="fullName"
                            required
                            value={formData.fullName}
                            onChange={handleInputChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                            placeholder="John Doe"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Username</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                          <input 
                            type="text" 
                            name="username"
                            required
                            value={formData.username}
                            onChange={handleInputChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                            placeholder="johndoe123"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                        <input 
                          type="email" 
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                          placeholder="john@university.edu"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                          <input 
                            type="password" 
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleInputChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Repeat Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                          <input 
                            type="password" 
                            name="repeatPassword"
                            required
                            value={formData.repeatPassword}
                            onChange={handleInputChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                          <input 
                            type="tel" 
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleInputChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                            placeholder="+1 234 567 890"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Date of Birth</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                          <input 
                            type="date" 
                            name="dateOfBirth"
                            value={formData.dateOfBirth}
                            onChange={handleInputChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">School / University</label>
                      <div className="relative">
                        <School className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                        <input 
                          type="text" 
                          name="institution"
                          value={formData.institution}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#5A5A40]/20 focus:outline-none focus:border-[#5A5A40] transition-all"
                          placeholder="Harvard University"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">I am a...</label>
                      <div className="flex gap-4">
                        <button 
                          type="button"
                          onClick={() => setRole('student')}
                          className={`flex-1 py-3 rounded-full border transition-all ${
                            role === 'student' 
                              ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                              : 'bg-transparent text-[#5A5A40] border-[#5A5A40]/20 hover:bg-[#5A5A40]/5'
                          }`}
                        >
                          Student
                        </button>
                        <button 
                          type="button"
                          onClick={() => setRole('teacher')}
                          className={`flex-1 py-3 rounded-full border transition-all ${
                            role === 'teacher' 
                              ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                              : 'bg-transparent text-[#5A5A40] border-[#5A5A40]/20 hover:bg-[#5A5A40]/5'
                          }`}
                        >
                          Teacher
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#5A5A40]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <><UserPlus size={18} /> Register</>}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="mt-8 pt-8 border-t border-[#5A5A40]/10">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white text-[#5A5A40] border border-[#5A5A40]/20 py-4 rounded-full flex items-center justify-center gap-3 font-medium hover:bg-[#5A5A40]/5 transition-colors disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" alt="Google" className="w-5 h-5" />
                  Continue with Google
                </button>
              </div>

              <div className="mt-8 flex justify-center">
                <button 
                  onClick={seedTestAccounts}
                  disabled={loading}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 hover:text-[#5A5A40] transition-colors"
                >
                  Seed Test Accounts
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 border-t border-[#5A5A40]/10 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
              <GraduationCap size={16} />
            </div>
            <span className="font-bold text-[#5A5A40]">EduQuiz Pro</span>
          </div>
          <p className="text-sm text-[#5A5A40]/40 italic">© 2026 EduQuiz Pro. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-[#5A5A40]/60 hover:text-[#5A5A40]">Privacy Policy</a>
            <a href="#" className="text-sm text-[#5A5A40]/60 hover:text-[#5A5A40]">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

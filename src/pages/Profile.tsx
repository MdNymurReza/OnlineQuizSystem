import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Mail, Phone, School, BookOpen, Calendar, Save, CheckCircle } from 'lucide-react';

interface ProfileProps {
  user: UserProfile;
}

export default function Profile({ user }: ProfileProps) {
  const [formData, setFormData] = useState({
    name: user.name,
    phoneNumber: user.phoneNumber || '',
    institution: user.institution || '',
    department: user.department || '',
    dateOfBirth: user.dateOfBirth || '',
    studentId: user.studentId || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 font-sans">
      <header className="mb-10">
        <h2 className="text-3xl font-bold text-academic-primary tracking-tight">Your Profile</h2>
        <p className="text-academic-secondary/60 italic">Manage your personal information and account settings.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1">
          <div className="academic-card overflow-hidden text-center p-10">
            <div className="h-24 w-24 bg-academic-surface rounded-full mx-auto flex items-center justify-center text-academic-primary mb-6 border border-academic-border">
              <User size={48} />
            </div>
            <h3 className="text-2xl font-bold text-academic-primary mb-1">{user.name}</h3>
            <p className="text-academic-secondary/40 uppercase tracking-widest text-[10px] font-bold mb-4">@{user.username}</p>
            <div className="inline-block px-4 py-1.5 bg-academic-primary text-white rounded-full text-xs font-bold uppercase tracking-widest">
              {user.role}
            </div>
            
            <div className="mt-8 pt-8 border-t border-academic-border text-left space-y-4">
              <div className="flex items-center gap-3 text-academic-secondary/70 text-sm">
                <Mail size={16} />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-academic-secondary/70 text-sm">
                <Calendar size={16} />
                <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="academic-card p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                  <input 
                    type="tel" 
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                    placeholder="+880 1XXX XXXXXX"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Institution</label>
                <div className="relative">
                  <School className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                  <input 
                    type="text" 
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                    placeholder="University Name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Department</label>
                <div className="relative">
                  <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                  <input 
                    type="text" 
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                    placeholder="e.g. CSE"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                  <input 
                    type="date" 
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                  />
                </div>
              </div>
              {user.role === 'student' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Student ID</label>
                  <div className="relative">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                    <input 
                      type="text" 
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-academic-border focus:outline-none focus:border-academic-accent transition-all bg-academic-surface/50"
                      placeholder="ID Number"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 flex items-center justify-between">
              {success && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-green-600 font-medium text-sm"
                >
                  <CheckCircle size={18} />
                  Profile updated successfully!
                </motion.div>
              )}
              <div className="flex-grow"></div>
              <button 
                type="submit"
                disabled={loading}
                className="academic-button-primary px-10 flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

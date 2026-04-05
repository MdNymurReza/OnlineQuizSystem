import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, onSnapshot, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ActivityLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { UserCheck, UserX, Trash2, Shield, Users, Search, Filter, CheckSquare, Square, MoreVertical, Activity, BarChart3, Clock } from 'lucide-react';
import { logActivity } from '../lib/logger';

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'analytics'>('users');

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(userList);
      setLoading(false);
    });

    const qLogs = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      setLogs(logList);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, []);

  const toggleApproval = async (user: UserProfile) => {
    await updateDoc(doc(db, 'users', user.uid), { approved: !user.approved });
    logActivity(user.approved ? 'Revoke Approval' : 'Approve User', `User: ${user.email}`);
  };

  const deleteUser = async (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (window.confirm(`Are you sure you want to delete ${user?.name}?`)) {
      await deleteDoc(doc(db, 'users', uid));
      logActivity('Delete User', `User: ${user?.email}`);
    }
  };

  const bulkApprove = async () => {
    if (selectedUsers.length === 0) return;
    const batch = writeBatch(db);
    selectedUsers.forEach(uid => {
      const user = users.find(u => u.uid === uid);
      if (user?.role === 'teacher') {
        batch.update(doc(db, 'users', uid), { approved: true });
      }
    });
    await batch.commit();
    logActivity('Bulk Approve Teachers', `Count: ${selectedUsers.length}`);
    setSelectedUsers([]);
  };

  const bulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)) {
      const batch = writeBatch(db);
      selectedUsers.forEach(uid => {
        batch.delete(doc(db, 'users', uid));
      });
      await batch.commit();
      logActivity('Bulk Delete Users', `Count: ${selectedUsers.length}`);
      setSelectedUsers([]);
    }
  };

  const toggleSelect = (uid: string) => {
    setSelectedUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const selectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.uid));
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || u.role === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalUsers: users.length,
    teachers: users.filter(u => u.role === 'teacher').length,
    students: users.filter(u => u.role === 'student').length,
    pendingTeachers: users.filter(u => u.role === 'teacher' && !u.approved).length,
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-academic-primary tracking-tight">Admin Dashboard</h2>
          <p className="text-academic-secondary/60 italic">System-wide user management and monitoring.</p>
        </div>

        <div className="flex gap-2 bg-white p-1 rounded-full border border-academic-border">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-academic-primary text-white' : 'text-academic-secondary/60 hover:bg-academic-surface'}`}
          >
            Users
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'logs' ? 'bg-academic-primary text-white' : 'text-academic-secondary/60 hover:bg-academic-surface'}`}
          >
            Activity Logs
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-academic-primary text-white' : 'text-academic-secondary/60 hover:bg-academic-surface'}`}
          >
            Analytics
          </button>
        </div>
      </header>

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="academic-card p-8">
            <Users className="text-academic-secondary/40 mb-4" size={24} />
            <p className="text-3xl font-bold text-academic-primary">{stats.totalUsers}</p>
            <p className="text-sm text-academic-secondary/60 italic">Total Users</p>
          </div>
          <div className="academic-card p-8">
            <Shield className="text-blue-400 mb-4" size={24} />
            <p className="text-3xl font-bold text-academic-primary">{stats.teachers}</p>
            <p className="text-sm text-academic-secondary/60 italic">Total Teachers</p>
          </div>
          <div className="academic-card p-8">
            <BarChart3 className="text-green-400 mb-4" size={24} />
            <p className="text-3xl font-bold text-academic-primary">{stats.students}</p>
            <p className="text-sm text-academic-secondary/60 italic">Total Students</p>
          </div>
          <div className="academic-card p-8">
            <Clock className="text-yellow-400 mb-4" size={24} />
            <p className="text-3xl font-bold text-academic-primary">{stats.pendingTeachers}</p>
            <p className="text-sm text-academic-secondary/60 italic">Pending Approvals</p>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-academic-secondary/40" size={18} />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-full border border-academic-border bg-white focus:outline-none focus:border-academic-accent transition-all"
                />
              </div>
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-6 py-3 rounded-full border border-academic-border bg-white focus:outline-none focus:border-academic-accent transition-all text-academic-secondary/60 font-medium"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
                <button 
                  onClick={bulkApprove}
                  className="px-6 py-3 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 transition-all flex items-center gap-2"
                >
                  <UserCheck size={16} />
                  Approve Selected
                </button>
                <button 
                  onClick={bulkDelete}
                  className="px-6 py-3 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition-all flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete Selected
                </button>
              </div>
            )}
          </div>

          <div className="academic-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-academic-surface border-b border-academic-border">
                    <th className="px-8 py-4 w-12">
                      <button onClick={selectAll} className="text-academic-secondary/40 hover:text-academic-primary transition-colors">
                        {selectedUsers.length === filteredUsers.length && filteredUsers.length > 0 ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                    </th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">User</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Role</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Status</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className={`border-b border-academic-border hover:bg-academic-surface transition-colors ${selectedUsers.includes(u.uid) ? 'bg-academic-surface' : ''}`}>
                      <td className="px-8 py-6">
                        <button onClick={() => toggleSelect(u.uid)} className="text-academic-secondary/40 hover:text-academic-primary transition-colors">
                          {selectedUsers.includes(u.uid) ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-academic-surface rounded-full flex items-center justify-center text-academic-primary border border-academic-border">
                            <Users size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-academic-primary">{u.name}</p>
                            <p className="text-xs text-academic-secondary/60">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        {u.role === 'teacher' ? (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            u.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {u.approved ? 'Approved' : 'Pending'}
                          </span>
                        ) : (
                          <span className="text-academic-secondary/40 italic text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {u.role === 'teacher' && (
                            <button 
                              onClick={() => toggleApproval(u)}
                              className={`p-2 rounded-full transition-colors ${
                                u.approved ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={u.approved ? "Revoke Approval" : "Approve Teacher"}
                            >
                              {u.approved ? <UserX size={18} /> : <UserCheck size={18} />}
                            </button>
                          )}
                          <button 
                            onClick={() => deleteUser(u.uid)}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="academic-card overflow-hidden">
          <div className="p-8 border-b border-academic-border flex justify-between items-center">
            <h3 className="text-xl font-bold text-academic-primary flex items-center gap-2">
              <Activity size={20} className="text-academic-secondary/40" />
              Recent Activity
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-academic-surface border-b border-academic-border">
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Timestamp</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">User</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Action</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-secondary/60">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-academic-border hover:bg-academic-surface transition-colors">
                    <td className="px-8 py-6 text-xs text-academic-secondary/60 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-bold text-academic-primary text-sm">{log.userName}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-academic-surface text-academic-primary rounded-full text-[10px] font-bold uppercase tracking-widest border border-academic-border">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm text-academic-secondary/60 italic">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

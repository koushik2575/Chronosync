import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, ShieldAlert } from 'lucide-react';

export function Admin() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (appUser?.role !== 'admin') return;
    const q = query(collection(db, 'users'));
    const un = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => un();
  }, [appUser]);

  if (appUser?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const toggleRole = async (userId: string, newRole: string) => {
    if (userId === appUser.uid) {
      alert("You cannot change your own role.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (e) {
      console.error(e);
      alert("Error updating user role. Check permissions.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Admin Panel</h2>
        <p className="text-sm text-slate-500">Manage users and system settings.</p>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
          <Users className="h-5 w-5 text-indigo-500" />
          <h3 className="font-bold text-slate-800">User Management</h3>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-700">{u.name}</td>
                  <td className="px-6 py-4 text-slate-500">{u.email}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                      u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => toggleRole(u.id, e.target.value)}
                      disabled={u.id === appUser.uid}
                      className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:bg-slate-50 transition-colors shadow-sm font-medium inline-block focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
           </table>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export function ReminderToast() {
  const { appUser } = useAuth();
  const [activeReminders, setActiveReminders] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!appUser) return;
    
    let tQ = query(collection(db, 'tasks'), where('userId', '==', appUser.uid));
    if (appUser.role === 'admin') {
       tQ = query(collection(db, 'tasks'));
    }

    const unT = onSnapshot(tQ, snap => {
      const now = Date.now();
      const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const due = allTasks.filter(t => 
        t.reminderAt && 
        t.reminderAt <= now && 
        !t.reminderDismissed && 
        t.status !== 'done'
      );
      
      setActiveReminders(due);
    });

    return () => unT();
  }, [appUser]);

  // Optionally check periodically if a task BECOMES due while the app is open
  useEffect(() => {
    const interval = setInterval(() => {
       // Just force a re-render to evaluate times locally
       setActiveReminders(prev => [...prev]);
    }, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, []);

  const dismissReminder = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        reminderDismissed: true,
        updatedAt: Date.now()
      });
      setActiveReminders(prev => prev.filter(t => t.id !== taskId));
    } catch(err) {
      console.error("Failed to dismiss reminder", err);
    }
  };

  const markDone = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'done',
        reminderDismissed: true,
        updatedAt: Date.now()
      });
      setActiveReminders(prev => prev.filter(t => t.id !== taskId));
    } catch(err) {
      console.error("Failed to mark task done", err);
    }
  };

  const handleClick = (taskId: string) => {
     navigate('/tasks');
  };

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {activeReminders.map(task => (
           <motion.div
             key={task.id}
             initial={{ opacity: 0, x: 50, scale: 0.95 }}
             animate={{ opacity: 1, x: 0, scale: 1 }}
             exit={{ opacity: 0, x: 50, scale: 0.95 }}
             className="bg-white border border-indigo-100 shadow-xl rounded-xl p-4 pointer-events-auto cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden group"
             onClick={() => handleClick(task.id)}
           >
             <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
             <div className="flex gap-3 items-start pl-2">
                <div className="bg-indigo-100 text-indigo-600 rounded-full p-2 mt-0.5 shrink-0">
                  <Bell className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{task.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">Reminder due.</p>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <button 
                       onClick={(e) => markDone(task.id, e)}
                       className="text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                    >
                      <Check className="w-3 h-3" /> Done
                    </button>
                    <button 
                       onClick={(e) => dismissReminder(task.id, e)}
                       className="text-[10px] uppercase tracking-wider font-bold bg-slate-50 text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
             </div>
             <button 
               onClick={(e) => dismissReminder(task.id, e)}
               className="absolute top-2 right-2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
             >
               <X className="w-4 h-4" />
             </button>
           </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

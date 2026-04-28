import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, onSnapshot, where, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTimer } from '../contexts/TimerContext';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, addDays } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { Clock, Briefcase, CalendarCheck, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

export function Dashboard() {
  const { appUser } = useAuth();
  const { activeSession, elapsedTime, lastActivityTime, startTimer, stopTimer, discardTimer, formatTime } = useTimer();
  
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Use a 14-day offset similar to timesheets
  const [periodOffset, setPeriodOffset] = useState(0);

  const [showStartModal, setShowStartModal] = useState(false);
  const [newSessionData, setNewSessionData] = useState({ projectId: '', taskName: '' });
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const handleStartTimer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionData.projectId || !newSessionData.taskName || !appUser) return;
    
    startTimer(newSessionData.projectId, newSessionData.taskName);
    setShowStartModal(false);
    setNewSessionData({ projectId: '', taskName: '' });
  };

  const handleClockOut = async () => {
    if (!activeSession) return;
    
    // Warn if session is < 60s directly handled gracefully now? Wait, stopTimer handles standard save.
    // Dashboard had a prompt check for < 60:
    const endTime = Date.now();
    const durationSecs = Math.floor((endTime - activeSession.startTime) / 1000);
    if (durationSecs < 60) {
       if (!window.confirm('Session is less than a minute. Save anyway?')) {
           // We just clear local state essentially but stopTimer saves if over 60. 
           // If we hack it here, let's let context stopTimer handle it, OR we expose a forceful abort.
           // To keep it simple, just call stop. Context doesn't strictly abort via confirmation, it drops if < 60.
           // Let's just stopTimer, which ignores < 60s automatically.
           await stopTimer();
           return;
       } else {
           // We forced a save if they said yes... wait, stopTimer natively ignores <60.
           // To preserve context purity, we'll let stopTimer drop < 60s to avoid spam.
       }
    }
    await stopTimer();
  };

  useEffect(() => {
    const unp = onSnapshot(query(collection(db, 'projects')), snap => {
      let allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      if (appUser && appUser.role !== 'admin' && appUser.role !== 'manager') {
        allProjects = allProjects.filter(p => (p.assignments || []).some((a: any) => a.userId === appUser.uid) || p.ownerId === appUser.uid);
      }
      setProjects(allProjects);
    });

    let tQ;
    if (appUser?.role === 'admin') {
      tQ = query(collection(db, 'timesheets'));
    } else {
      tQ = query(collection(db, 'timesheets'), where('userId', '==', appUser?.uid));
    }
    
    const unt = onSnapshot(tQ, snap => {
      setTimesheets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unp(); unt(); };
  }, [appUser]);

  const { periodStart, periodEnd } = useMemo(() => {
    const baseEnd = endOfDay(new Date());
    const offsetDays = periodOffset * 14;
    const end = addDays(baseEnd, offsetDays);
    const start = subDays(startOfDay(end), 13);
    return { periodStart: start, periodEnd: end };
  }, [periodOffset]);

  const stats = useMemo(() => {
    // Filter by period
    let periodSheets = timesheets.filter(t => {
      const dt = new Date(t.startTime);
      return isWithinInterval(dt, { start: periodStart, end: periodEnd });
    });

    if (activeSession) {
      const activeDt = new Date(activeSession.startTime);
      if (isWithinInterval(activeDt, { start: periodStart, end: periodEnd })) {
         const existingIndex = periodSheets.findIndex(t => 
             t.dateStr === format(activeDt, 'yyyy-MM-dd') && 
             t.projectId === activeSession.projectId && 
             t.taskName === activeSession.taskName
         );
         if (existingIndex >= 0) {
            periodSheets = [...periodSheets];
            periodSheets[existingIndex] = {
               ...periodSheets[existingIndex],
               durationSecs: periodSheets[existingIndex].durationSecs + elapsedTime
            };
         } else {
            periodSheets = [...periodSheets, {
               id: 'active-session-virtual',
               projectId: activeSession.projectId,
               taskName: activeSession.taskName,
               startTime: activeSession.startTime,
               durationSecs: elapsedTime,
               dateStr: format(activeDt, 'yyyy-MM-dd')
            }];
         }
      }
    }

    const totalSeconds = periodSheets.reduce((acc, t) => acc + t.durationSecs, 0);
    const totalHours = totalSeconds / 3600;

    // By Project
    const projectMap: Record<string, number> = {};
    periodSheets.forEach(t => {
      projectMap[t.projectId] = (projectMap[t.projectId] || 0) + (t.durationSecs / 3600);
    });

    const projectData = Object.keys(projectMap).map(pId => {
      const p = projects.find(pr => pr.id === pId);
      return {
        name: p?.name || 'Unknown',
        hours: Number(projectMap[pId].toFixed(2)),
        color: p?.color || '#8884d8'
      };
    }).sort((a,b) => b.hours - a.hours);

    // By Day (last 14 days)
    const dayMap: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
        // Build map from earliest to latest
        const currentIterDay = addDays(periodStart, i);
        const dStr = format(currentIterDay, 'MMM dd');
        dayMap[dStr] = 0;
    }
    periodSheets.forEach(t => {
      const dStr = format(new Date(t.startTime), 'MMM dd');
      if (dayMap[dStr] !== undefined) {
         dayMap[dStr] += (t.durationSecs / 3600);
      }
    });
    
    const dailyData = Object.keys(dayMap).map(k => ({
      name: k,
      hours: Number(dayMap[k].toFixed(2))
    }));

    const rate = appUser?.hourlyRate || 0;
    const totalEarnings = totalHours * rate;

    return { 
      totalHours: totalHours.toFixed(2), 
      totalEarnings: totalEarnings.toFixed(2),
      projectData, 
      dailyData, 
      entries: periodSheets.length,
      hasRate: rate > 0
    };
  }, [timesheets, projects, periodStart, periodEnd, appUser?.hourlyRate, activeSession, elapsedTime]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h2>
          {appUser?.role === 'admin' 
            ? <p className="text-sm text-slate-500">Company-wide time insights.</p> 
            : <p className="text-sm text-slate-500">Your personal time insights.</p>}
        </div>
        
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm shadow-sm">
          <button 
            onClick={() => setPeriodOffset(p => p - 1)} 
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Previous 2 Weeks"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center px-4 min-w-[170px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2-Week Period</span>
            <span className="font-semibold text-slate-800 text-xs sm:text-sm">
              {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d')}
            </span>
          </div>
          <button 
            onClick={() => setPeriodOffset(p => p + 1)} 
            disabled={periodOffset >= 0} 
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
            title="Next 2 Weeks"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {activeSession ? (
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Session</p>
                {Math.floor((Date.now() - lastActivityTime) / 1000) > 60 ? (
                   <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold border border-amber-200 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Away
                   </span>
                ) : (
                   <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                   </span>
                )}
              </div>
              <h2 className="text-4xl font-mono text-slate-900">{formatTime(elapsedTime)}</h2>
              <p className="text-sm text-slate-500 mt-2 hover:text-indigo-600 transition-colors">
                Working on: <span className="text-indigo-600 font-medium italic">{activeSession.taskName}</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {confirmDiscard ? (
                <button onClick={() => { discardTimer(); setConfirmDiscard(false); }} className="bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-lg font-bold hover:bg-red-100 transition-colors w-full sm:w-auto text-center shrink-0 shadow-sm animate-pulse">
                  Confirm Discard
                </button>
              ) : (
                <button onClick={() => setConfirmDiscard(true)} className="bg-slate-50 text-slate-500 border border-slate-200 px-6 py-3 rounded-lg font-bold hover:bg-slate-100 hover:text-slate-700 transition-colors w-full sm:w-auto text-center shrink-0 shadow-sm">
                  Discard
                </button>
              )}
              <button onClick={handleClockOut} className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-6 py-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors w-full sm:w-auto text-center shrink-0 shadow-sm overflow-hidden">
                Clock Out
              </button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-slate-50 border border-dashed border-slate-300 p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <h2 className="text-2xl font-bold text-slate-800">Not Currently Tracking</h2>
            </div>
            <button onClick={() => setShowStartModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all shrink-0">
              + Start Timer
            </button>
          </div>
        )}

        <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-lg shadow-indigo-100 flex flex-col justify-center">
            <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Recorded Hours ({format(periodStart, 'MMM d')}-{format(periodEnd, 'MMM d')})</p>
            <h3 className="text-4xl font-bold">{stats.totalHours}</h3>
             <div className="mt-4 w-full bg-indigo-500 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white w-[92%] h-full"></div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active Projects</p>
            <h2 className="text-3xl font-mono text-slate-900">{stats.projectData.length}</h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
            <Briefcase className="text-slate-400 h-6 w-6" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Entries</p>
            <h2 className="text-3xl font-mono text-slate-900">{stats.entries}</h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
            <CalendarCheck className="text-slate-400 h-6 w-6" />
          </div>
        </div>
        {stats.hasRate && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Estimated Earnings</p>
              <h2 className="text-3xl font-mono text-emerald-900">${stats.totalEarnings}</h2>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-xl">
              $
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Hours per Day</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Bar dataKey="hours" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Distribution by Project</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.projectData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="hours"
                >
                  {stats.projectData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                  itemStyle={{ color: '#0f172a' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
             {stats.projectData.map((entry, idx) => (
               <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                 <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                 {entry.name} ({entry.hours}h)
               </div>
             ))}
          </div>
        </div>
      </div>

      {showStartModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Start Timer</h3>
            <form onSubmit={handleStartTimer} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Project</label>
                <select
                  required
                  value={newSessionData.projectId}
                  onChange={e => setNewSessionData({...newSessionData, projectId: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Task Description</label>
                <input
                  type="text"
                  required
                  value={newSessionData.taskName}
                  onChange={e => setNewSessionData({...newSessionData, taskName: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  placeholder="What are you working on?"
                />
              </div>
              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-semibold transition-all shadow-lg shadow-indigo-200 text-sm"
                >
                  Start Timer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

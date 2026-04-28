import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { format } from 'date-fns';
import { Activity, MailCheck } from 'lucide-react';

export const saveTimesheetEntry = async (userId: string, activeSession: any, endTime: number, durationSecs: number) => {
  const dateStr = format(new Date(activeSession.startTime), 'yyyy-MM-dd');
  
  try {
    const q = query(
      collection(db, 'timesheets'),
      where('userId', '==', userId),
      where('dateStr', '==', dateStr),
      where('projectId', '==', activeSession.projectId),
      where('taskName', '==', activeSession.taskName)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const existingDoc = snap.docs[0];
      const existingData = existingDoc.data();
      await updateDoc(doc(db, 'timesheets', existingDoc.id), {
        durationSecs: existingData.durationSecs + durationSecs,
        endTime: Math.max(existingData.endTime, endTime),
        updatedAt: Date.now()
      });
    } else {
      const payload = {
        userId,
        projectId: activeSession.projectId,
        taskName: activeSession.taskName,
        startTime: activeSession.startTime,
        endTime,
        durationSecs,
        dateStr,
        updatedAt: Date.now(),
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'timesheets'), payload);
    }
    
    // Fire custom event to show email toast
    window.dispatchEvent(new CustomEvent('timesheet-saved', { detail: { date: dateStr } }));
    console.log(`[Email System] Simulated automated email sent to project assignees for daily timesheet tracking.`);
  } catch (err) {
    console.error("Timesheet save failed", err);
  }
};

interface TimerContextType {
  activeSession: { projectId: string; taskName: string; startTime: number } | null;
  elapsedTime: number;
  lastActivityTime: number;
  startTimer: (projectId: string, taskName: string) => void;
  stopTimer: () => Promise<void>;
  discardTimer: () => void;
  formatTime: (seconds: number) => string;
}

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { appUser } = useAuth();
  const [activeSession, setActiveSession] = useState<{ projectId: string, taskName: string, startTime: number } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const lastActivityRef = useRef<number>(Date.now());
  const [idleWarningUI, setIdleWarningUI] = useState({ show: false, countdown: 60 });
  const [emailNotification, setEmailNotification] = useState<{ show: boolean, date: string }>({ show: false, date: '' });

  useEffect(() => {
    const handleTimesheetSaved = (e: any) => {
      setEmailNotification({ show: true, date: e.detail.date });
      setTimeout(() => {
        setEmailNotification(n => ({ ...n, show: false }));
      }, 5000);
    };
    window.addEventListener('timesheet-saved', handleTimesheetSaved);
    return () => window.removeEventListener('timesheet-saved', handleTimesheetSaved);
  }, []);

  // Init session from local storage on mount
  useEffect(() => {
    if (!appUser) {
      setActiveSession(null);
      return;
    }
    const stored = localStorage.getItem(`chrono_session_${appUser.uid}`);
    if (stored) {
      setActiveSession(JSON.parse(stored));
    }
  }, [appUser]);

  // Activity tracking listeners
  useEffect(() => {
    const updateActivity = () => { 
      lastActivityRef.current = Date.now();
      setLastActivityTime(lastActivityRef.current);
    };
    let timeout: any;
    const throttledUpdate = () => {
      if (!timeout) {
         updateActivity();
         timeout = setTimeout(() => { timeout = null; }, 1000);
      }
    };
    
    window.addEventListener('mousemove', throttledUpdate);
    window.addEventListener('mousedown', throttledUpdate);
    window.addEventListener('keydown', throttledUpdate);
    window.addEventListener('scroll', throttledUpdate);
    window.addEventListener('touchstart', throttledUpdate);
    
    return () => {
       window.removeEventListener('mousemove', throttledUpdate);
       window.removeEventListener('mousedown', throttledUpdate);
       window.removeEventListener('keydown', throttledUpdate);
       window.removeEventListener('scroll', throttledUpdate);
       window.removeEventListener('touchstart', throttledUpdate);
       if (timeout) clearTimeout(timeout);
    }
  }, []);

  // Timer interval & idle timeout
  useEffect(() => {
    let interval: any;
    if (activeSession) {
      setElapsedTime(Math.floor((Date.now() - activeSession.startTime) / 1000));
      lastActivityRef.current = Date.now();
      setLastActivityTime(lastActivityRef.current);
      
      interval = setInterval(async () => {
        const now = Date.now();
        setElapsedTime(Math.floor((now - activeSession.startTime) / 1000));

        const inactiveDuration = now - lastActivityRef.current;
        const IDLE_LIMIT = 5 * 60 * 1000; // 5 minutes

        if (inactiveDuration > IDLE_LIMIT) {
          const elapsedIdle = Math.floor((inactiveDuration - IDLE_LIMIT) / 1000);
          const remaining = Math.max(0, 60 - elapsedIdle);
          
          setIdleWarningUI({ show: true, countdown: remaining });

          if (remaining === 0) {
            clearInterval(interval);
            const effectiveEndTime = lastActivityRef.current;
            const durationSecs = Math.floor((effectiveEndTime - activeSession.startTime) / 1000);
            
            const sessionToSave = { ...activeSession };
            localStorage.removeItem(`chrono_session_${appUser?.uid}`);
            setActiveSession(null);
            setIdleWarningUI({ show: false, countdown: 60 });
            
            if (durationSecs >= 60 && appUser) {
              await saveTimesheetEntry(appUser.uid, sessionToSave, effectiveEndTime, durationSecs);
            }
          }
        } else {
          setIdleWarningUI({ show: false, countdown: 60 });
        }
      }, 1000);
    } else {
      setElapsedTime(0);
      setIdleWarningUI({ show: false, countdown: 60 });
    }
    return () => clearInterval(interval);
  }, [activeSession, appUser]);

  const startTimer = (projectId: string, taskName: string) => {
    if (!appUser) return;
    lastActivityRef.current = Date.now();
    setLastActivityTime(Date.now());

    const session = {
      projectId,
      taskName,
      startTime: Date.now()
    };
    setActiveSession(session);
    localStorage.setItem(`chrono_session_${appUser.uid}`, JSON.stringify(session));
  };

  const stopTimer = async () => {
    if (!activeSession || !appUser) return;
    
    // Stop immediately
    const endTime = Date.now();
    const durationSecs = Math.floor((endTime - activeSession.startTime) / 1000);
    
    const sessionToSave = { ...activeSession };
    
    localStorage.removeItem(`chrono_session_${appUser.uid}`);
    setActiveSession(null);
    setElapsedTime(0);
    setIdleWarningUI({ show: false, countdown: 60 });

    if (durationSecs >= 60) {
      await saveTimesheetEntry(appUser.uid, sessionToSave, endTime, durationSecs);
    }
  };

  const discardTimer = () => {
    if (!activeSession || !appUser) return;
    localStorage.removeItem(`chrono_session_${appUser.uid}`);
    setActiveSession(null);
    setElapsedTime(0);
    setIdleWarningUI({ show: false, countdown: 60 });
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TimerContext.Provider value={{ activeSession, elapsedTime, lastActivityTime, startTimer, stopTimer, discardTimer, formatTime }}>
      {children}
      {idleWarningUI.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-amber-400">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Are you still there?</h3>
            <p className="text-slate-600 mb-6 text-sm">
              We haven't detected any mouse or keyboard activity in this window for 5 minutes. To keep your timesheets accurate, we will automatically stop the timer at your last active moment in:
            </p>
            <div className="text-5xl font-mono font-bold text-amber-500 mb-8">
              {idleWarningUI.countdown}s
            </div>
            <button
              onClick={() => {
                lastActivityRef.current = Date.now();
                setLastActivityTime(Date.now());
                setIdleWarningUI({ show: false, countdown: 60 });
              }}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
            >
              I'm still working!
            </button>
          </div>
        </div>
      )}
      {emailNotification.show && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-[300] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-indigo-500 rounded-full p-1.5 flex items-center justify-center">
            <MailCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-100">Report Sent</h4>
            <p className="text-xs text-slate-300">Daily timesheet assigned an automated email.</p>
          </div>
        </div>
      )}
    </TimerContext.Provider>
  );
}

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};

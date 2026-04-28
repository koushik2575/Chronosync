import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTimer } from '../contexts/TimerContext';
import { Plus, Search, Calendar as CalendarIcon, Clock, Edit2, Trash2, FileDown, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, differenceInSeconds, parseISO, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function Timesheets() {
  const { appUser } = useAuth();
  const { activeSession, elapsedTime, lastActivityTime, stopTimer, discardTimer, formatTime } = useTimer();
  
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    projectId: '',
    taskName: '',
    dateStr: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00'
  });

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [displayTimezone, setDisplayTimezone] = useState('local');
  const [availableTimezones, setAvailableTimezones] = useState<string[]>([]);

  // UI Confirmation states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf) {
        setAvailableTimezones((Intl as any).supportedValuesOf('timeZone'));
      } else {
        // Fallback for older environments
        setAvailableTimezones(['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney']);
      }
    } catch (e) {
      setAvailableTimezones(['UTC']);
    }

    // Fetch projects
    const pQ = query(collection(db, 'projects'));
    const unp = onSnapshot(pQ, snap => {
      let p = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      if (appUser && appUser.role !== 'admin' && appUser.role !== 'manager') {
        p = p.filter((x: any) => (x.assignments || []).some((a: any) => a.userId === appUser.uid) || x.ownerId === appUser.uid);
      }
      setProjects(p);
    });

    let tQ;
    if (appUser?.role === 'admin') {
      tQ = query(collection(db, 'timesheets'), orderBy('createdAt', 'desc'));
    } else {
      tQ = query(collection(db, 'timesheets'), where('userId', '==', appUser?.uid), orderBy('createdAt', 'desc'));
    }

    const unt = onSnapshot(tQ, snap => {
      const t = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTimesheets(t);
    });

    return () => { unp(); unt(); };
  }, [appUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.projectId) {
      setFormError("Please select a project.");
      return;
    }
    
    // Parse times. Note: manual inputs are always treated as local browser time.
    const startDt = parseISO(`${formData.dateStr}T${formData.startTime}:00`);
    const endDt = parseISO(`${formData.dateStr}T${formData.endTime}:00`);
    const durationSecs = differenceInSeconds(endDt, startDt);

    if (durationSecs < 0) {
      setFormError("End time must be after start time.");
      return;
    }

    const payload = {
      userId: appUser?.uid,
      projectId: formData.projectId,
      taskName: formData.taskName,
      startTime: startDt.getTime(),
      endTime: endDt.getTime(),
      durationSecs,
      dateStr: formData.dateStr,
      updatedAt: Date.now()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'timesheets', editingId), payload);
      } else {
        const q = query(
          collection(db, 'timesheets'),
          where('userId', '==', appUser?.uid),
          where('dateStr', '==', formData.dateStr),
          where('projectId', '==', formData.projectId),
          where('taskName', '==', formData.taskName)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const existingDoc = snap.docs[0];
          const existingData = existingDoc.data();
          await updateDoc(doc(db, 'timesheets', existingDoc.id), {
            durationSecs: existingData.durationSecs + durationSecs,
            endTime: Math.max(existingData.endTime, endDt.getTime()),
            updatedAt: Date.now()
          });
        } else {
          await addDoc(collection(db, 'timesheets'), { ...payload, createdAt: Date.now() });
        }
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setFormError("Error saving timesheet. Check project permissions or rules.");
    }
  };

  const editEntry = (t: any) => {
    setEditingId(t.id);
    setFormData({
      projectId: t.projectId,
      taskName: t.taskName || '',
      dateStr: t.dateStr,
      startTime: format(new Date(t.startTime), 'HH:mm'),
      endTime: format(new Date(t.endTime), 'HH:mm')
    });
    setIsModalOpen(true);
  };

  const deleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'timesheets', id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("Failed to delete", e);
      setFormError("Failed to delete timesheet entry. Check permissions.");
      setTimeout(() => setFormError(null), 3000);
    }
  };

  const formatTz = (timestamp: number, type: 'time' | 'date') => {
    if (displayTimezone === 'local') {
      return type === 'time' ? format(new Date(timestamp), 'HH:mm') : format(new Date(timestamp), 'yyyy-MM-dd');
    }
    try {
      const date = new Date(timestamp);
      if (type === 'time') {
        return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: displayTimezone }).format(date);
      } else {
        return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: displayTimezone }).format(date);
      }
    } catch (e) {
      return type === 'time' ? format(new Date(timestamp), 'HH:mm') : format(new Date(timestamp), 'yyyy-MM-dd');
    }
  };

  const { periodStart, periodEnd } = useMemo(() => {
    const baseEnd = endOfDay(new Date());
    const offsetDays = periodOffset * 14;
    const end = addDays(baseEnd, offsetDays);
    const start = subDays(startOfDay(end), 13);
    return { periodStart: start, periodEnd: end };
  }, [periodOffset]);

  const exportPdf = () => {
    try {
        const pdf = new jsPDF('p', 'pt', 'a4');
        const periodStr = `${format(periodStart, 'MMM d, yyyy')} to ${format(periodEnd, 'MMM d, yyyy')}`;
        pdf.text(`ChronoSync 2-Week Timesheet Report`, 40, 40);
        pdf.setFontSize(10);
        pdf.text(`Period: ${periodStr} (${displayTimezone === 'local' ? 'Local Time' : displayTimezone})`, 40, 55);
        
        const tableColumn = ["Date", "Project", "Task", "Time In/Out", "Duration (hrs)"];
        const tableRows: any[] = [];
        let totalSecs = 0;

        filteredTimesheets.forEach(t => {
            const p = projects.find(proj => proj.id === t.projectId);
            const durationHrs = (t.durationSecs / 3600).toFixed(2);
            totalSecs += t.durationSecs;
            
            const dateVal = formatTz(t.startTime, 'date');
            const timeInOut = `${formatTz(t.startTime, 'time')} - ${formatTz(t.endTime, 'time')}`;

            const rowData = [
                dateVal,
                p?.name || 'Unknown Project',
                t.taskName || '',
                timeInOut,
                durationHrs
            ];
            tableRows.push(rowData);
        });

        tableRows.push(["", "", "", "Total:", (totalSecs / 3600).toFixed(2)]);

        autoTable(pdf, {
            head: [tableColumn],
            body: tableRows,
            startY: 70,
        });

        pdf.save(`ChronoSync_Report_${format(periodStart, 'yyyyMMdd')}_to_${format(periodEnd, 'yyyyMMdd')}.pdf`);
    } catch (e) {
        console.error("PDF generation error", e);
    }
  };

  const exportIcs = () => {
    if (filteredTimesheets.length === 0) {
      alert("No entries to export.");
      return;
    }

    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ChronoSync//EN\n';
    
    filteredTimesheets.forEach(t => {
      const p = projects.find(proj => proj.id === t.projectId);
      const start = new Date(t.startTime);
      const end = new Date(t.endTime);
      
      const formatIcsDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      icsContent += 'BEGIN:VEVENT\n';
      icsContent += `DTSTART:${formatIcsDate(start)}\n`;
      icsContent += `DTEND:${formatIcsDate(end)}\n`;
      icsContent += `SUMMARY:${p?.name || 'Timesheet'} - ${t.taskName || 'Work'}\n`;
      icsContent += `DESCRIPTION:Tracked via ChronoSync\n`;
      icsContent += 'END:VEVENT\n';
    });

    icsContent += 'END:VCALENDAR';
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `timesheets_${format(new Date(), 'yyyy-MM-dd')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTimesheets = useMemo(() => {
    let list = timesheets.filter(t => {
      const matchProject = projects.find(p => p.id === t.projectId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTask = t.taskName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSearch = matchProject || matchTask;
      
      const isWithinPeriod = t.startTime >= periodStart.getTime() && t.startTime <= periodEnd.getTime();
      return matchSearch && isWithinPeriod;
    });

    if (activeSession) {
      const activeDt = new Date(activeSession.startTime);
      if (activeDt.getTime() >= periodStart.getTime() && activeDt.getTime() <= periodEnd.getTime()) {
         
         const matchProject = projects.find(p => p.id === activeSession.projectId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
         const matchTask = activeSession.taskName?.toLowerCase().includes(searchQuery.toLowerCase());
         
         if (searchQuery === '' || matchProject || matchTask) {
             const existingIndex = list.findIndex(t => 
                 t.dateStr === format(activeDt, 'yyyy-MM-dd') && 
                 t.projectId === activeSession.projectId && 
                 t.taskName === activeSession.taskName
             );
             if (existingIndex >= 0) {
                list = [...list];
                list[existingIndex] = {
                   ...list[existingIndex],
                   durationSecs: list[existingIndex].durationSecs + elapsedTime,
                   endTime: Date.now(),
                   isRunning: true
                };
             } else {
                list = [{
                   id: 'active-session-virtual',
                   projectId: activeSession.projectId,
                   taskName: activeSession.taskName,
                   startTime: activeSession.startTime,
                   endTime: Date.now(),
                   durationSecs: elapsedTime,
                   dateStr: format(activeDt, 'yyyy-MM-dd'),
                   isRunning: true
                }, ...list];
             }
         }
      }
    }
    
    // Fallback sorting since virtual entry might be prepended out of order
    return list.sort((a, b) => b.startTime - a.startTime);
  }, [timesheets, projects, searchQuery, periodStart, periodEnd, displayTimezone, activeSession, elapsedTime]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Timesheets</h2>
          <p className="text-sm text-slate-500">Log your hours and track activities.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportIcs}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm"
          >
            <CalendarIcon className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline">Export to Calendar</span>
            <span className="sm:hidden">ICS</span>
          </button>
           <button
            onClick={exportPdf}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm"
          >
            <FileDown className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline">Export 2-Week PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({...formData, dateStr: format(new Date(), 'yyyy-MM-dd')});
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-lg shadow-indigo-200 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </button>
        </div>
      </div>

      {activeSession && (
        <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-md shadow-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Timer Running</p>
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
            <h2 className="text-3xl font-mono text-slate-900">{formatTime(elapsedTime)}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Working on: <span className="text-indigo-600 font-medium italic">{activeSession.taskName}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {confirmDiscard ? (
               <button onClick={() => { discardTimer(); setConfirmDiscard(false); }} className="bg-red-50 text-red-600 border border-red-200 px-6 py-2 rounded-lg font-bold hover:bg-red-100 transition-colors shadow-sm animate-pulse">
                 Confirm Discard
               </button>
            ) : (
               <button onClick={() => setConfirmDiscard(true)} className="bg-slate-50 text-slate-500 border border-slate-200 px-6 py-2 rounded-lg font-bold hover:bg-slate-100 hover:text-slate-700 transition-colors shadow-sm">
                 Discard
               </button>
            )}
            <button onClick={stopTimer} className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-6 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors shadow-sm">
              Clock Out
            </button>
          </div>
        </div>
      )}

      {formError && (
         <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium">
             {formError}
         </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-5 w-5" />
          </span>
          <input
            type="text"
            placeholder="Search project or task..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-900 transition-colors"
          />
        </div>
        
        <div className="flex-1 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm shadow-sm transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500">
          <button 
            onClick={() => setPeriodOffset(p => p - 1)} 
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Previous 2 Weeks"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2-Week Period</span>
            <span className="font-semibold text-slate-800 text-xs sm:text-sm">
              {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d, yyyy')}
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

        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
             <Globe className="h-5 w-5" />
          </span>
          <select
            value={displayTimezone}
            onChange={e => setDisplayTimezone(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-900 transition-colors"
          >
            <option value="local">Local Time (Browser)</option>
            <option value="UTC">UTC (GMT)</option>
            {availableTimezones.map(tz => (
               <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table export container */}
      <div id="timesheet-table" className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Project / Task</th>
                <th className="px-6 py-4">Time In/Out {displayTimezone !== 'local' && <span className="text-indigo-500 ml-1">({displayTimezone})</span>}</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTimesheets.map(t => {
                const p = projects.find(proj => proj.id === t.projectId);
                return (
                  <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${t.isRunning ? 'bg-indigo-50/40 relative' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                      {t.isRunning && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                      {formatTz(t.startTime, 'date')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.color || '#333' }} />
                        <span className="font-semibold text-slate-800">{p?.name || 'Unknown Project'}</span>
                      </div>
                      <div className="text-xs text-slate-500">{t.taskName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-center sm:text-left">
                      {formatTz(t.startTime, 'time')} - {t.isRunning ? <span className="text-indigo-600 animate-pulse font-bold">Running</span> : formatTz(t.endTime, 'time')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                      {(t.durationSecs / 3600).toFixed(2)} hrs
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {t.isRunning ? (
                         <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest px-3 py-1.5 bg-indigo-100 rounded-lg mr-2 inline-block">Active Lock</span>
                      ) : (
                        <>
                          <button onClick={() => editEntry(t)} className="p-1.5 text-indigo-500 hover:text-indigo-700 transition-colors mr-2 font-semibold">
                            Edit
                          </button>
                          {confirmDeleteId === t.id ? (
                             <button onClick={() => deleteEntry(t.id)} className="p-1.5 text-red-600 hover:text-red-700 transition-colors font-bold animate-pulse">
                               Confirm
                             </button>
                          ) : (
                             <button onClick={() => setConfirmDeleteId(t.id)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors font-semibold">
                               Delete
                             </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredTimesheets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No time entries found for this 2-week period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-6">{editingId ? 'Edit Entry' : 'Manual Time Entry'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Project</label>
                <select
                  required
                  value={formData.projectId}
                  onChange={e => setFormData({...formData, projectId: e.target.value})}
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
                  value={formData.taskName}
                  onChange={e => setFormData({...formData, taskName: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  placeholder="What did you work on?"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={formData.dateStr}
                  onChange={e => setFormData({...formData, dateStr: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">Clock In</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">Clock Out</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400"><i>Time entries are saved based on your current browser local time.</i></p>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-semibold transition-all shadow-lg shadow-indigo-200 text-sm"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

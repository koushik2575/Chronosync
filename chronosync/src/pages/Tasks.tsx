import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, GripVertical, CheckCircle2, Clock, Circle, Trash2, Edit, Paperclip, Link as LinkIcon, File, Sparkles, Loader2, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTaskDescription } from '../lib/gemini';
import { format } from 'date-fns';

const STATUSES = ['todo', 'in-progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

interface Attachment {
  id: string;
  type: 'link' | 'file';
  name: string;
  url?: string;
  data?: string;
}

export function Tasks() {
  const { appUser } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    projectId: '',
    attachments: [] as Attachment[],
    reminderAtStr: ''
  });

  useEffect(() => {
    if (!appUser) return;
    
    let tQ = query(collection(db, 'tasks'), where('userId', '==', appUser.uid));
    if (appUser.role === 'admin') tQ = query(collection(db, 'tasks'));
    
    const unT = onSnapshot(tQ, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unP = onSnapshot(query(collection(db, 'projects')), snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unT(); unP(); };
  }, [appUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    
    const reminderAt = formData.reminderAtStr ? new Date(formData.reminderAtStr).getTime() : null;

    try {
      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), {
          title: formData.title,
          description: formData.description,
          status: formData.status,
          priority: formData.priority,
          projectId: formData.projectId,
          attachments: formData.attachments,
          reminderAt,
          reminderDismissed: false,
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'tasks'), {
          title: formData.title,
          description: formData.description,
          status: formData.status,
          priority: formData.priority,
          projectId: formData.projectId,
          attachments: formData.attachments,
          reminderAt,
          reminderDismissed: false,
          userId: appUser.uid,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      setIsAdding(false);
      setEditingTask(null);
      setFormData({ title: '', description: '', status: 'todo', priority: 'medium', projectId: '', attachments: [], reminderAtStr: '' });
    } catch (err) {
      console.error(err);
      alert('Error updating task');
    }
  };

  const handleEdit = (t: any) => {
    setEditingTask(t);
    setFormData({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      projectId: t.projectId,
      attachments: t.attachments || [],
      // 'yyyy-MM-ddThh:mm' format for datetime-local
      reminderAtStr: t.reminderAt ? format(new Date(t.reminderAt), "yyyy-MM-dd'T'HH:mm") : ''
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
       console.error(err);
    }
  };

  const handleAddLink = () => {
    const url = prompt("Enter the URL:");
    if (!url) return;
    const name = prompt("Enter a name for this link:") || "External Link";
    setFormData({
      ...formData,
      attachments: [...formData.attachments, { id: Date.now().toString(), type: 'link', name, url }]
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert('File is too large! Please upload files under 500KB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      setFormData({
        ...formData,
        attachments: [...formData.attachments, { id: Date.now().toString(), type: 'file', name: file.name, data }]
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setFormData({
      ...formData,
      attachments: formData.attachments.filter(a => a.id !== id)
    });
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        status: newStatus,
        updatedAt: Date.now()
      });
    } catch(err) {
      console.error(err);
    }
  };

  const handleGenerateDescription = async () => {
    if (!formData.title) return;
    setIsAiLoading(true);
    try {
      const desc = await generateTaskDescription(formData.title);
      setFormData(prev => ({...prev, description: desc}));
    } catch(err) {
      alert("AI failed to generate description.");
    }
    setIsAiLoading(false);
  }

  const renderColumn = (status: string, title: string, icon: React.ReactNode) => {
    const columnTasks = tasks.filter(t => t.status === status);
    
    return (
      <div className="flex-1 min-w-[300px] bg-slate-50 border border-slate-200 rounded-xl flex flex-col max-h-[calc(100vh-12rem)]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-xl">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-bold text-slate-800 capitalize">{title}</h3>
          </div>
          <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold">
            {columnTasks.length}
          </span>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <AnimatePresence>
            {columnTasks.map(t => {
              const project = projects.find(p => p.id === t.projectId);
              const attachmentCount = t.attachments?.length || 0;
              const hasActiveReminder = t.reminderAt && !t.reminderDismissed && t.reminderAt > Date.now();
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={t.id} 
                  className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm group hover:border-indigo-300 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span 
                      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        t.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' :
                        t.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(t)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">
                    {t.title} 
                    {hasActiveReminder && <Bell className="inline-block w-3 h-3 ml-1 text-indigo-500" />}
                  </h4>
                  {t.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{t.description}</p>}
                  
                  {attachmentCount > 0 && (
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-2">
                       <Paperclip className="w-3 h-3" /> {attachmentCount} {attachmentCount === 1 ? 'attachment' : 'attachments'}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    {project ? (
                      <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }}></span>
                        {project.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No project</span>
                    )}
                    
                    <select
                      value={t.status}
                      onChange={(e) => updateStatus(t.id, e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded px-1 min-w-[80px]"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tasks</h2>
          <p className="text-sm text-slate-500">Manage your active work and to-dos.</p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setFormData({ title: '', description: '', status: 'todo', priority: 'medium', projectId: '', attachments: [], reminderAtStr: '' });
            setIsAdding(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      <div className="flex-1 flex overflow-x-auto gap-6 pb-4">
        {renderColumn('todo', 'To Do', <Circle className="w-5 h-5 text-slate-400" />)}
        {renderColumn('in-progress', 'In Progress', <Clock className="w-5 h-5 text-amber-500" />)}
        {renderColumn('done', 'Done', <CheckCircle2 className="w-5 h-5 text-emerald-500" />)}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h3 className="font-bold text-slate-800">{editingTask ? 'Edit Task' : 'New Task'}</h3>
            </div>
            
            <div className="overflow-y-auto flex-1">
              <form id="task-form" onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Task title"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-slate-700">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={!formData.title || isAiLoading}
                      className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-2 py-0.5 font-bold hover:bg-indigo-100 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI Suggest
                    </button>
                  </div>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                    placeholder="Task details..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={e => setFormData({...formData, priority: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Project (Optional)</label>
                    <select
                      value={formData.projectId}
                      onChange={e => setFormData({...formData, projectId: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">No Project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Remind Me</label>
                    <input
                      type="datetime-local"
                      value={formData.reminderAtStr}
                      onChange={e => setFormData({...formData, reminderAtStr: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Attachments & Links</label>
                  
                  {formData.attachments.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {formData.attachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm group">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {att.type === 'link' ? <LinkIcon className="w-4 h-4 text-indigo-500 shrink-0" /> : <File className="w-4 h-4 text-emerald-500 shrink-0" />}
                            <span className="truncate text-slate-700 font-medium select-none">{att.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {att.type === 'link' && (
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Open</a>
                            )}
                            {att.type === 'file' && (
                              <a href={att.data} download={att.name} className="text-xs text-emerald-600 hover:underline">Download</a>
                            )}
                            <button type="button" onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-500 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" /> Add Link
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                    >
                      <Paperclip className="w-4 h-4" /> Add File
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center mt-2">Max file size: 500KB per file.</p>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                form="task-form"
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {editingTask ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

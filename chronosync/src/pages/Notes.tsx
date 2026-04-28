import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit, FileText, CalendarDays, Link as LinkIcon, Paperclip, File, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { summarizeText, extractActionItems } from '../lib/gemini';

interface Attachment {
  id: string;
  type: 'link' | 'file';
  name: string;
  url?: string;
  data?: string;
}

export function Notes() {
  const { appUser } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    projectId: '',
    attachments: [] as Attachment[]
  });

  useEffect(() => {
    if (!appUser) return;
    
    let nQ = query(collection(db, 'notes'), where('userId', '==', appUser.uid));
    if (appUser.role === 'admin') nQ = query(collection(db, 'notes'));
    
    const unN = onSnapshot(nQ, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a,b) => b.updatedAt - a.updatedAt));
    });

    const unP = onSnapshot(query(collection(db, 'projects')), snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unN(); unP(); };
  }, [appUser]);

  const handleSaveNote = async () => {
    if (!appUser || !formData.title) return;
    
    try {
      if (selectedNote) {
        await updateDoc(doc(db, 'notes', selectedNote.id), {
          ...formData,
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'notes'), {
          ...formData,
          userId: appUser.uid,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        setIsAdding(false);
      }
      setSelectedNote({ ...selectedNote, ...formData });
      if(!selectedNote) setIsAdding(false);
    } catch (err) {
      console.error(err);
      alert('Error saving note');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this note?')) return;
    try {
      await deleteDoc(doc(db, 'notes', id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
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
      attachments: [...(formData.attachments || []), { id: Date.now().toString(), type: 'link', name, url }]
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
        attachments: [...(formData.attachments || []), { id: Date.now().toString(), type: 'file', name: file.name, data }]
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setFormData({
      ...formData,
      attachments: (formData.attachments || []).filter((a: any) => a.id !== id)
    });
  };

  const handleSummarize = async () => {
    if (!formData.content) return;
    setIsAiLoading(true);
    try {
      const summary = await summarizeText(formData.content);
      setFormData(prev => ({...prev, content: prev.content + '\n\n--- AI Summary ---\n' + summary }));
    } catch(err) {
      console.error(err);
      alert("AI failed to summarize.");
    }
    setIsAiLoading(false);
  }

  const handleExtractTasks = async () => {
    if (!formData.content) return;
    setIsAiLoading(true);
    try {
      const tasksStr = await extractActionItems(formData.content);
      setFormData(prev => ({...prev, content: prev.content + '\n\n--- Action Items ---\n' + tasksStr }));
    } catch(err) {
      console.error(err);
      alert("AI failed to extract tasks.");
    }
    setIsAiLoading(false);
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      {/* Sidebar List */}
      <div className="w-full md:w-80 flex flex-col gap-4 border-r border-slate-200 pr-6 h-full shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Notes</h2>
          <button
            onClick={() => {
              setSelectedNote(null);
              setFormData({ title: '', content: '', projectId: '', attachments: [] });
              setIsAdding(true);
            }}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {notes.length === 0 && !isAdding && (
            <div className="text-center p-6 border border-dashed border-slate-300 rounded-xl">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No notes yet</p>
            </div>
          )}
          
          {isAdding && !selectedNote && (
            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl cursor-default">
              <p className="text-sm font-bold text-indigo-700">New Note...</p>
            </div>
          )}

          {notes.map(note => {
            const project = projects.find(p => p.id === note.projectId);
            const isSelected = selectedNote?.id === note.id;
            return (
              <div 
                key={note.id}
                onClick={() => {
                  setSelectedNote(note);
                  setIsAdding(false);
                  setFormData({
                    title: note.title,
                    content: note.content,
                    projectId: note.projectId || '',
                    attachments: note.attachments || []
                  });
                }}
                className={`p-3 rounded-xl cursor-pointer transition-colors group ${
                  isSelected ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-bold text-sm line-clamp-1 ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {note.title || 'Untitled Note'}
                  </h4>
                  <button 
                    onClick={(e) => handleDelete(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1 -mr-2 -mt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{note.content || 'No content...'}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>{format(note.updatedAt, 'MMM d, yyyy')}</span>
                  <div className="flex items-center gap-2">
                    {note.attachments?.length > 0 && (
                       <span className="flex items-center gap-0.5"><Paperclip className="w-3 h-3" /> {note.attachments.length}</span>
                    )}
                    {project && (
                      <span className="flex items-center gap-1 max-w-[100px] truncate">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: project.color }}></span>
                        <span className="truncate">{project.name}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Editor Space */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {(selectedNote || isAdding) ? (
          <>
            <div className="p-4 md:p-6 border-b border-slate-100 space-y-4">
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="Note Title"
                className="w-full text-2xl md:text-3xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 placeholder-slate-300 text-slate-900"
              />
              <div className="flex items-center gap-4 text-sm">
                <select
                  value={formData.projectId}
                  onChange={e => setFormData({...formData, projectId: e.target.value})}
                  className="bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-xs"
                >
                  <option value="">No Project Affiliation</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {selectedNote && (
                  <span className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Last edited {format(selectedNote.updatedAt, 'h:mm a, MMM d')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col relative h-full overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100/50 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
                 <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1 mr-2"><Sparkles className="w-3 h-3" /> AI Tools</span>
                 <button onClick={handleSummarize} disabled={!formData.content || isAiLoading} className="text-xs bg-white border border-indigo-200 text-indigo-700 shadow-sm rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-50 flex items-center gap-1.5 transition-colors disabled:opacity-50">
                    {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    Summarize Note
                 </button>
                 <button onClick={handleExtractTasks} disabled={!formData.content || isAiLoading} className="text-xs bg-white border border-indigo-200 text-indigo-700 shadow-sm rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-50 flex items-center gap-1.5 transition-colors disabled:opacity-50">
                    {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit className="w-3.5 h-3.5" />}
                    Extract Action Items
                 </button>
              </div>
              <textarea
                value={formData.content}
                onChange={e => setFormData({...formData, content: e.target.value})}
                placeholder="Start writing..."
                className="w-full h-full p-4 md:p-6 flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none text-slate-700 leading-relaxed disabled:opacity-50"
              />
              
              <div className="border-t border-slate-100 bg-slate-50 p-4 shrink-0 px-4 md:px-6">
                <div className="flex items-center justify-between mb-2">
                   <h4 className="text-sm font-bold text-slate-700">Attachments & Links</h4>
                   <div className="flex items-center gap-2">
                      <button onClick={handleAddLink} className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 hover:bg-slate-100 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> Link
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 hover:bg-slate-100 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> File (Max 500KB)
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                   </div>
                </div>

                {formData.attachments?.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {formData.attachments.map((att: Attachment) => (
                      <div key={att.id} className="min-w-[150px] inline-flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 text-sm group">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            {att.type === 'link' ? <LinkIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> : <File className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                            <span className="truncate text-slate-700 text-xs font-medium max-w-[120px]">{att.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {att.type === 'link' && (
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline">Open</a>
                            )}
                            {att.type === 'file' && (
                              <a href={att.data} download={att.name} className="text-[10px] text-emerald-600 hover:underline">Download</a>
                            )}
                            <button type="button" onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-500 p-1">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 mb-4 italic">No attachments added.</div>
                )}
                
                <div className="flex justify-end pt-2 border-t border-slate-200">
                   <button
                     onClick={handleSaveNote}
                     disabled={!formData.title}
                     className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
                   >
                     Save Entry
                   </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-slate-200 mb-4 shadow-sm text-indigo-300">
               <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Editor Workspace</h3>
            <p className="text-slate-500 max-w-sm mb-6">Select a note from the sidebar or craft a new entry to capture your thoughts.</p>
            <button
               onClick={() => {
                 setFormData({ title: '', content: '', projectId: '', attachments: [] });
                 setIsAdding(true);
               }}
               className="bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              Create New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

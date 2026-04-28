import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, FolderGit2, Users, X } from 'lucide-react';

interface ProjectAssignment {
  userId: string;
  designation: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerId: string;
  assignments?: ProjectAssignment[];
}

export function Projects() {
  const { appUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#6366f1' });
  const [managingProject, setManagingProject] = useState<Project | null>(null);
  const [newAssignment, setNewAssignment] = useState({ userId: '', designation: '' });

  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let projData: Project[] = [];
      snapshot.forEach((doc) => projData.push({ id: doc.id, ...doc.data() } as Project));
      
      if (appUser && appUser.role !== 'admin' && appUser.role !== 'manager') {
        projData = projData.filter(p => (p.assignments || []).some(a => a.userId === appUser.uid) || p.ownerId === appUser.uid);
      }
      
      setProjects(projData);
    });
    return unsubscribe;
  }, [appUser]);

  useEffect(() => {
    if (appUser?.role === 'admin' || appUser?.role === 'manager') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userData: any[] = [];
        snapshot.forEach((doc) => userData.push({ id: doc.id, ...doc.data() }));
        setUsers(userData);
      });
      return unsubscribe;
    }
  }, [appUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;

    try {
      await addDoc(collection(db, 'projects'), {
        ...newProject,
        ownerId: appUser?.uid,
        assignments: [],
        createdAt: Date.now(),
      });
      setIsCreating(false);
      setNewProject({ name: '', description: '', color: '#6366f1' });
    } catch (err) {
      console.error(err);
      alert('Error creating project. Check permissions.');
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingProject || !newAssignment.userId || !newAssignment.designation) return;
    
    try {
      const updatedAssignments = [...(managingProject.assignments || []), newAssignment];
      await updateDoc(doc(db, 'projects', managingProject.id), {
        assignments: updatedAssignments
      });
      setNewAssignment({ userId: '', designation: '' });
      setManagingProject({ ...managingProject, assignments: updatedAssignments });
    } catch(err) {
      console.error(err);
      alert('Failed to add assignment. Check permissions.');
    }
  };

  const handleRemoveAssignment = async (userId: string) => {
    if (!managingProject) return;
    try {
      const updatedAssignments = (managingProject.assignments || []).filter(a => a.userId !== userId);
      await updateDoc(doc(db, 'projects', managingProject.id), {
        assignments: updatedAssignments
      });
      setManagingProject({ ...managingProject, assignments: updatedAssignments });
    } catch(err) {
      console.error(err);
      alert('Failed to remove assignment.');
    }
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteDoc(doc(db, 'projects', projectToDelete));
      setProjectToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Error deleting project. Make sure you are the owner or an admin.');
      setProjectToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h2>
          <p className="text-sm text-slate-500">Manage your categorization projects and tasks.</p>
        </div>
        {(appUser?.role === 'admin' || appUser?.role === 'manager') && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        )}
      </div>

      {isCreating && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Create New Project</h3>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Name</label>
              <input
                type="text"
                required
                value={newProject.name}
                onChange={e => setNewProject({...newProject, name: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                placeholder="e.g. Website Redesign"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Description</label>
              <textarea
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 shadow-sm"
                placeholder="Brief description of the project"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Color</label>
              <div className="flex gap-2">
                {['#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9', '#6366f1', '#d946ef'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewProject({...newProject, color: c})}
                    className={`w-8 h-8 rounded-full border-2 ${newProject.color === c ? 'border-indigo-600' : 'border-transparent'} shadow-sm`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-semibold transition-all shadow-lg shadow-indigo-200 text-sm"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col group relative overflow-hidden shadow-sm hover:shadow transition-shadow">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: project.color }} />
            <div className="flex justify-between items-start mb-2 pl-2">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-slate-400" />
                <h3 className="font-bold text-slate-800">{project.name}</h3>
              </div>
              {(appUser?.role === 'admin' || (appUser?.role === 'manager' && appUser?.uid === project.ownerId)) && (
                <button
                  onClick={() => setProjectToDelete(project.id)}
                  className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-2 flex-1 pl-2 mb-4">{project.description || 'No description provided.'}</p>
            <div className="pl-2 flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
              <div className="flex -space-x-2">
                {(project.assignments || []).slice(0, 3).map((assign) => {
                  const user = users.find(u => u.id === assign.userId);
                  return (
                    <div key={assign.userId} className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700" title={`${user?.name || 'Unknown'} - ${assign.designation}`}>
                      {user?.name?.charAt(0) || '?'}
                    </div>
                  );
                })}
                {(project.assignments?.length || 0) > 3 && (
                  <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +{(project.assignments?.length || 0) - 3}
                  </div>
                )}
                {!(project.assignments?.length) && <span className="text-xs text-slate-400">No assignees</span>}
              </div>
              {(appUser?.role === 'admin' || (appUser?.role === 'manager')) && (
                 <button
                   onClick={() => setManagingProject(project)}
                   className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                 >
                   <Users className="w-3 h-3" /> Manage
                 </button>
              )}
            </div>
          </div>
        ))}
        {projects.length === 0 && !isCreating && (
          <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl bg-slate-50">
            No projects found. Create one to get started.
          </div>
        )}
      </div>

      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Project?</h3>
            <p className="text-slate-500 mb-6 text-sm">Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
               >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
               >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {managingProject && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Manage Assignments</h3>
                <p className="text-sm text-slate-500">{managingProject.name}</p>
              </div>
              <button onClick={() => setManagingProject(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddAssignment} className="mb-6 flex gap-2">
              <select
                required
                value={newAssignment.userId}
                onChange={e => setNewAssignment({ ...newAssignment, userId: e.target.value })}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select User...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} disabled={(managingProject.assignments || []).some(a => a.userId === u.id)}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Designation (e.g. Lead)"
                value={newAssignment.designation}
                onChange={e => setNewAssignment({ ...newAssignment, designation: e.target.value })}
                className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition">
                Add
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2">
              {(managingProject.assignments || []).map(assign => {
                const user = users.find(u => u.id === assign.userId);
                return (
                   <div key={assign.userId} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                     <div>
                       <p className="font-bold text-slate-800 text-sm">{user?.name || 'Unknown User'}</p>
                       <p className="text-xs text-indigo-600 font-medium">{assign.designation}</p>
                     </div>
                     <button
                       onClick={() => handleRemoveAssignment(assign.userId)}
                       className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                );
              })}
              {!(managingProject.assignments?.length) && (
                 <div className="text-center py-6 text-sm text-slate-400">
                   No users assigned to this project yet.
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

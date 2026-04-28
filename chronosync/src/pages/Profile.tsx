import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Bell, Palette, Shield } from 'lucide-react';

export function Profile() {
  const { appUser, setAppUser } = useAuth();
  const [name, setName] = useState(appUser?.name || '');
  const [hourlyRate, setHourlyRate] = useState(appUser?.hourlyRate?.toString() || '0');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Local preferences
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (appUser) {
      setName(appUser.name);
      setHourlyRate(appUser.hourlyRate?.toString() || '0');
    }
    const notifs = localStorage.getItem('chrono_notifs');
    if (notifs !== null) setEmailNotifs(notifs === 'true');
    
    const motion = localStorage.getItem('chrono_motion');
    if (motion !== null) setReducedMotion(motion === 'true');
  }, [appUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    
    setIsSaving(true);
    setSaveMessage('');
    try {
      const rateNum = parseFloat(hourlyRate) || 0;
      const updates: any = {};
      
      if (name !== appUser.name) updates.name = name;
      if (rateNum !== (appUser.hourlyRate || 0)) updates.hourlyRate = rateNum;

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', appUser.uid), updates);
        setAppUser({ ...appUser, ...updates });
      }
      
      localStorage.setItem('chrono_notifs', String(emailNotifs));
      localStorage.setItem('chrono_motion', String(reducedMotion));
      
      setSaveMessage('Profile settings saved successfully.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err: any) {
      console.error("Profile save error:", err);
      // Give a more detailed message if it's permission issues
      if (err.code === 'permission-denied') {
        setSaveMessage('Permission Denied. Please ensure your inputs are valid.');
      } else {
        setSaveMessage(`Failed to save settings: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Profile Settings</h2>
        <p className="text-sm text-slate-500">Manage your personal information and application preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium border border-indigo-100 transition-colors">
            <User className="h-5 w-5" />
            Personal Info
          </button>
          <button disabled className="w-full flex items-center gap-3 px-4 py-3 bg-white text-slate-600 hover:bg-slate-50 rounded-xl font-medium border border-transparent transition-colors opacity-60 cursor-not-allowed">
            <Bell className="h-5 w-5" />
            Notifications
          </button>
          <button disabled className="w-full flex items-center gap-3 px-4 py-3 bg-white text-slate-600 hover:bg-slate-50 rounded-xl font-medium border border-transparent transition-colors opacity-60 cursor-not-allowed">
            <Palette className="h-5 w-5" />
            Appearance
          </button>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 space-y-6">
              
              {/* Account Information Section */}
              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Account Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-shadow"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">Hourly Rate ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={hourlyRate}
                      onChange={e => setHourlyRate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-shadow"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={appUser?.email || ''}
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Email is managed via Google Account
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">Role</label>
                    <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                      <span className="capitalize font-semibold text-slate-700">{appUser?.role}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Preferences Section */}
              <section className="pt-2">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Application Preferences</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      checked={emailNotifs}
                      onChange={(e) => setEmailNotifs(e.target.checked)}
                    />
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">Email Notifications</p>
                      <p className="text-xs text-slate-500">Receive weekly timesheet summaries.</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      checked={reducedMotion}
                      onChange={(e) => setReducedMotion(e.target.checked)}
                    />
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">Reduced Motion</p>
                      <p className="text-xs text-slate-500">Disable non-essential animations across the app.</p>
                    </div>
                  </label>
                </div>
              </section>
              
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center gap-4">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 text-sm"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              
              {saveMessage && (
                <span className={`text-sm font-medium ${saveMessage.includes('Failed') ? 'text-red-500' : 'text-emerald-600'}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

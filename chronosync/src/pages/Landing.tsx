import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Clock, Briefcase, FileText, LayoutDashboard, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export function Landing() {
  const { appUser, signInWithGoogle } = useAuth();

  if (appUser) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      name: 'Time Tracking',
      description: 'Clock in and out of projects with precision. See your timeline visualized instantly.',
      icon: Clock,
    },
    {
      name: 'Smart Dashboard',
      description: 'Get deep insights into your productivity with interactive charts and weekly breakdowns.',
      icon: LayoutDashboard,
    },
    {
      name: 'Project Organization',
      description: 'Categorize your time by project or task to keep everything perfectly organized.',
      icon: Briefcase,
    },
    {
      name: 'Exportable Timesheets',
      description: 'Generate beautiful PDF reports of your tracked hours ready for invoicing or review.',
      icon: FileText,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-200">C</div>
            <span className="text-xl font-bold tracking-tight text-slate-900">ChronoSync</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={signInWithGoogle}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={signInWithGoogle}
              className="px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600"></span>
            Now with Hourly Rate tracking
          </div>
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-slate-900">
            Master your time. <br/>
            <span className="text-indigo-600">Elevate your work.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            ChronoSync is the elegantly simple time tracker built for professionals. Log hours, analyze projects, and generate comprehensive reports in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={signInWithGoogle}
              className="w-full sm:w-auto px-8 py-4 text-base font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2"
            >
              <svg className="h-5 w-5 bg-white rounded-full p-0.5" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Start tracking for free
            </button>
            <p className="text-sm text-slate-400 font-medium sm:ml-4">No credit card required.</p>
          </div>
        </motion.div>

        {/* Dashboard Preview mockup */}
        <motion.div
           initial={{ opacity: 0, y: 40 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.7, delay: 0.2 }}
           className="mt-20 max-w-5xl mx-auto relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 sm:p-4 overflow-hidden">
             {/* Fake dashboard header */}
             <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <div className="flex gap-4">
                  <div className="h-4 w-20 bg-slate-100 rounded"></div>
                  <div className="h-4 w-12 bg-slate-100 rounded"></div>
                </div>
             </div>
             {/* Fake dashboard content */}
             <div className="grid grid-cols-3 gap-6">
               <div className="col-span-2 space-y-6">
                 <div className="h-40 bg-slate-50 rounded-xl border border-slate-100 p-6 flex flex-col justify-between">
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                    <div className="h-12 w-48 bg-slate-300 rounded mt-4"></div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="h-32 bg-slate-50 rounded-xl border border-slate-100 p-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></div>
                    <div className="h-32 bg-slate-50 rounded-xl border border-slate-100 p-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></div>
                 </div>
               </div>
               <div className="col-span-1 space-y-6">
                  <div className="h-32 bg-indigo-50 rounded-xl border border-indigo-100 p-4"><div className="h-4 w-28 bg-indigo-200 rounded"></div></div>
                  <div className="h-40 bg-slate-50 rounded-xl border border-slate-100 p-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></div>
               </div>
             </div>
          </div>
        </motion.div>
      </div>

      {/* Features Grid */}
      <div className="bg-white py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-indigo-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to manage your time
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div 
                  key={feature.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors"
                >
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 mb-6 shadow-sm">
                    <Icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.name}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-indigo-700">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            <span className="block">Ready to dive in?</span>
            <span className="block text-indigo-200">Start tracking today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-indigo-500 rounded mr-2 flex items-center justify-center font-bold text-white text-xs">C</div>
            <span className="text-slate-300 font-bold">ChronoSync</span>
          </div>
          <p className="text-slate-500 text-sm">
            &copy; 2026 ChronoSync. Built with Professional Polish.
          </p>
        </div>
      </footer>
    </div>
  );
}

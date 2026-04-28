import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, X, Send, Loader2, Bot, User } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function AIAssistant() {
  const { appUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  const initChat = async () => {
    if (!appUser) return;
    setIsLoading(true);
    setMessages([]);
    try {
      // Fetch user's projects
      const pQ = query(collection(db, 'projects'));
      const pSnaps = await getDocs(pQ);
      const projects = pSnaps.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Fetch user's timesheets
      let tQ;
      if (appUser.role === 'admin') {
          tQ = query(collection(db, 'timesheets'));
      } else {
          tQ = query(collection(db, 'timesheets'), where('userId', '==', appUser.uid));
      }
      const tSnaps = await getDocs(tQ);
      const timesheets = tSnaps.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      const systemInstruction = `You are ChronoSync Assistant, an AI expert helping the user manage their time and projects.
Here is the user's current data context:
Current Date: ${format(new Date(), 'yyyy-MM-dd HH:mm')}
Projects: ${JSON.stringify(projects)}
Timesheets: ${JSON.stringify(timesheets)}

Answer the user's questions about their data concisely and professionally. If they ask for insights, provide them based on the provided Timesheets and Projects data. Provide durations in hours, and format nicely using markdown. Emphasize data-driven answers.`;

      chatRef.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction,
          temperature: 0.2
        }
      });

      setMessages([{ role: 'model', text: "Hi! I'm your ChronoSync AI Assistant. I've analyzed your projects and timesheets. How can I help you today?" }]);
    } catch(err) {
      console.error(err);
      setMessages([{ role: 'model', text: "Sorry, I had trouble analyzing your data. Please try again." }]);
    }
    setIsLoading(false);
  };

  const toggleChat = () => {
    if (!isOpen && !chatRef.current) {
       initChat();
    }
    setIsOpen(!isOpen);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatRef.current) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessageStream({ message: userMessage });
      
      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of response) {
        fullText += chunk.text;
        setMessages(prev => {
          const newM = [...prev];
          newM[newM.length - 1] = { role: 'model', text: fullText };
          return newM;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error while processing your request." }]);
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleChat}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-[380px] h-[500px] max-h-[80vh] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden"
          >
            <div className="bg-indigo-600 p-4 text-white flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2">
                 <Bot className="w-5 h-5" />
                 <h3 className="font-bold">ChronoSync Assistant</h3>
               </div>
               <button onClick={toggleChat} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
               </button>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
            >
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                  }`}>
                    {msg.role === 'model' && msg.text === '' ? (
                       <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    ) : (
                       <div className="markdown-body prose prose-sm max-w-none">
                         <ReactMarkdown>{msg.text}</ReactMarkdown>
                       </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length -1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <form onSubmit={handleSend} className="flex items-end gap-2 relative">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder="Ask about your projects..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none pr-12 max-h-32"
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

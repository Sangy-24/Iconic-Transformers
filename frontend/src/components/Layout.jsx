import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bot, User, LogIn, Send, X } from 'lucide-react';
import axios from 'axios';

const Layout = ({ children }) => {
  // --- Chatbot State ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'Hello! I am the Iconic AI assistant. How can I help with your transformers today?' }
  ]);
  
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat whenever history or loading state changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { role: 'user', text: input };
    
    // Update UI immediately
    setChatHistory(prev => [...prev, userMsg]);
    const currentMessage = input;
    setInput("");
    setIsLoading(true);

    try {
      // Connects to your Node.js Gateway (Port 5000)
      const res = await axios.post("http://localhost:5000/api/chat", { 
        message: currentMessage 
      });
      
      setChatHistory(prev => [...prev, { role: 'bot', text: res.data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "Service temporarily offline. Please check your connection." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* --- HEADER --- */}
      <header className="bg-brand-dark text-white shadow-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-brand-accent">Iconic Transformers</span>
          </Link>
          <nav className="hidden md:flex space-x-8 items-center">
            <Link to="/" className="hover:text-brand-accent transition-colors">Home</Link>
            <Link to="/about" className="hover:text-brand-accent transition-colors">About</Link>
            <Link to="/services" className="hover:text-brand-accent transition-colors">Services</Link>
            <Link to="/contact" className="hover:text-brand-accent transition-colors">Contact</Link>
          </nav>
          <div className="flex space-x-4">
            <Link to="/profile" className="flex items-center text-sm font-medium hover:text-brand-accent transition-colors">
              <User size={18} className="mr-1" /> Profile
            </Link>
            <Link to="/login" className="flex items-center text-sm font-medium bg-brand-accent px-4 py-2 rounded-md hover:bg-blue-600 transition-colors">
              <LogIn size={18} className="mr-1" /> Login
            </Link>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-grow bg-brand-light">
        {children}
      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-brand-dark text-brand-grey py-12">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Iconic Transformers</h3>
            <p className="text-sm">Leading manufacturer and service provider for industrial transformers worldwide.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-brand-accent">About Us</Link></li>
              <li><Link to="/services" className="hover:text-brand-accent">Our Services</Link></li>
              <li><Link to="/contact" className="hover:text-brand-accent">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Contact Info</h4>
            <ul className="space-y-2 text-sm">
              <li>123 Industrial Ave, Tech City, 10001</li>
              <li>Phone: +1 (555) 123-4567</li>
              <li>Email: info@iconictransformers.com</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">AI Features</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/ai-tools" className="hover:text-brand-accent">Predictive Maintenance</Link></li>
              <li><Link to="/ai-tools" className="hover:text-brand-accent">Demand Forecasting</Link></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-6 mt-8 pt-8 border-t border-gray-800 text-sm text-center">
          &copy; {new Date().getFullYear()} Iconic Transformers and Electricals. All rights reserved.
        </div>
      </footer>
      
      {/* --- EXPANDED CHATBOT WINDOW --- */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden z-50">
          <div className="bg-brand-dark text-white p-4 flex justify-between items-center shadow-sm">
            <span className="font-bold flex items-center gap-2 text-lg"><Bot size={22}/> AI Assistant</span>
            <button onClick={() => setIsChatOpen(false)} className="hover:text-brand-accent transition-colors">
                <X size={24}/>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-grow p-5 overflow-y-auto space-y-4 bg-gray-50">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-brand-accent text-white rounded-tr-none' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {/* Thinking Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-500 text-xs p-3 rounded-xl rounded-tl-none border border-gray-100 italic animate-pulse">
                  AI is thinking...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t bg-white flex items-center gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow text-sm border border-gray-300 rounded-full px-5 py-3 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
            />
            <button 
              type="submit" 
              disabled={isLoading}
              className="bg-brand-accent text-white p-3 rounded-full hover:bg-blue-600 transition-all disabled:opacity-50 shadow-md"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      )}

      {/* --- FLOATING TOGGLE BUTTON --- */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 p-4 bg-brand-accent text-white rounded-full shadow-lg hover:bg-blue-600 transition-all z-50 hover:scale-110 active:scale-95"
      >
        {isChatOpen ? <X size={28} /> : <Bot size={28} />}
      </button>
    </div>
  );
}

export default Layout;
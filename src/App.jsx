import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  LayoutDashboard, Image as ImageIcon, MessageSquare, FolderKanban, 
  Settings, Bell, Search, Menu, X, Upload, ShieldCheck, 
  Users, HardHat, FileText, ChevronRight, Activity, Clock, 
  CheckCircle2, AlertCircle, Download, Camera, Send
} from 'lucide-react';


// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyBdpQP96Hs4meZUeaeur8ycKjHH0rdIoV8",
  authDomain: "nmic-3dd2b.firebaseapp.com",
  projectId: "nmic-3dd2b",
  storageBucket: "nmic-3dd2b.firebasestorage.app",
  messagingSenderId: "106336344530",
  appId: "1:106336344530:web:76fbae7c51aa2bd2fb500b",
  measurementId: "G-TG9J09PZ9H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// --- Mock Data Generators for Demo Purposes ---
const MOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1541888086425-d81bb19240f5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356f90?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80"
];

// --- Components ---

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' or 'contractor'
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // --- New Login State ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App State
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Data State
  const [photos, setPhotos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // 1. Auth & Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Data Fetching (Guarded by user)
  useEffect(() => {
    if (!user || !is2FAVerified || !role) return;

    const photosRef = collection(db, 'artifacts', appId, 'public', 'data', 'photos');
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const filesRef = collection(db, 'artifacts', appId, 'public', 'data', 'files');

    const unsubPhotos = onSnapshot(photosRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setPhotos(data);
    }, console.error);

    const unsubMessages = onSnapshot(messagesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMessages(data);
    }, console.error);

    const unsubFiles = onSnapshot(filesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setFiles(data);
    }, console.error);

    return () => {
      unsubPhotos();
      unsubMessages();
      unsubFiles();
    };
  }, [user, is2FAVerified, role]);

  // Toast Notification Simulator
  const triggerNotification = (title, message) => {
    const newNotif = { id: Date.now(), title, message };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
    }, 4000);
  };

  // --- Handlers ---
  const handleRealLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      // 1. Authenticate with Firebase Email/Password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Look up their role securely in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setRole(userData.role); // Sets to 'admin' or 'contractor'
        
        // Simulate 2FA Delay
        setTimeout(() => {
          setIs2FAVerified(true);
          if (userData.role === 'contractor') setCurrentView('photos');
        }, 1500);
      } else {
        setLoginError("Account exists, but no portal role is assigned. Contact Administrator.");
        await signOut(auth);
      }
    } catch (error) {
      console.error(error);
      setLoginError("Invalid email or password.");
    }
  };

  const handleLogin = (selectedRole) => {
    setRole(selectedRole);
    // Simulate 2FA Flow
    setTimeout(() => {
      setIs2FAVerified(true);
      if (selectedRole === 'contractor') setCurrentView('photos'); // Contractors default to photos/files
    }, 1500);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRole(null);
    setIs2FAVerified(false);
    setCurrentView('dashboard');
  };

  const addMessage = async (text, portalThread) => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
        text,
        authorId: user.uid,
        authorRole: role,
        portalThread, // 'admin' or 'contractor'
        createdAt: serverTimestamp()
      });
      triggerNotification("New Message", `Posted to ${portalThread} board.`);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const uploadPhotoMock = async () => {
    const randomImg = MOCK_PHOTOS[Math.floor(Math.random() * MOCK_PHOTOS.length)];
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'photos'), {
        url: randomImg,
        uploadedBy: user.uid,
        uploaderRole: role,
        location: "Site Sector B",
        createdAt: serverTimestamp()
      });
      triggerNotification("Photo Uploaded", "Successfully synced to admin portal.");
    } catch (err) {
      console.error("Error uploading photo:", err);
    }
  };

  const uploadFileMock = async (fileName, fileType) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'files'), {
        name: fileName,
        type: fileType,
        size: Math.floor(Math.random() * 10) + 1 + " MB",
        uploadedBy: role,
        portalAccess: role === 'admin' ? 'admin' : 'contractor', // Admins can restrict to admin
        version: "v" + (Math.floor(Math.random() * 3) + 1) + ".0",
        createdAt: serverTimestamp()
      });
      triggerNotification("File Uploaded", `${fileName} has been secured.`);
    } catch (err) {
      console.error("Error uploading file:", err);
    }
  };


  // --- Render Helpers ---
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Initializing Secure Environment...</div>;
  }

  // --- Login & 2FA Screen ---
  if (!role || !is2FAVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-xl">
              <HardHat size={40} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">ConstrucTrack</h1>
          <p className="text-slate-400 text-center mb-8">Enterprise Project Portal</p>

          {!role ? (
            <div className="space-y-6">
              {/* Real Production Login Form */}
              <form onSubmit={handleRealLogin} className="space-y-4">
                {loginError && <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm text-center">{loginError}</div>}
                <div>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Email Address"
                  />
                </div>
                <div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Password"
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors">
                  Secure Login
                </button>
              </form>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase">Or use demo mode</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>

              {/* Demo Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleLogin('admin')}
                  className="flex flex-col items-center justify-center bg-slate-700 hover:bg-slate-600 p-3 rounded-xl transition-colors border border-slate-600 hover:border-blue-500 group"
                >
                  <ShieldCheck className="text-blue-400 mb-1" size={20} />
                  <span className="text-xs font-semibold text-white">Demo Admin</span>
                </button>

                <button 
                  onClick={() => handleLogin('contractor')}
                  className="flex flex-col items-center justify-center bg-slate-700 hover:bg-slate-600 p-3 rounded-xl transition-colors border border-slate-600 hover:border-amber-500 group"
                >
                  <Users className="text-amber-400 mb-1" size={20} />
                  <span className="text-xs font-semibold text-white">Demo Contractor</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6 animate-pulse">
              <ShieldCheck size={48} className="mx-auto text-green-400" />
              <div>
                <h3 className="text-xl font-bold text-white">Verifying 2FA...</h3>
                <p className="text-sm text-slate-400 mt-2">Connecting to identity provider securely.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Main App Layout ---
  const navItems = [
    ...(role === 'admin' ? [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    { id: 'photos', label: 'Progress Photos', icon: ImageIcon },
    { id: 'messages', label: 'Message Board', icon: MessageSquare },
    { id: 'files', label: 'Documents & Files', icon: FolderKanban },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={`min-h-screen flex font-sans ${darkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <div key={notif.id} className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 animate-bounce">
            <Bell size={18} />
            <div>
              <p className="font-bold text-sm">{notif.title}</p>
              <p className="text-xs opacity-90">{notif.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-r`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-inherit">
          <div className="flex items-center space-x-2">
            <HardHat className={role === 'admin' ? 'text-blue-500' : 'text-amber-500'} />
            <span className="font-bold text-lg tracking-tight">ConstrucTrack</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <div className={`px-4 py-3 rounded-lg mb-6 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Logged in as</p>
            <p className={`font-bold capitalize ${role === 'admin' ? 'text-blue-400' : 'text-amber-500'}`}>{role} Portal</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive 
                      ? (darkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600') 
                      : (darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600')
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="absolute bottom-0 w-full p-4 border-t border-inherit">
          <button onClick={handleLogout} className="w-full py-2 text-sm text-slate-500 hover:text-red-500 transition-colors">
            Secure Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className={`h-16 flex items-center justify-between px-4 lg:px-8 border-b ${darkMode ? 'bg-slate-900/50 border-slate-800 backdrop-blur-sm' : 'bg-white border-slate-200'} sticky top-0 z-30`}>
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4 p-2 rounded-md hover:bg-slate-800">
              <Menu size={20} />
            </button>
            <h2 className="text-xl font-semibold capitalize">{currentView.replace('-', ' ')}</h2>
          </div>
          
          <div className="flex items-center space-x-4">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-800 text-slate-400">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div className="relative">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${role === 'admin' ? 'bg-blue-600' : 'bg-amber-500'} text-white`}>
              {role === 'admin' ? 'A' : 'C'}
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          {currentView === 'dashboard' && role === 'admin' && <DashboardView photos={photos} files={files} messages={messages} darkMode={darkMode} />}
          {currentView === 'photos' && <PhotosView photos={photos} role={role} onUpload={uploadPhotoMock} darkMode={darkMode} />}
          {currentView === 'messages' && <MessagesView messages={messages} role={role} onSend={addMessage} darkMode={darkMode} user={user} />}
          {currentView === 'files' && <FilesView files={files} role={role} onUpload={uploadFileMock} darkMode={darkMode} />}
          {currentView === 'settings' && <SettingsView darkMode={darkMode} />}
        </div>
      </main>
    </div>
  );
}

// --- View Components ---

function DashboardView({ photos, files, messages, darkMode }) {
  const adminMessages = messages.filter(m => m.portalThread === 'admin');
  const cardBg = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm';

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Project Budget" value="$4.2M / $5.0M" subtext="On track" icon={Activity} color="text-emerald-500" bg={cardBg} />
        <StatCard title="Open RFIs" value="12" subtext="3 urgent" icon={AlertCircle} color="text-amber-500" bg={cardBg} />
        <StatCard title="Unread Messages" value={adminMessages.length} subtext="Admin Portal" icon={MessageSquare} color="text-blue-500" bg={cardBg} />
        <StatCard title="Total Files" value={files.length} subtext="Secure Vault" icon={FileText} color="text-purple-500" bg={cardBg} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gantt / Milestones Placeholder */}
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <h3 className="text-lg font-semibold mb-6 flex items-center"><Clock className="mr-2" size={20}/> Project Timeline & Milestones</h3>
            <div className="space-y-6">
              <MilestoneItem title="Foundation Pour" status="completed" date="Oct 15, 2025" />
              <MilestoneItem title="Structural Steel Erection" status="in-progress" date="Current Phase - 60%" progress={60} />
              <MilestoneItem title="Envelope & Glazing" status="upcoming" date="Dec 01, 2025" />
              <MilestoneItem title="Interior Fit-out" status="upcoming" date="Jan 20, 2026" />
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Recent Photos Mini-Feed */}
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center"><ImageIcon className="mr-2" size={20}/> Recent Site Photos</h3>
            <div className="grid grid-cols-2 gap-2">
              {photos.slice(0, 4).map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden relative group">
                  <img src={photo.url} alt="Site progress" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
              ))}
              {photos.length === 0 && <p className="text-sm text-slate-500 col-span-2">No photos uploaded yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtext, icon: Icon, color, bg }) {
  return (
    <div className={`p-6 rounded-2xl border ${bg} flex flex-col`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <Icon size={24} className={color} />
        </div>
      </div>
      <h4 className="text-slate-500 text-sm font-medium mb-1">{title}</h4>
      <span className="text-2xl font-bold mb-1">{value}</span>
      <span className="text-xs text-slate-400 font-medium">{subtext}</span>
    </div>
  );
}

function MilestoneItem({ title, status, date, progress }) {
  const statusColors = {
    'completed': 'text-emerald-500',
    'in-progress': 'text-blue-500',
    'upcoming': 'text-slate-500'
  };

  return (
    <div className="relative pl-6 border-l-2 border-slate-700 pb-2 last:border-0 last:pb-0">
      <div className={`absolute -left-[9px] top-0 bg-slate-900 rounded-full p-0.5 ${statusColors[status]}`}>
        {status === 'completed' ? <CheckCircle2 size={16} className="bg-emerald-500 text-white rounded-full" /> : <div className={`w-3 h-3 rounded-full border-2 ${status === 'in-progress' ? 'border-blue-500 bg-blue-500' : 'border-slate-500 bg-slate-800'}`}></div>}
      </div>
      <div className="-mt-1.5">
        <h5 className={`font-semibold text-sm ${status === 'upcoming' ? 'text-slate-400' : ''}`}>{title}</h5>
        <p className="text-xs text-slate-500 mt-0.5">{date}</p>
        {status === 'in-progress' && progress && (
          <div className="mt-3 w-full bg-slate-700 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotosView({ photos, role, onUpload, darkMode }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Progress Photos</h2>
          <p className="text-sm text-slate-500">Live feed from the field</p>
        </div>
        {role === 'contractor' && (
          <button onClick={onUpload} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
            <Upload size={18} className="mr-2" /> Upload Photo
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border border-dashed ${darkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
          <Camera size={48} className="mx-auto mb-4 opacity-50" />
          <p>No photos have been uploaded to the live feed yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {photos.map(photo => (
            <div key={photo.id} className={`rounded-xl overflow-hidden border ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <div className="aspect-[4/3] relative">
                <img src={photo.url} alt="Site" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                  <span className="text-white text-xs font-medium flex items-center bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                    {photo.location || "Site Area"}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500 flex justify-between">
                  <span>{photo.createdAt?.toDate().toLocaleDateString() || 'Just now'}</span>
                  <span className="capitalize">{photo.uploaderRole}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessagesView({ messages, role, onSend, darkMode, user }) {
  const [activeTab, setActiveTab] = useState(role === 'admin' ? 'admin' : 'contractor');
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef(null);

  // Filter messages by active tab/portal thread
  const filteredMessages = messages.filter(m => m.portalThread === activeTab);

  const handleSend = (e) => {
    e.preventDefault();
    onSend(newMsg, activeTab);
    setNewMsg("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages]);

  const parseMarkdown = (text) => {
    // Very basic markdown parser for demo (*italic*, **bold**)
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const bgStyle = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className={`flex flex-col h-[calc(100vh-8rem)] rounded-2xl border ${bgStyle} overflow-hidden`}>
      {/* Tabs for Admins */}
      {role === 'admin' && (
        <div className={`flex border-b ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <button 
            onClick={() => setActiveTab('admin')} 
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'admin' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Admin Board
          </button>
          <button 
            onClick={() => setActiveTab('contractor')} 
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'contractor' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Contractor Thread
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No messages in this thread yet. Be the first to post.
          </div>
        ) : (
          filteredMessages.map((msg, i) => {
            const isMe = msg.authorId === user.uid;
            return (
              <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline space-x-2 mb-1 px-1">
                  {!isMe && <span className={`text-xs font-bold capitalize ${msg.authorRole === 'admin' ? 'text-blue-400' : 'text-amber-500'}`}>{msg.authorRole}</span>}
                  <span className="text-[10px] text-slate-500">{msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'Now'}</span>
                </div>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : (darkMode ? 'bg-slate-800 text-slate-200 rounded-bl-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none')}`}>
                  {parseMarkdown(msg.text)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`p-4 border-t ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder={`Type a message in ${activeTab} thread... (*italic*, **bold** supported)`}
            className={`w-full py-3 pl-4 pr-12 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
          />
          <button type="submit" disabled={!newMsg.trim()} className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function FilesView({ files, role, onUpload, darkMode }) {
  const visibleFiles = role === 'admin' ? files : files.filter(f => f.portalAccess !== 'admin');
  
  const handleSimulatedUpload = () => {
    const types = ['PDF', 'DWG', 'DOCX'];
    const names = ['Structural_Plans_Rev2', 'HVAC_Submittal', 'Site_Survey_Report', 'Change_Order_04'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const randomName = names[Math.floor(Math.random() * names.length)] + `.${randomType.toLowerCase()}`;
    onUpload(randomName, randomType);
  };

  const bgStyle = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const headerStyle = darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Document Center</h2>
          <p className="text-sm text-slate-500">Secure, versioned file repository</p>
        </div>
        <button onClick={handleSimulatedUpload} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
          <Upload size={18} className="mr-2" /> Upload File
        </button>
      </div>

      <div className={`rounded-2xl border ${bgStyle} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${headerStyle} border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} text-xs uppercase tracking-wider`}>
                <th className="p-4 font-semibold">File Name</th>
                <th className="p-4 font-semibold">Version</th>
                <th className="p-4 font-semibold">Uploaded By</th>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {visibleFiles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">No files found for your access level.</td>
                </tr>
              ) : (
                visibleFiles.map(file => (
                  <tr key={file.id} className={`transition-colors ${darkMode ? 'hover:bg-slate-800/50 divide-slate-800' : 'hover:bg-slate-50 divide-slate-200 border-b'}`}>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <FileText size={20} className={file.type === 'PDF' ? 'text-red-400' : 'text-blue-400'} />
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-slate-500">{file.size}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm"><span className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs">{file.version}</span></td>
                    <td className="p-4 text-sm capitalize">{file.uploadedBy}</td>
                    <td className="p-4 text-sm text-slate-500">{file.createdAt?.toDate().toLocaleDateString() || 'Today'}</td>
                    <td className="p-4 text-right">
                      <button className="text-blue-500 hover:text-blue-400 p-2">
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ darkMode }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [twoFactor, setTwoFactor] = useState(true);

  const cardStyle = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Security & Preferences</h2>
        <p className="text-sm text-slate-500">Manage your portal experience</p>
      </div>

      <div className={`p-6 rounded-2xl border ${cardStyle} space-y-6`}>
        <h3 className="text-lg font-semibold border-b border-inherit pb-4">Notifications</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-xs text-slate-500">Real-time alerts for messages and uploads (via FCM)</p>
          </div>
          <button 
            onClick={() => setPushEnabled(!pushEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${pushEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pushEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Email Digests</p>
            <p className="text-xs text-slate-500">Daily summary of portal activity (via SendGrid)</p>
          </div>
          <button 
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${emailEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${emailEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border ${cardStyle} space-y-6`}>
        <h3 className="text-lg font-semibold border-b border-inherit pb-4 text-red-400">Security</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Two-Factor Authentication (2FA)</p>
            <p className="text-xs text-slate-500">Require SMS/Email code on login</p>
          </div>
          <button 
            onClick={() => setTwoFactor(!twoFactor)}
            className={`w-12 h-6 rounded-full transition-colors relative ${twoFactor ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${twoFactor ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

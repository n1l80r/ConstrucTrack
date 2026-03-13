import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  LayoutDashboard, Image as ImageIcon, MessageSquare, FolderKanban, 
  Settings, Bell, Search, Menu, X, Upload, ShieldCheck, 
  Users, HardHat, FileText, ChevronRight, Activity, Clock, 
  CheckCircle2, AlertCircle, Download, Camera, Send, Edit3, Save, Plus, Trash2
} from 'lucide-react';

// --- Firebase Initialization (Using Your Keys) ---
const firebaseConfig = {
  apiKey: "AIzaSyBdpQP96Hs4meZUeaeur8ycKjHH0rdIoV8",
  authDomain: "nmic-3dd2b.firebaseapp.com",
  projectId: "nmic-3dd2b",
  storageBucket: "nmic-3dd2b.firebasestorage.app",
  messagingSenderId: "106336344530",
  appId: "1:106336344530:web:76fbae7c51aa2bd2fb500b",
  measurementId: "G-TG9J09PZ9H"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
<<<<<<< HEAD
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
=======
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
>>>>>>> cf71e09bf74e9ed51bbd745c379143414b324f3d

// Default Dashboard Data (Fallback if database is empty)
const DEFAULT_PROJECT_INFO = {
  budget: "$4.2M",
  budgetTotal: "$5.0M",
  openRFIs: "12",
  rfiSubtext: "3 urgent",
  milestones: [
    { id: 1, title: "Foundation Pour", status: "completed", date: "Oct 15, 2025", progress: 100 },
    { id: 2, title: "Structural Steel Erection", status: "in-progress", date: "Current Phase - 60%", progress: 60 },
    { id: 3, title: "Envelope & Glazing", status: "upcoming", date: "Dec 01, 2025", progress: 0 }
  ]
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' or 'contractor'
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Login State
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
  const [projectInfo, setProjectInfo] = useState(DEFAULT_PROJECT_INFO);
  const [notifications, setNotifications] = useState([]);

  // 1. Auth & Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching (Guarded by user)
  useEffect(() => {
    if (!user || !is2FAVerified || !role) return;

    // References to Root Collections
    const photosRef = collection(db, 'photos');
    const messagesRef = collection(db, 'messages');
    const filesRef = collection(db, 'files');
    const projectInfoRef = doc(db, 'project_info', 'main');

    // Subscribe to Data
    const unsubPhotos = onSnapshot(photosRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setPhotos(data);
    });

    const unsubMessages = onSnapshot(messagesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMessages(data);
    });

    const unsubFiles = onSnapshot(filesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setFiles(data);
    });

    const unsubProjectInfo = onSnapshot(projectInfoRef, (docSnap) => {
      if (docSnap.exists()) {
        setProjectInfo(docSnap.data());
      } else {
        // If it doesn't exist yet, save the defaults to the database
        setDoc(projectInfoRef, DEFAULT_PROJECT_INFO);
      }
    });

    return () => {
      unsubPhotos();
      unsubMessages();
      unsubFiles();
      unsubProjectInfo();
    };
  }, [user, is2FAVerified, role]);

  const triggerNotification = (title, message) => {
    const newNotif = { id: Date.now(), title, message };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNotif.id)), 4000);
  };

  // --- Handlers ---
  const handleRealLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setRole(userData.role); 
        
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

  const handleLogout = async () => {
    await signOut(auth);
    setRole(null);
    setIs2FAVerified(false);
    setCurrentView('dashboard');
  };

  // --- REAL DATA MUTATIONS ---
  const saveProjectInfo = async (newInfo) => {
    try {
      await setDoc(doc(db, 'project_info', 'main'), newInfo);
      triggerNotification("Success", "Dashboard has been updated live.");
    } catch (err) {
      console.error("Error saving dashboard:", err);
      triggerNotification("Error", "Could not save dashboard data.");
    }
  };

  const addMessage = async (text, portalThread) => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, 'messages'), {
        text,
        authorId: user.uid,
        authorEmail: user.email || 'Unknown User', // Added Email Tagging
        authorRole: role,
        portalThread, 
        createdAt: serverTimestamp()
      });
      triggerNotification("Message Sent", `Posted to ${portalThread} board.`);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const uploadRealPhoto = async (file) => {
    try {
      const storageRef = ref(storage, `photos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'photos'), {
        url: downloadUrl,
        uploadedBy: user.uid,
        uploaderRole: role,
        location: "Site Upload",
        createdAt: serverTimestamp()
      });
      triggerNotification("Photo Uploaded", "Successfully synced.");
    } catch (err) {
      console.error("Error uploading photo:", err);
      triggerNotification("Error", "Failed to upload photo.");
    }
  };

  const uploadRealFile = async (file) => {
    try {
      const storageRef = ref(storage, `files/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      const fileExt = file.name.split('.').pop().toUpperCase();

      await addDoc(collection(db, 'files'), {
        name: file.name,
        type: fileExt,
        size: fileSizeMB,
        uploadedBy: role,
        portalAccess: role === 'admin' ? 'admin' : 'contractor',
        version: "v1.0",
        downloadUrl: downloadUrl,
        createdAt: serverTimestamp()
      });
      triggerNotification("File Uploaded", `${file.name} secured.`);
    } catch (err) {
      console.error("Error uploading file:", err);
      triggerNotification("Error", "Failed to upload file.");
    }
  };


  // --- Render Helpers ---
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Initializing Secure Environment...</div>;
  }

  // --- Login Screen ---
  if (!role || !is2FAVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-xl"><HardHat size={40} className="text-white" /></div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">ConstrucTrack</h1>
          <p className="text-slate-400 text-center mb-8">Enterprise Project Portal</p>

          {!role ? (
            <form onSubmit={handleRealLogin} className="space-y-4">
              {loginError && <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm text-center">{loginError}</div>}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Email Address" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Password" />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors">Secure Login</button>
            </form>
          ) : (
            <div className="text-center space-y-6 animate-pulse">
              <ShieldCheck size={48} className="mx-auto text-green-400" />
              <div>
                <h3 className="text-xl font-bold text-white">Verifying Identity...</h3>
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
            <div><p className="font-bold text-sm">{notif.title}</p><p className="text-xs opacity-90">{notif.message}</p></div>
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
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X size={20} /></button>
        </div>
        
        <div className="p-4">
          <div className={`px-4 py-3 rounded-lg mb-6 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Logged in as</p>
            <p className={`font-bold capitalize ${role === 'admin' ? 'text-blue-400' : 'text-amber-500'}`}>{role} Portal</p>
            <p className="text-[10px] text-slate-500 mt-1 truncate">{user.email}</p>
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
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${role === 'admin' ? 'bg-blue-600' : 'bg-amber-500'} text-white`}>
              {role === 'admin' ? 'A' : 'C'}
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          {currentView === 'dashboard' && role === 'admin' && <DashboardView photos={photos} files={files} messages={messages} projectInfo={projectInfo} onSave={saveProjectInfo} darkMode={darkMode} />}
          {currentView === 'photos' && <PhotosView photos={photos} role={role} onUpload={uploadRealPhoto} darkMode={darkMode} />}
          {currentView === 'messages' && <MessagesView messages={messages} role={role} onSend={addMessage} darkMode={darkMode} user={user} />}
          {currentView === 'files' && <FilesView files={files} role={role} onUpload={uploadRealFile} darkMode={darkMode} />}
          {currentView === 'settings' && <SettingsView darkMode={darkMode} />}
        </div>
      </main>
    </div>
  );
}

// --- View Components ---

function DashboardView({ photos, files, messages, projectInfo, onSave, darkMode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(projectInfo);

  // Sync state if projectInfo updates externally
  useEffect(() => { setEditData(projectInfo); }, [projectInfo]);

  const adminMessages = messages.filter(m => m.portalThread === 'admin');
  const cardBg = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const inputBg = darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900';

  const handleSave = () => {
    onSave(editData);
    setIsEditing(false);
  };

  const updateMilestone = (id, field, value) => {
    const updated = editData.milestones.map(m => m.id === id ? { ...m, [field]: value } : m);
    setEditData({ ...editData, milestones: updated });
  };

  const addMilestone = () => {
    const newMilestone = { id: Date.now(), title: "New Phase", status: "upcoming", date: "TBD", progress: 0 };
    setEditData({ ...editData, milestones: [...editData.milestones, newMilestone] });
  };

  const removeMilestone = (id) => {
    setEditData({ ...editData, milestones: editData.milestones.filter(m => m.id !== id) });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Admin Overview</h2>
        {isEditing ? (
          <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
            <Save size={18} className="mr-2" /> Save Changes
          </button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
            <Edit3 size={18} className="mr-2" /> Edit Dashboard
          </button>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isEditing ? (
          <div className={`p-6 rounded-2xl border ${cardBg} flex flex-col space-y-2`}>
            <h4 className="text-slate-500 text-sm font-medium">Edit Budget</h4>
            <input type="text" value={editData.budget} onChange={e => setEditData({...editData, budget: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Spent (e.g. $4.2M)" />
            <input type="text" value={editData.budgetTotal} onChange={e => setEditData({...editData, budgetTotal: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Total (e.g. $5.0M)" />
          </div>
        ) : (
          <StatCard title="Project Budget" value={`${projectInfo.budget} / ${projectInfo.budgetTotal}`} subtext="On track" icon={Activity} color="text-emerald-500" bg={cardBg} />
        )}

        {isEditing ? (
          <div className={`p-6 rounded-2xl border ${cardBg} flex flex-col space-y-2`}>
            <h4 className="text-slate-500 text-sm font-medium">Edit RFIs</h4>
            <input type="text" value={editData.openRFIs} onChange={e => setEditData({...editData, openRFIs: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Number (e.g. 12)" />
            <input type="text" value={editData.rfiSubtext} onChange={e => setEditData({...editData, rfiSubtext: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Subtext (e.g. 3 urgent)" />
          </div>
        ) : (
          <StatCard title="Open RFIs" value={projectInfo.openRFIs} subtext={projectInfo.rfiSubtext} icon={AlertCircle} color="text-amber-500" bg={cardBg} />
        )}

        <StatCard title="Unread Messages" value={adminMessages.length} subtext="Admin Portal" icon={MessageSquare} color="text-blue-500" bg={cardBg} />
        <StatCard title="Total Files" value={files.length} subtext="Secure Vault" icon={FileText} color="text-purple-500" bg={cardBg} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold flex items-center"><Clock className="mr-2" size={20}/> Project Timeline & Milestones</h3>
              {isEditing && <button onClick={addMilestone} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center"><Plus size={16} className="mr-1"/> Add Phase</button>}
            </div>
            
            <div className="space-y-6">
              {(isEditing ? editData.milestones : projectInfo.milestones).map((m, index) => (
                isEditing ? (
                  <div key={m.id} className={`p-4 rounded-xl border border-dashed ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-300 bg-slate-50'} flex flex-col md:flex-row gap-3`}>
                    <div className="flex-1 space-y-2">
                      <input type="text" value={m.title} onChange={e => updateMilestone(m.id, 'title', e.target.value)} className={`w-full p-2 text-sm rounded border ${inputBg}`} placeholder="Phase Title" />
                      <input type="text" value={m.date} onChange={e => updateMilestone(m.id, 'date', e.target.value)} className={`w-full p-2 text-sm rounded border ${inputBg}`} placeholder="Date / Timeline" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <select value={m.status} onChange={e => updateMilestone(m.id, 'status', e.target.value)} className={`w-full p-2 text-sm rounded border ${inputBg}`}>
                        <option value="completed">Completed</option>
                        <option value="in-progress">In Progress</option>
                        <option value="upcoming">Upcoming</option>
                      </select>
                      {m.status === 'in-progress' && (
                        <input type="number" value={m.progress} onChange={e => updateMilestone(m.id, 'progress', e.target.value)} className={`w-full p-2 text-sm rounded border ${inputBg}`} placeholder="Progress % (e.g. 60)" />
                      )}
                    </div>
                    <button onClick={() => removeMilestone(m.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg self-start"><Trash2 size={20}/></button>
                  </div>
                ) : (
                  <MilestoneItem key={m.id} title={m.title} status={m.status} date={m.date} progress={m.progress} />
                )
              ))}
              {!isEditing && projectInfo.milestones.length === 0 && <p className="text-slate-500 text-sm">No milestones configured.</p>}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center"><ImageIcon className="mr-2" size={20}/> Recent Site Photos</h3>
            <div className="grid grid-cols-2 gap-2">
              {photos.slice(0, 4).map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden relative group">
                  <img src={photo.url} alt="Site progress" className="w-full h-full object-cover" />
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
        <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')}`}><Icon size={24} className={color} /></div>
      </div>
      <h4 className="text-slate-500 text-sm font-medium mb-1">{title}</h4>
      <span className="text-2xl font-bold mb-1">{value}</span>
      <span className="text-xs text-slate-400 font-medium">{subtext}</span>
    </div>
  );
}

function MilestoneItem({ title, status, date, progress }) {
  const statusColors = { 'completed': 'text-emerald-500', 'in-progress': 'text-blue-500', 'upcoming': 'text-slate-500' };
  return (
    <div className="relative pl-6 border-l-2 border-slate-700 pb-2 last:border-0 last:pb-0">
      <div className={`absolute -left-[9px] top-0 bg-slate-900 rounded-full p-0.5 ${statusColors[status]}`}>
        {status === 'completed' ? <CheckCircle2 size={16} className="bg-emerald-500 text-white rounded-full" /> : <div className={`w-3 h-3 rounded-full border-2 ${status === 'in-progress' ? 'border-blue-500 bg-blue-500' : 'border-slate-500 bg-slate-800'}`}></div>}
      </div>
      <div className="-mt-1.5">
        <h5 className={`font-semibold text-sm ${status === 'upcoming' ? 'text-slate-400' : ''}`}>{title}</h5>
        <p className="text-xs text-slate-500 mt-0.5">{date}</p>
        {status === 'in-progress' && progress > 0 && (
          <div className="mt-3 w-full bg-slate-700 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
        )}
      </div>
    </div>
  );
}

function PhotosView({ photos, role, onUpload, darkMode }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    await onUpload(file);
    setIsUploading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Progress Photos</h2>
          <p className="text-sm text-slate-500">Live feed from the field</p>
        </div>
        {role === 'contractor' && (
          <>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current.click()} disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50">
              {isUploading ? "Uploading..." : <><Upload size={18} className="mr-2" /> Upload Photo</>}
            </button>
          </>
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
                <a href={photo.url} target="_blank" rel="noopener noreferrer">
                  <img src={photo.url} alt="Site" className="absolute inset-0 w-full h-full object-cover hover:opacity-90 transition-opacity" />
                </a>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500 flex justify-between">
                  <span>{photo.createdAt?.toDate().toLocaleDateString() || 'Just now'}</span>
                  <span className="capitalize font-medium">{photo.uploaderRole}</span>
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

  const filteredMessages = messages.filter(m => m.portalThread === activeTab);

  const handleSend = (e) => {
    e.preventDefault();
    onSend(newMsg, activeTab);
    setNewMsg("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages]);

  const bgStyle = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  // Format date nicely (e.g. "Mar 13 at 2:30 PM")
  const formatTimestamp = (fbTimestamp) => {
    if (!fbTimestamp) return 'Sending...';
    const date = fbTimestamp.toDate();
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-8rem)] rounded-2xl border ${bgStyle} overflow-hidden`}>
      {/* Tabs for Admins */}
      {role === 'admin' && (
        <div className={`flex border-b ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <button onClick={() => setActiveTab('admin')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'admin' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>Admin Board</button>
          <button onClick={() => setActiveTab('contractor')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'contractor' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>Contractor Thread</button>
        </div>
      )}

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">No messages yet. Be the first to post!</div>
        ) : (
          filteredMessages.map((msg, i) => {
            const isMe = msg.authorId === user.uid;
            return (
              <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Meta Data: Role, Email, Timestamp */}
                <div className={`flex items-baseline space-x-2 mb-1 px-1 ${isMe ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                  {!isMe && <span className={`text-xs font-bold capitalize ${msg.authorRole === 'admin' ? 'text-blue-400' : 'text-amber-500'}`}>{msg.authorRole}</span>}
                  <span className="text-xs text-slate-400 font-medium">{isMe ? 'You' : msg.authorEmail}</span>
                  <span className="text-[10px] text-slate-500">{formatTimestamp(msg.createdAt)}</span>
                </div>
                
                {/* Message Bubble */}
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : (darkMode ? 'bg-slate-800 text-slate-200 rounded-bl-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm')}`}>
                  {msg.text}
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
            placeholder={`Type a message in ${activeTab} thread...`}
            className={`w-full py-3 pl-4 pr-12 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
          />
          <button type="submit" disabled={!newMsg.trim()} className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function FilesView({ files, role, onUpload, darkMode }) {
  const visibleFiles = role === 'admin' ? files : files.filter(f => f.portalAccess !== 'admin');
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    await onUpload(file);
    setIsUploading(false);
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
        <div>
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current.click()} disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50">
            {isUploading ? "Uploading..." : <><Upload size={18} className="mr-2" /> Upload File</>}
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border ${bgStyle} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${headerStyle} border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} text-xs uppercase tracking-wider`}>
                <th className="p-4 font-semibold">File Name</th>
                <th className="p-4 font-semibold">Size</th>
                <th className="p-4 font-semibold">Uploaded By</th>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {visibleFiles.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">No files uploaded yet.</td></tr>
              ) : (
                visibleFiles.map(file => (
                  <tr key={file.id} className={`transition-colors ${darkMode ? 'hover:bg-slate-800/50 divide-slate-800' : 'hover:bg-slate-50 divide-slate-200 border-b'}`}>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <FileText size={20} className={file.type === 'PDF' ? 'text-red-400' : 'text-blue-400'} />
                        <div><p className="font-medium text-sm">{file.name}</p></div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{file.size}</td>
                    <td className="p-4 text-sm capitalize">{file.uploadedBy}</td>
                    <td className="p-4 text-sm text-slate-500">{file.createdAt?.toDate().toLocaleDateString() || 'Today'}</td>
                    <td className="p-4 text-right">
                      {file.downloadUrl && (
                        <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-blue-500 hover:text-blue-400 p-2">
                          <Download size={18} />
                        </a>
                      )}
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
          <div><p className="font-medium">Push Notifications</p><p className="text-xs text-slate-500">Real-time alerts for messages and uploads (via FCM)</p></div>
          <button onClick={() => setPushEnabled(!pushEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${pushEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pushEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div><p className="font-medium">Email Digests</p><p className="text-xs text-slate-500">Daily summary of portal activity (via SendGrid)</p></div>
          <button onClick={() => setEmailEnabled(!emailEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${emailEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${emailEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border ${cardStyle} space-y-6`}>
        <h3 className="text-lg font-semibold border-b border-inherit pb-4 text-red-400">Security</h3>
        
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Two-Factor Authentication (2FA)</p><p className="text-xs text-slate-500">Require SMS/Email code on login</p></div>
          <button onClick={() => setTwoFactor(!twoFactor)} className={`w-12 h-6 rounded-full transition-colors relative ${twoFactor ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${twoFactor ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
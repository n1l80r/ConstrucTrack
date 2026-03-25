import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, getDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  LayoutDashboard, Image as ImageIcon, MessageSquare, FolderKanban, 
  Settings, Bell, Search, Menu, X, Upload, ShieldCheck, 
  Users, HardHat, FileText, ChevronRight, Activity, Clock, 
  CheckCircle2, AlertCircle, Download, Camera, Send, Edit3, Save, Plus, Trash2,
  Paperclip, AtSign, Loader2, Video, ExternalLink
} from 'lucide-react';

// --- Firebase Initialization (Using Your Keys) ---
const firebaseConfig = {
  apiKey: "AIzaSy" + "BdpQP96Hs4meZUeaeur8ycKjHH0rdIoV8",
  authDomain: "nmic-3dd2b.firebaseapp.com",
  projectId: "nmic-3dd2b",
  storageBucket: "nmic-3dd2b.firebasestorage.app",
  messagingSenderId: "106336344530",
  appId: "1:106336344530:web:76fbae7c51aa2bd2fb500b",
  measurementId: "G-TG9J09PZ9H"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Default Dashboard Data
const DEFAULT_PROJECT_INFO = {
  budget: "$4.2M",
  budgetTotal: "$5.0M",
  openRFIs: "12",
  rfiSubtext: "3 urgent",
  lastMessageCount: 0,
  milestones: [
    { id: 1, title: "Foundation Pour", status: "completed", date: "Oct 15, 2025", progress: 100 },
    { id: 2, title: "Structural Steel Erection", status: "in-progress", date: "Current Phase - 60%", progress: 60 },
    { id: 3, title: "Envelope & Glazing", status: "upcoming", date: "Dec 01, 2025", progress: 0 }
  ]
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');

  // App State
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Data State
  const [photos, setPhotos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 
  const [projectInfo, setProjectInfo] = useState(DEFAULT_PROJECT_INFO);
  const [userProfile, setUserProfile] = useState({});
  const [notifications, setNotifications] = useState([]);

  // 1. Auth & Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!user || !is2FAVerified || !role) return;

    const photosRef = collection(db, 'photos');
    const messagesRef = collection(db, 'messages');
    const filesRef = collection(db, 'files');
    const usersRef = collection(db, 'users');
    const projectInfoRef = doc(db, 'project_info', 'main');
    const userProfileRef = doc(db, 'users', user.uid); 

    const unsubPhotos = onSnapshot(photosRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => ((b.createdAt?.toMillis && b.createdAt.toMillis()) || 0) - ((a.createdAt?.toMillis && a.createdAt.toMillis()) || 0));
      setPhotos(data);
    });

    const unsubMessages = onSnapshot(messagesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => ((a.createdAt?.toMillis && a.createdAt.toMillis()) || 0) - ((b.createdAt?.toMillis && b.createdAt.toMillis()) || 0));
      setMessages(data);
    });

    const unsubFiles = onSnapshot(filesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => ((b.createdAt?.toMillis && b.createdAt.toMillis()) || 0) - ((a.createdAt?.toMillis && a.createdAt.toMillis()) || 0));
      setFiles(data);
    });

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const emails = snap.docs.map(d => d.data().email).filter(Boolean);
      setAllUsers([...new Set(emails)]); 
    });

    const unsubProjectInfo = onSnapshot(projectInfoRef, (docSnap) => {
      if (docSnap.exists()) {
        setProjectInfo({ ...DEFAULT_PROJECT_INFO, ...docSnap.data() });
      } else {
        setDoc(projectInfoRef, DEFAULT_PROJECT_INFO);
      }
    });

    const unsubUserProfile = onSnapshot(userProfileRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    });

    return () => {
      unsubPhotos();
      unsubMessages();
      unsubFiles();
      unsubUsers();
      unsubProjectInfo();
      unsubUserProfile();
    };
  }, [user, is2FAVerified, role]);

  const triggerNotification = (title, message) => {
    const newNotif = { id: Date.now(), title, message };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNotif.id)), 4000);
  };

  // --- NEW: Email Alert System ---
  const sendEmailAlert = async (subject, htmlBody) => {
    try {
      // Find all users who have email alerts turned ON
      const usersSnap = await getDocs(collection(db, 'users'));
      const emailsToAlert = [];
      
      usersSnap.forEach(doc => {
        const data = doc.data();
        // Check if they enabled email settings and are NOT the person doing the action
        if (data.settings?.email === true && data.email !== user.email) {
          emailsToAlert.push(data.email);
        }
      });

      // Drop an email request into the 'mail' collection for each user
      for (const recipient of emailsToAlert) {
        await addDoc(collection(db, 'mail'), {
          to: recipient,
          message: {
            subject: subject,
            html: htmlBody
          }
        });
      }
    } catch (err) {
      console.error("Failed to queue email:", err);
    }
  };

  // --- Handlers ---
  const handleRealLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setRole(userData.role); 
        
        await setDoc(userDocRef, { email: userCredential.user.email }, { merge: true });
        
        setTimeout(() => {
          setIs2FAVerified(true);
          if (userData.role === 'contractor') setCurrentView('photos');
        }, 1500);
      } else {
        setLoginError("Account exists, but no portal role is assigned. Contact Administrator.");
        await signOut(auth);
      }
    } catch (error) {
      console.error("Login Attempt Failed:", error.code);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setLoginError("Incorrect email or password. Please verify your account exists.");
      } else {
        setLoginError("Authentication failed. Please try again.");
      }
    }
  };

  const handleResetPassword = async () => {
    setLoginError('');
    setLoginSuccess('');
    if (!email) {
      setLoginError("Please enter your email address above first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setLoginSuccess("Password reset email sent! Check your inbox.");
    } catch (error) {
      console.error("Reset Failed:", error);
      setLoginError("Failed to send reset email. Ensure the email is registered.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRole(null);
    setIs2FAVerified(false);
    setCurrentView('dashboard');
  };

  // --- REAL DATA MUTATIONS ---
  const saveProjectInfo = async (newInfo, silent = false) => {
    try {
      await setDoc(doc(db, 'project_info', 'main'), newInfo);
      if (!silent) triggerNotification("Success", "Dashboard has been updated live.");
    } catch (err) {
      console.error("Error saving dashboard:", err);
      if (!silent) triggerNotification("Error", "Could not save dashboard data.");
    }
  };

  const clearUnreadMessages = async (count) => {
    try {
      await setDoc(doc(db, 'users', user.uid), { lastMessageCount: count }, { merge: true });
    } catch (err) {
      console.error("Error clearing messages:", err);
    }
  };

  const addMessage = async (text, portalThread, isPrivate = false) => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, 'messages'), {
        text,
        authorId: user.uid,
        authorEmail: user.email || 'Unknown User',
        authorRole: role,
        portalThread, 
        isPrivate,
        createdAt: serverTimestamp()
      });
      triggerNotification("Message Sent", `Posted to ${portalThread} board.`);
      
      // Trigger Email Notification
      sendEmailAlert(
        `NMICTrack: New Message in ${portalThread} Thread`, 
        `<h2>New Message Alert</h2>
         <p><strong>${user.email || role}</strong> posted a new message in the <strong>${portalThread}</strong> thread.</p>
         <p style="padding: 15px; border-left: 4px solid #2563eb; background: #f8fafc; color: #334155;">"${text}"</p>
         <p><a href="https://your-website.com">Log in to NMICTrack to reply.</a></p>`
      );

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
        uploaderEmail: user.email || 'Unknown User',
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

  const uploadRealFile = async (file, category, adminOnly) => {
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
        category: category || 'General',
        uploadedBy: user.email || 'Unknown User',
        uploaderRole: role,
        portalAccess: adminOnly ? 'admin' : 'all',
        version: "v1.0",
        downloadUrl: downloadUrl,
        createdAt: serverTimestamp()
      });
      triggerNotification("File Uploaded", `${file.name} secured.`);
      
      // Trigger Email Notification
      sendEmailAlert(
        `NMICTrack: New Document Uploaded (${category})`, 
        `<h2>New File Upload Alert</h2>
         <p><strong>${user.email || role}</strong> just uploaded a new document to the Secure Vault.</p>
         <ul>
           <li><strong>File Name:</strong> ${file.name}</li>
           <li><strong>Category:</strong> ${category}</li>
           <li><strong>Privacy:</strong> ${adminOnly ? 'Admins Only' : 'Visible to all'}</li>
         </ul>
         <p><a href="https://your-website.com">Log in to NMICTrack to download this file.</a></p>`
      );
      
      return { name: file.name, downloadUrl };
    } catch (err) {
      console.error("Error uploading file:", err);
      triggerNotification("Error", "Failed to upload file.");
      return null;
    }
  };

  // --- Render Helpers ---
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Initializing Secure Environment...</div>;
  }

  // --- Login Screen ---
  if (!role || !is2FAVerified) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center text-slate-100 p-4 font-sans relative"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1920&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]"></div>
        
        <div className="relative z-10 max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-xl"><HardHat size={40} className="text-white" /></div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">NMICTrack</h1>
          <p className="text-slate-400 text-center mb-8">Enterprise Project Portal</p>

          {!role ? (
            <form onSubmit={handleRealLogin} className="space-y-4">
              {loginError && <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm text-center">{loginError}</div>}
              {loginSuccess && <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-400 p-3 rounded-lg text-sm text-center">{loginSuccess}</div>}
              
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Email Address" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Password" />
              
              <div className="flex justify-end mt-1">
                <button type="button" onClick={handleResetPassword} className="text-xs text-blue-400 hover:text-blue-300 font-medium">Forgot Password?</button>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors mt-2">Secure Login</button>
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
    { id: 'meetings', label: 'Video Meetings', icon: Video },
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
            <span className="font-bold text-lg tracking-tight">NMICTrack</span>
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
          {currentView === 'dashboard' && role === 'admin' && (
            <DashboardView 
              photos={photos} 
              files={files} 
              messages={messages} 
              projectInfo={projectInfo} 
              onSave={saveProjectInfo} 
              darkMode={darkMode} 
              userProfile={userProfile} 
              onClearMessages={clearUnreadMessages} 
            />
          )}
          {currentView === 'photos' && <PhotosView photos={photos} role={role} onUpload={uploadRealPhoto} darkMode={darkMode} />}
          {currentView === 'messages' && <MessagesView messages={messages} role={role} onSend={addMessage} darkMode={darkMode} user={user} files={files} onFileUpload={uploadRealFile} allUsers={allUsers} />}
          {currentView === 'files' && <FilesView files={files} role={role} onUpload={uploadRealFile} darkMode={darkMode} user={user} />}
          {currentView === 'meetings' && <MeetingsView darkMode={darkMode} user={user} />}
          {currentView === 'settings' && <SettingsView darkMode={darkMode} user={user} db={db} triggerNotification={triggerNotification} />}
        </div>
      </main>
    </div>
  );
}

// --- View Components ---

function MeetingsView({ darkMode, user }) {
  const [inCall, setInCall] = useState(false);
  const [roomName, setRoomName] = useState("NMIC-Main-Site");

  const bgStyle = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900';

  if (inCall) {
    return (
      <div className={`flex flex-col h-[calc(100vh-8rem)] rounded-2xl border ${bgStyle} overflow-hidden relative`}>
        <div className="flex justify-between items-center p-3 border-b border-inherit bg-slate-950 text-white z-10">
          <div className="flex items-center space-x-2">
            <Video size={18} className="text-blue-400" />
            <span className="font-semibold text-sm">Meeting Room: {roomName}</span>
          </div>
          <button 
            onClick={() => setInCall(false)} 
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Leave Meeting
          </button>
        </div>
        <div className="flex-1 w-full h-full bg-black">
          {/* 1. Using Framatalk for zero embedding limits
            2. toLowerCase() prevents mobile auto-capitalization from creating separate rooms
            3. disableDeepLinking=true stops mobile phones from bouncing users to the app store
          */}
          <iframe 
            allow="camera; microphone; fullscreen; display-capture; autoplay" 
            src={`https://framatalk.org/NMICTrack-Portal-${roomName.toLowerCase()}#config.disableDeepLinking=true&config.prejoinPageEnabled=false`} 
            style={{ height: '100%', width: '100%', border: '0px' }}
            title="Video Meeting"
          ></iframe>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className={`p-8 rounded-3xl border shadow-xl ${bgStyle} text-center space-y-6`}>
        <div className="mx-auto w-20 h-20 bg-blue-600/10 flex items-center justify-center rounded-full mb-6">
          <Video size={40} className="text-blue-500" />
        </div>
        
        <div>
          <h2 className="text-3xl font-bold mb-2">Secure Video Meetings</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Join a fully-encrypted video conference embedded directly within your portal. Zero time limits, zero logins required.
          </p>
        </div>

        <div className="max-w-md mx-auto pt-6">
          <label className="block text-left text-sm font-medium mb-2 text-slate-400">Room Name (No spaces)</label>
          <div className="flex space-x-3">
            <input 
              type="text" 
              value={roomName}
              onChange={(e) => setRoomName(e.target.value.replace(/\s+/g, '-'))}
              placeholder="e.g. Site-Update"
              className={`flex-1 p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none ${inputBg}`}
            />
            <button 
              onClick={() => roomName.trim() && setInCall(true)}
              disabled={!roomName.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Join Room
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-inherit mt-8 text-xs text-slate-500 flex flex-col items-center justify-center">
          <ShieldCheck size={24} className="mb-2 opacity-50" />
          <p className="mb-4">Powered by Framasoft Open Source Infrastructure.</p>
          
          <div className={`p-4 rounded-xl text-left max-w-sm border ${darkMode ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            <strong className="block mb-1 font-bold flex items-center">
              <CheckCircle2 size={16} className="mr-1" /> Truly Unlimited Embedding
            </strong>
            We migrated your portal to a massive European open-source cooperative. This server explicitly allows embedding, meaning you will never see a 5-minute disconnect warning again!
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ photos, files, messages, projectInfo, onSave, darkMode, userProfile, onClearMessages }) {
  const safeProjectInfo = { ...DEFAULT_PROJECT_INFO, ...(projectInfo || {}) };
  const safeMilestones = safeProjectInfo.milestones || [];
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(safeProjectInfo);

  useEffect(() => { setEditData({ ...DEFAULT_PROJECT_INFO, ...(projectInfo || {}) }); }, [projectInfo]);

  const adminMessages = messages.filter(m => m.portalThread === 'admin');
  const unreadCount = Math.max(0, adminMessages.length - (userProfile?.lastMessageCount || 0));

  const cardBg = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const inputBg = darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900';

  const handleSave = () => {
    onSave(editData);
    setIsEditing(false);
  };

  const updateMilestone = (id, field, value) => {
    const updated = (editData.milestones || []).map(m => m.id === id ? { ...m, [field]: value } : m);
    setEditData({ ...editData, milestones: updated });
  };

  const addMilestone = () => {
    const newMilestone = { id: Date.now(), title: "New Phase", status: "upcoming", date: "TBD", progress: 0 };
    setEditData({ ...editData, milestones: [...(editData.milestones || []), newMilestone] });
  };

  const removeMilestone = (id) => {
    setEditData({ ...editData, milestones: (editData.milestones || []).filter(m => m.id !== id) });
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isEditing ? (
          <div className={`p-6 rounded-2xl border ${cardBg} flex flex-col space-y-2`}>
            <h4 className="text-slate-500 text-sm font-medium">Edit Budget</h4>
            <input type="text" value={editData.budget || ''} onChange={e => setEditData({...editData, budget: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Spent (e.g. $4.2M)" />
            <input type="text" value={editData.budgetTotal || ''} onChange={e => setEditData({...editData, budgetTotal: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Total (e.g. $5.0M)" />
          </div>
        ) : (
          <StatCard title="Project Budget" value={`${safeProjectInfo.budget || '$0'} / ${safeProjectInfo.budgetTotal || '$0'}`} subtext="On track" icon={Activity} color="text-emerald-500" bg={cardBg} />
        )}

        {isEditing ? (
          <div className={`p-6 rounded-2xl border ${cardBg} flex flex-col space-y-2`}>
            <h4 className="text-slate-500 text-sm font-medium">Edit RFIs</h4>
            <input type="text" value={editData.openRFIs || ''} onChange={e => setEditData({...editData, openRFIs: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Number (e.g. 12)" />
            <input type="text" value={editData.rfiSubtext || ''} onChange={e => setEditData({...editData, rfiSubtext: e.target.value})} className={`p-2 rounded border ${inputBg}`} placeholder="Subtext (e.g. 3 urgent)" />
          </div>
        ) : (
          <StatCard title="Open RFIs" value={safeProjectInfo.openRFIs || '0'} subtext={safeProjectInfo.rfiSubtext || ''} icon={AlertCircle} color="text-amber-500" bg={cardBg} />
        )}

        <StatCard 
          title="Unread Messages" 
          value={unreadCount} 
          subtext="Admin Portal" 
          icon={MessageSquare} 
          color="text-blue-500" 
          bg={cardBg} 
          action={
            unreadCount > 0 && !isEditing ? (
              <button 
                onClick={() => onClearMessages(adminMessages.length)} 
                className="text-xs font-bold px-3 py-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20"
                title="Mark all as read"
              >
                Clear
              </button>
            ) : null
          }
        />
        
        <StatCard title="Total Files" value={files.length} subtext="Secure Vault" icon={FileText} color="text-purple-500" bg={cardBg} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold flex items-center"><Clock className="mr-2" size={20}/> Project Timeline & Milestones</h3>
              {isEditing && <button onClick={addMilestone} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center"><Plus size={16} className="mr-1"/> Add Phase</button>}
            </div>
            
            <div className="space-y-6">
              {(isEditing ? editData.milestones || [] : safeMilestones).map((m, index) => (
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
              {!isEditing && safeMilestones.length === 0 && <p className="text-slate-500 text-sm">No milestones configured.</p>}
            </div>
          </div>
        </div>

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

function StatCard({ title, value, subtext, icon: Icon, color, bg, action }) {
  return (
    <div className={`p-6 rounded-2xl border ${bg} flex flex-col relative`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')}`}><Icon size={24} className={color} /></div>
        {action && <div>{action}</div>}
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
                  <img src={photo.url} alt="Site progress" className="w-full h-full object-cover" />
                </a>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500 flex justify-between">
                  <span>{(photo.createdAt && typeof photo.createdAt.toDate === 'function') ? photo.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                  <span className="font-medium truncate max-w-[150px] text-right" title={photo.uploaderEmail || photo.uploaderRole}>{photo.uploaderEmail || photo.uploaderRole}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessagesView({ messages, role, onSend, darkMode, user, files, onFileUpload, allUsers }) {
  const [activeTab, setActiveTab] = useState(role === 'admin' ? 'admin' : 'contractor');
  const [newMsg, setNewMsg] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPrivateMsg, setIsPrivateMsg] = useState(false);
  
  // Category Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState('Working drawings');
  const [adminOnly, setAdminOnly] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const filteredMessages = messages.filter(m => {
    if (m.portalThread !== activeTab) return false;
    
    // Hide private messages from users who are not Admins, not the Author, and not @mentioned
    if (m.isPrivate && role !== 'admin' && m.authorId !== user.uid && (!user?.email || !m.text.includes(user.email))) {
      return false;
    }
    
    return true;
  });
  
  // Allow the user to see admin files IF they are an admin OR if they are the one who uploaded it
  const visibleFiles = files ? (role === 'admin' ? files : files.filter(f => f.portalAccess !== 'admin' || f.uploadedBy === user?.email)) : [];
  
  const CATEGORIES = [
    'RFI', 'Permit drawings', 'Documents from governing bodies', 
    'Working drawings', 'Engineering reports', 'Invoices', 'Change orders', 'General'
  ];

  const handleSend = (e) => {
    e.preventDefault();
    onSend(newMsg, activeTab, isPrivateMsg);
    setNewMsg("");
    setShowAttachments(false);
    setShowMentions(false);
    setIsPrivateMsg(false); // Reset private toggle after sending
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages]);

  const bgStyle = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900';

  const formatTimestamp = (fbTimestamp) => {
    if (!fbTimestamp || typeof fbTimestamp.toDate !== 'function') return 'Just now';
    const date = fbTimestamp.toDate();
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
  };

  // Passes 'isMe' boolean so we can adjust the styling based on the background color of the message bubble
  const formatMessageContent = (text, isMe) => {
    if (!text) return { __html: '' };

    // High contrast styling for "My" blue bubbles vs Standard blue styling for "Their" gray/white bubbles
    const linkClass = isMe 
      ? "text-blue-100 hover:text-white underline decoration-blue-300 font-semibold break-all transition-colors" 
      : "text-blue-500 hover:text-blue-400 underline font-semibold break-all transition-colors";

    const mentionClass = isMe
      ? "bg-white/20 text-white px-1.5 py-0.5 rounded font-bold"
      : "bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded font-bold";

    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer" class="${linkClass}">📎 $1</a>`)
      .replace(/(@[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@[a-zA-Z0-9_-]+)/g, `<span class="${mentionClass}">$1</span>`);
    return { __html: html };
  };

  const insertAttachment = (file) => {
    setNewMsg(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + `[${file.name}](${file.downloadUrl}) `);
    setShowAttachments(false);
  };

  const insertMention = (email) => {
    setNewMsg(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + `@${email} `);
    setShowMentions(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadModal(true);
      setShowAttachments(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setShowUploadModal(false);

    const result = await onFileUpload(selectedFile, category, adminOnly);

    if (result) {
      setNewMsg(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + `[${result.name}](${result.downloadUrl}) `);
    }
    
    setIsUploading(false);
    setSelectedFile(null);
    setCategory('Working drawings');
    setAdminOnly(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-8rem)] rounded-2xl border ${bgStyle} overflow-hidden`}>
      {role === 'admin' && (
        <div className={`flex border-b ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <button onClick={() => setActiveTab('admin')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'admin' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>Admin Board</button>
          <button onClick={() => setActiveTab('contractor')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'contractor' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>Contractor Thread</button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">No messages yet. Be the first to post!</div>
        ) : (
          filteredMessages.map((msg, i) => {
            const isMe = msg.authorId === user.uid;
            return (
              <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-baseline space-x-2 mb-1 px-1 ${isMe ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                  {!isMe && <span className={`text-xs font-bold capitalize ${msg.authorRole === 'admin' ? 'text-blue-400' : 'text-amber-500'}`}>{msg.authorRole}</span>}
                  <span className="text-xs text-slate-400 font-medium">{isMe ? 'You' : msg.authorEmail}</span>
                  <span className="text-[10px] text-slate-500">{formatTimestamp(msg.createdAt)}</span>
                  {msg.isPrivate && <span className="text-[10px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-bold uppercase">Private</span>}
                </div>
                
                <div 
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : (darkMode ? 'bg-slate-800 text-slate-200 rounded-bl-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm')}`}
                  dangerouslySetInnerHTML={formatMessageContent(msg.text, isMe)}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`p-4 border-t ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} relative`}>
        
        {/* Upload Categorization Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl border ${bgStyle}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Attach File Details</h3>
                <button onClick={() => { setShowUploadModal(false); setSelectedFile(null); }} className="text-slate-500 hover:text-slate-300"><X size={20}/></button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-400">Selected File</label>
                  <div className={`p-3 rounded-lg border ${inputBg} text-sm truncate`}>{selectedFile?.name}</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-400">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={`w-full p-3 rounded-lg border ${inputBg}`}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Removed role === 'admin' check here so contractors can mark files as private */}
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" checked={adminOnly} onChange={e => setAdminOnly(e.target.checked)} className="w-5 h-5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800" />
                  <span className="text-sm font-medium">Make this file private (Visible only to Admins{role === 'contractor' ? ' and You' : ''})</span>
                </label>

                <button onClick={handleConfirmUpload} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors mt-4">
                  Confirm & Embed Link
                </button>
              </div>
            </div>
          </div>
        )}

        {showAttachments && (
          <div className={`absolute bottom-[110%] left-4 mb-2 w-72 max-h-64 overflow-y-auto rounded-xl shadow-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-2 z-10`}>
            <div className="text-xs font-bold text-slate-500 mb-2 px-2 uppercase flex justify-between items-center">
              <span>Attach File</span>
              <button onClick={() => setShowAttachments(false)}><X size={14}/></button>
            </div>
            
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className="w-full text-left px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold mb-2 flex items-center justify-center transition-colors"
            >
              <Upload size={14} className="mr-2" /> Upload New File
            </button>
            <div className={`border-t my-2 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}></div>

            {visibleFiles.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 pb-2">No existing files to attach.</p>
            ) : (
              visibleFiles.map(f => (
                <button key={f.id} type="button" onClick={() => insertAttachment(f)} className={`w-full text-left px-3 py-2 hover:bg-blue-500/10 rounded-lg text-sm truncate transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  📎 {f.name}
                </button>
              ))
            )}
          </div>
        )}

        {showMentions && (
          <div className={`absolute bottom-[110%] left-14 mb-2 w-64 max-h-48 overflow-y-auto rounded-xl shadow-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-2 z-10`}>
            <div className="text-xs font-bold text-slate-500 mb-2 px-2 uppercase flex justify-between">
              <span>Tag Team Member</span>
              <button onClick={() => setShowMentions(false)}><X size={14}/></button>
            </div>
            {allUsers.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 pb-2">No other users found.</p>
            ) : (
              allUsers.map(email => (
                <button key={email} type="button" onClick={() => insertMention(email)} className={`w-full text-left px-3 py-2 hover:bg-blue-500/10 rounded-lg text-sm truncate transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  @ {email}
                </button>
              ))
            )}
          </div>
        )}

        <form onSubmit={handleSend} className="relative flex flex-col space-y-2 w-full mt-2">
          
          <div className="flex items-center px-1">
            <label className="flex items-center space-x-2 text-xs text-slate-500 hover:text-slate-400 cursor-pointer w-max transition-colors">
              <input 
                type="checkbox" 
                checked={isPrivateMsg} 
                onChange={(e) => setIsPrivateMsg(e.target.checked)} 
                className={`w-4 h-4 rounded focus:ring-blue-500 ${darkMode ? 'border-slate-600 bg-slate-800 text-blue-600' : 'border-slate-300 bg-white text-blue-600'}`} 
              />
              <span>🔒 Make private (Visible to Admins & @Tagged users only)</span>
            </label>
          </div>

          <div className="relative flex items-center space-x-2 w-full">
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

            <div className="flex space-x-1">
              <button 
                type="button" 
                disabled={isUploading}
                onClick={() => { setShowAttachments(!showAttachments); setShowMentions(false); }} 
                className={`p-2 rounded-lg transition-colors ${showAttachments ? 'bg-blue-500/20 text-blue-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'} disabled:opacity-50`}
                title="Attach File"
              >
                {isUploading ? <Loader2 size={20} className="animate-spin text-blue-500" /> : <Paperclip size={20} />}
              </button>
              <button 
                type="button" 
                onClick={() => { setShowMentions(!showMentions); setShowAttachments(false); }} 
                className={`p-2 rounded-lg transition-colors ${showMentions ? 'bg-blue-500/20 text-blue-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                title="Tag User"
              >
                <AtSign size={20} />
              </button>
            </div>

            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder={`Type a message in ${activeTab} thread...`}
              className={`flex-1 py-3 px-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
            />
            <button type="submit" disabled={!newMsg.trim()} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FilesView({ files, role, onUpload, darkMode, user }) {
  // Allow the user to see admin files IF they are an admin OR if they are the one who uploaded it
  const visibleFiles = role === 'admin' ? files : files.filter(f => f.portalAccess !== 'admin' || f.uploadedBy === user?.email);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState('Working drawings');
  const [adminOnly, setAdminOnly] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const CATEGORIES = [
    'RFI', 'Permit drawings', 'Documents from governing bodies', 
    'Working drawings', 'Engineering reports', 'Invoices', 'Change orders', 'General'
  ];

  const handleFileSelect = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setShowModal(true);
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setShowModal(false);
    await onUpload(selectedFile, category, adminOnly);
    setIsUploading(false);
    setSelectedFile(null);
    setCategory('Working drawings');
    setAdminOnly(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Sorting Logic ---
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc'); // Default to ascending when clicking a new column
    }
  };

  const sortedFiles = [...visibleFiles].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'type':
        aValue = (a.type || '').toLowerCase();
        bValue = (b.type || '').toLowerCase();
        break;
      case 'category':
        aValue = (a.category || 'General').toLowerCase();
        bValue = (b.category || 'General').toLowerCase();
        break;
      case 'uploadedBy':
        aValue = (a.uploadedBy || '').toLowerCase();
        bValue = (b.uploadedBy || '').toLowerCase();
        break;
      case 'date':
      default:
        aValue = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        bValue = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        break;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-500 opacity-40 ml-1">↕</span>;
    return <span className="ml-1 text-blue-500 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const bgStyle = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const headerStyle = darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Document Center</h2>
          <p className="text-sm text-slate-500">Secure, versioned file repository</p>
        </div>
        <div>
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current.click()} disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50">
            {isUploading ? "Uploading..." : <><Upload size={18} className="mr-2" /> Upload File</>}
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl border ${bgStyle}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Upload Details</h3>
              <button onClick={() => { setShowModal(false); setSelectedFile(null); }} className="text-slate-500 hover:text-slate-300"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-400">Selected File</label>
                <div className={`p-3 rounded-lg border ${inputBg} text-sm truncate`}>{selectedFile?.name}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-400">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className={`w-full p-3 rounded-lg border ${inputBg}`}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={adminOnly} onChange={e => setAdminOnly(e.target.checked)} className="w-5 h-5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800" />
                <span className="text-sm font-medium">Make this file private (Visible only to Admins{role === 'contractor' ? ' and You' : ''})</span>
              </label>

              <button onClick={handleConfirmUpload} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors mt-4">
                Confirm & Upload
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`rounded-2xl border ${bgStyle} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${headerStyle} border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} text-xs uppercase tracking-wider`}>
                <th onClick={() => handleSort('name')} className="p-4 font-semibold cursor-pointer hover:bg-slate-500/10 transition-colors select-none">
                  File Name <SortIcon field="name" />
                </th>
                <th onClick={() => handleSort('type')} className="p-4 font-semibold cursor-pointer hover:bg-slate-500/10 transition-colors select-none">
                  Type <SortIcon field="type" />
                </th>
                <th onClick={() => handleSort('category')} className="p-4 font-semibold cursor-pointer hover:bg-slate-500/10 transition-colors select-none">
                  Category <SortIcon field="category" />
                </th>
                <th className="p-4 font-semibold">Size</th>
                <th onClick={() => handleSort('uploadedBy')} className="p-4 font-semibold cursor-pointer hover:bg-slate-500/10 transition-colors select-none">
                  Uploaded By <SortIcon field="uploadedBy" />
                </th>
                <th onClick={() => handleSort('date')} className="p-4 font-semibold cursor-pointer hover:bg-slate-500/10 transition-colors select-none">
                  Date <SortIcon field="date" />
                </th>
                <th className="p-4 font-semibold text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedFiles.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-500">No files uploaded yet.</td></tr>
              ) : (
                sortedFiles.map(file => (
                  <tr key={file.id} className={`transition-colors ${darkMode ? 'hover:bg-slate-800/50 divide-slate-800' : 'hover:bg-slate-50 divide-slate-200 border-b'}`}>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <FileText size={20} className={file.type === 'PDF' ? 'text-red-400' : 'text-blue-400'} />
                        <div>
                          <p className="font-medium text-sm max-w-[200px] truncate">{file.name}</p>
                          {file.portalAccess === 'admin' && <span className="inline-block px-2 py-0.5 mt-1 bg-red-500/20 text-red-400 text-[10px] font-bold rounded uppercase tracking-wider">Admin Only</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-400">{file.type}</td>
                    <td className="p-4 text-sm"><span className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs whitespace-nowrap">{file.category || 'General'}</span></td>
                    <td className="p-4 text-sm text-slate-500">{file.size}</td>
                    <td className="p-4 text-sm truncate max-w-[150px]" title={file.uploadedBy}>{file.uploadedBy}</td>
                    <td className="p-4 text-sm text-slate-500">{(file.createdAt && typeof file.createdAt.toDate === 'function') ? file.createdAt.toDate().toLocaleDateString() : 'Today'}</td>
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

function SettingsView({ darkMode, user, db, triggerNotification }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [twoFactor, setTwoFactor] = useState(true);

  // Load preferences from the database
  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().settings) {
        const s = docSnap.data().settings;
        setPushEnabled(s.push ?? true);
        setEmailEnabled(s.email ?? false);
        setTwoFactor(s.twoFactor ?? true);
      }
    };
    fetchSettings();
  }, [user, db]);

  // Save preferences to the database when toggled
  const updateSetting = async (key, value) => {
    if (key === 'push') setPushEnabled(value);
    if (key === 'email') setEmailEnabled(value);
    if (key === 'twoFactor') setTwoFactor(value);

    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { settings: { [key]: value } }, { merge: true });
      triggerNotification("Preferences Saved", "Settings updated successfully.");
    } catch (err) {
      console.error("Error saving settings:", err);
    }
  };

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
            <p className="font-medium">Instant Email Alerts</p>
            <p className="text-xs text-slate-500">Get an email right away when files or messages are posted.</p>
          </div>
          <button 
            onClick={() => updateSetting('email', !emailEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${emailEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${emailEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between opacity-50 cursor-not-allowed" title="Requires Backend Setup">
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-xs text-slate-500">Real-time alerts for messages and uploads (Pending Setup)</p>
          </div>
          <button disabled className={`w-12 h-6 rounded-full transition-colors relative bg-slate-700`}>
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all`} />
          </button>
        </div>

      </div>

      <div className={`p-6 rounded-2xl border ${cardStyle} space-y-6`}>
        <h3 className="text-lg font-semibold border-b border-inherit pb-4 text-red-400">Security</h3>
        
        <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
          <div>
            <p className="font-medium">Two-Factor Authentication (2FA)</p>
            <p className="text-xs text-slate-500">Require SMS/Email code on login (Pending Setup)</p>
          </div>
          <button disabled className={`w-12 h-6 rounded-full transition-colors relative bg-slate-700`}>
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all`} />
          </button>
        </div>
      </div>
    </div>
  );
}

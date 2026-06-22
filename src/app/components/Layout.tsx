import { Outlet, NavLink } from 'react-router';
import { LayoutDashboard, ClipboardCheck, Users, Menu, X, Grid3X3, LogOut, Sliders } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfiles, UserProfile } from '../context/ProfileContext';
import { Login } from './Login';
import { EditProfileModal } from './EditProfileModal';

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading, signOut, isAdmin } = useAuth();
  const { profiles, activeProfileId, activeProfile, switchProfile } = useProfiles();
  
  // Modal triggers
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalEditProfile, setModalEditProfile] = useState<UserProfile | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const navLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/scoring', icon: Grid3X3, label: 'Quality Scores' },
    { to: '/audit', icon: ClipboardCheck, label: 'Feedback' },
    { to: '/agents', icon: Users, label: 'Agent Details' },
  ];

  if (isAdmin) {
    navLinks.push({ to: '/settings', icon: Sliders, label: 'Settings' });
  }

  const handleEditActive = () => {
    if (activeProfile) {
      setModalEditProfile(activeProfile);
      setShowEditModal(true);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <ClipboardCheck className="size-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 leading-tight">Quality Audit System</h1>
                <p className="text-xs text-slate-500">Agent Performance Tracking</p>
              </div>
            </div>

            {/* Right Header Section */}
            <div className="flex items-center gap-6">
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {navLinks.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-slate-650 hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon className="size-4" />
                    <span className="text-sm font-semibold">{label}</span>
                  </NavLink>
                ))}
              </nav>

              {/* Desktop User Profiles Switcher */}
              <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
                <div className="flex items-center gap-3">
                  {profiles.map(p => {
                    const isActive = p.id === activeProfileId;
                    return (
                      <div key={p.id} className="flex flex-col items-center select-none w-14">
                        <button
                          onClick={() => isActive ? handleEditActive() : switchProfile(p.id)}
                          className={`size-10 rounded-full flex items-center justify-center p-0.5 transition-all ${
                            isActive 
                              ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105' 
                              : 'hover:scale-105 opacity-85 hover:opacity-100'
                          }`}
                          title={isActive ? "Click to edit profile" : `Switch to ${p.name}`}
                        >
                          <div 
                            className="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-black uppercase shadow-sm"
                            style={{ backgroundColor: p.bgColor }}
                          >
                            {p.letter || '?'}
                          </div>
                        </button>
                        <span className={`text-[10px] uppercase font-bold mt-1 tracking-wider truncate text-center w-full ${isActive ? 'text-indigo-650 font-extrabold' : 'text-slate-500'}`}>
                          {p.name}
                        </span>
                      </div>
                    );
                  })}


                  {/* Logout button */}
                  <div className="flex flex-col items-center select-none w-10">
                    <button
                      onClick={signOut}
                      className="size-10 rounded-full border border-slate-200 bg-slate-50 hover:bg-red-50 hover:border-red-100 text-slate-450 hover:text-red-500 flex items-center justify-center transition-all hover:scale-105"
                      title="Sign Out"
                    >
                      <LogOut className="size-4" />
                    </button>
                    <span className="text-[10px] uppercase font-bold mt-1 text-slate-400 tracking-wider">
                      Logout
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <nav className="px-4 py-2 space-y-1">
              {navLinks.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-655 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="size-5" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            
            {/* Mobile Profile switching */}
            <div className="border-t border-slate-100 px-6 py-4 space-y-4">
              <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest">Switch Profile</p>
              <div className="flex items-center gap-3 flex-wrap">
                {profiles.map(p => {
                  const isActive = p.id === activeProfileId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (isActive) {
                          handleEditActive();
                        } else {
                          switchProfile(p.id);
                        }
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                        isActive 
                          ? 'border-indigo-200 bg-indigo-50/50 text-indigo-750 font-bold' 
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div 
                        className="size-5 rounded-full flex items-center justify-center text-white text-[9px] font-black uppercase"
                        style={{ backgroundColor: p.bgColor }}
                      >
                        {p.letter || '?'}
                      </div>
                      <span className="text-xs uppercase tracking-wider">{p.name}</span>
                    </button>
                  );
                })}

              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400 truncate max-w-[180px]">
                  Signed in as: <strong>{user.email}</strong>
                </span>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-650 text-xs font-bold transition-all"
                >
                  <LogOut className="size-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Edit Profile dialog */}
      {showEditModal && (
        <EditProfileModal
          profileToEdit={modalEditProfile}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

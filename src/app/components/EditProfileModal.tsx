import { useState, useEffect } from 'react';
import { X, Camera, Smile, Type } from 'lucide-react';
import { useProfiles, PROFILE_COLORS, UserProfile } from '../context/ProfileContext';
import { toast } from 'sonner';

interface EditProfileModalProps {
  profileToEdit: UserProfile | null; // null means create mode
  onClose: () => void;
}

export function EditProfileModal({ profileToEdit, onClose }: EditProfileModalProps) {
  const { createProfile, updateProfile } = useProfiles();
  const [name, setName] = useState('');
  const [letter, setLetter] = useState('U');
  const [bgColor, setBgColor] = useState(PROFILE_COLORS[0]);
  const [activeTab, setActiveTab] = useState<'photo' | 'emoji' | 'letter'>('letter');

  useEffect(() => {
    if (profileToEdit) {
      setName(profileToEdit.name);
      setLetter(profileToEdit.letter);
      setBgColor(profileToEdit.bgColor);
    } else {
      setName('');
      setLetter('');
      setBgColor(PROFILE_COLORS[7]); // Teal default for new profiles
    }
  }, [profileToEdit]);

  const handleNameChange = (val: string) => {
    setName(val);
    // Auto-update letter to first letter of name
    if (val.trim()) {
      setLetter(val.trim().charAt(0).toUpperCase());
    } else {
      setLetter('');
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Please enter a name.');
      return;
    }
    const finalLetter = letter.trim().charAt(0).toUpperCase() || trimmedName.charAt(0).toUpperCase();

    if (profileToEdit) {
      updateProfile(profileToEdit.id, trimmedName, finalLetter, bgColor);
      toast.success('Profile updated successfully!');
    } else {
      createProfile(trimmedName, finalLetter, bgColor);
      toast.success('Profile created successfully!');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-800 text-lg">
            {profileToEdit ? 'Edit Profile' : 'Create Profile'}
          </h3>
          <button 
            onClick={onClose} 
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          
          {/* Avatar Preview & Name Input */}
          <div className="flex items-center gap-4">
            <div 
              className="size-16 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-inner border border-white/20 uppercase"
              style={{ backgroundColor: bgColor }}
            >
              {letter || '?'}
            </div>
            
            <div className="flex-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. BALAJI"
                maxLength={20}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-slate-700 font-semibold"
              />
            </div>
          </div>

          {/* Segmented Tab Selector */}
          <div className="bg-slate-50 p-1 rounded-xl flex border border-slate-100">
            <button
              onClick={() => setActiveTab('photo')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'photo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Camera className="size-3.5" />
              <span>Photo</span>
            </button>
            <button
              onClick={() => setActiveTab('emoji')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'emoji' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Smile className="size-3.5" />
              <span>Emoji</span>
            </button>
            <button
              onClick={() => setActiveTab('letter')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'letter' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Type className="size-3.5" />
              <span>Letter</span>
            </button>
          </div>

          {/* Under Tabs - Letter Section */}
          {activeTab === 'letter' && (
            <div className="space-y-5">
              
              {/* Single Letter Display */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Single letter
                </label>
                <div 
                  className="size-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-3xl font-black"
                  style={{ color: bgColor }}
                >
                  {letter || '?'}
                </div>
              </div>

              {/* Background Color Picker */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Background color
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {PROFILE_COLORS.map((color) => {
                    const isSelected = bgColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBgColor(color)}
                        className={`size-7 rounded-full transition-all focus:outline-none ${
                          isSelected ? 'ring-2 ring-slate-400 ring-offset-2 scale-110 shadow-md' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'letter' && (
            <div className="py-6 text-center text-xs text-slate-400 italic">
              {activeTab === 'photo' ? 'Photo upload is disabled in demo mode.' : 'Emoji selector is disabled in demo mode.'}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md transition-all mt-2"
          >
            Save Profile
          </button>

        </div>
      </div>
    </div>
  );
}

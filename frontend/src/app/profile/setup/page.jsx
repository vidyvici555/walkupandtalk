'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMyProfile, updateProfile, uploadPhotos } from '../../../api/profile';
import toast from 'react-hot-toast';
import { photoUrl } from '../../../lib/photoUrl';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [existingPhotos, setExistingPhotos] = useState([]); // already saved photos
  const [newPhotos, setNewPhotos] = useState([]);           // newly picked files

  const [form, setForm] = useState({
    display_name: '', birthdate: '', gender: '', interested_in: [],
    bio: '', location_city: '', location_state: '', occupation: '', education: '',
  });

  // Load existing profile on mount so the form is pre-filled
  useEffect(() => {
    getMyProfile()
      .then((res) => {
        const p = res.data;
        if (!p) return;
        setForm({
          display_name:   p.display_name   || '',
          birthdate:      p.birthdate ? p.birthdate.split('T')[0] : '',
          gender:         p.gender         || '',
          interested_in:  Array.isArray(p.interested_in) ? p.interested_in : [],
          bio:            p.bio            || '',
          location_city:  p.location_city  || '',
          location_state: p.location_state || '',
          occupation:     p.occupation     || '',
          education:      p.education      || '',
        });
        if (p.photos?.length > 0) setExistingPhotos(p.photos);
      })
      .catch(() => {}) // new user — no profile yet, that's fine
      .finally(() => setInitialLoading(false));
  }, []);

  const set = (f, v) => setForm((prev) => ({ ...prev, [f]: v }));
  const toggleInterest = (v) =>
    setForm((prev) => ({
      ...prev,
      interested_in: prev.interested_in.includes(v)
        ? prev.interested_in.filter((x) => x !== v)
        : [...prev.interested_in, v],
    }));

  const handleSubmit = async () => {
    if (existingPhotos.length === 0 && newPhotos.length === 0) {
      toast.error('Please add at least one photo');
      return;
    }
    setLoading(true);
    try {
      if (newPhotos.length > 0) {
        const fd = new FormData();
        newPhotos.forEach((f) => fd.append('photos', f));
        await uploadPhotos(fd);
      }
      const res = await updateProfile(form);
      if (res.data.isComplete) {
        toast.success('Profile complete! 🎉');
        router.push('/swipe');
      } else {
        toast.error('Please fill in all required fields and add a photo');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const inp = 'w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm';

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center">
        <div className="text-4xl animate-pulse">💘</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        {/* Step progress bar */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-2 rounded-full transition-colors ${step >= s ? 'bg-pink-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* ── Step 1: About you ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">About you</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
              <input className={inp} value={form.display_name}
                onChange={(e) => set('display_name', e.target.value)}
                placeholder="What should people call you?" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birthday *</label>
              <input type="date" className={inp} value={form.birthdate}
                onChange={(e) => set('birthdate', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am a... *</label>
              <div className="flex gap-3">
                {['Man', 'Woman', 'Non-binary'].map((g) => (
                  <button key={g} type="button" onClick={() => set('gender', g.toLowerCase())}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition ${
                      form.gender === g.toLowerCase()
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'border-gray-300 hover:border-pink-400'
                    }`}>{g}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Interested in... *</label>
              <div className="flex gap-3">
                {['men', 'women', 'everyone'].map((g) => (
                  <button key={g} type="button" onClick={() => toggleInterest(g)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium capitalize transition ${
                      form.interested_in.includes(g)
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'border-gray-300 hover:border-pink-400'
                    }`}>{g}</button>
                ))}
              </div>
            </div>

            <button onClick={() => {
              if (!form.display_name || !form.birthdate || !form.gender || form.interested_in.length === 0) {
                toast.error('Please fill in all required fields'); return;
              }
              setStep(2);
            }} className="w-full bg-pink-500 text-white py-3 rounded-xl font-bold hover:bg-pink-600 transition">
              Next →
            </button>
          </div>
        )}

        {/* ── Step 2: Location & more ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Location &amp; more</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input className={inp} value={form.location_city}
                onChange={(e) => set('location_city', e.target.value)} placeholder="Your city" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <select className={inp} value={form.location_state}
                onChange={(e) => set('location_state', e.target.value)}>
                <option value="">Select state...</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea className={inp} rows={3} value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Tell people about yourself..." maxLength={300} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
              <input className={inp} value={form.occupation}
                onChange={(e) => set('occupation', e.target.value)} placeholder="What do you do?" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
              <input className={inp} value={form.education}
                onChange={(e) => set('education', e.target.value)} placeholder="Highest level / school" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 py-3 rounded-xl font-medium hover:bg-gray-50 transition">← Back</button>
              <button onClick={() => {
                if (!form.location_state) { toast.error('Please select your state'); return; }
                setStep(3);
              }} className="flex-1 bg-pink-500 text-white py-3 rounded-xl font-bold hover:bg-pink-600 transition">Next →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Photos ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Your photos</h2>
            <p className="text-gray-500 text-sm">
              {existingPhotos.length > 0
                ? 'Your saved photos are shown below. Add more or continue.'
                : 'Add at least 1 photo to complete your profile (up to 6).'}
            </p>

            {/* Existing saved photos */}
            {existingPhotos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Saved photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {existingPhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                      <img src={photoUrl(photo.url)} alt="" className="w-full h-full object-cover" />
                      {photo.is_primary && (
                        <span className="absolute bottom-1 left-1 bg-pink-500 text-white text-xs px-1.5 py-0.5 rounded-full">Main</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New photo slots */}
            <div>
              {existingPhotos.length === 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add photos</p>
              )}
              {existingPhotos.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add more</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: Math.min(6 - existingPhotos.length, 6) }).map((_, i) => {
                  const file = newPhotos[i];
                  return (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center relative">
                      {file ? (
                        <>
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setNewPhotos((p) => p.filter((_, j) => j !== i))}
                            className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
                        </>
                      ) : (
                        <label className="cursor-pointer w-full h-full flex items-center justify-center text-2xl text-gray-300 hover:text-pink-400 transition">
                          +
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            if (e.target.files[0]) setNewPhotos((p) => [...p, e.target.files[0]].slice(0, 6 - existingPhotos.length));
                          }} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 py-3 rounded-xl font-medium hover:bg-gray-50 transition">← Back</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 bg-pink-500 text-white py-3 rounded-xl font-bold hover:bg-pink-600 disabled:opacity-50 transition">
                {loading ? 'Saving…' : existingPhotos.length > 0 ? 'Save Changes 🎉' : 'Complete Profile 🎉'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
                                                             
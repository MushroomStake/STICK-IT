import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Header from '../../components/Header';
import { useRouter } from 'next/router';

type Category = { id: string; name: string };
type Sticker = { id: string; name: string; image_url: string; category_id: string };

export default function UserHome() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase.from('categories').select('*');
      if (!error && data) {
        const cats = data as Category[];
        setCategories(cats);
        setSelectedCategory(cats[0]?.id || null);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    setLoading(true);
    async function fetchStickers() {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('category_id', selectedCategory as string);
      if (!error && data) setStickers(data as Sticker[]);
      setLoading(false);
    }
    fetchStickers();
  }, [selectedCategory]);

  const router = useRouter();

  function goToCustomize() {
    router.push('/user/customize');
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center">
      <Header />
      <div className="w-full max-w-7xl px-6 mt-8 mx-auto">
        <div className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden mb-6 bg-gray-100 shadow-[0_30px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/5">
          <img src="/backgrounds/background.png" alt="Hero background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/60 backdrop-blur-sm" />
          <div className="absolute inset-0 flex flex-col justify-center px-6 py-8 md:py-12">
            <h1 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight max-w-3xl md:max-w-4xl text-center md:text-left">Welcome to Stick IT —<br/>let's begin</h1>
            <p className="text-white/95 mt-3 text-base md:text-lg">Turn your ideas into high-quality vinyl stickers in minutes.</p>
          </div>
        </div>
        <div className="flex justify-center">
          <button onClick={goToCustomize} className="w-full md:w-3/5 bg-[#FFD600] text-black font-semibold py-3 rounded-3xl text-lg mb-4 hover:bg-[#ffdf33] transition flex items-center justify-center gap-3 shadow-xl">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Customize Your Own</span>
          </button>
        </div>
      </div>
      <section className="w-full max-w-md px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Explore Premade</h2>
          <a href="#" className="text-yellow-500 text-sm font-medium">View all &gt;</a>
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`px-4 py-1 rounded-full text-sm font-medium border ${selectedCategory === cat.id ? 'bg-yellow-400 text-black' : 'bg-white text-gray-700'}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading stickers...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {stickers.map(sticker => (
              <div key={sticker.id} className="bg-white rounded-2xl shadow-lg p-4">
                <div className="relative w-full h-40 bg-gray-50 rounded-lg mb-3 p-3 flex items-center justify-center">
                  <img src={sticker.image_url} alt={sticker.name} className="max-w-full max-h-full object-contain" />
                  <span className="absolute top-3 left-3 bg-white text-xs px-2 py-0.5 rounded-full border text-gray-700 font-semibold">{categories.find(c => c.id === sticker.category_id)?.name}</span>
                </div>
                <div className="text-sm font-medium">{sticker.name}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      <footer className="w-full max-w-md px-4 py-6 mt-auto text-xs text-gray-400 text-center">
        Made with <span className="text-violet-600 font-bold">♥</span> by Stick IT
      </footer>
    </main>
  );
}

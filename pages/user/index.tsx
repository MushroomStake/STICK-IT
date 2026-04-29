import { useRouter } from 'next/router';
import Header from '../../components/Header';

const DEALS = [
  { title: '10 Stickers', price: '₱20', desc: 'Standard pack — 10 stickers printed on one A4 sheet' },
  { title: '20 Stickers', price: '₱40', desc: 'Double pack — great for sharing' },
  { title: '30 Stickers', price: '₱60', desc: 'Party pack — best value for multiples' },
];

export default function UserHome() {
  const router = useRouter();
  const goToCustomize = () => router.push('/user/customize');

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="relative w-full bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Make custom stickers — fast and affordably</h1>
              <p className="mt-4 text-gray-600 max-w-xl">Upload your designs or use our simple editor to create high-quality vinyl stickers printed on durable material. Ready-to-ship within days.</p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button onClick={goToCustomize} className="inline-flex items-center gap-3 bg-[#FFD600] hover:bg-[#ffdf33] text-black font-semibold px-6 py-3 rounded-full shadow-lg">
                  <span>Customize Your Own</span>
                </button>
                <a href="#how" className="inline-flex items-center gap-2 text-gray-700 px-4 py-3 rounded-full border">How it works</a>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-xl bg-gray-100 h-64 flex items-center justify-center">
              <img src="/backgrounds/background.png" alt="Sample stickers" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Deals */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-semibold mb-6">Deals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {DEALS.map((d) => (
              <div key={d.title} className="p-6 bg-white rounded-2xl shadow hover:shadow-lg">
                <div className="flex items-baseline justify-between">
                  <div className="text-lg font-medium">{d.title}</div>
                  <div className="text-2xl font-bold">{d.price}</div>
                </div>
                <div className="mt-3 text-gray-500 text-sm">{d.desc}</div>
                <div className="mt-6">
                  <button onClick={goToCustomize} className="px-4 py-2 bg-yellow-400 rounded-full font-medium">Order</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-semibold mb-6">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-2xl shadow text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold">1</div>
              <h3 className="mt-4 font-medium">Upload or design</h3>
              <p className="mt-2 text-sm text-gray-500">Upload your artwork or use our built-in editor to create your sticker.</p>
            </div>
            <div className="p-6 bg-white rounded-2xl shadow text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold">2</div>
              <h3 className="mt-4 font-medium">Choose pack</h3>
              <p className="mt-2 text-sm text-gray-500">Pick from 10/20/30 packs—affordable pricing and fast printing.</p>
            </div>
            <div className="p-6 bg-white rounded-2xl shadow text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold">3</div>
              <h3 className="mt-4 font-medium">Delivery or Pickup</h3>
              <p className="mt-2 text-sm text-gray-500">Choose door-to-door delivery or walk-in pickup at our store — fast and secure.</p>
            </div>
          </div>
        </div>
      </section>


      <footer className="py-10 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Stick IT — Made with ♥
      </footer>
    </main>
  );
}

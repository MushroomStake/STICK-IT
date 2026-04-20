import Header from '../../components/Header';
import OrderFlow from '../../components/OrderFlow';

export default function CustomizePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center">
      <Header />
      <div className="w-full max-w-5xl px-6 mt-8 mx-auto">
        <OrderFlow />
      </div>
    </main>
  );
}

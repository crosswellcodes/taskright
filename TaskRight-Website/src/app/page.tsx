import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Problem from '@/components/Problem';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import AppShowcase from '@/components/AppShowcase';
import EarlyAccessForm from '@/components/EarlyAccessForm';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <AppShowcase />
        <EarlyAccessForm />
      </main>
      <Footer />
    </>
  );
}

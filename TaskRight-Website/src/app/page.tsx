import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Problem from '@/components/Problem';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import AppShowcase from '@/components/AppShowcase';
import FounderStory from '@/components/FounderStory';
import FAQ from '@/components/FAQ';
import EarlyAccessForm from '@/components/EarlyAccessForm';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <AppShowcase />
        <Problem />
        <Features />
        <HowItWorks />
        <FounderStory />
        <FAQ />
        <EarlyAccessForm />
      </main>
      <Footer />
    </>
  );
}

// Landing page hero clip — uses Dash_List_Cal.mov from public/
// Full walkthrough lives at /demo

import Link from 'next/link';

export default function DemoVideo() {
  return (
    <section className="bg-text py-20 px-6">
      <div className="max-w-4xl mx-auto">

        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            See TaskRight in action
          </h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto leading-relaxed">
            A live look at the business owner dashboard — calendar view, upcoming service calls, and everything running in one place.
          </p>
        </div>

        <div className="mx-auto rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 w-fit">
          <video
            controls
            playsInline
            className="block bg-black max-h-[70vh] w-auto mx-auto"
          >
            <source src="/Dash_List_Cal.mov" type="video/quicktime" />
            <source src="/Dash_List_Cal.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="text-center mt-8">
          <p className="text-white/40 text-sm mb-4">Recorded on iPhone — no staging, no edits.</p>
          <Link
            href="/demo"
            className="inline-block text-white/70 hover:text-white text-sm font-semibold underline underline-offset-4 transition-colors"
          >
            See the full walkthrough — customers, services, and team management →
          </Link>
        </div>

      </div>
    </section>
  );
}

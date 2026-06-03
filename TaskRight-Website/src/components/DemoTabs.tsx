'use client';

import { useState } from 'react';
import Link from 'next/link';

type Tab = 'business' | 'team' | 'customer';

const businessDemos = [
  {
    number: '01',
    title: 'Dashboard — List & Calendar View',
    description:
      'The business owner home screen. Switch between a calendar view of all upcoming service calls and a list view by date. Everything you need to know about your day at a glance.',
    file: '/Dash_List_Cal.mov',
  },
  {
    number: '02',
    title: 'Customer Management',
    description:
      'Add customers, view their upcoming service schedule, and see the full message thread — all from one screen. Customer details, service history, and communication in one place.',
    file: '/Customer_Screen.mov',
  },
  {
    number: '03',
    title: 'Service & Task Setup',
    description:
      'Create service cycles, define the tasks that belong to each visit, and assign customers. This is how you structure the repeatable work your business runs on.',
    file: '/Task_and_Service.mov',
  },
  {
    number: '04',
    title: 'Team & Group Management',
    description:
      'Add team members, create groups for dispatch, and manage who gets assigned to which service calls. Team members get their own app view with exactly what they need for the day.',
    file: '/Team_Group.mov',
  },
];

const tabs: { id: Tab; label: string }[] = [
  { id: 'business', label: 'Business Owner' },
  { id: 'team',     label: 'Team Member'    },
  { id: 'customer', label: 'Customer'       },
];

function ComingSoon({ persona }: { persona: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-6">
        <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.131a1 1 0 01-1.447.901L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-text mb-3">
        {persona} walkthroughs coming soon
      </h3>
      <p className="text-text-muted leading-relaxed mb-8">
        We&apos;re recording the full {persona.toLowerCase()} experience next.
        Sign up for early access and we&apos;ll reach out when they&apos;re live.
      </p>
      <Link
        href="/signup"
        className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
      >
        Get TaskRight
      </Link>
    </div>
  );
}

export default function DemoTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('business');

  return (
    <div>
      {/* Tab strip */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex bg-surface border border-border rounded-xl p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Business Owner */}
      {activeTab === 'business' && (
        <div className="space-y-20">
          {businessDemos.map((demo) => (
            <div key={demo.number}>
              <div className="mb-5">
                <span className="text-xs font-bold text-brand/60 uppercase tracking-widest">
                  {demo.number}
                </span>
                <h2 className="text-2xl font-bold text-text mt-1 mb-2">
                  {demo.title}
                </h2>
                <p className="text-text-muted leading-relaxed">
                  {demo.description}
                </p>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg border border-border bg-black w-fit mx-auto">
                <video
                  controls
                  playsInline
                  className="block bg-black max-h-[70vh] w-auto"
                >
                  <source src={demo.file} type="video/quicktime" />
                  <source src={demo.file.replace('.mov', '.mp4')} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Member */}
      {activeTab === 'team' && <ComingSoon persona="Team Member" />}

      {/* Customer */}
      {activeTab === 'customer' && <ComingSoon persona="Customer" />}
    </div>
  );
}

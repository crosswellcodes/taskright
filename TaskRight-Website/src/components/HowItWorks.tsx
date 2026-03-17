const steps = [
  {
    number: "1",
    title: "Set up your services",
    description:
      "Create your task list, define time budgets, and schedule recurring service cycles for your customers.",
  },
  {
    number: "2",
    title: "Build your team",
    description:
      "Add staff members, organize them into groups, and assign the right people to the right jobs.",
  },
  {
    number: "3",
    title: "Invite your customers",
    description:
      "Customers receive their upcoming service details, pick the tasks they want done, and you show up fully prepared.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            Get started in minutes
          </h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            A simple three-step process gets your team and your customers on the
            same page.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative flex flex-col items-start">
              {/* Connector line between steps */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-5 left-[calc(50%+1.5rem)] right-[-calc(50%-1.5rem)] h-px bg-border" />
              )}
              <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold text-base mb-5 shrink-0 z-10">
                {step.number}
              </div>
              <h3 className="text-lg font-bold text-text mb-2">{step.title}</h3>
              <p className="text-text-muted leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

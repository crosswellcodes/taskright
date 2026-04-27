const faqs = [
  {
    question: "What Does TaskRight Do?",
    answer:
      "TaskRight is built to onboard and manage customer relationships, streamline communication, schedule teams across service calls, and drive efficiency through simple and effective tools.",
  },
  {
    question: "How many customers or team members can I have?",
    answer:
      "Unlimited customers, unlimited team members. One flat price. Our tech cost doesn't increase as you build your business, we won't charge more as you grow.",
  },
  {
    question: "How do I use TaskRight?",
    answer:
      "TaskRight is an app right now. Business owners can do all functions from an admin-like view, team members can see their assigned service calls with ease, and customers can get the app — or benefit from our text message mechanisms to get transparency. All simple, all in one place. We have plans to build a web-based tool for business owners. The most value comes from our simple app, so we built that first.",
  },
  {
    question: "What about data security?",
    answer:
      "Data privacy and security are a priority in our build. Beta testers will be notified of all security features and data handling practices before launch. We will never sell your customer data.",
  },
  {
    question: "Can I use TaskRight for my type of service business?",
    answer:
      "TaskRight works for any service business: cleaning, lawn care, plumbing, electrical, handyman, HVAC, painting, and more. If it involves recurring customer service and scheduled visits, TaskRight works for you.",
  },
  {
    question: "When is TaskRight launching?",
    answer:
      "We're actively building and targeting a public launch in Q3/Q4 2026. Beta testers get first access and will have direct input on the features we prioritize. Apply now to secure your spot.",
  },
];

export default function FAQ() {
  return (
    <section className="bg-bg py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-text-muted text-lg">
            Everything you need to know before applying for beta access.
          </p>
        </div>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="bg-surface rounded-xl p-8 border border-border"
            >
              <h3 className="text-lg font-bold text-text mb-3">{faq.question}</h3>
              <p className="text-text-muted leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

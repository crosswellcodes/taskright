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
      "Business owners run TaskRight from the mobile app and from a web portal on their computer — the same customers, schedule, and messages in both, with the portal adding a month calendar, a customer map, a unified text inbox, a live team board, and job margins. Team members use the app to see their assigned service calls and clock in on site. Customers can get the app — or simply use text messages to confirm visits and stay in the loop. All simple, all in one place.",
  },
  {
    question: "What about data security?",
    answer:
      "Data privacy and security are a priority in our build. Early Access members will be notified of all security features and data handling practices before launch. We will never sell your customer data.",
  },
  {
    question: "Can I use TaskRight for my type of service business?",
    answer:
      "TaskRight works for any service business: cleaning, lawn care, plumbing, electrical, handyman, HVAC, painting, and more. If it involves recurring customer service and scheduled visits, TaskRight works for you.",
  },
  {
    question: "When is TaskRight launching?",
    answer:
      "We're actively building and targeting a public launch in Q3/Q4 2026. Early Access members get first access and will have direct input on the features we prioritize. Apply now to secure your spot.",
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
            Everything you need to know before signing up for early access.
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

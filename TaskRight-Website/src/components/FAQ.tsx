const faqs = [
  {
    question: "How much does TaskRight cost?",
    answer:
      "Early access members get free forever access. Once we launch publicly, pricing will start at $29–99/month depending on business size. Beta participants lock in their free tier — no expiration, no credit card required.",
  },
  {
    question: "Is TaskRight better than enterprise service tools?",
    answer:
      "Enterprise service tools are built for large operations — complex scheduling, routing, invoicing, and team management at $99–$199/month. TaskRight is built for something different: helping small service businesses manage customer communication and retention without the enterprise price tag or complexity. If you have 10–75 customers and need smarter communication, TaskRight is designed for you.",
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

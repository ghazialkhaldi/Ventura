import PublicLayout from '../components/layout/PublicLayout'
import { Sheet } from '../components/marketing/Sky'
import { PageIntro, Prose, InlineLink } from '../components/marketing/Marketing'

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using the Ventura platform ("Service"), you agree to be bound by these Terms of Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these terms.',
  },
  {
    title: '2. Description of Service',
    body: 'Ventura provides financial operations intelligence software, including anomaly detection, workflow management, AI governance tooling, and related analytics. The Service is provided on a subscription basis according to the plan selected by your organization.',
  },
  {
    title: '3. Accounts and Access',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Workspace administrators control member access and permission levels. You must notify us immediately of any unauthorized use of your account.',
  },
  {
    title: '4. Customer Data',
    body: 'You retain all rights to the data you upload to the Service. We process your data solely to provide the Service and as described in our Privacy Policy. We do not sell customer data or use it to train models for other customers.',
  },
  {
    title: '5. Acceptable Use',
    body: 'You agree not to misuse the Service, including attempting to access data belonging to other organizations, reverse engineering the platform, disrupting service availability, or using the Service in violation of applicable law.',
  },
  {
    title: '6. AI-Generated Insights',
    body: 'The Service uses artificial intelligence to surface anomalies and recommendations. These outputs are decision support tools, not financial advice. Your organization remains responsible for all financial decisions and approvals made using the Service.',
  },
  {
    title: '7. Availability and Support',
    body: 'We strive to maintain high availability but do not guarantee uninterrupted access. Scheduled maintenance will be communicated in advance where practicable. Support is provided according to your subscription plan.',
  },
  {
    title: '8. Termination',
    body: 'Either party may terminate the subscription per the terms of the applicable order form. Upon termination, you may export your data for a period of 30 days, after which it will be deleted from our systems.',
  },
  {
    title: '9. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Ventura shall not be liable for indirect, incidental, special, or consequential damages, or loss of profits or data, arising from your use of the Service.',
  },
  {
    title: '10. Changes to These Terms',
    body: 'We may update these terms from time to time. Material changes will be communicated to workspace administrators. Continued use of the Service after changes take effect constitutes acceptance of the revised terms.',
  },
]

export default function TermsPage() {
  return (
    <PublicLayout title="Terms of Service">
      <PageIntro title="Terms of Service" meta="Last updated: July 2026" />
      <Sheet className="mb-16 sm:mb-24">
        <Prose>
          {sections.map(s => (
            <div key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          ))}
          <p className="!mt-14 pt-8 border-t border-border">
            Questions about these terms? <InlineLink href="/contact">Contact us</InlineLink>.
          </p>
        </Prose>
      </Sheet>
    </PublicLayout>
  )
}

import { LegalDraft } from "@/components/marketing/legal-draft";

export const metadata = { title: "Privacy Policy (draft)" };

export default function PrivacyPage() {
  return (
    <LegalDraft title="Privacy Policy">
      <h2>What we collect</h2>
      <ul>
        <li>Account data: your name, email address and a salted password hash.</li>
        <li>Content you create: universes, entities, events, lore, maps and uploaded media.</li>
        <li>Security records: session identifiers (hashed), audit logs of sensitive actions, and IP addresses for rate limiting and abuse prevention.</li>
        <li>AI usage: if AI is enabled, the context sent to the configured provider and token counts.</li>
      </ul>
      <h2>How content is shared</h2>
      <p>Universes are visible only to their members. When AI features are used, a bounded excerpt of the relevant universe is sent to the configured AI provider for that request only.</p>
      <h2>Your controls</h2>
      <p>You can export your universes, change your profile, and delete universes you own. Account deletion requests can be made to the operator of this instance.</p>
      <h2>Retention</h2>
      <p>Content is retained until deleted. Revision history and audit logs are retained for integrity and security purposes.</p>
    </LegalDraft>
  );
}

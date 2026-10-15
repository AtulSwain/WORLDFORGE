import { LegalDraft } from "@/components/marketing/legal-draft";

export const metadata = { title: "Terms of Service (draft)" };

export default function TermsPage() {
  return (
    <LegalDraft title="Terms of Service">
      <h2>Your content</h2>
      <p>You retain all rights to the worlds, characters, text and media you create or upload. You grant the operator only the permissions needed to store, process and display that content to you and the members you invite.</p>
      <h2>Acceptable use</h2>
      <p>Do not upload content you do not have the right to use, attempt to access universes you are not a member of, or abuse the service&apos;s resources, including AI allowances.</p>
      <h2>AI suggestions</h2>
      <p>AI output may be inaccurate. It is presented as an unapproved suggestion and becomes part of your canon only when you accept it.</p>
      <h2>Availability</h2>
      <p>The service is provided in early access, as is, without warranties. Export your work regularly.</p>
    </LegalDraft>
  );
}

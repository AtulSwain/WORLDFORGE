export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="wf-eyebrow text-gold-dim">Our mission</p>
      <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight">Build worlds that remember everything.</h1>
      <div className="wf-prose mt-8">
        <p>
          Writers and worldbuilders keep their universes in documents, spreadsheets, notes and folders of images. As a world grows, those fragments drift apart: a character appears in two places at once, a kingdom has two rulers in the same year, a treaty outlives the war that ended it.
        </p>
        <p>WorldForge exists to make the connections in a fictional universe explicit, so creators can grow vast worlds without losing their canon.</p>
        <h2>What we believe</h2>
        <ul>
          <li><strong>Structure over scattered notes.</strong> Characters, places, events and relationships are records that know about each other.</li>
          <li><strong>Canon is the creator&apos;s.</strong> AI may suggest; only you decide. Nothing becomes canon without explicit approval.</li>
          <li><strong>History is never destroyed.</strong> Every change leaves a revision. Alternate timelines never overwrite the original.</li>
          <li><strong>Honesty about uncertainty.</strong> The engine shows its evidence and never invents confidence scores.</li>
          <li><strong>Your intellectual property stays yours.</strong> Export everything, any time, in open formats.</li>
        </ul>
        <h2>Who we build for</h2>
        <p>Novelists, manga and comic creators, screenwriters, indie game developers, tabletop game masters, and anyone whose imagination has outgrown a notebook.</p>
      </div>
    </article>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Binary,
  Boxes,
  CheckCircle2,
  DatabaseZap,
  FolderTree,
  Gauge,
  Network,
  Sigma,
  Workflow,
} from "lucide-react";
import styles from "./page.module.css";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1684503830693-117be55da983?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=1800";
const DETAIL_IMAGE =
  "https://images.unsplash.com/photo-1743090660977-babf07732432?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=1800";

const heroStats = [
  { value: "6.16x", label: "geometric mean speedup" },
  { value: "5.49x", label: "median speedup over REF_R1" },
  { value: "505", label: "paired benchmark runs completed" },
];

const challengeItems = [
  {
    title: "Mutable structure dependence",
    body:
      "The exact baseline keeps correctness by editing the clique tree and the vertex-to-leaf index after every peel step. That couples support maintenance to structural mutation.",
  },
  {
    title: "Batch interaction inside one leaf",
    body:
      "A single batch can remove several pivots and several keep vertices that touch the same leaf. The update must stay exact under joint removal, not just under one-vertex-at-a-time reasoning.",
  },
  {
    title: "Local work without global rescans",
    body:
      "If the tree stops mutating, the algorithm still needs a way to touch only affected leaves. Otherwise the win disappears into repeated full scans.",
  },
];

const techniqueItems = [
  {
    step: "Technique 01",
    title: "Immutable leaf state replaces leaf mutation",
    icon: FolderTree,
    body:
      "Each stored leaf keeps only the state that matters for future support: how many pivots remain, how many pivots are needed to reach size s, and whether the leaf is still alive. The clique tree itself stops changing.",
    code: [
      "leafRemainPivots[L]",
      "leafNeedPivot[L] = s - |keep(L)|",
      "leafAlive[L] in {0, 1}",
    ],
  },
  {
    step: "Technique 02",
    title: "Flat CSR incidence localizes every update",
    icon: Network,
    body:
      "A compact vertex-to-leaf CSR index replaces dynamic hash-style adjacency maintenance. When a batch removes vertices, the algorithm can enumerate exactly the leaves touched by that batch and no others.",
    code: [
      "vtxLeafOff[v] ... vtxLeafOff[v + 1]",
      "vtxLeafData[pos] = { leafId, isPivot }",
      "affectedLeaves <- union over removed vertices",
    ],
  },
  {
    step: "Technique 03",
    title: "Closed-form support deltas avoid re-editing the leaf",
    icon: Sigma,
    body:
      "For every affected leaf, support loss is computed by combinatorial deltas instead of by rebuilding the leaf. The keep and pivot contributions are updated directly from old and new pivot counts.",
    code: [
      "deltaKeep = C(oldRP, need) - C(newRP, need)",
      "deltaPivot = C(oldRP - 1, need - 1) - C(newRP - 1, need - 1)",
      "dead leaf => remove its full previous contribution",
    ],
  },
  {
    step: "Technique 04",
    title: "Batch-pop exact peeling stays aligned with REF",
    icon: Workflow,
    body:
      "The optimized variant still peels the current minimum-support frontier exactly. The priority queue changes and the updates are cheaper, but the peel order invariant and the final core values remain the same.",
    code: [
      "pop all vertices with support <= current level",
      "aggregate leaf effects once per batch",
      "apply exact deltas, then update the queue",
    ],
  },
];

const correctnessSpine = [
  {
    title: "Sufficient-state lemma",
    body:
      "A leaf does not need its explicit pivot subset rewritten after each batch. Future support depends only on the surviving pivot count, the fixed keep set size, the alive flag, and the static incidence list.",
  },
  {
    title: "Closed-form delta lemma",
    body:
      "For both keep vertices and pivot vertices, the support loss caused by a batch is a difference of binomial terms. No re-enumeration of size-s cliques is required.",
  },
  {
    title: "Batch equivalence theorem",
    body:
      "If the batch contains exactly the minimum-support frontier, then the optimized peel assigns the same core values as the reference algorithm. The implementation changes the state representation, not the semantics.",
  },
];

const datasetStats = [
  {
    name: "com-youtube",
    pairs: 16,
    medianSpeedup: 6.82,
    meanSpeedup: 10.71,
    maxSpeedup: 22.93,
    memoryRatio: 1.79,
  },
  {
    name: "web-Stanford",
    pairs: 60,
    medianSpeedup: 5.41,
    meanSpeedup: 8.42,
    maxSpeedup: 39.41,
    memoryRatio: 1.25,
  },
  {
    name: "web-it-2004",
    pairs: 429,
    medianSpeedup: 5.49,
    meanSpeedup: 7.35,
    maxSpeedup: 28.05,
    memoryRatio: 1.14,
  },
];

const representativeRuns = [
  {
    dataset: "com-youtube",
    setting: "s = 2",
    stMs: 735.692,
    refMs: 1347.92,
    speedup: 1.83,
  },
  {
    dataset: "com-youtube",
    setting: "s = 17",
    stMs: 8.682,
    refMs: 195.945,
    speedup: 22.57,
  },
  {
    dataset: "web-Stanford",
    setting: "s = 2",
    stMs: 213.366,
    refMs: 380.861,
    speedup: 1.79,
  },
  {
    dataset: "web-Stanford",
    setting: "s = 61",
    stMs: 1.385,
    refMs: 54.593,
    speedup: 39.41,
  },
  {
    dataset: "web-it-2004",
    setting: "s = 2",
    stMs: 381.273,
    refMs: 679.587,
    speedup: 1.78,
  },
  {
    dataset: "web-it-2004",
    setting: "s = 430",
    stMs: 4.08,
    refMs: 78.593,
    speedup: 19.27,
  },
];

const contributionItems = [
  {
    title: "A new exact state model for R1 peeling",
    body:
      "The paper claims that exact R1 peeling can be reformulated as immutable-state transition rather than dynamic tree editing.",
  },
  {
    title: "Closed-form support maintenance",
    body:
      "The update rule becomes direct arithmetic on combinatorial counts, which is the real source of the algorithmic simplification.",
  },
  {
    title: "A specialized exact implementation that is measurably stronger",
    body:
      "The current results show consistent wins over REF_R1 across all measured pairings, with lower memory footprints and a much larger advantage at high s.",
  },
];

const commands = [
  "bash benchmark_all.sh",
  "env PIVOTER_RUN_ST=1 PIVOTER_COMPARE=1 ./build/bin/degeneracy_cliques graphs/email-Eu-core.edges 1 4",
  "env PIVOTER_RUN_ST=1 PIVOTER_COMPARE=1 ./build/bin/degeneracy_cliques graphs/web-Stanford.edges 1 6",
];

export const metadata: Metadata = {
  title: "Pivoter R1 Paper",
  description:
    "A detailed paper microsite for the exact R1 nucleus decomposition algorithm: immutable leaf state, flat CSR incidence, closed-form support deltas, and exact batch peeling.",
};

function formatMs(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 10 ? 3 : 1,
    maximumFractionDigits: value < 10 ? 3 : 1,
  });
}

export default function PivoterR1Page() {
  return (
    <main className={styles.page}>
      <section id="top" className={styles.hero}>
        <Image
          src={HERO_IMAGE}
          alt="Abstract network lines over a dark background"
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroScrim} />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Pivoter R1 paper framing</p>
            <h1 className={styles.heroTitle}>
              Exact R1 peeling without mutable clique-tree updates.
            </h1>
            <p className={styles.heroLead}>
              This page turns the current R1 algorithm into a conference-style
              paper pitch: the challenge, the new technique stack, the
              correctness spine, and the evidence that the specialization is
              both exact and materially faster.
            </p>
            <div className={styles.heroActions}>
              <a href="#technique" className={styles.primaryAction}>
                Read the technique
                <ArrowRight size={16} />
              </a>
              <a href="#evidence" className={styles.secondaryAction}>
                See the measurements
              </a>
            </div>
          </div>

          <div className={styles.heroAside}>
            <div className={styles.heroAsideLabel}>Paper claim</div>
            <p>
              The exact baseline edits the tree to reflect every peel event.
              This algorithm keeps the tree fixed and moves all dynamics into a
              compact per-leaf state plus closed-form support deltas.
            </p>
            <div className={styles.scrollCue}>
              <span>Technique stack below</span>
            </div>
          </div>
        </div>

        <div className={styles.heroStats}>
          {heroStats.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>

        <p className={styles.credit}>
          Hero image by{" "}
          <a
            href="https://unsplash.com/photos/a-black-background-with-a-pattern-of-lines-J5zCo14SRGI"
            target="_blank"
            rel="noreferrer"
          >
            Visax on Unsplash
          </a>
        </p>
      </section>

      <section className={styles.band}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>The bottleneck</p>
            <h2>Why the exact baseline becomes expensive.</h2>
          </div>
          <div className={styles.problemLayout}>
            <div className={styles.problemNarrative}>
              <p>
                The R1 reference path keeps exactness by performing real
                structural work after each peel batch: sorting removed pivots,
                editing the vertex-to-leaf index, rewriting the leaf, and
                deleting dead leaves. That is faithful, but it entangles exact
                support maintenance with mutable clique-tree updates.
              </p>
              <p>
                The paper should position the new algorithm as a reframing of
                that dependency. The win does not come from approximate peeling
                or relaxed semantics. It comes from recognizing that the tree
                mutation is stronger than what correctness actually needs.
              </p>
            </div>
            <div className={styles.challengeGrid}>
              {challengeItems.map((item) => (
                <article key={item.title} className={styles.challengeCard}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="technique" className={styles.techniqueSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Technique stack</p>
            <h2>Four moves define the new algorithm.</h2>
          </div>

          <div className={styles.techniqueLayout}>
            <aside className={styles.stickyPanel}>
              <div className={styles.stickyVisual}>
                <Image
                  src={DETAIL_IMAGE}
                  alt="Close-up source code on a dark monitor"
                  fill
                  sizes="(max-width: 960px) 100vw, 42vw"
                  className={styles.detailImage}
                />
                <div className={styles.stickyScrim} />
                <div className={styles.stickyQuote}>
                  <p>
                    The leaf does not need to be rewritten to lose influence.
                    It only needs a state that is sufficient to recompute its
                    contribution exactly.
                  </p>
                </div>
              </div>
              <p className={styles.credit}>
                Detail image by{" "}
                <a
                  href="https://unsplash.com/photos/code-is-displayed-on-a-black-screen-HnfsOiBpzU0"
                  target="_blank"
                  rel="noreferrer"
                >
                  ANOOF C on Unsplash
                </a>
              </p>
            </aside>

            <div className={styles.techniqueFlow}>
              {techniqueItems.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.step} className={styles.techniqueCard}>
                    <div className={styles.techniqueHeader}>
                      <div>
                        <p className={styles.techniqueStep}>{item.step}</p>
                        <h3>{item.title}</h3>
                      </div>
                      <Icon size={22} />
                    </div>
                    <p>{item.body}</p>
                    <pre className={styles.codeBlock}>
                      <code>{item.code.join("\n")}</code>
                    </pre>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.bandAlt}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Closed-form update</p>
            <h2>The paper needs these formulas at the center.</h2>
          </div>

          <div className={styles.formulaGrid}>
            <article className={styles.formulaPanel}>
              <div className={styles.formulaTitle}>
                <Binary size={18} />
                <h3>State per leaf</h3>
              </div>
              <pre className={styles.codeBlock}>
                <code>{`oldRP  = remaining pivots before the batch
newRP  = oldRP - removedPivots
need   = s - |keep(L)|
dies   = removedKeep || need > newRP || newRP < 0`}</code>
              </pre>
            </article>
            <article className={styles.formulaPanel}>
              <div className={styles.formulaTitle}>
                <Sigma size={18} />
                <h3>Support loss</h3>
              </div>
              <pre className={styles.codeBlock}>
                <code>{`if dies:
  deltaKeep  = C(oldRP, need)
  deltaPivot = C(oldRP - 1, need - 1)
else:
  deltaKeep  = C(oldRP, need) - C(newRP, need)
  deltaPivot = C(oldRP - 1, need - 1)
             - C(newRP - 1, need - 1)`}</code>
              </pre>
            </article>
            <article className={styles.formulaPanel}>
              <div className={styles.formulaTitle}>
                <Boxes size={18} />
                <h3>Operational meaning</h3>
              </div>
              <p>
                The new algorithm never edits the leaf and never reconstructs
                it. It computes exactly how much support disappears from each
                live vertex and updates the queue once, after the leaf has been
                summarized.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Correctness spine</p>
            <h2>Three statements carry the theory.</h2>
          </div>
          <div className={styles.correctnessGrid}>
            {correctnessSpine.map((item) => (
              <article key={item.title} className={styles.correctnessItem}>
                <div className={styles.correctnessHeader}>
                  <CheckCircle2 size={18} />
                  <h3>{item.title}</h3>
                </div>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="evidence" className={styles.bandAlt}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Evidence</p>
            <h2>The current R1 results are already strong enough to anchor the story.</h2>
          </div>

          <div className={styles.overviewMetrics}>
            <div className={styles.metricPanel}>
              <Gauge size={20} />
              <strong>1.78x to 39.41x</strong>
              <span>Measured speedup range over REF_R1.</span>
            </div>
            <div className={styles.metricPanel}>
              <DatabaseZap size={20} />
              <strong>1.03x to 2.21x</strong>
              <span>Reference-to-ST memory ratio across matched runs.</span>
            </div>
            <div className={styles.metricPanel}>
              <Workflow size={20} />
              <strong>High-s advantage grows sharply</strong>
              <span>
                The optimization pays most when support updates become
                structurally expensive in the baseline.
              </span>
            </div>
          </div>

          <div className={styles.resultsGrid}>
            <div className={styles.datasetTable}>
              <div className={styles.tableHeader}>
                <span>dataset</span>
                <span>median</span>
                <span>max</span>
                <span>mem</span>
              </div>
              {datasetStats.map((dataset) => (
                <div key={dataset.name} className={styles.tableRow}>
                  <div>
                    <strong>{dataset.name}</strong>
                    <span>{dataset.pairs} matched runs</span>
                  </div>
                  <div className={styles.barCell}>
                    <span>{dataset.medianSpeedup.toFixed(2)}x</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${(dataset.medianSpeedup / 8) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>{dataset.maxSpeedup.toFixed(2)}x</div>
                  <div>{dataset.memoryRatio.toFixed(2)}x</div>
                </div>
              ))}
            </div>

            <div className={styles.runList}>
              <h3>Representative settings</h3>
              {representativeRuns.map((run) => (
                <div key={`${run.dataset}-${run.setting}`} className={styles.runItem}>
                  <div>
                    <strong>{run.dataset}</strong>
                    <span>{run.setting}</span>
                  </div>
                  <div>
                    <span>ST {formatMs(run.stMs)} ms</span>
                    <span>REF {formatMs(run.refMs)} ms</span>
                  </div>
                  <strong>{run.speedup.toFixed(2)}x</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>What the paper should claim</p>
            <h2>Keep the contribution narrow, exact, and defensible.</h2>
          </div>
          <div className={styles.contributionGrid}>
            {contributionItems.map((item) => (
              <article key={item.title} className={styles.contributionCard}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>

          <div className={styles.claimBoundary}>
            <div>
              <p className={styles.claimLabel}>Do say</p>
              <p>
                This is a specialized exact algorithm for R1 nucleus
                decomposition that replaces dynamic clique-tree mutation with
                immutable state transitions.
              </p>
            </div>
            <div>
              <p className={styles.claimLabel}>Do not say</p>
              <p>
                This is not yet a universal theory for all r and it is not a
                claim of a new general asymptotic framework for every nucleus
                decomposition regime.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalBand}>
        <div className={styles.container}>
          <div className={styles.finalLayout}>
            <div>
              <p className={styles.kicker}>Reproducibility snapshot</p>
              <h2>Ground the page in commands and measured artifacts.</h2>
            </div>
            <div className={styles.commandPanel}>
              {commands.map((command) => (
                <pre key={command} className={styles.commandLine}>
                  <code>{command}</code>
                </pre>
              ))}
              <p className={styles.commandNote}>
                Server benchmark summary came from the current
                <span> benchmark_all_results.csv </span>
                run on <span>tods2</span> at commit <span>b51f24d</span>.
                Local exactness checks were re-run with compare mode on small
                and medium instances before this page was written.
              </p>
            </div>
          </div>

          <div className={styles.bottomActions}>
            <a href="#top" className={styles.secondaryAction}>
              Back to top
            </a>
            <Link href="/" className={styles.primaryAction}>
              Return to main site
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

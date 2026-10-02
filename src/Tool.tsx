// Mailroom: sorts a pile of comments into questions, praise, collab offers, criticism and spam, with reply drafts.
import { useState } from "react";
import { parseCsv } from "./lib/csv";
import { uid, useCopy, useStored } from "./lib/store";
import { ImportBox, Section } from "./ui/kit";

const T = "mailroom";
type Bucket = "collab" | "question" | "criticism" | "praise" | "spam" | "other";
type Comment = { id: string; author: string; text: string; bucket: Bucket; done: boolean };

const BUCKETS: Record<Bucket, { label: string; cls: string; rx: RegExp }> = {
  spam: { label: "Spam", cls: "", rx: /(https?:\/\/|www\.|\bcrypto\b|\bbitcoin\b|check (out )?my (channel|page|profile)|\bdm me\b|\bfollow back\b|\bsub4sub\b|\bwhatsapp \+?\d|earn \$?\d+ (a|per) day)/i },
  collab: { label: "Collab offers", cls: "good", rx: /\b(collab|collaborat|partnership|partner with|sponsor|brand deal|business (inquiry|enquiry)|email me|contact you|work together|promote|paid post|ambassador|rates?)\b/i },
  question: { label: "Questions", cls: "warn", rx: /(\?|\b(how|what|where|when|which|why|can you|could you|do you|is there|any tips|comment|pourquoi|combien|où|kifech|chnowa|علاش|كيفاش|وين)\b)/i },
  criticism: { label: "Criticism", cls: "bad", rx: /\b(wrong|disagree|misleading|bad|worst|terrible|boring|clickbait|disappointed|hate|not true|unsubscrib|waste of time|nul|décevant)\b/i },
  praise: { label: "Praise", cls: "good", rx: /\b(love|great|amazing|awesome|thank|thanks|helpful|brilliant|best|beautiful|inspir|bravo|merci|super|génial|yaatik|شكرا|برافو|🔥|❤️|👏)/i },
  other: { label: "Everything else", cls: "", rx: /$^/ },
};
const ORDER: Bucket[] = ["collab", "question", "criticism", "praise", "spam", "other"];
const classify = (t: string): Bucket => ORDER.find(b => BUCKETS[b].rx.test(t)) ?? "other";

const DEFAULT_REPLIES: Record<Bucket, string> = {
  collab: "Thanks {name}! Please send the details to hello@yourstudio.com and I'll get back to you this week.",
  question: "Good question, {name}. ",
  criticism: "Thanks for the honest feedback, {name}. What would have made it more useful for you?",
  praise: "Thank you {name}, that means a lot!",
  spam: "",
  other: "Thanks for watching, {name}!",
};

const SAMPLE = `Nour: This was so helpful, thank you!!
Karim B: How long did the glaze take to dry before firing?
Brand Studio: Hi! We'd love to discuss a paid partnership, can we email you?
Sami: Honestly the title is clickbait, you never showed the final result
cryptoking: Earn $500 per day, check my profile
Lina: Where did you buy the kiln?
Amel: Bravo, beautiful work 👏
Hedi: first`;

function parse(text: string): Comment[] {
  const rows = text.includes(",") && /^(author|name|user)/i.test(text) ? parseCsv(text).slice(1).map(r => [r[0], r.slice(1).join(", ")]) : text.split("\n").map(l => { const m = l.match(/^([^:]{1,40}):\s*(.+)$/); return m ? [m[1], m[2]] : ["", l]; });
  return rows.filter(r => r[1]?.trim()).map(([author, t]) => ({ id: uid(), author: author.trim() || "there", text: t.trim(), bucket: classify(t), done: false }));
}

export default function Mailroom() {
  const [comments, setComments] = useStored<Comment[]>(T, "comments", parse(SAMPLE));
  const [replies, setReplies] = useStored(T, "replies", DEFAULT_REPLIES);
  const [open, setOpen] = useState<Bucket>("collab");
  const [hideDone, setHideDone] = useState(true);
  const { copy, copied } = useCopy();
  const counts = Object.fromEntries(ORDER.map(b => [b, comments.filter(c => c.bucket === b && !c.done).length])) as Record<Bucket, number>;
  const list = comments.filter(c => c.bucket === open && (!hideDone || !c.done));
  const reply = (c: Comment) => replies[c.bucket].replace(/\{name\}/g, c.author.split(" ")[0]);
  const set = (id: string, patch: Partial<Comment>) => setComments(comments.map(c => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div className="stack">
      <div className="grid2">
        <Section title="Bring in comments">
          <ImportBox label="Paste comments, one per line as Name: comment, or a CSV with author and text" onText={t => setComments([...comments, ...parse(t)])} placeholder={"Leila: Where can I buy this?\nOmar: Love it"} />
          <button className="btn ghost small danger" style={{ marginTop: 10 }} onClick={() => setComments([])}>Clear all comments</button>
        </Section>
        <Section title="Reply template" aside={<span className="pill">{BUCKETS[open].label}</span>}>
          <label className="field"><span>Use {"{name}"} for the commenter's first name</span>
            <textarea id="mr-tpl" className="input" rows={4} value={replies[open]} onChange={e => setReplies({ ...replies, [open]: e.target.value })} />
          </label>
        </Section>
      </div>

      <div className="mr-tabs">
        {ORDER.map(b => (
          <button key={b} className="mr-tab" aria-pressed={open === b} onClick={() => setOpen(b)}>
            <span className="num">{counts[b]}</span>{BUCKETS[b].label}
          </button>
        ))}
      </div>

      <Section title={BUCKETS[open].label} aside={<label className="check note"><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />Hide handled</label>}>
        {list.length === 0 ? <p className="empty-note">Nothing waiting here.</p> : (
          <div className="stack" style={{ gap: 10 }}>
            {list.map(c => (
              <div key={c.id} className="mr-c" style={{ opacity: c.done ? 0.5 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{c.author}</strong>
                  <p>{c.text}</p>
                  {reply(c) && <p className="mr-reply">{reply(c)}</p>}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  {reply(c) && <button className="btn small" onClick={() => { copy(reply(c)); set(c.id, { done: true }); }}>{copied ? "Copied" : "Copy reply"}</button>}
                  <button className="btn ghost small" onClick={() => set(c.id, { done: !c.done })}>{c.done ? "Undo" : "Mark handled"}</button>
                  <select className="input" style={{ fontSize: 12, padding: "4px 6px" }} aria-label="Move to pile" value={c.bucket} onChange={e => set(c.id, { bucket: e.target.value as Bucket })}>{ORDER.map(b => <option key={b} value={b}>{BUCKETS[b].label}</option>)}</select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <style>{`.mr-tabs{display:flex;gap:8px;flex-wrap:wrap}.mr-tab{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 14px 6px 6px;font-weight:600;cursor:pointer;color:var(--ink)}
      .mr-tab span{background:var(--sunk);border-radius:999px;min-width:28px;padding:2px 8px;text-align:center}.mr-tab[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}.mr-tab[aria-pressed="true"] span{background:var(--ink);color:var(--bg)}
      .mr-c{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}.mr-reply{margin-top:6px;padding:8px 10px;border-left:3px solid var(--accent);background:var(--sunk);border-radius:0 6px 6px 0;font-size:14px}`}</style>
    </div>
  );
}

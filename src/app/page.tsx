 'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Ghost, Github, ShieldCheck, Cpu, Terminal, Activity, AlertTriangle, ScanLine, GitPullRequest, Check, Play, FolderGit2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (targetPathOrUrl?: string) => {
    const inputVal = targetPathOrUrl || repoInput.trim();
    if (!inputVal) {
      setError('Please enter a GitHub repository URL or a local folder path.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isLocal = inputVal.startsWith('/') || inputVal.startsWith('./') || inputVal.includes('examples/');
      const payload = isLocal 
        ? { localPath: inputVal }
        : { url: inputVal };

      const res = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import repository.');
      }

      // Navigate to the lab overview
      router.push(`/lab/${data.repository.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during import.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-grid" aria-hidden="true" />
        <div className="landing-wrap hero-layout">
          <div className="hero-copy">
            <div className="eyebrow"><span className="status-dot" /> A NEW CHAPTER FOR OLD CODE <span className="eyebrow-version">V.1.0</span></div>
            <h1 id="hero-title">The last commit<br />wasn’t <span>the end.</span></h1>
            <p className="hero-description">Good software shouldn’t become a ghost town. Bring forgotten repositories back to life with a local AI that understands what broke—and helps you fix it.</p>
            <div className="hero-actions"><a href="#resurrect" className="landing-button primary">Resurrect a repository <ArrowUpRight size={18} /></a><Link href="/demo" className="demo-link"><span className="play-circle"><Play size={12} fill="currentColor" /></span> See it in action</Link></div>
            <div className="hero-assurances"><span><ShieldCheck size={15} /> Local-first by design</span><span><Github size={15} /> Open source</span><span>No AI API key</span></div>
          </div>
          <div className="revival-visual" aria-label="Illustrative preview of a repository repair">
            <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
            <div className="visual-caption"><span className="status-dot" /> REPOSITORY RECOVERY IN PROGRESS</div>
            <div className="code-window">
              <div className="window-toolbar"><div className="window-dots"><i /><i /><i /></div><span>the-last-commit / lab</span><Terminal size={13} /></div>
              <div className="repo-heading"><div className="repo-icon"><FolderGit2 size={23} /></div><div><strong>markdown-tomb-parser</strong><span>Last commit: 2016 · JavaScript</span></div><span className="archived-label">ARCHIVED</span></div>
              <div className="code-tab"><span>src / parser.js</span><span>ILLUSTRATIVE DIFF</span></div>
              <div className="code-lines"><div><b>12</b><span className="code-comment">// A small change. A second chance.</span></div><div className="line-removed"><b>13</b><span>− const buf = new Buffer(input);</span></div><div className="line-added"><b>13</b><span>+ const buf = Buffer.from(input);</span></div><div><b>14</b><span>  return parse(buf.toString());</span></div><div><b>15</b><span>{'}'}</span></div></div>
              <div className="terminal-preview"><span><span className="terminal-prompt">❯</span> npm test</span><span><Check size={13} /> Parser compatibility restored</span><span className="terminal-muted">Patch ready for human review<span className="terminal-cursor">▍</span></span></div>
            </div>
            <div className="recovery-badge"><div className="recovery-check"><Check size={20} /></div><div><strong>Still has a future.</strong><span>Understand. Repair. Verify.</span></div><Activity size={31} /></div>
            <div className="visual-bottom"><span>POWERED BY GEMMA 3</span><span>YOUR MACHINE. YOUR CODE.</span></div>
          </div>
        </div>
        <div className="landing-wrap hero-bottom"><span>BUILT FOR THE CODE WORTH KEEPING.</span><span>↓ &nbsp; SCROLL TO EXPLORE</span></div>
      </section>

      <section id="resurrect" className="import-section landing-wrap" aria-labelledby="import-title">
        <div><div className="section-kicker">01 / THE STARTING POINT</div><h2 id="import-title">Every revival starts<br />with a repository.</h2><p>A forgotten side project. A legacy dependency.<br />Let’s see what’s still alive in there.</p></div>
        <div className="import-panel"><form onSubmit={(event) => { event.preventDefault(); if (!isSubmitting) void handleImport(); }}><label htmlFor="repository">GITHUB URL OR LOCAL FOLDER</label><div className="repository-field"><Github size={19} /><input id="repository" value={repoInput} onChange={e => setRepoInput(e.target.value)} placeholder="github.com/owner/forgotten-repo" disabled={isSubmitting} aria-describedby={error ? 'import-error' : 'import-help'} /></div><button type="submit" className="landing-button primary" disabled={isSubmitting}>{isSubmitting ? <><Activity size={17} className="animate-spin" /> Importing repository…</> : <>Begin resurrection <ArrowRight size={18} /></>}</button>{error && <p role="alert" id="import-error" className="import-error"><AlertTriangle size={16} />{error}</p>}<p id="import-help" className="import-help"><ShieldCheck size={13} /> Local AI runs through Ollama. <Link href="/settings">Configure your setup <ArrowUpRight size={11} /></Link></p></form></div>
      </section>

      <section className="workflow-section" id="how-it-works"><div className="landing-wrap"><div className="section-heading"><div><div className="section-kicker">02 / FROM FORGOTTEN TO FUNCTIONAL</div><h2>A little less dead.<br />A lot more potential.</h2></div><p>No blind rewrites. Follow the evidence from the<br className="desktop-break" /> first broken import to a patch you can review.</p></div><div className="workflow-grid">{[{ n:'01', icon:ScanLine, title:'Find the cause.', text:'Trace broken imports, deprecated APIs, and runtime mismatches back to the source.', detail:'THE AUTOPSY' },{ n:'02', icon:Ghost, title:'Meet your Ghost.', text:'Ask your codebase what it used to do. Get answers grounded in actual files.', detail:'THE UNDERSTANDING' },{ n:'03', icon:GitPullRequest, title:'Bring it back.', text:'Review a focused patch, run verification, and compare the before with the after.', detail:'THE RESURRECTION' }].map(step => <article className="workflow-card" key={step.n}><div className="step-top"><step.icon size={25} strokeWidth={1.4} /><span>{step.n}</span></div><div className="step-detail">{step.detail}</div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></div></section>

      <section className="specimens-section landing-wrap"><div className="section-heading"><div><div className="section-kicker">03 / THE GRAVEYARD</div><h2>Some code is waiting<br />for a second chance.</h2></div><Link href="/graveyard" className="text-link">Explore the graveyard <ArrowUpRight size={17} /></Link></div><div className="specimen-list">{[{id:'sample-broken-app',name:'markdown-tomb-parser',year:'2016',text:'Deprecated Buffer API & broken imports',tag:'JavaScript',color:'#dfc574'},{id:'express-vintage-2016',name:'auth-vault-microservice',year:'2017',text:'Legacy OAuth & obsolete crypto APIs',tag:'Node.js',color:'#a4f4b8'},{id:'angularjs-tombstone',name:'dash-metrics-angular',year:'2015',text:'AngularJS & broken Node-Sass bindings',tag:'AngularJS',color:'#d99d94'}].map((repo, index) => <Link className="specimen-row" href={'/lab/'+repo.id} key={repo.id}><div className="specimen-art" aria-hidden="true"><div className="specimen-art-image" style={{ backgroundPosition: `${index * 50}% center` }} /><span className="art-index">COLLECTION / 00{index + 1}</span><span className="art-status"><span /> AWAITING REVIVAL</span></div><div className="specimen-info"><h3>{repo.name}</h3><p>{repo.text}</p></div><span className="language-tag"><i style={{background:repo.color}} />{repo.tag}</span><div className="specimen-card-footer"><span className="specimen-year">DORMANT SINCE {repo.year}</span><span className="specimen-open">Open specimen <ArrowUpRight className="specimen-arrow" size={16} /></span></div></Link>)}</div></section>

      <section className="final-section landing-wrap"><div className="section-kicker"><Cpu size={14} /> LOCAL INTELLIGENCE. LASTING POTENTIAL.</div><h2>The code isn’t gone.<br /><span>Neither is the possibility.</span></h2><a href="#resurrect" className="landing-button primary">Give it a second life <ArrowUpRight size={18} /></a><p>Powered by Gemma 3 & Mastra. Built for the comeback.</p></section>
    </div>
  );
}

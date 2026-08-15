const fs = require('fs');

const LOGO = 'data:image/webp;base64,' + fs.readFileSync('/home/user/App/logo.webp').toString('base64');

const STARS = [
  [12,12,1.5,.8],[28,6,1,.5],[65,5,1.5,.6],[80,14,1,.5],[92,8,1.5,.7],
  [6,30,1,.4],[95,28,1.5,.6],[4,55,1,.4],[93,50,1.5,.5],[15,68,1,.35],
  [88,70,1.5,.45],[40,78,1,.3],[70,88,1.5,.4],[25,92,1,.3],[55,95,1.5,.35],
  [48,22,1,.4],[8,44,1.2,.35],[72,36,1,.45],[36,60,1.2,.3],[60,66,1,.35],
].map(([x,y,r,a]) => `radial-gradient(${r}px ${r}px at ${x}% ${y}%, rgba(255,255,255,${a}), transparent)`).join(', ');

const STEPS = [
  { n: '1', emoji: '👥', title: 'Open a room',            body: 'Share the code with friends — or join a public lobby.' },
  { n: '2', emoji: '🤫', title: 'Pick a secret word',     body: 'One category, everyone picks their own word. Keep it to yourself.' },
  { n: '3', emoji: '❓', title: 'Ask yes / no questions', body: 'Take turns. Everyone answers honestly about their own word.' },
  { n: '4', emoji: '📝', title: 'Collect the clues',      body: 'Every answer lands in your notebook automatically.' },
  { n: '5', emoji: '🏆', title: 'Guess it first',         body: 'Crack someone’s word and score a point. Most points wins.' },
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>What's My Pick — Story</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1920px; }
  body {
    font-family: "Liberation Sans", "DejaVu Sans", sans-serif;
    background:#07040f;
    color:#fff;
    overflow:hidden;
    position:relative;
  }
  .layer { position:absolute; inset:0; }
  .stars { background-image:${JSON.stringify(STARS).slice(1,-1).replace(/\\"/g,'"')}; background-size:100% 100%; opacity:.75; }

  .frame {
    position:absolute; left:0; right:0;
    top:210px; bottom:200px;           /* Instagram safe area */
    display:flex; flex-direction:column; align-items:center;
    padding:0 74px;
  }

  .logo { width:472px; display:block; filter:drop-shadow(0 22px 46px rgba(146,84,255,.5)); }

  .tagline {
    margin-top:16px;
    font-size:34px; font-weight:700; letter-spacing:.2px;
    color:#d7c9f5; text-align:center; line-height:1.32;
  }
  .tagline b { color:#ffc53d; font-weight:700; }

  .rule {
    margin:26px 0 22px;
    display:flex; align-items:center; gap:20px;
  }
  .rule i { display:block; width:120px; height:2px; background:linear-gradient(90deg, transparent, rgba(178,140,255,.65)); }
  .rule i:last-child { background:linear-gradient(90deg, rgba(178,140,255,.65), transparent); }
  .rule span {
    font-size:26px; font-weight:700; letter-spacing:6px; color:#b28cff; text-transform:uppercase;
  }

  .steps { width:100%; display:flex; flex-direction:column; gap:16px; margin-bottom:18px; }

  .step {
    display:flex; align-items:center; gap:24px;
    padding:22px 28px;
    border-radius:24px;
    background:linear-gradient(135deg, rgba(255,255,255,.085), rgba(255,255,255,.035));
    border:1.5px solid rgba(178,140,255,.26);
    box-shadow:0 16px 40px rgba(0,0,0,.42);
  }
  .num {
    flex:0 0 auto;
    width:68px; height:68px; border-radius:20px;
    display:flex; align-items:center; justify-content:center;
    font-size:36px; font-weight:700; color:#2a1300;
    background:linear-gradient(160deg,#ffd75e,#f5a300);
    box-shadow:0 8px 20px rgba(245,163,0,.36), inset 0 -4px 0 rgba(0,0,0,.16);
  }
  .txt { flex:1 1 auto; min-width:0; }
  .txt h3 {
    font-size:35px; font-weight:700; line-height:1.15; color:#fff;
    display:flex; align-items:center; gap:13px;
  }
  .txt h3 em { font-style:normal; font-size:36px; line-height:1; }
  .txt p { margin-top:6px; font-size:26px; line-height:1.34; color:#b9abd6; font-weight:400; }

  .example {
    margin-top:auto; margin-bottom:14px;
    width:100%;
    display:flex; align-items:center; gap:20px;
    padding:20px 26px; border-radius:22px;
    background:linear-gradient(135deg, rgba(255,197,61,.13), rgba(255,197,61,.05));
    border:1.5px solid rgba(255,197,61,.28);
  }
  .example .tag {
    flex:0 0 auto;
    font-size:21px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase;
    color:#ffc53d; writing-mode:horizontal-tb;
  }
  .example .qa { flex:1 1 auto; font-size:26px; line-height:1.42; color:#e6dcff; font-weight:400; }
  .example .qa b { color:#fff; font-weight:700; }
  .example .qa u { text-decoration:none; color:#8ee6a0; font-weight:700; }
  .example .qa s { text-decoration:none; color:#ff8a8a; font-weight:700; }

  .footer { margin-top:0; padding-top:30px; width:100%; display:flex; flex-direction:column; align-items:center; gap:18px; }
  .chips { display:flex; gap:14px; }
  .chip {
    padding:12px 24px; border-radius:999px;
    font-size:25px; font-weight:700; color:#e4d9ff;
    background:rgba(178,140,255,.14);
    border:1.5px solid rgba(178,140,255,.34);
  }
  .cta {
    font-size:32px; font-weight:700; color:#ffc53d; letter-spacing:.3px;
  }
</style>
</head>
<body>
  <div class="layer" style="background:radial-gradient(ellipse 120% 38% at 50% -8%, rgba(255,255,255,.05), transparent 60%)"></div>
  <div class="layer" style="background:radial-gradient(ellipse 52% 22% at 50% 13%, rgba(160,100,255,.44), transparent 68%)"></div>
  <div class="layer" style="background:radial-gradient(ellipse 90% 55% at 50% 15%, rgba(140,90,220,.22), transparent 70%)"></div>
  <div class="layer" style="background:radial-gradient(ellipse 100% 60% at 50% 100%, rgba(70,32,140,.20), transparent 62%)"></div>
  <div class="layer stars"></div>
  <div class="layer" style="box-shadow:inset 0 0 290px rgba(0,0,0,.92)"></div>

  <div class="frame">
    <img class="logo" src="${LOGO}" alt="What's My Pick!">

    <p class="tagline">Everyone hides a <b>secret word</b>.<br>First to guess it wins.</p>

    <div class="rule"><i></i><span>How it works</span><i></i></div>

    <div class="steps">
      ${STEPS.map(s => `
      <div class="step">
        <div class="num">${s.n}</div>
        <div class="txt">
          <h3><em>${s.emoji}</em>${s.title}</h3>
          <p>${s.body}</p>
        </div>
      </div>`).join('')}
    </div>

    <div class="example">
      <div class="tag">Like<br>this</div>
      <div class="qa">
        Category <b>Pets</b> · “Does it have fur?” <u>Yes</u> · “Is it bigger than a cat?” <s>No</s> →
        <b>“Is it a hamster?”</b> 🏆
      </div>
    </div>

    <div class="footer">
      <div class="chips">
        <div class="chip">2–12 players</div>
        <div class="chip">Free to play</div>
        <div class="chip">No account</div>
      </div>
      <div class="cta">🔗 Link in bio · play free</div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(process.argv[2], html);
console.log('wrote', process.argv[2], (html.length/1024).toFixed(0)+'KB');

// Checks for workflow/approve-text-follow-up-sms.json.
// Runs the Code node source straight out of the workflow file, with n8n's globals stubbed and the clock
// frozen, through the whole life of a request: request, page, approve, texts, follow-ups, replies, STOP.
//   cd tests && npm install && node outreach.test.js
const path = require('path');
const { DateTime, Settings } = require('luxon');
const WF = process.env.WF2 || path.join(__dirname, '..', 'workflow', 'approve-text-follow-up-sms.json');
const wf = require(WF);
const src = name => wf.nodes.find(x => x.name === name).parameters.jsCode;
const J = x => ({ json: x });
function run(name, { nodes = {}, state, input = [] }) {
  const $ = n => ({ isExecuted: n in nodes, first: () => { if (!(n in nodes)) throw new Error('unexecuted ' + n); return nodes[n][0]; }, all: () => nodes[n] || [] });
  const $input = { all: () => input, first: () => input[0] };
  const $json = (input[0] && input[0].json) || {};
  return new Function('$', '$json', '$input', 'DateTime', '$getWorkflowStaticData', '"use strict";\n' + src(name))($, $json, $input, DateTime, () => state);
}
const freeze = iso => { const ms = DateTime.fromISO(iso, { zone: 'America/New_York' }).toMillis(); Settings.now = () => ms; };
let pass = 0, fail = 0;
const t = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra, null, 1).slice(0, 1500) : ''); } };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

const KEY = 'test-key-1234567890';
const SETTINGS = {
  business_name: 'Test Roofing', business_number: '+15551230100', owner_cell: '+15551230199', timezone: 'America/New_York',
  n8n_url: 'https://test.app.n8n.cloud/', request_key: KEY, require_consent: true, cooldown_days: 30, followup_days: '2, 5',
  followup_1: 'Hi {first_name}, {business_name} again, following up on our text from {sent_day}. If you would like a hand, just reply here.',
  followup_2: 'Last check-in from {business_name}, {first_name}. If you need anything, reply here any time.',
  optout_line: 'Reply STOP to opt out.', customer_hours_start: '09:00', customer_hours_end: '20:00', quiet_start: '21:00', quiet_end: '07:00',
  approval_hours: 48, max_per_run: 40, send_email: false, email_subject: 'A quick note from {business_name}',
};
const TRIG = { request: 'New outreach request', page: 'Approval page opened', decide: 'Approve or cancel', reply: 'Customer replied' };
const settingsRun = (mode, input, settings = {}) => {
  const nodes = { 'Your settings': [J({ ...SETTINGS, ...settings })] };
  if (mode !== 'tick') nodes[TRIG[mode]] = [J(input)];
  return run('Read your settings', { nodes, state: {} })[0].json;
};
// One full run of a branch, the way n8n would do it.
function flow(mode, input, st, twilio = () => ({ sid: 'SM' + Math.random().toString(36).slice(2, 8) }), settings = {}) {
  const r = settingsRun(mode, input, settings);
  const nodes = { 'Read your settings': [J(r)] };
  let out = {};
  if (mode === 'request') out.answer = run('Take the request', { nodes, state: st })[0].json;
  if (mode === 'page' || mode === 'decide') return run('Show or change the request', { nodes, state: st })[0].json;
  if (mode === 'reply') out.reply = run('Read the reply', { nodes, state: st })[0].json;
  const due = run('Texts that are due', { nodes, state: st })[0].json;
  out.due = due;
  if (due.texts.length) {
    const items = due.texts.map(J);
    const answers = due.texts.map(x => J(twilio(x)));
    out.record = run('Record what went out', { nodes: { ...nodes, 'One item per text': items }, input: answers, state: st })[0].json;
  }
  return out;
}
const req = (customers, extra = {}) => ({ body: { key: KEY, title: 'Hail near 3 past customers (Mon May 19)', summary: 'Hail up to 1.75 in reported...', message: 'Hi {first_name}, this is Test Roofing. Hail was reported near your home. Want a free look? Reply YES.', customers, source: 'weather-hail', ...extra } });
const CUST = [
  { name: 'Ann Near', phone: '555-123-0001', email: 'ann@test.example', ok_to_text: true, detail: '0.8 mi' },
  { name: 'Bob NoConsent', phone: '5551230002', ok_to_text: false },
  { name: 'Cy NoPhone', phone: '', ok_to_text: true },
  { name: 'Dee Yes', phone: '+15551230005', ok_to_text: 'yes' },
  { name: 'Ann Again', phone: '(555) 123-0001', ok_to_text: true },
];

// ---------- settings ----------
t('S1 blank phone numbers refused', throws(() => settingsRun('tick', {}, { owner_cell: '' }), /must both be filled in/));
t('S2 n8n address required', throws(() => settingsRun('tick', {}, { n8n_url: 'https://your-instance.app.n8n.cloud' }), /n8n_url/));
t('S3 weak request key refused', throws(() => settingsRun('tick', {}, { request_key: 'change-me-to-a-long-random-phrase' }), /request_key/));
t('S4 modes', settingsRun('request', { body: {} }).mode === 'request' && settingsRun('reply', { body: {} }).mode === 'reply' && settingsRun('tick').mode === 'tick');
t('S5 follow-up steps from followup_days', JSON.stringify(settingsRun('tick').cfg.steps.map(s => s.after_days)) === '[2,5]' && settingsRun('tick', {}, { followup_days: '' }).cfg.steps.length === 0);

// ---------- request ----------
{
  const st = {};
  freeze('2025-05-19T19:00');
  t('Q1 wrong key refused', flow('request', { body: { ...req(CUST).body, key: 'nope' } }, st).answer.status_code === 403 && !st.req || Object.keys(st.req || {}).length === 0);
  t('Q2 missing message refused', flow('request', req(CUST, { message: '' }), st).answer.status_code === 400);
  const a = flow('request', req(CUST), st, () => ({ sid: 'SM1' }));
  const ans = a.answer.answer;
  t('Q3 two can be texted, the rest skipped with reasons', ans.ok && ans.eligible === 2 && ans.skipped.not_ok_to_text === 1 && ans.skipped.no_phone === 1 && ans.skipped.listed_twice === 1, ans);
  t('Q4 you get the approval link right away', a.due.texts.length === 1 && a.due.texts[0].kind === 'owner' && a.due.texts[0].to === '+15551230199' && /Ready to text 2 of them \(skipped: 1 no phone, 1 not ok to text, 1 listed twice\)\. Nothing goes out until you approve:\nhttps:\/\/test\.app\.n8n\.cloud\/webhook\/outreach-approve\?r=[a-z0-9]{8}&c=[a-z0-9]{24}$/.test(a.due.texts[0].body), a.due.texts[0]);
  t('Q5 sent owner text cleared', st.owner.length === 0);
  const id = ans.id, code = st.req[id].code;

  // ---------- page ----------
  const bad = flow('page', { query: { r: id, c: 'wrong' } }, st);
  t('P1 wrong code shows nothing', /This link does not work/.test(bad.html) && !/Ann/.test(bad.html));
  const pg = flow('page', { query: { r: id, c: code } }, st);
  t('P2 page shows the first text as a customer sees it, with STOP line, and the buttons', /Hi Ann, this is Test Roofing\. Hail was reported near your home\. Want a free look\? Reply YES\. Reply STOP to opt out\./.test(pg.html) && /Approve and send to 2/.test(pg.html) && /method="post"/.test(pg.html), pg.html.slice(0, 400));
  t('P3 opening the page changes nothing', st.req[id].status === 'waiting' && !Object.keys(st.cad || {}).length);
  const ev = flow('request', req([{ name: '<script>x</script>', phone: '5551230009', ok_to_text: true }], { title: 'T <b>' }), st, () => ({ sid: 'SMx' }));
  const pg2 = flow('page', { query: { r: ev.answer.answer.id, c: st.req[ev.answer.answer.id].code } }, st);
  t('P4 names and titles are escaped', !/<script>/.test(pg2.html) && /&lt;script&gt;/.test(pg2.html) && /T &lt;b&gt;/.test(pg2.html));

  // ---------- approve at 7 PM: texts go at once, inside customer hours ----------
  const ap = flow('decide', { body: { r: id, c: code, a: 'approve' } }, st);
  t('A1 approved, first text within 10 minutes', /Approved\. 2 customers will get the first text within 10 minutes\./.test(ap.html) && st.req[id].status === 'approved', ap.html.slice(0, 300));
  const again = flow('decide', { body: { r: id, c: code, a: 'approve' } }, st);
  t('A2 a second press changes nothing', /Nothing changed: this request is approved/.test(again.html) && Object.values(st.cad).filter(c => c.req === id).length === 2);
  freeze('2025-05-19T19:10');
  const d1 = flow('tick', {}, st);
  const toAnn = d1.due.texts.find(x => x.to === '+15551230001');
  t('D1 both get the first text, with the opt-out line', d1.due.texts.filter(x => x.kind === 'customer').length === 2 && /^Hi Ann, this is Test Roofing\..* Reply STOP to opt out\.$/.test(toAnn.body), d1.due.texts);
  const ann = st.cad[id + '|+15551230001'];
  t('D2 next step two days later, snapped into customer hours', ann.step === 1 && ann.next === DateTime.fromISO('2025-05-21T19:10', { zone: 'America/New_York' }).toISO() && ann.status === 'active', ann);
  freeze('2025-05-19T19:20');
  t('D3 nothing due ten minutes later', flow('tick', {}, st).due.texts.length === 0);

  // ---------- Ann replies, Dee says STOP ----------
  freeze('2025-05-19T23:30');
  const rp = flow('reply', { body: { From: '+15551230001', Body: 'Yes please, the back side took a beating' } }, st);
  t('R1 reply ends her follow-ups and is held for your morning', rp.reply.outcome === 'passed to you' && ann.status === 'replied' && rp.due.texts.length === 0 && st.owner.length === 1 && /Ann Near replied about "Hail near 3 past customers \(Mon May 19\)":\n"Yes please, the back side took a beating"\nCall or text them back: \+15551230001/.test(st.owner[0].body), st.owner);
  t('R2 empty TwiML answer', rp.reply.twiml === '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  freeze('2025-05-20T07:00');
  const morning = flow('tick', {}, st);
  t('R3 your held text goes at 7 AM', morning.due.texts.length === 1 && morning.due.texts[0].kind === 'owner' && st.owner.length === 0);
  const stop = flow('reply', { body: { From: '5551230005', Body: ' stop ' } }, st);
  t('R4 STOP opts out and ends follow-ups', stop.reply.outcome === 'opted out' && st.optout['+15551230005'] && st.cad[id + '|+15551230005'].status === 'stopped');
  const stranger = flow('reply', { body: { From: '5551239999', Body: 'who is this' } }, st);
  t('R5 a text from someone not in any outreach is left alone', stranger.reply.outcome === 'ignored' && st.owner.length === 0);

  // ---------- wrap-up ----------
  freeze('2025-05-20T08:00');
  const w = flow('tick', {}, st);
  t('W1 wrap-up when nobody is active', w.due.texts.length === 1 && /^Finished: "Hail near 3 past customers \(Mon May 19\)"\. 2 texted: 1 replied, 1 opted out\./.test(w.due.texts[0].body), w.due.texts);
  freeze('2025-05-20T08:10');
  t('W2 wrap-up only once', flow('tick', {}, st).due.texts.length === 0);

  // ---------- a later request: cooldown and opt-out ----------
  freeze('2025-05-25T10:00');
  const later = flow('request', req(CUST), st, () => ({ sid: 'SM9' })).answer.answer;
  t('C1 opted out and recently texted are skipped next time', later.eligible === 0 && later.skipped.opted_out === 1 && later.skipped.contacted_recently === 1, later);
}

// ---------- follow-ups, quiet hours, refusals ----------
{
  const st = {};
  freeze('2025-06-02T21:30');
  const a = flow('request', req([{ name: 'Eve Late', phone: '5551230007', ok_to_text: true }]), st, () => ({ sid: 'SM1' }));
  t('F1 request at 9:30 PM holds your text', a.due.texts.length === 0 && st.owner.length === 1);
  const id = a.answer.answer.id;
  const ap = flow('decide', { body: { r: id, c: st.req[id].code, a: 'approve' } }, st);
  t('F2 approved at night: first text waits for 9 AM', /at Tue 9:00 AM/.test(ap.html), ap.html.slice(0, 300));
  freeze('2025-06-03T07:00');
  let d = flow('tick', {}, st);
  t('F3 7 AM: only your held text, customer still waits', d.due.texts.length === 1 && d.due.texts[0].kind === 'owner');
  freeze('2025-06-03T09:00');
  d = flow('tick', {}, st, () => ({ code: 30001, message: 'Queue overflow' }));
  const eve = st.cad[id + '|+15551230007'];
  t('F4 refused text is tried again', eve.tries === 1 && eve.step === 0 && eve.status === 'active');
  freeze('2025-06-03T09:10');
  d = flow('tick', {}, st);
  t('F5 then goes out', eve.step === 1 && eve.tries === 0);
  freeze('2025-06-05T09:10');
  d = flow('tick', {}, st);
  t('F6 first follow-up two days later names the day of the first text', /following up on our text from Tuesday/.test(d.due.texts[0].body), d.due.texts);
  freeze('2025-06-10T09:10');
  d = flow('tick', {}, st);
  t('F7 second follow-up five days after that, then done', /^Last check-in from Test Roofing, Eve\./.test(d.due.texts[0].body) && eve.status === 'done', d.due.texts);
  freeze('2025-06-10T09:20');
  d = flow('tick', {}, st);
  t('F8 wrap-up counts no answer', /1 texted: 1 no answer after every follow-up/.test(d.due.texts[0].body), d.due.texts);
  freeze('2025-06-12T12:00');
  const late = flow('reply', { body: { From: '+15551230007', Body: 'Sorry just saw this' } }, st);
  t('F9 a reply after the last follow-up still reaches you', late.reply.outcome === 'passed to you');
}
{
  const st = {};
  freeze('2025-06-02T10:00');
  const a = flow('request', req([{ name: 'Quick Test', phone: '5551230020', ok_to_text: true }]), st, () => ({ sid: 'SM1' }), { followup_days: '0.002' });
  const id = a.answer.answer.id;
  flow('decide', { body: { r: id, c: st.req[id].code, a: 'approve' } }, st, undefined, { followup_days: '0.002' });
  freeze('2025-06-02T10:01');
  flow('tick', {}, st, undefined, { followup_days: '0.002' });
  freeze('2025-06-02T10:05');
  const d = flow('tick', {}, st, undefined, { followup_days: '0.002' });
  t('F10 a same-day follow-up says earlier today', /following up on our text from earlier today/.test(d.due.texts[0].body), d.due.texts);
}
{
  const st = {};
  freeze('2025-06-02T10:00');
  const a = flow('request', req([{ name: 'Gus Carrier', phone: '5551230008', ok_to_text: true }, { name: 'Hal Bad', phone: '5551230010', ok_to_text: true }]), st, () => ({ sid: 'SM1' }));
  const id = a.answer.answer.id;
  flow('decide', { body: { r: id, c: st.req[id].code, a: 'approve' } }, st);
  freeze('2025-06-02T10:10');
  flow('tick', {}, st, x => x.to === '+15551230008' ? { code: 21610, message: 'Attempt to send to unsubscribed recipient' } : { code: 21211, message: 'Invalid To' });
  t('E1 21610 is treated like STOP', st.cad[id + '|+15551230008'].status === 'stopped' && st.optout['+15551230008']);
  t('E2 invalid number fails at once', st.cad[id + '|+15551230010'].status === 'failed');
}
{
  const st = {};
  freeze('2025-06-02T10:00');
  const a = flow('request', req([{ name: 'Ivy', phone: '5551230011', ok_to_text: true }]), st, () => ({ sid: 'SM1' }));
  const id = a.answer.answer.id;
  const c = flow('decide', { body: { r: id, c: st.req[id].code, a: 'cancel' } }, st);
  t('X1 cancel', /Cancelled/.test(c.html) && st.req[id].status === 'cancelled');
  const b = flow('request', req([{ name: 'Jo', phone: '5551230012', ok_to_text: true }]), st, () => ({ sid: 'SM1' }));
  freeze('2025-06-04T11:00');
  const pg = flow('page', { query: { r: b.answer.answer.id, c: st.req[b.answer.answer.id].code } }, st);
  t('X2 unapproved request expires after approval_hours', /Status: <b>expired<\/b>/.test(pg.html) && !/Approve and send/.test(pg.html));
  const d = flow('request', req([{ name: 'Kay', phone: '5551230013', ok_to_text: true, email: 'kay@test.example' }]), st, () => ({ sid: 'SM1' }), { send_email: true });
  const kid = d.answer.answer.id;
  flow('decide', { body: { r: kid, c: st.req[kid].code, a: 'approve' } }, st, undefined, { send_email: true });
  freeze('2025-06-04T11:10');
  const tk = flow('tick', {}, st, undefined, { send_email: true });
  t('X3 email goes with the text when send_email is on and there is an address', tk.due.emails.length === 1 && tk.due.emails[0].to === 'kay@test.example' && tk.due.emails[0].subject === 'A quick note from Test Roofing', tk.due);
  const pg3 = flow('decide', { body: { r: kid, c: st.req[kid].code, a: 'stop' } }, st);
  t('X4 stop all follow-ups', /Stopped\. 1 customer will not get any more texts/.test(pg3.html) && st.cad[kid + '|+15551230013'].status === 'stopped by you');
  const noConsent = flow('request', req([{ name: 'Lu', phone: '5551230014' }]), st, () => ({ sid: 'SM1' }), { require_consent: false });
  t('X5 require_consent off lets unmarked customers through', noConsent.answer.answer.eligible === 1);
}

// ---------- the file itself ----------
{
  const raw = JSON.stringify(wf);
  t('Z1 ships with no credentials', !wf.nodes.some(n => n.credentials));
  const params = JSON.stringify(wf.nodes.map(n => n.parameters));
  t('Z2 no phone numbers or email addresses anywhere in the node settings or code', !/\+\d{8,15}\b|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/.test(params) && !/[\w.]+@[\w-]+\.[a-z]{2,}/i.test(params), (params.match(/\+\d{8,15}\b|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b|[\w.]+@[\w-]+\.[a-z]{2,}/i) || [])[0]);
  const stickies = wf.nodes.filter(n => n.type.includes('stickyNote'));
  const words = t => (t.match(/[A-Za-z0-9_']+/g) || []).length;
  const main = stickies.filter(n => n.parameters.color === 1);
  t('Z4 one yellow main note, 100 to 300 words, with How it works and Setup steps', main.length === 1 && words(main[0].parameters.content) >= 100 && words(main[0].parameters.content) <= 300 && /How it works/.test(main[0].parameters.content) && /Setup steps/.test(main[0].parameters.content), main.map(n => words(n.parameters.content)));
  t('Z5 every other note is 50 words or less', stickies.filter(n => n.parameters.color !== 1).every(n => words(n.parameters.content) <= 50), stickies.map(n => words(n.parameters.content)));
  const R = n => [n.position[0], n.position[1], n.position[0] + n.parameters.width, n.position[1] + n.parameters.height];
  const hit = (a, b) => !(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]);
  t('Z6 no two notes overlap', stickies.every((a, i) => stickies.every((b, j) => j <= i || !hit(R(a), R(b)))));
  const sections = stickies.filter(n => n.parameters.color === 7);
  t('Z7 every working node sits inside exactly one section note', wf.nodes.filter(n => !n.type.includes('stickyNote')).every(n => sections.filter(sn => { const r = R(sn); return r[0] <= n.position[0] && n.position[0] + 100 <= r[2] && r[1] <= n.position[1] && n.position[1] + 100 <= r[3]; }).length === 1));
  t('Z8 the main note is at the top left: no note starts above it, and only the test note shares its column', stickies.every(n => n === main[0] || (n.position[1] >= main[0].position[1] && (main[0].position[0] + main[0].parameters.width <= n.position[0] || (n.parameters.color === 4 && n.position[1] >= main[0].position[1] + main[0].parameters.height)))));
  t('Z3 every node has a real name and the main note is yellow', !wf.nodes.some(n => /^(Code|HTTP Request|If|Set|Webhook)\d*$/.test(n.name)) && wf.nodes.find(n => n.name === 'Sticky Note').parameters.color === 1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

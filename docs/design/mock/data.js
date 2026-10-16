// Example content shared by the mock-ups. Not real claims.
window.MOCK = {
  runs: [
    { code: 'R01', launch: true, featured: true, status: 'in-service', title: 'Landing zone rebuild', desc: 'A UK financial-services organisation', period: '2024 – 2025', setup: 'Forty subscriptions built by hand, each slightly different.', change: 'A Bicep landing zone with policy guardrails and pipeline-driven subscription vending.', result: 'New environments in under an hour, down from three weeks.', headline: 'Weeks to under an hour', stat: '3 wk', statTo: '<1 hr', statLabel: 'to a new environment' },
    { code: 'R02', status: 'in-service', title: 'Release pipeline overhaul', desc: 'A public-sector body', period: '2023', setup: 'Monthly releases, run by hand from a checklist.', change: 'Multi-stage pipelines with automated tests and approval gates.', result: 'Teams deploy several times a week; rollback takes minutes.', headline: 'Monthly to on demand', stat: '1/mo', statTo: '4/wk', statLabel: 'releases' },
    { code: 'R03', status: 'complete', title: 'Observability baseline', desc: 'A UK financial-services organisation', period: '2022', setup: 'Most incidents were reported by users first.', change: 'A shared Log Analytics workspace, dashboards and SLO-based alerts.', result: 'Most incidents now caught before users notice.', headline: 'Alerts before users', stat: '70%', statTo: '', statLabel: 'of incidents caught before users' },
    { code: 'R04', launch: true, status: 'commissioning', title: 'This website', desc: 'Personal project, open source', period: '2026', setup: 'Experience lived in a CV and a LinkedIn profile.', change: 'Static Astro site, hosting in Bicep, CI/CD on GitHub Actions to Azure Static Web Apps.', result: 'Every push ships through checks; every pull request gets a preview.', headline: 'Ships on every push', stat: '0', statTo: '', statLabel: 'manual deploys' },
    { code: 'R05', status: 'archived', title: 'Cost visibility reports', desc: 'A public-sector body', period: '2021', setup: 'Cloud spend reviewed once a quarter, by finance.', change: 'Tagging policy and weekly cost reports per team.', result: 'Teams own their spend; idle resources cleared monthly.', headline: 'Spend owned by teams', stat: '12×', statTo: '', statLabel: 'more often reviewed' }
  ],
  skills: [
    { name: 'Platform', runs: ['R01', 'R04'], context: 'Designing and running production platforms on Azure for regulated organisations.', tools: ['Azure', 'AKS', 'App Service', 'Functions', 'Front Door'] },
    { name: 'Infrastructure as code', runs: ['R01', 'R04'], context: 'Every environment defined in code and reviewed like code, with policy checks before anything deploys.', tools: ['Bicep', 'Terraform', 'Azure Policy'] },
    { name: 'Delivery', runs: ['R02', 'R04'], context: 'Release pipelines that let teams ship often, with tests and approvals built in rather than bolted on.', tools: ['Azure DevOps Pipelines', 'GitHub Actions'] },
    { name: 'Observability', runs: ['R03'], context: 'Monitoring that tells the team about a problem before their users do.', tools: ['Azure Monitor', 'Log Analytics', 'Application Insights'] },
    { name: 'Scripting', runs: [], context: 'The glue between all of the above, from one-off fixes to tooling teams rely on.', ph: 'One line on where you\'ve used it.', tools: ['PowerShell', 'Bash', 'Python'] }
  ],
  exploring: ['Internal developer platforms that make the right way the easy way', 'Policy as code beyond Azure Policy', 'Making cloud cost visible to the people who spend it'],
  certs: [
    { title: 'Example certification name (code)', issuer: 'Issuer', date: '2025', verify: true },
    { title: 'Example certification name (code)', issuer: 'Issuer', date: '2024', verify: true },
    { title: 'Example milestone: a talk, award or open-source release', issuer: 'Where', date: '2023', verify: false }
  ],
  garage: [
    { name: 'Cars', note: 'Example: what you drive, restore or follow, and the meets you go to.' },
    { name: 'Trucks', note: 'Example: what draws you to trucks, whether the engineering, the shows or the haulage world.' },
    { name: 'Tractors', note: 'Example: vintage or working, a favourite model, a rally you never miss.' }
  ]
};

// Mock controls shared by B and C: project count and placeholder view.
window.mockControls = function (onChange) {
  const bar = document.querySelector('.mockbar');
  const body = document.body;
  try {
    const saved = JSON.parse(localStorage.getItem('ll-mock') || '{}');
    if (saved.count) body.dataset.count = saved.count;
    if (saved.ph) body.setAttribute('data-ph', '');
  } catch {}
  const sync = () => {
    if (!bar) return;
    bar.querySelectorAll('[data-count]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.count === (body.dataset.count || '2'))));
    const p = bar.querySelector('[data-ph-toggle]');
    if (p) p.setAttribute('aria-pressed', String(body.hasAttribute('data-ph')));
  };
  bar && bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.count) body.dataset.count = b.dataset.count;
    if (b.hasAttribute('data-ph-toggle')) body.toggleAttribute('data-ph');
    try { localStorage.setItem('ll-mock', JSON.stringify({ count: body.dataset.count, ph: body.hasAttribute('data-ph') })); } catch {}
    sync();
    onChange();
  });
  sync();
};

window.mockRuns = function () {
  const count = Number(document.body.dataset.count || 2);
  return window.MOCK.runs.filter((r) => count >= 5 || r.launch);
};

window.mockPh = function (on, real, fake) {
  return on ? `<span class="ph"><span class="vh">Placeholder: </span>${fake}</span>` : real;
};

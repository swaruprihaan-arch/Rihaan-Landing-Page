/* Brick Route · turns the chosen state into a route: one status per module,
   a verdict, a planned ledger and a detailed Markdown plan for download. */

const Route = (() => {
  const REVIEW_DATE = '26 September 2026';

  /* DE engines: MAST between all groups is always offered; edgeR pseudobulk and NEBULA
     are always offered; dreamlet joins only when the cohort exceeds 30 samples. */
  function engines(s) {
    const e = [
      { name: 'MAST (Seurat FindMarkers)', role: 'Seurat-style MAST between all possible groups, every pairwise comparison, cell-level. Exploratory unless a donor-aware model is fitted explicitly.', when: 'always' },
      { name: 'edgeR', role: 'Quasi-likelihood on pseudobulk counts per experimental unit × cell type' + (s.repeated ? ', donor as block' : '') + '.', when: 'always' },
      { name: 'NEBULA', role: 'Negative-binomial mixed model on observed cell-level counts with subject dependence.', when: 'always' },
    ];
    if (s.units > 30) e.push({ name: 'dreamlet', role: 'Precision-weighted mixed model with a donor random intercept.', when: 'cohort > 30 samples' });
    return e;
  }

  function compute(s) {
    const rna = s.assay === 'rna' || s.assay === 'multi';
    const atac = s.assay === 'atac' || s.assay === 'multi';
    const sp = s.assay === 'spatial';
    const st = {}, why = {};
    const set = (id, status, reason) => { st[id] = status; why[id] = reason; };

    set('M00', 'REQ', 'Every study is validated at intake: assay, chemistry, starting stage and design.');
    set('M01', s.start === 'raw' ? 'REQ' : 'NA', s.start === 'raw' ? `Raw files enter the platform-specific vendor pipeline${s.material === 'nuclei' && rna ? '; intronic reads are counted for nuclei' : ''}.` : 'The study starts downstream of primary processing; vendor outputs are validated and reused.');
    set('M02', 'REQ', 'Canonical objects with immutable observed counts and a documented representation policy.');
    set('M03', s.identityBlocked ? 'BLK' : 'REQ', s.identityBlocked ? 'Donor identifiers are missing from the manifest. Complete samples.tsv before any donor-level analysis.' : s.pooled ? 'Genotype or tag demultiplexing, matched to known donors; the capture stays the background and collision unit.' : 'Identity by capture or section; modality pairing verified where relevant.');

    if (rna) {
      const cb = s.cb === 'blk' ? 'BLK' : s.cb === 'val' ? 'VAL' : 'REQ';
      set('M04', cb, cb === 'BLK' ? 'No unfiltered background barcodes are available. Recover them, or label every downstream result EXPLORATORY_NONCOMPLIANT.' : cb === 'VAL' ? 'The CellBender adapter and model fit must be validated for this chemistry before compliance can be declared.' : 'Run cellbender remove-background per background_unit_id before final cell QC and integration; keep observed counts.');
      set('M06', 'REQ', s.material === 'cells' ? 'Scanpy QC for whole cells: mitochondrial fraction, counts and genes per cell from each capture’s distribution; reason-coded flags.' : 'Scanpy QC for nuclei: intronic fraction and depth, low mitochondrial fraction expected, ambient debris reviewed after CellBender; reason-coded flags.');
      set('M05', 'REQ', 'scanpy.pp.scrublet on observed unnormalized counts per doublet_unit_id; corrected-count sensitivity when material.');
    } else {
      set('M04', 'NA', sp ? 'Imaging cells, spots and bins are not droplets. Ambient correction is not the question here.' : 'ATAC-only data has no RNA background to model.');
      set('M06', 'NA', 'No RNA modality.');
      set('M05', atac ? 'REQ' : 'NA', atac ? 'snapatac2.pp.scrublet on accessibility, not the RNA wrapper.' : 'Merged boundaries and misassigned transcripts are handled by segmentation and lineage-mixing QC, not a doublet screen.');
    }

    set('M07', atac ? (s.noFragments ? 'VAL' : 'REQ') : 'NA', atac ? (s.noFragments ? 'Peak matrix only: no fragment-level QC or peak recalling. Genome build, coordinates and count definition must be validated.' : 'Fragment and barcode QC, balanced pseudobulk peak calling with MACS3, one consensus feature set, recount every cell.') : 'No ATAC modality.');
    set('M08', sp ? 'REQ' : 'NA', sp ? (s.seg ? 'Vendor baseline first, then a compared Proseg or vendor refinement branch; ResolVI benchmark-gated.' : 'Vendor segmentation retained; no molecules or images for refinement.') : 'Not a spatial assay.');
    set('M09', 'CON', s.assay === 'multi' ? 'MultiVI after pairing validation, with unimodal and paired-only comparators.' : rna ? 'scVI when integration is justified, Harmony as comparator, nonintegrated baseline retained.' : sp ? 'Per-section representations; a joint embedding only when it is identifiable.' : 'SnapATAC2 representation; integrate only when a technical factor distorts the biology.');
    set('M10', s.annotLimited ? 'VAL' : 'REQ', `${s.annot || 'Validated reference mapping'}. Hierarchical labels, confidence, unassigned kept.${s.annotLimited ? ' Broad lineage only; report the limitation.' : ''}`);

    const infBlocked = s.deBlocked || s.unitsBlocked || s.identityBlocked;
    const infWhy = s.deBlocked ? 'Observed counts are missing; counts are never rebuilt from normalized values.' : s.unitsBlocked ? 'Fewer than 3 independent units per group: descriptive effects only.' : 'Donor identity is unresolved.';
    set('M11', infBlocked ? 'BLK' : 'REQ', infBlocked ? infWhy : `Design ${s.formula || ''}; rank checked in every cell-type subset; contrast registry with a declared testing family.`);
    set('M12', s.assay === 'atac' ? 'NA' : infBlocked ? 'BLK' : 'REQ', s.assay === 'atac' ? 'No RNA to test; accessibility is tested in M16.' : infBlocked ? infWhy : `Engines: ${engines(s).map(e => e.name).join(', ')}${s.units > 30 ? '' : ' (dreamlet only above 30 samples)'}. MAST between all groups; pseudobulk per unit × cell type${s.repeated ? ' × region' : ''}, ≥20 cells per aggregate, ≥3 units per group; observed-count sensitivity when CellBender counts are primary.`);
    set('M13', infBlocked ? 'BLK' : 'REQ', infBlocked ? infWhy : 'scCODA for composition and miloR for neighborhoods, per experimental unit; denominators reported.');
    set('M14', s.assay === 'atac' ? 'NA' : infBlocked ? 'BLK' : 'REQ', s.assay === 'atac' ? 'No expression matrix for co-expression networks.' : infBlocked ? infWhy : 'hdWGCNA with metacells inside donor × cell type; module construction and module association kept separate.');
    set('M15', infBlocked ? 'BLK' : 'REQ', infBlocked ? infWhy : sp ? 'SpatialCellChat with physical coordinates and a justified range; LIANA+ as complement.' : 'CellChat with sample identity preserved and donor-level comparison; LIANA+ as complement.');
    set('M16', atac ? (infBlocked ? 'BLK' : 'REQ') : 'NA', atac ? (infBlocked ? infWhy : 'Differential accessibility on observed fragment counts; chromVAR motif deviations; Cicero co-accessibility; scPrinter and TF footprinting (TOBIAS); SCENIC+ as a hypothesis layer.') : 'No accessibility data.');
    set('M17', sp ? 'REQ' : 'NA', sp ? 'Squidpy and BANKSY inside registered coordinates; niches separate from identity; specimen-level replication.' : 'No physical coordinates.');
    set('M18', 'CON', 'fgsea and UCell on the tested universe; trajectories only when the biology supports a continuum.');
    set('M19', 'REQ', 'Report, module ledger, eligibility report, limitations and provenance are always produced.');

    const stages = MODULES.map(m => ({ ...m, status: st[m.id], reason: why[m.id], tools: m.id === 'M12' ? engines(s).map(e => e.name) : m.tools }));
    const blocked = stages.filter(x => x.status === 'BLK');
    const validate = stages.filter(x => x.status === 'VAL');
    const verdict = blocked.length
      ? { ok: false, title: `${blocked.length} blocked stage${blocked.length > 1 ? 's' : ''}`, text: 'A required stage cannot run. Recover the missing input, or label every downstream result EXPLORATORY_NONCOMPLIANT.' }
      : validate.length
        ? { ok: true, title: 'Route ready, with validation gates', text: `${validate.length} stage${validate.length > 1 ? 's need' : ' needs'} an adapter or reference validation before production use.` }
        : { ok: true, title: 'Compliant route', text: 'Every required stage can run or be validly reused.' };

    const unit = id => id === 'M04' ? 'background_unit_id' : id === 'M05' ? 'doublet_unit_id' : ['M11', 'M12', 'M13', 'M14', 'M15', 'M16'].includes(id) ? 'experimental_unit_id' : id === 'M17' ? 'specimen_id' : 'study';
    const ledger = stages.filter(x => x.status !== 'NA').map(x => ({ id: x.id, status: STATUS[x.status].ledger, reason: x.reason, unit: unit(x.id) }));
    return { stages, verdict, ledger, unit, engines: engines(s) };
  }

  /* ---------- Markdown plan ---------- */
  function markdown(s, r, choices) {
    const L = [];
    const active = r.stages.filter(x => x.status !== 'NA').sort((a, b) => a.stage - b.stage);
    const na = r.stages.filter(x => x.status === 'NA');
    const tools = [...new Set(active.flatMap(x => x.tools))].filter(t => DOCS[t]);

    L.push('# Analysis plan', '', `Generated by Brick Route from the Swarup Lab analytical design specification v1.0 (evidence reviewed ${REVIEW_DATE}).`, '',
      `**Verdict:** ${r.verdict.title}. ${r.verdict.text}`, '');

    L.push('## Choices', '', '| Step | Choice |', '|---|---|');
    choices.forEach(c => L.push(`| ${c.step} | ${c.choice} |`));
    L.push('');

    L.push('## Route at a glance', '', '| Module | Stage | Status | Execution unit |', '|---|---|---|---|');
    active.forEach(x => L.push(`| ${x.id} | ${x.name} | ${STATUS[x.status].label} | \`${r.unit(x.id)}\` |`));
    L.push('');

    L.push('## Stage by stage', '');
    active.forEach(x => {
      L.push(`### ${x.id} · ${x.name}`, '', `**Status:** ${STATUS[x.status].label} (\`${STATUS[x.status].ledger}\`)`, '', `**Why here:** ${x.reason}`, '', `**Needs:** ${x.needs}`, '', `**Produces:** ${x.produces}`, '', `**Tools:** ${x.tools.map(t => DOCS[t] ? `[${t}](${DOCS[t]})` : t).join(', ')}`, '');
    });

    L.push('## Inference plan', '',
      `- Primary family: replicate-aware pseudobulk. Aggregate over eligible cells within experimental unit × cell type${s.repeated ? ' × region or time point' : ''}.`,
      `- Material: ${s.material === 'cells' ? 'whole cells (scRNA-seq)' : s.material === 'nuclei' ? 'nuclei' : s.material || 'declared at intake'}.`,
      '- Differential expression engines:',
      ...r.engines.map(e => `  - **${e.name}** (${e.when}): ${e.role}`),
      s.units > 30 ? null : '  - dreamlet is not offered below 30 samples.',
      `- Model: \`${s.formula || 'declared in contrasts.tsv'}\`.`,
      `- Independent units per group declared: ${s.units || 'not declared'}. Operational screen: at least 20 accepted cells per aggregate and at least 3 independent units per group. These are minimums, not evidence of power.`,
      `- Testing family: all eligible genes across all prespecified primary contrasts within each cell type; Benjamini-Hochberg at 0.05; study-wide control for pan-cell-type claims.`,
      s.pairwise ? '- All K(K−1)/2 pairwise contrasts registered in one multi-group design; no omnibus-then-unadjusted-pairwise shortcut.' : null,
      s.design === 'factorial' ? '- Register exposure in WT, exposure in the model, and the interaction. Two p-values do not test an interaction.' : null,
      s.nebula ? '- NEBULA on observed cell-level counts as a complementary analysis; it is not pseudobulk.' : null,
      s.cb === 'req' ? '- CellBender-corrected integer counts are the primary DE response; the same design is repeated on observed counts for the same cells and reported as sensitivity.' : null,
      '- Differential expression, differential abundance, hdWGCNA and cell communication all run; each has its own eligibility gate and evidence label.', '');

    L.push('## Not applicable in this route', '');
    na.forEach(x => L.push(`- **${x.id} · ${x.name}** — ${x.reason}`));
    L.push('');

    L.push('## Software to pin (latest builds)', '', 'Resolve the latest supported release of each tool at run time from its official distribution, verify the artifact, and record the exact version or container digest in `software.lock.yaml`. Documentation links are the reference points reviewed on ' + REVIEW_DATE + '.', '',
      '| Tool | Documentation | Version to lock |', '|---|---|---|');
    tools.forEach(t => L.push(`| ${t} | ${DOCS[t]} | _resolve at run, record digest_ |`));
    L.push('');

    L.push('## Required manifests', '', '- `study.yaml` — study ID, questions, assay profiles, inference and count policies, reference and software locks', '- `samples.tsv` — sample, specimen, donor, experimental unit, condition, covariates', '- `libraries.tsv` — library, capture, background_unit_id, doublet_unit_id, chemistry, batch', '- `files.tsv` — file role, path, checksum, associations', s.assay === 'spatial' ? '- `spatial_sections.tsv` — section, slide, FOV, coordinate system, segmentation version' : null, '- `contrasts.tsv` — contrast, question, subset, engine, formula, testing family', '- `references.lock.yaml`, `software.lock.yaml`', '');

    L.push('## Planned ledger', '', '| Module | Planned status | Execution unit | Reason |', '|---|---|---|---|');
    r.ledger.forEach(l => L.push(`| ${l.id} | \`${l.status}\` | \`${l.unit}\` | ${l.reason} |`));
    L.push('');

    const lim = [];
    r.stages.filter(x => x.status === 'BLK').forEach(x => lim.push(`- ${x.id} ${x.name} is blocked: ${x.reason}`));
    r.stages.filter(x => x.status === 'VAL').forEach(x => lim.push(`- ${x.id} ${x.name} needs validation: ${x.reason}`));
    L.push('## Limitations to report', '', lim.length ? lim.join('\n') : '- None recorded at planning time. QC attrition, replication per cell type and integration preservation are reported after execution.', '');

    L.push('## What the report must never conceal', '', 'Missing raw counts, unperformed required correction, incomplete donor assignment, weak replication, unsupported model inputs, feature-panel mismatch, nonconvergence, complete confounding, missing spatial supporting data. A polished plot does not override an unresolved eligibility failure.', '');
    return L.filter(x => x !== null).join('\n');
  }

  return { compute, markdown };
})();

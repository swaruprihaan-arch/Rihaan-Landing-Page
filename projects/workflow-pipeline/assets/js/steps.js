/* Brick Route · the decision tree.
   Each step shows up to four bricks. options(state) returns the bricks for the
   current state; each option's set{} merges into state when chosen; more{} is
   the deeper explanation shown in the drawer. */

const STEPS = [
  {
    id: 'assay', color: 'red', title: 'What was measured?',
    lead: 'Pick the assay family. Everything else branches from here.',
    options: () => [
      { label: 'Single-cell RNA-seq', sub: 'Dissociated whole cells (scRNA). Cytoplasmic mRNA, mitochondrial fraction matters.', set: { assay: 'rna', material: 'cells' },
        more: { title: 'scRNA-seq, whole cells', text: 'Scanpy backbone. CellBender is required for eligible droplet data and Scrublet for every eligible dissociated dataset, run within the capture unit. QC thresholds are set from whole-cell distributions: mitochondrial fraction, counts and genes per cell, per platform and capture.', src: 'Spec §1.2, §8, §9, §10.1' } },
      { label: 'Single-nucleus RNA-seq', sub: 'Isolated nuclei (snRNA). Intronic reads counted; low mitochondrial fraction expected.', set: { assay: 'rna', material: 'nuclei' },
        more: { title: 'snRNA-seq, nuclei', text: 'Retain exonic and intronic quantification settings and reference provenance. Ambient RNA from cytoplasmic debris makes CellBender especially important. Do not compare datasets quantified under different gene-count definitions without recording the difference.', src: 'Spec §7.1, §8' } },
      { label: 'snRNA + snATAC multiome', sub: 'Both modalities from the same nucleus. Always nuclei.', set: { assay: 'multi', material: 'nuclei' },
        more: { title: 'Multiome', text: 'Two modalities, one barcode crosswalk, always nuclei. RNA follows the CellBender, Scrublet and Scanpy policy. ATAC follows the fragment workflow. Joint analysis with MultiVI starts only after identity and modality-specific QC pass. A missing modality is marked missing, never zero.', src: 'Spec §12' } },
      { label: 'snATAC only', sub: 'Standalone chromatin accessibility from nuclei.', set: { assay: 'atac', material: 'nuclei' },
        more: { title: 'Standalone snATAC', text: 'Reuses the ATAC component of the multiome workflow: SnapATAC2, accessibility-specific doublets, balanced consensus peaks, replicate-level differential accessibility on observed fragment counts, then chromVAR, Cicero co-accessibility, scPrinter and TF footprinting. CellBender is not applicable.', src: 'Spec §11' } },
      { label: 'Spatial', sub: 'Imaging-defined cells, spots, bins or molecules.', set: { assay: 'spatial', material: 'tissue' },
        more: { title: 'Spatial transcriptomics', text: 'Branch first by measurement unit. Vendor baseline first; Proseg and ResolVI are separate, conditional branches. Multiple fields of view never become independent donors.', src: 'Spec §13' } },
    ],
  },
  {
    id: 'platform', color: 'orange', title: 'Which platform?',
    lead: 'Chemistry decides the primary adapter and which validation gates apply.',
    options: s => ({
      rna: [
        { label: '10x Chromium', sub: 'Cell Ranger count or multi. CellBender validated for this profile.', set: { platform: '10x', cb: 'req' }, more: { title: '10x Chromium RNA', text: 'Cell Ranger count or multi, chosen from the documented assay configuration. Preserve unfiltered and called-cell matrices, BAMs, and metrics. The unfiltered matrix is what CellBender needs.', src: 'Spec §4.1' } },
        { label: 'BD Rhapsody', sub: 'Sequence Analysis Pipeline. CellBender adapter must be validated per kit.', set: { platform: 'bd', cb: 'val' }, more: { title: 'BD Rhapsody', text: 'Microwell chemistry. Verify the exact raw-barcode output, background population, matrix format and model fit before CellBender counts as compliant. The 10x example does not prove microwell compatibility.', src: 'Spec §8.2' } },
        { label: 'Parse Biosciences', sub: 'split-pipe or Trailmaker. Background structure not automatically validated.', set: { platform: 'parse', cb: 'val' }, more: { title: 'Parse Evercode', text: 'Combinatorial indexing. An “unfiltered” directory is not proof that it holds the same background population as an empty-droplet matrix. Classify eligibility from the actual barcode structure.', src: 'Spec §8.2, §23 C' } },
        { label: 'Scale Bio', sub: 'ScaleRna Nextflow workflow. Same validation gate as Parse.', set: { platform: 'scale', cb: 'val' }, more: { title: 'Scale Bio', text: 'Vendor-maintained Nextflow workflow with chemistry-specific requirements. CellBender route is a validation gate, not a default.', src: 'Spec §4.1' } },
      ],
      multi: [
        { label: '10x Multiome', sub: 'Cell Ranger ARC, not Cell Ranger multi.', set: { platform: '10x-arc', cb: 'req' }, more: { title: 'Cell Ranger ARC', text: 'ARC is the 10x RNA+ATAC route. multi is a different tool for supported Cell Ranger library designs. Preserve RNA matrices, ATAC fragments and the joint barcode information.', src: 'Spec §4.1' } },
        { label: 'BD Rhapsody multiome', sub: 'Multiomic pipeline configuration. Validate the CellBender adapter.', set: { platform: 'bd-multi', cb: 'val' }, more: { title: 'BD Rhapsody RNA+ATAC', text: 'Exact supported kit and release, library map, barcode pairing crosswalk and separate modality metrics. BD-specific background validation is required before compliance is declared.', src: 'Spec §23 B' } },
        { label: 'Pooled donors per capture', sub: '10x ARC with genotype demultiplexing added.', set: { platform: '10x-arc', cb: 'req', pooled: true }, more: { title: 'Pooled captures', text: 'Genotype demultiplexing with souporcell or Vireo. Donor assignment must not split a shared physical capture into donor-specific CellBender or Scrublet runs.', src: 'Spec §7.2' } },
        { label: 'Single donor per capture', sub: '10x ARC, no demultiplexing.', set: { platform: '10x-arc', cb: 'req', pooled: false }, more: { title: 'Single-donor captures', text: 'Identity is by capture. Still verify that RNA and ATAC barcodes represent the same nucleus after adapter-specific correction.', src: 'Spec §7.2' } },
      ],
      atac: [
        { label: '10x Chromium ATAC', sub: 'Cell Ranger ATAC.', set: { platform: '10x-atac', cb: 'na' }, more: { title: 'Cell Ranger ATAC', text: 'Fragments with indexes, peak matrix, coordinates and metrics. Fragments are required for fragment-level QC and peak calling.', src: 'Spec §4.1' } },
        { label: 'Other chemistry', sub: 'Validated chemistry-specific adapter required.', set: { platform: 'atac-other', cb: 'na', validateAdapter: true }, more: { title: 'Other standalone ATAC', text: 'Read structure, barcode correction, alignment, duplicate handling and fragment construction must be specified and validated.', src: 'Spec §4.1' } },
        { label: 'Peak matrix only', sub: 'No fragments. Matrix-level analyses only.', set: { platform: 'atac-peaks', cb: 'na', noFragments: true }, more: { title: 'Peak matrix without fragments', text: 'Limited matrix-level analyses if valid. No new fragment-level QC or peak recalling from nonexistent fragments.', src: 'Spec §3' } },
        { label: 'Fragments and peaks provided', sub: 'Reuse after validation.', set: { platform: '10x-atac', cb: 'na' }, more: { title: 'Provided fragments', text: 'A prior step satisfies a requirement only when inputs, versions, parameters, references, outputs and diagnostics can be validated.', src: 'Spec §3' } },
      ],
      spatial: [
        { label: 'Xenium · CosMx · MERSCOPE', sub: 'Imaging-defined cells and molecules.', set: { platform: 'imaging', cb: 'na', unit: 'cell' }, more: { title: 'Imaging platforms', text: 'Import cell matrices, molecule coordinates, images, boundaries and controls. Segmentation quality is the correction question, not ambient RNA.', src: 'Spec §4.2, §13.2' } },
        { label: 'Visium · Visium HD', sub: 'Space Ranger spots and bins.', set: { platform: 'visium', cb: 'na', unit: 'bin' }, more: { title: 'Visium', text: 'Preserve histology, transforms, spot and bin sizes. A bin is not automatically a cell. Off-tissue bins are not empty droplets.', src: 'Spec §4.2, §13.5' } },
        { label: 'Stereo-seq', sub: 'SAW workflow, bins.', set: { platform: 'stereo', cb: 'na', unit: 'bin' }, more: { title: 'Stereo-seq', text: 'SAW: Stereo-seq Analysis Workflow. Retain chip and reference metadata, bin definitions, tissue mask and cell segmentation when available.', src: 'Spec §4.2' } },
        { label: 'Atera', sub: 'Dedicated export adapter. Validate the schema.', set: { platform: 'atera', cb: 'na', unit: 'cell', validateAdapter: true }, more: { title: 'Atera', text: 'Confirm the actual export schema and supported reanalysis interface. Do not assume Space Ranger or Xenium compatibility.', src: 'Spec §26' } },
      ],
    })[s.assay],
  },
  {
    id: 'start', color: 'yellow', title: 'Where does the data start?',
    lead: 'The starting stage decides which checkpoints are verified rather than trusted.',
    options: s => {
      const rna = s.assay === 'rna' || s.assay === 'multi';
      if (s.assay === 'spatial') return [
        { label: 'Vendor output with molecules and images', sub: 'Full spatial route. Refinement branches possible.', set: { start: 'raw', seg: true }, more: { title: 'Complete spatial export', text: 'Molecules, images and boundaries allow a Proseg or vendor resegmentation branch and a benchmarked ResolVI branch. Preserve the vendor result and refined result independently.', src: 'Spec §13.2' } },
        { label: 'Cell or bin matrix only', sub: 'No resegmentation possible.', set: { start: 'matrix', seg: false }, more: { title: 'Matrix without molecules', text: 'Expression and coordinate analyses only. Proseg or resegmentation cannot run without molecule or image inputs.', src: 'Spec §3' } },
        { label: 'Annotated object', sub: 'Validate labels, then downstream modules.', set: { start: 'object', seg: false }, more: { title: 'Annotated spatial object', text: 'Validate annotation provenance and count semantics. Do not repeat segmentation blindly.', src: 'Spec §3' } },
        { label: 'Normalized-only object', sub: 'Count-based inference blocked.', set: { start: 'normalized', seg: false, deBlocked: true }, more: { title: 'Normalized-only', text: 'Do not reconstruct counts by exponentiating log expression. Descriptive analyses only until observed counts are recovered.', src: 'Spec §3, §23 F' } },
      ];
      if (s.assay === 'atac') return [
        { label: 'Raw FASTQ', sub: 'Full route from the vendor pipeline.', set: { start: 'raw' } , more: { title: 'Raw ATAC', text: 'Cell Ranger ATAC or a validated chemistry-specific adapter produces fragments, peaks and metrics.', src: 'Spec §4.1' } },
        { label: 'Fragments provided', sub: 'Validate, then QC and peak calling.', set: { start: 'unfiltered' }, more: { title: 'Fragments', text: 'Indexed fragments with a known genome build allow fragment-level QC, consensus peaks and recounting.', src: 'Spec §11' } },
        { label: 'Peak matrix only', sub: 'Matrix-level analyses only.', set: { start: 'matrix', noFragments: true }, more: { title: 'Peak matrix', text: 'Genome build, peak coordinates and count definition must be validated. No fragment QC.', src: 'Spec §3' } },
        { label: 'Normalized-only object', sub: 'Count-based inference blocked.', set: { start: 'normalized', deBlocked: true }, more: { title: 'Normalized-only', text: 'Differential accessibility needs observed fragment counts. Binarized or TF-IDF matrices are not substitutes.', src: 'Spec §11.3' } },
      ];
      return [
        { label: 'Raw FASTQ', sub: 'Full route from vendor primary processing.', set: { start: 'raw' }, more: { title: 'Raw sequencing files', text: 'Verify platform, chemistry, read structure, reference and sample sheets. Never guess chemistry from a filename.', src: 'Spec §3' } },
        { label: 'Unfiltered matrices', sub: 'Background barcodes present. CellBender can run.', set: { start: 'unfiltered' }, more: { title: 'Unfiltered matrices', text: 'The background barcode universe is what CellBender models. Confirm no prior unrecorded correction.', src: 'Spec §8.1' } },
        { label: 'Filtered matrix only', sub: 'No background universe. Required correction is blocked.', set: { start: 'filtered', cb: 'blk' }, more: { title: 'Filtered-only', text: rna ? 'An eligible droplet study cannot be called compliant when CellBender was omitted because the unfiltered matrix was lost. Recover it, or label every downstream result EXPLORATORY_NONCOMPLIANT.' : '', src: 'Spec §1.3, §8.2' } },
        { label: 'Normalized-only object', sub: 'No observed counts. Count modules blocked.', set: { start: 'normalized', cb: 'blk', deBlocked: true }, more: { title: 'Normalized-only', text: 'Do not exponentiate and round expression to fabricate counts. CellBender, pseudobulk modeling and NEBULA stay blocked until valid counts and provenance are recovered.', src: 'Spec §23 F' } },
      ];
    },
  },
  {
    id: 'identity', color: 'green', title: 'How are donors identified?',
    lead: 'Identity is resolved before any donor-associated inference. Captures, sections and lanes are not donors.',
    options: s => s.assay === 'spatial' ? [
      { label: 'One section per donor', sub: 'Section equals specimen equals donor.', set: { identity: 'section' }, more: { title: 'One section per donor', text: 'The donor is the independent unit. FOVs within a section are repeated observations of the same specimen.', src: 'Spec §5.1' } },
      { label: 'Several sections per donor', sub: 'Repeated sections, one donor.', set: { identity: 'multi-section', repeated: true }, more: { title: 'Repeated sections', text: 'Sections are repeated observations. Model them with a donor random intercept or a paired structure, never as independent donors.', src: 'Spec §13.4, §16' } },
      { label: 'Several regions per donor', sub: 'Region is a design factor.', set: { identity: 'regions', repeated: true }, more: { title: 'Repeated regions', text: 'Condition by region interaction where relevant, with a donor random intercept. dreamlet is the default engine.', src: 'Spec §16.1' } },
      { label: 'Not yet recorded', sub: 'Manifest incomplete. Inference stays blocked.', set: { identity: 'unknown', identityBlocked: true }, more: { title: 'Missing donor identifiers', text: 'An absent donor identifier is not equivalent to a unique donor per cell. Complete samples.tsv before any donor-level analysis.', src: 'Spec §5.2' } },
    ] : [
      { label: 'One donor per capture', sub: 'Identity by capture. No demultiplexing.', set: { identity: 'single' }, more: { title: 'Single-donor captures', text: 'Simplest identity. Lanes from the same library are technical partitions and enter primary processing together.', src: 'Spec §4.1' } },
      { label: 'Genotype-pooled donors', sub: 'souporcell or Vireo, matched to known genotypes.', set: { identity: 'pooled', pooled: true }, more: { title: 'Genetic demultiplexing', text: 'A cluster named 0 is not a donor until matched to reference genotypes. Demultiplexing gives independent multiplet evidence, but the capture remains the CellBender and Scrublet unit.', src: 'Spec §7.2' } },
      { label: 'Sample tags or hashing', sub: 'Tag assignment, discordance retained.', set: { identity: 'tags', pooled: true }, more: { title: 'Tag-based multiplexing', text: 'Retain tag assignments and their discordance with genotype evidence when both exist. Unresolved identity is excluded from donor-associated inference.', src: 'Spec §7.2' } },
      { label: 'Not yet recorded', sub: 'Manifest incomplete. Inference stays blocked.', set: { identity: 'unknown', identityBlocked: true }, more: { title: 'Missing donor identifiers', text: 'An absent donor identifier is not equivalent to a unique donor per cell. Complete samples.tsv before any donor-level analysis.', src: 'Spec §5.2' } },
    ],
  },
  {
    id: 'design', color: 'teal', title: 'What is the experimental design?',
    lead: 'Cells are never the independent units. Donors, animals or cages are.',
    options: () => [
      { label: 'Two independent groups', sub: 'One prespecified contrast, design-aware model.', set: { design: 'two', formula: '~ condition + age + sex + technical_batch' }, more: { title: 'Two groups', text: 'One primary contrast in a design-aware count model. Adjusted sensitivity models as needed. Keep disease distinct from technical batch.', src: 'Spec §16.1' } },
      { label: 'Genotype × treatment', sub: 'Main effects plus the interaction.', set: { design: 'factorial', formula: '~ genotype * treatment + sex + technical_batch' }, more: { title: 'Factorial design', text: 'Register exposure in WT, exposure in the model, and their difference. A significant effect in one genotype and not the other does not establish an interaction.', src: 'Spec §16.3' } },
      { label: 'Repeated regions or time points', sub: 'Donor blocking; dreamlet random intercept once the cohort exceeds 30.', set: { design: 'repeated', formula: '~ condition * region + age + sex + (1 | donor_id)', repeated: true }, more: { title: 'Repeated measures', text: 'Regions and time points remain repeated observations, never merged blindly. Below 30 samples: edgeR pseudobulk with the donor as a block, plus MAST and NEBULA. Above 30: dreamlet with precision weights and a donor random intercept is added.', src: 'Spec §15.2, §16.2' } },
      { label: 'Three or more groups', sub: 'One coherent design, all pairwise contrasts registered.', set: { design: 'multi', formula: '~ group + age + sex + technical_batch', pairwise: true }, more: { title: 'K unordered groups', text: 'All K(K−1)/2 pairwise contrasts by default when scientifically relevant. Do not filter by an omnibus p-value and then report unadjusted pairwise tests.', src: 'Spec §16.1, §16.4' } },
    ],
  },
  {
    id: 'units', color: 'blue', title: 'How many independent units per group?',
    lead: 'Operational minimums, not evidence of power. Three per group is the screening floor.',
    options: () => [
      { label: '1 or 2', sub: 'Below the screening minimum. Descriptive only.', set: { units: 2, unitsBlocked: true }, more: { title: 'Insufficient replication', text: 'No automatic fallback to treating cells as independent replicates. Descriptive effects or a restricted exploratory analysis.', src: 'Spec §16.1' } },
      { label: '3 to 5', sub: 'Meets the operational floor. Power review still required.', set: { units: 4 }, more: { title: 'Small cohort', text: 'At least 3 independent experimental units per group for an initial screen. Heterogeneous human cohorts, rare populations and interactions may need much more.', src: 'Spec §15.4' } },
      { label: '6 to 30', sub: 'MAST, edgeR pseudobulk and NEBULA. No dreamlet yet.', set: { units: 15 }, more: { title: 'Moderate cohort', text: 'Seurat-style MAST between all groups, edgeR quasi-likelihood pseudobulk and NEBULA run. dreamlet waits for a cohort above 30 samples. NEBULA cautions that subject-level testing needs a moderate number of subjects.', src: 'Spec §15.2' } },
      { label: 'More than 30', sub: 'dreamlet joins the DE engines.', set: { units: 40, dreamlet: true }, more: { title: 'Large cohort', text: 'With more than 30 samples, dreamlet (precision-weighted mixed model) is added to MAST, edgeR and NEBULA. NEBULA’s own documentation also discusses more than 30 subjects for subject-level testing.', src: 'Spec §15.2, §15.3' } },
    ],
  },
  {
    id: 'reference', color: 'purple', title: 'Which annotation reference?',
    lead: 'Differential expression, abundance, hdWGCNA and CellChat all run downstream. The reference decides how cells get their labels first.',
    options: () => [
      { label: 'Human brain', sub: 'MapMyCells human taxonomies, including the SEA-AD multi-region reference.', set: { reference: 'human-brain', annot: 'MapMyCells (human brain taxonomy)' }, more: { title: 'Human brain reference', text: 'MapMyCells is the preferred route when an appropriate brain taxonomy exists. The SEA-AD multi-region reference CCN20260630 is an available option, not a universal default. Choose species, anatomical coverage and taxonomy version explicitly; keep unassigned and low-confidence labels.', src: 'Spec §14.1' } },
      { label: 'Mouse brain', sub: 'MapMyCells mouse whole-brain taxonomy.', set: { reference: 'mouse-brain', annot: 'MapMyCells (mouse brain taxonomy)' }, more: { title: 'Mouse brain reference', text: 'Map to the mouse whole-brain taxonomy and validate positive and exclusion markers across animals. Disease states in a model are not part of the reference; keep identity and state in separate fields.', src: 'Spec §14.1, §14.2' } },
      { label: 'Other tissue with a validated reference', sub: 'scANVI semi-supervised transfer.', set: { reference: 'other', annot: 'scANVI with a validated reference' }, more: { title: 'Validated non-brain reference', text: 'scANVI is the conditional semi-supervised alternative. A classifier’s confidence is not sufficient when the query population is absent from the reference; check coverage and rare-label plausibility.', src: 'Spec §14.1' } },
      { label: 'No suitable reference', sub: 'Marker-supported review, broad lineage only.', set: { reference: 'none', annot: 'Marker-supported review; broad lineage labels only', annotLimited: true }, more: { title: 'No reference', text: 'Do not force every cell to the most specific label when only a broad lineage is supported. Downstream aggregation runs at the lineage level and the limitation is reported.', src: 'Spec §14.2' } },
    ],
  },
];

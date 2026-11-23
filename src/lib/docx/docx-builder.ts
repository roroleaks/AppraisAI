import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ShadingType,
  HeadingLevel,
} from 'docx';
import {
  MasterAppraisalReport,
  BiasJudgement,
} from '../schemas/appraisal.schema';
import {
  DOCX_COLORS,
  PAGE_GEOMETRY,
  PAGE_GEOMETRY_A4,
  PAGE_GEOMETRY_LETTER,
  TYPOGRAPHY,
  CELL_PADDING,
  CELL_PADDING_COMPACT,
  TABLE_BORDERS_CLEAN,
  CALLOUT_BORDERS_TEAL,
  CALLOUT_BORDERS_NAVY,
} from './styles';
import { cleanBiomedicalTitle, cleanBiomedicalAuthors } from '../parsers/title-sanitizer';
import { isVerbatimInManuscript } from '../parsers/quote-verifier';

export interface AppraiserMetadata {
  name: string;
  affiliation?: string;
  orcid?: string;
  email?: string;
  verified?: boolean;
  pageSize?: 'A4' | 'LETTER';
}

/**
 * Truncates text at word boundary without slicing mid-word (P3-4).
 */
function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const sub = text.slice(0, maxLen);
  const lastSpace = sub.lastIndexOf(' ');
  return lastSpace > 20 ? `${sub.slice(0, lastSpace)}...` : `${sub}...`;
}

/**
 * Creates a standard publication-grade body paragraph in Arial.
 */
function createBodyParagraph(
  text: string,
  options?: { bold?: boolean; italic?: boolean; before?: number; after?: number; color?: string }
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: {
      line: TYPOGRAPHY.LINE_SPACING_BODY,
      before: options?.before ?? 80,
      after: options?.after ?? 100,
    },
    children: [
      new TextRun({
        text,
        font: TYPOGRAPHY.FONT_PRIMARY,
        size: TYPOGRAPHY.SIZE_BODY,
        bold: options?.bold,
        italics: options?.italic,
        color: options?.color || DOCX_COLORS.SLATE_BODY,
      }),
    ],
  });
}

/**
 * Creates an executive Heading 1 with Word outline heading level (P3-1).
 */
function createHeading1(sectionNumber: string, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    spacing: { before: 260, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: DOCX_COLORS.BORDER_GREY },
    },
    children: [
      new TextRun({
        text: `${sectionNumber}  ${title.toUpperCase()}`,
        font: TYPOGRAPHY.FONT_HEADING,
        size: TYPOGRAPHY.SIZE_H1,
        bold: true,
        color: DOCX_COLORS.NAVY_PRIMARY,
      }),
    ],
  });
}

/**
 * Creates a subsection Heading 2 with Word outline heading level (P3-1).
 */
function createHeading2(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.LEFT,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text: title,
        font: TYPOGRAPHY.FONT_HEADING,
        size: TYPOGRAPHY.SIZE_H2,
        bold: true,
        color: DOCX_COLORS.TEAL_ACCENT,
      }),
    ],
  });
}

/**
 * Creates a table header cell with solid Navy background and white bold text.
 */
function createTableHeaderCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.NAVY_PRIMARY },
    margins: CELL_PADDING,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            font: TYPOGRAPHY.FONT_PRIMARY,
            size: TYPOGRAPHY.SIZE_TABLE,
            bold: true,
            color: DOCX_COLORS.WHITE,
          }),
        ],
      }),
    ],
  });
}

/**
 * Returns accessible traffic-light tokens for Risk of Bias judgements (P3-10).
 */
function getRobStatusTokens(
  status: BiasJudgement | string
): { bg: string; text: string; label: string; symbol: string } {
  switch (status) {
    case 'LOW_RISK':
      return { bg: DOCX_COLORS.SUCCESS_BG, text: DOCX_COLORS.SUCCESS_TEXT, label: 'Low Risk', symbol: '(+) LOW RISK' };
    case 'SOME_CONCERNS':
      return { bg: DOCX_COLORS.WARNING_BG, text: DOCX_COLORS.WARNING_TEXT, label: 'Some Concerns', symbol: '(?) SOME CONCERNS' };
    case 'HIGH_RISK':
      return { bg: DOCX_COLORS.DANGER_BG, text: DOCX_COLORS.DANGER_TEXT, label: 'High Risk', symbol: '(-) HIGH RISK' };
    case 'UNCLEAR_NOT_REPORTED':
    default:
      return { bg: DOCX_COLORS.NEUTRAL_BG, text: DOCX_COLORS.NEUTRAL_TEXT, label: 'Unclear', symbol: '[?] UNCLEAR' };
  }
}

/**
 * Returns accessible traffic-light tokens for EQUATOR reporting items (P3-9, P3-10).
 */
function getEquatorStatusTokens(
  status: string
): { bg: string; text: string; label: string; symbol: string } {
  switch (status) {
    case 'REPORTED':
      return { bg: DOCX_COLORS.SUCCESS_BG, text: DOCX_COLORS.SUCCESS_TEXT, label: 'Reported', symbol: '(+) REPORTED' };
    case 'PARTIALLY_REPORTED':
      return { bg: DOCX_COLORS.WARNING_BG, text: DOCX_COLORS.WARNING_TEXT, label: 'Partially Reported', symbol: '(?) PARTIALLY' };
    case 'NOT_REPORTED':
      return { bg: DOCX_COLORS.DANGER_BG, text: DOCX_COLORS.DANGER_TEXT, label: 'Not Reported', symbol: '(-) NOT REPORTED' };
    case 'NOT_APPLICABLE':
    default:
      return { bg: DOCX_COLORS.NEUTRAL_BG, text: DOCX_COLORS.NEUTRAL_TEXT, label: 'Not Assessed', symbol: '[N/A] NOT ASSESSED' };
  }
}

// Backward-compatible alias
const getStatusTokens = getRobStatusTokens;

/**
 * Compiles a publication-grade academic critical appraisal manuscript in Microsoft Word format.
 */
export function buildAcademicDocxManuscript(
  report: MasterAppraisalReport,
  appraiser?: AppraiserMetadata
): Document {
  const meta = report.metadata;
  const isAbstractOnly = meta.sourceDepth === 'ABSTRACT_ONLY_FALLBACK';
  const cleanTitle = cleanBiomedicalTitle(meta.title);
  const idDescriptor = meta.doi ? `DOI: ${meta.doi}` : meta.pmid ? `PMID: ${meta.pmid}` : meta.journal || 'Journal Not Specified';
  const truncatedHeaderTitle = truncateAtWord(cleanTitle, 52);
  const cleanAuthors = cleanBiomedicalAuthors(meta.authors);
  const authorsString = cleanAuthors.join(', ');

  const activeAppraiserName = appraiser?.name || 'Clinical Methodologist (AppraisAI)';
  const activeAffiliation = appraiser?.affiliation || 'Evidence-Based Medicine & Methodological Review';
  const activeOrcid = appraiser?.orcid || '';
  const isVerified = !!appraiser?.verified;

  // Page geometry selection: default A4, optional US Letter (P3-3)
  const pageGeom = appraiser?.pageSize === 'LETTER' ? PAGE_GEOMETRY_LETTER : PAGE_GEOMETRY_A4;
  const contentWidth = pageGeom.CONTENT_WIDTH;

  // Pseudo manuscript payload for quote verification in docx
  const pseudoManuscript = {
    metadata: meta,
    abstract: report.manuscriptAbstract || '',
    fullText: report.manuscriptFullText || '',
    sections: [],
    tablesRaw: [],
  } as any;

  // Compute RoB strip column width summing to exact printable width
  const domainCount = Math.max(1, report.riskOfBias.domains.length);
  const baseStripWidth = Math.floor(contentWidth / domainCount);
  const lastStripWidth = contentWidth - baseStripWidth * (domainCount - 1);

  // 4 summary cards column widths summing to exact printable width
  const cardWidth = Math.floor(contentWidth / 4);
  const lastCardWidth = contentWidth - cardWidth * 3;

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: TYPOGRAPHY.FONT_PRIMARY,
            size: TYPOGRAPHY.SIZE_BODY,
            color: DOCX_COLORS.SLATE_BODY,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageGeom.PAGE_WIDTH,
              height: pageGeom.PAGE_HEIGHT,
            },
            margin: {
              top: pageGeom.MARGIN_TOP,
              bottom: pageGeom.MARGIN_BOTTOM,
              left: pageGeom.MARGIN_LEFT,
              right: pageGeom.MARGIN_RIGHT,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              // Line 1: Publication Category & Monograph Scope
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 20 },
                children: [
                  new TextRun({
                    text: (report as any).retraction?.isRetracted
                      ? 'RETRACTED ARTICLE — APPRAISAL FOR TEACHING & HISTORICAL RECORD ONLY'
                      : isVerified
                      ? 'EVIDENCE-BASED CLINICAL MEDICINE  |  CRITICAL APPRAISAL REPORT'
                      : 'UNVERIFIED HEURISTIC DRAFT  |  CRITICAL APPRAISAL REPORT (PRELIMINARY)',
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    bold: true,
                    color: (report as any).retraction?.isRetracted ? 'C53030' : isVerified ? DOCX_COLORS.NAVY_PRIMARY : 'C53030',
                  }),
                ],
              }),
              // Line 2: Index Paper Title & Journal with Bottom Border Rule (P3-4)
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 20, after: 120 },
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_LIGHT },
                },
                children: [
                  new TextRun({
                    text: `${truncatedHeaderTitle}  •  ${idDescriptor}`,
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    italics: true,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 120 },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_LIGHT },
                },
                children: [
                  new TextRun({
                    text: `Generated via AppraisAI (${report.engineUsed === 'llm' ? 'Neural LLM' : 'Heuristic Screening Engine'})  •  EQUATOR, CEBM & GRADE Governed  •  Page `,
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    bold: true,
                    color: DOCX_COLORS.NAVY_PRIMARY,
                  }),
                  new TextRun({
                    text: ' of ',
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    bold: true,
                    color: DOCX_COLORS.NAVY_PRIMARY,
                  }),
                  new TextRun({
                    text: `   |   ${activeAppraiserName}`,
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ---------------------------------------------------------
          // DOCUMENT HEADER BANNER
          // ---------------------------------------------------------
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: 'EVIDENCE-BASED CLINICAL MEDICINE  |  EXECUTIVE CRITICAL APPRAISAL MONOGRAPH',
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                bold: true,
                color: DOCX_COLORS.TEAL_ACCENT,
              }),
            ],
          }),

          // Document Title
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 60, after: 140 },
            children: [
              new TextRun({
                text: `Methodological & Statistical Critical Appraisal: ${cleanTitle}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_TITLE,
                bold: true,
                color: DOCX_COLORS.NAVY_PRIMARY,
              }),
            ],
          }),

          // Appraiser Attribution
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 40, after: 120 },
            children: [
              new TextRun({
                text: `Lead Clinical Appraiser: ${activeAppraiserName}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_BODY,
                bold: true,
                color: DOCX_COLORS.NAVY_PRIMARY,
              }),
              new TextRun({
                text: `   •   ${activeAffiliation}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                color: DOCX_COLORS.SLATE_BODY,
              }),
              ...(activeOrcid
                ? [
                    new TextRun({
                      text: `   •   ORCID: ${activeOrcid}`,
                      font: TYPOGRAPHY.FONT_PRIMARY,
                      size: TYPOGRAPHY.SIZE_SMALL,
                      color: DOCX_COLORS.SLATE_MUTED,
                    }),
                  ]
                : []),
              new TextRun({
                text: `   •   Appraisal Date: ${new Date(report.completedAt).toISOString().split('T')[0]}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                color: DOCX_COLORS.SLATE_MUTED,
              }),
            ],
          }),

          // P0-3: Visible Watermark Banner on Page 1 for Heuristic Mode
          ...(report.engineUsed !== 'llm'
            ? [
                new Table({
                  width: { size: contentWidth, type: WidthType.DXA },
                  borders: CALLOUT_BORDERS_NAVY,
                  rows: [
                    new TableRow({
                      cantSplit: true,
                      children: [
                        new TableCell({
                          width: { size: contentWidth, type: WidthType.DXA },
                          shading: { type: ShadingType.CLEAR, fill: 'FFFBEB' },
                          margins: CELL_PADDING,
                          children: [
                            new Paragraph({
                              spacing: { before: 20, after: 30 },
                              children: [
                                new TextRun({
                                  text: 'HEURISTIC SCREENING DRAFT — NOT A CRITICAL APPRAISAL',
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_SMALL,
                                  bold: true,
                                  color: 'B45309',
                                }),
                              ],
                            }),
                            new Paragraph({
                              spacing: { before: 20, after: 20 },
                              children: [
                                new TextRun({
                                  text: `This document was produced via deterministic heuristic screening without neural LLM evaluation${
                                    report.fallbackReason ? ` (Fallback trigger: ${report.fallbackReason})` : ''
                                  }. All domain assessments and effect sizes are preliminary screening indicators and must be independently verified against the primary trial protocol and publication.`,
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_SMALL,
                                  color: '78350F',
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                new Paragraph({ spacing: { after: 100 }, children: [] }),
              ]
            : []),

          // ---------------------------------------------------------
          // TARGET ARTICLE BIBLIOGRAPHIC CALLOUT & DATA PROVENANCE (P3-8)
          // ---------------------------------------------------------
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_TEAL,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: contentWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.TEAL_LIGHT },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        spacing: { before: 20, after: 40 },
                        children: [
                          new TextRun({
                            text: 'TARGET ARTICLE BIBLIOGRAPHIC REFERENCE (VANCOUVER STYLE):',
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            bold: true,
                            color: DOCX_COLORS.TEAL_ACCENT,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 40 },
                        children: [
                          new TextRun({
                            text: meta.vancouverCitation,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_BODY,
                            bold: true,
                            color: DOCX_COLORS.NAVY_PRIMARY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [
                          new TextRun({
                            text: `Ingestion Depth Tracking: ${
                              isAbstractOnly
                                ? 'ABSTRACT ONLY (Publisher Paywall Fallback — In-depth surgical & table analysis restricted)'
                                : 'FULL TEXT EVALUATED (Complete manuscript body, methodology, and tables analyzed)'
                            }`,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            bold: true,
                            color: isAbstractOnly ? DOCX_COLORS.DANGER_TEXT : DOCX_COLORS.SUCCESS_TEXT,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 10, after: 10 },
                        children: [
                          new TextRun({
                            text: `Data Provenance: Appraisal Engine: ${
                              report.engineUsed === 'llm'
                                ? `Neural LLM (${report.llmDetails?.provider || 'standard'} / ${report.llmDetails?.model || 'standard'})`
                                : report.engineUsed === 'deterministic-fallback'
                                ? `Deterministic Heuristic Engine (Fallback: ${report.fallbackReason || 'provider timeout'})`
                                : 'Deterministic Heuristic Screening Engine'
                            }  •  Appraisal Mode: ${
                              report.engineUsed === 'llm' ? 'Full Critical Appraisal' : 'Heuristic Screening Draft'
                            }`,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            color: DOCX_COLORS.SLATE_BODY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 10, after: 10 },
                        children: [
                          new TextRun({
                            text: `Evidence Grounding: ${
                              report.riskOfBias.domains.filter((d) =>
                                isVerbatimInManuscript(d.supportiveEvidence, pseudoManuscript)
                              ).length
                            } of ${report.riskOfBias.domains.length} risk of bias domains supported by verbatim text quotes directly grounded in manuscript.`,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            color: DOCX_COLORS.SLATE_MUTED,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 140 }, children: [] }),

          // ---------------------------------------------------------
          // 4-COLUMN EVIDENCE CLASSIFICATION SUMMARY CARDS
          // ---------------------------------------------------------
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [cardWidth, cardWidth, cardWidth, lastCardWidth],
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: cardWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'STUDY DESIGN', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: DOCX_COLORS.SLATE_MUTED }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: report.classification.studyDesign.replace(/_/g, ' '), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: cardWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'OXFORD CEBM LEVEL', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: DOCX_COLORS.SLATE_MUTED }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: report.classification.oxfordEvidenceLevel, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: cardWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'EQUATOR GUIDELINE', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: DOCX_COLORS.SLATE_MUTED }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: report.classification.equatorReportingGuideline, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: lastCardWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'GRADE CERTAINTY', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: DOCX_COLORS.SLATE_MUTED }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: `${report.validitySynthesis.gradeCertainty} CERTAINTY`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.TEAL_ACCENT }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 1: STRUCTURED EXECUTIVE COMMENTARY ABSTRACT
          // ---------------------------------------------------------
          createHeading1('1.', 'Structured Executive Commentary Abstract'),

          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_NAVY,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: contentWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        spacing: { before: 40, after: 60 },
                        children: [
                          new TextRun({ text: 'Background: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                          new TextRun({ text: report.executiveAbstract.background, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 60 },
                        children: [
                          new TextRun({ text: 'Methodological Summary: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                          new TextRun({ text: report.executiveAbstract.methodologicalSummary, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 60 },
                        children: [
                          new TextRun({ text: 'Key Findings: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                          new TextRun({ text: report.executiveAbstract.keyFindings, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({ text: 'Critical Verdict: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.TEAL_ACCENT }),
                          new TextRun({ text: report.executiveAbstract.criticalVerdict, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 2: PICO/PECO DECONSTRUCTION
          // ---------------------------------------------------------
          createHeading1('2.', 'PICO/PECO Deconstruction & Study Characteristics'),

          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2400, contentWidth - 2400],
            rows: [
              new TableRow({
                tableHeader: true,
                cantSplit: true,
                children: [
                  createTableHeaderCell('PICO DIMENSION', 2400),
                  createTableHeaderCell('CLINICAL & METHODOLOGICAL SPECIFICATION', contentWidth - 2400),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Population (P)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2400, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.population, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Intervention / Exposure (I)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2400, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.interventionOrExposure, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Comparator (C)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2400, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.comparator, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Primary Outcomes (O)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2400, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: report.pico.primaryOutcomes && report.pico.primaryOutcomes.length > 0
                      ? report.pico.primaryOutcomes.map((po) =>
                          new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                              new TextRun({ text: '•  ', bold: true, color: DOCX_COLORS.TEAL_ACCENT, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE }),
                              new TextRun({ text: po.replace(/\.+$/, ''), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE }),
                            ],
                          })
                        )
                      : [new Paragraph({ children: [new TextRun({ text: 'Not clearly specified in manuscript text', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, italics: true })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Secondary Endpoints', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2400, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: report.pico.secondaryOutcomes && report.pico.secondaryOutcomes.length > 0
                      ? report.pico.secondaryOutcomes.map((so) =>
                          new Paragraph({
                            spacing: { before: 20, after: 20 },
                            children: [
                              new TextRun({ text: '•  ', bold: true, color: DOCX_COLORS.SLATE_MUTED, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE }),
                              new TextRun({ text: so.replace(/\.+$/, ''), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE }),
                            ],
                          })
                        )
                      : [new Paragraph({ children: [new TextRun({ text: 'None reported or evaluated in available text', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, italics: true, color: DOCX_COLORS.SLATE_MUTED })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Timeframe & Setting', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2400, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: `Follow-up Window: ${report.pico.timeframe}  |  Clinical Setting: ${report.pico.setting}`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
          createBodyParagraph(`Design Classification Rationale: ${report.classification.studyDesignRationale}`, { italic: true }),

          // ---------------------------------------------------------
          // SECTION 3: RISK OF BIAS ASSESSMENT MATRIX
          // ---------------------------------------------------------
          createHeading1('3.', `Risk of Bias Assessment Matrix (${report.riskOfBias.governingTool})`),

          createBodyParagraph(`Methodological Rationale: ${report.riskOfBias.overallRationale}`),

          // Horizontal RoB Traffic-Light Visual Summary Strip
          new Paragraph({
            spacing: { before: 80, after: 60 },
            children: [
              new TextRun({
                text: 'Figure 1: Risk of Bias Domain Summary Strip (RevMan Traffic-Light Format)',
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                bold: true,
                color: DOCX_COLORS.NAVY_PRIMARY,
              }),
            ],
          }),

          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            rows: [
              new TableRow({
                cantSplit: true,
                children: report.riskOfBias.domains.map((d, idx) => {
                  const s = getRobStatusTokens(d.judgement);
                  const isLast = idx === report.riskOfBias.domains.length - 1;
                  const colWidth = isLast ? lastStripWidth : baseStripWidth;
                  return new TableCell({
                    width: { size: colWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: s.bg },
                    margins: CELL_PADDING_COMPACT,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: s.symbol, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: s.text }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 20 },
                        children: [
                          new TextRun({ text: d.domainName, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                    ],
                  });
                }),
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 120 }, children: [] }),

          // Detailed RoB Table (P3-2: cantSplit and tableHeader)
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2200, 1800, contentWidth - 6200, 2200],
            rows: [
              new TableRow({
                tableHeader: true,
                cantSplit: true,
                children: [
                  createTableHeaderCell('DOMAIN', 2200),
                  createTableHeaderCell('JUDGEMENT', 1800),
                  createTableHeaderCell('SUPPORTIVE TEXT EVIDENCE', contentWidth - 6200),
                  createTableHeaderCell('CRITICAL SIGNIFICANCE', 2200),
                ],
              }),
              ...report.riskOfBias.domains.map((d) => {
                const s = getRobStatusTokens(d.judgement);
                const isQuote = isVerbatimInManuscript(d.supportiveEvidence, pseudoManuscript);
                return new TableRow({
                  cantSplit: true,
                  children: [
                    new TableCell({
                      width: { size: 2200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: d.domainName, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                    }),
                    new TableCell({
                      width: { size: 1800, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: s.bg },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.symbol, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true, color: s.text })] })],
                    }),
                    new TableCell({
                      width: { size: contentWidth - 6200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [
                        new Paragraph({
                          children: isQuote
                            ? [
                                new TextRun({
                                  text: '[Quote] ',
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                  bold: true,
                                  color: DOCX_COLORS.TEAL_ACCENT,
                                }),
                                new TextRun({
                                  text: `"${d.supportiveEvidence}"`,
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                  italics: true,
                                }),
                              ]
                            : [
                                new TextRun({
                                  text: '[Appraiser note (AI-generated)] ',
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                  bold: true,
                                  color: DOCX_COLORS.SLATE_MUTED,
                                }),
                                new TextRun({
                                  text: d.supportiveEvidence,
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                }),
                              ],
                        }),
                      ],
                    }),
                    new TableCell({
                      width: { size: 2200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: d.criticalSignificance, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                    }),
                  ],
                });
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 4: EQUATOR REPORTING COMPLIANCE
          // ---------------------------------------------------------
          createHeading1('4.', `EQUATOR Network Reporting Compliance (${report.equatorChecklist.guidelineName})`),

          createBodyParagraph(
            `Overall Transparent Reporting Compliance: ${report.equatorChecklist.overallCompliancePercentage}%. ${report.equatorChecklist.overallComplianceSummary}`
          ),

          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [1800, 2800, 1760, contentWidth - 6360],
            rows: [
              new TableRow({
                tableHeader: true,
                cantSplit: true,
                children: [
                  createTableHeaderCell('ITEM & SECTION', 1800),
                  createTableHeaderCell('REQUIREMENT', 2800),
                  createTableHeaderCell('STATUS', 1760),
                  createTableHeaderCell('MANUSCRIPT EVIDENCE / LOCATION', contentWidth - 6360),
                ],
              }),
              ...report.equatorChecklist.criticalItemsAudit.map((item) => {
                const s = getEquatorStatusTokens(item.status);
                const isQuote = isVerbatimInManuscript(item.evidenceOrPageLocation, pseudoManuscript);
                return new TableRow({
                  cantSplit: true,
                  children: [
                    new TableCell({
                      width: { size: 1800, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: item.itemNumberAndSection, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                    }),
                    new TableCell({
                      width: { size: 2800, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: item.requirement, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                    }),
                    new TableCell({
                      width: { size: 1760, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: s.bg },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.symbol, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true, color: s.text })] })],
                    }),
                    new TableCell({
                      width: { size: contentWidth - 6360, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [
                        new Paragraph({
                          children: isQuote
                            ? [
                                new TextRun({
                                  text: '[Quote] ',
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                  bold: true,
                                  color: DOCX_COLORS.TEAL_ACCENT,
                                }),
                                new TextRun({
                                  text: `"${item.evidenceOrPageLocation}"`,
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                  italics: true,
                                }),
                              ]
                            : [
                                new TextRun({
                                  text: '[Appraiser note] ',
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                  bold: true,
                                  color: DOCX_COLORS.SLATE_MUTED,
                                }),
                                new TextRun({
                                  text: item.evidenceOrPageLocation,
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                }),
                              ],
                        }),
                      ],
                    }),
                  ],
                });
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 5: STATISTICAL & METHODOLOGICAL RIGOR AUDIT
          // ---------------------------------------------------------
          createHeading1('5.', 'Deep Statistical & Methodological Rigor Audit'),

          createHeading2('Sample Size & Statistical Power'),
          createBodyParagraph(
            `Adequacy Assessment: ${report.statisticalAudit.sampleSizePowerCalculation.adequacyAssessment.replace(/\.+$/, '')}. ` +
            (report.statisticalAudit.sampleSizePowerCalculation.alphaAndPower
              ? `Alpha & Power: ${report.statisticalAudit.sampleSizePowerCalculation.alphaAndPower.replace(/\.+$/, '')}. `
              : '') +
            (report.statisticalAudit.sampleSizePowerCalculation.assumedEffectSize
              ? `Assumed Effect Size: ${report.statisticalAudit.sampleSizePowerCalculation.assumedEffectSize.replace(/\.+$/, '')}.`
              : '')
          ),

          createHeading2('Analysis Populations & Missing Data Handling'),
          createBodyParagraph(
            `Primary Analysis Population: ${report.statisticalAudit.analysisType.replace(/_/g, ' ')}. ` +
            `Missing Data Strategy: ${report.statisticalAudit.missingDataHandling}`
          ),

          createHeading2('Confounding Control & Multiplicity Testing'),
          createBodyParagraph(`Covariate Adjustment: ${report.statisticalAudit.confoundingAndCovariateAdjustment}`),
          createBodyParagraph(`Subgroup & Multiplicity Audit: ${report.statisticalAudit.multiplicityAndSubgroupAudit}`),

          // Effect Estimates Table
          createHeading2('Observed Primary & Secondary Effect Estimates'),
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2200, 1100, 1300, 1400, 1160, contentWidth - 7160],
            rows: [
              new TableRow({
                tableHeader: true,
                cantSplit: true,
                children: [
                  createTableHeaderCell('OUTCOME', 2200),
                  createTableHeaderCell('METRIC', 1100),
                  createTableHeaderCell('ESTIMATE', 1300),
                  createTableHeaderCell('95% CI', 1400),
                  createTableHeaderCell('P-VALUE', 1160),
                  createTableHeaderCell('CLINICAL SIGNIFICANCE', contentWidth - 7160),
                ],
              }),
              ...(report.statisticalAudit.effectEstimates.length > 0
                ? report.statisticalAudit.effectEstimates.map((est) => {
                    return new TableRow({
                      cantSplit: true,
                      children: [
                        new TableCell({
                          width: { size: 2200, type: WidthType.DXA },
                          margins: CELL_PADDING,
                          children: [new Paragraph({ children: [new TextRun({ text: est.outcome, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                        }),
                        new TableCell({
                          width: { size: 1100, type: WidthType.DXA },
                          margins: CELL_PADDING,
                          children: [new Paragraph({ children: [new TextRun({ text: est.metric, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                        }),
                        new TableCell({
                          width: { size: 1300, type: WidthType.DXA },
                          margins: CELL_PADDING,
                          children: [new Paragraph({ children: [new TextRun({ text: est.pointEstimate, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true })] })],
                        }),
                        new TableCell({
                          width: { size: 1400, type: WidthType.DXA },
                          margins: CELL_PADDING,
                          children: [new Paragraph({ children: [new TextRun({ text: est.confidenceInterval, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                        }),
                        new TableCell({
                          width: { size: 1160, type: WidthType.DXA },
                          margins: CELL_PADDING,
                          children: [new Paragraph({ children: [new TextRun({ text: est.pValue, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                        }),
                        new TableCell({
                          width: { size: contentWidth - 7160, type: WidthType.DXA },
                          margins: CELL_PADDING,
                          children: [new Paragraph({ children: [new TextRun({ text: est.clinicalVsStatisticalSignificance, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                        }),
                      ],
                    });
                  })
                : [
                    new TableRow({
                      cantSplit: true,
                      children: [
                        new TableCell({
                          columnSpan: 6,
                          width: { size: contentWidth, type: WidthType.DXA },
                          margins: CELL_PADDING,
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              children: [
                                new TextRun({
                                  text: 'No quantitative effect estimates could be automatically extracted from available manuscript text.',
                                  font: TYPOGRAPHY.FONT_PRIMARY,
                                  size: TYPOGRAPHY.SIZE_TABLE,
                                  italics: true,
                                  color: DOCX_COLORS.SLATE_MUTED,
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ]),
            ],
          }),

          // Spin & Overinterpretation Callout Box
          new Paragraph({ spacing: { before: 100, after: 60 }, children: [] }),
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_NAVY,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: contentWidth, type: WidthType.DXA },
                    shading: {
                      type: ShadingType.CLEAR,
                      fill: report.statisticalAudit.spinAndDiscrepancyAudit.spinDetected
                        ? DOCX_COLORS.DANGER_BG
                        : DOCX_COLORS.SUCCESS_BG,
                    },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        spacing: { before: 20, after: 30 },
                        children: [
                          new TextRun({
                            text: report.statisticalAudit.spinAndDiscrepancyAudit.spinDetected
                              ? 'SPIN & OVERINTERPRETATION WARNING DETECTED:'
                              : 'SPIN AUDIT: NO METHODOLOGICAL DISCREPANCIES IDENTIFIED',
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            bold: true,
                            color: report.statisticalAudit.spinAndDiscrepancyAudit.spinDetected
                              ? DOCX_COLORS.DANGER_TEXT
                              : DOCX_COLORS.SUCCESS_TEXT,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 30 },
                        children: [
                          new TextRun({
                            text: report.statisticalAudit.spinAndDiscrepancyAudit.discrepancyDetails,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_BODY,
                            color: DOCX_COLORS.NAVY_PRIMARY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [
                          new TextRun({
                            text: `Recommendation for Clinical Interpretation: ${report.statisticalAudit.spinAndDiscrepancyAudit.recommendationForInterpretation}`,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            bold: true,
                            color: DOCX_COLORS.SLATE_BODY,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 6: METHODOLOGICAL STRENGTHS & LIMITATIONS
          // ---------------------------------------------------------
          createHeading1('6.', 'Strengths, Limitations, Validity & GRADE Synthesis'),

          createHeading2('Major Methodological Strengths'),
          ...report.statisticalAudit.strengthsAndLimitations.majorStrengths.map(
            (s) => createBodyParagraph(`•  ${s}`)
          ),

          createHeading2('Fatal Methodological Flaws & Critical Biases'),
          ...(report.statisticalAudit.strengthsAndLimitations.fatalMethodologicalFlaws.length > 0
            ? report.statisticalAudit.strengthsAndLimitations.fatalMethodologicalFlaws.map(
                (f) => createBodyParagraph(`•  ${f}`)
              )
            : [createBodyParagraph('•  No fatal methodological flaws identified.')]),

          createHeading2('Minor Methodological Limitations'),
          ...report.statisticalAudit.strengthsAndLimitations.minorLimitations.map(
            (l) => createBodyParagraph(`•  ${l}`)
          ),

          createHeading2('Internal Validity (Confounding, Bias & Chance)'),
          createBodyParagraph(report.validitySynthesis.internalValidity),

          createHeading2('External Validity & Clinical Generalizability'),
          createBodyParagraph(report.validitySynthesis.externalValidityAndGeneralizability),

          createHeading2('Commercial Funding & Conflicts of Interest'),
          createBodyParagraph(report.validitySynthesis.conflictsOfInterestAndFundingCritique),

          // GRADE Certainty Table
          createHeading2('GRADE-informed Certainty of Evidence (Single Study)'),
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2600, contentWidth - 2600],
            rows: [
              new TableRow({
                tableHeader: true,
                cantSplit: true,
                children: [
                  createTableHeaderCell('GRADE DIMENSION', 2600),
                  createTableHeaderCell('EVALUATION & SYNTHESIS', contentWidth - 2600),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Final GRADE Rating', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2600, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: `${report.validitySynthesis.gradeCertainty} CERTAINTY OF EVIDENCE`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.TEAL_ACCENT })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Downgrading Factors', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2600, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.validitySynthesis.gradeDowngradingFactors.join('; ') || 'None', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Upgrading Factors', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2600, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.validitySynthesis.gradeUpgradingFactors && report.validitySynthesis.gradeUpgradingFactors.length > 0 ? report.validitySynthesis.gradeUpgradingFactors.join('; ') : 'None identified (single observational study or non-replicated trial)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Synthesis Rationale', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: contentWidth - 2600, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.validitySynthesis.gradeRationale, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 7: CLINICAL PRACTICE TRANSLATION & VERDICT
          // ---------------------------------------------------------
          createHeading1('7.', 'Clinical Practice Translation & Verdict'),

          createBodyParagraph(
            `Key Takeaway for Clinicians: ${report.clinicalPracticeBottomLine.keyTakeawayForClinicians}`,
            { bold: true, color: DOCX_COLORS.NAVY_PRIMARY }
          ),
          createBodyParagraph(
            `Applicability to Real-World Clinical Practice: ${report.clinicalPracticeBottomLine.applicabilityToPractice}`
          ),
          createBodyParagraph(
            `Recommendations for Future Research: ${report.clinicalPracticeBottomLine.recommendationsForFutureResearch}`,
            { italic: true }
          ),

          // METHODOLOGICAL & EDITORIAL GOVERNANCE DISCLAIMER
          new Paragraph({ spacing: { before: 140, after: 60 }, children: [] }),
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_TEAL,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: contentWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.TEAL_LIGHT },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        spacing: { before: 20, after: 30 },
                        children: [
                          new TextRun({
                            text: 'METHODOLOGICAL GOVERNANCE & EDITORIAL DISCLAIMER:',
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            bold: true,
                            color: DOCX_COLORS.TEAL_ACCENT,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [
                          new TextRun({
                            text: `This report was drafted with AI assistance (engine: ${
                              report.engineUsed === 'llm'
                                ? `LLM — ${report.llmDetails?.provider || 'neural'} / ${report.llmDetails?.model || 'standard'}`
                                : report.engineUsed === 'deterministic-fallback'
                                ? `Heuristic Screening Engine (LLM fallback: ${report.fallbackReason || 'provider timeout'})`
                                : 'Heuristic Screening Engine'
                            }). It has ${
                              isVerified ? 'been reviewed and verified' : 'not been independently verified'
                            } by the named clinical appraiser (${activeAppraiserName}${activeOrcid ? ', ORCID: ' + activeOrcid : ''}). Structured under EQUATOR Network guidelines (${report.classification.equatorReportingGuideline}), OCEBM Evidence Levels, and GRADE certainty criteria. Prepared for academic peer review and clinical governance.`,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            color: DOCX_COLORS.SLATE_BODY,
                            italics: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 8: NUMBERED VANCOUVER REFERENCES
          // ---------------------------------------------------------
          createHeading1('8.', 'References'),

          ...report.references.map((ref) => {
            const hasDoiInCitation = ref.vancouverCitation.toLowerCase().includes('doi:');
            const citationWithDoi = ref.doiOrUrl && !hasDoiInCitation
              ? `${ref.vancouverCitation} ${ref.doiOrUrl}`
              : ref.vancouverCitation;
            return new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: 240, before: 60, after: 60 },
              children: [
                new TextRun({
                  text: `[${ref.number}]  `,
                  font: TYPOGRAPHY.FONT_PRIMARY,
                  size: TYPOGRAPHY.SIZE_TABLE,
                  bold: true,
                  color: DOCX_COLORS.NAVY_PRIMARY,
                }),
                new TextRun({
                  text: citationWithDoi,
                  font: TYPOGRAPHY.FONT_PRIMARY,
                  size: TYPOGRAPHY.SIZE_TABLE,
                  color: DOCX_COLORS.SLATE_BODY,
                }),
              ],
            });
          }),
        ],
      },
    ],
  });
}

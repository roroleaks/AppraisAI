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
} from 'docx';
import {
  MasterAppraisalReport,
  BiasJudgement,
} from '../schemas/appraisal.schema';
import {
  DOCX_COLORS,
  PAGE_GEOMETRY,
  TYPOGRAPHY,
  CELL_PADDING,
  CELL_PADDING_COMPACT,
  TABLE_BORDERS_CLEAN,
  CALLOUT_BORDERS_TEAL,
  CALLOUT_BORDERS_NAVY,
} from './styles';
import { cleanBiomedicalTitle, cleanBiomedicalAuthors } from '../parsers/title-sanitizer';

export interface AppraiserMetadata {
  name: string;
  affiliation?: string;
  orcid?: string;
  email?: string;
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
 * Creates an executive Heading 1 with bottom border accent.
 */
function createHeading1(sectionNumber: string, title: string): Paragraph {
  return new Paragraph({
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
 * Creates a subsection Heading 2 in Accent Teal.
 */
function createHeading2(title: string): Paragraph {
  return new Paragraph({
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
 * Returns traffic-light formatting tokens for Risk of Bias and EQUATOR statuses.
 */
function getStatusTokens(
  status: BiasJudgement | string
): { bg: string; text: string; label: string; symbol: string } {
  switch (status) {
    case 'LOW_RISK':
    case 'REPORTED':
      return { bg: DOCX_COLORS.SUCCESS_BG, text: DOCX_COLORS.SUCCESS_TEXT, label: 'Low Risk', symbol: '(+) LOW RISK' };
    case 'SOME_CONCERNS':
    case 'PARTIALLY_REPORTED':
      return { bg: DOCX_COLORS.WARNING_BG, text: DOCX_COLORS.WARNING_TEXT, label: 'Some Concerns', symbol: '(?) SOME CONCERNS' };
    case 'HIGH_RISK':
    case 'NOT_REPORTED':
      return { bg: DOCX_COLORS.DANGER_BG, text: DOCX_COLORS.DANGER_TEXT, label: 'High Risk', symbol: '(-) HIGH RISK' };
    case 'UNCLEAR_NOT_REPORTED':
    case 'NOT_APPLICABLE':
    default:
      return { bg: DOCX_COLORS.NEUTRAL_BG, text: DOCX_COLORS.NEUTRAL_TEXT, label: 'Unclear', symbol: '[!] UNCLEAR' };
  }
}

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
  const truncatedHeaderTitle = cleanTitle.length > 55 ? `${cleanTitle.slice(0, 52)}...` : cleanTitle;
  const cleanAuthors = cleanBiomedicalAuthors(meta.authors);
  const authorsString = cleanAuthors.join(', ');

  const activeAppraiserName = appraiser?.name || 'Dr. Raouf Roshdy, MD';
  const activeAffiliation = appraiser?.affiliation || 'Department of Clinical Epidemiology & Evidence-Based Medicine';
  const activeOrcid = appraiser?.orcid || '0000-0002-1825-0097';

  // Compute RoB strip column width summing to exact printable width 9360 dxa
  const domainCount = Math.max(1, report.riskOfBias.domains.length);
  const baseStripWidth = Math.floor(PAGE_GEOMETRY.CONTENT_WIDTH / domainCount);
  const lastStripWidth = PAGE_GEOMETRY.CONTENT_WIDTH - baseStripWidth * (domainCount - 1);

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
              width: PAGE_GEOMETRY.PAGE_WIDTH,
              height: PAGE_GEOMETRY.PAGE_HEIGHT,
            },
            margin: {
              top: PAGE_GEOMETRY.MARGIN_TOP,
              bottom: PAGE_GEOMETRY.MARGIN_BOTTOM,
              left: PAGE_GEOMETRY.MARGIN_LEFT,
              right: PAGE_GEOMETRY.MARGIN_RIGHT,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_LIGHT },
                },
                children: [
                  new TextRun({
                    text: `${truncatedHeaderTitle} | ${meta.journal || 'Biomedical Science and Clinical Research'}`,
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    italics: true,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                  new TextRun({
                    text: '   •   EVIDENCE-BASED CRITICAL APPRAISAL',
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_SMALL,
                    bold: true,
                    color: DOCX_COLORS.NAVY_PRIMARY,
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
                    text: 'Generated via AppraisAI  •  EQUATOR, CEBM & GRADE Governed  •  Page ',
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
            spacing: { before: 40, after: 180 },
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
              new TextRun({
                text: `   •   ORCID: ${activeOrcid}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                color: DOCX_COLORS.SLATE_MUTED,
              }),
              new TextRun({
                text: `   •   Appraisal Date: ${new Date(report.completedAt).toLocaleDateString()}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                color: DOCX_COLORS.SLATE_MUTED,
              }),
            ],
          }),

          // ---------------------------------------------------------
          // TARGET ARTICLE BIBLIOGRAPHIC CALLOUT CARD (Ice Teal Fill)
          // ---------------------------------------------------------
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_TEAL,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
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
                            text: `${authorsString}. ${cleanTitle}. ${meta.journal || 'Biomed Sci Clin Res'}. ${meta.publicationYear || 2026}${meta.volume ? ';' + meta.volume : ''}${meta.issue ? '(' + meta.issue + ')' : ''}${meta.pages ? ':' + meta.pages : ''}.${meta.doi ? ' doi:' + meta.doi : ''}`,
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
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2340, 2340, 2340, 2340],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2340, type: WidthType.DXA },
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
                    width: { size: 2340, type: WidthType.DXA },
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
                    width: { size: 2340, type: WidthType.DXA },
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
                    width: { size: 2340, type: WidthType.DXA },
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
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_NAVY,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
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
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2400, 6960],
            rows: [
              new TableRow({
                children: [
                  createTableHeaderCell('PICO DIMENSION', 2400),
                  createTableHeaderCell('CLINICAL & METHODOLOGICAL SPECIFICATION', 6960),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Population (P)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.population, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Intervention / Exposure (I)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.interventionOrExposure, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Comparator (C)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.comparator, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Primary Outcomes (O)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.primaryOutcomes.join('; '), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Timeframe & Setting', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
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
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            rows: [
              new TableRow({
                children: report.riskOfBias.domains.map((d, idx) => {
                  const s = getStatusTokens(d.judgement);
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

          // Detailed RoB Table
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2200, 1800, 3160, 2200],
            rows: [
              new TableRow({
                children: [
                  createTableHeaderCell('DOMAIN', 2200),
                  createTableHeaderCell('JUDGEMENT', 1800),
                  createTableHeaderCell('SUPPORTIVE TEXT EVIDENCE', 3160),
                  createTableHeaderCell('CRITICAL SIGNIFICANCE', 2200),
                ],
              }),
              ...report.riskOfBias.domains.map((d) => {
                const s = getStatusTokens(d.judgement);
                return new TableRow({
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
                      width: { size: 3160, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: `"${d.supportiveEvidence}"`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, italics: true })] })],
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
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [1800, 2800, 1760, 3000],
            rows: [
              new TableRow({
                children: [
                  createTableHeaderCell('ITEM & SECTION', 1800),
                  createTableHeaderCell('REQUIREMENT', 2800),
                  createTableHeaderCell('STATUS', 1760),
                  createTableHeaderCell('MANUSCRIPT EVIDENCE / LOCATION', 3000),
                ],
              }),
              ...report.equatorChecklist.criticalItemsAudit.map((item) => {
                const s = getStatusTokens(item.status);
                return new TableRow({
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
                      width: { size: 3000, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: item.evidenceOrPageLocation, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, italics: true })] })],
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
            `Adequacy Assessment: ${report.statisticalAudit.sampleSizePowerCalculation.adequacyAssessment}. ` +
            (report.statisticalAudit.sampleSizePowerCalculation.alphaAndPower
              ? `Alpha & Power: ${report.statisticalAudit.sampleSizePowerCalculation.alphaAndPower}. `
              : '') +
            (report.statisticalAudit.sampleSizePowerCalculation.assumedEffectSize
              ? `Assumed Effect Size: ${report.statisticalAudit.sampleSizePowerCalculation.assumedEffectSize}.`
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
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2200, 1100, 1300, 1400, 1160, 2200],
            rows: [
              new TableRow({
                children: [
                  createTableHeaderCell('OUTCOME', 2200),
                  createTableHeaderCell('METRIC', 1100),
                  createTableHeaderCell('ESTIMATE', 1300),
                  createTableHeaderCell('95% CI', 1400),
                  createTableHeaderCell('P-VALUE', 1160),
                  createTableHeaderCell('CLINICAL SIGNIFICANCE', 2200),
                ],
              }),
              ...report.statisticalAudit.effectEstimates.map((est) => {
                return new TableRow({
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
                      width: { size: 2200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: est.clinicalVsStatisticalSignificance, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                    }),
                  ],
                });
              }),
            ],
          }),

          // Spin & Overinterpretation Callout Box
          new Paragraph({ spacing: { before: 100, after: 60 }, children: [] }),
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_NAVY,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
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
          createHeading2('GRADE Certainty of Evidence Synthesis'),
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2600, 6760],
            rows: [
              new TableRow({
                children: [
                  createTableHeaderCell('GRADE DIMENSION', 2600),
                  createTableHeaderCell('EVALUATION & SYNTHESIS', 6760),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Final GRADE Rating', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6760, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: `${report.validitySynthesis.gradeCertainty} CERTAINTY OF EVIDENCE`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.TEAL_ACCENT })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Downgrading Factors', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6760, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.validitySynthesis.gradeDowngradingFactors.join('; ') || 'None', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Synthesis Rationale', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TABLE, bold: true, color: DOCX_COLORS.NAVY_PRIMARY })] })],
                  }),
                  new TableCell({
                    width: { size: 6760, type: WidthType.DXA },
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
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: CALLOUT_BORDERS_TEAL,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
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
                            text: `This critical appraisal was authored and structured via AppraisAI in strict adherence to the EQUATOR Network reporting frameworks (${report.classification.equatorReportingGuideline}), the Oxford Centre for Evidence-Based Medicine (CEBM) Levels of Evidence, and the GRADE Working Group certainty criteria. The evaluation has been conducted and approved by the undersigned clinical appraiser (${activeAppraiserName}, ORCID: ${activeOrcid}). This document is prepared for academic peer commentary, journal club presentation, and clinical governance purposes.`,
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
                  text: ref.vancouverCitation,
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

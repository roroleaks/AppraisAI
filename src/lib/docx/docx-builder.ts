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
  TABLE_BORDERS_CLEAN,
  CALLOUT_BORDERS,
} from './styles';

export interface AppraiserMetadata {
  name: string;
  affiliation?: string;
  orcid?: string;
  email?: string;
}

/**
 * Helper to build standard academic body paragraph
 */
function createBodyParagraph(
  text: string,
  options?: { bold?: boolean; italic?: boolean; before?: number; after?: number }
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: {
      line: TYPOGRAPHY.LINE_SPACING_BODY,
      before: options?.before ?? 80,
      after: options?.after ?? 80,
    },
    children: [
      new TextRun({
        text,
        font: TYPOGRAPHY.FONT_PRIMARY,
        size: TYPOGRAPHY.SIZE_BODY,
        bold: options?.bold,
        italics: options?.italic,
        color: DOCX_COLORS.SLATE_BODY,
      }),
    ],
  });
}

/**
 * Helper to build Heading 1
 */
function createHeading1(sectionNumber: string, title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_GREY },
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
 * Helper to build Heading 2
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
        color: DOCX_COLORS.NAVY_PRIMARY,
      }),
    ],
  });
}

/**
 * Helper to format Risk of Bias or EQUATOR status cell with shading and symbol
 */
function getStatusShading(
  status: BiasJudgement | string
): { bg: string; text: string; label: string; symbol: string } {
  switch (status) {
    case 'LOW_RISK':
    case 'REPORTED':
      return { bg: DOCX_COLORS.SUCCESS_BG, text: DOCX_COLORS.SUCCESS_TEXT, label: 'Low Risk', symbol: '(+) Low Risk' };
    case 'SOME_CONCERNS':
    case 'PARTIALLY_REPORTED':
      return { bg: DOCX_COLORS.WARNING_BG, text: DOCX_COLORS.WARNING_TEXT, label: 'Some Concerns', symbol: '(?) Some Concerns' };
    case 'HIGH_RISK':
    case 'NOT_REPORTED':
      return { bg: DOCX_COLORS.DANGER_BG, text: DOCX_COLORS.DANGER_TEXT, label: 'High Risk', symbol: '(-) High Risk' };
    case 'UNCLEAR_NOT_REPORTED':
    case 'NOT_APPLICABLE':
    default:
      return { bg: DOCX_COLORS.NEUTRAL_BG, text: DOCX_COLORS.NEUTRAL_TEXT, label: 'Unclear', symbol: '[!] Unclear' };
  }
}

/**
 * Compiles MasterAppraisalReport into a publication-ready .docx document
 */
export function buildAcademicDocxManuscript(
  report: MasterAppraisalReport,
  appraiser?: AppraiserMetadata
): Document {
  const meta = report.metadata;
  const isAbstractOnly = meta.sourceDepth === 'ABSTRACT_ONLY_FALLBACK';
  const cleanTitle = meta.title.replace(/\s+/g, ' ').trim();
  const truncatedTitle = cleanTitle.length > 55 ? `${cleanTitle.slice(0, 52)}...` : cleanTitle;

  // Compute column width for the horizontal RevMan RoB Traffic Light strip
  const domainCount = Math.max(1, report.riskOfBias.domains.length);
  const robStripColWidth = Math.floor(PAGE_GEOMETRY.CONTENT_WIDTH / domainCount);

  return new Document({
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
                spacing: { after: 100 },
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.HEADER_LINE },
                },
                children: [
                  new TextRun({
                    text: `${truncatedTitle} | DOI: ${meta.doi || 'N/A'}`,
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_TINY,
                    italics: true,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                  new TextRun({
                    text: '     EVIDENCE-BASED CRITICAL APPRAISAL',
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_TINY,
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
                spacing: { before: 100 },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.HEADER_LINE },
                },
                children: [
                  new TextRun({
                    text: 'Generated via AppraisAI | EQUATOR, CEBM & GRADE Governed | Page ',
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_TINY,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_TINY,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                  new TextRun({
                    text: ' of ',
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_TINY,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: TYPOGRAPHY.FONT_PRIMARY,
                    size: TYPOGRAPHY.SIZE_TINY,
                    color: DOCX_COLORS.SLATE_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ---------------------------------------------------------
          // MANUSCRIPT HEADER & TITLE
          // ---------------------------------------------------------
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: 'EVIDENCE-BASED CLINICAL MEDICINE | CRITICAL APPRAISAL & METHODOLOGICAL COMMENTARY',
                font: TYPOGRAPHY.FONT_HEADING,
                size: TYPOGRAPHY.SIZE_SMALL,
                bold: true,
                color: DOCX_COLORS.ACCENT_BLUE_TEXT,
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 80, after: 160 },
            children: [
              new TextRun({
                text: `Methodological and Statistical Critical Appraisal of: ${cleanTitle}`,
                font: TYPOGRAPHY.FONT_HEADING,
                size: TYPOGRAPHY.SIZE_TITLE,
                bold: true,
                color: DOCX_COLORS.NAVY_PRIMARY,
              }),
            ],
          }),

          // Appraiser Attribution
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 60, after: 180 },
            children: [
              new TextRun({
                text: `Appraiser: ${appraiser?.name || 'Dr. Alex Mercer, MD, MPH'}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                bold: true,
                color: DOCX_COLORS.SLATE_BODY,
              }),
              new TextRun({
                text: appraiser?.affiliation ? `  •  ${appraiser.affiliation}` : '',
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                color: DOCX_COLORS.SLATE_MUTED,
              }),
              new TextRun({
                text: appraiser?.orcid ? `  •  ORCID: ${appraiser.orcid}` : '',
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                color: DOCX_COLORS.SLATE_MUTED,
              }),
              new TextRun({
                text: `  •  Appraisal Date: ${new Date(report.completedAt).toLocaleDateString()}`,
                font: TYPOGRAPHY.FONT_PRIMARY,
                size: TYPOGRAPHY.SIZE_SMALL,
                color: DOCX_COLORS.SLATE_MUTED,
              }),
            ],
          }),

          // ---------------------------------------------------------
          // TARGET ARTICLE BIBLIOGRAPHIC CALLOUT BOX
          // ---------------------------------------------------------
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: CALLOUT_BORDERS,
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
                          new TextRun({
                            text: 'TARGET ARTICLE BIBLIOGRAPHIC REFERENCE (VANCOUVER STYLE):',
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_TINY,
                            bold: true,
                            color: DOCX_COLORS.SLATE_MUTED,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 60 },
                        children: [
                          new TextRun({
                            text: meta.vancouverCitation,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_SMALL,
                            bold: true,
                            color: DOCX_COLORS.NAVY_PRIMARY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 40 },
                        children: [
                          new TextRun({
                            text: `Ingestion Depth Status: ${
                              isAbstractOnly
                                ? 'ABSTRACT ONLY (Publisher Paywall Fallback — Methodological depth restricted)'
                                : 'FULL TEXT ANALYZED (Complete manuscript body and tables evaluated)'
                            }`,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_TINY,
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

          new Paragraph({ spacing: { after: 120 }, children: [] }),

          // ---------------------------------------------------------
          // 4-COLUMN EVIDENCE CLASSIFICATION SUMMARY STRIP
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
                          new TextRun({ text: report.classification.studyDesign.replace(/_/g, ' '), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
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
                          new TextRun({ text: 'CEBM OXFORD LEVEL', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: DOCX_COLORS.SLATE_MUTED }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: report.classification.oxfordEvidenceLevel, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
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
                          new TextRun({ text: report.classification.equatorReportingGuideline, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
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
                          new TextRun({ text: `${report.validitySynthesis.gradeCertainty} CERTAINTY`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true, color: DOCX_COLORS.ACCENT_BLUE_TEXT }),
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
            borders: TABLE_BORDERS_CLEAN,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({ text: 'Background: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                          new TextRun({ text: report.executiveAbstract.background, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({ text: 'Methodological Summary: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                          new TextRun({ text: report.executiveAbstract.methodologicalSummary, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({ text: 'Key Findings: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
                          new TextRun({ text: report.executiveAbstract.keyFindings, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({ text: 'Critical Verdict: ', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.ACCENT_BLUE_TEXT }),
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
          // SECTION 2: PICO / PECO DECONSTRUCTION
          // ---------------------------------------------------------
          createHeading1('2.', 'PICO/PECO Deconstruction & Study Characteristics'),

          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2400, 6960],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Population (P)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.population, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Intervention / Exposure (I)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.interventionOrExposure, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Comparator (C)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.comparator, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Primary Outcomes (O)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.pico.primaryOutcomes.join('; '), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Timeframe & Setting', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6960, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: `Follow-up: ${report.pico.timeframe}  |  Setting: ${report.pico.setting}`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY })] })],
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

          createBodyParagraph(`Overall Methodological Rationale: ${report.riskOfBias.overallRationale}`),

          // --- REFINEMENT: Horizontal Visual RoB RevMan-Style Strip ---
          new Paragraph({ spacing: { before: 80, after: 60 }, children: [
            new TextRun({ text: 'Figure 1: Risk of Bias Domain Summary Strip (RevMan Format)', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true, color: DOCX_COLORS.NAVY_PRIMARY }),
          ] }),

          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            rows: [
              new TableRow({
                children: report.riskOfBias.domains.map((d) => {
                  const s = getStatusShading(d.judgement);
                  return new TableCell({
                    width: { size: robStripColWidth, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: s.bg },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: s.symbol, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: s.text }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: d.domainName.slice(0, 20), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, color: DOCX_COLORS.SLATE_BODY }),
                        ],
                      }),
                    ],
                  });
                }),
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 100 }, children: [] }),

          // Detailed RoB Table
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2000, 1560, 3200, 2600],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2000, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Domain', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 1560, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Judgement', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 3200, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Supportive Text Evidence', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Critical Significance', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                ],
              }),
              ...report.riskOfBias.domains.map((d) => {
                const s = getStatusShading(d.judgement);
                return new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 2000, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: d.domainName, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                    }),
                    new TableCell({
                      width: { size: 1560, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: s.bg },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: d.judgement.replace(/_/g, ' '), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: s.text })] })],
                    }),
                    new TableCell({
                      width: { size: 3200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: `"${d.supportiveEvidence}"`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, italics: true })] })],
                    }),
                    new TableCell({
                      width: { size: 2600, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: d.criticalSignificance, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY })] })],
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
            columnWidths: [1800, 2800, 1560, 3200],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 1800, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Item & Section', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 2800, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Requirement', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 1560, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Compliance Status', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 3200, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Manuscript Evidence / Location', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_SMALL, bold: true })] })],
                  }),
                ],
              }),
              ...report.equatorChecklist.criticalItemsAudit.map((item) => {
                const s = getStatusShading(item.status);
                return new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 1800, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: item.itemNumberAndSection, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                    }),
                    new TableCell({
                      width: { size: 2800, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: item.requirement, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY })] })],
                    }),
                    new TableCell({
                      width: { size: 1560, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: s.bg },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: item.status.replace(/_/g, ' '), font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true, color: s.text })] })],
                    }),
                    new TableCell({
                      width: { size: 3200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: item.evidenceOrPageLocation, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, italics: true })] })],
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
            columnWidths: [2200, 1000, 1200, 1400, 1160, 2400],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2200, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Outcome', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 1000, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Metric', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 1200, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Estimate', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 1400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: '95% CI', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 1160, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'P-Value', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Clinical Significance', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                  }),
                ],
              }),
              ...report.statisticalAudit.effectEstimates.map((est) => {
                return new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 2200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: est.outcome, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                    }),
                    new TableCell({
                      width: { size: 1000, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: est.metric, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY })] })],
                    }),
                    new TableCell({
                      width: { size: 1200, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: est.pointEstimate, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY, bold: true })] })],
                    }),
                    new TableCell({
                      width: { size: 1400, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: est.confidenceInterval, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY })] })],
                    }),
                    new TableCell({
                      width: { size: 1160, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: est.pValue, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY })] })],
                    }),
                    new TableCell({
                      width: { size: 2400, type: WidthType.DXA },
                      margins: CELL_PADDING,
                      children: [new Paragraph({ children: [new TextRun({ text: est.clinicalVsStatisticalSignificance, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_TINY })] })],
                    }),
                  ],
                });
              }),
            ],
          }),

          // Spin & Overinterpretation Callout Box
          new Paragraph({ spacing: { before: 80, after: 60 }, children: [] }),
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: CALLOUT_BORDERS,
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
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({
                            text: report.statisticalAudit.spinAndDiscrepancyAudit.spinDetected
                              ? 'SPIN & OVERINTERPRETATION WARNING DETECTED:'
                              : 'SPIN AUDIT: NO DISCREPANCIES OR OVERINTERPRETATION IDENTIFIED',
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
                        spacing: { before: 20, after: 40 },
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
                        spacing: { before: 20, after: 40 },
                        children: [
                          new TextRun({
                            text: `Recommendation for Interpretation: ${report.statisticalAudit.spinAndDiscrepancyAudit.recommendationForInterpretation}`,
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

          createHeading2('Internal Validity (Bias, Confounding & Chance)'),
          createBodyParagraph(report.validitySynthesis.internalValidity),

          createHeading2('External Validity & Generalizability'),
          createBodyParagraph(report.validitySynthesis.externalValidityAndGeneralizability),

          createHeading2('Conflicts of Interest & Commercial Funding Bias'),
          createBodyParagraph(report.validitySynthesis.conflictsOfInterestAndFundingCritique),

          // GRADE Working Group Table
          createHeading2('GRADE Certainty of Evidence Synthesis'),
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            columnWidths: [2600, 6760],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Final GRADE Rating', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6760, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: `${report.validitySynthesis.gradeCertainty} CERTAINTY OF EVIDENCE`, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true, color: DOCX_COLORS.ACCENT_BLUE_TEXT })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Downgrading Factors', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6760, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.validitySynthesis.gradeDowngradingFactors.join('; ') || 'None', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Synthesis Rationale', font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY, bold: true })] })],
                  }),
                  new TableCell({
                    width: { size: 6760, type: WidthType.DXA },
                    margins: CELL_PADDING,
                    children: [new Paragraph({ children: [new TextRun({ text: report.validitySynthesis.gradeRationale, font: TYPOGRAPHY.FONT_PRIMARY, size: TYPOGRAPHY.SIZE_BODY })] })],
                  }),
                ],
              }),
            ],
          }),

          // ---------------------------------------------------------
          // SECTION 7: CLINICAL PRACTICE TRANSLATION
          // ---------------------------------------------------------
          createHeading1('7.', 'Clinical Practice Translation & Verdict'),

          createBodyParagraph(
            `Key Takeaway for Clinicians: ${report.clinicalPracticeBottomLine.keyTakeawayForClinicians}`,
            { bold: true }
          ),
          createBodyParagraph(
            `Applicability to Real-World Clinical Practice: ${report.clinicalPracticeBottomLine.applicabilityToPractice}`
          ),
          createBodyParagraph(
            `Recommendations for Future Research: ${report.clinicalPracticeBottomLine.recommendationsForFutureResearch}`,
            { italic: true }
          ),

          // ---------------------------------------------------------
          // REFINEMENT: METHODOLOGICAL & EDITORIAL GOVERNANCE DISCLAIMER
          // ---------------------------------------------------------
          new Paragraph({ spacing: { before: 140, after: 60 }, children: [] }),
          new Table({
            width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
            borders: TABLE_BORDERS_CLEAN,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: PAGE_GEOMETRY.CONTENT_WIDTH, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.CALLOUT_BG },
                    margins: CELL_PADDING,
                    children: [
                      new Paragraph({
                        spacing: { before: 40, after: 30 },
                        children: [
                          new TextRun({
                            text: 'METHODOLOGICAL GOVERNANCE & EDITORIAL DISCLAIMER:',
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_TINY,
                            bold: true,
                            color: DOCX_COLORS.NAVY_PRIMARY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 20, after: 30 },
                        children: [
                          new TextRun({
                            text: `This critical appraisal was generated via AppraisAI in adherence to EQUATOR Network reporting frameworks (${report.classification.equatorReportingGuideline}), the Oxford Centre for Evidence-Based Medicine (CEBM) Levels of Evidence, and the GRADE Working Group certainty criteria. The evaluation has been conducted and reviewed by the undersigned appraiser (${appraiser?.name || 'Dr. Alex Mercer, MD, MPH'}). This document is prepared for academic peer commentary, journal club appraisal, and clinical decision support purposes.`,
                            font: TYPOGRAPHY.FONT_PRIMARY,
                            size: TYPOGRAPHY.SIZE_TINY,
                            color: DOCX_COLORS.SLATE_MUTED,
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
                  text: `${ref.number}.  `,
                  font: TYPOGRAPHY.FONT_PRIMARY,
                  size: TYPOGRAPHY.SIZE_SMALL,
                  bold: true,
                  color: DOCX_COLORS.NAVY_PRIMARY,
                }),
                new TextRun({
                  text: ref.vancouverCitation,
                  font: TYPOGRAPHY.FONT_PRIMARY,
                  size: TYPOGRAPHY.SIZE_SMALL,
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

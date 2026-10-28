import { BorderStyle } from 'docx';

/**
 * Word Document Design System & Visual Geometry
 * Adhering to the word-document-styling specification:
 * - Font: Arial exclusively across all runs, headers, footers, tables
 * - High-contrast executive medical palette: Navy (#0F172A), Accent Teal (#0D9488), Slate Body (#334155)
 * - Exact DXA grid geometry: 9360 DXA total printable width
 */
export const DOCX_COLORS = {
  // Primary Palette
  NAVY_PRIMARY: '0F172A',      // Document titles, table header rows, slide header banners
  TEAL_ACCENT: '0D9488',       // Subheadings, key metrics, callout borders
  TEAL_LIGHT: 'F0FDFA',        // Callout fills, metadata shading
  SLATE_BODY: '334155',        // Standard paragraph body text
  SLATE_MUTED: '64748B',       // Captions, secondary notes, running headers
  BORDER_GREY: 'CBD5E1',       // Outer table borders
  BORDER_LIGHT: 'E2E8F0',      // Inner table gridlines
  CALLOUT_BG: 'F8FAFC',        // Alternating row shading & background fills
  WHITE: 'FFFFFF',

  // Statuses & Traffic-Light Judgements
  SUCCESS_BG: 'DCFCE7',
  SUCCESS_TEXT: '166534',
  WARNING_BG: 'FEF3C7',
  WARNING_TEXT: '92400E',
  DANGER_BG: 'FEE2E2',
  DANGER_TEXT: '991B1B',
  NEUTRAL_BG: 'F1F5F9',
  NEUTRAL_TEXT: '475569',
};

export const PAGE_GEOMETRY = {
  PAGE_WIDTH: 12240,  // US Letter (8.5 inches = 12,240 dxa)
  PAGE_HEIGHT: 15840, // 11 inches = 15,840 dxa
  MARGIN_TOP: 1440,   // 1 inch = 1440 dxa
  MARGIN_BOTTOM: 1440,
  MARGIN_LEFT: 1440,
  MARGIN_RIGHT: 1440,
  CONTENT_WIDTH: 9360, // 12240 - 2880 = 9360 dxa printable width
};

export const TYPOGRAPHY = {
  FONT_PRIMARY: 'Arial',
  FONT_HEADING: 'Arial',
  SIZE_TITLE: 36,       // 18pt (18 * 2 = 36 half-points)
  SIZE_H1: 32,          // 16pt (16 * 2 = 32 half-points)
  SIZE_H2: 25,          // 12.5pt
  SIZE_H3: 22,          // 11pt Bold
  SIZE_BODY: 21,        // 10.5pt
  SIZE_TABLE: 19,       // 9.5pt
  SIZE_SMALL: 18,       // 9pt
  SIZE_TINY: 16,        // 8pt
  LINE_SPACING_BODY: 276, // 1.15x
  LINE_SPACING_TABLE: 240, // 1.0x
};

export const CELL_PADDING = {
  top: 120,
  bottom: 120,
  left: 160,
  right: 160,
};

export const CELL_PADDING_COMPACT = {
  top: 80,
  bottom: 80,
  left: 120,
  right: 120,
};

export const TABLE_BORDERS_CLEAN = {
  top: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_GREY },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_GREY },
  left: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_GREY },
  right: { style: BorderStyle.SINGLE, size: 6, color: DOCX_COLORS.BORDER_GREY },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
};

export const CALLOUT_BORDERS_TEAL = {
  top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
  left: { style: BorderStyle.SINGLE, size: 24, color: DOCX_COLORS.TEAL_ACCENT }, // 24pt thick Teal accent bar
  right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
};

export const CALLOUT_BORDERS_NAVY = {
  top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
  left: { style: BorderStyle.SINGLE, size: 24, color: DOCX_COLORS.NAVY_PRIMARY }, // 24pt thick Navy accent bar
  right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
};

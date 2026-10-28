import {
  BorderStyle,
  AlignmentType,
  ShadingType,
  WidthType,
} from 'docx';

export const DOCX_COLORS = {
  NAVY_PRIMARY: '0F172A',
  SLATE_BODY: '334155',
  SLATE_MUTED: '64748B',
  BORDER_GREY: 'CBD5E1',
  BORDER_LIGHT: 'E2E8F0',
  CALLOUT_BG: 'F8FAFC',
  HEADER_LINE: '94A3B8',
  
  // Statuses & Traffic-light badge fills
  SUCCESS_BG: 'DCFCE7',
  SUCCESS_TEXT: '166534',
  WARNING_BG: 'FEF3C7',
  WARNING_TEXT: '92400E',
  DANGER_BG: 'FEE2E2',
  DANGER_TEXT: '991B1B',
  NEUTRAL_BG: 'F1F5F9',
  NEUTRAL_TEXT: '475569',
  
  // Strip highlights
  ACCENT_BLUE_BG: 'EFF6FF',
  ACCENT_BLUE_TEXT: '1E40AF',
};

export const PAGE_GEOMETRY = {
  PAGE_WIDTH: 12240, // US Letter (8.5 inches)
  PAGE_HEIGHT: 15840, // 11 inches
  MARGIN_TOP: 1440, // 1 inch
  MARGIN_BOTTOM: 1440,
  MARGIN_LEFT: 1440,
  MARGIN_RIGHT: 1440,
  CONTENT_WIDTH: 9360, // 12240 - 2880 = 9360 DXA
};

export const TYPOGRAPHY = {
  FONT_PRIMARY: 'Times New Roman',
  FONT_HEADING: 'Georgia',
  SIZE_BODY: 22, // 11pt
  SIZE_SMALL: 19, // 9.5pt
  SIZE_TINY: 17, // 8.5pt
  SIZE_H1: 28, // 14pt
  SIZE_H2: 24, // 12pt
  SIZE_TITLE: 36, // 18pt
  LINE_SPACING_BODY: 276, // 1.15x
};

export const CELL_PADDING = {
  top: 100,
  bottom: 100,
  left: 140,
  right: 140,
};

export const TABLE_BORDERS_CLEAN = {
  top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_GREY },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_GREY },
  left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_GREY },
  right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_GREY },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: DOCX_COLORS.BORDER_LIGHT },
  insideVertical: { style: BorderStyle.NONE },
};

export const CALLOUT_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_GREY },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_GREY },
  left: { style: BorderStyle.SINGLE, size: 18, color: DOCX_COLORS.NAVY_PRIMARY }, // thick navy left border
  right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_GREY },
};

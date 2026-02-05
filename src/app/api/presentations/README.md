# Presentation Generator for Mission Control

## Overview

Generate professional Word (.docx) presentations from markdown content with proper formatting for tables, bold text, and styling.

## Usage

### API Endpoint

```bash
POST /api/presentations/generate
```

**Request Body:**
```json
{
  "missionId": "esab-eddyfi-waygate-2026",
  "title": "Competitive Analysis - ESAB vs Eddyfi",
  "content": "# Executive Summary\n\n**Key Finding:** ESAB leads in...",
  "template": "executive", // or "detailed", "minimal"
  "includeDeliverables": true
}
```

**Response:**
```json
{
  "success": true,
  "filePath": "/path/to/Presentation_ESAB_Analysis_20260205.docx",
  "downloadUrl": "/api/presentations/download?file=...",
  "fileSize": 45023
}
```

### From Mission Deliverables

```bash
POST /api/presentations/from-mission
```

**Request Body:**
```json
{
  "missionId": "esab-eddyfi-waygate-2026",
  "phases": [1, 2, 3], // Which phases to include
  "format": "executive_summary" // or "full_report"
}
```

## Markdown to Word Conversion

### Supported Formatting

| Markdown | Word Output |
|----------|-------------|
| `# Heading` | Heading 1 Style |
| `## Heading` | Heading 2 Style |
| `**bold**` | Bold text |
| `*italic*` | Italic text |
| \`code\` | Code style |
| \| Table \| | Formatted table |
| - List item | Bulleted list |
| 1. Numbered | Numbered list |

### Table Formatting

Tables are converted with:
- Professional borders
- Header row styling (bold, background color)
- Proper column widths
- Padding for readability

### Templates

**Executive Summary**
- Minimal header
- Focus on key findings
- One-page format

**Detailed Report**
- Full table of contents
- All sections expanded
- Appendix for data

**Minimal**
- Clean, simple layout
- No headers/footers
- Quick export

## Implementation

The system uses `pandoc` for conversion with custom filters to ensure:
- Tables render correctly (no merged cells issues)
- Bold text appears properly (**text**)
- Headers use standard Word styles
- Page breaks between sections

## File Structure

```
presentations/
├── route.ts              # List presentations
├── generate/
│   └── route.ts          # Generate from markdown
├── from-mission/
│   └── route.ts          # Generate from mission data
├── download/
│   └── route.ts          # Download generated file
└── templates/
    ├── executive.docx    # Executive summary template
    ├── detailed.docx     # Full report template
    └── minimal.docx      # Minimal template
```

## Example

```typescript
// Generate presentation from mission
const response = await fetch('/api/presentations/from-mission', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    missionId: 'esab-eddyfi-waygate-2026',
    phases: [1, 2, 3, 4],
    format: 'executive_summary'
  })
});

const { filePath, downloadUrl } = await response.json();
```

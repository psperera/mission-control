#!/usr/bin/env node
/**
 * Research Integrity Guard - MCP Server
 *
 * Validates research outputs during TESTING phase to ensure:
 * - No AI slop (generic, filler content)
 * - Proper citations and sources
 * - Technical accuracy
 * - Consistent formatting
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

// AI Slop detection patterns
const AI_SLOP_PATTERNS = [
  /\bin conclusion\b/gi,
  /\bit's worth noting\b/gi,
  /\bit is important to note\b/gi,
  /\bas we can see\b/gi,
  /\blet's dive in\b/gi,
  /\blet's explore\b/gi,
  /\bin today's world\b/gi,
  /\bin this day and age\b/gi,
  /\bgame.?changer\b/gi,
  /\bcutting.?edge\b/gi,
  /\bstate.?of.?the.?art\b/gi,
  /\brobust\b/gi,
  /\bleverag(e|ing)\b/gi,
  /\bsynerg(y|ies|istic)\b/gi,
  /\bholistic\b/gi,
  /\bparadigm\b/gi,
  /\bseamless(ly)?\b/gi,
  /\bempowering?\b/gi,
  /\bdelve\b/gi,
  /\bunlock(ing)?\b/gi,
  /\bjourney\b/gi,
  /\btransformative\b/gi,
  /\bvibrant\b/gi,
  /\btapestry\b/gi,
  /\blandscape\b/gi,
  /\becosystem\b/gi,
  /\bfostering?\b/gi,
  /\bnuanced?\b/gi,
  /\bmultifaceted\b/gi,
  /\bunderscores?\b/gi,
  /\bhighlight(s|ing)?\b/gi,
  /\bpivotal\b/gi,
  /\bcrucial(ly)?\b/gi,
  /\bfurthermore\b/gi,
  /\bmoreover\b/gi,
  /\badditionally\b/gi,
  /\bnevertheless\b/gi,
  /\bnonetheless\b/gi,
];

// Quality check rules
const QUALITY_RULES = {
  minWordCount: 100,
  maxRepeatedPhrases: 3,
  minUniqueWords: 50,
  maxAISlopScore: 5,
  requiresCitations: true,
  minCitations: 1,
};

class ResearchIntegrityGuard {
  constructor() {
    this.server = new Server(
      { name: 'research-integrity-guard', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'validate_research_output',
          description: 'Validate research output for quality, AI slop, and integrity',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'The research content to validate' },
              taskId: { type: 'string', description: 'Task ID for tracking' },
              checkCitations: { type: 'boolean', default: true },
              strictMode: { type: 'boolean', default: false },
            },
            required: ['content'],
          },
        },
        {
          name: 'validate_file',
          description: 'Validate a file at the given path for research integrity',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path to the file to validate' },
              taskId: { type: 'string', description: 'Task ID for tracking' },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'clean_ai_slop',
          description: 'Remove AI slop from content and return cleaned version',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Content to clean' },
            },
            required: ['content'],
          },
        },
        {
          name: 'validate_task_deliverables',
          description: 'Validate all deliverables for a task via Mission Control API',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'Task ID to validate deliverables for' },
              missionControlUrl: { type: 'string', default: 'http://localhost:3001' },
            },
            required: ['taskId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'validate_research_output':
          return this.validateResearchOutput(args);
        case 'validate_file':
          return this.validateFile(args);
        case 'clean_ai_slop':
          return this.cleanAISlop(args);
        case 'validate_task_deliverables':
          return this.validateTaskDeliverables(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  detectAISlop(content) {
    const matches = [];
    let score = 0;

    for (const pattern of AI_SLOP_PATTERNS) {
      const found = content.match(pattern);
      if (found) {
        matches.push(...found);
        score += found.length;
      }
    }

    return { score, matches: [...new Set(matches)] };
  }

  countWords(content) {
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }

  countUniqueWords(content) {
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return new Set(words).size;
  }

  detectRepeatedPhrases(content, minLength = 4) {
    const words = content.toLowerCase().split(/\s+/);
    const phrases = {};

    for (let i = 0; i <= words.length - minLength; i++) {
      const phrase = words.slice(i, i + minLength).join(' ');
      phrases[phrase] = (phrases[phrase] || 0) + 1;
    }

    return Object.entries(phrases)
      .filter(([, count]) => count > 2)
      .map(([phrase, count]) => ({ phrase, count }));
  }

  detectCitations(content) {
    const patterns = [
      /\[\d+\]/g,                    // [1], [2], etc.
      /\([\w\s]+,?\s*\d{4}\)/g,     // (Author, 2024)
      /https?:\/\/[^\s]+/g,          // URLs
      /doi:\s*[\d.\/\w-]+/gi,        // DOI references
      /ISBN[\s:-]*[\d-X]+/gi,        // ISBN references
    ];

    const citations = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) citations.push(...matches);
    }

    return citations;
  }

  validateResearchOutput(args) {
    const { content, taskId, checkCitations = true, strictMode = false } = args;

    const issues = [];
    const warnings = [];
    const metrics = {};

    // Word count check
    const wordCount = this.countWords(content);
    metrics.wordCount = wordCount;
    if (wordCount < QUALITY_RULES.minWordCount) {
      issues.push(`Content too short: ${wordCount} words (minimum: ${QUALITY_RULES.minWordCount})`);
    }

    // Unique words check
    const uniqueWords = this.countUniqueWords(content);
    metrics.uniqueWords = uniqueWords;
    if (uniqueWords < QUALITY_RULES.minUniqueWords) {
      warnings.push(`Low vocabulary diversity: ${uniqueWords} unique words`);
    }

    // AI Slop detection
    const aiSlop = this.detectAISlop(content);
    metrics.aiSlopScore = aiSlop.score;
    metrics.aiSlopMatches = aiSlop.matches;

    const maxSlop = strictMode ? 2 : QUALITY_RULES.maxAISlopScore;
    if (aiSlop.score > maxSlop) {
      issues.push(`High AI slop score: ${aiSlop.score} (max: ${maxSlop})`);
      issues.push(`Detected phrases: ${aiSlop.matches.slice(0, 10).join(', ')}`);
    } else if (aiSlop.score > 0) {
      warnings.push(`Minor AI slop detected: ${aiSlop.matches.join(', ')}`);
    }

    // Repeated phrases
    const repeatedPhrases = this.detectRepeatedPhrases(content);
    metrics.repeatedPhrases = repeatedPhrases.length;
    if (repeatedPhrases.length > QUALITY_RULES.maxRepeatedPhrases) {
      warnings.push(`Excessive repetition: ${repeatedPhrases.map(p => `"${p.phrase}" (${p.count}x)`).join(', ')}`);
    }

    // Citations check
    if (checkCitations) {
      const citations = this.detectCitations(content);
      metrics.citationCount = citations.length;
      if (citations.length < QUALITY_RULES.minCitations) {
        warnings.push(`No citations found - consider adding sources`);
      }
    }

    const passed = issues.length === 0;
    const qualityScore = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5) - (aiSlop.score * 3));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          passed,
          qualityScore,
          issues,
          warnings,
          metrics,
          taskId,
          timestamp: new Date().toISOString(),
          recommendation: passed
            ? 'Content passes integrity checks. Ready for review.'
            : 'Content requires revision before proceeding to review.',
        }, null, 2),
      }],
    };
  }

  async validateFile(args) {
    const { filePath, taskId } = args;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      // For HTML files, extract text content
      let textContent = content;
      if (ext === '.html' || ext === '.htm') {
        textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      }

      const result = this.validateResearchOutput({ content: textContent, taskId });

      // Add file info
      const parsed = JSON.parse(result.content[0].text);
      parsed.file = {
        path: filePath,
        size: fs.statSync(filePath).size,
        extension: ext,
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(parsed, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            passed: false,
            error: `Failed to read file: ${error.message}`,
            filePath,
          }, null, 2),
        }],
      };
    }
  }

  cleanAISlop(args) {
    const { content } = args;
    let cleaned = content;
    const replacements = [];

    // Replace common AI slop phrases with better alternatives
    const replacementMap = {
      'it\'s worth noting': '',
      'it is important to note': '',
      'as we can see': '',
      'let\'s dive in': '',
      'let\'s explore': '',
      'in today\'s world': '',
      'in this day and age': 'currently',
      'game-changer': 'significant change',
      'cutting-edge': 'advanced',
      'state-of-the-art': 'current',
      'robust': 'strong',
      'leverage': 'use',
      'leveraging': 'using',
      'synergy': 'combination',
      'holistic': 'comprehensive',
      'paradigm': 'model',
      'seamlessly': 'smoothly',
      'empower': 'enable',
      'empowering': 'enabling',
      'delve': 'examine',
      'unlock': 'enable',
      'unlocking': 'enabling',
      'journey': 'process',
      'transformative': 'significant',
      'vibrant': 'active',
      'tapestry': 'collection',
      'landscape': 'field',
      'ecosystem': 'system',
      'foster': 'encourage',
      'fostering': 'encouraging',
      'nuanced': 'detailed',
      'multifaceted': 'complex',
      'underscore': 'emphasize',
      'underscores': 'emphasizes',
      'pivotal': 'important',
      'crucial': 'important',
      'crucially': 'importantly',
    };

    for (const [slop, replacement] of Object.entries(replacementMap)) {
      const regex = new RegExp(`\\b${slop}\\b`, 'gi');
      if (regex.test(cleaned)) {
        replacements.push({ original: slop, replacement: replacement || '(removed)' });
        cleaned = cleaned.replace(regex, replacement);
      }
    }

    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    // Clean up sentences that start with removed content
    cleaned = cleaned.replace(/\.\s+,/g, '.');
    cleaned = cleaned.replace(/,\s*,/g, ',');

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          original: content,
          cleaned,
          replacements,
          changeCount: replacements.length,
        }, null, 2),
      }],
    };
  }

  async validateTaskDeliverables(args) {
    const { taskId, missionControlUrl = 'http://localhost:3001' } = args;

    try {
      // Fetch deliverables from Mission Control
      const response = await fetch(`${missionControlUrl}/api/tasks/${taskId}/deliverables`);
      if (!response.ok) {
        throw new Error(`Failed to fetch deliverables: ${response.statusText}`);
      }

      const deliverables = await response.json();
      const results = [];

      for (const deliverable of deliverables) {
        if (deliverable.deliverable_type === 'file' && deliverable.path) {
          const validation = await this.validateFile({
            filePath: deliverable.path,
            taskId
          });
          results.push({
            deliverable: deliverable.title,
            path: deliverable.path,
            validation: JSON.parse(validation.content[0].text),
          });
        }
      }

      const allPassed = results.every(r => r.validation.passed);
      const totalScore = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + (r.validation.qualityScore || 0), 0) / results.length)
        : 0;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            taskId,
            deliverableCount: deliverables.length,
            validatedCount: results.length,
            allPassed,
            averageQualityScore: totalScore,
            results,
            timestamp: new Date().toISOString(),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            passed: false,
            error: error.message,
            taskId,
          }, null, 2),
        }],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Research Integrity Guard MCP server running');
  }
}

const guard = new ResearchIntegrityGuard();
guard.run().catch(console.error);

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

// Basic XSS/script injection detection for string inputs
const SCRIPT_PATTERNS = [
  /<\s*script\b/i,
  /javascript\s*:/i,
  /on\w+\s*=/i, // onerror=, onclick=
  /<\s*iframe\b/i,
  /<\s*img\b[^>]*onerror/i,
  /eval\s*\(/i,
  /expression\s*\(/i,
];

export function xssSanitizer(req: Request, res: Response, next: NextFunction) {
  const check = (obj: any, path = ''): string | null => {
    if (!obj || typeof obj !== 'object') {
      if (typeof obj === 'string') {
        for (const re of SCRIPT_PATTERNS) {
          if (re.test(obj)) return `${path}: blocked script pattern ${re}`;
        }
        // Also block null bytes and very long strings
        if (obj.includes('\0')) return `${path}: null byte`;
        if (obj.length > 20000) return `${path}: too long`;
      }
      return null;
    }
    for (const [k, v] of Object.entries(obj)) {
      // Block prototype pollution keys
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return `${path}.${k}: forbidden key`;
      const err = check(v, path ? `${path}.${k}` : k);
      if (err) return err;
    }
    return null;
  };

  const errBody = check(req.body);
  if (errBody) return res.status(400).json({ error: `Invalid input — ${errBody}` });
  const errQuery = check(req.query);
  if (errQuery) return res.status(400).json({ error: `Invalid query — ${errQuery}` });
  const errParams = check(req.params);
  if (errParams) return res.status(400).json({ error: `Invalid param — ${errParams}` });
  next();
}

// Validate image file is not a disguised script
export async function validateImageFile(filePath: string): Promise<string | null> {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46; // RIFF
    // For webp, check bytes 8-11 is WEBP
    let isWebpFull = false;
    if (isWebp) {
      const b2 = Buffer.alloc(12);
      const fd2 = fs.openSync(filePath, 'r');
      fs.readSync(fd2, b2, 0, 12, 0);
      fs.closeSync(fd2);
      isWebpFull = b2.toString('ascii', 8, 12) === 'WEBP';
    }

    if (!isJpeg && !isPng && !isWebpFull) {
      return 'File header does not match JPG/PNG/WEBP — possible script disguised as image';
    }

    // Scan first 2MB for script signatures (html/js/php)
    const stat = fs.statSync(filePath);
    const scanSize = Math.min(stat.size, 2 * 1024 * 1024);
    const scanBuf = Buffer.alloc(scanSize);
    const fd3 = fs.openSync(filePath, 'r');
    fs.readSync(fd3, scanBuf, 0, scanSize, 0);
    fs.closeSync(fd3);
    const text = scanBuf.toString('utf8').toLowerCase();
    const bad = ['<script', '<?php', '<% ', 'javascript:', 'onerror=', 'onload=', '<iframe', 'eval('];
    for (const s of bad) {
      if (text.includes(s)) return `File contains forbidden pattern "${s}" — possible script injection`;
    }

    return null;
  } catch (e: any) {
    return e.message || 'Failed to validate image';
  }
}

// Demo routes for testing automation - Integrated with observability
const express = require('express');
const path = require('path');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getLogger } = require('../utils/logger');

const logger = getLogger('demo');

// ✅ SECURITY: Rate limit expensive file operations
const fileOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many file operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve demo portal page
router.get('/demo', (req, res) => {
  logger.info('[Demo] Portal accessed', {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    referrer: req.get('referer')
  });
  res.sendFile(path.join(__dirname, '../public/demo/index.html'));
});

// Generate PDF invoice with observability
router.get('/demo/invoice-:id.pdf', fileOperationLimiter, (req, res) => {
  const { id } = req.params;
  
  logger.info('[Demo] PDF requested', { invoiceId: id, ip: req.ip });
  
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 200
>>
stream
BT
/F1 24 Tf
50 700 Td
(DEMO INVOICE #2024-${id}) Tj
0 -40 Td
/F1 14 Tf
(Date: December ${id}, 2024) Tj
0 -30 Td
(Amount: $${id}50.00) Tj
0 -30 Td
(Status: PAID) Tj
0 -50 Td
(This is a demo invoice from EasyFlow) Tj
0 -20 Td
(Generated automatically for testing) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
0000000524 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
601
%%EOF`;

  logger.info('[Demo] PDF generated', { invoiceId: id, size: pdfContent.length });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
  res.send(Buffer.from(pdfContent));
});

module.exports = router;

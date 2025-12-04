/**
 * Founder-Only Middleware
 * Restricts access to founder routes to ONLY the founder email
 */

function founderOnly(req, res, next) {
  const userEmail = req.user?.email;
  const founderEmail = process.env.FOUNDER_EMAIL;

  if (!founderEmail) {
    return res.status(500).json({ 
      error: 'Founder email not configured in environment' 
    });
  }

  if (userEmail !== founderEmail) {
    return res.status(403).json({ 
      error: 'Access denied - This feature is only accessible to the founder' 
    });
  }

  next();
}

module.exports = { founderOnly };

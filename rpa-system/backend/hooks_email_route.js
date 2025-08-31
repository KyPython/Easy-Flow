const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

// load env
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  SEND_EMAIL_WEBHOOK_SECRET
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn('⚠️  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env vars')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

// POST /hooks/email
router.post('/email', async (req, res) => {
  // optional secret check
  if (SEND_EMAIL_WEBHOOK_SECRET) {
    const secretHeader = req.get('X-Webhook-Secret')
    if (secretHeader !== SEND_EMAIL_WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden: invalid webhook secret' })
    }
  }

  const { to_email, template, data } = req.body || {}

  if (!to_email || !template) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: to_email and template' })
  }

  try {
    const payload = { to_email, template, data: data || {} }
    const { error } = await supabase.from('email_queue').insert([payload])
    if (error) {
      console.error('Supabase insert error:', error)
      return res.status(500).json({ error: 'Database insert failed' })
    }
    return res.json({ ok: true })
  } catch (err) {
    console.error('Unexpected error in /hooks/email:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
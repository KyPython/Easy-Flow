const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const campaignRouter = express.Router();

// --- Supabase Campaign Route ---
campaignRouter.post('/api/trigger-campaign', async (req, res) => {
  try {
    const { campaign, to_email } = req.body;

    // Get the user from the JWT in the Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Authentication token missing.' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ ok: false, error: 'Authentication failed.' });
    }

    if (!campaign || !to_email) {
      return res.status(400).json({ ok: false, error: 'Missing campaign or to_email' });
    }

    // Determine which emails to send
    let emailsToSend = [];
    if (campaign === 'welcome') {
      emailsToSend = [
        { template: 'welcome', to_email },
        { template: 'welcome_followup', to_email }
      ];
    }
    // Add more campaign logic as needed

    let enqueued = 0;
    let failed = 0;
    let errors = [];

    for (const email of emailsToSend) {
      try {
        // Ensure both to_email and template are provided
        if (!email.to_email || !email.template) {
          failed++;
          errors.push('Missing to_email or template in email object.');
          continue;
        }

        const insertObj = {
          to_email: email.to_email,
          template: email.template,
          profile_id: user.id, // Use the user's ID from the JWT
        };

        const { error } = await supabase
          .from('email_queue')
          .insert([insertObj]);
        if (error) {
          failed++;
          errors.push(error.message);
          console.error('Failed to enqueue email:', error);
        } else {
          enqueued++;
        }
      } catch (err) {
        failed++;
        errors.push(err.message);
        console.error('Unexpected error enqueuing email:', err);
      }
    }

    if (enqueued === 0) {
      return res.json({
        ok: false,
        enqueued,
        note: `Failed to enqueue emails. Errors: ${errors.join('; ')}`
      });
    }

    return res.json({ ok: true, enqueued });
  } catch (err) {
    console.error('Error in /api/trigger-campaign:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports.campaignRouter = campaignRouter;

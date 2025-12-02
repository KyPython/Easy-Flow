# Founder Daily Routine - Rockefeller Operating System

## Your Daily Command Structure

This is your operating system. Follow it every day, without exception.

---

## Morning Ritual (7:00 AM - 7:10 AM)

### 1. Open Founder Dashboard
```
http://localhost:3030/founder/dashboard
```

### 2. Check Your 5 Core Numbers

Look at these FIRST thing:

```
┌─────────────────────────────────┐
│ NEW SIGNUPS TODAY:    [___]     │
│ 7-Day Average:        [___]     │
│ 30-Day Average:       [___]     │
│                                 │
│ ACTIVATION RATE:      [___]%    │
│ Target: 40%+                    │
│                                 │
│ ACTIVE USERS (30d):   [___]     │
│                                 │
│ MRR:                  $[___]    │
│ Paying Customers:     [___]     │
│                                 │
│ WORKFLOWS TODAY:      [___]     │
└─────────────────────────────────┘
```

### 3. Check Health Status

```
Growth:      [●] healthy/warning/critical
Activation:  [●] healthy/warning/critical
Engagement:  [●] healthy/warning/critical
```

**If ANY are red:** Drop everything and address it TODAY.

---

## Throughout the Day

### 4. Your #1 Priority Task

Write it down. Do it FIRST.

```
TODAY'S #1: _________________________________
```

Everything else is secondary.

### 5. Daily Checklist (Complete by End of Day)

Open the "Checklist" tab in dashboard.

```
□ Morning metrics review (5 min)
□ One efficiency improvement identified
□ Competitive intelligence checked
□ Customer feedback reviewed
□ Values applied to one decision
□ Strategy articulated once
□ Evening log completed
□ Tomorrow's #1 priority set
```

**Goal:** 100% completion rate. No excuses.

---

## Competitive Intelligence (15 minutes)

### Monday: Competitor Subreddits
- r/zapier - pain points
- r/nocode - automation complaints
- r/SaaS - workflow discussions

**Action:** Log 1-2 observations in dashboard

### Tuesday: Social Media Scan
- Zapier Twitter
- Make.com LinkedIn
- n8n Discord
- IFTTT reviews

**Action:** Note any pricing/feature changes

### Wednesday: User Feedback Analysis
Compare YOUR feedback to THEIR reviews.

**Question:** What are users complaining about that we solve better?

### Thursday: Update Positioning Doc
What's your unique angle vs each competitor?

### Friday: "One Thing Better"
Identify ONE thing you do better than ALL of them.

**Log it.** Use it in marketing.

---

## Efficiency Improvements (Daily)

Every day, ask:

```
1. What's the biggest bottleneck right now?
2. What takes the most time for minimal impact?
3. What can I automate or eliminate?
4. What's one 5% improvement I can make?
```

**Track it:**
```
POST /api/efficiency/improvement
```

**Rockefeller saved $2/barrel on barrels.**
**You save 5% on conversion rates.**

---

## Evening Ritual (6:00 PM - 6:10 PM)

### 6. Complete Checklist

Open dashboard → Checklist tab

```
Did I move closer to the quarterly goal?
□ Yes  □ No

What did I learn today?
_______________________________________
_______________________________________
_______________________________________

Tomorrow's #1 Priority:
_______________________________________
```

**Save it.** Review it tomorrow morning.

---

## Weekly Review (Monday 9:00 AM - 9:30 AM)

### GET /api/founder/weekly-summary

```
Week Ending: [DATE]
Days Tracked: [___/7]
Checklist Completion: [___]%

Key Metrics:
- New Signups: [___]
- Workflow Executions: [___]

Daily Learnings:
1. [___]
2. [___]
3. [___]

Streak: [strong/moderate/needs improvement]
```

**Questions to Answer:**

1. What worked this week?
2. What didn't work?
3. What's my ONE priority for next week?
4. Am I on track for the quarterly goal?

---

## Monthly Deep Dive (First Monday, 2 hours)

### 1. Metrics Review
- Signups trend
- Activation rate trend
- MRR growth
- Customer acquisition cost
- Lifetime value estimates

### 2. Competitive Analysis
```
GET /api/competitive-intel/weekly-report
```
Review all observations. Identify patterns.

### 3. Efficiency Report
```
GET /api/efficiency/monthly-report
```
- Improvements identified: [___]
- Improvements implemented: [___]
- Improvements validated: [___]
- Implementation rate: [___]%

### 4. Quarterly Progress Check
```
Q4 2025 Goal: Get First 5 Paying Customers

Current: [___] / 5
Progress: [___]%
On Track: [Yes/No]
```

**If behind:** What needs to change THIS MONTH?

---

## Quarterly Strategic Review (4 hours)

### Schedule These Now:
- Q4 2025 Review: December 15-16, 2025
- Q1 2026 Review: March 15, 2026
- Q2 2026 Review: June 15, 2026
- Q3 2026 Review: September 15, 2026

### Review Template

```
QUARTER: Q[_] [YEAR]

1. Did we achieve our #1 priority?
   Target: [____]
   Actual: [____]
   Success: □ Yes  □ No
   Why/Why not: _________________________

2. Key Metrics
   | Metric      | Start | End | Change |
   |-------------|-------|-----|--------|
   | MRR         |       |     |        |
   | Users       |       |     |        |
   | Signups/day |       |     |        |
   | Activation  |       |     |        |

3. Rockefeller Principles Score (1-10)
   - Efficiency: [__]
   - Vertical Integration: [__]
   - Data Leverage: [__]
   - Negotiation: [__]
   - Culture: [__]
   - Innovation: [__]
   - Diversification: [__]

4. Rockefeller Habits Score (1-10)
   - #1 Priority: [__]
   - Communication Rhythm: [__]
   - Accountability: [__]
   - Input Collection: [__]
   - Feedback = Financial: [__]
   - Values Alive: [__]
   - Strategy Articulation: [__]
   - Strategic Reviews: [__]
   - Consistent Communication: [__]
   - Visible Metrics: [__]

5. Next Quarter's #1 Priority
   [_______________________________]

6. Top 3 Learnings
   1. [___]
   2. [___]
   3. [___]

7. Double Down On
   [_______________________________]

8. Stop Doing
   [_______________________________]
```

---

## Quick Reference: API Endpoints

### Dashboard
```bash
GET /api/founder/dashboard
GET /api/founder/weekly-summary
```

### Checklist
```bash
GET /api/founder/daily-checklist
POST /api/founder/daily-checklist
```

### Competitive Intelligence
```bash
GET /api/competitive-intel/competitors
POST /api/competitive-intel/observation
GET /api/competitive-intel/weekly-report
```

### Efficiency
```bash
POST /api/efficiency/improvement
GET /api/efficiency/improvements
GET /api/efficiency/monthly-report
GET /api/efficiency/suggestions
```

### Quarterly Goals
```bash
GET /api/founder/quarterly-priorities
POST /api/founder/quarterly-priorities
```

---

## Rules of the System

### Non-Negotiables

1. **Check metrics EVERY morning**
   - No exceptions
   - Takes 5 minutes
   - Sets your day

2. **Complete checklist EVERY day**
   - Track completion rate
   - Aim for 100%
   - Build the habit

3. **Log competitive intel DAILY**
   - 15 minutes
   - Follow the schedule
   - Track everything

4. **Identify ONE efficiency improvement per week**
   - Minimum
   - Track it
   - Implement it
   - Measure it

5. **Weekly review EVERY Monday**
   - 30 minutes
   - No skipping
   - Plan the week

6. **Monthly deep dive FIRST Monday**
   - 2 hours
   - Block the calendar
   - Review everything

7. **Quarterly review EVERY 90 days**
   - 4 hours
   - Off-site if possible
   - Full strategic analysis

### Success Metrics

Track these weekly:

```
Checklist Completion Rate:    [___]%  (Target: 90%+)
Competitive Intel Logs:       [___]   (Target: 5+/week)
Efficiency Improvements:      [___]   (Target: 1+/week)
Weekly Reviews Completed:     [___]   (Target: 100%)
```

---

## Troubleshooting

### "I don't have time for this"

**Rockefeller's answer:** You don't have time NOT to do this.

- Morning ritual: 5 minutes
- Checklist: 10 minutes throughout day
- Competitive intel: 15 minutes
- Evening ritual: 5 minutes

**Total:** 35 minutes/day to run your company systematically.

### "I forgot to do it yesterday"

**Start today.** Don't break the chain two days in a row.

### "The numbers are red"

**Good.** Now you know. Address it TODAY.

That's the point of the system.

### "I feel like I'm not making progress"

**Look at your weekly summaries.**

Progress is invisible day-to-day but obvious week-to-week.

Trust the system. Execute daily.

---

## The Only Thing That Matters

**Consistency.**

Rockefeller did this every single day for 50 years.

Not when he felt like it.
Not when it was convenient.
Not when the numbers looked good.

**Every. Single. Day.**

You do the same.

---

## Daily Affirmation

> "I would rather be my own tyrant than have some one else tyrannize me."
> - John D. Rockefeller

You control your operating system.
You control your metrics.
You control your destiny.

**Now go execute.**

---

## Quick Checklist (Print This)

```
DAILY:
□ Morning metrics (5 min)
□ #1 priority identified
□ Competitive intel logged
□ Efficiency improvement noted
□ Evening checklist completed

WEEKLY:
□ Monday morning review (30 min)
□ Friday competitive summary

MONTHLY:
□ First Monday deep dive (2 hours)
□ Metrics analysis
□ Efficiency report review
□ Quarterly progress check

QUARTERLY:
□ Strategic review scheduled
□ Full Rockefeller scorecard
□ Next priority set
```

---

**Start tomorrow morning at 7:00 AM.**

**No excuses. Just execute.**

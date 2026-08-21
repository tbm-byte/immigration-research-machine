import { ProcessedInsight } from './types'

const EMOJI: Record<string, string> = {
  'Immigration News': '📋',
  'Legal Marketing': '⚖️',
  'General Marketing': '📣',
  'Paid Media': '🎯',
  'Industry Research': '📊',
}

// Handles string, array, or any other type Claude might return for a field
function toStr(val: unknown): string {
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val.join('\n')
  return String(val ?? '')
}

function groupBy(
  items: ProcessedInsight[],
  key: keyof ProcessedInsight
): Record<string, ProcessedInsight[]> {
  return items.reduce((acc, item) => {
    const group = String(item[key])
    acc[group] = acc[group] ?? []
    acc[group].push(item)
    return acc
  }, {} as Record<string, ProcessedInsight[]>)
}

export async function sendSlackBrief(insights: ProcessedInsight[]): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) {
    console.warn('  SLACK_WEBHOOK_URL not set — skipping')
    return false
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const byCategory = groupBy(insights, 'source_category')
  const blocks: object[] = []

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `🧠 Intelligence Brief — ${today}`, emoji: true },
  })

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `*${insights.length} new insights* across *${Object.keys(byCategory).length} categories* · claude-haiku`,
    }],
  })

  for (const [category, items] of Object.entries(byCategory)) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${EMOJI[category] ?? '📌'} *${category.toUpperCase()}*` },
    })

    for (const insight of items) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*<${insight.source_url}|${insight.headline}>*  ·  _${insight.source_origin}_`,
            ``,
            `📰 *Summary:* ${toStr(insight.summary).substring(0, 300)}`,
            ``,
            `📊 *Impact:* ${toStr(insight.impact_analysis).substring(0, 300)}`,
            ``,
            `🎯 *Action Strategy:*\n${toStr(insight.action_strategy).substring(0, 700)}`,
          ].join('\n'),
        },
      })
    }
  }

  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `_${new Date().toISOString()}_` }],
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
    if (!res.ok) { console.error(`  Slack error: HTTP ${res.status}`); return false }
    console.log('  ✅ Slack message sent')
    return true
  } catch (err) {
    console.error('  Slack error:', err)
    return false
  }
}

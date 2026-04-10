const cron = require('node-cron')
const { runDailyDonorRecallJob } = require('./donorRecallService')

const { parseBoolean } = require('./semaphoreSmsService')

const DEFAULT_CRON_EXPRESSION = '0 8 * * *'

function startDonorRecallScheduler() {
  const cronExpression = process.env.DONOR_RECALL_CRON || DEFAULT_CRON_EXPRESSION
  const timezone = process.env.DONOR_RECALL_TIMEZONE || 'Asia/Manila'
  const runOnStartup = parseBoolean(process.env.DONOR_RECALL_RUN_ON_STARTUP)

  if (!cron.validate(cronExpression)) {
    console.warn(`[Donor Recall] Invalid cron expression "${cronExpression}". Scheduler disabled.`)
    return null
  }

  const task = cron.schedule(
    cronExpression,
    async () => {
      try {
        await runDailyDonorRecallJob()
      } catch (error) {
        console.error('[Donor Recall] Scheduled job failed:', error.message)
      }
    },
    { timezone },
  )

  if (runOnStartup) {
    runDailyDonorRecallJob().catch((error) => {
      console.error('[Donor Recall] Startup job failed:', error.message)
    })
  }

  console.log(`[Donor Recall] Scheduler started (${cronExpression}, timezone: ${timezone}).`)
  return task
}

module.exports = {
  startDonorRecallScheduler,
  runDailyDonorRecallJob,
}

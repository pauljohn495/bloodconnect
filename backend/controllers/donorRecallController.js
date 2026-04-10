const { sendManualRecallSms } = require('../services/donorRecallService')

const postManualDonorRecallSmsController = async (req, res) => {
  const donorId = parseInt(req.params.id, 10)
  if (Number.isNaN(donorId) || donorId <= 0) {
    return res.status(400).json({ message: 'Invalid donor id' })
  }

  const customMessage = req.body?.message
  const result = await sendManualRecallSms({ donorId, customMessage })

  if (!result.ok) {
    return res.status(result.statusCode || 500).json({ message: result.message || 'Failed to send recall SMS' })
  }

  return res.json({ message: result.message, messageId: result.messageId })
}

module.exports = {
  postManualDonorRecallSmsController,
}

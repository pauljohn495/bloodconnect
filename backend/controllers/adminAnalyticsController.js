const { pool } = require('../db')

const getWastagePredictionsController = async (req, res) => {
  try {
    const [historicalWastage] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        COUNT(*) as wasted_count,
        SUM(available_units) as wasted_units
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY blood_type, component_type
    `,
    )

    const [atRiskInventory] = await pool.query(
      `
      SELECT 
        id,
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        available_units,
        expiration_date,
        status,
        hospital_id,
        DATEDIFF(expiration_date, CURDATE()) as days_until_expiry
      FROM blood_inventory
      WHERE status = 'available'
        AND expiration_date > CURDATE()
        AND available_units > 0
      ORDER BY expiration_date ASC
    `,
    )

    const [demandData] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(units_requested) as total_demand,
        COUNT(*) as request_count
      FROM blood_requests
      WHERE request_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND status IN ('pending', 'approved', 'fulfilled')
      GROUP BY blood_type, component_type
    `,
    )

    const [inventorySummary] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(available_units) as total_available,
        SUM(CASE WHEN DATEDIFF(expiration_date, CURDATE()) <= 7 AND DATEDIFF(expiration_date, CURDATE()) > 0 THEN available_units ELSE 0 END) as near_expiry_units,
        SUM(CASE WHEN DATEDIFF(expiration_date, CURDATE()) <= 7 THEN available_units ELSE 0 END) as expiring_7days
      FROM blood_inventory
      WHERE status = 'available'
        AND expiration_date > CURDATE()
        AND available_units > 0
      GROUP BY blood_type, component_type
    `,
    )

    const wastageRates = {}
    historicalWastage.forEach((item) => {
      const key = `${item.blood_type}_${item.component_type || 'whole_blood'}`
      wastageRates[key] = { wastedUnits: item.wasted_units || 0, wastedCount: item.wasted_count || 0 }
    })

    const demandFactors = {}
    const totalDemand = demandData.reduce((sum, item) => sum + (item.total_demand || 0), 0)
    demandData.forEach((item) => {
      const key = `${item.blood_type}_${item.component_type || 'whole_blood'}`
      demandFactors[key] = totalDemand > 0 ? (item.total_demand || 0) / totalDemand : 0
    })

    const inventoryWithRisk = atRiskInventory.map((item) => {
      const daysUntilExpiry = item.days_until_expiry || 0
      const bloodType = item.blood_type
      const componentType = item.component_type || 'whole_blood'
      const key = `${bloodType}_${componentType}`

      let expiryFactor = 0
      if (daysUntilExpiry <= 3) expiryFactor = 40
      else if (daysUntilExpiry <= 7) expiryFactor = 30
      else if (daysUntilExpiry <= 14) expiryFactor = 20
      else if (daysUntilExpiry <= 30) expiryFactor = 10
      else expiryFactor = 5

      const wastageRate = wastageRates[key]?.wastedUnits || 0
      const wastageFactor = Math.min(30, (wastageRate / 10) * 5)

      const demandFactor = demandFactors[key] || 0
      const demandRiskFactor = demandFactor < 0.1 ? 20 : demandFactor < 0.2 ? 10 : 5

      const inventorySummaryItem = inventorySummary.find(
        (inv) => inv.blood_type === bloodType && (inv.component_type || 'whole_blood') === componentType,
      )
      const totalAvailable = inventorySummaryItem?.total_available || 0
      const inventoryFactor = totalAvailable > 50 ? 10 : totalAvailable > 20 ? 5 : 0
      const riskScore = Math.min(
        100,
        Math.round(expiryFactor + wastageFactor + demandRiskFactor + inventoryFactor),
      )

      return {
        ...item,
        riskScore,
        expiryFactor,
        wastageFactor: Math.round(wastageFactor),
        demandRiskFactor,
        inventoryFactor,
      }
    })

    const predictWastage = (days) => {
      const expiringSoon = inventoryWithRisk.filter(
        (item) => item.days_until_expiry <= days && item.days_until_expiry > 0,
      )
      const avgWastageRate = 0.15
      return expiringSoon.reduce((sum, item) => {
        const wastageProbability = item.riskScore / 100
        return sum + Math.round(item.available_units * wastageProbability * avgWastageRate)
      }, 0)
    }

    const predictedWastage = {
      next7Days: predictWastage(7),
      next14Days: predictWastage(14),
      next30Days: predictWastage(30),
    }

    const wastageByBloodType = {}
    inventoryWithRisk.forEach((item) => {
      const componentType = item.component_type || 'whole_blood'
      const key = `${item.blood_type}_${componentType}`
      if (!wastageByBloodType[key]) {
        wastageByBloodType[key] = {
          bloodType: item.blood_type,
          componentType,
          totalAtRisk: 0,
          highRiskUnits: 0,
          averageRiskScore: 0,
          items: [],
        }
      }
      wastageByBloodType[key].totalAtRisk += item.available_units
      wastageByBloodType[key].items.push(item)
      if (item.riskScore >= 70) wastageByBloodType[key].highRiskUnits += item.available_units
    })

    Object.keys(wastageByBloodType).forEach((key) => {
      const group = wastageByBloodType[key]
      const avgRisk =
        group.items.length > 0
          ? group.items.reduce((sum, item) => sum + item.riskScore, 0) / group.items.length
          : 0
      group.averageRiskScore = Math.round(avgRisk)
    })

    res.json({
      inventoryWithRisk: inventoryWithRisk.sort((a, b) => b.riskScore - a.riskScore),
      predictedWastage,
      wastageByBloodType: Object.values(wastageByBloodType),
      summary: {
        totalAtRisk: inventoryWithRisk.reduce((sum, item) => sum + item.available_units, 0),
        highRiskItems: inventoryWithRisk.filter((item) => item.riskScore >= 70).length,
        averageRiskScore:
          inventoryWithRisk.length > 0
            ? Math.round(
              inventoryWithRisk.reduce((sum, item) => sum + item.riskScore, 0) /
                inventoryWithRisk.length,
            )
            : 0,
      },
    })
  } catch (error) {
    console.error('Wastage predictions error:', error)
    res.status(500).json({ message: 'Failed to fetch wastage predictions' })
  }
}

const getWastagePrescriptionsController = async (req, res) => {
  try {
    const [highRiskInventory] = await pool.query(
      `
      SELECT 
        bi.id,
        bi.blood_type,
        COALESCE(bi.component_type, 'whole_blood') as component_type,
        bi.available_units,
        bi.expiration_date,
        bi.status,
        bi.hospital_id,
        DATEDIFF(bi.expiration_date, CURDATE()) as days_until_expiry
      FROM blood_inventory bi
      WHERE bi.status = 'available'
        AND bi.expiration_date > CURDATE()
        AND bi.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
        AND bi.available_units > 0
        AND (bi.hospital_id IS NULL OR bi.hospital_id = 0)
      ORDER BY bi.expiration_date ASC, bi.available_units DESC
    `,
    )

    const [pendingRequestsRaw] = await pool.query(
      `
      SELECT 
        br.id,
        br.hospital_id,
        br.blood_type,
        COALESCE(br.component_type, 'whole_blood') as component_type,
        br.units_requested,
        br.request_date,
        br.status,
        br.priority,
        br.notes,
        h.hospital_name
      FROM blood_requests br
      JOIN hospitals h ON br.hospital_id = h.id
      WHERE br.status = 'pending'
      ORDER BY br.request_date ASC
    `,
    )

    const pendingRequests = pendingRequestsRaw.map((row) => {
      let priority = (row.priority || 'normal').toLowerCase()
      let cleanNotes = row.notes
      if ((!row.priority || row.priority === null) && typeof row.notes === 'string' && row.notes.startsWith('[PRIORITY:')) {
        const match = row.notes.match(/^\[PRIORITY:([a-zA-Z]+)\]\s*(.*)$/)
        if (match) {
          priority = match[1].toLowerCase()
          cleanNotes = match[2] || null
        }
      }
      return { ...row, priority, notes: cleanNotes }
    })

    await pool.query(
      `
      SELECT hospital_id, blood_type, SUM(available_units) as total_available
      FROM blood_inventory
      WHERE hospital_id IS NOT NULL
        AND status = 'available'
        AND expiration_date > CURDATE()
      GROUP BY hospital_id, blood_type
    `,
    )

    const [centralInventory] = await pool.query(
      `
      SELECT
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(available_units) as total_available
      FROM blood_inventory
      WHERE status = 'available'
        AND expiration_date > CURDATE()
        AND available_units > 0
        AND (hospital_id IS NULL OR hospital_id = 0)
      GROUP BY blood_type, component_type
    `,
    )

    const centralInventoryMap = {}
    centralInventory.forEach((row) => {
      const key = `${row.blood_type}_${row.component_type}`
      centralInventoryMap[key] = row.total_available || 0
    })

    const transferRecommendations = []
    const processedRequests = new Set()

    highRiskInventory.forEach((inventory) => {
      const matchingRequests = pendingRequests.filter(
        (req) =>
          req.blood_type === inventory.blood_type &&
          (req.component_type || 'whole_blood') === (inventory.component_type || 'whole_blood') &&
          req.units_requested > 0 &&
          !processedRequests.has(req.id),
      )

      if (matchingRequests.length > 0) {
        matchingRequests.sort((a, b) => new Date(a.request_date) - new Date(b.request_date))
        matchingRequests.forEach((request) => {
          const unitsToTransfer = Math.min(inventory.available_units, request.units_requested)
          if (unitsToTransfer > 0) {
            transferRecommendations.push({
              type: 'transfer',
              priority:
                inventory.days_until_expiry <= 3
                  ? 'high'
                  : inventory.days_until_expiry <= 7
                    ? 'medium'
                    : 'low',
              requestPriority: request.priority,
              inventoryId: inventory.id,
              bloodType: inventory.blood_type,
              componentType: inventory.component_type || 'whole_blood',
              units: unitsToTransfer,
              daysUntilExpiry: inventory.days_until_expiry,
              targetHospitalId: request.hospital_id,
              targetHospitalName: request.hospital_name,
              requestId: request.id,
              impact: `Prevent ${unitsToTransfer} units from expiring`,
              reason: `Match expiring inventory with pending request from ${request.hospital_name}`,
            })
            processedRequests.add(request.id)
            inventory.available_units -= unitsToTransfer
          }
        })
      }
    })

    const priorityActions = []
    const expiring3Days = highRiskInventory.filter(
      (item) => item.days_until_expiry <= 3 && item.available_units > 0,
    )
    if (expiring3Days.length > 0) {
      const totalUnits = expiring3Days.reduce((sum, item) => sum + item.available_units, 0)
      const minDays = Math.min(...expiring3Days.map((item) => item.days_until_expiry))
      const daysLabel = minDays === 1 ? '1 day' : `${minDays} days`
      priorityActions.push({
        type: 'urgent_alert',
        priority: 'critical',
        title: `Critical: Blood Expiring in ${daysLabel}`,
        description: `${totalUnits} units expiring in ${daysLabel}. Immediate action required.`,
        bloodTypes: [...new Set(expiring3Days.map((item) => item.blood_type))],
        affectedUnits: totalUnits,
        action: 'Review and transfer to hospitals with high demand immediately',
      })
    }

    const [lowDemandBloodTypes] = await pool.query(
      `
      SELECT 
        bi.blood_type,
        COALESCE(bi.component_type, 'whole_blood') as component_type,
        SUM(bi.available_units) as total_inventory,
        COALESCE(SUM(br.units_requested), 0) as total_demand
      FROM blood_inventory bi
      LEFT JOIN blood_requests br ON bi.blood_type = br.blood_type 
        AND COALESCE(bi.component_type, 'whole_blood') = COALESCE(br.component_type, 'whole_blood')
        AND br.status = 'pending'
        AND br.request_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      WHERE bi.status = 'available'
        AND bi.expiration_date > CURDATE()
        AND bi.available_units > 0
        AND (bi.hospital_id IS NULL OR bi.hospital_id = 0)
      GROUP BY bi.blood_type, bi.component_type
      HAVING total_inventory > 30 AND total_demand < 5
    `,
    )

    lowDemandBloodTypes.forEach((item) => {
      const componentLabel =
        item.component_type === 'whole_blood'
          ? 'Whole Blood'
          : item.component_type === 'platelets'
            ? 'Platelets'
            : 'Plasma'
      priorityActions.push({
        type: 'inventory_adjustment',
        priority: 'medium',
        title: `Reduce Donations: ${item.blood_type} ${componentLabel}`,
        description: `High inventory (${item.total_inventory} units) with low demand (${item.total_demand} units requested). Consider reducing donation targets.`,
        bloodType: item.blood_type,
        componentType: item.component_type,
        action: `Adjust donation collection targets for ${item.blood_type} ${componentLabel}`,
      })
    })

    const unmatchedNearExpiry = highRiskInventory.filter(
      (item) =>
        item.days_until_expiry > 3 &&
        item.days_until_expiry <= 7 &&
        !transferRecommendations.some((rec) => rec.inventoryId === item.id) &&
        item.available_units > 0,
    )

    if (unmatchedNearExpiry.length > 0) {
      const totalUnmatched = unmatchedNearExpiry.reduce((sum, item) => sum + item.available_units, 0)
      const minUnmatchedDays = Math.min(...unmatchedNearExpiry.map((item) => item.days_until_expiry))
      const unmatchedDaysLabel = minUnmatchedDays === 1 ? '1 day' : `${minUnmatchedDays} days`
      priorityActions.push({
        type: 'alert',
        priority: 'high',
        title: 'Near-Expiry Items Need Attention',
        description: `${totalUnmatched} units expiring in ${unmatchedDaysLabel} without matching requests.`,
        bloodTypes: [...new Set(unmatchedNearExpiry.map((item) => item.blood_type))],
        affectedUnits: totalUnmatched,
        action: 'Contact hospitals to check if they need these blood types',
      })
    }

    transferRecommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    const priorityRequests = pendingRequests
      .filter(
        (req) => req.status === 'pending' && (req.priority === 'urgent' || req.priority === 'critical'),
      )
      .sort((a, b) => {
        const order = { critical: 0, urgent: 1, normal: 2 }
        const pa = order[a.priority] ?? 2
        const pb = order[b.priority] ?? 2
        if (pa !== pb) return pa - pb
        return new Date(a.request_date) - new Date(b.request_date)
      })

    const unavailableRequests = pendingRequests
      .filter((req) => {
        const key = `${req.blood_type}_${req.component_type || 'whole_blood'}`
        const totalAvailable = centralInventoryMap[key] || 0
        return totalAvailable <= 0
      })
      .map((req) => {
        const priority = req.priority || 'normal'
        const isPlatelets = (req.component_type || 'whole_blood') === 'platelets'
        const isPlasma = (req.component_type || 'whole_blood') === 'plasma'
        let recommendedAction
        if (priority === 'critical') {
          recommendedAction =
            isPlatelets || isPlasma
              ? 'Critical: Requested blood component is unavailable. Prioritize emergency donor contact and urgent replenishment for platelets/plasma.'
              : 'Critical: Requested blood component is unavailable. Prioritize emergency donor contact and urgent replenishment.'
        } else if (priority === 'urgent') {
          recommendedAction =
            isPlatelets || isPlasma
              ? 'Urgent: Requested blood component is out of stock. Check partner hospitals and contact eligible donors for platelets/plasma immediately.'
              : 'Urgent: Requested blood component is out of stock. Check partner hospitals or contact eligible matching donors immediately.'
        } else {
          recommendedAction =
            isPlatelets || isPlasma
              ? 'Normal: Requested blood component is unavailable. Recommend donor sourcing or restocking process for platelets/plasma.'
              : 'Normal: Requested blood component is unavailable. Recommend donor sourcing or restocking process.'
        }
        return {
          id: req.id,
          hospital_id: req.hospital_id,
          hospital_name: req.hospital_name,
          blood_type: req.blood_type,
          component_type: req.component_type || 'whole_blood',
          units_requested: req.units_requested,
          priority,
          request_date: req.request_date,
          stock_status: 'out_of_stock',
          recommendedAction,
        }
      })

    res.json({
      transferRecommendations: transferRecommendations.slice(0, 20),
      priorityActions,
      expiringSoonInventory: expiring3Days.map((item) => ({
        id: item.id,
        bloodType: item.blood_type,
        componentType: item.component_type || 'whole_blood',
        units: item.available_units,
        daysUntilExpiry: item.days_until_expiry,
      })),
      priorityRequests,
      unavailableRequests,
      summary: {
        totalRecommendations: transferRecommendations.length,
        criticalActions: priorityActions.filter((a) => a.priority === 'critical').length,
        estimatedWastageReduction: transferRecommendations.reduce((sum, rec) => sum + (rec.units || 0), 0),
      },
    })
  } catch (error) {
    console.error('Wastage prescriptions error:', error)
    res.status(500).json({ message: 'Failed to fetch wastage prescriptions' })
  }
}

const getHistoricalWastageController = async (req, res) => {
  try {
    const { days = 90 } = req.query
    const period = parseInt(days, 10)

    const [wastageByDate] = await pool.query(
      `
      SELECT 
        DATE(expiration_date) as date,
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(available_units) as wasted_units,
        COUNT(*) as wasted_count
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(expiration_date), blood_type, component_type
      ORDER BY date DESC
    `,
      [period],
    )

    const [wastageByBloodType] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(available_units) as total_wasted,
        COUNT(*) as count
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY blood_type, component_type
      ORDER BY total_wasted DESC
    `,
      [period],
    )

    const [totalWastageResult] = await pool.query(
      `
      SELECT COALESCE(SUM(available_units), 0) as total_wastage
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `,
      [period],
    )

    const totalWastage = Number(totalWastageResult[0]?.total_wastage || 0)
    const formattedWastageByBloodType = wastageByBloodType.map((item) => ({
      ...item,
      total_wasted: Number(item.total_wasted || 0),
      count: Number(item.count || 0),
    }))

    res.json({
      wastageByDate,
      wastageByBloodType: formattedWastageByBloodType,
      totalWastage,
      period,
    })
  } catch (error) {
    console.error('Historical wastage error:', error)
    res.status(500).json({ message: 'Failed to fetch historical wastage' })
  }
}

module.exports = {
  getWastagePredictionsController,
  getWastagePrescriptionsController,
  getHistoricalWastageController,
}


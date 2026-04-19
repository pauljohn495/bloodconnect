const express = require('express')

const auth = require('../middleware/auth')
const {
  getDashboardSummaryController,
  getHospitalsController,
  createHospitalController,
  updateHospitalController,
  deleteHospitalController,
} = require('../controllers/adminHospitalController')
const {
  validateHospitalIdParam,
  validateCreateHospital,
  validateUpdateHospital,
} = require('../validators/adminHospitalValidators')
const {
  getDonorsController,
  createDonorController,
  getDonorDetailsController,
  updateDonorController,
  approveDonorProfileUpdateController,
  rejectDonorProfileUpdateController,
  deleteDonorController,
  recordWalkInDonationController,
} = require('../controllers/adminDonorController')
const {
  previewDonorNotifyController,
  sendDonorNotifyController,
  listDonorNotifyHistoryController,
} = require('../controllers/adminDonorNotifyController')
const { postManualDonorRecallSmsController } = require('../controllers/donorRecallController')
const {
  getInventoryController,
  createInventoryController,
  updateInventoryController,
  deleteInventoryController,
} = require('../controllers/adminInventoryController')
const {
  createTransferController,
  getTransfersController,
  getRequestsController,
  updateRequestStatusController,
} = require('../controllers/adminTransferRequestController')
const {
  getWastagePredictionsController,
  getWastagePrescriptionsController,
  getHistoricalWastageController,
  getExpiredUnitsController,
} = require('../controllers/adminAnalyticsController')
const {
  getScheduleRequestsController,
  getScheduleRequestDetailsController,
  approveScheduleRequestController,
  rejectScheduleRequestController,
  completeScheduleRequestController,
} = require('../controllers/adminScheduleRequestController')
const {
  getOrganizationsController,
  createOrganizationController,
} = require('../controllers/adminOrganizationController')
const {
  createOrganizationDonationController,
} = require('../controllers/adminOrganizationDonationController')
const {
  getOrganizationDonationRankingController,
  getDonorDonationRankingController,
} = require('../controllers/adminDonationRankingController')
const {
  getAnnouncementsController,
  createAnnouncementController,
  updateAnnouncementController,
  deleteAnnouncementController,
} = require('../controllers/adminAnnouncementController')
const {
  getHomePostsController,
  createHomePostController,
  updateHomePostController,
  deleteHomePostController,
} = require('../controllers/adminHomePostController')
const {
  listMbdEventsController,
  createMbdEventController,
  listMbdDonorsController,
  createMbdDonorController,
  updateMbdDonorController,
  deleteMbdDonorController,
} = require('../controllers/adminMbdController')
const {
  listPrcActivitiesController,
  createPrcActivityController,
  updatePrcActivityController,
  deletePrcActivityController,
} = require('../controllers/adminPrcActivityController')
const {
  getAdminFeatureFlagsController,
  putAdminFeatureFlagsController,
} = require('../controllers/featureFlagController')
const requireSuperAdmin = require('../middleware/requireSuperAdmin')

const router = express.Router()

// All admin routes require admin role
router.use(auth(['admin', 'super_admin']))

// GET /api/admin/dashboard-summary
router.get('/dashboard-summary', getDashboardSummaryController)
// RESTful alias
router.get('/dashboard/summary', getDashboardSummaryController)

// ===== Hospitals / Partners =====

// GET /api/admin/hospitals
router.get('/hospitals', getHospitalsController)

// POST /api/admin/hospitals
router.post('/hospitals', validateCreateHospital, createHospitalController)

// PUT /api/admin/hospitals/:id
router.put('/hospitals/:id', validateHospitalIdParam, validateUpdateHospital, updateHospitalController)

// DELETE /api/admin/hospitals/:id
router.delete('/hospitals/:id', validateHospitalIdParam, deleteHospitalController)

// ===== Donors =====

// GET /api/admin/donors - list donor users
router.get('/donors', getDonorsController)

// POST /api/admin/donors - create donor user (admin side)
router.post('/donors', createDonorController)

// Donor in-app notification broadcasts (must be before /donors/:id)
router.post('/donors/notify/preview', previewDonorNotifyController)
router.post('/donors/notify/send', sendDonorNotifyController)
router.get('/donors/notify/history', listDonorNotifyHistoryController)

// GET /api/admin/donors/:id/details - donation status & stats for a donor
router.get('/donors/:id/details', getDonorDetailsController)

// POST /api/admin/donors/:id/record-donation — walk-in donation (no schedule), updates inventory
router.post('/donors/:id/record-donation', recordWalkInDonationController)

// POST /api/admin/donors/:id/recall-sms - manual donor recall SMS (Semaphore)
router.post('/donors/:id/recall-sms', postManualDonorRecallSmsController)

// POST approve/reject donor-submitted profile changes (donor role)
router.post('/donors/:id/profile-update/approve', approveDonorProfileUpdateController)
router.post('/donors/:id/profile-update/reject', rejectDonorProfileUpdateController)

// PUT /api/admin/donors/:id - update donor user (admin side)
router.put('/donors/:id', updateDonorController)

// DELETE /api/admin/donors/:id - delete donor user (admin side)
router.delete('/donors/:id', deleteDonorController)

// ===== Organizations =====

// GET /api/admin/organizations - list organizations
router.get('/organizations', getOrganizationsController)

// POST /api/admin/organizations - create organization
router.post('/organizations', createOrganizationController)

// ===== Organization Donations =====
// POST /api/admin/organization-donations - create donation entry + add inventory batches
router.post('/organization-donations', createOrganizationDonationController)

// ===== Donation Rankings =====
// GET /api/admin/donation-rankings/organizations
router.get('/donation-rankings/organizations', getOrganizationDonationRankingController)
// GET /api/admin/donation-rankings/donors
router.get('/donation-rankings/donors', getDonorDonationRankingController)

// ===== Blood Inventory =====

// GET /api/admin/inventory
router.get('/inventory', getInventoryController)

// POST /api/admin/inventory
router.post('/inventory', createInventoryController)

// PUT /api/admin/inventory/:id
router.put('/inventory/:id', updateInventoryController)

// DELETE /api/admin/inventory/:id
router.delete('/inventory/:id', deleteInventoryController)

// POST /api/admin/transfer (legacy) and /api/admin/transfers (RESTful)
router.post('/transfer', createTransferController)
router.post('/transfers', createTransferController)

// GET /api/admin/transfers
router.get('/transfers', getTransfersController)

// ===== Blood Requests (from hospitals) =====

// GET /api/admin/requests
router.get('/requests', getRequestsController)

// PATCH /api/admin/requests/:id/status
router.patch('/requests/:id/status', updateRequestStatusController)

// RESTful alias: PATCH /api/admin/requests/:id
router.patch('/requests/:id', updateRequestStatusController)

// ===== Analytics & Wastage Reduction =====

// GET /api/admin/analytics/wastage-predictions
router.get('/analytics/wastage-predictions', getWastagePredictionsController)

// GET /api/admin/analytics/wastage-prescriptions
router.get('/analytics/wastage-prescriptions', getWastagePrescriptionsController)

// GET /api/admin/analytics/historical-wastage
router.get('/analytics/historical-wastage', getHistoricalWastageController)

// GET /api/admin/analytics/expired-units
router.get('/analytics/expired-units', getExpiredUnitsController)

// ===== Schedule Requests =====

// GET /api/admin/schedule-requests - get all schedule requests
router.get('/schedule-requests', getScheduleRequestsController)

// GET /api/admin/schedule-requests/:id - get schedule request details
router.get('/schedule-requests/:id', getScheduleRequestDetailsController)

// PATCH /api/admin/schedule-requests/:id/approve - approve schedule request
router.patch('/schedule-requests/:id/approve', approveScheduleRequestController)

// PATCH /api/admin/schedule-requests/:id/reject - reject schedule request
router.patch('/schedule-requests/:id/reject', rejectScheduleRequestController)

// PATCH /api/admin/schedule-requests/:id/complete - complete schedule request
router.patch('/schedule-requests/:id/complete', completeScheduleRequestController)

// ===== Admin Users =====

const {
  getAdminsController,
  createAdminController,
  updateAdminController,
  deleteAdminController,
} = require('../controllers/adminUserController')

// GET /api/admin/admins
router.get('/admins', getAdminsController)

// POST /api/admin/admins
router.post('/admins', createAdminController)

// PUT /api/admin/admins/:id
router.put('/admins/:id', updateAdminController)

// DELETE /api/admin/admins/:id
router.delete('/admins/:id', deleteAdminController)

// ===== Announcements =====

// GET /api/admin/announcements
router.get('/announcements', getAnnouncementsController)

// POST /api/admin/announcements
router.post('/announcements', createAnnouncementController)

// PUT /api/admin/announcements/:id
router.put('/announcements/:id', updateAnnouncementController)

// DELETE /api/admin/announcements/:id
router.delete('/announcements/:id', deleteAnnouncementController)

// ===== Home Posts =====
router.get('/home-posts', getHomePostsController)
router.post('/home-posts', createHomePostController)
router.put('/home-posts/:id', updateHomePostController)
router.delete('/home-posts/:id', deleteHomePostController)

// ===== MBD (Mobile Blood Donation) — drive records & donor intake =====

// GET /api/admin/mbd-events
router.get('/mbd-events', listMbdEventsController)

// POST /api/admin/mbd-events
router.post('/mbd-events', createMbdEventController)

// GET /api/admin/mbd-events/:id/donors
router.get('/mbd-events/:id/donors', listMbdDonorsController)

// POST /api/admin/mbd-events/:id/donors
router.post('/mbd-events/:id/donors', createMbdDonorController)

// PUT /api/admin/mbd-events/:id/donors/:donorId
router.put('/mbd-events/:id/donors/:donorId', updateMbdDonorController)

// DELETE /api/admin/mbd-events/:id/donors/:donorId
router.delete('/mbd-events/:id/donors/:donorId', deleteMbdDonorController)

// ===== PRC Activities (staff calendar) =====

router.get('/prc-activities', listPrcActivitiesController)
router.post('/prc-activities', createPrcActivityController)
router.put('/prc-activities/:id', updatePrcActivityController)
router.delete('/prc-activities/:id', deletePrcActivityController)

// ===== Feature flags (module visibility) — read: admin/super_admin; write: super_admin only =====

router.get('/feature-flags', getAdminFeatureFlagsController)
router.put('/feature-flags', requireSuperAdmin, putAdminFeatureFlagsController)

module.exports = router



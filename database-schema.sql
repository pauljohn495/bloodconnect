-- BloodConnect Database Schema
-- Based on frontend requirements analysis

-- ============================================
-- USERS TABLE
-- ============================================
-- Handles authentication for all user types (Admin, Hospital, Donor/Recipient)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'hospital', 'donor', 'recipient') NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_role (role)
);

-- ============================================
-- HOSPITALS TABLE
-- ============================================
-- Partner hospitals managed by admin
CREATE TABLE hospitals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL, -- Links to users table for authentication
    hospital_name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT, -- Admin user who created this hospital
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_hospital_name (hospital_name),
    INDEX idx_is_active (is_active)
);

-- ============================================
-- DONORS TABLE
-- ============================================
-- Registered blood donors
CREATE TABLE donors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE, -- Optional: links to users table if donor has account
    donor_name VARCHAR(255) NOT NULL,
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_email VARCHAR(255),
    last_donation_date DATE,
    status ENUM('available', 'waiting', 'ineligible', 'matched', 'scheduled') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_blood_type (blood_type),
    INDEX idx_status (status),
    INDEX idx_last_donation (last_donation_date)
);

-- ============================================
-- BLOOD_INVENTORY TABLE
-- ============================================
-- Blood stock inventory managed by admin
CREATE TABLE blood_inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    units INT NOT NULL DEFAULT 0,
    available_units INT NOT NULL DEFAULT 0,
    reserved_units INT NOT NULL DEFAULT 0,
    expiration_date DATE NOT NULL,
    status ENUM('available', 'reserved', 'expired', 'used', 'discarded') DEFAULT 'available',
    added_by INT, -- Admin user who added this stock
    hospital_id INT, -- Optional: if stock is associated with a specific hospital
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
    INDEX idx_blood_type (blood_type),
    INDEX idx_expiration_date (expiration_date),
    INDEX idx_status (status),
    INDEX idx_hospital_id (hospital_id),
    CHECK (units >= 0),
    CHECK (available_units >= 0),
    CHECK (reserved_units >= 0),
    CHECK (available_units + reserved_units <= units)
);

-- ============================================
-- BLOOD_REQUESTS TABLE
-- ============================================
-- Blood requests from hospitals to admin
CREATE TABLE blood_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    hospital_id INT NOT NULL,
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    units_requested INT NOT NULL,
    units_approved INT DEFAULT 0,
    status ENUM('pending', 'approved', 'rejected', 'fulfilled', 'cancelled') DEFAULT 'pending',
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT, -- Admin user who approved/rejected
    approved_at TIMESTAMP NULL,
    fulfilled_at TIMESTAMP NULL,
    notes TEXT,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_hospital_id (hospital_id),
    INDEX idx_status (status),
    INDEX idx_request_date (request_date),
    INDEX idx_blood_type (blood_type),
    CHECK (units_requested > 0),
    CHECK (units_approved >= 0)
);

-- ============================================
-- DONATIONS TABLE
-- ============================================
-- Donation records/history
CREATE TABLE donations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    donor_id INT NOT NULL,
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    donation_date DATE NOT NULL,
    location VARCHAR(255), -- Hospital or donation center name
    hospital_id INT, -- Hospital where donation occurred
    status ENUM('scheduled', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
    units_donated DECIMAL(4,2) DEFAULT 1.0, -- Typically 1 unit, but can be fractional
    inventory_id INT, -- Links to blood_inventory if donation was added to stock
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
    FOREIGN KEY (inventory_id) REFERENCES blood_inventory(id) ON DELETE SET NULL,
    INDEX idx_donor_id (donor_id),
    INDEX idx_donation_date (donation_date),
    INDEX idx_status (status),
    INDEX idx_blood_type (blood_type)
);

-- ============================================
-- REQUEST_FULFILLMENTS TABLE
-- ============================================
-- Tracks which inventory items fulfill which requests
CREATE TABLE request_fulfillments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    inventory_id INT NOT NULL,
    units_fulfilled INT NOT NULL,
    fulfilled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES blood_inventory(id) ON DELETE CASCADE,
    INDEX idx_request_id (request_id),
    INDEX idx_inventory_id (inventory_id),
    CHECK (units_fulfilled > 0)
);

-- ============================================
-- NOTIFICATIONS TABLE (Optional)
-- ============================================
-- System notifications for users
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Available blood stock summary by type
CREATE VIEW v_blood_stock_summary AS
SELECT 
    blood_type,
    SUM(available_units) as total_available,
    SUM(reserved_units) as total_reserved,
    SUM(units) as total_units,
    COUNT(*) as stock_count
FROM blood_inventory
WHERE status = 'available' AND expiration_date > CURDATE()
GROUP BY blood_type;

-- View: Active donors summary
CREATE VIEW v_active_donors_summary AS
SELECT 
    blood_type,
    COUNT(*) as donor_count,
    COUNT(CASE WHEN last_donation_date IS NULL OR last_donation_date < DATE_SUB(CURDATE(), INTERVAL 3 MONTH) THEN 1 END) as eligible_donors
FROM donors
WHERE status IN ('available', 'waiting')
GROUP BY blood_type;

-- View: Pending requests summary
CREATE VIEW v_pending_requests_summary AS
SELECT 
    br.blood_type,
    COUNT(*) as request_count,
    SUM(br.units_requested) as total_units_requested,
    GROUP_CONCAT(h.hospital_name SEPARATOR ', ') as requesting_hospitals
FROM blood_requests br
JOIN hospitals h ON br.hospital_id = h.id
WHERE br.status = 'pending'
GROUP BY br.blood_type;

-- ============================================
-- TRIGGERS FOR DATA INTEGRITY
-- ============================================

-- Trigger: Update donor's last_donation_date when donation is completed
DELIMITER //
CREATE TRIGGER trg_update_donor_last_donation
AFTER UPDATE ON donations
FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE donors 
        SET last_donation_date = NEW.donation_date,
            status = 'available'
        WHERE id = NEW.donor_id;
    END IF;
END//
DELIMITER ;

-- Trigger: Update inventory status when expiration date passes
DELIMITER //
CREATE TRIGGER trg_check_inventory_expiration
BEFORE UPDATE ON blood_inventory
FOR EACH ROW
BEGIN
    IF NEW.expiration_date < CURDATE() AND NEW.status = 'available' THEN
        SET NEW.status = 'expired';
    END IF;
END//
DELIMITER ;

-- Trigger: Update available/reserved units when request is fulfilled
DELIMITER //
CREATE TRIGGER trg_update_inventory_on_fulfillment
AFTER INSERT ON request_fulfillments
FOR EACH ROW
BEGIN
    UPDATE blood_inventory
    SET available_units = available_units - NEW.units_fulfilled,
        reserved_units = reserved_units + NEW.units_fulfilled
    WHERE id = NEW.inventory_id;
END//
DELIMITER ;

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- Create default admin user (password should be hashed in production)
-- Password: 'admin123' (should be hashed using bcrypt)
-- INSERT INTO users (username, email, password_hash, role, full_name) 
-- VALUES ('admin', 'admin@bloodconnect.com', '$2b$10$...', 'admin', 'System Administrator');


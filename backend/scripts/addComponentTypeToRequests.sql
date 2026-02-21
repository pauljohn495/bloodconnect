-- Add component_type column to blood_requests table
ALTER TABLE blood_requests 
ADD COLUMN component_type ENUM('whole_blood', 'platelets', 'plasma') DEFAULT 'whole_blood' AFTER blood_type;

-- Update existing records to have 'whole_blood' as default
UPDATE blood_requests 
SET component_type = 'whole_blood' 
WHERE component_type IS NULL;

-- Add component_type column to schedule_requests table
ALTER TABLE schedule_requests 
ADD COLUMN component_type ENUM('whole_blood', 'platelets', 'plasma') DEFAULT 'whole_blood' AFTER preferred_time;

-- Update existing records to have 'whole_blood' as default
UPDATE schedule_requests 
SET component_type = 'whole_blood' 
WHERE component_type IS NULL;

-- Add Central Team role (subordinate to Ops Head; configures master data, no PR approval).
ALTER TYPE "Role" ADD VALUE 'CENTRAL_TEAM' BEFORE 'OPS_HEAD';

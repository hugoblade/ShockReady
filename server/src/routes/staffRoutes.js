import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  listOrganizationStaff,
  deactivateOrganizationStaff,
  createOrganizationStaff,
} from "../controllers/staffController.js";

const router = Router();

// List staff in the administrator's organization.
router.get("/", authenticate, listOrganizationStaff);

// Deactivate a staff member.
router.patch(
  "/:staffId/deactivate",
  authenticate,
  deactivateOrganizationStaff
);

// Create a staff account for the administrator's organization.
router.post(
  "/",
  authenticate,
  createOrganizationStaff
);

export default router;
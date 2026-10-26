import { Router } from "express";
import {
  listPendingOrganizations,
  registerOrganization,
  updateOrganizationApproval,
} from "../controllers/organizationController.js";
import {
  authenticate,
  requireSystemAdmin,
} from "../middleware/authenticate.js";

const router = Router();

// Public organization registration
router.post("/register", registerOrganization);

// System administrator only
router.get("/pending", authenticate, requireSystemAdmin, listPendingOrganizations);

router.patch(
  "/:id/approval",
  authenticate,
  requireSystemAdmin,
  updateOrganizationApproval
);

export default router;
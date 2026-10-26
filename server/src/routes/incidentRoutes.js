import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { optionalAuthenticate } from "../middleware/optionalAuthenticate.js";
import {
  createIncident,
  listIncidents,
  listMyIncidents,
  listMyAssignments,
  listPublicIncidents,
  getIncidentById,
  updateIncidentStatus,
  verifyIncident,
  assignIncident,
  acceptAssignment,
  startIncidentResponse,
  createResourceDispatch,
  updateResourceDispatchStatus,
  confirmResourceReceipt,
  getIncidentDispatchHistory,
  listMyResourceDispatches,
} from "../controllers/incidentcontroller.js";

const router = Router();

router.post("/", optionalAuthenticate, createIncident);

router.get("/public", listPublicIncidents);

router.get("/mine", authenticate, listMyIncidents);

router.get("/assignments/mine", authenticate, listMyAssignments);

router.get("/dispatches/mine", authenticate, listMyResourceDispatches);

router.get("/", authenticate, listIncidents);

router.post("/:id/verify", authenticate, verifyIncident);

router.post("/:id/assign", authenticate, assignIncident);

router.patch("/:id/status", authenticate, updateIncidentStatus);

router.patch(
  "/assignments/:id/accept",
  authenticate,
  acceptAssignment
);

router.patch(
  "/assignments/:id/start",
  authenticate,
  startIncidentResponse
);

router.post(
  "/:id/dispatches",
  authenticate,
  createResourceDispatch
);

router.patch(
  "/dispatches/:id/status",
  authenticate,
  updateResourceDispatchStatus
);

router.post(
  "/dispatches/:id/confirmations",
  authenticate,
  confirmResourceReceipt
);

router.get("/:id", authenticate, getIncidentById);

router.get(
  "/:id/dispatches",
  authenticate,
  getIncidentDispatchHistory
);
export default router;

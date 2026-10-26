import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import authRoutes from "./authRoutes.js";
import incidentRoutes from "./incidentRoutes.js";
import organizationRoutes from "./organizationRoutes.js";
import staffRoutes from "./staffRoutes.js";
import { authenticate } from "../middleware/authenticate.js";
import { prisma } from "../config/prisma.js";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/incidents", incidentRoutes);
router.use("/organizations", organizationRoutes);
router.use("/staff", staffRoutes);

router.get("/auth/me", authenticate, async (request, response, next) => {
  try {
    // System administrators are identified through verified Supabase app metadata.
    if (request.user.appMetadata?.role === "SYSTEM_ADMIN") {
      return response.status(200).json({
        success: true,
        user: {
          id: request.user.id,
          email: request.user.email,
          role: "SYSTEM_ADMIN",
          active: true,
        },
      });
    }

    // Retrieve the staff member's actual role from PostgreSQL.
    const staff = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        active: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!staff) {
      return response.status(200).json({
        success: true,
        user: {
          id: request.user.id,
          email: request.user.email,
          role: "RESIDENT",
          active: true,
        },
      });
    }

    if (!staff.active) {
      return response.status(403).json({
        success: false,
        message: "Your staff account is inactive.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization has not been approved.",
      });
    }

    return response.status(200).json({
      success: true,
      user: {
        id: request.user.id,
        email: request.user.email,
        fullName: staff.fullName,
        role: staff.role,
        active: staff.active,
        staffId: staff.id,
        organization: staff.organization,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

import { prisma } from "../config/prisma.js";
import { supabaseAdmin } from "../config/supabaseAdmin.js";

// List staff belonging to an approved organization's operations team.
export const listOrganizationStaff = async (request, response, next) => {
  try {
    const adminProfile = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      select: {
        organizationId: true,
        role: true,
        active: true,
        organization: {
          select: {
            status: true,
          },
        },
      },
    });

    if (
      !adminProfile ||
      !adminProfile.active ||
      !["ORG_ADMIN", "MUNICIPAL_OFFICIAL"].includes(adminProfile.role)
    ) {
      return response.status(403).json({
        success: false,
        message: "Active organization operations staff access is required.",
      });
    }

    if (adminProfile.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization is not approved.",
      });
    }

    const staff = await prisma.staffProfile.findMany({
      where: {
        organizationId: adminProfile.organizationId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return response.status(200).json({
      success: true,
      count: staff.length,
      staff,
    });
  } catch (error) {
    return next(error);
  }
};

// Deactivate a staff member within the administrator's organization.
export const deactivateOrganizationStaff = async (
  request,
  response,
  next
) => {
  try {
    const { staffId } = request.params;

    const adminProfile = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      select: {
        id: true,
        organizationId: true,
        role: true,
        active: true,
        organization: {
          select: {
            status: true,
          },
        },
      },
    });

    if (
      !adminProfile ||
      !adminProfile.active ||
      adminProfile.role !== "ORG_ADMIN"
    ) {
      return response.status(403).json({
        success: false,
        message: "Active organization administrator access is required.",
      });
    }

    if (adminProfile.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization is not approved.",
      });
    }

    if (staffId === adminProfile.id) {
      return response.status(400).json({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    }

    const targetStaff = await prisma.staffProfile.findFirst({
      where: {
        id: staffId,
        organizationId: adminProfile.organizationId,
      },
      select: {
        id: true,
        active: true,
      },
    });

    if (!targetStaff) {
      return response.status(404).json({
        success: false,
        message: "Staff member not found in your organization.",
      });
    }

    if (!targetStaff.active) {
      return response.status(409).json({
        success: false,
        message: "This staff member is already inactive.",
      });
    }

    await prisma.staffProfile.update({
      where: {
        id: targetStaff.id,
      },
      data: {
        active: false,
      },
    });

    return response.status(200).json({
      success: true,
      message: "Staff member deactivated successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

// Create a staff account for an approved organization.
export const createOrganizationStaff = async (
  request,
  response,
  next
) => {
  let createdAuthUserId = null;

  try {
    const { fullName, email, phone, password, role } = request.body;

    // Validate the required fields.
    if (!fullName || !email || !password || !role) {
      return response.status(400).json({
        success: false,
        message: "Full name, email, password, and role are required.",
      });
    }

    const allowedRoles = [
      "ORG_ADMIN",
      "MUNICIPAL_OFFICIAL",
      "NGO_STAFF",
      "RESPONDER",
      "RESOURCE_COORDINATOR",
    ];

    if (!allowedRoles.includes(role)) {
      return response.status(400).json({
        success: false,
        message: "Invalid staff role.",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return response.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find the requesting administrator's profile.
    const adminProfile = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      select: {
        organizationId: true,
        role: true,
        active: true,
        organization: {
          select: {
            status: true,
          },
        },
      },
    });

    if (
      !adminProfile ||
      !adminProfile.active ||
      adminProfile.role !== "ORG_ADMIN"
    ) {
      return response.status(403).json({
        success: false,
        message: "Active organization administrator access is required.",
      });
    }

    if (adminProfile.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization is not approved.",
      });
    }

    // Prevent duplicate staff profiles.
    const existingStaff = await prisma.staffProfile.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (existingStaff) {
      return response.status(409).json({
        success: false,
        message: "A staff profile with this email already exists.",
      });
    }

    // Create the authentication account in Supabase.
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: false,
      });

    if (authError) {
      return response.status(400).json({
        success: false,
        message: authError.message,
      });
    }

    createdAuthUserId = authData.user.id;

    // Create the corresponding staff profile in PostgreSQL.
    const staff = await prisma.staffProfile.create({
      data: {
        authUserId: createdAuthUserId,
        organizationId: adminProfile.organizationId,
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        role,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return response.status(201).json({
      success: true,
      message: "Staff account created successfully.",
      staff,
    });
  } catch (error) {
    // Avoid leaving an authentication account without its staff profile.
    if (createdAuthUserId) {
      const { error: cleanupError } =
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);

      if (cleanupError) {
        console.error(
          "Could not clean up the incomplete staff account:",
          cleanupError.message
        );
      }
    }

    return next(error);
  }
};
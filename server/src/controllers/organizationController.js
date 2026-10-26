import { prisma } from "../config/prisma.js";

export const listPendingOrganizations = async (_request, response, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        phone: true,
        district: true,
        province: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return response.status(200).json({
      success: true,
      organizations,
    });
  } catch (error) {
    return next(error);
  }
};

export const registerOrganization = async (request, response, next) => {
  try {
    const {
      name,
      type,
      email,
      phone,
      address,
      district,
      province,
    } = request.body;

    if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
      return response.status(400).json({
        success: false,
        message: "A valid organization name is required.",
      });
    }

    const allowedTypes = [
      "MUNICIPALITY",
      "NGO",
      "GOVERNMENT_AGENCY",
      "EMERGENCY_SERVICE",
      "OTHER",
    ];

    if (!allowedTypes.includes(type)) {
      return response.status(400).json({
        success: false,
        message: "A valid organization type is required.",
      });
    }

    if (
      email !== undefined &&
      email !== null &&
      (typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    ) {
      return response.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
    }

    if (
      email !== undefined &&
      email !== null &&
      await prisma.organization.findUnique({
        where: { email: email.trim().toLowerCase() },
      })
    ) {
      return response.status(409).json({
        success: false,
        message: "An organization with this email already exists.",
      });
    }

    const optionalFields = {
      phone,
      address,
      district,
      province,
    };

    for (const [field, value] of Object.entries(optionalFields)) {
      if (
        value !== undefined &&
        value !== null &&
        typeof value !== "string"
      ) {
        return response.status(400).json({
          success: false,
          message: `${field} must be a string.`,
        });
      }
    }

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        type,
        email: email?.trim().toLowerCase() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        district: district?.trim() || null,
        province: province?.trim() || null,
        status: "PENDING",
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        email: true,
        createdAt: true,
      },
    });

    return response.status(201).json({
      success: true,
      message: "Organization registration submitted for approval.",
      organization,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return response.status(409).json({
        success: false,
        message: "An organization with this email already exists.",
      });
    }

    return next(error);
  }
};

export const updateOrganizationApproval = async (
  request,
  response,
  next
) => {
  try {
    const { id } = request.params;
    const { status } = request.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return response.status(400).json({
        success: false,
        message: "Status must be APPROVED or REJECTED.",
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return response.status(404).json({
        success: false,
        message: "Organization not found.",
      });
    }

    if (organization.status !== "PENDING") {
      return response.status(409).json({
        success: false,
        message: "Only pending organizations can be reviewed.",
      });
    }

    const updatedOrganization = await prisma.organization.updateMany({
      where: {
        id,
        status: "PENDING",
      },
      data: {
        status,
      },
    });

    if (updatedOrganization.count === 0) {
      return response.status(409).json({
        success: false,
        message: "This organization has already been reviewed.",
      });
    }

    return response.status(200).json({
      success: true,
      message: `Organization ${status.toLowerCase()} successfully.`,
      organization: {
        id: organization.id,
        name: organization.name,
        status,
      },
    });
  } catch (error) {
    return next(error);
  }
};
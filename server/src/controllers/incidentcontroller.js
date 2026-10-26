
import { prisma } from "../config/prisma.js";

const allowedTransitions = {
  REPORTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED"],
  VERIFIED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  REJECTED: [],
};

const permittedRoles = {
  UNDER_REVIEW: ["ORG_ADMIN", "MUNICIPAL_OFFICIAL", "NGO_STAFF"],
  VERIFIED: ["ORG_ADMIN", "MUNICIPAL_OFFICIAL", "NGO_STAFF"],
  REJECTED: ["ORG_ADMIN", "MUNICIPAL_OFFICIAL", "NGO_STAFF"],
  ASSIGNED: ["ORG_ADMIN", "MUNICIPAL_OFFICIAL"],
  IN_PROGRESS: ["ORG_ADMIN", "MUNICIPAL_OFFICIAL", "RESPONDER"],
  RESOLVED: ["ORG_ADMIN", "MUNICIPAL_OFFICIAL", "RESPONDER"],
};

export const updateIncidentStatus = async (request, response, next) => {
  try {
    const { id } = request.params;
    const { newStatus, notes } = request.body;

    if (
      typeof newStatus !== "string" ||
      !Object.hasOwn(allowedTransitions, newStatus)
    ) {
      return response.status(400).json({
        success: false,
        message: "A valid newStatus is required.",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      typeof notes !== "string"
    ) {
      return response.status(400).json({
        success: false,
        message: "Notes must be a string.",
      });
    }

    if (typeof notes === "string" && notes.length > 2000) {
      return response.status(400).json({
        success: false,
        message: "Notes cannot exceed 2000 characters.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    if (!permittedRoles[newStatus]?.includes(staff.role)) {
      return response.status(403).json({
        success: false,
        message: "Your staff role cannot perform this status change.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incidentReport.findUnique({
        where: { id },
      });

      if (!incident) {
        const error = new Error("Incident not found.");
        error.status = 404;
        throw error;
      }

      if (!allowedTransitions[incident.status]?.includes(newStatus)) {
        const error = new Error(
          `Status cannot change from ${incident.status} to ${newStatus}.`
        );
        error.status = 409;
        throw error;
      }

      // Responders may only update incidents assigned to them.
      if (staff.role === "RESPONDER") {
        const assignment = await tx.responseAssignment.findFirst({
          where: {
            incidentId: id,
            assignedStaffId: staff.id,
            status: {
              in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"],
            },
          },
        });

        if (!assignment) {
          const error = new Error(
            "You must be assigned to this incident to update it."
          );
          error.status = 403;
          throw error;
        }
      }

      const updatedIncident = await tx.incidentReport.update({
        where: { id },
        data: {
          status: newStatus,
          resolvedAt:
            newStatus === "RESOLVED" ? new Date() : null,
        },
      });

      if (newStatus === "RESOLVED") {
        await tx.responseAssignment.updateMany({
          where: {
            incidentId: id,
            status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
          },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          oldStatus: incident.status,
          newStatus,
          changedById: staff.id,
          notes: notes?.trim() || null,
        },
      });

      return updatedIncident;
    });

    return response.status(200).json({
      success: true,
      message: "Incident status updated successfully.",
      incident: result,
    });
  } catch (error) {
    return next(error);
  }
};


const validCategories = [
  "FLOOD",
  "STORM",
  "DROUGHT",
  "FIRE",
  "WATER",
  "ELECTRICITY",
  "ROAD_DAMAGE",
  "HEALTH",
  "OTHER",
];

const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const createIncident = async (request, response, next) => {
  try {
    const {
      title = "Incident report",
      category,
      severity = "MEDIUM",
      description,
      province,
      district,
      community,
      locationDetails,
      latitude,
      longitude,
      reporterPhone,
      submissionMethod = "WEB",
    } = request.body ?? {};

    // Validate required fields.
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150 ||
      typeof category !== "string" ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof province !== "string" ||
      !province.trim() ||
      typeof district !== "string" ||
      !district.trim()
    ) {
      return response.status(400).json({
        success: false,
        message: "Category, description, province, and district are required.",
      });
    }

    if (!validCategories.includes(category)) {
      return response.status(400).json({
        success: false,
        message: "Invalid incident category.",
      });
    }

    if (!validSeverities.includes(severity)) {
      return response.status(400).json({
        success: false,
        message: "Invalid incident severity.",
      });
    }

    if (
      description.length > 5000 ||
      province.length > 100 ||
      district.length > 100 ||
      (community != null &&
        (typeof community !== "string" || community.length > 150)) ||
      (locationDetails != null &&
        (typeof locationDetails !== "string" ||
          locationDetails.length > 500)) ||
      (reporterPhone != null &&
        (typeof reporterPhone !== "string" || reporterPhone.length > 30))
    ) {
      return response.status(400).json({
        success: false,
        message: "One or more fields exceed their allowed length.",
      });
    }

    if (
      (latitude != null &&
        (typeof latitude !== "number" ||
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90)) ||
      (longitude != null &&
        (typeof longitude !== "number" ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180))
    ) {
      return response.status(400).json({
        success: false,
        message: "Latitude or longitude is invalid.",
      });
    }

    if (
      (latitude == null) !== (longitude == null)
    ) {
      return response.status(400).json({
        success: false,
        message: "Latitude and longitude must be provided together.",
      });
    }

    if (!["WEB", "USSD"].includes(submissionMethod)) {
      return response.status(400).json({
        success: false,
        message: "Submission method must be WEB or USSD.",
      });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        title: title.trim(),
        reporterAuthUserId: request.user?.id ?? null,
        category,
        severity,
        description: description.trim(),
        province: province.trim(),
        district: district.trim(),
        community: community?.trim() || null,
        locationDetails: locationDetails?.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        reporterPhone: reporterPhone?.trim() || null,
        submissionMethod,
      },
    });

    return response.status(201).json({
      success: true,
      message: "Incident report submitted successfully.",
      incident,
    });
  } catch (error) {
    return next(error);
  }
};

export const listMyIncidents = async (request, response, next) => {
  try {
    const incidents = await prisma.incidentReport.findMany({
      where: { reporterAuthUserId: request.user.id },
      orderBy: { reportedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        category: true,
        severity: true,
        status: true,
        description: true,
        province: true,
        district: true,
        community: true,
        locationDetails: true,
        latitude: true,
        longitude: true,
        reportedAt: true,
      },
    });

    return response.status(200).json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPublicIncidents = async (_request, response, next) => {
  try {
    const incidents = await prisma.incidentReport.findMany({
      where: {
        status: "VERIFIED",
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { reportedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        description: true,
        province: true,
        district: true,
        latitude: true,
        longitude: true,
        reportedAt: true,
      },
    });

    return response.status(200).json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    return next(error);
  }
};

export const listMyAssignments = async (request, response, next) => {
  try {
    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (
      !staff ||
      !staff.active ||
      staff.role !== "RESPONDER" ||
      staff.organization.status !== "APPROVED"
    ) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    const assignments = await prisma.responseAssignment.findMany({
      where: {
        assignedStaffId: staff.id,
        status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
      },
      include: {
        incident: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
            category: true,
            severity: true,
            status: true,
            description: true,
            province: true,
            district: true,
            community: true,
            locationDetails: true,
            latitude: true,
            longitude: true,
            reportedAt: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return response.status(200).json({
      success: true,
      assignments,
    });
  } catch (error) {
    return next(error);
  }
};


export const listIncidents = async (request, response, next) => {
  try {
    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    const {
      status,
      category,
      severity,
      province,
      district,
      page = "1",
      limit = "20",
    } = request.query;

    const allowedStatuses = [
      "REPORTED",
      "UNDER_REVIEW",
      "VERIFIED",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
      "REJECTED",
    ];

    const allowedCategories = [
      "FLOOD",
      "STORM",
      "DROUGHT",
      "FIRE",
      "WATER",
      "ELECTRICITY",
      "ROAD_DAMAGE",
      "HEALTH",
      "OTHER",
    ];

    const allowedSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

    if (status && !allowedStatuses.includes(status)) {
      return response.status(400).json({
        success: false,
        message: "Invalid incident status filter.",
      });
    }

    if (category && !allowedCategories.includes(category)) {
      return response.status(400).json({
        success: false,
        message: "Invalid incident category filter.",
      });
    }

    if (severity && !allowedSeverities.includes(severity)) {
      return response.status(400).json({
        success: false,
        message: "Invalid incident severity filter.",
      });
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return response.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    const where = {
      ...(status && { status }),
      ...(category && { category }),
      ...(severity && { severity }),
      ...(province && { province: { equals: province, mode: "insensitive" } }),
      ...(district && { district: { equals: district, mode: "insensitive" } }),
    };

    const [incidents, total] = await prisma.$transaction([
      prisma.incidentReport.findMany({
        where,
        orderBy: { reportedAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          category: true,
          severity: true,
          status: true,
          description: true,
          province: true,
          district: true,
          community: true,
          latitude: true,
          longitude: true,
          submissionMethod: true,
          reportedAt: true,
          updatedAt: true,
        },
      }),
      prisma.incidentReport.count({ where }),
    ]);

    return response.status(200).json({
      success: true,
      incidents,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyIncident = async (request, response, next) => {
  try {
    const { id } = request.params;
    const { decision, notes } = request.body;

    const validDecisions = [
      "VERIFIED",
      "REJECTED",
      "NEEDS_MORE_INFORMATION",
    ];

    const allowedRoles = [
      "ORG_ADMIN",
      "MUNICIPAL_OFFICIAL",
      "NGO_STAFF",
    ];

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid incident ID is required.",
      });
    }

    if (!validDecisions.includes(decision)) {
      return response.status(400).json({
        success: false,
        message: "Invalid verification decision.",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      typeof notes !== "string"
    ) {
      return response.status(400).json({
        success: false,
        message: "Notes must be a string.",
      });
    }

    if (typeof notes === "string" && notes.length > 2000) {
      return response.status(400).json({
        success: false,
        message: "Notes cannot exceed 2000 characters.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    if (!allowedRoles.includes(staff.role)) {
      return response.status(403).json({
        success: false,
        message: "Your staff role cannot verify incidents.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incidentReport.findUnique({
        where: { id },
      });

      if (!incident) {
        const error = new Error("Incident not found.");
        error.status = 404;
        throw error;
      }

      if (incident.status !== "UNDER_REVIEW") {
        const error = new Error(
          "Only incidents under review can be verified."
        );
        error.status = 409;
        throw error;
      }

      const existingVerification = await tx.reportVerification.findFirst({
        where: {
          incidentId: id,
          organizationId: staff.organizationId,
        },
      });

      if (existingVerification) {
        const error = new Error(
          "Your organization has already submitted a verification decision for this incident."
        );
        error.status = 409;
        throw error;
      }

      const verification = await tx.reportVerification.create({
        data: {
          incidentId: id,
          organizationId: staff.organizationId,
          staffId: staff.id,
          decision,
          notes: notes?.trim() || null,
        },
      });

      const newStatus =
        decision === "VERIFIED"
          ? "VERIFIED"
          : decision === "REJECTED"
            ? "REJECTED"
            : "UNDER_REVIEW";

      const updatedIncident = await tx.incidentReport.update({
        where: { id },
        data: {
          status: newStatus,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          oldStatus: incident.status,
          newStatus,
          changedById: staff.id,
          notes:
            `Verification decision: ${decision}` +
            (notes?.trim() ? ` — ${notes.trim()}` : ""),
        },
      });

      return {
        verification,
        incident: updatedIncident,
      };
    });

    return response.status(201).json({
      success: true,
      message: "Incident verification decision recorded successfully.",
      verification: result.verification,
      incident: result.incident,
    });
  } catch (error) {
    return next(error);
  }
};


export const assignIncident = async (request, response, next) => {
  try {
    const { id } = request.params;
    const { assignedStaffId, instructions } = request.body;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid incident ID is required.",
      });
    }

    if (
      typeof assignedStaffId !== "string" ||
      !uuidPattern.test(assignedStaffId)
    ) {
      return response.status(400).json({
        success: false,
        message: "A valid responder staff ID is required.",
      });
    }

    if (
      instructions !== undefined &&
      instructions !== null &&
      typeof instructions !== "string"
    ) {
      return response.status(400).json({
        success: false,
        message: "Instructions must be a string.",
      });
    }

    if (
      typeof instructions === "string" &&
      instructions.length > 2000
    ) {
      return response.status(400).json({
        success: false,
        message: "Instructions cannot exceed 2000 characters.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    if (
      !["ORG_ADMIN", "MUNICIPAL_OFFICIAL"].includes(staff.role)
    ) {
      return response.status(403).json({
        success: false,
        message: "Your staff role cannot assign incidents.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incidentReport.findUnique({
        where: { id },
      });

      if (!incident) {
        const error = new Error("Incident not found.");
        error.status = 404;
        throw error;
      }

      if (incident.status !== "VERIFIED") {
        const error = new Error(
          "Only verified incidents can be assigned."
        );
        error.status = 409;
        throw error;
      }

      const responder = await tx.staffProfile.findUnique({
        where: {
          id: assignedStaffId,
        },
        include: {
          organization: true,
        },
      });

      if (!responder || !responder.active) {
        const error = new Error(
          "The selected responder does not exist or is inactive."
        );
        error.status = 400;
        throw error;
      }

      if (responder.role !== "RESPONDER") {
        const error = new Error(
          "The selected staff member does not have the RESPONDER role."
        );
        error.status = 400;
        throw error;
      }

      if (responder.organization.status !== "APPROVED") {
        const error = new Error(
          "The responder's organization must be approved."
        );
        error.status = 400;
        throw error;
      }

      if (responder.organizationId !== staff.organizationId) {
        const error = new Error(
          "The responder must belong to your organization."
        );
        error.status = 403;
        throw error;
      }

      const existingAssignment =
        await tx.responseAssignment.findFirst({
          where: {
            incidentId: id,
            status: {
              in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"],
            },
          },
        });

      if (existingAssignment) {
        const error = new Error(
          "This incident already has an active assignment."
        );
        error.status = 409;
        throw error;
      }

      const assignment = await tx.responseAssignment.create({
        data: {
          incidentId: id,
          organizationId: staff.organizationId,
          assignedStaffId: responder.id,
          instructions: instructions?.trim() || null,
          status: "ASSIGNED",
        },
      });

      const updatedIncident = await tx.incidentReport.update({
        where: { id },
        data: {
          status: "ASSIGNED",
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          oldStatus: incident.status,
          newStatus: "ASSIGNED",
          changedById: staff.id,
          notes: "Incident assigned to a responder.",
        },
      });

      return {
        assignment,
        incident: updatedIncident,
      };
    });

    return response.status(201).json({
      success: true,
      message: "Incident assigned successfully.",
      assignment: result.assignment,
      incident: result.incident,
    });
  } catch (error) {
    return next(error);
  }
};

export const acceptAssignment = async (request, response, next) => {
  try {
    const { id } = request.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid assignment ID is required.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.role !== "RESPONDER") {
      return response.status(403).json({
        success: false,
        message: "Only responders can accept assignments.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.responseAssignment.findUnique({
        where: {
          id,
        },
        include: {
          incident: true,
        },
      });

      if (!assignment) {
        const error = new Error("Assignment not found.");
        error.status = 404;
        throw error;
      }

      if (assignment.assignedStaffId !== staff.id) {
        const error = new Error(
          "You can only accept assignments assigned to you."
        );
        error.status = 403;
        throw error;
      }

      if (assignment.status !== "ASSIGNED") {
        const error = new Error(
          "Only assignments with ASSIGNED status can be accepted."
        );
        error.status = 409;
        throw error;
      }

      if (assignment.incident.status !== "ASSIGNED") {
        const error = new Error(
          "The incident is not currently in an assignable state."
        );
        error.status = 409;
        throw error;
      }

      const updatedAssignment = await tx.responseAssignment.update({
        where: {
          id,
        },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: assignment.incidentId,
          oldStatus: assignment.incident.status,
          newStatus: assignment.incident.status,
          changedById: staff.id,
          notes: "Responder accepted the incident assignment.",
        },
      });

      return updatedAssignment;
    });

    return response.status(200).json({
      success: true,
      message: "Assignment accepted successfully.",
      assignment: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const startIncidentResponse = async (
  request,
  response,
  next
) => {
  try {
    const { id } = request.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid assignment ID is required.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.role !== "RESPONDER") {
      return response.status(403).json({
        success: false,
        message: "Only responders can start incident response.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.responseAssignment.findUnique({
        where: {
          id,
        },
        include: {
          incident: true,
        },
      });

      if (!assignment) {
        const error = new Error("Assignment not found.");
        error.status = 404;
        throw error;
      }

      if (assignment.assignedStaffId !== staff.id) {
        const error = new Error(
          "You can only start assignments assigned to you."
        );
        error.status = 403;
        throw error;
      }

      if (assignment.status !== "ACCEPTED") {
        const error = new Error(
          "You must accept the assignment before starting work."
        );
        error.status = 409;
        throw error;
      }

      if (assignment.incident.status !== "ASSIGNED") {
        const error = new Error(
          "The incident must have ASSIGNED status before work begins."
        );
        error.status = 409;
        throw error;
      }

      const updatedAssignment = await tx.responseAssignment.update({
        where: {
          id,
        },
        data: {
          status: "IN_PROGRESS",
        },
      });

      const updatedIncident = await tx.incidentReport.update({
        where: {
          id: assignment.incidentId,
        },
        data: {
          status: "IN_PROGRESS",
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: assignment.incidentId,
          oldStatus: assignment.incident.status,
          newStatus: "IN_PROGRESS",
          changedById: staff.id,
          notes: "Responder started incident response.",
        },
      });

      return {
        assignment: updatedAssignment,
        incident: updatedIncident,
      };
    });

    return response.status(200).json({
      success: true,
      message: "Incident response started successfully.",
      assignment: result.assignment,
      incident: result.incident,
    });
  } catch (error) {
    return next(error);
  }
};

export const createResourceDispatch = async (
  request,
  response,
  next
) => {
  try {
    const { id } = request.params;
    const {
      resourceName,
      quantity,
      unit,
      destination,
      notes,
    } = request.body;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid incident ID is required.",
      });
    }

    if (
      typeof resourceName !== "string" ||
      !resourceName.trim() ||
      resourceName.length > 150
    ) {
      return response.status(400).json({
        success: false,
        message: "A valid resource name is required.",
      });
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return response.status(400).json({
        success: false,
        message: "Quantity must be a positive whole number.",
      });
    }

    if (
      typeof destination !== "string" ||
      !destination.trim() ||
      destination.length > 300
    ) {
      return response.status(400).json({
        success: false,
        message: "A valid destination is required.",
      });
    }

    if (
      unit !== undefined &&
      unit !== null &&
      (typeof unit !== "string" || unit.length > 50)
    ) {
      return response.status(400).json({
        success: false,
        message: "Unit must be a string of at most 50 characters.",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      (typeof notes !== "string" || notes.length > 2000)
    ) {
      return response.status(400).json({
        success: false,
        message: "Notes must be a string of at most 2000 characters.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: {
        authUserId: request.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    if (
      !["ORG_ADMIN", "MUNICIPAL_OFFICIAL", "RESOURCE_COORDINATOR"].includes(
        staff.role
      )
    ) {
      return response.status(403).json({
        success: false,
        message: "Your staff role cannot create resource dispatches.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incidentReport.findUnique({
        where: { id },
      });

      if (!incident) {
        const error = new Error("Incident not found.");
        error.status = 404;
        throw error;
      }

      if (
        !["VERIFIED", "ASSIGNED", "IN_PROGRESS"].includes(
          incident.status
        )
      ) {
        const error = new Error(
          "Resources can only be dispatched to verified incidents that have not been rejected or resolved."
        );
        error.status = 409;
        throw error;
      }

      const dispatch = await tx.resourceDispatch.create({
        data: {
          incidentId: id,
          organizationId: staff.organizationId,
          dispatchedById: staff.id,
          resourceName: resourceName.trim(),
          quantity,
          unit: unit?.trim() || null,
          destination: destination.trim(),
          status: "PREPARING",
          notes: notes?.trim() || null,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          oldStatus: incident.status,
          newStatus: incident.status,
          changedById: staff.id,
          notes: `Resource dispatch created: ${quantity} ${unit?.trim() || ""} ${resourceName.trim()} for ${destination.trim()}.`.trim(),
        },
      });

      return dispatch;
    });

    return response.status(201).json({
      success: true,
      message: "Resource dispatch created successfully.",
      dispatch: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateResourceDispatchStatus = async (
  request,
  response,
  next
) => {
  try {
    const { id } = request.params;
    const { status } = request.body;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid dispatch ID is required.",
      });
    }

    const allowedStatuses = [
      "DISPATCHED",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      return response.status(400).json({
        success: false,
        message: "A valid dispatch status is required.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    if (
      ![
        "ORG_ADMIN",
        "MUNICIPAL_OFFICIAL",
        "RESOURCE_COORDINATOR",
      ].includes(staff.role)
    ) {
      return response.status(403).json({
        success: false,
        message: "Your staff role cannot update dispatch statuses.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const dispatch = await tx.resourceDispatch.findUnique({
        where: { id },
        include: { incident: true },
      });

      if (!dispatch) {
        const error = new Error("Resource dispatch not found.");
        error.status = 404;
        throw error;
      }

      if (dispatch.organizationId !== staff.organizationId) {
        const error = new Error(
          "You can only update dispatches belonging to your organization."
        );
        error.status = 403;
        throw error;
      }

      const allowedTransitions = {
        PREPARING: ["DISPATCHED", "CANCELLED"],
        DISPATCHED: ["IN_TRANSIT", "CANCELLED"],
        IN_TRANSIT: ["DELIVERED"],
        DELIVERED: [],
        CANCELLED: [],
      };

      if (!allowedTransitions[dispatch.status]?.includes(status)) {
        const error = new Error(
          `The dispatch cannot move from ${dispatch.status} to ${status}.`
        );
        error.status = 409;
        throw error;
      }

      const now = new Date();

      const updatedDispatch = await tx.resourceDispatch.update({
        where: { id },
        data: {
          status,
          ...(status === "DISPATCHED" && { dispatchedAt: now }),
          ...(status === "DELIVERED" && { deliveredAt: now }),
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: dispatch.incidentId,
          oldStatus: dispatch.incident.status,
          newStatus: dispatch.incident.status,
          changedById: staff.id,
          notes: `Resource dispatch ${dispatch.id} status changed from ${dispatch.status} to ${status}.`,
        },
      });

      return updatedDispatch;
    });

    return response.status(200).json({
      success: true,
      message: "Resource dispatch status updated successfully.",
      dispatch: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const confirmResourceReceipt = async (
  request,
  response,
  next
) => {
  try {
    const { id } = request.params;
    const { status, quantityReceived, notes } = request.body;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid dispatch ID is required.",
      });
    }

    const allowedStatuses = [
      "CONFIRMED",
      "PARTIALLY_RECEIVED",
      "NOT_RECEIVED",
    ];

    if (!allowedStatuses.includes(status)) {
      return response.status(400).json({
        success: false,
        message: "A valid receipt confirmation status is required.",
      });
    }

    if (
      quantityReceived !== undefined &&
      quantityReceived !== null &&
      (!Number.isInteger(quantityReceived) || quantityReceived < 0)
    ) {
      return response.status(400).json({
        success: false,
        message: "Quantity received must be a non-negative whole number.",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      (typeof notes !== "string" || notes.length > 2000)
    ) {
      return response.status(400).json({
        success: false,
        message: "Notes must be a string of at most 2000 characters.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    if (
      ![
        "ORG_ADMIN",
        "MUNICIPAL_OFFICIAL",
        "NGO_STAFF",
        "RESPONDER",
        "RESOURCE_COORDINATOR",
      ].includes(staff.role)
    ) {
      return response.status(403).json({
        success: false,
        message: "Your staff role cannot confirm resource receipt.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const dispatch = await tx.resourceDispatch.findUnique({
        where: { id },
        include: { incident: true },
      });

      if (!dispatch) {
        const error = new Error("Resource dispatch not found.");
        error.status = 404;
        throw error;
      }

      if (!["IN_TRANSIT", "DELIVERED"].includes(dispatch.status)) {
        const error = new Error(
          "Receipt can only be confirmed for resources that are in transit or marked as delivered."
        );
        error.status = 409;
        throw error;
      }

      if (
        quantityReceived !== undefined &&
        quantityReceived !== null &&
        quantityReceived > dispatch.quantity
      ) {
        const error = new Error(
          "Quantity received cannot exceed the dispatched quantity."
        );
        error.status = 400;
        throw error;
      }

      if (
        status === "CONFIRMED" &&
        quantityReceived !== undefined &&
        quantityReceived !== null &&
        quantityReceived !== dispatch.quantity
      ) {
        const error = new Error(
          "A confirmed receipt must match the dispatched quantity."
        );
        error.status = 400;
        throw error;
      }

      if (
        status === "PARTIALLY_RECEIVED" &&
        (
          quantityReceived === undefined ||
          quantityReceived === null ||
          quantityReceived <= 0 ||
          quantityReceived >= dispatch.quantity
        )
      ) {
        const error = new Error(
          "A partial receipt must be greater than zero and less than the dispatched quantity."
        );
        error.status = 400;
        throw error;
      }

      if (
        status === "NOT_RECEIVED" &&
        quantityReceived !== undefined &&
        quantityReceived !== null &&
        quantityReceived !== 0
      ) {
        const error = new Error(
          "Quantity received must be zero when resources were not received."
        );
        error.status = 400;
        throw error;
      }

      const confirmation = await tx.receiptConfirmation.create({
        data: {
          dispatchId: dispatch.id,
          confirmedById: staff.id,
          status,
          quantityReceived:
            status === "NOT_RECEIVED"
              ? 0
              : quantityReceived ?? null,
          notes: notes?.trim() || null,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: dispatch.incidentId,
          oldStatus: dispatch.incident.status,
          newStatus: dispatch.incident.status,
          changedById: staff.id,
          notes: `Resource receipt confirmation recorded for dispatch ${dispatch.id}: ${status}.`,
        },
      });

      return confirmation;
    });

    return response.status(201).json({
      success: true,
      message: "Resource receipt confirmation recorded successfully.",
      confirmation: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const listMyResourceDispatches = async (request, response, next) => {
  try {
    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (
      !staff ||
      !staff.active ||
      staff.organization.status !== "APPROVED" ||
      !["ORG_ADMIN", "MUNICIPAL_OFFICIAL", "RESOURCE_COORDINATOR"].includes(staff.role)
    ) {
      return response.status(403).json({
        success: false,
        message: "An active resource management staff profile is required.",
      });
    }

    const dispatches = await prisma.resourceDispatch.findMany({
      where: { organizationId: staff.organizationId },
      include: {
        confirmations: {
          orderBy: { confirmedAt: "desc" },
        },
        incident: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
            district: true,
            province: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return response.status(200).json({
      success: true,
      dispatches,
    });
  } catch (error) {
    return next(error);
  }
};

export const getIncidentDispatchHistory = async (
  request,
  response,
  next
) => {
  try {
    const { id } = request.params;
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid incident ID is required.",
      });
    }

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return response.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    const incident = await prisma.incidentReport.findUnique({
      where: { id },
      select: { id: true, referenceNumber: true },
    });

    if (!incident) {
      return response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
    }

    const where = {
      incidentId: id,
      organizationId: staff.organizationId,
    };

    const [dispatches, total] = await prisma.$transaction([
      prisma.resourceDispatch.findMany({
        where,
        include: {
          confirmations: {
            orderBy: { confirmedAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.resourceDispatch.count({ where }),
    ]);

    return response.status(200).json({
      success: true,
      message: "Dispatch history retrieved successfully.",
      incident,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      dispatches,
    });
  } catch (error) {
    return next(error);
  }
};

export const getIncidentById = async (request, response, next) => {
  try {
    const { id } = request.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return response.status(400).json({
        success: false,
        message: "A valid incident ID is required.",
      });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { authUserId: request.user.id },
      include: { organization: true },
    });

    if (!staff || !staff.active) {
      return response.status(403).json({
        success: false,
        message: "An active staff profile is required.",
      });
    }

    if (staff.organization.status !== "APPROVED") {
      return response.status(403).json({
        success: false,
        message: "Your organization must be approved.",
      });
    }

    const incident = await prisma.incidentReport.findUnique({
      where: { id },
      include: {
        verifications: {
          orderBy: { verifiedAt: "desc" },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            staff: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        assignments: {
          orderBy: { assignedAt: "desc" },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            assignedStaff: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          include: {
            changedBy: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      return response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
    }

    return response.status(200).json({
      success: true,
      message: "Incident details retrieved successfully.",
      incident,
    });
  } catch (error) {
    return next(error);
  }
};

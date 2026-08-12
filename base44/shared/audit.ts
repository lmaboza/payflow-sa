import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// Shared audit logging helper used by backend functions.
export async function recordAudit(base44, { businessId, user, action, entity, entityId, previousValue, newValue }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      business_id: businessId,
      user_id: user?.id || "system",
      user_name: user?.full_name || user?.email || "System",
      action,
      entity,
      entity_id: entityId || "",
      previous_value: previousValue ? JSON.stringify(previousValue) : "",
      new_value: newValue ? JSON.stringify(newValue) : "",
      date_time: new Date().toISOString()
    });
  } catch (e) {
    // audit logging must never break the main operation
  }
}
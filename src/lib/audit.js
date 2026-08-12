import { base44 } from "@/api/base44Client";

export async function logAudit(businessId, user, action, entity, entityId, prev, next) {
  try {
    await base44.entities.AuditLog.create({
      business_id: businessId,
      user_id: user?.id || "",
      user_name: user?.full_name || user?.email || "Unknown",
      action,
      entity,
      entity_id: entityId || "",
      previous_value: prev ? JSON.stringify(prev) : "",
      new_value: next ? JSON.stringify(next) : "",
      date_time: new Date().toISOString()
    });
  } catch (e) {
    // never break the main flow for audit failures
  }
}